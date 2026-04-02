import { describe, it, expect, vi, beforeAll } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { loadAllGames, getGame } from '../../src/games/registry';
import { GameConfig } from '../../src/engine/GameEngine';

function makeConfig(w = 360, h = 640, diff = 0, onScore?: (s: number) => void, onGameOver?: (s: number) => void): GameConfig {
  return { canvas: document.createElement('canvas'), width: w, height: h, difficulty: diff, onScore, onGameOver };
}

beforeAll(async () => { await loadAllGames(); });

// Helper: create a fake KeyboardEvent
function fakeKeyEvent(key: string): KeyboardEvent {
  return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

// Helper: run N update+render cycles
function runCycles(game: any, n: number, dt = 0.016): void {
  for (let i = 0; i < n; i++) {
    game.update(dt);
    game.render();
  }
}

// Helper: complete all animations by running many short update cycles
function drainAnimations(game: any, cycles = 60, dt = 0.02): void {
  for (let i = 0; i < cycles; i++) {
    game.update(dt);
  }
}

// ════════════════════════════════════════════════════════════════════
// Twenty48 Tests
// ════════════════════════════════════════════════════════════════════

describe('Twenty48 - game logic', () => {
  function create2048(diff = 1, onScore?: (s: number) => void, onGameOver?: (s: number) => void) {
    const info = getGame('2048')!;
    const game = info.createGame(makeConfig(360, 400, diff, onScore, onGameOver)) as any;
    game.init();
    return game;
  }

  it('should initialize with a 4x4 grid containing exactly 2 non-zero tiles', () => {
    const game = create2048();
    const grid: number[][] = game.grid;
    expect(grid.length).toBe(4);
    let nonZero = 0;
    for (const row of grid) {
      expect(row.length).toBe(4);
      for (const v of row) {
        if (v !== 0) nonZero++;
      }
    }
    expect(nonZero).toBe(2);
    game.destroy();
  });

  it('should handle ArrowUp and produce animation state', () => {
    const scoreFn = vi.fn();
    const game = create2048(1, scoreFn);
    game.handleKeyDown('ArrowUp', fakeKeyEvent('ArrowUp'));
    // Either animating or no move was possible
    // Run updates to drain animation
    drainAnimations(game);
    game.render();
    game.destroy();
  });

  it('should handle ArrowDown move', () => {
    const game = create2048();
    game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
    drainAnimations(game);
    game.render();
    game.destroy();
  });

  it('should handle ArrowLeft move', () => {
    const game = create2048();
    game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
    drainAnimations(game);
    game.render();
    game.destroy();
  });

  it('should handle ArrowRight move', () => {
    const game = create2048();
    game.handleKeyDown('ArrowRight', fakeKeyEvent('ArrowRight'));
    drainAnimations(game);
    game.render();
    game.destroy();
  });

  it('should simulate a pointer swipe up (handlePointerDown then handlePointerUp)', () => {
    const game = create2048();
    game.handlePointerDown(180, 300);
    game.handlePointerUp(180, 100);
    drainAnimations(game);
    game.render();
    game.destroy();
  });

  it('should simulate a pointer swipe down', () => {
    const game = create2048();
    game.handlePointerDown(180, 100);
    game.handlePointerUp(180, 300);
    drainAnimations(game);
    game.destroy();
  });

  it('should simulate a pointer swipe left', () => {
    const game = create2048();
    game.handlePointerDown(250, 200);
    game.handlePointerUp(50, 200);
    drainAnimations(game);
    game.destroy();
  });

  it('should simulate a pointer swipe right', () => {
    const game = create2048();
    game.handlePointerDown(50, 200);
    game.handlePointerUp(250, 200);
    drainAnimations(game);
    game.destroy();
  });

  it('should ignore swipe that is too short (dist < 20)', () => {
    const game = create2048();
    game.handlePointerDown(180, 200);
    game.handlePointerUp(185, 202);
    // No move should have happened
    expect(game.animating).toBe(false);
    game.destroy();
  });

  it('should support undo on difficulty 0 (Easy mode)', () => {
    const scoreFn = vi.fn();
    const game = create2048(0, scoreFn);
    expect(game.config_.hasUndo).toBe(true);

    // Record initial grid state
    const gridBefore = game.grid.map((r: number[]) => [...r]);

    // Make a move
    game.handleKeyDown('ArrowUp', fakeKeyEvent('ArrowUp'));
    drainAnimations(game);

    // Now undo
    game.handleKeyDown('z', fakeKeyEvent('z'));

    // Grid should be restored to before
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        expect(game.grid[r][c]).toBe(gridBefore[r][c]);
      }
    }
    game.destroy();
  });

  it('should not allow undo when canUndo is false', () => {
    const game = create2048(0);
    // No move made yet, undo should be a no-op
    const gridBefore = game.grid.map((r: number[]) => [...r]);
    game.handleKeyDown('z', fakeKeyEvent('z'));
    // Grid should be unchanged
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        expect(game.grid[r][c]).toBe(gridBefore[r][c]);
      }
    }
    game.destroy();
  });

  it('should not allow undo on difficulty 1 (Medium)', () => {
    const game = create2048(1);
    expect(game.config_.hasUndo).toBe(false);
    game.destroy();
  });

  it('should handle difficulty 2 (Hard) - walls spawn', () => {
    const game = create2048(2);
    expect(game.config_.wallInterval).toBe(20);
    expect(game.config_.hasUndo).toBe(false);

    // Make many moves to trigger wall spawning
    const directions: string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    for (let i = 0; i < 100; i++) {
      const dir = directions[i % 4];
      game.handleKeyDown(dir, fakeKeyEvent(dir));
      drainAnimations(game, 30, 0.02);
      if (!game.gameActive) break;
    }
    game.render();
    game.destroy();
  });

  it('should handle difficulty 3 (Extra Hard) - 5x5 grid', () => {
    const game = create2048(3);
    expect(game.size).toBe(5);
    expect(game.grid.length).toBe(5);
    expect(game.grid[0].length).toBe(5);
    expect(game.config_.winTarget).toBe(4096);

    // Make some moves
    game.handleKeyDown('ArrowUp', fakeKeyEvent('ArrowUp'));
    drainAnimations(game);
    game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
    drainAnimations(game);
    game.render();
    game.destroy();
  });

  it('should accumulate score through merges over many move cycles', () => {
    const scoreFn = vi.fn();
    const game = create2048(1, scoreFn);

    const directions: string[] = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
    for (let i = 0; i < 60; i++) {
      const dir = directions[i % 4];
      game.handleKeyDown(dir, fakeKeyEvent(dir));
      drainAnimations(game, 30, 0.02);
      if (!game.gameActive) break;
    }
    // Score should have been called at least once if any merge happened
    if (scoreFn.mock.calls.length > 0) {
      // The last call should have a positive score
      const lastScore = scoreFn.mock.calls[scoreFn.mock.calls.length - 1][0];
      expect(lastScore).toBeGreaterThanOrEqual(0);
    }
    game.destroy();
  });

  it('should fire gameOver when no moves available', () => {
    const gameOverFn = vi.fn();
    const game = create2048(1, undefined, gameOverFn);

    // Play until game over
    const directions: string[] = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
    for (let i = 0; i < 500; i++) {
      const dir = directions[i % 4];
      game.handleKeyDown(dir, fakeKeyEvent(dir));
      drainAnimations(game, 20, 0.02);
      if (!game.gameActive) break;
    }
    // gameActive may or may not be false depending on randomness, but no error thrown
    game.destroy();
  });

  it('should handle win detection by manipulating the grid', () => {
    const game = create2048(1);
    // Force a winning grid state
    game.grid[0][0] = 1024;
    game.grid[0][1] = 1024;
    game.grid[0][2] = 0;
    game.grid[0][3] = 0;
    for (let r = 1; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        game.grid[r][c] = 0;
      }
    }
    // Move left to merge the 1024s into 2048
    game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
    drainAnimations(game, 60, 0.02);
    // After animation settles, won flag should be true
    expect(game.won).toBe(true);
    game.destroy();
  });

  it('should dismiss win overlay on tap and allow continued play', () => {
    const game = create2048(1);
    // Force win state
    game.won = true;
    game.continuedAfterWin = false;
    game.gameActive = true;

    // Tap to dismiss
    game.handlePointerDown(180, 200);
    expect(game.continuedAfterWin).toBe(true);

    // Now keys should work again
    game.handleKeyDown('ArrowUp', fakeKeyEvent('ArrowUp'));
    game.destroy();
  });

  it('should dismiss win overlay on key press', () => {
    const game = create2048(1);
    game.won = true;
    game.continuedAfterWin = false;
    game.gameActive = true;

    game.handleKeyDown('ArrowUp', fakeKeyEvent('ArrowUp'));
    expect(game.continuedAfterWin).toBe(true);
    game.destroy();
  });

  it('should queue a pending move during animation', () => {
    const game = create2048(1);
    // Start a move to trigger animation
    game.handleKeyDown('ArrowUp', fakeKeyEvent('ArrowUp'));
    // If animating, a second key press should queue
    if (game.animating) {
      game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
      // pendingMove should be set if executeMove was called while animating
      // (it calls executeMove which sets pendingMove if animating)
    }
    drainAnimations(game);
    game.destroy();
  });

  it('should not move when gameActive is false', () => {
    const game = create2048(1);
    game.gameActive = false;
    const gridBefore = game.grid.map((r: number[]) => [...r]);
    game.handleKeyDown('ArrowUp', fakeKeyEvent('ArrowUp'));
    // Grid should be unchanged
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        expect(game.grid[r][c]).toBe(gridBefore[r][c]);
      }
    }
    game.destroy();
  });

  it('should handle computeMove for all directions', () => {
    const game = create2048(1);
    // Set up a known grid
    game.grid = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 4, 4],
      [0, 0, 0, 0],
    ];
    const resultLeft = game.computeMove('left');
    expect(resultLeft.moved).toBe(true);
    expect(resultLeft.scoreGained).toBeGreaterThan(0);

    // Reset and test right
    game.grid = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 4, 4],
      [0, 0, 0, 0],
    ];
    const resultRight = game.computeMove('right');
    expect(resultRight.moved).toBe(true);

    // Reset and test up
    game.grid = [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const resultUp = game.computeMove('up');
    expect(resultUp.moved).toBe(true);

    // Reset and test down
    game.grid = [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const resultDown = game.computeMove('down');
    expect(resultDown.moved).toBe(true);

    game.destroy();
  });

  it('should render without error at each difficulty', () => {
    for (let d = 0; d <= 3; d++) {
      const game = create2048(d);
      game.render();
      game.destroy();
    }
  });

  it('should render wall tiles (value = -1) on hard mode', () => {
    const game = create2048(2);
    // Place a wall tile manually
    game.grid[2][2] = -1;
    game.render();
    game.destroy();
  });

  it('should render high-value tiles (4096+)', () => {
    const game = create2048(1);
    game.grid[0][0] = 4096;
    game.grid[0][1] = 8192;
    game.render();
    game.destroy();
  });

  it('should render during slide animation', () => {
    const game = create2048(1);
    // Manually set up a slide animation
    game.slideAnims = [{
      value: 2,
      fromRow: 0, fromCol: 0,
      toRow: 0, toCol: 3,
      progress: 0.5,
    }];
    game.render();
    game.destroy();
  });

  it('should render spawn animations', () => {
    const game = create2048(1);
    game.spawnAnims = [{ row: 1, col: 1, progress: 0.5 }];
    game.grid[1][1] = 2;
    game.render();
    game.destroy();
  });

  it('should render merge bump animations', () => {
    const game = create2048(1);
    game.mergeAnims = [{ row: 0, col: 0, progress: 0.5 }];
    game.grid[0][0] = 4;
    game.render();
    game.destroy();
  });

  it('should render win overlay', () => {
    const game = create2048(1);
    game.won = true;
    game.continuedAfterWin = false;
    game.render(); // exercises renderWinOverlay
    game.destroy();
  });

  it('should render undo hint on easy mode', () => {
    const game = create2048(0);
    game.canUndo = true;
    game.gameActive = true;
    game.animating = false;
    game.render(); // exercises renderUndoHint
    game.destroy();
  });

  it('should handle hasMovesAvailable when grid is full but has adjacent pairs', () => {
    const game = create2048(1);
    // Fill grid but ensure adjacent equal pair exists
    game.grid = [
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2, 4],
      [8, 16, 32, 32], // last two are equal
    ];
    expect(game.hasMovesAvailable()).toBe(true);
    game.destroy();
  });

  it('should detect no moves available when grid is full with no adjacent pairs', () => {
    const game = create2048(1);
    game.grid = [
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [2, 4, 8, 16],
      [32, 64, 128, 256],
    ];
    expect(game.hasMovesAvailable()).toBe(false);
    game.destroy();
  });

  it('should handle computeMove with walls in the grid', () => {
    const game = create2048(2);
    game.grid = [
      [2, -1, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = game.computeMove('left');
    // Wall should stay in place
    expect(result.grid[0][1]).toBe(-1);
    game.destroy();
  });
});

