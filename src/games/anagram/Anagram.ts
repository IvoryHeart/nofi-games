import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';
import { wordSet } from '../../words/dictionary';

// ── Constants ───────────────────────────────────────────────────────────────

const BG_COLOR = '#FEF0E4';
const PANEL_COLOR = '#FFFAF5';
const PRIMARY_COLOR = '#8B5E83';
const ACCENT_COLOR = '#D4A574';
const TILE_COLOR = '#F5E6D8';
const TILE_SELECTED_COLOR = '#E8C497';
const TEXT_DARK = '#3D2B35';
const TEXT_LIGHT = '#FFFFFF';
const TEXT_MUTED = '#8B7D6B';
const SUCCESS_COLOR = '#4FA56B';
const ERROR_COLOR = '#E85D5D';
const BUTTON_COLOR = '#8B5E83';
const BUTTON_TEXT = '#FFFFFF';
const BORDER_COLOR = '#D9CFC6';

// Curated pangram bases. Each base is a real word whose letters form
// many common English sub-words. Picked so 5/6/7 letter slices all work.
const ANAGRAM_BASES: string[] = [
  'GARDEN',  // 6
  'LIBRARY', // 7
  'ORANGE',  // 6
  'PLANET',  // 6
  'STREAM',  // 6
  'CASTLE',  // 6
  'FOREST',  // 6
  'MASTER',  // 6
  'PARENT',  // 6
  'DANGER',  // 6
  'KITCHEN', // 7
  'TEACHER', // 7
  'PICTURE', // 7
  'STRANGE', // 7
  'CARPETS', // 7
  'PARTNER', // 7
  'CLEANER', // 7
  'GROWING', // 7
  'PAINTER', // 7
  'BRACKET', // 7
  'WRITERS', // 7
  'STORIES', // 7
  'HEARTS',  // 6
  'WONDER',  // 6
  'ANSWER',  // 6
  'PRINCE',  // 6
  'SILVER',  // 6
  'WINTER',  // 6
  'NUMBER',  // 6
  'MOTHER',  // 6
  'FATHER',  // 6
  'SISTER',  // 6
  'BROTHER', // 7
  'FRIENDS', // 7
  'HEALTH',  // 6
  'PLATES',  // 6
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Return a sorted-letter signature, e.g. "garden" -> "adegnr". Used to
 *  test whether a candidate's letters are a multiset subset of the base. */
function letterSignature(word: string): string {
  return word.toLowerCase().split('').sort().join('');
}

/** Returns true iff every letter (with multiplicity) in `candidate` is
 *  available in `available`. Linear in word length. */
function isMultisetSubset(candidate: string, available: string): boolean {
  const counts: Record<string, number> = {};
  for (const ch of available) {
    counts[ch] = (counts[ch] ?? 0) + 1;
  }
  for (const ch of candidate) {
    if (!counts[ch]) return false;
    counts[ch]--;
  }
  return true;
}

/** Score a single found word: 10 pts for a 3-letter word, then +5 per extra
 *  letter. So 3=10, 4=15, 5=20, 6=25, 7=30. The pangram bonus is added
 *  separately on top of this base score. */
function scoreForWord(word: string): number {
  return 10 + Math.max(0, word.length - 3) * 5;
}

const PANGRAM_BONUS = 50;

// ── Difficulty configs ──────────────────────────────────────────────────────

interface DifficultyConfig {
  letterCount: number;   // 5..7 (also the pangram length)
  timeLimit: number;     // seconds
  targetWords: number;   // need this many to win
  requirePangram: boolean;
}

const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { letterCount: 5, timeLimit: 90, targetWords: 5,  requirePangram: false }, // Easy
  { letterCount: 6, timeLimit: 90, targetWords: 10, requirePangram: false }, // Medium
  { letterCount: 7, timeLimit: 75, targetWords: 15, requirePangram: true  }, // Hard
  { letterCount: 7, timeLimit: 60, targetWords: 20, requirePangram: true  }, // Extra Hard
];

