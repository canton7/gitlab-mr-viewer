import { Gitlab } from '@gitbeaker/rest';
import { browser } from '$app/environment';
import { Gitlab as CoreGitlab, type ExpandedUserSchema, type MergeRequestSchemaWithBasicLabels } from '@gitbeaker/core';

const UPDATE_PERIOD_MS = 60000;

export interface MergeRequest {
    id: number;
    title: string;
    web_url: string;
    created_at: string;
    updated_at: string;
    author_name: string;
    reference: string;
}

export function createGitlabClient(host: string | null, token: string | null): GitlabClient {
    let api = null;
    if (browser && host && token) {
        api = new Gitlab({
            host: host,
            token: token
        });
    }

    const client = new GitlabClient(api);
    return client;
}

export class GitlabClient {
    private readonly _api: CoreGitlab | null;
    private readonly _user: Promise<ExpandedUserSchema> | null = null;
    private _intervalHandle: number | null = null;

    assigned = $state<MergeRequest[]>([]);
    reviewing = $state<MergeRequest[]>([]);
    isLoading = $state(true);
    loadError = $state<Error | null>(null);

    constructor(api: CoreGitlab | null) {
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
        return {
            id: merge_request.id,
            title: merge_request.title,
            web_url: merge_request.web_url,
            created_at: merge_request.created_at,
            updated_at: merge_request.updated_at,
            author_name: merge_request.author.name,
            reference: merge_request.references.full.split('/').at(-1) ?? ''
        };
    }

    private async mapMergeRequests(merge_requests: Promise<MergeRequestSchemaWithBasicLabels[]>) {
        return await Promise.all((await merge_requests).map((x) => this.mapMergeRequest(x)));
    }

    private async doRequest(action: (api: CoreGitlab, userId: number) => Promise<void>) {
        if (!this._api) {
            return;
        }

        try {
            await action(this._api, (await this._user!).id);
            this.loadError = null;
        } catch (err) {
            this.loadError = err as Error;
        }
    }

    private async loadAsync() {
        await this.doRequest(async (api, userId) => {
            const [reviewing, assigned] = await Promise.all([
                this.mapMergeRequests(
                    api.MergeRequests.all({ state: 'opened', scope: 'all', reviewerId: userId, orderBy: 'updated_at' })
                ),
                this.mapMergeRequests(
                    api.MergeRequests.all({ state: 'opened', scope: 'all', assigneeId: userId, orderBy: 'updated_at' })
                )
            ]);

            this.reviewing = reviewing;
            this.assigned = assigned;
            console.log(assigned[0]);
        });

        this.isLoading = false;
    }
}
