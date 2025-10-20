<script lang="ts">
    import { tooltip } from "$lib/Bootstrap";
    import { DATE_FORMAT, fromNow } from "$lib/DateUtils";
    import type { Tooltip } from "bootstrap";
    import moment from "moment";
    import { flip } from "svelte/animate";
    import { fade } from "svelte/transition";
    import { ACTIVITY_ANIMATION_DURATION, CARD_ANIMATION_DURATION } from "$lib/Const";
    import type { MergeRequest } from "$lib/gitlab/Types";

    interface Props {
        mergeRequests: MergeRequest[] | null;
        role: "assignee" | "reviewer";
        filteredMergeRequest: MergeRequest | null;
    }

    let { mergeRequests, role, filteredMergeRequest = $bindable(null) }: Props = $props();

    let hoveredMergeRequest = $state<MergeRequest | null>(null);
    let pinnedMergeRequest = $state<MergeRequest | null>(null);

    $effect(() => {
        filteredMergeRequest = hoveredMergeRequest ?? pinnedMergeRequest;
    });

    function getApprovalColor(mr: MergeRequest) {
        // If it's approved, that's always good
        if (mr.isApproved) {
            return "--status-good";
        }
        if (role == "assignee") {
            // If we're the assignee, it's always up to the reviewer to approve
            return "--status-others-action";
        } else {
            // If we're the reviewer, it's our action if everything else is ready for approval
            if (mr.openDiscussions == 0) {
                return "--status-my-action";
            } else {
                return "--status-not-ready";
            }
        }
    }

    function getApprovalTooltip(mr: MergeRequest) {
        if (mr.isApproved) {
            return "Approved";
        }
        return role == "reviewer" ? "Pending approval" : "Not approved";
    }

    function getDiscussionColor(mr: MergeRequest) {
        if (role == "assignee") {
            // If we're the assignee, then we only need to take action if there are open discussions
            if (mr.openDiscussions == 0) {
                return "--status-good";
            } else {
                return "--status-my-action";
            }
        } else {
            if (mr.isApproved && mr.openDiscussions == 0) {
                // If it's approved (and there are no open discussions), then we're not expecting any more discussions
                return "--status-good";
            } else {
                // Otherwise we're responsible for adding discussions as well as responding to them
                return "--status-my-action";
            }
        }
    }

    function getDiscussionTooltip(mr: MergeRequest) {
        let title;
        if (mr.totalDiscussions == 0) {
            title = "No threads";
        } else if (mr.openDiscussions == 0) {
            title = "All threads resolved";
        } else {
            title = `Open threads: ${mr.openDiscussions} / ${mr.totalDiscussions}`;
        }

        const link = mr.firstOpenNoteId == null ? "" : "<br><em>Click to view</em>";
        return title + link;
    }

    function getCiColor(mr: MergeRequest) {
        if (mr.ciStatus == "success") {
            return "--status-good";
        }
        // If we're the assignee it's our responsibility to fix broken CI. If we're reviewing, it's the assignee's
        if (mr.ciStatus == "failed") {
            if (role == "assignee") {
                return "--status-broken";
            } else {
                return "--status-others-action";
            }
        }
        return "--status-others-action";
    }

    function getCiTooltip(mr: MergeRequest) {
        let title;
        if (mr.ciStatus == "none") {
            title = "No Pipeline";
        } else {
            title = `Pipeline ${mr.ciStatus}`;
        }

        const link = mr.ciUrl == null ? "" : "<br><em>Click to view</em>";
        return title + link;
    }

    function getOverallColor(mr: MergeRequest) {
        if (role == "assignee" && mr.ciStatus != "none" && mr.ciStatus != "success") {
            return "--ci-color";
        }
        if (mr.openDiscussions > 0) {
            return "--discussions-color";
        }
        return "--approval-color";
    }

    const tooltipOptions: Partial<Tooltip.Options> = {
        placement: "right",
        delay: { show: 750, hide: 0 },
        html: true,
    };
</script>

