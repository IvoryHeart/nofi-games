import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';
import {
  WaterSortLevel, Tube, PALETTE,
  canPour, pour, isLevelSolved, cloneLevel, topColor,
} from './types';
import { generate, WaterSortBucket } from './generator';

const BUCKETS: WaterSortBucket[] = ['easy', 'medium', 'hard', 'expert'];

// ── Layout ─────────────────────────────────────────────────
const TOP_HUD = 72;
const BOTTOM_PAD = 60;
const SIDE_PAD = 12;
const TUBE_GAP = 10;
const TUBE_LIFT_PX = 16; // how much a selected tube visually rises

// ── Visuals ────────────────────────────────────────────────
const BG = '#FEF0E4';
const TUBE_GLASS = 'rgba(139,94,131,0.20)';
const TUBE_OUTLINE = '#8B5E83';
const TUBE_RIM = '#3D2B35';
const HIGHLIGHT_RING = '#F5A623';
const WIN_DELAY_MS = 1500;

class WaterSortGame extends GameEngine {
  private level!: WaterSortLevel;
  /** Cached initial state so Restart returns to the starting puzzle. */
  private initialLevel: WaterSortLevel | null = null;
  private activeDifficulty = 0;

  // UI state
  private selectedTubeIdx = -1;
  private moves = 0;
  private gameActive = false;
  private winScheduled = false;

  // Layout
  private tubeW = 48;
  private tubeH = 160;
  private segmentH = 36;
  private tubeBaseY = 0;
  private tubeXs: number[] = [];
  private cols = 0;
  private rows = 0;

  constructor(config: GameConfig) {
    super(config);
  }

  init(): void {
    const d = Math.max(0, Math.min(3, this.difficulty));
    this.activeDifficulty = d;
    const bucket = BUCKETS[d];
    if (this.initialLevel) {
      this.level = cloneLevel(this.initialLevel);
    } else {
      const seed = this.seed ?? Math.floor(Math.random() * 2_147_483_647);
      const lvl = generate(seed, bucket);
      this.level = lvl;
      this.initialLevel = cloneLevel(lvl);
    }
    this.selectedTubeIdx = -1;
    this.moves = 0;
    this.gameActive = true;
    this.winScheduled = false;
    this.computeLayout();
    this.setScore(0);
  }

