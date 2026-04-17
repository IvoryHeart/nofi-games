import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';
import { isValidWord } from '../../words/dictionary';
import { LadderLevel } from './types';
import { generateDaily, LadderBucket } from './generator';

const BUCKETS: LadderBucket[] = ['easy', 'medium', 'hard', 'expert'];

// ── Layout ───────────────────────────────────────────────
const TOP_HUD = 72;
const HEADER_H = 52;            // START → GOAL line
const CURRENT_ROW_GAP = 14;
const KEYBOARD_PAD_BOTTOM = 12;
const KEY_GAP = 4;

// ── Visuals ──────────────────────────────────────────────
const BG = '#FEF0E4';
const TILE_BG = '#F5E7D5';
const TILE_TEXT = '#3D2B35';
const TILE_CURRENT_BG = '#FFFFFF';
const TILE_CURRENT_BORDER = '#8B5E83';
const TILE_SELECTED_BORDER = '#D14E5C';
const KEY_BG = '#EFDBC7';
const KEY_ACTIVE_BG = '#D8C2AA';
const KEY_TEXT = '#3D2B35';
const KEY_SPECIAL_BG = '#8B5E83';
const KEY_SPECIAL_TEXT = '#FFFFFF';
const START_COLOR = '#8DC5A2';
const GOAL_COLOR = '#D14E5C';
const ERROR_SHAKE_MS = 360;
const WIN_DELAY_MS = 1500;

const KB_ROW_1 = ['q','w','e','r','t','y','u','i','o','p'];
const KB_ROW_2 = ['a','s','d','f','g','h','j','k','l'];
const KB_ROW_3 = ['BACK','z','x','c','v','b','n','m','UNDO'];

type Key = { kind: 'letter'; ch: string } | { kind: 'back' } | { kind: 'undo' };

class WordLadderGame extends GameEngine {
  private level!: LadderLevel;
  private ladder: string[] = []; // history; last entry is the current word
  private selectedSlot = 0;
  private wordLen = 4;
  private gameActive = false;
  private winScheduled = false;
  private shakeTimer = 0;

  // Layout (computed)
  private tileSize = 40;
  private tileGap = 6;
  private ladderX = 0;
  private ladderTopY = 0;
  private currentY = 0;

  // On-screen keyboard hit areas
  private keyHitAreas: Array<{ k: Key; x: number; y: number; w: number; h: number; active?: boolean }> = [];
  private activeKey: Key | null = null;

  constructor(config: GameConfig) {
    super(config);
  }

  init(): void {
    const d = Math.max(0, Math.min(3, this.difficulty));
    const bucket = BUCKETS[d];
    const seed = this.seed ?? Math.floor(Math.random() * 2_147_483_647);
    this.level = generateDaily(seed, bucket);
    this.wordLen = this.level.start.length;
    this.ladder = [this.level.start];
    this.selectedSlot = this.firstMismatchWithGoal(this.level.start);
    this.gameActive = true;
    this.winScheduled = false;
    this.shakeTimer = 0;
    this.computeLayout();
    this.setScore(0);
  }

  private firstMismatchWithGoal(word: string): number {
    for (let i = 0; i < this.wordLen; i++) {
      if (word[i] !== this.level.end[i]) return i;
    }
    return 0;
  }

