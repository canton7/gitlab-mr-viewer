/* eslint-disable svelte/prefer-svelte-reactivity */

import { Gitlab } from "@gitbeaker/rest";
import { browser } from "$app/environment";
import { gitlabSettings } from "$lib/Settings";
import {
    Gitlab as CoreGitlab,
    type CommitablePipelineStatus,
    type DiscussionNoteSchema,
    type DiscussionSchema,
    type ExpandedUserSchema,
    type MergeRequestSchemaWithBasicLabels,
} from "@gitbeaker/core";
import { createRequesterFn, type RequestOptions, type ResourceOptions } from "@gitbeaker/requester-utils";
import { createRequestHandler } from "./GitlabUtils";
import { GitlabCache } from "./GitlabCache";

const UPDATE_PERIOD_MS = 1 * 60 * 1000;
const CACHE_FLUSH_PERIOD_MS = 15 * 60 * 1000;
// Activities which occurr within 10 mins of each other get combined
const COMBINE_ACTIVITY_TIME_MS = 10 * 60 * 1000;

export type GitlabCiStatus = CommitablePipelineStatus | "none";

export type MergeRequestType = "assignee" | "reviewer";

export interface MergeRequest {
    key: string;
    type: MergeRequestType;
    title: string;
    webUrl: string;
    createdAt: Date;
    updatedAt: Date;
    authorName: string;
    reviewerName: string | null;
    reference: string;
    isApproved: boolean;
    firstOpenNoteId: number | null;
    openDiscussions: number;
    totalDiscussions: number;
    ciStatus: GitlabCiStatus;
    ciLink: string | null;
}

export interface Activity {
    key: string;
    body: string;
    updatedAt: Date;
    noteId: number | null;
    authorName: string;
    mergeRequest: MergeRequest;
}

type State = { kind: "unconfigured" } | { kind: "loading" } | { kind: "loaded" } | { kind: "error"; error: Error };

export class GitlabClient {
    private _api: CoreGitlab | null = null;
    private _user: Promise<ExpandedUserSchema> | null = null;
    private _intervalHandle: number | null = null;

    private _state = $state<State>({ kind: "unconfigured" });
    assigned = $state<MergeRequest[] | null>(null);
    reviewing = $state<MergeRequest[] | null>(null);
    activities = $state<Activity[] | null>(null);

    setApi(api: CoreGitlab | null) {
        this._api = api;

        if (this._api) {
            this._user = this._api.Users.showCurrentUser();
            this._state = { kind: "loading" };
        } else {
            this._user = null;
            this.assigned = null;
            this.reviewing = null;
            this.activities = null;
            this._state = { kind: "unconfigured" };
        }
    }

    get state() {
        return this._state;
    }

    start() {
        this.stop();
        this._intervalHandle = setInterval(() => this.loadAsync(), UPDATE_PERIOD_MS);
        this.loadAsync();
    }

    stop() {
        if (this._intervalHandle !== null) {
            clearInterval(this._intervalHandle);
            this._intervalHandle = null;
        }
    }

