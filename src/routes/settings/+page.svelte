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
    <fieldset>
        <div class="field border label">
            <input name="baseUrl" required value={$gitlabSettings.baseUrl} />
            <label for="baseUrl">GitLab URL</label>
            <span class="helper">Don't include 'rest/api' etc</span>
        </div>

        <div class="field border label">
            <input type="password" name="accessToken" required value={$gitlabSettings.accessToken} placeholder=" " />
            <label for="accessToken">GitLab Personal Access Token</label>
            <span class="helper">This needs to have the read_api scope</span>
        </div>

        <button type="submit" class="btn primary">Save</button>
    </fieldset>
</form>
