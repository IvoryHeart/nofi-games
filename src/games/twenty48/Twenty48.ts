import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// ── Types ───────────────────────────────────────────────────────────────────

interface TileAnim {
  value: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  progress: number; // 0..1 for slide
}

interface SpawnAnim {
  row: number;
  col: number;
  progress: number; // 0..1 for pop-in scale
}

interface MergeAnim {
  row: number;
  col: number;
  progress: number; // 0..1 for bump scale
}

type Direction = 'up' | 'down' | 'left' | 'right';

// ── Constants ───────────────────────────────────────────────────────────────

const GAP = 8;
const CORNER_RADIUS = 8;

const SLIDE_DURATION = 0.12; // seconds (120ms)
const SPAWN_DURATION = 0.18;
const MERGE_DURATION = 0.18;

const BG_COLOR = '#FEF0E4';
const GRID_BG_COLOR = '#E5D5C5';
const EMPTY_CELL_COLOR = '#D4C4B4';

const WALL_VALUE = -1; // sentinel value for wall blocks

const TILE_COLORS: Record<number, string> = {
  [WALL_VALUE]: '#8B7D6B',  // wall tile: dark stone
  2: '#F5E6D8',
  4: '#F0DCC8',
  8: '#F2B179',
  16: '#F09665',
  32: '#E88055',
  64: '#E06040',
  128: '#F2D86A',
  256: '#F2C848',
  512: '#F0B830',
  1024: '#F0A818',
  2048: '#EDC53F',
  4096: '#C8A030',
};

const DEFAULT_HIGH_TILE_COLOR = '#A08860';

const DARK_TEXT = '#5C4833';
const LIGHT_TEXT = '#FFFFFF';

function textColorForValue(value: number): string {
  if (value === WALL_VALUE) return LIGHT_TEXT;
  return value >= 8 ? LIGHT_TEXT : DARK_TEXT;
}

function fontSizeForValue(value: number, cellSize: number): number {
  const base = cellSize * 0.4;
  if (value === WALL_VALUE) return base * 0.8;
  if (value < 128) return base;
  if (value < 1024) return base * 0.8;
  return base * 0.65;
}

function tileColor(value: number): string {
  return TILE_COLORS[value] || DEFAULT_HIGH_TILE_COLOR;
}

// ── Difficulty configs ──────────────────────────────────────────────────────

interface DifficultyConfig {
  gridSize: number;
  winTarget: number;
  hasUndo: boolean;
  wallInterval: number; // 0 = no walls; >0 = spawn wall every N moves
}

const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { gridSize: 4, winTarget: 2048, hasUndo: true,  wallInterval: 0 },  // Easy
  { gridSize: 4, winTarget: 2048, hasUndo: false, wallInterval: 0 },  // Medium
  { gridSize: 4, winTarget: 2048, hasUndo: false, wallInterval: 20 }, // Hard
  { gridSize: 5, winTarget: 4096, hasUndo: false, wallInterval: 0 },  // Extra Hard
];

// ── Game ────────────────────────────────────────────────────────────────────

class Twenty48Game extends GameEngine {
  private grid: number[][] = [];
  private size = 4;
  private gameActive = false;
  private config_: DifficultyConfig = DIFFICULTY_CONFIGS[1];

  // Dynamic layout
  private gridSize = 340;
  private gridX = 10;
  private gridY = 40;
  private cellSize = 78;

  // Animation state
  private slideAnims: TileAnim[] = [];
  private spawnAnims: SpawnAnim[] = [];
  private mergeAnims: MergeAnim[] = [];
  private animating = false;

  // Swipe detection
  private swipeStartX = 0;
  private swipeStartY = 0;
  private swiping = false;

  // Pending move direction (queued during animation)
  private pendingMove: Direction | null = null;

