import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock(
    'react-native',
    () => ({
        I18nManager: { isRTL: false },
        Dimensions: { get: (k: string) => ({ width: 100, height: 200, scale: 1, fontScale: 1, key: k }) },
        PixelRatio: { get: () => 2, getFontScale: () => 1 },
        Platform: { OS: 'ios', Version: 16 },
        NativeModules: { PlatformConstants: { fake: true } },
        StyleSheet: { flatten: (s: unknown) => s, create: (s: unknown) => s },
        AppRegistry: { getAppKeys: () => ['main'] },
    }),
    { virtual: true },
);

import { init, _resetForTesting } from '../src/index';
import { unpatchXHR } from '../src/networkInterceptor';
import { unpatchConsole } from '../src/consoleInterceptor';
import { installMockXHR, uninstallMockXHR, lastInstance } from './mockXHR';

describe('integration', () => {
    beforeEach(() => {
        unpatchXHR();
        unpatchConsole();
        _resetForTesting();
        installMockXHR();
    });

    afterEach(() => {
        unpatchXHR();
        unpatchConsole();
        _resetForTesting();
        uninstallMockXHR();
    });

    it('init() exposes global and captures XHR requests', () => {
        init();

        expect(globalThis.__RN_AI_DEVTOOLS__).toBeDefined();
        expect(globalThis.__RN_AI_DEVTOOLS__!.version).toBe(require('../package.json').version);

        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/test');
        xhr.send();
        lastInstance()._fireLoad({
            status: 200,
            body: '{"data":1}',
            headers: { 'content-type': 'application/json' },
        });

        const entries = globalThis.__RN_AI_DEVTOOLS__!.getNetworkEntries();
        expect(entries).toHaveLength(1);
        expect(entries[0].url).toBe('https://api.example.com/test');
        expect(entries[0].status).toBe(200);
    });

    it('init() is idempotent', () => {
        init();
        const first = globalThis.__RN_AI_DEVTOOLS__;

        init();
        expect(globalThis.__RN_AI_DEVTOOLS__).toBe(first);
    });

    it('clearNetwork returns count and empties buffer', () => {
        init();

        const a = new XMLHttpRequest();
        a.open('GET', 'https://api.example.com/a');
        a.send();
        lastInstance()._fireLoad({ status: 200, body: 'ok' });

        const b = new XMLHttpRequest();
        b.open('GET', 'https://api.example.com/b');
        b.send();
        lastInstance()._fireLoad({ status: 200, body: 'ok' });

        const count = globalThis.__RN_AI_DEVTOOLS__!.clearNetwork();
        expect(count).toBe(2);
        expect(globalThis.__RN_AI_DEVTOOLS__!.getNetworkEntries()).toHaveLength(0);
    });

    it('exposes stores on the global', () => {
        const mockStore = { getState: () => ({ count: 1 }) };
        init({ stores: { redux: mockStore } });

        expect(globalThis.__RN_AI_DEVTOOLS__!.stores).toBeDefined();
        expect(globalThis.__RN_AI_DEVTOOLS__!.stores.redux).toBe(mockStore);
    });

    it('stores default to empty object when not provided', () => {
        init();

        expect(globalThis.__RN_AI_DEVTOOLS__!.stores).toEqual({});
    });

    it('capabilities reflect config with stores', () => {
        init({ stores: { redux: {} } });

        const caps = globalThis.__RN_AI_DEVTOOLS__!.capabilities;
        expect(caps.network).toBe(true);
        expect(caps.console).toBe(true);
        expect(caps.stores).toBe(true);
        expect(caps.navigation).toBe(false);
        expect(caps.render).toBe(false);
    });

    it('capabilities.stores is false when no stores provided', () => {
        init();

        expect(globalThis.__RN_AI_DEVTOOLS__!.capabilities.stores).toBe(false);
    });

    it('exposes navigation on the global', () => {
        const mockNav = { getCurrentRoute: () => 'Home' };
        init({ navigation: mockNav });

        expect(globalThis.__RN_AI_DEVTOOLS__!.navigation).toBe(mockNav);
        expect(globalThis.__RN_AI_DEVTOOLS__!.capabilities.navigation).toBe(true);
    });

    it('navigation defaults to null when not provided', () => {
        init();

        expect(globalThis.__RN_AI_DEVTOOLS__!.navigation).toBeNull();
        expect(globalThis.__RN_AI_DEVTOOLS__!.capabilities.navigation).toBe(false);
    });

    it('exposes custom references on the global', () => {
        const asyncStorage = { getItem: () => null };
        const mmkv = { getString: () => '' };
        init({ custom: { asyncStorage, mmkv } });

        expect(globalThis.__RN_AI_DEVTOOLS__!.custom.asyncStorage).toBe(asyncStorage);
        expect(globalThis.__RN_AI_DEVTOOLS__!.custom.mmkv).toBe(mmkv);
    });

    it('custom defaults to empty object when not provided', () => {
        init();

        expect(globalThis.__RN_AI_DEVTOOLS__!.custom).toEqual({});
    });

    it('console entries are accessible via global', () => {
        init();

        expect(typeof globalThis.__RN_AI_DEVTOOLS__!.getConsoleEntries).toBe('function');
        expect(typeof globalThis.__RN_AI_DEVTOOLS__!.clearConsole).toBe('function');
    });

    it('captures console logs via global', () => {
        init();

        console.log('integration test log');

        const entries = globalThis.__RN_AI_DEVTOOLS__!.getConsoleEntries();
        const ourLog = entries.find((l) => l.message.includes('integration test log'));
        expect(ourLog).toBeDefined();
        expect(ourLog!.level).toBe('log');
    });

    it('init() exposes __rn__ namespace with RN globals', () => {
        init();

        const ns = (globalThis as Record<string, unknown>).__rn__ as Record<string, unknown> | undefined;
        expect(ns).toBeDefined();
        expect(ns!.I18nManager).toBeDefined();
        expect((ns!.I18nManager as { isRTL: boolean }).isRTL).toBe(false);
    });

    it('clearConsole returns count', () => {
        init();

        console.log('msg1');
        console.warn('msg2');

        const entries = globalThis.__RN_AI_DEVTOOLS__!.getConsoleEntries();
        const count = globalThis.__RN_AI_DEVTOOLS__!.clearConsole();
        expect(count).toBe(entries.length);
        expect(globalThis.__RN_AI_DEVTOOLS__!.getConsoleEntries()).toHaveLength(0);
    });
});