  private computeLayout(): void {
    // Keyboard sizing: fits KB_ROW_1 (10 keys) across available width
    const availW = this.width - 12;
    const keyW = Math.floor((availW - KEY_GAP * 9) / 10);
    const keyH = Math.max(38, Math.min(48, Math.floor(keyW * 1.2)));
    const kbHeight = keyH * 3 + KEY_GAP * 2;

    // Letter tile size for current word + ladder
    const maxTileByW = Math.floor((this.width - 40 - (this.wordLen - 1) * 6) / this.wordLen);
    this.tileSize = Math.max(28, Math.min(48, maxTileByW));
    this.tileGap = 6;

    // Current word row sits just above keyboard
    this.currentY = this.height - KEYBOARD_PAD_BOTTOM - kbHeight - CURRENT_ROW_GAP - this.tileSize;

    // Ladder top
    const ladderTop = TOP_HUD + HEADER_H + 12;
    this.ladderTopY = ladderTop;

    // Center horizontally
    const rowW = this.tileSize * this.wordLen + this.tileGap * (this.wordLen - 1);
    this.ladderX = Math.floor((this.width - rowW) / 2);

    // Build keyboard hit areas
    this.keyHitAreas = [];
    const kbY0 = this.height - KEYBOARD_PAD_BOTTOM - kbHeight;
    const rowYs = [kbY0, kbY0 + keyH + KEY_GAP, kbY0 + (keyH + KEY_GAP) * 2];
    // Row 1 (10)
    for (let i = 0; i < KB_ROW_1.length; i++) {
      const x = Math.floor((this.width - (keyW * 10 + KEY_GAP * 9)) / 2) + i * (keyW + KEY_GAP);
      this.keyHitAreas.push({ k: { kind: 'letter', ch: KB_ROW_1[i] }, x, y: rowYs[0], w: keyW, h: keyH });
    }
    // Row 2 (9, centered — slight inset)
    for (let i = 0; i < KB_ROW_2.length; i++) {
      const x = Math.floor((this.width - (keyW * 9 + KEY_GAP * 8)) / 2) + i * (keyW + KEY_GAP);
      this.keyHitAreas.push({ k: { kind: 'letter', ch: KB_ROW_2[i] }, x, y: rowYs[1], w: keyW, h: keyH });
    }
    // Row 3 (BACK + 7 letters + UNDO, with BACK/UNDO wider)
    const wide = Math.floor(keyW * 1.4);
    const innerKeys = 7;
    const row3W = wide * 2 + keyW * innerKeys + KEY_GAP * (innerKeys + 1);
    let x3 = Math.floor((this.width - row3W) / 2);
    this.keyHitAreas.push({ k: { kind: 'back' }, x: x3, y: rowYs[2], w: wide, h: keyH });
    x3 += wide + KEY_GAP;
    for (let i = 1; i < KB_ROW_3.length - 1; i++) {
      this.keyHitAreas.push({ k: { kind: 'letter', ch: KB_ROW_3[i] }, x: x3, y: rowYs[2], w: keyW, h: keyH });
      x3 += keyW + KEY_GAP;
    }
    this.keyHitAreas.push({ k: { kind: 'undo' }, x: x3, y: rowYs[2], w: wide, h: keyH });
  }

