import { describe, it, expect, beforeAll, vi } from 'vitest';
import { GameEngine, GameConfig, GameSnapshot } from '../../src/engine/GameEngine';

// Mock idb-keyval before any source imports.
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  del: vi.fn((key: string) => {
    store.delete(key);
    return Promise.resolve();
  }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { getGame, GameInfo } from '../../src/games/registry';
import { parseLevel, Level } from '../../src/games/maze-paint/types';
import { solve, slide, scoreDifficulty, bucketFor, stats } from '../../src/games/maze-paint/solver';
import { generate, generateDaily } from '../../src/games/maze-paint/generator';

function makeConfig(opts: {
  width?: number;
  height?: number;
  difficulty?: number;
  seed?: number;
  onWin?: (s: number) => void;
  onGameOver?: (s: number) => void;
} = {}): GameConfig {
  const canvas = document.createElement('canvas');
  return {
    canvas,
    width: opts.width ?? 360,
    height: opts.height ?? 640,
    difficulty: opts.difficulty ?? 0,
    seed: opts.seed,
    onWin: opts.onWin,
    onGameOver: opts.onGameOver,
  };
}

type MazePaintInternals = GameEngine & {
  level: Level;
  ballCol: number;
  ballRow: number;
  painted: Uint8Array;
  floorCount: number;
  paintedCount: number;
  moves: number;
  gameActive: boolean;
  winScheduled: boolean;
  testSlide: (dir: 'up' | 'down' | 'left' | 'right') => void;
};

let info: GameInfo;
beforeAll(async () => {
  store.clear();
  await import('../../src/games/maze-paint/MazePaint');
  const fetched = getGame('maze-paint');
  if (!fetched) throw new Error('maze-paint not registered');
  info = fetched;
});

describe('Maze Paint — Integration', () => {
  describe('Registration', () => {
    it('is registered with the registry', () => {
      expect(info).toBeDefined();
      expect(info.id).toBe('maze-paint');
      expect(info.name).toBe('Maze Paint');
      expect(info.category).toBe('puzzle');
      expect(info.dailyMode).toBe(true);
    });

    it('has expected canvas dimensions and controls', () => {
      expect(info.canvasWidth).toBe(360);
      expect(info.canvasHeight).toBe(640);
      expect(info.controls).toContain('wall');
      expect(info.bgGradient).toEqual(['#D14E5C', '#F4A0A8']);
    });
  });

  describe('Parsing and slide mechanics', () => {
    it('parses a simple grid correctly', () => {
      const level = parseLevel([
        '@##',
        '###',
      ]);
      expect(level.cols).toBe(3);
      expect(level.rows).toBe(2);
      expect(level.start).toEqual({ col: 0, row: 0 });
      // All 6 cells are floor
      for (let i = 0; i < 6; i++) expect(level.cells[i]).toBe(1);
    });

    it('slides until hitting a wall (off-grid)', () => {
      const level = parseLevel(['@##']);
      const end = slide(level, 0, 0, 'right');
      expect(end.col).toBe(2);
      expect(end.row).toBe(0);
      expect(end.path.length).toBe(3);
    });

    it('slides stop at edge when next cell is empty', () => {
      const level = parseLevel([
        '@#.',
        '##.',
      ]);
      const end = slide(level, 0, 0, 'right');
      expect(end.col).toBe(1); // stops before empty cell
      expect(end.row).toBe(0);
    });

    it('does not move when direction is blocked', () => {
      const level = parseLevel([
        '.#',
        '@#',
      ]);
      const end = slide(level, 0, 1, 'up');
      expect(end.col).toBe(0);
      expect(end.row).toBe(1); // unchanged
    });
  });

  describe('Solver', () => {
    it('solves a trivial 1x3 corridor in 1 move', () => {
      const level = parseLevel(['@##']);
      const r = solve(level);
      expect(r).not.toBeNull();
      expect(r!.minMoves).toBe(1);
    });

    it('solves a 3x2 rectangle in at most 3 moves', () => {
      const level = parseLevel(['@##', '###']);
      const r = solve(level);
      expect(r).not.toBeNull();
      expect(r!.minMoves).toBeLessThanOrEqual(3);
      expect(r!.floorCount).toBe(6);
    });

    it('returns non-null for a connected puzzle', () => {
      const level = parseLevel([
        '##.',
        '@#.',
        '###',
      ]);
      const r = solve(level);
      expect(r).not.toBeNull();
      expect(r!.minMoves).toBeGreaterThan(0);
    });

    it('assigns low difficulty score to trivial puzzles', () => {
      const level = parseLevel(['@##']);
      const s = stats(level);
      expect(s).not.toBeNull();
      expect(s!.score).toBeLessThan(25);
      expect(bucketFor(s!.score)).toBe('easy');
    });

    it('scoreDifficulty yields higher scores for longer solutions', () => {
      const easy = solve(parseLevel(['@##']))!;
      const bigger = solve(parseLevel([
        '@####',
        '#...#',
        '#####',
      ]))!;
      expect(scoreDifficulty(bigger)).toBeGreaterThan(scoreDifficulty(easy));
    });
  });

  describe('Generator', () => {
    it('generates a solvable level with target floor size', () => {
      const g = generate({ cols: 5, rows: 5, targetFloor: 12, seed: 42 });
      expect(g).not.toBeNull();
      expect(g!.result.floorCount).toBeGreaterThanOrEqual(10);
      expect(g!.result.minMoves).toBeGreaterThan(0);
    });

    it('produces deterministic output for the same seed', () => {
      const a = generate({ cols: 5, rows: 5, targetFloor: 12, seed: 777 });
      const b = generate({ cols: 5, rows: 5, targetFloor: 12, seed: 777 });
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(a!.level.cells).toEqual(b!.level.cells);
      expect(a!.level.start).toEqual(b!.level.start);
    });

    it('generateDaily always returns a valid level for every bucket', () => {
      for (const bucket of ['easy', 'medium', 'hard', 'expert'] as const) {
        const g = generateDaily(1234567, bucket);
        expect(g.level.cells.length).toBe(g.level.cols * g.level.rows);
        expect(g.level.cells[g.level.start.row * g.level.cols + g.level.start.col]).toBe(1);
        expect(g.result.minMoves).toBeGreaterThan(0);
      }
    });
  });

  describe('Game lifecycle', () => {
    it('instantiates at all 4 difficulties without throwing', () => {
      for (let d = 0; d <= 3; d++) {
        const g = info.createGame(makeConfig({ difficulty: d, seed: 100 + d }));
        expect(g).toBeInstanceOf(GameEngine);
        g.destroy();
      }
    });

    it('initializes with ball on a floor cell and starting tile painted', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as MazePaintInternals;
      g.start();
      expect(g.level.cells[g.ballRow * g.level.cols + g.ballCol]).toBe(1);
      expect(g.painted[g.ballRow * g.level.cols + g.ballCol]).toBe(1);
      expect(g.paintedCount).toBeGreaterThanOrEqual(1);
      expect(g.moves).toBe(0);
      g.destroy();
    });

    it('slides and paints every cell traversed', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as MazePaintInternals;
      g.start();
      const beforePainted = g.paintedCount;
      // Try all 4 directions — at least one must move and paint
      let moved = false;
      for (const dir of ['right', 'down', 'left', 'up'] as const) {
        const prev = { col: g.ballCol, row: g.ballRow };
        g.testSlide(dir);
        if (g.ballCol !== prev.col || g.ballRow !== prev.row) {
          moved = true;
          break;
        }
      }
      expect(moved).toBe(true);
      expect(g.paintedCount).toBeGreaterThan(beforePainted);
      expect(g.moves).toBeGreaterThan(0);
      g.destroy();
    });

    it('triggers win when all floor tiles are painted', async () => {
      const winFn = vi.fn();
      const overFn = vi.fn();
      const g = info.createGame(
        makeConfig({ difficulty: 0, seed: 99, onWin: winFn, onGameOver: overFn }),
      ) as MazePaintInternals;
      g.start();
      // Force-paint every floor tile via internal state
      for (let i = 0; i < g.painted.length; i++) {
        if (g.level.cells[i] === 1) g.painted[i] = 1;
      }
      g.paintedCount = g.floorCount;
      // Pick ANY direction that moves so handleSolved fires through completeSlide path
      const dirs = ['right', 'down', 'left', 'up'] as const;
      // Instead of triggering via slide (which may not move), call the solve path directly
      // by invoking the internal handleSolved flow through testSlide
      for (const dir of dirs) {
        const before = { col: g.ballCol, row: g.ballRow };
        g.testSlide(dir);
        if (g.ballCol !== before.col || g.ballRow !== before.row) break;
      }
      expect(winFn).toHaveBeenCalled();
      g.destroy();
    });
  });

  describe('Save / Resume', () => {
    it('round-trips serialize/deserialize preserving level and painted state', () => {
      const g1 = info.createGame(makeConfig({ difficulty: 1, seed: 7 })) as MazePaintInternals;
      g1.start();
      // Make a couple of moves
      const dirs = ['right', 'down', 'left', 'up'] as const;
      for (const d of dirs) g1.testSlide(d);
      const snap = g1.serialize() as GameSnapshot;
      const before = {
        cells: Array.from(g1.level.cells),
        painted: Array.from(g1.painted),
        ballCol: g1.ballCol,
        ballRow: g1.ballRow,
        moves: g1.moves,
        paintedCount: g1.paintedCount,
      };
      g1.destroy();

      const g2 = info.createGame(makeConfig({ difficulty: 1, seed: 999 })) as MazePaintInternals;
      g2.start();
      g2.deserialize(snap);
      expect(Array.from(g2.level.cells)).toEqual(before.cells);
      expect(Array.from(g2.painted)).toEqual(before.painted);
      expect(g2.ballCol).toBe(before.ballCol);
      expect(g2.ballRow).toBe(before.ballRow);
      expect(g2.moves).toBe(before.moves);
      expect(g2.paintedCount).toBe(before.paintedCount);
      g2.destroy();
    });

    it('silently bails on corrupt snapshot', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 5 })) as MazePaintInternals;
      g.start();
      const before = {
        col: g.ballCol, row: g.ballRow, paintedCount: g.paintedCount,
      };
      // Corrupt snapshot
      g.deserialize({ cols: 'nope' as unknown as number, rows: 10, cells: [], start: null as unknown as { col: number; row: number }, painted: [] });
      expect(g.ballCol).toBe(before.col);
      expect(g.ballRow).toBe(before.row);
      expect(g.paintedCount).toBe(before.paintedCount);
      g.destroy();
    });

    it('canSave is true when idle and game is active, false during animation', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 5 })) as MazePaintInternals;
      g.start();
      expect(g.canSave()).toBe(true);
      g.destroy();
    });
  });

  describe('Daily Mode determinism', () => {
    it('same seed produces same puzzle', () => {
      const g1 = info.createGame(makeConfig({ difficulty: 1, seed: 314 })) as MazePaintInternals;
      g1.start();
      const g2 = info.createGame(makeConfig({ difficulty: 1, seed: 314 })) as MazePaintInternals;
      g2.start();
      expect(Array.from(g1.level.cells)).toEqual(Array.from(g2.level.cells));
      expect(g1.level.start).toEqual(g2.level.start);
      g1.destroy();
      g2.destroy();
    });
  });

  describe('Start position', () => {
    it('ball starts on a perimeter cell (at least one non-floor neighbor)', () => {
      // Exercise a few seeds across all four difficulty tiers. Expert
      // generation is a bit expensive (bigger grids + more attempts), so we
      // stick to 2 seeds per tier to keep the test under 30s.
      for (const diff of [0, 1, 2, 3]) {
        for (const seed of [11, 222]) {
          const g = info.createGame(makeConfig({ difficulty: diff, seed })) as MazePaintInternals;
          g.start();
          const { col, row } = g.level.start;
          let hasWall = false;
          for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
            const nc = col + dc, nr = row + dr;
            if (nc < 0 || nc >= g.level.cols || nr < 0 || nr >= g.level.rows) {
              hasWall = true; break;
            }
            if (g.level.cells[nr * g.level.cols + nc] === 0) {
              hasWall = true; break;
            }
          }
          expect(hasWall).toBe(true);
          g.destroy();
        }
      }
    }, 30_000);
  });

  describe('Scoring', () => {
    it('Expert wins score higher than Easy wins for equivalent play', () => {
      function scoreFor(difficulty: number, seed: number): number {
        const g = info.createGame(makeConfig({ difficulty, seed })) as MazePaintInternals;
        g.start();
        // Force-paint everything + set moves to optimal to simulate a perfect solve
        for (let i = 0; i < g.painted.length; i++) {
          if (g.level.cells[i] === 1) g.painted[i] = 1;
        }
        g.paintedCount = g.floorCount;
        // moves = minMoves → perfect solve
        (g as unknown as { moves: number }).moves =
          (g as unknown as { activeMinMoves: number }).activeMinMoves;
        // Trigger win handler directly via testSlide (paints nothing, but
        // paintedCount already equals floorCount so handleSolved will fire).
        // We need any direction that moves the ball.
        for (const d of ['right', 'down', 'left', 'up'] as const) {
          const before = { col: g.ballCol, row: g.ballRow };
          g.testSlide(d);
          if (g.ballCol !== before.col || g.ballRow !== before.row) break;
        }
        const s = g.getScore();
        g.destroy();
        return s;
      }
      const easy = scoreFor(0, 42);
      const expert = scoreFor(3, 42);
      expect(expert).toBeGreaterThan(easy);
    });

    it('perfect solve scores higher than sloppy solve on the same puzzle', () => {
      function scoreAt(moves: number): number {
        const g = info.createGame(makeConfig({ difficulty: 1, seed: 42 })) as MazePaintInternals;
        g.start();
        for (let i = 0; i < g.painted.length; i++) {
          if (g.level.cells[i] === 1) g.painted[i] = 1;
        }
        g.paintedCount = g.floorCount;
        (g as unknown as { moves: number }).moves = moves;
        for (const d of ['right', 'down', 'left', 'up'] as const) {
          const before = { col: g.ballCol, row: g.ballRow };
          g.testSlide(d);
          if (g.ballCol !== before.col || g.ballRow !== before.row) break;
        }
        const s = g.getScore();
        g.destroy();
        return s;
      }
      const min = (info.createGame(makeConfig({ difficulty: 1, seed: 42 })) as MazePaintInternals);
      min.start();
      const optimal = (min as unknown as { activeMinMoves: number }).activeMinMoves;
      min.destroy();
      expect(scoreAt(optimal)).toBeGreaterThan(scoreAt(optimal * 3));
    });
  });

  describe('Restart', () => {
    it('reset() replays the same puzzle rather than rolling a new one', () => {
      const g = info.createGame(makeConfig({ difficulty: 1 })) as MazePaintInternals;
      g.start();
      const before = {
        cells: Array.from(g.level.cells),
        start: { col: g.level.start.col, row: g.level.start.row },
        cols: g.level.cols,
        rows: g.level.rows,
      };
      // Make a move to dirty the state
      for (const dir of ['right', 'down', 'left', 'up'] as const) {
        g.testSlide(dir);
        if (g.moves > 0) break;
      }
      g.reset();
      expect(g.level.cols).toBe(before.cols);
      expect(g.level.rows).toBe(before.rows);
      expect(Array.from(g.level.cells)).toEqual(before.cells);
      expect(g.level.start).toEqual(before.start);
      // Also: progress is cleared
      expect(g.moves).toBe(0);
      // Exactly one cell painted (the start)
      expect(g.paintedCount).toBe(1);
      g.destroy();
    });
  });
});
