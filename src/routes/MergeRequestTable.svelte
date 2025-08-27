<script lang="ts">
    import { goto } from '$app/navigation';
    import type { MergeRequest } from '$lib/GitlabClient.svelte';
    import moment from 'moment';

    interface Props {
        mergeRequests: MergeRequest[];
        showAuthor?: boolean;
    }

    let { mergeRequests, showAuthor = false }: Props = $props();

    function getOverallClass(mr: MergeRequest) {
        if (mr.ciStatus == 'failed') {
            return 'overall-ci';
        }
        if (mr.totalDiscussions != mr.resolvedDiscussions) {
            return 'overall-discussions';
        }
        return 'overall-approval';
    }

    function getApprovalClass(mr: MergeRequest) {
        return mr.isApproved ? 'approved' : 'not-approved';
    }

    function getDiscussionClass(mr: MergeRequest) {
        return mr.totalDiscussions == mr.resolvedDiscussions ? 'no-open-discussions' : 'open-discussions';
    }

    function getCiClass(mr: MergeRequest) {
        if (mr.ciStatus == 'success' || mr.ciStatus == 'none') {
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
    {#each mergeRequests as mr (mr.id)}
        <div class={['card', getOverallClass(mr), getApprovalClass(mr), getDiscussionClass(mr), getCiClass(mr)]}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="content" onclick={() => window.open(mr.webUrl, '_blank')}>
                <p class="m-0"><a href={mr.webUrl} target="_blank">{mr.title}</a></p>
                <div class="footer">
                    <p>
                        {mr.reference} · {moment(mr.createdAt).fromNow()}
                        {#if showAuthor}
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
                    {#if mr.totalDiscussions != mr.resolvedDiscussions}
                        {mr.totalDiscussions - mr.resolvedDiscussions}
                    {:else}
                        <i class="fa-solid fa-list-check"></i>
                    {/if}
                </div>
                <div class="ci">
                    {#if mr.ciLink}
                        <a href={mr.ciLink} aria-label="CI Status"><i class="fa-solid fa-robot"></i></a>
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

    .approved {
        --approval-color: lightgreen;
    }
    .not-approved {
        --approval-color: lightgray;
    }

    .open-discussions {
        --discussions-color: blue;
    }
    .no-open-discussions {
        --discussions-color: lightgreen;
    }

    .ci-success {
        --ci-color: lightgreen;
    }
    .ci-failed {
        --ci-color: red;
    }
    .ci-pending {
        --ci-color: lightgray;
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
        box-shadow: 0 0 8px 1px color-mix(in srgb, var(--overall-color) 80%, transparent);
    }

    .content {
        display: grid;
        grid-template-rows: 1fr auto;
        row-gap: 10px;
        padding: 5px 8px;
        cursor: pointer;
    }

    .bubbles {
        display: grid;
        grid-template-rows: 1fr 1fr 1fr;
        color: black;
        width: 30px;

        a {
            color: black;
        }

        div {
            min-height: 25px;
            /* Center icons in bubble */
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
