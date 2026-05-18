import { NetworkBuffer } from './networkBuffer';
import { ConsoleBuffer } from './consoleBuffer';
import { patchXHR, unpatchXHR } from './networkInterceptor';
import { patchConsole } from './consoleInterceptor';
import { exposeGlobal } from './global';
import { exposeRnGlobals } from './rnGlobals';
import { InitOptions } from './types';

export type {
    InitOptions,
    NetworkEntry,
    ConsoleEntry,
    Capabilities,
    DevToolsGlobal,
} from './types';

let initialized = false;

declare const __DEV__: boolean | undefined;

export function init(options?: InitOptions): void {
    if (initialized) {
        return;
    }

    // Safety net: no-op in production
    if (typeof __DEV__ !== 'undefined' && !__DEV__) {
        return;
    }

    const networkBuffer = new NetworkBuffer(options?.maxNetworkEntries ?? 500);
    const consoleBuffer = new ConsoleBuffer(options?.maxConsoleEntries ?? 500);
    const stores = options?.stores ?? {};
    const navigation = options?.navigation ?? null;
    const custom = options?.custom ?? {};

    patchXHR(networkBuffer);
    patchConsole(consoleBuffer);

    exposeGlobal({
        networkBuffer,
        consoleBuffer,
        stores,
        navigation,
        custom,
        capabilities: {
            network: true,
            console: true,
            stores: Object.keys(stores).length > 0,
            navigation: navigation != null,
            render: false,
        },
    });

    exposeRnGlobals();

    initialized = true;
}

// Exported for testing purposes
export function _resetForTesting(): void {
    initialized = false;
    unpatchXHR();
    delete globalThis.__RN_AI_DEVTOOLS__;
    delete (globalThis as Record<string, unknown>).__rn__;
}
