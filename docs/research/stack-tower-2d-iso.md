# Stack Tower 2.5D Isometric Rendering — Research

## TL;DR
- Use a simple **cabinet-style oblique projection** (not true 30° iso) with a fixed depth `d` and tilt factor `k ≈ 0.5` — easiest math, looks almost identical to Ketchapp Stack, and matches portrait layout.
- Each block is three polygons: **top (parallelogram)**, **right side**, **left side**, drawn back-to-front, with baked-in brightness multipliers (1.00 / 0.82 / 0.65).
- The tower color gradient is a **per-block lerp** from a base "bottom" hue to the neutral cream palette entry at the stack head — compute once when the block lands.
- Camera is a single `cameraY` world offset that lerps toward a target set every time a block is placed; draw everything with `screenY = worldY + cameraY`.
- Overhang slices are modeled as **independent falling objects** (position + velocity + angularVelocity) rendered with `ctx.save/translate/rotate/restore` and culled when off-screen.

---

## 1. Isometric projection math

### True isometric (30°)
The classic "game dev" isometric projects a 3D point `(x, y, z)` where `y` is up:

```
screenX = (x - z) * cos(30°)      ≈ (x - z) * 0.866
screenY = (x + z) * sin(30°) - y  ≈ (x + z) * 0.5  - y
```

Tile ratio is **2:1** (width:height), so a 1×1 top face becomes a diamond 2 units wide and 1 unit tall. This is the look of Diablo, Transport Tycoon, etc.

### Cabinet / oblique projection (recommended)
Cabinet projection keeps the front face **axis-aligned** and just slants the depth axis:

```
// world (x, y, z) where y = up, z = depth (into the screen)
// k controls how much depth "leans" (0 = no tilt, 0.5 = classic cabinet)
screenX = x + z * cos(angle) * k      // angle usually 30° or 45°
screenY = -y + z * sin(angle) * k     // negative y because canvas y grows downward
```

For Ketchapp Stack the angle looks like roughly **30° with k ≈ 0.5**, giving:

```
screenX = x + z * 0.433
screenY = -y + z * 0.25
```

### Which to use?
| Aspect                | True iso (30°)                      | Cabinet (recommended)          |
|-----------------------|-------------------------------------|--------------------------------|
| Front face            | Rotated diamond                     | Axis-aligned rectangle         |
| Math                  | Two multiplies both axes            | Front face is "free"           |
| Fits portrait layout  | Awkward (tower leans)               | Natural vertical stack         |
| Matches Ketchapp look | Close                               | Closer — their front is square |
| Overhang slicing math | Needs world-space clip              | Slice is a simple x-range      |

**Verdict**: cabinet projection with ~30° tilt. Our existing overhang math already works in screen-aligned 2D, so keeping the front face axis-aligned means we can add depth **additively** without rewriting the drop/slice logic.

---

## 2. Drawing an isometric block (three faces, lighting)

### Vertex layout
For a block with **front-bottom-left** corner at world `(x, y, z)` and size `(w, d, h)` (width, depth, height), the 8 corners are:

```
        G---------H           y (up)
       /|        /|           │
      / |       / |           │
     E---------F  |           └── x (right)
     |  C------|--D          /
     | /       | /          z (into screen)
     |/        |/
     A---------B
```

```
A = (x,     y,     z)
B = (x + w, y,     z)
C = (x,     y,     z + d)
D = (x + w, y,     z + d)
E = (x,     y + h, z)
F = (x + w, y + h, z)
G = (x,     y + h, z + d)
H = (x + w, y + h, z + d)
```

With cabinet projection and our "camera looks slightly down and to the left of the block", the three **visible** faces are:

- **Top** (y = y+h): `E F H G` — a parallelogram
- **Front / right-front side** (z = z): `A B F E` — a rectangle (axis-aligned because cabinet)
- **Right side** (x = x+w): `B D H F` — a parallelogram

The left side (x = x) and bottom are hidden by the tower below and the camera angle — don't draw them.

### Draw order (back-to-front, painter's algorithm)
Within a single block, the correct order is:
1. **Right side** (back of the trio)
2. **Top**
3. **Front side**

Because the front face is the closest to camera, it overlaps the top and right edges and hides the seams — which is actually what you want for a clean look.

Across the tower, iterate **bottom-to-top** so the current block overlaps the one below at its base seam. This is trivially correct because higher blocks are drawn later.

### Lighting (single baked directional light)
Given a `baseColor` in hex, compute three shaded colors:

