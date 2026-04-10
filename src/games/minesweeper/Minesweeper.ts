import { GameEngine, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

const LONG_PRESS_MS = 400;
const GAP = 2;

const BG_COLOR = '#FEF0E4';
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
  private lost = false;
  private timer = 0;
  private timerRunning = false;
  private flagCount = 0;
  private pointerDownTime = 0;
  private pointerDownCell: { row: number; col: number } | null = null;
  private isRightClick = false;
  private isShiftClick = false;
  private revealedCount = 0;
  private targetReveals = 0;

  // Keyboard-navigable cursor position
  private cursorRow = 0;
  private cursorCol = 0;

  // For radial mine explosion
  private explodedOrigin: { row: number; col: number } | null = null;

  // Bound listeners so we can remove them on destroy
  private contextMenuHandler: ((e: MouseEvent) => void) | null = null;
  private mouseDownCaptureHandler: ((e: MouseEvent) => void) | null = null;
  private listenersAttached = false;

  init(): void {
    this.attachCanvasListeners();
    // Determine difficulty
    const diff = DIFFICULTY_MAP[this.difficulty] ?? DIFFICULTY_MAP[0];
    this.rows = diff.gridSize;
    this.cols = diff.gridSize;
    this.mineCount = diff.mines;

    // Dynamic canvas sizing — reserve 50px for the shell HUD at top
    const headerHeight = 50;
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
    this.lost = false;
    this.timer = 0;
    this.timerRunning = false;
    this.flagCount = 0;
    this.pointerDownTime = 0;
    this.pointerDownCell = null;
    this.isRightClick = false;
    this.isShiftClick = false;
    this.revealedCount = 0;
    this.targetReveals = this.rows * this.cols - this.mineCount;
    this.explodedOrigin = null;
    this.cursorRow = Math.floor(this.rows / 2);
    this.cursorCol = Math.floor(this.cols / 2);

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

  private attachCanvasListeners(): void {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    // Capture-phase mousedown records shift/button state BEFORE the engine's
    // bubble-phase handler calls handlePointerDown().
    this.mouseDownCaptureHandler = (e: MouseEvent) => {
      this.isRightClick = e.button === 2;
      this.isShiftClick = e.shiftKey;
    };
    this.canvas.addEventListener('mousedown', this.mouseDownCaptureHandler, { capture: true });

    // Suppress native context menu on canvas and treat as flag action.
    this.contextMenuHandler = (e: MouseEvent) => {
      e.preventDefault();
      if (this.won || this.lost) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.width / Math.max(rect.width, 1));
      const y = (e.clientY - rect.top) * (this.height / Math.max(rect.height, 1));
      const cell = this.getCellFromPos(x, y);
      if (!cell) return;
      // If this is the first interaction, contextmenu should NOT place mines
      // or reveal — just flag, matching real Minesweeper behavior.
      this.toggleFlag(cell.row, cell.col);
    };
    this.canvas.addEventListener('contextmenu', this.contextMenuHandler);
  }

  private moveCursor(dr: number, dc: number): void {
    this.cursorRow = Math.max(0, Math.min(this.rows - 1, this.cursorRow + dr));
    this.cursorCol = Math.max(0, Math.min(this.cols - 1, this.cursorCol + dc));
  }

  private revealAtCursor(): void {
    if (this.won || this.lost) return;
    const row = this.cursorRow;
    const col = this.cursorCol;
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
    const cell = this.grid[row][col];
    if (cell.flagged || cell.revealed) return;

    if (this.firstClick) {
      this.firstClick = false;
      this.placeMines(row, col);
      this.timerRunning = true;
    }
    this.revealCell(row, col);
  }

  private flagAtCursor(): void {
    if (this.won || this.lost) return;
    // Prefer the current pointerDown cell if one exists (e.g. finger holding on
    // a cell + keyboard modifier), otherwise fall back to the keyboard cursor.
    const row = this.pointerDownCell ? this.pointerDownCell.row : this.cursorRow;
    const col = this.pointerDownCell ? this.pointerDownCell.col : this.cursorCol;
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
    this.toggleFlag(row, col);
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

    // Check win — all non-mine cells revealed
    const nonMineRevealed = this.countNonMineRevealed();
    if (nonMineRevealed === this.rows * this.cols - this.mineCount) {
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
      this.setScore(finalScore);
      this.gameWin();
      setTimeout(() => {
        this.gameOver();
      }, 600);
    }
  }

  private countNonMineRevealed(): number {
    let count = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.revealed && !cell.mine) count++;
      }
    }
    return count;
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
    // Move cursor to the clicked cell so keyboard follow-ups use it
    this.cursorRow = cell.row;
    this.cursorCol = cell.col;
  }

  protected handlePointerUp(x: number, y: number): void {
    if (this.won || this.lost) return;
    if (!this.pointerDownCell) return;

    const cell = this.getCellFromPos(x, y);
    if (!cell || cell.row !== this.pointerDownCell.row || cell.col !== this.pointerDownCell.col) {
      this.pointerDownCell = null;
      this.isRightClick = false;
      this.isShiftClick = false;
      return;
    }

    const elapsed = performance.now() - this.pointerDownTime;
    const { row, col } = cell;

    if (this.isRightClick || this.isShiftClick || elapsed >= LONG_PRESS_MS) {
      this.toggleFlag(row, col);
    } else {
      const gridCell = this.grid[row][col];
      if (gridCell.flagged) {
        this.pointerDownCell = null;
        this.isRightClick = false;
        this.isShiftClick = false;
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
    this.isRightClick = false;
    this.isShiftClick = false;
  }

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    // Restart shortcut when game is over
    if ((key === 'r' || key === 'R') && (this.won || this.lost)) {
      this.init();
      return;
    }

    if (this.won || this.lost) return;

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault?.();
        this.moveCursor(-1, 0);
        return;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault?.();
        this.moveCursor(1, 0);
        return;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault?.();
        this.moveCursor(0, -1);
        return;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault?.();
        this.moveCursor(0, 1);
        return;
      case ' ':
      case 'Spacebar':
      case 'Enter':
        e.preventDefault?.();
        this.revealAtCursor();
        return;
      case 'f':
      case 'F':
      case 'Shift':
        e.preventDefault?.();
        this.flagAtCursor();
        return;
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

  getHudStats(): Array<{ label: string; value: string }> {
    const remainingMines = this.mineCount - this.flagCount;
    const seconds = Math.floor(this.timer);
    const timeStr = String(seconds).padStart(3, '0');
    return [
      { label: 'Mines', value: String(remainingMines) },
      { label: 'Time', value: timeStr },
    ];
  }

  render(): void {
    this.clear(BG_COLOR);
    this.renderGrid();
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

    this.renderCursor();
  }

  private renderCursor(): void {
    if (this.won || this.lost) return;
    if (
      this.cursorRow < 0 ||
      this.cursorRow >= this.rows ||
      this.cursorCol < 0 ||
      this.cursorCol >= this.cols
    ) {
      return;
    }
    const ctx = this.ctx;
    const cs = this.cellSize;
    const x = this.gridOffsetX + this.cursorCol * (cs + GAP);
    const y = this.gridOffsetY + this.cursorRow * (cs + GAP);
    const radius = Math.max(3, cs * 0.1);

    ctx.save();
    ctx.strokeStyle = '#8B5E83';
    ctx.lineWidth = Math.max(2, cs * 0.08);
    ctx.beginPath();
    ctx.roundRect(x - 1, y - 1, cs + 2, cs + 2, radius + 1);
    ctx.stroke();
    ctx.restore();
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

  // ── Save / Resume ──

  serialize(): GameSnapshot {
    // Deep clone the grid so the snapshot is independent of live state
    const grid = this.grid.map((row) =>
      row.map((cell) => ({
        mine: cell.mine,
        revealed: cell.revealed,
        flagged: cell.flagged,
        adjacentMines: cell.adjacentMines,
      }))
    );

    return {
      rows: this.rows,
      cols: this.cols,
      mineCount: this.mineCount,
      grid,
      firstClick: this.firstClick,
      lost: this.lost,
      timer: this.timer,
      timerRunning: this.timerRunning,
      flagCount: this.flagCount,
      revealedCount: this.revealedCount,
      targetReveals: this.targetReveals,
      cursorRow: this.cursorRow,
      cursorCol: this.cursorCol,
    };
  }

  deserialize(state: GameSnapshot): void {
    try {
      const rows = state.rows as number;
      const cols = state.cols as number;
      const mineCount = state.mineCount as number;
      const rawGrid = state.grid as Array<
        Array<{ mine: boolean; revealed: boolean; flagged: boolean; adjacentMines: number }>
      >;

      // Defensive validation
      if (
        typeof rows !== 'number' ||
        typeof cols !== 'number' ||
        typeof mineCount !== 'number' ||
        rows <= 0 ||
        cols <= 0 ||
        !Array.isArray(rawGrid) ||
        rawGrid.length !== rows
      ) {
        return;
      }
      for (let r = 0; r < rows; r++) {
        if (!Array.isArray(rawGrid[r]) || rawGrid[r].length !== cols) return;
      }

      this.rows = rows;
      this.cols = cols;
      this.mineCount = mineCount;

      this.grid = rawGrid.map((row) =>
        row.map((cell) => ({
          mine: !!cell.mine,
          revealed: !!cell.revealed,
          flagged: !!cell.flagged,
          adjacentMines: typeof cell.adjacentMines === 'number' ? cell.adjacentMines : 0,
          // Restored cells skip animation — show settled state
          revealAnim: 1,
          revealDelay: 0,
          flagAnim: 1,
          flagBounce: false,
        }))
      );

      this.firstClick = (state.firstClick as boolean) ?? false;
      this.lost = (state.lost as boolean) ?? false;
      this.timer = (state.timer as number) ?? 0;
      this.timerRunning = (state.timerRunning as boolean) ?? false;
      this.flagCount = (state.flagCount as number) ?? 0;
      this.revealedCount = (state.revealedCount as number) ?? 0;
      this.targetReveals =
        (state.targetReveals as number) ?? this.rows * this.cols - this.mineCount;
      this.explodedOrigin = null;
      this.pointerDownCell = null;
      this.pointerDownTime = 0;
      this.isRightClick = false;
      this.isShiftClick = false;

      // Restore cursor (backward-compatible: default to center if missing)
      const savedCursorRow = state.cursorRow;
      const savedCursorCol = state.cursorCol;
      this.cursorRow =
        typeof savedCursorRow === 'number' &&
        savedCursorRow >= 0 &&
        savedCursorRow < this.rows
          ? savedCursorRow
          : Math.floor(this.rows / 2);
      this.cursorCol =
        typeof savedCursorCol === 'number' &&
        savedCursorCol >= 0 &&
        savedCursorCol < this.cols
          ? savedCursorCol
          : Math.floor(this.cols / 2);
    } catch {
      // Silently bail on bad state — engine falls back to fresh init()
    }
  }

  canSave(): boolean {
    // No mid-turn animations to worry about — safe to save while game is active
    return !this.lost && !this.won;
  }

  destroy(): void {
    if (this.contextMenuHandler) {
      this.canvas.removeEventListener('contextmenu', this.contextMenuHandler);
      this.contextMenuHandler = null;
    }
    if (this.mouseDownCaptureHandler) {
      this.canvas.removeEventListener('mousedown', this.mouseDownCaptureHandler, {
        capture: true,
      });
      this.mouseDownCaptureHandler = null;
    }
    this.listenersAttached = false;
    super.destroy();
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
