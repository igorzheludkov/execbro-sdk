import { NetworkBuffer } from './networkBuffer';
import { ConsoleBuffer } from './consoleBuffer';
import { FlowpointBuffer } from './flowpointBuffer';
import { patchXHR, unpatchXHR } from './networkInterceptor';
import { patchConsole } from './consoleInterceptor';
import { exposeGlobal } from './global';
import { exposeRnGlobals } from './rnGlobals';
import { installFastRefreshRecorder } from './fastRefreshRecorder';
import { InitOptions } from './types';

export { flowpoint } from './flowpoint';

export type {
    InitOptions,
    NetworkEntry,
    ConsoleEntry,
    Capabilities,
    DevToolsGlobal,
    FlowpointEntry,
    FlowpointOptions,
    FlowpointLevel,
    FlowpointSnapshot,
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
    const flowpointBuffer = new FlowpointBuffer(options?.maxFlowpointEntries ?? 500);
    const stores = options?.stores ?? {};
    const navigation = options?.navigation ?? null;
    const custom = options?.custom ?? {};

    patchXHR(networkBuffer);
    patchConsole(consoleBuffer);

    exposeGlobal({
        networkBuffer,
        consoleBuffer,
        flowpointBuffer,
        stores,
        navigation,
        custom,
        capabilities: {
            network: true,
            console: true,
            stores: Object.keys(stores).length > 0,
            navigation: navigation != null,
            render: false,
            flowpoints: true,
        },
    });

    exposeRnGlobals();
    installFastRefreshRecorder();

    initialized = true;
}

// Exported for testing purposes
export function _resetForTesting(): void {
    initialized = false;
    unpatchXHR();
    delete (globalThis as any).__EXECBRO__;
    delete globalThis.__RN_AI_DEVTOOLS__;
    delete (globalThis as Record<string, unknown>).__rn__;
    delete globalThis.__rn_devtools_hmr_log__;
    delete globalThis.__rn_devtools_hmr_via__;
}
