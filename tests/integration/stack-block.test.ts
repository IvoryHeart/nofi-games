import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock idb-keyval before any source imports
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { loadAllGames, getGame } from '../../src/games/registry';
import { GameConfig, GameEngine } from '../../src/engine/GameEngine';

interface BlockTile {
  x: number;
  y: number;
  w: number;
  color: string;
}

interface ActiveBlock extends BlockTile {
  dir: number;
  speed: number;
}

// Reach into the game's internals for tests via this typed accessor.
type StackInternals = GameEngine & {
  tower: BlockTile[];
  active: ActiveBlock | null;
  cameraY: number;
  targetCameraY: number;
  gameActive: boolean;
  placedCount: number;
  dropActiveBlock: () => void;
  spawnNextBlock: () => void;
  serialize: () => Record<string, unknown>;
  deserialize: (s: Record<string, unknown>) => void;
  canSave: () => boolean;
};

function makeConfig(
  w = 360,
  h = 640,
  diff = 0,
  onScore?: (s: number) => void,
  onGameOver?: (s: number) => void,
): GameConfig {
  return {
    canvas: document.createElement('canvas'),
    width: w,
    height: h,
    difficulty: diff,
    onScore,
    onGameOver,
  };
}

function createGame(
  diff = 0,
  onScore?: (s: number) => void,
  onGameOver?: (s: number) => void,
): StackInternals {
  const info = getGame('stack-block')!;
  const game = info.createGame(makeConfig(360, 640, diff, onScore, onGameOver)) as unknown as StackInternals;
  game.start();
  return game;
}

beforeAll(async () => {
  await loadAllGames();
});

