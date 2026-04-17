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
import { generateLevel } from '../../src/games/ricochet/generator';
import { RicochetLevel, Target, Obstacle, BallState } from '../../src/games/ricochet/types';

function makeConfig(opts: {
  difficulty?: number;
  seed?: number;
  onWin?: (s: number) => void;
  onGameOver?: (s: number) => void;
} = {}): GameConfig {
  const canvas = document.createElement('canvas');
  return {
    canvas,
    width: 360,
    height: 600,
    difficulty: opts.difficulty ?? 0,
    seed: opts.seed,
    onWin: opts.onWin,
    onGameOver: opts.onGameOver,
  };
}

type RicochetInternals = GameEngine & {
  level: RicochetLevel;
  targets: Target[];
  obstacles: Obstacle[];
  ball: BallState;
  dartsRemaining: number;
  gameActive: boolean;
  testFire: (vx: number, vy: number) => void;
  testDestroyAllTargets: () => void;
  allTargetsDestroyed: () => boolean;
};

let info: GameInfo;
beforeAll(async () => {
  store.clear();
  await import('../../src/games/ricochet/Ricochet');
  const fetched = getGame('ricochet');
  if (!fetched) throw new Error('ricochet not registered');
  info = fetched;
});

describe('Ricochet — Integration', () => {
  describe('Registration', () => {
    it('is registered', () => {
      expect(info.id).toBe('ricochet');
      expect(info.name).toBe('Ricochet');
      expect(info.category).toBe('arcade');
      expect(info.dailyMode).toBe(true);
    });
  });

  describe('Generator', () => {
    it('produces a level for every bucket', () => {
      for (const bucket of ['easy', 'medium', 'hard', 'expert'] as const) {
        const level = generateLevel({ seed: 111, bucket });
        expect(level.targets.length).toBeGreaterThan(0);
        expect(level.darts).toBeGreaterThan(0);
        expect(level.arena.w).toBeGreaterThan(0);
        expect(level.arena.h).toBeGreaterThan(0);
      }
    });

    it('is deterministic for the same seed', () => {
      const a = generateLevel({ seed: 42, bucket: 'medium' });
      const b = generateLevel({ seed: 42, bucket: 'medium' });
      expect(a.targets.map(t => ({ x: t.x, y: t.y }))).toEqual(
        b.targets.map(t => ({ x: t.x, y: t.y })),
      );
    });

    it('targets do not overlap each other', () => {
      const level = generateLevel({ seed: 777, bucket: 'hard' });
      for (let i = 0; i < level.targets.length; i++) {
        for (let j = i + 1; j < level.targets.length; j++) {
          const a = level.targets[i];
          const b = level.targets[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          expect(d).toBeGreaterThanOrEqual(a.radius + b.radius);
        }
      }
    });
  });

  describe('Game lifecycle', () => {
    it('instantiates at all 4 difficulties', () => {
      for (let d = 0; d <= 3; d++) {
        const g = info.createGame(makeConfig({ difficulty: d, seed: 200 + d }));
        expect(g).toBeInstanceOf(GameEngine);
        g.destroy();
      }
    });

    it('initializes with ball at rest and full darts', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as RicochetInternals;
      g.start();
      expect(g.ball.active).toBe(false);
      expect(g.dartsRemaining).toBe(g.level.darts);
      expect(g.targets.every(t => !t.destroyed)).toBe(true);
      g.destroy();
    });

    it('firing the ball decrements dart count and activates ball', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as RicochetInternals;
      g.start();
      const startDarts = g.dartsRemaining;
      g.testFire(200, -300);
      expect(g.dartsRemaining).toBe(startDarts - 1);
      expect(g.ball.active).toBe(true);
      g.destroy();
    });

    it('ball eventually decelerates and comes to rest', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as RicochetInternals;
      g.start();
      g.testFire(150, -200);
      // Simulate a few seconds of physics
      for (let i = 0; i < 400; i++) g.update(0.016);
      expect(g.ball.active).toBe(false);
      g.destroy();
    });

    it('bounces off arena walls', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as RicochetInternals;
      g.start();
      // Fire straight up at high speed
      g.testFire(0, -600);
      // After a few ticks, ball should be moving (or have bounced back)
      for (let i = 0; i < 30; i++) g.update(0.016);
      // Ball should be inside arena
      const a = g.level.arena;
      expect(g.ball.x).toBeGreaterThanOrEqual(a.x);
      expect(g.ball.x).toBeLessThanOrEqual(a.x + a.w);
      expect(g.ball.y).toBeGreaterThanOrEqual(a.y);
      expect(g.ball.y).toBeLessThanOrEqual(a.y + a.h);
      g.destroy();
    });

    it('wins when all targets destroyed', () => {
      const winFn = vi.fn();
      const g = info.createGame(makeConfig({
        difficulty: 0, seed: 42, onWin: winFn,
      })) as RicochetInternals;
      g.start();
      g.testDestroyAllTargets();
      expect(g.allTargetsDestroyed()).toBe(true);
      // One update tick to trigger win detection
      g.update(0.016);
      expect(winFn).toHaveBeenCalled();
      g.destroy();
    });

    it('loses when darts run out without clearing', () => {
      const overFn = vi.fn();
      const g = info.createGame(makeConfig({
        difficulty: 0, seed: 42, onGameOver: overFn,
      })) as RicochetInternals;
      g.start();
      // Spend all darts without destroying anything — simulate by draining darts
      while (g.dartsRemaining > 0) {
        g.testFire(10, -10); // weak shots that won't hit much
        for (let i = 0; i < 300; i++) g.update(0.016);
      }
      // If by chance all targets got destroyed, the test succeeds but skip the assertion.
      // Otherwise gameOver should have fired.
      if (!g.allTargetsDestroyed()) {
        // drive one extra update to allow handleLoss to schedule
        g.update(0.016);
        // wait for setTimeout
        return new Promise<void>(resolve => {
          setTimeout(() => {
            expect(overFn).toHaveBeenCalled();
            g.destroy();
            resolve();
          }, 1500);
        });
      }
      g.destroy();
    });
  });

  describe('Save / Resume', () => {
    it('round-trips serialize/deserialize', () => {
      const g1 = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as RicochetInternals;
      g1.start();
      g1.targets[0].destroyed = true;
      const snap = g1.serialize() as GameSnapshot;
      const before = {
        targets: g1.targets.map(t => ({ ...t })),
        darts: g1.dartsRemaining,
      };
      g1.destroy();

      const g2 = info.createGame(makeConfig({ difficulty: 0, seed: 999 })) as RicochetInternals;
      g2.start();
      g2.deserialize(snap);
      expect(g2.targets.map(t => ({ ...t }))).toEqual(before.targets);
      expect(g2.dartsRemaining).toBe(before.darts);
      g2.destroy();
    });

    it('canSave returns false while ball is moving', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as RicochetInternals;
      g.start();
      expect(g.canSave()).toBe(true);
      g.testFire(100, -100);
      expect(g.canSave()).toBe(false);
      g.destroy();
    });
  });
});
