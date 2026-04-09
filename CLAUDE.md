# NoFi.Games - Development Guide

## Project Overview
NoFi.Games is an offline-first casual games collection. Brand name: **NoFi.Games** (capital N, capital G — "NoFi" stands for "no wifi"). Domain: nofi.games. App ID: `games.nofi.app`.

16 games across four genres: puzzle (2048, Sudoku, Minesweeper, Memory Match, Nonogram, Lights Out, Mastermind), word (Wordle, Word Search, Anagram), arcade (Block Drop, Bubble Pop, Snake, Breakout, Stack the Block), and match-3 (Gem Swap). Daily Mode offers seeded puzzles with streak tracking.

## Performance Principles

**Performance is the #1 priority**, even over features. Then user delight.

- **Instant first paint**: `index.html` has inline critical CSS + a static loading shell (logo, brand, spinner) that paints before ANY JavaScript runs.
- **Lazy game loading**: games load via dynamic `import()` in the background after the app shell mounts. The home screen renders immediately with just the registry metadata.
- **Code splitting**: 16 separate game chunks + a shared engine chunk. Only the 50KB app shell blocks FCP. The service worker precaches everything for instant repeat visits.
- **No external resources**: no web fonts, no analytics, no CDN. Zero network requests needed after first visit.
- **Terser 2-pass + `drop_console`**: production builds strip console.log and dead code.
- **Immutable cache headers**: `/assets/*` and `/icons/*` get `max-age=31536000, immutable`. SW gets `no-cache`.

## Tech Stack
- **Build**: Vite + TypeScript (strict mode)
- **Rendering**: HTML5 Canvas 2D (custom engine — no Phaser/PixiJS)
- **Storage**: IndexedDB via `idb-keyval` — scores, settings, favourites, per-level save/resume, daily completions + streaks
- **Audio**: Procedural Web Audio API (no audio files)
- **RNG**: Seeded mulberry32 PRNG for daily mode determinism
- **PWA**: vite-plugin-pwa + Workbox (skipWaiting + clientsClaim)
- **Mobile**: Capacitor (iOS/Android)
- **Desktop**: Tauri v2 (macOS/Windows/Linux)
- **Tests**: Vitest + jsdom (1197 tests across 25 files)

## Architecture

### Directory Structure
```
src/
  engine/
    GameEngine.ts     # Base class: canvas, input, loop, drawing, event log, replay
    input.ts          # InputManager: unified pointer/swipe/tap/wheel/longpress/hover
  games/
    registry.ts       # Game registry + lazy loadAllGames()
    icons.ts          # SVG icons for all 16 games
    <name>/<Name>.ts  # Each game: extends GameEngine, self-registers
  storage/
    scores.ts         # Scores, stats, favourites, per-game settings
    gameState.ts      # Per-(game, difficulty) save/resume snapshots
    daily.ts          # Daily completion tracking + streak counter
  utils/
    audio.ts          # 14 procedural sound effects
    haptics.ts        # Vibration feedback (light/medium/heavy/error)
    rng.ts            # Seeded PRNG, dailySeed(), shuffle, pick
    confetti.ts       # Canvas particle burst for win celebrations
    keyboardNav.ts    # Document-level screen-scoped key bindings
    helpOverlay.ts    # Reusable help/keymap modal
  app.ts              # App shell: screens, navigation, Daily Mode, win/gameover
  main.ts             # Bootstrap (non-blocking game load)
  styles/
    theme.css         # CSS custom properties (design tokens)
    app.css           # Component styles
```

### Adding a New Game
1. Create `src/games/<name>/<Name>.ts`, extend `GameEngine`
2. Implement `init()`, `update(dt)`, `render()`
3. Implement `serialize()` / `deserialize(state)` for save/resume (see below)
4. Override `canSave()` to return `false` during transient animations
5. Use `this.rng()` (NOT `Math.random()`) for all randomization — required for daily mode
6. If the game has a win condition, call `this.gameWin()` (idempotent)
7. Call `registerGame({...})` at module level. Set `dailyMode: true` if the game supports deterministic seeded puzzles. Set `continuableAfterWin: true` if play continues past the win (e.g. 2048).
8. Add the dynamic import to `loadAllGames()` in `src/games/registry.ts`
9. Add an SVG icon to `src/games/icons.ts`
10. All coordinates must be relative to `this.width`/`this.height` — never hardcoded

### Key Design Decisions
- **No game framework** — keeps each game chunk under 50KB. Canvas 2D is sufficient for all 16 current games.
- **Self-registering games** — each game file calls `registerGame()` at module level on import
- **Save/resume per (game, difficulty)** — each difficulty has its own independent save slot. The user can pause Hard, switch to Easy, play that, and come back to Hard later.
- **Win celebrations at the app shell layer** — games call `gameWin()`, the app shell shows confetti + a rotating congratulatory message, then auto-starts the next game after ~2.5 seconds. No buttons on the win overlay. The user can always go home via the back button.
- **Touch area covers the full game container** — not just the canvas. Swipes work anywhere on the screen (except HUD buttons).
- **Event log built into the engine** — every input event is automatically recorded. `getEventLog()` returns a `ReplayLog` for debugging and future replay features.

