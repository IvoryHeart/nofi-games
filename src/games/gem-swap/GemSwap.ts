import { GameEngine, GameConfig, GameSnapshot, HUD_CLEARANCE } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Types ───────────────────────────────────────────────────────────────────

const ALL_GEM_TYPES = ['diamond', 'circle', 'square', 'triangle', 'star', 'heart', 'hexagon'] as const;
type GemType = (typeof ALL_GEM_TYPES)[number];

// Warm-leaning palette spanning reds, oranges, yellows, greens, blues,
// purples, cyans — saturated enough to read against the cream background
// and still distinguishable for players with mild color blindness thanks
// to the silhouette variety below.
const GEM_COLORS: Record<GemType, string> = {
  diamond:  '#E85B5B', // red
  circle:   '#F59E0B', // amber / orange
  square:   '#FACC15', // yellow
  triangle: '#4CAF5A', // green
  star:     '#8B5EC9', // purple
  heart:    '#EC4E9A', // pink-magenta (still a "heart" vibe)
  hexagon:  '#2BB8C9', // cyan
};

interface Gem {
  type: GemType;
  row: number;
  col: number;
  /** Visual Y offset for falling animation (0 = at rest) */
  visualY: number;
  /** Falling velocity (pixels per second) for gravity acceleration */
  fallVelocity: number;
  /** Scale for pop/shrink animation (1 = normal) */
  scale: number;
  /** Whether gem is being removed */
  removing: boolean;
  /** Sparkle timer for removal animation */
  sparkleTimer: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
}

interface Pos {
  row: number;
  col: number;
}

type GamePhase = 'idle' | 'swapping' | 'removing' | 'falling' | 'checking';

// ── Difficulty settings ─────────────────────────────────────────────────────

interface DifficultySettings {
  gemCount: number;
  totalTime: number;
  cascadeBonusMultiplier: number;
}

const DIFFICULTY_TABLE: DifficultySettings[] = [
  { gemCount: 5, totalTime: 120, cascadeBonusMultiplier: 1 },   // 0: Easy
  { gemCount: 6, totalTime: 90,  cascadeBonusMultiplier: 1 },   // 1: Medium
  { gemCount: 6, totalTime: 60,  cascadeBonusMultiplier: 0.5 }, // 2: Hard
  { gemCount: 7, totalTime: 45,  cascadeBonusMultiplier: 1 },   // 3: Extra Hard
];

// ── Constants ───────────────────────────────────────────────────────────────

const ROWS = 8;
const COLS = 8;
const GAP = 1;
const BASE_SCORE = 50;
const SWAP_DURATION = 0.2; // 200ms cubic ease swap
const REMOVE_DURATION = 0.3; // seconds
const GRAVITY_ACCEL = 2800; // pixels per second^2

// ── Game ────────────────────────────────────────────────────────────────────

class GemSwapGame extends GameEngine {
  private grid: (Gem | null)[][] = [];
  private phase: GamePhase = 'idle';
  private timeLeft = 90;
  private totalTime = 90;
  private comboMultiplier = 1;
  private cascadeBonusMultiplier = 1;
  private gemTypes: GemType[] = [];
  private particles: Particle[] = [];

  // Layout (computed dynamically)
  private cellSize = 44;
  private gridX = 0;
  private gridY = 0;

  // Selection / input
  private selected: Pos | null = null;
  private cursorRow = 0;
  private cursorCol = 0;
  private useKeyboard = false;

  // Drag state
  private dragStart: Pos | null = null;
  private dragging = false;

  // Swap animation
  private swapA: Pos | null = null;
  private swapB: Pos | null = null;
  private swapProgress = 0;
  private swapReverse = false;

  // Pulse animation for selection
  private pulseTimer = 0;

