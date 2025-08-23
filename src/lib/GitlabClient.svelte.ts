import { Gitlab } from '@gitbeaker/rest';
import { browser } from '$app/environment';
import { gitlabSettings } from '$lib/Settings.svelte';
import {
    Gitlab as CoreGitlab,
    type CommitablePipelineStatus,
    type ExpandedUserSchema,
    type MergeRequestSchemaWithBasicLabels
} from '@gitbeaker/core';

const UPDATE_PERIOD_MS = 5 * 60 * 1000;

export type GitlabCiStatus = CommitablePipelineStatus;

export interface MergeRequest {
    id: number;
    title: string;
    webUrl: string;
    createdAt: string;
    updatedAt: string;
    authorName: string;
    reference: string;
    isApproved: boolean;
    resolvedDiscussions: number;
    totalDiscussions: number;
    ciStatus: GitlabCiStatus;
    ciLink: string | null;
}

type State = { kind: 'unconfigured' } | { kind: 'loading' } | { kind: 'loaded' } | { kind: 'error'; error: Error };

export class GitlabClient {
    private _api: CoreGitlab | null = null;
    private _user: Promise<ExpandedUserSchema> | null = null;
    private _intervalHandle: number | null = null;

    private _state = $state<State>({ kind: 'unconfigured' });
    assigned = $state<MergeRequest[]>([]);
    reviewing = $state<MergeRequest[]>([]);

    setApi(api: CoreGitlab | null) {
        this._api = api;

        if (this._api) {
            this._user = this._api.Users.showCurrentUser();
            this._state = { kind: 'loading' };
        } else {
            this._user = null;
            this.assigned = [];
            this.reviewing = [];
            this._state = { kind: 'unconfigured' };
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
                mergerequestIId: merge_request.iid
            }),
            await api.MergeRequestDiscussions.all(merge_request.project_id, merge_request.iid),
            await api.Commits.allStatuses(merge_request.project_id, merge_request.sha)
        ]);

        let resolvable = 0;
        let resolved = 0;
        for (const discussion of discussions) {
            for (const note of discussion.notes ?? []) {
                if (note.resolvable) {
                    resolvable += 1;
                }
                if (note.resolved) {
                    resolved += 1;
                }
            }
        }

        return {
            id: merge_request.id,
            title: merge_request.title,
            webUrl: merge_request.web_url,
            createdAt: merge_request.created_at,
            updatedAt: merge_request.updated_at,
            authorName: merge_request.author.name,
            reference: merge_request.references.full.split('/').at(-1) ?? '',
            isApproved: (approvals.approved_by?.length ?? 0) > 0,
            resolvedDiscussions: resolved,
            totalDiscussions: resolvable,
            ciStatus: commitStatus.at(0)?.status ?? 'pending',
            ciLink: commitStatus.at(0)?.target_url ?? null
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
            this._state = { kind: 'loaded' };
        } catch (err) {
            this._state = { kind: 'error', error: err as Error };
        }
    }

    private async loadAsync() {
        await this.doRequest(async (api, userId) => {
            const [reviewing, assigned] = await Promise.all([
                this.mapMergeRequests(
                    api,
                    api.MergeRequests.all({
                        state: 'opened',
                        scope: 'all',
                        reviewerId: userId,
                        orderBy: 'updated_at'
                    })
                ),
                this.mapMergeRequests(
                    api,
                    api.MergeRequests.all({
                        state: 'opened',
                        scope: 'all',
                        assigneeId: userId,
                        orderBy: 'updated_at'
                    })
                )
            ]);

            this.reviewing = reviewing;
            this.assigned = assigned;
        });
    }
}

export const gitlabClient = new GitlabClient();
gitlabSettings.subscribe((settings) => {
    if (!browser || !settings?.baseUrl || !settings?.accessToken) {
        gitlabClient.setApi(null);
    } else {
        const api = new Gitlab({
            host: settings.baseUrl,
            token: settings.accessToken
        });
        gitlabClient.setApi(api);
    }
});
