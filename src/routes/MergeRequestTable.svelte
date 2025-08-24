<script lang="ts">
    import type { MergeRequest } from '$lib/GitlabClient.svelte';
    import moment from 'moment';

    interface Props {
        mergeRequests: MergeRequest[];
        showAuthor?: boolean;
    }

    let { mergeRequests, showAuthor = false }: Props = $props();
</script>

{#if mergeRequests.length == 0}
    <p class="caught-up">All caught up!</p>
{/if}

<div class="merge-request-table">
    {#each mergeRequests as mr (mr.id)}
        <div class="card p-2">
            <div class="headline">
                <p><a href={mr.webUrl}>{mr.title}</a></p>
                <div class="bubbles">
                    {#if mr.totalDiscussions > 0}
                        <div class="bubble">
                            {mr.resolvedDiscussions} / {mr.totalDiscussions}
                            <i class="fa-solid fa-list-check"></i>
                        </div>
                    {/if}
                    {#if mr.ciLink}
                        <a href={mr.ciLink}>{mr.ciStatus}</a>
                    {:else}
                        {mr.ciStatus}
                    {/if}
                    {#if mr.isApproved}
                        <div class="bubble">
                            Approved
                            <i class="approved fa-regular fa-circle-check"></i>
                        </div>
                    {/if}
                </div>
            </div>
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
    {/each}
</div>

<style>
    .caught-up {
        text-align: center;
    }

    .headline {
        display: flex;
        /* Not ideal: bubbles take up more space than they need to */
        justify-content: space-between;
        align-items: stretch;

        .bubbles {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
        }
    }

    .bubble {
        display: inline-flex;
        align-items: center;
        font-size: 0.9rem;
        border: 1px solid black;
        padding: 2px 6px;
        height: 1.5rem;
        border-radius: 0.5rem;

        i {
            margin-left: 5px;
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

    .approved {
        color: green;
        text-align: right;
    }
</style>
