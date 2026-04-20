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
const BASE_H = 20;           // wooden base thickness
const POST_W = 8;            // peg thickness
const POST_MARGIN_TOP = 30;  // space above topmost disk

// ── Visuals ────────────────────────────────────────────────
const BG = '#FEF0E4';
const BASE_COLOR = '#A0693D';
const BASE_HIGHLIGHT = '#C58A54';
const POST_COLOR = '#6E4224';
const POST_HIGHLIGHT = '#8B5E3D';

// Warm-palette disk colors, indexed by size (1-based). Smallest disks are
// lighter warm tones; largest disks deeper warm tones.
const DISK_PALETTE: string[] = [
  '#F5C06E', // smallest
  '#F5A06B',
  '#E8884D',
  '#D4704D',
  '#B85A4E',
  '#8B5E83',
  '#6A4566', // largest
];

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
    if (this.heldSize < topDst) {
      // Legal move
      dst.push(this.heldSize);
      if (destPeg !== this.heldFromPeg) {
        this.moves++;
        this.onUpdate({ moves: this.moves });
      }
      this.playSound('drop');
      this.haptic('light');
    } else {
      // Illegal — return the disk to its origin peg
      this.pegs[this.heldFromPeg].push(this.heldSize);
      this.playSound('error');
    }
    this.holding = false;
    this.heldSize = 0;
    this.heldFromPeg = -1;

    // Win: all disks on peg 2 (rightmost) in descending size order
    if (this.isSolved() && !this.winScheduled) this.handleSolved();
    void y; // silence unused
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

  update(_dt: number): void { /* no simulation */ }

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
    if (this.holding) this.renderHeldDisk();
  }

  private renderBase(): void {
    // Wooden base
    const baseX = 12;
    const baseW = this.width - 24;
    this.drawRoundRect(baseX, this.baseY, baseW, BASE_H, 4, BASE_COLOR);
    this.drawRoundRect(baseX + 2, this.baseY + 2, baseW - 4, 5, 2, BASE_HIGHLIGHT);
  }

  private renderPosts(): void {
    const postH = this.baseY - this.pegTopY;
    for (let i = 0; i < 3; i++) {
      const px = this.pegCenterXs[i] - POST_W / 2;
      this.drawRoundRect(px, this.pegTopY, POST_W, postH, 3, POST_COLOR);
      this.drawRoundRect(px + 1, this.pegTopY + 1, 2, postH - 2, 1, POST_HIGHLIGHT);
      // Peg cap (rounded top)
      this.drawCircle(this.pegCenterXs[i], this.pegTopY, POST_W / 2 + 1, POST_COLOR);
    }
  }

  private renderDisks(): void {
    for (let p = 0; p < 3; p++) {
      const peg = this.pegs[p];
      for (let i = 0; i < peg.length; i++) {
        const size = peg[i];
        const x = this.pegCenterXs[p];
        const y = this.baseY - this.diskH * (i + 1);
        this.drawDisk(size, x, y);
      }
    }
  }

  private renderHeldDisk(): void {
    // Draw the held disk at the pointer position, offset upward so it
    // doesn't sit directly under the finger.
    const nearPeg = this.nearestPeg(this.pointerX);
    const x = this.pegCenterXs[nearPeg];
    // Preview y: above the top of the destination peg's stack
    const stackHeight = this.pegs[nearPeg].length * this.diskH;
    const previewY = this.baseY - stackHeight - this.diskH - this.diskH * LIFT_HEIGHT;
    // Also honor the actual pointer y for a more tactile feel — take the min
    // so the disk never phases below the stack top.
    const y = Math.min(previewY, this.pointerY - this.diskH / 2);
    this.drawDisk(this.heldSize, x, y, true);
  }

  private drawDisk(size: number, cx: number, topY: number, held = false): void {
    const minW = POST_W + 18;
    const ratio = this.diskCount > 1 ? (size - 1) / (this.diskCount - 1) : 0;
    const w = minW + (this.diskMaxW - minW) * ratio;
    const h = this.diskH - 2;
    const x = cx - w / 2;
    const y = topY;
    const radius = Math.max(2, h / 2);
    const color = DISK_PALETTE[Math.min(size - 1, DISK_PALETTE.length - 1)];
    // Shadow
    this.drawRoundRect(x + 1, y + 2, w, h, radius, 'rgba(61,43,53,0.2)');
    // Body
    this.drawRoundRect(x, y, w, h, radius, color);
    // Top highlight band
    this.drawRoundRect(x + 2, y + 1, w - 4, Math.max(2, h * 0.3), radius / 2, 'rgba(255,255,255,0.22)');
    if (held) {
      // Golden ring to indicate the disk is being held
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
