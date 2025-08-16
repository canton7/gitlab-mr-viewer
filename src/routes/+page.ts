import { PUBLIC_GITLAB_TOKEN, PUBLIC_GITLAB_HOST } from '$env/static/public';
import type { PageLoad } from './$types';
import { createGitlabClient } from '$lib/GitlabClient.svelte';

export const load = (async () => {
    const client = createGitlabClient(PUBLIC_GITLAB_HOST, PUBLIC_GITLAB_TOKEN);
    client.start();

    return {
        client: client
    };
}) satisfies PageLoad;
