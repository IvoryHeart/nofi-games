# Social Vibing Builder

An agentic builder for nofi.games. Users create and modify Canvas 2D games through chat. An AI writes the code, Sandpack previews it instantly, and a GitHub App auto-commits to branches that Vercel deploys as shareable previews.

No separate service. No SDK. Three core shifts: the harness is the product, branches are the persistence layer, and collaboration is the thesis test.

---

## Core insights

1. **The harness is the product.** The AI model is interchangeable. What we build is: what the AI can do (tools), what it can't (validators on every call), what it knows (system prompt), what it's allowed to touch (config).

2. **Branch-first, preview-as-launch.** A branch is created the moment building starts. Vercel deploys it. The game is shareable before any PR or merge.

3. **Zero mandatory auth.** A GitHub App handles all git operations. Users can build anonymously with a platform key. Auth is progressive enhancement for attribution and BYOK.

4. **Three collaboration modes.** Solo build → remix (branch from someone's branch) → live collab (multiple people, same branch, queued instructions). Same infrastructure, increasing social complexity.

5. **Stay on Vite.** The current project is a Vite + vanilla TypeScript SPA. The builder is a separate Vite entrypoint with React (for Sandpack). No framework migration. API routes use Vercel Serverless Functions.

6. **Builder is an extractable module.** `src/builder/` is fully self-contained. Its only coupling to the player app is engine source files loaded via Vite `?raw` imports. If extracted to a separate repo later, swap `?raw` imports for an npm package or git submodule. API routes (`api/`) move with it.

---

## Architecture (four layers)

```
┌────────────────────────────────────────────────────┐
│  Layer 4: Platform (nofi.games)                    │
│  Gallery, profiles, event write-layer, stats       │
│  Catches events from games, persists to DB         │
└────────────────────────────────────────────────────┘
         ▲ events (postMessage from iframe)
┌────────────────────────────────────────────────────┐
│  Layer 3: Game Runtime (iframe, sandboxed)         │
│  Pure client-side. Canvas 2D. No DB access.        │
│  Emits events. Optionally connects to WS relay.    │
│  sandbox="allow-scripts" (no allow-same-origin)    │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  Layer 2: Builder (/build, separate Vite entry)    │
│  React + Sandpack preview (~200ms hot-reload)      │
│  Chat UI via @ai-sdk/react useChat hook            │
│  Backend auto-commits at end of each AI turn       │
└────────────────────────────────────────────────────┘
         ▲ tool calls validated per-call
┌────────────────────────────────────────────────────┐
│  Layer 1: Harness (Vercel Serverless Functions)    │
│  System prompt. Tool definitions. Per-call         │
│  validators. Config. Prompt caching.               │
│  Auto-commits to branch via GitHub App on turn end.│
└────────────────────────────────────────────────────┘
```

### Current state of nofi-games

- **Build**: Vite + TypeScript (strict mode), no framework
- **Rendering**: HTML5 Canvas 2D via custom `GameEngine` base class (~543 lines)
- **Games**: 23 games, each extends `GameEngine`, self-registers via `registerGame()`
- **Storage**: IndexedDB via `idb-keyval`
- **Audio**: Procedural Web Audio API
- **PWA**: vite-plugin-pwa + Workbox
- **Hosting**: Vercel with SPA rewrites
- **Telemetry**: Supabase (consent-gated, anon key, INSERT-only RLS)
- **API**: Single `api/health.ts` Vercel serverless function
- **App shell**: Monolithic `app.ts` (66KB) — handles all screens, navigation, win/gameover
- **Engine deps**: `GameEngine.ts` imports `audio.ts`, `haptics.ts`, `rng.ts` (does NOT import `input.ts` or `confetti.ts` — engine has inline input handling)

### Why Vite, not Next.js

The original plan-minima-v2 assumed Next.js app router. This would require migrating the entire project to Next.js — a massive, risky change orthogonal to the thesis being tested.

Instead:

| Concern | Solution |
|---------|----------|
| Builder page | Separate Vite entrypoint at `build/index.html`, uses React for Sandpack |
| API routes | Vercel Serverless Functions in `api/` (existing pattern — `api/health.ts` already works) |
| Streaming | `@ai-sdk/react` `useChat` hook talks to `api/chat.ts` serverless function |
| Game player app | Completely untouched. Same vanilla TS. Same bundle. |

Vite supports multi-page apps natively via `build.rollupOptions.input`. The builder page loads React + Sandpack in its own chunk. The main player app never imports React.

---

## The harness (Layer 1)

### Config

```json
{
  "allowedPaths": "src/games/[slug]/**",
  "allowedDependencies": ["matter-js", "howler", "pixi.js"],
  "maxFiles": 20,
  "maxFileSize": 50000,
  "modelAllowlist": ["anthropic/claude-sonnet-4-20250514", "openai/gpt-4o", "google/gemini-2.5-pro"],
  "maxTurns": 50,
  "systemPromptPath": "./prompts/game-builder.md"
}
```

### Tools (validated per-call)

Three tools, validated on every call. Reference implementation: `spikes/spike-3-tool-calling/src/tools.ts`.

```typescript
writeFile: tool({
  description: 'Write or replace an entire game file. Use for new files or full rewrites.',
  parameters: z.object({ path: z.string(), content: z.string() }),
  execute: async ({ path, content }) => {
    assertPathAllowed(path, config.allowedPaths);
    assertFileSize(content, config.maxFileSize);
    assertNoBlockedPatterns(content);
    session.files[path] = content;
    return { success: true, path, size: content.length };
  },
})

patchFile: tool({
  description: 'Search-and-replace edit on an existing file. old_text must match exactly once.',
  parameters: z.object({ path: z.string(), old_text: z.string(), new_text: z.string() }),
  execute: async ({ path, old_text, new_text }) => {
    assertFileExists(path, session.files);
    assertExactlyOneMatch(session.files[path], old_text);
    const patched = session.files[path].replace(old_text, new_text);
    assertFileSize(patched, config.maxFileSize);
    assertNoBlockedPatterns(patched);
    session.files[path] = patched;
    return { success: true, path, size: patched.length };
  },
})

addDependency: tool({
  description: 'Add an allowed npm dependency.',
  parameters: z.object({ name: z.string(), version: z.string().optional() }),
  execute: async ({ name, version }) => {
    assertDependencyAllowed(name, config.allowedDependencies);
    session.dependencies[name] = version || 'latest';
    return { success: true, name };
  },
})
```

**Why patchFile matters:** Spike 3 showed the AI rewrites the entire file for a one-line change (6,833 output tokens for changing a ball color). `patchFile` reduces this to ~50 tokens — a 99% reduction in output token cost for small modifications. The system prompt instructs the AI to prefer `patchFile` when changing <30% of a file.

### Content validators

Blocked patterns (tested in `spikes/spike-3-tool-calling/src/test-validators.ts`, 24/24 passing):

```typescript
const NETWORK_PATTERNS = [
  'fetch(', 'fetch (', 'XMLHttpRequest', 'new WebSocket',
  'navigator.sendBeacon', 'importScripts',
  'window.fetch', 'globalThis.fetch',
  'import(',
];

const STORAGE_PATTERNS = [
  'localStorage', 'sessionStorage', 'document.cookie', 'indexedDB',
];

const CODE_EXEC_PATTERNS = [
  'eval(', 'eval (',
  'new Function(', 'new Function (',
  'Function(', 'Function (',
];
```

**Important:** `import(` blocks dynamic imports but does NOT false-positive on static `import { Foo } from './bar'` statements (static imports don't contain `import(`). Verified by tests.

**Known limitation:** These are string-matching speed bumps, not walls. Obfuscation (`window['fe'+'tch']`) bypasses them. The iframe sandbox is the real enforcement layer.

### Compile check before auto-commit

The AI can produce code that doesn't compile. Auto-committing broken code means the Vercel preview fails to deploy.

Sandpack reports compilation status via `useSandpack()` hook (`status`, `error` fields). The builder page sends this status back to the server before the commit proceeds.

**Important (from Spike 3):** When feeding errors back to the AI for self-correction, use real Sandpack compilation errors with actual code context. The AI verifies errors against its own code — fabricated errors are rejected. This is correct behavior that the harness should rely on.

The compile gate is a two-step async flow between server and client:

```
1. AI turn ends → onFinish fires on server
2. Server marks session as "pending compile check", saves changed files
3. Client receives stream-end → Sandpack recompiles (~200ms)
4. Client POSTs compile status to /api/compile-status
5. Server receives status:
   - Clean → commits to branch via GitHub App
   - Errors → logs errors, skips commit, errors fed to AI on next turn
```

**Server side (`api/chat.ts`):**

```typescript
onFinish: async ({ toolCalls }) => {
  if (session.files.dirty) {
    // Save session state — commit happens when client reports compile status
    session.pendingCommit = {
      files: session.files.changed(),
      buildLog: session.buildLog.append(turn),
      message: `Turn ${turn}: ${summarize(userPrompt)}`,
      coAuthor: session.user?.github || null,
    };
  }
}
```

**Server side (`api/compile-status.ts`):**

```typescript
export async function POST(req: Request) {
  const { sessionId, hasErrors, errors } = await req.json();
  const session = getSession(sessionId);
  if (!session.pendingCommit) return Response.json({ ok: true });

  if (hasErrors) {
    session.buildLog.appendError(turn, errors);
    session.pendingCommit = null;
    return Response.json({ committed: false, errors });
  }

  await commitToBranch({
    branch: session.branch,
    ...session.pendingCommit,
  });
  session.files.markClean();
  session.pendingCommit = null;
  return Response.json({ committed: true });
}
```

### Auto-commit at end of turn

There is NO `/api/commit` endpoint. The commit is triggered by `/api/compile-status` after the client confirms Sandpack compiled successfully. The client never chooses *what* to commit — it only reports pass/fail. The harness commits what it validated. No public upload surface.

**Compare-and-swap:** Uses GitHub's `force: false` on ref update. Returns 422 on stale SHA. Retry with fresh base SHA. Spike 2 validated this works reliably.

**Commit timings (from Spike 2):**

| Operation | API calls | Time |
|-----------|-----------|------|
| Create branch | 2 | ~640ms |
| Commit 3 files | 8 | 3.2-7.2s |
| Commit 10 files | 15 | ~3.7s |
| Open PR | 1 | ~1.3s |
| Delete branch | 1 | ~550ms |

The bottleneck is the sequential API chain (getRef → getCommit → createBlobs → createTree → createCommit → updateRef), not the file count. Blob creation parallelizes well via `Promise.all`. 10 files was sometimes faster than 3.

### SDK strategy: Vercel AI SDK (production) vs raw Anthropic SDK (spike)

**Spike 3** used the raw `@anthropic-ai/sdk` directly (`client.messages.stream()`). This was correct for isolated testing but **production uses the Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) because:

1. `useChat` from `@ai-sdk/react` requires a Vercel AI SDK-compatible server endpoint — it expects the AI SDK streaming protocol, not raw Anthropic SSE.
2. The Vercel AI SDK handles streaming, tool calling, retries, and the client-server protocol as a unified stack.
3. The `@ai-sdk/anthropic` provider wraps the Anthropic API with the same model capabilities (tool calling, streaming, prompt caching).

**Translation from spike to production:**

| Spike (raw SDK) | Production (Vercel AI SDK) |
|-----------------|---------------------------|
| `client.messages.stream()` | `streamText()` from `ai` |
| `tools` array with `input_schema` | `tools` object with `z.object()` schemas (Zod) |
| `cache_control: { type: 'ephemeral' }` on message blocks | Same — `@ai-sdk/anthropic` supports `cacheControl` on messages via `experimental_providerMetadata` |
| `client.messages.stream().on('message')` | `onFinish` callback in `streamText()` |
| Manual retry logic | Built-in retry in `@ai-sdk/anthropic` provider, plus Vercel AI SDK's `maxRetries` |

**Prompt caching with Vercel AI SDK:**

```typescript
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages: [
    {
      role: 'system',
      content: staticPrefix,
      experimental_providerMetadata: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    },
    // ... session prefix with second cache breakpoint
    // ... dynamic tail (user message, tool results)
  ],
  tools: { writeFile, patchFile, addDependency },
  onFinish: async ({ toolCalls }) => { /* auto-commit logic */ },
  maxRetries: 5,
});
```

**The raw `@anthropic-ai/sdk` is NOT needed in production.** It remains a dev dependency for running spike tests. Remove it from production `dependencies` if bundle size matters (it's server-only so it doesn't affect client bundle).

### Connection reliability

Spike 3 observed ECONNRESET errors on ~30-40% of Anthropic API calls. Streaming mode + retry logic (5 retries, 10s exponential backoff) resolved every instance. **Production must use streaming with retry.** The Vercel AI SDK's `maxRetries` option and `@ai-sdk/anthropic` provider handle this automatically. Reference for spike behavior: `spikes/spike-3-tool-calling/src/client.ts`.

### Prompt caching strategy

Structure the AI context to maximize cache hits:

```
┌─────────────────────────────────────────────┐
│  STATIC PREFIX (cached, reused across all)  │
│  • System prompt (~11K tokens)              │
│  • GameEngine API docs (auto-generated)     │
│  • Example game (Snake.ts)                  │
│  • Constraints & rules                      │
│  [CACHE BREAKPOINT 1]                       │
├─────────────────────────────────────────────┤
│  SESSION PREFIX (cached within session)     │
│  • Build log (append-only, grows per turn)  │
│  • Current game files                       │
│  [CACHE BREAKPOINT 2]                       │
├─────────────────────────────────────────────┤
│  DYNAMIC TAIL (never cached)               │
│  • Current user message                     │
│  • Current turn's tool results              │
└─────────────────────────────────────────────┘
```

**Measured (Spike 3):** 31K-66K `cache_read_input_tokens` per turn. Cache hit on every turn after the first. Static prefix is ~11K tokens / ~45K chars.

**Implementation:** Use `experimental_providerMetadata` with the Vercel AI SDK (see SDK strategy section above for the full `streamText()` example with cache breakpoints).

### System prompt (production-ready)

Written and tested in Spike 3. Lives at `prompts/game-builder.md` (225 lines) and `prompts/engine-api.md` (205 lines). These are production deliverables, not spike artifacts.

The system prompt includes:
- Tool usage instructions (writeFile vs patchFile: use patchFile when <30% changes)
- Complete template game showing the exact pattern
- 10 numbered constraints (network, storage, DOM, rng, coordinates, animation, HUD_CLEARANCE, entry point, clear(), NaN guards)
- Style guide with NoFi.Games brand colors
- Common patterns (grid layout, difficulty scaling, swipe detection, collision, terminal win)
- Important notes (sandbox, engine responsibilities, idempotent gameWin)

**System prompt auto-generation:** `prompts/engine-api.md` should be auto-generated from `src/engine/GameEngine.ts` as a build step to prevent prompt rot. For Phase 1, the manually-written version from Spike 3 is sufficient.

---

## Builder UI (Layer 2)

### Builder as extractable module

`src/builder/` is a fully self-contained React application. It shares NO runtime code with the player app. The only connection to the player app codebase is reading engine source files via Vite `?raw` imports to build the Sandpack file map.

This means:
- The player app bundle is completely unaffected
- If we ever want to extract the builder to a separate repo, we copy `src/builder/`, `api/`, `build/`, `prompts/`, and `configs/` — then swap the `?raw` imports for an npm package or git submodule of the engine
- Different teams could work on player vs builder without conflicts

### Vite multi-page setup

```typescript
// vite.config.ts — add builder as second entry
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        builder: resolve(__dirname, 'build/index.html'),
      }
    }
  },
  plugins: [
    react(),  // only active for .tsx files (builder)
    pwa({ /* existing config */ }),
  ],
})
```

`/build/index.html` is a separate HTML shell that loads `src/builder/main.tsx`. The main player app at `/index.html` is completely untouched — it doesn't import React and its bundle is unaffected.

### Sandpack integration (validated by Spike 1)

Sandpack (`@codesandbox/sandpack-react`) renders the game preview with ~200ms hot-reload.

**Spike 1 finding: GameEngine runs inside Sandpack unmodified.** All 543 lines work as-is. The 882-line Snake game also works — canvas renders, input works, rng works, animation loop runs smoothly.

**File map strategy:** Use Vite `?raw` imports to load engine source as strings, then pass into Sandpack's virtual filesystem. The directory structure must mirror the source layout so relative imports resolve:

```typescript
// Validated file map from Spike 1
const sandpackFiles = {
  '/src/engine/GameEngine.ts': gameEngineRaw,       // REAL source, works unmodified
  '/src/utils/audio.ts': audioRaw,                   // REAL source, Web Audio works in iframe
  '/src/utils/haptics.ts': hapticsRaw,               // REAL source, navigator.vibrate guarded
  '/src/utils/rng.ts': rngRaw,                       // REAL source, pure math
  '/src/storage/scores.ts': storageScoresStub,       // STUB: returns default settings
  '/src/games/registry.ts': registryStripped,        // STRIPPED: no loadAllGames dynamic imports
  '/src/game/index.ts': aiGeneratedGameCode,         // AI writes this
  '/src/main.ts': bootstrapTemplate,                 // Creates game instance, mounts canvas
  '/index.html': gameHtmlShell,                      // Minimal HTML with canvas container
};
```

**What needs stubbing (only 2 files):**

1. `src/storage/scores.ts` — Audio and haptics import `getSettings()` from here. Stub returns defaults: `{ soundEnabled: true, vibrationEnabled: true, volume: 80 }`.

2. `src/games/registry.ts` — Real file has `loadAllGames()` with dynamic imports for all 23 games. Stripped version exports only `registerGame()`, `getGame()`, `getAllGames()`.

**What works as-is (no changes needed):**

- `GameEngine.ts` — all 543 lines unmodified
- `audio.ts` — Web Audio API works in Sandpack's iframe
- `haptics.ts` — uses `navigator.vibrate()` (not Capacitor), gracefully guarded
- `rng.ts` — pure math, zero dependencies
- `Snake.ts` — 882 lines, works unmodified (for reference games)

**No Capacitor dependency in the engine's haptics module.** `haptics.ts` uses `navigator.vibrate()` directly. The `@capacitor/haptics` package in `package.json` is for native app builds only and is not needed in Sandpack — no package aliasing required.

**Import resolution works:** All relative paths resolve correctly when the virtual filesystem mirrors the source directory structure. Example: `GameEngine.ts` → `'../utils/audio'` → `/src/utils/audio.ts` ✓

**Hot-reload behavior:** ~200ms. `updateFile()` remounts the entire iframe (game state resets). Acceptable for the builder — each AI turn produces a fresh version. Only the game file (`/src/game/index.ts`) changes between AI turns; engine, utils, stubs, bootstrap, and HTML are fixed.

**Canvas overflow issue:** `window.innerWidth/Height` in Sandpack's iframe returns the document size, not the constrained area. Fix with `ResizeObserver` on `#game-container` in the bootstrap template.

**Sandpack configuration:**

```tsx
<SandpackProvider
  template="vanilla-ts"
  files={fileMap}
  customSetup={{
    entry: '/src/main.ts',
    dependencies: { /* e.g. 'matter-js': 'latest' */ },
  }}
  options={{
    recompileMode: 'delayed',
    recompileDelay: 300,
    autorun: true,
  }}
>
  <SandpackPreview />
</SandpackProvider>
```

### Chat UI

```tsx
// src/builder/BuilderApp.tsx
import { useChat } from '@ai-sdk/react';
import { SandpackProvider, SandpackPreview } from '@codesandbox/sandpack-react';

function BuilderApp() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });
  // Desktop: split layout — chat on left, Sandpack preview on right
  // Mobile: bottom-sheet chat over full-screen preview
}
```

### Server-client data flow protocol

Tool calls originate server-side (in `api/chat.ts`), but their effects must reach the client-side Sandpack preview. The `useChat` hook from `@ai-sdk/react` handles this automatically via the Vercel AI SDK streaming protocol:

```
Server (api/chat.ts)                          Client (BuilderApp.tsx)
─────────────────                              ────────────────────────
streamText() calls tools                       useChat() receives stream
  → writeFile validator passes                   → tool result arrives in message stream
  → session.files['game.ts'] = content           → client reads { path, content } from result
  → returns { path, content, size }              → calls Sandpack.updateFile(path, content)
  → AI sees result, continues                    → Sandpack hot-reloads (~200ms)
                                                 → Sandpack reports compile status
AI turn ends → onFinish fires
  → server saves pendingCommit               Client sends compile status
  → waits for client report                      → POST /api/compile-status
                                                   { sessionId, hasErrors, errors[] }
Server receives compile status
  → if clean: commitToBranch()
  → if errors: skip commit, log errors
```

**How file content reaches the client:** Tool `execute` functions return the result to the AI (for context) AND to the client (via the Vercel AI SDK stream). The trick: **include `content` in the tool result** so the client can update Sandpack:

```typescript
writeFile: tool({
  execute: async ({ path, content }) => {
    // ... validators ...
    session.files[path] = content;
    return { success: true, path, content, size: content.length };
    //                         ^^^^^^^ client reads this to update Sandpack
  },
})
```

On the client, `useChat` exposes tool results in the message stream. The `BuilderApp` component watches for tool results and updates Sandpack:

```tsx
// In BuilderApp.tsx — watch messages for tool results
useEffect(() => {
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg?.toolInvocations) return;
  for (const inv of lastMsg.toolInvocations) {
    if (inv.state === 'result' && inv.result?.success && inv.result?.content) {
      sandpackRef.current?.updateFile(inv.result.path, inv.result.content);
    }
  }
}, [messages]);
```

**Key insight:** Tool call results flow server→client automatically via `useChat`. But compile status flows client→server, which requires an explicit step. Two approaches:

1. **Approach A (simpler, Phase 1):** After the AI turn completes, the client waits ~500ms for Sandpack to compile, then sends compile status to a `POST /api/compile-status` endpoint. The server holds the commit until this arrives (with a timeout — commit anyway after 5s if no status received, since missing status shouldn't block forever).

2. **Approach B (better, Phase 2+):** Use a WebSocket or Server-Sent Events channel per session. Compile status streams continuously. The `onFinish` handler subscribes and waits.

**`?raw` imports are client-side only.** The Sandpack file map (engine source loaded via `import gameEngineRaw from '../engine/GameEngine.ts?raw'`) is built at client build time by Vite. The server never reads engine files — it only validates and stores AI-written game files.

### Compilation status feedback

Sandpack reports compilation errors via `useSandpack()`. The builder captures these and feeds them back:
1. **To the server** — via `/api/compile-status` endpoint so the compile-check gate knows whether to commit
2. **To the AI context** — so the AI can self-correct on the next turn (use real errors with code context, not fabricated ones)

---

## Branch-first architecture

### The flow

1. User hits `/build` (or `/build?remix=snake` or `/build?branch=game/abc123`)
2. Server creates a branch via GitHub App: `game/<session-id>` (~640ms)
3. During chat: Sandpack for instant local preview (~200ms hot-reload)
4. End of each AI turn: backend auto-commits changed files + build log to branch (~3-7s for 3 files, if compile check passes)
5. Vercel deploys the branch → preview URL is live (~30-60s after first commit)
6. Share button appears once first deploy is ready
7. Subsequent commits auto-deploy

### Two preview layers

| Layer | Speed | Purpose |
|-------|-------|---------|
| Sandpack (in-page) | ~200ms | Builder's iteration loop |
| Vercel preview (deployed) | 30-60s per commit | Shareable URL for friends to play |

### Preview environment scoping

| Context | Can play games | Can build | Has secrets |
|---------|---------------|-----------|-------------|
| Production (`nofi.games`) | Yes | Yes | Yes |
| Preview (`*.vercel.app`) | Yes | No → redirects to production `/build` | No |

### Branch cleanup

Branches accumulate. Strategy:
- **Phase 1-3:** Manual cleanup. Acceptable for 3-friend test. Spike 2 validated branch deletion works (~550ms per branch). `spikes/spike-2-github-app/src/cleanup.ts` has a working cleanup script.
- **Phase 4+:** Automated pruning. Cron job deletes branches with no commits in 30 days (unless they have an open PR).
- **Rate limit headroom:** ~12 concurrent sessions at 5000 req/hr with 50 turns/session. Well above the 3-friend test target.

---

## Session state model

**Files = branch (durable). Chat = ephemeral. AI context = rebuilt from files + build log.**

| State | Where it lives | On return |
|-------|---------------|-----------|
| Game files | Branch (auto-committed per turn) | Load from branch into Sandpack |
| Build log | Branch (`.build-log.json`, auto-committed) | AI reads for context |
| Chat history | Client memory only (useChat hook) | Gone. Fresh conversation. |
| AI context | Rebuilt: static prefix + build log + current files | Full context via prompt caching |

### Session state across serverless invocations

Each call to `api/chat.ts` is a separate serverless function invocation — there is no persistent in-memory `session` object between turns.

**Solution for Phase 1:** The Vercel AI SDK `useChat` hook sends the full message history with each request. On every `api/chat.ts` invocation:

1. **Files** — Reconstructed from the GitHub branch. `api/chat.ts` fetches the current tree from the branch (via `getTree` with `recursive: true`), populates `session.files`. This is the source of truth — files are durable on the branch.
2. **Build log** — Read from `.build-log.json` on the branch (fetched alongside files).
3. **AI context** — Rebuilt from static prefix + build log + current files + incoming message history.
4. **Pending commit state** — Stored in a lightweight server-side cache (Vercel KV, or an in-memory Map with TTL for Phase 1). The `onFinish` handler writes pending commit data; `/api/compile-status` reads and consumes it. TTL: 60s (if the client never reports, the pending commit expires).

**Cost of branch fetch per turn:** ~2 API calls (getRef + getTree). Adds ~500ms latency per turn. Acceptable given AI response time is 30-110s. This eliminates the need for any external session store in Phase 1.

### Chat history on return

Chat messages are ephemeral (lost on page close). This is intentional — storing chat would require a database and complicate the state model. But users need orientation when returning.

**Solution:** Show the build log as a read-only "build history" pane on return. Not chat messages — just a timeline: "Turn 1: added bombs to snake (files: game.tsx, physics.tsx)". Sets expectations correctly without requiring chat persistence.

### Finding your branch on return

Three layers, progressive:

1. **localStorage** — maps session to branch name. Immediate. Same-browser only.
2. **URL** — `/build?branch=game/snake-bombs`. Portable, bookmarkable, shareable.
3. **GitHub OAuth** — "My games" list of branches with your `Co-authored-by`. Cross-device.

---

## Build log (`.build-log.json`)

Lives at `src/games/<slug>/.build-log.json` on the branch. Auto-committed alongside game files every turn.

```typescript
// BuildLogEntry type (see also: spikes/spike-3-tool-calling/src/session.ts)
interface BuildLogEntry {
  turn: number;
  contributor: string;           // "anonymous" or "@githubUsername"
  prompt: string;                // user's instruction for this turn
  filesChanged: string[];        // file paths that were written/patched
  timestamp: string;             // ISO 8601
  error?: string;                // compile error message (omitted on success)
}
```

Example:

```json
[
  {
    "turn": 1,
    "contributor": "anonymous",
    "prompt": "add bombs to snake",
    "filesChanged": ["game.tsx", "physics.tsx"],
    "timestamp": "2026-05-02T14:30:00Z"
  },
  {
    "turn": 2,
    "contributor": "@friend",
    "prompt": "make the bombs explode with particles",
    "filesChanged": ["game.tsx", "effects.tsx"],
    "timestamp": "2026-05-02T14:35:00Z"
  },
  {
    "turn": 3,
    "contributor": "@friend",
    "prompt": "add sound effects to explosions",
    "filesChanged": ["game.tsx"],
    "timestamp": "2026-05-02T14:40:00Z",
    "error": "Property 'explode' does not exist on type 'BombManager'"
  }
]
```

### Purpose

- **AI context on resume:** AI reads the log → knows what was built, who contributed, what the intent was
- **User orientation on return:** build history pane shows what happened
- **Attribution:** who did what, even across sessions and contributors
- **Remix lineage:** branch from someone's branch → inherit their build log → your entries append

### Merge behavior — submit branch strategy

The build log never merges to main. Spike 2 validated the "submit branch" strategy:

1. Create `submit/<session-id>` branch from `game/<session-id>` HEAD
2. Read the full tree recursively via `getTree` with `recursive: "true"`
3. Filter out `.build-log.json` entries
4. Create a clean tree/commit without the log, update ref
5. Open PR from `submit/...` to `main`

**Cost:** 6 extra API calls + ~5 seconds. One-time per game submission. Reference: `spikes/spike-2-github-app/src/spike.ts` lines 510-637.

---

## Three collaboration modes

### Mode 1: Solo build

One person, one branch, one game.

- User hits `/build` → fresh branch from main
- Builds, iterates, shares preview URL
- Optionally submits PR to gallery

### Mode 2: Remix

Branch from someone's branch. Inherit their game + build log. Build on top.

```
main
 └── game/snake-bombs (User A)
      └── game/snake-bombs-neon (User B remixes A's game)
           └── game/snake-bombs-neon-hard (User C remixes B's)
```

- User plays a preview → clicks "Remix this"
- Redirects to production `/build?remix-branch=game/snake-bombs`
- Server creates a NEW branch from that branch's HEAD
- Sandpack loads the game files. Build log inherits full history.
- User continues building. Their entries append to the log.

Recursive: any branch can be remixed from any depth. The build log captures lineage.

**Note:** GitHub doesn't track branch parentage natively. The build log is the lineage record. If the original branch is deleted, downstream remixes still work (they're independent branches) but lose the "remix from" reference in the UI.

### Mode 3: Live collab (Phase 5+)

Multiple people, one branch, queued instructions, real-time shared building.

- A "room" URL: `/build?branch=game/snake-collab&mode=live`
- WebSocket connects all participants
- Instructions queue → AI processes sequentially (one turn at a time)
- Everyone sees Sandpack update after each turn
- Build log records who contributed each instruction

Infrastructure needed beyond solo/remix: WebSocket room, instruction queue, "watching" state. Same harness, same branch, same build log.

---

## Auth model

### Zero-auth + progressive enhancement

| User state | Git operations | AI key | Attribution |
|---|---|---|---|
| Anonymous | GitHub App commits as `social-vibing[bot]` | Platform key OR BYOK | None (commit: "anonymous") |
| Authenticated | GitHub App commits with `Co-authored-by: @user` | BYOK or platform key | Full GitHub identity |

### The GitHub App (`social-vibing`)

- Installed on the nofi-games repo
- Permissions: `contents:write`, `pull-requests:write`, `metadata:read`
- Creates branches, commits, opens PRs as `social-vibing[bot]`
- Server uses installation token (auto-refreshes every hour via `@octokit/auth-app`)
- Rate limits: 5000 req/hr per installation
- Installation ID provided via `GITHUB_APP_INSTALLATION_ID` env var (see Phase 1 environment setup)

**Note:** A new production App must be created — the spike used a throwaway test App. Follow `spikes/spike-2-github-app/README.md` for setup steps.

### Platform key + BYOK

- **Platform key:** Server-side Anthropic API key. BYOK is the primary path — the platform key is a low-friction onboarding ramp.
- **BYOK:** User pastes OpenRouter key in UI. `sessionStorage` (tab-scoped, never persisted). No turn cap. Available to both anonymous and authenticated. Uses `@ai-sdk/openai` with `createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: userKey })` — OpenRouter is OpenAI-compatible (see `woa-revamp/src/app/api/chat/route.ts` for working reference).

### Cost model (measured in Spike 3)

| Metric | Value |
|--------|-------|
| Static prefix | ~11K tokens / ~45K chars |
| Avg cost per turn (with caching) | ~$0.15 |
| 4-turn session (measured) | $0.61 |
| 10-turn session (projected) | ~$1.50 |
| Cache read per turn | 31K-66K tokens |
| Cost without patchFile | ~$0.15-0.23 per turn |
| Cost with patchFile for small edits | ~$0.05-0.08 per turn (projected, not yet validated with live API) |

Output tokens dominate cost. `writeFile` on an 18K-char file costs 6,833 output tokens ($0.19). `patchFile` for the same change: ~50 output tokens ($0.001).

### Rate limiting (invisible, server-side)

- 3 concurrent sessions per IP
- 100 API calls/hour per IP
- Global spend circuit-breaker: if platform key spend velocity spikes, halt anonymous sessions.

---

## Security

### Game contract

A game is:
- A folder: `src/games/<slug>/`
- Entry point: `index.ts` extending `GameEngine`
- Renders on a Canvas (2D)
- Emits events via `this.emit('score', { value: 42 })` / `this.emit('gameOver', {})`
- No `fetch`. No `XMLHttpRequest`. No `import()`. No `eval()`. No `document.cookie`. No `localStorage`.

### Enforcement layers

1. **AI system prompt** — Spike 3 showed the AI refuses network calls at the prompt level without even attempting a writeFile. The system prompt constraints are the first enforcement layer.
2. **Harness validators** — `assertNoBlockedPatterns()` blocks writeFile/patchFile calls containing network APIs, storage APIs, dynamic imports, and code execution patterns (eval, Function). 24/24 validator tests passing.
3. **Runtime sandbox** — `<iframe sandbox="allow-scripts">` (no `allow-same-origin`). Phase 1.
4. **CI** — Static scan on PR (`scripts/scan.js`)
5. **Human review** — Maintainer reviews PR before merge

### Known limitations

String-matching validators can be bypassed with obfuscation (`window['fe'+'tch']`). For Phase 1 with trusted friends, this is acceptable — three layers (prompt compliance + validators + iframe sandbox) provide defense-in-depth. Phase 4 adds separate-origin iframe + CSP.

### Event write-layer

Platform listens to `postMessage` from game iframe. Write-layer persists what matters (scores, play sessions). Game code never knows about the DB.

---

## CI

One workflow, runs on PR:

```yaml
jobs:
  check:
    steps:
      - run: npm run build        # includes builder entrypoint
      - run: node scripts/scan.js # static security scan
```

---

## Files to add

The builder is an extractable module. All builder code lives under `src/builder/`, with API routes in `api/` and prompts in `prompts/`. The player app is untouched.

```
build/
  index.html                        ← builder page HTML shell (separate Vite entry)

src/builder/                        ← EXTRACTABLE MODULE (self-contained React app)
  main.tsx                          ← React entry point
  BuilderApp.tsx                    ← top-level layout (chat + preview)
  components/
    Chat.tsx                        ← chat UI (useChat hook)
    Preview.tsx                     ← Sandpack wrapper + compilation status
    BuildHistory.tsx                ← read-only build log timeline (shown on return)
    ShareButton.tsx                 ← share preview URL (faded while deploying)
    ByokModal.tsx                   ← OpenRouter key input
  lib/
    harness/
      config.ts                     ← BuilderConfig type + loader
      tools.ts                      ← writeFile, patchFile, addDependency with validators
      validators.ts                 ← path check, dep check, blocked patterns, compile gate
      github-app.ts                 ← App token, branch ops, compare-and-swap commit
      prompt-cache.ts               ← cache breakpoint management, context assembly
      session.ts                    ← session state (files, deps, build log)
    sandpack/
      file-map.ts                   ← builds Sandpack file map from engine sources (via ?raw)
      stubs.ts                      ← storage/scores stub, stripped registry
      bootstrap.ts                  ← main.ts + index.html templates for Sandpack

api/                                ← Vercel Serverless Functions (move with builder if extracted)
  chat.ts                           ← harness: streamText + validated tools + auto-commit
  compile-status.ts                 ← receives Sandpack compile status from client (commit gate)
  submit.ts                         ← opens PR via submit-branch strategy (excludes build log)
  auth/github.ts                    ← GitHub OAuth callback (optional, progressive)
  session/create.ts                 ← creates branch, returns session info

prompts/                            ← PRODUCTION-READY (from Spike 3)
  game-builder.md                   ← system prompt (225 lines, tested)
  engine-api.md                     ← GameEngine API docs (205 lines, tested)

configs/
  builder.json                      ← harness config (shape defined in "The harness > Config" section above)

tests/builder/                      ← all builder tests (see Testing Strategy section)
  harness/
    validators.test.ts              ← blocked patterns (port spike-3's 24 tests + expand)
    tools.test.ts                   ← writeFile, patchFile, addDependency
    session.test.ts                 ← session state, pendingCommit, build log
    github-app.test.ts              ← branch/commit/PR ops (mocked Octokit)
    prompt-cache.test.ts            ← context assembly, cache breakpoints
  sandpack/
    file-map.test.ts                ← file map generation, stubs
    bootstrap.test.ts               ← template HTML/TS validity
  components/
    BuilderApp.test.tsx             ← chat + preview integration
    Chat.test.tsx                   ← useChat, messages, input
    Preview.test.tsx                ← Sandpack wrapper, compile status
    ByokModal.test.tsx              ← key input, sessionStorage
  api/
    chat.test.ts                    ← streamText endpoint, tools, errors
    compile-status.test.ts          ← commit gate logic
    session-create.test.ts          ← branch creation

scripts/
  scan.js                           ← static security scan for CI (see specification below)
```

**`scripts/scan.js` specification:** Scans all files in `src/games/*/` for the same blocked patterns used by the harness validators (NETWORK_PATTERNS, STORAGE_PATTERNS, CODE_EXEC_PATTERNS). A simple Node.js script that reads files and does string matching — no AST parsing needed. Reuses the pattern lists from `src/builder/lib/harness/validators.ts` (import or duplicate). Exits with code 1 if any pattern is found. This is a safety net for manually-committed game code, not a replacement for the per-tool-call validators.

### Vite config changes

```typescript
// vite.config.ts additions
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),   // handles .tsx in builder, no-op for vanilla .ts
    pwa({ /* existing */ }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        builder: resolve(__dirname, 'build/index.html'),
      },
    },
  },
});
```

### Vercel config changes

Add two rewrite rules to the existing `vercel.json` for the builder page. These must go **before** the catch-all `/(.*) → /index.html` rule:

```diff
 // vercel.json
 {
+  // existing: "$schema", "framework", "buildCommand", "outputDirectory" unchanged
   "rewrites": [
     { "source": "/api/(.*)", "destination": "/api/$1" },
+    { "source": "/build", "destination": "/build/index.html" },
+    { "source": "/build/(.*)", "destination": "/build/index.html" },
     { "source": "/(.*)", "destination": "/index.html" }
-  ]
+  ],
+  // existing: "headers" array for /assets, /icons, /favicon.svg, /sw.js unchanged
 }
```

The existing `headers` (immutable cache for assets/icons, no-cache for sw.js), `buildCommand` (`npm run db:migrate && npm run build`), and `outputDirectory` (`dist`) are all preserved as-is.

### New dependencies

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@codesandbox/sandpack-react": "^2.20.0",
    "@ai-sdk/react": "^1.0.0",
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "@octokit/auth-app": "^7.0.0",
    "@octokit/rest": "^21.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.4.0"
  }
}
```

**Note:** `@anthropic-ai/sdk` (raw SDK) is NOT needed in production — `@ai-sdk/anthropic` wraps it. It stays in the spike folder's devDependencies for running spike tests.

---

## Spike results (Phase 0 — Complete)

All three spikes passed. No kill criteria triggered. Key findings are incorporated throughout this plan.

### Spike 1: Sandpack + GameEngine — PASS

GameEngine (543 lines) and Snake (882 lines) run inside Sandpack unmodified. Only 2 stubs needed (storage/scores, stripped registry). Web Audio works in the iframe. Hot-reload: ~200ms, remounts iframe (game state resets — acceptable). Canvas overflow fixable with ResizeObserver. **Note:** npm dependency loading (matter-js) and Sandpack error reporting were validated conceptually but not tested end-to-end in the spike — these are exercised during Phase 1 implementation.

**Reference:** `spikes/spike-1-sandpack/`

### Spike 2: GitHub App + Branch + Commit — PASS

End-to-end flow works. Branch creation ~640ms, 3-file commit ~3-7s, 10-file commit ~3.7s. Compare-and-swap reliably catches stale refs (422). Submit-branch strategy cleanly excludes build log from PRs. ~12 concurrent sessions within rate limits.

**Reference:** `spikes/spike-2-github-app/`

### Spike 3: Tool Calling + Prompt Caching — PASS

100% tool calling reliability across all turns. AI correctly uses GameEngine API (HUD_CLEARANCE, rng, playSound, haptic, serialize/deserialize, destroy). Cache hit every turn (31K-66K tokens). AI refuses network calls at prompt level. System prompt and engine API docs are production-ready.

**Reference:** `spikes/spike-3-tool-calling/`, `prompts/game-builder.md`, `prompts/engine-api.md`

---

## Phase 1 environment setup

### Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `ANTHROPIC_API_KEY` | `.env.local` (dev), Vercel env vars (prod) | Platform key for AI API calls (used when no BYOK) |
| `GITHUB_APP_ID` | `.env.local`, Vercel env vars | The App ID from the `social-vibing` GitHub App settings page |
| `GITHUB_APP_PRIVATE_KEY_BASE64` | `.env.local`, Vercel env vars | Base64-encoded PEM private key. Encode: `base64 -w0 < private-key.pem`. Decode in code: `Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY_BASE64, 'base64').toString('utf8')` |
| `GITHUB_APP_INSTALLATION_ID` | `.env.local`, Vercel env vars | Installation ID for the nofi-games repo. Find via: `GET /repos/{owner}/{repo}/installation` or from the App's installation page |

**Dev setup:**

```bash
# .env.local (git-ignored, Vite loads automatically for dev)
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY_BASE64=LS0tLS1CRUd...  # base64 -w0 < private-key.pem
GITHUB_APP_INSTALLATION_ID=78901234
```

**Production:** Add the same variables in Vercel → Project Settings → Environment Variables. Mark all as "Production" + "Preview" scope.

**Note:** The spike used `GITHUB_APP_PRIVATE_KEY` (raw PEM). Production uses `_BASE64` suffix because Vercel env vars don't preserve multi-line values. The decode is a one-liner in `github-app.ts`.

---

## Phase 1 — Implementation guide

Phase 1 delivers the solo build + remix flow. An agent picking this up should build each component end-to-end. The spike code provides working reference implementations.

### Phase 1 scope

**In scope:**
- Builder page with chat + Sandpack preview
- Harness API with writeFile/patchFile/addDependency tools and validators
- Auto-commit to branch on turn end (with compile gate)
- Branch creation on session start
- Remix flow (`/build?remix-branch=...`)
- Build log per turn
- BYOK modal

**Out of scope for Phase 1:**
- Share button (Phase 2)
- Submit to gallery / PR creation (Phase 2)
- Return flow / build history pane (Phase 2)
- GitHub OAuth (Phase 2)
- Branch cleanup automation (Phase 4)
- Live collab (Phase 5)

### Implementation order

1. **Vite multi-page setup** — Add `build/index.html`, configure Vite with React plugin, add Vercel rewrites. Verify both entrypoints build and deploy.

2. **Sandpack preview component** — Port `spikes/spike-1-sandpack/` into `src/builder/`. Load engine via `?raw` imports. Render template game. Fix canvas overflow with ResizeObserver in bootstrap.

3. **Harness API** — Create `api/chat.ts` serverless function. Port tools and validators from `spikes/spike-3-tool-calling/src/tools.ts`. Use Vercel AI SDK (`streamText` from `ai` + `anthropic` provider from `@ai-sdk/anthropic`) with `maxRetries: 5`. Add prompt caching with two breakpoints via `experimental_providerMetadata`. Use system prompt from `prompts/game-builder.md`. Create `api/compile-status.ts` for the compile gate.

4. **Chat UI** — Wire `useChat` hook to `api/chat.ts`. Show AI text responses. On tool calls, update Sandpack file map via `updateFile()`.

5. **GitHub App integration** — Create production App (follow spike-2 README). Port branch creation and batch commit from `spikes/spike-2-github-app/src/spike.ts`. Wire auto-commit into `onFinish` callback with compile gate.

6. **Session management** — `api/session/create.ts` creates branch, returns session info. Client stores branch name in localStorage + URL. On `/build?branch=...`, load files from branch into Sandpack.

7. **Remix flow** — On `/build?remix-branch=...`, create new branch from source branch HEAD. Load source files + build log into session. Append new entries to inherited build log.

8. **BYOK modal** — Simple input for OpenRouter key. Store in `sessionStorage`. Pass to API via request header. API uses OpenRouter provider when key is present, Anthropic platform key when absent.

### Done when

- User types "make snake green" → Sandpack updates instantly → branch has commit within ~7s → Vercel preview deploys within ~60s
- Another user opens `/build?remix-branch=game/snake-green` → sees the game → can modify it → their changes go to a new branch
- BYOK path works end-to-end
- All tests pass (`npm test`)

### Testing strategy

Per CLAUDE.md: "Every change must include tests." The builder adds three testable layers, each with its own test approach.

**Test files to add:**

```
tests/builder/
  harness/
    validators.test.ts              ← port + expand spike-3's 24 tests to Vitest
    tools.test.ts                   ← writeFile/patchFile/addDependency unit tests
    session.test.ts                 ← session state, pendingCommit lifecycle, build log
    github-app.test.ts              ← branch create, batch commit, compare-and-swap (mocked Octokit)
    prompt-cache.test.ts            ← context assembly, cache breakpoint placement
  sandpack/
    file-map.test.ts                ← file map generation, stub correctness, ?raw import verification
    bootstrap.test.ts               ← bootstrap template generates valid HTML/TS
  components/
    BuilderApp.test.tsx             ← renders chat + preview, tool results update Sandpack
    Chat.test.tsx                   ← useChat integration, message display, input handling
    Preview.test.tsx                ← Sandpack wrapper, compile status reporting
    ByokModal.test.tsx              ← key input, sessionStorage, validation
  api/
    chat.test.ts                    ← streamText endpoint, tool execution, error responses
    compile-status.test.ts          ← commit gate: clean compile → commit, errors → skip
    session-create.test.ts          ← branch creation, session info response
