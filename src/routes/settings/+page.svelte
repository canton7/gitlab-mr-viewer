<script lang="ts">
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';
    import { gitlabSettings } from '$lib/Settings.svelte';
    import type { PageProps } from './$types';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';

    // let { data }: PageProps = $props();

    const save: SubmitFunction = ({ formData, cancel }) => {
        cancel();
        $gitlabSettings.baseUrl = formData.get('baseUrl') as string;
        $gitlabSettings.accessToken = formData.get('accessToken') as string;
        goto(resolve('/'));
    };
</script>

<svelte:head>
    <title>Settings</title>
</svelte:head>

<h1>Settings</h1>

<form use:enhance={save} method="POST">
    <label>
        GitLab URL
        <input name="baseUrl" required value={$gitlabSettings.baseUrl} />
        <small>Don't include 'rest/api' etc</small>
    </label>

    <label>
        GitLab Personal Access Token
        <input type="password" name="accessToken" required value={$gitlabSettings.accessToken} />
        <small>This needs to have the read_api scope</small>
    </label>

    <input type="submit" value="Save" />
</form>
