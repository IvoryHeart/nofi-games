import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameConfig } from '../../src/engine/GameEngine';

function makeConfig(width = 360, height = 640, difficulty = 0): GameConfig {
  const canvas = document.createElement('canvas');
  return { canvas, width, height, difficulty };
}

describe('Game Integration Tests', () => {

  describe('Block Drop', () => {
    beforeEach(async () => { await import('../../src/games/block-drop/BlockDrop'); });
    it('should register itself', async () => {
      const { getGame } = await import('../../src/games/registry');
      const info = getGame('block-drop');
      expect(info).toBeDefined();
      expect(info!.name).toBe('Block Drop');
      expect(info!.bgGradient).toBeDefined();
    });
    it('should start at each difficulty', async () => {
      const { getGame } = await import('../../src/games/registry');
      const info = getGame('block-drop')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig(360, 640, d));
        expect(game).toBeInstanceOf(GameEngine);
        game.start();
        game.destroy();
      }
    });
  });

  describe('Bubble Pop', () => {
    beforeEach(async () => { await import('../../src/games/bubble-pop/BubblePop'); });
    it('should register itself', async () => {
      const { getGame } = await import('../../src/games/registry');
      expect(getGame('bubble-pop')!.name).toBe('Bubble Pop');
    });
    it('should start at each difficulty', async () => {
      const { getGame } = await import('../../src/games/registry');
      const info = getGame('bubble-pop')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig(360, 640, d));
        game.start(); game.destroy();
      }
    });
  });

  describe('Gem Swap', () => {
    beforeEach(async () => { await import('../../src/games/gem-swap/GemSwap'); });
    it('should register itself', async () => {
      const { getGame } = await import('../../src/games/registry');
      expect(getGame('gem-swap')!.name).toBe('Gem Swap');
    });
    it('should start at each difficulty', async () => {
      const { getGame } = await import('../../src/games/registry');
      const info = getGame('gem-swap')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig(360, 640, d));
        game.start(); game.destroy();
      }
    });
  });

  describe('2048', () => {
    beforeEach(async () => { await import('../../src/games/twenty48/Twenty48'); });
    it('should register itself', async () => {
      const { getGame } = await import('../../src/games/registry');
      expect(getGame('2048')!.name).toBe('2048');
    });
    it('should start at each difficulty', async () => {
      const { getGame } = await import('../../src/games/registry');
      const info = getGame('2048')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig(360, 640, d));
        game.start(); game.destroy();
      }
    });
  });

  describe('Snake', () => {
    beforeEach(async () => { await import('../../src/games/snake/Snake'); });
    it('should register itself', async () => {
      const { getGame } = await import('../../src/games/registry');
      expect(getGame('snake')!.name).toBe('Snake');
      expect(getGame('snake')!.category).toBe('arcade');
    });
    it('should start at each difficulty', async () => {
      const { getGame } = await import('../../src/games/registry');
      const info = getGame('snake')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig(360, 640, d));
        game.start(); game.destroy();
      }
    });
  });

  describe('Minesweeper', () => {
    beforeEach(async () => { await import('../../src/games/minesweeper/Minesweeper'); });
    it('should register itself', async () => {
      const { getGame } = await import('../../src/games/registry');
      expect(getGame('minesweeper')!.name).toBe('Minesweeper');
    });
    it('should start at each difficulty', async () => {
      const { getGame } = await import('../../src/games/registry');
      const info = getGame('minesweeper')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig(360, 640, d));
        game.start(); game.destroy();
      }
    });
  });

  describe('Memory Match', () => {
    beforeEach(async () => { await import('../../src/games/memory-match/MemoryMatch'); });
    it('should register itself', async () => {
      const { getGame } = await import('../../src/games/registry');
      expect(getGame('memory-match')!.name).toBe('Memory');
      expect(getGame('memory-match')!.category).toBe('card');
    });
    it('should start at each difficulty', async () => {
      const { getGame } = await import('../../src/games/registry');
      const info = getGame('memory-match')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig(360, 640, d));
        game.start(); game.destroy();
      }
    });
  });

  describe('Sudoku', () => {
    beforeEach(async () => { await import('../../src/games/sudoku/Sudoku'); });
    it('should register itself', async () => {
      const { getGame } = await import('../../src/games/registry');
      expect(getGame('sudoku')!.name).toBe('Sudoku');
    });
    it('should start at each difficulty', async () => {
      const { getGame } = await import('../../src/games/registry');
      const info = getGame('sudoku')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig(360, 640, d));
        game.start(); game.destroy();
      }
    });
  });

  describe('All Games Registry', () => {
    it('should have all 8 games after loading', async () => {
      const { loadAllGames, getAllGames } = await import('../../src/games/registry');
      await loadAllGames();
      const games = getAllGames();
      const ids = games.map(g => g.id);
      expect(ids).toContain('block-drop');
      expect(ids).toContain('bubble-pop');
      expect(ids).toContain('gem-swap');
      expect(ids).toContain('2048');
      expect(ids).toContain('snake');
      expect(ids).toContain('minesweeper');
      expect(ids).toContain('memory-match');
      expect(ids).toContain('sudoku');
    });

    it('all games should have bgGradient', async () => {
      const { getAllGames } = await import('../../src/games/registry');
      for (const game of getAllGames()) {
        expect(game.bgGradient).toBeDefined();
        expect(game.bgGradient!.length).toBe(2);
      }
    });

    it('all games should have required metadata', async () => {
      const { getAllGames } = await import('../../src/games/registry');
      for (const game of getAllGames()) {
        expect(game.id).toBeTruthy();
        expect(game.name).toBeTruthy();
        expect(game.description).toBeTruthy();
        expect(game.icon).toBeTruthy();
        expect(['puzzle', 'arcade', 'strategy', 'card']).toContain(game.category);
      }
    });
  });
});
