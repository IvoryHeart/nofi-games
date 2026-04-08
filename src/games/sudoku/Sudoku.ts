import { GameEngine, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Constants ─────────────────────────────────────────────────────

const GRID_SIZE = 9;

// Layout: header at top, grid in middle, picker at bottom.
const HEADER_HEIGHT = 44;       // top header (timer, notes label, etc.)
const PICKER_BTN_HEIGHT = 56;   // per-button height — always >= 48 for touch
const PICKER_AREA_HEIGHT = PICKER_BTN_HEIGHT + 16; // pad top/bottom around buttons

// Colors
const BG_COLOR = '#FEF0E4';
const GRID_BG_COLOR = '#FFFAF5';
const GRID_LINE_COLOR = '#D9CFC6';
const BOX_LINE_COLOR = '#A89080';
const GIVEN_COLOR = '#3D2B35';
const PLAYER_COLOR = '#8B5E83';
const NOTE_COLOR = '#A89080';
const ERROR_COLOR = '#E85D5D';
const SELECTED_CELL_BG = '#E8D8F0';
const SAME_NUMBER_BG = '#F0E8F5';
const SAME_REGION_BG = '#F5F0F8';
const PRIMARY_COLOR = '#8B5E83';
const HEADER_TEXT_COLOR = '#A89080';
const PICKER_BTN_BG = '#FFFAF5';
const PICKER_BTN_ACTIVE_BG = PRIMARY_COLOR;
const PICKER_BTN_ACTIVE_TEXT = '#FFFFFF';
const PICKER_BTN_BORDER = '#D9CFC6';
const NOTES_BTN_BG = '#F5EAE0';
const NOTES_BTN_ACTIVE_BG = '#8B5E83';

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
  private headerY = 0;     // y-center of header row
  private headerH = 0;     // header height
  private pickerY = 0;     // y-top of picker row
  private pickerBtnW = 0;  // per-digit button width
  private pickerBtnH = 0;  // per-digit button height (>= 48)
  private pickerGap = 0;
  private pickerStartX = 0;
  // Back-compat: older tests address buttons as pickerStartX + i * pickerSpacing.
  // Kept as an alias for `pickerBtnW + pickerGap`.
  private pickerSpacing = 0;
  private notesBtnX = 0;
  private notesBtnY = 0;
  private notesBtnW = 0;
  private notesBtnH = 0;

  // Board state
  private solution: Board = [];
  private given: boolean[][] = [];
  private playerBoard: Board = [];
  private errors: boolean[][] = [];
  // notes[r][c] = array of candidate digits (1-9). Empty array = no notes.
  private notes: number[][][] = [];

  // Selection
  private selRow = -1;
  private selCol = -1;
  private selectedPickerNum = 0;
  private notesMode = false;

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
    // Reserved areas above grid (header) and below (picker).
    this.headerH = HEADER_HEIGHT;
    this.headerY = Math.floor(this.headerH / 2) + 4;

    const reserved = this.headerH + PICKER_AREA_HEIGHT + 12; // + padding
    const gridAreaHeight = Math.max(100, this.height - reserved);
    this.cellSize = Math.floor(Math.min(this.width - 16, gridAreaHeight) / 9);
    this.gridPx = this.cellSize * GRID_SIZE;
    this.gridX = Math.floor((this.width - this.gridPx) / 2);
    this.gridY = this.headerH + Math.max(4, Math.floor((gridAreaHeight - this.gridPx) / 2));

    // Picker row sits below grid with padding, anchored to available space.
    const pickerTop = this.gridY + this.gridPx + 12;
    // Ensure it stays on-canvas even if layout gets tight.
    const maxPickerTop = Math.max(pickerTop, this.height - PICKER_AREA_HEIGHT + 4);
    this.pickerY = Math.min(pickerTop, maxPickerTop);

    // Button sizing: 9 number buttons in a row, with small gap.
    // Button height is at least 48 (MIN touch target).
    this.pickerBtnH = Math.max(48, Math.min(PICKER_BTN_HEIGHT, PICKER_AREA_HEIGHT - 16));
    const hMargin = 8;
    const availW = Math.max(180, this.width - hMargin * 2);
    // 9 digit buttons with a small gap
    this.pickerGap = 4;
    const totalGap = this.pickerGap * 8;
    this.pickerBtnW = Math.max(28, Math.floor((availW - totalGap) / 9));
    this.pickerSpacing = this.pickerBtnW + this.pickerGap;
    const actualRowW = this.pickerBtnW * 9 + totalGap;
    this.pickerStartX = Math.floor((this.width - actualRowW) / 2);

    // Notes toggle button: placed in the header row, right-aligned.
    this.notesBtnW = Math.max(60, Math.floor(this.width * 0.22));
    this.notesBtnH = Math.max(28, this.headerH - 12);
    this.notesBtnX = this.width - this.notesBtnW - 10;
    this.notesBtnY = Math.floor((this.headerH - this.notesBtnH) / 2) + 2;
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
    this.notes = [];
    for (let r = 0; r < 9; r++) {
      this.given[r] = [];
      this.errors[r] = [];
      this.notes[r] = [];
      for (let c = 0; c < 9; c++) {
        this.given[r][c] = puzzle[r][c] !== 0;
        this.errors[r][c] = false;
        this.notes[r][c] = [];
      }
    }
    this.selRow = -1;
    this.selCol = -1;
    this.selectedPickerNum = 0;
    this.notesMode = false;
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
      // notes: 9x9 grid of number[] — each inner array lists the candidate
      // digits (1-9) currently pencilled into that cell.
      notes: this.notes.map(row => row.map(cell => [...cell])),
      notesMode: this.notesMode,
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

      // Notes: 9x9 of number[]. Missing/invalid cells fall back to empty.
      const rawNotes = state.notes as unknown;
      this.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [] as number[]));
      if (Array.isArray(rawNotes) && rawNotes.length === 9) {
        for (let r = 0; r < 9; r++) {
          const row = rawNotes[r];
          if (!Array.isArray(row) || row.length !== 9) continue;
          for (let c = 0; c < 9; c++) {
            const cell = row[c];
            if (Array.isArray(cell)) {
              const clean: number[] = [];
              for (const v of cell) {
                if (typeof v === 'number' && v >= 1 && v <= 9 && !clean.includes(v)) {
                  clean.push(v);
                }
              }
              this.notes[r][c] = clean;
            }
          }
        }
      }

      const notesMode = state.notesMode as boolean | undefined;
      this.notesMode = typeof notesMode === 'boolean' ? notesMode : false;

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

    // Notes toggle button in the header
    if (
      x >= this.notesBtnX && x <= this.notesBtnX + this.notesBtnW &&
      y >= this.notesBtnY && y <= this.notesBtnY + this.notesBtnH
    ) {
      this.notesMode = !this.notesMode;
      return;
    }

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

      // If a picker number is already selected, place it immediately (fill mode only).
      // In notes mode, tapping a cell just selects it; the digit buttons add notes.
      if (!this.notesMode && this.selectedPickerNum > 0 && !this.given[cell.row][cell.col]) {
        this.placeNumber(cell.row, cell.col, this.selectedPickerNum);
      }
    }
  }

  private checkPickerHit(x: number, y: number): boolean {
    // Vertical bounds check first
    if (y < this.pickerY || y > this.pickerY + this.pickerBtnH) return false;

    for (let i = 0; i < 9; i++) {
      const bx = this.pickerStartX + i * (this.pickerBtnW + this.pickerGap);
      if (x >= bx && x <= bx + this.pickerBtnW) {
        const num = i + 1;
        if (this.notesMode) {
          // Notes mode: tapping a digit always highlights it and toggles the
          // candidate for the selected cell. There's no "deselect" concept in
          // notes mode because notes add/remove freely.
          this.selectedPickerNum = num;
          if (this.selRow >= 0 && this.selCol >= 0 && !this.given[this.selRow][this.selCol]) {
            this.toggleNote(this.selRow, this.selCol, num);
          }
        } else {
          // Fill mode: re-tapping the currently-active digit deselects it and
          // clears the cell (original behaviour preserved for existing tests).
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
        }
        return true;
      }
    }
    return false;
  }

  private toggleNote(row: number, col: number, num: number): void {
    if (num < 1 || num > 9) return;
    // Don't add notes to a cell that already has a final value.
    if (this.playerBoard[row][col] !== 0) return;
    const cellNotes = this.notes[row][col];
    const idx = cellNotes.indexOf(num);
    if (idx >= 0) {
      cellNotes.splice(idx, 1);
    } else {
      cellNotes.push(num);
      cellNotes.sort((a, b) => a - b);
    }
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

    // Toggle notes mode.
    if (key === 'n' || key === 'N') {
      e.preventDefault();
      this.notesMode = !this.notesMode;
      return;
    }

    if (key >= '1' && key <= '9') {
      e.preventDefault();
      const num = parseInt(key, 10);
      if (this.selRow >= 0 && this.selCol >= 0 && !this.given[this.selRow][this.selCol]) {
        this.selectedPickerNum = num;
        if (this.notesMode) {
          this.toggleNote(this.selRow, this.selCol, num);
        } else {
          this.placeNumber(this.selRow, this.selCol, num);
        }
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

    // Setting a final value (or clearing the cell) always wipes its notes.
    this.notes[row][col] = [];

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
    this.renderHeader();
    this.renderGridBackground();
    this.renderCellBackgrounds();
    this.renderGridLines();
    this.renderNotes();
    this.renderNumbers();
    this.renderPicker();
    if (this.won) {
      this.renderWinAnimation();
    }
  }

  private renderHeader(): void {
    // Timer (left-aligned) — moved from below the picker up into the header.
    const seconds = Math.floor(this.timer);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    this.drawText(timeStr, 12, this.headerY, {
      size: 15,
      color: HEADER_TEXT_COLOR,
      align: 'left',
      weight: '700',
    });

    // Notes toggle button in the header (right-aligned).
    const bg = this.notesMode ? NOTES_BTN_ACTIVE_BG : NOTES_BTN_BG;
    const textColor = this.notesMode ? '#FFFFFF' : GIVEN_COLOR;
    this.drawRoundRect(
      this.notesBtnX, this.notesBtnY,
      this.notesBtnW, this.notesBtnH,
      8, bg, PICKER_BTN_BORDER,
    );
    this.drawText('Notes', this.notesBtnX + this.notesBtnW / 2, this.notesBtnY + this.notesBtnH / 2, {
      size: 13,
      color: textColor,
      weight: '700',
      align: 'center',
    });
  }

  private renderNotes(): void {
    const noteSize = Math.max(8, Math.floor(this.cellSize * 0.22));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        // Don't draw notes for cells that already have a final value.
        if (this.playerBoard[r][c] !== 0) continue;
        const cellNotes = this.notes[r][c];
        if (cellNotes.length === 0) continue;

        const cellX = this.gridX + c * this.cellSize;
        const cellY = this.gridY + r * this.cellSize;
        const subW = this.cellSize / 3;
        for (const n of cellNotes) {
          if (n < 1 || n > 9) continue;
          const sr = Math.floor((n - 1) / 3); // sub-row 0..2
          const sc = (n - 1) % 3;              // sub-col 0..2
          const nx = cellX + sc * subW + subW / 2;
          const ny = cellY + sr * subW + subW / 2;
          this.drawText(String(n), nx, ny, {
            size: noteSize,
            color: NOTE_COLOR,
            weight: '600',
            align: 'center',
          });
        }
      }
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

  private renderPicker(): void {
    const fontSize = Math.max(18, Math.floor(this.pickerBtnH * 0.48));
    for (let i = 0; i < 9; i++) {
      const num = i + 1;
      const bx = this.pickerStartX + i * (this.pickerBtnW + this.pickerGap);
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

      let fill: string;
      let textColor: string;
      if (isSelected) {
        fill = PICKER_BTN_ACTIVE_BG;
        textColor = PICKER_BTN_ACTIVE_TEXT;
      } else if (allPlaced) {
        fill = '#EDE4DC';
        textColor = '#C4B4A8';
      } else {
        fill = PICKER_BTN_BG;
        textColor = GIVEN_COLOR;
      }
      this.drawRoundRect(bx, by, this.pickerBtnW, this.pickerBtnH, 10, fill, PICKER_BTN_BORDER);
      this.drawText(String(num), bx + this.pickerBtnW / 2, by + this.pickerBtnH / 2, {
        size: fontSize,
        color: textColor,
        weight: '700',
        align: 'center',
      });
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