  // Snapshot of grid before current slide animation (used for rendering sliding tiles)
  private preAnimGrid: number[][] = [];
  // Grid state after the move is applied (used for rendering destination state)
  private postAnimGrid: number[][] = [];
  // Merge targets for this move
  private mergeTargets: { row: number; col: number; value: number }[] = [];

  // Undo support (Easy mode)
  private previousGrid: number[][] | null = null;
  private previousScore = 0;
  private canUndo = false;

  // Move counter (for wall spawning on Hard)
  private moveCount = 0;

  constructor(config: GameConfig) {
    super(config);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  init(): void {
    // Pick difficulty config
    const diff = Math.min(Math.max(this.difficulty, 0), 3);
    this.config_ = DIFFICULTY_CONFIGS[diff];
    this.size = this.config_.gridSize;

    // Dynamic canvas sizing
    this.gridSize = Math.min(this.width - 20, this.height - 20);
    this.gridX = (this.width - this.gridSize) / 2;
    this.gridY = (this.height - this.gridSize) / 2;
    this.cellSize = (this.gridSize - GAP * (this.size + 1)) / this.size;

    // Initialize grid
    this.grid = [];
    for (let r = 0; r < this.size; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.size; c++) {
        this.grid[r][c] = 0;
      }
    }

    this.gameActive = true;
    this.slideAnims = [];
    this.spawnAnims = [];
    this.mergeAnims = [];
    this.animating = false;
    this.pendingMove = null;
    this.preAnimGrid = [];
    this.postAnimGrid = [];
    this.mergeTargets = [];
    this.swiping = false;
    this.previousGrid = null;
    this.previousScore = 0;
    this.canUndo = false;
    this.moveCount = 0;

    this.setScore(0);
    this.spawnTile();
    this.spawnTile();
  }

  update(dt: number): void {
    // Update slide animations
    let sliding = false;
    for (const anim of this.slideAnims) {
      if (anim.progress < 1) {
        anim.progress = Math.min(1, anim.progress + dt / SLIDE_DURATION);
        sliding = true;
      }
    }

    // Update spawn animations
    let spawning = false;
    for (const anim of this.spawnAnims) {
      if (anim.progress < 1) {
        anim.progress = Math.min(1, anim.progress + dt / SPAWN_DURATION);
        spawning = true;
      }
    }

    // Update merge animations
    let merging = false;
    for (const anim of this.mergeAnims) {
      if (anim.progress < 1) {
        anim.progress = Math.min(1, anim.progress + dt / MERGE_DURATION);
        merging = true;
      }
    }

    // When slide animation completes, commit the move
    if (this.animating && !sliding) {
      if (this.slideAnims.length > 0) {
        // Copy postAnimGrid into actual grid
        for (let r = 0; r < this.size; r++) {
          for (let c = 0; c < this.size; c++) {
            this.grid[r][c] = this.postAnimGrid[r][c];
          }
        }
        this.slideAnims = [];

        // Start merge bump anims
        for (const mt of this.mergeTargets) {
          this.mergeAnims.push({ row: mt.row, col: mt.col, progress: 0 });
        }
        this.mergeTargets = [];

        // Spawn a wall tile on Hard mode every N moves
        if (this.config_.wallInterval > 0 && this.moveCount > 0 && this.moveCount % this.config_.wallInterval === 0) {
          this.spawnWall();
        }

        // Spawn a new number tile
        this.spawnTile();
      }
    }

    // Check if all animations are done
    if (this.animating && !sliding && !spawning && !merging) {
      this.animating = false;

      // Check win condition (gameWin is idempotent, only fires once per session)
      if (!this.won) {
        for (let r = 0; r < this.size; r++) {
          for (let c = 0; c < this.size; c++) {
            if (this.grid[r][c] === this.config_.winTarget) {
              this.gameWin();
            }
          }
        }
      }

      // Check game over
      if (!this.hasMovesAvailable()) {
        this.gameActive = false;
        this.gameOver();
        return;
      }

      // Process pending move
      if (this.pendingMove) {
        const dir = this.pendingMove;
        this.pendingMove = null;
        this.executeMove(dir);
      }
    }
  }

