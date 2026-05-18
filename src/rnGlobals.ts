import { I18nManager, Dimensions, PixelRatio, Platform, NativeModules, StyleSheet, AppRegistry } from 'react-native';

/**
 * Defines getter-backed properties on globalThis.__rn__ for the seven RN
 * modules agents most commonly need. Getters re-resolve each access so Fast
 * Refresh cannot strand a stale module reference.
 */
const ENTRIES: Array<[string, () => unknown]> = [
    ['I18nManager', () => I18nManager],
    ['Dimensions', () => Dimensions],
    ['PixelRatio', () => PixelRatio],
    ['Platform', () => Platform],
    ['NativeModules', () => NativeModules],
    ['StyleSheet', () => StyleSheet],
    ['AppRegistry', () => AppRegistry],
];

export function exposeRnGlobals(): void {
    const ns: Record<string, unknown> = {};
    for (const [key, getter] of ENTRIES) {
        Object.defineProperty(ns, key, {
            get: getter,
            enumerable: true,
            configurable: true,
        });
    }
    (globalThis as Record<string, unknown>).__rn__ = ns;
}
