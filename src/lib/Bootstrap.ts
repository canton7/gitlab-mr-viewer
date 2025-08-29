import type * as Bootstrap from 'bootstrap';
import type { Attachment } from 'svelte/attachments';
import { fromStore, readonly, writable } from 'svelte/store';

const _bootstrap = writable<typeof Bootstrap | null>(null);
export const bootstrap = readonly(_bootstrap);

export async function loadBootstrap() {
    _bootstrap.set(await import('bootstrap'));
}

export function tooltip(options: Partial<Bootstrap.Tooltip.Options>): Attachment {
    return (element) => {
        const b = fromStore(_bootstrap).current;
        if (!b) {
            return;
        }
        const tooltip = new b.Tooltip(element, options);
        return () => tooltip.dispose();
    };
}
