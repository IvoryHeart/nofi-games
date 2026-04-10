import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';
import { wordsByLength } from '../../words/dictionary';

// ── Constants ───────────────────────────────────────────────────────────────

const BG_COLOR = '#FEF0E4';
const BORDER_COLOR = '#D4C4B4';
const EMPTY_TEXT_COLOR = '#5C4833';
const FILLED_BORDER = '#8B5E83';
const CURSOR_BORDER = '#8B5E83';

// Wordle-iconic colors
const COLOR_CORRECT = '#6BAA75'; // green
const COLOR_PRESENT = '#D4B33B'; // yellow
const COLOR_ABSENT = '#7A7A7A';  // gray
const COLOR_HINT = '#A8D5B5';    // light green hint
const TEXT_ON_COLOR = '#FFFFFF';

const KEYBOARD_ROWS = [
  'QWERTYUIOP',
  'ASDFGHJKL',
  'ZXCVBNM',
];

type LetterState = 'empty' | 'correct' | 'present' | 'absent';

interface DifficultyConfig {
  wordLength: number;
  maxGuesses: number;
  hintEnabled: boolean;
}

const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { wordLength: 4, maxGuesses: 6, hintEnabled: true },  // Easy
  { wordLength: 5, maxGuesses: 6, hintEnabled: false }, // Medium
  { wordLength: 5, maxGuesses: 5, hintEnabled: false }, // Hard
  { wordLength: 6, maxGuesses: 6, hintEnabled: false }, // Extra Hard
];

function pickList(length: number): readonly string[] {
  return wordsByLength(length);
}

// ── Game ────────────────────────────────────────────────────────────────────

class WordleGame extends GameEngine {
  private targetWord = '';
  private wordLength = 5;
  private maxGuesses = 6;
  private hintEnabled = false;

  private guesses: string[] = []; // submitted guesses (uppercase)
  private currentInput = ''; // in-progress guess (uppercase)
  private gameActive = false;
  private hintShown = false;
  private hintLetterIndex = -1; // index of revealed hint letter (Easy mode)

  // End-state animation: brief delay before game over after win
  private winDelay = 0;
  private winDelayTotal = 1.5;

  // Brief shake animation when guess is invalid (incomplete on Enter)
  private shake = 0;

  // Layout (computed in init)
  private gridX = 0;
  private gridY = 0;
  private cellSize = 0;
  private cellGap = 6;

  private kbY = 0;
  private kbKeyW = 0;
  private kbKeyH = 0;
  private kbGap = 4;
  private kbWideMul = 1.5; // backspace and enter are wider

  private config_: DifficultyConfig = DIFFICULTY_CONFIGS[1];

  constructor(config: GameConfig) {
    super(config);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  init(): void {
    const diff = Math.min(Math.max(this.difficulty, 0), 3);
    this.config_ = DIFFICULTY_CONFIGS[diff];
    this.wordLength = this.config_.wordLength;
    this.maxGuesses = this.config_.maxGuesses;
    this.hintEnabled = this.config_.hintEnabled;

    // Pick target word from the appropriate list using this.rng() (daily-mode safe)
    const list = pickList(this.wordLength);
    const idx = Math.floor(this.rng() * list.length);
    this.targetWord = (list[idx] || list[0]).toUpperCase();

    this.guesses = [];
    this.currentInput = '';
    this.gameActive = true;
    this.hintShown = false;
    this.hintLetterIndex = -1;
    this.winDelay = 0;
    this.shake = 0;

    this.computeLayout();
    this.setScore(0);
  }

  private computeLayout(): void {
    // Reserve space for keyboard at the bottom
    const padding = 12;
    const kbHeight = Math.max(120, this.height * 0.28);
    const gridAvailH = this.height - kbHeight - padding * 2;
    const gridAvailW = this.width - padding * 2;

    // Cell size: fit grid into avail space
    const cellByW = (gridAvailW - this.cellGap * (this.wordLength - 1)) / this.wordLength;
    const cellByH = (gridAvailH - this.cellGap * (this.maxGuesses - 1)) / this.maxGuesses;
    this.cellSize = Math.max(20, Math.min(cellByW, cellByH));

    const gridW = this.cellSize * this.wordLength + this.cellGap * (this.wordLength - 1);
    const gridH = this.cellSize * this.maxGuesses + this.cellGap * (this.maxGuesses - 1);
    this.gridX = (this.width - gridW) / 2;
    this.gridY = padding + (gridAvailH - gridH) / 2;

    // Keyboard
    this.kbY = this.height - kbHeight + padding;
    const maxKeysPerRow = 10;
    const totalGapW = this.kbGap * (maxKeysPerRow - 1);
    this.kbKeyW = Math.max(16, (this.width - padding * 2 - totalGapW) / maxKeysPerRow);
    this.kbKeyH = Math.max(28, (kbHeight - padding * 2 - this.kbGap * 2) / 3);
  }

  update(dt: number): void {
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 4);
    }

