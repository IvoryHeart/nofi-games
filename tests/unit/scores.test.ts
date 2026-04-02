import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import {
  saveScore, getStats, getScores, getAllGameIds,
  getSettings, saveSettings,
  getFavourites, toggleFavourite,
  getGameSettings, saveGameSettings,
} from '../../src/storage/scores';

describe('Score Storage', () => {
  beforeEach(() => { store.clear(); });

  describe('saveScore()', () => {
    it('should save a score entry', async () => {
      await saveScore('snake', 100);
      const scores = await getScores('snake');
      expect(scores).toHaveLength(1);
      expect(scores[0].score).toBe(100);
      expect(scores[0].gameId).toBe('snake');
    });

    it('should save multiple scores in order (newest first)', async () => {
      await saveScore('snake', 100);
      await saveScore('snake', 200);
      await saveScore('snake', 150);
      const scores = await getScores('snake');
      expect(scores).toHaveLength(3);
      expect(scores[0].score).toBe(150);
    });

    it('should limit stored scores to 100', async () => {
      for (let i = 0; i < 105; i++) await saveScore('snake', i * 10);
      const scores = await getScores('snake');
      expect(scores.length).toBeLessThanOrEqual(100);
    });

    it('should include difficulty if provided', async () => {
      await saveScore('2048', 500, 120, 2);
      const scores = await getScores('2048');
      expect(scores[0].difficulty).toBe(2);
      expect(scores[0].duration).toBe(120);
    });
  });

  describe('getStats()', () => {
    it('should return default stats for new game', async () => {
      const stats = await getStats('unknown-game');
      expect(stats.bestScore).toBe(0);
      expect(stats.totalGames).toBe(0);
    });

    it('should track best score', async () => {
      await saveScore('snake', 100);
      await saveScore('snake', 300);
      await saveScore('snake', 200);
      const stats = await getStats('snake');
      expect(stats.bestScore).toBe(300);
      expect(stats.lifetimeBest).toBe(300);
    });

    it('should track total games and total score', async () => {
      await saveScore('snake', 100);
      await saveScore('snake', 200);
      await saveScore('snake', 300);
      const stats = await getStats('snake');
      expect(stats.totalGames).toBe(3);
      expect(stats.totalScore).toBe(600);
    });

    it('should track weekly best', async () => {
      await saveScore('snake', 500);
      const stats = await getStats('snake');
      expect(stats.weeklyBest).toBe(500);
    });
  });

  describe('getScores()', () => {
    it('should return empty array for unknown game', async () => {
      const scores = await getScores('nonexistent');
      expect(scores).toEqual([]);
    });

    it('should return scores with valid dates', async () => {
      await saveScore('snake', 100);
      const scores = await getScores('snake');
      expect(new Date(scores[0].date).getTime()).toBeGreaterThan(0);
    });
  });

  describe('getAllGameIds()', () => {
    it('should return empty array when no games played', async () => {
      const ids = await getAllGameIds();
      expect(ids).toEqual([]);
    });

    it('should return unique game IDs', async () => {
      await saveScore('snake', 100);
      await saveScore('2048', 200);
      await saveScore('snake', 150);
      const ids = await getAllGameIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain('snake');
      expect(ids).toContain('2048');
    });
  });

  describe('Favourites', () => {
    it('should return empty favourites by default', async () => {
      const favs = await getFavourites();
      expect(favs).toEqual([]);
    });

    it('should toggle favourite on', async () => {
      const result = await toggleFavourite('snake');
      expect(result).toBe(true);
      const favs = await getFavourites();
      expect(favs).toContain('snake');
    });

    it('should toggle favourite off', async () => {
      await toggleFavourite('snake');
      const result = await toggleFavourite('snake');
      expect(result).toBe(false);
      const favs = await getFavourites();
      expect(favs).not.toContain('snake');
    });

    it('should handle multiple favourites', async () => {
      await toggleFavourite('snake');
      await toggleFavourite('2048');
      await toggleFavourite('sudoku');
      const favs = await getFavourites();
      expect(favs).toHaveLength(3);
    });
  });

  describe('Per-game Settings', () => {
    it('should return default per-game settings', async () => {
      const gs = await getGameSettings('snake');
      expect(gs.lastDifficulty).toBe(0);
    });

    it('should save and retrieve per-game settings', async () => {
      await saveGameSettings('snake', { lastDifficulty: 2 });
      const gs = await getGameSettings('snake');
      expect(gs.lastDifficulty).toBe(2);
    });

    it('should keep settings separate per game', async () => {
      await saveGameSettings('snake', { lastDifficulty: 3 });
      await saveGameSettings('2048', { lastDifficulty: 1 });
      expect((await getGameSettings('snake')).lastDifficulty).toBe(3);
      expect((await getGameSettings('2048')).lastDifficulty).toBe(1);
    });
  });

  describe('App Settings', () => {
    it('should return default settings', async () => {
      const settings = await getSettings();
      expect(settings.soundEnabled).toBe(true);
      expect(settings.musicEnabled).toBe(true);
      expect(settings.vibrationEnabled).toBe(true);
      expect(settings.volume).toBe(80);
      expect(settings.maxFps).toBe(60);
    });

    it('should save and retrieve settings', async () => {
      await saveSettings({
        soundEnabled: false, musicEnabled: false,
        vibrationEnabled: true, volume: 50, maxFps: 30, theme: 'light',
      });
      const settings = await getSettings();
      expect(settings.soundEnabled).toBe(false);
      expect(settings.volume).toBe(50);
      expect(settings.maxFps).toBe(30);
    });
  });
});
