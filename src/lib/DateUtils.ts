import moment from "moment";
import { derived, readable } from "svelte/store";

export const DATE_FORMAT = "ddd DD MMMM YYYY [at] h:mm:ss a";

const NOW_UPDATE_INTERVAL_MS = 30 * 1000;

export const now = readable(new Date(), (set) => {
    set(new Date());

    const interval = setInterval(() => {
        set(new Date());
    }, NOW_UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
});

/**
 * $now can lag, and if it's a bit behind, then doing 'moment(someDate).from($now)' can show e.g. 'in 5 seconds'.
 *
 * Instead, use '$fromNow(someDate)'.
 */
export const fromNow = derived(now, ($now) => (date: Date | string) => {
    const nowMoment = moment(date);
    return nowMoment.from(moment.max(nowMoment, moment($now)));
});