```
topColor   = shade(baseColor, 1.00)   // full brightness
rightColor = shade(baseColor, 0.82)   // medium shadow
frontColor = shade(baseColor, 0.65)   // dark shadow
```

`shade(hex, f)` multiplies each RGB channel by `f` and clamps. Cache the three colors on the block when it lands so you're not recomputing per frame.

---

## 3. Gradient tower coloring

Two valid approaches:

### A. Per-block lerp (recommended)
When a block is placed at stack index `i`, compute its base color by lerping between two anchor colors based on `i` relative to a "window":

```
function blockBaseColor(stackIndex: number, activeIndex: number): string {
  // Distance below the current head (0 = head, larger = further down)
  const depth = activeIndex - stackIndex;
  // Map depth 0..30 onto t in 0..1 (clamped)
  const t = Math.min(depth / 30, 1);
  // Head color (neutral cream/mauve) → bottom color (green → yellow)
  return lerpColor('#E8D5C4', '#4FB87C', t);   // or via HSL for smoother blend
}
```

Because the reference shows a **continuous green→yellow→cream** ramp as blocks age, use three anchor stops and a piecewise lerp:

```
// stops: bottom (green) → middle (yellow) → top (cream)
const STOPS = ['#4FB87C', '#E8C547', '#E8D5C4'];
```

The key insight: the color does **not** change after placement. Compute once on drop, store `baseColor` on the block. Each frame only the brightness-shaded versions are drawn — no gradient calculations during render.

### B. Per-pixel Canvas gradient
You could call `createLinearGradient(0, 0, 0, towerHeight)` and use it as fillStyle on every face. Downside: the gradient is screen-space, so it scrolls weirdly with the camera unless you recreate the gradient each frame with the current camera offset. Not worth the bother.

**Use approach A.**

---

## 4. Camera scroll

The current StackBlock.ts already has the right idea:

```ts
private cameraY = 0;
private targetCameraY = 0;
// in update()
this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(SCROLL_LERP * dt, 1);
```

For the 2.5D version, keep **exactly this model** — isometric doesn't change the camera semantics. A few refinements:

1. **Set the target** whenever the next active block would be above a threshold ratio of the screen. Use `0.35–0.45` for portrait so the player sees roughly 6–8 blocks of history below the head.
2. **Apply the camera in projection**, not in world:
   ```
   screenY = projectY(worldY) + cameraY
   ```
   Keep world coordinates unchanged. Only the draw step adds `cameraY`.
3. **Never reset `cameraY` backwards** unless you restart — monotonic increase avoids jitter when blocks are placed with exactly zero overhang.
4. **Pitfall**: when you introduce height `h` for each block in 3D, the block's "top" in screen space is lower (larger y in canvas coords) than the anchor. Set the camera target from the **top** of the active block, not its anchor, or blocks will appear to be cut off at the top of the screen after a place.

---

## 5. Overhang slice animation

When the player drops with horizontal offset `Δx`:

### Step 1 — slice
Compute the same overlap interval the existing code does:
```
overlapLeft  = max(active.x, top.x)
overlapRight = min(active.x + active.w, top.x + top.w)
overlap      = overlapRight - overlapLeft
```

If `overlap > 0`:
- **Kept block**: `{ x: overlapLeft, w: overlap, ... }` — added to the tower as a static block.
- **Falling slice**: one or two rectangular "chunks" with the **remainder** width(s). If the active block had both a left and right overhang (possible if active is wider than top), create two chunks. Normally it's just one.

```ts
const chunks: FallingChunk[] = [];
if (active.x < overlapLeft) {
  chunks.push({
    x: active.x,
    y: active.y,
    z: active.z,
    w: overlapLeft - active.x,
    d: active.d,
    h: active.h,
    vx: -60,             // slight drift outward
    vy: 0,               // starts at rest
    angVel: -2.5,        // rad/s, spins counter-clockwise
    rot: 0,
    baseColor: active.baseColor,
  });
}
if (active.x + active.w > overlapRight) {
  chunks.push({
    x: overlapRight,
    y: active.y,
    z: active.z,
    w: (active.x + active.w) - overlapRight,
    d: active.d,
    h: active.h,
    vx: 60,
    vy: 0,
    angVel: 2.5,
    rot: 0,
    baseColor: active.baseColor,
  });
}
```

### Step 2 — tumble physics (arcade, not realistic)

