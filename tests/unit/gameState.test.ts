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
  hasGameState,
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
    it('should round-trip a saved state', async () => {
      const payload = makePayload({ score: 250, difficulty: 2 });
      await saveGameState('snake', payload);

      const loaded = await loadGameState('snake');
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
      await saveGameState('2048', makePayload({ state: complexState }));

      const loaded = await loadGameState('2048');
      expect(loaded?.state).toEqual(complexState);
    });

    it('should set savedAt to a valid ISO timestamp', async () => {
      const before = Date.now();
      await saveGameState('tetris', makePayload());
      const after = Date.now();

      const loaded = await loadGameState('tetris');
      expect(loaded?.savedAt).toBeDefined();
      expect(typeof loaded?.savedAt).toBe('string');
      const savedTime = new Date(loaded!.savedAt).getTime();
      expect(savedTime).toBeGreaterThanOrEqual(before);
      expect(savedTime).toBeLessThanOrEqual(after);
      // ISO format check
      expect(loaded!.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should namespace keys per gameId', async () => {
      await saveGameState('snake', makePayload({ score: 10 }));
      await saveGameState('tetris', makePayload({ score: 20 }));

      const snake = await loadGameState('snake');
      const tetris = await loadGameState('tetris');
      expect(snake?.score).toBe(10);
      expect(tetris?.score).toBe(20);
    });

    it('should overwrite an existing saved state for the same game', async () => {
      await saveGameState('snake', makePayload({ score: 10 }));
      await saveGameState('snake', makePayload({ score: 999, won: true }));

      const loaded = await loadGameState('snake');
      expect(loaded?.score).toBe(999);
      expect(loaded?.won).toBe(true);
    });

    it('should persist won=true when provided', async () => {
      await saveGameState('puzzle', makePayload({ won: true }));
      const loaded = await loadGameState('puzzle');
      expect(loaded?.won).toBe(true);
    });
  });

  // ── loadGameState missing key ──

  describe('loadGameState() missing key', () => {
    it('should return null when no state has been saved', async () => {
      const loaded = await loadGameState('nonexistent');
      expect(loaded).toBeNull();
    });

    it('should return null for a different gameId than the one saved', async () => {
      await saveGameState('snake', makePayload());
      const loaded = await loadGameState('tetris');
      expect(loaded).toBeNull();
    });

    it('should return null after the state has been cleared', async () => {
      await saveGameState('snake', makePayload());
      await clearGameState('snake');
      const loaded = await loadGameState('snake');
      expect(loaded).toBeNull();
    });
  });

  // ── clearGameState ──

  describe('clearGameState()', () => {
    it('should remove a saved state', async () => {
      await saveGameState('snake', makePayload());
      expect(await hasGameState('snake')).toBe(true);
      await clearGameState('snake');
      expect(await hasGameState('snake')).toBe(false);
    });

    it('should be idempotent (clearing a nonexistent key is a no-op)', async () => {
      await expect(clearGameState('nothing')).resolves.toBeUndefined();
      expect(await hasGameState('nothing')).toBe(false);
    });

    it('should not affect other games when clearing one', async () => {
      await saveGameState('snake', makePayload({ score: 10 }));
      await saveGameState('tetris', makePayload({ score: 20 }));
      await clearGameState('snake');

      expect(await hasGameState('snake')).toBe(false);
      expect(await hasGameState('tetris')).toBe(true);
      const tetris = await loadGameState('tetris');
      expect(tetris?.score).toBe(20);
    });
  });

  // ── hasGameState ──

  describe('hasGameState()', () => {
    it('should return false when no state exists', async () => {
      expect(await hasGameState('snake')).toBe(false);
    });

    it('should return true after a state has been saved', async () => {
      await saveGameState('snake', makePayload());
      expect(await hasGameState('snake')).toBe(true);
    });

    it('should reflect state transitions (save -> clear -> save)', async () => {
      expect(await hasGameState('snake')).toBe(false);
      await saveGameState('snake', makePayload());
      expect(await hasGameState('snake')).toBe(true);
      await clearGameState('snake');
      expect(await hasGameState('snake')).toBe(false);
      await saveGameState('snake', makePayload({ score: 42 }));
      expect(await hasGameState('snake')).toBe(true);
    });
  });
});
