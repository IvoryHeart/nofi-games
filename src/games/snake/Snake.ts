import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Types ─────────────────────────────────────────────────────────────
interface Point {
  x: number;
  y: number;
}

interface Direction {
  dx: number;
  dy: number;
}

interface DifficultyConfig {
  gridDim: number;
  startSpeed: number;
  obstacles: number;
  wrapEdges: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────
const DIRECTIONS: Record<string, Direction> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { gridDim: 14, startSpeed: 0.18, obstacles: 0, wrapEdges: false }, // Easy
  { gridDim: 18, startSpeed: 0.14, obstacles: 0, wrapEdges: false }, // Medium
  { gridDim: 18, startSpeed: 0.11, obstacles: 4, wrapEdges: false }, // Hard
  { gridDim: 22, startSpeed: 0.09, obstacles: 8, wrapEdges: true },  // Extra Hard
];

const HEAD_COLOR = '#8DC5A2';
const TAIL_COLOR = '#6BA882';
const FOOD_COLOR = '#E8928A';
const BG_COLOR = '#FEF0E4';
const GRID_LINE_COLOR = '#F0E4D4';
const WALL_COLOR = '#C5B0A0';
const OBSTACLE_COLOR = '#C5B0A0';

const MIN_INTERVAL = 0.05;

// ── Game ──────────────────────────────────────────────────────────────
class SnakeGame extends GameEngine {
  // Grid layout
  private gridDim = 18;
  private cellSize = 20;
  private offsetX = 0;
  private offsetY = 0;
  private diffConfig!: DifficultyConfig;

  // Game state
  private snake: Point[] = [];
  // Previous-tick positions for each segment, used to interpolate renders
  // smoothly between logical ticks. Kept 1:1 with `snake` at all times.
  private previousCells: Point[] = [];
  private direction: Direction = DIRECTIONS.right;
  private nextDirection: Direction = DIRECTIONS.right;
  private food: Point = { x: 0, y: 0 };
  private obstacles: Point[] = [];
  private moveTimer = 0;
  private moveInterval = 0.15;
  private growing = false;
  private gameActive = false;

  // Animation state
  // Fraction of the current move tick that has elapsed: 0 at the instant a
  // logical tick runs, 1 right as the next tick is about to run. Used to
  // interpolate each segment's rendered position between `previousCells`
  // and `snake`.
  private tickProgress = 0;
  private growAnimTimer = 0;
  private eatAnimScale = 0; // extra scale on head when eating
  private totalTime = 0; // running clock for pulsing etc.

  // ── Backward-compat aliases ───────────────────────────────────────────
  // Older tests and external code may read/write these legacy names; keep
  // them as getters/setters that forward to the canonical fields above.
  private get prevSnake(): Point[] { return this.previousCells; }
  private set prevSnake(v: Point[]) { this.previousCells = v; }
  private get moveProgress(): number { return this.tickProgress; }
  private set moveProgress(v: number) { this.tickProgress = v; }

  // Swipe detection
  private swipeStart: Point | null = null;

  // Scoring bonus
  private lastEatTime = 0;
  private consecutiveQuickEats = 0;
  private readonly quickEatThreshold = 3;

  constructor(config: GameConfig) {
    super(config);
  }

  init(): void {
    // Select difficulty config
    const d = Math.max(0, Math.min(3, this.difficulty));
    this.diffConfig = DIFFICULTY_CONFIGS[d];
    this.gridDim = this.diffConfig.gridDim;

    // Dynamic cell size: fit grid into canvas with 2 cells of margin
    this.cellSize = Math.floor(Math.min(this.width, this.height) / (this.gridDim + 2));

    // Center the grid in the canvas
    const gridPixelW = this.gridDim * this.cellSize;
    const gridPixelH = this.gridDim * this.cellSize;
    this.offsetX = Math.floor((this.width - gridPixelW) / 2);
    this.offsetY = Math.floor((this.height - gridPixelH) / 2);

    // Initialize snake in the center
    const cx = Math.floor(this.gridDim / 2);
    const cy = Math.floor(this.gridDim / 2);
    this.snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    this.previousCells = this.snake.map(p => ({ ...p }));

    this.direction = DIRECTIONS.right;
    this.nextDirection = DIRECTIONS.right;
    this.moveTimer = 0;
    this.moveInterval = this.diffConfig.startSpeed;
    this.growing = false;
    this.growAnimTimer = 0;
    this.eatAnimScale = 0;
    this.tickProgress = 0;
    this.totalTime = 0;
    this.gameActive = true;
    this.swipeStart = null;
    this.lastEatTime = 0;
    this.consecutiveQuickEats = 0;

    // Place obstacles
    this.obstacles = [];
    this.placeObstacles(this.diffConfig.obstacles);

    this.spawnFood();
    this.setScore(0);
  }