```ts
update(dt) {
  for (const c of this.falling) {
    c.vy += 900 * dt;           // gravity
    c.x  += c.vx * dt;
    c.y  += c.vy * dt;          // world-space downward (positive y = down in this code)
    c.rot += c.angVel * dt;
  }
  // Remove chunks that have fallen far below the visible area
  this.falling = this.falling.filter(c => (c.y + this.cameraY) < this.height + 200);
}
```

### Step 3 — render with rotation

```ts
for (const c of this.falling) {
  const sx = c.x + c.w / 2;                    // pivot = chunk center
  const sy = c.y + c.h / 2 + this.cameraY;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(c.rot);
  ctx.translate(-sx, -sy);
  drawBlock(ctx, c.x, c.y, c.z, c.w, c.d, c.h, c.baseColor, this.cameraY);
  ctx.restore();
}
```

That's it — no real 3D rotation, just the whole projected block rotated as a 2D sprite around its center. It looks convincing because the tumble is quick (< 1.5s) and the block is off-screen before the eye can notice the missing perspective change.

**Gotcha**: because you're drawing the block with `drawBlock(ctx, x, y, z, ...)` which uses world coordinates, the `translate/rotate` must happen around the **projected** center, not the world center. Either pre-project the center and rotate there (as above) or refactor `drawBlock` to accept an anchor point.

---

## 6. Active block slide-in

The current implementation just bounces the block back and forth across the screen. For the Ketchapp feel:

1. **Spawn off-screen**: start at `x = -active.w - 30` (or `x = this.width + 30`, alternating each block).
2. **Slide in with ease-out**: lerp toward a "play position" over ~0.25s using ease-out cubic.
3. **Once on-screen**, switch to the existing **oscillating slide** pattern (constant speed, bounces at edges). The player can drop at any time.
4. **Alternate sides** per block — visually matches the reference, where each new block enters from the opposite direction of the last.

```ts
interface ActiveBlock {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  baseColor: string;

  // Slide-in state
  mode: 'entering' | 'oscillating';
  enterT: number;           // 0..1 for ease-out
  enterFrom: number;        // starting x
  enterTo: number;          // x at start of oscillation
  enterDuration: number;    // seconds

  dir: number;              // -1 or 1 during oscillation
  speed: number;
}
```

During `update(dt)`:
```ts
if (a.mode === 'entering') {
  a.enterT = Math.min(1, a.enterT + dt / a.enterDuration);
  const t = 1 - Math.pow(1 - a.enterT, 3);       // ease-out cubic
  a.x = a.enterFrom + (a.enterTo - a.enterFrom) * t;
  if (a.enterT >= 1) {
    a.mode = 'oscillating';
    a.x = a.enterTo;
  }
} else {
  a.x += a.dir * a.speed * dt;
  if (a.x <= 0) { a.x = 0; a.dir = 1; }
  else if (a.x + a.w >= this.width) { a.x = this.width - a.w; a.dir = -1; }
}
```

**Along Z too?** Optional polish: alternate blocks enter from +x direction (front-right) and from +z direction (back-right), with matching projection. Looks cooler but doubles the complexity — skip for v1.

---

## 7. Performance notes

**50 blocks at 60fps in Canvas 2D is trivially fine.** Rough budget on a mid-range phone:
- ~50 blocks × 3 faces = 150 `fill()` calls per frame
- Plus ~150 `stroke()` calls if you outline faces
- Plus 1 background gradient
- Plus 1 active block (3 faces) and maybe 1–2 falling chunks

Total < 310 draw calls — Chrome/Safari handle this at 60fps on a 5-year-old Android without breaking a sweat. The only thing to watch:

1. **Cull off-screen blocks.** Skip rendering any block where `projectedY + cameraY + blockScreenHeight < -20` or `projectedY + cameraY > this.height + 20`. With a tall tower (hundreds of blocks), this is the #1 optimization. The existing code already does this for 2D — extend to iso.
2. **Don't create new arrays every frame.** Reuse a single `tempVertices[8]` buffer inside `drawBlock`.
3. **Avoid `createLinearGradient` per frame.** If you use a gradient for the sky, cache it once on resize.
4. **Batch fills by color only if hot.** In practice it's not needed at 50 blocks.
5. **No shadows via `ctx.shadowBlur`.** Soft shadows in Canvas 2D are murderously slow. Fake them with an extra translucent fill offset by a few pixels.
6. **Integer `ctx.setTransform(1,0,0,1,0,0)`** at the start of each frame to reset any stray transforms from rotation-tumble rendering.

---

## 8. Sky background

