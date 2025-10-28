<script lang="ts">
    import { tooltip } from "$lib/Bootstrap";
    import { DATE_FORMAT, fromNow } from "$lib/DateUtils";
    import moment from "moment";
    import { fade, slide } from "svelte/transition";
    import { ACTIVITY_ANIMATION_DURATION } from "$lib/Const";
    import { type Activity } from "$lib/gitlab/Types";
    import { stripHtml } from "$lib/HtmlUtils";

    interface Props {
        activities: Activity[];
        lastSeen: Date | null;
    }

    let { activities, lastSeen }: Props = $props();

    let indexOfLastSeen = $derived.by(() => {
        if (lastSeen == null) {
            return null;
        }
        const index = activities.findIndex((x) => x.date.getTime() - lastSeen.getTime() < 0);
        return index == 0 ? null : index;
    });
</script>

{#snippet details(activity: Activity)}
    <p>
        <a href={activity.url} target="_blank">
            {activity.authorName}
            {stripHtml(activity.body)}
        </a>
    </p>
    <p class="footer">
        {activity.mergeRequest.reference} ·
        <span {@attach tooltip({ title: moment(activity.date).format(DATE_FORMAT) })}>
            {$fromNow(activity.date)}
        </span>
    </p>
{/snippet}

{#snippet timeline(index: number, showDot: boolean)}
    <div class={["timeline", index == 0 && "first-row", index == activities.length - 1 && "last-row"]}>
        {#if showDot}
            <span class="dot-outer"><span class="dot-inner"></span></span>
        {/if}
        <span class="line"></span>
    </div>
{/snippet}

<div class="activity-table">
    {#each activities as activity, index (activity.key)}
        {#if indexOfLastSeen != null && index == indexOfLastSeen}
            <div class="row last-read" transition:fade={{ duration: 100 }}>
                <p>NEW</p>
                {@render timeline(index, false)}
            </div>
        {/if}

        <div class="row" transition:slide={{ duration: ACTIVITY_ANIMATION_DURATION }}>
            <div class="details left">
                {#if activity.mergeRequest.type == "assignee"}
                    {@render details(activity)}
                {/if}
            </div>

            {@render timeline(index, true)}

            <div class="details">
                {#if activity.mergeRequest.type == "reviewer"}
                    {@render details(activity)}
                {/if}
            </div>
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

    .row {
        display: grid;
        position: relative;
        grid-column: 1 / span 3;
        grid-template-columns: subgrid;
    }

    .last-read {
        --color: red;

        &::before {
            content: "";
            position: absolute;
            top: calc(50% - 0.5px);
            left: 0;
            right: 0;
            height: 1px;
            background: var(--color);
            z-index: 4;
        }

        p {
            position: absolute;

            // Let it overflow the parent, but force it to overflow equally to the top and bottom
            top: 50%;
            transform: translateY(-50%);
            margin: 0;

            width: fit-content;
            font-weight: bold;
            font-family: Verdana, Geneva, Tahoma, sans-serif;
            font-size: 0.6em;

            background: var(--color);
            color: white;
            border-radius: 3px 0 0 3px;
            padding: 2px 10px 2px 3px;

            // Little arrow to the right
            clip-path: polygon(0% 0%, 80% 0%, 95% 50%, 80% 100%, 0% 100%);

            z-index: 5;
        }
    }

    .row.last-read {
        height: 6px;
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
        width: 30px;

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
            top: 0;
            bottom: 0;
        }

        &.first-row .line {
            top: calc(50% + var(--dot-outer-size) / 2);
        }

        &.last-row .line {
            bottom: calc(50% - var(--dot-outer-size) / 2);
        }

        &.first-row.last-row .line {
            display: none;
        }
    }
</style>
