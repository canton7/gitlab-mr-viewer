<script lang="ts">
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
</script>

<h1>Merge Requests</h1>

{#await data.client.mergeRequests}
    <p>Loading...</p>
{:then mergeRequests}
    <ul>
        {#each mergeRequests as mr (mr.id)}
            <li>{mr.title}</li>
        {/each}
    </ul>
{/await}