Canvas 2D `createLinearGradient(x0, y0, x1, y1)` gives a clean vertical gradient. A few tips:

```ts
// Cache on resize, not per frame
this.skyGradient = ctx.createLinearGradient(0, 0, 0, this.height);
this.skyGradient.addColorStop(0,    '#A8DDE0');   // top, soft aqua
this.skyGradient.addColorStop(0.55, '#C9E8E2');
this.skyGradient.addColorStop(1,    '#E8F2EC');   // horizon, almost cream
```

**Gotchas**:
- `addColorStop` offsets must be 0..1. Stops outside this range silently fail.
- Using fewer than 2 stops throws.
- The Ketchapp palette varies the sky color slightly per play, cycling hues — you can do the same by offsetting hue with `hsl()` stops.
- **Do not recreate the gradient every frame.** `createLinearGradient` is cheap but not free, and it's wasteful when the size hasn't changed. Build in `init()` and on resize; `ctx.fillStyle = this.skyGradient; ctx.fillRect(0, 0, this.width, this.height)`.
- If you want a subtle **atmospheric perspective** effect (distant blocks fading toward sky color), lerp each block's base color toward the top sky color by 5–10% when it's far from the head. Subtle but authentic.

---

## 9. Code sketch (~100 lines TypeScript)

```ts
// ── Projection ────────────────────────────────────────────────────
// Cabinet oblique: front face axis-aligned, depth leans up-right.
const ISO_DX = 0.433;   // cos(30°) * 0.5 depth factor
const ISO_DY = 0.25;    // sin(30°) * 0.5 depth factor

function projectX(x: number, z: number): number {
  return x + z * ISO_DX;
}
function projectY(y: number, z: number): number {
  // canvas y grows downward; world y is "up" so invert
  return -y + z * ISO_DY;
}

// ── Lighting ──────────────────────────────────────────────────────
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8)  & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round(( n        & 0xff) * factor)));
  return `rgb(${r},${g},${b})`;
}

// ── Block draw ────────────────────────────────────────────────────
// Draws the three visible faces of an axis-aligned block.
// (x, y, z) is the front-bottom-left corner in world space (y = up).
// anchorScreenY is the canvas-space offset (camera already applied).
function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, z: number,
  w: number, d: number, h: number,
  baseColor: string,
  cameraY: number,
): void {
  // 8 corners projected to screen space
  const px = (wx: number, wz: number) => projectX(wx, wz);
  const py = (wy: number, wz: number) => projectY(wy, wz) + cameraY;

  // Only the 6 corners we actually need for the 3 visible faces.
  // A = front-bottom-left,  B = front-bottom-right
  // E = front-top-left,     F = front-top-right
  // H = back-top-right,     D = back-bottom-right
  const Ax = px(x,       z    ), Ay = py(y,       z    );
  const Bx = px(x + w,   z    ), By = py(y,       z    );
  const Ex = px(x,       z    ), Ey = py(y + h,   z    );
  const Fx = px(x + w,   z    ), Fy = py(y + h,   z    );
  const Dx = px(x + w,   z + d), Dy = py(y,       z + d);
  const Hx = px(x + w,   z + d), Hy = py(y + h,   z + d);
  const Gx = px(x,       z + d), Gy = py(y + h,   z + d);

  const topColor   = shade(baseColor, 1.00);
  const rightColor = shade(baseColor, 0.78);
  const frontColor = shade(baseColor, 0.60);

  // 1. Right side (back-most)
  ctx.fillStyle = rightColor;
  ctx.beginPath();
  ctx.moveTo(Bx, By); ctx.lineTo(Dx, Dy);
  ctx.lineTo(Hx, Hy); ctx.lineTo(Fx, Fy);
  ctx.closePath(); ctx.fill();

  // 2. Top (parallelogram)
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(Ex, Ey); ctx.lineTo(Fx, Fy);
  ctx.lineTo(Hx, Hy); ctx.lineTo(Gx, Gy);
  ctx.closePath(); ctx.fill();

  // 3. Front (rectangle, closest to camera)
  ctx.fillStyle = frontColor;
  ctx.beginPath();
  ctx.moveTo(Ax, Ay); ctx.lineTo(Bx, By);
  ctx.lineTo(Fx, Fy); ctx.lineTo(Ex, Ey);
  ctx.closePath(); ctx.fill();
}

// ── Falling slice (rotation around projected center) ─────────────
interface FallingChunk {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  vx: number; vy: number; angVel: number; rot: number;
  baseColor: string;
}

function updateAndRenderFalling(
  ctx: CanvasRenderingContext2D,
  chunks: FallingChunk[],
  cameraY: number,
  dt: number,
  screenH: number,
): FallingChunk[] {
  const next: FallingChunk[] = [];
  for (const c of chunks) {
    c.vy += 900 * dt;
    c.x  += c.vx * dt;
    c.y  -= c.vy * dt;  // world y is up; falling reduces y
    c.rot += c.angVel * dt;

    const cx = projectX(c.x + c.w / 2, c.z + c.d / 2);
    const cy = projectY(c.y + c.h / 2, c.z + c.d / 2) + cameraY;
    if (cy > screenH + 200) continue;   // cull when well below screen

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(c.rot);
    ctx.translate(-cx, -cy);
    drawBlock(ctx, c.x, c.y, c.z, c.w, c.d, c.h, c.baseColor, cameraY);
    ctx.restore();
    next.push(c);
  }
  return next;
}
```