    private async mapMergeRequest(
        api: CoreGitlab,
        mergeRequest: MergeRequestSchemaWithBasicLabels,
        type: MergeRequestType
    ): Promise<[MergeRequest, Activity[]]> {
        const [approvals, discussions, commitStatus] = await Promise.all([
            await api.MergeRequestApprovals.showConfiguration(mergeRequest.project_id, {
                mergerequestIId: mergeRequest.iid,
            }),
            await api.MergeRequestDiscussions.all(mergeRequest.project_id, mergeRequest.iid, {
                pagination: "keyset",
                sort: "desc",
                orderBy: "updated_at",
                perPage: 50,
            }),
            await api.Commits.allStatuses(mergeRequest.project_id, mergeRequest.sha),
        ]);

        let resolvable = 0;
        let totalDiscussions = 0;
        let firstOpenNoteId = null;
        for (const discussion of discussions) {
            // Each note corresponds to a comment in the current discussion thread
            // I *think* they should all have the same resolved/resolvable status
            if (discussion.notes != undefined && discussion.notes.length > 0) {
                const note = discussion.notes[0];
                if (note.resolvable) {
                    totalDiscussions++;
                    if (!note.resolved) {
                        firstOpenNoteId = note.id;
                        resolvable++;
                    }
                }
            }
        }

        const mr: MergeRequest = {
            key: `${mergeRequest.project_id}-${mergeRequest.id}`,
            type: type,
            title: mergeRequest.title,
            webUrl: mergeRequest.web_url,
            createdAt: new Date(mergeRequest.created_at),
            updatedAt: new Date(mergeRequest.updated_at),
            authorName: mergeRequest.author.name,
            reviewerName: mergeRequest.reviewers?.at(0)?.name ?? null,
            reference: mergeRequest.references.full.split("/").at(-1) ?? "",
            isApproved: (approvals.approved_by?.length ?? 0) > 0,
            firstOpenNoteId: firstOpenNoteId,
            openDiscussions: resolvable,
            totalDiscussions: totalDiscussions,
            ciStatus: commitStatus.at(0)?.status ?? "none",
            ciLink: commitStatus.at(0)?.target_url ?? null,
        };

        const activities = this.createActivities(type, discussions, mr);

        return [mr, activities];
    }

    private createActivities(type: MergeRequestType, discussions: DiscussionSchema[], mergeRequest: MergeRequest) {
        // Discussions are presented in as a list of threads, but each thread may have multiple comments left at
        // different times.

        const activities: Activity[] = [];

        const commentNotes: DiscussionNoteSchema[] = [];
        // let resolvedNotes: MergeRequestDiscussionNoteSchema[] = [];

        for (const discussion of discussions) {
            if (discussion.notes === undefined || discussion.notes.length == 0) {
                continue;
            }

            // These are things like system notifications, X added commits, etc
            if (discussion.individual_note) {
                let body: string | null = discussion.notes[0].body.split("\n", 2)[0];
                // We don't want to show this one
                if (body == "left review comments") {
                    body = null;
                }

                if (body) {
                    // It's technically possible for the same MR to show up in "reviewing" and "assigned"
                    activities.push({
                        key: `${discussion.id}-${type}`,
                        body: body,
                        updatedAt: new Date(discussion.notes[0].updated_at),
                        noteId: discussion.notes[0].id,
                        authorName: discussion.notes[0].author.name,
                        mergeRequest: mergeRequest,
                    });
                }
            } else {
                // We'll synthesise events for:
                // - X left N comments
                // - X closed N threads
                commentNotes.push(...discussion.notes);

                // If a thread is resolved, all times in it get a resolved status
                // if (discussion.notes[0].resolved_at != undefined) {
                //     resolvedNotes.push(discussion.notes[0] as MergeRequestDiscussionNoteSchema);
                // }
            }
        }

        function collectSimilar(
            synthesisedNoteType: string,
            notes: DiscussionNoteSchema[],
            dateGetter: (current: DiscussionNoteSchema) => Date,
            authorGetter: (current: DiscussionNoteSchema) => { id: number; name: string },
            messageGetter: (count: number) => string
        ) {
            type Collection = { end: Date; firstNote: DiscussionNoteSchema; count: number };

            const appendComments = (current: Collection) =>
                activities.push({
                    key: `${synthesisedNoteType}-${current.firstNote.id}-${type}`,
                    body: messageGetter(current.count),
                    updatedAt: current.end,
                    noteId: null,
                    authorName: authorGetter(current.firstNote).name,
                    mergeRequest: mergeRequest,
                });

            let current: Collection | null = null;
            for (const note of notes) {
                const date = dateGetter(note);
                if (
                    current != null &&
                    authorGetter(current.firstNote).id == authorGetter(current.firstNote).id &&
                    date.getTime() - current.end.getTime() < COMBINE_ACTIVITY_TIME_MS
                ) {
                    current.end = date;
                    current.count++;
                } else {
                    if (current != null) {
                        appendComments(current);
                    }
                    current = { end: date, firstNote: note, count: 1 };
                }
            }
            if (current != null) {
                appendComments(current);
            }
        }

        // First, adding comments
        commentNotes.sort((x, y) => new Date(x.updated_at).getTime() - new Date(y.updated_at).getTime());

        collectSimilar(
            "synthesised-add-comments",
            commentNotes,
            // The updated time gets updated when we resolve a comment, so we need to use the created time
            (note) => new Date(note.created_at),
            (note) => note.author,
            (count) => `added ${count} comment(s)`
        );

        // Then, resolving
        // resolvedNotes.sort((x, y) => new Date(x.resolved_at).getTime() - new Date(y.resolved_at).getTime());

        // collectSimilar(
        //     "synthesised-resolve-comments",
        //     resolvedNotes,
        //     (note) => new Date(note.resolved_at),
        //     // @ts-ignore - the type annotation is wrong, and this does contain the correct type
        //     (note) => note.resolved_by,
        //     (count) => `resolved ${count} thread(s)`
        // );

        return activities;
    }

