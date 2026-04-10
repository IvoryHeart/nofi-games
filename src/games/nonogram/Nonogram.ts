import { GameEngine, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Types ─────────────────────────────────────────────────────────

type CellState = 'empty' | 'filled' | 'marked'; // marked = X (player thinks empty)
type Tool = 'fill' | 'mark';

interface DifficultyConfig {
  rows: number;
  cols: number;
  maxMistakes: number; // 0 = infinite (no penalty)
  showMistakes: boolean;
}

const DIFFICULTY_MAP: Record<number, DifficultyConfig> = {
  0: { rows: 5, cols: 5, maxMistakes: 0, showMistakes: false },
  1: { rows: 10, cols: 10, maxMistakes: 0, showMistakes: true },
  2: { rows: 15, cols: 15, maxMistakes: 3, showMistakes: true },
  3: { rows: 15, cols: 20, maxMistakes: 1, showMistakes: true }, // 20 cols × 15 rows
};

// ── Colors (warm palette) ────────────────────────────────────────

const BG_COLOR = '#FEF0E4';
const GRID_BG = '#FFFAF5';
const GRID_LINE = '#E0D4C5';
const GRID_LINE_THICK = '#A89080';
const HINT_BG = '#F5E6D3';
const HINT_TEXT = '#5A4030';
const HINT_DONE = '#B8A998';
const CELL_EMPTY = '#FFFAF5';
const CELL_FILLED = '#5A4030';
const CELL_MARKED_BG = '#FFFAF5';
const CELL_MARKED_X = '#C07050';
const CELL_BAD_FILL = '#E85D5D';
const TOOL_ACTIVE = '#8B5E83';
const TOOL_INACTIVE_BG = '#EDE0D0';
const TOOL_INACTIVE_FG = '#5A4030';
const TEXT_DARK = '#3D2B35';

const LONG_PRESS_MS = 400;

// ── Hints helper ─────────────────────────────────────────────────

function computeLineHints(cells: readonly boolean[]): number[] {
  const hints: number[] = [];
  let run = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]) {
      run++;
    } else if (run > 0) {
      hints.push(run);
      run = 0;
    }
  }
  if (run > 0) hints.push(run);
  if (hints.length === 0) hints.push(0);
  return hints;
}

// ── Game ─────────────────────────────────────────────────────────

class NonogramGame extends GameEngine {
  // Board
  private rows = 5;
  private cols = 5;
  private grid: CellState[][] = [];
  private solution: boolean[][] = [];
  private rowHints: number[][] = [];
  private colHints: number[][] = [];

  // State
  private tool: Tool = 'fill';
  private mistakes = 0;
  private maxMistakes = 0;
  private showMistakes = false;
  private gameActive = false;
  private timer = 0;
  private winTime = 0;

  // Layout
  private cellSize = 0;
  private gridX = 0;
  private gridY = 0;
  private gridW = 0;
  private gridH = 0;
  private rowHintW = 0;
  private colHintH = 0;
  private toolFillRect = { x: 0, y: 0, w: 0, h: 0 };
  private toolMarkRect = { x: 0, y: 0, w: 0, h: 0 };

  // Pointer state for long-press tool toggle
  private pointerDownTime = 0;
  private pointerDownCell: { row: number; col: number } | null = null;
  private longPressFired = false;

  // ── Init ────────────────────────────────────────────────────────

  init(): void {
    const diff = DIFFICULTY_MAP[this.difficulty] ?? DIFFICULTY_MAP[0];
    this.rows = diff.rows;
    this.cols = diff.cols;
    this.maxMistakes = diff.maxMistakes;
    this.showMistakes = diff.showMistakes;

    // Generate solution using seeded RNG (~50% fill rate)
    this.solution = [];
    let safety = 0;
    // Guarantee at least one filled cell — re-roll if all empty
    do {
      this.solution = [];
      for (let r = 0; r < this.rows; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < this.cols; c++) {
          row.push(this.rng() < 0.5);
        }
        this.solution.push(row);
      }
      safety++;
    } while (this.solutionIsEmpty() && safety < 10);

