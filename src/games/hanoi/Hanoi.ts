import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

/** Disks per peg. `pegs[0]` is the left tower, index 0 = bottom-most disk,
 *  highest index = top. Disk values are their "size" (1 = smallest). */
type Peg = number[];

const BUCKETS = ['easy', 'medium', 'hard', 'expert'] as const;
const DISK_COUNT: Record<typeof BUCKETS[number], number> = {
  easy: 3,
  medium: 4,
  hard: 5,
  expert: 6,
};

// ── Layout ─────────────────────────────────────────────────
const TOP_HUD = 72;
const BOTTOM_PAD = 40;
const BASE_H = 24;           // wooden base thickness
const POST_W = 10;           // peg thickness
const POST_MARGIN_TOP = 36;  // space above topmost disk

// ── Visuals ────────────────────────────────────────────────
const BG = '#FEF0E4';
const BASE_LIGHT = '#B87A4A';
const BASE_MID = '#9A5E36';
const BASE_DARK = '#6E4224';
const BASE_GRAIN = 'rgba(61,43,53,0.10)';
const POST_LIGHT = '#A37250';
const POST_MID = '#7A4E30';
const POST_DARK = '#4D2E1C';

// Warm-palette disk colors, indexed by size (1-based). Each entry is
// [rim/dark edge, main face, inner highlight].
const DISK_PALETTE: Array<[string, string, string]> = [
  ['#C99043', '#F5C06E', '#FFDBA5'], // smallest
  ['#BD7545', '#F5A06B', '#FFC79A'],
  ['#A96237', '#E8884D', '#FBB087'],
  ['#8B4A38', '#D4704D', '#F0957A'],
  ['#6E3336', '#B85A4E', '#D68378'],
  ['#5B3E56', '#8B5E83', '#B78AAE'],
  ['#48304A', '#6A4566', '#946F91'], // largest
];

// ── Animation ──────────────────────────────────────────────
const LIFT_ANIM_DURATION = 0.12;   // seconds to lift disk when picked up
const DROP_ANIM_DURATION = 0.18;   // seconds for released disk to settle
const INVALID_SNAP_DURATION = 0.22;// seconds for illegal-drop bounce-back

const WIN_DELAY_MS = 1500;
const LIFT_HEIGHT = 0.85; // fraction of disk height the disk rises while held

class HanoiGame extends GameEngine {
  private pegs: Peg[] = [[], [], []];
  private diskCount = 3;
  private moves = 0;
  private minMoves = 7; // 2^n - 1 for n disks

  // Drag state
  private holding = false;
  private heldSize = 0;       // disk size being dragged
  private heldFromPeg = -1;
  private pointerX = 0;
  private pointerY = 0;

  // Animation state: a disk playing a "settle" animation after being dropped.
  // During this animation the disk renders separately from the stacked disks
  // so it appears to slide/fall into place.
  private settle: {
    size: number;
    pegIdx: number;
    /** Index in the peg stack where this disk ends up after the animation. */
    stackIdx: number;
    fromX: number;
    fromY: number;
    elapsed: number;
    duration: number;
  } | null = null;

  // Lift animation when a disk is picked up (gives a tactile "grab" feel).
  private liftStartTime = 0;

  // Layout
  private pegCenterXs: number[] = [0, 0, 0];
  private baseY = 0;
  private pegTopY = 0;
  private diskH = 20;
  private diskMaxW = 100;

  // Lifecycle
  private gameActive = false;
  private winScheduled = false;

  constructor(config: GameConfig) {
    super(config);
  }

  init(): void {
    const d = Math.max(0, Math.min(3, this.difficulty));
    this.diskCount = DISK_COUNT[BUCKETS[d]];
    this.minMoves = (1 << this.diskCount) - 1; // 2^n - 1
    this.pegs = [[], [], []];
    // All disks start on the left peg, largest at bottom
    for (let s = this.diskCount; s >= 1; s--) this.pegs[0].push(s);
    this.moves = 0;
    this.holding = false;
    this.heldSize = 0;
    this.heldFromPeg = -1;
    this.gameActive = true;
    this.winScheduled = false;
    this.computeLayout();
    this.setScore(0);
  }

