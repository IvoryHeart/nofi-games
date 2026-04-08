# Block Drop Tetris Rework — Review

## Summary

The rework is **substantially correct and faithful to the research spec**. All 8
SRS kick transitions for JLSTZ and I are entered verbatim from
`docs/research/tetris-controls.md` § 7, the Y-down convention is honoured (`+=
ky`, not `-=`), DAS/ARR timings (0.167 / 0.033 s) and the wheel handler
(deltaMode normalization, 40 px step, 300 px hard-drop, 180 ms cooldown) all
match the spec. The tap-vs-velocity-flick gesture model is implemented and a
wheel listener is attached/detached cleanly. All 14 new tests in `BlockDrop –
modern control scheme` pass (`30 passed | 63 skipped` when filtered to
BlockDrop).

Minor divergences exist (axis-dominance ratio uses 1.5 instead of the research's
2.0, tap-jitter threshold is 4 px instead of 10 px, soft-drop pass does not
check that a hard-drop has already fired this drag, cooldown is 180 ms vs.
research's 50 ms). Several tests are shallow — they assert `typeof x === 'boolean'`
or accept either-outcome branches, so they exercise the code paths but don't
actually pin down the correct behaviour.

No production bugs found. No changes made to production files.

---

## 1. SRS wall kicks (entry-by-entry verification)

Checked against `docs/research/tetris-controls.md` § 7. Tables are in Y-down
convention per the spec comment on lines 82–85 of `BlockDrop.ts`.

### KICKS_JLSTZ (lines 88–97)

| Transition | Spec (§7)                                   | Code                                        | Match |
|---         |---                                          |---                                          |---    |
| 0 → 1 (R)  | `[0,0] [-1,0] [-1,-1] [0,2] [-1,2]`         | `[0,0] [-1,0] [-1,-1] [0,2] [-1,2]`         | yes   |
| 1 → 0      | `[0,0] [1,0] [1,1] [0,-2] [1,-2]`           | `[0,0] [1,0] [1,1] [0,-2] [1,-2]`           | yes   |
| 1 → 2      | `[0,0] [1,0] [1,1] [0,-2] [1,-2]`           | `[0,0] [1,0] [1,1] [0,-2] [1,-2]`           | yes   |
| 2 → 1      | `[0,0] [-1,0] [-1,-1] [0,2] [-1,2]`         | `[0,0] [-1,0] [-1,-1] [0,2] [-1,2]`         | yes   |
| 2 → 3 (L)  | `[0,0] [1,0] [1,-1] [0,2] [1,2]`            | `[0,0] [1,0] [1,-1] [0,2] [1,2]`            | yes   |
| 3 → 2      | `[0,0] [-1,0] [-1,1] [0,-2] [-1,-2]`        | `[0,0] [-1,0] [-1,1] [0,-2] [-1,-2]`        | yes   |
| 3 → 0      | `[0,0] [-1,0] [-1,1] [0,-2] [-1,-2]`        | `[0,0] [-1,0] [-1,1] [0,-2] [-1,-2]`        | yes   |
| 0 → 3      | `[0,0] [1,0] [1,-1] [0,2] [1,2]`            | `[0,0] [1,0] [1,-1] [0,2] [1,2]`            | yes   |

8 / 8 exact matches.

### KICKS_I (lines 99–108)

| Transition | Spec (§7)                                   | Code                                        | Match |
|---         |---                                          |---                                          |---    |
| 0 → 1      | `[0,0] [-2,0] [1,0] [-2,-1] [1,2]`          | `[0,0] [-2,0] [1,0] [-2,-1] [1,2]`          | yes   |
| 1 → 0      | `[0,0] [2,0] [-1,0] [2,1] [-1,-2]`          | `[0,0] [2,0] [-1,0] [2,1] [-1,-2]`          | yes   |
| 1 → 2      | `[0,0] [-1,0] [2,0] [-1,2] [2,-1]`          | `[0,0] [-1,0] [2,0] [-1,2] [2,-1]`          | yes   |
| 2 → 1      | `[0,0] [1,0] [-2,0] [1,-2] [-2,1]`          | `[0,0] [1,0] [-2,0] [1,-2] [-2,1]`          | yes   |
| 2 → 3      | `[0,0] [2,0] [-1,0] [2,1] [-1,-2]`          | `[0,0] [2,0] [-1,0] [2,1] [-1,-2]`          | yes   |
| 3 → 2      | `[0,0] [-2,0] [1,0] [-2,-1] [1,2]`          | `[0,0] [-2,0] [1,0] [-2,-1] [1,2]`          | yes   |
| 3 → 0      | `[0,0] [1,0] [-2,0] [1,-2] [-2,1]`          | `[0,0] [1,0] [-2,0] [1,-2] [-2,1]`          | yes   |
| 0 → 3      | `[0,0] [-1,0] [2,0] [-1,2] [2,-1]`          | `[0,0] [-1,0] [2,0] [-1,2] [2,-1]`          | yes   |

8 / 8 exact matches. The JLSTZ and I tables are distinct, as required.

### O piece

`KICKS_O = [[0, 0]]` (line 110) and `tryRotate` early-returns for `type === 1`
(O) before the kick lookup (lines 356–359). `KICKS_O` is declared but never
read — dead constant, harmless.

### Y-axis convention

`tryRotate` line 374: `test.y = this.current.y + ky;` — **adds** `ky`. Matches the
Y-down spec in the research doc and the inline comment on lines 372–373.

### Rotation indexing

The code uses rotation 0/1/2/3 = SRS 0/R/2/L (see comment on lines 361–362).
The 8 keys are correctly built as `"${oldRotation}->${newRotation}"`.
`newRotation = (oldRotation + dir + 4) % 4` handles CCW by adding `-1`, then
`+4` wraps, so `0` CCW → `3`, exercising the `'0->3'` entry correctly.

**Verdict: SRS tables are correct in every entry. The old 4-entry bug is
genuinely fixed.**

---

## 2. Velocity-gated hard drop

`handlePointerMove` lines 1105–1114:

```ts
const { vx, vy } = this.pointerVelocity();
const verticalDominant = Math.abs(dyTotal) > Math.abs(dxTotal) * 1.5;
if (vy > 1.5 && dyTotal > CELL && verticalDominant) {
  this.hardDrop();
  this.swipeHandled = true;
  ...
}
```

- **Velocity threshold (`vy > 1.5` px/ms)**: matches research § 2 exactly.
- **Total-Y threshold (`dyTotal > CELL`)**: matches research (`dy > 1 × CELL`).
- **Axis dominance**: code uses `|dy| > |dx| * 1.5`, research specifies
  `|dy/dx| > 2`. **Minor divergence** — the code is slightly more permissive
  (easier to trigger hard drop on a near-diagonal flick). Not a bug, but
  off-spec.
- **`swipeHandled` gate**: once hard-drop fires, `handlePointerMove` early-returns
  on subsequent moves (line 1088). Good — prevents the soft-drop branch from
  also running in the same drag.
- **Velocity sampling**: `pointerVelocity()` uses the oldest-to-newest of up to
  3 samples, not a single-step derivative. Research says "last 2–3 samples,
  recent". Acceptable approximation; on a fast flick the 3-sample window still
  captures peak velocity because `pointermove` fires many times per second.

**Slow vertical drag → soft drop (no hard drop)**: the test on lines 1153–1169
seeds samples with a slow 30 px drag over ~300 ms (~0.1 px/ms). Since
`vy < 1.5`, the hard-drop branch is skipped. The soft-drop branch
`dyTotal > CELL * 0.5 && vy > 0 && vy <= 1.5` at line 1133 may fire exactly
once per move call (single `tryMove(0, 1)`). The piece moves at most a few
rows, well below the whole-board hard-drop.

**Verdict: correct. Minor divergence on axis-dominance ratio (1.5 vs 2.0).**

---

## 3. Tap-to-rotate

`handlePointerUp` lines 1151–1165:

```ts
if (!this.touchMoved && elapsed < 300) {
  this.tryRotate(1);
}
```

- **No zoning**: the rotate call is triggered purely by the tap-vs-move /
  elapsed-time predicate. There is no left/right/top-third zoning anywhere in
  the file (confirmed by a full scan of `handlePointerDown/Move/Up`). The
  entire playfield is a rotate target when the gesture qualifies as a tap.
- **Tap threshold**: 300 ms matches research § 2.
- **Touch-moved jitter**: `handlePointerMove` sets `touchMoved = true` once
  `|dx| > 4 || |dy| > 4`. Research recommends 10 px. The code is stricter
  (fewer false taps), not a bug.
- **Double-tap**: not implemented. A second tap simply calls `tryRotate(1)`
  again. There is no `dblclickInterval` wait, no second-tap-hard-drop path.
  Matches research § 4 ("never use double-tap").

**Verdict: correct. Whole playfield rotates on tap, no zoning, no double-tap.**

---

## 4. DAS/ARR

Constants on lines 174–175:

```ts
private readonly DAS = 0.167;  // 167 ms
private readonly ARR = 0.033;  // 33 ms
```

Matches the modern Guideline defaults in research § 8 exactly (10 frames / 2
frames at 60 Hz).

### Key-down behaviour (lines 991–1007)

```ts
case 'ArrowLeft':
  this.tryMove(-1, 0);   // immediate first move
  this.dasDir = -1;
  this.dasTimer = 0;
  this.arrTimer = 0;
  break;
```

One immediate move, then DAS timer starts fresh. Matches research pseudocode.

### Switching direction resets DAS

If the user presses `ArrowRight` while `dasDir === -1`, the code
unconditionally sets `dasDir = 1; dasTimer = 0; arrTimer = 0`. **This correctly
resets DAS on direction switch**, matching research § 8 ("when the player
switches direction… modern Tetris resets DAS").

### Key-up behaviour (lines 1043–1057)

```ts
if (key === 'ArrowLeft' && this.dasDir === -1) {
  this.dasDir = 0;
  this.dasTimer = 0;
  this.arrTimer = 0;
}
```

The `&& this.dasDir === -1` guard is important: if the player is pressing
Left, then presses Right (which sets dasDir=1), then releases Left, we should
NOT clear dasDir because Right is still held. The guard handles this correctly.

### Update loop (lines 506–516)

```ts
if (this.dasDir !== 0) {
  this.dasTimer += dt;
  if (this.dasTimer >= this.DAS) {
    this.arrTimer += dt;
    let guard = 20;
    while (this.arrTimer >= this.ARR && guard-- > 0) {
      this.arrTimer -= this.ARR;
      if (!this.tryMove(this.dasDir, 0)) break;
    }
  }
}
```

- Increments DAS timer each frame until `DAS` is reached.
- After DAS elapses, accumulates ARR timer and shifts repeatedly until caught up.
- **Per-frame guard of 20 shifts**: protects against a huge `dt` in hitched
  frames or tests. Sensible.
- **Breaks out on tryMove failure**: the piece stops at the wall. Matches the
  research snippet.

**Verdict: DAS/ARR is implemented correctly, including the direction-switch
reset and the key-release guard. One small omission: there is no explicit test
that pressing Left→Right mid-hold resets `dasTimer` to 0 — the existing DAS
test only presses Right.**

---

## 5. Wheel handler

`handleWheel` lines 1171–1212.

| Spec (§5)                                       | Code                                           | Match |
|---                                              |---                                             |---    |
| `preventDefault()` required (`passive: false`)  | `if (typeof e.preventDefault === 'function')`  | yes   |
| `deltaMode` 0/1/2 → px normalization            | `mode 1 → ×16`, `mode 2 → ×400`                | yes   |
| Accumulate deltaY                               | `this.wheelAccumY += px`                       | yes   |
| Soft-drop step threshold 40 px                  | `STEP = 40`                                    | yes   |
| Hard-drop single-event threshold                | `HARD_DROP_THRESHOLD = 300`                    | yes (research suggested 120; 300 is stricter) |
| Cooldown 50 ms                                  | `COOLDOWN_MS = 180`                            | **divergent**: 180 ms (stricter than spec's 50 ms) |
| Horizontal accumulator for deltaX               | **absent** — deltaX is only read in dominance check | **divergent** — spec mentioned it but Block Drop intentionally doesn't move horizontally via wheel |
| Cleanup in `destroy()`                          | `this.canvas.removeEventListener('wheel', ...)` in `destroy()` | yes   |

### Cooldown behaviour

Lines 1186–1194 (hard drop path):
```ts
if (Math.abs(px) >= HARD_DROP_THRESHOLD && Math.abs(px) > Math.abs(e.deltaX) * 2) {
  if (now - this.lastWheelTriggerTime >= COOLDOWN_MS) {
    this.hardDrop();
    this.lastWheelTriggerTime = now;
    this.wheelAccumY = 0;
  }
  return;
}
```

Lines 1198–1208 (soft drop path):
```ts
while (this.wheelAccumY >= STEP && guard-- > 0) {
  if (now - this.lastWheelTriggerTime < COOLDOWN_MS) break;
  if (this.tryMove(0, 1)) { ... }
  this.wheelAccumY -= STEP;
  this.lastWheelTriggerTime = now;
}
```

Both paths gate on 180 ms cooldown. The soft-drop path's `lastWheelTriggerTime`
update inside the loop means a single big wheel event can only trigger one
`tryMove` per 180 ms window (subsequent loop iterations `break`). That's more
conservative than the spec's 50 ms — macOS inertia is heavily suppressed, at
the cost of slow sustained scrolls moving the piece slower than the user
expects.

### Negative accumulator (oscillating scroll)

Line 1210–1211:
```ts
if (this.wheelAccumY < -STEP) this.wheelAccumY = -STEP;
```

A scroll-up event decrements `wheelAccumY`. The clamp prevents momentum
oscillation from building up a huge negative backlog that would then take many
events to cancel out. Correct.

However, there is **no handling for a scroll-up to do anything** (research §5
suggested "optional: scroll up = rotate"). The code quietly ignores scroll-up
events. That's a valid design choice — scroll-up just doesn't do anything in
Block Drop.

### Cleanup

`init()` lines 264–267 attach the listener only if `wheelHandler === null` (idempotent).
`destroy()` lines 270–276 remove the listener and null it out. Test on line 1273
verifies both states. Good.

**Verdict: wheel handler works correctly. Cooldown is intentionally stricter
than research (180 vs 50 ms). Horizontal wheel movement is not implemented —
this is a conscious omission, not a bug.**

---

## 6. Keybindings

`handleKeyDown` lines 980–1041. Checked against research § 6 and the review
checklist:

| Key          | Action                  | Status |
|---           |---                      |---     |
| `ArrowLeft`  | move left + DAS start   | yes    |
| `ArrowRight` | move right + DAS start  | yes    |
| `ArrowDown`  | soft drop               | yes    |
| `ArrowUp`    | rotate CW               | yes    |
| `Space`      | hard drop               | yes    |
| `z` / `Z`    | rotate CCW              | yes    |
| `Control`    | rotate CCW              | yes    |
| `x` / `X`    | rotate CW               | yes    |
| `c` / `C`    | reserved (no-op)        | yes    |
| `Shift`      | reserved (no-op)        | yes    |
| `p` / `P`    | toggle pause            | yes    |
| `Escape`     | toggle pause            | yes    |

The pause keys are handled **before** the `isOver || clearTimer > 0` early
return (lines 983–987), so pause works during clear animation and after game
over — matches the inline comment.

**Minor issue**: `z`, `Z`, `Control`, `x`, `X`, `c`, `C`, `Shift` do not call
`e.preventDefault()`. `Control` specifically is harmless (browsers don't bind
lone Ctrl), but if Shift or Z is ever used as a modifier in some future
browser hotkey, there could be a conflict. Not a bug today.

The `controls` string on line 1227 still reads `"Arrows/Touch to move, Up/Tap
to rotate, Space to drop"` — research § "Block Drop changes required" bullet 6
suggested updating it to `"Drag to move, tap to rotate, flick down to drop"`.
**Minor divergence**: the UI string wasn't updated.

**Verdict: all required keys bound. Minor: no preventDefault on Z/X/Ctrl/C/Shift;
controls display string not updated.**

---

## 7. Determinism / RNG

`Grep 'Math\.random'` on `BlockDrop.ts` returns **zero matches**. Every random
call uses `this.rng()`:

- Line 220: `this.rng()` for garbage-row gap column
- Line 224: `this.rng()` for garbage-row colour
- Line 283: `this.rng()` for bag shuffle

`GameEngine` line 107: `this.rng = config.seed != null ? mulberry32(config.seed) : Math.random;`

So Block Drop is **fully deterministic when seeded** and falls back gracefully
when unseeded.

**Verdict: RNG migration complete. No leftover `Math.random` calls.**

---

## 8. Test coverage

All 14 tests in the `BlockDrop – modern control scheme` describe block pass
(verified with `npx vitest run tests/integration/game-logic-1.test.ts -t
"BlockDrop"` → `30 passed | 63 skipped`).

### Tests that are solid

- **`tap without drag rotates CW`** (line 1139): correctly simulates a tap
  (no pointerMove), verifies rotation advanced by 1.
- **`a slow short downward drag does NOT trigger a hard drop`** (line 1153):
  seeds explicit slow samples, asserts `y - startY < 20`.
- **`handleWheel with large single deltaY triggers hard drop`** (line 1190):
  fires 500 px delta and asserts the cooldown timer was set.
- **`handleWheel respects the cooldown between triggers`** (line 1202):
  fires two 500 px events back-to-back, asserts the second is gated.
- **`handleWheel normalizes deltaMode=1 (line) to pixels`** (line 1216): fires
  `deltaY=3, mode=1`, asserts accum is `< 48` (i.e., a trigger fired).
- **`P / Escape toggle pause`** (lines 1226, 1235): direct and clear.
- **`DAS timer advances while held`** (line 1252): fires key, ticks update,
  asserts `dasTimer >= DAS`.
- **`releasing cleared dasDir`** (line 1264): straightforward.
- **`wheel handler attached in init / cleaned in destroy`** (line 1273):
  checks both sides.

### Tests with loose / under-specified assertions

1. **`SRS table has an entry for every (from, to) transition…`** (line 1099):
   only asserts `typeof ok === 'boolean'` and that rotating back restores the
   rotation. It does not verify that, e.g., a `1→0` CCW rotation actually
   tries the `1->0` kick list. The test would pass even if `tryRotate` always
   returned `false`.

2. **`tryRotate with CCW (-1) uses a different kick table than CW (+1)`** (line
   1120): asserts `typeof ok === 'boolean'` for both directions. It does not
   actually verify that the tables are different — the old broken
   single-table code would pass this test too. The test name is aspirational;
   the assertion is not.

3. **`Z key rotates CCW`** (line 1242): asserts
   `rotation === 1 || rotation === 2`. It accepts EITHER the correct outcome
   (1, CCW success) OR the no-op outcome (2, CCW failed). This makes the
   assertion unfalsifiable — a broken CCW binding would still pass.

4. **`handleWheel accumulates deltaY and triggers soft-drop at threshold`**
   (line 1171): has an `if (newY === startY) { expect(wheelAccumY < 40) }
   else { expect(newY >= startY) }` branching assertion. Both branches are
   loose — the second accepts "unchanged" as success.

### Missing coverage

- **No test that a sideways wheel event (`deltaX > 0, deltaY = 0`) does NOT
  move the piece horizontally.** This is explicitly asked for in the review
  brief and is absent. Easy to add.
- **No test for DAS reset on direction switch** (Left→Right mid-hold should
  reset `dasTimer` to 0). Only the single-direction DAS test exists.
- **No test that `X` rotates CW** (explicit binding, unlike `ArrowUp`).
- **No test that `Ctrl` rotates CCW.**
- **No test that `C` / `Shift` are no-ops** (just that they don't crash).
- **No test for hard-drop axis dominance** — that a diagonal fast drag with
  large dx doesn't misfire as a hard drop.
- **No test for wheel-accumulator negative clamp** (line 1211).
- **No test that the soft-drop branch of handlePointerMove actually triggers
  a single-row soft drop** on a slow drag (the slow-drag test only verifies
  it doesn't hard-drop).

**Verdict: test coverage exercises the code paths but has several loose
assertions and notable gaps. The gaps are not dangerous but limit confidence
in future refactors.**

---

## Bugs / divergences found

No functional bugs. Divergences (in order of significance):

1. **Axis dominance ratio**: code uses `|dy| > |dx| * 1.5`; research § 2
   specifies `|dy/dx| > 2`. Near-diagonal flicks trigger hard drop more easily
   than spec.
2. **Wheel cooldown**: code uses 180 ms; research § 5 suggests 50 ms. Sustained
   trackpad scrolls will feel slower than modern clients.
3. **Tap jitter threshold**: code uses 4 px; research § 2 recommends 10 px.
   Stricter, not a bug.
4. **Controls display string** (`'Arrows/Touch to move, Up/Tap to rotate, Space
   to drop'`, line 1227): not updated per research recommendation
   (`'Drag to move, tap to rotate, flick down to drop'`).
5. **`KICKS_O` is declared but unused** (line 110): dead constant — `tryRotate`
   early-returns for O before the lookup. Harmless.
6. **No `e.preventDefault()` on Z/X/Ctrl/C/Shift**: browsers don't bind these
   alone, but it's inconsistent with the arrow keys and Space.
7. **Test assertion looseness**: four of the 14 new tests have
   under-specified assertions that would pass even if the implementation
   regressed.
8. **Missing sideways-wheel test**: review brief explicitly asked for it.

---

## Recommendations

### Code (low priority, optional)

1. Tighten the axis-dominance ratio to `2.0` to match spec exactly.
2. Reduce wheel cooldown to ~50 ms or make it configurable; the current 180 ms
   feels sluggish on a fast trackpad.
3. Update the `controls` registry string to the shorter "drag / tap / flick"
   wording.
4. Delete the unused `KICKS_O` constant, or actually use it (pointlessly) for
   symmetry.
5. Add `e.preventDefault()` to the rotate and hold key cases for consistency.

### Tests (medium priority)

1. **Add a sideways-wheel test**: fire `{deltaX: 100, deltaY: 0}` and assert
   the piece's x is unchanged and `wheelAccumY` is unchanged.
2. **Add a DAS direction-switch test**: press Right, tick 0.1s, press Left,
   assert `dasDir === -1 && dasTimer === 0`.
3. **Tighten the SRS-table tests**: instead of `typeof x === 'boolean'`,
   set up specific grid configurations where a given kick is known to be the
   only valid offset, then assert the resulting `(x, y)` matches that kick.
   This would actually verify the 8-entry table.
4. **Tighten the Z-rotates-CCW test**: from rotation 2, assert the resulting
   rotation is 1 (and not "1 or 2").
5. **Add an X-CW-rotates and Ctrl-CCW-rotates test** for the explicit bindings.
6. **Add a soft-drop slow-drag test** that asserts the piece actually dropped
   exactly one row on a qualifying slow drag (positive assertion, not
   "doesn't hard drop").
7. **Add a diagonal flick test** that verifies a fast drag with
   `|dx| > |dy|/1.5` does NOT trigger hard drop.
