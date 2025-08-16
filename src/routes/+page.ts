import { PUBLIC_GITLAB_TOKEN, PUBLIC_GITLAB_HOST } from '$env/static/public';
import type { PageLoad } from './$types';
import { createGitlabClient } from '$lib/gitlab_client.svelte';

export const load = (async () => {
    const client = await createGitlabClient(PUBLIC_GITLAB_HOST, PUBLIC_GITLAB_TOKEN);

    return {
        client: client
    };
}) satisfies PageLoad;
