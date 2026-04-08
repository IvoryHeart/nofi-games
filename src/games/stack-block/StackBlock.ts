import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Types ─────────────────────────────────────────────────────────────
interface BlockTile {
  x: number;       // world x (left edge)
  y: number;       // world y (top edge); negative = above ground
  w: number;       // width
  color: string;
}

interface ActiveBlock extends BlockTile {
  dir: number;     // -1 or 1 (direction of horizontal slide)
  speed: number;   // px / second
}

interface DifficultyConfig {
  baseSpeed: number;       // px/sec slide speed
  startWidth: number;      // starting block width
  perfectTolerance: number; // px tolerance for perfect stack
  speedRamp: number;       // additional speed per block placed
}

// ── Constants ─────────────────────────────────────────────────────────
const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { baseSpeed: 140, startWidth: 140, perfectTolerance: 4, speedRamp: 0 },     // Easy
  { baseSpeed: 200, startWidth: 110, perfectTolerance: 2, speedRamp: 0 },     // Medium
  { baseSpeed: 280, startWidth: 90,  perfectTolerance: 0, speedRamp: 0 },     // Hard
  { baseSpeed: 320, startWidth: 80,  perfectTolerance: 0, speedRamp: 8 },     // Extra Hard
];

const BLOCK_HEIGHT = 28;
const GROUND_OFFSET = 80;        // distance from canvas bottom to top of base block
const ACTIVE_GAP = 8;            // gap between active block and last placed block
const SCROLL_TRIGGER_RATIO = 0.45; // when active block goes above this ratio of height, scroll

const BG_COLOR = '#FEF0E4';
const GROUND_COLOR = '#C5B0A0';
const TEXT_COLOR = '#3D2B35';
const BASE_COLOR = '#8B5E83';

// Warm palette gradient from mauve → peach → orange
const PALETTE = [
  '#8B5E83',
  '#A06585',
  '#B86E84',
  '#C97D7E',
  '#D88B78',
  '#E29973',
  '#E8A66E',
  '#EBB36B',
];

const PERFECT_BONUS = 10;
const PLACE_POINTS = 5;
const SCROLL_LERP = 6;            // smoothing factor for camera

// ── Game ──────────────────────────────────────────────────────────────
class StackBlockGame extends GameEngine {
  private tower: BlockTile[] = [];
  private active: ActiveBlock | null = null;
  private cameraY = 0;          // current world offset (positive = scrolled up)
  private targetCameraY = 0;    // smooth-scroll target
  private gameActive = false;
  private diffConfig!: DifficultyConfig;
  private placedCount = 0;      // how many blocks placed (excluding base)

  constructor(config: GameConfig) {
    super(config);
  }

  init(): void {
    const d = Math.max(0, Math.min(3, this.difficulty));
    this.diffConfig = DIFFICULTY_CONFIGS[d];

    this.tower = [];
    this.active = null;
    this.cameraY = 0;
    this.targetCameraY = 0;
    this.gameActive = true;
    this.placedCount = 0;

    // Base block: centred, slightly wider than the start width
    const baseW = this.diffConfig.startWidth + 20;
    const baseX = (this.width - baseW) / 2;
    const baseY = this.height - GROUND_OFFSET - BLOCK_HEIGHT;
    this.tower.push({
      x: baseX,
      y: baseY,
      w: baseW,
      color: BASE_COLOR,
    });

    this.spawnNextBlock();
    this.setScore(0);
  }

  private getBlockColor(index: number): string {
    // Cycle through warm palette by index
    return PALETTE[index % PALETTE.length];
  }

  private spawnNextBlock(): void {
    if (this.tower.length === 0) return;
    const top = this.tower[this.tower.length - 1];
    const newY = top.y - BLOCK_HEIGHT - ACTIVE_GAP;
    // New block inherits current top width (for partial overlap chains)
    const newW = top.w;
    // Start aligned with the top block's x so the slide animation starts smoothly
    const startX = top.x;
    const speed = this.diffConfig.baseSpeed + this.placedCount * this.diffConfig.speedRamp;
    this.active = {
      x: startX,
      y: newY,
      w: newW,
      color: this.getBlockColor(this.placedCount + 1),
      dir: 1,
      speed,
    };

    // Update camera target so the active block stays in the upper portion
    // of the visible area but is not too close to the top.
    const visibleTopThreshold = this.height * SCROLL_TRIGGER_RATIO;
    // World-space y of the active block, after camera offset, should equal visibleTopThreshold.
    // screenY = worldY + cameraY  →  cameraY = screenY - worldY
    const desiredCameraY = visibleTopThreshold - newY;
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

    // Compute overlap interval [overlapLeft, overlapRight]
    const overlapLeft = Math.max(a.x, top.x);
    const overlapRight = Math.min(a.x + a.w, top.x + top.w);
    const overlap = overlapRight - overlapLeft;

    if (overlap <= 0) {
      // No overlap → game over
      this.gameActive = false;
      this.haptic('heavy');
      this.playSound('gameOver');
      this.gameOver();
      return;
    }

    // Check perfect alignment within tolerance
    const offset = Math.abs(a.x - top.x);
    const isPerfect = offset <= this.diffConfig.perfectTolerance;

    let placedX: number;
    let placedW: number;

    if (isPerfect) {
      // Snap to top block's x and keep full width
      placedX = top.x;
      placedW = top.w;
      this.addScore(PLACE_POINTS + PERFECT_BONUS);
      this.playSound('score');
      this.haptic('medium');
    } else {
      // Chop overhang: new block is the overlap region only
      placedX = overlapLeft;
      placedW = overlap;
      this.addScore(PLACE_POINTS);
      this.playSound('place');
      this.haptic('light');
    }

    // Guard against zero/NaN width
    placedW = Math.max(placedW, 1);

    this.tower.push({
      x: placedX,
      y: a.y,
      w: placedW,
      color: a.color,
    });
    this.placedCount++;

    // Spawn next active block (game continues endlessly)
    this.spawnNextBlock();
  }

