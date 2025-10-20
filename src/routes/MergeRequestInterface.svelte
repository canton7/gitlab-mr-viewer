<script lang="ts">
    import MergeRequestTable from "./MergeRequestTable.svelte";
    import ActivityTable from "./ActivityTable.svelte";
    import type { Activity, MergeRequest } from "$lib/gitlab/Types";

    let filteredMergeRequest: MergeRequest | null = $state.raw(null);

    interface Props {
        assigned: MergeRequest[] | null;
        reviewing: MergeRequest[] | null;
        activities: Activity[] | null;
        lastSeen: Date | null;
        isRefreshing: boolean;
        refresh: (() => Promise<void>) | null;
    }

    let { assigned, reviewing, activities, lastSeen, isRefreshing, refresh }: Props = $props();
</script>

<div class="content">
    <div class="merge-requests" data-helpid="assigned-merge-requests">
        <h2>Assigned</h2>

        <div class="merge-request-table">
            <MergeRequestTable mergeRequests={assigned} role="assignee" bind:filteredMergeRequest />
        </div>
    </div>

    <div class="merge-requests" data-helpid="reviewing-merge-requests">
        <div>
            {#if refresh}
                <button class="refresh" aria-label="Refresh" onclick={() => refresh()}>
                    <i class="fa-solid fa-arrows-rotate" class:fa-spin={isRefreshing}></i>
                </button>
            {/if}

            <h2>Reviewing</h2>
        </div>
        <div class="merge-request-table">
            <MergeRequestTable mergeRequests={reviewing} role="reviewer" bind:filteredMergeRequest />
        </div>
    </div>

    <div class="activity" data-helpid="activity">
        <ActivityTable
            activities={(activities ?? []).filter(
                (x) => filteredMergeRequest == null || x.mergeRequest.key == filteredMergeRequest.key
            )}
            {lastSeen} />
    </div>
</div>

<style lang="scss">
    h2 {
        font-size: 1.4rem;
        margin-bottom: 20px;
    }

    .content {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: minmax(50vh, auto) auto;
        gap: 20px;
    }

    .activity {
        grid-column: 1 / span 2;
    }

    .refresh {
        float: right;
        background: none;
        border: none;
        margin-top: 5px;
    }
</style>