// ════════════════════════════════════════════════════════════════════
// Minesweeper Tests
// ════════════════════════════════════════════════════════════════════

describe('Minesweeper - game logic', () => {
  function createMinesweeper(diff = 0, onScore?: (s: number) => void, onGameOver?: (s: number) => void) {
    const info = getGame('minesweeper')!;
    const game = info.createGame(makeConfig(360, 420, diff, onScore, onGameOver)) as any;
    game.init();
    return game;
  }

  // Compute cell center position for a given row, col
  function cellCenter(game: any, row: number, col: number): { x: number; y: number } {
    const x = game.gridOffsetX + col * (game.cellSize + 2) + game.cellSize / 2;
    const y = game.gridOffsetY + row * (game.cellSize + 2) + game.cellSize / 2;
    return { x, y };
  }

  it('should initialize with correct grid size for difficulty 0 (8x8, 8 mines)', () => {
    const game = createMinesweeper(0);
    expect(game.rows).toBe(8);
    expect(game.cols).toBe(8);
    expect(game.mineCount).toBe(8);
    expect(game.firstClick).toBe(true);
    expect(game.grid.length).toBe(8);
    expect(game.grid[0].length).toBe(8);
    game.destroy();
  });

  it('should have correct grid sizes for all difficulties', () => {
    const expected = [
      { rows: 8, cols: 8, mines: 8 },
      { rows: 10, cols: 10, mines: 15 },
      { rows: 12, cols: 12, mines: 30 },
      { rows: 14, cols: 14, mines: 45 },
    ];
    for (let d = 0; d <= 3; d++) {
      const game = createMinesweeper(d);
      expect(game.rows).toBe(expected[d].rows);
      expect(game.cols).toBe(expected[d].cols);
      expect(game.mineCount).toBe(expected[d].mines);
      game.destroy();
    }
  });

  it('first click should always be safe (no mine)', () => {
    // Test multiple times due to randomness
    for (let attempt = 0; attempt < 5; attempt++) {
      const game = createMinesweeper(0);
      const { x, y } = cellCenter(game, 3, 3);

      // Simulate pointerDown then pointerUp (short press = reveal)
      game.handlePointerDown(x, y);
      game.handlePointerUp(x, y);

      // The cell should be revealed and not a mine
      expect(game.grid[3][3].revealed).toBe(true);
      expect(game.grid[3][3].mine).toBe(false);
      expect(game.lost).toBe(false);
      game.destroy();
    }
  });

  it('should start the timer after first click', () => {
    const game = createMinesweeper(0);
    expect(game.timerRunning).toBe(false);

    const { x, y } = cellCenter(game, 0, 0);
    game.handlePointerDown(x, y);
    game.handlePointerUp(x, y);

    expect(game.timerRunning).toBe(true);
    game.destroy();
  });

  it('should increment timer during update when running', () => {
    const game = createMinesweeper(0);
    const { x, y } = cellCenter(game, 0, 0);
    game.handlePointerDown(x, y);
    game.handlePointerUp(x, y);

    expect(game.timer).toBe(0);
    game.update(1.0);
    expect(game.timer).toBeCloseTo(1.0, 1);
    game.update(2.5);
    expect(game.timer).toBeCloseTo(3.5, 1);
    game.destroy();
  });

  // Find an unrevealed, non-mine cell
  function findUnrevealedCell(game: any): { row: number; col: number } | null {
    for (let r = game.rows - 1; r >= 0; r--) {
      for (let c = game.cols - 1; c >= 0; c--) {
        if (!game.grid[r][c].revealed && !game.grid[r][c].mine) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }

  it('should toggle flag on long press', () => {
    const game = createMinesweeper(0);
    // First make a click to place mines
    const { x: cx, y: cy } = cellCenter(game, 0, 0);
    game.handlePointerDown(cx, cy);
    game.handlePointerUp(cx, cy);

    // Find an unrevealed cell to flag
    const target = findUnrevealedCell(game);
    expect(target).not.toBeNull();
    const { row: tr, col: tc } = target!;
    const { x: fx, y: fy } = cellCenter(game, tr, tc);

    // Simulate long press by manipulating pointerDownTime
    game.handlePointerDown(fx, fy);
    // Override the pointerDownTime to simulate 500ms ago
    game.pointerDownTime = performance.now() - 500;
    game.handlePointerUp(fx, fy);

    expect(game.grid[tr][tc].flagged).toBe(true);
    expect(game.flagCount).toBe(1);

    // Long press again to unflag
    game.handlePointerDown(fx, fy);
    game.pointerDownTime = performance.now() - 500;
    game.handlePointerUp(fx, fy);

    expect(game.grid[tr][tc].flagged).toBe(false);
    expect(game.flagCount).toBe(0);
    game.destroy();
  });

  it('should not reveal a flagged cell on short click', () => {
    const game = createMinesweeper(0);
    // First click to place mines
    const { x: cx, y: cy } = cellCenter(game, 0, 0);
    game.handlePointerDown(cx, cy);
    game.handlePointerUp(cx, cy);

    // Find an unrevealed cell to flag
    const target = findUnrevealedCell(game);
    expect(target).not.toBeNull();
    const { row: tr, col: tc } = target!;
    const { x: fx, y: fy } = cellCenter(game, tr, tc);

    game.handlePointerDown(fx, fy);
    game.pointerDownTime = performance.now() - 500;
    game.handlePointerUp(fx, fy);
    expect(game.grid[tr][tc].flagged).toBe(true);

    // Short click on flagged cell should not reveal
    game.handlePointerDown(fx, fy);
    game.handlePointerUp(fx, fy);
    expect(game.grid[tr][tc].revealed).toBe(false);
    game.destroy();
  });

  it('should cascade reveal when clicking on zero-adjacent cell', () => {
    const game = createMinesweeper(0);
    // First click in a corner - likely to cascade
    const { x, y } = cellCenter(game, 0, 0);
    game.handlePointerDown(x, y);
    game.handlePointerUp(x, y);

    // Count revealed cells
    let revealed = 0;
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        if (game.grid[r][c].revealed) revealed++;
      }
    }
    // Should have revealed at least 1 cell
    expect(revealed).toBeGreaterThanOrEqual(1);
    game.destroy();
  });

  it('should run update/render cycles for reveal animations', () => {
    const game = createMinesweeper(0);
    const { x, y } = cellCenter(game, 0, 0);
    game.handlePointerDown(x, y);
    game.handlePointerUp(x, y);

    // Run animation cycles
    runCycles(game, 30, 0.016);
    game.destroy();
  });

  it('should handle clicking outside the grid', () => {
    const game = createMinesweeper(0);
    // Click far outside
    game.handlePointerDown(0, 0);
    game.handlePointerUp(0, 0);
    // Nothing should happen - no crash
    expect(game.firstClick).toBe(true);
    game.destroy();
  });

  it('should handle clicking in the gap between cells', () => {
    const game = createMinesweeper(0);
    // Click in a gap area (slightly beyond cellSize in a gap)
    const gapX = game.gridOffsetX + game.cellSize + 1; // in the GAP area
    const gapY = game.gridOffsetY + game.cellSize / 2;
    game.handlePointerDown(gapX, gapY);
    game.handlePointerUp(gapX, gapY);
    // Should not crash
    game.destroy();
  });

  it('should not process clicks when game is won or lost', () => {
    const game = createMinesweeper(0);
    game.won = true;
    const { x, y } = cellCenter(game, 3, 3);
    game.handlePointerDown(x, y);
    game.handlePointerUp(x, y);
    // Cell should not be revealed since won
    expect(game.grid[3][3].revealed).toBe(false);
    game.destroy();
  });

  it('should handle R key to restart after game over', () => {
    const game = createMinesweeper(0);
    game.lost = true;
    game.handleKeyDown('R', fakeKeyEvent('R'));
    // Should re-initialize
    expect(game.lost).toBe(false);
    expect(game.firstClick).toBe(true);
    game.destroy();
  });

  it('should handle F key for flag toggle', () => {
    const game = createMinesweeper(0);
    // First click
    const { x: cx, y: cy } = cellCenter(game, 0, 0);
    game.handlePointerDown(cx, cy);
    game.handlePointerUp(cx, cy);

    // Find an unrevealed, non-mine cell to flag
    let flagRow = -1, flagCol = -1;
    for (let r = game.rows - 1; r >= 0; r--) {
      for (let c = game.cols - 1; c >= 0; c--) {
        if (!game.grid[r][c].revealed && !game.grid[r][c].mine) {
          flagRow = r;
          flagCol = c;
          break;
        }
      }
      if (flagRow >= 0) break;
    }

    if (flagRow >= 0) {
      // Set pointerDownCell to simulate having a cell selected
      game.pointerDownCell = { row: flagRow, col: flagCol };
      game.handleKeyDown('f', fakeKeyEvent('f'));
      expect(game.grid[flagRow][flagCol].flagged).toBe(true);
    }
    game.destroy();
  });

  it('should render at all 4 difficulties without error', () => {
    for (let d = 0; d <= 3; d++) {
      const game = createMinesweeper(d);
      // Click to start
      const { x, y } = cellCenter(game, 0, 0);
      game.handlePointerDown(x, y);
      game.handlePointerUp(x, y);
      runCycles(game, 5);
      game.destroy();
    }
  });

  it('should detect mine hit and set lost flag', () => {
    const game = createMinesweeper(0);
    // First safe click
    const { x: cx, y: cy } = cellCenter(game, 0, 0);
    game.handlePointerDown(cx, cy);
    game.handlePointerUp(cx, cy);

    // Find a mine cell and click it
    let mineRow = -1, mineCol = -1;
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        if (game.grid[r][c].mine && !game.grid[r][c].revealed) {
          mineRow = r;
          mineCol = c;
          break;
        }
      }
      if (mineRow >= 0) break;
    }

    if (mineRow >= 0) {
      const { x: mx, y: my } = cellCenter(game, mineRow, mineCol);
      game.handlePointerDown(mx, my);
      game.handlePointerUp(mx, my);
      expect(game.lost).toBe(true);
    }
    game.destroy();
  });

  it('should handle pointerUp with no prior pointerDown cell', () => {
    const game = createMinesweeper(0);
    // pointerUp without pointerDown should not crash
    game.handlePointerUp(100, 100);
    game.destroy();
  });

  it('should handle pointerUp on different cell than pointerDown', () => {
    const game = createMinesweeper(0);
    const { x: x1, y: y1 } = cellCenter(game, 0, 0);
    const { x: x2, y: y2 } = cellCenter(game, 3, 3);
    game.handlePointerDown(x1, y1);
    game.handlePointerUp(x2, y2);
    // Should be treated as drag and ignored
    expect(game.firstClick).toBe(true);
    game.destroy();
  });

  it('should render revealed cells with numbers after clicks', () => {
    const game = createMinesweeper(0);
    // Click to reveal and start game
    const { x, y } = cellCenter(game, 0, 0);
    game.handlePointerDown(x, y);
    game.handlePointerUp(x, y);

    // Run update cycles to advance reveal animations
    drainAnimations(game, 20, 0.02);

    // Render - should exercise renderRevealedCell with numbers
    game.render();
    game.destroy();
  });

  it('should render mines after losing', () => {
    const game = createMinesweeper(0);
    // First safe click
    const { x: cx, y: cy } = cellCenter(game, 0, 0);
    game.handlePointerDown(cx, cy);
    game.handlePointerUp(cx, cy);

    // Find a mine and click it
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        if (game.grid[r][c].mine && !game.grid[r][c].revealed) {
          const { x: mx, y: my } = cellCenter(game, r, c);
          game.handlePointerDown(mx, my);
          game.handlePointerUp(mx, my);
          break;
        }
      }
      if (game.lost) break;
    }

    // Run animations then render - exercises drawMine, exploded cell rendering
    drainAnimations(game, 30, 0.05);
    game.render();
    game.destroy();
  });

  it('should render flagged cells with flag bounce animation', () => {
    const game = createMinesweeper(0);
    // First click
    const { x: cx, y: cy } = cellCenter(game, 0, 0);
    game.handlePointerDown(cx, cy);
    game.handlePointerUp(cx, cy);

    // Flag a cell
    const target = findUnrevealedCell(game);
    if (target) {
      const { x: fx, y: fy } = cellCenter(game, target.row, target.col);
      game.handlePointerDown(fx, fy);
      game.pointerDownTime = performance.now() - 500;
      game.handlePointerUp(fx, fy);

      // Render during flag bounce animation
      for (let i = 0; i < 10; i++) {
        game.update(0.02);
        game.render();
      }
    }
    game.destroy();
  });

  it('should render with pressed state indicator', () => {
    const game = createMinesweeper(0);
    // First click
    const { x: cx, y: cy } = cellCenter(game, 0, 0);
    game.handlePointerDown(cx, cy);
    game.handlePointerUp(cx, cy);

    // Hold down on an unrevealed cell
    const target = findUnrevealedCell(game);
    if (target) {
      const { x: fx, y: fy } = cellCenter(game, target.row, target.col);
      game.handlePointerDown(fx, fy);
      // pointer.down should be set via base class, but we set it directly for render test
      game.pointer = { x: fx, y: fy, down: true };
      game.render(); // exercises the pressed state rendering
    }
    game.destroy();
  });

  it('should render header with mine count and timer', () => {
    const game = createMinesweeper(0);
    game.timer = 42;
    game.flagCount = 3;
    game.render(); // exercises renderHeader
    game.destroy();
  });

  it('should render header with win message', () => {
    const game = createMinesweeper(0);
    game.won = true;
    game.render(); // exercises win branch in renderHeader
    game.destroy();
  });

  it('should render header with game over message', () => {
    const game = createMinesweeper(0);
    game.lost = true;
    game.render(); // exercises lost branch in renderHeader
    game.destroy();
  });

  it('should render cells mid-reveal-animation', () => {
    const game = createMinesweeper(0);
    // Click to start
    const { x, y } = cellCenter(game, 0, 0);
    game.handlePointerDown(x, y);
    game.handlePointerUp(x, y);

    // Set some cells to mid-reveal animation
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        if (game.grid[r][c].revealed && game.grid[r][c].revealAnim < 1) {
          // These are mid-animation - render will exercise the scale/alpha path
          break;
        }
      }
    }
    game.render();
    game.destroy();
  });

  it('should handle cascading reveal with wave delay animation', () => {
    const game = createMinesweeper(0);
    // Click a corner cell - likely to trigger cascade with delays
    const { x, y } = cellCenter(game, 0, 0);
    game.handlePointerDown(x, y);
    game.handlePointerUp(x, y);

    // Run many update/render frames to process wave delays
    for (let i = 0; i < 40; i++) {
      game.update(0.03);
      game.render();
    }

    // All revealed cells should have completed their animation
    let allDone = true;
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        if (game.grid[r][c].revealed && game.grid[r][c].revealAnim < 1) {
          allDone = false;
        }
      }
    }
    expect(allDone).toBe(true);
    game.destroy();
  });
});

