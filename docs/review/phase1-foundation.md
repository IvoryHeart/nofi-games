# Phase 1 Foundation — Code Review

Commits reviewed: `0daa4f4`, `bee2061`, `4bd0f88`, `ed8b170`.
Reviewer: Opus 4.6 (1M context).

## Summary

Strong overall. The new types are well designed, the SRS kick tables match the spec exactly, the `InputManager` has a clean API, and the Bubble Pop floater fix is correctly scoped. Test coverage for new surface area is meaningful (not just "doesn't throw"). However: (1) `InputManager` is defined but not yet wired into any game — BlockDrop/Breakout/2048 each re-implemented wheel, hover and swipe handling inline, meaning the commit that "unifies" input actually *added* a fifth input layer; (2) the DAS key-release state machine has a real UX bug when direction keys are swapped mid-hold; (3) the legacy `gameState` migration quietly leaks keys when difficulty doesn't match; (4) the confetti `resize` listener leaks on browser back-nav; (5) Bubble Pop still has two unseeded `Math.random()` call sites despite the commit message claiming the fix. None of these block ship, but (1) and (2) should be resolved before Phase 2 lands more games on top.

## Findings by area

### 1. Per-level saves (`src/storage/gameState.ts`)

**What's good**
- Clean API, `key()` helper avoids string drift, types are tight.
- `clearAllGameStates` correctly wipes the legacy key in addition to the 4 per-difficulty slots.
- Tests cover the difficulty-namespacing, cross-game isolation, and the "legacy entry, non-matching difficulty" branch.

**Bugs / concerns**

- **Legacy migration leaks on difficulty mismatch.** `loadGameState('snake', 0)` with a legacy save at difficulty 2 returns `null` and leaves the legacy key in place. If the player never opens difficulty 2 again (common — the whole point of per-level is that people bounce between levels), the legacy entry lingers forever. Two options:
  - Migrate the legacy entry to its *own* slot (`gamestate_snake_2`) on the first load of *any* difficulty, not just the matching one.
  - Or run a one-shot migration in `main.ts` / `App.init` that moves every legacy key to its per-difficulty slot at app start.
- **`hasGameState` has a hidden side effect.** It calls `loadGameState`, which can trigger legacy migration. That means a simple "do we have a save for level 2?" check can mutate storage. Not wrong per se but surprising. A pure `get(key(...)) != null` check is cheaper and side-effect-free.
- **`savedDifficulties` does not consider the legacy entry.** If the player had a legacy save and has never opened the matching difficulty, `savedDifficulties(gameId)` returns an empty array even though a save "exists". Minor, but it means a future "which levels have saves?" UI would miss the legacy entry.

