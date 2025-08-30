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
    createdAt: string;
    updatedAt: string;
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

type State = { kind: "unconfigured" } | { kind: "loading" } | { kind: "loaded" } | { kind: "error"; error: Error };

export class GitlabClient {
    private _api: CoreGitlab | null = null;
    private _user: Promise<ExpandedUserSchema> | null = null;
    private _intervalHandle: number | null = null;

    private _state = $state<State>({ kind: "unconfigured" });
    assigned = $state<MergeRequest[]>([]);
    reviewing = $state<MergeRequest[]>([]);

    setApi(api: CoreGitlab | null) {
        this._api = api;

        if (this._api) {
            this._user = this._api.Users.showCurrentUser();
            this._state = { kind: "loading" };
        } else {
            this._user = null;
            this.assigned = [];
            this.reviewing = [];
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
        merge_request: MergeRequestSchemaWithBasicLabels
    ): Promise<MergeRequest> {
        const [approvals, discussions, commitStatus] = await Promise.all([
            await api.MergeRequestApprovals.showConfiguration(merge_request.project_id, {
                mergerequestIId: merge_request.iid,
            }),
            await api.MergeRequestDiscussions.all(merge_request.project_id, merge_request.iid),
            await api.Commits.allStatuses(merge_request.project_id, merge_request.sha),
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

        return {
            key: `${merge_request.project_id}-${merge_request.id}`,
            title: merge_request.title,
            webUrl: merge_request.web_url,
            createdAt: merge_request.created_at,
            updatedAt: merge_request.updated_at,
            authorName: merge_request.author.name,
            reviewerName: merge_request.reviewers?.at(0)?.name ?? null,
            reference: merge_request.references.full.split("/").at(-1) ?? "",
            isApproved: (approvals.approved_by?.length ?? 0) > 0,
            firstOpenNoteId: firstOpenNoteId,
            openDiscussions: resolvable,
            totalDiscussions: totalDiscussions,
            ciStatus: commitStatus.at(0)?.status ?? "none",
            ciLink: commitStatus.at(0)?.target_url ?? null,
        };
    }

    private async mapMergeRequests(api: CoreGitlab, merge_requests: Promise<MergeRequestSchemaWithBasicLabels[]>) {
        return await Promise.all((await merge_requests).map((x) => this.mapMergeRequest(api, x)));
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
            const [reviewing, assigned] = await Promise.all([
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
