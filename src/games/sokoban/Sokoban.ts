import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';
import {
  SokobanLevel, Box, Tile, Direction, DIR_VECTORS,
  tileAt, boxAt,
} from './types';
import { generate, SokobanBucket } from './generator';

const BUCKETS: SokobanBucket[] = ['easy', 'medium', 'hard', 'expert'];

// ── Layout ─────────────────────────────────────────────────
const TOP_HUD = 72;
const BOTTOM_PAD = 40;
const SIDE_PAD = 16;

// ── Visuals ────────────────────────────────────────────────
const BG = '#FEF0E4';
const FLOOR_COLOR = '#EADBC7';
const FLOOR_ALT = '#E0CEB6';
const WALL_COLOR = '#5A4048';
const WALL_HIGHLIGHT = '#7B5A66';
const TARGET_COLOR = '#D14E5C';
const BOX_COLOR = '#A0693D';
const BOX_STRAP = '#703B1E';
const BOX_ON_TARGET = '#8DC5A2';
const BOX_ON_TARGET_STRAP = '#4E8A63';
const PLAYER_COLOR = '#8B5E83';
const PLAYER_HIGHLIGHT = '#B88EB0';

const WIN_DELAY_MS = 1500;
const MOVE_ANIM_DURATION = 0.09; // seconds per step

type AnimState = {
  playerFrom: { col: number; row: number };
  playerTo: { col: number; row: number };
  boxMoves: Array<{ idx: number; from: { col: number; row: number }; to: { col: number; row: number } }>;
  elapsed: number;
  duration: number;
};

class SokobanGame extends GameEngine {
  private level!: SokobanLevel;
  private activeLevel: SokobanLevel | null = null;
  private activeTier = 0;
  private boxes: Box[] = [];
  private playerCol = 0;
  private playerRow = 0;
  private moves = 0;
  private anim: AnimState | null = null;
  private queuedDir: Direction | null = null;

  // Layout
  private tileSize = 30;
  private gridX = 0;
  private gridY = 0;

  // Swipe
  private swipeStart: { x: number; y: number } | null = null;

  // Lifecycle
  private gameActive = false;
  private winScheduled = false;

  constructor(config: GameConfig) {
    super(config);
  }

  init(): void {
    const d = Math.max(0, Math.min(3, this.difficulty));
    this.activeTier = d;
    if (this.activeLevel) {
      this.level = this.activeLevel;
    } else {
      const seed = this.seed ?? Math.floor(Math.random() * 2_147_483_647);
      this.level = generate(seed, BUCKETS[d]);
      this.activeLevel = this.level;
    }
    this.boxes = this.level.boxes.map(b => ({ ...b }));
    this.playerCol = this.level.player.col;
    this.playerRow = this.level.player.row;
    this.moves = 0;
    this.anim = null;
    this.queuedDir = null;
    this.gameActive = true;
    this.winScheduled = false;
    this.swipeStart = null;
    this.computeLayout();
    this.setScore(0);
  }

  private computeLayout(): void {
    const availW = Math.max(this.width - SIDE_PAD * 2, 1);
    const availH = Math.max(this.height - TOP_HUD - BOTTOM_PAD, 1);
    const tileByW = Math.floor(availW / this.level.cols);
    const tileByH = Math.floor(availH / this.level.rows);
    this.tileSize = Math.max(16, Math.min(56, Math.min(tileByW, tileByH)));
    const gridW = this.tileSize * this.level.cols;
    const gridH = this.tileSize * this.level.rows;
    this.gridX = Math.floor((this.width - gridW) / 2);
    this.gridY = Math.floor(TOP_HUD + (availH - gridH) / 2);
  }

