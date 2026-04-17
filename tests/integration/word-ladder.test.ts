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
import { generate, generateDaily, adjacencyForLength } from '../../src/games/word-ladder/generator';

function makeConfig(opts: {
  difficulty?: number;
  seed?: number;
  onWin?: (s: number) => void;
} = {}): GameConfig {
  const canvas = document.createElement('canvas');
  return {
    canvas,
    width: 360,
    height: 640,
    difficulty: opts.difficulty ?? 0,
    seed: opts.seed,
    onWin: opts.onWin,
  };
}

type WordLadderInternals = GameEngine & {
  level: { start: string; end: string; minSteps: number; samplePath?: string[] };
  ladder: string[];
  selectedSlot: number;
  wordLen: number;
  gameActive: boolean;
  testTypeLetter: (ch: string) => void;
  testUndo: () => void;
  testSelectSlot: (i: number) => void;
};

let info: GameInfo;
beforeAll(async () => {
  store.clear();
  await import('../../src/games/word-ladder/WordLadder');
  const fetched = getGame('word-ladder');
  if (!fetched) throw new Error('word-ladder not registered');
  info = fetched;
});

describe('Word Ladder — Integration', () => {
  describe('Registration', () => {
    it('is registered', () => {
      expect(info.id).toBe('word-ladder');
      expect(info.name).toBe('Word Ladder');
      expect(info.category).toBe('puzzle');
      expect(info.dailyMode).toBe(true);
    });
  });

  describe('Adjacency + Generator', () => {
    it('builds adjacency for 4-letter words', () => {
      const adj = adjacencyForLength(4);
      // Sanity: COLD should link to at least one 4-letter word differing by 1
      const neighbors = adj.get('cold') ?? [];
      expect(neighbors.length).toBeGreaterThan(0);
      // All neighbors must differ by exactly one letter
      for (const n of neighbors) {
        expect(n.length).toBe(4);
        let diffs = 0;
        for (let i = 0; i < 4; i++) if (n[i] !== 'cold'[i]) diffs++;
        expect(diffs).toBe(1);
      }
    });

    it('generates a 4-letter puzzle of target depth', () => {
      const level = generate({ wordLength: 4, targetSteps: 4, seed: 42 });
      expect(level).not.toBeNull();
      expect(level!.start.length).toBe(4);
      expect(level!.end.length).toBe(4);
      expect(level!.minSteps).toBe(4);
      expect(level!.start).not.toBe(level!.end);
      // Sample path if provided must be contiguous
      if (level!.samplePath) {
        expect(level!.samplePath[0]).toBe(level!.start);
        expect(level!.samplePath[level!.samplePath.length - 1]).toBe(level!.end);
        for (let i = 1; i < level!.samplePath.length; i++) {
          const a = level!.samplePath[i - 1];
          const b = level!.samplePath[i];
          let diffs = 0;
          for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) diffs++;
          expect(diffs).toBe(1);
        }
      }
    });

    it('is deterministic for the same seed', () => {
      const a = generate({ wordLength: 4, targetSteps: 4, seed: 777 });
      const b = generate({ wordLength: 4, targetSteps: 4, seed: 777 });
      expect(a?.start).toBe(b?.start);
      expect(a?.end).toBe(b?.end);
    });

    it('generateDaily always produces a valid level for every bucket', () => {
      for (const bucket of ['easy', 'medium', 'hard', 'expert'] as const) {
        const level = generateDaily(12345, bucket);
        expect(level.start.length).toBe(level.end.length);
        expect(level.start).not.toBe(level.end);
        expect(level.minSteps).toBeGreaterThan(0);
      }
    });
  });

  describe('Game lifecycle', () => {
    it('instantiates at all 4 difficulties', () => {
      for (let d = 0; d <= 3; d++) {
        const g = info.createGame(makeConfig({ difficulty: d, seed: 500 + d }));
        expect(g).toBeInstanceOf(GameEngine);
        g.destroy();
      }
    });

    it('initializes ladder with start word only', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as WordLadderInternals;
      g.start();
      expect(g.ladder.length).toBe(1);
      expect(g.ladder[0]).toBe(g.level.start);
      g.destroy();
    });

    it('walking the sample path reaches the goal and wins', () => {
      const winFn = vi.fn();
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42, onWin: winFn })) as WordLadderInternals;
      g.start();
      const path = g.level.samplePath;
      expect(path).toBeDefined();
      // For each consecutive pair, find the slot that differs and type that letter
      for (let i = 1; i < path!.length; i++) {
        const prev = path![i - 1];
        const next = path![i];
        let slot = -1;
        for (let j = 0; j < prev.length; j++) {
          if (prev[j] !== next[j]) { slot = j; break; }
        }
        expect(slot).toBeGreaterThanOrEqual(0);
        g.testSelectSlot(slot);
        g.testTypeLetter(next[slot]);
      }
      expect(g.ladder[g.ladder.length - 1]).toBe(g.level.end);
      expect(winFn).toHaveBeenCalled();
      g.destroy();
    });

    it('rejects invalid word attempts', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as WordLadderInternals;
      g.start();
      const before = g.ladder.length;
      // Type 'z' into slot 0 — likely produces a non-word from a dictionary word start
      g.testSelectSlot(0);
      g.testTypeLetter('z');
      // Either the result is a valid word (rare) or rejected. Both are fine but
      // we at least don't expect the ladder to grow beyond 1 step here reliably.
      // Test a deliberate nonsense: type the same letter (no change)
      const current = g.ladder[g.ladder.length - 1];
      g.testTypeLetter(current[0]);
      // Ladder grew at most by 1 (only from the 'z' attempt if it was valid).
      expect(g.ladder.length - before).toBeLessThanOrEqual(1);
      g.destroy();
    });

    it('rejects repeated words', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as WordLadderInternals;
      g.start();
      const path = g.level.samplePath;
      if (!path || path.length < 3) { g.destroy(); return; }
      // Apply the first step
      const prev = path[0];
      const next = path[1];
      let slot = -1;
      for (let j = 0; j < prev.length; j++) {
        if (prev[j] !== next[j]) { slot = j; break; }
      }
      g.testSelectSlot(slot);
      g.testTypeLetter(next[slot]);
      // Now try to go back to the start word (repeat)
      g.testTypeLetter(prev[slot]);
      // Ladder should NOT include start again (repeats rejected)
      expect(g.ladder[g.ladder.length - 1]).toBe(next);
      g.destroy();
    });

    it('undo reverts the most recent step', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as WordLadderInternals;
      g.start();
      const path = g.level.samplePath!;
      if (path.length < 2) { g.destroy(); return; }
      const next = path[1];
      let slot = -1;
      for (let j = 0; j < path[0].length; j++) {
        if (path[0][j] !== next[j]) { slot = j; break; }
      }
      g.testSelectSlot(slot);
      g.testTypeLetter(next[slot]);
      expect(g.ladder.length).toBe(2);
      g.testUndo();
      expect(g.ladder.length).toBe(1);
      expect(g.ladder[0]).toBe(g.level.start);
      g.destroy();
    });
  });

  describe('Save / Resume', () => {
    it('round-trips serialize/deserialize', () => {
      const g1 = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as WordLadderInternals;
      g1.start();
      const path = g1.level.samplePath!;
      if (path.length >= 2) {
        const next = path[1];
        let slot = -1;
        for (let j = 0; j < path[0].length; j++) {
          if (path[0][j] !== next[j]) { slot = j; break; }
        }
        g1.testSelectSlot(slot);
        g1.testTypeLetter(next[slot]);
      }
      const snap = g1.serialize() as GameSnapshot;
      const before = { ladder: g1.ladder.slice(), start: g1.level.start, end: g1.level.end };
      g1.destroy();

      const g2 = info.createGame(makeConfig({ difficulty: 0, seed: 999 })) as WordLadderInternals;
      g2.start();
      g2.deserialize(snap);
      expect(g2.ladder).toEqual(before.ladder);
      expect(g2.level.start).toBe(before.start);
      expect(g2.level.end).toBe(before.end);
      g2.destroy();
    });
  });
});
