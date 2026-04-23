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
const BOTTOM_PAD = 48;
const SIDE_PAD = 8;
const TUBE_GAP_X = 6;
const TUBE_GAP_Y = 14;
const TUBE_LIFT_PX = 14; // how much a selected tube visually rises

// ── Visuals ────────────────────────────────────────────────
const BG = '#FEF0E4';
const TUBE_OUTLINE = '#5A4048';
const TUBE_OUTLINE_SELECTED = '#F5A623';
const TUBE_GLASS_TINT = 'rgba(139,94,131,0.08)';
const TUBE_INNER_HIGHLIGHT = 'rgba(255,255,255,0.25)';
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

    // Pick cols / rows to keep tubes readable. Target a tube width in the
    // 28–52 px range depending on how many tubes we need to fit.
    let bestCols = 1;
    let bestRows = n;
    let bestScore = -Infinity;
    for (let c = Math.min(n, 8); c >= 1; c--) {
      const r = Math.ceil(n / c);
      const w = Math.floor((availW - TUBE_GAP_X * (c - 1)) / c);
      const rowH = Math.floor((availH - TUBE_GAP_Y * (r - 1)) / r);
      if (w < 24 || rowH < 90) continue;
      // Score favours taller-over-wider tubes (closer to a real test tube
      // aspect ratio) and larger tube width.
      const aspect = rowH / w;
      const score = aspect * 2 + w / 60 - Math.abs(r - 1) * 0.2;
      if (score > bestScore) { bestScore = score; bestCols = c; bestRows = r; }
    }
    const cols = bestCols;
    const rows = bestRows;
    this.cols = cols;
    this.rows = rows;

    // Tube dimensions: cap width so tubes stay slender, clamp height so all
    // rows fit. segmentH is derived from the final tubeH.
    const maxTubeW = Math.floor((availW - TUBE_GAP_X * (cols - 1)) / cols);
    this.tubeW = Math.max(24, Math.min(52, maxTubeW));
    const rowH = Math.floor((availH - TUBE_GAP_Y * (rows - 1)) / rows);
    // Reserve a bit of extra space above for the arrow indicator when lifted.
    this.tubeH = Math.max(90, Math.min(rowH - 18, this.tubeW * 3.4));
    // Liquid area is the tube minus the rim on top (8px) and the rounded
    // bottom (tubeW/2 for a hemisphere). Cap the segment height so the
    // liquid doesn't overflow the tube visually.
    const rimH = 6;
    const bottomRadius = this.tubeW / 2;
    const liquidArea = this.tubeH - rimH - bottomRadius;
    this.segmentH = Math.max(14, Math.floor(liquidArea / this.level.capacity));

    // Compute grid origin
    const totalW = cols * this.tubeW + (cols - 1) * TUBE_GAP_X;
    const totalH = rows * this.tubeH + (rows - 1) * TUBE_GAP_Y;
    const gridX = Math.floor((this.width - totalW) / 2);
    const gridTopY = TOP_HUD + Math.floor((availH - totalH) / 2) + 18; // +18 for arrow headroom
    this.tubeBaseY = gridTopY + rows * this.tubeH + (rows - 1) * TUBE_GAP_Y;

    // Compute x positions (layout is a uniform grid; last row may not fill).
    this.tubeXs = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const tubesInThisRow = Math.min(cols, n - row * cols);
      const rowWidth = tubesInThisRow * this.tubeW + (tubesInThisRow - 1) * TUBE_GAP_X;
      const rowStartX = Math.floor((this.width - rowWidth) / 2);
      const x = rowStartX + col * (this.tubeW + TUBE_GAP_X);
      this.tubeXs.push(x);
      void gridX;
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
      const top = this.tubeBaseY - this.tubeH - (this.rows - 1 - row) * (this.tubeH + TUBE_GAP_Y);
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
    const top = this.tubeBaseY - this.tubeH - (this.rows - 1 - row) * (this.tubeH + TUBE_GAP_Y);
    const left = this.tubeXs[i];
    const selected = i === this.selectedTubeIdx;
    const lift = selected ? TUBE_LIFT_PX : 0;
    const y0 = top - lift;
    const w = this.tubeW;
    const h = this.tubeH;
    const bottomR = w / 2;
    const wallT = Math.max(2, Math.round(w * 0.06)); // wall thickness
    const rimH = 6;

    // Soft shadow beneath the tube — an ellipse at the bottom, the way a
    // real test tube resting on something would cast one.
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(61,43,53,0.12)';
    this.ctx.beginPath();
    this.ctx.ellipse(
      left + w / 2, y0 + h + 4,
      w * 0.46, w * 0.12, 0, 0, Math.PI * 2,
    );
    this.ctx.fill();
    this.ctx.restore();

    // ── Build the tube's inner cavity path once — used for clipping the
    // liquid and for drawing the glass. Coordinates are the INSIDE of the
    // tube (leaves `wallT` of glass around the liquid).
    const innerX = left + wallT;
    const innerY = y0 + rimH;
    const innerW = w - wallT * 2;
    const innerBottomY = y0 + h;
    const innerBottomR = innerW / 2;
    const buildInnerPath = () => {
      this.ctx.beginPath();
      this.ctx.moveTo(innerX, innerY);
      this.ctx.lineTo(innerX, innerBottomY - innerBottomR);
      this.ctx.arc(
        innerX + innerBottomR, innerBottomY - innerBottomR,
        innerBottomR, Math.PI, 0, true, // sweep clockwise to form the U
      );
      this.ctx.lineTo(innerX + innerW, innerY);
      this.ctx.closePath();
    };

    // ── Glass background: very light tint inside the tube outline so empty
    // tubes still read as glass, not as a gap in the scene.
    this.ctx.save();
    buildInnerPath();
    this.ctx.fillStyle = TUBE_GLASS_TINT;
    this.ctx.fill();
    this.ctx.restore();

    // ── Liquid: clip to inner cavity, then draw filled bands from the
    // bottom up. Use the SAME cavity path so the liquid conforms to the
    // rounded bottom.
    if (tube.contents.length > 0) {
      this.ctx.save();
      buildInnerPath();
      this.ctx.clip();
      const liquidBottomY = innerBottomY - 1; // keep 1px gap from the glass
      for (let s = 0; s < tube.contents.length; s++) {
        const color = PALETTE[tube.contents[s] % PALETTE.length];
        const segBottom = liquidBottomY - s * this.segmentH;
        const segTop = segBottom - this.segmentH;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(innerX - 1, segTop, innerW + 2, this.segmentH + 1);
        // Bright highlight stripe at the top of each unit — visible seam
        // even when two adjacent units share the same colour.
        this.ctx.fillStyle = 'rgba(255,255,255,0.22)';
        this.ctx.fillRect(innerX - 1, segTop, innerW + 2, Math.max(2, this.segmentH * 0.18));
        // Dark divider line between adjacent units (except at the very
        // bottom where the glass already bounds the liquid). This keeps
        // boundaries crisp regardless of colour similarity.
        if (s > 0) {
          this.ctx.fillStyle = 'rgba(0,0,0,0.28)';
          this.ctx.fillRect(innerX - 1, segBottom, innerW + 2, 1);
        }
      }
      this.ctx.restore();
    }

    // ── Glass highlight on the left side of the tube (vertical stripe).
    this.ctx.save();
    buildInnerPath();
    this.ctx.clip();
    this.ctx.fillStyle = TUBE_INNER_HIGHLIGHT;
    this.ctx.fillRect(innerX + 2, innerY + 2, Math.max(2, innerW * 0.18), h - rimH - 8);
    this.ctx.restore();

    // ── Outer glass outline: walk the outer tube shape (open at the top,
    // U-shaped bottom) as a single stroke. Slight flare at the lip.
    this.ctx.save();
    this.ctx.strokeStyle = selected ? TUBE_OUTLINE_SELECTED : TUBE_OUTLINE;
    this.ctx.lineWidth = wallT;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    // Left lip: slight outward flare
    this.ctx.moveTo(left - 2, y0 + 1);
    this.ctx.lineTo(left, y0 + rimH);
    this.ctx.lineTo(left, y0 + h - bottomR);
    this.ctx.arc(left + bottomR, y0 + h - bottomR, bottomR, Math.PI, 0, true);
    this.ctx.lineTo(left + w, y0 + rimH);
    this.ctx.lineTo(left + w + 2, y0 + 1);
    this.ctx.stroke();
    this.ctx.restore();

    // ── Rim (thin dark band across the top opening). Two short tick-marks
    // at each lip make the tube "open" at the top rather than closed.
    this.ctx.save();
    this.ctx.strokeStyle = selected ? TUBE_OUTLINE_SELECTED : TUBE_OUTLINE;
    this.ctx.lineWidth = Math.max(1, wallT * 0.6);
    this.ctx.beginPath();
    this.ctx.moveTo(left - 1, y0 + rimH);
    this.ctx.lineTo(left + w + 1, y0 + rimH);
    this.ctx.stroke();
    this.ctx.restore();

    // ── Selection indicator: gold arrow above the lifted tube.
    if (selected) {
      const arrowY = y0 - 6;
      const cx = left + w / 2;
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
    const top = this.tubeBaseY - this.tubeH - (this.rows - 1 - row) * (this.tubeH + TUBE_GAP_Y);
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
