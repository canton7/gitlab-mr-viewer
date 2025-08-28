// All copied from the gitbreaker source because defaultRequestHandler isn't exporded, see https://github.com/jdalrymple/gitbeaker/issues/3634

import {
    getMatchingRateLimiter,
    GitbeakerRequestError,
    GitbeakerRetryError,
    GitbeakerTimeoutError,
    type FormattedResponse,
    type RequestHandlerFn,
    type RequestOptions,
    type ResponseBodyTypes
} from '@gitbeaker/requester-utils';
import type { GitlabCache } from './GitlabCache';

function getConditionalMode(endpoint: string) {
    if (endpoint.includes('repository/archive')) return 'same-origin';
    return undefined; // Default is 'cors'
}

async function parseResponse(response: Response, asStream = false) {
    const { status, headers: rawHeaders } = response;
    const headers = Object.fromEntries(rawHeaders.entries());
    let body: ResponseBodyTypes | null;

    if (asStream) {
        body = response.body;
    } else {
        body = status === 204 ? null : await processBody(response);
    }

    return { body, headers, status };
}

async function processBody(response: Response): Promise<ResponseBodyTypes> {
    // Split to remove potential charset info from the content type
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();

    if (contentType === 'application/json') {
        return response.json().then((v) => v || {});
    }

    if (contentType.startsWith('text/')) {
        return response.text().then((t) => t || '');
    }
    return response.blob();
}

function delay(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function throwFailedRequestError(request: Request, response: Response): Promise<GitbeakerRequestError> {
    const content = await response.text();
    const contentType = response.headers.get('Content-Type');
    let description: string;

    if (contentType?.includes('application/json')) {
        const output = JSON.parse(content);
        const contentProperty = output?.error || output?.message || '';

        description = typeof contentProperty === 'string' ? contentProperty : JSON.stringify(contentProperty);
    } else {
        description = content;
    }

    throw new GitbeakerRequestError(description, {
        cause: {
            description,
            request,
            response
        }
    });
}

export async function requestHandler(
    endpoint: string,
    cache: GitlabCache,
    options?: RequestOptions
): Promise<FormattedResponse<ResponseBodyTypes>> {
    const retryCodes = [429, 502];
    const maxRetries = 10;
    const { prefixUrl, asStream, searchParams, rateLimiters, method, ...opts } = options || {};
    const rateLimit = getMatchingRateLimiter(endpoint, rateLimiters, method);
    let lastStatus: number | undefined;
    let baseUrl: string | undefined;

    if (prefixUrl) baseUrl = prefixUrl.endsWith('/') ? prefixUrl : `${prefixUrl}/`;

    const url = new URL(endpoint, baseUrl);

    url.search = searchParams || '';

    let cachedResponse = null;
    if (method == 'GET') {
        cachedResponse = cache.get(url);
        if (cachedResponse != undefined) {
            if (opts.headers == undefined) {
                opts.headers = {};
            }
            opts.headers['If-None-Match'] = cachedResponse.etag;
        }
    }

    // CHECKME: https://github.com/nodejs/undici/issues/1305
    const mode = getConditionalMode(endpoint);

    for (let i = 0; i < maxRetries; i += 1) {
        // We're doing our own caching: no point in the browser keeping its own cache
        const request = new Request(url, { ...opts, method, mode, cache: 'no-store' });

        await rateLimit();

        const response = await fetch(request).catch((e) => {
            if (e.name === 'TimeoutError' || e.name === 'AbortError') {
                throw new GitbeakerTimeoutError('Query timeout was reached');
            }

            throw e;
        });

        if (response.ok) {
            const parsedResponse = await parseResponse(response, asStream);
            if (method == 'GET') {
                const etag = response.headers.get('ETag');
                if (etag != null) {
                    cache.put(url, etag, parsedResponse.body);
                }
            }
            return parsedResponse;
        } else if (response.status == 304 && cachedResponse !== null) {
            return {
                body: cachedResponse.body,
                headers: Object.fromEntries(response.headers.entries()),
                status: response.status
            };
        }
        if (!retryCodes.includes(response.status)) await throwFailedRequestError(request, response);

        // Retry
        lastStatus = response.status;
        await delay(2 ** i * 0.25);

        continue;
    }

    throw new GitbeakerRetryError(
        `Could not successfully complete this request after ${maxRetries} retries, last status code: ${lastStatus}. ${lastStatus === 429 ? 'Check the applicable rate limits for this endpoint' : 'Verify the status of the endpoint'}.`
    );
}
export function createRequestHandler(cache: GitlabCache): RequestHandlerFn {
    return (endpoint: string, options?: RequestOptions) => requestHandler(endpoint, cache, options);
}
