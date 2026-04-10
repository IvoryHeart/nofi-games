import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';

// Tetromino shape definitions - each rotation is a 4x4 grid encoded as [row][col]
type Shape = number[][];

interface Piece {
  type: number;       // 0-6 index into SHAPES/COLORS
  rotation: number;   // 0-3
  x: number;          // column position (in grid cells)
  y: number;          // row position (in grid cells, integer for logic)
}

const COLS = 10;
const ROWS = 20;

// Colors for each piece type: I, O, T, S, Z, J, L
const COLORS = [
  '#7CA8BF', // I
  '#F0D08C', // O
  '#B49FCC', // T
  '#8DC5A2', // S
  '#E8928A', // Z
  '#6B8FA3', // J
  '#F0B088', // L
];

// Tetromino shapes: each piece has 4 rotations, each rotation is an array of [row, col] offsets
// Using SRS (Super Rotation System) orientations
const SHAPES: Shape[][] = [
  // I
  [
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[3,0]],
  ],
  // O
  [
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
  ],
  // T
  [
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,0],[1,0],[1,1],[2,0]],
    [[0,0],[0,1],[0,2],[1,1]],
    [[0,1],[1,0],[1,1],[2,1]],
  ],
  // S
  [
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]],
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]],
  ],
  // Z
  [
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[1,0],[1,1],[2,0]],
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[1,0],[1,1],[2,0]],
  ],
  // J
  [
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,0],[0,1],[1,0],[2,0]],
    [[0,0],[0,1],[0,2],[1,2]],
    [[0,1],[1,1],[2,0],[2,1]],
  ],
  // L
  [
    [[0,2],[1,0],[1,1],[1,2]],
    [[0,0],[1,0],[2,0],[2,1]],
    [[0,0],[0,1],[0,2],[1,0]],
    [[0,0],[0,1],[1,1],[2,1]],
  ],
];

// SRS wall-kick tables keyed by "from->to" rotation transition (Y-down convention,
// so Y values match our grid — positive Y = down). Replaces the old 4-entry
// table that incorrectly reused CW kicks for CCW rotations. See
// docs/research/tetris-controls.md § 7 for the source.
type Kick = readonly [number, number];

