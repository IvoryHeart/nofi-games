import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Projection (cabinet oblique, rotated 90° around Y) ───────────────
// Camera is rotated 90° around the vertical axis compared to default
// cabinet oblique. Depth (z) projects UP and to the LEFT, so the left
// side face is visible instead of the right.
const ISO_DX = -0.45;
const ISO_DY = 0.35;

export function projectX(x: number, z: number): number {
  return x + z * ISO_DX;
}
export function projectY(y: number, z: number): number {
  return y - z * ISO_DY;
}

// ── Colour helpers ────────────────────────────────────────────────────
/** Multiply each RGB channel of a #rrggbb hex colour by factor, clamped to [0,255]. */
export function shade(hex: string, factor: number): string {
  // Accept both "#rrggbb" and "rrggbb"
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((n & 0xff) * factor)));
  return `rgb(${r},${g},${b})`;
}

/** Linear blend between two #rrggbb colours, t in [0,1]. */
function lerpHex(colorA: string, colorB: string, t: number): string {
  const clampT = Math.max(0, Math.min(1, t));
  const ah = colorA.startsWith('#') ? colorA.slice(1) : colorA;
  const bh = colorB.startsWith('#') ? colorB.slice(1) : colorB;
  const an = parseInt(ah, 16);
  const bn = parseInt(bh, 16);
  const ar = (an >> 16) & 0xff;
  const ag = (an >> 8) & 0xff;
  const ab = an & 0xff;
  const br = (bn >> 16) & 0xff;
  const bg = (bn >> 8) & 0xff;
  const bb = bn & 0xff;
  const r = Math.round(ar + (br - ar) * clampT);
  const g = Math.round(ag + (bg - ag) * clampT);
  const b = Math.round(ab + (bb - ab) * clampT);
  const toHex = (v: number): string => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Palette: bottom green → middle yellow → top golden. Lerped per-block
// and stored on each block at placement, so render is pure draw calls.
const PALETTE_BOTTOM = '#7CC850';
const PALETTE_MIDDLE = '#E8D040';
const PALETTE_TOP = '#E8C850';

export function gradientColor(stackIndex: number, activeIndex: number): string {
  // depth = 0 at the head (just placed), grows as we look down the tower
  const depth = Math.max(0, activeIndex - stackIndex);
  const t = Math.min(depth / 30, 1);
  // Piecewise lerp: first half cream→yellow, second half yellow→green.
  if (t < 0.5) {
    return lerpHex(PALETTE_TOP, PALETTE_MIDDLE, t * 2);
  }
  return lerpHex(PALETTE_MIDDLE, PALETTE_BOTTOM, (t - 0.5) * 2);
}

// ── Types ─────────────────────────────────────────────────────────────
interface BlockTile {
  x: number;        // world x (left edge of front face)
  y: number;        // world y (top edge); negative = above ground
  z: number;        // world z (depth of front face)
  w: number;        // width along x
  d: number;        // depth along z
  h: number;        // height along y (screen-vertical)
  baseColor: string;
}

interface ActiveBlock extends BlockTile {
  // Oscillation state (after slide-in)
  dir: number;
  speed: number;
  axis: 'x' | 'z';   // which axis oscillates

  // Slide-in animation
  mode: 'entering' | 'oscillating';
  enterT: number;
  enterFrom: number;
  enterTo: number;
  enterDuration: number;
}

interface FallingChunk {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  vx: number;
  vy: number;   // positive = falling downward (y grows downward)
  angVel: number;
  rot: number;
  baseColor: string;
}

interface DifficultyConfig {
  baseSpeed: number;
  startWidth: number;
  perfectTolerance: number;
  speedRamp: number;
}

// ── Constants ─────────────────────────────────────────────────────────
const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { baseSpeed: 140, startWidth: 140, perfectTolerance: 4, speedRamp: 0 },     // Easy
  { baseSpeed: 200, startWidth: 110, perfectTolerance: 2, speedRamp: 0 },     // Medium
  { baseSpeed: 280, startWidth: 90,  perfectTolerance: 0, speedRamp: 0 },     // Hard
  { baseSpeed: 320, startWidth: 80,  perfectTolerance: 0, speedRamp: 8 },     // Extra Hard
];

