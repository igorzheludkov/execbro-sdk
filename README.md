# react-native-ai-devtools-sdk

Companion SDK for ExecBro — captures network requests, console logs, and state store references from your React Native app for AI-powered debugging. Ships as the npm package `react-native-ai-devtools-sdk`, pairs with the MCP server `react-native-ai-devtools`.

## Why use this SDK?

The ExecBro MCP server (npm: `react-native-ai-devtools`) connects to your app via Chrome DevTools Protocol (CDP). This works great for most features, but CDP has limitations on newer React Native architectures (Expo SDK 52+, Bridgeless):

| | Without SDK | With SDK |
|---|---|---|
| Startup network requests (auth, config) | Missed | Captured from first fetch |
| Request/response headers | Partial | Full |
| Request/response bodies | Not available | Full (including GraphQL) |
| Console logs from startup | May miss early logs | Captured from first log |
| State store access | Manual via `execute_in_app` | Direct references exposed |
| Works on Bridgeless (Expo SDK 52+) | Partial | Full |
| Setup | None | One import |

The SDK patches `fetch` and `console` at import time and stores everything in an in-app buffer. The MCP server automatically detects the SDK and reads from it — no extra configuration needed.

## Installation

```bash
npm install react-native-ai-devtools-sdk
```

## Setup

Add to your app's entry file (`index.js`, `App.tsx`, or `app/_layout.tsx` for Expo Router) — **must be the first import**:

```js
import { init } from 'react-native-ai-devtools-sdk';
if (__DEV__) {
  init();
}

// ... rest of your imports
```

That's it. The MCP tools (`get_network_requests`, `get_logs`, etc.) will automatically use the SDK data when available.

### With state stores

Pass references to your state management stores for direct AI access:

```js
import { init } from 'react-native-ai-devtools-sdk';
import { store } from './store'; // Redux store
import { queryClient } from './queryClient'; // TanStack Query

if (__DEV__) {
  init({
    stores: {
      redux: store,
      queryClient: queryClient,
    },
  });
}
```

The AI assistant can then inspect store state directly:
```
execute_in_app with expression="globalThis.__RN_AI_DEVTOOLS__.stores.redux.getState()"
```

### With navigation

Pass your navigation reference for AI-powered navigation inspection:

```js
import { init } from 'react-native-ai-devtools-sdk';
import { navigationRef } from './navigation';

if (__DEV__) {
  init({
    navigation: navigationRef,
  });
}
```

### With custom references

Use `custom` to expose any additional tools, services, or objects that don't belong to stores or navigation (e.g. AsyncStorage, MMKV, analytics):

```js
import { init } from 'react-native-ai-devtools-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './mmkv';

if (__DEV__) {
  init({
    custom: {
      asyncStorage: AsyncStorage,
      mmkv: storage,
    },
  });
}
```

### Configuration options

```js
init({
  // Max network entries to buffer (default: 500)
  maxNetworkEntries: 500,

  // Max console entries to buffer (default: 500)
  maxConsoleEntries: 500,

  // State store references for AI access
  stores: {
    redux: reduxStore,
    queryClient: queryClient,
    userStore: useUserStore,
  },

  // Navigation reference
  navigation: navigationRef,

  // Any additional references for AI access
  custom: {
    asyncStorage: AsyncStorage,
    mmkv: storage,
  },
});
```

## How it works

### Architecture

```
React Native App
  |
  |  1. import { init } from 'react-native-ai-devtools-sdk'
  |     → patches globalThis.fetch (captures all network requests)
  |     → patches console.log/warn/error/info/debug (captures all logs)
  |     → stores references to state management stores
  |     → exposes globalThis.__RN_AI_DEVTOOLS__ with query methods
  |
  |  2. App runs normally — all fetch() calls and console output
  |     are intercepted, stored in circular buffers, and passed
  |     through to their original implementations unchanged
  |
  v
ExecBro MCP Server (npm: react-native-ai-devtools)
  |
  |  3. Connects to app via CDP (Chrome DevTools Protocol)
  |     Detects SDK: typeof globalThis.__RN_AI_DEVTOOLS__?.getNetworkRequests === "function"
  |
  |  4. MCP tools read SDK data via Runtime.evaluate:
  |     get_network_requests → globalThis.__RN_AI_DEVTOOLS__.getNetworkRequests()
  |     get_request_details  → globalThis.__RN_AI_DEVTOOLS__.getNetworkRequest(id)
  |     get_logs (future)    → globalThis.__RN_AI_DEVTOOLS__.getConsoleLogs()
  |
  v
AI Assistant (Claude Code, Cursor, VS Code Copilot, etc.)
```

