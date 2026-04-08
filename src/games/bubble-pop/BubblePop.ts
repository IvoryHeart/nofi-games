import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Shared constants ────────────────────────────────────────────────────
const MIN_MATCH = 3;
const POINTS_PER_POP = 10;
const POINTS_PER_DROP = 15;

const COLORS = ['#F0726A', '#4EAAD4', '#5DC47E', '#F2C94C', '#9B6FCF', '#E86DA0'];
const COLOR_BORDERS = ['#D04E42', '#3088B2', '#3EAA62', '#D8A830', '#7E4FB8', '#CC4D82'];
const BG_COLOR = '#FEF0E4';
const GRID_BG_COLOR = '#FBE8D6';

// ── Difficulty presets ──────────────────────────────────────────────────
interface DifficultyPreset {
  numColors: number;
  shotsBeforeNewRow: number;
  startRows: number;
  wobble: boolean;
}

const DIFFICULTY_PRESETS: DifficultyPreset[] = [
  { numColors: 4, shotsBeforeNewRow: 8, startRows: 4, wobble: false },  // 0 Easy
  { numColors: 5, shotsBeforeNewRow: 6, startRows: 5, wobble: false },  // 1 Medium
  { numColors: 6, shotsBeforeNewRow: 4, startRows: 6, wobble: false },  // 2 Hard
  { numColors: 6, shotsBeforeNewRow: 3, startRows: 7, wobble: true },   // 3 Extra Hard
];

// ── Types ───────────────────────────────────────────────────────────────
interface FlyingBubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  colorIdx: number;
}

interface PopAnim {
  x: number;
  y: number;
  colorIdx: number;
  t: number;       // 0..1
}

interface DropAnim {
  x: number;
  y: number;
  vy: number;
  colorIdx: number;
  t: number;
  bounced: boolean;
  bounceCount: number;
}

// ── Game ────────────────────────────────────────────────────────────────
class BubblePopGame extends GameEngine {
  // Dynamic layout values (computed in init from this.width / this.height)
  private bubbleRadius = 18;
  private bubbleDiameter = 36;
  private cols = 9;
  private rowHeight = 0;
  private gridOffsetX = 0;
  private gridOffsetY = 0;
  private maxRows = 14;
  private deadLineY = 0;
  private shooterX = 0;
  private shooterY = 0;
  private shotSpeed = 600;

  // Difficulty
  private preset: DifficultyPreset = DIFFICULTY_PRESETS[0];

  // State
  private grid: (number | null)[][] = [];
  private totalRowsAdded = 0;

  private currentColor = 0;
  private nextColor = 0;

  private aimAngle = -Math.PI / 2;

  private flying: FlyingBubble | null = null;
  private canShoot = true;
  private shotsSinceNewRow = 0;

  private popAnims: PopAnim[] = [];
  private dropAnims: DropAnim[] = [];

  private isAiming = false;
  private isGameOver = false;

  // Wobble timer for extra hard
  private wobbleTime = 0;

  // Smooth new-row intro: while this is > 0, the entire grid renders with a
  // vertical offset that lerps from -rowHeight to 0, so a freshly pushed row
  // slides in from above instead of snapping into place.
  private rowIntroProgress = 1; // 1 = no animation; 0..1 = in progress
  private static readonly ROW_INTRO_DURATION = 0.35; // seconds

  constructor(config: GameConfig) {
    super(config);
  }