  // ── Input ─────────────────────────────────────────────────

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (!this.gameActive) return;
    if (key.length === 1 && /[a-zA-Z]/.test(key)) {
      e.preventDefault();
      this.tryApplyLetter(key.toLowerCase());
    } else if (key === 'Backspace') {
      e.preventDefault();
      this.undoStep();
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      this.selectedSlot = (this.selectedSlot - 1 + this.wordLen) % this.wordLen;
    } else if (key === 'ArrowRight') {
      e.preventDefault();
      this.selectedSlot = (this.selectedSlot + 1) % this.wordLen;
    }
  }

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;
    // Slot selection: click on a letter in the current word
    const currentWord = this.ladder[this.ladder.length - 1];
    for (let i = 0; i < this.wordLen; i++) {
      const sx = this.ladderX + i * (this.tileSize + this.tileGap);
      const sy = this.currentY;
      if (x >= sx && x <= sx + this.tileSize && y >= sy && y <= sy + this.tileSize) {
        this.selectedSlot = i;
        return;
      }
    }

    // Keyboard
    for (const k of this.keyHitAreas) {
      if (x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) {
        this.activeKey = k.k;
        // Visual feedback
        return;
      }
    }
    void currentWord;
  }

  protected handlePointerUp(x: number, y: number): void {
    if (!this.gameActive) { this.activeKey = null; return; }
    const pressed = this.activeKey;
    this.activeKey = null;
    if (!pressed) return;
    // Confirm the release is still inside the pressed key
    const hit = this.keyHitAreas.find(
      k =>
        x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h &&
        sameKey(k.k, pressed),
    );
    if (!hit) return;
    if (pressed.kind === 'letter') this.tryApplyLetter(pressed.ch);
    else if (pressed.kind === 'back') this.undoStep();
    else if (pressed.kind === 'undo') this.undoStep();
  }

  private tryApplyLetter(ch: string): void {
    if (!this.gameActive) return;
    const current = this.ladder[this.ladder.length - 1];
    if (current[this.selectedSlot] === ch) {
      this.flashError();
      return;
    }
    const candidate =
      current.slice(0, this.selectedSlot) + ch + current.slice(this.selectedSlot + 1);
    if (!isValidWord(candidate)) {
      this.flashError();
      return;
    }
    // Reject repeat words (standard Word Ladder rule)
    if (this.ladder.includes(candidate)) {
      this.flashError();
      return;
    }
    this.ladder.push(candidate);
    this.playSound('tap');
    this.haptic('light');
    // Auto-advance slot to next mismatch with goal
    this.selectedSlot = this.firstMismatchWithGoal(candidate);
    if (candidate === this.level.end) this.handleWin();
    this.onUpdate({ steps: this.ladder.length - 1 });
  }

  private undoStep(): void {
    if (this.ladder.length <= 1) {
      this.flashError();
      return;
    }
    this.ladder.pop();
    this.playSound('tap');
    this.selectedSlot = this.firstMismatchWithGoal(this.ladder[this.ladder.length - 1]);
  }

  private flashError(): void {
    this.shakeTimer = ERROR_SHAKE_MS / 1000;
    this.playSound('error');
    this.haptic('medium');
  }

  private handleWin(): void {
    this.winScheduled = true;
    this.gameActive = false;
    const steps = this.ladder.length - 1;
    const par = this.level.minSteps;
    const bonus = Math.max(0, (par + 2 - steps)) * 100;
    this.setScore(Math.max(200, 800 + bonus));
    this.gameWin();
    setTimeout(() => this.gameOver(), WIN_DELAY_MS);
  }

  // ── Reveal (for game-over display) ────────────────────────

  getRevealMessage(): string | null {
    if (this.winScheduled) return null;
    return `${this.level.start.toUpperCase()} → ${this.level.end.toUpperCase()} in ${this.level.minSteps} steps`;
  }

  // ── HUD ───────────────────────────────────────────────────

  getHudStats(): Array<{ label: string; value: string }> {
    return [
      { label: 'Steps', value: `${this.ladder.length - 1}` },
      { label: 'Par', value: `${this.level.minSteps}` },
    ];
  }

  // ── Update / Render ───────────────────────────────────────

  update(dt: number): void {
    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
  }

  render(): void {
    this.clear(BG);
    this.renderHeader();
    this.renderLadder();
    this.renderCurrentWord();
    this.renderKeyboard();
  }

  private renderHeader(): void {
    const y = TOP_HUD + HEADER_H / 2;
    const leftX = this.width * 0.22;
    const rightX = this.width * 0.78;
    // START pill
    this.drawPill(leftX, y, this.level.start.toUpperCase(), START_COLOR);
    // Arrow
    this.drawText('→', this.width / 2, y, {
      size: 22, color: TILE_TEXT, weight: '700',
    });
    // GOAL pill
    this.drawPill(rightX, y, this.level.end.toUpperCase(), GOAL_COLOR);
  }

  private drawPill(cx: number, cy: number, text: string, color: string): void {
    const padX = 10;
    const height = 32;
    this.ctx.font = `700 15px 'Inter', system-ui, sans-serif`;
    const width = this.ctx.measureText(text).width + padX * 2;
    this.drawRoundRect(cx - width / 2, cy - height / 2, width, height, height / 2, color);
    this.drawText(text, cx, cy, {
      size: 15, color: '#FFFFFF', weight: '700',
    });
  }

  private renderLadder(): void {
    // Show the last ~(N) steps above the current word. Tight vertical stack.
    const rowH = Math.max(22, Math.min(30, Math.floor(this.tileSize * 0.55)));
    const maxRows = Math.max(1, Math.floor((this.currentY - this.ladderTopY - 8) / rowH));
    const history = this.ladder.slice(0, -1);
    const visible = history.slice(-maxRows);
    const startY = this.currentY - 8 - rowH * visible.length;
    for (let r = 0; r < visible.length; r++) {
      const word = visible[r];
      const y = startY + r * rowH;
      // Centered small tiles (no per-letter tiles — just text for compactness)
      this.ctx.font = `700 ${Math.floor(rowH * 0.72)}px 'Inter', system-ui, sans-serif`;
      const letterSpacing = this.tileSize * 0.25;
      const totalW = this.wordLen * this.tileSize * 0.5;
      const x0 = this.ladderX + (this.tileSize * this.wordLen + this.tileGap * (this.wordLen - 1)) / 2 - totalW / 2;
      for (let i = 0; i < this.wordLen; i++) {
        this.drawText(
          word[i].toUpperCase(),
          x0 + (i + 0.5) * (totalW / this.wordLen),
          y + rowH / 2,
          { size: Math.floor(rowH * 0.72), color: '#8B7B83', weight: '600' },
        );
      }
      void letterSpacing;
    }
  }

  private renderCurrentWord(): void {
    const current = this.ladder[this.ladder.length - 1];
    const shakeOffset = this.shakeTimer > 0
      ? Math.sin((this.shakeTimer / (ERROR_SHAKE_MS / 1000)) * Math.PI * 8) * 6
      : 0;
    for (let i = 0; i < this.wordLen; i++) {
      const x = this.ladderX + i * (this.tileSize + this.tileGap) + shakeOffset;
      const y = this.currentY;
      const selected = i === this.selectedSlot;
      this.drawRoundRect(x, y, this.tileSize, this.tileSize, 6,
        TILE_CURRENT_BG,
        selected ? TILE_SELECTED_BORDER : TILE_CURRENT_BORDER);
      if (selected) {
        // Thicker border
        this.ctx.strokeStyle = TILE_SELECTED_BORDER;
        this.ctx.lineWidth = 2.5;
        this.ctx.strokeRect(x + 1, y + 1, this.tileSize - 2, this.tileSize - 2);
      }
      this.drawText(
        current[i].toUpperCase(),
        x + this.tileSize / 2,
        y + this.tileSize / 2,
        { size: Math.floor(this.tileSize * 0.55), color: TILE_TEXT, weight: '800' },
      );
    }
  }

  private renderKeyboard(): void {
    for (const k of this.keyHitAreas) {
      const active = this.activeKey !== null && sameKey(this.activeKey, k.k);
      const isSpecial = k.k.kind !== 'letter';
      const bg = active
        ? KEY_ACTIVE_BG
        : (isSpecial ? KEY_SPECIAL_BG : KEY_BG);
      this.drawRoundRect(k.x, k.y, k.w, k.h, 6, bg);
      const label =
        k.k.kind === 'back' ? '⌫'
        : k.k.kind === 'undo' ? '↶'
        : k.k.ch.toUpperCase();
      this.drawText(
        label,
        k.x + k.w / 2,
        k.y + k.h / 2,
        {
          size: Math.floor(k.h * 0.44),
          color: isSpecial ? KEY_SPECIAL_TEXT : KEY_TEXT,
          weight: '700',
        },
      );
    }
  }

  // ── Save / Resume ─────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      start: this.level.start,
      end: this.level.end,
      minSteps: this.level.minSteps,
      ladder: this.ladder.slice(),
      selectedSlot: this.selectedSlot,
      gameActive: this.gameActive,
    };
  }

  deserialize(state: GameSnapshot): void {
    const start = state.start as string | undefined;
    const end = state.end as string | undefined;
    const ladder = state.ladder as string[] | undefined;
    if (
      typeof start !== 'string' || typeof end !== 'string' ||
      !Array.isArray(ladder) || ladder.length === 0 ||
      ladder[0] !== start
    ) return;
    this.level = {
      start,
      end,
      minSteps: (state.minSteps as number | undefined) ?? ladder.length - 1,
    };
    this.wordLen = start.length;
    this.ladder = ladder.slice();
    this.selectedSlot = Math.min(
      Math.max(0, (state.selectedSlot as number | undefined) ?? 0),
      this.wordLen - 1,
    );
    this.gameActive = (state.gameActive as boolean | undefined) ?? true;
    this.winScheduled = false;
    this.computeLayout();
  }

  canSave(): boolean {
    return this.gameActive && this.shakeTimer === 0;
  }

  // ── Test hooks ────────────────────────────────────────────
  testTypeLetter(ch: string): void {
    this.tryApplyLetter(ch.toLowerCase());
  }
  testUndo(): void {
    this.undoStep();
  }
  testSelectSlot(i: number): void {
    if (i >= 0 && i < this.wordLen) this.selectedSlot = i;
  }
}

function sameKey(a: Key, b: Key): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'letter' && b.kind === 'letter') return a.ch === b.ch;
  return true;
}

registerGame({
  id: 'word-ladder',
  name: 'Word Ladder',
  description: 'Change one letter at a time to reach the goal word',
  icon: 'WL',
  color: '--color-primary',
  bgGradient: ['#8DC5A2', '#BBD9C6'],
  category: 'puzzle',
  createGame: (config) => new WordLadderGame(config),
  canvasWidth: 360,
  canvasHeight: 640,
  controls: 'Tap a letter to select; type a new letter to change it',
  dailyMode: true,
});

export { WordLadderGame };