  // ── Input ─────────────────────────────────────────────────

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (!this.gameActive) return;
    let dir: Direction | null = null;
    switch (key) {
      case 'ArrowUp': case 'w': case 'W': dir = 'up'; break;
      case 'ArrowDown': case 's': case 'S': dir = 'down'; break;
      case 'ArrowLeft': case 'a': case 'A': dir = 'left'; break;
      case 'ArrowRight': case 'd': case 'D': dir = 'right'; break;
    }
    if (dir) {
      e.preventDefault();
      this.tryMove(dir);
    }
  }

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;
    this.swipeStart = { x, y };
  }

  protected handlePointerUp(x: number, y: number): void {
    if (!this.gameActive || !this.swipeStart) { this.swipeStart = null; return; }
    const dx = x - this.swipeStart.x;
    const dy = y - this.swipeStart.y;
    this.swipeStart = null;
    const dist = Math.hypot(dx, dy);
    if (dist < 15) {
      // Tap: direction relative to player
      const pc = this.cellCenter(this.playerCol, this.playerRow);
      const tdx = x - pc.x;
      const tdy = y - pc.y;
      if (Math.abs(tdx) < 4 && Math.abs(tdy) < 4) return;
      const dir: Direction = Math.abs(tdx) > Math.abs(tdy)
        ? (tdx > 0 ? 'right' : 'left')
        : (tdy > 0 ? 'down' : 'up');
      this.tryMove(dir);
    } else {
      const dir: Direction = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up');
      this.tryMove(dir);
    }
  }

  private tryMove(dir: Direction): void {
    if (this.anim) {
      // Queue one move ahead — keeps input responsive without chaining chaos.
      this.queuedDir = dir;
      return;
    }
    this.attemptMove(dir);
  }

  private attemptMove(dir: Direction): void {
    const { dc, dr } = DIR_VECTORS[dir];
    const nc = this.playerCol + dc;
    const nr = this.playerRow + dr;
    const next = tileAt(this.level, nc, nr);
    if (next === Tile.Empty || next === Tile.Wall) return;

    const bIdx = boxAt(this.boxes, nc, nr);
    if (bIdx >= 0) {
      // There's a box. Check what's beyond.
      const bc = nc + dc;
      const br = nr + dr;
      const beyond = tileAt(this.level, bc, br);
      if (beyond === Tile.Empty || beyond === Tile.Wall) return; // wall blocks push
      if (boxAt(this.boxes, bc, br) >= 0) return;                 // another box blocks push

      // Push: schedule animation
      this.anim = {
        playerFrom: { col: this.playerCol, row: this.playerRow },
        playerTo: { col: nc, row: nr },
        boxMoves: [{ idx: bIdx, from: { col: nc, row: nr }, to: { col: bc, row: br } }],
        elapsed: 0,
        duration: MOVE_ANIM_DURATION,
      };
    } else {
      // Walk
      this.anim = {
        playerFrom: { col: this.playerCol, row: this.playerRow },
        playerTo: { col: nc, row: nr },
        boxMoves: [],
        elapsed: 0,
        duration: MOVE_ANIM_DURATION,
      };
    }
    this.moves++;
    this.onUpdate({ moves: this.moves });
    this.playSound('tap');
  }

  private commitAnim(): void {
    if (!this.anim) return;
    this.playerCol = this.anim.playerTo.col;
    this.playerRow = this.anim.playerTo.row;
    for (const m of this.anim.boxMoves) {
      this.boxes[m.idx].col = m.to.col;
      this.boxes[m.idx].row = m.to.row;
    }
    this.anim = null;
    this.haptic('light');

    if (this.isSolved() && !this.winScheduled) {
      this.handleSolved();
      return;
    }

    if (this.queuedDir) {
      const next = this.queuedDir;
      this.queuedDir = null;
      this.attemptMove(next);
    }
  }

  private isSolved(): boolean {
    for (const b of this.boxes) {
      if (tileAt(this.level, b.col, b.row) !== Tile.Target) return false;
    }
    return true;
  }

  private boxesOnTarget(): number {
    let n = 0;
    for (const b of this.boxes) {
      if (tileAt(this.level, b.col, b.row) === Tile.Target) n++;
    }
    return n;
  }

  private handleSolved(): void {
    this.winScheduled = true;
    this.gameActive = false;
    // Scaled score: base by tier + complexity, minus 5 per excess move
    // beyond a forgiving par (12 * box count).
    const par = this.boxes.length * 12;
    const excess = Math.max(0, this.moves - par);
    const tierBonus = this.activeTier * 400;
    const boxBonus = this.boxes.length * 200;
    const final = Math.max(150, Math.round(500 + tierBonus + boxBonus - excess * 5));
    this.setScore(final);
    this.gameWin();
    setTimeout(() => this.gameOver(), WIN_DELAY_MS);
  }

  // ── Update / Render ───────────────────────────────────────

  update(dt: number): void {
    if (this.anim) {
      this.anim.elapsed += dt;
      if (this.anim.elapsed >= this.anim.duration) this.commitAnim();
    }
  }

  getHudStats(): Array<{ label: string; value: string }> {
    const total = this.boxes.length;
    return [
      { label: 'Boxes', value: `${this.boxesOnTarget()}/${total}` },
      { label: 'Moves', value: `${this.moves}` },
    ];
  }

  render(): void {
    this.clear(BG);
    this.renderTiles();
    this.renderBoxes();
    this.renderPlayer();
  }

  private renderTiles(): void {
    const s = this.tileSize;
    for (let r = 0; r < this.level.rows; r++) {
      for (let c = 0; c < this.level.cols; c++) {
        const t = tileAt(this.level, c, r);
        const x = this.gridX + c * s;
        const y = this.gridY + r * s;
        if (t === Tile.Empty) continue;
        if (t === Tile.Wall) {
          this.ctx.fillStyle = WALL_COLOR;
          this.ctx.fillRect(x, y, s, s);
          // Highlight top face for pseudo-depth
          this.ctx.fillStyle = WALL_HIGHLIGHT;
          this.ctx.fillRect(x + 2, y + 2, s - 4, Math.max(3, s * 0.22));
          continue;
        }
        // Floor or Target: alternate shade for checker feel
        const alt = ((c + r) & 1) === 0;
        this.ctx.fillStyle = alt ? FLOOR_COLOR : FLOOR_ALT;
        this.ctx.fillRect(x, y, s, s);
        if (t === Tile.Target) {
          // Small bullseye dot
          this.drawCircle(x + s / 2, y + s / 2, s * 0.16, TARGET_COLOR);
          this.drawCircle(x + s / 2, y + s / 2, s * 0.08, BG);
        }
      }
    }
  }

  private renderBoxes(): void {
    const s = this.tileSize;
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      // Interpolate if this box is part of the active animation
      let col = b.col;
      let row = b.row;
      if (this.anim) {
        const m = this.anim.boxMoves.find(m => m.idx === i);
        if (m) {
          const t = this.anim.elapsed / Math.max(this.anim.duration, 0.001);
          const e = Math.min(1, t);
          col = m.from.col + (m.to.col - m.from.col) * e;
          row = m.from.row + (m.to.row - m.from.row) * e;
        }
      }
      const x = this.gridX + col * s + s * 0.1;
      const y = this.gridY + row * s + s * 0.1;
      const w = s * 0.8;
      const onTarget = tileAt(this.level, Math.round(col), Math.round(row)) === Tile.Target;
      const body = onTarget ? BOX_ON_TARGET : BOX_COLOR;
      const strap = onTarget ? BOX_ON_TARGET_STRAP : BOX_STRAP;
      this.drawRoundRect(x, y, w, w, Math.max(2, s * 0.08), body);
      // Cross-strap lines
      this.ctx.fillStyle = strap;
      this.ctx.fillRect(x, y + w * 0.45, w, w * 0.1);
      this.ctx.fillRect(x + w * 0.45, y, w * 0.1, w);
      // Inset highlight
      this.drawRoundRect(
        x + w * 0.08, y + w * 0.08, w * 0.84, w * 0.18,
        Math.max(2, s * 0.06),
        'rgba(255,255,255,0.14)',
      );
    }
  }

  private renderPlayer(): void {
    const s = this.tileSize;
    let col = this.playerCol;
    let row = this.playerRow;
    if (this.anim) {
      const t = this.anim.elapsed / Math.max(this.anim.duration, 0.001);
      const e = Math.min(1, t);
      col = this.anim.playerFrom.col + (this.anim.playerTo.col - this.anim.playerFrom.col) * e;
      row = this.anim.playerFrom.row + (this.anim.playerTo.row - this.anim.playerFrom.row) * e;
    }
    const cx = this.gridX + col * s + s / 2;
    const cy = this.gridY + row * s + s / 2;
    const r = s * 0.32;
    // Shadow
    this.drawCircle(cx + 1, cy + 3, r, 'rgba(61,43,53,0.3)');
    // Body
    this.drawCircle(cx, cy, r, PLAYER_COLOR);
    this.drawCircle(cx - r * 0.3, cy - r * 0.4, r * 0.35, PLAYER_HIGHLIGHT);
    // Eyes
    this.drawCircle(cx - r * 0.3, cy, r * 0.12, '#FFFFFF');
    this.drawCircle(cx + r * 0.3, cy, r * 0.12, '#FFFFFF');
    this.drawCircle(cx - r * 0.3, cy, r * 0.05, '#3D2B35');
    this.drawCircle(cx + r * 0.3, cy, r * 0.05, '#3D2B35');
  }

  private cellCenter(col: number, row: number): { x: number; y: number } {
    const s = this.tileSize;
    return {
      x: this.gridX + col * s + s / 2,
      y: this.gridY + row * s + s / 2,
    };
  }

  // ── Save / Resume ─────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      tier: this.activeTier,
      cols: this.level.cols,
      rows: this.level.rows,
      tiles: Array.from(this.level.tiles),
      initialPlayer: { col: this.level.player.col, row: this.level.player.row },
      initialBoxes: this.level.boxes.map(b => ({ col: b.col, row: b.row })),
      playerCol: this.playerCol,
      playerRow: this.playerRow,
      boxes: this.boxes.map(b => ({ col: b.col, row: b.row })),
      moves: this.moves,
      gameActive: this.gameActive,
    };
  }

  deserialize(state: GameSnapshot): void {
    const tier = state.tier as number | undefined;
    const cols = state.cols as number | undefined;
    const rows = state.rows as number | undefined;
    const tilesArr = state.tiles as number[] | undefined;
    const initialPlayer = state.initialPlayer as { col: number; row: number } | undefined;
    const initialBoxes = state.initialBoxes as Box[] | undefined;
    const boxes = state.boxes as Box[] | undefined;
    if (
      typeof tier !== 'number' || typeof cols !== 'number' || typeof rows !== 'number' ||
      !Array.isArray(tilesArr) || tilesArr.length !== cols * rows ||
      !initialPlayer || !Array.isArray(initialBoxes) || !Array.isArray(boxes)
    ) return;
    this.level = {
      cols, rows,
      tiles: new Uint8Array(tilesArr),
      player: { col: initialPlayer.col, row: initialPlayer.row },
      boxes: initialBoxes.map(b => ({ col: b.col, row: b.row })),
    };
    this.activeLevel = this.level;
    this.activeTier = tier;
    this.boxes = boxes.map(b => ({ col: b.col, row: b.row }));
    this.playerCol = (state.playerCol as number | undefined) ?? this.level.player.col;
    this.playerRow = (state.playerRow as number | undefined) ?? this.level.player.row;
    this.moves = (state.moves as number | undefined) ?? 0;
    this.gameActive = (state.gameActive as boolean | undefined) ?? true;
    this.anim = null;
    this.queuedDir = null;
    this.winScheduled = false;
    this.computeLayout();
  }

  canSave(): boolean {
    return this.gameActive && !this.anim;
  }

  // ── Test hooks ────────────────────────────────────────────
  testMove(dir: Direction): void {
    if (!this.gameActive || this.anim) return;
    this.attemptMove(dir);
    if (this.anim) this.commitAnim();
  }
}

registerGame({
  id: 'sokoban',
  name: 'Sokoban',
  description: 'Push every box onto its target',
  icon: 'SK',
  color: '--color-primary',
  bgGradient: ['#A0693D', '#D4A574'],
  category: 'puzzle',
  createGame: (config) => new SokobanGame(config),
  canvasWidth: 360,
  canvasHeight: 560,
  controls: 'Swipe or arrow keys to move — push boxes onto the red dots',
  dailyMode: true,
});

export { SokobanGame };
