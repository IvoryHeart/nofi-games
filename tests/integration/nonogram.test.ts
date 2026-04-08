import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock idb-keyval before any source imports
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { loadAllGames, getGame } from '../../src/games/registry';
import { GameConfig, GameEngine } from '../../src/engine/GameEngine';

function makeConfig(
  width = 360,
  height = 640,
  difficulty = 0,
  onScore?: (s: number) => void,
  onGameOver?: (s: number) => void,
  onWin?: (s: number) => void,
  seed?: number,
): GameConfig {
  return {
    canvas: document.createElement('canvas'),
    width,
    height,
    difficulty,
    onScore,
    onGameOver,
    onWin,
    seed,
  };
}

interface NonogramInternal extends GameEngine {
  rows: number;
  cols: number;
  grid: ('empty' | 'filled' | 'marked')[][];
  solution: boolean[][];
  rowHints: number[][];
  colHints: number[][];
  tool: 'fill' | 'mark';
  mistakes: number;
  maxMistakes: number;
  showMistakes: boolean;
  gameActive: boolean;
  applyTool(row: number, col: number): void;
}

function asInternal(g: GameEngine): NonogramInternal {
  return g as unknown as NonogramInternal;
}

beforeAll(async () => {
  await loadAllGames();
});

describe('Nonogram', () => {
  // ── 1. Registration ─────────────────────────────────────────────
  it('is registered in the registry with expected metadata', () => {
    const info = getGame('nonogram');
    expect(info).toBeDefined();
    expect(info!.name).toBe('Nonogram');
    expect(info!.category).toBe('puzzle');
    expect(info!.canvasWidth).toBe(360);
    expect(info!.canvasHeight).toBe(640);
    expect(info!.dailyMode).toBe(true);
    expect(info!.bgGradient).toEqual(['#5B7C99', '#8AABC4']);
  });

  // ── 2. Difficulty grid sizes ────────────────────────────────────
  it('instantiates at all 4 difficulties with the expected grid dimensions', () => {
    const info = getGame('nonogram')!;
    const expected: Array<{ rows: number; cols: number }> = [
      { rows: 5, cols: 5 },
      { rows: 10, cols: 10 },
      { rows: 15, cols: 15 },
      { rows: 15, cols: 20 },
    ];
    for (let d = 0; d <= 3; d++) {
      const game = info.createGame(makeConfig(360, 640, d));
      game.start();
      const internal = asInternal(game);
      expect(internal.rows).toBe(expected[d].rows);
      expect(internal.cols).toBe(expected[d].cols);
      expect(internal.grid.length).toBe(expected[d].rows);
      expect(internal.grid[0].length).toBe(expected[d].cols);
      game.destroy();
    }
  });

  // ── 3. Lifecycle clean ──────────────────────────────────────────
  it('runs full start/update/render/destroy lifecycle without crashing', () => {
    const info = getGame('nonogram')!;
    const game = info.createGame(makeConfig(360, 640, 1));
    expect(() => {
      game.start();
      for (let i = 0; i < 5; i++) {
        (game as unknown as { update(dt: number): void }).update(0.016);
        (game as unknown as { render(): void }).render();
      }
      game.destroy();
    }).not.toThrow();
  });

  // ── 4. Solution dimensions ──────────────────────────────────────
  it('generates a solution grid with the expected dimensions', () => {
    const info = getGame('nonogram')!;
    const game = info.createGame(makeConfig(360, 640, 2));
    game.start();
    const internal = asInternal(game);
    expect(internal.solution.length).toBe(15);
    for (const row of internal.solution) {
      expect(row.length).toBe(15);
      for (const cell of row) {
        expect(typeof cell).toBe('boolean');
      }
    }
    game.destroy();
  });

  // ── 5. Hints match the solution ─────────────────────────────────
  it('row and column hints correctly describe runs in the solution', () => {
    const info = getGame('nonogram')!;
    const game = info.createGame(makeConfig(360, 640, 0, undefined, undefined, undefined, 12345));
    game.start();
    const internal = asInternal(game);

    // Compute expected hints from the solution and compare
    function lineHints(cells: boolean[]): number[] {
      const out: number[] = [];
      let run = 0;
      for (const v of cells) {
        if (v) run++;
        else if (run > 0) { out.push(run); run = 0; }
      }
      if (run > 0) out.push(run);
      if (out.length === 0) out.push(0);
      return out;
    }

    expect(internal.rowHints.length).toBe(internal.rows);
    expect(internal.colHints.length).toBe(internal.cols);

    for (let r = 0; r < internal.rows; r++) {
      const expected = lineHints(internal.solution[r]);
      expect(internal.rowHints[r]).toEqual(expected);
    }
    for (let c = 0; c < internal.cols; c++) {
      const col: boolean[] = [];
      for (let r = 0; r < internal.rows; r++) col.push(internal.solution[r][c]);
      const expected = lineHints(col);
      expect(internal.colHints[c]).toEqual(expected);
    }
    game.destroy();
  });

  // ── 6. Filling correct cells triggers onWin ────────────────────
  it('filling exactly the solution cells triggers onWin', () => {
    const info = getGame('nonogram')!;
    const winFn = vi.fn();
    const game = info.createGame(makeConfig(360, 640, 0, undefined, undefined, winFn, 7777));
    game.start();
    const internal = asInternal(game);
    internal.tool = 'fill';

    for (let r = 0; r < internal.rows; r++) {
      for (let c = 0; c < internal.cols; c++) {
        if (internal.solution[r][c]) {
          internal.applyTool(r, c);
        }
      }
    }
    expect(winFn).toHaveBeenCalled();
    expect(game.isWon()).toBe(true);
    game.destroy();
  });

  // ── 7. Wrong fill increments mistake counter (Hard) ────────────
  it('filling wrong cells increments mistake counter on Hard', () => {
    const info = getGame('nonogram')!;
    const game = info.createGame(makeConfig(360, 640, 2, undefined, undefined, undefined, 555));
    game.start();
    const internal = asInternal(game);
    internal.tool = 'fill';
    expect(internal.mistakes).toBe(0);

    // Find an empty solution cell and try to fill it
    let found = false;
    outer: for (let r = 0; r < internal.rows; r++) {
      for (let c = 0; c < internal.cols; c++) {
        if (!internal.solution[r][c]) {
          internal.applyTool(r, c);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true);
    expect(internal.mistakes).toBe(1);
    game.destroy();
  });

  // ── 8. Exceeding max mistakes ends the game ────────────────────
  it('exceeding max mistakes ends the game without a win', () => {
    const info = getGame('nonogram')!;
    const overFn = vi.fn();
    const winFn = vi.fn();
    // Difficulty 3 (Extra Hard) has only 1 mistake allowed
    const game = info.createGame(makeConfig(360, 640, 3, undefined, overFn, winFn, 222));
    game.start();
    const internal = asInternal(game);
    internal.tool = 'fill';
    expect(internal.maxMistakes).toBe(1);

    // Find an empty solution cell and fill it once → game over
    outer: for (let r = 0; r < internal.rows; r++) {
      for (let c = 0; c < internal.cols; c++) {
        if (!internal.solution[r][c]) {
          internal.applyTool(r, c);
          break outer;
        }
      }
    }
    expect(internal.mistakes).toBe(1);
    expect(internal.gameActive).toBe(false);
    expect(winFn).not.toHaveBeenCalled();
    game.destroy();
  });

  // ── 9. Daily mode determinism ──────────────────────────────────
  it('daily mode: same seed produces the same solution grid', () => {
    const info = getGame('nonogram')!;
    const a = info.createGame(makeConfig(360, 640, 1, undefined, undefined, undefined, 9090));
    const b = info.createGame(makeConfig(360, 640, 1, undefined, undefined, undefined, 9090));
    a.start();
    b.start();
    const ai = asInternal(a);
    const bi = asInternal(b);
    expect(ai.rows).toBe(bi.rows);
    expect(ai.cols).toBe(bi.cols);
    for (let r = 0; r < ai.rows; r++) {
      for (let c = 0; c < ai.cols; c++) {
        expect(ai.solution[r][c]).toBe(bi.solution[r][c]);
      }
    }
    a.destroy();
    b.destroy();
  });

  it('different seeds produce different solutions (high probability)', () => {
    const info = getGame('nonogram')!;
    const a = info.createGame(makeConfig(360, 640, 1, undefined, undefined, undefined, 1));
    const b = info.createGame(makeConfig(360, 640, 1, undefined, undefined, undefined, 99999));
    a.start();
    b.start();
    const ai = asInternal(a);
    const bi = asInternal(b);
    let differs = false;
    for (let r = 0; r < ai.rows && !differs; r++) {
      for (let c = 0; c < ai.cols && !differs; c++) {
        if (ai.solution[r][c] !== bi.solution[r][c]) differs = true;
      }
    }
    expect(differs).toBe(true);
    a.destroy();
    b.destroy();
  });

  // ── 10. serialize / deserialize round trip ─────────────────────
  it('serialize / deserialize round-trips state', () => {
    const info = getGame('nonogram')!;
    const game = info.createGame(makeConfig(360, 640, 1, undefined, undefined, undefined, 4242));
    game.start();
    const internal = asInternal(game);
    internal.tool = 'mark';

    // Make a couple of moves
    for (let r = 0; r < internal.rows && r < 2; r++) {
      for (let c = 0; c < internal.cols && c < 2; c++) {
        internal.applyTool(r, c);
      }
    }

    const snapshot = game.serialize();
    expect(snapshot).not.toBeNull();
    expect(snapshot).toBeTruthy();

    const game2 = info.createGame(makeConfig(360, 640, 1));
    game2.start();
    game2.deserialize(snapshot!);
    const internal2 = asInternal(game2);

    expect(internal2.rows).toBe(internal.rows);
    expect(internal2.cols).toBe(internal.cols);
    expect(internal2.tool).toBe(internal.tool);
    expect(internal2.mistakes).toBe(internal.mistakes);
    for (let r = 0; r < internal.rows; r++) {
      for (let c = 0; c < internal.cols; c++) {
        expect(internal2.grid[r][c]).toBe(internal.grid[r][c]);
        expect(internal2.solution[r][c]).toBe(internal.solution[r][c]);
      }
    }

    game.destroy();
    game2.destroy();
  });

  // ── 11. canSave during play vs after over ──────────────────────
  it('canSave is true during active play and false after the game ends', () => {
    const info = getGame('nonogram')!;
    const game = info.createGame(makeConfig(360, 640, 0, undefined, undefined, undefined, 31));
    game.start();
    expect(game.canSave()).toBe(true);

    // Win the game
    const internal = asInternal(game);
    internal.tool = 'fill';
    for (let r = 0; r < internal.rows; r++) {
      for (let c = 0; c < internal.cols; c++) {
        if (internal.solution[r][c]) internal.applyTool(r, c);
      }
    }
    expect(game.canSave()).toBe(false);
    game.destroy();
  });

  // ── 12. Defensive deserialize ──────────────────────────────────
  it('deserialize tolerates corrupt / malformed snapshots without throwing', () => {
    const info = getGame('nonogram')!;
    const game = info.createGame(makeConfig(360, 640, 1));
    game.start();

    expect(() => game.deserialize({})).not.toThrow();
    expect(() => game.deserialize({ rows: 'oops', cols: 5 })).not.toThrow();
    expect(() => game.deserialize({ rows: 5, cols: 5, grid: 'not-an-array' })).not.toThrow();
    expect(() => game.deserialize({ rows: 5, cols: 5, grid: [[]], solution: [[]] })).not.toThrow();
    expect(() => game.deserialize({ rows: -1, cols: -1, grid: [], solution: [] })).not.toThrow();
    expect(() => game.deserialize(null as unknown as Record<string, unknown>)).not.toThrow();

    // Game should still be functional after the bad payloads
    const internal = asInternal(game);
    expect(internal.rows).toBeGreaterThan(0);
    expect(internal.cols).toBeGreaterThan(0);
    game.destroy();
  });

  // ── 13. Easy mode does not surface mistakes ────────────────────
  it('Easy mode does not show or limit mistakes', () => {
    const info = getGame('nonogram')!;
    const game = info.createGame(makeConfig(360, 640, 0, undefined, undefined, undefined, 1234));
    game.start();
    const internal = asInternal(game);
    expect(internal.maxMistakes).toBe(0);
    expect(internal.showMistakes).toBe(false);

    // Make several wrong moves; game should not end
    internal.tool = 'fill';
    let wrongCount = 0;
    for (let r = 0; r < internal.rows && wrongCount < 3; r++) {
      for (let c = 0; c < internal.cols && wrongCount < 3; c++) {
        if (!internal.solution[r][c]) {
          internal.applyTool(r, c);
          wrongCount++;
        }
      }
    }
    // Game should still be active
    expect(internal.gameActive).toBe(true);
    game.destroy();
  });

  // ── 14. Mark tool marks cells with X state ─────────────────────
  it('mark tool sets cells to marked, then back to empty when re-applied', () => {
    const info = getGame('nonogram')!;
    const game = info.createGame(makeConfig(360, 640, 0, undefined, undefined, undefined, 88));
    game.start();
    const internal = asInternal(game);
    internal.tool = 'mark';

    // Find an empty solution cell so the mark is "correct" and counts no mistake
    let target: { r: number; c: number } | null = null;
    outer: for (let r = 0; r < internal.rows; r++) {
      for (let c = 0; c < internal.cols; c++) {
        if (!internal.solution[r][c]) { target = { r, c }; break outer; }
      }
    }
    expect(target).not.toBeNull();
    if (target) {
      internal.applyTool(target.r, target.c);
      expect(internal.grid[target.r][target.c]).toBe('marked');
      // Re-apply → back to empty
      internal.applyTool(target.r, target.c);
      expect(internal.grid[target.r][target.c]).toBe('empty');
    }
    game.destroy();
  });

  // ── 15. Fill toggle ────────────────────────────────────────────
  it('fill tool toggles a filled cell back to empty', () => {
    const info = getGame('nonogram')!;
    const game = info.createGame(makeConfig(360, 640, 0, undefined, undefined, undefined, 17));
    game.start();
    const internal = asInternal(game);
    internal.tool = 'fill';

    let target: { r: number; c: number } | null = null;
    outer: for (let r = 0; r < internal.rows; r++) {
      for (let c = 0; c < internal.cols; c++) {
        if (internal.solution[r][c]) { target = { r, c }; break outer; }
      }
    }
    expect(target).not.toBeNull();
    if (target) {
      internal.applyTool(target.r, target.c);
      expect(internal.grid[target.r][target.c]).toBe('filled');
      internal.applyTool(target.r, target.c);
      expect(internal.grid[target.r][target.c]).toBe('empty');
    }
    game.destroy();
  });

  // ── 16. Keyboard space toggles tool ────────────────────────────
  it('space key toggles between fill and mark tools', () => {
    const info = getGame('nonogram')!;
    const game = info.createGame(makeConfig(360, 640, 1));
    game.start();
    const internal = asInternal(game);
    internal.tool = 'fill';

    const ev = new KeyboardEvent('keydown', { key: ' ' });
    ev.preventDefault = vi.fn();
    (game as unknown as { handleKeyDown(k: string, e: KeyboardEvent): void }).handleKeyDown(' ', ev);
    expect(internal.tool).toBe('mark');
    (game as unknown as { handleKeyDown(k: string, e: KeyboardEvent): void }).handleKeyDown(' ', ev);
    expect(internal.tool).toBe('fill');
    game.destroy();
  });

  // ── 17. Score is set on win ────────────────────────────────────
  it('sets a positive score on win', () => {
    const info = getGame('nonogram')!;
    const scoreFn = vi.fn();
    const game = info.createGame(makeConfig(360, 640, 1, scoreFn, undefined, undefined, 314));
    game.start();
    const internal = asInternal(game);
    internal.tool = 'fill';
    for (let r = 0; r < internal.rows; r++) {
      for (let c = 0; c < internal.cols; c++) {
        if (internal.solution[r][c]) internal.applyTool(r, c);
      }
    }
    expect(game.isWon()).toBe(true);
    expect(game.getScore()).toBeGreaterThan(0);
    expect(scoreFn).toHaveBeenCalled();
    game.destroy();
  });

  // ── 18. Solution always has at least one filled cell ───────────
  it('solution always has at least one filled cell across many seeds', () => {
    const info = getGame('nonogram')!;
    for (let s = 0; s < 25; s++) {
      const game = info.createGame(makeConfig(360, 640, 0, undefined, undefined, undefined, s));
      game.start();
      const internal = asInternal(game);
      let any = false;
      for (let r = 0; r < internal.rows && !any; r++) {
        for (let c = 0; c < internal.cols && !any; c++) {
          if (internal.solution[r][c]) any = true;
        }
      }
      expect(any).toBe(true);
      game.destroy();
    }
  });

  // ── Render coverage ─────────────────────────────────────────────
  describe('Render coverage', () => {
    function renderOf(game: GameEngine): () => void {
      return (game as unknown as { render(): void }).render.bind(game);
    }

    it('renders cleanly at all 4 difficulties', () => {
      const info = getGame('nonogram')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig(360, 640, d, undefined, undefined, undefined, 1000 + d));
        game.start();
        expect(() => renderOf(game)()).not.toThrow();
        game.destroy();
      }
    });

    it('renders an empty grid without throwing', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 1, undefined, undefined, undefined, 17));
      game.start();
      renderOf(game)();
      game.destroy();
    });

    it('renders a grid with mixed empty / filled / marked cells', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 1, undefined, undefined, undefined, 2024));
      game.start();
      const internal = asInternal(game);

      // Put each cell state on the board:
      //  - one correct fill (matches solution)
      //  - one incorrect fill (triggers CELL_BAD_FILL render branch)
      //  - one marked cell
      let placedFilled = false;
      let placedBadFill = false;
      let placedMarked = false;
      for (let r = 0; r < internal.rows; r++) {
        for (let c = 0; c < internal.cols; c++) {
          if (!placedFilled && internal.solution[r][c]) {
            internal.grid[r][c] = 'filled';
            placedFilled = true;
          } else if (!placedBadFill && !internal.solution[r][c]) {
            internal.grid[r][c] = 'filled'; // wrong fill → red render branch
            placedBadFill = true;
          } else if (!placedMarked) {
            internal.grid[r][c] = 'marked';
            placedMarked = true;
          }
          if (placedFilled && placedBadFill && placedMarked) break;
        }
        if (placedFilled && placedBadFill && placedMarked) break;
      }
      expect(placedFilled).toBe(true);
      expect(placedBadFill).toBe(true);
      expect(placedMarked).toBe(true);

      expect(() => renderOf(game)()).not.toThrow();
      game.destroy();
    });

    it('renders with row/column satisfaction highlights after completing lines', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 0, undefined, undefined, undefined, 4242));
      game.start();
      const internal = asInternal(game);

      // Fill the first row correctly — should mark that row satisfied
      for (let c = 0; c < internal.cols; c++) {
        if (internal.solution[0][c]) {
          internal.grid[0][c] = 'filled';
        }
      }
      // Fill the first column correctly — should mark that column satisfied
      for (let r = 0; r < internal.rows; r++) {
        if (internal.solution[r][0]) {
          internal.grid[r][0] = 'filled';
        }
      }
      expect(() => renderOf(game)()).not.toThrow();
      game.destroy();
    });

    it('renders with mark tool active (toolbar mark button highlighted)', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 1, undefined, undefined, undefined, 77));
      game.start();
      const internal = asInternal(game);
      internal.tool = 'mark';
      expect(() => renderOf(game)()).not.toThrow();
      game.destroy();
    });

    it('renders the win overlay after solving the puzzle', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 0, undefined, undefined, undefined, 9191));
      game.start();
      const internal = asInternal(game);
      internal.tool = 'fill';
      for (let r = 0; r < internal.rows; r++) {
        for (let c = 0; c < internal.cols; c++) {
          if (internal.solution[r][c]) internal.applyTool(r, c);
        }
      }
      expect(game.isWon()).toBe(true);
      // Advance winTime so the overlay fade-in reaches full opacity
      (game as unknown as { update(dt: number): void }).update(0.8);
      expect(() => renderOf(game)()).not.toThrow();
      game.destroy();
    });

    it('renders header mistakes counter at the limit (red color branch)', () => {
      const info = getGame('nonogram')!;
      // Difficulty 2: maxMistakes = 3
      const game = info.createGame(makeConfig(360, 640, 2, undefined, undefined, undefined, 606));
      game.start();
      const internal = asInternal(game);
      internal.tool = 'fill';

      // Generate mistakes by filling wrong cells until at or above the cap
      let tries = 0;
      while (internal.mistakes < internal.maxMistakes && tries < 200) {
        let fired = false;
        outer: for (let r = 0; r < internal.rows; r++) {
          for (let c = 0; c < internal.cols; c++) {
            if (!internal.solution[r][c] && internal.grid[r][c] === 'empty') {
              internal.applyTool(r, c);
              fired = true;
              break outer;
            }
          }
        }
        if (!fired) break;
        tries++;
      }
      expect(internal.mistakes).toBeGreaterThanOrEqual(internal.maxMistakes);
      expect(() => renderOf(game)()).not.toThrow();
      game.destroy();
    });

    it('renders header without the mistake counter when showMistakes is off (Easy)', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 0, undefined, undefined, undefined, 55));
      game.start();
      const internal = asInternal(game);
      expect(internal.showMistakes).toBe(false);
      expect(() => renderOf(game)()).not.toThrow();
      game.destroy();
    });

    it('renders timer after update ticks simulate minutes of play', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 1, undefined, undefined, undefined, 88));
      game.start();
      // Simulate ~70 seconds elapsed so the timer crosses the minute boundary
      const ticker = game as unknown as { update(dt: number): void };
      for (let i = 0; i < 70; i++) ticker.update(1);
      expect(() => renderOf(game)()).not.toThrow();
      game.destroy();
    });

    it('renders full lifecycle across difficulties with several update ticks', () => {
      const info = getGame('nonogram')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig(360, 640, d, undefined, undefined, undefined, 10 + d));
        game.start();
        const ticker = game as unknown as { update(dt: number): void; render(): void };
        for (let i = 0; i < 3; i++) {
          ticker.update(0.016);
          ticker.render();
        }
        game.destroy();
      }
    });
  });

  // ── Keyboard tool-switch shortcut coverage ──────────────────────
  describe('Keyboard shortcuts', () => {
    function press(game: GameEngine, key: string): void {
      const evt = new KeyboardEvent('keydown', { key });
      evt.preventDefault = vi.fn();
      (game as unknown as { handleKeyDown(k: string, e: KeyboardEvent): void }).handleKeyDown(key, evt);
    }

    it('f / F forces fill tool, x / X / m / M forces mark tool', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 1));
      game.start();
      const internal = asInternal(game);
      internal.tool = 'mark';
      press(game, 'f');
      expect(internal.tool).toBe('fill');
      press(game, 'x');
      expect(internal.tool).toBe('mark');
      press(game, 'F');
      expect(internal.tool).toBe('fill');
      press(game, 'M');
      expect(internal.tool).toBe('mark');
      press(game, 'X');
      expect(internal.tool).toBe('mark');
      press(game, 'm');
      expect(internal.tool).toBe('mark');
      // Unknown key is ignored
      press(game, 'q');
      expect(internal.tool).toBe('mark');
      game.destroy();
    });

    it('Spacebar alias for space also toggles the tool', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 1));
      game.start();
      const internal = asInternal(game);
      internal.tool = 'fill';
      const evt = new KeyboardEvent('keydown', { key: 'Spacebar' });
      evt.preventDefault = vi.fn();
      (game as unknown as { handleKeyDown(k: string, e: KeyboardEvent): void }).handleKeyDown('Spacebar', evt);
      expect(internal.tool).toBe('mark');
      game.destroy();
    });
  });

  // ── Pointer input coverage (tap tool buttons, long-press toggle) ─
  describe('Pointer input', () => {
    interface WithPointer extends NonogramInternal {
      toolFillRect: { x: number; y: number; w: number; h: number };
      toolMarkRect: { x: number; y: number; w: number; h: number };
      gridX: number;
      gridY: number;
      cellSize: number;
    }

    function asPointer(g: GameEngine): WithPointer {
      return g as unknown as WithPointer;
    }
    function down(g: GameEngine, x: number, y: number): void {
      (g as unknown as { handlePointerDown(x: number, y: number): void }).handlePointerDown(x, y);
    }
    function up(g: GameEngine, x: number, y: number): void {
      (g as unknown as { handlePointerUp(x: number, y: number): void }).handlePointerUp(x, y);
    }

    it('tapping the toolbar Fill button sets the fill tool', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 1));
      game.start();
      const internal = asPointer(game);
      internal.tool = 'mark';
      const r = internal.toolFillRect;
      down(game, r.x + r.w / 2, r.y + r.h / 2);
      expect(internal.tool).toBe('fill');
      game.destroy();
    });

    it('tapping the toolbar Mark button sets the mark tool', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 1));
      game.start();
      const internal = asPointer(game);
      internal.tool = 'fill';
      const r = internal.toolMarkRect;
      down(game, r.x + r.w / 2, r.y + r.h / 2);
      expect(internal.tool).toBe('mark');
      game.destroy();
    });

    it('tap + release on a grid cell applies the current tool', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 1, undefined, undefined, undefined, 4567));
      game.start();
      const internal = asPointer(game);
      internal.tool = 'mark';
      // Pick an empty solution cell (so mark is correct and doesn't cost a mistake)
      let target: { r: number; c: number } | null = null;
      outer: for (let r = 0; r < internal.rows; r++) {
        for (let c = 0; c < internal.cols; c++) {
          if (!internal.solution[r][c]) { target = { r, c }; break outer; }
        }
      }
      expect(target).not.toBeNull();
      if (!target) return;
      const x = internal.gridX + target.c * internal.cellSize + internal.cellSize / 2;
      const y = internal.gridY + target.r * internal.cellSize + internal.cellSize / 2;
      down(game, x, y);
      up(game, x, y);
      expect(internal.grid[target.r][target.c]).toBe('marked');
      game.destroy();
    });

    it('long-press on a cell toggles the active tool', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 1, undefined, undefined, undefined, 4321));
      game.start();
      const internal = asPointer(game);
      internal.tool = 'fill';

      // Target any in-grid cell
      const x = internal.gridX + internal.cellSize / 2;
      const y = internal.gridY + internal.cellSize / 2;

      // Manually backdate the pointer-down time to simulate a long press
      const ptr = game as unknown as { pointerDownTime: number };
      down(game, x, y);
      ptr.pointerDownTime = performance.now() - 800; // well past LONG_PRESS_MS
      up(game, x, y);
      expect(internal.tool).toBe('mark');
      game.destroy();
    });

    it('tapping outside the grid and outside the toolbar is a no-op', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 1));
      game.start();
      const internal = asPointer(game);
      const before = internal.tool;
      down(game, -10, -10);
      up(game, -10, -10);
      down(game, 9999, 9999);
      up(game, 9999, 9999);
      expect(internal.tool).toBe(before);
      game.destroy();
    });

    it('pointer events are ignored after the game ends', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 0, undefined, undefined, undefined, 31));
      game.start();
      const internal = asPointer(game);
      // Solve to win → gameActive=false
      internal.tool = 'fill';
      for (let r = 0; r < internal.rows; r++) {
        for (let c = 0; c < internal.cols; c++) {
          if (internal.solution[r][c]) internal.applyTool(r, c);
        }
      }
      expect(game.isWon()).toBe(true);
      const prevTool = internal.tool;
      // Taps after winning must be no-ops
      const r = internal.toolMarkRect;
      down(game, r.x + r.w / 2, r.y + r.h / 2);
      up(game, r.x + r.w / 2, r.y + r.h / 2);
      expect(internal.tool).toBe(prevTool);
      game.destroy();
    });

    it('drag: pointer up on a different cell than down does not apply the tool', () => {
      const info = getGame('nonogram')!;
      const game = info.createGame(makeConfig(360, 640, 1, undefined, undefined, undefined, 5500));
      game.start();
      const internal = asPointer(game);
      internal.tool = 'fill';

      const x1 = internal.gridX + internal.cellSize / 2;
      const y1 = internal.gridY + internal.cellSize / 2;
      const x2 = internal.gridX + internal.cellSize * 2 + internal.cellSize / 2;
      const y2 = internal.gridY + internal.cellSize * 2 + internal.cellSize / 2;
      down(game, x1, y1);
      up(game, x2, y2);
      expect(internal.grid[0][0]).toBe('empty');
      expect(internal.grid[2][2]).toBe('empty');
      game.destroy();
    });
  });
});
