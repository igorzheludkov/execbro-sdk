import { NetworkBuffer } from './networkBuffer';
import { NetworkEntry } from './types';

interface PerRequestState {
    id: string;
    method: string;
    url: string;
    requestHeaders: Record<string, string>;
    startTime: number;
}

const stateMap = new WeakMap<XMLHttpRequest, PerRequestState>();

let originalOpen: typeof XMLHttpRequest.prototype.open | null = null;
let originalSend: typeof XMLHttpRequest.prototype.send | null = null;
let originalSetRequestHeader: typeof XMLHttpRequest.prototype.setRequestHeader | null = null;
let idCounter = 0;

function generateId(): string {
    const random = Math.random().toString(36).substring(2, 6);
    return `sdk-${random}-${++idCounter}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stringifyBody(body: any): string | undefined {
    if (body == null) {
        return undefined;
    }
    try {
        if (typeof body === 'string') {
            return body;
        }
        if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
            return body.toString();
        }
        if (typeof FormData !== 'undefined' && body instanceof FormData) {
            return stringifyFormData(body);
        }
        if (typeof Blob !== 'undefined' && body instanceof Blob) {
            return typeof body.size === 'number'
                ? `[binary body, ${body.size} bytes]`
                : '[binary body]';
        }
        if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) {
            return typeof body.byteLength === 'number'
                ? `[binary body, ${body.byteLength} bytes]`
                : '[binary body]';
        }
        if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(body)) {
            const view = body as ArrayBufferView;
            return typeof view.byteLength === 'number'
                ? `[binary body, ${view.byteLength} bytes]`
                : '[binary body]';
        }
        if (typeof Document !== 'undefined' && body instanceof Document) {
            return '[document body]';
        }
        return '[non-string body]';
    } catch {
        return '[non-string body]';
    }
}

function stringifyFormData(fd: FormData): string {
    try {
        const obj: Record<string, string> = {};
        // React Native's FormData polyfill exposes `_parts` (an array of
        // [key, value] tuples). Native FormData coerces non-Blob values to
        // strings via String(value) during iteration, which loses RN's
        // `{ uri, name, type }` file shape. Prefer `_parts` when present.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: Array<[string, unknown]> | undefined = (fd as any)._parts;
        const entries: Array<[string, unknown]> = Array.isArray(parts)
            ? parts
            : [];
        if (entries.length === 0) {
            fd.forEach((value, key) => entries.push([key, value]));
        }
        for (const [key, value] of entries) {
            if (typeof Blob !== 'undefined' && value instanceof Blob) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const name = (value as any).name as string | undefined;
                if (name) {
                    obj[key] = `[file: ${name}]`;
                } else if (typeof value.size === 'number') {
                    obj[key] = `[file: ${value.size} bytes]`;
                } else {
                    obj[key] = '[file]';
                }
            } else if (
                value != null &&
                typeof value === 'object' &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                'uri' in (value as any)
            ) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const rn = value as any;
                obj[key] = `[file: ${rn.name ?? rn.uri}]`;
            } else {
                obj[key] = String(value);
            }
        }
        return JSON.stringify(obj);
    } catch {
        return '[formdata]';
    }
}

function parseResponseHeaders(raw: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!raw) {
        return result;
    }
    const lines = raw.split(/\r\n/);
    for (const line of lines) {
        if (!line) {
            continue;
        }
        const idx = line.indexOf(': ');
        if (idx === -1) {
            continue;
        }
        const key = line.slice(0, idx).toLowerCase();
        const value = line.slice(idx + 2);
        result[key] = value;
    }
    return result;
}

// Content-types whose payloads are textual and worth decoding even when the
// caller asked for arraybuffer/blob (e.g. axios with responseType='arraybuffer'
// against a JSON endpoint that occasionally returns a file). The runtime has
// already handled Content-Encoding (gzip/br) by the time we see the bytes.
function isTextualContentType(ct: string | undefined): boolean {
    if (!ct) return false;
    const c = ct.toLowerCase();
    return (
        c.startsWith('text/') ||
        c.includes('json') ||
        c.includes('xml') ||
        c.includes('javascript') ||
        c.includes('x-www-form-urlencoded')
    );
}

function parseCharset(ct: string | undefined): string {
    if (!ct) return 'utf-8';
    const m = /charset=([^;\s]+)/i.exec(ct);
    return m ? m[1].toLowerCase().replace(/^"|"$/g, '') : 'utf-8';
}

function decodeArrayBufferToString(ab: ArrayBuffer, charset: string = 'utf-8'): string | undefined {
    try {
        if (typeof TextDecoder !== 'undefined') {
            try {
                return new TextDecoder(charset).decode(new Uint8Array(ab));
            } catch {
                return new TextDecoder('utf-8').decode(new Uint8Array(ab));
            }
        }
        // Fallback: chunked String.fromCharCode (avoid stack blow-up on large buffers).
        const view = new Uint8Array(ab);
        let out = '';
        const chunk = 0x8000;
        for (let i = 0; i < view.length; i += chunk) {
            out += String.fromCharCode.apply(null, Array.from(view.subarray(i, i + chunk)));
        }
        return out;
    } catch {
        return undefined;
    }
}

function getResponseContentType(xhr: XMLHttpRequest): string | undefined {
    try {
        return xhr.getResponseHeader('content-type') ?? undefined;
    } catch {
        return undefined;
    }
}

function extractResponseBody(xhr: XMLHttpRequest): string | undefined {
    try {
        const rt = xhr.responseType;
        if (rt === '' || rt === 'text') {
            return xhr.responseText;
        }
        if (rt === 'json') {
            return JSON.stringify(xhr.response);
        }
        if (rt === 'arraybuffer') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ab = xhr.response as any;
            const size = ab && typeof ab.byteLength === 'number' ? ab.byteLength : null;
            const ct = getResponseContentType(xhr);
            if (ab instanceof ArrayBuffer && isTextualContentType(ct)) {
                const decoded = decodeArrayBufferToString(ab, parseCharset(ct));
                if (decoded != null) return decoded;
            }
            return size != null ? `[binary response, ${size} bytes]` : '[binary response]';
        }
        if (rt === 'blob') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const b = xhr.response as any;
            const size = b && typeof b.size === 'number' ? b.size : null;
            // Blob.text() is async; we can't await here without changing the
            // call path. Surface the size + a hint so the agent isn't misled.
            const ct = getResponseContentType(xhr);
            if (isTextualContentType(ct)) {
                return size != null
                    ? `[textual blob, ${size} bytes — set responseType to 'text' or 'arraybuffer' to capture body]`
                    : '[textual blob — set responseType to "text" or "arraybuffer" to capture body]';
            }
            return size != null ? `[binary response, ${size} bytes]` : '[binary response]';
        }
        if (rt === 'document') {
            return '[document response]';
        }
        return undefined;
    } catch {
        return undefined;
    }
}

export function patchXHR(buffer: NetworkBuffer): void {
    if (originalOpen) {
        return;
    }
    if (typeof XMLHttpRequest === 'undefined') {
        return;
    }

    originalOpen = XMLHttpRequest.prototype.open;
    originalSend = XMLHttpRequest.prototype.send;
    originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function patchedOpen(
        this: XMLHttpRequest,
        method: string,
        url: string | URL,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...rest: any[]
    ): void {
        try {
            stateMap.set(this, {
                id: generateId(),
                method: (method || 'GET').toUpperCase(),
                url: typeof url === 'string' ? url : String(url),
                requestHeaders: {},
                startTime: 0,
            });
        } catch {
            // ignore — never break the user's request
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (originalOpen as any).apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(
        this: XMLHttpRequest,
        name: string,
        value: string,
    ): void {
        const state = stateMap.get(this);
        if (state) {
            state.requestHeaders[name] = value;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (originalSetRequestHeader as any).call(this, name, value);
    };

    XMLHttpRequest.prototype.send = function patchedSend(
        this: XMLHttpRequest,
        body?: Document | XMLHttpRequestBodyInit | null,
    ): void {
        const state = stateMap.get(this);
        if (state) {
            state.startTime = Date.now();

            const entry: NetworkEntry = {
                id: state.id,
                timestamp: state.startTime,
                method: state.method,
                url: state.url,
                requestHeaders: { ...state.requestHeaders },
                requestBody: stringifyBody(body),
                responseHeaders: {},
                completed: false,
            };
            buffer.add(entry);

            const xhr = this;

            const onLoad = (): void => {
                try {
                    const duration = Date.now() - state.startTime;
                    const responseHeaders = parseResponseHeaders(
                        xhr.getAllResponseHeaders(),
                    );
                    const mimeType = xhr.getResponseHeader('content-type') ?? undefined;
                    const updates: Partial<NetworkEntry> = {
                        status: xhr.status,
                        statusText: xhr.statusText,
                        duration,
                        responseHeaders,
                        mimeType,
                        responseBody: extractResponseBody(xhr),
                        completed: true,
                    };
                    if (xhr.responseURL && xhr.responseURL !== state.url) {
                        updates.responseURL = xhr.responseURL;
                    }
                    buffer.update(state.id, updates);
                } catch {
                    buffer.update(state.id, { completed: true });
                }
            };

            const terminalUpdate = (
                error: string,
                errorType: NetworkEntry['errorType'],
            ): void => {
                buffer.update(state.id, {
                    status: 0,
                    duration: Date.now() - state.startTime,
                    error,
                    errorType,
                    completed: true,
                });
            };

            xhr.addEventListener('load', onLoad);
            xhr.addEventListener('error', () => terminalUpdate('network error', 'network'));
            xhr.addEventListener('abort', () => terminalUpdate('aborted', 'abort'));
            xhr.addEventListener('timeout', () => terminalUpdate('timeout', 'timeout'));
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (originalSend as any).call(this, body);
    };
}

export function unpatchXHR(): void {
    if (originalOpen && originalSend && originalSetRequestHeader) {
        XMLHttpRequest.prototype.open = originalOpen;
        XMLHttpRequest.prototype.send = originalSend;
        XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
    }
    originalOpen = null;
    originalSend = null;
    originalSetRequestHeader = null;
    idCounter = 0;
}
