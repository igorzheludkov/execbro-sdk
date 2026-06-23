import { NetworkBuffer } from './networkBuffer';
import { ConsoleBuffer } from './consoleBuffer';
import { DevToolsGlobal, Capabilities } from './types';

// Single source of truth for the SDK version: the root package.json.
// Resolved relative to this file — Metro inlines the JSON at bundle time,
// Node resolves it from the shipped tarball at runtime. Avoids hand-syncing
// the version on every release. npm always includes package.json in the tarball.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SDK_VERSION: string = require('../package.json').version;

declare global {
    // eslint-disable-next-line no-var
    var __EXECBRO__: DevToolsGlobal | undefined;
    // eslint-disable-next-line no-var
    var __RN_AI_DEVTOOLS__: DevToolsGlobal | undefined;
}

export interface ExposeGlobalOptions {
    networkBuffer: NetworkBuffer;
    consoleBuffer: ConsoleBuffer;
    stores: Record<string, unknown>;
    navigation: unknown;
    custom: Record<string, unknown>;
    capabilities: Capabilities;
}

export function exposeGlobal(options: ExposeGlobalOptions): void {
    const { networkBuffer, consoleBuffer, stores, navigation, custom, capabilities } = options;

    const devtools: DevToolsGlobal = {
        version: SDK_VERSION,
        capabilities,
        stores,
        navigation,
        custom,
        getNetworkEntries: () => networkBuffer.getAll(),
        getConsoleEntries: () => consoleBuffer.getAll(),
        clearNetwork: () => networkBuffer.clear(),
        clearConsole: () => consoleBuffer.clear(),
    };

    (globalThis as any).__EXECBRO__ = devtools;
    globalThis.__RN_AI_DEVTOOLS__ = devtools; // legacy alias — same reference
}
