import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';
import { FlowLevel, Endpoint, PALETTE, isAdjacent } from './types';
import { generateDaily, FlowBucket } from './generator';

const BUCKETS: FlowBucket[] = ['easy', 'medium', 'hard', 'expert'];

// ── Layout ──────────────────────────────────────────────────
const TOP_HUD = 72;
const BOTTOM_PAD = 40;
const SIDE_PAD = 16;

// ── Visuals ─────────────────────────────────────────────────
const BG = '#FEF0E4';
const GRID_LINE = '#E8D8C8';
const CELL_BG = '#F5E7D5';
const ENDPOINT_RING = 'rgba(0,0,0,0.12)';

// ── Animation ───────────────────────────────────────────────
const WIN_DELAY_MS = 1500;

type Cell = { col: number; row: number };

class FlowConnectGame extends GameEngine {
  private level!: FlowLevel;
  private numColors = 0;
  /** -1 = empty; otherwise color index. Row-major. */
  private cellOwner: Int8Array = new Int8Array(0);
  /** For each color, the ordered list of cells forming its current path. */
  private paths: Cell[][] = [];

  // Drag state
  private drawing = false;
  private drawingColor = -1;

  // Layout
  private tileSize = 40;
  private gridX = 0;
  private gridY = 0;

  // Game state
  private gameActive = false;
  private winScheduled = false;
  private moves = 0; // number of path commits (for scoring)

  constructor(config: GameConfig) {
    super(config);
  }

  init(): void {
    const d = Math.max(0, Math.min(3, this.difficulty));
    const bucket = BUCKETS[d];
    const seed = this.seed ?? Math.floor(Math.random() * 2_147_483_647);
    this.level = generateDaily(seed, bucket);

    this.numColors = this.level.endpoints.length / 2;
    this.cellOwner = new Int8Array(this.level.cols * this.level.rows).fill(-1);
    this.paths = [];
    for (let c = 0; c < this.numColors; c++) this.paths.push([]);
    // Mark endpoints on the ownership map so they can't be overwritten
    // by another color's drag unless that drag cuts through.
    for (const ep of this.level.endpoints) {
      // Leave cellOwner[-1] until the player draws — endpoints are rendered
      // separately from path fills. But they are visually owned by their color.
    }
    this.drawing = false;
    this.drawingColor = -1;
    this.gameActive = true;
    this.winScheduled = false;
    this.moves = 0;

    this.computeLayout();
    this.setScore(0);
  }

  private computeLayout(): void {
    const availW = Math.max(this.width - SIDE_PAD * 2, 1);
    const availH = Math.max(this.height - TOP_HUD - BOTTOM_PAD, 1);
    const tileByW = Math.floor(availW / this.level.cols);
    const tileByH = Math.floor(availH / this.level.rows);
    this.tileSize = Math.max(20, Math.min(tileByW, tileByH));
    const gridW = this.tileSize * this.level.cols;
    const gridH = this.tileSize * this.level.rows;
    this.gridX = Math.floor((this.width - gridW) / 2);
    this.gridY = Math.floor(TOP_HUD + (availH - gridH) / 2);
  }

  // ── Input ─────────────────────────────────────────────────

  protected handlePointerDown(x: number, y: number): void {
    if (!this.gameActive) return;
    const cell = this.pointToCell(x, y);
    if (!cell) return;
    this.startDrawingAt(cell);
  }

  protected handlePointerMove(x: number, y: number): void {
    if (!this.drawing) return;
    const cell = this.pointToCell(x, y);
    if (!cell) return;
    this.extendDrawTo(cell);
  }

  protected handlePointerUp(_x: number, _y: number): void {
    if (this.drawing) {
      this.drawing = false;
      this.moves++;
      this.onUpdate({ moves: this.moves });
      if (this.isSolved() && !this.winScheduled) this.handleSolved();
    }
  }

