# Cross-Platform Game Control Conventions — Research

Scope: a control-design bible for the 16-game NoFi Games Canvas 2D PWA. Targets four input modalities — mobile touch, Mac trackpad, mouse + keyboard, and physical keyboard — with the same code path per game where possible.

Status: research only, no code changes. Recommendations should be implemented in `src/engine/GameEngine.ts` (input layer) and individual `src/games/*` files in a follow-up PR.

---

## TL;DR

1. **Adopt a unified Pointer Events layer.** Replace the parallel mouse/touch listeners in `GameEngine.setupInput()` with a single `pointerdown/move/up/cancel` path. Pointer Events normalize mouse, touch, and pen across all modern browsers, including Safari iOS 13+, and remove ~half the listener code currently in the engine.
2. **Lock in nine universal bindings (see §1).** Every game responds the same way to: primary action, secondary action, pause, restart, hint, undo, back, navigation arrows, and a help overlay. Players should never have to re-learn these.
3. **Pick one swipe model per genre, not per game.** Tile-slide and match-3 are the only places where swipe semantics differ — and even then, both should accept arrow keys as fallback so keyboard-only players are never locked out.
4. **Suppress `contextmenu` only on the canvas, never globally.** Right-click is reserved for "flag" semantics in Minesweeper and "secondary action" everywhere else; the rest of the page (menus, scores) keeps native context menus for accessibility.
5. **Long-press = 400 ms.** Already used by Minesweeper. Standardize across the engine and provide a visual ring/fill affordance plus cancel-on-move (≥10 px movement aborts).
6. **Trackpad wheel: normalize to "ticks", not pixels.** Accumulate `deltaY` until a magnitude threshold is crossed, then emit a discrete `wheel-tick` event. Solves the deltaMode 0/1/2 problem and the macOS inertia tail in one place.
7. **44×44 CSS px minimum hit target** (WCAG 2.1 SC 2.5.5 / 2.2 SC 2.5.8 minimum). On a 320 px-wide phone that means ≤7 columns of "tappable" cells before you have to scroll or pinch. Bake this into per-game layout.
8. **Honor `prefers-reduced-motion`.** Engine should expose a single `reducedMotion` boolean; games conditionally skip non-essential tweens (cell pop-ins, particle bursts, screen shake) but never skip feedback that conveys state (e.g. "match found" still flashes — just shorter).
9. **Keyboard equivalence is non-negotiable.** Every game that can be played by pointer must be playable end-to-end without touching the pointer. Tile-slide and Sudoku already do this. Gem Swap, Minesweeper, Word Search, Bubble Pop, Breakout, Block Drop need parity passes.

---

## 1. Universal baseline bindings

These bindings are **identical across every game**. Players who learn them once never need to read another tutorial.

| Action | Keyboard | Pointer (mouse / trackpad) | Touch | Notes |
|---|---|---|---|---|
| **Primary action** (place / reveal / select / launch / fire) | `Space` *and* `Enter` | Left click / tap | Tap | Both Space and Enter for muscle memory across web and game conventions |
| **Secondary action** (flag / mark / cycle / alt-place) | `Shift` modifier OR `F` | Right click | Long-press (400 ms) | Suppress browser context menu **only on canvas** |
| **Pause / resume** | `P` *and* `Escape` | (button in HUD) | (button in HUD) | Escape is the universal "stop what you're doing" key on the web; P is gaming convention |
| **Restart current game** | `R` | (button in HUD) | (button in HUD) | Confirm dialog only if a run is mid-progress |
| **Hint** | `H` | (button in HUD) | (button in HUD) | No-op if game has no hint system; never throw |
| **Undo** | `Z` *and* `Cmd/Ctrl+Z` | (button in HUD) | (button in HUD) | Only games with hasUndo=true respond |
| **Back / quit to menu** | `Escape` (when not in pause overlay), `Backspace` | (button in HUD) | (button in HUD) | Escape is contextual: pause first, then quit |
| **Spatial navigation** (cell selector / cursor) | Arrow keys *and* `WASD` | (n/a) | (n/a) | Wraps at edges in tile-slide; clamps in grids |
| **Help / show controls** | `?` (Shift+`/`) | (button in HUD) | (button in HUD) | Opens an overlay listing the per-game bindings |

