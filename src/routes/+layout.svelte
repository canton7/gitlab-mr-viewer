<script lang="ts">
    import favicon from '$lib/assets/favicon.svg';
    import '$lib/styles/styles.scss';
    import '@fortawesome/fontawesome-free/css/all.min.css';

    let { children } = $props();
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<div class="container-md">
    {@render children?.()}
</div>
