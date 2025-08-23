<script lang="ts">
    import { gitlabClient as client } from '$lib/GitlabClient.svelte';
    import type { PageProps } from './$types';
    import MergeRequestTable from './MergeRequestTable.svelte';
    import { resolve } from '$app/paths';
    import { browser } from '$app/environment';

    // let { data }: PageProps = $props();
    client?.start();
</script>

<svelte:head>
    <title>Merge Requests</title>
</svelte:head>

<h1>Merge Requests</h1>

{#if !browser || client.isLoading}
    <p>Loading...</p>
{:else if !client.isConfigured}
    <p>Configure in the <a href={resolve('/settings')}>Settings</a>.</p>
{:else if client.loadError}
    <p>Error: {client.loadError.message}</p>
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