    private async mapMergeRequests(
        api: CoreGitlab,
        merge_requests: Promise<MergeRequestSchemaWithBasicLabels[]>,
        type: MergeRequestType
    ): Promise<[MergeRequest[], Activity[]]> {
        const results = await Promise.all((await merge_requests).map((x) => this.mapMergeRequest(api, x, type)));
        return [results.map((x) => x[0]), results.flatMap((x) => x[1])];
    }

    private async doRequest(action: (api: CoreGitlab, userId: number) => Promise<void>) {
        if (!this._api) {
            return;
        }

        try {
            this._state = { kind: "loading" };
            await action(this._api, (await this._user!).id);
            this._state = { kind: "loaded" };
        } catch (err) {
            this._state = { kind: "error", error: err as Error };
        }
    }

    public async refreshAsync() {
        if (this._state.kind != "loaded" && this.state.kind != "error") {
            return;
        }

        await this.loadAsync();
    }

    private async loadAsync() {
        await this.doRequest(async (api, userId) => {
            const [[reviewing, reviewingActivity], [assigned, assignedActivity]] = await Promise.all([
                this.mapMergeRequests(
                    api,
                    api.MergeRequests.all({
                        state: "opened",
                        scope: "all",
                        reviewerId: userId,
                        orderBy: "updated_at",
                    }),
                    "reviewer"
                ),
                this.mapMergeRequests(
                    api,
                    api.MergeRequests.all({
                        state: "opened",
                        scope: "all",
                        assigneeId: userId,
                        orderBy: "updated_at",
                    }),
                    "assignee"
                ),
            ]);

            this.reviewing = reviewing;
            this.assigned = assigned;

            this.activities = reviewingActivity
                .concat(assignedActivity)
                .sort((x, y) => y.updatedAt.getTime() - x.updatedAt.getTime());
        });
    }
}

const cache = new GitlabCache();
setInterval(() => {
    cache.flush(CACHE_FLUSH_PERIOD_MS);
}, CACHE_FLUSH_PERIOD_MS);

export const gitlabClient = new GitlabClient();
gitlabSettings.subscribe((settings) => {
    if (!browser || !settings?.baseUrl || !settings?.accessToken) {
        gitlabClient.setApi(null);
    } else {
        const api = new Gitlab({
            host: "https://" + settings.baseUrl,
            token: settings.accessToken,
            requesterFn: createRequesterFn(
                (_: ResourceOptions, reqo: RequestOptions) => Promise.resolve(reqo),
                createRequestHandler(cache)
            ),
        });
        gitlabClient.setApi(api);
    }
});
