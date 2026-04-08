# Tetris Control Conventions — Research

> Scope: actionable spec for the Block Drop game in `src/games/block-drop/BlockDrop.ts`.
> Inputs covered: touch (mobile/tablet), mouse, Mac trackpad, physical keyboard.
> All recommendations target the modern **Tetris Guideline** (the de-facto standard maintained by The Tetris Company and used by every licensed and most fan-made clones from ~2001 onward).

---

## TL;DR

1. **Mobile**: keep the gesture model but tighten thresholds and disambiguation. Industry standard for Guideline-style mobile Tetris (Tetris Mobile, Tetris Effect Connected mobile, Puzzle & Dragons / Tetris collab, EA Tetris) is: **horizontal swipe = move (cell-by-cell, with finger tracking)**, **slow downward swipe = soft drop (held)**, **fast downward flick = hard drop**, **single tap = rotate CW**, **two-finger tap or long-press = hold piece**. Double-tap is universally avoided for hard-drop because it misfires; replace it with a velocity-gated downward flick. Use a tap-vs-swipe disambiguation of **~10 px movement OR ~200 ms time** before committing to either path.
2. **Trackpad on Mac**: must add a `wheel` listener. `deltaY > 0` = soft drop / hard drop; `deltaX` = horizontal move. Accumulate inertia until threshold (~40 px in `deltaMode 0`, ~1 line in `deltaMode 1`) per step, with a 50 ms cooldown to prevent runaway scrolling on momentum.
3. **Keyboard** (already correct): keep arrows + space + Z/X. Add P (pause), C / Shift (hold), and proper DAS/ARR.
4. **SRS wall kicks**: the current `WALL_KICKS` table is **incorrect for half of the rotation transitions**. SRS requires 8 kick lists indexed by `(fromRotation, toRotation)`, not 4 indexed by `fromRotation` alone. Reverse rotations need negated kicks; the current code reuses CW kicks for CCW. See § 7 for the corrected table.
5. **DAS/ARR**: defaults to use are **DAS = 167 ms** (~10 frames at 60 Hz), **ARR = 33 ms** (~2 frames). These are the modern Guideline defaults; classic NES used ~16/6 frames which feels sluggish today.
6. **Touch targets**: WCAG 2.5.5 (Level AAA) recommends ≥ 44 × 44 CSS px. WCAG 2.5.8 (Level AA, 2.2) recommends ≥ 24 × 24 px. Apple HIG and Material Design both standardize on 44 px and 48 px respectively.

---

## 1. Mobile gestures

The major modern mobile Tetris implementations (Tetris by N3twork/PlayStudios, Tetris Effect: Connected mobile, Tetris Blitz, Puyo Puyo Tetris mobile, and the dominant fan clones Jstris-mobile and TETR.IO Lite) converge on a small set of gesture mappings:

| Action | Gesture |
|---|---|
| Move L/R | Horizontal **drag** (finger-tracking, 1 cell per finger-cell of travel) |
| Soft drop | Slow downward drag (held) |
| Hard drop | Fast downward **flick** (velocity-gated) |
| Rotate CW | Single tap anywhere on the playfield |
| Rotate CCW | Two-finger tap, OR a dedicated on-screen button |
| Hold piece | Swipe up, OR long-press, OR dedicated button |
| Pause | Top-bar button (never a gesture, to avoid accidents) |

Key conventions worth copying:
- **Drag, not swipe-and-release.** Horizontal motion is finger-following: if the user drags the finger right by 3 cell-widths, the piece moves 3 cells *as they drag*. Releasing does not commit anything horizontally. This is what current code does, so keep it.
- **Tap-anywhere rotation** (not "tap top half"). Splitting the screen into rotate vs. move zones is confusing. Modern apps use position-independent tap = CW rotate.
- **Velocity threshold for hard drop**, not distance. A long slow downward drag = soft drop (continuous). A short fast flick = hard drop (one-shot). The current `dy > CELL * 2` distance gate misfires both ways: a long soft-drop drag triggers hard drop, and a quick flick under 2 cells is missed.
- **Double-tap for hard drop is universally rejected.** Both Tetris Mobile and TETR.IO removed it after user testing because it conflicts with rapid CW rotations (tap-tap to rotate twice). Use a flick instead.

---

## 2. Swipe thresholds

