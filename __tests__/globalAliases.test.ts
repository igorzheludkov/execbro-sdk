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

describe('global aliases', () => {
    beforeEach(() => {
        _resetForTesting();
    });

    afterEach(() => {
        _resetForTesting();
    });

    it('exposes the registration object at both __EXECBRO__ and __RN_AI_DEVTOOLS__', () => {
        init();
        expect((globalThis as any).__EXECBRO__).toBeDefined();
        expect((globalThis as any).__RN_AI_DEVTOOLS__).toBeDefined();
        expect((globalThis as any).__EXECBRO__).toBe((globalThis as any).__RN_AI_DEVTOOLS__);
    });
});
