import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Difficulty configs ───────────────────────────────────────
interface DifficultyConfig {
  size: number;       // grid is size×size
  preToggles: number; // number of inverse-taps from all-off
  parTaps: number;    // par for scoring (target moves)
  showMoveTarget: boolean;
}

const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { size: 4, preToggles: 5,  parTaps: 6,  showMoveTarget: false }, // Easy
  { size: 5, preToggles: 8,  parTaps: 10, showMoveTarget: false }, // Medium
  { size: 6, preToggles: 12, parTaps: 14, showMoveTarget: false }, // Hard
  { size: 7, preToggles: 16, parTaps: 18, showMoveTarget: true  }, // Extra Hard
];

// ── Layout constants ─────────────────────────────────────────
const TOP_HUD = 50;          // shell HUD height — no in-canvas header
const BOTTOM_PAD = 64;       // reset button area
const SIDE_PAD = 16;
const CELL_GAP = 6;

// ── Animation constants ──────────────────────────────────────
const FLIP_DURATION = 0.22;  // seconds for a single tile to flip
const WIN_DELAY_MS = 1500;

// ── Tile model ───────────────────────────────────────────────
interface Tile {
  on: boolean;
  flipProgress: number; // 1 = settled, 0..1 = mid-flip
}

// ── Easing ───────────────────────────────────────────────────
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

class LightsOutGame extends GameEngine {
  // Grid state
  private grid: Tile[][] = [];
  private size = 5;

  // Puzzle / scoring
  private taps = 0;
  private parTaps = 10;
  private preToggles = 8;
  private showMoveTarget = false;

  // Persisted seed taps so the puzzle can be reset (or reproduced) on demand.
  // Each entry is a (row, col) pair from puzzle generation.
  private seedTaps: Array<[number, number]> = [];

  // Lifecycle
  private gameActive = true;
  private winTimer = 0;       // counts up after gameWin()
  private winScheduled = false;

  // Layout (computed dynamically each init)
  private gridX = 0;
  private gridY = 0;
  private cellSize = 0;

  // Reset button hit area
  private resetBtn = { x: 0, y: 0, w: 0, h: 0 };

  constructor(config: GameConfig) {
    super(config);
  }

  // ── Lifecycle ─────────────────────────────────────────────

  init(): void {
    // Pick difficulty
    const d = Math.min(Math.max(this.difficulty, 0), 3);
    const cfg = DIFFICULTY_CONFIGS[d];
    this.size = cfg.size;
    this.preToggles = cfg.preToggles;
    this.parTaps = cfg.parTaps;
    this.showMoveTarget = cfg.showMoveTarget;

    this.taps = 0;
    this.gameActive = true;
    this.winTimer = 0;
    this.winScheduled = false;

    this.computeLayout();
    this.generatePuzzle();
    this.setScore(0);
  }

