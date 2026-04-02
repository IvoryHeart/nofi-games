import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock audio and haptics since GameEngine imports them
vi.mock('../../src/utils/audio', () => ({
  sound: { play: vi.fn() },
}));
vi.mock('../../src/utils/haptics', () => ({
  hapticLight: vi.fn(),
  hapticMedium: vi.fn(),
  hapticHeavy: vi.fn(),
}));

// Mock all game modules so loadAllGames can resolve
vi.mock('../../src/games/block-drop/BlockDrop', () => ({}));
vi.mock('../../src/games/bubble-pop/BubblePop', () => ({}));
vi.mock('../../src/games/gem-swap/GemSwap', () => ({}));
vi.mock('../../src/games/twenty48/Twenty48', () => ({}));
vi.mock('../../src/games/snake/Snake', () => ({}));
vi.mock('../../src/games/minesweeper/Minesweeper', () => ({}));
vi.mock('../../src/games/memory-match/MemoryMatch', () => ({}));
vi.mock('../../src/games/sudoku/Sudoku', () => ({}));

// The registry is a module-level Map, so games registered in one test persist.
// We test around that by using unique IDs.
import { registerGame, getGame, getAllGames, loadAllGames, GameInfo } from '../../src/games/registry';
import { GameEngine, GameConfig } from '../../src/engine/GameEngine';

class DummyGame extends GameEngine {
  init() {}
  update() {}
  render() {}
}

function makeDummyInfo(overrides: Partial<GameInfo> = {}): GameInfo {
  return {
    id: 'test-game',
    name: 'Test Game',
    description: 'A test game',
    icon: 'T',
    color: '--color-primary',
    category: 'puzzle',
    createGame: (config: GameConfig) => new DummyGame(config),
    canvasWidth: 300,
    canvasHeight: 400,
    ...overrides,
  };
}

describe('Game Registry', () => {
  describe('registerGame()', () => {
    it('should register a game', () => {
      const info = makeDummyInfo({ id: 'reg-test-1' });
      registerGame(info);
      const retrieved = getGame('reg-test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('Test Game');
    });

    it('should overwrite existing registration with same id', () => {
      registerGame(makeDummyInfo({ id: 'reg-overwrite', name: 'Original' }));
      registerGame(makeDummyInfo({ id: 'reg-overwrite', name: 'Replaced' }));
      const retrieved = getGame('reg-overwrite');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('Replaced');
    });

    it('should register games with different categories', () => {
      registerGame(makeDummyInfo({ id: 'reg-puzzle', category: 'puzzle' }));
      registerGame(makeDummyInfo({ id: 'reg-arcade', category: 'arcade' }));
      registerGame(makeDummyInfo({ id: 'reg-strategy', category: 'strategy' }));
      registerGame(makeDummyInfo({ id: 'reg-card', category: 'card' }));
      expect(getGame('reg-puzzle')!.category).toBe('puzzle');
      expect(getGame('reg-arcade')!.category).toBe('arcade');
      expect(getGame('reg-strategy')!.category).toBe('strategy');
      expect(getGame('reg-card')!.category).toBe('card');
    });
  });

  describe('getGame()', () => {
    it('should return undefined for unknown game', () => {
      expect(getGame('nonexistent-game-xyz')).toBeUndefined();
    });

    it('should return the GameInfo for registered game', () => {
      registerGame(makeDummyInfo({ id: 'reg-get-test' }));
      const info = getGame('reg-get-test');
      expect(info).toBeDefined();
      expect(info!.id).toBe('reg-get-test');
    });
  });

  describe('getAllGames()', () => {
    it('should return all registered games', () => {
      registerGame(makeDummyInfo({ id: 'reg-all-a', name: 'Game A' }));
      registerGame(makeDummyInfo({ id: 'reg-all-b', name: 'Game B' }));
      const all = getAllGames();
      const ids = all.map(g => g.id);
      expect(ids).toContain('reg-all-a');
      expect(ids).toContain('reg-all-b');
    });

    it('should return an array (not a Map)', () => {
      const all = getAllGames();
      expect(Array.isArray(all)).toBe(true);
    });
  });

  describe('createGame via GameInfo', () => {
    it('should create a game instance via createGame', () => {
      const info = makeDummyInfo({ id: 'reg-create' });
      registerGame(info);
      const game = info.createGame({
        canvas: document.createElement('canvas'),
        width: 300,
        height: 400,
      });
      expect(game).toBeInstanceOf(GameEngine);
      game.destroy();
    });
  });

  describe('game info fields', () => {
    it('should store all game info fields', () => {
      const info = makeDummyInfo({
        id: 'reg-fields',
        name: 'Full Game',
        description: 'With all fields',
        icon: 'F',
        color: '--color-accent',
        category: 'arcade',
        canvasWidth: 360,
        canvasHeight: 560,
        controls: 'Arrow keys',
      });
      registerGame(info);
      const retrieved = getGame('reg-fields')!;
      expect(retrieved.name).toBe('Full Game');
      expect(retrieved.description).toBe('With all fields');
      expect(retrieved.icon).toBe('F');
      expect(retrieved.color).toBe('--color-accent');
      expect(retrieved.category).toBe('arcade');
      expect(retrieved.canvasWidth).toBe(360);
      expect(retrieved.canvasHeight).toBe(560);
      expect(retrieved.controls).toBe('Arrow keys');
    });

    it('should store optional bgGradient', () => {
      const info = makeDummyInfo({
        id: 'reg-gradient',
        bgGradient: ['#FF0000', '#0000FF'],
      });
      registerGame(info);
      const retrieved = getGame('reg-gradient')!;
      expect(retrieved.bgGradient).toEqual(['#FF0000', '#0000FF']);
    });

    it('should store optional perGameSettings', () => {
      const info = makeDummyInfo({
        id: 'reg-per-game-settings',
        perGameSettings: [{ key: 'showHints', label: 'Show hints', type: 'toggle' }],
      });
      registerGame(info);
      const retrieved = getGame('reg-per-game-settings')!;
      expect(retrieved.perGameSettings).toHaveLength(1);
      expect(retrieved.perGameSettings![0].key).toBe('showHints');
    });
  });

  describe('loadAllGames()', () => {
    it('should attempt to import all game modules without throwing', async () => {
      await expect(loadAllGames()).resolves.not.toThrow();
    });
  });
});