**Test coverage**
- The existing "does not return a legacy entry for a non-matching difficulty" test asserts the `null` return but does *not* assert that the legacy key was (or wasn't) cleaned up. Worth adding a `expect(store.has('gamestate_snake')).toBe(true)` so the leak is documented if nothing else.

### 2. Confetti / win celebration (`src/utils/confetti.ts`, `src/app.ts`)

**What's good**
- Dependency-free, ~200 LOC, clean lifecycle with idempotent `stop()`.
- `prefers-reduced-motion` respected, with the early return before allocating the canvas.
- Null-check on `getContext('2d')` falls back cleanly without leaving the canvas or the resize listener attached.
- `WIN_MESSAGES` + `pickWinMessage(counter)` is a nice, testable cycle.

**Bugs / concerns**

- **Resize listener leaks if the overlay is dismissed via browser back-nav.** `handleWin`/`handleGameOver` only call `stopConfetti()` on the overlay buttons. If the user presses the OS back button (or `Escape`, which calls `history.back()` in other screens but not here — the win overlay doesn't set a key binding), `stopConfetti` is never called and the `resize` listener stays on `window` along with the `rafId` still ticking until the particles fall off and `elapsed > duration` fires. The `frame` callback does call `stop()` on duration expiry, so the leak is bounded to ~2.2 seconds, but if the container is detached before then, `container.getBoundingClientRect()` returns a degenerate rect and particles keep rendering into a detached canvas. Fix: listen for `beforeunload` / `popstate` and call `stop()`, or have `app.ts` track the active confetti stopper and call it from `exitGame`.
- **`prefers-reduced-motion` fallback when `matchMedia` is unavailable.** The code does `if (mq && mq.matches)` — when `matchMedia` is missing (old WebView, Node), reduced-motion is NOT respected and the burst runs. In practice this only matters for Node tests; safer default would be to treat "no matchMedia" as "respect reduced-motion" or at least log once. Minor.
- **`dpr` is captured once at `burst()` time.** If the user drags the window across monitors mid-burst, particles scale wrong. 2-second window, won't bite anyone.
- **Particle count is inconsistent.** `handleWin` uses 100, `handleGameOver` uses 80 — not a bug, just a magic number worth naming (`WIN_PARTICLES`, `BEST_PARTICLES`).

**Test coverage**
- Tests cover lifecycle, stop idempotency, reduced-motion, message cycle. Missing: the detached-container case and the `getContext` null path.

### 3. Event log / replay (`src/engine/GameEngine.ts`)

**What's good**
- Zero game-code changes — the logging sits in the existing input wrappers. Elegant.
- `replayActive` flag correctly prevents recursive re-recording when a replay fires the same handler that would normally record.
- 10k cap is enforced in `recordEvent` (`if (this.eventLog.length >= MAX_EVENTS) return`).
- `start()` correctly resets `eventLog` and `logStartTime` per session.
- Deterministic rng roundtrip test asserts replay + seed reproducibility.

**Bugs / concerns**

- **10k cap is silent.** Once full, new events are dropped without a counter or a tail-ring. Means a 30-minute Tetris session loses *all* events after the first few minutes, which defeats the "what did the player do before the crash?" goal. Consider a circular buffer (drop oldest) or a counter so you at least know "N events dropped".
- **Replay coordinate model is lossy.** `GameEngine` records logical (x, y) in pointer events, not raw client coordinates + rect. That means a replay against a different canvas size produces wrong positions. OK for in-session replay, wrong for "share a replay across devices". Worth documenting.
- **Replay synthesizes only `.key` and `.preventDefault` on the fake `KeyboardEvent`.** Games that read `e.shiftKey`, `e.ctrlKey`, `e.repeat` etc. will see `undefined`. BlockDrop uses `e.preventDefault()` only for arrow keys, so it's fine today, but this is a tight coupling — any game that reads modifier keys will silently break during replay. Worth at least a type assertion comment or a helper that synthesizes a more complete event.
- **No time-aware replay** — the docstring says "best-effort". Fine as stated, but worth a TODO for the future scrub UI.
- **`durationMs` computation**: `this.logStartTime > 0 ? performance.now() - this.logStartTime : 0`. If the user saves the log *after* `destroy()`, `lastTime` and `running` are reset but `logStartTime` is not — so you can still call `getEventLog()` after destroy and get a (now-inflated) duration. Minor.

**Test coverage**
- Tests cover recording, cap, replay no-recursion, seed reproducibility, pointer replay. Missing: replay after exceeding the cap (does it still run to the end?), replay against a *different-sized* canvas, keyboard event with modifiers.

### 4. InputManager (`src/engine/input.ts`)

**What's good**
- Clean, well-commented public API. Types are precise. `InputEvents` and `InputConfig` separation is right.
- Wheel normalization for `deltaMode` 0/1 is correct. Tests assert line-mode normalization.
- Long-press state machine correctly handles drift cancellation, early release, and touchcancel via `cancelPress()`.
- Tap-vs-swipe threshold is parameterized; velocity is reported in px/ms.
- `setEvents` swaps handlers in place without re-attaching listeners — correctly stores references through `this.events` so every callback invocation reads the current set.
- `destroy()` is idempotent and clears the long-press timer before detaching.

**Bugs / concerns**

- **DEAD CODE.** Not a single game imports `InputManager`. BlockDrop, Breakout and 2048 each added their *own* inline `mousemove` / `wheel` handlers instead of adopting the abstraction introduced two commits earlier. The commit message for `bee2061` says this is intentional ("follow-up per-game fixes will opt games into the new layer one at a time so regressions stay isolated"), but then `ed8b170` *didn't* opt any of them in — it bypassed the abstraction entirely. Net effect: we now have five input layers (`GameEngine.setupInput`, `InputManager`, BlockDrop's hand-rolled wheel, Breakout's hand-rolled hover, 2048's hand-rolled wheel) instead of one. This is the single most important piece of follow-up to land before Phase 2 adds more games.
- **Wheel `deltaMode === 2` normalization inconsistency.** `InputManager` uses `100` px/page, BlockDrop uses `400`, 2048 uses `400`. The research doc doesn't specify. Pick one and put it in a shared constant.
- **Swipe dominant-axis tie-break.** `Math.abs(dx) > Math.abs(dy) ? ... : ...` — when `dx == dy`, y wins. Not wrong, just undocumented.
- **Touch events on `touchend` read `pointer.x`/`pointer.y` instead of `changedTouches[0]`.** A finger released at a different position than the last `touchmove` sample would report stale coordinates. Uncommon, but real.
- **No pointer capture.** `mouseup` is attached to `window`, which is the right choice for drag-off-canvas, but there's no `releasePointerCapture` / pointer ID tracking. A multi-touch release on the second finger cancels the whole press. Fine for single-touch games, worth a note.
- **Long-press uses `setTimeout`** — fine, but the `longPressMs: 0` disables it (guard `this.config.longPressMs > 0`). A user passing `longPressMs: undefined` gets the default 450, which is what you want. OK.

**Test coverage**
- 24 tests, meaningfully asserted. Covers the drift cancel, tap-suppression after long-press, context-menu suppression, deltaMode=1 wheel normalization, touch dispatch, `setEvents` and `setSize` swaps. Missing: touchcancel, deltaMode=2 normalization, the `mousedown` right-button (`e.button === 2`) bail-out, two-finger touch (changedTouches vs touches).

### 5. Bubble Pop fix (`src/games/bubble-pop/BubblePop.ts`)

**What's good**
- Root cause (parity flip on row shift) is diagnosed correctly in the commit message and comment. `dropFloaters()` factoring is the right move.
- `rowIntroProgress` lerp with ease-out looks smooth; hooked into `canSave()` so the animation isn't interrupted by a checkpoint.
- `deserialize()` correctly resets `rowIntroProgress = 1`.

**Bugs / concerns**

- **Commit message says "uses `this.rng()` instead of `Math.random()`" but the fix is incomplete.** Lines 167, 180, 182 still call `Math.random()` in `addRow()` (the initial grid build) and `pickColor()` (shooter pick). So in Daily Mode / seeded runs, the initial grid and shooter picks are non-deterministic. The seeded-rng contract is broken for this game. Fix: migrate all three call sites to `this.rng()`.
- **`dropFloaters()` with an empty row 0 would drop every remaining bubble.** `findFloaters()` seeds the BFS from row 0 — if row 0 is entirely null, nothing is "attached" and every bubble in the grid becomes a floater. The existing call sites (`placeBubble` after a match, `pushNewRowFromTop` which just inserted a full row) don't hit this case in practice, so it's not a live bug, but any future caller could be blindsided. Add an early return: `if (!this.grid[0] || this.grid[0].every(c => c === null)) return;`.
- **`dropFloaters` `continue` after a null cell does not decrement the score count.** `this.addScore(floaters.size * POINTS_PER_DROP)` uses the raw `floaters.size`, but if a cell was found floating and then its color was null (via the `continue` guard), the score credits a drop that never animated. In practice `findFloaters` only returns cells with `row[c] !== null`, so this branch is unreachable, but it's a stale defensive check.
- **Row-intro animation does not render the newly-added row differently.** It offsets the whole grid down and uses `this.easeOut(...)`, so visually the entire board slides down by one row-height, not just the new row. Looks fine most of the time because everything below row 0 was just shifted, but if there are `dropAnims` in flight from the floater sweep, those drop from static world-y coordinates while the grid slides — the dropping bubbles will visually "jump" relative to the grid during the slide. Unlikely to be noticed.

**Test coverage**
- `dropFloaters clears any cell not connected back to row 0` — good.
- `pushNewRowFromTop triggers a floater sweep` — good.
- `dropFloaters leaves row 0 alone` — **misleading**. The test populates row 0 entirely with a single color and leaves rows 1–3 empty, then asserts `dropAnims.length` is unchanged. That's testing "empty rows don't produce floaters", not "row 0 is immune to dropping". If you flip the fixture to populate row 0 *and* row 2 (skipping row 1), does row 2 correctly drop? That's the real test.
- Missing: the "empty row 0 → all bubbles drop" edge case noted above.
- Missing: floater-sweep during an active `dropAnim` — do we double-count?

### 6. Block Drop modern controls (`src/games/block-drop/BlockDrop.ts`)

**What's good**
- **SRS kick tables are byte-identical to the research doc and the Tetris Wiki Y-down values.** I verified all 8 entries for JLSTZ and all 8 for I. O is correctly treated as a single zero-kick. The `tryRotate` now adds `ky` instead of subtracting, matching the Y-down tables.
- Hard-drop gate is now velocity-based + axis-dominance: `vy > 1.5 && dyTotal > CELL && verticalDominant` — much better than the old 2-cell distance gate.
- `pointerSamples` 3-sample sliding window for velocity is simple and correct.
- `hDragAccum` is incremented against `touchLastX` so gradual drift tracks smoothly, not from the original down point — this matches modern Tetris UX.
- DAS/ARR run in `update()` against engine time, not browser key-repeat. The `while` loop has a 20-iteration guard so a hitched frame can't push the piece across the board.
- Wheel handler is attached in `init()` and removed in a proper `destroy()` override that calls `super.destroy()`.
- `Math.random()` → `this.rng()` in the bag shuffle and garbage-row generation. These are daily-seed-safe now.
- Pause (`P`/`Escape`) works even during the clear animation — nice touch.

**Bugs / concerns**

- **DAS state machine drops movement when two direction keys swap.** Scenario: hold ArrowLeft (dasDir = -1), press ArrowRight (dasDir = 1, timers reset), release ArrowRight (keyUp matches `dasDir === 1` → dasDir = 0). Left is *still physically held* but movement stops. To resume, the player has to release Left and press it again. Modern Tetris guidelines (SRS DAS) handle this by restoring the other held direction. Two fixes:
  - Track both `leftHeld` and `rightHeld` booleans independently; on keyUp of the active direction, set `dasDir` to the other held direction (if any).
  - Or track the last-pressed direction and fall back to the opposite if still held.
  - Add a test for this scenario: press Left, press Right, release Right → expect `dasDir === -1` (Left still active).
- **Wheel cooldown strictness.** In `handleWheel()`, once `lastWheelTriggerTime = now` is set inside the loop, the next iteration's `now - lastWheelTriggerTime === 0 < COOLDOWN_MS`, so the loop `break`s. This means a huge single wheel event accumulates in `wheelAccumY` but only fires ONE soft-drop per event. At 40 px/step with a 180 ms cooldown, max sustained soft-drop rate is ~5.5 steps/sec — slower than holding ArrowDown. Whether that's correct is tuning; I'd argue for allowing multi-step within a single *event* (since the player already performed one physical scroll), and only applying the cooldown between *distinct* events.
- **Hard-drop wheel path doesn't check `Math.abs(px) > Math.abs(e.deltaX) * 2` against the *normalized* deltaX.** `e.deltaX` is raw, `px` is normalized. If `deltaMode === 1`, raw deltaX and normalized deltaY are in different units. Minor, affects edge cases.
- **`touchLastTime` is set but never read.** Dead field — the velocity uses `pointerSamples`.
- **`vx` is computed and then discarded** with a `void vx;` comment. If you're going to track it, use it for axis lock; if not, drop the computation.
- **`SHAPES` for I and S/Z only has 2 unique rotations** (states 0==2, 1==3). Research doc called this out as "OK for visual gameplay because the piece looks the same". Accepted trade-off, but the kick tables you added assume proper SRS states — so rotating I from 0 → 2 (a 180° via two CW presses) will happily pass through a state R that may not exist visually. Not a bug, just a coherence note.
- **`pointerSamples.push` in `handlePointerDown` seeds only the initial position**; velocity needs 2+ samples, so the first `pointerVelocity()` call after down returns zeros. That's intended, but the test "a slow short downward drag does NOT trigger a hard drop" *manually* stuffs pointerSamples to drive velocity, which is a sign the shape is awkward to test.

**Test coverage**
- 14 new tests hit the important surface: SRS table lookup (indirectly), tap-rotate, slow-drag-no-hard-drop, wheel soft-drop/hard-drop/cooldown/normalization, P/Escape pause, Z CCW, DAS timer advance, wheel cleanup.
- **Missing the direction-switch scenario** flagged above.
- **`SRS table has an entry for every (from, to) transition` is weak** — it only verifies `tryRotate` doesn't crash on the first available piece. It doesn't assert that each key in `KICKS_JLSTZ` and `KICKS_I` is actually exercised and correct. A table-driven test that iterates all 8 `from→to` values and asserts `(kx, ky)` matches the research spec would be stronger. Export the tables for test access.
- **No test for the `touchLast*` → `pointerSamples` migration** — i.e. no test asserts that holding a pointer still moves the piece when the DAS-like drag accumulator kicks in.

### 7. Breakout pointer-follow (`src/games/breakout/Breakout.ts`)

**What's good**
- Attaches `mousemove` in `init`, removes in `destroy`. Clean lifecycle.
- Logical coordinate scaling via `this.width / rect.width`.
- Gated on `this.gameActive` — no paddle movement after game over.
- Keyboard arrows and touch drag still work.

**Bugs / concerns**

- **Re-implements logic that `InputManager` already has** (rect scaling, hover mode). This is Exhibit A for "InputManager is dead code" in §4.
- **Hover handler is stored as a class field but assigned conditionally** — the `if (!this.hoverHandler)` guards against double-attach, which only matters if `init()` is called twice without `destroy()` in between. Unlikely but defensive.
- **No key-repeat clamping for arrow keys** — unchanged by this commit, but the mousemove path now competes with keyboard movement in a way that can jitter the paddle if both are used at once. Minor.

**Test coverage**
- 5 solid tests: middle, left-edge clamp, right-edge clamp, destroy cleanup, game-over no-op. Very good — these are exactly the edge cases.

### 8. 2048 wheel gestures (`src/games/twenty48/Twenty48.ts`)

**What's good**
- `WHEEL_THRESHOLD_PX` and `WHEEL_COOLDOWN_MS` are named constants.
- Partial accumulator drain: after firing, `wheelAccumY -= sign(accumY) * THRESH` instead of zeroing it, so a continuous fast scroll can fire a second move after the cooldown. Nice touch.
- Cross-axis zeroing: firing a vertical move zeros `wheelAccumX`, which prevents stale horizontal accumulation from leaking into a later move.
- `deltaMode` 0/1/2 normalization. Note: uses 400 px/page where InputManager uses 100 — see §4.

**Bugs / concerns**

- **Also re-implements what `InputManager` has.** Same Exhibit A.
- **The wheel handler accumulates across the cooldown.** If the player scrolls, triggers a move, then scrolls the other way during the cooldown, the opposite-axis accumulator keeps building. After the cooldown expires, a late event with small delta can fire in a direction the player has *already* stopped scrolling. Worth a "decay after cooldown" or "zero both accumulators on trigger, not just the cross-axis one".
- **`preventDefault` is unconditional** — fine inside the game canvas, but if the canvas is scrolled into view and the user's first wheel event lands on it, the page scroll is hijacked. Expected behavior for a game, just worth noting for accessibility.

**Test coverage**
- 9 tests: directional moves (3), sub-threshold no-fire, accumulated fires, cooldown, deltaMode=1, destroy cleanup, gameOver no-op. Solid.
- Missing: cross-axis zeroing assertion (move down, then try to move right with leftover accumX — should fire or not?).

### 9. Wordle cursor (`src/games/wordle/Wordle.ts`)

**What's good**
- 530 ms blink rate matches standard caret cadence.
- Suppressed when the game is won or `guesses.length >= maxGuesses`.
- Border hint color is a pre-existing constant; caret bar is sized proportionally to cell.

**Bugs / concerns**

- **`cursorPhase` uses `performance.now()` not a game-relative clock.** Harmless — caret keeps blinking while paused. But inconsistent with dt-based animations elsewhere. Not worth fixing.
- **No test for the cursor.** The commit adds 3 tests to `game-logic-1.test.ts` but they're all Bubble Pop. Missing: "cursor shows on active row", "cursor hidden after all guesses", "cursor hidden after win".

## Bugs flagged (prioritized)

### Critical
- None. Nothing crashes or corrupts data.

### Should fix
- **DAS direction-switch bug (BlockDrop)** — Two-key direction swap leaves the player stuck holding a dead key. Real UX bug, easy to reproduce. Fix described in §6.
- **InputManager is dead code** — three games that explicitly needed it bypass it. The longer this sits, the more game-specific input code has to be torn out later. Rewire BlockDrop / Breakout / 2048 to use it before adding more games in Phase 2.
- **Bubble Pop still has 3 `Math.random()` call sites** — `addRow`, `pickColor` (twice). Daily Mode / seeded reproducibility is broken for Bubble Pop despite the commit claiming it's fixed. Easy fix, 3 lines.
- **Legacy gameState migration leaks on difficulty mismatch** — add a one-shot at-startup migration, or make `loadGameState` move the legacy entry to its own slot regardless of the requested difficulty.

### Nice to have
- Event log 10k cap should either be a ring buffer or expose a `droppedCount` so callers can tell they lost data.
- Confetti `resize` listener should be torn down on `popstate`/`exitGame`, not just overlay-button click.
- Expose `KICKS_JLSTZ` and `KICKS_I` for a table-driven SRS test that iterates all 8 transitions and asserts the values against the research spec.
- Named constants for wheel-page normalization (single source of truth for `deltaMode === 2` px-per-page).
- Add Wordle cursor tests (3 cases in §9).
- Bubble Pop "empty row 0 → drops everything" guard and accompanying test.
- Consider decaying the 2048 cross-axis wheel accumulator on trigger.
- Replay coordinate model: document that pointer coords are logical and not portable across canvas sizes.

## Test coverage gaps

1. **SRS kick tables aren't directly asserted.** Tests exercise `tryRotate` indirectly but never assert the actual `(kx, ky)` values. A table-driven test would catch a regression on any single entry.
2. **DAS direction-switch scenario is untested.** No test holds Left, presses Right, releases Right, and asserts Left still drives movement.
3. **Bubble Pop `dropFloaters` "empty row 0" edge case.** Not tested.
4. **Bubble Pop "row 0 is immune" test is actually asserting the wrong thing.** Fix the fixture.
5. **Wordle cursor has zero tests** — 3 simple assertions would fill the gap.
6. **Event log cap behavior** — nothing asserts what happens to the 10 001st event (silently dropped vs. ring-buffered).
7. **Confetti container-detached-before-stop** — not tested, real memory concern.
8. **InputManager touchcancel + deltaMode=2 + multi-touch** — untested, though InputManager itself is dead code.
9. **`hasGameState` / `savedDifficulties` legacy-entry behavior** — not asserted.

## Recommendations for follow-up

1. **Wire `InputManager` into BlockDrop, Breakout and 2048.** One PR per game, each replacing the hand-rolled listener with a subscription. Delete the per-game `wheelHandler`, `hoverHandler`, etc. Measure: test counts should stay equal or grow; total LOC for input handling should *drop*.
2. **Fix DAS direction-switch.** Track `leftHeld`/`rightHeld` independently; on key-up of the active direction, fall back to the other if held. Add the test.
3. **Complete the Bubble Pop seeding.** Three call sites: `addRow`, `pickColor` (×2) → `this.rng()`.
4. **Harden gameState migration.** At app startup, walk `idb-keyval` keys matching `gamestate_<id>` (legacy shape, no `_<d>` suffix) and migrate each to its per-difficulty slot. This is a one-time, fire-and-forget cleanup.
5. **Add SRS kick-table tests.** Export the tables; iterate all 8 transitions; assert byte-for-byte against the research spec.
6. **Document the new patterns in CLAUDE.md.** Event log, per-level saves, confetti usage, and (once it's wired in) InputManager. A "Common patterns" section would help the next game author.
7. **Decide on the event log memory strategy** — ring buffer vs counter vs sampled. Without a decision, long sessions silently lose their tails.
8. **Audit the other games for `Math.random()` leftovers** — Snake, Minesweeper, Sudoku, Gem Swap, Memory Match, 2048 all still have them. Not a Phase 1 blocker, but Daily Mode reproducibility is a lie until they're all seeded.

---

### Appendix: files reviewed

- `/Users/ny/Forge/ProPlay/src/storage/gameState.ts`
- `/Users/ny/Forge/ProPlay/src/utils/confetti.ts`
- `/Users/ny/Forge/ProPlay/src/engine/GameEngine.ts`
- `/Users/ny/Forge/ProPlay/src/engine/input.ts`
- `/Users/ny/Forge/ProPlay/src/games/bubble-pop/BubblePop.ts`
- `/Users/ny/Forge/ProPlay/src/games/block-drop/BlockDrop.ts`
- `/Users/ny/Forge/ProPlay/src/games/breakout/Breakout.ts`
- `/Users/ny/Forge/ProPlay/src/games/twenty48/Twenty48.ts`
- `/Users/ny/Forge/ProPlay/src/games/wordle/Wordle.ts`
- `/Users/ny/Forge/ProPlay/src/app.ts`
- `/Users/ny/Forge/ProPlay/tests/unit/gameState.test.ts`
- `/Users/ny/Forge/ProPlay/tests/unit/confetti.test.ts`
- `/Users/ny/Forge/ProPlay/tests/unit/GameEngine.test.ts`
- `/Users/ny/Forge/ProPlay/tests/unit/input.test.ts`
- `/Users/ny/Forge/ProPlay/tests/integration/game-logic-1.test.ts`
- `/Users/ny/Forge/ProPlay/tests/integration/game-logic-2.test.ts`
- `/Users/ny/Forge/ProPlay/tests/integration/breakout.test.ts`
- `/Users/ny/Forge/ProPlay/docs/research/tetris-controls.md`
- `/Users/ny/Forge/ProPlay/CLAUDE.md`
