export const HMR_LOG_GLOBAL = '__rn_devtools_hmr_log__';
export const HMR_VIA_GLOBAL = '__rn_devtools_hmr_via__';
export const HMR_LOG_CAP = 32;

export type RefreshLogEntry = { at: number; modulePath?: string };
export type RecorderVia = 'performReactRefresh' | 'RefreshReg' | null;

export interface InstallResult {
    installed: boolean;
    via: RecorderVia;
    reason?: string;
}

declare global {
    // eslint-disable-next-line no-var
    var __rn_devtools_hmr_log__: RefreshLogEntry[] | undefined;
    // eslint-disable-next-line no-var
    var __rn_devtools_hmr_via__: RecorderVia | undefined;
    // eslint-disable-next-line no-var
    var __ReactRefresh: { performReactRefresh?: () => void } | undefined;
    // eslint-disable-next-line no-var
    var $RefreshReg$: ((type: unknown, id: string) => void) | undefined;
}

function pushEntry(entry: RefreshLogEntry): void {
    const arr = globalThis.__rn_devtools_hmr_log__;
    if (!arr) return;
    arr.push(entry);
    while (arr.length > HMR_LOG_CAP) arr.shift();
}

export function installFastRefreshRecorder(): InstallResult {
    if (Array.isArray(globalThis.__rn_devtools_hmr_log__)) {
        return { installed: true, via: globalThis.__rn_devtools_hmr_via__ ?? null };
    }

    globalThis.__rn_devtools_hmr_log__ = [];

    const refresh = globalThis.__ReactRefresh;
    if (refresh && typeof refresh.performReactRefresh === 'function') {
        const original = refresh.performReactRefresh.bind(refresh);
        refresh.performReactRefresh = function wrapped() {
            const result = original();
            pushEntry({ at: Date.now() });
            return result;
        };
        globalThis.__rn_devtools_hmr_via__ = 'performReactRefresh';
        return { installed: true, via: 'performReactRefresh' };
    }

    if (typeof globalThis.$RefreshReg$ === 'function') {
        const originalReg = globalThis.$RefreshReg$;
        globalThis.$RefreshReg$ = function wrappedReg(type: unknown, id: string) {
            originalReg(type, id);
            let modulePath: string | undefined;
            if (typeof id === 'string') {
                const spaceIdx = id.indexOf(' ');
                modulePath = spaceIdx === -1 ? id : id.slice(0, spaceIdx);
            }
            pushEntry({ at: Date.now(), modulePath });
        };
        globalThis.__rn_devtools_hmr_via__ = 'RefreshReg';
        return { installed: true, via: 'RefreshReg' };
    }

    globalThis.__rn_devtools_hmr_via__ = null;
    return {
        installed: false,
        via: null,
        reason: 'no __ReactRefresh and no $RefreshReg$',
    };
}