const BLOCK_HEIGHT = 52;      // world-space y thickness (chunky like reference)
const BLOCK_DEPTH = 110;      // world-space z depth (constant for all blocks)
const GROUND_OFFSET = 130;    // distance from canvas bottom to front-top of base block
const ACTIVE_GAP = 0;         // blocks sit flush on each other
const SCROLL_TRIGGER_RATIO = 0.45;

const TEXT_COLOR = '#3D2B35';

// Sky gradient stops (top → middle → bottom) — vibrant cyan to mint green
const SKY_TOP = '#7ECFE0';
const SKY_MID = '#A8E4D8';
const SKY_BOT = '#C0ECC0';

// Lighting factors for the three visible faces
const TOP_FACTOR = 1.05;
const SIDE_FACTOR = 0.72;
const FRONT_FACTOR = 0.55;

const PERFECT_BONUS = 10;
const PLACE_POINTS = 5;
const SCROLL_LERP = 10;

const ENTER_DURATION = 0.25;       // seconds for slide-in
const ENTER_OFF_MARGIN = 30;       // px off-screen to spawn from

const GRAVITY = 900;               // px/s² for falling chunks

// Sparkle particle for sky decoration
interface Sparkle { x: number; y: number; size: number; alpha: number; speed: number; }
const SPARKLE_COUNT = 30;

// ── Game ──────────────────────────────────────────────────────────────
class StackBlockGame extends GameEngine {
  private tower: BlockTile[] = [];
  private active: ActiveBlock | null = null;
  private falling: FallingChunk[] = [];
  private cameraY = 0;
  private targetCameraY = 0;
  private gameActive = false;
  private diffConfig!: DifficultyConfig;
  private placedCount = 0;
  private nextEnterFromLeft = true;

  // Sparkle particles
  private sparkles: Sparkle[] = [];

  // Cached sky gradient (rebuilt when width/height changes)
  private skyGradient: CanvasGradient | null = null;
  private skyGradientW = 0;
  private skyGradientH = 0;

  constructor(config: GameConfig) {
    super(config);
  }

  init(): void {
    const d = Math.max(0, Math.min(3, this.difficulty));
    this.diffConfig = DIFFICULTY_CONFIGS[d];

    this.tower = [];
    this.active = null;
    this.falling = [];
    this.cameraY = 0;
    this.targetCameraY = 0;
    this.gameActive = true;
    this.placedCount = 0;
    this.nextEnterFromLeft = true;

    // Force sky gradient to rebuild on next render
    this.skyGradient = null;

    // Sparkle particles
    this.sparkles = [];
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      this.sparkles.push({
        x: this.rng() * this.width,
        y: this.rng() * this.height * 0.6,
        size: 1 + this.rng() * 2.5,
        alpha: 0.2 + this.rng() * 0.6,
        speed: 0.3 + this.rng() * 0.8,
      });
    }

    // Base block: centred (in PROJECTED space), slightly wider than start width
    const baseW = this.diffConfig.startWidth + 20;
    // Centre the block's projected extent. With negative ISO_DX, the back-left
    // edge is the leftmost projected point.
    const backShift = BLOCK_DEPTH * ISO_DX; // negative when ISO_DX < 0
    const projLeft = Math.min(0, backShift);
    const projRight = baseW + Math.max(0, backShift);
    const projectedW = projRight - projLeft;
    const baseX = (this.width - projectedW) / 2 - projLeft;
    const baseZ = 0;
    const baseY = this.height - GROUND_OFFSET;

    this.tower.push({
      x: baseX,
      y: baseY,
      z: baseZ,
      w: baseW,
      d: BLOCK_DEPTH,
      h: BLOCK_HEIGHT,
      baseColor: gradientColor(0, 0),
    });

