import { GameEngine, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Constants ─────────────────────────────────────────────────────

const GRID_SIZE = 9;
const PICKER_AREA_HEIGHT = 50;

// Colors
const BG_COLOR = '#FEF0E4';
const GRID_BG_COLOR = '#FFFAF5';
const GRID_LINE_COLOR = '#D9CFC6';
const BOX_LINE_COLOR = '#A89080';
const GIVEN_COLOR = '#3D2B35';
const PLAYER_COLOR = '#8B5E83';
const ERROR_COLOR = '#E85D5D';
const SELECTED_CELL_BG = '#E8D8F0';
const SAME_NUMBER_BG = '#F0E8F5';
const SAME_REGION_BG = '#F5F0F8';
const PRIMARY_COLOR = '#8B5E83';

// Difficulty: cells to remove
const DIFFICULTY_REMOVALS = [30, 40, 50, 55];

// Animation durations (seconds)
const POP_DURATION = 0.25;
const SHAKE_DURATION = 0.35;
const SELECT_TRANSITION = 0.12;
const WIN_FLASH_DURATION = 1.2;

// ── Puzzle Generation ──────────────────────────────────────────────

type Board = number[][]; // 0 = empty

function createEmptyBoard(): Board {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function isValidPlacement(board: Board, row: number, col: number, num: number): boolean {
  for (let c = 0; c < 9; c++) {
    if (board[row][c] === num) return false;
  }
  for (let r = 0; r < 9; r++) {
    if (board[r][col] === num) return false;
  }
  const boxR = Math.floor(row / 3) * 3;
  const boxC = Math.floor(col / 3) * 3;
  for (let r = boxR; r < boxR + 3; r++) {
    for (let c = boxC; c < boxC + 3; c++) {
      if (board[r][c] === num) return false;
    }
  }
  return true;
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fillDiagonalBoxes(board: Board): void {
  for (let box = 0; box < 3; box++) {
    const startR = box * 3;
    const startC = box * 3;
    const nums = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let idx = 0;
    for (let r = startR; r < startR + 3; r++) {
      for (let c = startC; c < startC + 3; c++) {
        board[r][c] = nums[idx++];
      }
    }
  }
}

function solveBoard(board: Board): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const nums = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of nums) {
          if (isValidPlacement(board, r, c, num)) {
            board[r][c] = num;
            if (solveBoard(board)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function generateSolvedBoard(): Board {
  const board = createEmptyBoard();
  fillDiagonalBoxes(board);
  solveBoard(board);
  return board;
}

function generatePuzzle(cellsToRemove = 40): { puzzle: Board; solution: Board } {
  const solution = generateSolvedBoard();
  const puzzle: Board = solution.map(row => [...row]);

  const positions: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      positions.push([r, c]);
    }
  }
  shuffleArray(positions);

  let removed = 0;
  for (const [r, c] of positions) {
    if (removed >= cellsToRemove) break;
    puzzle[r][c] = 0;
    removed++;
  }

  return { puzzle, solution };
}

// ── Animation types ────────────────────────────────────────────────

interface PopAnim {
  row: number;
  col: number;
  elapsed: number;
}

interface ShakeAnim {
  row: number;
  col: number;
  elapsed: number;
}

interface SelectAnim {
  // Smooth highlight transition: we track opacity per cell
  prevRow: number;
  prevCol: number;
  elapsed: number;
}

// ── Game Class ─────────────────────────────────────────────────────

class SudokuGame extends GameEngine {
  // Layout (computed dynamically)
  private cellSize = 0;
  private gridX = 0;
  private gridY = 0;
  private gridPx = 0;
  private pickerY = 0;
  private pickerBtnR = 0;
  private pickerSpacing = 0;
  private pickerStartX = 0;

  // Board state
  private solution: Board = [];
  private given: boolean[][] = [];
  private playerBoard: Board = [];
  private errors: boolean[][] = [];

  // Selection
  private selRow = -1;
  private selCol = -1;
  private selectedPickerNum = 0;

  // Timing
  private timer = 0;
  private winTime = 0; // tracks time since win for animation
  private gameActive = false;

  // Animations
  private popAnims: PopAnim[] = [];
  private shakeAnims: ShakeAnim[] = [];
  private selectAnim: SelectAnim = { prevRow: -1, prevCol: -1, elapsed: 1 };
  private selectionAlpha = 0; // smooth highlight alpha (0..1)

  // ── Layout calculation ──────────────────────────────────────────

  private computeLayout(): void {
    const gridAreaHeight = this.height - 60; // 50 for picker + 10 padding
    this.cellSize = Math.floor(Math.min(this.width - 16, gridAreaHeight) / 9);
    this.gridPx = this.cellSize * GRID_SIZE;
    this.gridX = Math.floor((this.width - this.gridPx) / 2);
    this.gridY = Math.floor((gridAreaHeight - this.gridPx) / 2) + 4;

    // Number picker at bottom
    this.pickerY = this.gridY + this.gridPx + PICKER_AREA_HEIGHT / 2 + 5;
    this.pickerBtnR = Math.min(Math.floor(this.cellSize * 0.45), 18);
    this.pickerSpacing = this.gridPx / 9;
    this.pickerStartX = this.gridX + this.pickerSpacing / 2;
  }

  // ── Init ────────────────────────────────────────────────────────

  init(): void {
    this.computeLayout();

    const removals = DIFFICULTY_REMOVALS[this.difficulty] ?? 40;
    const { puzzle, solution } = generatePuzzle(removals);
    this.solution = solution;
    this.playerBoard = puzzle.map(row => [...row]);
    this.given = [];
    this.errors = [];
    for (let r = 0; r < 9; r++) {
      this.given[r] = [];
      this.errors[r] = [];
      for (let c = 0; c < 9; c++) {
        this.given[r][c] = puzzle[r][c] !== 0;
        this.errors[r][c] = false;
      }
    }
    this.selRow = -1;
    this.selCol = -1;
    this.selectedPickerNum = 0;
    this.timer = 0;
    this.winTime = 0;
    this.popAnims = [];
    this.shakeAnims = [];
    this.selectAnim = { prevRow: -1, prevCol: -1, elapsed: 1 };
    this.selectionAlpha = 0;
    this.gameActive = true;
  }

  // ── Save / Resume ───────────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      playerBoard: this.playerBoard.map(row => [...row]),
      given: this.given.map(row => [...row]),
      solution: this.solution.map(row => [...row]),
      errors: this.errors.map(row => [...row]),
      mistakes: 0,
      selRow: this.selRow,
      selCol: this.selCol,
      selectedPickerNum: this.selectedPickerNum,
      timer: this.timer,
      gameActive: this.gameActive,
    };
  }

  deserialize(state: GameSnapshot): void {
    try {
      const playerBoard = state.playerBoard as number[][] | undefined;
      const given = state.given as boolean[][] | undefined;
      const solution = state.solution as number[][] | undefined;
      const errors = state.errors as boolean[][] | undefined;

      if (!Array.isArray(playerBoard) || playerBoard.length !== 9) return;
      if (!Array.isArray(given) || given.length !== 9) return;
      if (!Array.isArray(solution) || solution.length !== 9) return;

      for (let r = 0; r < 9; r++) {
        if (!Array.isArray(playerBoard[r]) || playerBoard[r].length !== 9) return;
        if (!Array.isArray(given[r]) || given[r].length !== 9) return;
        if (!Array.isArray(solution[r]) || solution[r].length !== 9) return;
      }

      this.playerBoard = playerBoard.map(row => [...row]);
      this.given = given.map(row => [...row]);
      this.solution = solution.map(row => [...row]);

      if (Array.isArray(errors) && errors.length === 9) {
        this.errors = errors.map(row => Array.isArray(row) && row.length === 9 ? [...row] : Array(9).fill(false));
      } else {
        this.errors = Array.from({ length: 9 }, () => Array(9).fill(false));
      }

      const selRow = state.selRow as number | undefined;
      const selCol = state.selCol as number | undefined;
      this.selRow = typeof selRow === 'number' ? selRow : -1;
      this.selCol = typeof selCol === 'number' ? selCol : -1;

      const selectedPickerNum = state.selectedPickerNum as number | undefined;
      this.selectedPickerNum = typeof selectedPickerNum === 'number' ? selectedPickerNum : 0;

      const timer = state.timer as number | undefined;
      this.timer = typeof timer === 'number' ? timer : 0;

      const gameActive = state.gameActive as boolean | undefined;
      this.gameActive = typeof gameActive === 'boolean' ? gameActive : true;
    } catch {
      // Silently bail on corrupt snapshot — fresh init() state will remain.
    }
  }

  canSave(): boolean {
    return this.gameActive;
  }

  // ── Input ──────────────────────────────────────────────────────

  protected handlePointerDown(x: number, y: number): void {
    if (this.won) return;

    if (this.checkPickerHit(x, y)) return;

    const cell = this.getCellFromPos(x, y);
    if (cell) {
      // Track previous selection for smooth transition
      if (this.selRow !== cell.row || this.selCol !== cell.col) {
        this.selectAnim = { prevRow: this.selRow, prevCol: this.selCol, elapsed: 0 };
        this.selectionAlpha = 0;
      }
      this.selRow = cell.row;
      this.selCol = cell.col;

      // If a picker number is already selected, place it immediately
      if (this.selectedPickerNum > 0 && !this.given[cell.row][cell.col]) {
        this.placeNumber(cell.row, cell.col, this.selectedPickerNum);
      }
    }
  }

  private checkPickerHit(x: number, y: number): boolean {
    for (let i = 0; i < 9; i++) {
      const bx = this.pickerStartX + i * this.pickerSpacing;
      const by = this.pickerY;
      const dx = x - bx;
      const dy = y - by;
      if (dx * dx + dy * dy <= this.pickerBtnR * this.pickerBtnR) {
        const num = i + 1;
        if (this.selectedPickerNum === num) {
          this.selectedPickerNum = 0;
        } else {
          this.selectedPickerNum = num;
        }

        if (this.selRow >= 0 && this.selCol >= 0 && !this.given[this.selRow][this.selCol]) {
          if (this.selectedPickerNum === 0) {
            this.placeNumber(this.selRow, this.selCol, 0);
          } else {
            this.placeNumber(this.selRow, this.selCol, num);
          }
        }
        return true;
      }
    }
    return false;
  }

  private getCellFromPos(x: number, y: number): { row: number; col: number } | null {
    const gx = x - this.gridX;
    const gy = y - this.gridY;
    if (gx < 0 || gy < 0 || gx >= this.gridPx || gy >= this.gridPx) return null;
    const col = Math.floor(gx / this.cellSize);
    const row = Math.floor(gy / this.cellSize);
    if (row < 0 || row >= 9 || col < 0 || col >= 9) return null;
    return { row, col };
  }

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (this.won) return;

    if (key >= '1' && key <= '9') {
      e.preventDefault();
      const num = parseInt(key, 10);
      if (this.selRow >= 0 && this.selCol >= 0 && !this.given[this.selRow][this.selCol]) {
        this.placeNumber(this.selRow, this.selCol, num);
      }
      return;
    }

    if (key === '0' || key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      if (this.selRow >= 0 && this.selCol >= 0 && !this.given[this.selRow][this.selCol]) {
        this.placeNumber(this.selRow, this.selCol, 0);
      }
      return;
    }

    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault();
      const prevRow = this.selRow;
      const prevCol = this.selCol;
      if (this.selRow < 0) {
        this.selRow = 0;
        this.selCol = 0;
      } else {
        if (key === 'ArrowUp') this.selRow = Math.max(0, this.selRow - 1);
        if (key === 'ArrowDown') this.selRow = Math.min(8, this.selRow + 1);
        if (key === 'ArrowLeft') this.selCol = Math.max(0, this.selCol - 1);
        if (key === 'ArrowRight') this.selCol = Math.min(8, this.selCol + 1);
      }
      if (prevRow !== this.selRow || prevCol !== this.selCol) {
        this.selectAnim = { prevRow, prevCol, elapsed: 0 };
        this.selectionAlpha = 0;
      }
    }
  }

  private placeNumber(row: number, col: number, num: number): void {
    this.playerBoard[row][col] = num;

    if (num !== 0) {
      // Trigger pop animation
      this.popAnims = this.popAnims.filter(a => a.row !== row || a.col !== col);
      this.popAnims.push({ row, col, elapsed: 0 });
    }

    // On difficulty 3 (Extra Hard), skip error highlighting
    if (this.difficulty < 3) {
      this.recalcErrors();

      // Check if we just caused an error for this cell, trigger shake
      if (num !== 0 && this.errors[row][col]) {
        this.shakeAnims = this.shakeAnims.filter(a => a.row !== row || a.col !== col);
        this.shakeAnims.push({ row, col, elapsed: 0 });
      }
    } else {
      // Extra Hard: clear all errors (no highlighting)
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          this.errors[r][c] = false;
        }
      }
    }

    this.checkWin();
  }

  // ── Error detection ────────────────────────────────────────────

  private recalcErrors(): void {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        this.errors[r][c] = false;
      }
    }

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = this.playerBoard[r][c];
        if (val === 0) continue;

        for (let c2 = 0; c2 < 9; c2++) {
          if (c2 !== c && this.playerBoard[r][c2] === val) {
            this.errors[r][c] = true;
            this.errors[r][c2] = true;
          }
        }
        for (let r2 = 0; r2 < 9; r2++) {
          if (r2 !== r && this.playerBoard[r2][c] === val) {
            this.errors[r][c] = true;
            this.errors[r2][c] = true;
          }
        }
        const boxR = Math.floor(r / 3) * 3;
        const boxC = Math.floor(c / 3) * 3;
        for (let r2 = boxR; r2 < boxR + 3; r2++) {
          for (let c2 = boxC; c2 < boxC + 3; c2++) {
            if (r2 !== r || c2 !== c) {
              if (this.playerBoard[r2][c2] === val) {
                this.errors[r][c] = true;
                this.errors[r2][c2] = true;
              }
            }
          }
        }
      }
    }
  }

  // ── Win check ──────────────────────────────────────────────────

  private checkWin(): void {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.playerBoard[r][c] === 0) return;
      }
    }
    // Match solution (handles Extra Hard mode where errors are not shown)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.playerBoard[r][c] !== this.solution[r][c]) return;
      }
    }

    this.winTime = 0;
    this.gameActive = false;
    const seconds = Math.floor(this.timer);
    const finalScore = Math.max(2000 - seconds * 3, 200);
    this.setScore(finalScore);
    this.gameWin();
    setTimeout(() => {
      this.gameOver();
    }, 2000);
  }

  // ── Update ─────────────────────────────────────────────────────

  update(dt: number): void {
    if (!this.won) {
      this.timer += dt;
    } else {
      this.winTime += dt;
    }

    // Update pop animations
    for (let i = this.popAnims.length - 1; i >= 0; i--) {
      this.popAnims[i].elapsed += dt;
      if (this.popAnims[i].elapsed >= POP_DURATION) {
        this.popAnims.splice(i, 1);
      }
    }

    // Update shake animations
    for (let i = this.shakeAnims.length - 1; i >= 0; i--) {
      this.shakeAnims[i].elapsed += dt;
      if (this.shakeAnims[i].elapsed >= SHAKE_DURATION) {
        this.shakeAnims.splice(i, 1);
      }
    }

    // Update selection transition
    if (this.selectAnim.elapsed < SELECT_TRANSITION) {
      this.selectAnim.elapsed += dt;
      this.selectionAlpha = Math.min(1, this.selectAnim.elapsed / SELECT_TRANSITION);
    } else {
      this.selectionAlpha = 1;
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  render(): void {
    this.clear(BG_COLOR);
    this.renderGridBackground();
    this.renderCellBackgrounds();
    this.renderGridLines();
    this.renderNumbers();
    this.renderTimer();
    this.renderPicker();
    if (this.won) {
      this.renderWinAnimation();
    }
  }

  private renderGridBackground(): void {
    const ctx = this.ctx;
    // Draw rounded grid background
    const pad = 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(this.gridX - pad, this.gridY - pad, this.gridPx + pad * 2, this.gridPx + pad * 2, 6);
    ctx.fillStyle = GRID_BG_COLOR;
    ctx.fill();
    ctx.restore();
  }

  private renderCellBackgrounds(): void {
    const selectedVal = (this.selRow >= 0 && this.selCol >= 0)
      ? this.playerBoard[this.selRow][this.selCol]
      : 0;

    const ctx = this.ctx;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const x = this.gridX + c * this.cellSize;
        const y = this.gridY + r * this.cellSize;
        let bg: string | null = null;

        if (r === this.selRow && c === this.selCol) {
          bg = SELECTED_CELL_BG;
        } else if (this.selRow >= 0 && this.selCol >= 0) {
          const sameRow = r === this.selRow;
          const sameCol = c === this.selCol;
          const sameBox =
            Math.floor(r / 3) === Math.floor(this.selRow / 3) &&
            Math.floor(c / 3) === Math.floor(this.selCol / 3);

          if (selectedVal !== 0 && this.playerBoard[r][c] === selectedVal) {
            bg = SAME_NUMBER_BG;
          } else if (sameRow || sameCol || sameBox) {
            bg = SAME_REGION_BG;
          }
        }

        if (bg) {
          // Smooth selection transition
          const alpha = (r === this.selRow && c === this.selCol) ? this.selectionAlpha : this.selectionAlpha;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = bg;
          ctx.fillRect(x, y, this.cellSize, this.cellSize);
          ctx.restore();
        }
      }
    }
  }

  private renderGridLines(): void {
    const ctx = this.ctx;

    // Thin cell borders
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 9; i++) {
      const vx = this.gridX + i * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(vx, this.gridY);
      ctx.lineTo(vx, this.gridY + this.gridPx);
      ctx.stroke();

      const hy = this.gridY + i * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(this.gridX, hy);
      ctx.lineTo(this.gridX + this.gridPx, hy);
      ctx.stroke();
    }

    // Thick box borders
    ctx.strokeStyle = BOX_LINE_COLOR;
    ctx.lineWidth = 2;
    for (let i = 0; i <= 3; i++) {
      const vx = this.gridX + i * 3 * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(vx, this.gridY);
      ctx.lineTo(vx, this.gridY + this.gridPx);
      ctx.stroke();

      const hy = this.gridY + i * 3 * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(this.gridX, hy);
      ctx.lineTo(this.gridX + this.gridPx, hy);
      ctx.stroke();
    }
  }

  private renderNumbers(): void {
    const ctx = this.ctx;
    const fontSize = Math.max(12, Math.floor(this.cellSize * 0.48));

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = this.playerBoard[r][c];
        if (val === 0) continue;

        let cx = this.gridX + c * this.cellSize + this.cellSize / 2;
        const cy = this.gridY + r * this.cellSize + this.cellSize / 2;

        let color: string;
        let weight: string;

        if (this.given[r][c]) {
          color = GIVEN_COLOR;
          weight = '700';
        } else if (this.errors[r][c]) {
          color = ERROR_COLOR;
          weight = '600';
        } else {
          color = PLAYER_COLOR;
          weight = '600';
        }

        // Check for active pop animation
        let scale = 1;
        const pop = this.popAnims.find(a => a.row === r && a.col === c);
        if (pop) {
          const t = pop.elapsed / POP_DURATION;
          // Ease: quick scale up to 1.2 then settle back to 1.0
          if (t < 0.4) {
            scale = 1 + 0.2 * (t / 0.4);
          } else {
            scale = 1.2 - 0.2 * ((t - 0.4) / 0.6);
          }
        }

        // Check for shake animation (error)
        const shake = this.shakeAnims.find(a => a.row === r && a.col === c);
        if (shake) {
          const t = shake.elapsed / SHAKE_DURATION;
          // Damped oscillation
          const amplitude = 3 * (1 - t);
          cx += amplitude * Math.sin(t * Math.PI * 6);
        }

        if (scale !== 1) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(scale, scale);
          this.drawText(String(val), 0, 0, {
            size: fontSize,
            color,
            weight,
            align: 'center',
          });
          ctx.restore();
        } else {
          this.drawText(String(val), cx, cy, {
            size: fontSize,
            color,
            weight,
            align: 'center',
          });
        }
      }
    }
  }

  private renderTimer(): void {
    const seconds = Math.floor(this.timer);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Position timer between grid bottom and picker
    const timerY = this.gridY + this.gridPx + 14;
    this.drawText(timeStr, this.width / 2, timerY, {
      size: 13,
      color: '#A89080',
      align: 'center',
      weight: '600',
    });
  }

  private renderPicker(): void {
    for (let i = 0; i < 9; i++) {
      const num = i + 1;
      const bx = this.pickerStartX + i * this.pickerSpacing;
      const by = this.pickerY;
      const isSelected = this.selectedPickerNum === num;

      // Count how many of this number are placed
      let placed = 0;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.playerBoard[r][c] === num) placed++;
        }
      }
      const allPlaced = placed >= 9;

      if (isSelected) {
        this.drawCircle(bx, by, this.pickerBtnR, PRIMARY_COLOR);
        this.drawText(String(num), bx, by, {
          size: Math.max(11, Math.floor(this.pickerBtnR * 0.95)),
          color: '#FFFFFF',
          weight: '700',
          align: 'center',
        });
      } else {
        const fill = allPlaced ? '#EDE4DC' : '#FFFAF5';
        this.drawCircle(bx, by, this.pickerBtnR, fill, GRID_LINE_COLOR, 1);
        this.drawText(String(num), bx, by, {
          size: Math.max(11, Math.floor(this.pickerBtnR * 0.95)),
          color: allPlaced ? '#C4B4A8' : GIVEN_COLOR,
          weight: '600',
          align: 'center',
        });
      }
    }
  }

  private renderWinAnimation(): void {
    const ctx = this.ctx;
    const t = Math.min(this.winTime / WIN_FLASH_DURATION, 1);

    // Green flash wave across the board
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const x = this.gridX + c * this.cellSize;
        const y = this.gridY + r * this.cellSize;

        // Wave pattern: each cell's flash is delayed based on position
        const cellDelay = (r + c) / 16; // 0 to ~1
        const cellT = Math.max(0, Math.min(1, (t - cellDelay) * 3));

        // Flash up then fade
        let alpha: number;
        if (cellT < 0.5) {
          alpha = cellT * 2 * 0.45; // fade in to 0.45
        } else {
          alpha = (1 - cellT) * 2 * 0.45; // fade out
        }

        if (alpha > 0) {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#48BB78';
          ctx.fillRect(x, y, this.cellSize, this.cellSize);
          ctx.restore();
        }
      }
    }

    // Overlay message after flash starts settling
    if (t > 0.3) {
      const msgAlpha = Math.min(1, (t - 0.3) / 0.3);
      ctx.save();
      ctx.globalAlpha = msgAlpha * 0.85;
      ctx.fillStyle = GRID_BG_COLOR;
      const boxW = this.gridPx * 0.7;
      const boxH = 60;
      const boxX = this.gridX + (this.gridPx - boxW) / 2;
      const boxY = this.gridY + this.gridPx / 2 - boxH / 2;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 10);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = msgAlpha;
      this.drawText('Puzzle Solved!', this.width / 2, this.gridY + this.gridPx / 2 - 8, {
        size: Math.max(16, Math.floor(this.cellSize * 0.6)),
        color: '#48BB78',
        weight: '800',
        align: 'center',
      });

      const seconds = Math.floor(this.timer);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      this.drawText(`Time: ${timeStr}`, this.width / 2, this.gridY + this.gridPx / 2 + 16, {
        size: Math.max(12, Math.floor(this.cellSize * 0.4)),
        color: '#A89080',
        weight: '600',
        align: 'center',
      });
      ctx.restore();
    }
  }
}

registerGame({
  id: 'sudoku',
  name: 'Sudoku',
  description: 'Fill the grid with 1-9',
  icon: '#',
  color: '--game-sudoku',
  bgGradient: ['#4A8AC9', '#7BBAE0'],
  category: 'strategy',
  createGame: (config) => new SudokuGame(config),
  canvasWidth: 360,
  canvasHeight: 520,
  controls: 'Tap cell, then tap number to fill',
});
