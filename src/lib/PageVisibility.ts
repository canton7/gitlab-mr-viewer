import { browser } from "$app/environment";
import { on } from "svelte/events";
import { readonly, writable } from "svelte/store";

const isVisible = writable(false);

if (browser) {
    isVisible.set(!document.hidden);

    on(document, "visibilitychange", () => {
        isVisible.set(!document.hidden);
    });
}

const isPageVisible = readonly(isVisible);
export default isPageVisible;
