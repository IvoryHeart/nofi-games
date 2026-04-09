# NoFi.Games - Development Guide

## Project Overview
NoFi.Games is an offline-first casual games collection. Brand name: **NoFi.Games** (capital N, capital G, with the dot — "NoFi" stands for "no wifi"). Domain: nofi.games. App ID: `games.nofi.app`. 16 games across puzzle, word, logic, and arcade genres. Daily Mode with seeded puzzles and streak tracking.

## Performance Principles

**Performance is the #1 priority**, even over features. Then user delight. Then everything else.

- **First paint must be instant**: `index.html` has inline critical CSS + a static loading shell. The browser paints the logo + spinner before ANY JavaScript runs.
- **Lazy-load everything**: games load on demand via dynamic `import()`, not at boot. The home screen only needs the registry metadata (~1KB), not the game code (~200KB+). The service worker precaches all chunks in the background for instant repeat visits.
- **No network required for gameplay**: all storage is local IndexedDB, all sounds are procedural (Web Audio), all puzzles are generated client-side with seeded RNG.
- **Code splitting > monolithic bundle**: 16 separate game chunks means only the shell (50KB) blocks FCP. Changing one game doesn't invalidate any other game's cache.
- **Terser with `drop_console` + 2-pass compression**: production builds strip console.log and dead code.
- **Immutable cache headers**: `/assets/*` gets `max-age=31536000, immutable`. SW gets `no-cache`. Favicon gets `max-age=86400`.
- **No external resources**: no Google Fonts, no analytics, no CDN dependencies. Zero network requests needed after first visit.

## Tech Stack
- **Build**: Vite + TypeScript (strict mode)
- **Rendering**: HTML5 Canvas 2D API (custom lightweight engine, no game framework)
- **Storage**: IndexedDB via `idb-keyval` (offline scores, settings, favourites)
- **Audio**: Procedural Web Audio API (no audio files)
- **PWA**: vite-plugin-pwa with Workbox service worker
- **Mobile**: Capacitor (iOS/Android)
- **Desktop**: Tauri v2 (macOS/Windows/Linux)
- **Tests**: Vitest + jsdom

## Architecture

### Directory Structure
```
src/
  engine/GameEngine.ts    # Base game class - canvas, input, loop, drawing helpers
  games/registry.ts       # Game registry - self-registering module pattern
  games/<name>/<Name>.ts  # Each game: extends GameEngine, registers itself
  storage/scores.ts       # IndexedDB storage - scores, settings, favourites
  storage/gameState.ts    # IndexedDB storage - per-game save/resume snapshots
  utils/audio.ts          # Procedural sound effects (Web Audio API)
  utils/haptics.ts        # Vibration feedback
  utils/keyboardNav.ts    # Document-level key binding helper
  app.ts                  # App shell - screens, navigation, UI
  main.ts                 # Bootstrap entry point
  styles/                 # CSS (theme.css = design tokens, app.css = components)
tests/
  unit/                   # Pure logic tests (engine, storage, registry)
  integration/            # Game instantiation, registration, difficulty
  functional/             # App-level flows (navigation, settings, offline)
  setup.ts                # Canvas mock for jsdom
```

### Adding a New Game
1. Create `src/games/<name>/<Name>.ts`
2. Extend `GameEngine`, implement `init()`, `update(dt)`, `render()`
3. **Implement `serialize()` / `deserialize(state)`** — see Save/Resume section below
4. Override `canSave()` to return `false` during transient animations (line clears, flight physics, etc)
5. If the game has a win condition, call `this.gameWin()` when it fires (idempotent, fires `onWin` callback once)
6. Call `registerGame({...})` at module level (self-registration). Set `continuableAfterWin: true` if the game keeps running past the win (e.g. 2048).
7. Add dynamic import to `src/games/registry.ts` `loadAllGames()`
8. Game receives `this.width`, `this.height` (dynamic), `this.difficulty` (0-3)
9. All coordinates must be relative to canvas dimensions, not hardcoded

### Key Design Decisions
- **No game framework** (Phaser, PixiJS etc.) - keeps bundle under 200KB. None of the current 8 puzzle games need WebGL, physics, sprite atlases, or particle systems. Revisit when/if we add a game that actually needs them.
- **Self-registering games** - each game file imports `registerGame` and calls it at module level
- **Dynamic canvas sizing** - games fill available screen space, calculate layout from `this.width`/`this.height`
- **Difficulty 0-3** - Easy, Medium, Hard, Extra Hard. Each game maps this to meaningful gameplay changes
- **Offline-first** - zero network calls required. All storage is local IndexedDB.
- **Procedural audio** - no audio files, all sounds synthesized via Web Audio API
- **Auto-save & auto-resume** - every game implements `serialize`/`deserialize`; the app shell auto-saves on visibilitychange/blur/exit and auto-resumes on next launch. Saved state is cleared on game over or terminal win.
- **Win celebrations at the app shell layer** - games only call `gameWin()`; the app shell renders the celebration overlay. Games should NOT draw in-canvas win overlays.

## Save / Resume

Every game must support save/resume. The engine exposes four hooks:

