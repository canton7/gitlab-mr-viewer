<script lang="ts">
    import { browser } from "$app/environment";
    import { resolve } from "$app/paths";
    import { gitlabClient as client } from "$lib/gitlab/GitlabClient.svelte";
    import isPageVisible from "$lib/PageVisibility";
    import MergeRequestInterface from "$lib/components/MergeRequestInterface.svelte";

    let lastSeen = $state(new Date());

    const visibleUpdatePeriodMs = 1 * 60 * 1000;
    const hiddenUpdatePeriodMs = 10 * 60 * 1000;

    isPageVisible.subscribe((isVisible) => {
        if (isVisible) {
            client?.start(visibleUpdatePeriodMs);
        } else {
            lastSeen = new Date();
            client?.start(hiddenUpdatePeriodMs);
        }
    });

    let numUnseenActivities = $derived.by(() => {
        if (client?.activities == null || $isPageVisible) {
            return "";
        }
        let count = 0;
        for (const activity of client.activities) {
            if (activity.updatedAt > lastSeen) {
                count++;
            } else {
                break;
            }
        }
        return count == 0 ? "" : `(${count}) `;
    });
</script>

<svelte:head>
    <title>{numUnseenActivities}Merge Requests</title>
</svelte:head>

{#if browser && client.state.kind == "unconfigured"}
    <p>Configure in the <a href={resolve("/settings")}>Settings</a>.</p>
{:else if client.state.kind == "error"}
    <p>Error: {client.state.error}</p>
{:else}
    <MergeRequestInterface
        assigned={client.assigned}
        reviewing={client.reviewing}
        activities={client.activities}
        {lastSeen}
        isRefreshing={client.state.kind == "loading"}
        refresh={() => client.refreshAsync()} />
{/if}
