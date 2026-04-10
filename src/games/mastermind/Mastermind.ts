import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Types ───────────────────────────────────────────────────────────────────

interface Feedback {
  black: number; // correct color in correct position
  white: number; // correct color, wrong position
}

interface DifficultyConfig {
  pegCount: number;    // N — code length
  colorCount: number;  // K — palette size
  maxAttempts: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const BG_COLOR = '#FEF0E4';
const HEADER_TEXT_COLOR = '#3D2B35';
const ROW_BG_COLOR = '#F4DECD';
const ROW_BORDER_COLOR = '#D4B8A0';
const ACTIVE_ROW_BG_COLOR = '#FFE9D6';
const ACTIVE_ROW_BORDER_COLOR = '#704F9C';
const EMPTY_PEG_COLOR = '#E5D0BD';
const EMPTY_PEG_BORDER = '#C9B098';
const FEEDBACK_BG_COLOR = '#3D2B35';
const FEEDBACK_EMPTY_COLOR = '#5C4833';
const FEEDBACK_BLACK_COLOR = '#1B1018';
const FEEDBACK_WHITE_COLOR = '#FFFFFF';
const BUTTON_BG_COLOR = '#704F9C';
const BUTTON_BG_DISABLED = '#BDA8C9';
const BUTTON_TEXT_COLOR = '#FFFFFF';
const BUTTON_CLEAR_BG = '#8B5E83';

// Standard mastermind peg palette (8 colors max).
const PEG_COLORS: string[] = [
  '#E04545', // 1 red
  '#3A8BD8', // 2 blue
  '#3CAA3C', // 3 green
  '#F2C94C', // 4 yellow
  '#F09437', // 5 orange
  '#9B59B6', // 6 purple
  '#EC87C0', // 7 pink
  '#3CC0C8', // 8 cyan
];

const PEG_STROKE = '#3D2B35';

// ── Difficulty configs ──────────────────────────────────────────────────────

const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { pegCount: 4, colorCount: 6, maxAttempts: 12 }, // Easy
  { pegCount: 4, colorCount: 6, maxAttempts: 10 }, // Medium (classic)
  { pegCount: 5, colorCount: 7, maxAttempts: 10 }, // Hard
  { pegCount: 5, colorCount: 8, maxAttempts: 8 },  // Extra Hard
];

// ── Game ────────────────────────────────────────────────────────────────────

interface PaletteHit {
  type: 'palette';
  color: number;
}

interface CurrentSlotHit {
  type: 'currentSlot';
  index: number;
}

interface ButtonHit {
  type: 'submit' | 'clear';
}

type Hit = PaletteHit | CurrentSlotHit | ButtonHit | null;

class MastermindGame extends GameEngine {
  // ── Game state ──
  private code: number[] = [];
  private guesses: number[][] = [];
  private feedback: Feedback[] = [];
  private currentRow: number[] = [];
  private pegCount = 4;
  private colorCount = 6;
  private maxAttempts = 10;
  private gameActive = false;
  private codeRevealed = false;

  // ── Animation state ──
  private revealAnim = 0; // 0..1 progress for revealing the code at game end

  // ── Layout (computed in init / render) ──
  private rowHeight = 0;
  private rowsAreaY = 0;
  private rowsAreaHeight = 0;
  private rowPegRadius = 0;
  private feedbackPegRadius = 0;
  private paletteY = 0;
  private paletteRadius = 0;
  private paletteSpacing = 0;
  private paletteStartX = 0;
  private currentRowY = 0;
  private currentSlotRadius = 0;
  private currentSlotSpacing = 0;
  private currentRowStartX = 0;
  private submitBtn = { x: 0, y: 0, w: 0, h: 0 };
  private clearBtn = { x: 0, y: 0, w: 0, h: 0 };