const KICKS_JLSTZ: Record<string, readonly Kick[]> = {
  '0->1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1->0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1->2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2->1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2->3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3->2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3->0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0->3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};

const KICKS_I: Record<string, readonly Kick[]> = {
  '0->1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1->0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1->2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2->1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2->3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3->2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3->0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0->3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

// Note: the O-piece has no rotation kicks (no visual rotation) — tryRotate
// short-circuits on type===1 before reading any kick table.

// Difficulty presets: [startInterval, levelSpeedDecrease]
const DIFFICULTY_SETTINGS: [number, number][] = [
  [1.2, 0.06],  // 0 = Easy
  [0.8, 0.07],  // 1 = Medium
  [0.5, 0.08],  // 2 = Hard
  [0.3, 0.09],  // 3 = Extra Hard
];

class BlockDropGame extends GameEngine {
  private grid: number[][] = [];          // -1 = empty, 0-6 = piece type color
  private current: Piece | null = null;
  private next: Piece | null = null;
  private dropTimer = 0;
  private dropInterval = 1.0;             // seconds between drops
  private startDropInterval = 1.0;
  private levelSpeedDecrease = 0.08;
  private level = 1;
  private linesCleared = 0;
  private isOver = false;

  // Dynamic layout
  private CELL = 27;
  private boardOffsetX = 0;  // horizontal offset to center the board

  // Row clear animation
  private clearingRows: number[] = [];
  private clearTimer = 0;
  private readonly CLEAR_DURATION = 0.2; // 200ms shrink animation

  // Lock flash effect
  private lockFlashCells: { col: number; row: number }[] = [];
  private lockFlashTimer = 0;
  private readonly LOCK_FLASH_DURATION = 0.05; // 50ms

  // Smooth piece Y interpolation
  private displayY = 0;       // smoothed Y position in grid cells (fractional)
  private targetY = 0;        // target Y (integer grid row)
  private softDropping = false;

  // Touch / pointer input tracking — velocity-gated gesture state machine
  private touchStartX = 0;
  private touchStartY = 0;
  private touchLastX = 0;
  private touchLastY = 0;
  private touchLastTime = 0;
  private touchStartTime = 0;
  private touchMoved = false;
  private swipeHandled = false;
  // Recent pointer samples for velocity (last 3). Each: [x, y, timeMs].
  private pointerSamples: Array<[number, number, number]> = [];
  // Accumulates horizontal drag to commit 1 column per CELL of travel.
  private hDragAccum = 0;

  // Wheel / trackpad accumulation (Mac two-finger scroll)
  private wheelAccumY = 0;
  private lastWheelTriggerTime = 0;
  // Bound wheel handler kept so we can detach it in destroy().
  private wheelHandler: ((e: WheelEvent) => void) | null = null;

  // DAS (Delayed Auto-Shift) / ARR (Auto Repeat Rate) — modern Guideline
  // defaults: 167 ms initial delay, 33 ms repeat. We run our own timer
  // instead of the browser's keyboard auto-repeat.
  private readonly DAS = 0.167;
  private readonly ARR = 0.033;
  private dasDir = 0;        // -1 = left held, 0 = none, 1 = right held
  private dasTimer = 0;
  private arrTimer = 0;

  // Bag randomizer for fair piece distribution
  private bag: number[] = [];

  // Lock delay: brief pause before locking piece after landing
  private lockTimer = 0;
  private readonly LOCK_DELAY = 0.5;
  private isLanding = false;

  constructor(config: GameConfig) {
    super(config);
  }

  // Space reserved at the top for the shell HUD overlay
  private static readonly HUD_CLEARANCE = 56;
  private boardOffsetY = 0;

  private computeLayout(): void {
    // Fit 20 rows below HUD clearance with a small bottom margin
    const availH = this.height - BlockDropGame.HUD_CLEARANCE;
    this.CELL = Math.floor(availH / 21); // 20 rows + 1 bottom margin
    const boardWidth = COLS * this.CELL;
    this.boardOffsetX = Math.floor((this.width - boardWidth) / 2);
    // Ensure the board doesn't go off-screen on the left if canvas is tiny
    if (this.boardOffsetX < 0) this.boardOffsetX = 0;
    this.boardOffsetY = BlockDropGame.HUD_CLEARANCE;
  }

  init(): void {
    this.computeLayout();

    // Map difficulty
    const diff = Math.max(0, Math.min(3, this.difficulty));
    const [startInterval, speedDec] = DIFFICULTY_SETTINGS[diff];
    this.startDropInterval = startInterval;
    this.levelSpeedDecrease = speedDec;
    this.dropInterval = startInterval;

    // Initialize empty grid
    this.grid = [];
    for (let r = 0; r < ROWS; r++) {
      this.grid.push(new Array(COLS).fill(-1));
    }

    // Extra Hard: add 2 garbage rows at bottom
    if (diff === 3) {
      for (let g = 0; g < 2; g++) {
        const row = ROWS - 1 - g;
        const gapCol = Math.floor(this.rng() * COLS);
        for (let c = 0; c < COLS; c++) {
          if (c !== gapCol) {
            // Random piece color for garbage
            this.grid[row][c] = Math.floor(this.rng() * COLORS.length);
          }
        }
      }
    }

    this.bag = [];
    this.current = null;
    this.next = null;
    this.dropTimer = 0;
    this.level = 1;
    this.linesCleared = 0;
    this.isOver = false;
    this.clearingRows = [];
    this.clearTimer = 0;
    this.lockFlashCells = [];
    this.lockFlashTimer = 0;
    this.lockTimer = 0;
    this.isLanding = false;
    this.displayY = 0;
    this.targetY = 0;
    this.softDropping = false;

    // Reset input state
    this.dasDir = 0;
    this.dasTimer = 0;
    this.arrTimer = 0;
    this.hDragAccum = 0;
    this.pointerSamples = [];
    this.wheelAccumY = 0;
    this.lastWheelTriggerTime = 0;
    this.touchMoved = false;
    this.swipeHandled = false;

    this.next = this.spawnPiece();
    this.advancePiece();

    // Attach a canvas-scoped wheel listener once. Not added via the engine's
    // private addListener helper because we can't reach it from a subclass —
    // we track it ourselves and detach in destroy().
    if (!this.wheelHandler) {
      this.wheelHandler = (e: WheelEvent): void => this.handleWheel(e);
      this.canvas.addEventListener('wheel', this.wheelHandler as EventListener, { passive: false });
    }
  }

  destroy(): void {
    if (this.wheelHandler) {
      this.canvas.removeEventListener('wheel', this.wheelHandler as EventListener);
      this.wheelHandler = null;
    }
    super.destroy();
  }

  private nextFromBag(): number {
    if (this.bag.length === 0) {
      // Refill bag with one of each piece, then shuffle
      this.bag = [0, 1, 2, 3, 4, 5, 6];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop()!;
  }

  private spawnPiece(): Piece {
    const type = this.nextFromBag();
    return {
      type,
      rotation: 0,
      x: type === 0 ? 3 : 3, // center the piece roughly
      y: 0,
    };
  }

  private advancePiece(): void {
    this.current = this.next!;
    this.next = this.spawnPiece();
    this.dropTimer = 0;
    this.lockTimer = 0;
    this.isLanding = false;
    this.displayY = this.current.y;
    this.targetY = this.current.y;
    this.softDropping = false;

    // Check if spawn position is valid
    if (!this.isValid(this.current)) {
      // Game over - can't place new piece
      this.isOver = true;
      this.renderGameOver();
      this.gameOver();
    }
  }

  private getBlocks(piece: Piece): number[][] {
    return SHAPES[piece.type][piece.rotation];
  }

  private isValid(piece: Piece): boolean {
    const blocks = this.getBlocks(piece);
    for (const [r, c] of blocks) {
      const gr = piece.y + r;
      const gc = piece.x + c;
      if (gc < 0 || gc >= COLS || gr >= ROWS) return false;
      if (gr >= 0 && this.grid[gr][gc] !== -1) return false;
    }
    return true;
  }

  private tryMove(dx: number, dy: number): boolean {
    if (!this.current || this.isOver) return false;
    const test: Piece = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
    if (this.isValid(test)) {
      this.current.x = test.x;
      this.current.y = test.y;
      this.targetY = this.current.y;
      // Reset lock timer if we moved successfully while landing
      if (this.isLanding && dy === 0) {
        this.lockTimer = 0;
      }
      return true;
    }
    return false;
  }

  private tryRotate(dir: number): boolean {
    if (!this.current || this.isOver) return false;
    const oldRotation = this.current.rotation;
    const newRotation = (this.current.rotation + dir + 4) % 4;

    // O piece: no visual rotation, no kicks needed.
    if (this.current.type === 1) {
      this.current.rotation = newRotation;
      return true;
    }

    // Pick the right table keyed by the (from, to) transition. Our rotation
    // indices map directly to SRS states 0/R/2/L = 0/1/2/3.
    const key = `${oldRotation}->${newRotation}`;
    const table = this.current.type === 0 ? KICKS_I : KICKS_JLSTZ;
    const kicks = table[key];
    if (!kicks) return false;

    const test: Piece = { ...this.current, rotation: newRotation };

    for (const [kx, ky] of kicks) {
      test.x = this.current.x + kx;
      // Kick tables above are already in screen-Y-down (positive Y = down),
      // so we ADD ky to the current Y instead of subtracting.
      test.y = this.current.y + ky;
      if (this.isValid(test)) {
        this.current.rotation = newRotation;
        this.current.x = test.x;
        this.current.y = test.y;
        this.targetY = this.current.y;
        this.displayY = this.current.y;
        // Reset lock timer on successful rotation
        if (this.isLanding) {
          this.lockTimer = 0;
        }
        return true;
      }
    }
    return false;
  }

  private hardDrop(): void {
    if (!this.current || this.isOver) return;
    let dropDistance = 0;
    while (this.tryMove(0, 1)) {
      dropDistance++;
    }
    // Small bonus for hard drop
    this.addScore(dropDistance * 2);
    // Snap display Y immediately on hard drop
    this.displayY = this.current.y;
    this.lockPiece();
  }

  private getGhostY(): number {
    if (!this.current) return 0;
    const ghost: Piece = { ...this.current };
    while (true) {
      const test: Piece = { ...ghost, y: ghost.y + 1 };
      if (!this.isValid(test)) break;
      ghost.y++;
    }
    return ghost.y;
  }

  private lockPiece(): void {
    if (!this.current) return;
    const blocks = this.getBlocks(this.current);

    // Collect cells for lock flash
    this.lockFlashCells = [];
    for (const [r, c] of blocks) {
      const gr = this.current.y + r;
      const gc = this.current.x + c;
      if (gr >= 0 && gr < ROWS && gc >= 0 && gc < COLS) {
        this.grid[gr][gc] = this.current.type;
        this.lockFlashCells.push({ col: gc, row: gr });
      }
    }
    this.lockFlashTimer = this.LOCK_FLASH_DURATION;

    // Check for completed rows
    this.checkLines();

    // Spawn next piece
    this.advancePiece();
  }

  private checkLines(): void {
    const completedRows: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      if (this.grid[r].every(cell => cell !== -1)) {
        completedRows.push(r);
      }
    }

    if (completedRows.length > 0) {
      // Start shrink animation
      this.clearingRows = completedRows;
      this.clearTimer = this.CLEAR_DURATION;

      // Score based on number of lines cleared
      const lineScores = [0, 100, 300, 500, 800];
      const points = lineScores[completedRows.length] || 800;
      this.addScore(points * this.level);

      this.linesCleared += completedRows.length;

      // Level up every 10 lines
      const newLevel = Math.floor(this.linesCleared / 10) + 1;
      if (newLevel > this.level) {
        this.level = newLevel;
        // Speed increases with level
        this.dropInterval = Math.max(0.05, this.startDropInterval - (this.level - 1) * this.levelSpeedDecrease);
      }
    }
  }

  private removeCompletedRows(): void {
    // Remove cleared rows from grid
    for (const row of this.clearingRows.sort((a, b) => b - a)) {
      this.grid.splice(row, 1);
      this.grid.unshift(new Array(COLS).fill(-1));
    }
    this.clearingRows = [];
  }

  update(dt: number): void {
    if (this.isOver) return;

    // Handle lock flash timer
    if (this.lockFlashTimer > 0) {
      this.lockFlashTimer -= dt;
      if (this.lockFlashTimer <= 0) {
        this.lockFlashTimer = 0;
        this.lockFlashCells = [];
      }
    }

    // Handle row clear animation
    if (this.clearTimer > 0) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        this.removeCompletedRows();
        this.clearTimer = 0;
      }
      return; // Pause game during clear animation
    }

    if (!this.current) return;

    // DAS / ARR: once a direction has been held for DAS seconds, repeat the
    // move every ARR seconds. The first move happened immediately in
    // handleKeyDown. Cap the per-frame repeat count so a huge dt can't push
    // the piece across the whole board in a single tick (safety for tests
    // and hitched frames).
    if (this.dasDir !== 0) {
      this.dasTimer += dt;
      if (this.dasTimer >= this.DAS) {
        this.arrTimer += dt;
        let guard = 20;
        while (this.arrTimer >= this.ARR && guard-- > 0) {
          this.arrTimer -= this.ARR;
          if (!this.tryMove(this.dasDir, 0)) break;
        }
      }
    }

    // Smooth Y interpolation: displayY approaches targetY
    if (this.displayY < this.targetY) {
      // Interpolate towards target; speed depends on whether soft-dropping
      const interpSpeed = this.softDropping ? 25 : 15; // cells/sec visual speed
      this.displayY = Math.min(this.targetY, this.displayY + interpSpeed * dt);
    } else {
      this.displayY = this.targetY;
    }

    // Check if piece is landing (can't move down)
    const testDown: Piece = { ...this.current, y: this.current.y + 1 };
    const canMoveDown = this.isValid(testDown);

    if (!canMoveDown) {
      this.isLanding = true;
      this.lockTimer += dt;
      // Snap display Y when landing
      this.displayY = this.current.y;
      if (this.lockTimer >= this.LOCK_DELAY) {
        this.lockPiece();
      }
    } else {
      this.isLanding = false;
      this.lockTimer = 0;

      // Normal gravity drop
      this.dropTimer += dt;
      if (this.dropTimer >= this.dropInterval) {
        this.dropTimer -= this.dropInterval;
        this.tryMove(0, 1);
      }
    }
  }

  render(): void {
    // Clear canvas with warm cream
    this.clear('#FEF0E4');

    const ctx = this.ctx;

    ctx.save();
    ctx.translate(this.boardOffsetX, this.boardOffsetY);

    // Draw the well background
    this.drawWell();

    // Draw locked blocks
    this.drawGrid();

    // Draw row clear animation
    if (this.clearTimer > 0) {
      this.drawClearAnimation();
    }

    // Draw lock flash effect
    if (this.lockFlashTimer > 0) {
      this.drawLockFlash();
    }

    // Draw ghost piece
    if (this.current && this.clearTimer <= 0 && !this.isOver) {
      this.drawGhost();
    }

    // Draw current piece (with smooth Y)
    if (this.current && !this.isOver) {
      this.drawCurrentPiece();
    }

    ctx.restore();

    // Draw side panels (next piece, level, lines) in remaining space
    this.drawSidePanels();
  }

  getHudStats(): Array<{ label: string; value: string }> {
    return [
      { label: 'Level', value: `${this.level}` },
      { label: 'Lines', value: `${this.linesCleared}` },
    ];
  }

  private drawWell(): void {
    const ctx = this.ctx;
    const CELL = this.CELL;

    // Draw inner grid lines (more visible than before)
    ctx.strokeStyle = '#E0D0BA';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, ROWS * CELL);
      ctx.stroke();
    }
    // Horizontal lines
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(COLS * CELL, r * CELL);
      ctx.stroke();
    }

    // Thick outer border around the playfield
    ctx.strokeStyle = '#C5B0A0';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-0.5, -0.5, COLS * CELL + 1, ROWS * CELL + 1);
  }

  private drawGrid(): void {
    const CELL = this.CELL;
    for (let r = 0; r < ROWS; r++) {
      // Skip drawing rows that are being cleared (they get their own animation)
      if (this.clearingRows.includes(r)) continue;
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] !== -1) {
          this.drawBlock(c * CELL, r * CELL, CELL, COLORS[this.grid[r][c]], 1.0);
        }
      }
    }
  }

  private drawBlock(x: number, y: number, size: number, color: string, alpha: number): void {
    const pad = 1; // Small padding between blocks
    const ctx = this.ctx;

    ctx.globalAlpha = alpha;

    // Main block
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, 3);
    ctx.fillStyle = color;
    ctx.fill();

    // Subtle border to distinguish filled cells
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Subtle highlight on top-left
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, size - pad * 2, (size - pad * 2) * 0.35, [3, 3, 0, 0]);
    ctx.fill();

    ctx.globalAlpha = 1.0;
  }

  private drawCurrentPiece(): void {
    if (!this.current) return;
    const blocks = this.getBlocks(this.current);
    const color = COLORS[this.current.type];
    const CELL = this.CELL;

    // Use smooth displayY for rendering
    const smoothY = this.displayY;

    for (const [r, c] of blocks) {
      const row = smoothY + r;
      const col = this.current.x + c;
      if (row >= 0) {
        this.drawBlock(col * CELL, row * CELL, CELL, color, 1.0);
      }
    }
  }

  private drawGhost(): void {
    if (!this.current) return;
    const ghostY = this.getGhostY();
    if (ghostY === this.current.y) return; // Ghost is at same position, don't draw

    const blocks = this.getBlocks(this.current);
    const color = COLORS[this.current.type];
    const CELL = this.CELL;
    for (const [r, c] of blocks) {
      const row = ghostY + r;
      const col = this.current.x + c;
      if (row >= 0) {
        this.drawBlock(col * CELL, row * CELL, CELL, color, 0.2);
      }
    }
  }

  private drawClearAnimation(): void {
    const ctx = this.ctx;
    const CELL = this.CELL;
    // Progress 0 -> 1 as animation proceeds
    const progress = 1 - (this.clearTimer / this.CLEAR_DURATION);
    const easedProgress = this.easeOut(progress);
    // Scale rows vertically from 1 to 0
    const scaleY = 1 - easedProgress;

    for (const row of this.clearingRows) {
      const y = row * CELL;
      const centerY = y + CELL / 2;

      ctx.save();
      ctx.translate(0, centerY);
      ctx.scale(1, scaleY);
      ctx.translate(0, -centerY);

      for (let c = 0; c < COLS; c++) {
        if (this.grid[row][c] !== -1) {
          this.drawBlock(c * CELL, y, CELL, COLORS[this.grid[row][c]], 1.0);
        }
      }

      ctx.restore();
    }
  }

  private drawLockFlash(): void {
    const ctx = this.ctx;
    const CELL = this.CELL;
    const flashAlpha = this.lockFlashTimer / this.LOCK_FLASH_DURATION;

    for (const { col, row } of this.lockFlashCells) {
      ctx.globalAlpha = flashAlpha * 0.8;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
    ctx.globalAlpha = 1.0;
  }

  private drawSidePanels(): void {
    const CELL = this.CELL;
    const boardRight = this.boardOffsetX + COLS * CELL;
    const boardTop = this.boardOffsetY;

    // Determine which side has more space for panels
    const rightSpace = this.width - boardRight;
    const leftSpace = this.boardOffsetX;

    // Use the right side if there's enough room, otherwise left
    let panelX: number;
    let panelW: number;
    if (rightSpace >= leftSpace && rightSpace > CELL * 2) {
      panelX = boardRight + 4;
      panelW = rightSpace - 8;
    } else if (leftSpace > CELL * 2) {
      panelX = 4;
      panelW = leftSpace - 8;
    } else {
      // Not enough space for panels; skip
      return;
    }

    // Clamp panel width
    panelW = Math.min(panelW, CELL * 5);

    const ctx = this.ctx;

    // -- Next piece preview --
    const previewY = boardTop;
    const previewH = CELL * 4;

    ctx.globalAlpha = 0.6;
    this.drawRoundRect(panelX, previewY, panelW, previewH, 6, '#F0E4D4');
    ctx.globalAlpha = 1.0;

    const labelSize = Math.max(9, Math.floor(CELL * 0.4));
    const valueSize = Math.max(14, Math.floor(CELL * 0.6));

    this.drawText('NEXT', panelX + panelW / 2, previewY + labelSize + 4, {
      size: labelSize,
      color: '#718096',
      weight: '700',
    });

    if (this.next) {
      const blocks = SHAPES[this.next.type][0];
      const color = COLORS[this.next.type];

      // Calculate bounding box of the shape
      let minR = 4, maxR = 0, minC = 4, maxC = 0;
      for (const [r, c] of blocks) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
      const shapeW = (maxC - minC + 1);
      const shapeH = (maxR - minR + 1);

      const miniCell = Math.floor(CELL * 0.5);
      const offsetX = panelX + (panelW - shapeW * miniCell) / 2;
      const offsetY = previewY + labelSize + 12 + (previewH - labelSize - 16 - shapeH * miniCell) / 2;

      for (const [r, c] of blocks) {
        const bx = offsetX + (c - minC) * miniCell;
        const by = offsetY + (r - minR) * miniCell;
        ctx.beginPath();
        ctx.roundRect(bx + 0.5, by + 0.5, miniCell - 1, miniCell - 1, 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    // -- Level panel --
    const levelY = previewY + previewH + 8;
    const panelH = CELL * 2.2;

    ctx.globalAlpha = 0.6;
    this.drawRoundRect(panelX, levelY, panelW, panelH, 6, '#F0E4D4');
    ctx.globalAlpha = 1.0;

    this.drawText('LEVEL', panelX + panelW / 2, levelY + labelSize + 4, {
      size: labelSize,
      color: '#718096',
      weight: '700',
    });
    this.drawText(`${this.level}`, panelX + panelW / 2, levelY + panelH / 2 + labelSize / 2 + 4, {
      size: valueSize,
      color: '#2D3748',
      weight: '800',
    });

    // -- Lines panel --
    const linesY = levelY + panelH + 8;

    ctx.globalAlpha = 0.6;
    this.drawRoundRect(panelX, linesY, panelW, panelH, 6, '#F0E4D4');
    ctx.globalAlpha = 1.0;

    this.drawText('LINES', panelX + panelW / 2, linesY + labelSize + 4, {
      size: labelSize,
      color: '#718096',
      weight: '700',
    });
    this.drawText(`${this.linesCleared}`, panelX + panelW / 2, linesY + panelH / 2 + labelSize / 2 + 4, {
      size: valueSize,
      color: '#2D3748',
      weight: '800',
    });
  }

  private renderGameOver(): void {
    this.render();

    const ctx = this.ctx;
    // Darken overlay
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#1A202C';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1.0;

    const bigSize = Math.max(24, Math.floor(this.CELL * 1.2));

    // Game over text
    this.drawText('GAME', this.width / 2, this.height / 2 - bigSize, {
      size: bigSize,
      color: '#FFFFFF',
      weight: '800',
    });
    this.drawText('OVER', this.width / 2, this.height / 2 + bigSize * 0.5, {
      size: bigSize,
      color: '#FFFFFF',
      weight: '800',
    });
  }

  // -- Save / Resume --

  serialize(): GameSnapshot {
    return {
      grid: this.grid.map(row => [...row]),
      current: this.current
        ? { type: this.current.type, rotation: this.current.rotation, x: this.current.x, y: this.current.y }
        : null,
      next: this.next
        ? { type: this.next.type, rotation: this.next.rotation, x: this.next.x, y: this.next.y }
        : null,
      bag: [...this.bag],
      level: this.level,
      linesCleared: this.linesCleared,
      dropTimer: this.dropTimer,
      dropInterval: this.dropInterval,
      startDropInterval: this.startDropInterval,
      levelSpeedDecrease: this.levelSpeedDecrease,
      isOver: this.isOver,
      lockTimer: this.lockTimer,
      isLanding: this.isLanding,
      displayY: this.displayY,
      targetY: this.targetY,
      softDropping: this.softDropping,
    };
  }

  deserialize(state: GameSnapshot): void {
    // Validate grid dimensions
    const rawGrid = state.grid as unknown;
    if (!Array.isArray(rawGrid) || rawGrid.length !== ROWS) return;
    const grid: number[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const row = rawGrid[r] as unknown;
      if (!Array.isArray(row) || row.length !== COLS) return;
      const newRow: number[] = [];
      for (let c = 0; c < COLS; c++) {
        const cell = row[c];
        if (typeof cell !== 'number') return;
        newRow.push(cell);
      }
      grid.push(newRow);
    }

    // Validate piece helper
    const validatePiece = (raw: unknown): Piece | null => {
      if (raw === null || raw === undefined) return null;
      if (typeof raw !== 'object') return null;
      const p = raw as Record<string, unknown>;
      if (typeof p.type !== 'number' || typeof p.rotation !== 'number'
          || typeof p.x !== 'number' || typeof p.y !== 'number') return null;
      if (p.type < 0 || p.type >= SHAPES.length) return null;
      const rot = ((p.rotation % 4) + 4) % 4;
      return { type: p.type, rotation: rot, x: p.x, y: p.y };
    };

    const current = validatePiece(state.current);
    const next = validatePiece(state.next);

    const rawBag = state.bag as unknown;
    if (!Array.isArray(rawBag)) return;
    const bag: number[] = [];
    for (const v of rawBag) {
      if (typeof v !== 'number') return;
      bag.push(v);
    }

    const numField = (v: unknown, fallback: number): number =>
      typeof v === 'number' && Number.isFinite(v) ? v : fallback;

    // All validation passed — commit the state.
    this.grid = grid;
    this.current = current;
    this.next = next;
    this.bag = bag;
    this.level = numField(state.level, 1);
    this.linesCleared = numField(state.linesCleared, 0);
    this.dropTimer = numField(state.dropTimer, 0);
    this.dropInterval = numField(state.dropInterval, this.dropInterval);
    this.startDropInterval = numField(state.startDropInterval, this.startDropInterval);
    this.levelSpeedDecrease = numField(state.levelSpeedDecrease, this.levelSpeedDecrease);
    this.isOver = state.isOver === true;
    this.lockTimer = numField(state.lockTimer, 0);
    this.isLanding = state.isLanding === true;
    this.displayY = numField(state.displayY, this.current ? this.current.y : 0);
    this.targetY = numField(state.targetY, this.current ? this.current.y : 0);
    this.softDropping = state.softDropping === true;

    // Clear any in-flight transient animations from the previous session.
    this.clearingRows = [];
    this.clearTimer = 0;
    this.lockFlashCells = [];
    this.lockFlashTimer = 0;
  }

  canSave(): boolean {
    // Don't save mid-animation: line-clear shrink or lock-flash would
    // produce a snapshot with incomplete grid/piece state.
    if (this.clearTimer > 0) return false;
    if (this.lockFlashTimer > 0) return false;
    if (this.isOver) return false;
    return true;
  }

  // -- Input Handling --

  /** Toggle the built-in engine pause state. P or Escape. */
  private togglePause(): void {
    if (this.isPaused()) {
      this.resume();
    } else {
      this.pause();
    }
  }

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    // Pause/unpause should work even during clear animation so the player
    // can step away mid-clear. Every other action is gated below.
    if (key === 'p' || key === 'P' || key === 'Escape') {
      e.preventDefault();
      this.togglePause();
      return;
    }

    if (this.isOver || this.clearTimer > 0) return;

    switch (key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.tryMove(-1, 0);
        // Start DAS for left. Switching direction resets the shift timer so
        // the old direction doesn't keep firing.
        this.dasDir = -1;
        this.dasTimer = 0;
        this.arrTimer = 0;
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.tryMove(1, 0);
        this.dasDir = 1;
        this.dasTimer = 0;
        this.arrTimer = 0;
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.softDropping = true;
        if (this.tryMove(0, 1)) {
          this.addScore(1); // Soft drop bonus
          this.dropTimer = 0;
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.tryRotate(1);
        break;
      case ' ':
        e.preventDefault();
        this.hardDrop();
        break;
      case 'z':
      case 'Z':
      case 'Control':
        this.tryRotate(-1); // Counter-clockwise rotation
        break;
      case 'x':
      case 'X':
        this.tryRotate(1); // Clockwise rotation
        break;
      // Hold-piece binding reserved for future work (mechanic not yet
      // implemented). Keys: C, Shift. Intentionally a no-op for now — this
      // reserves the binding so we don't trigger other things on those keys.
      case 'c':
      case 'C':
      case 'Shift':
        break;
    }
  }

  protected handleKeyUp(key: string, _e: KeyboardEvent): void {
    if (key === 'ArrowDown') {
      this.softDropping = false;
    }
    // DAS release with fall-back to the other direction if it's still held.
    // Without this: hold Left → press Right → release Right leaves
    // dasDir = 0 while Left is still physically held, so the player gets
    // stuck. The engine tracks held keys in `this.keys`, so we can check.
    if (key === 'ArrowLeft' && this.dasDir === -1) {
      if (this.keys.has('ArrowRight')) {
        this.dasDir = 1;
      } else {
        this.dasDir = 0;
      }
      this.dasTimer = 0;
      this.arrTimer = 0;
    }
    if (key === 'ArrowRight' && this.dasDir === 1) {
      if (this.keys.has('ArrowLeft')) {
        this.dasDir = -1;
      } else {
        this.dasDir = 0;
      }
      this.dasTimer = 0;
      this.arrTimer = 0;
    }
  }

  protected handlePointerDown(x: number, y: number): void {
    if (this.isOver || this.clearTimer > 0) return;

    const now = performance.now();
    this.touchStartX = x;
    this.touchStartY = y;
    this.touchLastX = x;
    this.touchLastY = y;
    this.touchLastTime = now;
    this.touchStartTime = now;
    this.touchMoved = false;
    this.swipeHandled = false;
    this.hDragAccum = 0;
    this.pointerSamples = [[x, y, now]];
  }

  /** Compute the most recent pointer velocity in px/ms from the last few
   *  samples. Returns zeros if there aren't enough samples yet. */
  private pointerVelocity(): { vx: number; vy: number } {
    const n = this.pointerSamples.length;
    if (n < 2) return { vx: 0, vy: 0 };
    const [x0, y0, t0] = this.pointerSamples[0];
    const [x1, y1, t1] = this.pointerSamples[n - 1];
    const dt = Math.max(t1 - t0, 0.001); // guard against zero/negative
    return { vx: (x1 - x0) / dt, vy: (y1 - y0) / dt };
  }

  protected handlePointerMove(x: number, y: number): void {
    if (this.isOver || this.clearTimer > 0) return;
    if (this.swipeHandled) return;

    const now = performance.now();
    // Keep a sliding window of the 3 most recent samples — enough to compute
    // a meaningful flick velocity without smoothing out the peak.
    this.pointerSamples.push([x, y, now]);
    if (this.pointerSamples.length > 3) this.pointerSamples.shift();

    const dxTotal = x - this.touchStartX;
    const dyTotal = y - this.touchStartY;
    const CELL = this.CELL;

    // Any measurable drag exits the tap state.
    if (Math.abs(dxTotal) > 4 || Math.abs(dyTotal) > 4) {
      this.touchMoved = true;
    }

    // Velocity-gated hard drop: a fast, mostly-vertical flick. Replaces the
    // old distance gate (`dy > CELL * 2`), which misfired on soft-drop drags.
    const { vx, vy } = this.pointerVelocity();
    const verticalDominant = Math.abs(dyTotal) > Math.abs(dxTotal) * 1.5;
    if (vy > 1.5 && dyTotal > CELL && verticalDominant) {
      this.hardDrop();
      this.swipeHandled = true;
      this.touchMoved = true;
      return;
    }

    // Horizontal drag: accumulate cell-by-cell moves. A short swipe ≈ 1
    // column; a longer drag moves multiple columns. Reset the accumulator
    // against the finger position, not the original down position.
    this.hDragAccum += x - this.touchLastX;
    let guard = 32;
    while (this.hDragAccum >= CELL && guard-- > 0) {
      this.tryMove(1, 0);
      this.hDragAccum -= CELL;
      this.touchMoved = true;
    }
    while (this.hDragAccum <= -CELL && guard-- > 0) {
      this.tryMove(-1, 0);
      this.hDragAccum += CELL;
      this.touchMoved = true;
    }

    // Slow downward drag = soft drop while the finger is moving.
    if (dyTotal > CELL * 0.5 && vy > 0 && vy <= 1.5) {
      if (this.tryMove(0, 1)) {
        this.addScore(1);
        this.dropTimer = 0;
        this.softDropping = true;
        this.touchMoved = true;
      }
    }

    // Unused local to avoid an unused-variable lint on vx; kept for parity
    // with the research doc in case a future change uses it for axis lock.
    void vx;

    this.touchLastX = x;
    this.touchLastY = y;
    this.touchLastTime = now;
  }

  protected handlePointerUp(_x: number, _y: number): void {
    // Always clear transient per-drag state regardless of game mode so we
    // don't leak into the next pointer session.
    this.softDropping = false;

    if (this.isOver || this.clearTimer > 0) return;

    const elapsed = performance.now() - this.touchStartTime;

    // Tap = rotate CW. Modern Guideline apps treat the whole playfield as
    // a rotate target; the old tap-zone split caused off-center misfires.
    if (!this.touchMoved && elapsed < 300) {
      this.tryRotate(1);
    }
  }

  /** Trackpad two-finger scroll / mouse wheel. Accumulates deltaY in px
   *  (normalizing deltaMode) and triggers soft-drop steps when the threshold
   *  is crossed. A large single-event deltaY becomes a hard drop. A 180 ms
   *  cooldown swallows macOS inertia tails. */
  protected handleWheel(e: WheelEvent): void {
    // Stop the page from scrolling under the canvas.
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (this.isOver || this.clearTimer > 0) return;

    const STEP = 40;                   // px per soft-drop trigger
    const HARD_DROP_THRESHOLD = 300;   // single-event delta that jumps to hard drop
    const COOLDOWN_MS = 180;

    // Normalize deltaMode: 0 = pixels, 1 = lines, 2 = pages.
    let px = e.deltaY;
    if (e.deltaMode === 1) px *= 16;       // ~1 line ≈ 16 px
    else if (e.deltaMode === 2) px *= 400; // ~1 page ≈ 400 px

    // Huge single event = hard drop, once per cooldown.
    const now = performance.now();
    if (Math.abs(px) >= HARD_DROP_THRESHOLD && Math.abs(px) > Math.abs(e.deltaX) * 2) {
      if (now - this.lastWheelTriggerTime >= COOLDOWN_MS) {
        this.hardDrop();
        this.lastWheelTriggerTime = now;
        this.wheelAccumY = 0;
      }
      return;
    }

    this.wheelAccumY += px;

    // Sustained scroll = repeated soft-drop steps.
    let guard = 20;
    while (this.wheelAccumY >= STEP && guard-- > 0) {
      if (now - this.lastWheelTriggerTime < COOLDOWN_MS) break;
      if (this.tryMove(0, 1)) {
        this.addScore(1);
        this.dropTimer = 0;
      }
      this.wheelAccumY -= STEP;
      this.lastWheelTriggerTime = now;
    }
    // Clamp negative accumulator so momentum-induced oscillation doesn't
    // build up a huge backlog.
    if (this.wheelAccumY < -STEP) this.wheelAccumY = -STEP;
  }
}

// Self-register this game
registerGame({
  id: 'block-drop',
  name: 'Block Drop',
  description: 'Classic falling blocks puzzle',
  icon: '\u2B22',
  color: '--game-block-drop',
  bgGradient: ['#4A90D9', '#7CB8E8'],
  category: 'puzzle',
  createGame: (config) => new BlockDropGame(config),
  canvasWidth: 300,
  canvasHeight: 540,
  controls: 'Arrows/Touch to move, Up/Tap to rotate, Space to drop',
});
