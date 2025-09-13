<script lang="ts">
    import { enhance } from "$app/forms";
    import type { SubmitFunction } from "@sveltejs/kit";
    import { gitlabSettings } from "$lib/Settings";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";

    let baseUrl = $state($gitlabSettings.baseUrl);

    const save: SubmitFunction = ({ formData, cancel }) => {
        cancel();
        $gitlabSettings.baseUrl = formData.get("baseUrl") as string;
        $gitlabSettings.accessToken = formData.get("accessToken") as string;
        goto(resolve("/"));
    };
</script>

<svelte:head>
    <title>Settings</title>
</svelte:head>

<h1>Settings</h1>

<form use:enhance={save} method="POST">
    <div class="mb-3">
        <label for="baseUrl" class="form-label">GitLab URL</label>
        <div class="input-group">
            <span class="input-group-text">https://</span>
            <input
                name="baseUrl"
                class="form-control"
                required
                value={$gitlabSettings.baseUrl}
                onblur={(e) => (baseUrl = (e.target as HTMLInputElement).value)} />
        </div>
        <div class="form-text">Don't include 'rest/api' etc</div>
    </div>

    <div class="mb-3">
        <label for="accessToken" class="form-label">GitLab Personal Access Token</label>
        <input type="password" class="form-control" name="accessToken" required value={$gitlabSettings.accessToken} />
        <div class="form-text">
            {#if baseUrl}
                {@const url = `https://${baseUrl}/-/user_settings/personal_access_tokens`}
                Generate at <a href={url} target="_blank">{url}</a>.
            {/if}
            This needs to have the read_api scope
        </div>
    </div>

    <input type="submit" class="btn btn-primary" value="Save" />
</form>
