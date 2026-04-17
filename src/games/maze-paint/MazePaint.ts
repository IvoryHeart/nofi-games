import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';
import { Level, Direction, DIR_VECTORS, DIRS, isFloor, floorCells } from './types';
import { slide } from './solver';
import { generateDaily } from './generator';
import type { DifficultyBucket } from './solver';

const BUCKETS: DifficultyBucket[] = ['easy', 'medium', 'hard', 'expert'];

// ── Layout constants ────────────────────────────────────────────
const TOP_HUD = 72;
const BOTTOM_PAD = 68;
const SIDE_PAD = 20;
const MAX_TILE_PX = 56;
const MIN_TILE_PX = 20;

// ── Visuals ─────────────────────────────────────────────────────
const BG = '#FEF0E4';
const FLOOR_TOP = '#5A5458';        // unpainted floor (warm dark gray)
const FLOOR_SIDE = '#3D2B35';       // side shadow
const FLOOR_GROUT = '#4A4145';      // grid line between tiles
const PAINT_TOP = '#D14E5C';        // painted tile top
const PAINT_SIDE = '#8F2D3A';       // painted side
const PAINT_GROUT = '#B13A48';      // painted grout
const WALL_CAP = '#E8DDD0';         // cream caps on top edges
const BALL_COLOR = '#FFFFFF';
const BALL_HIGHLIGHT = 'rgba(255,255,255,0.9)';
const BALL_SHADOW = 'rgba(61,43,53,0.35)';

// ── Animation ───────────────────────────────────────────────────
const SLIDE_SPEED_CELLS_PER_SEC = 22;  // cells per second — snappy
const WIN_DELAY_MS = 1500;
const SQUISH_DURATION = 0.35;          // seconds for the ball to un-squish
const SQUISH_AMOUNT = 0.34;            // initial squish ratio
const PARTICLE_LIFE_MIN = 0.28;
const PARTICLE_LIFE_MAX = 0.55;
const PARTICLE_SPAWN_PER_SEC = 90;     // target spawn rate while rolling
const PARTICLE_COLORS = ['#F5C06E', '#FFD1B5', '#E89088', '#F5A623'];

class MazePaintGame extends GameEngine {
  private level!: Level;
  private ballCol = 0;
  private ballRow = 0;
  private painted: Uint8Array = new Uint8Array(0);
  private floorCount = 0;
  private paintedCount = 0;
  private moves = 0;

  // Slide animation
  private animating = false;
  private animFromCol = 0;
  private animFromRow = 0;
  private animToCol = 0;
  private animToRow = 0;
  private animDist = 0;
  private animElapsed = 0;
  private animDuration = 0;
  /** Index (1..animDist) of the last cell painted during the current slide. */
  private animPaintedIdx = 0;
  private queuedDir: Direction | null = null;

  // Squish-on-hit animation (plays after a slide completes).
  // squishDir is the direction the ball was moving when it hit the wall —
  // the ball squashes along that axis.
  private squishTimer = 0;
  private squishDir: Direction | null = null;

  // Sparkle particle trail — spawned behind the ball during a slide.
  private particles: Array<{
    x: number; y: number; vx: number; vy: number;
    life: number; maxLife: number; size: number; color: string;
  }> = [];
  private particleSpawnAccum = 0;

  // Layout
  private tileSize = 32;
  private gridX = 0;
  private gridY = 0;

  // Input
  private swipeStart: { x: number; y: number } | null = null;
  private swipeMoved = false;

  // Lifecycle
  private gameActive = false;
  private winScheduled = false;

  constructor(config: GameConfig) {
    super(config);
  }

  // ── Lifecycle ─────────────────────────────────────────────

  init(): void {
    const d = Math.max(0, Math.min(3, this.difficulty));
    const bucket = BUCKETS[d];
    // Use the engine's seeded rng when present so Daily Mode is deterministic.
    // Otherwise pick a fresh puzzle each session.
    const seed = this.seed ?? Math.floor(Math.random() * 2_147_483_647);
    const gen = generateDaily(seed, bucket);
    this.level = gen.level;

    this.ballCol = this.level.start.col;
    this.ballRow = this.level.start.row;
    this.painted = new Uint8Array(this.level.cols * this.level.rows);
    this.paintedCount = 0;
    this.floorCount = floorCells(this.level).length;
    this.moves = 0;
    this.animating = false;
    this.queuedDir = null;
    this.gameActive = true;
    this.winScheduled = false;
    this.swipeStart = null;
    this.squishTimer = 0;
    this.squishDir = null;
    this.particles = [];
    this.particleSpawnAccum = 0;

    // Paint the starting cell
    this.paintCell(this.ballCol, this.ballRow);

    this.computeLayout();
    this.setScore(0);
  }