**Implementation rule:** these are handled in `GameEngine` itself, not in each game. Games receive callbacks (`onPause()`, `onRestart()`, `onHint()`) they can override. This guarantees no game can accidentally break a universal binding.

**Conflict rule:** if a game needs to override one of these (e.g. an arcade game where `Space` fires a weapon), it must call `super.handleKeyDown(key, e)` first and bail only on a hard conflict. Document the override in the game's header comment.

---

## 2. Per-platform primary action

Each platform has a single "obvious" primary action. The rule for the engine: the primary callback fires from any of these and the game cannot tell which one was used.

| Platform | Primary | Secondary | Tertiary (cancel / back) |
|---|---|---|---|
| **Mobile touch** | Tap (≤200 ms, ≤10 px movement) | Long-press (400 ms hold) | Two-finger tap, OR explicit back button |
| **Mac trackpad** | Click (one finger) | Two-finger click *or* Control+click *or* right-click | Escape |
| **Mouse + keyboard** | Left click | Right click | Escape |
| **Physical keyboard** | Space / Enter | Shift+Space / F | Escape |

### Tap vs gesture decision matrix

Use **tap-to-place** when:
- The target is discrete and legible at the current zoom (Sudoku cells, Minesweeper cells, Lights Out tiles, Memory Match cards).
- The action is destination-only — the player doesn't care about the path, only the endpoint.
- The game has many small targets where dragging would be slow.

Use **gesture (drag/swipe)** when:
- The action implies direction or motion (Twenty48 swipe, Snake direction, Breakout paddle move).
- Two endpoints matter (Word Search start→end letter sequence, Gem Swap source→target).
- Continuous control beats discrete steps (Breakout paddle aiming).

**Hybrid: support both.** Gem Swap should accept both "tap one gem, then tap a neighbor" *and* "swipe across two gems". Word Search should accept both "drag across letters" and "tap first letter, tap last letter". The cost is small (one extra state machine per game) and the accessibility win is significant.

---

## 3. Pointer-follow vs click-drag

Two fundamentally different pointer modes; pick per game and stick to it.

### Pointer-follow (no button needed)
The cursor's *current* position drives game state in real time. Examples: Breakout paddle, Bubble Pop aim line, Snake-mode-with-mouse.