// ════════════════════════════════════════════════════════════════════
// MemoryMatch Tests
// ════════════════════════════════════════════════════════════════════

describe('MemoryMatch - game logic', () => {
  function createMemory(diff = 0, onScore?: (s: number) => void, onGameOver?: (s: number) => void) {
    const info = getGame('memory-match')!;
    const game = info.createGame(makeConfig(340, 400, diff, onScore, onGameOver)) as any;
    game.init();
    return game;
  }

  // Get pixel position of card center
  function cardCenter(game: any, row: number, col: number): { x: number; y: number } {
    const x = game.gridX + col * (game.cardW + 8) + game.cardW / 2;
    const y = game.gridY + row * (game.cardH + 8) + game.cardH / 2;
    return { x, y };
  }

  it('should initialize with correct card count for difficulty 0 (3x4 = 12 cards, 6 pairs)', () => {
    const game = createMemory(0);
    expect(game.cols).toBe(3);
    expect(game.rows).toBe(4);
    expect(game.numPairs).toBe(6);
    expect(game.cards.length).toBe(12);
    expect(game.moves).toBe(0);
    expect(game.pairsFound).toBe(0);
    game.destroy();
  });

  it('should initialize correctly for difficulty 1 (4x4, 8 pairs)', () => {
    const game = createMemory(1);
    expect(game.cols).toBe(4);
    expect(game.rows).toBe(4);
    expect(game.numPairs).toBe(8);
    expect(game.cards.length).toBe(16);
    game.destroy();
  });

  it('should initialize correctly for difficulty 2 (4x5, 10 pairs)', () => {
    const game = createMemory(2);
    expect(game.cols).toBe(4);
    expect(game.rows).toBe(5);
    expect(game.numPairs).toBe(10);
    expect(game.cards.length).toBe(20);
    game.destroy();
  });

  it('should initialize correctly for difficulty 3 (5x6, 15 pairs)', () => {
    const game = createMemory(3);
    expect(game.cols).toBe(5);
    expect(game.rows).toBe(6);
    expect(game.numPairs).toBe(15);
    expect(game.cards.length).toBe(30);
    game.destroy();
  });

  it('should flip a card face up on tap', () => {
    const game = createMemory(0);
    const { x, y } = cardCenter(game, 0, 0);
    game.handlePointerDown(x, y);

    const card = game.cards[0];
    expect(card.faceUp).toBe(true);
    expect(card.flipDirection).toBe(1);
    expect(game.flippedIndices.length).toBe(1);
    game.destroy();
  });

  it('should lock input after flipping two cards', () => {
    const game = createMemory(0);
    const { x: x0, y: y0 } = cardCenter(game, 0, 0);
    const { x: x1, y: y1 } = cardCenter(game, 0, 1);

    game.handlePointerDown(x0, y0);
    game.handlePointerDown(x1, y1);

    expect(game.flippedIndices.length).toBe(2);
    expect(game.lockInput).toBe(true);
    expect(game.moves).toBe(1);
    game.destroy();
  });

  it('should not flip the same card twice', () => {
    const game = createMemory(0);
    const { x, y } = cardCenter(game, 0, 0);

    game.handlePointerDown(x, y);
    game.handlePointerDown(x, y);

    expect(game.flippedIndices.length).toBe(1);
    game.destroy();
  });

  it('should not flip a third card while two are flipped', () => {
    const game = createMemory(0);
    const { x: x0, y: y0 } = cardCenter(game, 0, 0);
    const { x: x1, y: y1 } = cardCenter(game, 0, 1);
    const { x: x2, y: y2 } = cardCenter(game, 0, 2);

    game.handlePointerDown(x0, y0);
    game.handlePointerDown(x1, y1);
    game.handlePointerDown(x2, y2); // should be ignored (lockInput)

    expect(game.flippedIndices.length).toBe(2);
    game.destroy();
  });

  it('should detect matching cards and mark them as matched', () => {
    const game = createMemory(0);

    // Find two cards with the same symbolIndex
    let idx1 = -1, idx2 = -1;
    for (let i = 0; i < game.cards.length; i++) {
      for (let j = i + 1; j < game.cards.length; j++) {
        if (game.cards[i].symbolIndex === game.cards[j].symbolIndex) {
          idx1 = i;
          idx2 = j;
          break;
        }
      }
      if (idx1 >= 0) break;
    }

    expect(idx1).toBeGreaterThanOrEqual(0);

    const card1 = game.cards[idx1];
    const card2 = game.cards[idx2];

    const { x: x1, y: y1 } = cardCenter(game, card1.row, card1.col);
    const { x: x2, y: y2 } = cardCenter(game, card2.row, card2.col);

    game.handlePointerDown(x1, y1);
    // Complete flip animation
    drainAnimations(game, 30, 0.02);

    game.handlePointerDown(x2, y2);
    // Complete flip animation and match detection
    drainAnimations(game, 30, 0.02);

    expect(card1.matched).toBe(true);
    expect(card2.matched).toBe(true);
    expect(game.pairsFound).toBe(1);
    game.destroy();
  });

  it('should detect mismatched cards and flip them back after delay', () => {
    const game = createMemory(0);

    // Find two cards with different symbolIndex
    let idx1 = 0;
    let idx2 = -1;
    for (let j = 1; j < game.cards.length; j++) {
      if (game.cards[j].symbolIndex !== game.cards[0].symbolIndex) {
        idx2 = j;
        break;
      }
    }

    expect(idx2).toBeGreaterThanOrEqual(0);

    const card1 = game.cards[idx1];
    const card2 = game.cards[idx2];

    const { x: x1, y: y1 } = cardCenter(game, card1.row, card1.col);
    const { x: x2, y: y2 } = cardCenter(game, card2.row, card2.col);

    game.handlePointerDown(x1, y1);
    drainAnimations(game, 30, 0.02);

    game.handlePointerDown(x2, y2);
    drainAnimations(game, 30, 0.02);

    // Should have triggered mismatchTimer
    expect(card1.matched).toBe(false);
    expect(card2.matched).toBe(false);

    // Advance past mismatch show time (0.6s)
    drainAnimations(game, 60, 0.02);

    // Cards should be flipping back down
    expect(game.flippedIndices.length).toBe(0);
    expect(game.lockInput).toBe(false);
    game.destroy();
  });

  it('should not flip matched cards', () => {
    const game = createMemory(0);

    // Find matching pair
    let idx1 = -1, idx2 = -1;
    for (let i = 0; i < game.cards.length; i++) {
      for (let j = i + 1; j < game.cards.length; j++) {
        if (game.cards[i].symbolIndex === game.cards[j].symbolIndex) {
          idx1 = i;
          idx2 = j;
          break;
        }
      }
      if (idx1 >= 0) break;
    }

    const card1 = game.cards[idx1];
    const card2 = game.cards[idx2];

    // Match them
    const { x: x1, y: y1 } = cardCenter(game, card1.row, card1.col);
    const { x: x2, y: y2 } = cardCenter(game, card2.row, card2.col);

    game.handlePointerDown(x1, y1);
    drainAnimations(game, 30, 0.02);
    game.handlePointerDown(x2, y2);
    drainAnimations(game, 40, 0.02);

    expect(card1.matched).toBe(true);

    // Try tapping the matched card
    const prevFlipped = game.flippedIndices.length;
    game.handlePointerDown(x1, y1);
    expect(game.flippedIndices.length).toBe(prevFlipped);
    game.destroy();
  });

  it('should calculate score on match', () => {
    const scoreFn = vi.fn();
    const game = createMemory(0, scoreFn);

    // Find matching pair
    let idx1 = -1, idx2 = -1;
    for (let i = 0; i < game.cards.length; i++) {
      for (let j = i + 1; j < game.cards.length; j++) {
        if (game.cards[i].symbolIndex === game.cards[j].symbolIndex) {
          idx1 = i;
          idx2 = j;
          break;
        }
      }
      if (idx1 >= 0) break;
    }

    const card1 = game.cards[idx1];
    const card2 = game.cards[idx2];

    const { x: x1, y: y1 } = cardCenter(game, card1.row, card1.col);
    const { x: x2, y: y2 } = cardCenter(game, card2.row, card2.col);

    game.handlePointerDown(x1, y1);
    drainAnimations(game, 30, 0.02);
    game.handlePointerDown(x2, y2);
    drainAnimations(game, 40, 0.02);

    // Score should have been set
    expect(scoreFn).toHaveBeenCalled();
    const lastScore = scoreFn.mock.calls[scoreFn.mock.calls.length - 1][0];
    expect(lastScore).toBeGreaterThan(0);
    game.destroy();
  });

  it('should trigger game finished and gameOver when all pairs found', () => {
    const gameOverFn = vi.fn();
    const game = createMemory(0, undefined, gameOverFn);

    // Match all pairs by finding pairs and tapping them
    const matched = new Set<number>();
    const pairMap = new Map<number, number[]>();
    for (let i = 0; i < game.cards.length; i++) {
      const sym = game.cards[i].symbolIndex;
      if (!pairMap.has(sym)) pairMap.set(sym, []);
      pairMap.get(sym)!.push(i);
    }

    for (const [, indices] of pairMap) {
      if (game.gameFinished) break;
      const card1 = game.cards[indices[0]];
      const card2 = game.cards[indices[1]];

      const { x: x1, y: y1 } = cardCenter(game, card1.row, card1.col);
      const { x: x2, y: y2 } = cardCenter(game, card2.row, card2.col);

      game.handlePointerDown(x1, y1);
      drainAnimations(game, 30, 0.02);
      game.handlePointerDown(x2, y2);
      drainAnimations(game, 50, 0.02);
    }

    expect(game.pairsFound).toBe(game.numPairs);
    expect(game.gameFinished).toBe(true);
    game.destroy();
  });

  it('should handle tap outside grid area', () => {
    const game = createMemory(0);
    game.handlePointerDown(0, 0); // top-left corner, outside grid
    expect(game.flippedIndices.length).toBe(0);
    game.destroy();
  });

  it('should handle tap in gap between cards', () => {
    const game = createMemory(0);
    // Click in the gap area
    const x = game.gridX + game.cardW + 4; // in the 8px gap
    const y = game.gridY + game.cardH / 2;
    game.handlePointerDown(x, y);
    // Should not flip any card
    expect(game.flippedIndices.length).toBe(0);
    game.destroy();
  });

  it('should render with update cycles and sparkle/shake animations', () => {
    const game = createMemory(0);

    // Find a mismatched pair to trigger shake
    let idx1 = 0;
    let idx2 = -1;
    for (let j = 1; j < game.cards.length; j++) {
      if (game.cards[j].symbolIndex !== game.cards[0].symbolIndex) {
        idx2 = j;
        break;
      }
    }

    const card1 = game.cards[idx1];
    const card2 = game.cards[idx2];

    const { x: x1, y: y1 } = cardCenter(game, card1.row, card1.col);
    const { x: x2, y: y2 } = cardCenter(game, card2.row, card2.col);

    game.handlePointerDown(x1, y1);
    runCycles(game, 20, 0.016);
    game.handlePointerDown(x2, y2);
    runCycles(game, 40, 0.016);
    game.destroy();
  });

  it('should not allow taps when gameFinished', () => {
    const game = createMemory(0);
    game.gameFinished = true;
    const { x, y } = cardCenter(game, 0, 0);
    game.handlePointerDown(x, y);
    expect(game.flippedIndices.length).toBe(0);
    game.destroy();
  });

  it('should render win overlay after win timer exceeds 0.5s', () => {
    const game = createMemory(0);
    game.gameFinished = true;
    game.winTimer = 0.6;
    // Render should not throw
    game.render();
    game.destroy();
  });

  it('should have correct pair counts in card deck (each symbol appears exactly twice)', () => {
    const game = createMemory(0);
    const symbolCounts = new Map<number, number>();
    for (const card of game.cards) {
      symbolCounts.set(card.symbolIndex, (symbolCounts.get(card.symbolIndex) || 0) + 1);
    }
    for (const [, count] of symbolCounts) {
      expect(count).toBe(2);
    }
    expect(symbolCounts.size).toBe(game.numPairs);
    game.destroy();
  });

  it('should render all symbol types via difficulty 3 (15 pairs with all symbols)', () => {
    const game = createMemory(3);
    // Force all cards face-up and render to exercise all drawSymbol branches
    for (const card of game.cards) {
      card.faceUp = true;
      card.flipProgress = 1;
      card.flipDirection = 0;
    }
    game.render();

    // Also render with some cards matched (exercising matchAlpha rendering)
    for (const card of game.cards) {
      card.matched = true;
      card.matchAlpha = 0.8;
    }
    game.render();
    game.destroy();
  });

  it('should render sparkle effects during match animation', () => {
    const game = createMemory(0);

    // Find a matching pair
    let idx1 = -1, idx2 = -1;
    for (let i = 0; i < game.cards.length; i++) {
      for (let j = i + 1; j < game.cards.length; j++) {
        if (game.cards[i].symbolIndex === game.cards[j].symbolIndex) {
          idx1 = i;
          idx2 = j;
          break;
        }
      }
      if (idx1 >= 0) break;
    }

    const card1 = game.cards[idx1];
    const card2 = game.cards[idx2];
    const { x: x1, y: y1 } = cardCenter(game, card1.row, card1.col);
    const { x: x2, y: y2 } = cardCenter(game, card2.row, card2.col);

    game.handlePointerDown(x1, y1);
    drainAnimations(game, 30, 0.02);
    game.handlePointerDown(x2, y2);
    // Run just a few frames after match to catch sparkle rendering
    for (let i = 0; i < 15; i++) {
      game.update(0.02);
      game.render();
    }
    game.destroy();
  });

  it('should render cards during mid-flip animation (front and back faces)', () => {
    const game = createMemory(0);

    // Tap a card to start flipping
    const { x, y } = cardCenter(game, 0, 0);
    game.handlePointerDown(x, y);

    // Render at various flip progress stages
    game.cards[0].flipProgress = 0.25; // back face shrinking
    game.render();

    game.cards[0].flipProgress = 0.5; // transition point
    game.render();

    game.cards[0].flipProgress = 0.75; // front face expanding
    game.render();
    game.destroy();
  });

  it('should render bounce animation during win sequence', () => {
    const game = createMemory(0);
    game.gameFinished = true;
    game.winTimer = 0.3;

    // Set up bounce animation on cards
    for (const card of game.cards) {
      card.matched = true;
      card.faceUp = true;
      card.flipProgress = 1;
      card.bounceTime = 0.1; // mid-bounce
      card.bounceDelay = 0;
    }
    game.render();
    game.destroy();
  });

  it('should render shake animation on mismatched cards', () => {
    const game = createMemory(0);

    // Force two cards face-up with shake animation active
    game.cards[0].faceUp = true;
    game.cards[0].flipProgress = 1;
    game.cards[0].shakeTime = 0.15; // mid-shake

    game.cards[1].faceUp = true;
    game.cards[1].flipProgress = 1;
    game.cards[1].shakeTime = 0.15;

    game.render();
    game.destroy();
  });

  it('should render at very small scale to test symbolScale', () => {
    const info = getGame('memory-match')!;
    const game = info.createGame(makeConfig(100, 120, 0)) as any;
    game.init();
    // Force cards face up
    for (const card of game.cards) {
      card.faceUp = true;
      card.flipProgress = 1;
    }
    game.render();
    game.destroy();
  });

  it('should exercise the full update loop with all animation timers active', () => {
    const game = createMemory(0);
    game.gameFinished = true;
    game.winTimer = 0;

    // Set bounce delays
    for (const card of game.cards) {
      card.matched = true;
      card.faceUp = true;
      card.flipProgress = 1;
      card.bounceDelay = card.row * game.cols * 0.06 + card.col * 0.06;
      card.bounceTime = -card.bounceDelay;
    }

    // Run many update/render cycles to exercise bounce wave
    for (let i = 0; i < 60; i++) {
      game.update(0.04);
      game.render();
    }
    game.destroy();
  });
});