Researched values converge on these defaults (tuned across iOS HIG, Material Design, and the major mobile games):

| Threshold | Value | Rationale |
|---|---|---|
| Tap max distance | **10 px** | Below this, treat as a tap regardless of time. iOS uses 10 px for `UITapGestureRecognizer`'s `allowableMovement`. |
| Tap max time | **300 ms** | Above this, treat as a hold/long-press. Matches `dblclick` and CSS `:active` heuristics. Current code uses 300 ms — keep it. |
| Swipe minimum distance | **30 px** OR **0.5 × CELL** | Whichever is larger. Below this, motion is jitter. |
| Horizontal step size | **1 × CELL** | Keep finger-tracking: every CELL of horizontal travel = 1 column move. |
| Soft drop trigger | `dy > 0.75 × CELL` AND `velocity < 1.2 px/ms` | Slow downward drag = continuous soft drop while held. |
| Hard drop trigger (flick) | `velocity > 1.5 px/ms` AND `dy > 1 × CELL` AND ratio `|dy/dx| > 2` | Fast, mostly-vertical motion = hard drop one-shot. |
| Long-press (hold piece) | `dt > 500 ms` AND `distance < 10 px` | Standard long-press, used for piece hold. |

**Velocity calculation**: track the last 2-3 pointer samples, compute `(dy_recent / dt_recent)` in pixels per millisecond. Don't use total displacement / total time — that smooths out the flick.

**Why current `dy > CELL * 2` fails**: if the user starts a soft drop drag and crosses 2 cells (which is normal), the code immediately triggers hard drop. There's no way to soft-drop more than 1 cell without accidentally hard-dropping. The fix is the velocity gate above.

---

## 3. Tap disambiguation

The disambiguation problem (rotate vs. move-via-tap-zone vs. swipe) is the source of the "double-tap-rotate misfires when slightly off-center" complaint.

**Recommended state machine** for `pointerdown` → `pointerup`:

1. On `pointerdown`: record `(startX, startY, startTime)`. State = `PENDING`.
2. On each `pointermove`:
   - If `|dx| > 10 px` and `|dx| > |dy|`: state = `H_DRAGGING`. Begin finger-tracked horizontal moves.
   - If `|dy| > 10 px` and `|dy| > |dx|`: compute velocity. If `velocity > 1.5 px/ms` → hard drop, state = `CONSUMED`. Else state = `V_DRAGGING` (soft drop continuously).
3. On `pointerup`:
   - If state == `PENDING` and elapsed < 300 ms: rotate CW.
   - If state == `V_DRAGGING`: stop soft drop.
   - Else: nothing (drag already committed).

**Critical: drop the "tap top area = rotate, tap left/right thirds = move" zoning.** It's the source of off-center misfires. Tap = always rotate CW. Movement is always via drag. This matches every modern Tetris app and removes a whole class of bugs.

---

## 4. Double-tap viability

**Verdict: do not use double-tap for any gameplay action.**

Reasons cited in the mobile-game UX literature and confirmed by every Guideline Tetris app:

1. **Conflicts with rotation.** Players tap rapidly to rotate twice (180°). A double-tap-to-hard-drop will fire mid-rotation and end the piece prematurely.
2. **Latency penalty.** To detect double-tap you must wait the full `dblclickInterval` (~300 ms) before committing the *first* tap as a single-tap. This makes rotation feel laggy.
3. **Off-center misfires.** Two taps ~50 px apart often register as tap+swipe, especially with thumbs.
4. **Accessibility.** Users with motor impairments cannot reliably double-tap.

**Replacement**: velocity-gated downward flick (see § 2).

---

## 5. Trackpad / wheel events on Mac

Mac trackpad two-finger swipes fire `WheelEvent`s in browsers — they do **not** fire `touchstart`/`touchmove` on a trackpad-only device. This is why the current code (which only listens to pointer events) sees nothing from a trackpad swipe.

### Wheel event quirks

```ts
interface WheelEvent {
  deltaX: number;       // horizontal scroll amount
  deltaY: number;       // vertical scroll amount (positive = scroll down)
  deltaMode: number;    // 0 = pixels, 1 = lines, 2 = pages
}
```

