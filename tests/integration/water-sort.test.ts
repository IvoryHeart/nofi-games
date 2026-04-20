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
import {
  Tube, canPour, pour, topColor, topSegmentLength, isSolvedTube, isLevelSolved,
  WaterSortLevel,
} from '../../src/games/water-sort/types';
import { generate } from '../../src/games/water-sort/generator';

function makeConfig(opts: { difficulty?: number; seed?: number; onWin?: (s: number) => void } = {}): GameConfig {
  const canvas = document.createElement('canvas');
  return {
    canvas, width: 360, height: 560,
    difficulty: opts.difficulty ?? 0, seed: opts.seed, onWin: opts.onWin,
  };
}

type WaterSortInternals = GameEngine & {
  level: WaterSortLevel;
  initialLevel: WaterSortLevel | null;
  selectedTubeIdx: number;
  moves: number;
  gameActive: boolean;
  testTapTube: (i: number) => void;
};

let info: GameInfo;
beforeAll(async () => {
  store.clear();
  await import('../../src/games/water-sort/WaterSort');
  info = getGame('water-sort')!;
  if (!info) throw new Error('water-sort not registered');
});

describe('Water Sort — Integration', () => {
  describe('Tube mechanics', () => {
    it('topColor, topSegmentLength, isSolvedTube behave correctly', () => {
      const empty: Tube = { capacity: 4, contents: [] };
      expect(topColor(empty)).toBe(-1);
      expect(topSegmentLength(empty)).toBe(0);
      expect(isSolvedTube(empty)).toBe(true);

      const mixed: Tube = { capacity: 4, contents: [0, 0, 1, 1] };
      expect(topColor(mixed)).toBe(1);
      expect(topSegmentLength(mixed)).toBe(2);
      expect(isSolvedTube(mixed)).toBe(false);

      const full: Tube = { capacity: 4, contents: [2, 2, 2, 2] };
      expect(isSolvedTube(full)).toBe(true);
    });

    it('canPour enforces color match and capacity', () => {
      const a: Tube = { capacity: 4, contents: [0, 0] };
      const b: Tube = { capacity: 4, contents: [0] };
      expect(canPour(a, b)).toBe(true); // same top color, space available
      const c: Tube = { capacity: 4, contents: [1] };
      expect(canPour(a, c)).toBe(false); // mismatched colors
      const d: Tube = { capacity: 4, contents: [] };
      expect(canPour(a, d)).toBe(true);  // empty destination
      const fullSameColor: Tube = { capacity: 4, contents: [0, 0, 0, 0] };
      expect(canPour(a, fullSameColor)).toBe(false); // no room
    });

    it('pour moves all same-color top units that fit', () => {
      const a: Tube = { capacity: 4, contents: [1, 0, 0, 0] };
      const b: Tube = { capacity: 4, contents: [0] };
      const n = pour(a, b);
      expect(n).toBe(3);
      expect(a.contents).toEqual([1]);
      expect(b.contents).toEqual([0, 0, 0, 0]);
    });

    it('pour returns 0 and mutates nothing when illegal', () => {
      const a: Tube = { capacity: 4, contents: [1] };
      const b: Tube = { capacity: 4, contents: [0] };
      expect(pour(a, b)).toBe(0);
      expect(a.contents).toEqual([1]);
      expect(b.contents).toEqual([0]);
    });

    it('isLevelSolved true iff all tubes empty or one-color-full', () => {
      const lvl: WaterSortLevel = {
        capacity: 4, numColors: 2,
        tubes: [
          { capacity: 4, contents: [0, 0, 0, 0] },
          { capacity: 4, contents: [1, 1, 1, 1] },
          { capacity: 4, contents: [] },
        ],
      };
      expect(isLevelSolved(lvl)).toBe(true);
      lvl.tubes[0].contents[0] = 1;
      expect(isLevelSolved(lvl)).toBe(false);
    });
  });

  describe('Generator', () => {
    it('produces a level for every bucket with the expected tube count', () => {
      // numColors + 2 empty tubes — 4+2, 7+2, 10+2, 12+2.
      const sizes = { easy: 6, medium: 9, hard: 12, expert: 14 } as const;
      for (const [bucket, count] of Object.entries(sizes)) {
        const lvl = generate(42, bucket as keyof typeof sizes);
        expect(lvl.tubes.length).toBe(count);
        // Unit conservation: every color appears exactly `capacity` times
        // across all tubes.
        const histogram = new Map<number, number>();
        for (const t of lvl.tubes) {
          for (const c of t.contents) histogram.set(c, (histogram.get(c) ?? 0) + 1);
        }
        for (let c = 0; c < lvl.numColors; c++) {
          expect(histogram.get(c) ?? 0).toBe(lvl.capacity);
        }
      }
    });

    it('is deterministic for the same seed', () => {
      const a = generate(123, 'medium');
      const b = generate(123, 'medium');
      expect(a.tubes.map(t => t.contents)).toEqual(b.tubes.map(t => t.contents));
    });

    it('a freshly generated puzzle is NOT already solved', () => {
      const lvl = generate(99, 'medium');
      expect(isLevelSolved(lvl)).toBe(false);
    });

    it('every coloured tube starts mixed (no tube is pre-sorted)', () => {
      for (const bucket of ['easy', 'medium', 'hard', 'expert'] as const) {
        const lvl = generate(7, bucket);
        for (const t of lvl.tubes) {
          if (t.contents.length === 0) continue;
          if (t.contents.length < t.capacity) continue;
          // Full tubes must have more than one distinct colour
          const unique = new Set(t.contents);
          expect(unique.size).toBeGreaterThan(1);
        }
      }
    });

    it('every bucket ships exactly 2 empty tubes', () => {
      for (const bucket of ['easy', 'medium', 'hard', 'expert'] as const) {
        const lvl = generate(13, bucket);
        const empty = lvl.tubes.filter(t => t.contents.length === 0).length;
        expect(empty).toBe(2);
      }
    });
  });

  describe('Game lifecycle', () => {
    it('instantiates at all 4 difficulties', () => {
      for (let d = 0; d <= 3; d++) {
        const g = info.createGame(makeConfig({ difficulty: d, seed: 50 + d }));
        expect(g).toBeInstanceOf(GameEngine);
        g.destroy();
      }
    });

    it('tapping an empty tube first does not select it', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 1 })) as WaterSortInternals;
      g.start();
      // Easy has extraTubes=2 so at least one tube is empty
      const emptyIdx = g.level.tubes.findIndex(t => t.contents.length === 0);
      expect(emptyIdx).toBeGreaterThanOrEqual(0);
      g.testTapTube(emptyIdx);
      expect(g.selectedTubeIdx).toBe(-1);
      g.destroy();
    });

    it('pour between compatible tubes increments moves', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 1 })) as WaterSortInternals;
      g.start();
      // Find a legal source/dest pair
      let src = -1, dst = -1;
      outer: for (let i = 0; i < g.level.tubes.length; i++) {
        for (let j = 0; j < g.level.tubes.length; j++) {
          if (i === j) continue;
          if (canPour(g.level.tubes[i], g.level.tubes[j])) { src = i; dst = j; break outer; }
        }
      }
      expect(src).toBeGreaterThanOrEqual(0);
      const before = g.moves;
      g.testTapTube(src);
      expect(g.selectedTubeIdx).toBe(src);
      g.testTapTube(dst);
      expect(g.moves).toBe(before + 1);
      expect(g.selectedTubeIdx).toBe(-1);
      g.destroy();
    });

    it('solving the puzzle triggers win', () => {
      const winFn = vi.fn();
      // Build a trivial 2-color 3-tube solvable setup by hand
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 1, onWin: winFn })) as WaterSortInternals;
      g.start();
      g.level.tubes = [
        { capacity: 4, contents: [0, 0, 0, 1] },
        { capacity: 4, contents: [1, 1, 1, 0] },
        { capacity: 4, contents: [] },
      ];
      // 1→2 (move the 1 from tube 0 to tube 2)
      g.testTapTube(0); g.testTapTube(2);
      // 0→1 (move the 0 from tube 1 to tube 0? wait top of tube 1 is now 1)
      // Plan: top of tube 0 is now 0 (0,0,0). Top of tube 1 is 0. Tube 2 has [1].
      // Move tube 1 top (the 0) to tube 0.
      g.testTapTube(1); g.testTapTube(0);
      // Now: tube 0 = [0,0,0,0] (solved). tube 1 = [1,1,1]. tube 2 = [1].
      // Move tube 1 → tube 2
      g.testTapTube(1); g.testTapTube(2);
      // Now: tube 0 full 0, tube 1 empty, tube 2 full 1. Solved.
      expect(winFn).toHaveBeenCalled();
      g.destroy();
    });
  });

  describe('Save / Resume', () => {
    it('round-trips serialize/deserialize', () => {
      const g1 = info.createGame(makeConfig({ difficulty: 0, seed: 7 })) as WaterSortInternals;
      g1.start();
      // Make any move we can
      for (let i = 0; i < g1.level.tubes.length; i++) {
        for (let j = 0; j < g1.level.tubes.length; j++) {
          if (i !== j && canPour(g1.level.tubes[i], g1.level.tubes[j])) {
            g1.testTapTube(i); g1.testTapTube(j); break;
          }
        }
        if (g1.moves > 0) break;
      }
      const snap = g1.serialize() as GameSnapshot;
      const before = {
        tubes: g1.level.tubes.map(t => t.contents.slice()),
        moves: g1.moves,
      };
      g1.destroy();

      const g2 = info.createGame(makeConfig({ difficulty: 0, seed: 999 })) as WaterSortInternals;
      g2.start();
      g2.deserialize(snap);
      expect(g2.level.tubes.map(t => t.contents.slice())).toEqual(before.tubes);
      expect(g2.moves).toBe(before.moves);
      g2.destroy();
    });
  });

  describe('Restart', () => {
    it('reset() returns to the initial puzzle', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 7 })) as WaterSortInternals;
      g.start();
      const before = g.level.tubes.map(t => t.contents.slice());
      // Make a move
      for (let i = 0; i < g.level.tubes.length; i++) {
        for (let j = 0; j < g.level.tubes.length; j++) {
          if (i !== j && canPour(g.level.tubes[i], g.level.tubes[j])) {
            g.testTapTube(i); g.testTapTube(j); break;
          }
        }
        if (g.moves > 0) break;
      }
      g.reset();
      expect(g.level.tubes.map(t => t.contents.slice())).toEqual(before);
      expect(g.moves).toBe(0);
      g.destroy();
    });
  });
});
