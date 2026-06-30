import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NetworkBuffer } from '../src/networkBuffer';
import { patchXHR, unpatchXHR } from '../src/networkInterceptor';
import {
    MockXMLHttpRequest,
    installMockXHR,
    uninstallMockXHR,
    lastInstance,
} from './mockXHR';

describe('networkInterceptor (XHR)', () => {
    let buffer: NetworkBuffer;

    beforeEach(() => {
        installMockXHR();
        buffer = new NetworkBuffer();
        patchXHR(buffer);
    });

    afterEach(() => {
        unpatchXHR();
        uninstallMockXHR();
    });

    it('captures successful GET', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/data');
        xhr.send();

        lastInstance()._fireLoad({
            status: 200,
            statusText: 'OK',
            body: '{"ok":true}',
            headers: { 'content-type': 'application/json' },
        });

        const entries = buffer.getAll();
        expect(entries).toHaveLength(1);
        expect(entries[0].method).toBe('GET');
        expect(entries[0].url).toBe('https://api.example.com/data');
        expect(entries[0].status).toBe(200);
        expect(entries[0].statusText).toBe('OK');
        expect(entries[0].responseBody).toBe('{"ok":true}');
        expect(entries[0].mimeType).toBe('application/json');
        expect(entries[0].responseHeaders['content-type']).toBe('application/json');
        expect(entries[0].completed).toBe(true);
        expect(entries[0].errorType).toBeUndefined();
        void xhr;
    });

    it('captures JSON POST with string body', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.example.com/users');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({ name: 'test' }));

        lastInstance()._fireLoad({ status: 201, body: 'created' });

        const entries = buffer.getAll();
        expect(entries[0].method).toBe('POST');
        expect(entries[0].requestBody).toBe('{"name":"test"}');
        expect(entries[0].requestHeaders['Content-Type']).toBe('application/json');
        expect(entries[0].status).toBe(201);
        void xhr;
    });

    it('serializes URLSearchParams request body', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.example.com/form');
        const params = new URLSearchParams();
        params.set('a', '1');
        params.set('b', 'two');
        xhr.send(params);

        lastInstance()._fireLoad({ status: 200, body: 'ok' });
        expect(buffer.getAll()[0].requestBody).toBe('a=1&b=two');
    });

    it('serializes FormData with text field and File', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.example.com/upload');
        const fd = new FormData();
        fd.append('name', 'test');
        fd.append('file', new File(['hello'], 'hello.txt', { type: 'text/plain' }));
        xhr.send(fd);

        lastInstance()._fireLoad({ status: 200, body: 'ok' });
        const body = buffer.getAll()[0].requestBody!;
        const parsed = JSON.parse(body);
        expect(parsed.name).toBe('test');
        expect(parsed.file).toBe('[file: hello.txt]');
    });

    it('serializes RN-style file object in FormData', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.example.com/upload');
        // Emulate React Native's FormData polyfill: it exposes `_parts`
        // (Array<[key, value]>) rather than coercing values to strings.
        const fd = new FormData();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (fd as any)._parts = [
            ['photo', { uri: 'file://x.jpg', name: 'x.jpg', type: 'image/jpeg' }],
        ];
        xhr.send(fd);

        lastInstance()._fireLoad({ status: 200, body: 'ok' });
        const parsed = JSON.parse(buffer.getAll()[0].requestBody!);
        expect(parsed.photo).toBe('[file: x.jpg]');
    });

    it('summarizes Blob request body as size placeholder', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.example.com/bin');
        const blob = new Blob(['1234567890'], { type: 'application/octet-stream' });
        xhr.send(blob);

        lastInstance()._fireLoad({ status: 200, body: 'ok' });
        expect(buffer.getAll()[0].requestBody).toBe('[binary body, 10 bytes]');
    });

    it('summarizes arraybuffer response', () => {
        const xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
        xhr.open('GET', 'https://api.example.com/bin');
        xhr.send();

        lastInstance()._fireLoad({
            status: 200,
            body: new ArrayBuffer(42),
        });
        expect(buffer.getAll()[0].responseBody).toBe('[binary response, 42 bytes]');
    });

    it('reads a textual blob response via FileReader when Blob.text is absent (RN)', async () => {
        // Simulate React Native: its Blob polyfill has no .text()/.arrayBuffer(),
        // so the interceptor must fall back to FileReader.readAsText. Node's Blob
        // DOES have .text(), so we hide it to reproduce the RN environment.
        const originalBlobText = Blob.prototype.text;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const originalBlobArrayBuffer = (Blob.prototype as any).arrayBuffer;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const OriginalFileReader = (globalThis as any).FileReader;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (Blob.prototype as any).text = undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (Blob.prototype as any).arrayBuffer = undefined;

        class MockFileReader {
            public result: string | ArrayBuffer | null = null;
            public onload: (() => void) | null = null;
            public onerror: (() => void) | null = null;
            readAsText(blob: Blob): void {
                // RN's native FileReader decodes the blob off-thread; emulate
                // with the original Blob.text we hid from the code under test.
                originalBlobText.call(blob).then(
                    (t: string) => {
                        this.result = t;
                        this.onload?.();
                    },
                    () => this.onerror?.(),
                );
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).FileReader = MockFileReader;

        try {
            const xhr = new XMLHttpRequest();
            xhr.responseType = 'blob';
            xhr.open('POST', 'https://api.example.com/graphql');
            xhr.send('{"query":"{ me { id } }"}');

            const payload = JSON.stringify({ data: { me: { id: '1' } } });
            lastInstance()._fireLoad({
                status: 200,
                body: new Blob([payload], { type: 'application/json' }),
                headers: { 'content-type': 'application/json; charset=utf-8' },
            });

            // The FileReader read resolves on a microtask — flush before asserting.
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(buffer.getAll()[0].responseBody).toBe(payload);
        } finally {
            Blob.prototype.text = originalBlobText;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (Blob.prototype as any).arrayBuffer = originalBlobArrayBuffer;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).FileReader = OriginalFileReader;
        }
    });

    it('HTTP 500 is captured without errorType', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/boom');
        xhr.send();

        lastInstance()._fireLoad({ status: 500, statusText: 'Internal Server Error', body: 'oops' });

        const entry = buffer.getAll()[0];
        expect(entry.status).toBe(500);
        expect(entry.responseBody).toBe('oops');
        expect(entry.errorType).toBeUndefined();
        expect(entry.error).toBeUndefined();
    });

    it('abort event sets errorType=abort', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/x');
        xhr.send();
        lastInstance().dispatchEvent(new Event('abort'));

        const entry = buffer.getAll()[0];
        expect(entry.errorType).toBe('abort');
        expect(entry.error).toBe('aborted');
        expect(entry.status).toBe(0);
    });

    it('timeout event sets errorType=timeout', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/x');
        xhr.send();
        lastInstance()._fireTimeout();

        expect(buffer.getAll()[0].errorType).toBe('timeout');
    });

    it('error event sets errorType=network', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/x');
        xhr.send();
        lastInstance()._fireError();

        expect(buffer.getAll()[0].errorType).toBe('network');
        expect(buffer.getAll()[0].error).toBe('network error');
    });

    it('isolates state across concurrent requests', () => {
        const a = new XMLHttpRequest();
        a.open('GET', 'https://api.example.com/a');
        a.send();

        const b = new XMLHttpRequest();
        b.open('POST', 'https://api.example.com/b');
        b.setRequestHeader('X-Tag', 'b');
        b.send('body-b');

        const instances = MockXMLHttpRequest.instances;
        instances[1]._fireLoad({ status: 201, body: 'bbb' });
        instances[0]._fireLoad({ status: 200, body: 'aaa' });

        const entries = buffer.getAll();
        expect(entries).toHaveLength(2);
        const entryA = entries.find((e) => e.url.endsWith('/a'))!;
        const entryB = entries.find((e) => e.url.endsWith('/b'))!;
        expect(entryA.status).toBe(200);
        expect(entryA.responseBody).toBe('aaa');
        expect(entryB.status).toBe(201);
        expect(entryB.requestBody).toBe('body-b');
        expect(entryB.requestHeaders['X-Tag']).toBe('b');
    });

    it('accumulates multiple setRequestHeader calls', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/h');
        xhr.setRequestHeader('X-One', '1');
        xhr.setRequestHeader('X-Two', '2');
        xhr.send();
        lastInstance()._fireLoad({ status: 200, body: '' });

        const headers = buffer.getAll()[0].requestHeaders;
        expect(headers['X-One']).toBe('1');
        expect(headers['X-Two']).toBe('2');
    });

    it('unpatchXHR restores prototype methods', () => {
        // Start from a clean slate — the outer beforeEach already patched.
        unpatchXHR();
        uninstallMockXHR();
        installMockXHR();

        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

        patchXHR(buffer);
        expect(XMLHttpRequest.prototype.open).not.toBe(originalOpen);

        unpatchXHR();
        expect(XMLHttpRequest.prototype.open).toBe(originalOpen);
        expect(XMLHttpRequest.prototype.send).toBe(originalSend);
        expect(XMLHttpRequest.prototype.setRequestHeader).toBe(originalSetRequestHeader);

        // After unpatch, sending should not add entries.
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/after');
        xhr.send();
        lastInstance()._fireLoad({ status: 200, body: '' });
        expect(buffer.getAll()).toHaveLength(0);
    });

    it('populates responseURL on redirect', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/from');
        xhr.send();
        lastInstance()._fireLoad({
            status: 200,
            body: 'ok',
            responseURL: 'https://api.example.com/to',
        });

        expect(buffer.getAll()[0].responseURL).toBe('https://api.example.com/to');
    });

    it('never stores user/password credentials from open()', () => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/secure', true, 'alice', 'hunter2');
        xhr.send();
        lastInstance()._fireLoad({ status: 200, body: '' });

        const entry = buffer.getAll()[0];
        const serialized = JSON.stringify(entry);
        expect(serialized).not.toContain('alice');
        expect(serialized).not.toContain('hunter2');
        // underlying call still received them
        const creds = lastInstance()._getCredentials();
        expect(creds.user).toBe('alice');
        expect(creds.password).toBe('hunter2');
    });

    it('double patchXHR is a no-op', () => {
        const firstOpen = XMLHttpRequest.prototype.open;
        patchXHR(buffer); // second call
        expect(XMLHttpRequest.prototype.open).toBe(firstOpen);
    });
});