    // If still empty after retries, force a single cell on (defensive)
    if (this.solutionIsEmpty()) {
      this.solution[0][0] = true;
    }

    // Init player grid
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      const row: CellState[] = [];
      for (let c = 0; c < this.cols; c++) {
        row.push('empty');
      }
      this.grid.push(row);
    }

    this.computeHints();
    this.computeLayout();

    this.tool = 'fill';
    this.mistakes = 0;
    this.timer = 0;
    this.winTime = 0;
    this.gameActive = true;
    this.pointerDownTime = 0;
    this.pointerDownCell = null;
    this.longPressFired = false;
  }

  private solutionIsEmpty(): boolean {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.solution[r][c]) return false;
      }
    }
    return true;
  }

  private computeHints(): void {
    this.rowHints = [];
    for (let r = 0; r < this.rows; r++) {
      this.rowHints.push(computeLineHints(this.solution[r]));
    }
    this.colHints = [];
    for (let c = 0; c < this.cols; c++) {
      const col: boolean[] = [];
      for (let r = 0; r < this.rows; r++) {
        col.push(this.solution[r][c]);
      }
      this.colHints.push(computeLineHints(col));
    }
  }

  private computeLayout(): void {
    // Reserve space for shell HUD (top), tool/footer (bottom)
    const headerH = 50;
    const footerH = 70;
    const padding = 8;

    // Determine the maximum number of hints for rows and columns
    let maxRowHints = 1;
    for (const h of this.rowHints) maxRowHints = Math.max(maxRowHints, h.length);
    let maxColHints = 1;
    for (const h of this.colHints) maxColHints = Math.max(maxColHints, h.length);

    // Try a reasonable cell size that fits
    const availW = this.width - padding * 2;
    const availH = this.height - headerH - footerH - padding * 2;

    // Reserve hint area proportional to a base unit; the base unit is roughly the cell size.
    // Solve: cellSize * (cols + maxRowHints * 0.7) <= availW
    //        cellSize * (rows + maxColHints * 0.7) <= availH
    // Hint area uses ~0.7 of cellSize per hint number to keep things compact.
    const hintRatio = 0.7;
    const widthBudget = availW / (this.cols + maxRowHints * hintRatio);
    const heightBudget = availH / (this.rows + maxColHints * hintRatio);
    this.cellSize = Math.max(8, Math.floor(Math.min(widthBudget, heightBudget)));

    this.rowHintW = Math.ceil(this.cellSize * hintRatio * maxRowHints);
    this.colHintH = Math.ceil(this.cellSize * hintRatio * maxColHints);

    this.gridW = this.cellSize * this.cols;
    this.gridH = this.cellSize * this.rows;

    const totalW = this.rowHintW + this.gridW;
    const totalH = this.colHintH + this.gridH;

    const offsetX = Math.max(padding, Math.floor((this.width - totalW) / 2));
    const offsetY = headerH + Math.max(padding, Math.floor((this.height - headerH - footerH - totalH) / 2));

    this.gridX = offsetX + this.rowHintW;
    this.gridY = offsetY + this.colHintH;

    // Tool buttons in footer area
    const footerY = this.height - footerH + 8;
    const btnW = Math.min(120, Math.floor((this.width - 32) / 2));
    const btnH = 44;
    const gap = 12;
    const totalBtnW = btnW * 2 + gap;
    const startX = Math.floor((this.width - totalBtnW) / 2);
    this.toolFillRect = { x: startX, y: footerY, w: btnW, h: btnH };
    this.toolMarkRect = { x: startX + btnW + gap, y: footerY, w: btnW, h: btnH };
  }

  // ── Save / Resume ───────────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      rows: this.rows,
      cols: this.cols,
      grid: this.grid.map(row => [...row]),
      solution: this.solution.map(row => [...row]),
      tool: this.tool,
      mistakes: this.mistakes,
      maxMistakes: this.maxMistakes,
      showMistakes: this.showMistakes,
      timer: this.timer,
      gameActive: this.gameActive,
    };
  }

  deserialize(state: GameSnapshot): void {
    try {
      const rows = state.rows as number | undefined;
      const cols = state.cols as number | undefined;
      const grid = state.grid as CellState[][] | undefined;
      const solution = state.solution as boolean[][] | undefined;

      if (typeof rows !== 'number' || typeof cols !== 'number') return;
      if (rows <= 0 || cols <= 0) return;
      if (!Array.isArray(grid) || grid.length !== rows) return;
      if (!Array.isArray(solution) || solution.length !== rows) return;

      for (let r = 0; r < rows; r++) {
        if (!Array.isArray(grid[r]) || grid[r].length !== cols) return;
        if (!Array.isArray(solution[r]) || solution[r].length !== cols) return;
      }

      this.rows = rows;
      this.cols = cols;
      this.grid = grid.map(row =>
        row.map(cell => (cell === 'filled' || cell === 'marked' || cell === 'empty' ? cell : 'empty'))
      );
      this.solution = solution.map(row => row.map(v => !!v));

      const tool = state.tool as Tool | undefined;
      this.tool = tool === 'fill' || tool === 'mark' ? tool : 'fill';

      const mistakes = state.mistakes as number | undefined;
      this.mistakes = typeof mistakes === 'number' && mistakes >= 0 ? mistakes : 0;

      const maxMistakes = state.maxMistakes as number | undefined;
      this.maxMistakes = typeof maxMistakes === 'number' ? maxMistakes : this.maxMistakes;

      const showMistakes = state.showMistakes as boolean | undefined;
      this.showMistakes = typeof showMistakes === 'boolean' ? showMistakes : this.showMistakes;

      const timer = state.timer as number | undefined;
      this.timer = typeof timer === 'number' && timer >= 0 ? timer : 0;

      const gameActive = state.gameActive as boolean | undefined;
      this.gameActive = typeof gameActive === 'boolean' ? gameActive : true;

      // Recompute derived data
      this.computeHints();
      this.computeLayout();

      this.pointerDownCell = null;
      this.pointerDownTime = 0;
      this.longPressFired = false;
    } catch {
      // Silently bail on bad state — engine falls back to fresh init() state.
    }
  }

  canSave(): boolean {
    return this.gameActive && !this.won;
  }

  // ── Input ──────────────────────────────────────────────────────

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive || this.won) return;

    // Tool toggles
    if (this.hitRect(x, y, this.toolFillRect)) {
      this.tool = 'fill';
      this.haptic('light');
      return;
    }
    if (this.hitRect(x, y, this.toolMarkRect)) {
      this.tool = 'mark';
      this.haptic('light');
      return;
    }

    const cell = this.getCellFromPos(x, y);
    if (!cell) return;

    this.pointerDownTime = performance.now();
    this.pointerDownCell = cell;
    this.longPressFired = false;
  }

  protected handlePointerUp(x: number, y: number): void {
    if (!this.gameActive || this.won) {
      this.pointerDownCell = null;
      return;
    }
    if (!this.pointerDownCell) return;

    const cell = this.getCellFromPos(x, y);
    const startCell = this.pointerDownCell;
    this.pointerDownCell = null;

    if (!cell || cell.row !== startCell.row || cell.col !== startCell.col) {
      return;
    }

    const elapsed = performance.now() - this.pointerDownTime;
    if (elapsed >= LONG_PRESS_MS) {
      // Long-press toggles tool
      this.tool = this.tool === 'fill' ? 'mark' : 'fill';
      this.haptic('medium');
      this.longPressFired = true;
      return;
    }

    this.applyTool(cell.row, cell.col);
  }

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      this.tool = this.tool === 'fill' ? 'mark' : 'fill';
      return;
    }
    if (key === 'f' || key === 'F') {
      this.tool = 'fill';
      return;
    }
    if (key === 'x' || key === 'X' || key === 'm' || key === 'M') {
      this.tool = 'mark';
      return;
    }
  }

  private hitRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  private getCellFromPos(x: number, y: number): { row: number; col: number } | null {
    const gx = x - this.gridX;
    const gy = y - this.gridY;
    if (gx < 0 || gy < 0 || gx >= this.gridW || gy >= this.gridH) return null;
    const col = Math.floor(gx / this.cellSize);
    const row = Math.floor(gy / this.cellSize);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return { row, col };
  }

  applyTool(row: number, col: number): void {
    if (!this.gameActive || this.won) return;

    const current = this.grid[row][col];
    const isSolutionFilled = this.solution[row][col];

    if (this.tool === 'fill') {
      // Toggle fill if already filled, otherwise fill
      if (current === 'filled') {
        this.grid[row][col] = 'empty';
      } else {
        this.grid[row][col] = 'filled';
        // Mistake check: tried to fill an empty solution cell
        if (!isSolutionFilled) {
          this.registerMistake();
          // Even if it's a mistake we leave it placed so the player sees the wrong fill
        } else {
          this.haptic('light');
          this.playSound('score');
        }
      }
    } else {
      // mark tool
      if (current === 'marked') {
        this.grid[row][col] = 'empty';
      } else {
        this.grid[row][col] = 'marked';
        // Marking a cell that should be filled is a mistake on harder modes
        if (isSolutionFilled) {
          this.registerMistake();
        }
      }
    }

    if (this.checkWin()) {
      this.handleWin();
    }
  }

  private registerMistake(): void {
    this.mistakes++;
    this.haptic('heavy');
    this.playSound('gameOver');
    if (this.maxMistakes > 0 && this.mistakes >= this.maxMistakes) {
      this.gameActive = false;
      this.setScore(0);
      // End the game without a win — slight delay so player sees the final state
      setTimeout(() => {
        this.gameOver();
      }, 800);
    }
  }

  private checkWin(): boolean {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const filled = this.grid[r][c] === 'filled';
        if (filled !== this.solution[r][c]) {
          return false;
        }
      }
    }
    return true;
  }

  private handleWin(): void {
    if (this.won) return;
    this.gameActive = false;
    const seconds = Math.floor(this.timer);
    const baseByDifficulty = [400, 800, 1400, 2000];
    const base = baseByDifficulty[this.difficulty] ?? 400;
    const timeBonus = Math.max(0, 600 - seconds * 4);
    const perfectBonus = this.mistakes === 0 ? 300 : 0;
    const finalScore = base + timeBonus + perfectBonus;
    this.setScore(finalScore);
    this.gameWin();
    setTimeout(() => {
      this.gameOver();
    }, 2000);
  }

  // ── Update ─────────────────────────────────────────────────────

  update(dt: number): void {
    if (this.gameActive && !this.won) {
      this.timer += dt;
    } else if (this.won) {
      this.winTime += dt;
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  getHudStats(): Array<{ label: string; value: string }> {
    const seconds = Math.floor(this.timer);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const stats: Array<{ label: string; value: string }> = [
      { label: 'Time', value: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` },
    ];
    if (this.showMistakes) {
      const limitTxt = this.maxMistakes > 0 ? `${this.mistakes}/${this.maxMistakes}` : `${this.mistakes}`;
      stats.push({ label: 'Errors', value: limitTxt });
    }
    return stats;
  }

  render(): void {
    this.clear(BG_COLOR);
    this.renderHints();
    this.renderGrid();
    this.renderToolbar();
    if (this.won) {
      this.renderWinOverlay();
    }
  }

  private renderHints(): void {
    const ctx = this.ctx;

    // Background blocks for hint areas
    ctx.fillStyle = HINT_BG;
    ctx.fillRect(this.gridX - this.rowHintW, this.gridY - this.colHintH, this.rowHintW, this.colHintH);
    ctx.fillRect(this.gridX - this.rowHintW, this.gridY, this.rowHintW, this.gridH);
    ctx.fillRect(this.gridX, this.gridY - this.colHintH, this.gridW, this.colHintH);

    const hintFontSize = Math.max(8, Math.floor(this.cellSize * 0.42));

    // Row hints (left side)
    for (let r = 0; r < this.rows; r++) {
      const hints = this.rowHints[r];
      const cy = this.gridY + r * this.cellSize + this.cellSize / 2;
      const cellSatisfied = this.isRowSatisfied(r);
      const stepX = Math.max(1, Math.floor(this.rowHintW / Math.max(1, hints.length)));
      for (let i = 0; i < hints.length; i++) {
        const cx = this.gridX - this.rowHintW + stepX * i + stepX / 2;
        const color = cellSatisfied ? HINT_DONE : HINT_TEXT;
        this.drawText(String(hints[i]), cx, cy, {
          size: hintFontSize,
          color,
          align: 'center',
          weight: '700',
        });
      }
    }

    // Column hints (top)
    for (let c = 0; c < this.cols; c++) {
      const hints = this.colHints[c];
      const cx = this.gridX + c * this.cellSize + this.cellSize / 2;
      const colSatisfied = this.isColSatisfied(c);
      const stepY = Math.max(1, Math.floor(this.colHintH / Math.max(1, hints.length)));
      for (let i = 0; i < hints.length; i++) {
        const cy = this.gridY - this.colHintH + stepY * i + stepY / 2;
        const color = colSatisfied ? HINT_DONE : HINT_TEXT;
        this.drawText(String(hints[i]), cx, cy, {
          size: hintFontSize,
          color,
          align: 'center',
          weight: '700',
        });
      }
    }
  }

  private isRowSatisfied(r: number): boolean {
    const cells: boolean[] = [];
    for (let c = 0; c < this.cols; c++) {
      cells.push(this.grid[r][c] === 'filled');
    }
    const computed = computeLineHints(cells);
    const expected = this.rowHints[r];
    if (computed.length !== expected.length) return false;
    for (let i = 0; i < computed.length; i++) {
      if (computed[i] !== expected[i]) return false;
    }
    // Also need exact filled count to match the solution row
    let solRunCount = 0;
    for (let c = 0; c < this.cols; c++) if (this.solution[r][c]) solRunCount++;
    let plyRunCount = 0;
    for (let c = 0; c < this.cols; c++) if (this.grid[r][c] === 'filled') plyRunCount++;
    return plyRunCount === solRunCount;
  }

  private isColSatisfied(c: number): boolean {
    const cells: boolean[] = [];
    for (let r = 0; r < this.rows; r++) {
      cells.push(this.grid[r][c] === 'filled');
    }
    const computed = computeLineHints(cells);
    const expected = this.colHints[c];
    if (computed.length !== expected.length) return false;
    for (let i = 0; i < computed.length; i++) {
      if (computed[i] !== expected[i]) return false;
    }
    let solRunCount = 0;
    for (let r = 0; r < this.rows; r++) if (this.solution[r][c]) solRunCount++;
    let plyRunCount = 0;
    for (let r = 0; r < this.rows; r++) if (this.grid[r][c] === 'filled') plyRunCount++;
    return plyRunCount === solRunCount;
  }

  private renderGrid(): void {
    const ctx = this.ctx;

    // Grid background
    ctx.fillStyle = GRID_BG;
    ctx.fillRect(this.gridX, this.gridY, this.gridW, this.gridH);

    // Cells
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.gridX + c * this.cellSize;
        const y = this.gridY + r * this.cellSize;
        const cell = this.grid[r][c];

        if (cell === 'filled') {
          // Show wrong fills in red
          const correct = this.solution[r][c];
          ctx.fillStyle = correct ? CELL_FILLED : CELL_BAD_FILL;
          ctx.fillRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);
        } else if (cell === 'marked') {
          ctx.fillStyle = CELL_MARKED_BG;
          ctx.fillRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);
          // Draw X
          ctx.strokeStyle = CELL_MARKED_X;
          ctx.lineWidth = Math.max(1.2, this.cellSize * 0.08);
          const inset = this.cellSize * 0.25;
          ctx.beginPath();
          ctx.moveTo(x + inset, y + inset);
          ctx.lineTo(x + this.cellSize - inset, y + this.cellSize - inset);
          ctx.moveTo(x + this.cellSize - inset, y + inset);
          ctx.lineTo(x + inset, y + this.cellSize - inset);
          ctx.stroke();
        } else {
          ctx.fillStyle = CELL_EMPTY;
          ctx.fillRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);
        }
      }
    }

    // Thin grid lines
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    for (let i = 0; i <= this.cols; i++) {
      const x = this.gridX + i * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(x, this.gridY);
      ctx.lineTo(x, this.gridY + this.gridH);
      ctx.stroke();
    }
    for (let i = 0; i <= this.rows; i++) {
      const y = this.gridY + i * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(this.gridX, y);
      ctx.lineTo(this.gridX + this.gridW, y);
      ctx.stroke();
    }

    // Thicker lines every 5 cells
    ctx.strokeStyle = GRID_LINE_THICK;
    ctx.lineWidth = 2;
    for (let i = 0; i <= this.cols; i += 5) {
      const x = this.gridX + i * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(x, this.gridY);
      ctx.lineTo(x, this.gridY + this.gridH);
      ctx.stroke();
    }
    for (let i = 0; i <= this.rows; i += 5) {
      const y = this.gridY + i * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(this.gridX, y);
      ctx.lineTo(this.gridX + this.gridW, y);
      ctx.stroke();
    }

    // Outer thick border
    ctx.strokeStyle = GRID_LINE_THICK;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.gridX, this.gridY, this.gridW, this.gridH);
  }

  private renderToolbar(): void {
    const ctx = this.ctx;
    const drawBtn = (
      rect: { x: number; y: number; w: number; h: number },
      label: string,
      icon: string,
      active: boolean,
    ): void => {
      const radius = 10;
      const fill = active ? TOOL_ACTIVE : TOOL_INACTIVE_BG;
      const fg = active ? '#FFFFFF' : TOOL_INACTIVE_FG;
      this.drawRoundRect(rect.x, rect.y, rect.w, rect.h, radius, fill);

      // Mini icon box
      const iconSize = Math.min(rect.h - 16, 22);
      const iconX = rect.x + 12;
      const iconY = rect.y + (rect.h - iconSize) / 2;
      if (icon === 'fill') {
        ctx.fillStyle = fg;
        ctx.fillRect(iconX, iconY, iconSize, iconSize);
      } else {
        ctx.strokeStyle = fg;
        ctx.lineWidth = 2.5;
        const inset = 4;
        ctx.beginPath();
        ctx.moveTo(iconX + inset, iconY + inset);
        ctx.lineTo(iconX + iconSize - inset, iconY + iconSize - inset);
        ctx.moveTo(iconX + iconSize - inset, iconY + inset);
        ctx.lineTo(iconX + inset, iconY + iconSize - inset);
        ctx.stroke();
      }

      this.drawText(label, rect.x + iconSize + 22, rect.y + rect.h / 2, {
        size: 15,
        color: fg,
        align: 'left',
        weight: '700',
      });
    };

    drawBtn(this.toolFillRect, 'Fill', 'fill', this.tool === 'fill');
    drawBtn(this.toolMarkRect, 'Mark', 'x', this.tool === 'mark');
  }

  private renderWinOverlay(): void {
    const ctx = this.ctx;
    const t = Math.min(this.winTime / 0.6, 1);
    ctx.save();
    ctx.globalAlpha = 0.55 * t;
    ctx.fillStyle = '#FEF0E4';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = t;
    const boxW = Math.min(260, this.width - 40);
    const boxH = 90;
    const bx = (this.width - boxW) / 2;
    const by = this.height / 2 - boxH / 2;
    this.drawRoundRect(bx, by, boxW, boxH, 14, '#FFFAF5', '#A89080');
    this.drawText('Solved!', this.width / 2, by + 32, {
      size: 22,
      color: '#48BB78',
      weight: '800',
      align: 'center',
    });
    this.drawText(`Score: ${this.score}`, this.width / 2, by + 62, {
      size: 14,
      color: TEXT_DARK,
      weight: '600',
      align: 'center',
    });
    ctx.restore();
  }
}

registerGame({
  id: 'nonogram',
  name: 'Nonogram',
  description: 'Solve the picture puzzle from row & column clues',
  icon: 'N',
  color: '--color-primary',
  bgGradient: ['#5B7C99', '#8AABC4'],
  category: 'puzzle',
  createGame: (config) => new NonogramGame(config),
  canvasWidth: 360,
  canvasHeight: 640,
  controls: 'Tap to fill, double-tap to mark empty',
  dailyMode: true,
});
