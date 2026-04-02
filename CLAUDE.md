# NoFi Games - Development Guide

## Project Overview
NoFi Games is an offline-first casual games collection. Brand name: **NoFi Games** (written as "NoFi"). Domain: nofi.games. App ID: `games.nofi.app`.

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
  utils/audio.ts          # Procedural sound effects (Web Audio API)
  utils/haptics.ts        # Vibration feedback
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
3. Call `registerGame({...})` at module level (self-registration)
4. Add dynamic import to `src/games/registry.ts` `loadAllGames()`
5. Game receives `this.width`, `this.height` (dynamic), `this.difficulty` (0-3)
6. All coordinates must be relative to canvas dimensions, not hardcoded

### Key Design Decisions
- **No game framework** (Phaser, PixiJS etc.) - keeps bundle under 200KB
- **Self-registering games** - each game file imports `registerGame` and calls it at module level
- **Dynamic canvas sizing** - games fill available screen space, calculate layout from `this.width`/`this.height`
- **Difficulty 0-3** - Easy, Medium, Hard, Extra Hard. Each game maps this to meaningful gameplay changes
- **Offline-first** - zero network calls required. All storage is local IndexedDB.
- **Procedural audio** - no audio files, all sounds synthesized via Web Audio API

## Testing Requirements

**Every change must include tests.** This is a hard requirement, not optional.

### Coverage Targets
- **Core files (100%)**: `engine/GameEngine.ts`, `storage/scores.ts`, `games/registry.ts`, `utils/audio.ts`, `utils/haptics.ts`
- **App shell (90%+)**: `app.ts`, `main.ts`
- **Game files (80%+)**: Each game in `games/*/`
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
