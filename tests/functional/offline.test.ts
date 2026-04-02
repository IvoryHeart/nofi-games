import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock idb-keyval before any source imports
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { saveScore, getStats, getScores, getAllGameIds } from '../../src/storage/scores';
import { GameEngine } from '../../src/engine/GameEngine';

describe('Offline Functionality', () => {
  beforeEach(() => { store.clear(); });

  // ═══════════════════════════════════════
  // SCORE PERSISTENCE
  // ═══════════════════════════════════════
  describe('Score persistence', () => {
    it('should save and retrieve scores without network', async () => {
      await saveScore('snake', 500);
      await saveScore('snake', 800);
      const scores = await getScores('snake');
      expect(scores).toHaveLength(2);
      // Most recent should be first
      expect(scores[0].score).toBe(800);
      expect(scores[1].score).toBe(500);
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

    it('should persist scores across multiple save calls (simulating sessions)', async () => {
      // Session 1
      await saveScore('snake', 100);
      await saveScore('snake', 200);

      // Verify persistence
      const scores1 = await getScores('snake');
      expect(scores1).toHaveLength(2);

      // Session 2 (store still has data)
      await saveScore('snake', 300);
      const scores2 = await getScores('snake');
      expect(scores2).toHaveLength(3);
      expect(scores2[0].score).toBe(300);
    });

    it('should track lifetime best correctly', async () => {
      await saveScore('snake', 100);
      await saveScore('snake', 500);
      await saveScore('snake', 200);
      const stats = await getStats('snake');
      expect(stats.lifetimeBest).toBe(500);
    });

    it('should compute total score correctly', async () => {
      await saveScore('gem-swap', 100);
      await saveScore('gem-swap', 200);
      await saveScore('gem-swap', 300);
      const stats = await getStats('gem-swap');
      expect(stats.totalScore).toBe(600);
    });

    it('should track recent scores (last 10)', async () => {
      for (let i = 1; i <= 15; i++) {
        await saveScore('minesweeper', i * 10);
      }
      const stats = await getStats('minesweeper');
      expect(stats.recentScores.length).toBeLessThanOrEqual(10);
    });

    it('should return empty stats for games with no scores', async () => {
      const stats = await getStats('nonexistent');
      expect(stats.totalGames).toBe(0);
      expect(stats.bestScore).toBe(0);
      expect(stats.totalScore).toBe(0);
      expect(stats.recentScores).toEqual([]);
    });

    it('should return empty scores for games with no scores', async () => {
      const scores = await getScores('nonexistent');
      expect(scores).toEqual([]);
    });

    it('should include date in score entries', async () => {
      await saveScore('snake', 100);
      const scores = await getScores('snake');
      expect(scores[0].date).toBeTruthy();
      // Date should be a valid ISO string
      expect(new Date(scores[0].date).getTime()).not.toBeNaN();
    });

    it('should include gameId in score entries', async () => {
      await saveScore('sudoku', 500);
      const scores = await getScores('sudoku');
      expect(scores[0].gameId).toBe('sudoku');
    });

    it('should get all game IDs that have scores', async () => {
      await saveScore('snake', 100);
      await saveScore('2048', 200);
      await saveScore('sudoku', 300);
      const ids = await getAllGameIds();
      expect(ids).toContain('snake');
      expect(ids).toContain('2048');
      expect(ids).toContain('sudoku');
    });
  });

  // ═══════════════════════════════════════
  // GAME INSTANTIATION WITHOUT NETWORK
  // ═══════════════════════════════════════
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

    it('all games should run update/render without network', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unavailable'));
      const { loadAllGames, getAllGames } = await import('../../src/games/registry');
      await loadAllGames();
      for (const gameInfo of getAllGames()) {
        const game = gameInfo.createGame({
          canvas: document.createElement('canvas'),
          width: 360, height: 640, difficulty: 1,
        }) as any;
        game.start();
        game.update(0.016);
        game.render();
        game.destroy();
      }
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('all games should be instances of GameEngine', async () => {
      const { loadAllGames, getAllGames } = await import('../../src/games/registry');
      await loadAllGames();
      for (const gameInfo of getAllGames()) {
        const game = gameInfo.createGame({
          canvas: document.createElement('canvas'),
          width: 360, height: 640, difficulty: 0,
        });
        expect(game).toBeInstanceOf(GameEngine);
        game.destroy();
      }
    });

    it('each game should work at all 4 difficulties without network', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unavailable'));
      const { loadAllGames, getAllGames } = await import('../../src/games/registry');
      await loadAllGames();
      for (const gameInfo of getAllGames()) {
        for (let d = 0; d <= 3; d++) {
          const game = gameInfo.createGame({
            canvas: document.createElement('canvas'),
            width: 360, height: 640, difficulty: d,
          });
          expect(() => { game.start(); game.destroy(); }).not.toThrow();
        }
      }
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════
  // PWA CONFIGURATION
  // ═══════════════════════════════════════
  describe('PWA configuration', () => {
    it('should have PWA config with standalone display', async () => {
      const fs = await import('fs');
      const config = fs.readFileSync('vite.config.ts', 'utf-8');
      expect(config).toContain('VitePWA');
      expect(config).toContain("display: 'standalone'");
    });
  });

  // ═══════════════════════════════════════
  // BUILD ARTIFACTS
  // ═══════════════════════════════════════
  describe('Build artifacts', () => {
    it('should produce dist/index.html', async () => {
      const fs = await import('fs');
      expect(fs.existsSync('dist/index.html')).toBe(true);
    });

    it('should produce dist/sw.js', async () => {
      const fs = await import('fs');
      expect(fs.existsSync('dist/sw.js')).toBe(true);
    });

    it('should produce dist/manifest.webmanifest', async () => {
      const fs = await import('fs');
      expect(fs.existsSync('dist/manifest.webmanifest')).toBe(true);
    });

    it('dist/index.html should contain a script tag', async () => {
      const fs = await import('fs');
      if (fs.existsSync('dist/index.html')) {
        const html = fs.readFileSync('dist/index.html', 'utf-8');
        expect(html).toContain('<script');
      }
    });

    it('dist/manifest.webmanifest should contain app name', async () => {
      const fs = await import('fs');
      if (fs.existsSync('dist/manifest.webmanifest')) {
        const manifest = fs.readFileSync('dist/manifest.webmanifest', 'utf-8');
        const parsed = JSON.parse(manifest);
        expect(parsed.name).toBeTruthy();
      }
    });
  });
});