  private computeLayout(): void {
    const n = this.level.tubes.length;
    const availW = Math.max(this.width - SIDE_PAD * 2, 1);
    const availH = Math.max(this.height - TOP_HUD - BOTTOM_PAD, 1);
    // Pick a grid layout: prefer a single row, fall back to two.
    let cols = Math.min(n, Math.floor((availW + TUBE_GAP) / 56));
    if (cols <= 0) cols = 1;
    let rows = Math.ceil(n / cols);
    // If tubes would be too tall, wrap to two rows
    if (rows === 1 && n > 6) {
      cols = Math.ceil(n / 2);
      rows = 2;
    }
    this.cols = cols;
    this.rows = rows;

    // Tube dimensions
    const maxTubeW = Math.floor((availW - TUBE_GAP * (cols - 1)) / cols);
    this.tubeW = Math.max(30, Math.min(60, maxTubeW));
    // Tube height sized to fit capacity segments
    const rowH = Math.floor(availH / rows) - TUBE_GAP;
    this.tubeH = Math.max(120, Math.min(rowH, this.tubeW * 3.5));
    this.segmentH = Math.floor((this.tubeH - 14) / this.level.capacity);
    this.tubeH = this.segmentH * this.level.capacity + 14;

    this.tubeBaseY = TOP_HUD + Math.floor((availH - (this.tubeH * rows + TUBE_GAP * (rows - 1))) / 2) + this.tubeH;

    // Compute centered x positions for each tube
    this.tubeXs = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const tubesInThisRow = Math.min(cols, n - row * cols);
      const rowWidth = tubesInThisRow * this.tubeW + (tubesInThisRow - 1) * TUBE_GAP;
      const rowStartX = Math.floor((this.width - rowWidth) / 2);
      const x = rowStartX + col * (this.tubeW + TUBE_GAP);
      this.tubeXs.push(x);
    }
  }

  // ── Input ─────────────────────────────────────────────────

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;
    const hit = this.tubeAt(x, y);
    if (hit < 0) {
      // Tap outside tubes: deselect
      this.selectedTubeIdx = -1;
      return;
    }
    if (this.selectedTubeIdx === -1) {
      // Selecting source. Only allow non-empty tubes as source.
      if (this.level.tubes[hit].contents.length === 0) return;
      this.selectedTubeIdx = hit;
      this.playSound('select');
    } else if (this.selectedTubeIdx === hit) {
      // Tap the selected tube again: deselect
      this.selectedTubeIdx = -1;
    } else {
      // Attempt pour src → dst
      const src = this.level.tubes[this.selectedTubeIdx];
      const dst = this.level.tubes[hit];
      if (canPour(src, dst)) {
        pour(src, dst);
        this.moves++;
        this.onUpdate({ moves: this.moves });
        this.playSound('pop');
        this.haptic('light');
        this.selectedTubeIdx = -1;
        if (isLevelSolved(this.level) && !this.winScheduled) {
          this.handleSolved();
        }
      } else {
        // Invalid pour — switch selection to the tapped tube if it's non-empty
        if (dst.contents.length > 0) {
          this.selectedTubeIdx = hit;
          this.playSound('select');
        } else {
          this.selectedTubeIdx = -1;
          this.playSound('error');
        }
      }
    }
  }

  /** Index of the tube under (x, y), or -1 if none. */
  private tubeAt(x: number, y: number): number {
    for (let i = 0; i < this.level.tubes.length; i++) {
      const row = Math.floor(i / this.cols);
      const top = this.tubeBaseY - this.tubeH - (this.rows - 1 - row) * (this.tubeH + TUBE_GAP);
      const left = this.tubeXs[i];
      const selected = i === this.selectedTubeIdx;
      const lift = selected ? TUBE_LIFT_PX : 0;
      if (
        x >= left && x <= left + this.tubeW &&
        y >= top - lift && y <= top + this.tubeH - lift
      ) return i;
    }
    return -1;
  }

  private handleSolved(): void {
    this.winScheduled = true;
    this.gameActive = false;
    const baseByTier = [700, 1200, 1800, 2500][this.activeDifficulty] ?? 1000;
    // Par rule of thumb: ~2.5 pours per color
    const par = Math.max(4, this.level.numColors * 3);
    const excess = Math.max(0, this.moves - par);
    const final = Math.max(200, baseByTier - excess * 15);
    this.setScore(final);
    this.gameWin();
    setTimeout(() => this.gameOver(), WIN_DELAY_MS);
  }

  // ── Update / Render ───────────────────────────────────────

  update(_dt: number): void { /* no simulation */ }

  getHudStats(): Array<{ label: string; value: string }> {
    const solved = this.level.tubes.filter(t =>
      t.contents.length === 0 ||
      (t.contents.length === t.capacity && new Set(t.contents).size === 1)
    ).length;
    return [
      { label: 'Sorted', value: `${solved}/${this.level.tubes.length}` },
      { label: 'Moves', value: `${this.moves}` },
    ];
  }

  render(): void {
    this.clear(BG);
    for (let i = 0; i < this.level.tubes.length; i++) {
      this.renderTube(i);
    }
  }

  private renderTube(i: number): void {
    const tube = this.level.tubes[i];
    const row = Math.floor(i / this.cols);
    const top = this.tubeBaseY - this.tubeH - (this.rows - 1 - row) * (this.tubeH + TUBE_GAP);
    const left = this.tubeXs[i];
    const selected = i === this.selectedTubeIdx;
    const lift = selected ? TUBE_LIFT_PX : 0;
    const y0 = top - lift;
    const radius = Math.floor(this.tubeW * 0.22);

    // Shadow
    this.drawRoundRect(left + 2, y0 + 4, this.tubeW, this.tubeH, radius, 'rgba(61,43,53,0.12)');

    // Outer glass (semi-transparent fill + outline)
    this.drawRoundRect(left, y0, this.tubeW, this.tubeH, radius, TUBE_GLASS, TUBE_OUTLINE);

    // Rim (dark band across the top opening)
    this.ctx.fillStyle = TUBE_RIM;
    this.ctx.fillRect(left, y0, this.tubeW, 3);

    // Liquid segments — draw from bottom up
    const innerX = left + 3;
    const innerW = this.tubeW - 6;
    const baseY = y0 + this.tubeH - 3; // start just inside the bottom rim
    for (let s = 0; s < tube.contents.length; s++) {
      const color = PALETTE[tube.contents[s] % PALETTE.length];
      const segY = baseY - (s + 1) * this.segmentH;
      this.ctx.fillStyle = color;
      this.ctx.fillRect(innerX, segY, innerW, this.segmentH);
      // Subtle highlight band
      this.ctx.fillStyle = 'rgba(255,255,255,0.10)';
      this.ctx.fillRect(innerX, segY, innerW, Math.max(2, this.segmentH * 0.2));
    }
    // Rounded bottom of the liquid: overdraw a small corner mask using BG —
    // this keeps the liquid visually contained inside the rounded bottom.
    this.ctx.fillStyle = BG;
    this.ctx.fillRect(left, y0 + this.tubeH - radius, radius, radius);
    this.ctx.fillRect(left + this.tubeW - radius, y0 + this.tubeH - radius, radius, radius);
    this.drawRoundRect(
      left, y0, this.tubeW, this.tubeH, radius, 'rgba(0,0,0,0)', TUBE_OUTLINE,
    );

    // Selection highlight ring
    if (selected) {
      this.ctx.save();
      this.ctx.strokeStyle = HIGHLIGHT_RING;
      this.ctx.lineWidth = 2.5;
      this.ctx.setLineDash([5, 3]);
      this.ctx.strokeRect(left - 3, y0 - 3, this.tubeW + 6, this.tubeH + 6);
      this.ctx.restore();
      // Small arrow above to indicate "source"
      const arrowY = y0 - 10;
      const cx = left + this.tubeW / 2;
      this.ctx.fillStyle = HIGHLIGHT_RING;
      this.ctx.beginPath();
      this.ctx.moveTo(cx, arrowY);
      this.ctx.lineTo(cx - 6, arrowY - 8);
      this.ctx.lineTo(cx + 6, arrowY - 8);
      this.ctx.closePath();
      this.ctx.fill();
    }
    void topColor;
  }

  // ── Save / Resume ─────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      difficulty: this.activeDifficulty,
      capacity: this.level.capacity,
      numColors: this.level.numColors,
      tubes: this.level.tubes.map(t => t.contents.slice()),
      initial: this.initialLevel
        ? this.initialLevel.tubes.map(t => t.contents.slice())
        : null,
      moves: this.moves,
      gameActive: this.gameActive,
    };
  }

  deserialize(state: GameSnapshot): void {
    const tubes = state.tubes as number[][] | undefined;
    const capacity = state.capacity as number | undefined;
    const numColors = state.numColors as number | undefined;
    if (!Array.isArray(tubes) || typeof capacity !== 'number' || typeof numColors !== 'number') return;
    this.level = {
      capacity,
      numColors,
      tubes: tubes.map(c => ({ capacity, contents: Array.isArray(c) ? c.slice() : [] })),
    };
    const initial = state.initial as number[][] | null | undefined;
    if (Array.isArray(initial)) {
      this.initialLevel = {
        capacity, numColors,
        tubes: initial.map(c => ({ capacity, contents: Array.isArray(c) ? c.slice() : [] })),
      };
    } else {
      // Fall back to the resumed state as the restart target.
      this.initialLevel = cloneLevel(this.level);
    }
    this.activeDifficulty = (state.difficulty as number | undefined) ?? this.activeDifficulty;
    this.moves = (state.moves as number | undefined) ?? 0;
    this.gameActive = (state.gameActive as boolean | undefined) ?? true;
    this.selectedTubeIdx = -1;
    this.winScheduled = false;
    this.computeLayout();
  }

  canSave(): boolean {
    return this.gameActive;
  }

  // ── Test hooks ────────────────────────────────────────────
  testTapTube(i: number): void {
    // Simulate a pointer-down near the tube's center.
    const row = Math.floor(i / this.cols);
    const top = this.tubeBaseY - this.tubeH - (this.rows - 1 - row) * (this.tubeH + TUBE_GAP);
    const x = this.tubeXs[i] + this.tubeW / 2;
    const y = top + this.tubeH / 2;
    this.handlePointerDown(x, y);
  }
}

registerGame({
  id: 'water-sort',
  name: 'Water Sort',
  description: 'Pour colors between tubes until each tube is one color',
  icon: 'WS',
  color: '--color-primary',
  bgGradient: ['#8DC5A2', '#D14E5C'],
  category: 'puzzle',
  createGame: (config) => new WaterSortGame(config),
  canvasWidth: 360,
  canvasHeight: 560,
  controls: 'Tap a tube to select, tap another to pour — match top colors',
  dailyMode: true,
});

export { WaterSortGame };
