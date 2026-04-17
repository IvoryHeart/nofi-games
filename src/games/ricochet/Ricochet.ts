import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';
import { RicochetLevel, Target, Obstacle, BallState } from './types';
import { generateLevel, RicochetBucket } from './generator';

const BUCKETS: RicochetBucket[] = ['easy', 'medium', 'hard', 'expert'];

// ── Layout ────────────────────────────────────────────────
const TOP_HUD = 72;
const BOTTOM_PAD = 24;

// ── Visuals ───────────────────────────────────────────────
const BG = '#FEF0E4';
const ARENA_BG = '#F5E7D5';
const ARENA_BORDER = '#8B5E83';
const OBSTACLE_COLOR = '#5A4048';
const OBSTACLE_HIGHLIGHT = '#7B5A66';
const TARGET_COLOR = '#D14E5C';
const TARGET_RING = '#8F2D3A';
const TARGET_DESTROYED = 'rgba(141,45,58,0.20)';
const BALL_COLOR = '#FFFFFF';
const BALL_SHADOW = 'rgba(61,43,53,0.3)';
const AIM_COLOR = 'rgba(139,94,131,0.9)';

// ── Physics ───────────────────────────────────────────────
const BALL_RADIUS = 8;
const POWER_MIN = 120;        // px/s
const POWER_MAX = 760;        // px/s
const POWER_DRAG_MAX = 120;   // drag px that maps to POWER_MAX
const FRICTION_PER_SEC = 0.55; // multiplicative velocity decay per second
const STOP_SPEED = 20;        // below this, ball stops
const MAX_BOUNCES = 18;       // hard cap to avoid pathological sims
const SUBSTEPS = 5;
const WIN_DELAY_MS = 1500;
const GAME_OVER_DELAY_MS = 1200;

class RicochetGame extends GameEngine {
  private level!: RicochetLevel;
  private targets: Target[] = [];
  private obstacles: Obstacle[] = [];
  private ball: BallState = {
    x: 0, y: 0, vx: 0, vy: 0, radius: BALL_RADIUS, active: false, bounces: 0,
  };
  private dartsRemaining = 0;

  // Layout — logical arena to canvas mapping
  private arenaX = 0;
  private arenaY = 0;
  private arenaScale = 1;

  // Aim state
  private aiming = false;
  private aimPointerX = 0;
  private aimPointerY = 0;

  // Lifecycle
  private gameActive = false;
  private winScheduled = false;
  private loseScheduled = false;

  // Reset-to-start animation (after the ball comes to rest)
  private resetting = false;
  private resetFromX = 0;
  private resetFromY = 0;
  private resetElapsed = 0;
  private readonly resetDuration = 0.28; // seconds

  constructor(config: GameConfig) {
    super(config);
  }

  init(): void {
    const d = Math.max(0, Math.min(3, this.difficulty));
    const bucket = BUCKETS[d];
    const seed = this.seed ?? Math.floor(Math.random() * 2_147_483_647);
    this.level = generateLevel({ seed, bucket });
    this.targets = this.level.targets.map(t => ({ ...t, destroyed: false }));
    this.obstacles = this.level.obstacles.map(o => ({ ...o }));
    this.dartsRemaining = this.level.darts;
    this.resetBallToStart();
    this.aiming = false;
    this.gameActive = true;
    this.winScheduled = false;
    this.loseScheduled = false;
    this.resetting = false;
    this.computeLayout();
    this.setScore(0);
  }

  private resetBallToStart(): void {
    this.ball.x = this.level.startX;
    this.ball.y = this.level.startY;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.active = false;
    this.ball.bounces = 0;
  }

  private computeLayout(): void {
    const availW = Math.max(this.width - 16, 1);
    const availH = Math.max(this.height - TOP_HUD - BOTTOM_PAD, 1);
    const scaleX = availW / this.level.arena.w;
    const scaleY = availH / this.level.arena.h;
    this.arenaScale = Math.min(scaleX, scaleY);
    const arenaPxW = this.level.arena.w * this.arenaScale;
    const arenaPxH = this.level.arena.h * this.arenaScale;
    this.arenaX = Math.floor((this.width - arenaPxW) / 2);
    this.arenaY = Math.floor(TOP_HUD + (availH - arenaPxH) / 2);
  }