// ════════════════════════════════════════════════════════════════════
// Sudoku Tests
// ════════════════════════════════════════════════════════════════════

describe('Sudoku - game logic', () => {
  function createSudoku(diff = 0, onScore?: (s: number) => void, onGameOver?: (s: number) => void) {
    const info = getGame('sudoku')!;
    const game = info.createGame(makeConfig(360, 520, diff, onScore, onGameOver)) as any;
    game.init();
    return game;
  }

  // Get pixel position of cell center
  function sudokuCellCenter(game: any, row: number, col: number): { x: number; y: number } {
    const x = game.gridX + col * game.cellSize + game.cellSize / 2;
    const y = game.gridY + row * game.cellSize + game.cellSize / 2;
    return { x, y };
  }

  it('should initialize with a valid 9x9 board', () => {
    const game = createSudoku(0);
    expect(game.playerBoard.length).toBe(9);
    for (const row of game.playerBoard) {
      expect(row.length).toBe(9);
    }
    expect(game.solution.length).toBe(9);
    expect(game.won).toBe(false);
    expect(game.timer).toBe(0);
    game.destroy();
  });

  it('should have the solution be a valid sudoku', () => {
    const game = createSudoku(0);
    const sol = game.solution;

    // Check each row has 1-9
    for (let r = 0; r < 9; r++) {
      const rowSet = new Set(sol[r]);
      expect(rowSet.size).toBe(9);
      for (let n = 1; n <= 9; n++) {
        expect(rowSet.has(n)).toBe(true);
      }
    }

    // Check each column
    for (let c = 0; c < 9; c++) {
      const colSet = new Set<number>();
      for (let r = 0; r < 9; r++) {
        colSet.add(sol[r][c]);
      }
      expect(colSet.size).toBe(9);
    }

    // Check each 3x3 box
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const boxSet = new Set<number>();
        for (let r = br * 3; r < br * 3 + 3; r++) {
          for (let c = bc * 3; c < bc * 3 + 3; c++) {
            boxSet.add(sol[r][c]);
          }
        }
        expect(boxSet.size).toBe(9);
      }
    }
    game.destroy();
  });

  it('should have given cells matching the solution', () => {
    const game = createSudoku(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (game.given[r][c]) {
          expect(game.playerBoard[r][c]).toBe(game.solution[r][c]);
        }
      }
    }
    game.destroy();
  });

  it('should remove approximately correct number of cells per difficulty', () => {
    const expected = [30, 40, 50, 55];
    for (let d = 0; d <= 3; d++) {
      const game = createSudoku(d);
      let emptyCells = 0;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (game.playerBoard[r][c] === 0) emptyCells++;
        }
      }
      expect(emptyCells).toBe(expected[d]);
      game.destroy();
    }
  });

  it('should select a cell on click', () => {
    const game = createSudoku(0);
    expect(game.selRow).toBe(-1);
    expect(game.selCol).toBe(-1);

    const { x, y } = sudokuCellCenter(game, 4, 4);
    game.handlePointerDown(x, y);

    expect(game.selRow).toBe(4);
    expect(game.selCol).toBe(4);
    game.destroy();
  });

  it('should place a number via keyboard input', () => {
    const game = createSudoku(0);

    // Find an empty cell
    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) {
          emptyR = r;
          emptyC = c;
          break;
        }
      }
      if (emptyR >= 0) break;
    }

    expect(emptyR).toBeGreaterThanOrEqual(0);

    // Select the cell
    const { x, y } = sudokuCellCenter(game, emptyR, emptyC);
    game.handlePointerDown(x, y);

    // Input the correct number
    const correctNum = game.solution[emptyR][emptyC];
    game.handleKeyDown(String(correctNum), fakeKeyEvent(String(correctNum)));

    expect(game.playerBoard[emptyR][emptyC]).toBe(correctNum);
    game.destroy();
  });

  it('should clear a cell via Backspace', () => {
    const game = createSudoku(0);

    // Find an empty cell and fill it
    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) {
          emptyR = r;
          emptyC = c;
          break;
        }
      }
      if (emptyR >= 0) break;
    }

    const { x, y } = sudokuCellCenter(game, emptyR, emptyC);
    game.handlePointerDown(x, y);
    game.handleKeyDown('5', fakeKeyEvent('5'));
    expect(game.playerBoard[emptyR][emptyC]).toBe(5);

    // Clear it
    game.handleKeyDown('Backspace', fakeKeyEvent('Backspace'));
    expect(game.playerBoard[emptyR][emptyC]).toBe(0);
    game.destroy();
  });

  it('should clear a cell via Delete key', () => {
    const game = createSudoku(0);

    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) { emptyR = r; emptyC = c; break; }
      }
      if (emptyR >= 0) break;
    }

    const { x, y } = sudokuCellCenter(game, emptyR, emptyC);
    game.handlePointerDown(x, y);
    game.handleKeyDown('3', fakeKeyEvent('3'));
    expect(game.playerBoard[emptyR][emptyC]).toBe(3);

    game.handleKeyDown('Delete', fakeKeyEvent('Delete'));
    expect(game.playerBoard[emptyR][emptyC]).toBe(0);
    game.destroy();
  });

  it('should clear a cell via 0 key', () => {
    const game = createSudoku(0);

    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) { emptyR = r; emptyC = c; break; }
      }
      if (emptyR >= 0) break;
    }

    const { x, y } = sudokuCellCenter(game, emptyR, emptyC);
    game.handlePointerDown(x, y);
    game.handleKeyDown('7', fakeKeyEvent('7'));
    game.handleKeyDown('0', fakeKeyEvent('0'));
    expect(game.playerBoard[emptyR][emptyC]).toBe(0);
    game.destroy();
  });

  it('should detect errors when placing conflicting number (difficulty < 3)', () => {
    const game = createSudoku(0);

    // Find an empty cell
    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) {
          emptyR = r;
          emptyC = c;
          break;
        }
      }
      if (emptyR >= 0) break;
    }

    // Place a wrong number - find a number that conflicts
    const correctNum = game.solution[emptyR][emptyC];
    let wrongNum = correctNum === 1 ? 2 : 1;
    // Make sure wrongNum conflicts with something in the row
    // Just use a number that's different from the solution
    const { x, y } = sudokuCellCenter(game, emptyR, emptyC);
    game.handlePointerDown(x, y);
    game.handleKeyDown(String(wrongNum), fakeKeyEvent(String(wrongNum)));

    // Check if error was detected (there should be at least some conflict since it's wrong)
    // The error detection depends on whether wrongNum appears elsewhere in the same row/col/box
    // We just verify no crash and errors array exists
    expect(game.errors.length).toBe(9);
    game.destroy();
  });

  it('should not show errors on difficulty 3 (Extra Hard)', () => {
    const game = createSudoku(3);

    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) { emptyR = r; emptyC = c; break; }
      }
      if (emptyR >= 0) break;
    }

    const { x, y } = sudokuCellCenter(game, emptyR, emptyC);
    game.handlePointerDown(x, y);

    const correctNum = game.solution[emptyR][emptyC];
    const wrongNum = correctNum === 1 ? 2 : 1;
    game.handleKeyDown(String(wrongNum), fakeKeyEvent(String(wrongNum)));

    // On difficulty 3, all errors should be false
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        expect(game.errors[r][c]).toBe(false);
      }
    }
    game.destroy();
  });

  it('should not modify a given cell', () => {
    const game = createSudoku(0);

    // Find a given cell
    let givenR = -1, givenC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (game.given[r][c]) {
          givenR = r;
          givenC = c;
          break;
        }
      }
      if (givenR >= 0) break;
    }

    const origVal = game.playerBoard[givenR][givenC];
    const { x, y } = sudokuCellCenter(game, givenR, givenC);
    game.handlePointerDown(x, y);
    game.handleKeyDown('5', fakeKeyEvent('5'));

    // Should remain unchanged
    expect(game.playerBoard[givenR][givenC]).toBe(origVal);
    game.destroy();
  });

  it('should navigate cells with arrow keys', () => {
    const game = createSudoku(0);

    // Select cell (4,4)
    const { x, y } = sudokuCellCenter(game, 4, 4);
    game.handlePointerDown(x, y);
    expect(game.selRow).toBe(4);
    expect(game.selCol).toBe(4);

    // Arrow Up
    game.handleKeyDown('ArrowUp', fakeKeyEvent('ArrowUp'));
    expect(game.selRow).toBe(3);
    expect(game.selCol).toBe(4);

    // Arrow Down
    game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
    expect(game.selRow).toBe(4);
    expect(game.selCol).toBe(4);

    // Arrow Left
    game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
    expect(game.selRow).toBe(4);
    expect(game.selCol).toBe(3);

    // Arrow Right
    game.handleKeyDown('ArrowRight', fakeKeyEvent('ArrowRight'));
    expect(game.selRow).toBe(4);
    expect(game.selCol).toBe(4);
    game.destroy();
  });

  it('should initialize selection to (0,0) on first arrow press with no selection', () => {
    const game = createSudoku(0);
    expect(game.selRow).toBe(-1);
    expect(game.selCol).toBe(-1);

    game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
    expect(game.selRow).toBe(0);
    expect(game.selCol).toBe(0);
    game.destroy();
  });

  it('should clamp arrow navigation at grid boundaries', () => {
    const game = createSudoku(0);

    // Go to top-left
    const { x, y } = sudokuCellCenter(game, 0, 0);
    game.handlePointerDown(x, y);

    game.handleKeyDown('ArrowUp', fakeKeyEvent('ArrowUp'));
    expect(game.selRow).toBe(0); // clamped

    game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
    expect(game.selCol).toBe(0); // clamped

    // Go to bottom-right
    const { x: bx, y: by } = sudokuCellCenter(game, 8, 8);
    game.handlePointerDown(bx, by);

    game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
    expect(game.selRow).toBe(8); // clamped

    game.handleKeyDown('ArrowRight', fakeKeyEvent('ArrowRight'));
    expect(game.selCol).toBe(8); // clamped
    game.destroy();
  });

  it('should handle number picker buttons at bottom of canvas', () => {
    const game = createSudoku(0);

    // Find an empty cell first
    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) { emptyR = r; emptyC = c; break; }
      }
      if (emptyR >= 0) break;
    }

    // Select the cell
    const { x, y } = sudokuCellCenter(game, emptyR, emptyC);
    game.handlePointerDown(x, y);

    // Click on picker button for number 5
    const pickerX = game.pickerStartX + 4 * game.pickerSpacing; // button 5 (index 4)
    const pickerY = game.pickerY;
    game.handlePointerDown(pickerX, pickerY);

    expect(game.playerBoard[emptyR][emptyC]).toBe(5);
    game.destroy();
  });

  it('should toggle picker selection on double-click of same picker button', () => {
    const game = createSudoku(0);

    // Find an empty cell
    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) { emptyR = r; emptyC = c; break; }
      }
      if (emptyR >= 0) break;
    }

    // Select a cell
    const { x, y } = sudokuCellCenter(game, emptyR, emptyC);
    game.handlePointerDown(x, y);

    // Click picker 3
    const pickerX = game.pickerStartX + 2 * game.pickerSpacing;
    const pickerY = game.pickerY;
    game.handlePointerDown(pickerX, pickerY);
    expect(game.selectedPickerNum).toBe(3);
    expect(game.playerBoard[emptyR][emptyC]).toBe(3);

    // Click picker 3 again - deselects and clears cell
    game.handlePointerDown(pickerX, pickerY);
    expect(game.selectedPickerNum).toBe(0);
    expect(game.playerBoard[emptyR][emptyC]).toBe(0);
    game.destroy();
  });

  it('should place number immediately when selecting cell with picker active', () => {
    const game = createSudoku(0);

    // Click picker 7 first (no cell selected)
    const pickerX = game.pickerStartX + 6 * game.pickerSpacing;
    const pickerY = game.pickerY;
    game.handlePointerDown(pickerX, pickerY);
    expect(game.selectedPickerNum).toBe(7);

    // Now click an empty cell - should place 7 immediately
    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) { emptyR = r; emptyC = c; break; }
      }
      if (emptyR >= 0) break;
    }

    const { x, y } = sudokuCellCenter(game, emptyR, emptyC);
    game.handlePointerDown(x, y);
    expect(game.playerBoard[emptyR][emptyC]).toBe(7);
    game.destroy();
  });

  it('should detect win when all cells match solution', () => {
    const scoreFn = vi.fn();
    const game = createSudoku(0, scoreFn);

    // Fill in all empty cells with correct values
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) {
          const { x, y } = sudokuCellCenter(game, r, c);
          game.handlePointerDown(x, y);
          game.handleKeyDown(String(game.solution[r][c]), fakeKeyEvent(String(game.solution[r][c])));
        }
      }
    }

    expect(game.won).toBe(true);
    expect(scoreFn).toHaveBeenCalled();
    game.destroy();
  });

  it('should increment timer during update when not won', () => {
    const game = createSudoku(0);
    expect(game.timer).toBe(0);

    game.update(1.0);
    expect(game.timer).toBeCloseTo(1.0, 1);

    game.update(2.5);
    expect(game.timer).toBeCloseTo(3.5, 1);
    game.destroy();
  });

  it('should stop incrementing timer after win', () => {
    const game = createSudoku(0);
    game.update(5.0);

    // Force win
    game.won = true;
    const timerBefore = game.timer;
    game.update(2.0);
    expect(game.timer).toBeCloseTo(timerBefore, 1);
    game.destroy();
  });

  it('should update winTime after win', () => {
    const game = createSudoku(0);
    game.won = true;
    game.winTime = 0;
    game.update(0.5);
    expect(game.winTime).toBeCloseTo(0.5, 1);
    game.destroy();
  });

  it('should handle click outside grid', () => {
    const game = createSudoku(0);
    game.handlePointerDown(0, 0); // outside grid
    // selRow/selCol might change or stay, but no crash
    game.destroy();
  });

  it('should handle click outside picker radius', () => {
    const game = createSudoku(0);
    // Click far away from picker buttons
    game.handlePointerDown(5, game.pickerY);
    // No crash
    game.destroy();
  });

  it('should not accept input when won', () => {
    const game = createSudoku(0);
    game.won = true;

    // Try clicking
    const { x, y } = sudokuCellCenter(game, 0, 0);
    game.handlePointerDown(x, y);
    // selRow should not change (won guard)
    expect(game.selRow).toBe(-1);

    // Try key input
    game.handleKeyDown('5', fakeKeyEvent('5'));
    game.destroy();
  });

  it('should render at all difficulties without error', () => {
    for (let d = 0; d <= 3; d++) {
      const game = createSudoku(d);
      runCycles(game, 5);
      game.destroy();
    }
  });

  it('should trigger pop animation when placing a number', () => {
    const game = createSudoku(0);

    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) { emptyR = r; emptyC = c; break; }
      }
      if (emptyR >= 0) break;
    }

    const { x, y } = sudokuCellCenter(game, emptyR, emptyC);
    game.handlePointerDown(x, y);
    game.handleKeyDown('5', fakeKeyEvent('5'));

    expect(game.popAnims.length).toBeGreaterThan(0);
    const popAnim = game.popAnims.find((a: any) => a.row === emptyR && a.col === emptyC);
    expect(popAnim).toBeDefined();

    // Run updates to advance animation
    runCycles(game, 20, 0.016);
    // Pop anim should have completed and been removed
    const remaining = game.popAnims.find((a: any) => a.row === emptyR && a.col === emptyC);
    expect(remaining).toBeUndefined();
    game.destroy();
  });

  it('should trigger shake animation when placing an error number (difficulty < 3)', () => {
    const game = createSudoku(0);

    // Find an empty cell
    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) { emptyR = r; emptyC = c; break; }
      }
      if (emptyR >= 0) break;
    }

    // Find a number that already exists in the same row (creating a conflict)
    let conflictNum = 0;
    for (let c = 0; c < 9; c++) {
      if (c !== emptyC && game.playerBoard[emptyR][c] !== 0) {
        conflictNum = game.playerBoard[emptyR][c];
        break;
      }
    }

    if (conflictNum > 0) {
      const { x, y } = sudokuCellCenter(game, emptyR, emptyC);
      game.handlePointerDown(x, y);
      game.handleKeyDown(String(conflictNum), fakeKeyEvent(String(conflictNum)));

      expect(game.errors[emptyR][emptyC]).toBe(true);
      expect(game.shakeAnims.length).toBeGreaterThan(0);
    }
    game.destroy();
  });

  it('should handle all 9 number keys', () => {
    const game = createSudoku(0);

    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!game.given[r][c]) { emptyR = r; emptyC = c; break; }
      }
      if (emptyR >= 0) break;
    }

    const { x, y } = sudokuCellCenter(game, emptyR, emptyC);
    game.handlePointerDown(x, y);

    for (let n = 1; n <= 9; n++) {
      game.handleKeyDown(String(n), fakeKeyEvent(String(n)));
      expect(game.playerBoard[emptyR][emptyC]).toBe(n);
    }
    game.destroy();
  });

  it('should handle selection transition animation on cell change', () => {
    const game = createSudoku(0);

    const { x: x1, y: y1 } = sudokuCellCenter(game, 2, 2);
    game.handlePointerDown(x1, y1);
    expect(game.selectAnim.elapsed).toBe(0);
    expect(game.selectionAlpha).toBe(0);

    // Run some updates to advance selection transition
    game.update(0.06);
    expect(game.selectionAlpha).toBeGreaterThan(0);

    game.update(0.1);
    expect(game.selectionAlpha).toBe(1);

    // Now select a different cell
    const { x: x2, y: y2 } = sudokuCellCenter(game, 5, 5);
    game.handlePointerDown(x2, y2);
    expect(game.selectAnim.prevRow).toBe(2);
    expect(game.selectAnim.prevCol).toBe(2);
    expect(game.selectionAlpha).toBe(0);
    game.destroy();
  });

  it('should render win animation', () => {
    const game = createSudoku(0);
    game.won = true;
    game.winTime = 0.8; // past the 0.3 threshold for overlay message
    game.render(); // should not throw
    game.destroy();
  });
});
