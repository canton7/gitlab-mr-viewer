<script lang="ts">
    import type { MergeRequest } from '$lib/GitlabClient.svelte';
    import moment from 'moment';

    interface Props {
        mergeRequests: MergeRequest[];
        showAuthor: boolean;
    }

    let { mergeRequests, showAuthor = false }: Props = $props();
</script>

<div class="merge-request-table">
    {#each mergeRequests as mr (mr.id)}
        <div>
            <p><a href={mr.web_url}>{mr.title}</a></p>
            <p class="subtitle">
                {mr.reference} · {moment(mr.created_at).fromNow()}
                {#if showAuthor}
                    by {mr.author_name}
                {/if}
            </p>
        </div>
        <div>
            <p class="subtitle">Updated {moment(mr.updated_at).fromNow()}</p>
        </div>
    {/each}
</div>

<style>
    .merge-request-table {
        display: grid;
        grid-template-columns: 1fr auto;
        grid-row-gap: 20px;
    }

    .merge-request-table a {
        text-decoration: none;
    }

    .merge-request-table a:hover {
        text-decoration: underline;
    }

    .merge-request-table p {
        font-size: 0.75rem;
        margin: 0;
    }

    p.subtitle {
        font-size: 0.6rem;
    }
</style>
