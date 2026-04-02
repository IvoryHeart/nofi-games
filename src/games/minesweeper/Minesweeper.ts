import { GameEngine } from '../../engine/GameEngine';
import { registerGame } from '../registry';

const LONG_PRESS_MS = 400;
const GAP = 2;

const BG_COLOR = '#FEF0E4';
const HEADER_BG = '#F5E6D3';
const UNREVEALED_COLOR = '#E8DDD0';
const UNREVEALED_HIGHLIGHT = '#F2EBE0';
const UNREVEALED_SHADOW = '#CFC4B5';
const REVEALED_COLOR = '#FFF8F0';
const MINE_COLOR = '#2D3748';
const EXPLODED_BG = '#FEB2B2';

const NUMBER_COLORS: Record<number, string> = {
  1: '#6B8FA3',
  2: '#8DC5A2',
  3: '#E8928A',
  4: '#7A6BA3',
  5: '#C07050',
  6: '#60A0A0',
  7: '#2D3748',
  8: '#A0AEC0',
};

interface DifficultyConfig {
  gridSize: number;
  mines: number;
}

const DIFFICULTY_MAP: Record<number, DifficultyConfig> = {
  0: { gridSize: 8, mines: 8 },
  1: { gridSize: 10, mines: 15 },
  2: { gridSize: 12, mines: 30 },
  3: { gridSize: 14, mines: 45 },
};

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number;
  // Reveal animation
  revealAnim: number;       // 0..1 progress of reveal
  revealDelay: number;      // seconds before animation starts
  // Flag animation
  flagAnim: number;         // 0..1 progress of flag pop-in
  flagBounce: boolean;      // whether flag is currently animating
}

class MinesweeperGame extends GameEngine {
  private grid: Cell[][] = [];
  private rows = 8;
  private cols = 8;
  private mineCount = 8;
  private cellSize = 36;
  private gridOffsetX = 0;
  private gridOffsetY = 0;

  private firstClick = true;
  private won = false;
  private lost = false;
  private timer = 0;
  private timerRunning = false;
  private flagCount = 0;
  private pointerDownTime = 0;
  private pointerDownCell: { row: number; col: number } | null = null;
  private isRightClick = false;
  private revealedCount = 0;
  private targetReveals = 0;

  // For radial mine explosion
  private explodedOrigin: { row: number; col: number } | null = null;

