<script lang="ts">
    import { resolve } from '$app/paths';
    import { page } from '$app/state';
    import favicon from '$lib/assets/favicon.svg';
    import '$lib/styles/styles.scss';
    import '@fortawesome/fontawesome-free/css/all.min.css';

    let { children } = $props();

    let navItems = [
        { title: 'Home', url: resolve('/') },
        { title: 'Settings', url: resolve('/settings') }
    ];
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<nav class="navbar navbar-expand navbar-light bg-light container-fluid">
    <div class="container-md">
        <a class="navbar-brand" href={resolve('/')}>Merge Requests</a>

        <div class="navbar-collapse navbar-nav">
            {#each navItems as nav}
                <a class="nav-link" class:active={nav.url == page.url.pathname} href={nav.url}>{nav.title}</a>
            {/each}
        </div>
    </div>
</nav>

<div class="container-md mt-4">
    {@render children?.()}
</div>
