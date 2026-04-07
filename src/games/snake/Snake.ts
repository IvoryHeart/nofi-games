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
  private prevSnake: Point[] = []; // positions from last tick (for lerp)
  private direction: Direction = DIRECTIONS.right;
  private nextDirection: Direction = DIRECTIONS.right;
  private food: Point = { x: 0, y: 0 };
  private obstacles: Point[] = [];
  private moveTimer = 0;
  private moveInterval = 0.15;
  private growing = false;
  private gameActive = false;

  // Animation state
  private moveProgress = 0; // 0..1 between ticks
  private growAnimTimer = 0;
  private eatAnimScale = 0; // extra scale on head when eating
  private totalTime = 0; // running clock for pulsing etc.

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
    this.prevSnake = this.snake.map(p => ({ ...p }));

    this.direction = DIRECTIONS.right;
    this.nextDirection = DIRECTIONS.right;
    this.moveTimer = 0;
    this.moveInterval = this.diffConfig.startSpeed;
    this.growing = false;
    this.growAnimTimer = 0;
    this.eatAnimScale = 0;
    this.moveProgress = 0;
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

  /** Convert grid coords to pixel center */
  private gridToPixelCenter(gx: number, gy: number): Point {
    return {
      x: this.offsetX + gx * this.cellSize + this.cellSize / 2,
      y: this.offsetY + gy * this.cellSize + this.cellSize / 2,
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

    this.moveTimer += dt;

    // Calculate interpolation progress between ticks
    this.moveProgress = Math.min(this.moveTimer / this.moveInterval, 1);

    if (this.moveTimer < this.moveInterval) return;
    this.moveTimer -= this.moveInterval;
    this.moveProgress = 0;

    // Snapshot current positions for interpolation on next frame
    this.prevSnake = this.snake.map(p => ({ ...p }));

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

    // Move snake
    this.snake.unshift(newHead);

    if (this.growing) {
      this.growing = false;
      // Also extend prevSnake to match length by duplicating last
      this.prevSnake.unshift({ ...head });
    } else {
      this.snake.pop();
      // Insert prev head at front of prevSnake
      this.prevSnake.unshift({ ...head });
      this.prevSnake.pop();
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

  private renderSnake(): void {
    const cs = this.cellSize;
    const ox = this.offsetX;
    const oy = this.offsetY;
    const len = this.snake.length;
    const t = this.easeOut(this.moveProgress); // eased interpolation progress

    // Draw from tail to head so head is always on top
    for (let i = len - 1; i >= 0; i--) {
      const curr = this.snake[i];
      const prev = this.prevSnake[i] || curr;

      // Interpolate pixel position
      let interpX: number;
      let interpY: number;

      // Handle wrapping interpolation for Extra Hard mode
      if (this.diffConfig.wrapEdges) {
        let dx = curr.x - prev.x;
        let dy = curr.y - prev.y;
        // If the difference is more than half the grid, it wrapped
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

      const pixelX = ox + interpX * cs + cs / 2;
      const pixelY = oy + interpY * cs + cs / 2;

      // Color gradient from tail to head
      const colorT = len > 1 ? i / (len - 1) : 0;
      const color = this.lerpColor(TAIL_COLOR, HEAD_COLOR, colorT);

      const gap = cs * 0.08;
      let halfW = cs / 2 - gap;
      let halfH = cs / 2 - gap;

      // Head is slightly larger
      if (i === 0) {
        const headExpand = cs * 0.04;
        halfW += headExpand;
        halfH += headExpand;

        // Eat animation: brief scale-up
        if (this.eatAnimScale > 0) {
          const extra = this.eatAnimScale * cs * 0.15;
          halfW += extra;
          halfH += extra;
        }
      }

      const cornerRadius = i === 0 ? cs * 0.28 : cs * 0.2;

      const segX = pixelX - halfW;
      const segY = pixelY - halfH;
      const segW = halfW * 2;
      const segH = halfH * 2;

      // Shadow
      this.drawRoundRect(segX + 1, segY + 1.5, segW, segH, cornerRadius, 'rgba(0,0,0,0.06)');

      // Body
      this.drawRoundRect(segX, segY, segW, segH, cornerRadius, color);

      // Subtle inner highlight on each segment
      if (i === 0) {
        this.drawRoundRect(
          segX + segW * 0.1, segY + segH * 0.08,
          segW * 0.8, segH * 0.35,
          cornerRadius * 0.7,
          'rgba(255,255,255,0.15)'
        );
      }

      // Draw eyes on head
      if (i === 0) {
        this.drawEyes(pixelX, pixelY, halfW);
      }
    }
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
    // Reset interpolation buffer so resumed game renders stably
    this.prevSnake = this.snake.map(p => ({ ...p }));

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

    // Clear transient animation state so the resumed game starts stable
    this.moveTimer = 0;
    this.moveProgress = 0;
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