```

**Layer 1: Harness unit tests (target: 100%)**

These are pure functions with no UI or API dependencies. Port the 24 validator tests from `spikes/spike-3-tool-calling/src/test-validators.ts` to Vitest and expand:

- **Validators** — all blocked patterns (network, storage, code-exec, dynamic import), path traversal, file size limits, edge cases (word "import" in variable names, "evaluate" vs "eval()")
- **Tools** — writeFile creates file, patchFile exact-match semantics (0 matches, 1 match, 2+ matches), addDependency allowlist
- **Session** — pendingCommit lifecycle (set on onFinish, consumed on compile-status, expires on timeout), build log append/error, files dirty tracking
- **GitHub App** — mock `@octokit/rest`, test branch creation, blob parallelization, compare-and-swap retry on 422, submit-branch tree filtering
- **Prompt cache** — context assembly produces correct message structure, cache breakpoints at right positions

**Layer 2: Component tests (target: 80%)**

React Testing Library + Vitest. Mock `useChat` and Sandpack:

- **BuilderApp** — renders both panels, tool results from `useChat` messages trigger `updateFile` on Sandpack
- **Chat** — input submission, message rendering, loading state, error display
- **Preview** — Sandpack mount, compile status extraction, POST to `/api/compile-status`
- **ByokModal** — key stored in `sessionStorage`, cleared on close, passed via request header

**Layer 3: API integration tests (target: 80%)**

Test the API route handlers with mocked external services (Anthropic SDK, Octokit):

- **`api/chat.ts`** — request with messages → streamed response with tool calls, BYOK header switches provider, rate limiting
- **`api/compile-status.ts`** — clean status triggers commit, error status skips commit, no pending commit returns ok
- **`api/session/create.ts`** — creates branch, returns session info, remix-branch loads source files

**What NOT to test:**

- Sandpack internals (it's a third-party component — test our wrapper, not their iframe)
- Actual Anthropic API calls (mock the SDK — live API tests are in the spikes)
- Actual GitHub API calls (mock Octokit — live API tests are in the spikes)
- E2E browser tests (Phase 2 — Playwright once the flow is stable)

---

## Phases (updated)

**Phase 0 — Spikes (Complete)**
All three spikes passed. Findings incorporated into this plan.

**Phase 1 — Harness + Solo Build + Remix (Week 1-2)**
See implementation guide above.

**Phase 2 — Share + Submit + Return (Week 2-3)**
Share button (preview URL, faded while deploying). Submit button (PR to main via submit-branch strategy). localStorage + URL branch persistence. Build history pane on return. Optional GitHub OAuth for "My games". Platform key budget monitoring.
*Done when:* User builds, shares, friend plays, friend remixes. User returns next day via URL, sees build history, continues with full AI context.

**Phase 3 — Three friends (Week 3-4)**
Three non-devs. Build, share, remix each other's games. Watch what happens. Does anyone remix unprompted? Write up the outcome.

**Phase 4 — Hardening (if Phase 3 works)**
Separate-origin game iframe + CSP. Event write-layer. Branch cleanup cron. Rate limiting hardening. System prompt auto-generation build step.

**Phase 5 — Live collab (if remix takes off)**
WebSocket rooms. Instruction queue. Multi-contributor same-branch building.

---

## Open questions

| Question | Default | Decide by |
|----------|---------|-----------|
| Game iframe origin | `sandbox="allow-scripts"` Phase 1, separate origin Phase 4 | Phase 4 |
| Commit frequency | Per AI turn (all tool calls batched into one commit) | Resolved: yes, ~8 API calls for 3 files |
| Commit broken code? | No — compile gate blocks. Error logged for AI self-correction. | Resolved: feed real Sandpack errors |
| Remix slug naming | `<original-slug>-<modifier>` | Phase 1 |
| Build log shown to user? | Yes, as read-only timeline on return | Phase 2 |
| Branch cleanup | Manual Phase 1-3, automated Phase 4+ (30-day inactive prune) | Phase 4 |
| Platform key budget | BYOK is primary path. Platform key for onboarding ramp. | Resolved |
| System prompt auto-gen | Build step from GameEngine source | Phase 4 (manual version from Spike 3 is production-ready for Phase 1) |
| Live collab queue model | FIFO, one instruction at a time | Phase 5 |
| Vercel plan | Hobby to start, Pro if preview deploy limits are hit | Phase 3 |

---

## Summary

| What | How |
|------|-----|
| The product | The harness (tools + validators + prompts + config + prompt caching) |
| The UX | `/build` → zero auth → chat → Sandpack preview → shareable Vercel preview |
| The framework | Vite (multi-page). React only in `src/builder/` (extractable). No migration. |
| The API layer | Vercel Serverless Functions (`api/chat.ts`, `api/submit.ts`, `api/compile-status.ts`) |
| The tools | `writeFile`, `patchFile` (99% output token reduction), `addDependency` |
| The validators | Network + storage + code-exec + dynamic-import pattern blocking (24/24 tests passing) |
| The git model | GitHub App creates branch, auto-commits at end of each AI turn (~3-7s) |
| The commit model | Internal server action (onFinish). Compile gate before commit. Compare-and-swap. |
| The state model | Files + build log on branch (durable). Chat in client (ephemeral). Build history pane on return. |
| The build log | `.build-log.json` on branch, excluded from PR via submit-branch strategy |
| The cost model | Prompt caching (31K-66K tokens cached/turn). BYOK primary. ~$0.15/turn with caching. |
| The security | Prompt refusal → pattern validators → iframe sandbox → CI scan → human review |
| The social moment | Preview URL, shareable from first commit |
| The collaboration | Solo → remix (recursive, any depth) → live collab. Same infra. |
| The game contract | Pure client. Canvas 2D. Events only. No DB. No network. No eval. |
| The auth model | Zero required. Progressive: localStorage → URL → OAuth |
| The connection | Streaming + retry (30-40% ECONNRESET rate observed, all resolved by retry) |