**Use when:**
- The game has exactly one continuously-controlled object.
- The pointer is the *only* input modality for that object (no other meaning of "hover").
- The game runs full-screen or has a clearly bounded canvas (so the pointer can't wander into UI).

**Pros:** zero friction on trackpad, instant response, mirrors hardware joysticks.
**Cons:** terrible on touch (no hover state), confusing on desktop if the canvas is small (cursor leaves the play area), conflicts with text selection.

**Touch fallback:** drag-to-position. Touching the screen anywhere snaps the controlled object's X to that position; lifting the finger does *not* clear it. This is how every mobile Breakout clone since Atari Breakout has worked.

### Click-drag (button-down required)
A drag operation only counts while the button/finger is held. Examples: Gem Swap source→target, Word Search letter sweep, Minesweeper cell-marquee.

**Use when:**
- The game has multiple targets and the player has to commit to one.
- The drag has a meaningful start and end (not just current position).
- The same canvas region also accepts other gestures (taps, double-clicks).

**Pros:** works identically on touch and pointer, supports cancel-on-release-outside, pairs cleanly with long-press for secondary actions.
**Cons:** requires explicit press-and-hold on trackpad, which some users dislike.

### Decision per current game

| Game | Mode | Rationale |
|---|---|---|
| Breakout | **Pointer-follow** (paddle-x) + **drag** on touch | Paddle is the only controlled object |
| Snake | **Keyboard** primary + **swipe** on touch | Direction is discrete |
| Bubble Pop | **Click-drag** to aim, release to fire | Aim+commit pattern |
| Gem Swap | **Click-drag** OR tap-tap | Both must work |
| Word Search | **Click-drag** OR tap-first/tap-last | Both must work |
| Memory Match | **Tap** | Discrete targets |
| Minesweeper | **Tap** + secondary | Discrete targets |
| Sudoku | **Tap** + keyboard | Cell selection then digit |
| Twenty48 | **Swipe** + arrows + **wheel** | Discrete direction |
| Lights Out | **Tap** | Discrete |
| Mastermind | **Tap** | Discrete |
| Nonogram | **Click-drag** for streaks + tap for single | Drag-painting standard |
| Stack Block | **Tap / Space** | Single timing input |
| Block Drop | **Tap / arrows / swipe** | Tetris idiom |
| Anagram | **Tap** letter buttons + keyboard typing | Hybrid |
| Wordle | **Keyboard** + on-screen tap keys | Hybrid |

---

## 4. Trackpad wheel handling

The Mac trackpad two-finger scroll generates a continuous stream of `WheelEvent`s with `deltaMode === 0` (pixels) and a long inertia tail. To use it as directional input for tile-slide / 2048 / Block Drop rotation, you must:

1. Listen for `wheel` on the canvas (not window — avoids hijacking page scroll).
2. Normalize the unit so a "tick" feels the same regardless of OS / browser / device.
3. Accumulate small deltas until a threshold is crossed, emit one tick, reset accumulator.
4. Apply a cooldown so the inertia tail can't fire 20 ticks for one swipe.
5. Distinguish "two-finger swipe" (one rapid burst) from "real scroll" (slow, sustained).

### deltaMode normalization

`WheelEvent.deltaMode` tells you the unit:
- `0` = `DOM_DELTA_PIXEL` — typical on macOS, modern Chrome, smooth scrolling (most common)
- `1` = `DOM_DELTA_LINE` — typical on Windows Firefox without smooth scrolling
- `2` = `DOM_DELTA_PAGE` — rare, full-page scroll wheels

Multiply to a common pixel-equivalent unit:

```ts
const PIXELS_PER_LINE = 16;   // matches default line-height
const PIXELS_PER_PAGE = 800;  // arbitrary but consistent

function normalizeWheelDelta(e: WheelEvent): { dx: number; dy: number } {
  let scale = 1;
  if (e.deltaMode === 1) scale = PIXELS_PER_LINE;
  else if (e.deltaMode === 2) scale = PIXELS_PER_PAGE;
  return { dx: e.deltaX * scale, dy: e.deltaY * scale };
}
```

### Tick accumulator with cooldown (sketch)

```ts
class WheelTicker {
  private accumX = 0;
  private accumY = 0;
  private lastTickTime = 0;

  // Pixels of accumulated delta required to register one tick.
  // 100 is approximately one "notch" on a traditional mouse wheel.
  private static readonly TICK_THRESHOLD = 100;

  // After firing a tick, ignore further deltas for this many ms.
  // Long enough to swallow inertia, short enough that a deliberate
  // second swipe still registers.
  private static readonly COOLDOWN_MS = 180;

  // If the accumulator hasn't budged for this long, reset it
  // (so a slow scroll never accidentally triggers a tick).
  private static readonly DECAY_MS = 250;
  private lastDeltaTime = 0;

  consume(e: WheelEvent): 'up' | 'down' | 'left' | 'right' | null {
    const now = performance.now();

    // Cooldown: still in the inertia tail of the last tick.
    if (now - this.lastTickTime < WheelTicker.COOLDOWN_MS) {
      this.accumX = 0;
      this.accumY = 0;
      return null;
    }

    // Decay: too much time since last delta — start over.
    if (now - this.lastDeltaTime > WheelTicker.DECAY_MS) {
      this.accumX = 0;
      this.accumY = 0;
    }
    this.lastDeltaTime = now;

    const { dx, dy } = normalizeWheelDelta(e);
    this.accumX += dx;
    this.accumY += dy;

    // Pick the dominant axis.
    if (Math.abs(this.accumY) >= WheelTicker.TICK_THRESHOLD &&
        Math.abs(this.accumY) > Math.abs(this.accumX)) {
      const dir = this.accumY > 0 ? 'down' : 'up';
      this.accumX = 0; this.accumY = 0;
      this.lastTickTime = now;
      return dir;
    }
    if (Math.abs(this.accumX) >= WheelTicker.TICK_THRESHOLD) {
      const dir = this.accumX > 0 ? 'right' : 'left';
      this.accumX = 0; this.accumY = 0;
      this.lastTickTime = now;
      return dir;
    }
    return null;
  }
}
```

### Distinguishing swipe from scroll

You generally cannot, **inside the canvas**, distinguish a deliberate "swipe gesture" from a slow scroll — they generate the same WheelEvents. The accumulator + cooldown approach handles this implicitly: slow scrolls decay before reaching threshold, fast swipes cross threshold immediately. There is no public API for "macOS gesture momentum"; some browsers expose `event.wheelDeltaY` (deprecated, non-standard) or non-standard `momentumPhase` on Safari, but neither is portable.

**Always** call `e.preventDefault()` on the wheel event when consuming it as game input, and **always** add the listener with `{ passive: false }` so preventDefault is honored. Failing to do this lets the page scroll under the canvas during gameplay.

**Do not** hijack wheel globally — only when the canvas has focus or pointer-is-over. Otherwise wheel-controlled games break menu scrolling.

---

## 5. Right-click / context menu suppression

The browser's context menu fires on `contextmenu` events, which can be triggered by right click, long-press on touch (Safari/iOS, some Android browsers), and the menu key on keyboards.

### Standard suppression

```ts
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
```

**Scope rule:** suppress only on the game canvas. Never suppress globally. Players need the context menu on the menu screen, score lists, settings page, etc.

### Right-click as secondary action

```ts
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 2) {
    // Right click — secondary action (e.g. flag in Minesweeper).
    handleSecondary(x, y);
    e.preventDefault();
  } else if (e.button === 0) {
    handlePrimary(x, y);
  }
  // button === 1 (middle) is ignored — let the browser handle paste etc.
});
```

When using Pointer Events (recommended), use `e.button === 2` and `e.pointerType === 'mouse'` to gate the secondary path. Touch and pen pointers should never produce a right-click — they use long-press instead.

### Accessibility fallback

Suppressing the context menu silently breaks players who use it for accessibility tools (screen reader inspection, "save image" for screenshotting a puzzle, browser extension shortcuts). Mitigations:

1. **Provide a keyboard equivalent** for every right-click action. In Minesweeper, the F key already toggles a flag — keep it.
2. **Provide a touch equivalent** (long-press) for every right-click action. Already standard.
3. **Provide an HUD button** for the secondary action when the game has fewer than ~3 secondary actions. A "Flag mode" toggle is ugly but accessible.
4. **Document it.** The help overlay (`?` key) lists every alternative.

Per WAI-ARIA: a canvas element is opaque to screen readers anyway, so the *primary* mitigation is having a fully keyboard-equivalent flow, not preserving the context menu.

---

## 6. Long-press timing and feedback

### Threshold

**400 ms** is the recommended hold duration. This matches:
- The current Minesweeper implementation (`LONG_PRESS_MS = 400`).
- iOS standard for "haptic touch" → context menu (~500 ms; we want slightly faster for game responsiveness).
- Android Material Design `longPressTimeout` default (500 ms; again, slightly faster for games).
- The lower bound where users feel the press was "intentional, not a mistap" (research from Nielsen Norman and Apple HIG converges on the 300–500 ms band).

Anything **below 250 ms** feels accidental and creates false positives. Anything **above 600 ms** feels sluggish and players give up. Stick with 400.

### Cancellation

The long-press timer must abort if **any** of the following happen before the threshold elapses:
1. Pointer moves more than **10 CSS px** from the down position (a deliberate drag, not a hold).
2. Pointer is released (a tap).
3. A second pointer starts (multi-touch — likely a pinch).
4. The game pauses or loses focus (`visibilitychange`, `blur`).

The 10 px slop matches the OS standard for "tap vs swipe" disambiguation on iOS and Android.

### Visual / haptic feedback

Players need to know the long-press is **about to fire**. Without feedback, every long-press feels like a 400 ms wait followed by a surprise.

**Recommended affordance:** at 100 ms after pointerdown (well under the threshold), start drawing a circular progress ring around the touched cell that fills over the remaining 300 ms. At threshold, fill completes, fire one `hapticMedium()` pulse, then call `handleSecondary()`. The ring gives the player both "I'm being heard" and "let go to cancel" without text.

**Code sketch:**

```ts
// In GameEngine — exposed to subclasses
protected longPress = {
  active: false,
  startTime: 0,
  startX: 0,
  startY: 0,
  ringProgress: 0, // 0..1
};

private static readonly LONG_PRESS_MS = 400;
private static readonly LONG_PRESS_RING_DELAY_MS = 100;
private static readonly LONG_PRESS_SLOP_PX = 10;

// Called from pointerdown
protected armLongPress(x: number, y: number): void {
  this.longPress.active = true;
  this.longPress.startTime = performance.now();
  this.longPress.startX = x;
  this.longPress.startY = y;
  this.longPress.ringProgress = 0;
}

// Called from pointermove
protected updateLongPress(x: number, y: number): void {
  if (!this.longPress.active) return;
  const dx = x - this.longPress.startX;
  const dy = y - this.longPress.startY;
  if (Math.hypot(dx, dy) > GameEngine.LONG_PRESS_SLOP_PX) {
    this.longPress.active = false;
  }
}

// Called from update(dt) — engine drives the ring
protected tickLongPress(): boolean {
  if (!this.longPress.active) return false;
  const elapsed = performance.now() - this.longPress.startTime;
  if (elapsed < GameEngine.LONG_PRESS_RING_DELAY_MS) return false;
  this.longPress.ringProgress = Math.min(
    1,
    (elapsed - GameEngine.LONG_PRESS_RING_DELAY_MS) /
      (GameEngine.LONG_PRESS_MS - GameEngine.LONG_PRESS_RING_DELAY_MS),
  );
  if (elapsed >= GameEngine.LONG_PRESS_MS) {
    this.longPress.active = false;
    this.haptic('medium');
    return true; // game should fire its secondary action this frame
  }
  return false;
}
```

Audio feedback at fire is optional but desirable — a soft "click" sound caps the gesture. Avoid haptics during the *fill* (only at the *fire*); a vibrating ring is annoying.

---

## 7. Keyboard navigation

### Tab order

Canvas is a single tab stop. Inside the canvas, the **arrow keys** drive a focus cursor that the game renders itself. There is no built-in "next focusable element inside a canvas" — every game must implement its own focus model.

**Engine convention:** the engine maintains a `focusCell: { row, col } | null` and games consult it. Default behavior:
- `Tab` from outside the canvas focuses the canvas and sets `focusCell` to (0, 0) or "center".
- `Shift+Tab` from inside the canvas blurs the canvas and moves focus to the next HTML element after it (the HUD pause button).
- Arrow keys move `focusCell` by 1 in the appropriate direction, clamped to the grid.

### Standard shortcuts (universal — see §1)

| Key | Action |
|---|---|
| `Space` / `Enter` | Primary (place / reveal / fire) |
| `Shift` (held during primary) | Secondary (flag / mark) |
| `F` | Toggle secondary mode (flag mode in Minesweeper) |
| `Arrow` / `WASD` | Move focus / direction |
| `P` / `Esc` (first press) | Pause |
| `Esc` (second press, when paused) | Quit to menu |
| `R` | Restart |
| `H` | Hint |
| `Z` / `Cmd+Z` / `Ctrl+Z` | Undo |
| `?` | Help overlay |
| `0..9` | Numeric input (Sudoku, Mastermind colors) |
| `A..Z` | Letter input (Wordle, Anagram) |

### Spatial navigation

For grid games (Sudoku, Minesweeper, Lights Out, Nonogram, Memory Match, Mastermind), arrow keys move a focus rectangle. Implement once in the engine as a helper:

```ts
protected moveFocus(
  rows: number,
  cols: number,
  key: string,
  wrap: boolean = false,
): void {
  if (!this.focusCell) { this.focusCell = { row: 0, col: 0 }; return; }
  let { row, col } = this.focusCell;
  switch (key) {
    case 'ArrowUp':    row--; break;
    case 'ArrowDown':  row++; break;
    case 'ArrowLeft':  col--; break;
    case 'ArrowRight': col++; break;
    default: return;
  }
  if (wrap) {
    row = (row + rows) % rows;
    col = (col + cols) % cols;
  } else {
    row = Math.max(0, Math.min(rows - 1, row));
    col = Math.max(0, Math.min(cols - 1, col));
  }
  this.focusCell = { row, col };
}
```

Wrap = true for tile-slide-style games (where wrapping is meaningful), wrap = false everywhere else.

### Avoid global key conflicts

Browsers reserve many keys: `Tab`, `Cmd/Ctrl+T`, `Cmd/Ctrl+W`, `Cmd/Ctrl+R` (page reload — collides with our `R` for restart **only when modifier held**, so unmodified `R` is safe), `F1..F12`, `Cmd/Ctrl+L`, etc. The engine should never call `preventDefault()` on a key with a Cmd/Ctrl modifier unless the game explicitly handles it.

`Backspace` outside a text input no longer triggers "back" in modern browsers (changed circa Chrome 52). Safe to use.

---

## 8. Per-genre conventions

### Match-3 (Gem Swap)

| Modality | Best |
|---|---|
| **Touch** | Drag-across (start on gem, release on adjacent gem) **or** tap-two |
| **Trackpad** | Click-drag (matches touch muscle memory). Tap-tap is the recommended fallback because trackpad drag requires holding the click — physically tiring. |
| **Mouse** | Click-drag is fine, mouse drag is effortless |
| **Keyboard** | Arrow keys move focus, Space picks up gem, arrow + Space (or Enter) commits swap with neighbor |

**Trackpad-specific guidance:** support tap-tap as the *primary* trackpad path because click-drag on trackpads is fatiguing. Drag works for users who know it. Confirm on the first successful action which the player used and remember the preference for that session (bias toward their style).

### Tile-slide (2048, Block Drop)

| Modality | Best |
|---|---|
| **Touch** | Swipe (already implemented in Twenty48) — 20 px minimum, dominant-axis wins |
| **Trackpad** | Wheel ticks (see §4) **and** arrow keys |
| **Mouse** | Arrow keys, optional click-drag swipe |
| **Keyboard** | Arrow keys (canonical) |

The engine should expose both `swipe` and `wheel-tick` as inputs and route both to `handleDirection(dir)`.

### Minesweeper

| Modality | Best |
|---|---|
| **Touch** | Tap = reveal, long-press = flag |
| **Mouse** | Left = reveal, right = flag |
| **Trackpad** | Click = reveal, two-finger click or Control+click = flag (both produce `contextmenu` / `button === 2`) |
| **Keyboard** | Arrows move focus, Space = reveal, F = flag |

Already implemented correctly. Keep the 400 ms long-press threshold.

### Word Search

| Modality | Best |
|---|---|
| **Touch** | Drag from first letter to last (visualize the line) |
| **Trackpad / mouse** | Click-drag (same as touch) **or** tap first letter, tap last letter |
| **Keyboard** | Arrow + Space to start selection, arrow to extend, Space to commit, Esc to cancel |

The drag-across is the standard idiom in every published Word Search app (Boggle, Word Stacks, etc.). Tap-tap is the accessibility fallback.

### Anagram (Spelling Bee style)

A radial picker (letters arranged in a circle/hexagon) is the canonical layout. Any letter can be tapped, sequences build a word, an Enter button submits.

| Modality | Best |
|---|---|
| **Touch** | Tap each letter, tap Submit (or shake-to-clear) |
| **Trackpad / mouse** | Click each letter |
| **Keyboard** | Type letters directly, Enter to submit, Backspace to delete one, Esc to clear |

Keyboard typing is **mandatory** — anagram games on desktop without typing support feel broken. The "letters available" set should be enforced (typing a letter not in the set is a no-op + error sound).

### Paddle (Breakout)

| Modality | Best |
|---|---|
| **Touch** | Drag finger (paddle X = touch X, optionally with offset). Snap-on-tap is jarring. |
| **Trackpad** | Pointer-follow (no click required) |
| **Mouse** | Pointer-follow |
| **Keyboard** | Left/right arrows (acceleration model — not snap-to-side) |

Pointer-follow on trackpad is the gold standard for paddle games — Mac users expect it. Block movement past the canvas edge with clamping.

---

## 9. Accessibility checklist

Aligns with WCAG 2.1 AA and the relevant 2.2 additions (target sizing). Every game ships passing all of these or it doesn't ship.

### Pointer

- [ ] **Target size ≥ 44×44 CSS px** for all interactive cells, buttons, and HUD controls. (WCAG 2.1 SC 2.5.5 AAA / 2.2 SC 2.5.8 AA minimum 24×24, but we adopt 44 — Apple HIG and Material both recommend it.)
- [ ] **Hit slop**: clickable cells extend their hit region a few px past their visual bounds for finger-tip accuracy.
- [ ] **No double-tap-to-zoom**: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`. (Already in place.)
- [ ] **Pointer events normalized** via `pointertype` so the game cannot accidentally treat a stylus differently from a finger.

### Keyboard

- [ ] Every game completable with keyboard only.
- [ ] No keyboard trap: pressing `Esc` always returns to a higher-level UI (pause → quit → menu).
- [ ] Tab order is logical: canvas → HUD pause → HUD restart → HUD hint.
- [ ] Visible focus indicator on the canvas (not the default ugly browser ring; draw a 3 px high-contrast border around the focused cell).

### Motion

- [ ] Respect `window.matchMedia('(prefers-reduced-motion: reduce)')`. Engine exposes `this.reducedMotion` boolean.
- [ ] When reduced motion is on: disable non-essential animations (cell pop-ins, particle effects, screen shake, idle floats), keep functional animations (move, match, win, game-over) but shorten to ≤150 ms.
- [ ] Never use motion as the *only* indicator of state — pair with color/shape/text.

### Visual

- [ ] Contrast ratio ≥ 4.5:1 for text, ≥ 3:1 for UI elements (WCAG 1.4.3).
- [ ] Color is never the sole indicator (Mastermind uses both color and shape; Sudoku uses both color and number).
- [ ] Focus indicator is high contrast against both light and dark cells.

### Audio

- [ ] All sounds optional (already supported via settings).
- [ ] No audio is required to complete a game.

### Other

- [ ] `prefers-color-scheme: dark` honored (or graceful warm-default).
- [ ] No autoplaying audio.
- [ ] Pause on `visibilitychange` (tab hidden) — already done in app shell.
- [ ] No blocking of system gestures (back-swipe on Android, edge-swipe on iOS) — limit canvas touchmove preventDefault to inside the canvas only.

---

## Recommended input-abstraction interface

This is what `GameEngine` should expose to subclasses **after** the input layer refactor. Each game implements only the abstract methods it needs.

```ts
// src/engine/input/InputTypes.ts

export type PointerKind = 'mouse' | 'touch' | 'pen';

export interface PointerInput {
  /** Canvas-local X in CSS pixels (already mapped from clientX). */
  x: number;
  /** Canvas-local Y in CSS pixels. */
  y: number;
  /** Underlying device. Games rarely need this — use sparingly. */
  kind: PointerKind;
  /** Mouse button: 0=primary, 2=secondary. Always 0 for touch/pen. */
  button: 0 | 2;
  /** True if shift is held — flags can be modeled as primary+shift. */
  shift: boolean;
  /** Monotonic ms timestamp from performance.now(). */
  time: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface InputCallbacks {
  // Discrete primary action — fired by tap, click, Space, Enter
  onPrimary?(p: PointerInput): void;

  // Discrete secondary action — fired by long-press, right click, Shift+primary
  onSecondary?(p: PointerInput): void;

  // Drag lifecycle — fired regardless of input modality
  onDragStart?(p: PointerInput): void;
  onDragMove?(p: PointerInput): void;
  onDragEnd?(p: PointerInput): void;
  onDragCancel?(p: PointerInput): void;

  // Pointer-follow mode — fires every move regardless of button state
  // Games must opt in via `engine.setHoverEnabled(true)` (default off so
  // tap-only games aren't spammed with hover events).
  onHover?(p: PointerInput): void;

  // Discrete direction — fired by arrows, swipe, wheel-tick
  onDirection?(dir: Direction, source: 'key' | 'swipe' | 'wheel'): void;

  // Spatial navigation — moves an internal focus cell on a grid
  // Engine handles the math; game just reads `engine.focusCell`.
  onFocusMove?(focus: { row: number; col: number }): void;

  // Universal bindings — engine routes these regardless of modality
  onPause?(): void;
  onResume?(): void;
  onRestart?(): void;
  onHint?(): void;
  onUndo?(): void;
  onBack?(): void;
  onHelp?(): void;

  // Free-form text input (Wordle, Anagram). Filtered to printable chars.
  onTextInput?(char: string): void;
  onBackspace?(): void;
  onSubmit?(): void; // Enter when text-input mode is active

  // Numeric input (Sudoku digit entry).
  onNumberInput?(digit: number): void;
}

// src/engine/input/InputManager.ts

export interface InputConfig {
  canvas: HTMLCanvasElement;
  callbacks: InputCallbacks;

  /** Whether to enable wheel-tick → onDirection routing. Default false. */
  enableWheelDirection?: boolean;

  /** Whether to enable swipe → onDirection routing. Default true on touch. */
  enableSwipeDirection?: boolean;

  /** Pixels of finger movement before a tap escalates to a drag. Default 10. */
  dragSlopPx?: number;

  /** Long-press hold duration in ms. Default 400. */
  longPressMs?: number;

  /** Whether `?` opens a help overlay. Default true. */
  enableHelpKey?: boolean;
}

export class InputManager {
  constructor(config: InputConfig);

  /** Wire up listeners. Idempotent. */
  attach(): void;

  /** Remove all listeners. Always called from GameEngine.destroy(). */
  detach(): void;

  /** Pointer-follow mode. Off = onHover never fires. */
  setHoverEnabled(enabled: boolean): void;

  /** Text input mode. When true, A-Z keys go to onTextInput instead of being
   *  ignored. When false (default), letters are silently dropped. */
  setTextInputEnabled(enabled: boolean): void;

  /** Numeric input mode. When true, 0-9 keys go to onNumberInput. */
  setNumericInputEnabled(enabled: boolean): void;

  /** Read-only current pointer state. */
  readonly pointer: { x: number; y: number; down: boolean; kind: PointerKind };

  /** Read-only current focus cell for grid games. Engine maintains this in
   *  response to arrow keys when focusGrid is set. */
  readonly focusCell: { row: number; col: number } | null;

  /** Tell the engine the game has a grid of this size — enables arrow-key
   *  spatial navigation through onFocusMove. Pass null to disable. */
  setFocusGrid(grid: { rows: number; cols: number; wrap?: boolean } | null): void;
}
```

### Migration plan (out of scope but worth noting)

1. Build `InputManager` alongside the existing `setupInput()` — don't replace yet.
2. Move all 16 games to override the new callbacks (`onPrimary`, `onDragStart`, etc.) instead of `handlePointerDown` etc. One game at a time, behind an `engine.useNewInput()` opt-in.
3. Once all games are migrated, delete the legacy `handlePointer*` and `handleKey*` methods.
4. Add tests in `tests/unit/input-manager.test.ts` covering: pointer normalization, long-press timing/cancellation, wheel ticking, key routing, focus grid math.

The legacy `handlePointerDown/Move/Up` methods can stay during migration — `InputManager` calls them as a fallback so games that haven't been ported still work.

---

## Sources / references

Standards-based recommendations drawn from:

- W3C Pointer Events Level 3 (Recommendation) — unified pointer model
- W3C UI Events — `WheelEvent`, `KeyboardEvent`, `MouseEvent`
- WCAG 2.1 SC 2.5.5 (Target Size, AAA — 44×44) and WCAG 2.2 SC 2.5.8 (Target Size Minimum, AA — 24×24)
- WCAG 2.1 SC 2.1.1 (Keyboard) and 2.1.2 (No Keyboard Trap)
- WCAG 2.3.3 / 2.3.1 (motion / animation), `prefers-reduced-motion` media query
- Apple Human Interface Guidelines — Touch, Pointer, Keyboard sections
- Google Material Design — Gestures, Long press, Touch targets
- MDN: `WheelEvent.deltaMode`, `PointerEvent`, `contextmenu`

(Web search was unavailable in this session; recommendations are based on these widely-published standards plus the existing patterns in `/Users/ny/Forge/ProPlay/src/engine/GameEngine.ts` and `/Users/ny/Forge/ProPlay/src/games/minesweeper/Minesweeper.ts`.)