  private computeLayout(): void {
    const availW = Math.max(this.width - SIDE_PAD * 2, 1);
    const availH = Math.max(this.height - TOP_HUD - BOTTOM_PAD, 1);
    const tileByW = Math.floor(availW / this.level.cols);
    const tileByH = Math.floor(availH / this.level.rows);
    this.tileSize = Math.max(MIN_TILE_PX, Math.min(MAX_TILE_PX, Math.min(tileByW, tileByH)));
    const gridW = this.tileSize * this.level.cols;
    const gridH = this.tileSize * this.level.rows;
    this.gridX = Math.floor((this.width - gridW) / 2);
    this.gridY = Math.floor(TOP_HUD + (availH - gridH) / 2);
  }

  // ── Input ─────────────────────────────────────────────────

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (!this.gameActive) return;
    let dir: Direction | null = null;
    switch (key) {
      case 'ArrowUp': case 'w': case 'W': dir = 'up'; break;
      case 'ArrowDown': case 's': case 'S': dir = 'down'; break;
      case 'ArrowLeft': case 'a': case 'A': dir = 'left'; break;
      case 'ArrowRight': case 'd': case 'D': dir = 'right'; break;
    }
    if (dir) {
      e.preventDefault();
      this.tryStartSlide(dir);
    }
  }

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;
    this.swipeStart = { x, y };
    this.swipeMoved = false;
  }

  protected handlePointerMove(x: number, y: number): void {
    if (!this.swipeStart) return;
    const dx = x - this.swipeStart.x;
    const dy = y - this.swipeStart.y;
    if (Math.hypot(dx, dy) > 6) this.swipeMoved = true;
  }

  protected handlePointerUp(x: number, y: number): void {
    if (!this.gameActive || !this.swipeStart) { this.swipeStart = null; return; }
    const dx = x - this.swipeStart.x;
    const dy = y - this.swipeStart.y;
    const dist = Math.hypot(dx, dy);
    this.swipeStart = null;

    if (dist > 20) {
      // Swipe
      const dir: Direction = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up');
      this.tryStartSlide(dir);
    } else if (!this.swipeMoved) {
      // Tap relative to ball position
      const ballPx = this.cellCenter(this.ballCol, this.ballRow);
      const tx = x - ballPx.x;
      const ty = y - ballPx.y;
      if (Math.abs(tx) < 4 && Math.abs(ty) < 4) return;
      const dir: Direction = Math.abs(tx) > Math.abs(ty)
        ? (tx > 0 ? 'right' : 'left')
        : (ty > 0 ? 'down' : 'up');
      this.tryStartSlide(dir);
    }
  }

  private tryStartSlide(dir: Direction): void {
    if (!this.gameActive) return;
    if (this.animating) {
      this.queuedDir = dir; // queue — will run when current slide completes
      return;
    }
    this.beginSlide(dir);
  }

  private beginSlide(dir: Direction): void {
    const end = slide(this.level, this.ballCol, this.ballRow, dir);
    if (end.col === this.ballCol && end.row === this.ballRow) {
      // No movement — direction blocked
      return;
    }
    this.animFromCol = this.ballCol;
    this.animFromRow = this.ballRow;
    this.animToCol = end.col;
    this.animToRow = end.row;
    this.animDist = Math.abs(end.col - this.ballCol) + Math.abs(end.row - this.ballRow);
    this.animElapsed = 0;
    this.animDuration = this.animDist / SLIDE_SPEED_CELLS_PER_SEC;
    this.animPaintedIdx = 0;
    this.animating = true;
    this.moves++;
    this.onUpdate({ moves: this.moves });
    this.playSound('move');
  }

  /** Paint all cells along the slide path up to `targetIdx` (inclusive). */
  private paintUpToIndex(targetIdx: number): void {
    const { dc, dr } = DIR_VECTORS[this.currentDir()];
    while (this.animPaintedIdx < targetIdx) {
      this.animPaintedIdx++;
      const c = this.animFromCol + dc * this.animPaintedIdx;
      const r = this.animFromRow + dr * this.animPaintedIdx;
      this.paintCell(c, r);
    }
  }

  private completeSlide(): void {
    // Flush any remaining cells (covers rounding at t=1)
    this.paintUpToIndex(this.animDist);
    this.ballCol = this.animToCol;
    this.ballRow = this.animToRow;
    this.animating = false;

    // Trigger squish — ball just hit a wall
    this.squishTimer = SQUISH_DURATION;
    this.squishDir = this.currentDir();
    this.haptic('light');

    if (this.paintedCount === this.floorCount && !this.winScheduled) {
      this.handleSolved();
      return;
    }

    // Dequeue a pending direction, if any (mid-squish is fine — the ball
    // takes off again immediately, squish continues to decay visually)
    if (this.queuedDir) {
      const next = this.queuedDir;
      this.queuedDir = null;
      this.beginSlide(next);
    }
  }

  private currentDir(): Direction {
    if (this.animToCol > this.animFromCol) return 'right';
    if (this.animToCol < this.animFromCol) return 'left';
    if (this.animToRow > this.animFromRow) return 'down';
    return 'up';
  }

  private paintCell(col: number, row: number): void {
    if (!isFloor(this.level, col, row)) return;
    const k = row * this.level.cols + col;
    if (this.painted[k] === 1) return;
    this.painted[k] = 1;
    this.paintedCount++;
    this.playSound('tap');
  }

  private handleSolved(): void {
    this.winScheduled = true;
    this.gameActive = false;
    // Score: 1000 base, minus 5 per move beyond a generous par. Never negative.
    const par = Math.max(this.floorCount / 2, 5);
    const excess = Math.max(0, this.moves - par);
    const final = Math.max(100, Math.round(1000 - excess * 15));
    this.setScore(final);
    this.gameWin();
    setTimeout(() => this.gameOver(), WIN_DELAY_MS);
  }

  // ── Update / Render ───────────────────────────────────────

  update(dt: number): void {
    if (this.animating) {
      this.animElapsed += dt;
      const t = Math.min(1, this.animElapsed / Math.max(this.animDuration, 0.001));
      // Paint cells under the ball as it crosses them — eliminates the
      // "trail lags behind ball" feel.
      const reachedIdx = Math.min(this.animDist, Math.floor(t * this.animDist + 1e-4));
      if (reachedIdx > this.animPaintedIdx) this.paintUpToIndex(reachedIdx);

      // Spawn sparkle particles from just behind the ball while rolling.
      this.spawnTrailParticles(dt);

      if (t >= 1) this.completeSlide();
    }
    // Squish decays whether or not we're animating (can overlap with next slide)
    if (this.squishTimer > 0) {
      this.squishTimer = Math.max(0, this.squishTimer - dt);
      if (this.squishTimer === 0) this.squishDir = null;
    }
    // Update particles
    this.updateParticles(dt);
  }

  private spawnTrailParticles(dt: number): void {
    this.particleSpawnAccum += dt * PARTICLE_SPAWN_PER_SEC;
    if (this.particleSpawnAccum < 1) return;
    const count = Math.floor(this.particleSpawnAccum);
    this.particleSpawnAccum -= count;
    const pos = this.interpolatedBallPos();
    const cx = this.gridX + pos.col * this.tileSize + this.tileSize / 2;
    const cy = this.gridY + pos.row * this.tileSize + this.tileSize / 2;
    const { dc, dr } = DIR_VECTORS[this.currentDir()];
    for (let i = 0; i < count; i++) {
      const jitter = this.tileSize * 0.22;
      // Spawn slightly behind the ball (opposite motion direction)
      const sx = cx - dc * this.tileSize * 0.25 + (this.rng() - 0.5) * jitter;
      const sy = cy - dr * this.tileSize * 0.25 + (this.rng() - 0.5) * jitter;
      // Velocity: mostly outward with a backward bias
      const angle = this.rng() * Math.PI * 2;
      const speed = 20 + this.rng() * 50;
      const vx = Math.cos(angle) * speed - dc * 30;
      const vy = Math.sin(angle) * speed - dr * 30;
      const life = PARTICLE_LIFE_MIN + this.rng() * (PARTICLE_LIFE_MAX - PARTICLE_LIFE_MIN);
      this.particles.push({
        x: sx, y: sy, vx, vy,
        life, maxLife: life,
        size: 1.5 + this.rng() * 2.2,
        color: PARTICLE_COLORS[Math.floor(this.rng() * PARTICLE_COLORS.length)],
      });
    }
    // Hard cap to bound memory/rendering cost
    if (this.particles.length > 160) {
      this.particles.splice(0, this.particles.length - 160);
    }
  }

  private updateParticles(dt: number): void {
    if (this.particles.length === 0) return;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Gentle deceleration
      const decay = Math.pow(0.25, dt);
      p.vx *= decay;
      p.vy *= decay;
    }
  }

  private interpolatedBallPos(): { col: number; row: number } {
    if (!this.animating) return { col: this.ballCol, row: this.ballRow };
    const t = Math.min(1, this.animElapsed / Math.max(this.animDuration, 0.001));
    return {
      col: this.animFromCol + (this.animToCol - this.animFromCol) * t,
      row: this.animFromRow + (this.animToRow - this.animFromRow) * t,
    };
  }

  getHudStats(): Array<{ label: string; value: string }> {
    return [
      { label: 'Painted', value: `${this.paintedCount}/${this.floorCount}` },
      { label: 'Moves', value: `${this.moves}` },
    ];
  }

  render(): void {
    this.clear(BG);
    this.renderTiles();
    this.renderParticles();
    this.renderBall();
  }

  private renderParticles(): void {
    for (const p of this.particles) {
      const t = p.life / p.maxLife; // 1 → 0 as it fades
      const alpha = Math.max(0, Math.min(1, t));
      this.ctx.globalAlpha = alpha;
      this.drawCircle(p.x, p.y, p.size * (0.4 + t * 0.6), p.color);
    }
    this.ctx.globalAlpha = 1;
  }

  private renderTiles(): void {
    const s = this.tileSize;
    const depth = Math.max(3, Math.round(s * 0.14)); // side thickness
    // First pass: side/shadow faces (south edge of each tile)
    for (let r = 0; r < this.level.rows; r++) {
      for (let c = 0; c < this.level.cols; c++) {
        if (!isFloor(this.level, c, r)) continue;
        const x = this.gridX + c * s;
        const y = this.gridY + r * s;
        const painted = this.painted[r * this.level.cols + c] === 1;
        // Side is only visible when the cell below is NOT a floor tile
        if (!isFloor(this.level, c, r + 1)) {
          this.ctx.fillStyle = painted ? PAINT_SIDE : FLOOR_SIDE;
          this.ctx.fillRect(x, y + s, s, depth);
        }
      }
    }
    // Second pass: top faces + grid lines
    for (let r = 0; r < this.level.rows; r++) {
      for (let c = 0; c < this.level.cols; c++) {
        if (!isFloor(this.level, c, r)) continue;
        const x = this.gridX + c * s;
        const y = this.gridY + r * s;
        const painted = this.painted[r * this.level.cols + c] === 1;
        this.ctx.fillStyle = painted ? PAINT_TOP : FLOOR_TOP;
        this.ctx.fillRect(x, y, s, s);
        // Grout lines between adjacent floor cells (draw on east/south edges).
        this.ctx.fillStyle = painted ? PAINT_GROUT : FLOOR_GROUT;
        if (isFloor(this.level, c + 1, r)) {
          this.ctx.fillRect(x + s - 1, y, 1, s);
        }
        if (isFloor(this.level, c, r + 1)) {
          this.ctx.fillRect(x, y + s - 1, s, 1);
        }
      }
    }
    // Third pass: cream "wall caps" on top edges (where the north neighbor is empty)
    const capHeight = Math.max(2, Math.round(s * 0.08));
    this.ctx.fillStyle = WALL_CAP;
    for (let r = 0; r < this.level.rows; r++) {
      for (let c = 0; c < this.level.cols; c++) {
        if (!isFloor(this.level, c, r)) continue;
        if (isFloor(this.level, c, r - 1)) continue;
        const x = this.gridX + c * s;
        const y = this.gridY + r * s;
        this.ctx.fillRect(x - 1, y - capHeight, s + 2, capHeight);
      }
    }
  }

  private cellCenter(col: number, row: number): { x: number; y: number } {
    const s = this.tileSize;
    return {
      x: this.gridX + col * s + s / 2,
      y: this.gridY + row * s + s / 2,
    };
  }

  private renderBall(): void {
    const pos = this.interpolatedBallPos();
    const { x, y } = this.cellCenter(pos.col, pos.row);
    const r = this.tileSize * 0.38;

    // Squish: scale perpendicular to motion axis when the ball recently
    // hit a wall. Amplitude decays with time, with one gentle overshoot.
    let scaleX = 1;
    let scaleY = 1;
    if (this.squishTimer > 0 && this.squishDir) {
      const tElapsed = 1 - this.squishTimer / SQUISH_DURATION; // 0 → 1
      // One cycle of damped cosine — ball flattens, overshoots past round, settles.
      const amp = SQUISH_AMOUNT * Math.cos(tElapsed * Math.PI * 2.2) * (1 - tElapsed);
      if (this.squishDir === 'left' || this.squishDir === 'right') {
        scaleX = 1 - amp;
        scaleY = 1 + amp * 0.7;
      } else {
        scaleY = 1 - amp;
        scaleX = 1 + amp * 0.7;
      }
    }

    // Draw the ball with applied squish. Shadow uses the same squish so the
    // whole thing feels physical.
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.scale(scaleX, scaleY);
    // Shadow (slightly offset downward/rightward — done pre-scale transform so
    // it moves with the ball's deformed outline)
    this.drawCircle(1, 3, r, BALL_SHADOW);
    this.drawCircle(0, -1, r, BALL_COLOR);
    this.drawCircle(-r * 0.3, -r * 0.45, r * 0.28, BALL_HIGHLIGHT);
    this.ctx.restore();
  }

  // ── Save / Resume ─────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      cols: this.level.cols,
      rows: this.level.rows,
      cells: Array.from(this.level.cells),
      start: { col: this.level.start.col, row: this.level.start.row },
      ballCol: this.ballCol,
      ballRow: this.ballRow,
      painted: Array.from(this.painted),
      paintedCount: this.paintedCount,
      floorCount: this.floorCount,
      moves: this.moves,
      gameActive: this.gameActive,
    };
  }

  deserialize(state: GameSnapshot): void {
    const cols = state.cols as number | undefined;
    const rows = state.rows as number | undefined;
    const cellsArr = state.cells as number[] | undefined;
    const start = state.start as { col: number; row: number } | undefined;
    const painted = state.painted as number[] | undefined;

    if (
      typeof cols !== 'number' || typeof rows !== 'number' ||
      !Array.isArray(cellsArr) || cellsArr.length !== cols * rows ||
      !start || typeof start.col !== 'number' || typeof start.row !== 'number' ||
      !Array.isArray(painted) || painted.length !== cols * rows
    ) {
      return; // corrupt — keep fresh init state
    }

    this.level = {
      cols,
      rows,
      cells: new Uint8Array(cellsArr),
      start: { col: start.col, row: start.row },
    };
    this.painted = new Uint8Array(painted);
    this.ballCol = (state.ballCol as number | undefined) ?? start.col;
    this.ballRow = (state.ballRow as number | undefined) ?? start.row;
    this.paintedCount = (state.paintedCount as number | undefined) ?? 0;
    this.floorCount = (state.floorCount as number | undefined) ?? floorCells(this.level).length;
    this.moves = (state.moves as number | undefined) ?? 0;
    this.gameActive = (state.gameActive as boolean | undefined) ?? true;
    this.animating = false;
    this.queuedDir = null;
    this.winScheduled = false;
    this.computeLayout();
  }

  canSave(): boolean {
    return this.gameActive && !this.animating;
  }

  // ── Test hooks ────────────────────────────────────────────
  /** Force-apply a direction for tests. Runs the slide + paint synchronously. */
  testSlide(dir: Direction): void {
    if (!this.gameActive) return;
    if (!DIRS.includes(dir)) return;
    const end = slide(this.level, this.ballCol, this.ballRow, dir);
    if (end.col === this.ballCol && end.row === this.ballRow) return;
    const { dc, dr } = DIR_VECTORS[dir];
    let c = this.ballCol, r = this.ballRow;
    this.moves++;
    while (!(c === end.col && r === end.row)) {
      c += dc; r += dr;
      this.paintCell(c, r);
    }
    this.ballCol = end.col;
    this.ballRow = end.row;
    if (this.paintedCount === this.floorCount && !this.winScheduled) {
      this.handleSolved();
    }
  }
}

registerGame({
  id: 'maze-paint',
  name: 'Maze Paint',
  description: 'Roll the ball to paint every tile',
  icon: 'MP',
  color: '--color-primary',
  bgGradient: ['#D14E5C', '#F4A0A8'],
  category: 'puzzle',
  createGame: (config) => new MazePaintGame(config),
  canvasWidth: 360,
  canvasHeight: 640,
  controls: 'Swipe or arrow keys — ball slides until it hits a wall',
  dailyMode: true,
});

export { MazePaintGame };
