<script lang="ts">
    import favicon from '$lib/assets/favicon.svg';
    import '$lib/styles/styles.scss';
    import '@fortawesome/fontawesome-free/css/all.min.css';
    // import 'beercss/src/cdn/beer.css';
    import 'beercss/src/cdn/beer.ts';

    let { children } = $props();
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<main class="responsive">
    {@render children?.()}
</main>
