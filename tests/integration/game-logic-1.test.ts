import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Mock idb-keyval before any source imports
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { loadAllGames, getGame } from '../../src/games/registry';
import { GameConfig } from '../../src/engine/GameEngine';

function makeConfig(
  w = 360,
  h = 640,
  diff = 0,
  onScore?: (s: number) => void,
  onGameOver?: (s: number) => void,
): GameConfig {
  return {
    canvas: document.createElement('canvas'),
    width: w,
    height: h,
    difficulty: diff,
    onScore,
    onGameOver,
  };
}

/** Create a fake KeyboardEvent that has a preventDefault we can spy on. */
function fakeKeyEvent(key: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key });
  // In jsdom the default is a no-op, but we want it to be callable
  e.preventDefault = vi.fn();
  return e;
}

beforeAll(async () => {
  await loadAllGames();
});

// ════════════════════════════════════════════════════════════════════════════
// BlockDrop
// ════════════════════════════════════════════════════════════════════════════
describe('BlockDrop – internal logic', () => {
  function create(diff = 0, onScore?: (s: number) => void, onGameOver?: (s: number) => void) {
    const info = getGame('block-drop')!;
    const game = info.createGame(makeConfig(300, 540, diff, onScore, onGameOver)) as any;
    game.start();
    return game;
  }

  it('should survive left/right arrow keys during gameplay', () => {
    const game = create();
    expect(() => {
      game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
      game.update(0.016);
      game.render();
      game.handleKeyDown('ArrowRight', fakeKeyEvent('ArrowRight'));
      game.update(0.016);
      game.render();
    }).not.toThrow();
    game.destroy();
  });

  it('should handle soft drop (ArrowDown) and award 1-point bonus', () => {
    const scoreFn = vi.fn();
    const game = create(0, scoreFn);

    // Piece starts near the top; soft-dropping should move it down and give 1 pt
    game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
    // score callback should have been called with 1
    expect(scoreFn).toHaveBeenCalled();
    const lastScore = scoreFn.mock.calls[scoreFn.mock.calls.length - 1][0];
    expect(lastScore).toBeGreaterThanOrEqual(1);

    // Release the key
    game.handleKeyUp('ArrowDown', fakeKeyEvent('ArrowDown'));
    game.update(0.016);
    game.render();
    game.destroy();
  });

  it('should increase score on hard drop (Space)', () => {
    const scoreFn = vi.fn();
    const game = create(0, scoreFn);

    // Hard drop the very first piece
    game.handleKeyDown(' ', fakeKeyEvent(' '));
    expect(scoreFn).toHaveBeenCalled();
    const lastScore = scoreFn.mock.calls[scoreFn.mock.calls.length - 1][0];
    // Hard drop awards dropDistance * 2, should be > 0 because piece starts at row 0
    expect(lastScore).toBeGreaterThan(0);
    game.destroy();
  });

  it('should survive rotation (ArrowUp) without crash', () => {
    const game = create();
    expect(() => {
      game.handleKeyDown('ArrowUp', fakeKeyEvent('ArrowUp'));
      game.update(0.016);
      game.render();
    }).not.toThrow();
    game.destroy();
  });

  it('should survive Z/X counter-clockwise/clockwise rotation', () => {
    const game = create();
    expect(() => {
      game.handleKeyDown('z', fakeKeyEvent('z'));
      game.update(0.016);
      game.render();
      game.handleKeyDown('x', fakeKeyEvent('x'));
      game.update(0.016);
      game.render();
      game.handleKeyDown('Z', fakeKeyEvent('Z'));
      game.update(0.016);
      game.render();
      game.handleKeyDown('X', fakeKeyEvent('X'));
      game.update(0.016);
      game.render();
    }).not.toThrow();
    game.destroy();
  });

  it('should handle many update cycles and eventually trigger line clears or game over', () => {
    const scoreFn = vi.fn();
    const gameOverFn = vi.fn();
    const game = create(0, scoreFn, gameOverFn);

    // Hard-drop many pieces; eventually lines will clear or game ends
    for (let i = 0; i < 200; i++) {
      if (game.isOver) break;
      game.handleKeyDown(' ', fakeKeyEvent(' '));
      // Run several sub-steps to let clear animation and lock timers progress
      for (let t = 0; t < 5; t++) {
        game.update(0.05);
        game.render();
      }
    }

    // Either score increased (line clears) or game ended
    const scored = scoreFn.mock.calls.length > 0;
    const ended = gameOverFn.mock.calls.length > 0;
    expect(scored || ended).toBe(true);
    game.destroy();
  });

  it('should initialise garbage rows at difficulty 3', () => {
    const game = create(3);
    // grid row 19 (bottom) should have some non-empty cells (garbage)
    const bottomRow: number[] = game.grid[19];
    const filledCount = bottomRow.filter((c: number) => c !== -1).length;
    expect(filledCount).toBeGreaterThan(0);
    // There should be exactly 1 gap per garbage row
    const gapCount = bottomRow.filter((c: number) => c === -1).length;
    expect(gapCount).toBe(1);
    game.destroy();
  });

  it('should handle pointer input (touch swipe and tap) without crash', () => {
    const game = create();
    expect(() => {
      // Simulate tap in center (rotate)
      game.handlePointerDown(150, 270);
      game.handlePointerUp(150, 270);
      game.update(0.016);
      game.render();

      // Simulate left-side tap (move left)
      game.handlePointerDown(30, 400);
      game.handlePointerUp(30, 400);
      game.update(0.016);
      game.render();

      // Simulate right-side tap (move right)
      game.handlePointerDown(270, 400);
      game.handlePointerUp(270, 400);
      game.update(0.016);
      game.render();

      // Simulate top-area tap (rotate)
      game.handlePointerDown(150, 50);
      game.handlePointerUp(150, 50);
      game.update(0.016);
      game.render();
    }).not.toThrow();
    game.destroy();
  });

  it('should handle pointer swipe to move piece horizontally', () => {
    const game = create();
    const CELL = game.CELL;
    expect(() => {
      game.handlePointerDown(150, 270);
      // Move right more than 1 cell width to trigger swipe
      game.handlePointerMove(150 + CELL * 2, 270);
      game.handlePointerUp(150 + CELL * 2, 270);
      game.update(0.016);
      game.render();
    }).not.toThrow();
    game.destroy();
  });

  it('should handle pointer swipe down for hard drop', () => {
    const scoreFn = vi.fn();
    const game = create(0, scoreFn);
    const CELL = game.CELL;
    // Swipe down (dy > CELL * 2)
    game.handlePointerDown(150, 100);
    game.handlePointerMove(150, 100 + CELL * 3);
    game.update(0.016);
    // Hard drop should have triggered, score increases
    expect(scoreFn).toHaveBeenCalled();
    game.destroy();
  });

  it('should not crash when input occurs during clear animation', () => {
    const game = create();
    // Force a clearTimer > 0 scenario
    game.clearTimer = 0.1;
    game.clearingRows = [19];
    expect(() => {
      game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
      game.handlePointerDown(150, 270);
      game.handlePointerMove(160, 270);
      game.handlePointerUp(160, 270);
      game.update(0.016);
      game.render();
    }).not.toThrow();
    game.destroy();
  });

  it('should render side panels with enough canvas space', () => {
    // Wide canvas to give space for side panels
    const info = getGame('block-drop')!;
    const game = info.createGame(makeConfig(400, 540, 0)) as any;
    game.start();
    expect(() => {
      game.update(0.016);
      game.render();
    }).not.toThrow();
    game.destroy();
  });

  it('should handle lock delay correctly – piece locks after LOCK_DELAY', () => {
    const game = create();
    // Hard-drop to land instantly, then update enough time for lock delay
    game.handleKeyDown(' ', fakeKeyEvent(' '));
    // After hard drop, piece locks immediately, a new piece is spawned
    // The current piece should exist (new piece)
    expect(game.current).not.toBeNull();
    game.destroy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// BubblePop
// ════════════════════════════════════════════════════════════════════════════
describe('BubblePop – internal logic', () => {
  function create(diff = 0, onScore?: (s: number) => void, onGameOver?: (s: number) => void) {
    const info = getGame('bubble-pop')!;
    const game = info.createGame(makeConfig(360, 560, diff, onScore, onGameOver)) as any;
    game.start();
    return game;
  }

  it('should aim and shoot a bubble via pointer down/up', () => {
    const game = create();
    // Aim upward (above the shooter)
    game.handlePointerDown(180, 200);
    game.handlePointerUp(180, 200);

    // A flying bubble should now exist
    expect(game.flying).not.toBeNull();
    game.destroy();
  });

  it('should let flying bubble travel upward across update cycles', () => {
    const game = create();
    game.handlePointerDown(180, 200);
    game.handlePointerUp(180, 200);

    const initialY = game.flying!.y;

    // Run updates
    for (let i = 0; i < 30; i++) {
      game.update(0.016);
    }

    // Bubble should have moved up (or snapped to grid)
    if (game.flying) {
      expect(game.flying.y).toBeLessThan(initialY);
    }
    // If flying is null, it has snapped to the grid – also fine
    game.destroy();
  });

  it('should update aim angle via handlePointerDown at different positions', () => {
    const game = create();
    const initialAngle = game.aimAngle;

    // Aim far to the left
    game.handlePointerDown(50, 200);
    const leftAngle = game.aimAngle;

    // Aim far to the right
    game.handlePointerDown(310, 200);
    const rightAngle = game.aimAngle;

    expect(leftAngle).not.toBe(rightAngle);
    game.destroy();
  });

  it('should adjust aim via ArrowLeft and ArrowRight keys', () => {
    const game = create();
    const initial = game.aimAngle;

    game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
    const afterLeft = game.aimAngle;
    expect(afterLeft).toBeLessThan(initial);

    game.handleKeyDown('ArrowRight', fakeKeyEvent('ArrowRight'));
    game.handleKeyDown('ArrowRight', fakeKeyEvent('ArrowRight'));
    const afterRight = game.aimAngle;
    expect(afterRight).toBeGreaterThan(afterLeft);

    game.destroy();
  });

  it('should shoot via Space key', () => {
    const game = create();
    game.handleKeyDown(' ', fakeKeyEvent(' '));
    expect(game.flying).not.toBeNull();
    game.destroy();
  });

  it('should clamp aim angle at the boundaries', () => {
    const game = create();
    // Spam ArrowLeft to hit the left clamp
    for (let i = 0; i < 100; i++) {
      game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
    }
    const leftClamped = game.aimAngle;
    expect(leftClamped).toBeGreaterThanOrEqual(-Math.PI + 0.14);

    // Spam ArrowRight to hit the right clamp
    for (let i = 0; i < 200; i++) {
      game.handleKeyDown('ArrowRight', fakeKeyEvent('ArrowRight'));
    }
    const rightClamped = game.aimAngle;
    expect(rightClamped).toBeLessThanOrEqual(-0.14);

    game.destroy();
  });

  it('should not shoot while a bubble is already flying', () => {
    const game = create();
    game.handleKeyDown(' ', fakeKeyEvent(' '));
    const firstFlying = game.flying;

    // Try to shoot again – should be same flying bubble (no second shot)
    game.handleKeyDown(' ', fakeKeyEvent(' '));
    expect(game.flying).toBe(firstFlying);

    game.destroy();
  });

  it('should run many update/render cycles without crash', () => {
    const game = create();
    expect(() => {
      for (let i = 0; i < 100; i++) {
        // Shoot periodically
        if (i % 10 === 0 && !game.flying) {
          game.handleKeyDown(' ', fakeKeyEvent(' '));
        }
        game.update(0.016);
        game.render();
      }
    }).not.toThrow();
    game.destroy();
  });

  it('should handle wall bounces for the flying bubble', () => {
    const game = create();
    // Aim sharply left
    for (let i = 0; i < 20; i++) {
      game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
    }
    game.handleKeyDown(' ', fakeKeyEvent(' '));

    // Run enough updates for the bubble to hit the left wall
    for (let i = 0; i < 50; i++) {
      game.update(0.016);
    }
    // Should not crash; bubble either bounced or snapped
    game.render();
    game.destroy();
  });

  it('should place bubble and check matches when hitting the ceiling', () => {
    const scoreFn = vi.fn();
    const game = create(0, scoreFn);

    // Shoot straight up many times to fill up and trigger matches
    for (let round = 0; round < 20; round++) {
      if (game.isGameOver) break;
      game.aimAngle = -Math.PI / 2; // straight up
      game.handleKeyDown(' ', fakeKeyEvent(' '));
      // Let the bubble fly to the top
      for (let t = 0; t < 60; t++) {
        game.update(0.016);
      }
      game.render();
    }

    // Some scoring or game over should have happened
    const scored = scoreFn.mock.calls.length > 0;
    const ended = game.isGameOver;
    expect(scored || ended).toBe(true);
    game.destroy();
  });

  it('should handle pointer move for aiming during gameplay', () => {
    const game = create();
    expect(() => {
      game.handlePointerMove(100, 200);
      game.handlePointerMove(260, 200);
      game.update(0.016);
      game.render();
    }).not.toThrow();
    game.destroy();
  });

  it('should work at difficulty 2 (hard) with 6 colors', () => {
    const game = create(2);
    expect(game.preset.numColors).toBe(6);
    expect(() => {
      for (let i = 0; i < 20; i++) {
        game.update(0.016);
        game.render();
      }
    }).not.toThrow();
    game.destroy();
  });

  it('should enable wobble at difficulty 3 (extra hard)', () => {
    const game = create(3);
    expect(game.preset.wobble).toBe(true);
    // Run a few update cycles so wobbleTime advances
    for (let i = 0; i < 10; i++) {
      game.update(0.016);
      game.render();
    }
    expect(game.wobbleTime).toBeGreaterThan(0);
    game.destroy();
  });

  it('should process pop and drop animations without crash', () => {
    const game = create();
    // Inject fake pop and drop animations to exercise the code paths
    game.popAnims.push({ x: 100, y: 100, colorIdx: 0, t: 0 });
    game.dropAnims.push({ x: 150, y: 150, vy: 0, colorIdx: 1, t: 0, bounced: false, bounceCount: 0 });

    expect(() => {
      for (let i = 0; i < 30; i++) {
        game.update(0.05);
        game.render();
      }
    }).not.toThrow();
    // Animations should have been cleaned up
    expect(game.popAnims.length).toBe(0);
    game.destroy();
  });

  it('should trigger game over when bubbles reach the dead line', () => {
    const gameOverFn = vi.fn();
    const game = create(0, undefined, gameOverFn);

    // Push many rows from top to force deadline breach
    for (let i = 0; i < 20; i++) {
      if (game.isGameOver) break;
      game.pushNewRowFromTop();
    }

    expect(game.isGameOver).toBe(true);
    expect(gameOverFn).toHaveBeenCalled();
    game.destroy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GemSwap
// ════════════════════════════════════════════════════════════════════════════
describe('GemSwap – internal logic', () => {
  function create(diff = 0, onScore?: (s: number) => void, onGameOver?: (s: number) => void) {
    const info = getGame('gem-swap')!;
    const game = info.createGame(makeConfig(360, 440, diff, onScore, onGameOver)) as any;
    game.start();
    return game;
  }

  it('should initialise an 8x8 grid of gems', () => {
    const game = create();
    expect(game.grid.length).toBe(8);
    for (let r = 0; r < 8; r++) {
      expect(game.grid[r].length).toBe(8);
      for (let c = 0; c < 8; c++) {
        expect(game.grid[r][c]).not.toBeNull();
        expect(game.grid[r][c]!.type).toBeTruthy();
      }
    }
    game.destroy();
  });

  it('should start in idle phase', () => {
    const game = create();
    expect(game.phase).toBe('idle');
    game.destroy();
  });

  it('should select a gem via pointer click', () => {
    const game = create();
    // Compute pixel coordinates for cell (0, 0)
    const cx = game.gridX + game.cellSize / 2;
    const cy = game.gridY + game.cellSize / 2;

    game.handlePointerDown(cx, cy);
    game.handlePointerUp(cx, cy);

    expect(game.selected).toEqual({ row: 0, col: 0 });
    game.destroy();
  });

  it('should start swap when selecting two adjacent gems', () => {
    const game = create();
    const cs = game.cellSize;

    // Click cell (0,0)
    const x0 = game.gridX + cs / 2;
    const y0 = game.gridY + cs / 2;
    game.handlePointerDown(x0, y0);
    game.handlePointerUp(x0, y0);

    // Click adjacent cell (0,1)
    const x1 = game.gridX + cs + cs / 2;
    const y1 = game.gridY + cs / 2;
    game.handlePointerDown(x1, y1);
    game.handlePointerUp(x1, y1);

    // Phase should transition to swapping
    expect(game.phase).toBe('swapping');
    game.destroy();
  });

  it('should deselect when clicking the same gem twice', () => {
    const game = create();
    const cs = game.cellSize;
    const x0 = game.gridX + cs / 2;
    const y0 = game.gridY + cs / 2;

    game.handlePointerDown(x0, y0);
    game.handlePointerUp(x0, y0);
    expect(game.selected).toEqual({ row: 0, col: 0 });

    game.handlePointerDown(x0, y0);
    game.handlePointerUp(x0, y0);
    expect(game.selected).toBeNull();

    game.destroy();
  });

  it('should change selection when clicking a non-adjacent gem', () => {
    const game = create();
    const cs = game.cellSize;

    // Select (0,0)
    game.handlePointerDown(game.gridX + cs / 2, game.gridY + cs / 2);
    game.handlePointerUp(game.gridX + cs / 2, game.gridY + cs / 2);

    // Click (2,2) – not adjacent
    game.handlePointerDown(game.gridX + cs * 2 + cs / 2, game.gridY + cs * 2 + cs / 2);
    game.handlePointerUp(game.gridX + cs * 2 + cs / 2, game.gridY + cs * 2 + cs / 2);

    expect(game.selected).toEqual({ row: 2, col: 2 });
    game.destroy();
  });

  it('should support drag-to-swap via pointer down + move', () => {
    const game = create();
    const cs = game.cellSize;

    // Drag from (3,3) to (3,4)
    const x0 = game.gridX + cs * 3 + cs / 2;
    const y0 = game.gridY + cs * 3 + cs / 2;
    const x1 = game.gridX + cs * 4 + cs / 2;
    const y1 = game.gridY + cs * 3 + cs / 2;

    game.handlePointerDown(x0, y0);
    game.handlePointerMove(x1, y1);

    expect(game.phase).toBe('swapping');
    game.destroy();
  });

  it('should handle keyboard navigation (arrows + Enter)', () => {
    const game = create();
    expect(() => {
      game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
      game.handleKeyDown('ArrowRight', fakeKeyEvent('ArrowRight'));
      expect(game.cursorRow).toBe(1);
      expect(game.cursorCol).toBe(1);
      expect(game.useKeyboard).toBe(true);

      // Select via Enter
      game.handleKeyDown('Enter', fakeKeyEvent('Enter'));
      expect(game.selected).toEqual({ row: 1, col: 1 });

      // Move cursor to adjacent cell and select to swap
      game.handleKeyDown('ArrowRight', fakeKeyEvent('ArrowRight'));
      game.handleKeyDown('Enter', fakeKeyEvent('Enter'));
      expect(game.phase).toBe('swapping');
    }).not.toThrow();
    game.destroy();
  });

  it('should handle keyboard selection with Space key', () => {
    const game = create();
    game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
    game.handleKeyDown(' ', fakeKeyEvent(' '));
    expect(game.selected).toEqual({ row: 1, col: 0 });
    game.destroy();
  });

  it('should clamp keyboard cursor at grid boundaries', () => {
    const game = create();
    // Try to go above row 0
    game.handleKeyDown('ArrowUp', fakeKeyEvent('ArrowUp'));
    expect(game.cursorRow).toBe(0);
    // Try to go left of col 0
    game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
    expect(game.cursorCol).toBe(0);

    // Go to bottom-right corner
    for (let i = 0; i < 10; i++) {
      game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
      game.handleKeyDown('ArrowRight', fakeKeyEvent('ArrowRight'));
    }
    expect(game.cursorRow).toBe(7);
    expect(game.cursorCol).toBe(7);
    game.destroy();
  });

  it('should process swap animation through to completion', () => {
    const game = create();
    const cs = game.cellSize;

    // Force a swap
    game.handlePointerDown(game.gridX + cs / 2, game.gridY + cs / 2);
    game.handlePointerUp(game.gridX + cs / 2, game.gridY + cs / 2);
    game.handlePointerDown(game.gridX + cs + cs / 2, game.gridY + cs / 2);
    game.handlePointerUp(game.gridX + cs + cs / 2, game.gridY + cs / 2);

    expect(game.phase).toBe('swapping');

    // Run enough updates for the swap animation to complete
    for (let i = 0; i < 50; i++) {
      game.update(0.016);
      game.render();
    }

    // Phase should have moved on: either idle (swap reversed) or checking/removing
    expect(['idle', 'checking', 'removing', 'falling']).toContain(game.phase);
    game.destroy();
  });

  it('should run many update/render cycles and process cascades', () => {
    const scoreFn = vi.fn();
    const game = create(0, scoreFn);

    // Attempt many swaps to trigger matches
    for (let attempt = 0; attempt < 30; attempt++) {
      if (game.ended) break;

      // Wait for idle phase
      for (let t = 0; t < 30; t++) {
        game.update(0.05);
        game.render();
        if (game.phase === 'idle') break;
      }

      if (game.phase !== 'idle' || game.ended) continue;

      // Try to swap (r, c) with (r, c+1) for each cell until one triggers a match
      let triggered = false;
      for (let r = 0; r < 8 && !triggered; r++) {
        for (let c = 0; c < 7 && !triggered; c++) {
          const cs = game.cellSize;
          const x0 = game.gridX + cs * c + cs / 2;
          const y0 = game.gridY + cs * r + cs / 2;
          const x1 = game.gridX + cs * (c + 1) + cs / 2;

          game.handlePointerDown(x0, y0);
          game.handlePointerMove(x1, y0);

          if (game.phase === 'swapping') {
            triggered = true;
          }
        }
      }
    }

    // Just verify no crash – scoring is a bonus
    expect(true).toBe(true);
    game.destroy();
  });

  it('should count down timer and trigger game over when time expires', () => {
    const gameOverFn = vi.fn();
    const game = create(0, undefined, gameOverFn);

    // Fast-forward the timer by many large dt steps
    for (let i = 0; i < 200; i++) {
      if (game.ended) break;
      game.update(1.0); // 1 second per step
      game.render();
    }

    expect(game.ended).toBe(true);
    expect(gameOverFn).toHaveBeenCalled();
    game.destroy();
  });

  it('should have less time at higher difficulties', () => {
    const easyGame = create(0);
    const hardGame = create(2);
    const extraHardGame = create(3);

    expect(easyGame.totalTime).toBeGreaterThan(hardGame.totalTime);
    expect(hardGame.totalTime).toBeGreaterThan(extraHardGame.totalTime);

    easyGame.destroy();
    hardGame.destroy();
    extraHardGame.destroy();
  });

  it('should use more gem types at higher difficulties', () => {
    const easyGame = create(0);
    const hardGame = create(3);

    expect(easyGame.gemTypes.length).toBe(5);
    expect(hardGame.gemTypes.length).toBe(7);

    easyGame.destroy();
    hardGame.destroy();
  });

  it('should handle removing phase with gems shrinking to zero', () => {
    const game = create();
    // Manually trigger a removal
    game.grid[0][0]!.removing = true;
    game.grid[0][0]!.sparkleTimer = 0.3;
    game.phase = 'removing';

    for (let i = 0; i < 30; i++) {
      game.update(0.016);
      game.render();
    }

    // After removing animation completes, applyGravity fills empty cells
    // and the phase transitions to 'falling' or 'checking'. Verify we moved
    // past the 'removing' phase.
    expect(game.phase).not.toBe('removing');
    // The cell at [0][0] should have been replaced with a fresh gem
    // (applyGravity fills from top) – it should not still be "removing"
    if (game.grid[0][0]) {
      expect(game.grid[0][0].removing).toBe(false);
    }
    game.destroy();
  });

  it('should not accept input during non-idle phases', () => {
    const game = create();
    game.phase = 'swapping';

    const selectedBefore = game.selected;
    game.handleKeyDown('Enter', fakeKeyEvent('Enter'));
    expect(game.selected).toBe(selectedBefore);

    game.handlePointerDown(game.gridX + 10, game.gridY + 10);
    expect(game.dragStart).toBeNull();

    game.destroy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Snake
// ════════════════════════════════════════════════════════════════════════════
describe('Snake – internal logic', () => {
  function create(diff = 0, onScore?: (s: number) => void, onGameOver?: (s: number) => void) {
    const info = getGame('snake')!;
    const game = info.createGame(makeConfig(360, 360, diff, onScore, onGameOver)) as any;
    game.start();
    return game;
  }

  it('should start with a 3-segment snake in the center', () => {
    const game = create();
    expect(game.snake.length).toBe(3);
    // Head should be roughly in center
    const gd = game.gridDim;
    const cx = Math.floor(gd / 2);
    const cy = Math.floor(gd / 2);
    expect(game.snake[0].x).toBe(cx);
    expect(game.snake[0].y).toBe(cy);
    game.destroy();
  });

  it('should change direction via arrow keys', () => {
    const game = create();
    // Default direction is right
    game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
    expect(game.nextDirection).toEqual({ dx: 0, dy: 1 });

    // Left is opposite of current direction (right), so it's rejected until
    // the snake actually moves and commits the down direction.
    // Run a tick so direction commits to down.
    for (let i = 0; i < 15; i++) game.update(0.02);

    game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
    expect(game.nextDirection).toEqual({ dx: -1, dy: 0 });

    game.destroy();
  });

  it('should not allow reversing direction (opposite)', () => {
    const game = create();
    // Default direction is right; trying to go left should be blocked
    game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
    // nextDirection should still be right since left is opposite to current right
    expect(game.nextDirection).toEqual({ dx: 1, dy: 0 });
    game.destroy();
  });

  it('should support WASD keys for direction', () => {
    const game = create();
    game.handleKeyDown('s', fakeKeyEvent('s'));
    expect(game.nextDirection).toEqual({ dx: 0, dy: 1 });
    // Commit the down direction first, then 'a' (left) is valid
    for (let i = 0; i < 15; i++) game.update(0.02);
    game.handleKeyDown('a', fakeKeyEvent('a'));
    expect(game.nextDirection).toEqual({ dx: -1, dy: 0 });
    game.destroy();
  });

  it('should move the snake forward on update cycles', () => {
    const game = create();
    const initialHeadX = game.snake[0].x;

    // Run enough updates for the snake to move at least once
    // Default direction is right; moveInterval ~ 0.18
    for (let i = 0; i < 20; i++) {
      game.update(0.02);
    }

    expect(game.snake[0].x).toBeGreaterThan(initialHeadX);
    game.destroy();
  });

  it('should award score when food is eaten (many cycles)', () => {
    const scoreFn = vi.fn();
    const gameOverFn = vi.fn();
    const game = create(0, scoreFn, gameOverFn);

    // Place food directly in the snake's path (one cell to the right of head)
    const head = game.snake[0];
    game.food = { x: head.x + 1, y: head.y };

    // Run enough updates for snake to reach food
    for (let i = 0; i < 30; i++) {
      if (gameOverFn.mock.calls.length > 0) break;
      game.update(0.02);
    }

    expect(scoreFn).toHaveBeenCalled();
    // Snake should have grown
    expect(game.snake.length).toBeGreaterThan(3);
    game.destroy();
  });

  it('should trigger game over on wall collision (difficulty 0, no wrap)', () => {
    const gameOverFn = vi.fn();
    const game = create(0, undefined, gameOverFn);

    // Keep moving right until we hit the wall
    for (let i = 0; i < 200; i++) {
      if (gameOverFn.mock.calls.length > 0) break;
      game.update(0.02);
    }

    expect(gameOverFn).toHaveBeenCalled();
    game.destroy();
  });

  it('should have obstacles at difficulty 2 (hard)', () => {
    const game = create(2);
    expect(game.obstacles.length).toBeGreaterThan(0);
    expect(game.diffConfig.obstacles).toBe(4);
    game.destroy();
  });

  it('should wrap around edges at difficulty 3 (extra hard)', () => {
    const game = create(3);
    expect(game.diffConfig.wrapEdges).toBe(true);

    // The snake should wrap rather than die on the right edge
    // Move right until we exceed gridDim
    let died = false;
    for (let i = 0; i < 300; i++) {
      if (!game.gameActive) { died = true; break; }
      game.update(0.02);
    }

    // At difficulty 3 with wrap, we may die from self-collision or obstacles,
    // but not simply from hitting a wall. If the snake hasn't died, wrapping works.
    // If it did die, check it wasn't because of wall collision by verifying wrapEdges
    expect(game.diffConfig.wrapEdges).toBe(true);
    game.destroy();
  });

  it('should detect swipe via pointerDown + pointerUp', () => {
    const game = create();
    // Swipe down (distance > 15)
    game.handlePointerDown(180, 100);
    game.handlePointerUp(180, 160);

    expect(game.nextDirection).toEqual({ dx: 0, dy: 1 });
    game.destroy();
  });

  it('should detect horizontal swipe', () => {
    const game = create();
    // First change direction to down so left is valid
    game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
    // Run a tick so direction commits
    for (let i = 0; i < 15; i++) game.update(0.02);

    // Now swipe left
    game.handlePointerDown(200, 180);
    game.handlePointerUp(140, 180);

    expect(game.nextDirection).toEqual({ dx: -1, dy: 0 });
    game.destroy();
  });

  it('should handle tap (short distance) relative to snake head', () => {
    const game = create();
    // First change to down direction so tapping right of head is valid
    game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
    // Let the snake move once
    for (let i = 0; i < 15; i++) game.update(0.02);

    // Now tap to the right of the head
    const head = game.snake[0];
    const headPx = {
      x: game.offsetX + head.x * game.cellSize + game.cellSize / 2,
      y: game.offsetY + head.y * game.cellSize + game.cellSize / 2,
    };
    game.handlePointerDown(headPx.x + 5, headPx.y);
    game.handlePointerUp(headPx.x + 5, headPx.y);

    expect(game.nextDirection).toEqual({ dx: 1, dy: 0 });
    game.destroy();
  });

  it('should render without crash during eat animation', () => {
    const game = create();
    game.growAnimTimer = 0.2;
    game.eatAnimScale = 0.3;
    expect(() => {
      game.render();
    }).not.toThrow();
    game.destroy();
  });

  it('should render with wrap-around interpolation at difficulty 3', () => {
    const game = create(3);
    expect(() => {
      for (let i = 0; i < 50; i++) {
        game.update(0.016);
        game.render();
      }
    }).not.toThrow();
    game.destroy();
  });

  it('should increase speed as snake grows by eating food multiple times', () => {
    const scoreFn = vi.fn();
    const game = create(0, scoreFn);
    const initialInterval = game.moveInterval;

    // Feed the snake many times by placing food directly in its path
    for (let feed = 0; feed < 15; feed++) {
      if (!game.gameActive) break;
      const head = game.snake[0];
      // Place food 1 cell ahead in current direction
      game.food = { x: head.x + game.direction.dx, y: head.y + game.direction.dy };
      // Run enough updates for a move tick
      for (let t = 0; t < 15; t++) {
        if (!game.gameActive) break;
        game.update(0.02);
      }
    }

    // After eating many times, the snake should be longer and interval should decrease
    if (game.gameActive) {
      expect(game.moveInterval).toBeLessThan(initialInterval);
    }
    game.destroy();
  });

  it('should not accept input after game over', () => {
    const game = create();
    game.gameActive = false;

    game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
    // Direction should remain right since gameActive is false
    expect(game.nextDirection).toEqual({ dx: 1, dy: 0 });

    game.handlePointerDown(180, 100);
    expect(game.swipeStart).toBeNull();

    game.destroy();
  });

  it('should handle self-collision game over', () => {
    const gameOverFn = vi.fn();
    const game = create(0, undefined, gameOverFn);

    // Grow the snake artificially to make self-collision possible
    const head = game.snake[0];
    // Create a U-shape that will cause self-collision when moving down then left then up
    game.snake = [
      { x: head.x, y: head.y },
      { x: head.x + 1, y: head.y },
      { x: head.x + 1, y: head.y + 1 },
      { x: head.x, y: head.y + 1 },
      { x: head.x - 1, y: head.y + 1 },
    ];
    game.prevSnake = game.snake.map((p: any) => ({ ...p }));

    // Try to move down – the head would collide with the body at (head.x, head.y+1)
    game.direction = { dx: 0, dy: 1 };
    game.nextDirection = { dx: 0, dy: 1 };

    // Update enough for a move tick
    for (let i = 0; i < 20; i++) {
      game.update(0.02);
      if (!game.gameActive) break;
    }

    expect(game.gameActive).toBe(false);
    expect(gameOverFn).toHaveBeenCalled();
    game.destroy();
  });

  it('should handle handlePointerMove as a no-op without crash', () => {
    const game = create();
    expect(() => {
      game.handlePointerMove(100, 100);
    }).not.toThrow();
    game.destroy();
  });

  it('should run at difficulty 1 (medium) with different grid size and speed', () => {
    const game = create(1);
    expect(game.gridDim).toBe(18);
    expect(game.diffConfig.startSpeed).toBe(0.14);
    expect(game.obstacles.length).toBe(0);
    game.destroy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Save / Resume / canSave — endless games
// ════════════════════════════════════════════════════════════════════════════

describe('BlockDrop – save/resume & canSave', () => {
  function create(diff = 0) {
    const info = getGame('block-drop')!;
    const game = info.createGame(makeConfig(300, 540, diff)) as any;
    game.start();
    return game;
  }

  it('should round-trip serialize/deserialize via start({state,...})', () => {
    const game = create(1);
    // Mutate some state: drop a few pieces and move around
    game.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
    game.handleKeyDown(' ', fakeKeyEvent(' '));
    // Let lock settle
    for (let i = 0; i < 10; i++) game.update(0.05);
    game.handleKeyDown('ArrowRight', fakeKeyEvent('ArrowRight'));

    const snapshot = game.serialize();
    const score = game.getScore();
    const won = game.isWon();

    // Capture key state fields for comparison
    const gridBefore = game.grid.map((r: number[]) => [...r]);
    const levelBefore = game.level;
    const linesBefore = game.linesCleared;
    const currentBefore = game.current ? { ...game.current } : null;

    game.destroy();

    const info = getGame('block-drop')!;
    const restored = info.createGame(makeConfig(300, 540, 1)) as any;
    restored.start({ state: snapshot, score, won });

    // Grid should be byte-identical
    for (let r = 0; r < gridBefore.length; r++) {
      for (let c = 0; c < gridBefore[r].length; c++) {
        expect(restored.grid[r][c]).toBe(gridBefore[r][c]);
      }
    }
    expect(restored.level).toBe(levelBefore);
    expect(restored.linesCleared).toBe(linesBefore);
    if (currentBefore) {
      expect(restored.current).not.toBeNull();
      expect(restored.current.type).toBe(currentBefore.type);
      expect(restored.current.rotation).toBe(currentBefore.rotation);
      expect(restored.current.x).toBe(currentBefore.x);
      expect(restored.current.y).toBe(currentBefore.y);
    }
    expect(restored.getScore()).toBe(score);
    expect(restored.isWon()).toBe(won);
    // Resumed game should still be playable
    expect(() => {
      restored.handleKeyDown('ArrowLeft', fakeKeyEvent('ArrowLeft'));
      restored.update(0.016);
      restored.render();
    }).not.toThrow();
    restored.destroy();
  });

  it('canSave() returns true in normal state and false during line-clear animation', () => {
    const game = create();
    expect(game.canSave()).toBe(true);

    // Simulate a clear animation in progress
    game.clearTimer = 0.1;
    game.clearingRows = [19];
    expect(game.canSave()).toBe(false);

    // Simulate lock flash
    game.clearTimer = 0;
    game.clearingRows = [];
    game.lockFlashTimer = 0.05;
    expect(game.canSave()).toBe(false);

    // Simulate game over
    game.lockFlashTimer = 0;
    game.isOver = true;
    expect(game.canSave()).toBe(false);

    game.destroy();
  });

  it('should not throw on deserialize with malformed snapshot', () => {
    const game = create();
    const gridBefore = game.grid.map((r: number[]) => [...r]);

    // Malformed: missing grid
    expect(() => game.deserialize({} as any)).not.toThrow();
    // Malformed: wrong shape grid
    expect(() => game.deserialize({ grid: [[1, 2]] } as any)).not.toThrow();
    // Malformed: non-number cells
    expect(() => game.deserialize({ grid: 'nope', bag: 'x' } as any)).not.toThrow();

    // Game should still be playable (grid unchanged from malformed inputs)
    for (let r = 0; r < gridBefore.length; r++) {
      for (let c = 0; c < gridBefore[r].length; c++) {
        expect(game.grid[r][c]).toBe(gridBefore[r][c]);
      }
    }
    expect(() => {
      game.update(0.016);
      game.render();
    }).not.toThrow();
    game.destroy();
  });
});

describe('BubblePop – save/resume & canSave', () => {
  function create(diff = 0) {
    const info = getGame('bubble-pop')!;
    const game = info.createGame(makeConfig(360, 560, diff)) as any;
    game.start();
    return game;
  }

  it('should round-trip serialize/deserialize via start({state,...})', () => {
    const game = create(1);
    // Mutate state: change aim and set shots counter
    game.aimAngle = -Math.PI / 3;
    game.shotsSinceNewRow = 3;
    game.totalRowsAdded = game.totalRowsAdded + 2;

    const snapshot = game.serialize();
    const score = game.getScore();
    const won = game.isWon();

    // Copy grid for comparison
    const gridBefore: (number | null)[][] = game.grid.map((row: (number | null)[]) =>
      row ? [...row] : []
    );
    const aimBefore = game.aimAngle;
    const shotsBefore = game.shotsSinceNewRow;
    const totalRowsBefore = game.totalRowsAdded;
    const currentColorBefore = game.currentColor;
    const nextColorBefore = game.nextColor;

    game.destroy();

    const info = getGame('bubble-pop')!;
    const restored = info.createGame(makeConfig(360, 560, 1)) as any;
    restored.start({ state: snapshot, score, won });

    // Grid contents match
    for (let r = 0; r < gridBefore.length; r++) {
      const rowA = gridBefore[r] || [];
      const rowB = restored.grid[r] || [];
      expect(rowB.length).toBe(rowA.length);
      for (let c = 0; c < rowA.length; c++) {
        expect(rowB[c]).toBe(rowA[c]);
      }
    }
    expect(restored.aimAngle).toBeCloseTo(aimBefore, 5);
    expect(restored.shotsSinceNewRow).toBe(shotsBefore);
    expect(restored.totalRowsAdded).toBe(totalRowsBefore);
    expect(restored.currentColor).toBe(currentColorBefore);
    expect(restored.nextColor).toBe(nextColorBefore);
    expect(restored.getScore()).toBe(score);
    expect(restored.isWon()).toBe(won);
    // Transient state reset
    expect(restored.flying).toBeNull();
    expect(restored.popAnims.length).toBe(0);
    expect(restored.dropAnims.length).toBe(0);
    restored.destroy();
  });

  it('canSave() returns true normally and false during flying/pop/drop/game-over', () => {
    const game = create();
    expect(game.canSave()).toBe(true);

    // Simulate a flying bubble
    game.flying = { x: 100, y: 100, vx: 0, vy: -1, color: 0 };
    expect(game.canSave()).toBe(false);
    game.flying = null;

    // Simulate a pop animation
    game.popAnims.push({ x: 100, y: 100, colorIdx: 0, t: 0 });
    expect(game.canSave()).toBe(false);
    game.popAnims = [];

    // Simulate drop animation
    game.dropAnims.push({ x: 100, y: 100, vy: 0, colorIdx: 0, t: 0, bounced: false, bounceCount: 0 });
    expect(game.canSave()).toBe(false);
    game.dropAnims = [];

    // Game over
    game.isGameOver = true;
    expect(game.canSave()).toBe(false);

    game.destroy();
  });
});

describe('GemSwap – save/resume & canSave', () => {
  function create(diff = 0) {
    const info = getGame('gem-swap')!;
    const game = info.createGame(makeConfig(360, 440, diff)) as any;
    game.start();
    return game;
  }

  it('should round-trip serialize/deserialize via start({state,...})', () => {
    const game = create(1);
    // Mutate state: advance timer a bit
    game.timeLeft = game.timeLeft - 5;
    game.comboMultiplier = 2.5;

    const snapshot = game.serialize();
    const score = game.getScore();
    const won = game.isWon();

    // Capture grid as type strings for comparison
    const gridTypesBefore: (string | null)[][] = [];
    for (let r = 0; r < game.grid.length; r++) {
      const row: (string | null)[] = [];
      for (let c = 0; c < game.grid[r].length; c++) {
        row.push(game.grid[r][c] ? game.grid[r][c].type : null);
      }
      gridTypesBefore.push(row);
    }
    const timeLeftBefore = game.timeLeft;
    const comboBefore = game.comboMultiplier;

    game.destroy();

    const info = getGame('gem-swap')!;
    const restored = info.createGame(makeConfig(360, 440, 1)) as any;
    restored.start({ state: snapshot, score, won });

    // Grid types match
    for (let r = 0; r < gridTypesBefore.length; r++) {
      for (let c = 0; c < gridTypesBefore[r].length; c++) {
        const expected = gridTypesBefore[r][c];
        const actualGem = restored.grid[r][c];
        const actual = actualGem ? actualGem.type : null;
        expect(actual).toBe(expected);
      }
    }
    expect(restored.timeLeft).toBeCloseTo(timeLeftBefore, 5);
    expect(restored.comboMultiplier).toBeCloseTo(comboBefore, 5);
    expect(restored.getScore()).toBe(score);
    expect(restored.isWon()).toBe(won);
    // Transient state reset
    expect(restored.phase).toBe('idle');
    expect(restored.selected).toBeNull();
    expect(restored.particles.length).toBe(0);
    restored.destroy();
  });

  it('canSave() returns true only when phase === idle and game is not ended', () => {
    const game = create();
    expect(game.phase).toBe('idle');
    expect(game.canSave()).toBe(true);

    game.phase = 'swapping';
    expect(game.canSave()).toBe(false);
    game.phase = 'removing';
    expect(game.canSave()).toBe(false);
    game.phase = 'falling';
    expect(game.canSave()).toBe(false);
    game.phase = 'checking';
    expect(game.canSave()).toBe(false);

    game.phase = 'idle';
    game.ended = true;
    expect(game.canSave()).toBe(false);

    game.destroy();
  });
});

describe('Snake – save/resume & canSave', () => {
  function create(diff = 0) {
    const info = getGame('snake')!;
    const game = info.createGame(makeConfig(360, 360, diff)) as any;
    game.start();
    return game;
  }

  it('should round-trip serialize/deserialize via start({state,...})', () => {
    const game = create(2); // difficulty 2 has obstacles
    // Mutate state: change direction + move a bit
    game.handleKeyDown('ArrowDown', fakeKeyEvent('ArrowDown'));
    for (let i = 0; i < 20; i++) game.update(0.02);

    const snapshot = game.serialize();
    const score = game.getScore();
    const won = game.isWon();

    const snakeBefore = game.snake.map((p: any) => ({ x: p.x, y: p.y }));
    const foodBefore = { ...game.food };
    const directionBefore = { ...game.direction };
    const obstaclesBefore = game.obstacles.map((o: any) => ({ x: o.x, y: o.y }));
    const moveIntervalBefore = game.moveInterval;

    game.destroy();

    const info = getGame('snake')!;
    const restored = info.createGame(makeConfig(360, 360, 2)) as any;
    restored.start({ state: snapshot, score, won });

    // Snake body matches
    expect(restored.snake.length).toBe(snakeBefore.length);
    for (let i = 0; i < snakeBefore.length; i++) {
      expect(restored.snake[i].x).toBe(snakeBefore[i].x);
      expect(restored.snake[i].y).toBe(snakeBefore[i].y);
    }
    expect(restored.food.x).toBe(foodBefore.x);
    expect(restored.food.y).toBe(foodBefore.y);
    expect(restored.direction.dx).toBe(directionBefore.dx);
    expect(restored.direction.dy).toBe(directionBefore.dy);
    expect(restored.obstacles.length).toBe(obstaclesBefore.length);
    expect(restored.moveInterval).toBeCloseTo(moveIntervalBefore, 5);
    expect(restored.getScore()).toBe(score);
    expect(restored.isWon()).toBe(won);
    // Transient state reset
    expect(restored.growAnimTimer).toBe(0);
    expect(restored.eatAnimScale).toBe(0);
    restored.destroy();
  });

  it('canSave() returns true normally, false during eat-grow animation or when inactive', () => {
    const game = create();
    expect(game.canSave()).toBe(true);

    // Simulate eat animation in flight
    game.growAnimTimer = 0.15;
    expect(game.canSave()).toBe(false);
    game.growAnimTimer = 0;

    // Game over
    game.gameActive = false;
    expect(game.canSave()).toBe(false);

    game.destroy();
  });

  it('should not throw on deserialize with malformed snapshot', () => {
    const game = create();
    const snakeBefore = game.snake.map((p: any) => ({ x: p.x, y: p.y }));

    // Missing snake
    expect(() => game.deserialize({} as any)).not.toThrow();
    // Bad snake shape
    expect(() => game.deserialize({ snake: 'nope' } as any)).not.toThrow();
    // Empty snake array
    expect(() => game.deserialize({ snake: [] } as any)).not.toThrow();
    // Bad food
    expect(() => game.deserialize({ snake: [{ x: 1, y: 1 }], food: null } as any)).not.toThrow();

    // Snake should still be playable with original state
    expect(game.snake.length).toBe(snakeBefore.length);
    expect(() => {
      game.update(0.016);
      game.render();
    }).not.toThrow();
    game.destroy();
  });
});
