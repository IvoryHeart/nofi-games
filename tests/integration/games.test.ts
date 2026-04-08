import { describe, it, expect, beforeAll, vi } from 'vitest';
import { GameEngine, GameConfig } from '../../src/engine/GameEngine';

// Mock idb-keyval before any source imports
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { loadAllGames, getAllGames, getGame, GameInfo } from '../../src/games/registry';

function makeConfig(width = 360, height = 640, difficulty = 0, onScore?: (s: number) => void): GameConfig {
  const canvas = document.createElement('canvas');
  return { canvas, width, height, difficulty, onScore };
}

// Expected metadata for each of the 8 games
const EXPECTED_GAMES: Record<string, {
  name: string;
  category: 'puzzle' | 'arcade' | 'strategy' | 'card';
  bgGradient: [string, string];
  canvasWidth: number;
  canvasHeight: number;
  controls: string;
}> = {
  'block-drop': {
    name: 'Block Drop',
    category: 'puzzle',
    bgGradient: ['#4A90D9', '#7CB8E8'],
    canvasWidth: 300,
    canvasHeight: 540,
    controls: 'Arrows/Touch to move, Up/Tap to rotate, Space to drop',
  },
  'bubble-pop': {
    name: 'Bubble Pop',
    category: 'puzzle',
    bgGradient: ['#D94A7B', '#E88BAA'],
    canvasWidth: 360,
    canvasHeight: 560,
    controls: 'Aim and tap to shoot bubbles',
  },
  'gem-swap': {
    name: 'Gem Swap',
    category: 'puzzle',
    bgGradient: ['#7B4FC9', '#A98DE0'],
    canvasWidth: 360,
    canvasHeight: 440,
    controls: 'Tap to select, tap adjacent to swap',
  },
  '2048': {
    name: '2048',
    category: 'puzzle',
    bgGradient: ['#E89040', '#F0B868'],
    canvasWidth: 360,
    canvasHeight: 400,
    controls: 'Swipe or arrow keys to slide tiles',
  },
  'snake': {
    name: 'Snake',
    category: 'arcade',
    bgGradient: ['#3CAA3C', '#7DD87D'],
    canvasWidth: 360,
    canvasHeight: 360,
    controls: 'Swipe or arrow keys to turn',
  },
  'minesweeper': {
    name: 'Minesweeper',
    category: 'strategy',
    bgGradient: ['#6A7B8A', '#9AAAB8'],
    canvasWidth: 360,
    canvasHeight: 420,
    controls: 'Tap to reveal, long-press to flag',
  },
  'memory-match': {
    name: 'Memory',
    category: 'card',
    bgGradient: ['#D8704D', '#F0A880'],
    canvasWidth: 340,
    canvasHeight: 400,
    controls: 'Tap cards to flip and find pairs',
  },
  'sudoku': {
    name: 'Sudoku',
    category: 'strategy',
    bgGradient: ['#4A8AC9', '#7BBAE0'],
    canvasWidth: 360,
    canvasHeight: 520,
    controls: 'Tap cell, then tap number to fill',
  },
  'wordle': {
    name: 'Wordle',
    category: 'puzzle',
    bgGradient: ['#6BAA75', '#A8D5B5'],
    canvasWidth: 360,
    canvasHeight: 600,
    controls: 'Type letters, Enter to guess, Backspace to delete',
  },
  'anagram': {
    name: 'Anagram',
    category: 'puzzle',
    bgGradient: ['#D4A574', '#E8C497'],
    canvasWidth: 360,
    canvasHeight: 640,
    controls: 'Tap letters to form words, Submit to check',
  },
};

const GAME_IDS = Object.keys(EXPECTED_GAMES);

// Load all games once before all tests
beforeAll(async () => {
  store.clear();
  await loadAllGames();
});