  private logicalToCanvas(x: number, y: number): { px: number; py: number } {
    return {
      px: this.arenaX + x * this.arenaScale,
      py: this.arenaY + y * this.arenaScale,
    };
  }

  private canvasToLogical(px: number, py: number): { x: number; y: number } {
    return {
      x: (px - this.arenaX) / this.arenaScale,
      y: (py - this.arenaY) / this.arenaScale,
    };
  }

  // ── Input ─────────────────────────────────────────────────

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;
    if (this.ball.active) return; // can't aim while ball is moving
    if (this.resetting) return;   // can't aim while ball is sliding back
    if (this.dartsRemaining <= 0) return;
    this.aiming = true;
    this.aimPointerX = x;
    this.aimPointerY = y;
  }

  protected handlePointerMove(x: number, y: number): void {
    if (!this.aiming) return;
    this.aimPointerX = x;
    this.aimPointerY = y;
  }

  protected handlePointerUp(x: number, y: number): void {
    if (!this.aiming) return;
    this.aiming = false;

    // Fire direction: from ball toward pointer release point (in logical space)
    const logical = this.canvasToLogical(x, y);
    const dx = logical.x - this.ball.x;
    const dy = logical.y - this.ball.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) return; // too short — cancel

    // Power from drag length (in canvas px)
    const ballPx = this.logicalToCanvas(this.ball.x, this.ball.y);
    const dragPx = Math.hypot(x - ballPx.px, y - ballPx.py);
    const t = Math.min(1, dragPx / POWER_DRAG_MAX);
    const power = POWER_MIN + (POWER_MAX - POWER_MIN) * t;

    // Normalize direction (in logical space)
    const nx = dx / dist;
    const ny = dy / dist;
    this.ball.vx = nx * power;
    this.ball.vy = ny * power;
    this.ball.active = true;
    this.ball.bounces = 0;
    this.dartsRemaining--;
    this.onUpdate({ darts: this.dartsRemaining });
    this.playSound('move');
  }

  // ── Physics ───────────────────────────────────────────────

  update(dt: number): void {
    if (!this.gameActive) return;

    if (this.ball.active) {
      const sdt = dt / SUBSTEPS;
      for (let step = 0; step < SUBSTEPS; step++) {
        this.stepPhysics(sdt);
        if (!this.ball.active) break;
      }
    } else if (this.resetting) {
      this.resetElapsed += dt;
      const t = Math.min(1, this.resetElapsed / this.resetDuration);
      // ease-in-out cubic for a gentle slide
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.ball.x = this.resetFromX + (this.level.startX - this.resetFromX) * e;
      this.ball.y = this.resetFromY + (this.level.startY - this.resetFromY) * e;
      if (t >= 1) {
        this.resetting = false;
        this.resetBallToStart();
      }
    } else if (this.dartsRemaining <= 0 && !this.allTargetsDestroyed() && !this.loseScheduled && !this.winScheduled) {
      this.handleLoss();
    } else if (this.allTargetsDestroyed() && !this.winScheduled) {
      this.handleWin();
    }
  }

  private stepPhysics(dt: number): void {
    const b = this.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Arena walls (logical space)
    const a = this.level.arena;
    if (b.x - b.radius < a.x) {
      b.x = a.x + b.radius;
      b.vx = Math.abs(b.vx);
      this.onBounce();
    }
    if (b.x + b.radius > a.x + a.w) {
      b.x = a.x + a.w - b.radius;
      b.vx = -Math.abs(b.vx);
      this.onBounce();
    }
    if (b.y - b.radius < a.y) {
      b.y = a.y + b.radius;
      b.vy = Math.abs(b.vy);
      this.onBounce();
    }
    if (b.y + b.radius > a.y + a.h) {
      b.y = a.y + a.h - b.radius;
      b.vy = -Math.abs(b.vy);
      this.onBounce();
    }

    // Obstacle reflection (axis-aligned rects)
    for (const o of this.obstacles) {
      const closestX = Math.max(o.x, Math.min(b.x, o.x + o.w));
      const closestY = Math.max(o.y, Math.min(b.y, o.y + o.h));
      const ddx = b.x - closestX;
      const ddy = b.y - closestY;
      const distSq = ddx * ddx + ddy * ddy;
      if (distSq < b.radius * b.radius) {
        // Overlap — resolve based on which side is closer. Treat axis-aligned
        // collision: the smaller penetration axis is the reflection axis.
        if (Math.abs(ddx) > Math.abs(ddy)) {
          if (ddx > 0) { b.x = o.x + o.w + b.radius; b.vx = Math.abs(b.vx); }
          else { b.x = o.x - b.radius; b.vx = -Math.abs(b.vx); }
        } else {
          if (ddy > 0) { b.y = o.y + o.h + b.radius; b.vy = Math.abs(b.vy); }
          else { b.y = o.y - b.radius; b.vy = -Math.abs(b.vy); }
        }
        this.onBounce();
      }
    }

    // Target collisions (pass-through)
    for (const t of this.targets) {
      if (t.destroyed) continue;
      const ddx = t.x - b.x;
      const ddy = t.y - b.y;
      const rsum = t.radius + b.radius;
      if (ddx * ddx + ddy * ddy < rsum * rsum) {
        t.destroyed = true;
        this.playSound('pop');
        this.haptic('medium');
        this.addScore(100);
      }
    }

    // Friction — exponential decay over time
    const decay = Math.pow(FRICTION_PER_SEC, dt);
    b.vx *= decay;
    b.vy *= decay;

    const speed = Math.hypot(b.vx, b.vy);
    if (speed < STOP_SPEED || b.bounces >= MAX_BOUNCES) {
      b.active = false;
      b.vx = 0;
      b.vy = 0;
      if (this.dartsRemaining > 0 && !this.allTargetsDestroyed()) {
        this.beginResetAnimation();
      }
    }
  }

  /** Kick off the smooth slide-back-to-start animation. Ball stays visually
   *  where it came to rest and eases back to the start position over
   *  `resetDuration` seconds, then play can resume. */
  private beginResetAnimation(): void {
    this.resetting = true;
    this.resetFromX = this.ball.x;
    this.resetFromY = this.ball.y;
    this.resetElapsed = 0;
  }

  private onBounce(): void {
    this.ball.bounces++;
    this.playSound('tap');
  }

  private allTargetsDestroyed(): boolean {
    return this.targets.every(t => t.destroyed);
  }

  private handleWin(): void {
    this.winScheduled = true;
    this.gameActive = false;
    // Bonus for remaining darts
    const bonus = this.dartsRemaining * 150;
    this.setScore(this.score + bonus);
    this.gameWin();
    setTimeout(() => this.gameOver(), WIN_DELAY_MS);
  }

  private handleLoss(): void {
    this.loseScheduled = true;
    this.gameActive = false;
    setTimeout(() => this.gameOver(), GAME_OVER_DELAY_MS);
  }

  // ── HUD ───────────────────────────────────────────────────

  getHudStats(): Array<{ label: string; value: string }> {
    const remaining = this.targets.filter(t => !t.destroyed).length;
    const total = this.targets.length;
    return [
      { label: 'Darts', value: `${this.dartsRemaining}` },
      { label: 'Targets', value: `${total - remaining}/${total}` },
    ];
  }

  // ── Render ────────────────────────────────────────────────

  render(): void {
    this.clear(BG);
    this.renderArena();
    this.renderObstacles();
    this.renderTargets();
    this.renderBall();
    this.renderAim();
  }

  private renderArena(): void {
    const a = this.level.arena;
    const tl = this.logicalToCanvas(a.x, a.y);
    const size = {
      w: a.w * this.arenaScale,
      h: a.h * this.arenaScale,
    };
    this.drawRoundRect(tl.px, tl.py, size.w, size.h, 10, ARENA_BG, ARENA_BORDER);
  }

  private renderObstacles(): void {
    for (const o of this.obstacles) {
      const tl = this.logicalToCanvas(o.x, o.y);
      const w = o.w * this.arenaScale;
      const h = o.h * this.arenaScale;
      this.drawRoundRect(tl.px, tl.py, w, h, 3, OBSTACLE_COLOR);
      // Top highlight
      this.drawRoundRect(tl.px + 2, tl.py + 2, w - 4, h * 0.3, 2, OBSTACLE_HIGHLIGHT);
    }
  }

  private renderTargets(): void {
    for (const t of this.targets) {
      const { px, py } = this.logicalToCanvas(t.x, t.y);
      const r = t.radius * this.arenaScale;
      if (t.destroyed) {
        this.drawCircle(px, py, r * 0.35, TARGET_DESTROYED);
        continue;
      }
      // Outer ring
      this.drawCircle(px, py, r, TARGET_RING);
      // Inner fill
      this.drawCircle(px, py, r * 0.78, TARGET_COLOR);
      // Bullseye
      this.drawCircle(px, py, r * 0.3, TARGET_RING);
      // Highlight
      this.drawCircle(px - r * 0.25, py - r * 0.3, r * 0.25, 'rgba(255,255,255,0.5)');
    }
  }

  private renderBall(): void {
    const { px, py } = this.logicalToCanvas(this.ball.x, this.ball.y);
    const r = this.ball.radius * this.arenaScale;
    this.drawCircle(px + 1, py + 2, r, BALL_SHADOW);
    this.drawCircle(px, py, r, BALL_COLOR);
    this.drawCircle(px - r * 0.3, py - r * 0.35, r * 0.3, 'rgba(255,255,255,0.9)');
  }

  private renderAim(): void {
    if (!this.aiming) return;
    const { px: bx, py: by } = this.logicalToCanvas(this.ball.x, this.ball.y);
    const dx = this.aimPointerX - bx;
    const dy = this.aimPointerY - by;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) return;
    const t = Math.min(1, dist / POWER_DRAG_MAX);
    // Aim line
    this.ctx.save();
    this.ctx.strokeStyle = AIM_COLOR;
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([6, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(bx, by);
    this.ctx.lineTo(bx + dx, by + dy);
    this.ctx.stroke();
    this.ctx.restore();
    // Power dot at end
    this.drawCircle(bx + dx, by + dy, 5 + t * 4, AIM_COLOR);
  }

  // ── Save / Resume ─────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      arena: this.level.arena,
      startX: this.level.startX,
      startY: this.level.startY,
      obstacles: this.obstacles.map(o => ({ ...o })),
      targets: this.targets.map(t => ({ ...t })),
      dartsRemaining: this.dartsRemaining,
      gameActive: this.gameActive,
    };
  }

  deserialize(state: GameSnapshot): void {
    const arena = state.arena as RicochetLevel['arena'] | undefined;
    const obstacles = state.obstacles as Obstacle[] | undefined;
    const targets = state.targets as Target[] | undefined;
    if (!arena || !Array.isArray(obstacles) || !Array.isArray(targets)) return;
    this.level = {
      arena: { ...arena },
      startX: (state.startX as number | undefined) ?? arena.w / 2,
      startY: (state.startY as number | undefined) ?? arena.h - 40,
      obstacles: obstacles.map(o => ({ ...o })),
      targets: targets.map(t => ({ ...t })),
      darts: (state.dartsRemaining as number | undefined) ?? 6,
    };
    this.obstacles = this.level.obstacles.map(o => ({ ...o }));
    this.targets = this.level.targets.map(t => ({ ...t }));
    this.dartsRemaining = (state.dartsRemaining as number | undefined) ?? this.level.darts;
    this.gameActive = (state.gameActive as boolean | undefined) ?? true;
    this.resetBallToStart();
    this.winScheduled = false;
    this.loseScheduled = false;
    this.resetting = false;
    this.computeLayout();
  }

  canSave(): boolean {
    // Only save when the ball is at rest AND not mid-reset-animation
    return this.gameActive && !this.ball.active && !this.resetting;
  }

  // ── Test hooks ────────────────────────────────────────────
  testFire(vx: number, vy: number): void {
    if (!this.gameActive || this.ball.active || this.dartsRemaining <= 0) return;
    this.ball.vx = vx;
    this.ball.vy = vy;
    this.ball.active = true;
    this.ball.bounces = 0;
    this.dartsRemaining--;
  }

  testDestroyAllTargets(): void {
    for (const t of this.targets) t.destroyed = true;
  }
}

registerGame({
  id: 'ricochet',
  name: 'Ricochet',
  description: 'Bounce a ball off walls to hit every target',
  icon: 'R',
  color: '--color-primary',
  bgGradient: ['#8B5E83', '#D14E5C'],
  category: 'arcade',
  createGame: (config) => new RicochetGame(config),
  canvasWidth: 360,
  canvasHeight: 600,
  controls: 'Drag to aim, release to fire — the ball bounces off walls',
  dailyMode: true,
});

export { RicochetGame };