<!-- We need to have this always shown, otherwise the cards don't animate in after a load -->
<div
    class="merge-request-table"
    style:--card-animation-duration={`${CARD_ANIMATION_DURATION}ms`}
    style:--activity-animation-duration={`${ACTIVITY_ANIMATION_DURATION}ms`}>
    {#if mergeRequests == null || mergeRequests.length == 0}
        <p class="status" in:fade={{ duration: CARD_ANIMATION_DURATION, delay: CARD_ANIMATION_DURATION }}>
            {#if mergeRequests == null}
                Loading...
            {:else}
                All caught up!
            {/if}
        </p>
    {/if}

    {#each mergeRequests ?? [] as mr (mr.key)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class={[
                "card",
                filteredMergeRequest == null ? null : filteredMergeRequest.key == mr.key ? "selected" : "deselected",
            ]}
            data-helpid={`merge-request-${mr.key}`}
            animate:flip={{ duration: CARD_ANIMATION_DURATION }}
            transition:fade={{ duration: CARD_ANIMATION_DURATION }}
            style:--approval-color={`var(${getApprovalColor(mr)})`}
            style:--discussions-color={`var(${getDiscussionColor(mr)})`}
            style:--ci-color={`var(${getCiColor(mr)})`}
            style:--overall-color={`var(${getOverallColor(mr)})`}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="content" onclick={() => window.open(mr.webUrl, "_blank")}>
                <p class="title m-0">
                    {#each mr.ticketIntegration.createLinkParts(mr.title, mr.webUrl) as linkPart (linkPart)}
                        {#if linkPart.url}
                            <a href={linkPart.url} target="_blank" onclick={(e) => e.stopPropagation()}>
                                {linkPart.text}
                            </a>
                        {:else}
                            {linkPart.text}
                        {/if}
                    {/each}
                </p>
                <div class="footer">
                    <p>
                        {#if pinnedMergeRequest?.key == mr.key}
                            <i class="pin fa-solid fa-thumbtack"></i>
                        {/if}
                        <span
                            class="no-break mr-reference"
                            onclick={(e) => {
                                e.stopPropagation();
                                if (pinnedMergeRequest?.key == mr.key) {
                                    pinnedMergeRequest = null;
                                } else {
                                    pinnedMergeRequest = mr;
                                }
                            }}
                            onmouseenter={() => (hoveredMergeRequest = mr)}
                            onmouseleave={() => (hoveredMergeRequest = null)}>
                            {mr.reference}
                        </span>
                        ·
                        <span {@attach tooltip({ title: moment(mr.createdAt).format(DATE_FORMAT) })}>
                            {$fromNow(mr.createdAt)}
                        </span>
                        {#if role == "reviewer"}
                            {#if mr.assigneeName}
                                · {mr.assigneeName}
                            {/if}
                        {:else if mr.reviewerName}
                            · {mr.reviewerName}
                        {/if}
                    </p>
                    <p class="updated-at" {@attach tooltip({ title: moment(mr.updatedAt).format(DATE_FORMAT) })}>
                        Updated {$fromNow(mr.updatedAt)}
                    </p>
                </div>
            </div>
            <div class="bubbles">
                <div class="approval" {@attach tooltip({ title: getApprovalTooltip(mr), ...tooltipOptions })}>
                    <i class="fa-regular fa-circle-check"></i>
                </div>
                <div class="discussions" {@attach tooltip({ title: getDiscussionTooltip(mr), ...tooltipOptions })}>
                    {#if mr.openDiscussions > 0}
                        {#if mr.firstOpenNoteId != null}
                            <a href={`${mr.webUrl}#note_${mr.firstOpenNoteId}`} target="_blank">{mr.openDiscussions}</a>
                        {:else}
                            {mr.openDiscussions}
                        {/if}
                    {:else}
                        <i class="fa-solid fa-list-check"></i>
                    {/if}
                </div>
                <div class="ci" {@attach tooltip({ title: getCiTooltip(mr), ...tooltipOptions })}>
                    {#if mr.ciUrl}
                        <a href={mr.ciUrl} target="_blank" aria-label="Pipeline Status">
                            <i class="fa-solid fa-robot"></i>
                        </a>
                    {:else}
                        <i class="fa-solid fa-robot"></i>
                    {/if}
                </div>
            </div>
        </div>
    {/each}
</div>

<style lang="scss">
    @import "lib/styles/mixins.scss";

    .merge-request-table {
        position: relative;
    }

    // Needs to be absolutely positioned on top of the cards, as despite its animation delay it gets added to the DOM
    // straight away, while the cards are still fading out.
    .status {
        position: absolute;
        top: 1em;
        left: 0;
        right: 0;
        text-align: center;
    }

    :root {
        --status-good: lightgreen;
        --status-my-action: lightskyblue;
        --status-others-action: silver;
        --status-not-ready: lightgray;
        --status-broken: #ff8787;
    }

    .card {
        display: grid;
        grid-template-columns: 1fr auto;
        overflow: hidden;
        // Give a bit of space for the border glow
        margin: 5px 5px 15px 5px;
        border: 1px solid var(--overall-color);
        box-shadow: 0 0 4px 1px color-mix(in srgb, var(--overall-color) 60%, transparent);
        transition:
            border var(--card-animation-duration) ease,
            box-shadow var(--card-animation-duration) ease,
            opacity var(--activity-animation-duration) ease;

        opacity: 1;
        &.deselected {
            opacity: 0.5;
        }
    }

    .content {
        @include subtle-link;

        display: grid;
        grid-template-rows: 1fr auto;
        row-gap: 8px;
        padding: 5px 8px;
    }

    .bubbles {
        display: grid;
        grid-template-rows: 1fr 1fr 1fr;
        color: var(--bs-body-color);
        width: 30px;
        line-height: 0; // Override bootstrap style on links
        font-size: 0.8rem;

        a {
            color: var(--bs-body-color);
            text-decoration: none;
            width: 100%;
            height: 100%;
        }

        div {
            padding: 3px;
        }

        div,
        a {
            // Center icons in bubble
            display: flex;
            justify-content: center;
            align-items: center;
            transition: background-color var(--card-animation-duration) ease;
        }

        .approval {
            background-color: var(--approval-color);
        }

        .discussions {
            background-color: var(--discussions-color);
        }

        .ci {
            background-color: var(--ci-color);
        }
    }

    .footer {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;

        p {
            margin-bottom: 0;
            font-size: 0.8rem;
            text-wrap: balance;
        }

        .no-break {
            white-space: nowrap;
        }

        .updated-at {
            text-wrap: nowrap;
        }

        .mr-reference {
            cursor: pointer;
            &:hover {
                text-decoration: underline;
            }
        }

        .pin {
            font-size: 0.8em;
        }
    }

    .card.selected .footer .mr-reference {
        text-decoration: underline;
    }
</style>