  /** Decide which color to start drawing based on the tapped cell. */
  private startDrawingAt(cell: Cell): void {
    // Is this cell an endpoint?
    const ep = this.endpointAt(cell);
    if (ep !== null) {
      const color = ep.color;
      // Clear that color's existing path and start fresh from this endpoint
      this.clearPath(color);
      this.paths[color] = [{ col: ep.col, row: ep.row }];
      this.cellOwner[cell.row * this.level.cols + cell.col] = color;
      this.drawing = true;
      this.drawingColor = color;
      this.playSound('tap');
      return;
    }

    // Is this cell owned by some color's path?
    const owner = this.cellOwner[cell.row * this.level.cols + cell.col];
    if (owner >= 0) {
      // Truncate that color's path to this cell and resume drawing from here
      const path = this.paths[owner];
      const idx = path.findIndex(c => c.col === cell.col && c.row === cell.row);
      if (idx < 0) return;
      // Clear cells beyond this index
      for (let i = idx + 1; i < path.length; i++) {
        const c = path[i];
        this.cellOwner[c.row * this.level.cols + c.col] = -1;
      }
      path.length = idx + 1;
      this.drawing = true;
      this.drawingColor = owner;
      this.playSound('tap');
    }
  }

  private extendDrawTo(cell: Cell): void {
    const path = this.paths[this.drawingColor];
    if (path.length === 0) return;
    const last = path[path.length - 1];
    if (last.col === cell.col && last.row === cell.row) return;

    // If the cell is already in our own path, truncate back to it
    const selfIdx = path.findIndex(c => c.col === cell.col && c.row === cell.row);
    if (selfIdx >= 0) {
      for (let i = selfIdx + 1; i < path.length; i++) {
        const c = path[i];
        this.cellOwner[c.row * this.level.cols + c.col] = -1;
      }
      path.length = selfIdx + 1;
      return;
    }

    // Must be adjacent to the last cell. If not, ignore (drag too fast —
    // player will have to drag more slowly).
    if (!isAdjacent(last, cell)) return;

    // Can't extend onto another color's endpoint that isn't ours
    const ep = this.endpointAt(cell);
    if (ep !== null && ep.color !== this.drawingColor) return;

    // If this cell is owned by another color, truncate that color first.
    const k = cell.row * this.level.cols + cell.col;
    const otherOwner = this.cellOwner[k];
    if (otherOwner >= 0 && otherOwner !== this.drawingColor) {
      const otherPath = this.paths[otherOwner];
      const otherIdx = otherPath.findIndex(c => c.col === cell.col && c.row === cell.row);
      if (otherIdx >= 0) {
        for (let i = otherIdx; i < otherPath.length; i++) {
          const c = otherPath[i];
          // Don't clear if cell is the other color's endpoint — but cells
          // inside a path aren't endpoints by construction, so safe.
          this.cellOwner[c.row * this.level.cols + c.col] = -1;
        }
        otherPath.length = otherIdx;
      }
    }

    // Extend our path
    path.push({ col: cell.col, row: cell.row });
    this.cellOwner[k] = this.drawingColor;
    this.haptic('light');

    // If we just reached our matching endpoint, stop drawing (commit).
    if (ep !== null && ep.color === this.drawingColor) {
      // Path connects to the endpoint — drawing stays active until pointerUp;
      // player can keep going past (which would truncate back) but normally
      // releases here.
    }
  }

  private clearPath(color: number): void {
    const path = this.paths[color];
    for (const cell of path) {
      this.cellOwner[cell.row * this.level.cols + cell.col] = -1;
    }
    path.length = 0;
  }

  private endpointAt(cell: Cell): Endpoint | null {
    for (const ep of this.level.endpoints) {
      if (ep.col === cell.col && ep.row === cell.row) return ep;
    }
    return null;
  }

  private pointToCell(x: number, y: number): Cell | null {
    const col = Math.floor((x - this.gridX) / this.tileSize);
    const row = Math.floor((y - this.gridY) / this.tileSize);
    if (col < 0 || col >= this.level.cols || row < 0 || row >= this.level.rows) return null;
    return { col, row };
  }

  // ── Win check ─────────────────────────────────────────────