// ── Game ────────────────────────────────────────────────────────────────────

interface FlashMessage {
  text: string;
  color: string;
  timeLeft: number; // seconds remaining
}

interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
  label: 'submit' | 'shuffle' | 'clear';
}

interface TileRect {
  x: number;
  y: number;
  r: number;
  index: number; // index into letters[]
  /** Angular position in radians (for debugging + tests). -PI/2 = top. */
  angle: number;
}

class AnagramGame extends GameEngine {
  // Puzzle state
  private base: string = '';            // lowercase pangram, e.g. "garden"
  private letters: string[] = [];       // shuffled tile letters, length = config.letterCount
  private validWords: Set<string> = new Set(); // all valid sub-words for the current puzzle
  private foundWords: string[] = [];    // words player has found, in order
  private foundPangram: boolean = false;
  private currentInput: string = '';    // letters being assembled
  private selectedTiles: number[] = []; // tile indices used by currentInput, in order

  // Timer
  private timeLeft: number = 0;
  private timeLimitSeconds: number = 0;
  private gameActive: boolean = false;

  // Difficulty
  private cfg: DifficultyConfig = DIFFICULTY_CONFIGS[0];

  // Layout (recomputed in init based on canvas size)
  private headerHeight: number = 56;
  private tileCenterX: number = 0;
  private tileCenterY: number = 0;
  private ringRadius: number = 0;
  private tileRadius: number = 28;
  private tilesArea: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 };
  private buttons: ButtonRect[] = [];
  private tileRects: TileRect[] = [];
  private listRect: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 };

  // Drag-to-connect state (radial word picker)
  /** True while a pointer is down on a tile — we're either tapping or dragging. */
  private dragActive: boolean = false;
  /** True once the pointer has moved onto another tile (or backtracked). Used
   *  to decide whether pointer-up should auto-submit. A pure tap (down + up on
   *  the same tile with no drag) stays `false` and preserves click-click mode. */
  private isDragging: boolean = false;
  /** Last known pointer position while a drag is in progress — used to draw
   *  the trailing mauve line from the tail tile to the pointer. */
  private dragPointerX: number = 0;
  private dragPointerY: number = 0;

  // Flash message for feedback ("New word!", "Already found", etc.)
  private flash: FlashMessage | null = null;

  constructor(config: GameConfig) {
    super(config);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  init(): void {
    const diff = Math.min(Math.max(this.difficulty, 0), 3);
    this.cfg = DIFFICULTY_CONFIGS[diff];

    // Generate puzzle first so letters exist, then lay out the radial ring.
    this.generatePuzzle();
    this.computeLayout();

    // Reset state
    this.foundWords = [];
    this.foundPangram = false;
    this.currentInput = '';
    this.selectedTiles = [];
    this.timeLeft = this.cfg.timeLimit;
    this.timeLimitSeconds = this.cfg.timeLimit;
    this.gameActive = true;
    this.flash = null;
    this.dragActive = false;
    this.isDragging = false;

    this.setScore(0);
  }

  private computeLayout(): void {
    const W = this.width;
    const H = this.height;

    // Shell HUD occupies the top ~50px; no in-canvas header needed.
    this.headerHeight = 72;

    // Buttons + found-words list anchor to the bottom of the canvas. We first
    // reserve their space so the radial tile area can expand into what's left.
    const btnH = Math.max(32, Math.min(42, H * 0.055));
    const btnGap = 8;
    const btnW = (W * 0.9 - btnGap * 2) / 3;
    const btnStartX = W * 0.05;

    // Found-words list gets a fixed slice at the very bottom.
    const listH = Math.max(60, Math.min(110, H * 0.16));
    const listY = H - listH - 10;

    const btnY = listY - btnH - 10;

    this.buttons = [
      { x: btnStartX,                       y: btnY, w: btnW, h: btnH, label: 'shuffle' },
      { x: btnStartX + btnW + btnGap,       y: btnY, w: btnW, h: btnH, label: 'clear' },
      { x: btnStartX + (btnW + btnGap) * 2, y: btnY, w: btnW, h: btnH, label: 'submit' },
    ];

    this.listRect = {
      x: W * 0.05,
      y: listY,
      w: W * 0.9,
      h: listH,
    };

    // Tile area: everything between the header and the buttons.
    const tileAreaTop = this.headerHeight + 12;
    const tileAreaHeight = Math.max(120, btnY - tileAreaTop - 10);
    this.tilesArea = {
      x: 0,
      y: tileAreaTop,
      w: W,
      h: tileAreaHeight,
    };

    // Radial picker: tiles on a circle centered in the tile area.
    // Tile radius scales with both canvas width and number of letters so tiles
    // stay comfortable to tap on phones without overlapping on desktop.
    this.tileRadius = Math.max(22, Math.min(34, W * 0.09));
    this.tileCenterX = W / 2;
    this.tileCenterY = tileAreaTop + tileAreaHeight / 2;

    // Ring radius: leave room for the tile circles themselves plus a margin,
    // and cap by ~35% of the canvas width so the picker doesn't feel huge on
    // landscape/desktop.
    const maxByWidth = Math.min(W, H) * 0.35;
    const maxByHeight = tileAreaHeight / 2 - this.tileRadius - 8;
    const minRadius = this.tileRadius * 2.2; // prevents tile overlap at small N
    this.ringRadius = Math.max(minRadius, Math.min(maxByWidth, maxByHeight));

    this.computeTilePositions();
  }

  /** Place each letter on the ring. Tile 0 sits at the top (angle = -PI/2)
   *  and subsequent tiles step clockwise by 2*PI/N. Kept in its own method
   *  so shuffle / deserialize can refresh positions without recomputing the
   *  whole layout. */
  private computeTilePositions(): void {
    const n = this.letters.length;
    this.tileRects = [];
    if (n === 0) return;
    const step = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + i * step;
      const x = this.tileCenterX + Math.cos(angle) * this.ringRadius;
      const y = this.tileCenterY + Math.sin(angle) * this.ringRadius;
      this.tileRects.push({ x, y, r: this.tileRadius, index: i, angle });
    }
  }

  private generatePuzzle(): void {
    // Pick a base whose length matches our difficulty letter count.
    const candidates = ANAGRAM_BASES.filter((b) => b.length === this.cfg.letterCount);
    // Defensive fallback: if for any reason the curated list has no entry of
    // that exact length, fall back to any base trimmed to the right length.
    let basePick: string;
    if (candidates.length > 0) {
      basePick = candidates[Math.floor(this.rng() * candidates.length)];
    } else {
      const allLen = ANAGRAM_BASES.find((b) => b.length >= this.cfg.letterCount) ?? ANAGRAM_BASES[0];
      basePick = allLen.slice(0, this.cfg.letterCount);
    }

    this.base = basePick.toLowerCase();

    // Build letter array from the base, then Fisher-Yates shuffle with this.rng().
    this.letters = this.base.split('');
    this.shuffleLetters();

    // Compute the set of valid sub-words for this base. We scan the dictionary
    // once: this is O(N * L) where L = max word length.
    this.validWords = new Set();
    const baseSig = letterSignature(this.base);
    // Pre-build a count map of base letters for the multiset subset check.
    for (const word of wordSet()) {
      if (word.length < 3) continue;
      if (word.length > this.base.length) continue;
      // Quick reject by length, then exact subset test
      if (!isMultisetSubset(word, this.base)) continue;
      this.validWords.add(word);
    }
    // Always include the pangram itself
    this.validWords.add(this.base);

    // baseSig is referenced for completeness / future debugging
    void baseSig;
  }

  private shuffleLetters(): void {
    // Fisher-Yates with this.rng() for daily-mode determinism.
    for (let i = this.letters.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const tmp = this.letters[i];
      this.letters[i] = this.letters[j];
      this.letters[j] = tmp;
    }
  }

  update(dt: number): void {
    if (!this.gameActive) return;

    // Tick timer
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.gameActive = false;
      this.gameOver();
      return;
    }

    // Tick flash message
    if (this.flash) {
      this.flash.timeLeft -= dt;
      if (this.flash.timeLeft <= 0) {
        this.flash = null;
      }
    }
  }

  render(): void {
    this.clear(BG_COLOR);

    this.renderRadialPicker();
    this.renderButtons();
    this.renderFoundList();

    if (this.flash) {
      this.renderFlash();
    }
  }

  getHudStats(): Array<{ label: string; value: string }> {
    const t = Math.ceil(this.timeLeft);
    const mm = Math.floor(t / 60);
    const ss = t % 60;
    return [
      { label: 'Time', value: `${mm}:${ss.toString().padStart(2, '0')}` },
      { label: 'Words', value: `${this.foundWords.length}/${this.cfg.targetWords}` },
    ];
  }

  // ── Rendering ───────────────────────────────────────────────────────────

  private renderRadialPicker(): void {
    const cx = this.tileCenterX;
    const cy = this.tileCenterY;

    // Faint guide ring so the layout reads as a circle even before any
    // letter is selected.
    this.drawCircle(cx, cy, this.ringRadius, '', BORDER_COLOR, 1);

    // Connecting lines between selected tiles, then from the tail tile to
    // the current drag pointer. Drawn BEHIND the tiles so the tiles cover
    // the line endpoints cleanly.
    if (this.selectedTiles.length > 0 && this.tileRects.length > 0) {
      this.ctx.save();
      this.ctx.strokeStyle = PRIMARY_COLOR;
      this.ctx.lineWidth = Math.max(3, this.tileRadius * 0.18);
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      for (let i = 0; i < this.selectedTiles.length; i++) {
        const t = this.tileRects[this.selectedTiles[i]];
        if (!t) continue;
        if (i === 0) this.ctx.moveTo(t.x, t.y);
        else this.ctx.lineTo(t.x, t.y);
      }
      if (this.dragActive && this.isDragging) {
        this.ctx.lineTo(this.dragPointerX, this.dragPointerY);
      }
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Tiles themselves.
    for (const tile of this.tileRects) {
      const isSelected = this.selectedTiles.includes(tile.index);
      const fill = isSelected ? TILE_SELECTED_COLOR : TILE_COLOR;
      const stroke = isSelected ? PRIMARY_COLOR : BORDER_COLOR;
      this.drawCircle(tile.x, tile.y, tile.r, fill, stroke, 2);
      this.drawText(this.letters[tile.index].toUpperCase(), tile.x, tile.y + 1, {
        size: tile.r * 0.95,
        color: TEXT_DARK,
        weight: '700',
      });
    }

    // Center display: the current assembled word, or a subtle placeholder.
    const display = this.currentInput ? this.currentInput.toUpperCase() : '';
    if (display) {
      // Size shrinks a bit as the word grows so it stays inside the ring.
      const maxW = this.ringRadius * 1.6;
      let size = Math.min(this.tileRadius * 1.4, 32);
      this.ctx.save();
      this.ctx.font = `700 ${size}px 'Inter', system-ui, sans-serif`;
      while (this.ctx.measureText(display).width > maxW && size > 12) {
        size -= 1;
        this.ctx.font = `700 ${size}px 'Inter', system-ui, sans-serif`;
      }
      this.ctx.restore();
      this.drawText(display, cx, cy, {
        size, color: PRIMARY_COLOR, weight: '700',
      });
    } else {
      this.drawText('Drag letters', cx, cy, {
        size: 13, color: TEXT_MUTED, weight: '500',
      });
    }
  }

  private renderButtons(): void {
    for (const btn of this.buttons) {
      const isSubmit = btn.label === 'submit';
      const fill = isSubmit ? BUTTON_COLOR : PANEL_COLOR;
      const textColor = isSubmit ? BUTTON_TEXT : TEXT_DARK;
      const stroke = isSubmit ? BUTTON_COLOR : BORDER_COLOR;
      this.drawRoundRect(btn.x, btn.y, btn.w, btn.h, 6, fill, stroke);

      const label = btn.label === 'submit' ? 'Submit'
                  : btn.label === 'shuffle' ? 'Shuffle'
                  : 'Clear';
      this.drawText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1, {
        size: 14, color: textColor, weight: '700',
      });
    }
  }

  private renderFoundList(): void {
    const { x, y, w, h } = this.listRect;
    this.drawRoundRect(x, y, w, h, 6, PANEL_COLOR, BORDER_COLOR);

    if (this.foundWords.length === 0) {
      this.drawText('Found words appear here', x + w / 2, y + 22, {
        size: 12, color: TEXT_MUTED, weight: '500',
      });
      return;
    }

    // Two-column layout, fixed line height
    const lineH = 18;
    const colW = w / 2;
    const rowsPerCol = Math.max(1, Math.floor((h - 16) / lineH));
    // Show the most recent words first (newest on top)
    const display = [...this.foundWords].reverse();

    for (let i = 0; i < display.length; i++) {
      const col = Math.floor(i / rowsPerCol);
      const row = i % rowsPerCol;
      if (col >= 2) break; // overflow guard – drop the oldest off-screen entries
      const cellX = x + col * colW + 12;
      const cellY = y + 16 + row * lineH;
      const word = display[i];
      const isPangram = word === this.base;
      const color = isPangram ? SUCCESS_COLOR : TEXT_DARK;
      const weight = isPangram ? '700' : '600';
      this.drawText(word.toUpperCase(), cellX, cellY, {
        size: 12, color, weight, align: 'left',
      });
    }
  }

  private renderFlash(): void {
    if (!this.flash) return;
    const W = this.width;
    const H = this.height;
    // Float the flash just above the button row so it never occludes the ring.
    const cx = W / 2;
    const btnY = this.buttons.length > 0 ? this.buttons[0].y : H - 60;
    const cy = btnY - 12;
    if (cy < 0 || cy > H) return;
    this.drawText(this.flash.text, cx, cy, {
      size: 14, color: this.flash.color, weight: '700',
    });
  }

  // ── Input handling ──────────────────────────────────────────────────────

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;

    // Tile hit-test — if the pointer landed on a letter, start a drag session.
    const tileIdx = this.tileAt(x, y);
    if (tileIdx !== -1) {
      this.dragPointerX = x;
      this.dragPointerY = y;
      this.dragActive = true;
      this.isDragging = false;
      this.toggleTile(tileIdx);
      return;
    }

    // Otherwise, maybe the player hit a button.
    for (const btn of this.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this.handleButton(btn.label);
        return;
      }
    }
  }

  protected handlePointerMove(x: number, y: number): void {
    if (!this.gameActive || !this.dragActive) return;
    this.dragPointerX = x;
    this.dragPointerY = y;

    const tileIdx = this.tileAt(x, y);
    if (tileIdx === -1) return;

    // Unselected tile under the pointer → extend the word.
    if (!this.selectedTiles.includes(tileIdx)) {
      this.selectedTiles.push(tileIdx);
      this.rebuildInputFromTiles();
      this.isDragging = true;
      this.haptic('light');
      return;
    }

    // Backtrack: if the pointer crosses back onto the previous tile, drop the
    // last letter. Word Connect behaviour — lets users undo without lifting.
    if (this.selectedTiles.length >= 2) {
      const prev = this.selectedTiles[this.selectedTiles.length - 2];
      if (prev === tileIdx) {
        this.selectedTiles.pop();
        this.rebuildInputFromTiles();
        this.isDragging = true;
        this.haptic('light');
      }
    }
  }

  protected handlePointerUp(_x: number, _y: number): void {
    if (!this.dragActive) return;
    const wasDragging = this.isDragging;
    this.dragActive = false;
    this.isDragging = false;

    // A real drag (pointer moved across at least two tiles) auto-submits on
    // release. A pure tap (down + up on the same tile with no movement) keeps
    // the letter selected so click-click mode still works.
    if (wasDragging && this.gameActive && this.currentInput.length > 0) {
      this.submitWord();
    }
  }

  /** Return the tile index at (x, y), or -1 if none. */
  private tileAt(x: number, y: number): number {
    for (const tile of this.tileRects) {
      const dx = x - tile.x;
      const dy = y - tile.y;
      // Slightly generous hit slop so fast drags don't slip between tiles.
      const hit = tile.r + 4;
      if (dx * dx + dy * dy <= hit * hit) {
        return tile.index;
      }
    }
    return -1;
  }

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (!this.gameActive) return;

    if (key === 'Enter') {
      e.preventDefault();
      this.submitWord();
      return;
    }
    if (key === 'Escape') {
      e.preventDefault();
      this.clearInput();
      return;
    }
    if (key === 'Backspace') {
      e.preventDefault();
      this.backspace();
      return;
    }

    // Single letter? Try to add it (case-insensitive).
    if (key.length === 1) {
      const lower = key.toLowerCase();
      if (lower >= 'a' && lower <= 'z') {
        // Find the first unused tile with this letter
        for (let i = 0; i < this.letters.length; i++) {
          if (this.letters[i] === lower && !this.selectedTiles.includes(i)) {
            this.toggleTile(i);
            return;
          }
        }
      }
    }
  }

  // ── Game actions ────────────────────────────────────────────────────────

  private toggleTile(index: number): void {
    if (index < 0 || index >= this.letters.length) return;

    const pos = this.selectedTiles.indexOf(index);
    if (pos >= 0) {
      // Already selected — remove it (and any after it, to keep the input
      // a strict prefix of selectedTiles).
      this.selectedTiles.splice(pos, this.selectedTiles.length - pos);
      this.rebuildInputFromTiles();
      this.haptic('light');
      return;
    }

    this.selectedTiles.push(index);
    this.rebuildInputFromTiles();
    this.haptic('light');
  }

  private rebuildInputFromTiles(): void {
    let s = '';
    for (const i of this.selectedTiles) {
      s += this.letters[i];
    }
    this.currentInput = s;
  }

  private backspace(): void {
    if (this.selectedTiles.length === 0) return;
    this.selectedTiles.pop();
    this.rebuildInputFromTiles();
  }

  private clearInput(): void {
    this.selectedTiles = [];
    this.currentInput = '';
  }

  private handleButton(label: 'submit' | 'shuffle' | 'clear'): void {
    if (label === 'submit') this.submitWord();
    else if (label === 'shuffle') this.shuffle();
    else this.clearInput();
  }

  private shuffle(): void {
    this.shuffleLetters();
    // After shuffle, the indices are stale — clear the selection.
    this.clearInput();
    this.haptic('medium');
  }

  /** Try to submit the current input as a word. Returns true if accepted. */
  private submitWord(): boolean {
    const word = this.currentInput.toLowerCase();
    if (word.length < 3) {
      this.setFlash('Too short', ERROR_COLOR);
      this.clearInput();
      return false;
    }
    if (this.foundWords.includes(word)) {
      this.setFlash('Already found', TEXT_MUTED);
      this.clearInput();
      return false;
    }
    if (!this.validWords.has(word)) {
      this.setFlash('Not a word', ERROR_COLOR);
      this.clearInput();
      this.haptic('medium');
      return false;
    }

    // Valid new word!
    this.foundWords.push(word);
    let gained = scoreForWord(word);
    if (word === this.base) {
      gained += PANGRAM_BONUS;
      this.foundPangram = true;
      this.setFlash('PANGRAM!', SUCCESS_COLOR);
      this.haptic('heavy');
    } else {
      this.setFlash(`+${gained}`, SUCCESS_COLOR);
      this.haptic('light');
    }
    this.addScore(gained);
    this.clearInput();

    this.checkWinCondition();
    return true;
  }

  private checkWinCondition(): void {
    if (this.won) return;
    if (this.foundWords.length < this.cfg.targetWords) return;
    if (this.cfg.requirePangram && !this.foundPangram) return;
    this.gameWin();
  }

  private setFlash(text: string, color: string): void {
    this.flash = { text, color, timeLeft: 1.2 };
  }

  // ── Save / Resume ─────────────────────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      // Schema version lets future changes detect and migrate older snapshots.
      v: 2,
      base: this.base,
      letters: [...this.letters],
      foundWords: [...this.foundWords],
      foundPangram: this.foundPangram,
      timeLeft: this.timeLeft,
      gameActive: this.gameActive,
      difficulty: this.difficulty,
      // Radial layout state so the ring resumes in exactly the same spot.
      selectedTiles: [...this.selectedTiles],
      currentInput: this.currentInput,
    };
  }

  deserialize(state: GameSnapshot): void {
    const base = state.base as string | undefined;
    const letters = state.letters as string[] | undefined;
    if (typeof base !== 'string' || base.length === 0) return;
    if (!Array.isArray(letters) || letters.length === 0) return;
    if (letters.length !== this.cfg.letterCount) return;

    this.base = base;
    this.letters = [...letters];

    // Recompute valid words for this base (we don't trust serialized state).
    this.validWords = new Set();
    for (const word of wordSet()) {
      if (word.length < 3) continue;
      if (word.length > this.base.length) continue;
      if (!isMultisetSubset(word, this.base)) continue;
      this.validWords.add(word);
    }
    this.validWords.add(this.base);

    const found = state.foundWords;
    if (Array.isArray(found)) {
      this.foundWords = (found as unknown[]).filter((w): w is string => typeof w === 'string');
    } else {
      this.foundWords = [];
    }
    this.foundPangram = state.foundPangram === true;

    const tl = state.timeLeft;
    this.timeLeft = typeof tl === 'number' && tl > 0 ? tl : this.cfg.timeLimit;

    this.gameActive = state.gameActive !== false;

    // Radial state (v2+): restore in-flight word if present, else start clean.
    const selTiles = state.selectedTiles;
    if (Array.isArray(selTiles)) {
      const n = this.letters.length;
      this.selectedTiles = (selTiles as unknown[]).filter(
        (v): v is number => typeof v === 'number' && v >= 0 && v < n,
      );
    } else {
      this.selectedTiles = [];
    }
    const ci = state.currentInput;
    if (typeof ci === 'string') {
      this.currentInput = ci;
    } else {
      this.rebuildInputFromTiles();
    }

    // Tile positions depend on letter count; refresh them so hit-testing
    // works immediately after a resume without waiting for the next frame.
    this.computeTilePositions();
  }

  canSave(): boolean {
    return this.gameActive;
  }

  getRevealMessage(): string | null {
    if (this.won) return null;
    const missed = [...this.validWords].filter(w => !this.foundWords.includes(w));
    if (missed.length === 0) return null;
    // Show up to 8 missed words as a hint of what was possible
    const shown = missed.slice(0, 8);
    const extra = missed.length > 8 ? ` + ${missed.length - 8} more` : '';
    return `Missed words: <strong>${shown.join(', ')}</strong>${extra}`;
  }
}

// ── Registration ──────────────────────────────────────────────────────────

registerGame({
  id: 'anagram',
  name: 'Anagram',
  description: 'Form words from the letters',
  icon: 'A',
  color: '--color-primary',
  bgGradient: ['#D4A574', '#E8C497'],
  category: 'puzzle',
  createGame: (config) => new AnagramGame(config),
  canvasWidth: 360,
  canvasHeight: 640,
  controls: 'Tap letters to form words, Submit to check',
  dailyMode: true,
  continuableAfterWin: true,
});
