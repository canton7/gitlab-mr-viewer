<script lang="ts">
    import { browser } from "$app/environment";
    import { resolve } from "$app/paths";
    import { gitlabClient as client } from "$lib/gitlab/GitlabClient.svelte";
    import MergeRequestTable from "./MergeRequestTable.svelte";
    import ActivityTable from "./ActivityTable.svelte";
    import { onMount } from "svelte";
    import { on } from "svelte/events";

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

{#if !browser || client.state.kind == "loading"}
    <p>Loading...</p>
{:else if client.state.kind == "unconfigured"}
    <p>Configure in the <a href={resolve("/settings")}>Settings</a>.</p>
{:else if client.state.kind == "error"}
    <p>Error: {client.state.error}</p>
{:else}
    <div class="container">
        <div class="row">
            <div class="col-md-6">
                <h2>Assigned</h2>
                <MergeRequestTable mergeRequests={client.assigned ?? []} role="assignee" />
            </div>
            <div class="col-md-6">
                <h2>Reviewing</h2>
                <MergeRequestTable mergeRequests={client.reviewing ?? []} role="reviewer" />
            </div>
        </div>
    </div>

    <ActivityTable activities={client.activities} />
{/if}

<style lang="scss">
    h2 {
        font-size: 1.4rem;
        margin-bottom: 20px;
    }
</style>