  // ── Layout computation ────────────────────────────────────────────
  private computeLayout(): void {
    this.bubbleRadius = Math.floor(Math.min(this.width, this.height) / 22);
    this.bubbleDiameter = this.bubbleRadius * 2;
    this.rowHeight = this.bubbleDiameter * 0.866; // sqrt(3)/2
    this.cols = Math.floor(this.width / this.bubbleDiameter);
    if (this.cols < 5) this.cols = 5;
    this.gridOffsetX = (this.width - this.cols * this.bubbleDiameter) / 2 + this.bubbleRadius;
    this.gridOffsetY = this.bubbleRadius + Math.floor(this.height * 0.02);
    this.maxRows = Math.floor((this.height * 0.78 - this.gridOffsetY) / this.rowHeight);
    this.deadLineY = this.gridOffsetY + this.maxRows * this.rowHeight;
    this.shooterX = Math.floor(this.width / 2);
    this.shooterY = Math.floor(this.height * 0.92);
    this.shotSpeed = Math.max(400, this.height * 1.05);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────
  init(): void {
    this.computeLayout();

    this.preset = DIFFICULTY_PRESETS[Math.min(this.difficulty, 3)] || DIFFICULTY_PRESETS[0];

    this.grid = [];
    this.totalRowsAdded = 0;
    this.flying = null;
    this.canShoot = true;
    this.shotsSinceNewRow = 0;
    this.popAnims = [];
    this.dropAnims = [];
    this.aimAngle = -Math.PI / 2;
    this.isAiming = false;
    this.isGameOver = false;
    this.wobbleTime = 0;

    const startRows = this.preset.startRows;
    for (let r = 0; r < startRows; r++) {
      this.addRow(r);
    }
    this.totalRowsAdded = startRows;

    this.currentColor = this.pickColor();
    this.nextColor = this.pickColor();
  }

  // ── Grid helpers ──────────────────────────────────────────────────
  private colsInRow(row: number): number {
    return row % 2 === 0 ? this.cols : this.cols - 1;
  }

  private bubbleX(row: number, col: number): number {
    const offset = row % 2 === 0 ? 0 : this.bubbleRadius;
    return this.gridOffsetX + col * this.bubbleDiameter + offset;
  }

  private bubbleY(row: number): number {
    return this.gridOffsetY + row * this.rowHeight;
  }

  private addRow(row: number): void {
    const cols = this.colsInRow(row);
    const rowArr: (number | null)[] = [];
    for (let c = 0; c < cols; c++) {
      rowArr.push(Math.floor(Math.random() * this.preset.numColors));
    }
    this.grid[row] = rowArr;
  }

  private pickColor(): number {
    const present = new Set<number>();
    for (const row of this.grid) {
      if (!row) continue;
      for (const c of row) {
        if (c !== null) present.add(c);
      }
    }
    if (present.size === 0) return Math.floor(Math.random() * this.preset.numColors);
    const arr = Array.from(present);
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** Push a new row at the top, shifting everything else down. Re-runs the
   *  floater check afterwards: when all rows shift, each row's parity flips,
   *  which changes hex-grid neighbor relationships — bubbles that were packed
   *  tight in the old layout can end up disconnected in the new one. Without
   *  this sweep they visually float. Also kicks off a smooth slide-in animation. */
  private pushNewRowFromTop(): void {
    const newGrid: (number | null)[][] = [];
    const cols = this.colsInRow(0);
    const freshRow: (number | null)[] = [];
    for (let c = 0; c < cols; c++) {
      freshRow.push(Math.floor(this.rng() * this.preset.numColors));
    }
    newGrid[0] = freshRow;

    for (let r = 0; r < this.grid.length; r++) {
      if (this.grid[r]) {
        const oldRow = this.grid[r]!;
        const newR = r + 1;
        const newCols = this.colsInRow(newR);
        const mapped: (number | null)[] = [];
        for (let c = 0; c < newCols; c++) {
          mapped.push(c < oldRow.length ? oldRow[c] : null);
        }
        newGrid[newR] = mapped;
      }
    }
    this.grid = newGrid;
    this.totalRowsAdded++;

    // Start the slide-in animation.
    this.rowIntroProgress = 0;

    // Sweep for any bubbles that became disconnected from the new top row
    // after the parity shift. Drop them with the normal drop animation.
    this.dropFloaters();

    this.checkDeadLine();
  }

  /** Run a floater sweep and queue drop animations for anything not
   *  connected to row 0. Called both after a match pop and after a new-row
   *  push. Safe to call at any stable moment. */
  private dropFloaters(): void {
    const floaters = this.findFloaters();
    if (floaters.size === 0) return;
    for (const key of floaters) {
      const [fr, fc] = key.split(',').map(Number);
      const bx = this.bubbleX(fr, fc);
      const by = this.bubbleY(fr);
      const color = this.grid[fr][fc];
      if (color === null || color === undefined) continue;
      this.dropAnims.push({ x: bx, y: by, vy: 0, colorIdx: color, t: 0, bounced: false, bounceCount: 0 });
      this.grid[fr][fc] = null;
    }
    this.addScore(floaters.size * POINTS_PER_DROP);
  }

  private checkDeadLine(): void {
    for (let r = 0; r < this.grid.length; r++) {
      const row = this.grid[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== null) {
          const y = this.bubbleY(r);
          if (y >= this.deadLineY) {
            this.isGameOver = true;
            this.gameOver();
            return;
          }
        }
      }
    }
  }

  // ── Snap / match / drop logic ─────────────────────────────────────
  private snapToGrid(x: number, y: number): { row: number; col: number } {
    let bestRow = 0;
    let bestCol = 0;
    let bestDist = Infinity;

    const maxR = Math.max(this.grid.length + 1, this.maxRows + 2);
    for (let r = 0; r < maxR; r++) {
      const cols = this.colsInRow(r);
      for (let c = 0; c < cols; c++) {
        const bx = this.bubbleX(r, c);
        const by = this.bubbleY(r);
        const dx = x - bx;
        const dy = y - by;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          const row = this.grid[r];
          if (!row || row[c] === null || row[c] === undefined) {
            bestDist = dist;
            bestRow = r;
            bestCol = c;
          }
        }
      }
    }
    return { row: bestRow, col: bestCol };
  }

