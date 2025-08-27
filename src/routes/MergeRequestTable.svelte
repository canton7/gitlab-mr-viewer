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
        <article class="border">
            <div>
                <p><a href={mr.webUrl}>{mr.title}</a></p>
                <p class="subtitle">
                    {mr.reference} · {moment(mr.createdAt).fromNow()}
                    {#if showAuthor}
                        by {mr.authorName}
                    {/if}
                </p>
            </div>
            <div class="column-2">
                <div>
                    <p>
                        {#if mr.totalDiscussions > 0}
                            {mr.resolvedDiscussions} / {mr.totalDiscussions}
                        {/if}
                        {#if mr.isApproved}
                            <button class="small">
                                <i>check</i>
                                <span>Approved</span>
                            </button>

                            <!-- <i class="approved fa-regular fa-circle-check"></i> -->
                        {/if}
                        {#if mr.ciLink}
                            <a href={mr.ciLink}>{mr.ciStatus}</a>
                        {:else}
                            {mr.ciStatus}
                        {/if}
                    </p>
                </div>
                <p class="subtitle">Updated {moment(mr.updatedAt).fromNow()}</p>
            </div>
        </article>
    {/each}
</div>

<style>
    .caught-up {
        text-align: center;
    }

    .merge-request-table {
        article {
            padding: 10px;
            display: grid;
            grid-template-columns: 1fr auto;

            button {
                gap: 0.25rem;
                font-size: 0.8rem;
            }

            & > div {
                display: flex;
                flex-direction: column;
            }
        }
    }

    /* .merge-request-table {
        display: grid;
        grid-template-columns: auto;
        grid-column-gap: 20px;
        grid-row-gap: 20px;
    }

    .merge-request-table > article {
        display: flex;
        flex-direction: column;
    } */

    .merge-request-table a {
        text-decoration: none;
    }

    .merge-request-table a:hover {
        text-decoration: underline;
    }

    .merge-request-table p {
        margin: 0;
    }

    .column-2 {
        text-align: right;
    }

    p.subtitle {
        font-size: 0.6rem;
        margin-top: auto;
    }

    .approved {
        color: green;
        text-align: right;
    }
</style>
