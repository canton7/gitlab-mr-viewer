import { Gitlab } from "@gitbeaker/rest";
import { browser } from "$app/environment";
import { gitlabSettings } from "$lib/Settings";
import {
    Gitlab as CoreGitlab,
    type CommitablePipelineStatus,
    type ExpandedUserSchema,
    type MergeRequestSchemaWithBasicLabels,
} from "@gitbeaker/core";
import { createRequesterFn, type RequestOptions, type ResourceOptions } from "@gitbeaker/requester-utils";
import { createRequestHandler } from "./GitlabUtils";
import { GitlabCache } from "./GitlabCache";

const UPDATE_PERIOD_MS = 1 * 60 * 1000;
const CACHE_FLUSH_PERIOD_MS = 15 * 60 * 1000;

export type GitlabCiStatus = CommitablePipelineStatus | "none";

export interface MergeRequest {
    key: string;
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
    noteId: number;
    authorName: string;
    mergeRequest: MergeRequest;
}

type State = { kind: "unconfigured" } | { kind: "loading" } | { kind: "loaded" } | { kind: "error"; error: Error };

export class GitlabClient {
    private _api: CoreGitlab | null = null;
    private _user: Promise<ExpandedUserSchema> | null = null;
    private _intervalHandle: number | null = null;

    private _state = $state<State>({ kind: "unconfigured" });
    assigned = $state<MergeRequest[]>([]);
    reviewing = $state<MergeRequest[]>([]);
    activities = $state<Activity[]>([]);

    setApi(api: CoreGitlab | null) {
        this._api = api;

        if (this._api) {
            this._user = this._api.Users.showCurrentUser();
            this._state = { kind: "loading" };
        } else {
            this._user = null;
            this.assigned = [];
            this.reviewing = [];
            this.activities = [];
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
        mergeRequest: MergeRequestSchemaWithBasicLabels
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

        let activities: Activity[] = [];
        for (const discussion of discussions) {
            if (discussion.notes != undefined && discussion.notes.length > 0) {
                let body;
                if (discussion.individual_note) {
                    body = discussion.notes[0].body;
                } else {
                    body = `left ${discussion.notes.length} comment(s)`;
                }
                activities.push({
                    key: discussion.id,
                    body: body,
                    updatedAt: new Date(discussion.notes[0].updated_at),
                    noteId: discussion.notes[0].id,
                    authorName: discussion.notes[0].author.name,
                    mergeRequest: mr,
                });
            }
        }

        return [mr, activities];
    }

    private async mapMergeRequests(
        api: CoreGitlab,
        merge_requests: Promise<MergeRequestSchemaWithBasicLabels[]>
    ): Promise<[MergeRequest[], Activity[]]> {
        const results = await Promise.all((await merge_requests).map((x) => this.mapMergeRequest(api, x)));
        return [results.map((x) => x[0]), results.flatMap((x) => x[1])];
    }

    private async doRequest(action: (api: CoreGitlab, userId: number) => Promise<void>) {
        if (!this._api) {
            return;
        }

        try {
            await action(this._api, (await this._user!).id);
            this._state = { kind: "loaded" };
        } catch (err) {
            this._state = { kind: "error", error: err as Error };
        }
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
                    })
                ),
                this.mapMergeRequests(
                    api,
                    api.MergeRequests.all({
                        state: "opened",
                        scope: "all",
                        assigneeId: userId,
                        orderBy: "updated_at",
                    })
                ),
            ]);

            this.reviewing = reviewing;
            this.assigned = assigned;

            // We might have duplicates (if an MR appears in both reviewing and assigned). That's OK.
            let activitiesLookup = new Map<string, Activity>();
            for (const activity of reviewingActivity.concat(assignedActivity)) {
                activitiesLookup.set(activity.key, activity);
            }
            // TODO: Sort
            this.activities = activitiesLookup
                .values()
                .toArray()
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
