import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import {
  saveGameState,
  loadGameState,
  clearGameState,
  clearAllGameStates,
  hasGameState,
  savedDifficulties,
  type SavedGameState,
} from '../../src/storage/gameState';
import type { GameSnapshot } from '../../src/engine/GameEngine';

type SavePayload = Omit<SavedGameState, 'savedAt'>;

function makePayload(overrides: Partial<SavePayload> = {}): SavePayload {
  const baseState: GameSnapshot = { board: [1, 2, 3], level: 5 };
  return {
    state: baseState,
    score: 100,
    won: false,
    difficulty: 1,
    ...overrides,
  };
}

describe('Game State Storage', () => {
  beforeEach(() => {
    store.clear();
  });

  // ── saveGameState / loadGameState round-trip ──

  describe('saveGameState() and loadGameState()', () => {
    it('should round-trip a saved state at the same difficulty', async () => {
      const payload = makePayload({ score: 250, difficulty: 2 });
      await saveGameState('snake', payload);

      const loaded = await loadGameState('snake', 2);
      expect(loaded).not.toBeNull();
      expect(loaded?.score).toBe(250);
      expect(loaded?.difficulty).toBe(2);
      expect(loaded?.state).toEqual({ board: [1, 2, 3], level: 5 });
      expect(loaded?.won).toBe(false);
    });

    it('should preserve complex nested state snapshots', async () => {
      const complexState: GameSnapshot = {
        grid: [[1, 0, 2], [0, 3, 0]],
        meta: { turn: 7, lastMove: 'up' },
        flags: [true, false, true],
      };
      await saveGameState('2048', makePayload({ state: complexState, difficulty: 0 }));

      const loaded = await loadGameState('2048', 0);
      expect(loaded?.state).toEqual(complexState);
    });

    it('should set savedAt to a valid ISO timestamp', async () => {
      const before = Date.now();
      await saveGameState('tetris', makePayload({ difficulty: 1 }));
      const after = Date.now();

      const loaded = await loadGameState('tetris', 1);
      expect(loaded?.savedAt).toBeDefined();
      expect(typeof loaded?.savedAt).toBe('string');
      const savedTime = new Date(loaded!.savedAt).getTime();
      expect(savedTime).toBeGreaterThanOrEqual(before);
      expect(savedTime).toBeLessThanOrEqual(after);
      expect(loaded!.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should namespace keys per gameId', async () => {
      await saveGameState('snake', makePayload({ score: 10, difficulty: 1 }));
      await saveGameState('tetris', makePayload({ score: 20, difficulty: 1 }));

      const snake = await loadGameState('snake', 1);
      const tetris = await loadGameState('tetris', 1);
      expect(snake?.score).toBe(10);
      expect(tetris?.score).toBe(20);
    });

    it('should namespace keys per difficulty (per-level save slots)', async () => {
      // Same game, different difficulties — both should coexist
      await saveGameState('snake', makePayload({ score: 100, difficulty: 0 }));
      await saveGameState('snake', makePayload({ score: 500, difficulty: 3 }));

      const easy = await loadGameState('snake', 0);
      const extraHard = await loadGameState('snake', 3);
      expect(easy?.score).toBe(100);
      expect(extraHard?.score).toBe(500);
    });

    it('should overwrite an existing saved state for the same (game, difficulty)', async () => {
      await saveGameState('snake', makePayload({ score: 10, difficulty: 1 }));
      await saveGameState('snake', makePayload({ score: 999, won: true, difficulty: 1 }));

      const loaded = await loadGameState('snake', 1);
      expect(loaded?.score).toBe(999);
      expect(loaded?.won).toBe(true);
    });

    it('should persist won=true when provided', async () => {
      await saveGameState('puzzle', makePayload({ won: true, difficulty: 1 }));
      const loaded = await loadGameState('puzzle', 1);
      expect(loaded?.won).toBe(true);
    });

    it('should not leak state from one difficulty slot into another', async () => {
      await saveGameState('snake', makePayload({ score: 100, difficulty: 1 }));
      const other = await loadGameState('snake', 2);
      expect(other).toBeNull();
    });
  });

  // ── Legacy migration ──

  describe('legacy key migration', () => {
    it('migrates a pre-per-level entry to the new slot on first load', async () => {
      // Seed the store using the legacy key shape
      const legacy: SavedGameState = {
        state: { legacy: true },
        score: 42,
        won: false,
        difficulty: 2,
        savedAt: '2026-01-01T00:00:00Z',
      };
      store.set('gamestate_snake', legacy);

      const loaded = await loadGameState('snake', 2);
      expect(loaded).not.toBeNull();
      expect(loaded?.score).toBe(42);
      expect(loaded?.difficulty).toBe(2);

      // The legacy key should now be gone and the new key populated
      expect(store.has('gamestate_snake')).toBe(false);
      expect(store.has('gamestate_snake_2')).toBe(true);
    });

    it('does not return a legacy entry for a non-matching difficulty', async () => {
      store.set('gamestate_snake', {
        state: {}, score: 1, won: false, difficulty: 3, savedAt: '',
      } as SavedGameState);
      const loaded = await loadGameState('snake', 0);
      expect(loaded).toBeNull();
    });

    it('migrates a mismatched-difficulty legacy entry to its correct slot', async () => {
      // Regression test for the review-flagged leak: if a legacy entry was
      // saved at difficulty 2 and the player first opens difficulty 0, the
      // old code left the legacy key in place forever. The new code migrates
      // it to the correct difficulty slot regardless of which slot the
      // player opens first, then deletes the legacy key unconditionally.
      const legacy: SavedGameState = {
        state: { grid: 'legacy' },
        score: 777,
        won: false,
        difficulty: 2,
        savedAt: '2026-01-01T00:00:00Z',
      };
      store.set('gamestate_snake', legacy);

      // Player opens difficulty 0 — legacy should NOT be returned here,
      // but it SHOULD have been migrated out of the legacy key.
      const wrongSlot = await loadGameState('snake', 0);
      expect(wrongSlot).toBeNull();
      expect(store.has('gamestate_snake')).toBe(false);
      expect(store.has('gamestate_snake_2')).toBe(true);

      // And loading difficulty 2 now returns the migrated entry.
      const correctSlot = await loadGameState('snake', 2);
      expect(correctSlot?.score).toBe(777);
    });

    it('falls back to requested difficulty if legacy entry has no difficulty field', async () => {
      // Extra-defensive: a malformed legacy entry without a difficulty field
      // should still get migrated (to the currently-requested slot) and
      // removed from the legacy key.
      store.set('gamestate_snake', {
        state: {}, score: 5, won: false, savedAt: '',
      } as unknown as SavedGameState);

      await loadGameState('snake', 1);
      expect(store.has('gamestate_snake')).toBe(false);
      expect(store.has('gamestate_snake_1')).toBe(true);
    });
  });

  // ── loadGameState missing key ──

  describe('loadGameState() missing key', () => {
    it('should return null when no state has been saved', async () => {
      const loaded = await loadGameState('nonexistent', 0);
      expect(loaded).toBeNull();
    });

    it('should return null for a different gameId than the one saved', async () => {
      await saveGameState('snake', makePayload());
      const loaded = await loadGameState('tetris', 1);
      expect(loaded).toBeNull();
    });

    it('should return null after the state has been cleared', async () => {
      await saveGameState('snake', makePayload());
      await clearGameState('snake', 1);
      const loaded = await loadGameState('snake', 1);
      expect(loaded).toBeNull();
    });
  });

  // ── clearGameState ──

  describe('clearGameState()', () => {
    it('should remove a saved state', async () => {
      await saveGameState('snake', makePayload({ difficulty: 1 }));
      expect(await hasGameState('snake', 1)).toBe(true);
      await clearGameState('snake', 1);
      expect(await hasGameState('snake', 1)).toBe(false);
    });

    it('should be idempotent (clearing a nonexistent key is a no-op)', async () => {
      await expect(clearGameState('nothing', 0)).resolves.toBeUndefined();
      expect(await hasGameState('nothing', 0)).toBe(false);
    });

    it('should not affect other games when clearing one', async () => {
      await saveGameState('snake', makePayload({ score: 10 }));
      await saveGameState('tetris', makePayload({ score: 20 }));
      await clearGameState('snake', 1);

      expect(await hasGameState('snake', 1)).toBe(false);
      expect(await hasGameState('tetris', 1)).toBe(true);
      const tetris = await loadGameState('tetris', 1);
      expect(tetris?.score).toBe(20);
    });

    it('should not affect other difficulty slots of the same game', async () => {
      await saveGameState('snake', makePayload({ score: 10, difficulty: 0 }));
      await saveGameState('snake', makePayload({ score: 20, difficulty: 3 }));
      await clearGameState('snake', 0);

      expect(await hasGameState('snake', 0)).toBe(false);
      expect(await hasGameState('snake', 3)).toBe(true);
    });
  });

  // ── clearAllGameStates ──

  describe('clearAllGameStates()', () => {
    it('removes every difficulty slot for a game', async () => {
      await saveGameState('snake', makePayload({ score: 1, difficulty: 0 }));
      await saveGameState('snake', makePayload({ score: 2, difficulty: 1 }));
      await saveGameState('snake', makePayload({ score: 3, difficulty: 2 }));
      await saveGameState('snake', makePayload({ score: 4, difficulty: 3 }));

      await clearAllGameStates('snake');

      for (let d = 0; d < 4; d++) {
        expect(await hasGameState('snake', d)).toBe(false);
      }
    });

    it('also removes the legacy key', async () => {
      store.set('gamestate_snake', {} as SavedGameState);
      await clearAllGameStates('snake');
      expect(store.has('gamestate_snake')).toBe(false);
    });
  });

  // ── hasGameState ──

  describe('hasGameState()', () => {
    it('should return false when no state exists', async () => {
      expect(await hasGameState('snake', 1)).toBe(false);
    });

    it('should return true after a state has been saved', async () => {
      await saveGameState('snake', makePayload({ difficulty: 1 }));
      expect(await hasGameState('snake', 1)).toBe(true);
    });

    it('should reflect state transitions (save -> clear -> save)', async () => {
      expect(await hasGameState('snake', 1)).toBe(false);
      await saveGameState('snake', makePayload({ difficulty: 1 }));
      expect(await hasGameState('snake', 1)).toBe(true);
      await clearGameState('snake', 1);
      expect(await hasGameState('snake', 1)).toBe(false);
      await saveGameState('snake', makePayload({ score: 42, difficulty: 1 }));
      expect(await hasGameState('snake', 1)).toBe(true);
    });
  });

  // ── savedDifficulties ──

  describe('savedDifficulties()', () => {
    it('returns empty when nothing is saved', async () => {
      expect(await savedDifficulties('snake')).toEqual([]);
    });

    it('returns every difficulty that has a save', async () => {
      await saveGameState('snake', makePayload({ difficulty: 0 }));
      await saveGameState('snake', makePayload({ difficulty: 2 }));
      const difficulties = await savedDifficulties('snake');
      expect(difficulties.sort()).toEqual([0, 2]);
    });

    it('is isolated per game', async () => {
      await saveGameState('snake', makePayload({ difficulty: 1 }));
      await saveGameState('tetris', makePayload({ difficulty: 3 }));
      expect(await savedDifficulties('snake')).toEqual([1]);
      expect(await savedDifficulties('tetris')).toEqual([3]);
    });
  });
});