  private isSolved(): boolean {
    // All cells must be owned
    for (let i = 0; i < this.cellOwner.length; i++) {
      if (this.cellOwner[i] === -1) return false;
    }
    // Each color's path must start at one endpoint and end at the other
    for (let c = 0; c < this.numColors; c++) {
      const path = this.paths[c];
      if (path.length < 2) return false;
      const first = path[0];
      const last = path[path.length - 1];
      const eps = this.level.endpoints.filter(e => e.color === c);
      if (eps.length !== 2) return false;
      const firstIsEp = eps.some(e => e.col === first.col && e.row === first.row);
      const lastIsEp = eps.some(e => e.col === last.col && e.row === last.row);
      if (!firstIsEp || !lastIsEp) return false;
      if (first.col === last.col && first.row === last.row) return false;
      // Contiguity: every step in the path is adjacent
      for (let i = 1; i < path.length; i++) {
        if (!isAdjacent(path[i - 1], path[i])) return false;
      }
    }
    return true;
  }

  private handleSolved(): void {
    this.winScheduled = true;
    this.gameActive = false;
    // Score: 1000 - 10 per move over par. Par ≈ 2 * numColors (ideal).
    const par = this.numColors * 2;
    const excess = Math.max(0, this.moves - par);
    const final = Math.max(100, 1000 - excess * 20);
    this.setScore(final);
    this.gameWin();
    setTimeout(() => this.gameOver(), WIN_DELAY_MS);
  }

  // ── Update / Render ───────────────────────────────────────

  update(_dt: number): void {
    // No simulation needed
  }

  getHudStats(): Array<{ label: string; value: string }> {
    const connected = this.countConnectedColors();
    return [
      { label: 'Connected', value: `${connected}/${this.numColors}` },
      { label: 'Moves', value: `${this.moves}` },
    ];
  }

  private countConnectedColors(): number {
    let n = 0;
    for (let c = 0; c < this.numColors; c++) {
      const path = this.paths[c];
      if (path.length < 2) continue;
      const first = path[0];
      const last = path[path.length - 1];
      const eps = this.level.endpoints.filter(e => e.color === c);
      const firstIsEp = eps.some(e => e.col === first.col && e.row === first.row);
      const lastIsEp = eps.some(e => e.col === last.col && e.row === last.row);
      if (firstIsEp && lastIsEp && !(first.col === last.col && first.row === last.row)) n++;
    }
    return n;
  }

  render(): void {
    this.clear(BG);
    this.renderGrid();
    this.renderPaths();
    this.renderEndpoints();
  }

  private renderGrid(): void {
    const s = this.tileSize;
    // Cell backgrounds
    for (let r = 0; r < this.level.rows; r++) {
      for (let c = 0; c < this.level.cols; c++) {
        const x = this.gridX + c * s;
        const y = this.gridY + r * s;
        this.ctx.fillStyle = CELL_BG;
        this.ctx.fillRect(x, y, s, s);
      }
    }
    // Grid lines
    this.ctx.strokeStyle = GRID_LINE;
    this.ctx.lineWidth = 1;
    for (let c = 0; c <= this.level.cols; c++) {
      const x = this.gridX + c * s;
      this.ctx.beginPath();
      this.ctx.moveTo(x, this.gridY);
      this.ctx.lineTo(x, this.gridY + this.level.rows * s);
      this.ctx.stroke();
    }
    for (let r = 0; r <= this.level.rows; r++) {
      const y = this.gridY + r * s;
      this.ctx.beginPath();
      this.ctx.moveTo(this.gridX, y);
      this.ctx.lineTo(this.gridX + this.level.cols * s, y);
      this.ctx.stroke();
    }
  }