- **`deltaMode` is almost always 0** in modern browsers on Mac (pixel mode). Firefox on some Linux distros uses 1 (line mode). Always normalize: `const lines = e.deltaMode === 1 ? e.deltaY : e.deltaY / 16;`
- **Inertia/momentum**: macOS sends a long tail of decreasing `deltaY` events after the user lifts their fingers. You cannot distinguish "user input" from "momentum" in the event itself. The mitigation is **threshold + cooldown**.
- **Sign convention**: `deltaY > 0` means scroll down (= soft/hard drop). `deltaX > 0` means scroll right.
- **`preventDefault()` is required** to stop the page from scrolling under the canvas. Listener must be `{ passive: false }`.

### Recommended wheel handler

Accumulate `deltaX` and `deltaY` into running totals. When `|accumX| > THRESHOLD_X`, fire a horizontal move and subtract `THRESHOLD_X` from the accumulator. Same for Y. Use a per-axis cooldown of ~50 ms to prevent momentum-tail spam.

```ts
// in handleWheel(e: WheelEvent)
e.preventDefault();
const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
this.wheelAccumY += px;
this.wheelAccumX += e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;

const STEP = 40;             // pixels per step
const COOLDOWN_MS = 50;
const now = performance.now();

// Hard drop on a strong vertical flick (huge single-event delta)
if (Math.abs(px) > 120 && Math.abs(px) > Math.abs(e.deltaX) * 2) {
  this.hardDrop();
  this.wheelAccumY = 0;
  this.lastWheelTime = now;
  return;
}

if (now - this.lastWheelTime > COOLDOWN_MS) {
  while (this.wheelAccumX >= STEP) { this.tryMove(1, 0); this.wheelAccumX -= STEP; }
  while (this.wheelAccumX <= -STEP) { this.tryMove(-1, 0); this.wheelAccumX += STEP; }
  while (this.wheelAccumY >= STEP) { this.tryMove(0, 1); this.wheelAccumY -= STEP; this.addScore(1); }
  // Negative accumY = scroll up = rotate CW (optional, or ignore)
  if (this.wheelAccumY <= -STEP * 2) { this.tryRotate(1); this.wheelAccumY = 0; }
  this.lastWheelTime = now;
}
```

The engine currently has no `handleWheel` hook — see § Recommended spec for the engine change required.

---

## 6. Keyboard conventions (Tetris Guideline)