    if (this.won && this.winDelay < this.winDelayTotal) {
      this.winDelay += dt;
      if (this.winDelay >= this.winDelayTotal) {
        this.gameActive = false;
        this.gameOver();
      }
    }
  }

  render(): void {
    this.clear(BG_COLOR);
    this.renderGrid();
    this.renderKeyboard();
  }

  private renderGrid(): void {
    const shakeOffset = this.shake > 0 ? Math.sin(this.shake * 30) * 4 : 0;
    // Cursor blink phase (0..1) for the caret on the next empty cell of the active row.
    const cursorPhase = (performance.now() / 530) % 1;
    const cursorVisible = cursorPhase < 0.6;
    // Which column the cursor sits in: the first empty cell of the active row.
    const cursorCol = this.currentInput.length;

    for (let r = 0; r < this.maxGuesses; r++) {
      for (let c = 0; c < this.wordLength; c++) {
        const x = this.gridX + c * (this.cellSize + this.cellGap) + (r === this.guesses.length ? shakeOffset : 0);
        const y = this.gridY + r * (this.cellSize + this.cellGap);

        let letter = '';
        let state: LetterState = 'empty';
        let isHintCell = false;
        let isCursor = false;

        if (r < this.guesses.length) {
          // Submitted guess
          letter = this.guesses[r][c] || '';
          state = this.evaluateLetter(this.guesses[r], c);
        } else if (r === this.guesses.length) {
          // In-progress row
          letter = this.currentInput[c] || '';
          if (this.hintShown && c === this.hintLetterIndex && !letter) {
            letter = this.targetWord[c] || '';
            isHintCell = true;
          }
          // Mark the next empty cell as the cursor cell (only on the active
          // row, only while the game is still in progress, and only if we
          // haven't filled the row yet).
          if (
            !this.won &&
            this.guesses.length < this.maxGuesses &&
            c === cursorCol &&
            cursorCol < this.wordLength &&
            !letter
          ) {
            isCursor = true;
          }
        }

        this.renderCell(x, y, letter, state, isHintCell, isCursor && cursorVisible);
      }
    }
  }

  private renderCell(
    x: number,
    y: number,
    letter: string,
    state: LetterState,
    isHint: boolean,
    isCursor: boolean = false,
  ): void {
    let fill = BG_COLOR;
    let stroke = BORDER_COLOR;
    let textColor = EMPTY_TEXT_COLOR;

    if (state === 'correct') { fill = COLOR_CORRECT; stroke = COLOR_CORRECT; textColor = TEXT_ON_COLOR; }
    else if (state === 'present') { fill = COLOR_PRESENT; stroke = COLOR_PRESENT; textColor = TEXT_ON_COLOR; }
    else if (state === 'absent') { fill = COLOR_ABSENT; stroke = COLOR_ABSENT; textColor = TEXT_ON_COLOR; }
    else if (isHint) { fill = COLOR_HINT; stroke = COLOR_HINT; textColor = TEXT_ON_COLOR; }
    else if (letter) { stroke = FILLED_BORDER; }
    // Cursor cell gets a distinct mauve border so it's obvious which tile
    // the next typed letter will land in.
    else if (isCursor) { stroke = CURSOR_BORDER; }

    this.drawRoundRect(x, y, this.cellSize, this.cellSize, 6, fill, stroke);

    // Draw a blinking caret bar inside the empty cursor cell.
    if (isCursor && !letter) {
      const barW = Math.max(2, Math.floor(this.cellSize * 0.08));
      const barH = this.cellSize * 0.5;
      const barX = x + (this.cellSize - barW) / 2;
      const barY = y + (this.cellSize - barH) / 2;
      this.ctx.fillStyle = CURSOR_BORDER;
      this.ctx.fillRect(barX, barY, barW, barH);
    }

    if (letter) {
      this.drawText(letter, x + this.cellSize / 2, y + this.cellSize / 2, {
        size: this.cellSize * 0.5,
        color: textColor,
        weight: '700',
      });
    }
  }

  /** Compute the letter state for position `idx` of a submitted guess. */
  private evaluateLetter(guess: string, idx: number): LetterState {
    const states = this.evaluateGuess(guess);
    return states[idx];
  }

  /** Evaluate the entire guess: green > yellow > gray, accounting for letter counts. */
  private evaluateGuess(guess: string): LetterState[] {
    const len = this.targetWord.length;
    const result: LetterState[] = new Array(len).fill('absent');
    const targetUsed: boolean[] = new Array(len).fill(false);

    // First pass: greens
    for (let i = 0; i < len; i++) {
      if (guess[i] === this.targetWord[i]) {
        result[i] = 'correct';
        targetUsed[i] = true;
      }
    }
    // Second pass: yellows
    for (let i = 0; i < len; i++) {
      if (result[i] === 'correct') continue;
      for (let j = 0; j < len; j++) {
        if (!targetUsed[j] && guess[i] === this.targetWord[j]) {
          result[i] = 'present';
          targetUsed[j] = true;
          break;
        }
      }
    }
    return result;
  }

  /** Build the per-letter best state across all submitted guesses (for keyboard coloring). */
  private getKeyboardState(): Map<string, LetterState> {
    const states = new Map<string, LetterState>();
    const rank: Record<LetterState, number> = { empty: 0, absent: 1, present: 2, correct: 3 };

    for (const guess of this.guesses) {
      const evals = this.evaluateGuess(guess);
      for (let i = 0; i < guess.length; i++) {
        const letter = guess[i];
        const newState = evals[i];
        const existing = states.get(letter) || 'empty';
        if (rank[newState] > rank[existing]) {
          states.set(letter, newState);
        }
      }
    }
    return states;
  }

  private renderKeyboard(): void {
    const kbState = this.getKeyboardState();

    for (let row = 0; row < KEYBOARD_ROWS.length; row++) {
      const keys = KEYBOARD_ROWS[row];
      const rowY = this.kbY + row * (this.kbKeyH + this.kbGap);

      // For row 2, prepend ENTER and append BACKSPACE (wider keys)
      const hasSpecials = row === 2;
      const keyCount = keys.length + (hasSpecials ? 2 : 0);
      const wideExtra = hasSpecials ? 2 * (this.kbWideMul - 1) * this.kbKeyW : 0;
      const totalW = keyCount * this.kbKeyW + (keyCount - 1) * this.kbGap + wideExtra;
      let x = (this.width - totalW) / 2;

      if (hasSpecials) {
        this.drawKbKey(x, rowY, this.kbKeyW * this.kbWideMul, this.kbKeyH, 'ENT', 'empty');
        x += this.kbKeyW * this.kbWideMul + this.kbGap;
      }

      for (let i = 0; i < keys.length; i++) {
        const letter = keys[i];
        const state = kbState.get(letter) || 'empty';
        this.drawKbKey(x, rowY, this.kbKeyW, this.kbKeyH, letter, state);
        x += this.kbKeyW + this.kbGap;
      }

      if (hasSpecials) {
        this.drawKbKey(x, rowY, this.kbKeyW * this.kbWideMul, this.kbKeyH, 'DEL', 'empty');
      }
    }
  }

  private drawKbKey(x: number, y: number, w: number, h: number, label: string, state: LetterState): void {
    let fill = '#E5D5C5';
    let textColor = EMPTY_TEXT_COLOR;
    if (state === 'correct') { fill = COLOR_CORRECT; textColor = TEXT_ON_COLOR; }
    else if (state === 'present') { fill = COLOR_PRESENT; textColor = TEXT_ON_COLOR; }
    else if (state === 'absent') { fill = COLOR_ABSENT; textColor = TEXT_ON_COLOR; }

    this.drawRoundRect(x, y, w, h, 4, fill);
    const fontSize = Math.min(w * 0.4, h * 0.45);
    this.drawText(label, x + w / 2, y + h / 2, {
      size: fontSize,
      color: textColor,
      weight: '700',
    });
  }

  // ── Input handling ──────────────────────────────────────────────────────

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (!this.gameActive) return;

    if (key === 'Backspace') {
      e.preventDefault();
      this.deleteLetter();
      return;
    }
    if (key === 'Enter') {
      e.preventDefault();
      this.submitGuess();
      return;
    }
    // Single letter keys
    if (key.length === 1) {
      const code = key.toUpperCase().charCodeAt(0);
      if (code >= 65 && code <= 90) {
        this.addLetter(key.toUpperCase());
      }
    }
  }

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;

    // Check keyboard rows
    for (let row = 0; row < KEYBOARD_ROWS.length; row++) {
      const keys = KEYBOARD_ROWS[row];
      const rowY = this.kbY + row * (this.kbKeyH + this.kbGap);
      if (y < rowY || y > rowY + this.kbKeyH) continue;

      const hasSpecials = row === 2;
      const keyCount = keys.length + (hasSpecials ? 2 : 0);
      const wideExtra = hasSpecials ? 2 * (this.kbWideMul - 1) * this.kbKeyW : 0;
      const totalW = keyCount * this.kbKeyW + (keyCount - 1) * this.kbGap + wideExtra;
      let kx = (this.width - totalW) / 2;

      if (hasSpecials) {
        if (x >= kx && x <= kx + this.kbKeyW * this.kbWideMul) {
          this.submitGuess();
          return;
        }
        kx += this.kbKeyW * this.kbWideMul + this.kbGap;
      }

      for (let i = 0; i < keys.length; i++) {
        if (x >= kx && x <= kx + this.kbKeyW) {
          this.addLetter(keys[i]);
          return;
        }
        kx += this.kbKeyW + this.kbGap;
      }

      if (hasSpecials) {
        if (x >= kx && x <= kx + this.kbKeyW * this.kbWideMul) {
          this.deleteLetter();
          return;
        }
      }
    }
  }

  // ── Game actions ────────────────────────────────────────────────────────

  private addLetter(letter: string): void {
    if (!this.gameActive || this.won) return;
    if (this.currentInput.length >= this.wordLength) return;
    this.currentInput += letter;
    this.playSound('tap');
  }

  private deleteLetter(): void {
    if (!this.gameActive || this.won) return;
    if (this.currentInput.length === 0) return;
    this.currentInput = this.currentInput.slice(0, -1);
    this.playSound('tap');
  }

  private submitGuess(): void {
    if (!this.gameActive || this.won) return;
    if (this.currentInput.length !== this.wordLength) {
      // Incomplete: trigger shake
      this.shake = 0.5;
      this.playSound('error');
      return;
    }

    const guess = this.currentInput;
    this.guesses.push(guess);
    this.currentInput = '';

    // Win check
    if (guess === this.targetWord) {
      const points = Math.max(0, 1000 - 100 * (this.guesses.length - 1));
      this.setScore(points);
      this.gameWin();
      this.winDelay = 0;
      return;
    }

    // Hint trigger on first wrong guess (Easy mode)
    if (this.hintEnabled && !this.hintShown && this.guesses.length === 1) {
      this.revealHint();
    }

    this.playSound('select');

    // Out of guesses
    if (this.guesses.length >= this.maxGuesses) {
      this.setScore(0);
      this.gameActive = false;
      this.gameOver();
    }
  }

  private revealHint(): void {
    // Reveal a letter that the player hasn't guessed yet at its correct position
    const lastGuess = this.guesses[this.guesses.length - 1] || '';
    const candidates: number[] = [];
    for (let i = 0; i < this.wordLength; i++) {
      if (lastGuess[i] !== this.targetWord[i]) {
        candidates.push(i);
      }
    }
    if (candidates.length === 0) return;
    const pickIdx = Math.floor(this.rng() * candidates.length);
    this.hintLetterIndex = candidates[pickIdx];
    this.hintShown = true;
  }

  // ── Save / Resume ─────────────────────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      targetWord: this.targetWord,
      guesses: [...this.guesses],
      currentInput: this.currentInput,
      gameActive: this.gameActive,
      hintShown: this.hintShown,
      hintLetterIndex: this.hintLetterIndex,
      wordLength: this.wordLength,
      maxGuesses: this.maxGuesses,
    };
  }

  deserialize(state: GameSnapshot): void {
    const tw = state.targetWord;
    if (typeof tw !== 'string' || tw.length === 0) return;
    this.targetWord = tw;

    const wl = state.wordLength;
    if (typeof wl === 'number' && wl > 0) this.wordLength = wl;
    const mg = state.maxGuesses;
    if (typeof mg === 'number' && mg > 0) this.maxGuesses = mg;

    const g = state.guesses;
    if (Array.isArray(g)) {
      this.guesses = g.filter((x): x is string => typeof x === 'string');
    } else {
      this.guesses = [];
    }

    const ci = state.currentInput;
    this.currentInput = typeof ci === 'string' ? ci : '';

    this.gameActive = (state.gameActive as boolean) ?? true;
    this.hintShown = (state.hintShown as boolean) ?? false;
    const hli = state.hintLetterIndex;
    this.hintLetterIndex = typeof hli === 'number' ? hli : -1;

    // Recompute layout in case dimensions changed
    this.computeLayout();
  }

  canSave(): boolean {
    // Don't save during the post-win delay or if a shake animation is in flight
    return this.gameActive && !this.won && this.shake === 0;
  }
}

// ── Registration ──────────────────────────────────────────────────────────

registerGame({
  id: 'wordle',
  name: 'Wordle',
  description: 'Guess the hidden 5-letter word',
  icon: 'W',
  color: '--color-primary',
  bgGradient: ['#6BAA75', '#A8D5B5'],
  category: 'puzzle',
  createGame: (config) => new WordleGame(config),
  canvasWidth: 360,
  canvasHeight: 600,
  controls: 'Type letters, Enter to guess, Backspace to delete',
  dailyMode: true,
});
