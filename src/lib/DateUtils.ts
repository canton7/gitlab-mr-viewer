import { readable } from "svelte/store";

export const DATE_FORMAT = "ddd DD MMMM YYYY [at] h:mm:ss a";

const NOW_UPDATE_INTERVAL_MS = 30 * 1000;

export const now = readable(new Date(), (set) => {
    set(new Date());

    const interval = setInterval(() => {
        set(new Date());
    }, NOW_UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
});