    this.spawnNextBlock();
    this.setScore(0);
  }

  private spawnNextBlock(): void {
    if (this.tower.length === 0) return;
    const top = this.tower[this.tower.length - 1];
    const newY = top.y - BLOCK_HEIGHT - ACTIVE_GAP;
    const newW = top.w;
    const newD = top.d;
    const speed = this.diffConfig.baseSpeed + this.placedCount * this.diffConfig.speedRamp;

    // Alternate oscillation axis each block: X (left/right) ↔ Z (front/back)
    const axis: 'x' | 'z' = this.placedCount % 2 === 0 ? 'x' : 'z';
    // Alternate entry side per block
    const fromLeft = this.nextEnterFromLeft;
    this.nextEnterFromLeft = !fromLeft;

    let enterFrom: number;
    let enterTo: number;
    let startX = top.x;
    let startZ = top.z;

    if (axis === 'x') {
      enterTo = top.x;
      enterFrom = fromLeft ? -newW - ENTER_OFF_MARGIN : this.width + ENTER_OFF_MARGIN;
      startX = enterFrom;
    } else {
      enterTo = top.z;
      enterFrom = fromLeft ? -newD - ENTER_OFF_MARGIN : this.width + ENTER_OFF_MARGIN;
      startZ = enterFrom;
    }

    const newIndex = this.placedCount + 1;
    this.active = {
      x: startX,
      y: newY,
      z: startZ,
      w: newW,
      d: newD,
      h: BLOCK_HEIGHT,
      baseColor: gradientColor(newIndex, newIndex),
      dir: fromLeft ? 1 : -1,
      speed,
      axis,
      mode: 'entering',
      enterT: 0,
      enterFrom,
      enterTo,
      enterDuration: ENTER_DURATION,
    };

    // Camera target based on the PROJECTED top of the active block.
    // Projected top is at world y = newY - h (but we're using downward y),
    // so screen y = projectY(newY, newZ). For a uniform-z block the projected
    // top is simply projectY(newY, newZ).
    const visibleTopThreshold = this.height * SCROLL_TRIGGER_RATIO;
    const projectedTop = projectY(newY, top.z);
    const desiredCameraY = visibleTopThreshold - projectedTop;
    if (desiredCameraY > this.targetCameraY) {
      this.targetCameraY = desiredCameraY;
    }
  }

  protected handlePointerDown(_x: number, _y: number): void {
    if (!this.gameActive) return;
    this.dropActiveBlock();
  }

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (!this.gameActive) return;
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      this.dropActiveBlock();
    }
  }

  private dropActiveBlock(): void {
    if (!this.active || this.tower.length === 0) return;
    const top = this.tower[this.tower.length - 1];
    const a = this.active;

    if (a.axis === 'x') {
      // X-axis overlap
      const overlapLeft = Math.max(a.x, top.x);
      const overlapRight = Math.min(a.x + a.w, top.x + top.w);
      const overlap = overlapRight - overlapLeft;

      if (overlap <= 0) {
        this.gameActive = false;
        this.haptic('heavy');
        this.playSound('gameOver');
        this.gameOver();
        return;
      }

      const offset = Math.abs(a.x - top.x);
      const isPerfect = offset <= this.diffConfig.perfectTolerance;

      let placedX: number;
      let placedW: number;

      if (isPerfect) {
        placedX = top.x;
        placedW = top.w;
        this.addScore(PLACE_POINTS + PERFECT_BONUS);
        this.playSound('score');
        this.haptic('medium');
      } else {
        placedX = overlapLeft;
        placedW = overlap;
        this.addScore(PLACE_POINTS);
        this.playSound('place');
        this.haptic('light');

        if (a.x < overlapLeft) {
          this.falling.push({
            x: a.x, y: a.y, z: a.z,
            w: Math.max(overlapLeft - a.x, 1), d: a.d, h: a.h,
            vx: -60, vy: 0, angVel: -2.5, rot: 0, baseColor: a.baseColor,
          });
        }
        if (a.x + a.w > overlapRight) {
          this.falling.push({
            x: overlapRight, y: a.y, z: a.z,
            w: Math.max((a.x + a.w) - overlapRight, 1), d: a.d, h: a.h,
            vx: 60, vy: 0, angVel: 2.5, rot: 0, baseColor: a.baseColor,
          });
        }
      }

      this.tower.push({
        x: placedX, y: a.y, z: top.z,
        w: Math.max(placedW, 1), d: top.d, h: a.h,
        baseColor: a.baseColor,
      });
    } else {
      // Z-axis overlap
      const overlapFront = Math.max(a.z, top.z);
      const overlapBack = Math.min(a.z + a.d, top.z + top.d);
      const overlap = overlapBack - overlapFront;

      if (overlap <= 0) {
        this.gameActive = false;
        this.haptic('heavy');
        this.playSound('gameOver');
        this.gameOver();
        return;
      }

      const offset = Math.abs(a.z - top.z);
      const isPerfect = offset <= this.diffConfig.perfectTolerance;

      let placedZ: number;
      let placedD: number;

      if (isPerfect) {
        placedZ = top.z;
        placedD = top.d;
        this.addScore(PLACE_POINTS + PERFECT_BONUS);
        this.playSound('score');
        this.haptic('medium');
      } else {
        placedZ = overlapFront;
        placedD = overlap;
        this.addScore(PLACE_POINTS);
        this.playSound('place');
        this.haptic('light');

        if (a.z < overlapFront) {
          this.falling.push({
            x: a.x, y: a.y, z: a.z,
            w: a.w, d: Math.max(overlapFront - a.z, 1), h: a.h,
            vx: -60, vy: 0, angVel: -2.5, rot: 0, baseColor: a.baseColor,
          });
        }
        if (a.z + a.d > overlapBack) {
          this.falling.push({
            x: a.x, y: a.y, z: overlapBack,
            w: a.w, d: Math.max((a.z + a.d) - overlapBack, 1), h: a.h,
            vx: 60, vy: 0, angVel: 2.5, rot: 0, baseColor: a.baseColor,
          });
        }
      }

      this.tower.push({
        x: top.x, y: a.y, z: placedZ,
        w: top.w, d: Math.max(placedD, 1), h: a.h,
        baseColor: a.baseColor,
      });
    }

    this.placedCount++;
    this.spawnNextBlock();
  }

  update(dt: number): void {
    if (!this.gameActive) {
      // Still animate falling chunks so game-over looks consistent.
      this.updateFalling(dt);
      return;
    }

    // Active block: slide-in then oscillate
    if (this.active) {
      const a = this.active;
      if (a.mode === 'entering') {
        a.enterT = Math.min(1, a.enterT + dt / Math.max(a.enterDuration, 0.0001));
        const t = 1 - Math.pow(1 - a.enterT, 3); // ease-out cubic
        const val = a.enterFrom + (a.enterTo - a.enterFrom) * t;
        if (a.axis === 'x') a.x = val; else a.z = val;
        if (a.enterT >= 1) {
          a.mode = 'oscillating';
          if (a.axis === 'x') a.x = a.enterTo; else a.z = a.enterTo;
        }
      } else if (a.axis === 'x') {
        a.x += a.dir * a.speed * dt;
        if (a.x <= 0) { a.x = 0; a.dir = 1; }
        else if (a.x + a.w >= this.width) { a.x = this.width - a.w; a.dir = -1; }
      } else {
        a.z += a.dir * a.speed * dt;
        // Z bounds: allow oscillation across a reasonable range
        const minZ = -a.d;
        const maxZ = a.d + BLOCK_DEPTH;
        if (a.z <= minZ) { a.z = minZ; a.dir = 1; }
        else if (a.z >= maxZ) { a.z = maxZ; a.dir = -1; }
      }
    }

    // Camera scroll
    if (this.cameraY !== this.targetCameraY) {
      const diff = this.targetCameraY - this.cameraY;
      const step = diff * Math.min(SCROLL_LERP * dt, 1);
      this.cameraY += step;
      if (Math.abs(this.targetCameraY - this.cameraY) < 0.5) {
        this.cameraY = this.targetCameraY;
      }
    }

    // Falling chunks
    this.updateFalling(dt);
  }

  private updateFalling(dt: number): void {
    if (this.falling.length === 0) return;
    const next: FallingChunk[] = [];
    for (const c of this.falling) {
      c.vy += GRAVITY * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;   // positive vy = downward (world y grows downward)
      c.rot += c.angVel * dt;

      // Cull when well below the visible screen (projected space).
      const projY = projectY(c.y + c.h / 2, c.z + c.d / 2) + this.cameraY;
      if (projY > this.height + 200) continue;
      next.push(c);
    }
    this.falling = next;
  }

  render(): void {
    const ctx = this.ctx;

    // Defensive transform reset (falling-chunk rotation leaves transform stacked
    // correctly via save/restore, but we reset at frame top as belt-and-braces).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(this.dpr, this.dpr);

    // Sky background (cached gradient)
    this.drawSky();

    const cy = this.cameraY;

    // Tower: bottom to top (painter's algorithm handles overlaps naturally)
    for (const block of this.tower) {
      if (this.isOffScreen(block, cy)) continue;
      this.drawBlock(
        block.x, block.y, block.z,
        block.w, block.d, block.h,
        block.baseColor, cy,
      );
    }

    // Active block
    if (this.active && this.gameActive) {
      const a = this.active;
      if (!this.isOffScreen(a, cy)) {
        this.drawBlock(a.x, a.y, a.z, a.w, a.d, a.h, a.baseColor, cy);
      }
    }

    // Falling chunks last so they visually sit in front of the tower
    for (const c of this.falling) {
      const cx = projectX(c.x + c.w / 2, c.z + c.d / 2);
      const ccy = projectY(c.y + c.h / 2, c.z + c.d / 2) + cy;
      ctx.save();
      ctx.translate(cx, ccy);
      ctx.rotate(c.rot);
      ctx.translate(-cx, -ccy);
      this.drawBlock(c.x, c.y, c.z, c.w, c.d, c.h, c.baseColor, cy);
      ctx.restore();
    }

    // HUD
    this.drawText(`${this.placedCount}`, this.width / 2, 48, {
      size: 44,
      color: TEXT_COLOR,
      weight: '700',
    });
    this.drawText('blocks', this.width / 2, 78, {
      size: 12,
      color: TEXT_COLOR,
      weight: '500',
    });
  }

  private isOffScreen(b: BlockTile, cy: number): boolean {
    // Rough AABB in projected space.
    // With top-down projection (y + z*ISO_DY), the highest screen point is
    // the smallest world y with smallest z, and lowest is largest y with
    // largest z.
    // With ISO_DY > 0 subtracted: higher z → lower screen y (higher on screen)
    const topScreen = projectY(b.y - b.h, b.z + b.d) + cy;     // highest point
    const bottomScreen = projectY(b.y, b.z) + cy;               // lowest point
    if (bottomScreen < -20) return true;
    if (topScreen > this.height + 20) return true;
    return false;
  }

  private drawSky(): void {
    const ctx = this.ctx;
    if (
      !this.skyGradient ||
      this.skyGradientW !== this.width ||
      this.skyGradientH !== this.height
    ) {
      const grad = ctx.createLinearGradient(0, 0, 0, this.height);
      grad.addColorStop(0, SKY_TOP);
      grad.addColorStop(0.55, SKY_MID);
      grad.addColorStop(1, SKY_BOT);
      this.skyGradient = grad;
      this.skyGradientW = this.width;
      this.skyGradientH = this.height;
    }
    ctx.fillStyle = this.skyGradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Horizon glow
    const glowY = this.height * 0.35;
    const glow = ctx.createRadialGradient(this.width * 0.5, glowY, 0, this.width * 0.5, glowY, this.width * 0.6);
    glow.addColorStop(0, 'rgba(255,255,255,0.35)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);

    // Sparkle particles
    for (const s of this.sparkles) {
      ctx.globalAlpha = s.alpha * (0.5 + 0.5 * Math.sin(performance.now() * 0.002 * s.speed));
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Draws the three visible faces of an axis-aligned block in cabinet
   *  oblique projection (90° Y-rotated: depth goes up-left).
   *  Order: left side → top → front (painter's algorithm, back to front). */
  private drawBlock(
    x: number, y: number, z: number,
    w: number, d: number, h: number,
    baseColor: string, cameraY: number,
  ): void {
    const ctx = this.ctx;

    const fy = y;           // front bottom in world y
    const ty = y - h;       // front top in world y
    const bz = z + d;       // back z

    const px = (wx: number, wz: number): number => projectX(wx, wz);
    const py = (wy: number, wz: number): number => projectY(wy, wz) + cameraY;

    // Projected points
    const AblX = px(x, z);         const AblY = py(fy, z);         // front-bottom-left
    const BbrX = px(x + w, z);     const BbrY = py(fy, z);         // front-bottom-right
    const AtlX = px(x, z);         const AtlY = py(ty, z);         // front-top-left
    const BtrX = px(x + w, z);     const BtrY = py(ty, z);         // front-top-right
    const DblX = px(x, bz);        const DblY = py(fy, bz);        // back-bottom-left
    const DtlX = px(x, bz);        const DtlY = py(ty, bz);        // back-top-left
    const DtrX = px(x + w, bz);    const DtrY = py(ty, bz);        // back-top-right

    const topColor = shade(baseColor, TOP_FACTOR);
    const sideColor = shade(baseColor, SIDE_FACTOR);
    const frontColor = shade(baseColor, FRONT_FACTOR);

    // 1. Left side (back-most — depth goes left, so left face is visible)
    ctx.fillStyle = sideColor;
    ctx.beginPath();
    ctx.moveTo(AblX, AblY);
    ctx.lineTo(DblX, DblY);
    ctx.lineTo(DtlX, DtlY);
    ctx.lineTo(AtlX, AtlY);
    ctx.closePath();
    ctx.fill();

    // 2. Top (parallelogram)
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(AtlX, AtlY);
    ctx.lineTo(BtrX, BtrY);
    ctx.lineTo(DtrX, DtrY);
    ctx.lineTo(DtlX, DtlY);
    ctx.closePath();
    ctx.fill();

    // 3. Front (rectangle, closest to camera)
    ctx.fillStyle = frontColor;
    ctx.beginPath();
    ctx.moveTo(AblX, AblY);
    ctx.lineTo(BbrX, BbrY);
    ctx.lineTo(BtrX, BtrY);
    ctx.lineTo(AtlX, AtlY);
    ctx.closePath();
    ctx.fill();

    // Edge lines for depth definition
    ctx.strokeStyle = shade(baseColor, 0.5);
    ctx.lineWidth = 0.8;
    // Front-top edge
    ctx.beginPath();
    ctx.moveTo(AtlX, AtlY);
    ctx.lineTo(BtrX, BtrY);
    ctx.stroke();
    // Top-back edge
    ctx.beginPath();
    ctx.moveTo(DtlX, DtlY);
    ctx.lineTo(DtrX, DtrY);
    ctx.stroke();
    // Left vertical edge
    ctx.beginPath();
    ctx.moveTo(DtlX, DtlY);
    ctx.lineTo(DblX, DblY);
    ctx.stroke();
  }

  // ── Save / Resume ───────────────────────────────────────────────────
  serialize(): GameSnapshot {
    return {
      tower: this.tower.map(b => ({
        x: b.x, y: b.y, z: b.z,
        w: b.w, d: b.d, h: b.h,
        baseColor: b.baseColor,
      })),
      active: this.active
        ? {
            x: this.active.x,
            y: this.active.y,
            z: this.active.z,
            w: this.active.w,
            d: this.active.d,
            h: this.active.h,
            baseColor: this.active.baseColor,
            dir: this.active.dir,
            speed: this.active.speed,
            mode: this.active.mode,
            enterT: this.active.enterT,
            enterFrom: this.active.enterFrom,
            enterTo: this.active.enterTo,
            enterDuration: this.active.enterDuration,
            axis: this.active.axis,
          }
        : null,
      cameraY: this.cameraY,
      targetCameraY: this.targetCameraY,
      placedCount: this.placedCount,
      gameActive: this.gameActive,
      nextEnterFromLeft: this.nextEnterFromLeft,
    };
  }

  deserialize(state: GameSnapshot): void {
    if (!state || typeof state !== 'object') return;

    const towerRaw = state.tower as unknown;
    if (!Array.isArray(towerRaw) || towerRaw.length === 0) return;

    const validTower: BlockTile[] = [];
    for (const raw of towerRaw) {
      if (!raw || typeof raw !== 'object') return;
      const b = raw as Record<string, unknown>;
      if (typeof b.x !== 'number' || typeof b.y !== 'number' || typeof b.w !== 'number') {
        return;
      }
      // Back-compat: older snapshots used `color`. Convert gracefully.
      const legacyColor = typeof b.color === 'string' ? (b.color as string) : undefined;
      const baseColor = typeof b.baseColor === 'string'
        ? (b.baseColor as string)
        : (legacyColor ?? PALETTE_TOP);
      // Back-compat: older snapshots had no z/d/h
      const z = typeof b.z === 'number' ? b.z : 0;
      const d = typeof b.d === 'number' ? b.d : BLOCK_DEPTH;
      const h = typeof b.h === 'number' ? b.h : BLOCK_HEIGHT;
      validTower.push({
        x: b.x, y: b.y, z,
        w: Math.max(b.w, 1), d, h,
        baseColor,
      });
    }
    this.tower = validTower;

    const activeRaw = state.active as unknown;
    if (
      activeRaw &&
      typeof activeRaw === 'object' &&
      typeof (activeRaw as Record<string, unknown>).x === 'number' &&
      typeof (activeRaw as Record<string, unknown>).y === 'number' &&
      typeof (activeRaw as Record<string, unknown>).w === 'number' &&
      typeof (activeRaw as Record<string, unknown>).dir === 'number' &&
      typeof (activeRaw as Record<string, unknown>).speed === 'number'
    ) {
      const ar = activeRaw as Record<string, unknown>;
      const legacyColor = typeof ar.color === 'string' ? (ar.color as string) : undefined;
      const baseColor = typeof ar.baseColor === 'string'
        ? (ar.baseColor as string)
        : (legacyColor ?? PALETTE_TOP);
      const z = typeof ar.z === 'number' ? ar.z : 0;
      const d = typeof ar.d === 'number' ? ar.d : BLOCK_DEPTH;
      const h = typeof ar.h === 'number' ? ar.h : BLOCK_HEIGHT;
      const mode: 'entering' | 'oscillating' =
        ar.mode === 'entering' ? 'entering' : 'oscillating';
      const enterT = typeof ar.enterT === 'number' ? ar.enterT : 1;
      const enterFrom = typeof ar.enterFrom === 'number' ? ar.enterFrom : (ar.x as number);
      const enterTo = typeof ar.enterTo === 'number' ? ar.enterTo : (ar.x as number);
      const enterDuration = typeof ar.enterDuration === 'number' ? ar.enterDuration : ENTER_DURATION;
      this.active = {
        x: ar.x as number,
        y: ar.y as number,
        z,
        w: Math.max(ar.w as number, 1),
        d, h,
        baseColor,
        dir: (ar.dir as number) >= 0 ? 1 : -1,
        speed: Math.max(ar.speed as number, 1),
        mode,
        enterT,
        enterFrom,
        enterTo,
        enterDuration,
        axis: ar.axis === 'z' ? 'z' : 'x',
      };
    } else {
      this.active = null;
    }

    if (typeof state.cameraY === 'number') this.cameraY = state.cameraY;
    if (typeof state.targetCameraY === 'number') {
      this.targetCameraY = state.targetCameraY;
    } else {
      this.targetCameraY = this.cameraY;
    }
    if (typeof state.placedCount === 'number') {
      this.placedCount = Math.max(0, Math.floor(state.placedCount));
    }
    if (typeof state.gameActive === 'boolean') this.gameActive = state.gameActive;
    if (typeof state.nextEnterFromLeft === 'boolean') {
      this.nextEnterFromLeft = state.nextEnterFromLeft;
    }
  }

  canSave(): boolean {
    if (!this.gameActive) return false;
    if (Math.abs(this.targetCameraY - this.cameraY) > 0.5) return false;
    // Don't save mid slide-in — state is transient
    if (this.active && this.active.mode === 'entering') return false;
    // Don't save while chunks are still falling
    if (this.falling.length > 0) return false;
    return true;
  }
}

registerGame({
  id: 'stack-block',
  name: 'Stack',
  description: 'Drop blocks to stack them as high as you can',
  icon: 'S',
  color: '--color-primary',
  bgGradient: ['#5A8A99', '#85AEBE'],
  category: 'arcade',
  createGame: (config) => new StackBlockGame(config),
  canvasWidth: 360,
  canvasHeight: 640,
  controls: 'Tap to drop the moving block',
});
