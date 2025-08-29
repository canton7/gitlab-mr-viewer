import type * as Bootstrap from "bootstrap";
import type { Attachment } from "svelte/attachments";
import { fromStore, readonly, writable } from "svelte/store";

const _bootstrapStore = writable<typeof Bootstrap | null>(null);
// attachments work better with states, as they re-evaluate properly
const _bootstrapState = fromStore(_bootstrapStore);
export const bootstrap = readonly(_bootstrapStore);

export async function loadBootstrap() {
    _bootstrapStore.set(await import("bootstrap"));
}

export function tooltip(options: Partial<Bootstrap.Tooltip.Options>): Attachment {
    return (element) => {
        if (!_bootstrapState.current) {
            return;
        }
        const tooltip = new _bootstrapState.current.Tooltip(element, options);
        return () => tooltip.dispose();
    };
}