### What gets captured

**Network requests** — Every `fetch()` call is intercepted. The SDK captures:
- Method, URL, status, statusText, duration
- Full request and response headers
- Full request and response bodies (via `response.clone().text()` — the original response is untouched)
- Errors and timing

**Console output** — Every `console.log/warn/error/info/debug` call is captured with:
- Log level, timestamp, formatted message
- Original console methods still work — logs appear in Xcode/Metro/DevTools as normal

**State stores** — References passed via `stores` option are exposed globally for the MCP server to query on demand.

### Why it must be the first import

The SDK patches `globalThis.fetch` and `console` when `init()` is called. If other code (your app, libraries like Apollo/Axios) calls `fetch` before the SDK patches it, those requests won't be captured. Placing the import first ensures the SDK intercepts everything from the very beginning, including:

- OAuth token refresh on app launch
- Initial GraphQL/REST API calls
- Config/feature flag fetches
- Early console output during initialization

### Production safety

The SDK is a no-op in production builds:

1. The `if (__DEV__)` guard in your code prevents `init()` from being called
2. Even if called without the guard, `init()` checks `__DEV__` internally as a safety net
3. Tree-shaking removes the SDK code from production bundles when wrapped in `if (__DEV__)`

### Circular buffers

Both network and console data are stored in circular buffers (default: 500 entries each). When the buffer is full, the oldest entries are evicted. This bounds memory usage regardless of how many requests or logs the app produces.

## Exposed global API

The SDK exposes `globalThis.__RN_AI_DEVTOOLS__` with these methods. You don't need to call these directly — the MCP tools use them automatically.

```typescript
globalThis.__RN_AI_DEVTOOLS__ = {
  version: '0.2.0',

  // Capabilities — tells MCP server what's available
  capabilities: {
    network: true,
    console: true,
    stores: true,      // true if stores were passed
    navigation: true,  // true if navigation was passed
    render: false,     // future: render profiling
  },

  // State store references
  stores: { redux: store, queryClient: qc, ... },

  // Navigation reference
  navigation: navigationRef,

  // Custom references (AsyncStorage, MMKV, etc.)
  custom: { asyncStorage: AsyncStorage, mmkv: storage, ... },

  // Network
  getNetworkRequests(options?),  // { count, method, urlPattern, status }
  getNetworkRequest(id),          // full details including bodies
  getNetworkStats(),
  clearNetwork(),

  // Console
  getConsoleLogs(options?),      // { count, level, text }
  clearConsole(),
}
```

## Compatibility

| React Native | Architecture | Status |
|---|---|---|
| Expo SDK 54+ (RN 0.79+) | Bridgeless | Fully supported |
| Expo SDK 52-53 (RN 0.76-0.78) | Bridgeless | Fully supported |
| RN 0.73-0.75 | Hermes + Bridge | Fully supported |
| RN 0.70-0.72 | Hermes + Bridge | Should work (untested) |
| RN < 0.70 | JSC | Not tested |

The SDK has zero native dependencies — it's pure JavaScript that patches standard globals (`fetch`, `console`). It works on any React Native version that supports these globals.

## Relationship to ExecBro

This SDK is an **optional companion** to the ExecBro MCP server (npm: [`react-native-ai-devtools`](https://github.com/igorzheludkov/react-native-ai-devtools)). The MCP server works without the SDK — it connects via CDP and provides console logs, component inspection, UI interaction, and basic network tracking out of the box.

The SDK enhances network and console capture for cases where CDP alone isn't sufficient (Bridgeless architecture, startup request capture, response bodies). When the MCP server detects the SDK, it automatically prefers SDK data. When the SDK is absent, it falls back to CDP.

**You do NOT need the SDK for:**
- Console log viewing (`get_logs`)
- Component tree inspection (`get_component_tree`, `inspect_component`)
- UI interaction (`tap`, `swipe`, screenshots)
- JavaScript execution (`execute_in_app`)
- App reload, bundle error detection, device management

**The SDK improves:**
- Network request capture (especially startup requests and response bodies)
- Console log capture (startup logs that CDP might miss)
- State store access (direct references vs manual global inspection)

## License

MIT