  // Track if we already ended
  private ended = false;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  init(): void {
    // Compute layout
    this.cellSize = Math.floor(Math.min(this.width, this.height - HUD_CLEARANCE) / 8);
    const gridTotalW = COLS * this.cellSize;
    const gridTotalH = ROWS * this.cellSize;
    this.gridX = Math.floor((this.width - gridTotalW) / 2);
    this.gridY = HUD_CLEARANCE + Math.floor((this.height - HUD_CLEARANCE - gridTotalH) / 2);

    // Difficulty
    const diff = Math.max(0, Math.min(3, this.difficulty));
    const settings = DIFFICULTY_TABLE[diff];
    this.totalTime = settings.totalTime;
    this.timeLeft = settings.totalTime;
    this.cascadeBonusMultiplier = settings.cascadeBonusMultiplier;
    this.gemTypes = ALL_GEM_TYPES.slice(0, settings.gemCount) as unknown as GemType[];

    this.grid = [];
    this.phase = 'idle';
    this.comboMultiplier = 1;
    this.selected = null;
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.useKeyboard = false;
    this.dragStart = null;
    this.dragging = false;
    this.swapA = null;
    this.swapB = null;
    this.swapProgress = 0;
    this.swapReverse = false;
    this.pulseTimer = 0;
    this.ended = false;
    this.particles = [];

    // Fill grid ensuring no initial matches
    for (let r = 0; r < ROWS; r++) {
      this.grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        this.grid[r][c] = this.createGem(r, c);
      }
    }

    // Remove any accidental initial matches by re-rolling
    this.removeInitialMatches();

