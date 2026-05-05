# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Repository: https://github.com/igorzheludkov/react-native-ai-devtools-sdk

## Monorepo Context

This repo is part of the **react-native-ai-devtools** monorepo at `~/rn-devtools/`. See [`../CLAUDE.md`](../CLAUDE.md) for the full map and cross-repo workflows.

**Sibling repos:**
- `react-native-ai-devtools/` — MCP server, primary consumer of this SDK ([GitHub](https://github.com/igorzheludkov/react-native-ai-devtools))
- `infra/` — Cloudflare Worker backend + analytics dashboard
- `web/` — web platform (landing, user cabinet)
- `docs/` — **canonical location for all plans and specs** (`~/rn-devtools/docs/`)

**Plans and specs** must be written to `~/rn-devtools/docs/` (specs → `devtools-core/specs/`, plans → `devtools-core/plans/`). Never store plans/specs inside this repo.

## Commands

```bash
# Build (TypeScript → dist/)
npm run build

# Run all tests
npm test

# Run a single test file
npx jest __tests__/networkBuffer.test.ts

# Run tests matching a pattern
npx jest --testNamePattern "circular buffer"

# Type check without emitting
npx tsc --noEmit
```

No linter is configured in this project.

## Architecture

This is a lightweight TypeScript SDK (`react-native-ai-devtools-sdk`) that captures network requests, console logs, and state store references for AI-powered debugging in React Native apps. It is a companion to the `react-native-ai-devtools` MCP server.

### How It Works

1. **`init()`** (entry point in `src/index.ts`) orchestrates setup — idempotent, no-ops in production (`__DEV__` check)
2. **Interceptors** monkey-patch `globalThis.fetch` and `console.*` methods, capturing data while preserving original behavior (cloned responses, call-through to original console)
3. **Circular buffers** store captured entries with automatic eviction (default 500 entries each)
4. **Global API** exposed at `globalThis.__RN_AI_DEVTOOLS__` with query/stats/clear methods that the MCP server auto-detects

### Module Dependency Flow

```
index.ts (init orchestrator)
  ├── networkInterceptor.ts → patches fetch, writes to → networkBuffer.ts
  ├── consoleInterceptor.ts → patches console, writes to → consoleBuffer.ts
  ├── global.ts → exposes buffers + stores on globalThis.__RN_AI_DEVTOOLS__
  └── types.ts (shared type definitions)
```

### Key Design Decisions

- **No external runtime dependencies** — pure JS patching, no native modules
- **Network interceptor clones responses** (`response.clone().text()`) so consumers aren't affected
- **Console interceptor calls through** to original methods so logs still appear in DevTools/Xcode
- **`_resetForTesting()`** exported from index for test teardown
- **ID formats**: `sdk-<random>-<counter>` for network, `con-<random>-<counter>` for console

### Build & Publish

- CommonJS output targeting ES2020 with declaration files
- `prepublishOnly` auto-runs build
- Published files: `dist/`, `README.md`, `LICENSE`
