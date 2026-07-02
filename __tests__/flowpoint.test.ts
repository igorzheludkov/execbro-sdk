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

import { init, flowpoint, _resetForTesting } from '../src/index';

describe('flowpoint()', () => {
    beforeEach(() => {
        _resetForTesting();
    });

    afterEach(() => {
        _resetForTesting();
    });

    it('is a silent no-op before init()', () => {
        expect(() => flowpoint({ name: 'f', step: 's' })).not.toThrow();
    });

    it('records entries readable via the global after init()', () => {
        init();
        flowpoint({ name: 'add-to-cart', step: 'start', begin: true });
        flowpoint({ name: 'add-to-cart', step: 'cleared', meta: { removed: 3 } });
        const entries = globalThis.__EXECBRO__!.getFlowpointEntries();
        expect(entries).toHaveLength(2);
        expect(entries[0].step).toBe('start');
        expect(entries[1].meta).toEqual({ removed: 3 });
        expect(entries[0].run).toBe(entries[1].run);
    });

    it('exposes snapshot, clear, and capability on both global aliases', () => {
        init();
        flowpoint({ name: 'f', step: 's' });
        const g = globalThis.__EXECBRO__!;
        expect(g.capabilities.flowpoints).toBe(true);
        expect(g.getFlowpointSnapshot().entries).toHaveLength(1);
        expect(typeof g.getFlowpointSnapshot().contextId).toBe('string');
        expect(globalThis.__RN_AI_DEVTOOLS__!.getFlowpointEntries()).toHaveLength(1);
        expect(g.clearFlowpoints()).toBe(1);
        expect(g.getFlowpointEntries()).toHaveLength(0);
    });

    it('respects maxFlowpointEntries', () => {
        init({ maxFlowpointEntries: 2 });
        flowpoint({ name: 'f', step: 'a' });
        flowpoint({ name: 'f', step: 'b' });
        flowpoint({ name: 'f', step: 'c' });
        expect(globalThis.__EXECBRO__!.getFlowpointEntries().map((e) => e.step)).toEqual(['b', 'c']);
    });
});
