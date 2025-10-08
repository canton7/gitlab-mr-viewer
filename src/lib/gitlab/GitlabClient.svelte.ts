/* eslint-disable svelte/prefer-svelte-reactivity */

import { Gitlab } from "@gitbeaker/rest";
import { browser } from "$app/environment";
import { gitlabSettings } from "$lib/Settings";
import {
    Gitlab as CoreGitlab,
    type DiscussionNoteSchema,
    type DiscussionSchema,
    type ExpandedUserSchema,
    type MergeRequestSchemaWithBasicLabels,
} from "@gitbeaker/core";
import {
    createRequesterFn,
    GitbeakerRequestError,
    type RequestOptions,
    type ResourceOptions,
} from "@gitbeaker/requester-utils";
import { createRequestHandler } from "./GitlabUtils";
import { GitlabCache } from "./GitlabCache";
import { TicketIntegration, type Activity, type MergeRequest, type MergeRequestType } from "./Types";
import { JiraTicketIntegration } from "./JiraTicketIntegration";

const CACHE_FLUSH_PERIOD_MS = 15 * 60 * 1000;
// Activities which occurr within 10 mins of each other get combined
const COMBINE_ACTIVITY_TIME_MS = 5 * 60 * 1000;

type State = { kind: "unconfigured" } | { kind: "loading" } | { kind: "loaded" } | { kind: "error"; error: Error };

export class GitlabClient {
    private _api: CoreGitlab | null = null;
    private _user: Promise<ExpandedUserSchema> | null = null;
    private _pollInterval: number | null = null;
    private _intervalHandle: number | null = null;
    private readonly _users: Map<string, Promise<string | null>> = new Map();
    private readonly _ticketIntegrations: Map<number, Promise<TicketIntegration>> = new Map();

    private _state = $state<State>({ kind: "unconfigured" });
    assigned = $state<MergeRequest[] | null>(null);
    reviewing = $state<MergeRequest[] | null>(null);
    activities = $state<Activity[] | null>(null);

    setApi(api: CoreGitlab | null) {
        this._api = api;

        this._users.clear();
        this._ticketIntegrations.clear();
        this.assigned = null;
        this.reviewing = null;
        this.activities = null;

        if (this._api) {
            this._user = this._api.Users.showCurrentUser();
            this._state = { kind: "loading" };
        } else {
            this._user = null;

            this._state = { kind: "unconfigured" };
        }
    }

    get state() {
        return this._state;
    }

    start(pollInterval: number) {
        const oldPollInterval = this._pollInterval;

        this.stop();
        this._intervalHandle = setInterval(() => this.loadAsync(), pollInterval);

        if (oldPollInterval == null || pollInterval < oldPollInterval) {
            this.loadAsync();
        }
        this._pollInterval = pollInterval;
    }

    stop() {
        if (this._intervalHandle !== null) {
            clearInterval(this._intervalHandle);
            this._intervalHandle = null;
            this._pollInterval = null;
        }
    }

