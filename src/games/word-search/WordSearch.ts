import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';
import { wordsByLength } from '../../words/dictionary';

// Build word pool from shared dictionary (4-8 letter words, uppercased for grid display)
const VALID_WORDS: readonly string[] = [
  ...wordsByLength(4),
  ...wordsByLength(5),
  ...wordsByLength(6),
  ...wordsByLength(7),
  ...wordsByLength(8),
].map(w => w.toUpperCase());

// ── Types ──────────────────────────────────────────────────────────────────

interface PlacedWord {
  word: string;
  row: number;
  col: number;
  dr: number;
  dc: number;
  found: boolean;
}

interface Cell {
  row: number;
  col: number;
}

interface DifficultyConfig {
  size: number;
  wordCount: number;
  allowDiagonal: boolean;
  allowReversed: boolean;
}

const DIFFICULTY_CONFIGS: readonly DifficultyConfig[] = [
  { size: 8,  wordCount: 5,  allowDiagonal: false, allowReversed: false }, // Easy
  { size: 10, wordCount: 8,  allowDiagonal: true,  allowReversed: false }, // Medium
  { size: 12, wordCount: 12, allowDiagonal: true,  allowReversed: true  }, // Hard
  { size: 14, wordCount: 16, allowDiagonal: true,  allowReversed: true  }, // Extra Hard
];

// ── Constants ──────────────────────────────────────────────────────────────

const BG_COLOR = '#FEF0E4';
const GRID_BG_COLOR = '#FFFAF5';
const CELL_LINE_COLOR = '#E5D5C5';
const LETTER_COLOR = '#3D2B35';
const PRIMARY_COLOR = '#8B5E83';
const PRIMARY_LIGHT = 'rgba(139, 94, 131, 0.30)';
const PRIMARY_TRAIL = 'rgba(139, 94, 131, 0.45)';
const FOUND_HIGHLIGHT = 'rgba(91, 143, 185, 0.45)';
const WORD_LIST_BG = '#FFFAF5';
const WORD_LIST_TEXT = '#5C4833';
const WORD_LIST_FOUND = '#A89890';

const SCORE_PER_WORD = 100;
const TIME_BONUS_MAX = 500;
const WIN_DELAY_MS = 1500;

const MAX_PLACEMENT_ATTEMPTS = 100;
const MAX_GRID_BUILD_ATTEMPTS = 50;

// All 8 directions: dr, dc
const DIRECTIONS_4: ReadonlyArray<[number, number]> = [
  [0, 1],   // right
  [1, 0],   // down
];
const DIRECTIONS_8: ReadonlyArray<[number, number]> = [
  [0, 1],   // right
  [1, 0],   // down
  [1, 1],   // down-right
  [-1, 1],  // up-right
];

// ── Game ───────────────────────────────────────────────────────────────────

class WordSearchGame extends GameEngine {
  private size = 8;
  private grid: string[][] = [];
  private placedWords: PlacedWord[] = [];
  private config_: DifficultyConfig = DIFFICULTY_CONFIGS[0];
  private gameActive = false;
  private elapsed = 0;
  private winTimer = 0;
  private winning = false;

  // Layout (recomputed in init())
  private gridPx = 0;
  private gridX = 0;
  private gridY = 0;
  private cellSize = 0;
  private listX = 0;
  private listY = 0;
  private listW = 0;
  private listH = 0;

  // Drag state
  private dragging = false;
  private dragStart: Cell | null = null;
  private dragEnd: Cell | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  init(): void {
    const diff = Math.min(Math.max(this.difficulty, 0), 3);
    this.config_ = DIFFICULTY_CONFIGS[diff];
    this.size = this.config_.size;

    // Layout: grid below HUD, word list in remaining space below
    const hudClearance = 72; // space for HUD buttons
    const gridPad = 8;
    const availH = this.height - hudClearance - gridPad;
    const topPortion = Math.max(availH * 0.65, 200);
    const maxGrid = Math.max(Math.min(this.width - 16, topPortion), 40);
    this.gridPx = maxGrid;
    this.gridX = (this.width - this.gridPx) / 2;
    this.gridY = hudClearance;
    this.cellSize = Math.max(this.gridPx / this.size, 4);

    this.listX = 8;
    this.listY = this.gridY + this.gridPx + gridPad;
    this.listW = Math.max(this.width - 16, 40);
    this.listH = Math.max(this.height - this.listY - 8, 40);

    this.gameActive = true;
    this.winning = false;
    this.winTimer = 0;
    this.elapsed = 0;
    this.dragging = false;
    this.dragStart = null;
    this.dragEnd = null;
    this.placedWords = [];
    this.grid = [];

    this.setScore(0);
    this.buildGrid();
  }

