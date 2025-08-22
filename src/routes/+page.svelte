<script lang="ts">
    import { createGitlabClient, GitlabClient } from '$lib/GitlabClient.svelte';
    import { gitlabSettings } from '$lib/Settings.svelte';
    import type { PageProps } from './$types';
    import MergeRequestTable from './MergeRequestTable.svelte';
    import { resolve } from '$app/paths';

    let client: GitlabClient | null = $state(null);
    gitlabSettings.subscribe((settings) => {
        if (!settings?.baseUrl || !settings?.accessToken) {
            client = null;
        } else {
            client = createGitlabClient(settings.baseUrl, settings.accessToken);
            client.start();
        }
    });

    // let { data }: PageProps = $props();
</script>

<svelte:head>
    <title>Merge Requests</title>
</svelte:head>

<h1>Merge Requests</h1>

{#if !client}
    <p>Configure in the <a href={resolve('/settings')}>Settings</a>.</p>
{:else if client.loadError}
    <p>Error: {client.loadError.message}</p>
{:else if client.isLoading}
    <p>Loading...</p>
{:else}
    <div class="table-container">
        <div>
            <h2>Assigned</h2>
            <MergeRequestTable mergeRequests={client.assigned ?? []} />
        </div>
        <div>
            <h2>Reviewing</h2>
            <MergeRequestTable mergeRequests={client.reviewing ?? []} showAuthor={true} />
        </div>
    </div>
{/if}

<style>
    .table-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-column-gap: 50px;
    }
</style>