  private renderPaths(): void {
    const s = this.tileSize;
    const thickness = Math.max(6, Math.round(s * 0.42));
    for (let c = 0; c < this.numColors; c++) {
      const path = this.paths[c];
      if (path.length < 1) continue;
      const color = PALETTE[c % PALETTE.length];
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = thickness;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const cx = this.gridX + path[i].col * s + s / 2;
        const cy = this.gridY + path[i].row * s + s / 2;
        if (i === 0) this.ctx.moveTo(cx, cy);
        else this.ctx.lineTo(cx, cy);
      }
      this.ctx.stroke();
    }
  }

  private renderEndpoints(): void {
    const s = this.tileSize;
    const outerR = s * 0.38;
    const innerR = s * 0.28;
    for (const ep of this.level.endpoints) {
      const cx = this.gridX + ep.col * s + s / 2;
      const cy = this.gridY + ep.row * s + s / 2;
      const color = PALETTE[ep.color % PALETTE.length];
      // Outer ring (shadow)
      this.drawCircle(cx, cy, outerR, color);
      this.drawCircle(cx, cy, outerR, ENDPOINT_RING, undefined);
      // Inner dot
      this.drawCircle(cx, cy, innerR, color);
      // Tiny highlight
      this.drawCircle(cx - innerR * 0.3, cy - innerR * 0.35, innerR * 0.35, 'rgba(255,255,255,0.5)');
    }
  }

  // ── Save / Resume ─────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      cols: this.level.cols,
      rows: this.level.rows,
      endpoints: this.level.endpoints.map(e => ({ col: e.col, row: e.row, color: e.color })),
      paths: this.paths.map(p => p.map(c => ({ col: c.col, row: c.row }))),
      moves: this.moves,
      gameActive: this.gameActive,
    };
  }

  deserialize(state: GameSnapshot): void {
    const cols = state.cols as number | undefined;
    const rows = state.rows as number | undefined;
    const endpoints = state.endpoints as Endpoint[] | undefined;
    const paths = state.paths as Cell[][] | undefined;
    if (
      typeof cols !== 'number' || typeof rows !== 'number' ||
      !Array.isArray(endpoints) || !Array.isArray(paths)
    ) return;

    this.level = { cols, rows, endpoints: endpoints.map(e => ({ ...e })) };
    this.numColors = endpoints.length / 2;
    this.cellOwner = new Int8Array(cols * rows).fill(-1);
    this.paths = [];
    for (let c = 0; c < this.numColors; c++) {
      const raw = paths[c] ?? [];
      const clean: Cell[] = [];
      for (const cell of raw) {
        if (typeof cell?.col === 'number' && typeof cell?.row === 'number' &&
            cell.col >= 0 && cell.col < cols && cell.row >= 0 && cell.row < rows) {
          clean.push({ col: cell.col, row: cell.row });
          this.cellOwner[cell.row * cols + cell.col] = c;
        }
      }
      this.paths.push(clean);
    }
    this.moves = (state.moves as number | undefined) ?? 0;
    this.gameActive = (state.gameActive as boolean | undefined) ?? true;
    this.drawing = false;
    this.winScheduled = false;
    this.computeLayout();
  }

  canSave(): boolean {
    return this.gameActive && !this.drawing;
  }

  // ── Test hooks ────────────────────────────────────────────
  /** Programmatically draw a color's path from endpoint-A to endpoint-B via
   *  the given cell sequence. Validates each step is adjacent and legal. */
  testDrawPath(color: number, cells: Cell[]): void {
    this.clearPath(color);
    for (const cell of cells) {
      const k = cell.row * this.level.cols + cell.col;
      const other = this.cellOwner[k];
      if (other >= 0 && other !== color) {
        const op = this.paths[other];
        const idx = op.findIndex(c => c.col === cell.col && c.row === cell.row);
        if (idx >= 0) {
          for (let i = idx; i < op.length; i++) {
            const c = op[i];
            this.cellOwner[c.row * this.level.cols + c.col] = -1;
          }
          op.length = idx;
        }
      }
      this.paths[color].push({ col: cell.col, row: cell.row });
      this.cellOwner[k] = color;
    }
    this.moves++;
    if (this.isSolved() && !this.winScheduled) this.handleSolved();
  }
}

registerGame({
  id: 'flow-connect',
  name: 'Flow Connect',
  description: 'Draw paths to connect colored dots without crossing',
  icon: 'FC',
  color: '--color-primary',
  bgGradient: ['#8B5E83', '#C8A5C0'],
  category: 'puzzle',
  createGame: (config) => new FlowConnectGame(config),
  canvasWidth: 360,
  canvasHeight: 560,
  controls: 'Drag from a colored dot to its pair through empty cells',
  dailyMode: true,
});

export { FlowConnectGame };