  render(): void {
    this.clear(BG_COLOR);

    // Grid background
    this.drawRoundRect(this.gridX, this.gridY, this.gridSize, this.gridSize, CORNER_RADIUS + 2, GRID_BG_COLOR);

    // Empty cell backgrounds
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const { x, y } = this.cellPos(r, c);
        this.drawRoundRect(x, y, this.cellSize, this.cellSize, CORNER_RADIUS, EMPTY_CELL_COLOR);
      }
    }

    // During slide animation, render tiles from preAnimGrid sliding to postAnimGrid positions
    if (this.slideAnims.length > 0) {
      this.renderSlideAnims();
    } else {
      // Render static tiles
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (this.grid[r][c] === 0) continue;
          this.renderTile(r, c, this.grid[r][c], 1);
        }
      }
    }

    // Render spawn animations (on top)
    for (const anim of this.spawnAnims) {
      if (anim.progress < 1) {
        const value = this.grid[anim.row]?.[anim.col];
        if (value) {
          // Bounce pop: overshoot then settle
          const t = anim.progress;
          const scale = this.easeOutBounce(t);
          this.renderTile(anim.row, anim.col, value, scale);
        }
      }
    }

    // Render merge bump animations (on top)
    for (const anim of this.mergeAnims) {
      if (anim.progress < 1 && anim.progress > 0) {
        const value = this.grid[anim.row]?.[anim.col];
        if (value) {
          // Pronounced smooth bump: scale up to 1.25 then back to 1
          const t = anim.progress;
          const bump = 1 + 0.25 * Math.sin(t * Math.PI);
          this.renderTile(anim.row, anim.col, value, bump);
        }
      }
    }

    // Undo hint (Easy mode)
    if (this.config_.hasUndo && this.canUndo && this.gameActive && !this.animating) {
      this.renderUndoHint();
    }
  }

  // ── Tile rendering ──────────────────────────────────────────────────────

  private cellPos(row: number, col: number): { x: number; y: number } {
    return {
      x: this.gridX + GAP + col * (this.cellSize + GAP),
      y: this.gridY + GAP + row * (this.cellSize + GAP),
    };
  }

  private renderTile(row: number, col: number, value: number, scale: number): void {
    const { x, y } = this.cellPos(row, col);
    const cx = x + this.cellSize / 2;
    const cy = y + this.cellSize / 2;
    const s = this.cellSize * scale;

    const color = tileColor(value);
    this.drawRoundRect(cx - s / 2, cy - s / 2, s, s, CORNER_RADIUS, color);

    // Wall tiles show a special symbol
    if (value === WALL_VALUE) {
      const fontSize = fontSizeForValue(value, this.cellSize) * Math.min(scale, 1);
      this.drawText('\u2588', cx, cy, {
        size: fontSize,
        color: '#6B5D4D',
        weight: '700',
      });
      return;
    }

    const fontSize = fontSizeForValue(value, this.cellSize) * Math.min(scale, 1);
    this.drawText(String(value), cx, cy, {
      size: fontSize,
      color: textColorForValue(value),
      weight: '700',
    });
  }

  private renderTileAtPixel(px: number, py: number, value: number, scale: number): void {
    const s = this.cellSize * scale;
    const color = tileColor(value);

    this.drawRoundRect(px - s / 2, py - s / 2, s, s, CORNER_RADIUS, color);

    if (value === WALL_VALUE) {
      const fontSize = fontSizeForValue(value, this.cellSize) * Math.min(scale, 1);
      this.drawText('\u2588', px, py, {
        size: fontSize,
        color: '#6B5D4D',
        weight: '700',
      });
      return;
    }

    const fontSize = fontSizeForValue(value, this.cellSize) * Math.min(scale, 1);
    this.drawText(String(value), px, py, {
      size: fontSize,
      color: textColorForValue(value),
      weight: '700',
    });
  }

  private renderSlideAnims(): void {
    for (const anim of this.slideAnims) {
      const fromPos = this.cellPos(anim.fromRow, anim.fromCol);
      const toPos = this.cellPos(anim.toRow, anim.toCol);

      // Ease-out cubic for smooth deceleration (120ms slide)
      const t = this.easeOut(anim.progress);
      const px = fromPos.x + this.cellSize / 2 + (toPos.x - fromPos.x) * t;
      const py = fromPos.y + this.cellSize / 2 + (toPos.y - fromPos.y) * t;

      this.renderTileAtPixel(px, py, anim.value, 1);
    }
  }

  private renderUndoHint(): void {
    const hintY = this.gridY + this.gridSize + 12;
    if (hintY + 20 > this.height) return; // not enough space

    this.drawText('Shake or press Z to undo', this.width / 2, hintY, {
      size: 12,
      color: '#B8A898',
      weight: '600',
    });
  }

  // ── Easing functions ────────────────────────────────────────────────────

  /** Bounce-style pop: overshoots to ~1.12 then settles to 1 */
  private easeOutBounce(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // ── Grid logic ──────────────────────────────────────────────────────────

  private spawnTile(): void {
    const empty: { row: number; col: number }[] = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0) {
          empty.push({ row: r, col: c });
        }
      }
    }

    if (empty.length === 0) return;

    const cell = empty[Math.floor(Math.random() * empty.length)];
    this.grid[cell.row][cell.col] = Math.random() < 0.9 ? 2 : 4;

    this.spawnAnims.push({ row: cell.row, col: cell.col, progress: 0 });
  }

  private spawnWall(): void {
    const empty: { row: number; col: number }[] = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0) {
          empty.push({ row: r, col: c });
        }
      }
    }

    if (empty.length === 0) return;

    const cell = empty[Math.floor(Math.random() * empty.length)];
    this.grid[cell.row][cell.col] = WALL_VALUE;

    this.spawnAnims.push({ row: cell.row, col: cell.col, progress: 0 });
  }

  private hasMovesAvailable(): boolean {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0) return true;
      }
    }

    // Any adjacent equal pair (excluding walls)?
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const val = this.grid[r][c];
        if (val === WALL_VALUE) continue; // walls can't merge
        if (c < this.size - 1 && this.grid[r][c + 1] === val) return true;
        if (r < this.size - 1 && this.grid[r + 1][c] === val) return true;
      }
    }

    return false;
  }

  private executeMove(direction: Direction): void {
    if (!this.gameActive) return;
    if (this.animating) {
      this.pendingMove = direction;
      return;
    }

    // Snapshot pre-animation grid
    this.preAnimGrid = this.grid.map(row => [...row]);

    // Build move result
    const result = this.computeMove(direction);

    if (!result.moved) return; // no change

    // Save undo state (Easy mode)
    if (this.config_.hasUndo) {
      this.previousGrid = this.preAnimGrid.map(row => [...row]);
      this.previousScore = this.score;
      this.canUndo = true;
    }

    // Increment move counter
    this.moveCount++;

    // Store post-animation grid and merge targets
    this.postAnimGrid = result.grid;
    this.mergeTargets = result.merges;

    // Create slide animations for every non-zero tile in preAnimGrid that moved
    this.slideAnims = result.anims;
    this.spawnAnims = [];
    this.mergeAnims = [];
    this.animating = true;

    // Add score from merges
    if (result.scoreGained > 0) {
      this.addScore(result.scoreGained);
    }
  }

  private undoMove(): void {
    if (!this.config_.hasUndo || !this.canUndo || !this.previousGrid) return;
    if (this.animating) return;

    // Restore previous state
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        this.grid[r][c] = this.previousGrid[r][c];
      }
    }
    this.setScore(this.previousScore);
    this.canUndo = false;
    this.previousGrid = null;
  }

  private computeMove(direction: Direction): {
    grid: number[][];
    moved: boolean;
    scoreGained: number;
    anims: TileAnim[];
    merges: { row: number; col: number; value: number }[];
  } {
    const newGrid: number[][] = [];
    for (let r = 0; r < this.size; r++) {
      newGrid[r] = new Array(this.size).fill(0);
    }

    let moved = false;
    let scoreGained = 0;
    const anims: TileAnim[] = [];
    const merges: { row: number; col: number; value: number }[] = [];

    // Process each line (row or column) in the direction of movement
    const lines = this.getLines(direction);

    for (const line of lines) {
      // Extract values from the line, walls stay in place
      const values: { value: number; origRow: number; origCol: number }[] = [];
      const wallPositions: Map<number, { value: number; origRow: number; origCol: number }> = new Map();

      for (let idx = 0; idx < line.length; idx++) {
        const pos = line[idx];
        const val = this.grid[pos.row][pos.col];
        if (val === WALL_VALUE) {
          // Walls don't move -- record their position in the line
          wallPositions.set(idx, { value: val, origRow: pos.row, origCol: pos.col });
        } else if (val !== 0) {
          values.push({ value: val, origRow: pos.row, origCol: pos.col });
        }
      }

      // Merge logic: process from front (direction of movement)
      const merged: { value: number; sources: { origRow: number; origCol: number }[] }[] = [];
      let i = 0;
      while (i < values.length) {
        if (i + 1 < values.length && values[i].value === values[i + 1].value) {
          const newValue = values[i].value * 2;
          scoreGained += newValue;
          merged.push({
            value: newValue,
            sources: [
              { origRow: values[i].origRow, origCol: values[i].origCol },
              { origRow: values[i + 1].origRow, origCol: values[i + 1].origCol },
            ],
          });
          i += 2;
        } else {
          merged.push({
            value: values[i].value,
            sources: [{ origRow: values[i].origRow, origCol: values[i].origCol }],
          });
          i += 1;
        }
      }

      // Place walls first (they occupy their original line positions)
      for (const [idx, wall] of wallPositions) {
        const destPos = line[idx];
        newGrid[destPos.row][destPos.col] = WALL_VALUE;
        // Wall doesn't move, but we still animate it staying in place
        anims.push({
          value: WALL_VALUE,
          fromRow: wall.origRow,
          fromCol: wall.origCol,
          toRow: destPos.row,
          toCol: destPos.col,
          progress: 0,
        });
      }

      // Place merged values into newGrid, skipping wall-occupied positions
      let placeIdx = 0;
      for (let mIdx = 0; mIdx < merged.length; mIdx++) {
        // Skip positions occupied by walls
        while (wallPositions.has(placeIdx)) {
          placeIdx++;
        }
        if (placeIdx >= line.length) break;

        const destPos = line[placeIdx];
        newGrid[destPos.row][destPos.col] = merged[mIdx].value;

        for (const src of merged[mIdx].sources) {
          if (src.origRow !== destPos.row || src.origCol !== destPos.col) {
            moved = true;
          }
          anims.push({
            value: this.grid[src.origRow][src.origCol],
            fromRow: src.origRow,
            fromCol: src.origCol,
            toRow: destPos.row,
            toCol: destPos.col,
            progress: 0,
          });
        }

        if (merged[mIdx].sources.length > 1) {
          merges.push({ row: destPos.row, col: destPos.col, value: merged[mIdx].value });
          moved = true;
        }

        placeIdx++;
      }
    }

    return { grid: newGrid, moved, scoreGained, anims, merges };
  }

  private getLines(direction: Direction): { row: number; col: number }[][] {
    const lines: { row: number; col: number }[][] = [];

    switch (direction) {
      case 'left':
        for (let r = 0; r < this.size; r++) {
          const line: { row: number; col: number }[] = [];
          for (let c = 0; c < this.size; c++) {
            line.push({ row: r, col: c });
          }
          lines.push(line);
        }
        break;
      case 'right':
        for (let r = 0; r < this.size; r++) {
          const line: { row: number; col: number }[] = [];
          for (let c = this.size - 1; c >= 0; c--) {
            line.push({ row: r, col: c });
          }
          lines.push(line);
        }
        break;
      case 'up':
        for (let c = 0; c < this.size; c++) {
          const line: { row: number; col: number }[] = [];
          for (let r = 0; r < this.size; r++) {
            line.push({ row: r, col: c });
          }
          lines.push(line);
        }
        break;
      case 'down':
        for (let c = 0; c < this.size; c++) {
          const line: { row: number; col: number }[] = [];
          for (let r = this.size - 1; r >= 0; r--) {
            line.push({ row: r, col: c });
          }
          lines.push(line);
        }
        break;
    }

    return lines;
  }

  // ── Input handling ──────────────────────────────────────────────────────

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (!this.gameActive) return;

    // Undo on Z key (Easy mode)
    if ((key === 'z' || key === 'Z') && this.config_.hasUndo) {
      this.undoMove();
      return;
    }

    let dir: Direction | null = null;
    switch (key) {
      case 'ArrowUp':
        dir = 'up';
        break;
      case 'ArrowDown':
        dir = 'down';
        break;
      case 'ArrowLeft':
        dir = 'left';
        break;
      case 'ArrowRight':
        dir = 'right';
        break;
    }

    if (dir) {
      e.preventDefault();
      this.executeMove(dir);
    }
  }

  protected handlePointerDown(x: number, y: number): void {
    this.swipeStartX = x;
    this.swipeStartY = y;
    this.swiping = true;
  }

  protected handlePointerMove(_x: number, _y: number): void {
    // Not used for swipe -- detected on pointerUp
  }

  protected handlePointerUp(x: number, y: number): void {
    if (!this.swiping) return;
    this.swiping = false;

    if (!this.gameActive) return;

    const dx = x - this.swipeStartX;
    const dy = y - this.swipeStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 20) return; // too short, ignore

    let dir: Direction;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? 'right' : 'left';
    } else {
      dir = dy > 0 ? 'down' : 'up';
    }

    this.executeMove(dir);
  }

  // ── Save / Resume ─────────────────────────────────────────────────────────

  serialize(): GameSnapshot {
    return {
      grid: this.grid.map(row => [...row]),
      gameActive: this.gameActive,
      moveCount: this.moveCount,
      previousGrid: this.previousGrid ? this.previousGrid.map(row => [...row]) : null,
      previousScore: this.previousScore,
      canUndo: this.canUndo,
    };
  }

  deserialize(state: GameSnapshot): void {
    const g = state.grid as number[][] | undefined;
    if (!g || !Array.isArray(g) || g.length !== this.size) return;
    this.grid = g.map(row => [...row]);
    this.gameActive = (state.gameActive as boolean) ?? true;
    this.moveCount = (state.moveCount as number) ?? 0;
    const prev = state.previousGrid as number[][] | null | undefined;
    this.previousGrid = prev ? prev.map(row => [...row]) : null;
    this.previousScore = (state.previousScore as number) ?? 0;
    this.canUndo = (state.canUndo as boolean) ?? false;
    // Clear any pop-in animations from the fresh init() spawn
    this.spawnAnims = [];
  }

  canSave(): boolean {
    return this.gameActive && !this.animating;
  }
}

// ── Registration ──────────────────────────────────────────────────────────

registerGame({
  id: '2048',
  name: '2048',
  description: 'Slide & merge number tiles',
  icon: '2\u2074',
  color: '--game-2048',
  bgGradient: ['#E89040', '#F0B868'],
  category: 'puzzle',
  createGame: (config) => new Twenty48Game(config),
  canvasWidth: 360,
  canvasHeight: 400,
  controls: 'Swipe or arrow keys to slide tiles',
  continuableAfterWin: true,
});