  /** Build the grid. Start all-off, then apply N inverse-taps from this.rng().
   *  Because tapping is its own inverse (involution), the same set of taps
   *  applied again returns to all-off — guaranteeing a solvable puzzle. */
  private generatePuzzle(): void {
    // Allocate fresh grid (all off)
    this.grid = [];
    for (let r = 0; r < this.size; r++) {
      const row: Tile[] = [];
      for (let c = 0; c < this.size; c++) {
        row.push({ on: false, flipProgress: 1 });
      }
      this.grid.push(row);
    }

    // Pick `preToggles` random cells and toggle each (with neighbors).
    // We allow duplicates — that's fine; two taps on the same cell cancel out
    // and the puzzle just becomes a little easier. Cap iterations defensively.
    this.seedTaps = [];
    let attempts = 0;
    const maxAttempts = this.preToggles * 4;
    while (this.seedTaps.length < this.preToggles && attempts < maxAttempts) {
      attempts++;
      const r = Math.floor(this.rng() * this.size);
      const c = Math.floor(this.rng() * this.size);
      this.applyToggleNoAnim(r, c);
      this.seedTaps.push([r, c]);
    }

    // Edge case: if RNG conspired to give us all-off (e.g. duplicates cancel),
    // force at least one toggle so the puzzle isn't already solved.
    if (this.isAllOff()) {
      const r = Math.floor(this.rng() * this.size);
      const c = Math.floor(this.rng() * this.size);
      this.applyToggleNoAnim(r, c);
      this.seedTaps.push([r, c]);
    }

    // Make sure all flipProgress values are settled at 1 — generation
    // modifies `on` directly without triggering animations.
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        this.grid[r][c].flipProgress = 1;
      }
    }
  }

  private computeLayout(): void {
    const availW = Math.max(this.width - SIDE_PAD * 2, 1);
    const availH = Math.max(this.height - TOP_HUD - BOTTOM_PAD, 1);
    const maxCell = Math.min(availW, availH);
    // Cell size: subtract gaps from the available square, then divide.
    const totalGap = CELL_GAP * (this.size - 1);
    const cellRaw = (maxCell - totalGap) / this.size;
    this.cellSize = Math.max(Math.floor(cellRaw), 8);

    const gridSidePx = this.cellSize * this.size + CELL_GAP * (this.size - 1);
    this.gridX = Math.floor((this.width - gridSidePx) / 2);
    this.gridY = Math.floor(TOP_HUD + (availH - gridSidePx) / 2);

    // Reset button (bottom center)
    const btnW = Math.min(120, this.width - SIDE_PAD * 2);
    const btnH = 36;
    this.resetBtn = {
      x: Math.floor((this.width - btnW) / 2),
      y: Math.floor(this.height - BOTTOM_PAD / 2 - btnH / 2),
      w: btnW,
      h: btnH,
    };
  }

  // ── Save / Resume ─────────────────────────────────────────

  serialize(): GameSnapshot {
    const flat: number[] = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        flat.push(this.grid[r][c].on ? 1 : 0);
      }
    }
    return {
      size: this.size,
      taps: this.taps,
      parTaps: this.parTaps,
      preToggles: this.preToggles,
      showMoveTarget: this.showMoveTarget,
      seedTaps: this.seedTaps.map(([r, c]) => [r, c]),
      grid: flat,
      gameActive: this.gameActive,
    };
  }

  deserialize(state: GameSnapshot): void {
    const size = state.size as number | undefined;
    const flat = state.grid as unknown;

    if (
      typeof size !== 'number' ||
      size <= 0 ||
      size > 32 ||
      !Array.isArray(flat) ||
      flat.length !== size * size
    ) {
      // Corrupt payload — leave fresh init() state in place.
      return;
    }

    this.size = size;
    this.parTaps = (state.parTaps as number | undefined) ?? this.parTaps;
    this.preToggles = (state.preToggles as number | undefined) ?? this.preToggles;
    this.showMoveTarget = (state.showMoveTarget as boolean | undefined) ?? this.showMoveTarget;
    this.taps = (state.taps as number | undefined) ?? 0;
    this.gameActive = (state.gameActive as boolean | undefined) ?? true;

    // Restore seedTaps if present and valid
    const rawSeed = state.seedTaps as unknown;
    this.seedTaps = [];
    if (Array.isArray(rawSeed)) {
      for (const entry of rawSeed) {
        if (Array.isArray(entry) && entry.length === 2 &&
            typeof entry[0] === 'number' && typeof entry[1] === 'number') {
          this.seedTaps.push([entry[0], entry[1]]);
        }
      }
    }

    // Rebuild grid from flat
    this.grid = [];
    for (let r = 0; r < this.size; r++) {
      const row: Tile[] = [];
      for (let c = 0; c < this.size; c++) {
        const v = flat[r * this.size + c];
        row.push({ on: v === 1, flipProgress: 1 });
      }
      this.grid.push(row);
    }

    this.computeLayout();
    this.winTimer = 0;
    this.winScheduled = false;
  }

  canSave(): boolean {
    if (!this.gameActive) return false;
    // Don't save mid-flip — wait until tiles have settled.
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c].flipProgress < 1) return false;
      }
    }
    return true;
  }

  // ── Input ─────────────────────────────────────────────────

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;

    // Reset button
    if (
      x >= this.resetBtn.x && x <= this.resetBtn.x + this.resetBtn.w &&
      y >= this.resetBtn.y && y <= this.resetBtn.y + this.resetBtn.h
    ) {
      this.resetPuzzle();
      return;
    }

    // Translate to grid coordinates
    const relX = x - this.gridX;
    const relY = y - this.gridY;
    if (relX < 0 || relY < 0) return;

    const stride = this.cellSize + CELL_GAP;
    const c = Math.floor(relX / stride);
    const r = Math.floor(relY / stride);
    if (c < 0 || c >= this.size || r < 0 || r >= this.size) return;

    // Reject taps inside the gap area between cells
    const cellLeft = c * stride;
    const cellTop = r * stride;
    if (relX > cellLeft + this.cellSize || relY > cellTop + this.cellSize) return;

    this.toggleCell(r, c);
    this.taps++;
    this.playSound('click');
    this.haptic('light');

    if (this.isAllOff()) {
      this.handleSolved();
    }
  }

  /** Toggle a cell + 4 cardinal neighbors (with flip animation). */
  private toggleCell(r: number, c: number): void {
    const targets: Array<[number, number]> = [
      [r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
    ];
    for (const [tr, tc] of targets) {
      if (tr < 0 || tr >= this.size || tc < 0 || tc >= this.size) continue;
      const tile = this.grid[tr][tc];
      tile.on = !tile.on;
      tile.flipProgress = 0; // start flip animation
    }
  }

  /** Toggle without animation — used during puzzle generation. */
  private applyToggleNoAnim(r: number, c: number): void {
    const targets: Array<[number, number]> = [
      [r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
    ];
    for (const [tr, tc] of targets) {
      if (tr < 0 || tr >= this.size || tc < 0 || tc >= this.size) continue;
      this.grid[tr][tc].on = !this.grid[tr][tc].on;
    }
  }

  private isAllOff(): boolean {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c].on) return false;
      }
    }
    return true;
  }

  /** Reset the current puzzle to its starting state without re-randomizing. */
  private resetPuzzle(): void {
    // Wipe grid
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        this.grid[r][c].on = false;
        this.grid[r][c].flipProgress = 1;
      }
    }
    // Re-apply seed taps
    for (const [r, c] of this.seedTaps) {
      this.applyToggleNoAnim(r, c);
    }
    this.taps = 0;
    this.setScore(0);
    this.playSound('click');
  }

  private handleSolved(): void {
    if (this.winScheduled) return;
    this.winScheduled = true;
    this.gameActive = false;

    // Score: base + (par - actual) bonus, never negative.
    const base = 500;
    const bonus = Math.max(0, (this.parTaps - this.taps) * 50);
    const final = Math.max(0, base + bonus);
    this.setScore(final);

    this.gameWin();
    setTimeout(() => this.gameOver(), WIN_DELAY_MS);
  }

  // ── Update ────────────────────────────────────────────────

  update(dt: number): void {
    if (this.winScheduled) {
      this.winTimer += dt;
    }

    // Advance flip animations
    const speed = 1 / FLIP_DURATION;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const tile = this.grid[r][c];
        if (tile.flipProgress < 1) {
          tile.flipProgress = Math.min(1, tile.flipProgress + speed * dt);
        }
      }
    }
  }

  // ── Render ────────────────────────────────────────────────

  getHudStats(): Array<{ label: string; value: string }> {
    return [
      { label: 'Moves', value: `${this.taps}` },
      { label: this.showMoveTarget ? 'Target' : 'Par', value: `${this.parTaps}` },
    ];
  }

  render(): void {
    this.clear('#FEF0E4');

    // ── Grid ──
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        this.renderTile(r, c);
      }
    }

    // ── Reset button ──
    this.drawRoundRect(
      this.resetBtn.x,
      this.resetBtn.y,
      this.resetBtn.w,
      this.resetBtn.h,
      8,
      '#8B5E83',
    );
    this.drawText(
      'Reset',
      this.resetBtn.x + this.resetBtn.w / 2,
      this.resetBtn.y + this.resetBtn.h / 2,
      { size: 15, color: '#FFFFFF', weight: '700' },
    );

    // ── Win overlay ──
    if (this.winScheduled && this.winTimer > 0.2) {
      const overlayAlpha = Math.min((this.winTimer - 0.2) * 2, 0.7);
      this.ctx.fillStyle = `rgba(254, 240, 228, ${overlayAlpha})`;
      this.ctx.fillRect(0, 0, this.width, this.height);

      const textAlpha = Math.min((this.winTimer - 0.3) * 3, 1);
      this.ctx.globalAlpha = textAlpha;
      this.drawText('Lights Out!', this.width / 2, this.height / 2 - 16, {
        size: 26,
        color: '#3D2B35',
        weight: '700',
      });
      this.drawText(`${this.taps} moves`, this.width / 2, this.height / 2 + 14, {
        size: 16,
        color: '#8B5E83',
        weight: '500',
      });
      this.ctx.globalAlpha = 1;
    }
  }

  private renderTile(r: number, c: number): void {
    const tile = this.grid[r][c];
    const stride = this.cellSize + CELL_GAP;
    const x = this.gridX + c * stride;
    const y = this.gridY + r * stride;
    const radius = Math.max(4, Math.round(this.cellSize * 0.18));

    // Flip easing — squash horizontally during flip
    const t = easeOutCubic(tile.flipProgress);
    const squash = 0.75 + 0.25 * t; // 0.75 .. 1.0

    const drawW = Math.max(this.cellSize * squash, 1);
    const drawX = x + (this.cellSize - drawW) / 2;

    // ON: warm amber/gold. OFF: muted mauve. Both warm-palette friendly.
    const onColor = '#F5A623';
    const onHighlight = '#F8C775';
    const offColor = '#3D2B35';
    const offBorder = '#5C4452';

    if (tile.on) {
      this.drawRoundRect(drawX, y, drawW, this.cellSize, radius, onColor);
      // Inner highlight
      const inset = Math.max(2, this.cellSize * 0.12);
      if (drawW > inset * 2 && this.cellSize > inset * 2) {
        this.drawRoundRect(
          drawX + inset,
          y + inset,
          drawW - inset * 2,
          this.cellSize * 0.35,
          Math.max(2, radius - 2),
          onHighlight,
        );
      }
    } else {
      this.drawRoundRect(drawX, y, drawW, this.cellSize, radius, offColor, offBorder);
    }
  }
}

registerGame({
  id: 'lights-out',
  name: 'Lights Out',
  description: 'Turn off all the lights',
  icon: 'L',
  color: '--color-primary',
  bgGradient: ['#F5A623', '#F8C775'],
  category: 'puzzle',
  createGame: (config) => new LightsOutGame(config),
  canvasWidth: 360,
  canvasHeight: 600,
  controls: 'Tap a light to toggle it and its neighbors',
  dailyMode: true,
});
