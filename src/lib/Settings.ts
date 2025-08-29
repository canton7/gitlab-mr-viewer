import { browser } from "$app/environment";
import { writable } from "svelte/store";

function create<T>(name: string, defaultValue: T) {
    const state = writable<T>(defaultValue);

    if (browser) {
        const value = window.localStorage.getItem(name);
        if (value !== null) {
            state.set(JSON.parse(value) as T);
        }

        state.subscribe((value) => {
            window.localStorage.setItem(name, JSON.stringify(value));
        });
    }

    return state;
}

interface GitlabSettings {
    baseUrl?: string;
    accessToken?: string;
}

export const gitlabSettings = create<GitlabSettings>("gitlabSettings", {});
