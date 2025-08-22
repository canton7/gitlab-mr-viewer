import { Gitlab } from '@gitbeaker/rest';
import { browser } from '$app/environment';
import { gitlabSettings } from '$lib/Settings.svelte';
import { Gitlab as CoreGitlab, type ExpandedUserSchema, type MergeRequestSchemaWithBasicLabels } from '@gitbeaker/core';
import { readonly, writable } from 'svelte/store';

const UPDATE_PERIOD_MS = 5 * 60 * 1000;

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
}

export class GitlabClient {
    private readonly _api: CoreGitlab;
    private readonly _user: Promise<ExpandedUserSchema> | null = null;
    private _intervalHandle: number | null = null;

    assigned = $state<MergeRequest[]>([]);
    reviewing = $state<MergeRequest[]>([]);
    isLoading = $state(true);
    loadError = $state<Error | null>(null);

    constructor(api: CoreGitlab) {
        this._api = api;

        if (this._api) {
            this._user = this._api.Users.showCurrentUser();
        }
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

    private async mapMergeRequest(merge_request: MergeRequestSchemaWithBasicLabels): Promise<MergeRequest> {
        const [approvals, discussions] = await Promise.all([
            await this._api.MergeRequestApprovals.showConfiguration(merge_request.project_id, {
                mergerequestIId: merge_request.iid
            }),
            await this._api.MergeRequestDiscussions.all(merge_request.project_id, merge_request.iid)
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
        console.log(discussions);
        return {
            id: merge_request.id,
            title: merge_request.title,
            webUrl: merge_request.web_url,
            createdAt: merge_request.created_at,
            updatedAt: merge_request.updated_at,
            authorName: merge_request.author.name,
            reference: merge_request.references.full.split('/').at(-1) ?? '',
            isApproved: approvals.approved_by?.length > 0 ?? false,
            resolvedDiscussions: resolved,
            totalDiscussions: resolvable
        };
    }

    private async mapMergeRequests(merge_requests: Promise<MergeRequestSchemaWithBasicLabels[]>) {
        return await Promise.all((await merge_requests).map((x) => this.mapMergeRequest(x)));
    }

    private async doRequest(action: (userId: number) => Promise<void>) {
        try {
            await action((await this._user!).id);
            this.loadError = null;
        } catch (err) {
            this.loadError = err as Error;
        }
    }

    private async loadAsync() {
        await this.doRequest(async (userId) => {
            const [reviewing, assigned] = await Promise.all([
                this.mapMergeRequests(
                    this._api.MergeRequests.all({
                        state: 'opened',
                        scope: 'all',
                        reviewerId: userId,
                        orderBy: 'updated_at'
                    })
                ),
                this.mapMergeRequests(
                    this._api.MergeRequests.all({
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

        this.isLoading = false;
    }
}

const client = writable<GitlabClient | null>(null);
export const gitlabClient = readonly(client);
gitlabSettings.subscribe((settings) => {
    if (!browser || !settings?.baseUrl || !settings?.accessToken) {
        client.set(null);
    } else {
        const api = new Gitlab({
            host: settings.baseUrl,
            token: settings.accessToken
        });
        client.set(new GitlabClient(api));
    }
});