  constructor(config: GameConfig) {
    super(config);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init(): void {
    const diff = Math.min(Math.max(this.difficulty, 0), 3);
    const cfg = DIFFICULTY_CONFIGS[diff];
    this.pegCount = cfg.pegCount;
    this.colorCount = cfg.colorCount;
    this.maxAttempts = cfg.maxAttempts;

    // Generate the secret code using seeded RNG so daily mode is deterministic.
    this.code = [];
    for (let i = 0; i < this.pegCount; i++) {
      this.code.push(Math.floor(this.rng() * this.colorCount));
    }

    this.guesses = [];
    this.feedback = [];
    this.currentRow = [];
    this.gameActive = true;
    this.codeRevealed = false;
    this.revealAnim = 0;

    this.setScore(0);
    this.computeLayout();
  }

  private computeLayout(): void {
    const W = this.width;
    const H = this.height;

    const headerH = 72; // shell HUD height
    const paletteAreaH = Math.max(60, H * 0.10);
    const currentRowH = Math.max(56, H * 0.10);
    const buttonH = Math.max(40, H * 0.07);
    const bottomPad = 12;

    // Bottom stack: palette (top), current row, buttons (bottom-most).
    const bottomTotalH = paletteAreaH + currentRowH + buttonH + bottomPad * 2;

    this.rowsAreaY = headerH;
    this.rowsAreaHeight = Math.max(60, H - headerH - bottomTotalH);

    this.rowHeight = this.rowsAreaHeight / Math.max(1, this.maxAttempts);

    // Compute peg radius from row height + width constraints.
    const feedbackAreaWidth = Math.max(50, W * 0.22);
    const guessAreaWidth = W - feedbackAreaWidth - 24;
    const slotSpacing = guessAreaWidth / Math.max(1, this.pegCount);
    this.rowPegRadius = Math.max(6, Math.min(slotSpacing * 0.36, this.rowHeight * 0.36));
    this.feedbackPegRadius = Math.max(3, this.rowPegRadius * 0.45);

    // Palette circle layout — colors arranged in a single row, centered.
    this.paletteY = headerH + this.rowsAreaHeight + bottomPad + paletteAreaH / 2;
    const maxPaletteRadius = paletteAreaH * 0.42;
    const maxBySpacing = (W - 24) / (this.colorCount * 2 + (this.colorCount - 1) * 0.4);
    this.paletteRadius = Math.max(8, Math.min(maxPaletteRadius, maxBySpacing));
    this.paletteSpacing = this.paletteRadius * 2.4;
    const paletteTotalW = this.paletteSpacing * (this.colorCount - 1);
    this.paletteStartX = (W - paletteTotalW) / 2;

    // Current row slot layout.
    this.currentRowY = this.paletteY + paletteAreaH / 2 + currentRowH / 2;
    const maxSlotRadius = currentRowH * 0.36;
    const maxSlotBySpacing = (W - 24) / (this.pegCount * 2 + (this.pegCount - 1) * 0.5);
    this.currentSlotRadius = Math.max(8, Math.min(maxSlotRadius, maxSlotBySpacing));
    this.currentSlotSpacing = this.currentSlotRadius * 2.5;
    const slotTotalW = this.currentSlotSpacing * (this.pegCount - 1);
    this.currentRowStartX = (W - slotTotalW) / 2;

    // Buttons row at the bottom.
    const buttonsY = this.currentRowY + currentRowH / 2 + bottomPad / 2;
    const buttonW = Math.max(80, (W - 36) / 2);
    this.clearBtn = {
      x: 12,
      y: buttonsY,
      w: buttonW,
      h: buttonH,
    };
    this.submitBtn = {
      x: W - 12 - buttonW,
      y: buttonsY,
      w: buttonW,
      h: buttonH,
    };
  }

  update(_dt: number): void {
    // Recompute layout if dimensions changed (defensive — usually static).
    if (this.rowHeight === 0) {
      this.computeLayout();
    }

    // Reveal animation when game ends.
    if (this.codeRevealed && this.revealAnim < 1) {
      this.revealAnim = Math.min(1, this.revealAnim + _dt * 2);
    }
  }

  getHudStats(): Array<{ label: string; value: string }> {
    const attemptsLeft = this.maxAttempts - this.guesses.length;
    return [
      { label: 'Left', value: String(attemptsLeft) },
    ];
  }

  render(): void {
    this.clear(BG_COLOR);
    this.renderRows();
    this.renderPalette();
    this.renderCurrentRow();
    this.renderButtons();
  }

  // ── Render: previous guess rows ───────────────────────────────────────────

  private renderRows(): void {
    const W = this.width;

    for (let r = 0; r < this.maxAttempts; r++) {
      const rowY = this.rowsAreaY + r * this.rowHeight;
      const rowCy = rowY + this.rowHeight / 2;

      const isCurrent = r === this.guesses.length && this.gameActive;
      const isPast = r < this.guesses.length;

      // Row background
      const bg = isCurrent ? ACTIVE_ROW_BG_COLOR : ROW_BG_COLOR;
      const border = isCurrent ? ACTIVE_ROW_BORDER_COLOR : ROW_BORDER_COLOR;
      this.drawRoundRect(8, rowY + 2, W - 16, this.rowHeight - 4, 6, bg, border);

      // Pegs in this row
      const slotSpacing = (W - 80) / Math.max(1, this.pegCount);
      const slotStartX = 16 + slotSpacing / 2;
      for (let p = 0; p < this.pegCount; p++) {
        const cx = slotStartX + p * slotSpacing;
        let color: number | undefined;
        if (isPast) {
          color = this.guesses[r][p];
        }
        if (color !== undefined && color >= 0) {
          this.drawCircle(cx, rowCy, this.rowPegRadius, PEG_COLORS[color] || EMPTY_PEG_COLOR, PEG_STROKE, 1.5);
        } else {
          this.drawCircle(cx, rowCy, this.rowPegRadius * 0.6, EMPTY_PEG_COLOR, EMPTY_PEG_BORDER, 1);
        }
      }

      // Feedback area on the right
      if (isPast) {
        this.renderFeedback(W - 64, rowCy, this.feedback[r]);
      }
    }

    // If game is over and code revealed, draw the code on top of the unused row area.
    if (this.codeRevealed) {
      this.renderRevealedCode();
    }
  }

  private renderFeedback(cx: number, cy: number, fb: Feedback): void {
    // Render up to pegCount feedback dots in a 2-row grid.
    const totalSlots = this.pegCount;
    const cols = Math.ceil(totalSlots / 2);
    const dotR = this.feedbackPegRadius;
    const dx = dotR * 2.4;
    const dy = dotR * 2.4;
    const startX = cx - ((cols - 1) * dx) / 2;
    const startY = cy - dy / 2;

    // Background plate
    const plateW = cols * dx + dotR * 2;
    const plateH = dy * 2 + dotR * 0.8;
    this.drawRoundRect(cx - plateW / 2, cy - plateH / 2, plateW, plateH, 4, FEEDBACK_BG_COLOR);

    let drawn = 0;
    for (let i = 0; i < fb.black; i++) {
      const col = drawn % cols;
      const row = Math.floor(drawn / cols);
      this.drawCircle(startX + col * dx, startY + row * dy, dotR, FEEDBACK_BLACK_COLOR, '#000', 1);
      drawn++;
    }
    for (let i = 0; i < fb.white; i++) {
      const col = drawn % cols;
      const row = Math.floor(drawn / cols);
      this.drawCircle(startX + col * dx, startY + row * dy, dotR, FEEDBACK_WHITE_COLOR, '#000', 1);
      drawn++;
    }
    while (drawn < totalSlots) {
      const col = drawn % cols;
      const row = Math.floor(drawn / cols);
      this.drawCircle(startX + col * dx, startY + row * dy, dotR * 0.7, FEEDBACK_EMPTY_COLOR);
      drawn++;
      if (drawn > totalSlots * 2) break; // safety guard
    }
  }

  private renderRevealedCode(): void {
    const W = this.width;
    const headerH = 72;
    const bannerY = headerH / 2;

    // Show the code centered above all rows
    const labelY = headerH + 8;
    const fade = this.revealAnim;
    this.ctx.globalAlpha = fade;
    this.drawText('The code was:', W / 2, labelY, {
      size: 13,
      color: HEADER_TEXT_COLOR,
      weight: '600',
    });
    const codeRowY = labelY + 18;
    const spacing = (W - 60) / Math.max(1, this.pegCount);
    const startX = 30 + spacing / 2;
    for (let p = 0; p < this.pegCount; p++) {
      const cx = startX + p * spacing;
      this.drawCircle(cx, codeRowY, this.rowPegRadius * 0.9, PEG_COLORS[this.code[p]] || EMPTY_PEG_COLOR, PEG_STROKE, 1.5);
    }
    this.ctx.globalAlpha = 1;
    void bannerY;
  }

  // ── Render: palette ───────────────────────────────────────────────────────

  private renderPalette(): void {
    for (let i = 0; i < this.colorCount; i++) {
      const cx = this.paletteStartX + i * this.paletteSpacing;
      this.drawCircle(cx, this.paletteY, this.paletteRadius, PEG_COLORS[i] || EMPTY_PEG_COLOR, PEG_STROKE, 1.5);
      // Number label below
      this.drawText(String(i + 1), cx, this.paletteY + this.paletteRadius + 8, {
        size: 10,
        color: HEADER_TEXT_COLOR,
        weight: '600',
      });
    }
  }

  // ── Render: current row & buttons ─────────────────────────────────────────

  private renderCurrentRow(): void {
    for (let i = 0; i < this.pegCount; i++) {
      const cx = this.currentRowStartX + i * this.currentSlotSpacing;
      const color = this.currentRow[i];
      if (color !== undefined && color >= 0) {
        this.drawCircle(cx, this.currentRowY, this.currentSlotRadius, PEG_COLORS[color] || EMPTY_PEG_COLOR, PEG_STROKE, 2);
      } else {
        this.drawCircle(cx, this.currentRowY, this.currentSlotRadius, EMPTY_PEG_COLOR, EMPTY_PEG_BORDER, 1.5);
      }
    }
  }

  private renderButtons(): void {
    const canSubmit = this.gameActive && this.currentRow.length === this.pegCount;

    // Clear button
    this.drawRoundRect(this.clearBtn.x, this.clearBtn.y, this.clearBtn.w, this.clearBtn.h, 8, BUTTON_CLEAR_BG);
    this.drawText('Clear', this.clearBtn.x + this.clearBtn.w / 2, this.clearBtn.y + this.clearBtn.h / 2, {
      size: 16,
      color: BUTTON_TEXT_COLOR,
      weight: '700',
    });

    // Submit button
    const submitBg = canSubmit ? BUTTON_BG_COLOR : BUTTON_BG_DISABLED;
    this.drawRoundRect(this.submitBtn.x, this.submitBtn.y, this.submitBtn.w, this.submitBtn.h, 8, submitBg);
    this.drawText('Submit', this.submitBtn.x + this.submitBtn.w / 2, this.submitBtn.y + this.submitBtn.h / 2, {
      size: 16,
      color: BUTTON_TEXT_COLOR,
      weight: '700',
    });
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (!this.gameActive) return;

    if (key === 'Enter') {
      e.preventDefault();
      this.submitGuess();
      return;
    }

    if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      this.clearCurrentRow();
      return;
    }

    // Number keys 1..colorCount
    if (key >= '1' && key <= '9') {
      const n = parseInt(key, 10) - 1;
      if (n >= 0 && n < this.colorCount) {
        e.preventDefault();
        this.addColorToRow(n);
      }
    }
  }

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;

