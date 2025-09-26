<script lang="ts">
    import { browser } from "$app/environment";
    import { resolve } from "$app/paths";
    import { gitlabClient as client, type MergeRequest } from "$lib/gitlab/GitlabClient.svelte";
    import MergeRequestTable from "./MergeRequestTable.svelte";
    import ActivityTable from "./ActivityTable.svelte";
    import { onMount } from "svelte";
    import { on } from "svelte/events";

    let hoveredMergeRequest: MergeRequest | null = $state.raw(null);

    onMount(() => {
        client.start();

        const removeListener = on(document, "visibilitychange", () => {
            if (document.hidden) {
                client?.stop();
            } else {
                client?.start();
            }
        });

        return () => {
            client.stop();
            removeListener();
        };
    });
</script>

<svelte:head>
    <title>Merge Requests</title>
</svelte:head>

{#if browser && client.state.kind == "unconfigured"}
    <p>Configure in the <a href={resolve("/settings")}>Settings</a>.</p>
{:else if client.state.kind == "error"}
    <p>Error: {client.state.error}</p>
{:else}
    <div class="content">
        <div class="merge-requests">
            <h2>Assigned</h2>

            <div class="merge-request-table">
                <MergeRequestTable mergeRequests={client.assigned} role="assignee" bind:hoveredMergeRequest />
            </div>
        </div>

        <div class="merge-requests">
            <div>
                <button class="refresh" aria-label="Refresh" onclick={() => client.refreshAsync()}>
                    <i class="fa-solid fa-arrows-rotate" class:fa-spin={client.state.kind == "loading"}></i>
                </button>

                <h2>Reviewing</h2>
            </div>
            <div class="merge-request-table">
                <MergeRequestTable mergeRequests={client.reviewing} role="reviewer" bind:hoveredMergeRequest />
            </div>
        </div>

        <div class="activity">
            <ActivityTable
                activities={(client.activities ?? []).filter(
                    (x) => hoveredMergeRequest == null || x.mergeRequest.key == hoveredMergeRequest.key
                )} />
        </div>
    </div>
{/if}

<style lang="scss">
    h2 {
        font-size: 1.4rem;
        margin-bottom: 20px;
    }

    .content {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 50vh auto;
        gap: 20px;
    }

    .merge-requests {
        display: flex;
        flex-direction: column;

        .merge-request-table {
            flex: 1;
            overflow-y: auto;
        }
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