  update(dt: number): void {
    if (!this.gameActive) return;

    // Slide active block back and forth
    if (this.active) {
      const a = this.active;
      a.x += a.dir * a.speed * dt;
      // Bounce off canvas edges
      if (a.x <= 0) {
        a.x = 0;
        a.dir = 1;
      } else if (a.x + a.w >= this.width) {
        a.x = this.width - a.w;
        a.dir = -1;
      }
    }

    // Smooth camera scroll toward target
    if (this.cameraY !== this.targetCameraY) {
      const diff = this.targetCameraY - this.cameraY;
      const step = diff * Math.min(SCROLL_LERP * dt, 1);
      this.cameraY += step;
      // Snap when close enough
      if (Math.abs(this.targetCameraY - this.cameraY) < 0.5) {
        this.cameraY = this.targetCameraY;
      }
    }
  }

  render(): void {
    const ctx = this.ctx;
    this.clear(BG_COLOR);

    const cy = this.cameraY;

    // Draw tower (offset by camera)
    for (const block of this.tower) {
      const sy = block.y + cy;
      // Cull off-screen blocks (below or above visible area)
      if (sy > this.height + 4) continue;
      if (sy + BLOCK_HEIGHT < -4) continue;

      // Shadow
      this.drawRoundRect(block.x + 1, sy + 2, block.w, BLOCK_HEIGHT, 4, 'rgba(0,0,0,0.10)');
      this.drawRoundRect(block.x, sy, block.w, BLOCK_HEIGHT, 4, block.color);
      // Inner highlight
      this.drawRoundRect(
        block.x + 2,
        sy + 2,
        Math.max(block.w - 4, 1),
        BLOCK_HEIGHT * 0.35,
        3,
        'rgba(255,255,255,0.18)',
      );
    }

    // Draw active block
    if (this.active && this.gameActive) {
      const a = this.active;
      const sy = a.y + cy;
      this.drawRoundRect(a.x + 1, sy + 2, a.w, BLOCK_HEIGHT, 4, 'rgba(0,0,0,0.10)');
      this.drawRoundRect(a.x, sy, a.w, BLOCK_HEIGHT, 4, a.color);
      this.drawRoundRect(
        a.x + 2,
        sy + 2,
        Math.max(a.w - 4, 1),
        BLOCK_HEIGHT * 0.35,
        3,
        'rgba(255,255,255,0.20)',
      );
    }

    // Ground line (static, not affected by camera)
    const groundY = this.height - GROUND_OFFSET + BLOCK_HEIGHT;
    // Only draw the ground line when it's actually visible after camera offset.
    // The base block is anchored at world position; once the camera scrolls up
    // significantly the ground would visually drift down off-screen, but that's
    // fine because we draw it relative to the canvas (acts as a fixed UI line).
    if (this.cameraY < 4) {
      ctx.strokeStyle = GROUND_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(this.width, groundY);
      ctx.stroke();
    }

    // Score (height in blocks) — top of screen
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

  // ── Save / Resume ───────────────────────────────────────────────────
  serialize(): GameSnapshot {
    return {
      tower: this.tower.map(b => ({ x: b.x, y: b.y, w: b.w, color: b.color })),
      active: this.active
        ? {
            x: this.active.x,
            y: this.active.y,
            w: this.active.w,
            color: this.active.color,
            dir: this.active.dir,
            speed: this.active.speed,
          }
        : null,
      cameraY: this.cameraY,
      targetCameraY: this.targetCameraY,
      placedCount: this.placedCount,
      gameActive: this.gameActive,
    };
  }

  deserialize(state: GameSnapshot): void {
    if (!state || typeof state !== 'object') return;

    const towerRaw = state.tower as BlockTile[] | undefined;
    if (!Array.isArray(towerRaw) || towerRaw.length === 0) return;

    // Validate every tower entry before committing
    const validTower: BlockTile[] = [];
    for (const b of towerRaw) {
      if (
        !b ||
        typeof b.x !== 'number' ||
        typeof b.y !== 'number' ||
        typeof b.w !== 'number' ||
        typeof b.color !== 'string'
      ) {
        return; // bail out on malformed snapshot
      }
      validTower.push({ x: b.x, y: b.y, w: Math.max(b.w, 1), color: b.color });
    }
    this.tower = validTower;

    const activeRaw = state.active as ActiveBlock | null | undefined;
    if (
      activeRaw &&
      typeof activeRaw.x === 'number' &&
      typeof activeRaw.y === 'number' &&
      typeof activeRaw.w === 'number' &&
      typeof activeRaw.color === 'string' &&
      typeof activeRaw.dir === 'number' &&
      typeof activeRaw.speed === 'number'
    ) {
      this.active = {
        x: activeRaw.x,
        y: activeRaw.y,
        w: Math.max(activeRaw.w, 1),
        color: activeRaw.color,
        dir: activeRaw.dir >= 0 ? 1 : -1,
        speed: Math.max(activeRaw.speed, 1),
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
  }

  canSave(): boolean {
    if (!this.gameActive) return false;
    // Don't save while camera is still smooth-scrolling between blocks
    if (Math.abs(this.targetCameraY - this.cameraY) > 0.5) return false;
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
