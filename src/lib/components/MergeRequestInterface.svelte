<script lang="ts">
    import MergeRequestTable from "./MergeRequestTable.svelte";
    import ActivityTable from "./ActivityTable.svelte";
    import type { Activity, MergeRequest } from "$lib/gitlab/Types";

    // MR hovered in the MR table. This highlights the MR card and filters the activity list
    let tableHoveredMergeRequest: MergeRequest | null = $state.raw(null);
    // MR pinned in the MR table. This highlights the MR card and filters the activity list. This can also be pinned
    // from the activity list.
    let pinnedMergeRequest: MergeRequest | null = $state.raw(null);
    // MR hovered in the activity list. This highlighs the MR card but does not filter the activity list
    let activityHoveredMergeRequest: MergeRequest | null = $state.raw(null);

    // When activityHoveredMergeRequest is changed, set this to tableHoveredMergeRequest to select the correct card
    $effect(() => {
        tableHoveredMergeRequest = activityHoveredMergeRequest;
    });

    // The MR to filter the activity list on.
    // For some reason, using $derived infers the resulting type as 'null', which is incorrect
    let activityFilteredMergeRequest = $derived.by(
        // Only listen to tableHoveredMergeRequest if they're not hovering over an activity
        () => (activityHoveredMergeRequest != null ? null : tableHoveredMergeRequest) ?? pinnedMergeRequest
    );

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
            <MergeRequestTable
                mergeRequests={assigned}
                role="assignee"
                bind:hoveredMergeRequest={tableHoveredMergeRequest}
                bind:pinnedMergeRequest />
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
            <MergeRequestTable
                mergeRequests={reviewing}
                role="reviewer"
                bind:hoveredMergeRequest={tableHoveredMergeRequest}
                bind:pinnedMergeRequest />
        </div>
    </div>

    <div class="activity" data-helpid="activity">
        <ActivityTable
            activities={(activities ?? []).filter(
                (x) => activityFilteredMergeRequest == null || x.mergeRequest.key == activityFilteredMergeRequest.key
            )}
            {lastSeen}
            bind:hoveredMergeRequest={activityHoveredMergeRequest}
            bind:pinnedMergeRequest />
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
