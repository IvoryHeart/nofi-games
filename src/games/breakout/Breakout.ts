import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Types ─────────────────────────────────────────────────────────────
interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  color: string;
  hitsRemaining: number;
}

interface DifficultyConfig {
  lives: number;
  ballSpeed: number;       // pixels/sec at level 1
  paddleWidthFrac: number; // paddle width as fraction of canvas width
  brickRows: number;
}

// ── Constants ─────────────────────────────────────────────────────────
const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { lives: 5, ballSpeed: 220, paddleWidthFrac: 0.28, brickRows: 3 }, // Easy
  { lives: 3, ballSpeed: 280, paddleWidthFrac: 0.22, brickRows: 4 }, // Medium
  { lives: 3, ballSpeed: 340, paddleWidthFrac: 0.16, brickRows: 5 }, // Hard
  { lives: 1, ballSpeed: 400, paddleWidthFrac: 0.14, brickRows: 6 }, // Extra Hard
];

// Warm-leaning brick palette (top → bottom rows)
const BRICK_COLORS = [
  '#E85D5D', // red
  '#F08260', // coral
  '#F5A058', // orange
  '#F5C758', // amber
  '#D49C62', // tan
  '#B97A6F', // dusty rose
];

const BG_COLOR = '#FEF0E4';
const HUD_TEXT = '#3D2B35';
const PADDLE_COLOR = '#8B5E83';
const PADDLE_HIGHLIGHT = '#A87BA0';
const BALL_COLOR = '#3D2B35';
const BRICK_BORDER = 'rgba(0,0,0,0.18)';

const HUD_HEIGHT = 44;
const BRICK_GAP = 4;
const BRICK_COLS = 6;
const BRICK_TOP_PADDING = 16;
const BRICK_SIDE_PADDING = 12;
const PADDLE_HEIGHT = 12;
const PADDLE_BOTTOM_GAP = 28;
const BALL_RADIUS = 7;
const MAX_BOUNCE_ANGLE = (Math.PI / 180) * 60; // 60° max from straight up
const LEVEL_SPEED_BOOST = 1.12;
const MAX_BALL_SPEED = 720;

// ── Game ──────────────────────────────────────────────────────────────
class BreakoutGame extends GameEngine {
  private diffConfig!: DifficultyConfig;

  // Paddle
  private paddleX = 0;     // top-left x
  private paddleY = 0;     // top-left y
  private paddleW = 0;
  private paddleH = PADDLE_HEIGHT;

  // Ball
  private ballX = 0;
  private ballY = 0;
  private ballVX = 0;
  private ballVY = 0;
  private ballRadius = BALL_RADIUS;
  private ballSpeed = 220;

  // Bricks
  private bricks: Brick[] = [];
  private brickW = 0;
  private brickH = 0;

  // State
  private lives = 3;
  private level = 1;
  private gameActive = false;
  private ballOnPaddle = true;

  // Input
  private leftKeyDown = false;
  private rightKeyDown = false;
  private readonly paddleKeySpeed = 380; // px/sec when holding arrow keys

  constructor(config: GameConfig) {
    super(config);
  }

  init(): void {
    const d = Math.max(0, Math.min(3, this.difficulty));
    this.diffConfig = DIFFICULTY_CONFIGS[d];

    this.lives = this.diffConfig.lives;
    this.level = 1;
    this.gameActive = true;
    this.leftKeyDown = false;
    this.rightKeyDown = false;

    // Paddle dimensions/position
    this.paddleW = Math.max(40, Math.floor(this.width * this.diffConfig.paddleWidthFrac));
    this.paddleH = PADDLE_HEIGHT;
    this.paddleY = this.height - PADDLE_BOTTOM_GAP - this.paddleH;
    this.paddleX = (this.width - this.paddleW) / 2;

    this.ballRadius = BALL_RADIUS;
    this.ballSpeed = this.diffConfig.ballSpeed;

    this.spawnBricks(this.level);
    this.spawnBall();

    // Pointer-follow mode: paddle tracks the mouse cursor without requiring
    // a click-drag. Trackpad and mouse users expect this; the base engine's
    // handlePointerMove only fires while pressed, so we attach our own
    // mousemove listener directly on the canvas and clean it up in destroy().
    if (!this.hoverHandler) {
      this.hoverHandler = (e: MouseEvent): void => {
        if (!this.gameActive) return;
        const rect = this.canvas.getBoundingClientRect();
        const scale = rect.width > 0 ? this.width / rect.width : 1;
        const logicalX = (e.clientX - rect.left) * scale;
        this.movePaddleTo(logicalX);
      };
      this.canvas.addEventListener('mousemove', this.hoverHandler as EventListener);
    }

    this.setScore(0);
    this.emitUpdate();
  }

