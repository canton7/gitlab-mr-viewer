<script lang="ts">
    import type { MergeRequest } from '$lib/gitlab/GitlabClient.svelte';
    import moment from 'moment';
    import { flip } from 'svelte/animate';
    import { fade, fly } from 'svelte/transition';

    interface Props {
        mergeRequests: MergeRequest[];
        role: 'assignee' | 'reviewer';
    }

    let { mergeRequests, role }: Props = $props();

    function getOverallClass(mr: MergeRequest) {
        if (mr.ciStatus != 'none' && mr.ciStatus != 'success') {
            return 'overall-ci';
        }
        if (mr.openDiscussions > 0) {
            return 'overall-discussions';
        }
        return 'overall-approval';
    }

    function getApprovalClass(mr: MergeRequest) {
        if (mr.isApproved) {
            return 'approved';
        }
        if (mr.openDiscussions == 0) {
            return 'ready-for-approval';
        }
        return 'not-approved';
    }

    function getDiscussionClass(mr: MergeRequest) {
        return mr.openDiscussions == 0 ? 'no-open-discussions' : 'open-discussions';
    }

    function getCiClass(mr: MergeRequest) {
        if (mr.ciStatus == 'success') {
            return 'ci-success';
        }
        if (mr.ciStatus == 'failed') {
            return 'ci-failed';
        }
        return 'ci-pending';
    }
</script>

{#if mergeRequests.length == 0}
    <p class="caught-up">All caught up!</p>
{/if}

<div class="merge-request-table">
    {#each mergeRequests as mr (mr.key)}
        <div
            animate:flip
            transition:fade
            class={[
                'card',
                `role-${role}`,
                getOverallClass(mr),
                getApprovalClass(mr),
                getDiscussionClass(mr),
                getCiClass(mr)
            ]}
        >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="content" onclick={() => window.open(mr.webUrl, '_blank')}>
                <p class="m-0"><a href={mr.webUrl} target="_blank">{mr.title}</a></p>
                <div class="footer">
                    <p>
                        {mr.reference} · {moment(mr.createdAt).fromNow()}
                        {#if role == 'reviewer'}
                            by {mr.authorName}
                        {/if}
                    </p>
                    <p>Updated {moment(mr.updatedAt).fromNow()}</p>
                </div>
            </div>
            <div class="bubbles">
                <div class="approval">
                    <i class="fa-regular fa-circle-check"></i>
                </div>
                <div class="discussions">
                    {#if mr.openDiscussions > 0}
                        <a href={`${mr.webUrl}#note_${mr.firstOpenNoteId}`} target="_blank">{mr.openDiscussions}</a>
                    {:else}
                        <i class="fa-solid fa-list-check"></i>
                    {/if}
                </div>
                <div class="ci">
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

    // If it's approved, that's always good
    .approved {
        --approval-color: var(--status-good);
    }
    // If we're the assignee, it's always up to the reviewer to approve
    .role-assignee.not-approved,
    .role-assignee.ready-for-approval {
        --approval-color: var(--status-others-action);
    }
    // If we're the reviewer, it's our action if everything else is ready for approval
    .role-reviewer.not-approved {
        --approval-color: var(--status-not-ready);
    }
    .role-reviewer.ready-for-approval {
        --approval-color: var(--status-my-action);
    }

    // If we're the assignee, then we only need to take action if there are open discussions
    .role-assignee.no-open-discussions {
        --discussions-color: var(--status-good);
    }
    .role-assignee.open-discussions {
        --discussions-color: var(--status-my-action);
    }
    .role-reviewer.no-open-discussions,
    .role-reviewer.open-discussions {
        --discussions-color: var(--status-my-action);
    }
    // If it's approved (and there are no open discussions), then we're not expecting any more discussions
    .role-reviewer.no-open-discussions.approved {
        --discussions-color: var(--status-good);
    }

    .ci-success {
        --ci-color: var(--status-good);
    }
    // If we're the assignee it's our responsibility to fix broken CI. If we're reviewing, it's the assignee's
    .role-assignee.ci-failed {
        --ci-color: var(--status-broken);
    }
    .role-reviewer.ci-failed {
        --ci-color: var(--status-others-action);
    }
    .ci-pending {
        --ci-color: var(--status-others-action);
    }

    .overall-approval {
        --overall-color: var(--approval-color);
    }
    .overall-discussions {
        --overall-color: var(--discussions-color);
    }
    .overall-ci {
        --overall-color: var(--ci-color);
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