  update(dt: number): void {
    if (!this.gameActive && !this.winning) return;
    this.elapsed += dt;

    if (this.winning) {
      this.winTimer += dt;
      if (this.winTimer * 1000 >= WIN_DELAY_MS) {
        this.winning = false;
        this.gameActive = false;
        this.gameOver();
      }
    }
  }

  render(): void {
    this.clear(BG_COLOR);
    this.renderGrid();
    this.renderSelection();
    this.renderFoundHighlights();
    this.renderWordList();
  }

  // ── Grid construction ──────────────────────────────────────────────────

  private buildGrid(): void {
    // Try multiple times in case word placement keeps failing
    let attempt = 0;
    while (attempt < MAX_GRID_BUILD_ATTEMPTS) {
      attempt++;
      const ok = this.tryBuildGrid();
      if (ok) return;
    }
    // Last-ditch fallback: empty grid filled with random letters
    this.grid = this.makeEmptyGrid();
    this.placedWords = [];
    this.fillRandomLetters();
  }

  private tryBuildGrid(): boolean {
    const grid = this.makeEmptyGrid();
    const placed: PlacedWord[] = [];

    // Pick candidate words: filter by length <= grid size, then shuffle via rng
    const candidates = VALID_WORDS.filter(w => w.length <= this.size).slice();
    this.shuffleInPlace(candidates);

    // Direction set
    const baseDirs = this.config_.allowDiagonal ? DIRECTIONS_8 : DIRECTIONS_4;
    const dirs: Array<[number, number]> = [];
    for (const d of baseDirs) {
      dirs.push([d[0], d[1]]);
      if (this.config_.allowReversed) {
        dirs.push([-d[0], -d[1]]);
      }
    }

    // Place words
    for (const word of candidates) {
      if (placed.length >= this.config_.wordCount) break;
      // Skip duplicates of an already-placed word
      if (placed.some(p => p.word === word)) continue;

      const placement = this.tryPlaceWord(grid, word, dirs);
      if (placement) {
        // Write the word into the grid
        for (let i = 0; i < word.length; i++) {
          const r = placement.row + placement.dr * i;
          const c = placement.col + placement.dc * i;
          grid[r][c] = word[i];
        }
        placed.push({ ...placement, word, found: false });
      }
    }

    if (placed.length < this.config_.wordCount) {
      return false;
    }

    this.grid = grid;
    this.placedWords = placed;
    this.fillRandomLetters();
    return true;
  }

  private makeEmptyGrid(): string[][] {
    const g: string[][] = [];
    for (let r = 0; r < this.size; r++) {
      const row: string[] = [];
      for (let c = 0; c < this.size; c++) {
        row.push('');
      }
      g.push(row);
    }
    return g;
  }