  /** Hover-mode mousemove handler; initialized in init(), removed in destroy(). */
  private hoverHandler: ((e: MouseEvent) => void) | null = null;

  destroy(): void {
    if (this.hoverHandler) {
      this.canvas.removeEventListener('mousemove', this.hoverHandler as EventListener);
      this.hoverHandler = null;
    }
    super.destroy();
  }

  private emitUpdate(): void {
    this.onUpdate({ lives: this.lives, level: this.level });
  }

  // ── Brick spawning ───────────────────────────────────────────────────
  private spawnBricks(level: number): void {
    this.bricks = [];
    const rows = this.diffConfig.brickRows + Math.min(level - 1, 2); // small ramp
    const cols = BRICK_COLS;
    const totalGapW = BRICK_GAP * (cols + 1);
    const usableW = this.width - BRICK_SIDE_PADDING * 2 - totalGapW;
    const brickW = Math.max(8, Math.floor(usableW / cols));
    const brickH = 16;

    this.brickW = brickW;
    this.brickH = brickH;

    const startX = BRICK_SIDE_PADDING + BRICK_GAP;
    const startY = HUD_HEIGHT + BRICK_TOP_PADDING;

    let safetyRows = 0;
    const maxRows = Math.min(rows, 12); // hard cap
    while (safetyRows < maxRows) {
      const r = safetyRows;
      for (let c = 0; c < cols; c++) {
        const bx = startX + c * (brickW + BRICK_GAP);
        const by = startY + r * (brickH + BRICK_GAP);
        const colorIdx = r % BRICK_COLORS.length;
        // Higher levels: top row gets 2-hit bricks
        const tough = level >= 2 && r === 0;
        this.bricks.push({
          x: bx,
          y: by,
          w: brickW,
          h: brickH,
          alive: true,
          color: BRICK_COLORS[colorIdx],
          hitsRemaining: tough ? 2 : 1,
        });
      }
      safetyRows++;
    }
  }

  private spawnBall(): void {
    this.ballOnPaddle = true;
    this.ballX = this.paddleX + this.paddleW / 2;
    this.ballY = this.paddleY - this.ballRadius - 1;
    this.ballVX = 0;
    this.ballVY = 0;
  }

  private launchBall(): void {
    if (!this.ballOnPaddle) return;
    this.ballOnPaddle = false;
    // Slight randomized angle: -30°..+30° from straight up
    const angle = (this.rng() - 0.5) * (Math.PI / 3);
    const speed = this.currentSpeed();
    this.ballVX = Math.sin(angle) * speed;
    this.ballVY = -Math.cos(angle) * speed;
    this.playSound('click');
  }

  private currentSpeed(): number {
    const lvlBoost = Math.pow(LEVEL_SPEED_BOOST, this.level - 1);
    return Math.min(MAX_BALL_SPEED, this.ballSpeed * lvlBoost);
  }

  // ── Input ────────────────────────────────────────────────────────────
  protected handlePointerDown(x: number, _y: number): void {
    if (!this.gameActive) return;
    // Move paddle to follow finger immediately
    this.movePaddleTo(x);
    // Tap also launches the ball if waiting
    if (this.ballOnPaddle) this.launchBall();
  }

  protected handlePointerMove(x: number, _y: number): void {
    if (!this.gameActive) return;
    if (!this.pointer.down) return;
    this.movePaddleTo(x);
  }