  private placeObstacles(count: number): void {
    if (count === 0) return;
    const occupied = new Set<string>();
    // Reserve snake area (center region)
    const cx = Math.floor(this.gridDim / 2);
    const cy = Math.floor(this.gridDim / 2);
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        occupied.add(`${cx + dx},${cy + dy}`);
      }
    }
    for (const seg of this.snake) {
      occupied.add(`${seg.x},${seg.y}`);
    }

    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < 500) {
      attempts++;
      const x = Math.floor(Math.random() * this.gridDim);
      const y = Math.floor(Math.random() * this.gridDim);
      const key = `${x},${y}`;
      if (!occupied.has(key)) {
        this.obstacles.push({ x, y });
        occupied.add(key);
        placed++;
      }
    }
  }

  private isObstacle(x: number, y: number): boolean {
    for (const o of this.obstacles) {
      if (o.x === x && o.y === y) return true;
    }
    return false;
  }

  private spawnFood(): void {
    const occupied = new Set<string>();
    for (const seg of this.snake) {
      occupied.add(`${seg.x},${seg.y}`);
    }
    for (const o of this.obstacles) {
      occupied.add(`${o.x},${o.y}`);
    }

    const emptyCells: Point[] = [];
    for (let x = 0; x < this.gridDim; x++) {
      for (let y = 0; y < this.gridDim; y++) {
        if (!occupied.has(`${x},${y}`)) {
          emptyCells.push({ x, y });
        }
      }
    }

    if (emptyCells.length === 0) {
      this.gameOver();
      return;
    }

    this.food = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  private isOpposite(a: Direction, b: Direction): boolean {
    return a.dx + b.dx === 0 && a.dy + b.dy === 0;
  }

  private setDirection(dir: Direction): void {
    if (!this.isOpposite(dir, this.direction)) {
      this.nextDirection = dir;
    }
  }

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (!this.gameActive) return;

    let dir: Direction | null = null;
    switch (key) {
      case 'ArrowUp': case 'w': case 'W':
        dir = DIRECTIONS.up; break;
      case 'ArrowDown': case 's': case 'S':
        dir = DIRECTIONS.down; break;
      case 'ArrowLeft': case 'a': case 'A':
        dir = DIRECTIONS.left; break;
      case 'ArrowRight': case 'd': case 'D':
        dir = DIRECTIONS.right; break;
    }

    if (dir) {
      e.preventDefault();
      this.setDirection(dir);
    }
  }

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;
    this.swipeStart = { x, y };
  }

  protected handlePointerMove(_x: number, _y: number): void {}

  protected handlePointerUp(x: number, y: number): void {
    if (!this.gameActive) return;

    if (this.swipeStart) {
      const dx = x - this.swipeStart.x;
      const dy = y - this.swipeStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 15) {
        if (Math.abs(dx) > Math.abs(dy)) {
          this.setDirection(dx > 0 ? DIRECTIONS.right : DIRECTIONS.left);
        } else {
          this.setDirection(dy > 0 ? DIRECTIONS.down : DIRECTIONS.up);
        }
      } else {
        // Tap: direction relative to snake head
        const head = this.snake[0];
        const headPx = this.gridToPixelCenter(head.x, head.y);
        const tapDx = x - headPx.x;
        const tapDy = y - headPx.y;
        if (Math.abs(tapDx) > Math.abs(tapDy)) {
          this.setDirection(tapDx > 0 ? DIRECTIONS.right : DIRECTIONS.left);
        } else {
          this.setDirection(tapDy > 0 ? DIRECTIONS.down : DIRECTIONS.up);
        }
      }
    }

    this.swipeStart = null;
  }

  /** Convert grid coords to the pixel center of a cell. */
  private gridToPixelCenter(gx: number, gy: number): Point {
    return {
      x: this.offsetX + gx * this.cellSize + this.cellSize / 2,
      y: this.offsetY + gy * this.cellSize + this.cellSize / 2,
    };
  }

  /**
   * Convert a grid cell to its center pixel coordinates. Accepts fractional
   * cell values so callers can pass an interpolated cell position directly
   * and get a smooth pixel location back.
   */
  private gridToPixel(cell: Point): Point {
    return {
      x: this.offsetX + cell.x * this.cellSize + this.cellSize / 2,
      y: this.offsetY + cell.y * this.cellSize + this.cellSize / 2,
    };
  }

  /** Wrap coordinate for Extra Hard mode */
  private wrap(v: number): number {
    return ((v % this.gridDim) + this.gridDim) % this.gridDim;
  }

  update(dt: number): void {
    if (!this.gameActive) return;

    this.totalTime += dt;

    // Decay eat animation
    if (this.growAnimTimer > 0) {
      this.growAnimTimer = Math.max(0, this.growAnimTimer - dt);
      this.eatAnimScale = Math.sin((this.growAnimTimer / 0.3) * Math.PI) * 0.35;
    } else {
      this.eatAnimScale = 0;
    }

    // Advance the interpolation clock by the fraction of a tick `dt` covers.
    // Guard against a zero interval so we never divide by zero if difficulty
    // math ever collapses `moveInterval` to 0.
    const interval = Math.max(this.moveInterval, MIN_INTERVAL);
    this.tickProgress += dt / interval;
    this.moveTimer += dt;

    // If we haven't crossed a full tick yet, clamp progress to [0, 1) and
    // return — the snake will visually slide toward its current `snake` cells
    // but no logical move has occurred yet.
    if (this.tickProgress < 1) {
      if (this.tickProgress < 0) this.tickProgress = 0;
      return;
    }

    // A full tick has elapsed: snapshot the pre-tick positions so renders
    // before the NEXT tick can lerp from them, then run logical movement.
    this.previousCells = this.snake.map(p => ({ ...p }));
    // Carry any overshoot into the next tick so fast frames don't visibly
    // pause at the cell boundary. Engine dt is capped such that at most
    // one tick runs per frame, so subtract 1 rather than looping.
    this.tickProgress = Math.max(0, this.tickProgress - 1);
    this.moveTimer = 0;

    // Apply queued direction
    if (!this.isOpposite(this.nextDirection, this.direction)) {
      this.direction = this.nextDirection;
    }

    // Compute new head position
    const head = this.snake[0];
    let newX = head.x + this.direction.dx;
    let newY = head.y + this.direction.dy;

    if (this.diffConfig.wrapEdges) {
      // Wrap around edges (Extra Hard)
      newX = this.wrap(newX);
      newY = this.wrap(newY);
    } else {
      // Wall collision
      if (newX < 0 || newX >= this.gridDim || newY < 0 || newY >= this.gridDim) {
        this.gameActive = false;
        this.gameOver();
        return;
      }
    }

    const newHead: Point = { x: newX, y: newY };

    // Obstacle collision
    if (this.isObstacle(newHead.x, newHead.y)) {
      this.gameActive = false;
      this.gameOver();
      return;
    }

    // Self collision
    const checkLength = this.growing ? this.snake.length : this.snake.length - 1;
    for (let i = 0; i < checkLength; i++) {
      if (this.snake[i].x === newHead.x && this.snake[i].y === newHead.y) {
        this.gameActive = false;
        this.gameOver();
        return;
      }
    }

    // Move snake. `previousCells` was snapshotted above to the pre-tick snake
    // and has length N (the pre-tick length). For the non-grow path,
    // previousCells[i] already equals the pre-tick snake[i], which is exactly
    // where the post-tick segment at index i came from (each body segment
    // follows the one in front of it). No further adjustment is needed.
    this.snake.unshift(newHead);

    if (this.growing) {
      this.growing = false;
      // Snake just grew by 1. The new post-tick segment layout is
      //   [newHead, H, B1, B2, ..., tail]   (length N+1)
      // where H is the pre-tick head. Visually:
      //   - head slides from H to newHead
      //   - every other segment stays put (the tail didn't retract)
      // Extend previousCells by inserting the pre-tick head at the front,
      // so previousCells[i] == the visual origin of snake[i] post-tick.
      // Critically, the new tail index (previousCells.length-1) still
      // points at the same cell as snake's last entry, so the newly
      // appended tail segment has prev == curr and appears in place.
      this.previousCells.unshift({ x: head.x, y: head.y });
    } else {
      this.snake.pop();
      // previousCells already matches snake by index — nothing to do.
    }

    // Check food
    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      this.growing = true;
      this.growAnimTimer = 0.3;

      // Score calculation with bonus
      const now = performance.now() / 1000;
      let points = 10;
      if (this.lastEatTime > 0 && (now - this.lastEatTime) < this.quickEatThreshold) {
        this.consecutiveQuickEats++;
        points += this.consecutiveQuickEats * 5;
      } else {
        this.consecutiveQuickEats = 0;
      }
      this.lastEatTime = now;

      this.addScore(points);
      this.spawnFood();

      // Increase speed as snake grows
      const lengthFactor = (this.snake.length - 3) / (this.gridDim * this.gridDim * 0.3);
      this.moveInterval = this.diffConfig.startSpeed -
        (this.diffConfig.startSpeed - MIN_INTERVAL) * Math.min(lengthFactor, 1);
    }
  }

  render(): void {
    const ctx = this.ctx;

    // Background
    this.clear(BG_COLOR);

    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;
    const gridPx = this.gridDim * cs;

    // Draw subtle grid lines
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= this.gridDim; i++) {
      const px = ox + i * cs;
      const py = oy + i * cs;
      ctx.beginPath();
      ctx.moveTo(px, oy);
      ctx.lineTo(px, oy + gridPx);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox, py);
      ctx.lineTo(ox + gridPx, py);
      ctx.stroke();
    }

    // Draw border around play area
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(ox - 1, oy - 1, gridPx + 2, gridPx + 2);

    // If wrap-around mode, draw dashed border to indicate permeability
    if (this.diffConfig.wrapEdges) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#A09080';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox - 1, oy - 1, gridPx + 2, gridPx + 2);
      ctx.setLineDash([]);
    }

    // Draw obstacles
    for (const o of this.obstacles) {
      const bx = ox + o.x * cs + 1;
      const by = oy + o.y * cs + 1;
      const bs = cs - 2;
      this.drawRoundRect(bx + 1, by + 1, bs, bs, 3, 'rgba(0,0,0,0.06)');
      this.drawRoundRect(bx, by, bs, bs, 3, OBSTACLE_COLOR);
      // Inner highlight
      this.drawRoundRect(bx + 2, by + 2, bs - 4, bs - 4, 2, 'rgba(255,255,255,0.15)');
    }

    // Draw food with pulsing animation
    this.renderFood();

    // Draw snake with smooth interpolation
    this.renderSnake();
  }

  private renderFood(): void {
    const cs = this.cellSize;
    const cx = this.offsetX + this.food.x * cs + cs / 2;
    const cy = this.offsetY + this.food.y * cs + cs / 2;
    const baseRadius = cs / 2 - 3;

    // Pulsing: scale 0.9 to 1.1 over ~1s using sin wave
    const pulse = 0.9 + 0.2 * (0.5 + 0.5 * Math.sin(this.totalTime * Math.PI * 2));
    const r = baseRadius * pulse;

    // Shadow
    this.drawCircle(cx + 1, cy + 2, r, 'rgba(0,0,0,0.08)');

    // Main food circle
    this.drawCircle(cx, cy, r, FOOD_COLOR);

    // Highlight
    this.drawCircle(cx - r * 0.2, cy - r * 0.2, r * 0.3, 'rgba(255,255,255,0.45)');
  }

  /**
   * Compute interpolated pixel positions for every snake segment, head-first.
   * Handles wrap-around mode so segments don't fly across the board.
   */
  private computeSnakePoints(t: number): Point[] {
    const len = this.snake.length;
    const points: Point[] = [];

    for (let i = 0; i < len; i++) {
      const curr = this.snake[i];
      const prev = this.previousCells[i] || curr;

      let interpX: number;
      let interpY: number;

      if (this.diffConfig.wrapEdges) {
        let dx = curr.x - prev.x;
        let dy = curr.y - prev.y;
        if (dx > this.gridDim / 2) dx -= this.gridDim;
        if (dx < -this.gridDim / 2) dx += this.gridDim;
        if (dy > this.gridDim / 2) dy -= this.gridDim;
        if (dy < -this.gridDim / 2) dy += this.gridDim;
        interpX = prev.x + dx * t;
        interpY = prev.y + dy * t;
      } else {
        interpX = prev.x + (curr.x - prev.x) * t;
        interpY = prev.y + (curr.y - prev.y) * t;
      }

      points.push(this.gridToPixel({ x: interpX, y: interpY }));
    }

    return points;
  }

  /**
   * Draw a smooth continuous body curve through the given points.
   * Uses quadratic Bezier curves through midpoints for an S-curve effect.
   * Uniform width — no taper, just a clean thick rope.
   */
  private drawSmoothBody(
    points: Point[],
    cs: number,
    color: string,
  ): void {
    if (points.length < 2) return;
    const ctx = this.ctx;
    const gap = cs * 0.08;
    const bodyWidth = cs - gap * 2;

    ctx.strokeStyle = color;
    ctx.lineWidth = bodyWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    // Finish with a line to the very last point
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  private renderSnake(): void {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const len = this.snake.length;
    const t = this.easeOut(Math.min(Math.max(this.tickProgress, 0), 1));

    // 1. Compute all interpolated pixel positions (head to tail)
    const points = this.computeSnakePoints(t);

    if (points.length === 0) return;

    // 2. Draw body shadow
    ctx.save();
    ctx.translate(1, 1.5);
    this.drawSmoothBody(points, cs, 'rgba(0,0,0,0.06)');
    ctx.restore();

    // 3. Draw the smooth body
    this.drawSmoothBody(points, cs, TAIL_COLOR);

    // 4. Draw head on top — slightly larger circle with gradient color
    const headPt = points[0];
    const gap = cs * 0.08;
    let headRadius = cs / 2 - gap + cs * 0.04;

    // Eat animation: brief scale-up on head
    if (this.eatAnimScale > 0) {
      headRadius += this.eatAnimScale * cs * 0.15;
    }

    // Head shadow
    this.drawCircle(headPt.x + 1, headPt.y + 1.5, headRadius, 'rgba(0,0,0,0.06)');

    // Head circle
    this.drawCircle(headPt.x, headPt.y, headRadius, HEAD_COLOR);

    // Head highlight
    this.drawCircle(
      headPt.x - headRadius * 0.15,
      headPt.y - headRadius * 0.18,
      headRadius * 0.45,
      'rgba(255,255,255,0.15)',
    );

    // Eyes
    this.drawEyes(headPt.x, headPt.y, headRadius);
  }

  private drawEyes(cx: number, cy: number, halfSize: number): void {
    const scale = halfSize / 10; // normalize relative to typical half-size
    const eyeOffset = 3.8 * scale;
    const eyeSpread = 3.5 * scale;
    const eyeRadius = 2.4 * scale;
    const pupilRadius = 1.3 * scale;

    let eye1X: number, eye1Y: number, eye2X: number, eye2Y: number;

    if (this.direction === DIRECTIONS.right) {
      eye1X = cx + eyeOffset; eye1Y = cy - eyeSpread;
      eye2X = cx + eyeOffset; eye2Y = cy + eyeSpread;
    } else if (this.direction === DIRECTIONS.left) {
      eye1X = cx - eyeOffset; eye1Y = cy - eyeSpread;
      eye2X = cx - eyeOffset; eye2Y = cy + eyeSpread;
    } else if (this.direction === DIRECTIONS.up) {
      eye1X = cx - eyeSpread; eye1Y = cy - eyeOffset;
      eye2X = cx + eyeSpread; eye2Y = cy - eyeOffset;
    } else {
      eye1X = cx - eyeSpread; eye1Y = cy + eyeOffset;
      eye2X = cx + eyeSpread; eye2Y = cy + eyeOffset;
    }

    // White of eyes
    this.drawCircle(eye1X, eye1Y, eyeRadius, '#FFFFFF');
    this.drawCircle(eye2X, eye2Y, eyeRadius, '#FFFFFF');

    // Pupils offset toward movement direction
    const pupilShift = 0.6 * scale;
    const pdx = this.direction.dx * pupilShift;
    const pdy = this.direction.dy * pupilShift;
    this.drawCircle(eye1X + pdx, eye1Y + pdy, pupilRadius, '#2D3748');
    this.drawCircle(eye2X + pdx, eye2Y + pdy, pupilRadius, '#2D3748');
  }

  private lerpColor(colorA: string, colorB: string, t: number): string {
    const a = this.hexToRgb(colorA);
    const b = this.hexToRgb(colorB);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${bl})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  // ── Save / Resume ───────────────────────────────────────────────────
  serialize(): GameSnapshot {
    return {
      snake: this.snake.map(p => ({ x: p.x, y: p.y })),
      // Persist previousCells and tickProgress so a resumed game can
      // pick up mid-interpolation if needed. Older snapshots that lack
      // these fields are handled gracefully in deserialize().
      previousCells: this.previousCells.map(p => ({ x: p.x, y: p.y })),
      tickProgress: this.tickProgress,
      direction: { dx: this.direction.dx, dy: this.direction.dy },
      nextDirection: { dx: this.nextDirection.dx, dy: this.nextDirection.dy },
      food: { x: this.food.x, y: this.food.y },
      obstacles: this.obstacles.map(o => ({ x: o.x, y: o.y })),
      growing: this.growing,
      moveInterval: this.moveInterval,
      gameActive: this.gameActive,
      lastEatTime: this.lastEatTime,
      consecutiveQuickEats: this.consecutiveQuickEats,
    };
  }

  deserialize(state: GameSnapshot): void {
    if (!state || typeof state !== 'object') return;

    const snakeRaw = state.snake as Point[] | undefined;
    if (!Array.isArray(snakeRaw) || snakeRaw.length === 0) return;
    const foodRaw = state.food as Point | undefined;
    if (!foodRaw || typeof foodRaw.x !== 'number' || typeof foodRaw.y !== 'number') return;
    const dirRaw = state.direction as Direction | undefined;
    if (!dirRaw || typeof dirRaw.dx !== 'number' || typeof dirRaw.dy !== 'number') return;

    // Restore snake body (deep clone)
    this.snake = snakeRaw.map(p => ({ x: p.x, y: p.y }));

    // Restore previousCells if the snapshot has a valid one of the same
    // length; otherwise default to a copy of `snake` so the resumed game
    // renders stably at rest (no phantom slide). Older snapshots that
    // predate the interpolation fields land here gracefully.
    const prevRaw = state.previousCells as Point[] | undefined;
    if (
      Array.isArray(prevRaw) &&
      prevRaw.length === this.snake.length &&
      prevRaw.every(p => p && typeof p.x === 'number' && typeof p.y === 'number')
    ) {
      this.previousCells = prevRaw.map(p => ({ x: p.x, y: p.y }));
    } else {
      this.previousCells = this.snake.map(p => ({ ...p }));
    }

    // Restore direction (match against canonical DIRECTIONS where possible
    // so identity comparisons in drawEyes still work)
    const matchDir = (d: Direction): Direction => {
      for (const key of Object.keys(DIRECTIONS)) {
        const c = DIRECTIONS[key];
        if (c.dx === d.dx && c.dy === d.dy) return c;
      }
      return { dx: d.dx, dy: d.dy };
    };
    this.direction = matchDir(dirRaw);

    const nextDirRaw = state.nextDirection as Direction | undefined;
    if (nextDirRaw && typeof nextDirRaw.dx === 'number' && typeof nextDirRaw.dy === 'number') {
      this.nextDirection = matchDir(nextDirRaw);
    } else {
      this.nextDirection = this.direction;
    }

    // Restore food
    this.food = { x: foodRaw.x, y: foodRaw.y };

    // Restore obstacles (deep clone, defensive)
    const obstaclesRaw = state.obstacles as Point[] | undefined;
    if (Array.isArray(obstaclesRaw)) {
      this.obstacles = obstaclesRaw
        .filter(o => o && typeof o.x === 'number' && typeof o.y === 'number')
        .map(o => ({ x: o.x, y: o.y }));
    }

    if (typeof state.growing === 'boolean') this.growing = state.growing;
    if (typeof state.moveInterval === 'number') this.moveInterval = state.moveInterval;
    if (typeof state.gameActive === 'boolean') this.gameActive = state.gameActive;
    if (typeof state.lastEatTime === 'number') this.lastEatTime = state.lastEatTime;
    if (typeof state.consecutiveQuickEats === 'number') {
      this.consecutiveQuickEats = state.consecutiveQuickEats;
    }

    // Clear transient animation state so the resumed game starts stable.
    // We deliberately reset tickProgress to 0 regardless of what the
    // snapshot carried, so the resumed snake lands exactly on its grid
    // cells and won't jitter for a fraction of a tick on first render.
    this.moveTimer = 0;
    this.tickProgress = 0;
    this.growAnimTimer = 0;
    this.eatAnimScale = 0;
    this.swipeStart = null;
  }

  canSave(): boolean {
    // Don't save mid-eat-animation (transient grow/scale interpolation in flight),
    // and only save while the game is actively running.
    if (!this.gameActive) return false;
    if (this.growAnimTimer > 0) return false;
    return true;
  }
}

registerGame({
  id: 'snake',
  name: 'Snake',
  description: 'Eat, grow, don\'t crash!',
  icon: '\u2219',
  color: '--game-snake',
  bgGradient: ['#3CAA3C', '#7DD87D'],
  category: 'arcade',
  createGame: (config) => new SnakeGame(config),
  canvasWidth: 360,
  canvasHeight: 360,
  controls: 'Swipe or arrow keys to turn',
});