    private async mapMergeRequestAsync(
        api: CoreGitlab,
        mergeRequest: MergeRequestSchemaWithBasicLabels,
        type: MergeRequestType
    ): Promise<[MergeRequest, Activity[]]> {
        const [approvals, discussions, commitStatus] = await Promise.all([
            api.MergeRequestApprovals.showConfiguration(mergeRequest.project_id, {
                mergerequestIId: mergeRequest.iid,
            }),
            api.MergeRequestDiscussions.all(mergeRequest.project_id, mergeRequest.iid, {
                pagination: "keyset",
                sort: "desc",
                orderBy: "updated_at",
                perPage: 50,
            }),
            api.Commits.allStatuses(mergeRequest.project_id, mergeRequest.sha),
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
            assigneeName: mergeRequest.assignees?.at(0)?.name ?? null,
            reviewerName: mergeRequest.reviewers?.at(0)?.name ?? null,
            reference: mergeRequest.references.full.split("/").at(-1) ?? "",
            isApproved: (approvals.approved_by?.length ?? 0) > 0,
            firstOpenNoteId: firstOpenNoteId,
            openDiscussions: resolvable,
            totalDiscussions: totalDiscussions,
            ciStatus: commitStatus.at(0)?.status ?? "none",
            ciLink: commitStatus.at(0)?.target_url ?? null,
            ticketIntegration: await this.getTicketIntegrationAsync(mergeRequest.project_id),
        };

        const activities = await this.createActivitiesAsync(api, type, discussions, mr);

        return [mr, activities];
    }

    private async createActivitiesAsync(
        api: CoreGitlab,
        type: MergeRequestType,
        discussions: DiscussionSchema[],
        mergeRequest: MergeRequest
    ) {
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
            // Filter to system comments, otherwise if someone leaves an individual non-review non-thread comment, that
            // shows up here.
            if (discussion.individual_note && discussion.notes[0].system) {
                let body: string | null = discussion.notes[0].body.split("\n", 2)[0];
                // We don't want to show this one
                if (body == "left review comments") {
                    body = null;
                }

                if (body) {
                    // It's technically possible for the same MR to show up in "reviewing" and "assigned"
                    activities.push({
                        key: `${discussion.id}-${type}`,
                        body: await this.replaceUsernamesAsync(api, body),
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
        ): Activity[] {
            const collectedActivities: Activity[] = [];

            type Collection = { end: Date; firstNote: DiscussionNoteSchema; count: number };

            const appendComments = (current: Collection) =>
                collectedActivities.push({
                    key: `${synthesisedNoteType}-${current.firstNote.id}-${type}`,
                    body: messageGetter(current.count),
                    updatedAt: dateGetter(current.firstNote),
                    noteId: current.firstNote.id,
                    authorName: authorGetter(current.firstNote).name,
                    mergeRequest: mergeRequest,
                });

            // Author id -> collection of notes
            const currents = new Map<number, Collection>();
            // let current: Collection | null = null;
            for (const note of notes) {
                const date = dateGetter(note);
                const authorId = authorGetter(note).id;

                // Is there an open collection for this author, which is recent enough to combine?
                const current = currents.get(authorId);
                if (current && date.getTime() - current.end.getTime() < COMBINE_ACTIVITY_TIME_MS) {
                    current.end = date;
                    current.count++;
                } else {
                    // Either there's no open collection for this author, or there is and it's too old
                    if (current) {
                        appendComments(current);
                    }
                    currents.set(authorId, { end: date, firstNote: note, count: 1 });
                }
            }
            for (const current of currents.values()) {
                appendComments(current);
            }

            collectedActivities.sort((x, y) => x.updatedAt.getTime() - y.updatedAt.getTime());
            return collectedActivities;
        }

        // First, adding comments
        commentNotes.sort((x, y) => new Date(x.updated_at).getTime() - new Date(y.updated_at).getTime());

        activities.push(
            ...collectSimilar(
                "synthesised-add-comments",
                commentNotes,
                // The updated time gets updated when we resolve a comment, so we need to use the created time
                (note) => new Date(note.created_at),
                (note) => note.author,
                (count) => `added ${count} ${count == 1 ? "comment" : "comments"}`
            )
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

    private async mapMergeRequestsAsync(
        api: CoreGitlab,
        merge_requests: Promise<MergeRequestSchemaWithBasicLabels[]>,
        type: MergeRequestType
    ): Promise<[MergeRequest[], Activity[]]> {
        const results = await Promise.all((await merge_requests).map((x) => this.mapMergeRequestAsync(api, x, type)));
        return [results.map((x) => x[0]), results.flatMap((x) => x[1])];
    }

    private async lookupUserNameAsync<T extends { username: string }>(
        api: CoreGitlab,
        user: T
    ): Promise<T & { name: string | null }> {
        const queryName = async (username: string) => {
            const user = await api.Users.all({ username: username });
            return user.at(0)?.name ?? null;
        };

        const currentUser = await this._user!;
        if (user.username == currentUser.username) {
            return { ...user, name: currentUser.name };
        }

        let namePromise = this._users.get(user.username);
        if (namePromise === undefined) {
            namePromise = queryName(user.username);
            this._users.set(user.username, namePromise);
        }

        return { ...user, name: await namePromise };
    }

    private async replaceUsernamesAsync(api: CoreGitlab, input: string): Promise<string> {
        const regex = /(?<=\s|^)@(\w+)/g;

        const matches = [];
        let match;
        while ((match = regex.exec(input)) !== null) {
            matches.push({ username: match[1], position: match.index });
        }

        if (matches.length == 0) {
            return input;
        }

        const replacements = await Promise.all(matches.map((x) => this.lookupUserNameAsync(api, x)));

        for (const replacement of replacements.reverse()) {
            if (replacement.name != null) {
                input =
                    input.substring(0, replacement.position) +
                    replacement.name +
                    input.substring(replacement.position + replacement.username.length + 1);
            }
        }

        return input;
    }

    private async getTicketIntegrationAsync(projectId: number): Promise<TicketIntegration> {
        const queryIntegration = async (projectId: number) => {
            try {
                const result = await this._api!.Integrations.show(projectId, "jira");
                const properties = result.properties as {
                    url: string;
                    jira_issue_prefix: string | null;
                    jira_issue_regex: string | null;
                };
                return new JiraTicketIntegration(
                    properties.url,
                    properties.jira_issue_prefix,
                    properties.jira_issue_regex
                );
            } catch (err) {
                if (err instanceof GitbeakerRequestError) {
                    return new TicketIntegration();
                }
                throw err;
            }
        };

        let integrationPromise = this._ticketIntegrations.get(projectId);
        if (integrationPromise === undefined) {
            integrationPromise = queryIntegration(projectId);
            this._ticketIntegrations.set(projectId, integrationPromise);
        }

        return await integrationPromise;
    }

    private async doRequestAsync(action: (api: CoreGitlab, userId: number) => Promise<void>) {
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
        await this.doRequestAsync(async (api, userId) => {
            const [[reviewing, reviewingActivity], [assigned, assignedActivity]] = await Promise.all([
                this.mapMergeRequestsAsync(
                    api,
                    api.MergeRequests.all({
                        state: "opened",
                        scope: "all",
                        reviewerId: userId,
                        orderBy: "updated_at",
                    }),
                    "reviewer"
                ),
                this.mapMergeRequestsAsync(
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
