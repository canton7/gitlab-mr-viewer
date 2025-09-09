<script lang="ts">
    import type { Activity } from "$lib/gitlab/GitlabClient.svelte";
    import moment from "moment";

    interface Props {
        activities: Activity[];
    }

    let { activities }: Props = $props();
</script>

<div class="activity-table">
    {#each activities as activity, index (activity.key)}
        <p>
            {activity.mergeRequest.reference}: {activity.authorName}
        </p>
        <p class={["graphic", index == 0 && "first-row", index == activities.length - 1 && "last-row"]}>
            <span class="dot"></span>
            <span class="line"></span>
        </p>
        <p>{activity.body} {moment(activity.updatedAt).fromNow()}</p>
    {/each}
</div>

<style lang="scss">
    :root {
        --dot-size: 8px;
        --line-width: 2px;
    }

    p {
        margin-top: 0;
        margin-bottom: 0;
    }

    .activity-table {
        display: grid;
        grid-template-columns: auto auto 1fr;
    }

    .graphic {
        position: relative;
    }

    .dot {
        display: inline-block;
        position: relative;
        z-index: 3;
        margin: 0 10px;

        width: var(--dot-size);
        height: var(--dot-size);

        background-color: gray;
        border-radius: 50%;
        vertical-align: middle;
    }

    .line {
        position: absolute;
        z-index: 2;
        left: calc(50% - var(--line-width) / 2);

        background-color: red;
        width: var(--line-width);
        height: 100%;
    }

    .first-row .line {
        top: 50%;
    }

    .last-row .line {
        bottom: 50%;
    }
</style>