  private getNeighbors(row: number, col: number): Array<{ row: number; col: number }> {
    const neighbors: Array<{ row: number; col: number }> = [];
    const even = row % 2 === 0;

    neighbors.push({ row, col: col - 1 });
    neighbors.push({ row, col: col + 1 });

    if (even) {
      neighbors.push({ row: row - 1, col: col - 1 });
      neighbors.push({ row: row - 1, col });
    } else {
      neighbors.push({ row: row - 1, col });
      neighbors.push({ row: row - 1, col: col + 1 });
    }

    if (even) {
      neighbors.push({ row: row + 1, col: col - 1 });
      neighbors.push({ row: row + 1, col });
    } else {
      neighbors.push({ row: row + 1, col });
      neighbors.push({ row: row + 1, col: col + 1 });
    }

    return neighbors.filter(n => {
      if (n.row < 0) return false;
      const cols = this.colsInRow(n.row);
      return n.col >= 0 && n.col < cols;
    });
  }

  private findConnected(row: number, col: number, colorIdx: number): Set<string> {
    const visited = new Set<string>();
    const stack: Array<{ row: number; col: number }> = [{ row, col }];

    while (stack.length > 0) {
      const curr = stack.pop()!;
      const key = `${curr.row},${curr.col}`;
      if (visited.has(key)) continue;

      const r = this.grid[curr.row];
      if (!r || r[curr.col] !== colorIdx) continue;

      visited.add(key);

      for (const n of this.getNeighbors(curr.row, curr.col)) {
        const nk = `${n.row},${n.col}`;
        if (!visited.has(nk)) {
          stack.push(n);
        }
      }
    }
    return visited;
  }