    // If no valid moves from the start, reshuffle
    if (!this.hasValidMoves()) {
      this.reshuffleBoard();
    }
  }

  update(dt: number): void {
    if (this.ended) return;

    this.pulseTimer += dt;

    // Update particles
    this.updateParticles(dt);

    // Timer
    if (this.phase === 'idle') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.ended = true;
        this.gameOver();
        return;
      }
    }

    switch (this.phase) {
      case 'swapping':
        this.updateSwap(dt);
        break;
      case 'removing':
        this.updateRemoving(dt);
        break;
      case 'falling':
        this.updateFalling(dt);
        break;
      case 'checking':
        this.checkForMatches();
        break;
      default:
        break;
    }
  }

  render(): void {
    this.clear('#FEF0E4');
    this.renderGrid();
    this.renderParticles();
    if (this.ended) {
      this.renderGameOver();
    }
  }

  getHudStats(): Array<{ label: string; value: string }> {
    const secs = Math.ceil(this.timeLeft);
    const stats: Array<{ label: string; value: string }> = [
      { label: 'Time', value: `${secs}s` },
    ];
    if (this.comboMultiplier > 1 && (this.phase === 'removing' || this.phase === 'falling' || this.phase === 'checking')) {
      stats.push({ label: 'Combo', value: `x${this.comboMultiplier}` });
    }
    return stats;
  }

  // ── Grid helpers ────────────────────────────────────────────────────────

  private createGem(row: number, col: number): Gem {
    return {
      type: this.gemTypes[Math.floor(this.rng() * this.gemTypes.length)],
      row,
      col,
      visualY: 0,
      fallVelocity: 0,
      scale: 1,
      removing: false,
      sparkleTimer: 0,
    };
  }

  private removeInitialMatches(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let attempts = 0;
        while (attempts < 20 && this.wouldCauseMatch(r, c, this.grid[r][c]!.type)) {
          this.grid[r][c]!.type = this.gemTypes[Math.floor(this.rng() * this.gemTypes.length)];
          attempts++;
        }
      }
    }
  }

  private wouldCauseMatch(row: number, col: number, type: GemType): boolean {
    // Check left
    if (col >= 2) {
      const g1 = this.grid[row][col - 1];
      const g2 = this.grid[row][col - 2];
      if (g1 && g2 && g1.type === type && g2.type === type) return true;
    }
    // Check up
    if (row >= 2) {
      const g1 = this.grid[row - 1]?.[col];
      const g2 = this.grid[row - 2]?.[col];
      if (g1 && g2 && g1.type === type && g2.type === type) return true;
    }
    return false;
  }

  private cellCenter(row: number, col: number): { x: number; y: number } {
    return {
      x: this.gridX + col * this.cellSize + this.cellSize / 2,
      y: this.gridY + row * this.cellSize + this.cellSize / 2,
    };
  }

  private pixelToCell(px: number, py: number): Pos | null {
    const col = Math.floor((px - this.gridX) / this.cellSize);
    const row = Math.floor((py - this.gridY) / this.cellSize);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      return { row, col };
    }
    return null;
  }

  private isAdjacent(a: Pos, b: Pos): boolean {
    const dr = Math.abs(a.row - b.row);
    const dc = Math.abs(a.col - b.col);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  // ── Easing ──────────────────────────────────────────────────────────────

  /** Cubic ease in-out for smooth swap animation */
  private cubicEaseInOut(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ── Match detection ─────────────────────────────────────────────────────

  private findAllMatches(): Set<string> {
    const matched = new Set<string>();

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 3; c++) {
        const g = this.grid[r][c];
        if (!g || g.removing) continue;
        let len = 1;
        while (c + len < COLS) {
          const next = this.grid[r][c + len];
          if (next && !next.removing && next.type === g.type) {
            len++;
          } else {
            break;
          }
        }
        if (len >= 3) {
          for (let i = 0; i < len; i++) {
            matched.add(`${r},${c + i}`);
          }
        }
      }
    }

    // Vertical
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS - 3; r++) {
        const g = this.grid[r][c];
        if (!g || g.removing) continue;
        let len = 1;
        while (r + len < ROWS) {
          const next = this.grid[r + len]?.[c];
          if (next && !next.removing && next.type === g.type) {
            len++;
          } else {
            break;
          }
        }
        if (len >= 3) {
          for (let i = 0; i < len; i++) {
            matched.add(`${r + i},${c}`);
          }
        }
      }
    }

    return matched;
  }

  private checkForMatches(): void {
    const matched = this.findAllMatches();
    if (matched.size > 0) {
      // Score with cascade bonus multiplier
      const effectiveMultiplier = this.comboMultiplier === 1
        ? 1
        : 1 + (this.comboMultiplier - 1) * this.cascadeBonusMultiplier;
      const points = Math.round(matched.size * BASE_SCORE * effectiveMultiplier);
      this.addScore(points);

      // Mark gems for removal and spawn particles
      for (const key of matched) {
        const [r, c] = key.split(',').map(Number);
        const gem = this.grid[r][c];
        if (gem) {
          gem.removing = true;
          gem.sparkleTimer = REMOVE_DURATION;
          this.spawnMatchParticles(r, c, gem.type);
        }
      }

      this.comboMultiplier++;
      this.phase = 'removing';
    } else {
      // No more matches - reset combo, check for valid moves
      this.comboMultiplier = 1;
      this.phase = 'idle';

      if (!this.hasValidMoves()) {
        this.reshuffleBoard();
      }
    }
  }

  private hasValidMoves(): boolean {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Try swap right
        if (c < COLS - 1) {
          this.swapInGrid(r, c, r, c + 1);
          const has = this.findAllMatches().size > 0;
          this.swapInGrid(r, c, r, c + 1);
          if (has) return true;
        }
        // Try swap down
        if (r < ROWS - 1) {
          this.swapInGrid(r, c, r + 1, c);
          const has = this.findAllMatches().size > 0;
          this.swapInGrid(r, c, r + 1, c);
          if (has) return true;
        }
      }
    }
    return false;
  }

  private swapInGrid(r1: number, c1: number, r2: number, c2: number): void {
    const temp = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = temp;
    if (this.grid[r1][c1]) {
      this.grid[r1][c1]!.row = r1;
      this.grid[r1][c1]!.col = c1;
    }
    if (this.grid[r2][c2]) {
      this.grid[r2][c2]!.row = r2;
      this.grid[r2][c2]!.col = c2;
    }
  }

  private reshuffleBoard(): void {
    // Collect all gem types, then redistribute randomly until valid moves exist
    const types: GemType[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c]) {
          types.push(this.grid[r][c]!.type);
        }
      }
    }

    let attempts = 0;
    do {
      // Fisher-Yates shuffle (seeded-safe for daily mode)
      for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
      }

      let idx = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (this.grid[r][c]) {
            this.grid[r][c]!.type = types[idx++];
          }
        }
      }
      attempts++;
    } while (attempts < 100 && (!this.hasValidMoves() || this.findAllMatches().size > 0));

    // If still stuck, just regenerate the whole board
    if (attempts >= 100) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          this.grid[r][c] = this.createGem(r, c);
        }
      }
      this.removeInitialMatches();
    }
  }

  // ── Particles ──────────────────────────────────────────────────────────

  private spawnMatchParticles(row: number, col: number, type: GemType): void {
    const center = this.cellCenter(row, col);
    const color = GEM_COLORS[type];
    const count = 3 + Math.floor(Math.random() * 2); // 3 or 4 particles
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 60 + Math.random() * 80;
      this.particles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.4 + Math.random() * 0.2,
        radius: 2 + Math.random() * 2.5,
        color,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private renderParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const expandScale = 1 + (1 - alpha) * 1.5;
      const r = p.radius * expandScale;
      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      // Bright center
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Swap animation ──────────────────────────────────────────────────────

  private startSwap(a: Pos, b: Pos): void {
    this.phase = 'swapping';
    this.swapA = a;
    this.swapB = b;
    this.swapProgress = 0;
    this.swapReverse = false;
    this.selected = null;
  }

  private updateSwap(dt: number): void {
    if (!this.swapA || !this.swapB) return;

    this.swapProgress += dt / SWAP_DURATION;

    if (this.swapProgress >= 1) {
      this.swapProgress = 1;

      if (!this.swapReverse) {
        // Commit the swap in grid
        this.swapInGrid(this.swapA.row, this.swapA.col, this.swapB.row, this.swapB.col);

        // Check if this swap creates matches
        const matched = this.findAllMatches();
        if (matched.size === 0) {
          // No match - reverse the swap
          this.swapInGrid(this.swapA.row, this.swapA.col, this.swapB.row, this.swapB.col);
          this.swapReverse = true;
          this.swapProgress = 0;
        } else {
          // Valid swap
          this.swapA = null;
          this.swapB = null;
          this.comboMultiplier = 1;
          this.phase = 'checking';
        }
      } else {
        // Reverse animation done
        this.swapA = null;
        this.swapB = null;
        this.phase = 'idle';
      }
    }
  }

  // ── Remove animation ────────────────────────────────────────────────────

  private updateRemoving(dt: number): void {
    let allDone = true;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const gem = this.grid[r][c];
        if (gem && gem.removing) {
          gem.sparkleTimer -= dt;
          gem.scale = Math.max(0, gem.sparkleTimer / REMOVE_DURATION);
          if (gem.sparkleTimer <= 0) {
            this.grid[r][c] = null;
          } else {
            allDone = false;
          }
        }
      }
    }
    if (allDone) {
      this.applyGravity();
      this.phase = 'falling';
    }
  }

  // ── Gravity / falling ───────────────────────────────────────────────────

  private applyGravity(): void {
    for (let c = 0; c < COLS; c++) {
      let writeRow = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (this.grid[r][c]) {
          const gem = this.grid[r][c]!;
          if (r !== writeRow) {
            // Move gem down
            gem.visualY = (r - writeRow) * this.cellSize; // negative offset, will animate to 0
            gem.fallVelocity = 0; // start from rest, gravity will accelerate
            gem.row = writeRow;
            gem.col = c;
            this.grid[writeRow][c] = gem;
            this.grid[r][c] = null;
          }
          writeRow--;
        }
      }
      // Fill empty cells from top
      let spawnIdx = 0;
      for (let r = writeRow; r >= 0; r--) {
        const gem = this.createGem(r, c);
        spawnIdx++;
        gem.visualY = -spawnIdx * this.cellSize; // stagger above grid
        gem.fallVelocity = 0;
        this.grid[r][c] = gem;
      }
    }
  }

  private updateFalling(dt: number): void {
    let allSettled = true;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const gem = this.grid[r][c];
        if (gem && gem.visualY !== 0) {
          allSettled = false;
          if (gem.visualY < 0) {
            // Accelerating downward (gravity feel)
            gem.fallVelocity += GRAVITY_ACCEL * dt;
            gem.visualY += gem.fallVelocity * dt;
            if (gem.visualY >= 0) {
              gem.visualY = 0;
              gem.fallVelocity = 0;
            }
          } else {
            // Shouldn't normally happen, but snap upward if needed
            gem.visualY = 0;
            gem.fallVelocity = 0;
          }
        }
      }
    }
    if (allSettled) {
      this.phase = 'checking';
    }
  }

  // ── Input handling ──────────────────────────────────────────────────────

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (this.ended || this.phase !== 'idle') return;
    this.useKeyboard = true;

    switch (key) {
      case 'ArrowUp':
        e.preventDefault();
        this.cursorRow = Math.max(0, this.cursorRow - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.cursorRow = Math.min(ROWS - 1, this.cursorRow + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.cursorCol = Math.max(0, this.cursorCol - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.cursorCol = Math.min(COLS - 1, this.cursorCol + 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.handleCellAction({ row: this.cursorRow, col: this.cursorCol });
        break;
    }
  }

  protected handlePointerDown(x: number, y: number): void {
    if (this.ended || this.phase !== 'idle') return;
    this.useKeyboard = false;

    const cell = this.pixelToCell(x, y);
    if (!cell) return;

    this.dragStart = cell;
    this.dragging = false;
  }

  protected handlePointerMove(x: number, y: number): void {
    if (this.ended || this.phase !== 'idle' || !this.dragStart) return;

    const cell = this.pixelToCell(x, y);
    if (!cell) return;

    if (cell.row !== this.dragStart.row || cell.col !== this.dragStart.col) {
      if (this.isAdjacent(this.dragStart, cell)) {
        this.dragging = true;
        this.startSwap(this.dragStart, cell);
        this.dragStart = null;
      }
    }
  }

  protected handlePointerUp(x: number, y: number): void {
    if (this.ended) return;

    if (this.dragStart && !this.dragging && this.phase === 'idle') {
      const cell = this.pixelToCell(x, y);
      if (cell) {
        this.handleCellAction(cell);
      }
    }
    this.dragStart = null;
    this.dragging = false;
  }

  private handleCellAction(cell: Pos): void {
    if (this.selected) {
      if (this.isAdjacent(this.selected, cell)) {
        this.startSwap(this.selected, cell);
      } else if (this.selected.row === cell.row && this.selected.col === cell.col) {
        this.selected = null;
      } else {
        this.selected = cell;
      }
    } else {
      this.selected = cell;
    }
  }

  // ── Rendering ───────────────────────────────────────────────────────────


  private renderGrid(): void {
    const ctx = this.ctx;
    const CELL = this.cellSize;

    // Grid background
    this.drawRoundRect(
      this.gridX - 2, this.gridY - 2,
      COLS * CELL + 4, ROWS * CELL + 4,
      6, '#E8DDD4'
    );

    // Cell backgrounds
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = this.gridX + c * CELL + GAP / 2;
        const y = this.gridY + r * CELL + GAP / 2;
        const s = CELL - GAP;
        this.drawRoundRect(x, y, s, s, 4, '#FFFAF5');
      }
    }

    // Gems
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const gem = this.grid[r][c];
        if (!gem) continue;

        let cx = this.gridX + c * CELL + CELL / 2;
        let cy = this.gridY + r * CELL + CELL / 2 + gem.visualY;

        // Swap animation offset with cubic easing
        if (this.phase === 'swapping' && this.swapA && this.swapB) {
          const rawProgress = this.swapReverse ? 1 - this.swapProgress : this.swapProgress;
          const easedProgress = this.cubicEaseInOut(rawProgress);
          if (r === this.swapA.row && c === this.swapA.col) {
            const targetCenter = this.cellCenter(this.swapB.row, this.swapB.col);
            const srcCenter = this.cellCenter(this.swapA.row, this.swapA.col);
            cx = srcCenter.x + (targetCenter.x - srcCenter.x) * easedProgress;
            cy = srcCenter.y + (targetCenter.y - srcCenter.y) * easedProgress;
          } else if (r === this.swapB.row && c === this.swapB.col) {
            const targetCenter = this.cellCenter(this.swapA.row, this.swapA.col);
            const srcCenter = this.cellCenter(this.swapB.row, this.swapB.col);
            cx = srcCenter.x + (targetCenter.x - srcCenter.x) * easedProgress;
            cy = srcCenter.y + (targetCenter.y - srcCenter.y) * easedProgress;
          }
        }

        // Draw glossy 2.5D gem
        this.drawGem(ctx, cx, cy, CELL, gem.type, gem.scale);

        // Sparkle effect on removing gems is drawn centered on the gem
        if (gem.removing && gem.sparkleTimer > 0) {
          ctx.save();
          ctx.translate(cx, cy);
          this.renderSparkle(gem.sparkleTimer);
          ctx.restore();
        }
      }
    }

    // Selected gem highlight with subtle mauve pulse.
    // Matches the brand primary; no shadowBlur (slow on low-end hw).
    if (this.selected && this.phase === 'idle') {
      const sx = this.gridX + this.selected.col * CELL + GAP / 2;
      const sy = this.gridY + this.selected.row * CELL + GAP / 2;
      const ss = CELL - GAP;

      const breathe = 0.5 + 0.5 * Math.sin(this.pulseTimer * 4);

      ctx.save();

      // Outer mauve ring (crisp, no blur)
      ctx.globalAlpha = 0.55 + 0.35 * breathe;
      ctx.strokeStyle = '#8B5E83';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(sx - 1, sy - 1, ss + 2, ss + 2, 6);
      ctx.stroke();

      // Inner soft cream highlight border for contrast on any gem colour
      ctx.globalAlpha = 0.35 + 0.25 * breathe;
      ctx.strokeStyle = '#FEF0E4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(sx + 1, sy + 1, ss - 2, ss - 2, 5);
      ctx.stroke();

      ctx.restore();
    }

    // Keyboard cursor
    if (this.useKeyboard && this.phase === 'idle') {
      const kx = this.gridX + this.cursorCol * CELL + GAP / 2;
      const ky = this.gridY + this.cursorRow * CELL + GAP / 2;
      const ks = CELL - GAP;

      ctx.save();
      ctx.strokeStyle = '#2D3748';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.roundRect(kx, ky, ks, ks, 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  /**
   * Draws a single glossy 2.5D gem at (x, y) inside a `size`-wide cell.
   *
   * Layered look:
   *   1. Per-type silhouette path (circle, rounded square, diamond, hex,
   *      triangle, star, heart) so players can distinguish gems without
   *      relying on colour alone.
   *   2. Radial gradient offset to the top-left — reads as "lit from above-left".
   *      Uses `createRadialGradient(hi-x, hi-y, 0, cx, cy, r)`.
   *   3. Specular highlight: small semi-transparent white ellipse,
   *      slightly rotated, sitting in the top-left quadrant.
   *   4. Thin dark inner stroke to anchor the silhouette against the cell bg.
   *
   * Skips `shadowBlur` — it's the single biggest perf win on low-end mobile
   * GPUs for 64 sprites redrawn every frame.
   *
   * Accepts an explicit `ctx` (instead of reading `this.ctx`) to make the
   * method trivially unit-testable on a throwaway canvas.
   */
  drawGem(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    type: GemType,
    scale: number,
  ): void {
    if (scale <= 0) return;

    const baseColor = GEM_COLORS[type];
    // "Radius" — the per-type silhouette sits inside this envelope.
    // Math.max guards so tiny cells never produce NaN radii.
    const r = Math.max(2, Math.floor(size * 0.38));

    ctx.save();
    ctx.translate(x, y);
    if (scale !== 1) ctx.scale(scale, scale);

    // ── 1. Build silhouette path ─────────────────────────────────────
    ctx.beginPath();
    switch (type) {
      case 'circle': {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        break;
      }
      case 'square': {
        // Rounded square
        const hs = r * 0.9;
        ctx.roundRect(-hs, -hs, hs * 2, hs * 2, Math.max(2, r * 0.22));
        break;
      }
      case 'diamond': {
        // Rotated square — sharp cuts read as "cut gem"
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        break;
      }
      case 'hexagon': {
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      case 'triangle': {
        const h = r * 1.08;
        ctx.moveTo(0, -h);
        ctx.lineTo(h * 0.95, h * 0.65);
        ctx.lineTo(-h * 0.95, h * 0.65);
        ctx.closePath();
        break;
      }
      case 'star': {
        const spikes = 5;
        const outer = r;
        const inner = r * 0.48;
        for (let i = 0; i < spikes * 2; i++) {
          const a = (Math.PI / spikes) * i - Math.PI / 2;
          const rr = i % 2 === 0 ? outer : inner;
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      case 'heart': {
        // Simple bezier heart — symmetric around y axis
        const hs = r * 0.95;
        ctx.moveTo(0, hs * 0.82);
        ctx.bezierCurveTo(-hs * 0.2, hs * 0.4, -hs * 1.1, hs * 0.1, -hs * 1.1, -hs * 0.3);
        ctx.bezierCurveTo(-hs * 1.1, -hs * 0.8, -hs * 0.55, -hs * 1.0, 0, -hs * 0.5);
        ctx.bezierCurveTo(hs * 0.55, -hs * 1.0, hs * 1.1, -hs * 0.8, hs * 1.1, -hs * 0.3);
        ctx.bezierCurveTo(hs * 1.1, hs * 0.1, hs * 0.2, hs * 0.4, 0, hs * 0.82);
        ctx.closePath();
        break;
      }
    }

    // ── 2. Radial gradient fill ──────────────────────────────────────
    // Offset the hot-spot toward the upper-left corner so the gem looks
    // lit from above-left. The gradient radius spans most of the gem.
    const hiX = -r * 0.35;
    const hiY = -r * 0.35;
    const grad = ctx.createRadialGradient(hiX, hiY, 0, 0, 0, r * 1.35);
    grad.addColorStop(0, this.lightenColor(baseColor, 0.55));
    grad.addColorStop(0.45, baseColor);
    grad.addColorStop(1, this.darkenColor(baseColor, 0.32));
    ctx.fillStyle = grad;
    ctx.fill();

    // ── 4. Thin dark inner stroke (drawn on same silhouette path) ────
    ctx.strokeStyle = this.darkenColor(baseColor, 0.45);
    ctx.lineWidth = Math.max(1, Math.floor(r * 0.08));
    ctx.stroke();

    // ── 3. Specular highlight: small white ellipse, top-left ─────────
    ctx.save();
    ctx.translate(-r * 0.32, -r * 0.38);
    ctx.rotate(-Math.PI / 5);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.36, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Smaller, tighter hot spot just above
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(r * 0.04, -r * 0.04, r * 0.14, r * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  private renderSparkle(timer: number): void {
    const ctx = this.ctx;
    const progress = 1 - timer / REMOVE_DURATION;
    const numSparkles = 4;

    ctx.save();
    ctx.globalAlpha = 1 - progress;
    for (let i = 0; i < numSparkles; i++) {
      const angle = (Math.PI * 2 * i) / numSparkles + progress * Math.PI;
      const dist = 8 + progress * 16;
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist;
      const size = 3 * (1 - progress * 0.7);

      // Small expanding circles (particle effect)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();

      // Secondary smaller circle
      const dist2 = dist * 0.6;
      const sx2 = Math.cos(angle + 0.4) * dist2;
      const sy2 = Math.sin(angle + 0.4) * dist2;
      ctx.globalAlpha = (1 - progress) * 0.6;
      ctx.beginPath();
      ctx.arc(sx2, sy2, size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1 - progress;
    }
    ctx.restore();
  }

  private renderGameOver(): void {
    const ctx = this.ctx;

    // Overlay
    ctx.save();
    ctx.fillStyle = 'rgba(254, 240, 228, 0.88)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    this.drawText("Time's Up!", this.width / 2, this.height / 2 - 20, {
      size: 28,
      color: '#2D3748',
      weight: '700',
    });
    this.drawText(`Score: ${this.score}`, this.width / 2, this.height / 2 + 16, {
      size: 18,
      color: '#4A5568',
      weight: '600',
    });
  }

  // ── Color utilities ─────────────────────────────────────────────────────

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 0, g: 0, b: 0 };
  }

  private darkenColor(hex: string, amount: number): string {
    const { r, g, b } = this.hexToRgb(hex);
    const f = 1 - amount;
    return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
  }

  private lightenColor(hex: string, amount: number): string {
    const { r, g, b } = this.hexToRgb(hex);
    return `rgb(${Math.min(255, Math.round(r + (255 - r) * amount))}, ${Math.min(255, Math.round(g + (255 - g) * amount))}, ${Math.min(255, Math.round(b + (255 - b) * amount))})`;
  }

  // ── Save / Resume ───────────────────────────────────────────────────────

  serialize(): GameSnapshot {
    // Deep-clone the grid as plain gem-type cells (drop animation state).
    const grid: (GemType | null)[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const row: (GemType | null)[] = [];
      for (let c = 0; c < COLS; c++) {
        const gem = this.grid[r]?.[c];
        row.push(gem ? gem.type : null);
      }
      grid.push(row);
    }

    // Persist the tap-tap selection as (selectedR, selectedC) with -1
    // meaning "no selection". Older snapshots that omit these fields
    // deserialize to null, preserving backward compatibility.
    const selectedR = this.selected ? this.selected.row : -1;
    const selectedC = this.selected ? this.selected.col : -1;

    return {
      grid,
      timeLeft: this.timeLeft,
      totalTime: this.totalTime,
      comboMultiplier: this.comboMultiplier,
      cascadeBonusMultiplier: this.cascadeBonusMultiplier,
      gemTypes: [...this.gemTypes],
      ended: this.ended,
      selectedR,
      selectedC,
    };
  }

  deserialize(state: GameSnapshot): void {
    // Restore static grid only — discard any in-flight swap/fall/match animations.
    const savedGrid = state.grid as (GemType | null)[][] | undefined;
    if (Array.isArray(savedGrid) && savedGrid.length === ROWS) {
      const newGrid: (Gem | null)[][] = [];
      for (let r = 0; r < ROWS; r++) {
        const row: (Gem | null)[] = [];
        const savedRow = savedGrid[r];
        for (let c = 0; c < COLS; c++) {
          const type = Array.isArray(savedRow) ? savedRow[c] : null;
          if (type) {
            row.push({
              type,
              row: r,
              col: c,
              visualY: 0,
              fallVelocity: 0,
              scale: 1,
              removing: false,
              sparkleTimer: 0,
            });
          } else {
            row.push(null);
          }
        }
        newGrid.push(row);
      }
      this.grid = newGrid;
    }

    if (typeof state.totalTime === 'number') this.totalTime = state.totalTime as number;
    if (typeof state.timeLeft === 'number') this.timeLeft = state.timeLeft as number;
    if (typeof state.comboMultiplier === 'number') this.comboMultiplier = state.comboMultiplier as number;
    if (typeof state.cascadeBonusMultiplier === 'number') this.cascadeBonusMultiplier = state.cascadeBonusMultiplier as number;

    const savedGemTypes = state.gemTypes as GemType[] | undefined;
    if (Array.isArray(savedGemTypes) && savedGemTypes.length > 0) {
      this.gemTypes = [...savedGemTypes];
    }

    this.ended = state.ended === true;

    // Reset all transient/animation state.
    this.phase = 'idle';
    this.dragStart = null;
    this.dragging = false;

    // Restore tap-tap selection (backward compatible: if missing or -1, no selection).
    const sr = state.selectedR;
    const sc = state.selectedC;
    if (
      typeof sr === 'number' && typeof sc === 'number' &&
      sr >= 0 && sr < ROWS && sc >= 0 && sc < COLS
    ) {
      this.selected = { row: sr, col: sc };
    } else {
      this.selected = null;
    }
    this.swapA = null;
    this.swapB = null;
    this.swapProgress = 0;
    this.swapReverse = false;
    this.pulseTimer = 0;
    this.particles = [];
  }

  canSave(): boolean {
    if (this.ended) return false;
    if (this.phase !== 'idle') return false;
    return true;
  }
}

// ── Registration ──────────────────────────────────────────────────────────

registerGame({
  id: 'gem-swap',
  name: 'Gem Swap',
  description: 'Match 3 gems before time runs out',
  icon: '\u25C6',
  color: '--game-gem-swap',
  bgGradient: ['#7B4FC9', '#A98DE0'],
  category: 'puzzle',
  createGame: (config) => new GemSwapGame(config),
  canvasWidth: 360,
  canvasHeight: 440,
  controls: 'Tap to select, tap adjacent to swap',
});
