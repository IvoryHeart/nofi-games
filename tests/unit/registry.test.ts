import { describe, it, expect, beforeEach } from 'vitest';
import { registerGame, getGame, getAllGames, GameInfo } from '../../src/games/registry';
import { GameEngine, GameConfig } from '../../src/engine/GameEngine';

// Minimal test game for registry
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
  it('should register a game', () => {
    const info = makeDummyInfo({ id: 'reg-test-1' });
    registerGame(info);
    const retrieved = getGame('reg-test-1');
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('Test Game');
  });

  it('should return undefined for unknown game', () => {
    expect(getGame('nonexistent-game')).toBeUndefined();
  });

  it('should return all registered games', () => {
    registerGame(makeDummyInfo({ id: 'reg-test-a', name: 'Game A' }));
    registerGame(makeDummyInfo({ id: 'reg-test-b', name: 'Game B' }));
    const all = getAllGames();
    const ids = all.map(g => g.id);
    expect(ids).toContain('reg-test-a');
    expect(ids).toContain('reg-test-b');
  });

  it('should create a game instance via createGame', () => {
    const info = makeDummyInfo({ id: 'reg-test-create' });
    registerGame(info);
    const game = info.createGame({
      canvas: document.createElement('canvas'),
      width: 300,
      height: 400,
    });
    expect(game).toBeInstanceOf(GameEngine);
    game.destroy();
  });

  it('should store all game info fields', () => {
    const info = makeDummyInfo({
      id: 'reg-test-fields',
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
    const retrieved = getGame('reg-test-fields')!;
    expect(retrieved.category).toBe('arcade');
    expect(retrieved.canvasWidth).toBe(360);
    expect(retrieved.canvasHeight).toBe(560);
    expect(retrieved.controls).toBe('Arrow keys');
  });
});
