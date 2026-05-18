import { describe, it, expect, beforeEach, jest } from '@jest/globals';

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

describe('exposeRnGlobals', () => {
    beforeEach(() => {
        delete (globalThis as Record<string, unknown>).__rn__;
    });

    it('exposes the seven curated modules under __rn__', async () => {
        const { exposeRnGlobals } = await import('../src/rnGlobals');
        exposeRnGlobals();
        const ns = (globalThis as Record<string, unknown>).__rn__ as Record<string, unknown>;
        expect(ns).toBeDefined();
        for (const key of [
            'I18nManager', 'Dimensions', 'PixelRatio', 'Platform',
            'NativeModules', 'StyleSheet', 'AppRegistry',
        ]) {
            expect(ns[key]).toBeDefined();
        }
    });

    it('uses getters that re-resolve the module each access', async () => {
        // @ts-expect-error - virtual mock, peer dep not installed
        const rn = await import('react-native');
        const { exposeRnGlobals } = await import('../src/rnGlobals');
        exposeRnGlobals();
        const ns = (globalThis as Record<string, unknown>).__rn__ as Record<string, unknown>;
        expect((ns.I18nManager as { isRTL: boolean }).isRTL).toBe(false);
        (rn.I18nManager as { isRTL: boolean }).isRTL = true;
        expect((ns.I18nManager as { isRTL: boolean }).isRTL).toBe(true);
    });
});