```ts
// In your game subclass:
serialize(): GameSnapshot | null {
  return {
    grid: this.grid.map(row => [...row]),   // ALWAYS deep-clone
    // ...other game-specific fields
  };
}

deserialize(state: GameSnapshot): void {
  // Validate every field defensively — silently bail on malformed state
  const g = state.grid as number[][] | undefined;
  if (!g || !Array.isArray(g) || g.length !== this.size) return;
  this.grid = g.map(row => [...row]);
  // Reset any transient animation state set up by init()
  this.slideAnims = [];
}

canSave(): boolean {
  // Return false during animations/transient states where saving would
  // capture an inconsistent snapshot (line clears, flying bubbles, mid-swap, etc)
  return this.gameActive && !this.animating;
}
```

Rules:
- `serialize()` returns **game-specific state only** — the engine handles `score` and `won` automatically.
- `deserialize()` runs AFTER `init()`, so it only needs to overwrite fields. It must reset transient animation state that `init()` might have populated.
- Deep-clone all arrays/objects in `serialize()` — the snapshot must be independent of live state.
- `canSave()` defaults to `true`. Override whenever the game has frames where state is mid-mutation.
- The storage layer (`src/storage/gameState.ts`) persists the snapshot plus score, won, difficulty, and timestamp.

## Win conditions

For puzzle games with terminal completion (Sudoku, Minesweeper, Memory Match):
```ts
if (this.isComplete()) {
  this.gameWin();                // celebration - idempotent, fires onWin callback
  setTimeout(() => this.gameOver(), 1500);  // end the session after celebration
}
```

For continuable wins (2048):
```ts
if (this.grid[r][c] === this.config_.winTarget) {
  this.gameWin();   // celebration only - game keeps running
}
```
Mark continuable games with `continuableAfterWin: true` in `registerGame()`. The app shell's win overlay will show "Continue" / "Quit" buttons instead of "New Game" / "Home".

**Do not draw in-canvas win overlays** — the app shell handles celebration UI.

## Keyboard navigation

The app shell binds screen-scoped keyboard shortcuts via `src/utils/keyboardNav.ts`. Each screen calls `this.setKeys({...})` on entry, which automatically unbinds the previous screen's map. Standard bindings:

| Screen | Keys |
|---|---|
| Home | `Tab` cycles cards (native), `Enter`/`Space` launches focused card, `,`/`s` opens settings, `/` focuses first card |
| Difficulty | `←/→` or `↑/↓` changes level (native range slider — auto-focused on entry), `Enter` = Play/Resume, `Escape` = back, `f` = favourite, `?`/`h` = help |
| Game | `Escape` = exit. In-game keys are handled per-game via `GameEngine.handleKeyDown` |
| Settings | `Escape` = back |
| Scores | `Escape` = back, `1/2/3` switch tabs |

**Do not bind `Space`, `P`, or arrow keys at the app level on the game screen** — individual games may use them (e.g. BlockDrop uses Space for hard-drop).

## Testing Requirements

**Every change must include tests.** This is a hard requirement, not optional.

### Coverage Targets
- **Core files (100%)**: `engine/GameEngine.ts`, `storage/scores.ts`, `storage/gameState.ts`, `games/registry.ts`, `utils/audio.ts`, `utils/haptics.ts`, `utils/keyboardNav.ts`
- **App shell (90%+)**: `app.ts`, `main.ts`
- **Game files (80%+)**: Each game in `games/*/` — must include a `serialize` round-trip test and (for puzzle games) a win-condition test
- Run coverage: `npx vitest run --coverage`

### Test Categories
- **Unit tests** (`tests/unit/`): Test pure logic in isolation. Mock external deps (idb-keyval, canvas).
- **Integration tests** (`tests/integration/`): Test game registration, instantiation at all difficulties, interaction between modules.
- **Functional tests** (`tests/functional/`): Test app flows (navigation, settings, game launch), offline behavior, build artifacts.

### Test Conventions
- Use `describe`/`it` blocks with clear names
- Mock `idb-keyval` in any test that imports storage
- Canvas mock is in `tests/setup.ts` (auto-loaded via vitest config)
- Test all 4 difficulty levels for each game
- Test error cases, not just happy paths

## Code Conventions
- **No infinite loops** - every `while` must have a guaranteed termination condition or iteration cap
- **Guard against NaN/zero** - especially in canvas calculations, always `Math.max(value, minimum)`
- **Warm color palette** - background `#FEF0E4`, primary `#8B5E83`, never use cool blue/gray
- **No hardcoded canvas positions** - always compute from `this.width`/`this.height`
- **Clean up event listeners** - GameEngine handles this via `destroy()`, don't add listeners outside the engine
- **Time-based animations** - use `dt` (delta seconds), never frame-count-based
- **Sound integration** - call `this.playSound('name')` from games for key events

## Commands
```bash
npm run dev          # Dev server (localhost:5173)
npm run build        # Production build (tsc + vite)
npm run preview      # Preview production build
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run cap:sync     # Sync web assets to iOS/Android
npm run build:android # Build + sync Android
npm run build:ios     # Build + sync iOS
npm run open:android  # Open in Android Studio
npm run open:ios      # Open in Xcode
```

## Future Plans
- Auth system (login/signup)
- Payment integration (remove ads, buy coins/hints)
- Online leaderboards (Vercel serverless API)
- More games
- Achievements system