  /** Find all bubbles not connected to the top row */
  private findFloaters(): Set<string> {
    const attached = new Set<string>();
    const queue: Array<{ row: number; col: number }> = [];

    const topRow = this.grid[0];
    if (topRow) {
      for (let c = 0; c < topRow.length; c++) {
        if (topRow[c] !== null) {
          queue.push({ row: 0, col: c });
          attached.add(`0,${c}`);
        }
      }
    }

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const n of this.getNeighbors(curr.row, curr.col)) {
        const key = `${n.row},${n.col}`;
        if (attached.has(key)) continue;
        const r = this.grid[n.row];
        if (r && r[n.col] !== null && r[n.col] !== undefined) {
          attached.add(key);
          queue.push(n);
        }
      }
    }

    const floaters = new Set<string>();
    for (let r = 0; r < this.grid.length; r++) {
      const row = this.grid[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== null) {
          const key = `${r},${c}`;
          if (!attached.has(key)) {
            floaters.add(key);
          }
        }
      }
    }
    return floaters;
  }

  private placeBubble(row: number, col: number, colorIdx: number): void {
    while (this.grid.length <= row) {
      this.grid.push(null as unknown as (number | null)[]);
    }
    if (!this.grid[row]) {
      const cols = this.colsInRow(row);
      this.grid[row] = new Array(cols).fill(null);
    }
    const cols = this.colsInRow(row);
    while (this.grid[row].length < cols) {
      this.grid[row].push(null);
    }
    this.grid[row][col] = colorIdx;

    const matched = this.findConnected(row, col, colorIdx);

    if (matched.size >= MIN_MATCH) {
      for (const key of matched) {
        const [mr, mc] = key.split(',').map(Number);
        const bx = this.bubbleX(mr, mc);
        const by = this.bubbleY(mr);
        this.popAnims.push({ x: bx, y: by, colorIdx: this.grid[mr][mc]!, t: 0 });
        this.grid[mr][mc] = null;
      }
      this.addScore(matched.size * POINTS_PER_POP);

      this.dropFloaters();
    }

    this.shotsSinceNewRow++;
    if (this.shotsSinceNewRow >= this.preset.shotsBeforeNewRow) {
      this.shotsSinceNewRow = 0;
      this.pushNewRowFromTop();
    }

    this.checkDeadLine();

    // Check if grid is empty -- bonus!
    let anyBubble = false;
    for (const r of this.grid) {
      if (!r) continue;
      for (const c of r) {
        if (c !== null) { anyBubble = true; break; }
      }
      if (anyBubble) break;
    }
    if (!anyBubble) {
      this.addScore(100);
      const savedScore = this.score;
      this.grid = [];
      this.shotsSinceNewRow = 0;
      const startRows = this.preset.startRows;
      for (let r = 0; r < startRows; r++) {
        this.addRow(r);
      }
      this.totalRowsAdded += startRows;
      this.currentColor = this.pickColor();
      this.nextColor = this.pickColor();
      this.setScore(savedScore);
    }
  }

  // ── Shooting ──────────────────────────────────────────────────────
  private shoot(): void {
    if (!this.canShoot || this.flying || this.isGameOver) return;

    const clampedAngle = Math.max(-Math.PI + 0.15, Math.min(-0.15, this.aimAngle));

    const vx = Math.cos(clampedAngle) * this.shotSpeed;
    const vy = Math.sin(clampedAngle) * this.shotSpeed;

    this.flying = {
      x: this.shooterX,
      y: this.shooterY,
      vx,
      vy,
      colorIdx: this.currentColor,
    };

    this.currentColor = this.nextColor;
    this.nextColor = this.pickColor();
    this.canShoot = false;
  }

  // ── Input ─────────────────────────────────────────────────────────
  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (this.isGameOver) return;

    if (key === 'ArrowLeft') {
      this.aimAngle -= 0.05;
      if (this.aimAngle < -Math.PI + 0.15) this.aimAngle = -Math.PI + 0.15;
      e.preventDefault();
    } else if (key === 'ArrowRight') {
      this.aimAngle += 0.05;
      if (this.aimAngle > -0.15) this.aimAngle = -0.15;
      e.preventDefault();
    } else if (key === ' ') {
      this.shoot();
      e.preventDefault();
    }
  }

  protected handlePointerDown(x: number, y: number): void {
    if (this.isGameOver) return;
    this.isAiming = true;
    this.updateAim(x, y);
  }

  protected handlePointerMove(x: number, y: number): void {
    if (this.isGameOver) return;
    this.updateAim(x, y);
  }

  protected handlePointerUp(_x: number, _y: number): void {
    if (this.isGameOver) return;
    if (this.isAiming) {
      this.isAiming = false;
      this.shoot();
    }
  }

  private updateAim(x: number, y: number): void {
    const dx = x - this.shooterX;
    const dy = y - this.shooterY;
    if (dy < -5) {
      this.aimAngle = Math.atan2(dy, dx);
      if (this.aimAngle < -Math.PI + 0.15) this.aimAngle = -Math.PI + 0.15;
      if (this.aimAngle > -0.15) this.aimAngle = -0.15;
    }
  }

  // ── Easing helpers ────────────────────────────────────────────────
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private easeOutBounce(t: number): number {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      const t2 = t - 1.5 / 2.75;
      return 7.5625 * t2 * t2 + 0.75;
    } else if (t < 2.5 / 2.75) {
      const t2 = t - 2.25 / 2.75;
      return 7.5625 * t2 * t2 + 0.9375;
    } else {
      const t2 = t - 2.625 / 2.75;
      return 7.5625 * t2 * t2 + 0.984375;
    }
  }

  // ── Update ────────────────────────────────────────────────────────
  update(dt: number): void {
    if (this.isGameOver) return;

    // Advance the smooth new-row slide-in animation
    if (this.rowIntroProgress < 1) {
      this.rowIntroProgress = Math.min(1, this.rowIntroProgress + dt / BubblePopGame.ROW_INTRO_DURATION);
    }

    // Wobble timer for extra hard
    if (this.preset.wobble) {
      this.wobbleTime += dt;
    }

    // Track pointer for aim line
    if (!this.flying && !this.isAiming) {
      const px = this.pointer.x;
      const py = this.pointer.y;
      if (py < this.shooterY - 5) {
        this.updateAim(px, py);
      }
    }

    // Update flying bubble (smooth dt-based movement)
    if (this.flying) {
      const fb = this.flying;
      fb.x += fb.vx * dt;
      fb.y += fb.vy * dt;

      // Wall bounces
      if (fb.x - this.bubbleRadius < 0) {
        fb.x = this.bubbleRadius;
        fb.vx = Math.abs(fb.vx);
      } else if (fb.x + this.bubbleRadius > this.width) {
        fb.x = this.width - this.bubbleRadius;
        fb.vx = -Math.abs(fb.vx);
      }

      // Ceiling
      if (fb.y - this.bubbleRadius <= this.gridOffsetY) {
        fb.y = this.gridOffsetY;
        const snap = this.snapToGrid(fb.x, fb.y);
        this.flying = null;
        this.placeBubble(snap.row, snap.col, fb.colorIdx);
        this.canShoot = true;
        return;
      }

      // Collision with grid bubbles
      let collided = false;
      for (let r = 0; r < this.grid.length && !collided; r++) {
        const row = this.grid[r];
        if (!row) continue;
        for (let c = 0; c < row.length && !collided; c++) {
          if (row[c] === null) continue;
          const bx = this.bubbleX(r, c);
          const by = this.bubbleY(r);
          const ddx = fb.x - bx;
          const ddy = fb.y - by;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dist < this.bubbleDiameter * 0.9) {
            collided = true;
            const snap = this.snapToGrid(fb.x, fb.y);
            this.flying = null;
            this.placeBubble(snap.row, snap.col, fb.colorIdx);
            this.canShoot = true;
          }
        }
      }
    }

    // Update pop animations (scale down with easing)
    for (let i = this.popAnims.length - 1; i >= 0; i--) {
      this.popAnims[i].t += dt * 4; // slower than before for smoother anim
      if (this.popAnims[i].t >= 1) {
        this.popAnims.splice(i, 1);
      }
    }

    // Update drop animations (with bounce at bottom)
    const bounceFloor = this.height - this.bubbleRadius;
    for (let i = this.dropAnims.length - 1; i >= 0; i--) {
      const da = this.dropAnims[i];
      da.vy += 900 * dt; // gravity
      da.y += da.vy * dt;
      da.t += dt;

      // Bounce off bottom
      if (da.y >= bounceFloor && da.bounceCount < 2) {
        da.y = bounceFloor;
        da.vy = -Math.abs(da.vy) * 0.4; // dampen each bounce
        da.bounced = true;
        da.bounceCount++;
      }

      // Remove after enough time or off screen
      if (da.t > 2.0 || (da.bounceCount >= 2 && da.y >= bounceFloor)) {
        this.dropAnims.splice(i, 1);
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────
  render(): void {
    this.clear(BG_COLOR);

    // Grid background area
    const gridBgTop = this.gridOffsetY - this.bubbleRadius;
    const gridBgBottom = this.deadLineY + this.bubbleRadius;
    this.ctx.fillStyle = GRID_BG_COLOR;
    this.drawRoundRect(
      this.bubbleRadius * 0.3,
      gridBgTop,
      this.width - this.bubbleRadius * 0.6,
      gridBgBottom - gridBgTop,
      this.bubbleRadius * 0.5,
      GRID_BG_COLOR,
    );

    // Dead line indicator
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(200, 160, 130, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.deadLineY);
    this.ctx.lineTo(this.width, this.deadLineY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.restore();

    // Grid bubbles. During a new-row intro, the whole grid slides down one
    // row-height with ease-out so the freshly pushed row appears from above
    // instead of popping in.
    const introOffset = this.rowIntroProgress < 1
      ? -this.rowHeight * (1 - this.easeOut(this.rowIntroProgress))
      : 0;
    for (let r = 0; r < this.grid.length; r++) {
      const row = this.grid[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const ci = row[c];
        if (ci === null) continue;
        let bx = this.bubbleX(r, c);
        let by = this.bubbleY(r) + introOffset;

        // Wobble for extra-hard difficulty
        if (this.preset.wobble) {
          const wobbleAmt = this.bubbleRadius * 0.06;
          bx += Math.sin(this.wobbleTime * 2.5 + r * 0.7 + c * 1.3) * wobbleAmt;
          by += Math.cos(this.wobbleTime * 3.1 + r * 1.1 + c * 0.9) * wobbleAmt;
        }

        this.renderBubble(bx, by, ci, this.bubbleRadius);
      }
    }

    // Pop animations (scale down with easing)
    for (const pa of this.popAnims) {
      const eased = this.easeOutCubic(pa.t);
      const scale = 1 - eased;
      if (scale > 0.01) {
        const r = this.bubbleRadius * scale;
        this.ctx.globalAlpha = scale * scale; // fade out faster
        this.renderBubble(pa.x, pa.y, pa.colorIdx, r);
        this.ctx.globalAlpha = 1;
      }
    }

    // Drop animations
    for (const da of this.dropAnims) {
      const fadeStart = 1.2;
      const alpha = da.t < fadeStart ? 1 : Math.max(0, 1 - (da.t - fadeStart) / 0.8);
      this.ctx.globalAlpha = alpha;
      this.renderBubble(da.x, da.y, da.colorIdx, this.bubbleRadius);
      this.ctx.globalAlpha = 1;
    }

    // Flying bubble
    if (this.flying) {
      this.renderBubble(this.flying.x, this.flying.y, this.flying.colorIdx, this.bubbleRadius);
    }

    // Aiming line (smooth dotted line)
    if (!this.flying && !this.isGameOver) {
      this.renderAimLine();
    }

    // Shooter platform
    const platW = Math.floor(this.bubbleRadius * 3.4);
    const platH = Math.floor(this.bubbleRadius * 0.8);
    this.drawRoundRect(
      this.shooterX - platW / 2,
      this.shooterY + this.bubbleRadius * 0.4,
      platW,
      platH,
      platH / 2,
      '#DCC8B8',
    );

    // Current bubble at shooter
    if (!this.flying) {
      this.renderBubble(this.shooterX, this.shooterY, this.currentColor, this.bubbleRadius);
    }

    // Next bubble preview
    const nextLabelX = Math.floor(this.width * 0.12);
    const nextBubbleY = this.shooterY + Math.floor(this.bubbleRadius * 0.3);
    this.drawText('NEXT', nextLabelX, this.shooterY - this.bubbleRadius * 0.8, {
      size: Math.max(9, Math.floor(this.bubbleRadius * 0.5)),
      color: '#B89A82',
      weight: '600',
    });
    this.renderBubble(nextLabelX, nextBubbleY, this.nextColor, this.bubbleRadius * 0.7);

    // Shots until new row indicator
    const shotsLeft = this.preset.shotsBeforeNewRow - this.shotsSinceNewRow;
    const shotsLabelX = Math.floor(this.width * 0.88);
    this.drawText(`${shotsLeft}`, shotsLabelX, this.shooterY - this.bubbleRadius * 0.2, {
      size: Math.max(11, Math.floor(this.bubbleRadius * 0.65)),
      color: '#B89A82',
      weight: '600',
    });
    this.drawText('shots', shotsLabelX, this.shooterY + this.bubbleRadius * 0.5, {
      size: Math.max(8, Math.floor(this.bubbleRadius * 0.45)),
      color: '#D4B8A0',
      weight: '400',
    });
  }

  private renderBubble(x: number, y: number, colorIdx: number, radius: number): void {
    const fill = COLORS[colorIdx] || COLORS[0];
    const border = COLOR_BORDERS[colorIdx] || COLOR_BORDERS[0];

    // Main circle
    this.drawCircle(x, y, radius, fill, border, 1.5);

    // Highlight for 3D effect
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.4, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255,255,255,0.35)';
    this.ctx.fill();
    this.ctx.restore();
  }

  private renderAimLine(): void {
    const clampedAngle = Math.max(-Math.PI + 0.15, Math.min(-0.15, this.aimAngle));

    this.ctx.save();

    // Trace the aim path with wall reflections, drawing spaced dots
    let sx = this.shooterX;
    let sy = this.shooterY;
    let dx = Math.cos(clampedAngle);
    let dy = Math.sin(clampedAngle);

    const maxLen = this.height * 1.4;
    const dotSpacing = this.bubbleRadius * 0.7;
    const dotRadius = this.bubbleRadius * 0.12;
    let remaining = maxLen;
    let traveled = 0;
    let iterations = 0;

    while (remaining > 0 && iterations < 200) {
      iterations++;
      // Find nearest wall intersection or ceiling
      let tWall = Infinity;
      let hitSide = 0;

      if (dx < 0) {
        tWall = (this.bubbleRadius - sx) / dx;
        hitSide = -1;
      } else if (dx > 0) {
        tWall = (this.width - this.bubbleRadius - sx) / dx;
        hitSide = 1;
      }

      const tCeiling = dy < 0 ? (this.gridOffsetY - sy) / dy : Infinity;
      const tStep = Math.min(tWall, tCeiling, remaining);

      // Guard against floating-point edge cases that could cause infinite loop
      if (tStep <= 0.001) break;

      // Walk along segment and draw evenly-spaced dots
      if (dotSpacing > 0.5) {
        const startOff = dotSpacing - (traveled % dotSpacing);
        for (let d = startOff; d < tStep; d += dotSpacing) {
          const px = sx + dx * d;
          const py = sy + dy * d;
          const alpha = Math.max(0.1, 1 - (traveled + d) / maxLen);
          this.ctx.beginPath();
          this.ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
          this.ctx.fillStyle = `rgba(180, 150, 130, ${alpha * 0.7})`;
          this.ctx.fill();
        }
      }

      remaining -= tStep;
      traveled += tStep;
      sx = sx + dx * tStep;
      sy = sy + dy * tStep;

      if (tCeiling <= tWall || sy <= this.gridOffsetY) break;

      // Reflect off wall
      if (hitSide !== 0) {
        dx = -dx;
      }
    }

    this.ctx.restore();
  }

  // ── Save / Resume ─────────────────────────────────────────────────
  serialize(): GameSnapshot {
    // Deep-clone the grid so the snapshot is isolated from live state.
    const gridCopy: (number | null)[][] = [];
    for (let r = 0; r < this.grid.length; r++) {
      const row = this.grid[r];
      if (!row) {
        gridCopy[r] = [];
        continue;
      }
      const rowCopy: (number | null)[] = [];
      for (let c = 0; c < row.length; c++) {
        rowCopy.push(row[c] === null || row[c] === undefined ? null : row[c]);
      }
      gridCopy[r] = rowCopy;
    }

    return {
      grid: gridCopy,
      totalRowsAdded: this.totalRowsAdded,
      currentColor: this.currentColor,
      nextColor: this.nextColor,
      shotsSinceNewRow: this.shotsSinceNewRow,
      aimAngle: this.aimAngle,
      wobbleTime: this.wobbleTime,
      gameActive: !this.isGameOver,
    };
  }

  deserialize(state: GameSnapshot): void {
    // Defensive: only restore static grid state. Drop any in-flight bubble or
    // pop/drop animations — start fresh on resume.
    const rawGrid = state.grid as (number | null)[][] | undefined;
    if (Array.isArray(rawGrid)) {
      const restored: (number | null)[][] = [];
      for (let r = 0; r < rawGrid.length; r++) {
        const row = rawGrid[r];
        if (!Array.isArray(row)) {
          restored[r] = [];
          continue;
        }
        const rowCopy: (number | null)[] = [];
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          rowCopy.push(typeof cell === 'number' ? cell : null);
        }
        restored[r] = rowCopy;
      }
      this.grid = restored;
    }

    if (typeof state.totalRowsAdded === 'number') {
      this.totalRowsAdded = state.totalRowsAdded as number;
    }
    if (typeof state.currentColor === 'number') {
      this.currentColor = state.currentColor as number;
    }
    if (typeof state.nextColor === 'number') {
      this.nextColor = state.nextColor as number;
    }
    if (typeof state.shotsSinceNewRow === 'number') {
      this.shotsSinceNewRow = state.shotsSinceNewRow as number;
    }
    if (typeof state.aimAngle === 'number') {
      this.aimAngle = state.aimAngle as number;
    }
    if (typeof state.wobbleTime === 'number') {
      this.wobbleTime = state.wobbleTime as number;
    }

    // Always reset transient state on resume.
    this.flying = null;
    this.popAnims = [];
    this.dropAnims = [];
    this.isAiming = false;
    this.canShoot = true;
    this.rowIntroProgress = 1;
    this.isGameOver = state.gameActive === false ? true : false;
  }

  canSave(): boolean {
    // Don't save mid-shot or while pop/drop/row-intro animations are running —
    // those animations resolve into score/grid changes that would be lost.
    if (this.flying !== null) return false;
    if (this.popAnims.length > 0) return false;
    if (this.dropAnims.length > 0) return false;
    if (this.rowIntroProgress < 1) return false;
    return !this.isGameOver;
  }
}

// ── Registration ──────────────────────────────────────────────────────────
registerGame({
  id: 'bubble-pop',
  name: 'Bubble Pop',
  description: 'Aim, shoot, match & pop!',
  icon: '\u25CF',
  color: '--game-bubble-pop',
  bgGradient: ['#D94A7B', '#E88BAA'],
  category: 'puzzle',
  createGame: (config) => new BubblePopGame(config),
  canvasWidth: 360,
  canvasHeight: 560,
  controls: 'Aim and tap to shoot bubbles',
});
