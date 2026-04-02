import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { saveScore, getStats, getScores } from '../../src/storage/scores';

describe('Offline Functionality', () => {
  beforeEach(() => { store.clear(); });

  describe('Score persistence', () => {
    it('should save and retrieve scores without network', async () => {
      await saveScore('snake', 500);
      await saveScore('snake', 800);
      const scores = await getScores('snake');
      expect(scores).toHaveLength(2);
      expect(scores[0].score).toBe(800);
    });

    it('should maintain separate scores per game', async () => {
      await saveScore('snake', 100);
      await saveScore('2048', 2000);
      expect((await getScores('snake'))[0].score).toBe(100);
      expect((await getScores('2048'))[0].score).toBe(2000);
    });

    it('should correctly compute stats from local data', async () => {
      await saveScore('snake', 100);
      await saveScore('snake', 300);
      await saveScore('snake', 200);
      const stats = await getStats('snake');
      expect(stats.totalGames).toBe(3);
      expect(stats.bestScore).toBe(300);
    });
  });

  describe('Game instantiation without network', () => {
    it('should load all games from local bundles', async () => {
      const { loadAllGames, getAllGames } = await import('../../src/games/registry');
      await loadAllGames();
      expect(getAllGames().length).toBe(8);
    });

    it('each game should start without any fetch calls', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unavailable'));
      const { loadAllGames, getAllGames } = await import('../../src/games/registry');
      await loadAllGames();
      for (const gameInfo of getAllGames()) {
        const game = gameInfo.createGame({
          canvas: document.createElement('canvas'),
          width: 360, height: 640, difficulty: 1,
        });
        expect(() => { game.start(); game.destroy(); }).not.toThrow();
      }
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('PWA configuration', () => {
    it('should have PWA config with standalone display', async () => {
      const fs = await import('fs');
      const config = fs.readFileSync('vite.config.ts', 'utf-8');
      expect(config).toContain('VitePWA');
      expect(config).toContain("display: 'standalone'");
    });
  });

  describe('Build artifacts', () => {
    it('should produce dist with all assets', async () => {
      const fs = await import('fs');
      expect(fs.existsSync('dist/index.html')).toBe(true);
      expect(fs.existsSync('dist/sw.js')).toBe(true);
      expect(fs.existsSync('dist/manifest.webmanifest')).toBe(true);
    });
  });
});
