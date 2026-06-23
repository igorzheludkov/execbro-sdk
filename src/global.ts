import { NetworkBuffer } from './networkBuffer';
import { ConsoleBuffer } from './consoleBuffer';
import { DevToolsGlobal, Capabilities } from './types';

declare global {
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
        version: '0.5.1',
        capabilities,
        stores,
        navigation,
        custom,
        getNetworkEntries: () => networkBuffer.getAll(),
        getConsoleEntries: () => consoleBuffer.getAll(),
        clearNetwork: () => networkBuffer.clear(),
        clearConsole: () => consoleBuffer.clear(),
    };

    globalThis.__RN_AI_DEVTOOLS__ = devtools;
}
