import { type ResponseBodyTypes } from '@gitbeaker/requester-utils';

export interface CacheEntry {
    etag: string;
    body: ResponseBodyTypes;
    lastAccessed: number;
}

export class GitlabCache {
    private readonly _map = new Map<string, CacheEntry>();

    get(url: URL): CacheEntry | null {
        const entry = this._map.get(url.href) ?? null;
        if (entry != null) {
            entry.lastAccessed = Date.now();
        }
        return entry;
    }

    put(url: URL, etag: string, body: ResponseBodyTypes) {
        this._map.set(url.href, { etag, body, lastAccessed: Date.now() });
    }

    flush(timeoutMs: number) {
        const now = Date.now();
        for (const [key, value] of this._map) {
            if (now - value.lastAccessed > timeoutMs) {
                this._map.delete(key);
            }
        }
    }
}
