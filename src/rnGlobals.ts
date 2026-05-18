// react-native is a peer dependency provided by the host app at runtime.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - peer dependency resolved by host app
import { I18nManager, Dimensions, PixelRatio, Platform, NativeModules, StyleSheet, AppRegistry } from 'react-native';

/**
 * Defines getter-backed properties on globalThis.__rn__ for the seven RN
 * modules agents most commonly need. Getters re-resolve each access so Fast
 * Refresh cannot strand a stale module reference.
 */
export function exposeRnGlobals(): void {
    const ns: Record<string, unknown> = {};
    (globalThis as Record<string, unknown>).__rn__ = ns;

    Object.defineProperty(ns, 'I18nManager', {
        get: () => I18nManager,
        enumerable: true,
        configurable: true,
    });
    Object.defineProperty(ns, 'Dimensions', {
        get: () => Dimensions,
        enumerable: true,
        configurable: true,
    });
    Object.defineProperty(ns, 'PixelRatio', {
        get: () => PixelRatio,
        enumerable: true,
        configurable: true,
    });
    Object.defineProperty(ns, 'Platform', {
        get: () => Platform,
        enumerable: true,
        configurable: true,
    });
    Object.defineProperty(ns, 'NativeModules', {
        get: () => NativeModules,
        enumerable: true,
        configurable: true,
    });
    Object.defineProperty(ns, 'StyleSheet', {
        get: () => StyleSheet,
        enumerable: true,
        configurable: true,
    });
    Object.defineProperty(ns, 'AppRegistry', {
        get: () => AppRegistry,
        enumerable: true,
        configurable: true,
    });
}
