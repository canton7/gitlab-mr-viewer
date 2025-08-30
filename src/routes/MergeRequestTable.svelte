<script lang="ts">
    import { tooltip } from "$lib/Bootstrap";
    import type { MergeRequest } from "$lib/gitlab/GitlabClient.svelte";
    import type { Tooltip } from "bootstrap";
    import moment from "moment";
    import { flip } from "svelte/animate";
    import { fade } from "svelte/transition";

    interface Props {
        mergeRequests: MergeRequest[];
        role: "assignee" | "reviewer";
    }

    let { mergeRequests, role }: Props = $props();

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
        return mr.isApproved ? "Approved" : "Not approved";
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
            title = "No CI";
        } else {
            title = `CI ${mr.ciStatus}`;
        }

        const link = mr.ciLink == null ? "" : "<br><em>Click to view</em>";
        return title + link;
    }

    function getOverallColor(mr: MergeRequest) {
        if (mr.ciStatus != "none" && mr.ciStatus != "success") {
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

    const dateFormat = "ddd DD MMMM YYYY [at] h:mm:ss a";
</script>

{#if mergeRequests.length == 0}
    <p class="caught-up">All caught up!</p>
{/if}

<div class="merge-request-table">
    {#each mergeRequests as mr (mr.key)}
        <div
            class="card"
            animate:flip
            transition:fade
            style:--approval-color={`var(${getApprovalColor(mr)})`}
            style:--discussions-color={`var(${getDiscussionColor(mr)})`}
            style:--ci-color={`var(${getCiColor(mr)})`}
            style:--overall-color={`var(${getOverallColor(mr)})`}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="content" onclick={() => window.open(mr.webUrl, "_blank")}>
                <p class="m-0"><a href={mr.webUrl} target="_blank">{mr.title}</a></p>
                <div class="footer">
                    <p>
                        {mr.reference} ·
                        <span {@attach tooltip({ title: moment(mr.createdAt).format(dateFormat) })}>
                            {moment(mr.createdAt).fromNow()}
                        </span>
                        {#if role == "reviewer"}
                            by {mr.authorName}
                        {:else if mr.reviewerName}
                            to {mr.reviewerName}
                        {/if}
                    </p>
                    <p {@attach tooltip({ title: moment(mr.updatedAt).format(dateFormat) })}>
                        Updated {moment(mr.updatedAt).fromNow()}
                    </p>
                </div>
            </div>
            <div class="bubbles">
                <div class="approval" {@attach tooltip({ title: getApprovalTooltip(mr), ...tooltipOptions })}>
                    <i class="fa-regular fa-circle-check"></i>
                </div>
                <div class="discussions" {@attach tooltip({ title: getDiscussionTooltip(mr), ...tooltipOptions })}>
                    {#if mr.openDiscussions > 0}
                        <a href={`${mr.webUrl}#note_${mr.firstOpenNoteId}`} target="_blank">{mr.openDiscussions}</a>
                    {:else}
                        <i class="fa-solid fa-list-check"></i>
                    {/if}
                </div>
                <div class="ci" {@attach tooltip({ title: getCiTooltip(mr), ...tooltipOptions })}>
                    {#if mr.ciLink}
                        <a href={mr.ciLink} target="_blank" aria-label="CI Status"><i class="fa-solid fa-robot"></i></a>
                    {:else}
                        <i class="fa-solid fa-robot"></i>
                    {/if}
                </div>
            </div>
        </div>
    {/each}
</div>

<style lang="scss">
    .caught-up {
        text-align: center;
    }

    :root {
        --status-good: lightgreen;
        --status-my-action: lightblue;
        --status-others-action: lightgray;
        --status-not-ready: lightgray;
        --status-broken: #ff8787;
    }

    .card {
        display: grid;
        grid-template-columns: 1fr auto;
        overflow: hidden;
        margin-bottom: 15px;
        border: 1px solid var(--overall-color);
        box-shadow: 0 0 4px 1px color-mix(in srgb, var(--overall-color) 60%, transparent);
    }

    .content {
        display: grid;
        grid-template-rows: 1fr auto;
        row-gap: 8px;
        padding: 5px 8px;
        cursor: pointer;

        a {
            color: var(--bs-body-color);
            text-decoration: none;

            &:hover {
                text-decoration: underline;
            }
        }
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
        justify-content: space-between;

        p {
            margin-bottom: 0;
            font-size: 0.8rem;
        }
    }
</style>