    const hit = this.hitTest(x, y);
    if (!hit) return;

    if (hit.type === 'palette') {
      this.addColorToRow(hit.color);
    } else if (hit.type === 'currentSlot') {
      this.removeColorAtIndex(hit.index);
    } else if (hit.type === 'submit') {
      this.submitGuess();
    } else if (hit.type === 'clear') {
      this.clearCurrentRow();
    }
  }

  private hitTest(x: number, y: number): Hit {
    // Submit
    if (
      x >= this.submitBtn.x && x <= this.submitBtn.x + this.submitBtn.w &&
      y >= this.submitBtn.y && y <= this.submitBtn.y + this.submitBtn.h
    ) {
      return { type: 'submit' };
    }
    // Clear
    if (
      x >= this.clearBtn.x && x <= this.clearBtn.x + this.clearBtn.w &&
      y >= this.clearBtn.y && y <= this.clearBtn.y + this.clearBtn.h
    ) {
      return { type: 'clear' };
    }
    // Palette
    for (let i = 0; i < this.colorCount; i++) {
      const cx = this.paletteStartX + i * this.paletteSpacing;
      const dx = x - cx;
      const dy = y - this.paletteY;
      if (dx * dx + dy * dy <= this.paletteRadius * this.paletteRadius * 1.4) {
        return { type: 'palette', color: i };
      }
    }
    // Current row slots
    for (let i = 0; i < this.pegCount; i++) {
      const cx = this.currentRowStartX + i * this.currentSlotSpacing;
      const dx = x - cx;
      const dy = y - this.currentRowY;
      if (dx * dx + dy * dy <= this.currentSlotRadius * this.currentSlotRadius * 1.6) {
        return { type: 'currentSlot', index: i };
      }
    }
    return null;
  }

  // ── Game actions ──────────────────────────────────────────────────────────

  private addColorToRow(color: number): void {
    if (!this.gameActive) return;
    if (color < 0 || color >= this.colorCount) return;
    if (this.currentRow.length >= this.pegCount) return;
    this.currentRow.push(color);
    this.playSound('place');
    this.haptic('light');
  }

  private removeColorAtIndex(index: number): void {
    if (!this.gameActive) return;
    if (index < 0 || index >= this.currentRow.length) return;
    this.currentRow.splice(index, 1);
    this.playSound('place');
    this.haptic('light');
  }

  private clearCurrentRow(): void {
    if (!this.gameActive) return;
    if (this.currentRow.length === 0) return;
    this.currentRow = [];
    this.playSound('place');
    this.haptic('light');
  }

  private submitGuess(): void {
    if (!this.gameActive) return;
    if (this.currentRow.length !== this.pegCount) return;

    const guess = this.currentRow.slice();
    const fb = this.computeFeedback(guess);
    this.guesses.push(guess);
    this.feedback.push(fb);
    this.currentRow = [];

    this.playSound('score');
    this.haptic('medium');

    if (fb.black === this.pegCount) {
      // Win!
      const attemptsUsed = this.guesses.length;
      const bonus = 100 * (this.maxAttempts - attemptsUsed + 1);
      this.addScore(bonus);
      this.codeRevealed = true;
      this.gameActive = false;
      this.gameWin();
      // End the game shortly after to allow the win celebration to be seen.
      setTimeout(() => {
        this.gameOver();
      }, 1500);
      return;
    }

    if (this.guesses.length >= this.maxAttempts) {
      // Out of attempts — reveal the code.
      this.codeRevealed = true;
      this.gameActive = false;
      setTimeout(() => {
        this.gameOver();
      }, 1500);
    }
  }

  // ── Feedback algorithm ────────────────────────────────────────────────────

  /**
   * Compute mastermind feedback for a guess against the secret code.
   *
   * Standard two-pass algorithm with duplicate handling:
   *   Pass 1: count exact matches (black). For non-matches, accumulate
   *           remaining counts of guess colors and code colors separately.
   *   Pass 2: white pegs = sum of min(guessCount[c], codeCount[c]) for
   *           each color c that wasn't an exact match.
   *
   * Example: guess [1,1,2,3] vs code [1,2,2,3]
   *   Position 0: 1 vs 1 → black (+1).
   *   Position 1: 1 vs 2 → not black. guessLeft[1]++, codeLeft[2]++.
   *   Position 2: 2 vs 2 → black (+1).
   *   Position 3: 3 vs 3 → black (+1).
   *   white = sum min(guessLeft[c], codeLeft[c]) = min(1,0)+min(0,1) = 0.
   *   Result: black=3, white=0.
   */
  private computeFeedback(guess: number[]): Feedback {
    let black = 0;
    const guessLeft: number[] = new Array(this.colorCount).fill(0);
    const codeLeft: number[] = new Array(this.colorCount).fill(0);

    const len = Math.min(guess.length, this.code.length);
    for (let i = 0; i < len; i++) {
      const g = guess[i];
      const c = this.code[i];
      if (g === c) {
        black++;
      } else {
        if (g >= 0 && g < this.colorCount) guessLeft[g]++;
        if (c >= 0 && c < this.colorCount) codeLeft[c]++;
      }
    }

    let white = 0;
    for (let i = 0; i < this.colorCount; i++) {
      white += Math.min(guessLeft[i], codeLeft[i]);
    }

    return { black, white };
  }

  // ── Save / Resume ─────────────────────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      code: this.code.slice(),
      guesses: this.guesses.map(g => g.slice()),
      feedback: this.feedback.map(f => ({ black: f.black, white: f.white })),
      currentRow: this.currentRow.slice(),
      pegCount: this.pegCount,
      colorCount: this.colorCount,
      maxAttempts: this.maxAttempts,
      gameActive: this.gameActive,
      codeRevealed: this.codeRevealed,
    };
  }

  deserialize(state: GameSnapshot): void {
    if (!state || typeof state !== 'object') return;

    const code = state.code as number[] | undefined;
    if (Array.isArray(code) && code.length > 0) {
      this.code = code.slice();
    }

    const pegCount = state.pegCount;
    if (typeof pegCount === 'number' && pegCount > 0 && pegCount <= 8) {
      this.pegCount = pegCount;
    }

    const colorCount = state.colorCount;
    if (typeof colorCount === 'number' && colorCount > 0 && colorCount <= 8) {
      this.colorCount = colorCount;
    }

    const maxAttempts = state.maxAttempts;
    if (typeof maxAttempts === 'number' && maxAttempts > 0 && maxAttempts <= 20) {
      this.maxAttempts = maxAttempts;
    }

    const guesses = state.guesses as unknown;
    if (Array.isArray(guesses)) {
      this.guesses = [];
      for (const g of guesses) {
        if (Array.isArray(g)) {
          const row: number[] = [];
          for (const v of g) {
            if (typeof v === 'number') row.push(v);
          }
          if (row.length === this.pegCount) this.guesses.push(row);
        }
      }
    }

    const feedback = state.feedback as unknown;
    if (Array.isArray(feedback)) {
      this.feedback = [];
      for (const f of feedback) {
        if (f && typeof f === 'object') {
          const fb = f as { black?: unknown; white?: unknown };
          const black = typeof fb.black === 'number' ? fb.black : 0;
          const white = typeof fb.white === 'number' ? fb.white : 0;
          this.feedback.push({ black, white });
        }
      }
    }

    // Ensure feedback array length matches guesses, padding with zeros if needed.
    while (this.feedback.length < this.guesses.length) {
      this.feedback.push({ black: 0, white: 0 });
    }
    if (this.feedback.length > this.guesses.length) {
      this.feedback.length = this.guesses.length;
    }

    const currentRow = state.currentRow as unknown;
    if (Array.isArray(currentRow)) {
      this.currentRow = [];
      for (const v of currentRow) {
        if (typeof v === 'number' && v >= 0 && v < this.colorCount && this.currentRow.length < this.pegCount) {
          this.currentRow.push(v);
        }
      }
    }

    this.gameActive = typeof state.gameActive === 'boolean' ? state.gameActive : true;
    this.codeRevealed = typeof state.codeRevealed === 'boolean' ? state.codeRevealed : false;

    // Recompute layout because pegCount/colorCount may have changed.
    this.computeLayout();
  }

  canSave(): boolean {
    return this.gameActive;
  }
}

// ── Registration ────────────────────────────────────────────────────────────

registerGame({
  id: 'mastermind',
  name: 'Mastermind',
  description: 'Crack the secret color code',
  icon: 'M',
  color: '--color-primary',
  bgGradient: ['#704F9C', '#9F7BC9'],
  category: 'puzzle',
  createGame: (config) => new MastermindGame(config),
  canvasWidth: 360,
  canvasHeight: 640,
  controls: 'Tap colors to build a guess, Submit to check',
  dailyMode: true,
});