## Save / Resume

Every game must support save/resume. Saves are keyed by `(gameId, difficulty)`.

```ts
serialize(): GameSnapshot | null {
  return { grid: this.grid.map(row => [...row]), /* game-specific fields */ };
}

deserialize(state: GameSnapshot): void {
  // Validate defensively — silently bail on malformed state
  const g = state.grid as number[][] | undefined;
  if (!g || !Array.isArray(g) || g.length !== this.size) return;
  this.grid = g.map(row => [...row]);
  this.slideAnims = []; // Reset transient animation state
}

canSave(): boolean {
  return this.gameActive && !this.animating;
}
```

- `serialize()` returns game-specific state only — the engine handles `score` and `won`.
- `deserialize()` runs AFTER `init()`, so it overwrites fields. Must reset transient animation state.
- Deep-clone all arrays/objects — the snapshot must be independent of live state.
- The storage layer persists: `{ state, score, won, difficulty, savedAt }`. Legacy (pre-per-level) entries migrate automatically on first read.

## Win Conditions

Terminal wins (Sudoku, Minesweeper, Memory Match, Wordle, Nonogram, Lights Out, Mastermind):
```ts
this.gameWin();
setTimeout(() => this.gameOver(), 1500);
```

Continuable wins (2048 — game keeps running):
```ts
this.gameWin(); // celebration only, game continues
```

The app shell auto-starts a fresh game ~2.5 seconds after a terminal win celebration. No buttons on the win overlay. **Do not draw in-canvas win overlays** — the app shell handles all celebration UI.

## Keyboard & Input

### Screen-scoped shortcuts (via `keyboardNav.ts`)
| Screen | Keys |
|---|---|
| Home | `Tab` cycles cards, `Enter`/`Space` launches, `,`/`s` settings, `t` daily, `?` help |
| Difficulty | `←→↑↓` changes level (native slider), `Enter` Play/Resume, `Esc` back, `f` favourite, `?` help |
| Game | `Esc` exit, `?` help. Game-specific keys via `handleKeyDown` |
| Daily | `Esc` back, `1-9` quick-launch, `?` help |
| Settings/Scores | `Esc` back, `?` help |

**Do not bind Space, P, or arrow keys at the app level on the game screen** — games use them.

### Cross-platform input
- **Touch**: listeners on the game container (not just the canvas) so swipes work anywhere on screen. HUD buttons are exempt via tagName check.
- **Trackpad**: games that need it add their own `wheel` listener in `init()` and clean it up in `destroy()`.
- **Right-click**: suppressed on the canvas via `contextmenu` listener for alt-action (e.g. Minesweeper flag).
- **Additional listeners** added outside the engine (wheel, hover, contextmenu) MUST be removed in a `destroy()` override that calls `super.destroy()`.

## Testing

**Every change must include tests.**

### Coverage Targets
- **Core (100%)**: `engine/GameEngine.ts`, `engine/input.ts`, `storage/scores.ts`, `storage/gameState.ts`, `storage/daily.ts`, `games/registry.ts`, `utils/audio.ts`, `utils/haptics.ts`, `utils/rng.ts`, `utils/keyboardNav.ts`, `utils/confetti.ts`, `utils/helpOverlay.ts`
- **App shell (90%+)**: `app.ts`, `main.ts`
- **Games (80%+)**: each game file — must include serialize round-trip, canSave guards, and (for puzzle games) win-condition tests

### Conventions
- `describe`/`it` blocks with clear names
- Mock `idb-keyval` with `get/set/del/keys` before source imports
- Canvas mock auto-loaded from `tests/setup.ts`
- Test all 4 difficulty levels for each game
- Test error cases, not just happy paths
- When parallel agents modify shared test files, **append new describe blocks** — do not edit existing ones

## Code Conventions
- **No `Math.random()`** — use `this.rng()` (seeded for daily mode)
- **No infinite loops** — every `while` needs a guaranteed exit or iteration cap
- **Guard NaN/zero** — `Math.max(value, minimum)` in canvas calculations
- **Warm palette** — background `#FEF0E4`, primary `#8B5E83`, never cool blue/gray
- **Relative coordinates** — always compute from `this.width`/`this.height`
- **Clean up listeners** — GameEngine handles its own; additional ones need `destroy()` overrides with `super.destroy()`
- **Time-based animations** — use `dt` (delta seconds), never frame counts
- **No console.log in production** — terser strips it; use sparingly in dev

## Commands
```bash
npm run dev          # Dev server (localhost:5173)
npm run build        # Production build (tsc + vite)
npm run preview      # Preview production build
npm test             # Run all tests (currently 1197)
npm run test:watch   # Watch mode
npm run cap:sync     # Sync web assets to iOS/Android
npm run build:android # Build + sync Android
npm run build:ios     # Build + sync iOS
npm run open:android  # Open in Android Studio
npm run open:ios      # Open in Xcode
```

## Planned
- Replay viewer (event logs are already recorded)
- Consolidate per-game input handlers to use the shared `InputManager`
- Auth system (login/signup)
- Payment integration (remove ads, buy coins/hints)
- Online leaderboards (Vercel serverless API)
- Achievements system
- More games