  private computeLayout(): void {
    const availW = Math.max(this.width - 32, 1);
    const availH = Math.max(this.height - TOP_HUD - BOTTOM_PAD, 1);
    // Peg positions: three equally spaced
    for (let i = 0; i < 3; i++) {
      this.pegCenterXs[i] = Math.floor(16 + ((i + 0.5) * availW) / 3);
    }
    // Base sits at bottom of available space
    this.baseY = TOP_HUD + availH - BASE_H;
    this.pegTopY = TOP_HUD + POST_MARGIN_TOP;
    // Disk dimensions
    const availHeight = this.baseY - this.pegTopY;
    this.diskH = Math.max(10, Math.min(28, Math.floor(availHeight / (this.diskCount + 1))));
    // Widest disk fits inside the peg slot
    const slotW = Math.floor(availW / 3) - 16;
    this.diskMaxW = Math.max(40, Math.min(120, slotW));
  }

  // ── Input ─────────────────────────────────────────────────

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;
    if (this.settle) return; // wait for the settle animation to complete
    const pegIdx = this.nearestPeg(x);
    const peg = this.pegs[pegIdx];
    if (peg.length === 0) return;
    // Pick up the top disk
    this.heldSize = peg[peg.length - 1];
    this.heldFromPeg = pegIdx;
    peg.pop();
    this.holding = true;
    this.pointerX = x;
    this.pointerY = y;
    this.liftStartTime = performance.now() / 1000;
    this.playSound('select');
  }

  protected handlePointerMove(x: number, y: number): void {
    if (!this.holding) return;
    this.pointerX = x;
    this.pointerY = y;
  }

  protected handlePointerUp(x: number, y: number): void {
    if (!this.holding) return;
    const destPeg = this.nearestPeg(x);
    const dst = this.pegs[destPeg];
    const topDst = dst.length > 0 ? dst[dst.length - 1] : Infinity;
    const legal = this.heldSize < topDst;
    // Settle animation: disk slides from its current visual position down
    // to the target stack slot. For illegal drops it slides back to the
    // origin peg with a slightly longer duration (bounce feel).
    const landPeg = legal ? destPeg : this.heldFromPeg;
    const landStack = this.pegs[landPeg].length;
    // Record the animation start from the current pointer-tracked position.
    const liftedT = this.liftProgress();
    const bodyW = this.bodyWidthForSize(this.heldSize);
    void bodyW;
    const fromY = Math.min(
      this.pointerY - this.diskH / 2,
      this.baseY - (this.pegs[landPeg].length + 1) * this.diskH
        - this.diskH * LIFT_HEIGHT * liftedT,
    );
    this.settle = {
      size: this.heldSize,
      pegIdx: landPeg,
      stackIdx: landStack,
      fromX: this.pegCenterXs[this.nearestPeg(this.pointerX)],
      fromY,
      elapsed: 0,
      duration: legal ? DROP_ANIM_DURATION : INVALID_SNAP_DURATION,
    };
    // Commit the disk to its landing peg NOW so move counts / win check
    // fire immediately — the animation is pure eye candy on top.
    dst.length; // keep destPeg reference warm for readability
    this.pegs[landPeg].push(this.heldSize);
    if (legal && destPeg !== this.heldFromPeg) {
      this.moves++;
      this.onUpdate({ moves: this.moves });
      this.playSound('drop');
      this.haptic('light');
    } else if (legal) {
      this.playSound('drop');
    } else {
      this.playSound('error');
      this.haptic('medium');
    }
    this.holding = false;
    this.heldSize = 0;
    this.heldFromPeg = -1;

    if (this.isSolved() && !this.winScheduled) this.handleSolved();
    void y;
  }

  /** 0..1 lift completion value for the held disk. */
  private liftProgress(): number {
    if (!this.holding) return 0;
    const elapsed = performance.now() / 1000 - this.liftStartTime;
    return Math.min(1, elapsed / LIFT_ANIM_DURATION);
  }

  private bodyWidthForSize(size: number): number {
    const minW = POST_W + 22;
    const ratio = this.diskCount > 1 ? (size - 1) / (this.diskCount - 1) : 0;
    return minW + (this.diskMaxW - minW) * ratio;
  }

  private nearestPeg(x: number): number {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < 3; i++) {
      const d = Math.abs(x - this.pegCenterXs[i]);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  private isSolved(): boolean {
    const target = this.pegs[2];
    if (target.length !== this.diskCount) return false;
    for (let i = 0; i < this.diskCount; i++) {
      if (target[i] !== this.diskCount - i) return false;
    }
    return true;
  }

  private handleSolved(): void {
    this.winScheduled = true;
    this.gameActive = false;
    // Score: base by disk count, minus penalty for each move beyond optimal.
    const base = 400 + this.diskCount * 250;
    const excess = Math.max(0, this.moves - this.minMoves);
    const final = Math.max(150, base - excess * 20);
    // Perfect-solution bonus
    const perfect = this.moves === this.minMoves ? Math.round(base * 0.25) : 0;
    this.setScore(final + perfect);
    this.gameWin();
    setTimeout(() => this.gameOver(), WIN_DELAY_MS);
  }

  // ── Update / Render ───────────────────────────────────────

  update(dt: number): void {
    if (this.settle) {
      this.settle.elapsed += dt;
      if (this.settle.elapsed >= this.settle.duration) this.settle = null;
    }
  }

  getHudStats(): Array<{ label: string; value: string }> {
    return [
      { label: 'Moves', value: `${this.moves}/${this.minMoves}` },
      { label: 'Disks', value: `${this.pegs[2].length}/${this.diskCount}` },
    ];
  }

  render(): void {
    this.clear(BG);
    this.renderBase();
    this.renderPosts();
    this.renderDisks();
    this.renderSettleDisk();
    if (this.holding) this.renderHeldDisk();
  }

  private renderBase(): void {
    const baseX = 10;
    const baseW = this.width - 20;
    const y = this.baseY;
    // Main body — warm wood mid-tone
    this.drawRoundRect(baseX, y, baseW, BASE_H, 6, BASE_MID);
    // Bottom shadow band (darker)
    this.drawRoundRect(baseX, y + BASE_H - 6, baseW, 6, 4, BASE_DARK);
    // Top highlight band (lighter)
    this.drawRoundRect(baseX + 2, y + 2, baseW - 4, Math.max(4, BASE_H * 0.3), 3, BASE_LIGHT);
    // Wood-grain lines: a few subtle horizontal strokes across the top face
    this.ctx.save();
    this.ctx.strokeStyle = BASE_GRAIN;
    this.ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const gy = y + 6 + i * 4;
      this.ctx.beginPath();
      this.ctx.moveTo(baseX + 20 + i * 30, gy);
      this.ctx.lineTo(baseX + baseW - 20 - i * 10, gy);
      this.ctx.stroke();
    }
    this.ctx.restore();
    // Small dark stroke at the very top edge for crispness
    this.ctx.save();
    this.ctx.strokeStyle = BASE_DARK;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(baseX + 4, y + 0.5);
    this.ctx.lineTo(baseX + baseW - 4, y + 0.5);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private renderPosts(): void {
    const postH = this.baseY - this.pegTopY;
    for (let i = 0; i < 3; i++) {
      const px = this.pegCenterXs[i] - POST_W / 2;
      // Vertical shading: dark right edge, light left-middle
      // Body
      this.drawRoundRect(px, this.pegTopY, POST_W, postH + 4, 3, POST_MID);
      // Left highlight stripe
      this.drawRoundRect(px + 1, this.pegTopY + 2, Math.max(2, POST_W * 0.3), postH - 4, 1, POST_LIGHT);
      // Right shadow stripe
      this.drawRoundRect(
        px + POST_W - Math.max(2, POST_W * 0.3) - 1,
        this.pegTopY + 2,
        Math.max(2, POST_W * 0.3),
        postH - 4, 1,
        POST_DARK,
      );
      // Rounded top cap (drawn as a filled circle; the body already has
      // rounded corners but this reads as a cylinder top)
      this.drawCircle(this.pegCenterXs[i], this.pegTopY, POST_W / 2 + 0.5, POST_MID);
      this.drawCircle(
        this.pegCenterXs[i] - POST_W * 0.15,
        this.pegTopY - 0.5,
        POST_W * 0.22,
        POST_LIGHT,
      );
      // Slight socket ring where peg meets base
      this.drawCircle(this.pegCenterXs[i], this.baseY, POST_W / 2 + 2, 'rgba(61,43,53,0.22)');
    }
  }

  private renderDisks(): void {
    for (let p = 0; p < 3; p++) {
      const peg = this.pegs[p];
      for (let i = 0; i < peg.length; i++) {
        // Skip rendering the disk that is currently playing a settle anim;
        // it'll be drawn in renderSettleDisk() at its interpolated position.
        if (this.settle && this.settle.pegIdx === p && this.settle.stackIdx === i) continue;
        const size = peg[i];
        const x = this.pegCenterXs[p];
        const y = this.baseY - this.diskH * (i + 1);
        this.drawDisk(size, x, y);
      }
    }
  }

  private renderSettleDisk(): void {
    if (!this.settle) return;
    const s = this.settle;
    const t = Math.min(1, s.elapsed / Math.max(s.duration, 0.001));
    // Ease-out-cubic for the first 80% of the animation, then a tiny
    // overshoot & settle for the last 20% — gives a gentle thud feel.
    const easeOutCubic = 1 - Math.pow(1 - Math.min(1, t * 1.1), 3);
    const targetY = this.baseY - this.diskH * (s.stackIdx + 1);
    const targetX = this.pegCenterXs[s.pegIdx];
    const x = s.fromX + (targetX - s.fromX) * easeOutCubic;
    const y = s.fromY + (targetY - s.fromY) * easeOutCubic;
    this.drawDisk(s.size, x, y);
  }

  private renderHeldDisk(): void {
    const nearPeg = this.nearestPeg(this.pointerX);
    const x = this.pegCenterXs[nearPeg];
    const stackHeight = this.pegs[nearPeg].length * this.diskH;
    const previewY = this.baseY - stackHeight - this.diskH - this.diskH * LIFT_HEIGHT;
    // Interpolate from the origin stack position up to the lifted preview
    // for a smooth "grab" feel.
    const lift = this.liftProgress();
    const originPeg = this.heldFromPeg;
    const originStackTopY = this.baseY - (this.pegs[originPeg].length + 1) * this.diskH;
    const liftedY = Math.min(previewY, this.pointerY - this.diskH / 2);
    const y = originStackTopY + (liftedY - originStackTopY) * lift;
    const originX = this.pegCenterXs[originPeg];
    const xInterp = originX + (x - originX) * lift;
    this.drawDisk(this.heldSize, xInterp, y, true);
  }

  /** Draw a cylindrical disk with shaded body + pseudo-3D top. */
  private drawDisk(size: number, cx: number, topY: number, held = false): void {
    const w = this.bodyWidthForSize(size);
    const h = this.diskH - 2;
    const x = cx - w / 2;
    const y = topY;
    const radius = h / 2;
    const [edge, mid, hi] = DISK_PALETTE[Math.min(size - 1, DISK_PALETTE.length - 1)];

    // Drop shadow — a soft ellipse beneath the disk
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(61,43,53,0.22)';
    this.ctx.beginPath();
    this.ctx.ellipse(
      cx, y + h + 3, w * 0.48, Math.max(2, h * 0.18),
      0, 0, Math.PI * 2,
    );
    this.ctx.fill();
    this.ctx.restore();

    // Dark rim/edge (bottom)
    this.drawRoundRect(x, y + 2, w, h - 1, radius, edge);
    // Main body
    this.drawRoundRect(x, y, w, h - 2, radius, mid);
    // Bright highlight — small ellipse on top-left that simulates lighting
    this.ctx.save();
    this.ctx.fillStyle = hi;
    this.ctx.beginPath();
    this.ctx.ellipse(
      cx - w * 0.18, y + h * 0.28,
      w * 0.32, Math.max(1.5, h * 0.24),
      0, 0, Math.PI * 2,
    );
    this.ctx.fill();
    this.ctx.restore();

    // Thin dark edge line on top for crispness
    this.ctx.save();
    this.ctx.strokeStyle = edge;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.ellipse(cx, y + 0.5, w / 2 - 1, Math.max(1, h * 0.08), 0, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();

    // Centre hole (peg passes through) — small darker oval
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(61,43,53,0.30)';
    this.ctx.beginPath();
    this.ctx.ellipse(cx, y + h / 2, POST_W * 0.5, Math.max(1.5, h * 0.18), 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    if (held) {
      this.ctx.save();
      this.ctx.strokeStyle = '#F5A623';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([4, 3]);
      this.ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
      this.ctx.restore();
    }
  }

  // ── Save / Resume ─────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      diskCount: this.diskCount,
      pegs: this.pegs.map(p => p.slice()),
      moves: this.moves,
      gameActive: this.gameActive,
    };
  }

  deserialize(state: GameSnapshot): void {
    const pegs = state.pegs as number[][] | undefined;
    const diskCount = state.diskCount as number | undefined;
    if (!Array.isArray(pegs) || pegs.length !== 3 || typeof diskCount !== 'number') return;
    this.pegs = pegs.map(p => (Array.isArray(p) ? p.slice() : []));
    this.diskCount = diskCount;
    this.minMoves = (1 << diskCount) - 1;
    this.moves = (state.moves as number | undefined) ?? 0;
    this.gameActive = (state.gameActive as boolean | undefined) ?? true;
    this.holding = false;
    this.heldSize = 0;
    this.heldFromPeg = -1;
    this.winScheduled = false;
    this.computeLayout();
  }

  canSave(): boolean {
    return this.gameActive && !this.holding;
  }

  // ── Test hooks ────────────────────────────────────────────
  testMove(fromPeg: number, toPeg: number): boolean {
    if (fromPeg < 0 || fromPeg > 2 || toPeg < 0 || toPeg > 2) return false;
    const src = this.pegs[fromPeg];
    const dst = this.pegs[toPeg];
    if (src.length === 0) return false;
    const disk = src[src.length - 1];
    const topDst = dst.length > 0 ? dst[dst.length - 1] : Infinity;
    if (disk >= topDst) return false;
    src.pop();
    dst.push(disk);
    if (fromPeg !== toPeg) this.moves++;
    if (this.isSolved() && !this.winScheduled) this.handleSolved();
    return true;
  }
}

registerGame({
  id: 'hanoi',
  name: 'Towers of Hanoi',
  description: 'Move every disk to the right peg — no larger on smaller',
  icon: 'TH',
  color: '--color-primary',
  bgGradient: ['#A0693D', '#F5C06E'],
  category: 'puzzle',
  createGame: (config) => new HanoiGame(config),
  canvasWidth: 360,
  canvasHeight: 480,
  controls: 'Drag the top disk from one peg to another',
  dailyMode: true,
});

export { HanoiGame };
