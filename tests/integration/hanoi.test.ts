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

function makeConfig(opts: { difficulty?: number; onWin?: (s: number) => void } = {}): GameConfig {
  const canvas = document.createElement('canvas');
  return { canvas, width: 360, height: 480, difficulty: opts.difficulty ?? 0, onWin: opts.onWin };
}

type HanoiInternals = GameEngine & {
  pegs: number[][];
  diskCount: number;
  minMoves: number;
  moves: number;
  gameActive: boolean;
  testMove: (from: number, to: number) => boolean;
};

/** Recursive optimal Hanoi solver — plays a known minimum solution for tests. */
function solve(
  game: HanoiInternals, n: number, from: number, to: number, via: number,
): void {
  if (n === 0) return;
  solve(game, n - 1, from, via, to);
  game.testMove(from, to);
  solve(game, n - 1, via, to, from);
}

let info: GameInfo;
beforeAll(async () => {
  store.clear();
  await import('../../src/games/hanoi/Hanoi');
  info = getGame('hanoi')!;
  if (!info) throw new Error('hanoi not registered');
});

describe('Towers of Hanoi — Integration', () => {
  describe('Registration', () => {
    it('is registered', () => {
      expect(info.id).toBe('hanoi');
      expect(info.name).toBe('Towers of Hanoi');
      expect(info.category).toBe('puzzle');
    });
  });

  describe('Initial state', () => {
    it('all disks start on left peg with largest at bottom', () => {
      for (let d = 0; d <= 3; d++) {
        const g = info.createGame(makeConfig({ difficulty: d })) as HanoiInternals;
        g.start();
        expect(g.pegs[0].length).toBe(g.diskCount);
        expect(g.pegs[1].length).toBe(0);
        expect(g.pegs[2].length).toBe(0);
        // Bottom = largest size, top = smallest
        for (let i = 0; i < g.diskCount; i++) {
          expect(g.pegs[0][i]).toBe(g.diskCount - i);
        }
        expect(g.minMoves).toBe((1 << g.diskCount) - 1);
        g.destroy();
      }
    });
  });

  describe('Move validation', () => {
    it('cannot place a larger disk on a smaller one', () => {
      const g = info.createGame(makeConfig({ difficulty: 0 })) as HanoiInternals;
      g.start();
      // Move disk 1 (smallest) to peg 1
      expect(g.testMove(0, 1)).toBe(true);
      // Try to move disk 2 on top of disk 1
      expect(g.testMove(0, 1)).toBe(false);
      g.destroy();
    });

    it('cannot move from an empty peg', () => {
      const g = info.createGame(makeConfig({ difficulty: 0 })) as HanoiInternals;
      g.start();
      expect(g.testMove(1, 2)).toBe(false); // peg 1 is empty
      g.destroy();
    });
  });

  describe('Winning', () => {
    it('optimal solution wins in 2^n - 1 moves', () => {
      for (let d = 0; d <= 3; d++) {
        const winFn = vi.fn();
        const g = info.createGame(makeConfig({ difficulty: d, onWin: winFn })) as HanoiInternals;
        g.start();
        solve(g, g.diskCount, 0, 2, 1);
        expect(g.pegs[2].length).toBe(g.diskCount);
        expect(g.moves).toBe(g.minMoves);
        expect(winFn).toHaveBeenCalled();
        g.destroy();
      }
    });

    it('doesn\'t win until every disk is on the target peg', () => {
      const winFn = vi.fn();
      const g = info.createGame(makeConfig({ difficulty: 0, onWin: winFn })) as HanoiInternals;
      g.start();
      g.testMove(0, 2);
      g.testMove(0, 1);
      expect(winFn).not.toHaveBeenCalled();
      g.destroy();
    });
  });

  describe('Save / Resume', () => {
    it('round-trips state through serialize/deserialize', () => {
      const g1 = info.createGame(makeConfig({ difficulty: 1 })) as HanoiInternals;
      g1.start();
      g1.testMove(0, 2);
      g1.testMove(0, 1);
      const snap = g1.serialize() as GameSnapshot;
      const before = {
        pegs: g1.pegs.map(p => p.slice()),
        diskCount: g1.diskCount,
        moves: g1.moves,
      };
      g1.destroy();

      const g2 = info.createGame(makeConfig({ difficulty: 3 })) as HanoiInternals;
      g2.start();
      g2.deserialize(snap);
      expect(g2.diskCount).toBe(before.diskCount);
      expect(g2.pegs.map(p => p.slice())).toEqual(before.pegs);
      expect(g2.moves).toBe(before.moves);
      g2.destroy();
    });
  });

  describe('Restart', () => {
    it('reset() rebuilds the starting stack', () => {
      const g = info.createGame(makeConfig({ difficulty: 1 })) as HanoiInternals;
      g.start();
      g.testMove(0, 1);
      g.testMove(0, 2);
      g.reset();
      expect(g.pegs[0].length).toBe(g.diskCount);
      expect(g.pegs[1].length).toBe(0);
      expect(g.pegs[2].length).toBe(0);
      expect(g.moves).toBe(0);
      g.destroy();
    });
  });
});
