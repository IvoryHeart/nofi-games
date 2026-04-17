import { describe, it, expect, beforeAll, vi } from 'vitest';
import { GameEngine, GameConfig, GameSnapshot } from '../../src/engine/GameEngine';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { getGame, GameInfo } from '../../src/games/registry';
import { generate, generateDaily } from '../../src/games/flow-connect/generator';
import { FlowLevel, Endpoint, isAdjacent } from '../../src/games/flow-connect/types';

function makeConfig(opts: {
  difficulty?: number;
  seed?: number;
  onWin?: (s: number) => void;
} = {}): GameConfig {
  const canvas = document.createElement('canvas');
  return {
    canvas,
    width: 360,
    height: 560,
    difficulty: opts.difficulty ?? 0,
    seed: opts.seed,
    onWin: opts.onWin,
  };
}

type FlowInternals = GameEngine & {
  level: FlowLevel;
  numColors: number;
  cellOwner: Int8Array;
  paths: Array<Array<{ col: number; row: number }>>;
  moves: number;
  gameActive: boolean;
  testDrawPath: (color: number, cells: Array<{ col: number; row: number }>) => void;
  isSolved: () => boolean;
};

let info: GameInfo;
beforeAll(async () => {
  store.clear();
  await import('../../src/games/flow-connect/FlowConnect');
  const fetched = getGame('flow-connect');
  if (!fetched) throw new Error('flow-connect not registered');
  info = fetched;
});

describe('Flow Connect — Integration', () => {
  describe('Registration', () => {
    it('is registered', () => {
      expect(info.id).toBe('flow-connect');
      expect(info.name).toBe('Flow Connect');
      expect(info.category).toBe('puzzle');
      expect(info.dailyMode).toBe(true);
    });
  });

  describe('Generator', () => {
    it('generates a puzzle with coverage guarantee', () => {
      const level = generate({ cols: 5, rows: 5, numColors: 4, seed: 42 });
      expect(level).not.toBeNull();
      expect(level!.endpoints.length).toBe(8); // 4 colors × 2 endpoints
      expect(level!.solution).toBeDefined();

      // All segments cover all cells, no overlap
      const marked = new Set<string>();
      let totalCells = 0;
      for (const seg of level!.solution!) {
        for (const cell of seg) {
          const k = `${cell.col},${cell.row}`;
          expect(marked.has(k)).toBe(false);
          marked.add(k);
          totalCells++;
        }
        // Each step must be adjacent
        for (let i = 1; i < seg.length; i++) {
          expect(isAdjacent(seg[i - 1], seg[i])).toBe(true);
        }
      }
      expect(totalCells).toBe(25);
    });

    it('endpoints lie at the start and end of each solution segment', () => {
      const level = generate({ cols: 5, rows: 5, numColors: 4, seed: 17 })!;
      for (let c = 0; c < 4; c++) {
        const eps = level.endpoints.filter(e => e.color === c);
        expect(eps.length).toBe(2);
        const seg = level.solution![c];
        const first = seg[0];
        const last = seg[seg.length - 1];
        const firstIsEp = eps.some(e => e.col === first.col && e.row === first.row);
        const lastIsEp = eps.some(e => e.col === last.col && e.row === last.row);
        expect(firstIsEp).toBe(true);
        expect(lastIsEp).toBe(true);
      }
    });

    it('is deterministic for the same seed', () => {
      const a = generate({ cols: 5, rows: 5, numColors: 4, seed: 555 });
      const b = generate({ cols: 5, rows: 5, numColors: 4, seed: 555 });
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(a!.endpoints).toEqual(b!.endpoints);
    });

    it('generateDaily returns a valid level for every bucket', () => {
      for (const bucket of ['easy', 'medium', 'hard', 'expert'] as const) {
        const level = generateDaily(8675309, bucket);
        expect(level.endpoints.length % 2).toBe(0);
        expect(level.endpoints.length).toBeGreaterThanOrEqual(4);
        expect(level.cols).toBeGreaterThan(0);
        expect(level.rows).toBeGreaterThan(0);
      }
    });
  });

  describe('Game lifecycle', () => {
    it('instantiates at all 4 difficulties', () => {
      for (let d = 0; d <= 3; d++) {
        const g = info.createGame(makeConfig({ difficulty: d, seed: 100 + d }));
        expect(g).toBeInstanceOf(GameEngine);
        g.destroy();
      }
    });

    it('initializes with all cells empty and no paths', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as FlowInternals;
      g.start();
      expect(g.numColors).toBeGreaterThan(0);
      expect(g.paths.length).toBe(g.numColors);
      for (const path of g.paths) expect(path.length).toBe(0);
      for (let i = 0; i < g.cellOwner.length; i++) expect(g.cellOwner[i]).toBe(-1);
      g.destroy();
    });

    it('draws the full solution and wins', () => {
      const winFn = vi.fn();
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42, onWin: winFn })) as FlowInternals;
      g.start();
      // Use the pre-computed solution to draw each color's path
      const solution = g.level.solution;
      expect(solution).toBeDefined();
      for (let c = 0; c < g.numColors; c++) {
        g.testDrawPath(c, solution![c]);
      }
      expect(g.isSolved()).toBe(true);
      expect(winFn).toHaveBeenCalled();
      g.destroy();
    });

    it('partial path does not trigger win', () => {
      const winFn = vi.fn();
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42, onWin: winFn })) as FlowInternals;
      g.start();
      const solution = g.level.solution!;
      // Only draw first color — others empty
      g.testDrawPath(0, solution[0]);
      expect(g.isSolved()).toBe(false);
      expect(winFn).not.toHaveBeenCalled();
      g.destroy();
    });
  });

  describe('Save / Resume', () => {
    it('round-trips serialize/deserialize', () => {
      const g1 = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as FlowInternals;
      g1.start();
      const sol = g1.level.solution!;
      // Draw half of color 0
      g1.testDrawPath(0, sol[0].slice(0, Math.max(2, Math.floor(sol[0].length / 2))));
      const snap = g1.serialize() as GameSnapshot;
      const before = {
        endpoints: g1.level.endpoints.map(e => ({ ...e })),
        paths: g1.paths.map(p => p.map(c => ({ ...c }))),
        moves: g1.moves,
      };
      g1.destroy();

      const g2 = info.createGame(makeConfig({ difficulty: 0, seed: 999 })) as FlowInternals;
      g2.start();
      g2.deserialize(snap);
      expect(g2.level.endpoints).toEqual(before.endpoints);
      expect(g2.paths).toEqual(before.paths);
      expect(g2.moves).toBe(before.moves);
      g2.destroy();
    });

    it('silently bails on corrupt snapshot', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 5 })) as FlowInternals;
      g.start();
      const before = { numColors: g.numColors };
      g.deserialize({ cols: 'nope' as unknown as number, rows: 0, endpoints: null as unknown as Endpoint[], paths: [] });
      expect(g.numColors).toBe(before.numColors);
      g.destroy();
    });
  });
});