  init(): void {
    // Determine difficulty
    const diff = DIFFICULTY_MAP[this.difficulty] ?? DIFFICULTY_MAP[0];
    this.rows = diff.gridSize;
    this.cols = diff.gridSize;
    this.mineCount = diff.mines;

    // Dynamic canvas sizing
    const headerHeight = 44;
    const availableHeight = this.height - 54;
    this.cellSize = Math.floor(
      Math.min(this.width - 8, availableHeight) / diff.gridSize
    );

    // Compute actual grid dimensions
    const gridWidth = this.cols * this.cellSize + (this.cols - 1) * GAP;
    const gridHeight = this.rows * this.cellSize + (this.rows - 1) * GAP;

    // Center horizontally, offset below header vertically
    this.gridOffsetX = Math.floor((this.width - gridWidth) / 2);
    this.gridOffsetY = headerHeight + Math.floor((this.height - headerHeight - gridHeight) / 2);

    this.grid = [];
    this.firstClick = true;
    this.won = false;
    this.lost = false;
    this.timer = 0;
    this.timerRunning = false;
    this.flagCount = 0;
    this.pointerDownTime = 0;
    this.pointerDownCell = null;
    this.isRightClick = false;
    this.revealedCount = 0;
    this.targetReveals = this.rows * this.cols - this.mineCount;
    this.explodedOrigin = null;

    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c] = {
          mine: false,
          revealed: false,
          flagged: false,
          adjacentMines: 0,
          revealAnim: 1,
          revealDelay: 0,
          flagAnim: 1,
          flagBounce: false,
        };
      }
    }
  }

  private placeMines(safeRow: number, safeCol: number): void {
    const safeSet = new Set<string>();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = safeRow + dr;
        const nc = safeCol + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          safeSet.add(`${nr},${nc}`);
        }
      }
    }

    // Collect eligible cells and shuffle to guarantee termination
    const eligible: [number, number][] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!safeSet.has(`${r},${c}`)) eligible.push([r, c]);
      }
    }
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    const minesToPlace = Math.min(this.mineCount, eligible.length);
    for (let i = 0; i < minesToPlace; i++) {
      const [r, c] = eligible[i];
      this.grid[r][c].mine = true;
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c].mine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.grid[nr][nc].mine) {
              count++;
            }
          }
        }
        this.grid[r][c].adjacentMines = count;
      }
    }
  }

  private getCellFromPos(x: number, y: number): { row: number; col: number } | null {
    const gx = x - this.gridOffsetX;
    const gy = y - this.gridOffsetY;
    if (gx < 0 || gy < 0) return null;

    const col = Math.floor(gx / (this.cellSize + GAP));
    const row = Math.floor(gy / (this.cellSize + GAP));

    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;

    const cellX = col * (this.cellSize + GAP);
    const cellY = row * (this.cellSize + GAP);
    if (gx > cellX + this.cellSize || gy > cellY + this.cellSize) return null;

    return { row, col };
  }

  private distanceBetween(r1: number, c1: number, r2: number, c2: number): number {
    return Math.sqrt((r1 - r2) ** 2 + (c1 - c2) ** 2);
  }

  private revealCell(row: number, col: number, cascadeDelay = 0): void {
    const cell = this.grid[row][col];
    if (cell.revealed || cell.flagged) return;

    cell.revealed = true;
    cell.revealAnim = 0;
    cell.revealDelay = cascadeDelay;
    this.revealedCount++;

    if (cell.mine) {
      this.lost = true;
      this.timerRunning = false;
      this.explodedOrigin = { row, col };

      // Radial reveal of all mines from the clicked mine outward
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c].mine && !(r === row && c === col)) {
            if (!this.grid[r][c].revealed) {
              const dist = this.distanceBetween(row, col, r, c);
              this.grid[r][c].revealed = true;
              this.grid[r][c].revealAnim = 0;
              this.grid[r][c].revealDelay = dist * 0.06;
            }
          }
        }
      }

      setTimeout(() => {
        this.setScore(0);
        this.gameOver();
      }, 1200);
      return;
    }

    // Flood fill with wave delay based on distance from click origin
    if (cell.adjacentMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
            if (!this.grid[nr][nc].revealed && !this.grid[nr][nc].flagged) {
              const dist = this.distanceBetween(row, col, nr, nc);
              this.revealCell(nr, nc, cascadeDelay + dist * 0.04);
            }
          }
        }
      }
    }

    // Check win
    if (this.revealedCount === this.targetReveals) {
      this.won = true;
      this.timerRunning = false;
      const seconds = Math.floor(this.timer);
      const diffMultiplier = 1 + this.difficulty * 0.5;
      const finalScore = Math.max(Math.floor((1000 - seconds * 10) * diffMultiplier), 100);

      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c].mine && !this.grid[r][c].flagged) {
            this.grid[r][c].flagged = true;
            this.grid[r][c].flagAnim = 0;
            this.grid[r][c].flagBounce = true;
            this.flagCount++;
          }
        }
      }
      setTimeout(() => {
        this.setScore(finalScore);
        this.gameOver();
      }, 600);
    }
  }

  private toggleFlag(row: number, col: number): void {
    const cell = this.grid[row][col];
    if (cell.revealed) return;
    if (this.won || this.lost) return;

    cell.flagged = !cell.flagged;
    this.flagCount += cell.flagged ? 1 : -1;

    if (cell.flagged) {
      cell.flagAnim = 0;
      cell.flagBounce = true;
    }
  }

  protected handlePointerDown(x: number, y: number): void {
    if (this.won || this.lost) return;

    const cell = this.getCellFromPos(x, y);
    if (!cell) return;

    this.pointerDownTime = performance.now();
    this.pointerDownCell = cell;
    this.isRightClick = false;
  }

  protected handlePointerUp(x: number, y: number): void {
    if (this.won || this.lost) return;
    if (!this.pointerDownCell) return;

    const cell = this.getCellFromPos(x, y);
    if (!cell || cell.row !== this.pointerDownCell.row || cell.col !== this.pointerDownCell.col) {
      this.pointerDownCell = null;
      return;
    }

    const elapsed = performance.now() - this.pointerDownTime;
    const { row, col } = cell;

    if (this.isRightClick || elapsed >= LONG_PRESS_MS) {
      this.toggleFlag(row, col);
    } else {
      const gridCell = this.grid[row][col];
      if (gridCell.flagged) {
        this.pointerDownCell = null;
        return;
      }

      if (this.firstClick) {
        this.firstClick = false;
        this.placeMines(row, col);
        this.timerRunning = true;
      }

      this.revealCell(row, col);
    }

    this.pointerDownCell = null;
  }

  protected handleKeyDown(key: string, _e: KeyboardEvent): void {
    if (key === 'f' || key === 'F') {
      if (this.pointerDownCell) {
        this.toggleFlag(this.pointerDownCell.row, this.pointerDownCell.col);
      }
    }

    if ((key === 'r' || key === 'R') && (this.won || this.lost)) {
      this.init();
    }
  }

  update(dt: number): void {
    if (this.timerRunning && !this.won && !this.lost) {
      this.timer += dt;
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];

        // Reveal animation
        if (cell.revealed && cell.revealAnim < 1) {
          if (cell.revealDelay > 0) {
            cell.revealDelay -= dt;
          } else {
            // 100ms = speed of 10
            cell.revealAnim = Math.min(1, cell.revealAnim + dt * 10);
          }
        }

        // Flag bounce animation
        if (cell.flagBounce && cell.flagAnim < 1) {
          cell.flagAnim = Math.min(1, cell.flagAnim + dt * 8);
          if (cell.flagAnim >= 1) {
            cell.flagBounce = false;
          }
        }
      }
    }
  }

  render(): void {
    this.clear(BG_COLOR);
    this.renderHeader();
    this.renderGrid();
  }

  private renderHeader(): void {
    const headerHeight = 44;
    const ctx = this.ctx;

    // Header background
    this.drawRoundRect(0, 0, this.width, headerHeight, 0, HEADER_BG);

    // Subtle bottom border
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(this.width, headerHeight);
    ctx.strokeStyle = '#E0D4C5';
    ctx.lineWidth = 1;
    ctx.stroke();

    const remainingMines = this.mineCount - this.flagCount;

    // Mine counter (left)
    this.drawText(`\u{1F4A3} ${remainingMines}`, 40, headerHeight / 2, {
      size: 18,
      color: MINE_COLOR,
      align: 'left',
      weight: '700',
    });

    // Timer (right)
    const seconds = Math.floor(this.timer);
    const timeStr = String(seconds).padStart(3, '0');
    this.drawText(`\u{23F1} ${timeStr}`, this.width - 40, headerHeight / 2, {
      size: 18,
      color: MINE_COLOR,
      align: 'right',
      weight: '700',
    });

    // Win/lose
    if (this.won) {
      this.drawText('You Win!', this.width / 2, headerHeight / 2, {
        size: 18,
        color: '#48BB78',
        align: 'center',
        weight: '800',
      });
    } else if (this.lost) {
      this.drawText('Game Over', this.width / 2, headerHeight / 2, {
        size: 18,
        color: '#E53E3E',
        align: 'center',
        weight: '800',
      });
    }
  }

  private renderGrid(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        const x = this.gridOffsetX + c * (this.cellSize + GAP);
        const y = this.gridOffsetY + r * (this.cellSize + GAP);

        if (cell.revealed) {
          this.renderRevealedCell(cell, x, y, r, c);
        } else {
          this.renderUnrevealedCell(cell, x, y, r, c);
        }
      }
    }
  }

  // Bounce ease: overshoot then settle
  private easeOutBounce(t: number): number {
    if (t < 0.5) {
      return 2 * t * t;
    }
    const overshoot = 1.0 + (1.0 - t) * 0.3 * Math.sin((t - 0.5) * Math.PI * 2);
    return Math.min(overshoot, 1.15);
  }

  private renderUnrevealedCell(cell: Cell, x: number, y: number, _r: number, _c: number): void {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const radius = Math.max(3, cs * 0.1);

    // 3D bevel: shadow (bottom-right)
    this.drawRoundRect(x + 1, y + 2, cs, cs, radius, UNREVEALED_SHADOW);

    // Main cell body
    this.drawRoundRect(x, y, cs, cs, radius, UNREVEALED_COLOR);

    // Highlight on top half for bevel effect
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.roundRect(x, y, cs, cs * 0.5, [radius, radius, 0, 0]);
    ctx.fillStyle = UNREVEALED_HIGHLIGHT;
    ctx.fill();
    ctx.restore();

    // Top-left inner highlight line for extra bevel
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(x + radius, y + 1);
    ctx.lineTo(x + cs - radius, y + 1);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 1, y + radius);
    ctx.lineTo(x + 1, y + cs - radius);
    ctx.stroke();
    ctx.restore();

    // Pressed state
    if (
      this.pointerDownCell &&
      this.pointerDownCell.row === _r &&
      this.pointerDownCell.col === _c &&
      this.pointer.down &&
      !cell.flagged
    ) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      this.drawRoundRect(x, y, cs, cs, radius, '#000');
      ctx.restore();
    }

    // Flag with bounce animation
    if (cell.flagged) {
      ctx.save();
      if (cell.flagBounce) {
        const bounceScale = this.easeOutBounce(cell.flagAnim);
        const cx = x + cs / 2;
        const cy = y + cs / 2;
        ctx.translate(cx, cy);
        ctx.scale(bounceScale, bounceScale);
        ctx.translate(-cx, -cy);
      }
      this.drawFlag(x + cs / 2, y + cs / 2);
      ctx.restore();
    }
  }

  private renderRevealedCell(cell: Cell, x: number, y: number, _r: number, _c: number): void {
    const ctx = this.ctx;
    const anim = cell.revealAnim;
    const cs = this.cellSize;
    const radius = Math.max(3, cs * 0.1);

    if (anim < 1) {
      ctx.save();
      const cx = x + cs / 2;
      const cy = y + cs / 2;
      // Scale from 0.8 to 1.0 with ease-out
      const easedAnim = this.easeOut(anim);
      const scale = 0.8 + 0.2 * easedAnim;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      ctx.globalAlpha = 0.4 + 0.6 * easedAnim;
    }

    // Background
    if (cell.mine && this.lost) {
      this.drawRoundRect(x, y, cs, cs, radius, EXPLODED_BG);
    } else {
      this.drawRoundRect(x, y, cs, cs, radius, REVEALED_COLOR);
      this.drawRoundRect(x, y, cs, cs, radius, '', '#E8DDD0');
    }

    if (cell.mine) {
      this.drawMine(x, y, cs);
    } else if (cell.adjacentMines > 0) {
      const color = NUMBER_COLORS[cell.adjacentMines] || MINE_COLOR;
      const fontSize = Math.max(10, Math.floor(cs * 0.45));
      this.drawText(String(cell.adjacentMines), x + cs / 2, y + cs / 2, {
        size: fontSize,
        color,
        align: 'center',
        weight: '800',
      });
    }

    if (anim < 1) {
      ctx.restore();
    }
  }

  private drawMine(x: number, y: number, cs: number): void {
    const ctx = this.ctx;
    const cx = x + cs / 2;
    const cy = y + cs / 2;
    const bodyRadius = cs * 0.22;
    const spikeInner = cs * 0.14;
    const spikeOuter = cs * 0.33;

    // Body
    this.drawCircle(cx, cy, bodyRadius, MINE_COLOR);

    // Spikes
    ctx.strokeStyle = MINE_COLOR;
    ctx.lineWidth = Math.max(1.5, cs * 0.06);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * spikeInner, cy + Math.sin(angle) * spikeInner);
      ctx.lineTo(cx + Math.cos(angle) * spikeOuter, cy + Math.sin(angle) * spikeOuter);
      ctx.stroke();
    }

    // Shine
    const shineOffset = cs * 0.08;
    const shineRadius = cs * 0.055;
    this.drawCircle(cx - shineOffset, cy - shineOffset, shineRadius, '#FFF');
  }

  private drawFlag(cx: number, cy: number): void {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const scale = cs / 36; // normalize to original 36px cell size

    // Pole
    ctx.beginPath();
    ctx.strokeStyle = '#4A5568';
    ctx.lineWidth = Math.max(1.5, 2 * scale);
    ctx.moveTo(cx, cy - 10 * scale);
    ctx.lineTo(cx, cy + 10 * scale);
    ctx.stroke();

    // Flag triangle
    ctx.beginPath();
    ctx.fillStyle = '#E53E3E';
    ctx.moveTo(cx, cy - 10 * scale);
    ctx.lineTo(cx + 10 * scale, cy - 5 * scale);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();

    // Base
    ctx.beginPath();
    ctx.strokeStyle = '#4A5568';
    ctx.lineWidth = Math.max(1.5, 2 * scale);
    ctx.moveTo(cx - 5 * scale, cy + 10 * scale);
    ctx.lineTo(cx + 5 * scale, cy + 10 * scale);
    ctx.stroke();
  }
}

registerGame({
  id: 'minesweeper',
  name: 'Minesweeper',
  description: 'Find all mines without exploding',
  icon: '\u2691',
  color: '--game-minesweeper',
  bgGradient: ['#6A7B8A', '#9AAAB8'],
  category: 'strategy',
  createGame: (config) => new MinesweeperGame(config),
  canvasWidth: 360,
  canvasHeight: 420,
  controls: 'Tap to reveal, long-press to flag',
});