  private tryPlaceWord(
    grid: string[][],
    word: string,
    dirs: ReadonlyArray<[number, number]>,
  ): { row: number; col: number; dr: number; dc: number } | null {
    if (dirs.length === 0) return null;
    let attempts = 0;
    while (attempts < MAX_PLACEMENT_ATTEMPTS) {
      attempts++;
      const dirIdx = Math.floor(this.rng() * dirs.length);
      const [dr, dc] = dirs[dirIdx];
      const len = word.length;

      // Compute valid start ranges based on direction
      const minR = dr < 0 ? (len - 1) : 0;
      const maxR = dr > 0 ? (this.size - len) : (this.size - 1);
      const minC = dc < 0 ? (len - 1) : 0;
      const maxC = dc > 0 ? (this.size - len) : (this.size - 1);

      if (minR > maxR || minC > maxC) continue;

      const row = minR + Math.floor(this.rng() * (maxR - minR + 1));
      const col = minC + Math.floor(this.rng() * (maxC - minC + 1));

      // Check if word fits without conflicting letters
      let ok = true;
      for (let i = 0; i < len; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r < 0 || r >= this.size || c < 0 || c >= this.size) {
          ok = false;
          break;
        }
        const existing = grid[r][c];
        if (existing !== '' && existing !== word[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return { row, col, dr, dc };
    }
    return null;
  }

  private fillRandomLetters(): void {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === '') {
          this.grid[r][c] = A[Math.floor(this.rng() * 26)];
        }
      }
    }
  }

  private shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────

  private renderGrid(): void {
    // Background panel
    this.drawRoundRect(this.gridX - 4, this.gridY - 4, this.gridPx + 8, this.gridPx + 8, 8, GRID_BG_COLOR);

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const x = this.gridX + c * this.cellSize;
        const y = this.gridY + r * this.cellSize;
        // Cell border
        this.ctx.strokeStyle = CELL_LINE_COLOR;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
        // Letter
        const letter = this.grid[r][c];
        if (letter) {
          const fs = Math.max(this.cellSize * 0.55, 8);
          this.drawText(letter, x + this.cellSize / 2, y + this.cellSize / 2, {
            size: fs,
            color: LETTER_COLOR,
            weight: '700',
          });
        }
      }
    }
  }

  private renderFoundHighlights(): void {
    for (const pw of this.placedWords) {
      if (!pw.found) continue;
      this.drawWordOverlay(pw.row, pw.col, pw.dr, pw.dc, pw.word.length, FOUND_HIGHLIGHT);
    }
  }

  private renderSelection(): void {
    if (!this.dragging || !this.dragStart || !this.dragEnd) return;
    const line = this.cellsAlongLine(this.dragStart, this.dragEnd);
    if (line.length === 0) return;
    const first = line[0];
    const last = line[line.length - 1];
    const dr = last.row - first.row;
    const dc = last.col - first.col;
    const len = line.length;
    let nr = 0, nc = 0;
    if (len > 1) {
      const norm = Math.max(Math.abs(dr), Math.abs(dc));
      nr = dr / norm;
      nc = dc / norm;
    }
    this.drawWordOverlay(first.row, first.col, nr, nc, len, PRIMARY_TRAIL);
    // Highlight individual cells
    for (const cell of line) {
      const x = this.gridX + cell.col * this.cellSize;
      const y = this.gridY + cell.row * this.cellSize;
      this.ctx.fillStyle = PRIMARY_LIGHT;
      this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
    }
  }

  private drawWordOverlay(row: number, col: number, dr: number, dc: number, len: number, color: string): void {
    const x1 = this.gridX + col * this.cellSize + this.cellSize / 2;
    const y1 = this.gridY + row * this.cellSize + this.cellSize / 2;
    const endRow = row + dr * (len - 1);
    const endCol = col + dc * (len - 1);
    const x2 = this.gridX + endCol * this.cellSize + this.cellSize / 2;
    const y2 = this.gridY + endRow * this.cellSize + this.cellSize / 2;
    const thickness = Math.max(this.cellSize * 0.75, 4);
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = thickness;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private renderWordList(): void {
    if (this.listH < 20) return;
    this.drawRoundRect(this.listX, this.listY, this.listW, this.listH, 8, WORD_LIST_BG);

    const padding = 8;
    const innerW = this.listW - padding * 2;
    const innerH = this.listH - padding * 2;
    if (innerW <= 0 || innerH <= 0) return;

    const cols = 3;
    const rows = Math.ceil(this.placedWords.length / cols);
    if (rows === 0) return;
    const colW = innerW / cols;
    const rowH = Math.min(Math.max(innerH / Math.max(rows, 1), 12), 40);
    const fontSize = Math.max(Math.min(rowH * 0.6, 16), 10);

    for (let i = 0; i < this.placedWords.length; i++) {
      const pw = this.placedWords[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = this.listX + padding + col * colW + colW / 2;
      const cy = this.listY + padding + row * rowH + rowH / 2;
      const text = pw.found ? `\u2713 ${pw.word}` : pw.word;
      const color = pw.found ? WORD_LIST_FOUND : WORD_LIST_TEXT;
      this.drawText(text, cx, cy, {
        size: fontSize,
        color,
        weight: pw.found ? '500' : '700',
      });
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;
    const cell = this.pointToCell(x, y);
    if (!cell) return;
    this.dragging = true;
    this.dragStart = cell;
    this.dragEnd = cell;
  }

  protected handlePointerMove(x: number, y: number): void {
    if (!this.dragging || !this.dragStart) return;
    const cell = this.pointToCell(x, y);
    if (!cell) return;
    this.dragEnd = cell;
  }

  protected handlePointerUp(_x: number, _y: number): void {
    if (!this.dragging || !this.dragStart || !this.dragEnd) {
      this.dragging = false;
      this.dragStart = null;
      this.dragEnd = null;
      return;
    }
    const line = this.cellsAlongLine(this.dragStart, this.dragEnd);
    this.dragging = false;
    this.dragStart = null;
    this.dragEnd = null;

    if (line.length < 2) return;
    const word = line.map(c => this.grid[c.row][c.col]).join('');
    this.tryMatchWord(word, line);
  }

  private pointToCell(x: number, y: number): Cell | null {
    if (x < this.gridX || y < this.gridY) return null;
    const col = Math.floor((x - this.gridX) / this.cellSize);
    const row = Math.floor((y - this.gridY) / this.cellSize);
    if (row < 0 || row >= this.size || col < 0 || col >= this.size) return null;
    return { row, col };
  }

  /** Returns the list of cells along a straight line from a to b, snapped to
   *  the closest of the 8 directions. Returns [] if a and b are not collinear
   *  in one of those directions. */
  private cellsAlongLine(a: Cell, b: Cell): Cell[] {
    const dr = b.row - a.row;
    const dc = b.col - a.col;
    if (dr === 0 && dc === 0) return [a];
    const absR = Math.abs(dr);
    const absC = Math.abs(dc);
    // Must be horizontal, vertical, or perfect diagonal
    let stepR: number;
    let stepC: number;
    let len: number;
    if (dr === 0) {
      stepR = 0;
      stepC = dc > 0 ? 1 : -1;
      len = absC + 1;
    } else if (dc === 0) {
      stepR = dr > 0 ? 1 : -1;
      stepC = 0;
      len = absR + 1;
    } else if (absR === absC) {
      stepR = dr > 0 ? 1 : -1;
      stepC = dc > 0 ? 1 : -1;
      len = absR + 1;
    } else {
      return [];
    }
    const out: Cell[] = [];
    let guard = 0;
    for (let i = 0; i < len && guard < 64; i++, guard++) {
      out.push({ row: a.row + stepR * i, col: a.col + stepC * i });
    }
    return out;
  }

  private tryMatchWord(word: string, line: Cell[]): void {
    // Check forward
    let match = this.placedWords.find(p => !p.found && p.word === word);
    if (!match) {
      // Check reversed
      const reversed = word.split('').reverse().join('');
      match = this.placedWords.find(p => !p.found && p.word === reversed);
    }
    if (!match) {
      this.haptic('light');
      return;
    }
    // Verify the line actually corresponds to the placed word's cells
    if (!this.lineMatchesPlacement(line, match)) return;

    match.found = true;
    this.addScore(SCORE_PER_WORD);
    this.haptic('medium');

    if (this.placedWords.every(p => p.found)) {
      this.handleAllFound();
    }
  }

  private lineMatchesPlacement(line: Cell[], placement: PlacedWord): boolean {
    if (line.length !== placement.word.length) return false;
    const expected: Cell[] = [];
    for (let i = 0; i < placement.word.length; i++) {
      expected.push({
        row: placement.row + placement.dr * i,
        col: placement.col + placement.dc * i,
      });
    }
    // Allow forward or reversed
    const matchesForward = expected.every((c, i) => c.row === line[i].row && c.col === line[i].col);
    if (matchesForward) return true;
    const reversed = expected.slice().reverse();
    return reversed.every((c, i) => c.row === line[i].row && c.col === line[i].col);
  }

  private handleAllFound(): void {
    // Time bonus: more bonus for finishing fast (capped)
    const bonus = Math.max(0, Math.floor(TIME_BONUS_MAX - this.elapsed * 5));
    if (bonus > 0) this.addScore(bonus);
    this.gameWin();
    this.winning = true;
    this.winTimer = 0;
  }

  // ── Save / Resume ───────────────────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      size: this.size,
      grid: this.grid.map(row => [...row]),
      placedWords: this.placedWords.map(p => ({
        word: p.word, row: p.row, col: p.col, dr: p.dr, dc: p.dc, found: p.found,
      })),
      gameActive: this.gameActive,
      elapsed: this.elapsed,
    };
  }

  deserialize(state: GameSnapshot): void {
    if (!state || typeof state !== 'object') return;
    const size = state.size as number | undefined;
    const grid = state.grid as string[][] | undefined;
    const placed = state.placedWords as PlacedWord[] | undefined;

    if (typeof size !== 'number' || size <= 0) return;
    if (!Array.isArray(grid) || grid.length !== size) return;
    for (const row of grid) {
      if (!Array.isArray(row) || row.length !== size) return;
    }
    if (!Array.isArray(placed)) return;

    this.size = size;
    this.grid = grid.map(row => [...row]);
    this.placedWords = placed.map(p => ({
      word: String(p.word),
      row: Number(p.row),
      col: Number(p.col),
      dr: Number(p.dr),
      dc: Number(p.dc),
      found: Boolean(p.found),
    }));
    this.gameActive = state.gameActive !== false;
    this.elapsed = typeof state.elapsed === 'number' ? state.elapsed : 0;
    this.dragging = false;
    this.dragStart = null;
    this.dragEnd = null;
    this.winning = false;
    this.winTimer = 0;
  }

  canSave(): boolean {
    return this.gameActive && !this.winning && !this.dragging;
  }
}

// ── Registration ───────────────────────────────────────────────────────────

registerGame({
  id: 'word-search',
  name: 'Word Search',
  description: 'Find hidden words in the letter grid',
  icon: 'F',
  color: '--color-primary',
  bgGradient: ['#5B8FB9', '#9BBADD'],
  category: 'puzzle',
  createGame: (config: GameConfig) => new WordSearchGame(config),
  canvasWidth: 360,
  canvasHeight: 640,
  controls: 'Drag to select letters that form a word',
  dailyMode: true,
});
