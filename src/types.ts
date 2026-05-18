export interface InitOptions {
    maxNetworkEntries?: number;
    maxConsoleEntries?: number;
    stores?: Record<string, unknown>;
    navigation?: unknown;
    /** Named references to any additional tools, services, or objects (e.g. AsyncStorage, MMKV, analytics) that don't belong to stores or navigation. */
    custom?: Record<string, unknown>;
}

export interface NetworkEntry {
    id: string;
    timestamp: number;
    method: string;
    url: string;
    status?: number;
    statusText?: string;
    duration?: number;
    requestHeaders: Record<string, string>;
    requestBody?: string;
    responseHeaders: Record<string, string>;
    responseBody?: string;
    mimeType?: string;
    error?: string;
    errorType?: 'abort' | 'timeout' | 'network';
    responseURL?: string;
    completed: boolean;
}

export interface ConsoleEntry {
    id: string;
    timestamp: number;
    level: 'log' | 'warn' | 'error' | 'info' | 'debug';
    message: string;
}

export interface Capabilities {
    network: boolean;
    console: boolean;
    stores: boolean;
    navigation: boolean;
    render: boolean;
}

export interface DevToolsGlobal {
    version: string;
    capabilities: Capabilities;
    stores: Record<string, unknown>;
    navigation: unknown;
    custom: Record<string, unknown>;
    getNetworkEntries: () => NetworkEntry[];
    getConsoleEntries: () => ConsoleEntry[];
    clearNetwork: () => number;
    clearConsole: () => number;
}

export interface RnGlobalsNamespace {
    I18nManager: unknown;
    Dimensions: unknown;
    PixelRatio: unknown;
    Platform: unknown;
    NativeModules: unknown;
    StyleSheet: unknown;
    AppRegistry: unknown;
}

declare global {
    // eslint-disable-next-line no-var
    var __rn__: RnGlobalsNamespace | null | undefined;
}