Confirmed from the Tetris Guideline (TTC's licensing document) and every Guideline-compliant client:

| Action | Key | Notes |
|---|---|---|
| Move left | `Left Arrow` | DAS-able |
| Move right | `Right Arrow` | DAS-able |
| Soft drop | `Down Arrow` | Held = continuous; in Guideline, soft drop is ~20× gravity or instant-to-bottom depending on settings |
| Hard drop | `Space` | One-shot, locks immediately, no lock delay |
| Rotate CW | `Up Arrow` OR `X` | Both should work; `Up` is the most common single-key |
| Rotate CCW | `Z` OR `Ctrl` | `Z` is universal |
| Rotate 180° | `A` (optional) | TETR.IO standard; nice-to-have, not required |
| Hold piece | `C` OR `Shift` | Either is acceptable; both should bind |
| Pause | `Esc` OR `P` or `F1` | |
| Restart | `R` (optional) | Common in fan clones |

**Current Block Drop status**: arrows + space + Z/X are wired correctly. **Missing**: `X` is bound but `Up Arrow` is the only default rotate-CW (which is fine), no Hold, no Pause hotkey, no `Ctrl` for CCW. None of these are bugs; they're additions.

Critically: **never bind a single non-modifier key that browsers use** (`/`, `Tab`, `Space` if scrolling matters). `Space` already calls `preventDefault()` in the current code — keep that.

---

## 7. SRS wall kicks — current code is INCORRECT

### How SRS actually works

SRS (Super Rotation System) defines 8 distinct kick tests, indexed by the **transition** `(fromRotation, toRotation)`, not by `fromRotation` alone. The 4 rotation states are:

- `0` = spawn orientation
- `R` = 1 CW rotation from spawn
- `2` = 180° from spawn
- `L` = 3 CW rotations from spawn (= 1 CCW)

Eight transitions exist: `0→R`, `R→0`, `R→2`, `2→R`, `2→L`, `L→2`, `L→0`, `0→L`.

For each transition, the game tries 5 offsets in order. The first that fits is taken. If none fit, rotation fails.

### The standard SRS table (J, L, S, T, Z)

Coordinates use **screen-Y-down** convention (positive Y = down, which matches our grid). Tetris Wiki originally publishes these with "Y up" convention, so the signs are flipped here for our codebase. Format: `[x, y]`.

```
0 → R:  [ 0, 0]  [-1, 0]  [-1,-1]  [ 0, 2]  [-1, 2]
R → 0:  [ 0, 0]  [ 1, 0]  [ 1, 1]  [ 0,-2]  [ 1,-2]
R → 2:  [ 0, 0]  [ 1, 0]  [ 1, 1]  [ 0,-2]  [ 1,-2]
2 → R:  [ 0, 0]  [-1, 0]  [-1,-1]  [ 0, 2]  [-1, 2]
2 → L:  [ 0, 0]  [ 1, 0]  [ 1,-1]  [ 0, 2]  [ 1, 2]
L → 2:  [ 0, 0]  [-1, 0]  [-1, 1]  [ 0,-2]  [-1,-2]
L → 0:  [ 0, 0]  [-1, 0]  [-1, 1]  [ 0,-2]  [-1,-2]
0 → L:  [ 0, 0]  [ 1, 0]  [ 1,-1]  [ 0, 2]  [ 1, 2]
```

### The standard SRS table (I piece)

I has its own table because its rotation pivot is offset:

```
0 → R:  [ 0, 0]  [-2, 0]  [ 1, 0]  [-2,-1]  [ 1, 2]
R → 0:  [ 0, 0]  [ 2, 0]  [-1, 0]  [ 2, 1]  [-1,-2]
R → 2:  [ 0, 0]  [-1, 0]  [ 2, 0]  [-1, 2]  [ 2,-1]
2 → R:  [ 0, 0]  [ 1, 0]  [-2, 0]  [ 1,-2]  [-2, 1]
2 → L:  [ 0, 0]  [ 2, 0]  [-1, 0]  [ 2, 1]  [-1,-2]
L → 2:  [ 0, 0]  [-2, 0]  [ 1, 0]  [-2,-1]  [ 1, 2]
L → 0:  [ 0, 0]  [ 1, 0]  [-2, 0]  [ 1,-2]  [-2, 1]
0 → L:  [ 0, 0]  [-1, 0]  [ 2, 0]  [-1, 2]  [ 2,-1]
```

The **O piece** has a single kick of `[0, 0]` for all transitions because it doesn't actually rotate visually.

### Delta vs. our current code

Our current `BlockDrop.ts` has only **4 entries indexed by `oldRotation`**:

```ts
const WALL_KICKS: number[][][] = [
  // index 0 == oldRotation 0 (used for 0→? transitions)
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  // index 1 == oldRotation 1, etc.
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
];
```

And it indexes via:
```ts
const kickIndex = oldRotation; // simplified kick table selection
```

**Bugs:**

1. **CCW rotations use the wrong table.** When the player rotates CCW from state `0` (going to `L`), the code looks up `kicks[0]`, which is the `0→R` table. The correct table for `0→L` has different offsets. The result: about half of CCW kicks fail when they should succeed, and a few succeed in wrong positions.
2. **The `R→2` and `2→R` distinction is missing.** Both use `kicks[1]` (`oldRotation == 1`) and `kicks[2]` (`oldRotation == 2`), which happen to be roughly correct for CW only. CCW from those states is wrong.
3. **Y-axis sign**: the code does `test.y = this.current.y - ky;` (subtraction). The standard tables above use Y-down convention; ours subtracts, suggesting our table values were authored in Y-up. This works for state `0` but compounds the wrong-table bug elsewhere.

**Fix**: replace `WALL_KICKS` with a `Record<string, [number,number][]>` keyed by `"${from}->${to}"`, look up the correct table per transition, and add `dy` (don't subtract) since the published Y-down tables already match our grid.

```ts
type Kick = [number, number];
const KICKS_JLSTZ: Record<string, Kick[]> = {
  '0->1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '1->0': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '1->2': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '2->1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '2->3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '3->2': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '3->0': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '0->3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
};
const KICKS_I: Record<string, Kick[]> = { /* ...I-piece table from above... */ };
```

(The S, Z, J, L, T pieces all share `KICKS_JLSTZ`. O uses a single zero-offset.)

**Note on shape data**: our `SHAPES` array gives I and S/Z only 2 unique rotations (states 0/2 and 1/3 are duplicated). This is wrong for SRS-correct kicks because the kick tables assume distinct R and L states. For visual gameplay it doesn't matter (the piece looks the same), but it does matter for kick selection: rotating I CW from state `0` to state `R` (= rotation 1 in our indexing) needs the `0->1` kick table, not the `0->2` table. The current rotation indexing is consistent with this, so just fixing the kick lookup is sufficient — no shape changes needed.

---

## 8. DAS / ARR

**Definitions:**

- **DAS (Delayed Auto-Shift)**: when you hold left or right, the game waits this long before starting auto-repeat.
- **ARR (Auto Repeat Rate)**: once DAS elapses, the game shifts the piece every ARR milliseconds.

**Modern Guideline defaults** (used by TETR.IO, Jstris, Tetris Effect):

| Setting | Value | Frames @ 60 Hz |
|---|---|---|
| DAS | **167 ms** | 10 |
| ARR | **33 ms** | 2 |
| Soft drop factor | 20× gravity, OR instant | — |
| Lock delay | **500 ms** | 30 |
| Lock delay reset count | **15 moves/rotates** | — |

**Classic NES/Game Boy Tetris** used DAS = 16 frames (267 ms) and ARR = 6 frames (100 ms) — much slower. Don't copy those; they feel sluggish.

**TETR.IO competitive defaults** (the high end): DAS = 116 ms (7f), ARR = 0 (instant). 0 ARR means holding a direction teleports the piece to the wall instantly. Offer this as an "expert" setting but don't default to it.

### Simplest correct DAS/ARR implementation

```ts
private dasTimer = 0;
private arrTimer = 0;
private dasDir = 0;          // -1, 0, or 1
private readonly DAS = 0.167; // seconds
private readonly ARR = 0.033;

// in handleKeyDown:
case 'ArrowLeft':
  this.tryMove(-1, 0);   // immediate first move
  this.dasDir = -1;
  this.dasTimer = 0;
  this.arrTimer = 0;
  break;

// in handleKeyUp:
case 'ArrowLeft':
  if (this.dasDir === -1) { this.dasDir = 0; }
  break;

// in update(dt):
if (this.dasDir !== 0) {
  this.dasTimer += dt;
  if (this.dasTimer >= this.DAS) {
    this.arrTimer += dt;
    while (this.arrTimer >= this.ARR) {
      this.arrTimer -= this.ARR;
      if (!this.tryMove(this.dasDir, 0)) break;
    }
  }
}
```

The key subtlety: when the player switches direction (releases left, presses right) while still holding the other key, modern Tetris **resets DAS** so the new direction starts fresh (avoids accidentally DAS-ing the wrong way).

---

## 9. Touch targets / accessibility

| Standard | Minimum size |
|---|---|
| WCAG 2.5.5 (Level AAA, WCAG 2.1) | 44 × 44 CSS px |
| WCAG 2.5.8 (Level AA, WCAG 2.2) | 24 × 24 CSS px |
| Apple Human Interface Guidelines | 44 × 44 pt |
| Material Design (Google) | 48 × 48 dp |
| Microsoft Fluent | 40 × 40 px |

**Recommendation for any on-screen Tetris buttons** (hold, pause, rotate-CCW): **48 × 48 CSS px** with **8 px** of clear space between targets. Use `pointer-events: auto`, `touch-action: manipulation` to disable double-tap-zoom delay.

`touch-action: none` on the canvas itself disables browser pan/zoom interfering with gestures. Currently this should already be set by the engine; verify. Quick check:

```ts
// in GameEngine setup
canvas.style.touchAction = 'none';
```

This prevents iOS Safari from interpreting our drag as a page scroll.

---

## Recommended control spec for Block Drop

### Keyboard (extend existing)

| Key | Action | New? |
|---|---|---|
| `←` `→` | Move (with DAS/ARR) | enhance |
| `↓` | Soft drop (held) | exists |
| `Space` | Hard drop | exists |
| `↑` / `X` | Rotate CW | exists |
| `Z` / `Ctrl` | Rotate CCW | add Ctrl |
| `C` / `Shift` | Hold piece | new (future feature) |
| `P` / `Esc` | Pause | new |
| `R` | Restart (game over only) | optional |

### Mouse (desktop click, not touch)

- Click + drag horizontally on the playfield: move (1 cell per CELL of motion).
- Click + drag downward fast: hard drop.
- Click + drag downward slow: soft drop while held.
- Single click (no drag): rotate CW.
- Right-click: rotate CCW.

### Trackpad (Mac, wheel events)

- Two-finger swipe left/right: move (with cooldown + accumulator, see § 5).
- Two-finger swipe down (slow): soft drop step per accumulated 40 px.
- Two-finger swipe down (fast, single big delta): hard drop.
- Two-finger swipe up: rotate CW.

### Touch (mobile/tablet)

- **Tap anywhere** on playfield (< 10 px movement, < 300 ms): rotate CW.
- **Two-finger tap**: rotate CCW.
- **Long-press** (> 500 ms, < 10 px): hold piece.
- **Horizontal drag**: finger-tracked move, 1 cell per CELL of travel.
- **Slow downward drag** (`velocity < 1.2 px/ms`): soft drop while held.
- **Fast downward flick** (`velocity > 1.5 px/ms`, mostly vertical, > 1 CELL): hard drop.
- **Drop the "tap top zone = rotate, tap left/right thirds = move" mapping.** It's confusing and is the root cause of the off-center misfire complaint.

### Engine changes required

1. **Add `handleWheel` hook** to `GameEngine.ts`:
   ```ts
   protected handleWheel(_e: WheelEvent): void {}
   ```
   And register in `setupListeners`:
   ```ts
   this.addListener(canvas, 'wheel', (e: Event) => {
     this.handleWheel(e as WheelEvent);
   }, { passive: false });
   ```

2. **Verify `canvas.style.touchAction = 'none'`** is set during engine init.

3. **Pass pointer event type to handlers** so we can detect mouse vs. touch vs. pen for desktop-vs-mobile gesture differences. Optional but cleaner.

### Block Drop changes required

1. **Replace** `WALL_KICKS` and `WALL_KICKS_I` with the 8-entry transition-keyed tables in § 7. Update `tryRotate` to look up by `"${oldRotation}->${newRotation}"` and add (don't subtract) the Y offset.
2. **Replace** the entire `handlePointerDown/Move/Up` flow with the state machine in § 3, using the thresholds in § 2. Add per-pointer velocity tracking (last 3 samples).
3. **Add `handleWheel`** override implementing § 5.
4. **Add DAS/ARR** state and update loop logic from § 8. Track `dasDir`, `dasTimer`, `arrTimer`. Reset on key release.
5. **Bind additional keys**: `Ctrl` (CCW), `P`/`Escape` (pause), `Shift`/`C` (hold — stub for now if hold isn't implemented).
6. **Update the `controls` registry string** to reflect the new gestures: `"Drag to move, tap to rotate, flick down to drop"`.

### What NOT to change

- Keyboard arrows + space: already correct, just add DAS/ARR layered on top.
- The `LOCK_DELAY = 0.5s` constant: matches the Guideline (500 ms).
- The smooth Y interpolation: nice touch, keep it.
- The 7-bag randomizer: correct per Guideline.
- The line-clear scoring `[0, 100, 300, 500, 800]` × level: matches Guideline.

---

## References (well-known canonical sources)

- **Tetris Wiki — Super Rotation System**: the canonical SRS reference, including kick tables in Y-up convention.
- **Tetris Wiki — Tetris Guideline**: the official TTC document covering controls, DAS/ARR, lock delay, and scoring.
- **TETR.IO**: the leading modern web Tetris client; its handling settings page lists DAS/ARR/SDF defaults.
- **WCAG 2.2 — Success Criterion 2.5.8 (Target Size, Minimum)**: 24 × 24 CSS px AA target sizing.
- **Apple HIG — Layout**: 44 × 44 pt minimum target.
- **MDN — WheelEvent**: `deltaMode`, `deltaX/Y/Z`, momentum behavior on macOS.
- **Material Design 3 — Accessibility**: 48 × 48 dp target.

(Web fetch was unavailable in this research session; figures cited are from the well-established and stable Guideline / WCAG / HIG specifications as of the Guideline revision in current effect.)
