# Contributing to NoFi Games

Thanks for your interest in NoFi Games! This document explains how to set up the project locally, the standards we hold contributions to, and how to get a change merged.

## Code of Conduct

Be kind, be constructive, assume good intent. We follow the spirit of the [Contributor Covenant](https://www.contributor-covenant.org/). Harassment, personal attacks, and discriminatory language are not tolerated.

## Project Overview

NoFi Games is an offline-first casual games collection built with:

- **Vite + TypeScript** (strict mode)
- **HTML5 Canvas 2D** (custom lightweight engine, no game framework)
- **IndexedDB** via `idb-keyval` for offline storage
- **Web Audio API** for procedural sound (no audio files)
- **Vitest + jsdom** for tests
- **Capacitor** (iOS/Android) and **Tauri v2** (desktop) for native builds

For deeper architectural notes, read [`CLAUDE.md`](./CLAUDE.md).

## Getting Started

```bash
git clone https://github.com/IvoryHeart/nofi-games.git
cd nofi-games
npm install
npm run dev          # http://localhost:5173
```

Other useful scripts:

```bash
npm run build        # Production build (tsc + vite)
npm run preview      # Preview the built bundle
npm test             # Run the full test suite once
npm run test:watch   # Vitest in watch mode
```

## Branching & Pull Requests

1. Fork the repo and create a topic branch off `main`:
   ```bash
   git checkout -b feat/my-new-game
   ```
2. Make your change with tests (see below).
3. Push the branch and open a PR against `main`.
4. CI runs `tsc --noEmit`, `npm test`, and `npm run build` on every PR. All checks must be green before review.
5. Vercel automatically creates a preview deployment for your PR — please test the live preview before requesting review.

Branch name suggestions: `feat/...`, `fix/...`, `docs/...`, `refactor/...`, `test/...`.

## Tests Are Required

**Every change must include tests.** This is a hard rule.

Coverage targets:

| Area | Target |
|---|---|
| `src/engine/`, `src/storage/`, `src/games/registry.ts`, `src/utils/audio.ts`, `src/utils/haptics.ts` | **100%** |
| `src/app.ts`, `src/main.ts` | **90%+** |
| Individual games in `src/games/<name>/` | **80%+** |

Run coverage locally:

```bash
npx vitest run --coverage
```

Test layout:

- `tests/unit/` — pure logic in isolation. Mock `idb-keyval`, canvas, etc.
- `tests/integration/` — game registration, instantiation at all four difficulties, cross-module behavior.
- `tests/functional/` — app-level flows: navigation, settings, offline persistence, build artifacts.

The canvas mock for jsdom is in `tests/setup.ts` and is auto-loaded by `vitest.config.ts`.

## Adding a New Game

1. Create `src/games/<name>/<Name>.ts`.
2. Extend `GameEngine` and implement `init()`, `update(dt)`, `render()`.
3. Call `registerGame({...})` at module level (self-registration pattern).
4. Add a dynamic import to `loadAllGames()` in `src/games/registry.ts`.
5. Use `this.width` / `this.height` for all coordinates — never hardcode pixel positions.
6. Map `this.difficulty` (0–3) to meaningful gameplay changes (grid sizes, speeds, mechanics).
7. Trigger sound via `this.playSound('name')` for key game events.
8. Write tests across all four difficulty levels in `tests/integration/`.

## Code Conventions

- **TypeScript strict mode** is on. Fix the type, don't reach for `any`.
- **No infinite loops** — every `while` must have a guaranteed termination condition or iteration cap.
- **Guard against NaN/zero** in canvas math: `Math.max(value, minimum)`.
- **Warm color palette only** — see `src/styles/theme.css`. Never introduce cool blue/gray.
- **Time-based animations** — use `dt` (delta seconds), never frame counts.
- **Clean up listeners** via `GameEngine.destroy()`. Don't add listeners outside the engine.
- **Comment only where logic isn't self-evident.** Don't narrate obvious code.

## Commit Messages

Keep them short, imperative, and meaningful:

```
Add diagonal-swap mechanic to Gem Swap
Fix Bubble Pop infinite loop in renderAimLine
Bump test coverage for Sudoku to 98%
```

We don't enforce a strict format (Conventional Commits is welcome but not required).

## Reporting Bugs

Open an issue with:

- What you expected to happen
- What actually happened
- Steps to reproduce (which game, difficulty, browser/platform)
- Console errors if any

## Suggesting Features

Open an issue tagged `enhancement` describing the feature and why it fits NoFi's offline-first, lightweight philosophy. Bundle size and dependency count are taken seriously — we keep the app under 200KB for a reason.

## Questions?

Open a discussion or issue on GitHub. Thanks for contributing!