  private movePaddleTo(centerX: number): void {
    let newX = centerX - this.paddleW / 2;
    if (newX < 0) newX = 0;
    if (newX + this.paddleW > this.width) newX = this.width - this.paddleW;
    this.paddleX = newX;
    if (this.ballOnPaddle) {
      this.ballX = this.paddleX + this.paddleW / 2;
    }
  }

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (!this.gameActive) return;
    switch (key) {
      case 'ArrowLeft': case 'a': case 'A':
        this.leftKeyDown = true;
        e.preventDefault();
        break;
      case 'ArrowRight': case 'd': case 'D':
        this.rightKeyDown = true;
        e.preventDefault();
        break;
      case ' ':
      case 'Enter':
      case 'Spacebar':
        if (this.ballOnPaddle) this.launchBall();
        e.preventDefault();
        break;
    }
  }

  protected handleKeyUp(key: string, _e: KeyboardEvent): void {
    switch (key) {
      case 'ArrowLeft': case 'a': case 'A':
        this.leftKeyDown = false;
        break;
      case 'ArrowRight': case 'd': case 'D':
        this.rightKeyDown = false;
        break;
    }
  }

  // ── Update / Physics ─────────────────────────────────────────────────
  update(dt: number): void {
    if (!this.gameActive) return;

    // Keyboard paddle movement
    if (this.leftKeyDown) {
      this.movePaddleTo(this.paddleX + this.paddleW / 2 - this.paddleKeySpeed * dt);
    }
    if (this.rightKeyDown) {
      this.movePaddleTo(this.paddleX + this.paddleW / 2 + this.paddleKeySpeed * dt);
    }

    if (this.ballOnPaddle) {
      // Stay glued
      this.ballX = this.paddleX + this.paddleW / 2;
      this.ballY = this.paddleY - this.ballRadius - 1;
      return;
    }

    // Integrate ball motion in two sub-steps for better collision stability
    const steps = 2;
    const stepDt = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.ballX += this.ballVX * stepDt;
      this.ballY += this.ballVY * stepDt;
      this.collideBall();
      if (!this.gameActive || this.ballOnPaddle) return;
    }
  }

  /** All collisions: walls, paddle, bricks, and bottom (lose-life). */
  private collideBall(): void {
    const r = this.ballRadius;

    // Left wall
    if (this.ballX - r < 0) {
      this.ballX = r;
      this.ballVX = Math.abs(this.ballVX);
      this.playSound('click');
    }
    // Right wall
    if (this.ballX + r > this.width) {
      this.ballX = this.width - r;
      this.ballVX = -Math.abs(this.ballVX);
      this.playSound('click');
    }
    // Top (HUD bottom)
    if (this.ballY - r < HUD_HEIGHT) {
      this.ballY = HUD_HEIGHT + r;
      this.ballVY = Math.abs(this.ballVY);
      this.playSound('click');
    }

    // Paddle collision (AABB-circle approximation, only when moving downward)
    if (this.ballVY > 0) {
      const px = this.paddleX;
      const py = this.paddleY;
      const pw = this.paddleW;
      const ph = this.paddleH;
      if (
        this.ballX + r >= px &&
        this.ballX - r <= px + pw &&
        this.ballY + r >= py &&
        this.ballY - r <= py + ph
      ) {
        // Reflect with bounce angle based on hit position relative to paddle center
        const hit = (this.ballX - (px + pw / 2)) / (pw / 2); // -1..1
        const clamped = Math.max(-1, Math.min(1, hit));
        const angle = clamped * MAX_BOUNCE_ANGLE;
        const speed = Math.max(this.currentSpeed(), Math.hypot(this.ballVX, this.ballVY));
        this.ballVX = Math.sin(angle) * speed;
        this.ballVY = -Math.abs(Math.cos(angle) * speed);
        // Nudge above paddle to avoid sticking
        this.ballY = py - r - 0.5;
        this.playSound('click');
        this.haptic('light');
      }
    }

    // Brick collisions
    let hitBrick: Brick | null = null;
    let hitFromX = false;
    for (let i = 0; i < this.bricks.length; i++) {
      const b = this.bricks[i];
      if (!b.alive) continue;
      if (
        this.ballX + r >= b.x &&
        this.ballX - r <= b.x + b.w &&
        this.ballY + r >= b.y &&
        this.ballY - r <= b.y + b.h
      ) {
        // Determine bounce axis: which side did we enter from
        const prevX = this.ballX - this.ballVX * 0.001;
        const prevY = this.ballY - this.ballVY * 0.001;
        const wasOutsideX = prevX + r <= b.x || prevX - r >= b.x + b.w;
        const wasOutsideY = prevY + r <= b.y || prevY - r >= b.y + b.h;
        if (wasOutsideX && !wasOutsideY) {
          hitFromX = true;
        } else if (wasOutsideY && !wasOutsideX) {
          hitFromX = false;
        } else {
          // Ambiguous: pick the smaller penetration
          const overlapX = Math.min(this.ballX + r - b.x, b.x + b.w - (this.ballX - r));
          const overlapY = Math.min(this.ballY + r - b.y, b.y + b.h - (this.ballY - r));
          hitFromX = overlapX < overlapY;
        }
        hitBrick = b;
        break;
      }
    }

    if (hitBrick) {
      hitBrick.hitsRemaining -= 1;
      if (hitBrick.hitsRemaining <= 0) {
        hitBrick.alive = false;
        this.addScore(10 * this.level);
      } else {
        // Tougher brick: still award a small score and shift color
        this.addScore(2 * this.level);
      }
      if (hitFromX) {
        this.ballVX = -this.ballVX;
      } else {
        this.ballVY = -this.ballVY;
      }
      this.haptic('light');

      // Level cleared?
      if (this.allBricksCleared()) {
        this.advanceLevel();
        return;
      }
    }

    // Fell below paddle?
    if (this.ballY - r > this.height) {
      this.lives -= 1;
      this.emitUpdate();
      this.haptic('medium');
      if (this.lives <= 0) {
        this.gameActive = false;
        this.gameOver();
        return;
      }
      this.spawnBall();
    }
  }

  private allBricksCleared(): boolean {
    for (let i = 0; i < this.bricks.length; i++) {
      if (this.bricks[i].alive) return false;
    }
    return true;
  }

  private advanceLevel(): void {
    this.level += 1;
    this.spawnBricks(this.level);
    this.spawnBall();
    this.emitUpdate();
    this.playSound('win');
  }

  // ── Render ───────────────────────────────────────────────────────────
  render(): void {
    this.clear(BG_COLOR);

    this.renderHUD();
    this.renderBricks();
    this.renderPaddle();
    this.renderBall();
  }

  private renderHUD(): void {
    const ctx = this.ctx;
    // Subtle HUD divider
    ctx.fillStyle = '#F5E2CC';
    ctx.fillRect(0, HUD_HEIGHT - 1, this.width, 1);

    this.drawText(`Score ${this.score}`, 12, HUD_HEIGHT / 2, {
      size: 14, color: HUD_TEXT, align: 'left',
    });
    this.drawText(`L${this.level}`, this.width / 2, HUD_HEIGHT / 2, {
      size: 14, color: HUD_TEXT, align: 'center',
    });
    // Lives as small circles on the right
    const heartR = 5;
    const spacing = 14;
    const startX = this.width - 12 - (this.lives - 1) * spacing;
    for (let i = 0; i < this.lives; i++) {
      this.drawCircle(startX + i * spacing, HUD_HEIGHT / 2, heartR, '#E85D5D');
    }
  }

  private renderBricks(): void {
    for (const b of this.bricks) {
      if (!b.alive) continue;
      // Shadow
      this.drawRoundRect(b.x + 1, b.y + 2, b.w, b.h, 3, 'rgba(0,0,0,0.08)');
      // Body
      const color = b.hitsRemaining > 1 ? this.darken(b.color) : b.color;
      this.drawRoundRect(b.x, b.y, b.w, b.h, 3, color, BRICK_BORDER);
      // Top highlight
      this.drawRoundRect(b.x + 2, b.y + 2, b.w - 4, b.h * 0.32, 2, 'rgba(255,255,255,0.22)');
    }
  }

  private darken(hex: string): string {
    // Quick approximation: just return a desaturated/darker variant
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const r = Math.max(0, parseInt(m[1], 16) - 40);
    const g = Math.max(0, parseInt(m[2], 16) - 40);
    const b = Math.max(0, parseInt(m[3], 16) - 40);
    return `rgb(${r},${g},${b})`;
  }

  private renderPaddle(): void {
    // Shadow
    this.drawRoundRect(this.paddleX + 1, this.paddleY + 2, this.paddleW, this.paddleH, 6, 'rgba(0,0,0,0.12)');
    // Body
    this.drawRoundRect(this.paddleX, this.paddleY, this.paddleW, this.paddleH, 6, PADDLE_COLOR);
    // Highlight
    this.drawRoundRect(
      this.paddleX + 4, this.paddleY + 2,
      this.paddleW - 8, this.paddleH * 0.35,
      4, PADDLE_HIGHLIGHT,
    );
  }

  private renderBall(): void {
    // Shadow
    this.drawCircle(this.ballX + 1, this.ballY + 2, this.ballRadius, 'rgba(0,0,0,0.15)');
    // Body
    this.drawCircle(this.ballX, this.ballY, this.ballRadius, BALL_COLOR);
    // Highlight
    this.drawCircle(
      this.ballX - this.ballRadius * 0.3,
      this.ballY - this.ballRadius * 0.3,
      this.ballRadius * 0.35,
      'rgba(255,255,255,0.5)',
    );
  }

  // ── Save / Resume ────────────────────────────────────────────────────
  serialize(): GameSnapshot {
    return {
      paddleX: this.paddleX,
      paddleY: this.paddleY,
      paddleW: this.paddleW,
      ballX: this.ballX,
      ballY: this.ballY,
      ballVX: this.ballVX,
      ballVY: this.ballVY,
      ballOnPaddle: this.ballOnPaddle,
      lives: this.lives,
      level: this.level,
      gameActive: this.gameActive,
      bricks: this.bricks.map(b => ({
        x: b.x, y: b.y, w: b.w, h: b.h,
        alive: b.alive, color: b.color,
        hitsRemaining: b.hitsRemaining,
      })),
    };
  }

  deserialize(state: GameSnapshot): void {
    if (!state || typeof state !== 'object') return;

    if (typeof state.paddleX === 'number') this.paddleX = state.paddleX;
    if (typeof state.paddleY === 'number') this.paddleY = state.paddleY;
    if (typeof state.paddleW === 'number' && state.paddleW > 0) this.paddleW = state.paddleW;
    if (typeof state.ballX === 'number') this.ballX = state.ballX;
    if (typeof state.ballY === 'number') this.ballY = state.ballY;
    if (typeof state.ballVX === 'number') this.ballVX = state.ballVX;
    if (typeof state.ballVY === 'number') this.ballVY = state.ballVY;
    if (typeof state.ballOnPaddle === 'boolean') this.ballOnPaddle = state.ballOnPaddle;
    if (typeof state.lives === 'number' && state.lives >= 0) this.lives = state.lives;
    if (typeof state.level === 'number' && state.level >= 1) this.level = state.level;
    if (typeof state.gameActive === 'boolean') this.gameActive = state.gameActive;

    const bricksRaw = state.bricks;
    if (Array.isArray(bricksRaw)) {
      const restored: Brick[] = [];
      for (const raw of bricksRaw) {
        if (!raw || typeof raw !== 'object') continue;
        const r = raw as Record<string, unknown>;
        if (
          typeof r.x === 'number' &&
          typeof r.y === 'number' &&
          typeof r.w === 'number' &&
          typeof r.h === 'number'
        ) {
          restored.push({
            x: r.x,
            y: r.y,
            w: r.w,
            h: r.h,
            alive: typeof r.alive === 'boolean' ? r.alive : true,
            color: typeof r.color === 'string' ? r.color : BRICK_COLORS[0],
            hitsRemaining: typeof r.hitsRemaining === 'number' ? r.hitsRemaining : 1,
          });
        }
      }
      if (restored.length > 0) this.bricks = restored;
    }

    this.emitUpdate();
  }

  canSave(): boolean {
    if (!this.gameActive) return false;
    return true;
  }
}

registerGame({
  id: 'breakout',
  name: 'Breakout',
  description: 'Bounce the ball, break the bricks',
  icon: 'B',
  color: '--color-primary',
  bgGradient: ['#E85D5D', '#F08280'],
  category: 'arcade',
  createGame: (config) => new BreakoutGame(config),
  canvasWidth: 360,
  canvasHeight: 540,
  controls: 'Drag or arrows to move paddle, tap to launch',
});