describe('Game Integration Tests', () => {

  // ══════════════════════════════════════════════
  // Per-game test suites
  // ══════════════════════════════════════════════
  for (const gameId of GAME_IDS) {
    const expected = EXPECTED_GAMES[gameId];

    describe(expected.name, () => {

      it('should be registered in the registry', () => {
        const info = getGame(gameId);
        expect(info).toBeDefined();
      });

      it('should have correct name', () => {
        expect(getGame(gameId)!.name).toBe(expected.name);
      });

      it('should have correct id', () => {
        expect(getGame(gameId)!.id).toBe(gameId);
      });

      it('should have correct category', () => {
        expect(getGame(gameId)!.category).toBe(expected.category);
      });

      it('should have correct bgGradient', () => {
        const info = getGame(gameId)!;
        expect(info.bgGradient).toBeDefined();
        expect(info.bgGradient).toEqual(expected.bgGradient);
      });

      it('should have correct canvasWidth and canvasHeight', () => {
        const info = getGame(gameId)!;
        expect(info.canvasWidth).toBe(expected.canvasWidth);
        expect(info.canvasHeight).toBe(expected.canvasHeight);
      });

      it('should have controls string', () => {
        const info = getGame(gameId)!;
        expect(info.controls).toBe(expected.controls);
      });

      it('should instantiate at all 4 difficulties without throwing', () => {
        const info = getGame(gameId)!;
        for (let d = 0; d <= 3; d++) {
          const game = info.createGame(makeConfig(360, 640, d));
          expect(game).toBeInstanceOf(GameEngine);
          game.destroy();
        }
      });

      it('should start, run update/render cycles, and destroy without crashing', () => {
        const info = getGame(gameId)!;
        const game = info.createGame(makeConfig(360, 640, 1)) as any;
        expect(() => {
          game.start();
          game.update(0.016);
          game.render();
          game.update(0.016);
          game.render();
          game.update(0.032);
          game.render();
          game.destroy();
        }).not.toThrow();
      });

      it('should run multiple update/render cycles at each difficulty', () => {
        const info = getGame(gameId)!;
        for (let d = 0; d <= 3; d++) {
          const game = info.createGame(makeConfig(360, 640, d)) as any;
          game.start();
          for (let i = 0; i < 5; i++) {
            game.update(0.016);
            game.render();
          }
          game.destroy();
        }
      });

      it('should call onScore callback when addScore is used', () => {
        const info = getGame(gameId)!;
        const scoreFn = vi.fn();
        const game = info.createGame(makeConfig(360, 640, 0, scoreFn)) as any;
        game.start();
        // Directly invoke addScore via the protected method
        game.addScore(100);
        expect(scoreFn).toHaveBeenCalledWith(100);
        game.addScore(50);
        expect(scoreFn).toHaveBeenCalledWith(150);
        game.destroy();
      });

      it('should call onScore callback via setScore', () => {
        const info = getGame(gameId)!;
        const scoreFn = vi.fn();
        const game = info.createGame(makeConfig(360, 640, 0, scoreFn)) as any;
        game.start();
        game.setScore(999);
        expect(scoreFn).toHaveBeenCalledWith(999);
        game.destroy();
      });

      it('should handle small canvas dimensions gracefully (100x100)', () => {
        const info = getGame(gameId)!;
        expect(() => {
          const game = info.createGame(makeConfig(100, 100, 0)) as any;
          game.start();
          game.update(0.016);
          game.render();
          game.destroy();
        }).not.toThrow();
      });

      it('should handle zero delta time gracefully', () => {
        const info = getGame(gameId)!;
        const game = info.createGame(makeConfig(360, 640, 0)) as any;
        game.start();
        expect(() => {
          game.update(0);
          game.render();
        }).not.toThrow();
        game.destroy();
      });

      it('should support pause and resume without crashing', () => {
        const info = getGame(gameId)!;
        const game = info.createGame(makeConfig(360, 640, 1));
        game.start();
        game.pause();
        game.resume();
        game.destroy();
      });

      it('should support start then immediate destroy', () => {
        const info = getGame(gameId)!;
        const game = info.createGame(makeConfig(360, 640, 0));
        expect(() => {
          game.start();
          game.destroy();
        }).not.toThrow();
      });

      it('should be safe to destroy multiple times', () => {
        const info = getGame(gameId)!;
        const game = info.createGame(makeConfig(360, 640, 0));
        game.start();
        game.destroy();
        expect(() => game.destroy()).not.toThrow();
      });
    });
  }

  // ══════════════════════════════════════════════
  // Cross-cutting registry tests
  // ══════════════════════════════════════════════
  describe('All Games Registry', () => {

    it('should have all 16 games registered', () => {
      const games = getAllGames();
      expect(games.length).toBe(16);
      const ids = games.map(g => g.id);
      for (const id of GAME_IDS) {
        expect(ids).toContain(id);
      }
    });

    it('every game should have a 2-element bgGradient array', () => {
      for (const game of getAllGames()) {
        expect(game.bgGradient).toBeDefined();
        expect(game.bgGradient!.length).toBe(2);
        // Both entries should be color strings
        expect(typeof game.bgGradient![0]).toBe('string');
        expect(typeof game.bgGradient![1]).toBe('string');
      }
    });

    it('every game should have required metadata fields', () => {
      for (const game of getAllGames()) {
        expect(game.id).toBeTruthy();
        expect(game.name).toBeTruthy();
        expect(game.description).toBeTruthy();
        expect(game.icon).toBeTruthy();
        expect(game.color).toBeTruthy();
        expect(['puzzle', 'arcade', 'strategy', 'card']).toContain(game.category);
        expect(game.canvasWidth).toBeGreaterThan(0);
        expect(game.canvasHeight).toBeGreaterThan(0);
        expect(typeof game.createGame).toBe('function');
      }
    });

    it('every game createGame should return a GameEngine instance', () => {
      for (const game of getAllGames()) {
        const instance = game.createGame(makeConfig(360, 640, 0));
        expect(instance).toBeInstanceOf(GameEngine);
        instance.destroy();
      }
    });

    it('all games should survive a full start/update/render/destroy lifecycle', () => {
      for (const game of getAllGames()) {
        const instance = game.createGame(makeConfig(360, 640, 1)) as any;
        instance.start();
        instance.update(0.016);
        instance.render();
        instance.destroy();
      }
    });

    it('getGame should return undefined for non-existent id', () => {
      expect(getGame('nonexistent-game')).toBeUndefined();
    });

    it('all games should have distinct ids', () => {
      const ids = getAllGames().map(g => g.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('all games should have controls defined', () => {
      for (const game of getAllGames()) {
        expect(game.controls).toBeTruthy();
        expect(typeof game.controls).toBe('string');
      }
    });
  });
});
