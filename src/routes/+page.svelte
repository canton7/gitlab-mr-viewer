<script lang="ts">
    import type { PageProps } from './$types';
    import MergeRequestTable from './MergeRequestTable.svelte';

    let { data }: PageProps = $props();
</script>

<h1>Merge Requests</h1>

{#if data.client.loadError}
    <p>Error: {data.client.loadError.message}</p>
{:else}
    <div class="table-container">
        <div>
            <h2>Assigned</h2>
            <MergeRequestTable mergeRequests={data.client.assigned ?? []} />
        </div>
        <div>
            <h2>Reviewing</h2>
            <MergeRequestTable mergeRequests={data.client.reviewing ?? []} showAuthor={true} />
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
