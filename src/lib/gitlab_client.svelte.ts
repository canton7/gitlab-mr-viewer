import { Gitlab } from '@gitbeaker/rest';
import { browser } from '$app/environment';
import { Gitlab as CoreGitlab, type ExpandedUserSchema } from '@gitbeaker/core';

export async function createGitlabClient(host: string, token: string): Promise<GitlabClient> {
    let api = null;
    if (browser) {
        api = new Gitlab({
            host: host,
            token: token
        });
    }

    const client = new GitlabClient(api);
    await client.loadAsync();

    return client;
}

export class GitlabClient {
    private readonly _api: CoreGitlab | null;
    private readonly _user: Promise<ExpandedUserSchema> | null = null;

    mergeRequests = $state<Promise<object[]>>(new Promise(() => {}));

    constructor(api: CoreGitlab | null) {
        this._api = api;

        if (this._api) {
            this._user = this._api.Users.showCurrentUser();
        }
    }

    private async getApi() {
        if (!this._api) {
            return {};
        }

        return { api: this._api, userId: (await this._user!).id };
    }

    async loadAsync() {
        const { api, userId } = await this.getApi();
        if (!api) {
            return;
        }

        const load = async () => {
            const [reviewing, open] = await Promise.all([
                api.MergeRequests.all({ state: 'opened', reviewerId: userId }),
                api.MergeRequests.all({ state: 'opened', assigneeId: userId })
            ]);

            return [...reviewing, ...open];
        };

        this.mergeRequests = load();
    }
}