describe('Stack the Block', () => {
  it('1. is registered and getGame returns its info', () => {
    const info = getGame('stack-block');
    expect(info).toBeDefined();
    expect(info!.id).toBe('stack-block');
    expect(info!.name).toBe('Stack');
    expect(info!.category).toBe('arcade');
    expect(info!.canvasWidth).toBe(360);
    expect(info!.canvasHeight).toBe(640);
  });

  it('2. instantiates at all 4 difficulties without throwing', () => {
    const info = getGame('stack-block')!;
    for (let d = 0; d <= 3; d++) {
      const game = info.createGame(makeConfig(360, 640, d));
      expect(game).toBeInstanceOf(GameEngine);
      game.destroy();
    }
  });

  it('3. survives a clean start/update/render/destroy lifecycle', () => {
    const game = createGame(1);
    expect(() => {
      game.update(0.016);
      game.render();
      game.update(0.016);
      game.render();
      game.update(0.05);
      game.render();
      game.destroy();
    }).not.toThrow();
  });

  it('4. initial state has the base block plus one active block', () => {
    const game = createGame(0);
    expect(game.tower.length).toBe(1);
    expect(game.active).not.toBeNull();
    expect(game.gameActive).toBe(true);
    expect(game.placedCount).toBe(0);
    // Base block must have positive width
    expect(game.tower[0].w).toBeGreaterThan(0);
    game.destroy();
  });

  it('5. active block has a non-zero slide speed and moves over time', () => {
    const game = createGame(0);
    expect(game.active).not.toBeNull();
    expect(game.active!.speed).toBeGreaterThan(0);
    const x0 = game.active!.x;
    // Step a small amount of time; horizontal position should change
    game.update(0.1);
    const x1 = game.active!.x;
    expect(x1).not.toBe(x0);
    game.destroy();
  });

  it('6. drop on perfect alignment keeps full width and awards perfect bonus', () => {
    const scoreFn = vi.fn();
    const game = createGame(0, scoreFn);
    const top = game.tower[0];
    // Force the active block to perfectly align with the top block
    game.active!.x = top.x;
    game.active!.w = top.w;
    const beforeWidth = top.w;

    game.dropActiveBlock();

    // Tower grew by exactly one block
    expect(game.tower.length).toBe(2);
    // The placed block has the SAME width as the top (perfect)
    const placed = game.tower[1];
    expect(placed.w).toBe(beforeWidth);
    expect(placed.x).toBe(top.x);
    // Score callback fired with at least the perfect bonus amount (5 + 10 = 15)
    expect(scoreFn).toHaveBeenCalled();
    const lastScore = scoreFn.mock.calls[scoreFn.mock.calls.length - 1][0] as number;
    expect(lastScore).toBeGreaterThanOrEqual(15);
    game.destroy();
  });

  it('7. drop with partial overlap chops the overhang and shrinks block width', () => {
    // Use Hard so perfectTolerance = 0 (no perfect snapping interference)
    const game = createGame(2);
    const top = game.tower[0];
    // Offset active block by 10px to the right of top → partial overlap
    game.active!.x = top.x + 10;
    game.active!.w = top.w;

    const expectedOverlap = top.w - 10;

    game.dropActiveBlock();

    expect(game.tower.length).toBe(2);
    const placed = game.tower[1];
    expect(placed.w).toBeLessThan(top.w);
    expect(placed.w).toBeCloseTo(expectedOverlap, 4);
    // The new block starts at the overlap left edge (top.x + 10)
    expect(placed.x).toBeCloseTo(top.x + 10, 4);
    game.destroy();
  });

  it('8. drop with no overlap triggers gameOver', () => {
    const overFn = vi.fn();
    const game = createGame(2, undefined, overFn);
    const top = game.tower[0];
    // Move active completely past the right edge of the top block
    game.active!.x = top.x + top.w + 20;
    game.active!.w = 30;

    game.dropActiveBlock();

    expect(overFn).toHaveBeenCalled();
    expect(game.gameActive).toBe(false);
    game.destroy();
  });

  it('9. score increments on each successful stack', () => {
    const scoreFn = vi.fn();
    const game = createGame(0, scoreFn);

    // Two consecutive perfect drops
    for (let i = 0; i < 2; i++) {
      const top = game.tower[game.tower.length - 1];
      game.active!.x = top.x;
      game.active!.w = top.w;
      game.dropActiveBlock();
    }

    expect(game.tower.length).toBe(3);
    expect(game.placedCount).toBe(2);
    // The score callback was invoked at least twice
    expect(scoreFn.mock.calls.length).toBeGreaterThanOrEqual(2);
    // Final score should reflect both placements (2 * (5 + 10) = 30 minimum)
    const finalScore = scoreFn.mock.calls[scoreFn.mock.calls.length - 1][0] as number;
    expect(finalScore).toBeGreaterThanOrEqual(30);
    game.destroy();
  });

  it('10. tower grows after multiple drops', () => {
    const game = createGame(0);
    const initialLen = game.tower.length;
    for (let i = 0; i < 5; i++) {
      const top = game.tower[game.tower.length - 1];
      game.active!.x = top.x;
      game.active!.w = top.w;
      game.dropActiveBlock();
    }
    expect(game.tower.length).toBe(initialLen + 5);
    expect(game.gameActive).toBe(true);
    game.destroy();
  });

  it('11. different difficulties produce different starting block widths', () => {
    const easy = createGame(0);
    const hard = createGame(2);
    // Easy: startWidth=140 (+20 base), Hard: startWidth=90 (+20 base)
    expect(easy.tower[0].w).toBeGreaterThan(hard.tower[0].w);
    // Active widths inherit from base
    expect(easy.active!.w).toBeGreaterThan(hard.active!.w);
    easy.destroy();
    hard.destroy();
  });

  it('12. serialize/deserialize round-trips tower, active block, and camera', () => {
    const game = createGame(0);
    // Drop a block to grow the tower a bit
    const top = game.tower[0];
    game.active!.x = top.x;
    game.active!.w = top.w;
    game.dropActiveBlock();

    // Force a non-zero camera and capture state
    game.cameraY = 42;
    game.targetCameraY = 42;
    const snapshot = game.serialize();

    // Create a fresh game and deserialize
    const game2 = createGame(0);
    game2.deserialize(snapshot);

    expect(game2.tower.length).toBe(game.tower.length);
    expect(game2.tower[0].x).toBeCloseTo(game.tower[0].x, 4);
    expect(game2.tower[0].w).toBeCloseTo(game.tower[0].w, 4);
    expect(game2.tower[1].w).toBeCloseTo(game.tower[1].w, 4);
    expect(game2.active).not.toBeNull();
    expect(game2.active!.w).toBeCloseTo(game.active!.w, 4);
    expect(game2.cameraY).toBeCloseTo(42, 4);
    expect(game2.placedCount).toBe(game.placedCount);
    expect(game2.gameActive).toBe(true);

    game.destroy();
    game2.destroy();
  });

  it('13. canSave returns true during play and false after game over', () => {
    const game = createGame(0);
    // Stable initial state: camera at target, game active
    expect(game.canSave()).toBe(true);

    // Force game over via no-overlap drop
    const top = game.tower[0];
    game.active!.x = top.x + top.w + 50;
    game.active!.w = 20;
    game.dropActiveBlock();

    expect(game.gameActive).toBe(false);
    expect(game.canSave()).toBe(false);
    game.destroy();
  });

  it('14. defensive deserialize ignores malformed snapshots', () => {
    const game = createGame(0);
    const originalLen = game.tower.length;
    const originalBaseW = game.tower[0].w;

    // Empty / wrong type — should be a no-op (state intact)
    game.deserialize({} as Record<string, unknown>);
    expect(game.tower.length).toBe(originalLen);
    expect(game.tower[0].w).toBe(originalBaseW);

    // tower entries missing required fields — should bail out, leaving state intact
    game.deserialize({ tower: [{ x: 1 }] } as unknown as Record<string, unknown>);
    expect(game.tower.length).toBe(originalLen);
    expect(game.tower[0].w).toBe(originalBaseW);

    // tower as wrong type — should bail out
    game.deserialize({ tower: 'nope' } as unknown as Record<string, unknown>);
    expect(game.tower.length).toBe(originalLen);

    // Valid tower but malformed active — tower restored, active becomes null
    game.deserialize({
      tower: [{ x: 10, y: 20, w: 50, color: '#ff0000' }],
      active: 'garbage',
    } as unknown as Record<string, unknown>);
    expect(game.tower.length).toBe(1);
    expect(game.tower[0].w).toBe(50);
    expect(game.active).toBeNull();

    game.destroy();
  });
});
