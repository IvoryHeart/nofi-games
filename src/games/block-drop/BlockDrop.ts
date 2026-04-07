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

// Wall kick data for SRS (simplified)
const WALL_KICKS: number[][][] = [
  // Standard kicks for J, L, S, T, Z
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
];

const WALL_KICKS_I: number[][][] = [
  [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
];

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

  // Touch input tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private touchMoved = false;
  private swipeHandled = false;

  // Bag randomizer for fair piece distribution
  private bag: number[] = [];

  // Lock delay: brief pause before locking piece after landing
  private lockTimer = 0;
  private readonly LOCK_DELAY = 0.5;
  private isLanding = false;

  constructor(config: GameConfig) {
    super(config);
  }

  private computeLayout(): void {
    this.CELL = Math.floor(this.height / 22); // 20 rows + 2 for margins
    const boardWidth = COLS * this.CELL;
    this.boardOffsetX = Math.floor((this.width - boardWidth) / 2);
    // Ensure the board doesn't go off-screen on the left if canvas is tiny
    if (this.boardOffsetX < 0) this.boardOffsetX = 0;
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
        const gapCol = Math.floor(Math.random() * COLS);
        for (let c = 0; c < COLS; c++) {
          if (c !== gapCol) {
            // Random piece color for garbage
            this.grid[row][c] = Math.floor(Math.random() * COLORS.length);
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

    this.next = this.spawnPiece();
    this.advancePiece();
  }

  private nextFromBag(): number {
    if (this.bag.length === 0) {
      // Refill bag with one of each piece, then shuffle
      this.bag = [0, 1, 2, 3, 4, 5, 6];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
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

    const kicks = this.current.type === 0 ? WALL_KICKS_I : WALL_KICKS;
    const kickIndex = oldRotation; // simplified kick table selection

    const test: Piece = { ...this.current, rotation: newRotation };

    for (const [kx, ky] of kicks[kickIndex]) {
      test.x = this.current.x + kx;
      test.y = this.current.y - ky; // y is inverted in our grid
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
    ctx.translate(this.boardOffsetX, this.CELL); // 1-cell top margin

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

  private drawWell(): void {
    const ctx = this.ctx;
    const CELL = this.CELL;

    // Draw grid lines
    ctx.strokeStyle = '#F0E4D4';
    ctx.lineWidth = 0.5;

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
    const boardTop = CELL; // 1-cell top margin

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

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (this.isOver || this.clearTimer > 0) return;

    switch (key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.tryMove(-1, 0);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.tryMove(1, 0);
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
        this.tryRotate(-1); // Counter-clockwise rotation
        break;
      case 'x':
      case 'X':
        this.tryRotate(1); // Clockwise rotation
        break;
    }
  }

  protected handleKeyUp(key: string, _e: KeyboardEvent): void {
    if (key === 'ArrowDown') {
      this.softDropping = false;
    }
  }

  protected handlePointerDown(x: number, y: number): void {
    if (this.isOver || this.clearTimer > 0) return;

    this.touchStartX = x;
    this.touchStartY = y;
    this.touchStartTime = performance.now();
    this.touchMoved = false;
    this.swipeHandled = false;
  }

  protected handlePointerMove(x: number, y: number): void {
    if (this.isOver || this.clearTimer > 0) return;

    const dx = x - this.touchStartX;
    const dy = y - this.touchStartY;
    const CELL = this.CELL;

    // Detect horizontal swipe to move piece
    if (Math.abs(dx) > CELL && !this.swipeHandled) {
      const steps = Math.floor(Math.abs(dx) / CELL);
      const dir = dx > 0 ? 1 : -1;
      for (let i = 0; i < steps; i++) {
        this.tryMove(dir, 0);
      }
      this.touchStartX = x;
      this.touchMoved = true;
    }

    // Detect downward swipe for hard drop
    if (dy > CELL * 2 && !this.swipeHandled) {
      this.hardDrop();
      this.swipeHandled = true;
      this.touchMoved = true;
    }
  }

  protected handlePointerUp(x: number, _y: number): void {
    if (this.isOver || this.clearTimer > 0) return;

    const elapsed = performance.now() - this.touchStartTime;
    const CELL = this.CELL;

    // Quick tap (not a swipe) -> rotate or move based on position
    if (!this.touchMoved && elapsed < 300) {
      const wellLeft = this.boardOffsetX;
      const wellRight = this.boardOffsetX + COLS * CELL;
      const wellWidth = COLS * CELL;
      if (this.touchStartY < CELL * 4) {
        // Tap in top area -> rotate
        this.tryRotate(1);
      } else if (x < wellLeft + wellWidth / 3) {
        // Tap left third -> move left
        this.tryMove(-1, 0);
      } else if (x > wellLeft + wellWidth * 2 / 3) {
        // Tap right third -> move right
        this.tryMove(1, 0);
      } else {
        // Tap center -> rotate
        this.tryRotate(1);
      }
    }
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
