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
                <div>
                    {#if mr.totalDiscussions > 0}
                        <div class="bubble">
                            <i class="fa-regular fa-comment"></i>
                            {mr.resolvedDiscussions} / {mr.totalDiscussions}
                        </div>
                    {/if}
                    {#if mr.isApproved}
                        <i class="approved fa-regular fa-circle-check"></i>
                    {/if}
                    {#if mr.ciLink}
                        <a href={mr.ciLink}>{mr.ciStatus}</a>
                    {:else}
                        {mr.ciStatus}
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
        justify-content: space-between;
    }

    .bubble {
        display: inline-block;
        border: 1px solid black;
        padding: 0 5px;
        height: 25px;
        border-radius: 25px;
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
