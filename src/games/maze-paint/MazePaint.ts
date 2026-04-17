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
const SLIDE_SPEED_CELLS_PER_SEC = 14;  // ball slides this fast
const WIN_DELAY_MS = 1500;

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
  private queuedDir: Direction | null = null;

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
    this.animating = true;
    this.moves++;
    this.onUpdate({ moves: this.moves });
    this.playSound('move');
  }

  private completeSlide(): void {
    const { dc, dr } = DIR_VECTORS[this.currentDir()];
    let c = this.animFromCol;
    let r = this.animFromRow;
    // Paint every cell along the slide path (including destination).
    // The starting cell is already painted; walk forward until we reach the end.
    while (!(c === this.animToCol && r === this.animToRow)) {
      c += dc;
      r += dr;
      this.paintCell(c, r);
    }
    this.ballCol = this.animToCol;
    this.ballRow = this.animToRow;
    this.animating = false;
    this.haptic('light');

    if (this.paintedCount === this.floorCount && !this.winScheduled) {
      this.handleSolved();
      return;
    }

    // Dequeue a pending direction, if any
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
      if (this.animElapsed >= this.animDuration) {
        this.completeSlide();
      }
    }
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
    this.renderBall();
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
    // Interpolate ball position during slide
    let col: number, row: number;
    if (this.animating) {
      const t = Math.min(1, this.animElapsed / Math.max(this.animDuration, 0.001));
      col = this.animFromCol + (this.animToCol - this.animFromCol) * t;
      row = this.animFromRow + (this.animToRow - this.animFromRow) * t;
    } else {
      col = this.ballCol;
      row = this.ballRow;
    }
    const { x, y } = this.cellCenter(col, row);
    const r = this.tileSize * 0.38;
    // Shadow
    this.drawCircle(x + 1, y + 3, r, BALL_SHADOW);
    // Ball
    this.drawCircle(x, y - 1, r, BALL_COLOR);
    // Highlight
    this.drawCircle(x - r * 0.3, y - r * 0.45, r * 0.28, BALL_HIGHLIGHT);
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