---

## Recommended implementation for StackBlock.ts

Concrete changes to apply on top of the current file:

1. **Add a Z (depth) axis to the block model.** Extend `BlockTile` with `z: number` and `d: number` (depth). Use a fixed constant `BLOCK_DEPTH = 120` for all blocks — the classic Stack game has uniform depth. Adjust `GROUND_OFFSET` to account for the projected height of the block depth.

2. **Add projection helpers** (`projectX`, `projectY`) as file-scope functions near the top, alongside the constants. Use cabinet factors `ISO_DX = 0.433`, `ISO_DY = 0.25`.

3. **Replace `drawRoundRect` calls with `drawBlock`** in the `render()` method. Add `drawBlock()` as a private method. Keep the active block and tower blocks sharing the same function.

4. **Change draw order** so tower blocks render bottom-to-top, then the active block, then falling chunks last. This ensures correct overlap without a z-sort.

5. **Replace `color` with `baseColor`** on each block. Compute via a new `gradientColor(stackIndex, activeIndex)` helper that lerps across two or three palette stops (green → yellow → cream). Do **not** re-shade every frame — compute `baseColor` once on placement.

6. **Introduce falling-chunk physics.** Add `private falling: FallingChunk[] = []` and on a non-perfect drop push one or two chunks for the overhanging slice(s). Update and render in `update()` / `render()`. Clear on `init()`.

7. **Slide-in animation for the active block.** Add `mode: 'entering' | 'oscillating'` and `enterT / enterFrom / enterTo / enterDuration` fields. Spawn the block off-screen alternating left/right each time. Use ease-out cubic for ~0.25s, then transition to the existing oscillation loop.

8. **Sky background gradient.** Replace `this.clear(BG_COLOR)` with a cached `CanvasGradient`. Rebuild in `init()` and whenever `this.width`/`this.height` change (hook into GameEngine resize if available, otherwise lazily rebuild when dimensions differ from cached). Stops: `#A8DDE0` top → `#C9E8E2` mid → `#E8F2EC` bottom.

9. **Camera target from projected top.** Update `spawnNextBlock()` to set `desiredCameraY` from the projected top (`projectY(a.y + a.h, a.z)`) of the active block, not its raw world y. Otherwise the camera lags by one block after the 3D conversion.

10. **Cull on projected y.** Tighten the `render()` cull condition to compare projected + camera-offset y, not raw world y.

11. **Tests to add** (required per CLAUDE.md):
    - `projectX` / `projectY` unit tests with known inputs.
    - `shade()` clamps and computes correctly for pure white, pure black, typical colors.
    - `gradientColor(i, active)` returns the bottom stop when far below, the top stop when at the head.
    - Falling chunks are removed once below `screenH + 200`.
    - Placing with overhang produces a chunk with width equal to `active.w - overlap`.
    - Perfect drop still produces no chunks.
    - Slide-in mode transitions to oscillating after `enterDuration` seconds.
    - Camera target uses projected top, not raw y (regression test for #9).

12. **Don't change**:
    - The drop / overlap / perfect-tolerance math. That all lives in x-space and is unaffected by projection.
    - The serialize/deserialize shape, except adding new fields (`z`, `d`, `baseColor`, `falling`, slide-in state) with validated defaults so old save snapshots still load gracefully.
    - The score and game-over logic.
    - The sound and haptic calls.

With these changes the game plays identically to the current version but **looks** like the Ketchapp Stack reference: isometric tower, directional lighting, gradient coloring, sky backdrop, chunks tumbling off on imperfect drops.
