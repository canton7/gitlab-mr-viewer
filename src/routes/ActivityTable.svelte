<script lang="ts">
    import { tooltip } from "$lib/Bootstrap";
    import type { Activity } from "$lib/gitlab/GitlabClient.svelte";
    import { DATE_FORMAT, now } from "$lib/DateUtils";
    import moment from "moment";

    interface Props {
        activities: Activity[];
    }

    let { activities }: Props = $props();
</script>

{#snippet details(activity: Activity)}
    {@const url = `${activity.mergeRequest.webUrl}#note_${activity.noteId}`}
    <p>
        <a href={url} target="_blank">
            {activity.authorName}
            {activity.body}
        </a>
    </p>
    <p class="footer">
        {activity.mergeRequest.reference} ·
        <span {@attach tooltip({ title: moment(activity.updatedAt).format(DATE_FORMAT) })}>
            {moment(activity.updatedAt).from($now)}
        </span>
    </p>
{/snippet}

<div class="activity-table">
    {#each activities as activity, index (activity.key)}
        <div class="details left">
            {#if activity.mergeRequest.type == "assignee"}
                {@render details(activity)}
            {/if}
        </div>

        <div class={["timeline", index == 0 && "first-row", index == activities.length - 1 && "last-row"]}>
            <span class="dot-outer"><span class="dot-inner"></span></span>
            <span class="line"></span>
        </div>

        <div class="details">
            {#if activity.mergeRequest.type == "reviewer"}
                {@render details(activity)}
            {/if}
        </div>
    {/each}
</div>

<style lang="scss">
    @import "lib/styles/mixins.scss";

    :root {
        --dot-outer-size: 8px;
        --dot-inner-size: 4px;
        --line-width: 2px;

        --timeline-light: #ececef;
        --timeline-dark: #737278;
    }

    .activity-table {
        @include subtle-link;

        display: grid;
        grid-template-columns: 1fr auto 1fr;
    }

    p {
        margin: 3px 0;
        line-height: 1em;
        font-size: 0.85em;
    }

    .left {
        text-align: right;
    }

    .details {
        margin: 2px 0;

        .footer {
            color: var(--footer-color);
        }
    }

    .timeline {
        position: relative;
        width: 30px;
    }

    .dot-outer {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 3;

        width: var(--dot-outer-size);
        height: var(--dot-outer-size);

        background-color: var(--timeline-light);
        border-radius: 50%;
    }

    .dot-inner {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        width: var(--dot-inner-size);
        height: var(--dot-inner-size);

        background-color: var(--timeline-dark);
        border-radius: 50%;
    }

    .line {
        position: absolute;
        left: 50%;
        transform: translate(-50%, 0);
        z-index: 2;

        background-color: var(--timeline-light);
        width: var(--line-width);
        height: 100%;
    }

    .first-row .line {
        top: calc(50% + var(--dot-outer-size) / 2);
    }

    .last-row .line {
        bottom: calc(50% - var(--dot-outer-size) / 2);
    }
</style>
