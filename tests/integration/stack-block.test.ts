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
import {
  projectX,
  projectY,
  shade,
  gradientColor,
} from '../../src/games/stack-block/StackBlock';

interface BlockTile {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  baseColor: string;
}

interface ActiveBlock extends BlockTile {
  dir: number;
  speed: number;
  axis: 'x' | 'z';
  mode: 'entering' | 'oscillating';
  enterT: number;
  enterFrom: number;
  enterTo: number;
  enterDuration: number;
}

/** Align the active block with the top of the tower and force x-axis mode for test simplicity. */
function alignActive(game: StackInternals, xOffset = 0): void {
  const top = game.tower[game.tower.length - 1];
  game.active!.x = top.x + xOffset;
  game.active!.w = top.w;
  game.active!.z = top.z;
  game.active!.d = top.d;
  game.active!.axis = 'x';
}

interface FallingChunk {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  vx: number;
  vy: number;
  angVel: number;
  rot: number;
  baseColor: string;
}

// Reach into the game's internals for tests via this typed accessor.
type StackInternals = GameEngine & {
  tower: BlockTile[];
  active: ActiveBlock | null;
  falling: FallingChunk[];
  cameraY: number;
  targetCameraY: number;
  gameActive: boolean;
  placedCount: number;
  dropActiveBlock: () => void;
  spawnNextBlock: () => void;
  updateFalling: (dt: number) => void;
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
    expect(game.tower[0].w).toBeGreaterThan(0);
    expect(game.tower[0].d).toBeGreaterThan(0);
    expect(game.tower[0].h).toBeGreaterThan(0);
    game.destroy();
  });

  it('5. active block has a non-zero slide speed; position advances during slide-in', () => {
    const game = createGame(0);
    expect(game.active).not.toBeNull();
    expect(game.active!.speed).toBeGreaterThan(0);
    const x0 = game.active!.x;
    game.update(0.1);
    const x1 = game.active!.x;
    expect(x1).not.toBe(x0);
    game.destroy();
  });

  it('6. drop on perfect alignment keeps full width and awards perfect bonus', () => {
    const scoreFn = vi.fn();
    const game = createGame(0, scoreFn);
    const top = game.tower[0];
    alignActive(game);
    const beforeWidth = top.w;

    game.dropActiveBlock();

    expect(game.tower.length).toBe(2);
    const placed = game.tower[1];
    expect(placed.w).toBe(beforeWidth);
    expect(placed.x).toBe(top.x);
    expect(scoreFn).toHaveBeenCalled();
    const lastScore = scoreFn.mock.calls[scoreFn.mock.calls.length - 1][0] as number;
    expect(lastScore).toBeGreaterThanOrEqual(15);
    game.destroy();
  });

  it('7. drop with partial overlap chops the overhang and shrinks block width', () => {
    const game = createGame(2);
    const top = game.tower[0];
    alignActive(game, 10);

    const expectedOverlap = top.w - 10;

    game.dropActiveBlock();

    expect(game.tower.length).toBe(2);
    const placed = game.tower[1];
    expect(placed.w).toBeLessThan(top.w);
    expect(placed.w).toBeCloseTo(expectedOverlap, 4);
    expect(placed.x).toBeCloseTo(top.x + 10, 4);
    game.destroy();
  });

  it('8. drop with no overlap triggers gameOver', () => {
    const overFn = vi.fn();
    const game = createGame(2, undefined, overFn);
    const top = game.tower[0];
    alignActive(game, top.w + 20);
    game.active!.w = 30;

    game.dropActiveBlock();

    expect(overFn).toHaveBeenCalled();
    expect(game.gameActive).toBe(false);
    game.destroy();
  });

  it('9. score increments on each successful stack', () => {
    const scoreFn = vi.fn();
    const game = createGame(0, scoreFn);

    for (let i = 0; i < 2; i++) {
      alignActive(game);
      game.dropActiveBlock();
    }

    expect(game.tower.length).toBe(3);
    expect(game.placedCount).toBe(2);
    expect(scoreFn.mock.calls.length).toBeGreaterThanOrEqual(2);
    const finalScore = scoreFn.mock.calls[scoreFn.mock.calls.length - 1][0] as number;
    expect(finalScore).toBeGreaterThanOrEqual(30);
    game.destroy();
  });

  it('10. tower grows after multiple drops', () => {
    const game = createGame(0);
    const initialLen = game.tower.length;
    for (let i = 0; i < 5; i++) {
      alignActive(game);
      game.dropActiveBlock();
    }
    expect(game.tower.length).toBe(initialLen + 5);
    expect(game.gameActive).toBe(true);
    game.destroy();
  });

  it('11. different difficulties produce different starting block widths', () => {
    const easy = createGame(0);
    const hard = createGame(2);
    expect(easy.tower[0].w).toBeGreaterThan(hard.tower[0].w);
    expect(easy.active!.w).toBeGreaterThan(hard.active!.w);
    easy.destroy();
    hard.destroy();
  });

  it('12. serialize/deserialize round-trips tower, active block, and camera', () => {
    const game = createGame(0);
    alignActive(game);
    game.dropActiveBlock();

    game.cameraY = 42;
    game.targetCameraY = 42;
    const snapshot = game.serialize();

    const game2 = createGame(0);
    game2.deserialize(snapshot);

    expect(game2.tower.length).toBe(game.tower.length);
    expect(game2.tower[0].x).toBeCloseTo(game.tower[0].x, 4);
    expect(game2.tower[0].w).toBeCloseTo(game.tower[0].w, 4);
    expect(game2.tower[1].w).toBeCloseTo(game.tower[1].w, 4);
    expect(game2.tower[0].z).toBeCloseTo(game.tower[0].z, 4);
    expect(game2.tower[0].d).toBeCloseTo(game.tower[0].d, 4);
    expect(game2.active).not.toBeNull();
    expect(game2.active!.w).toBeCloseTo(game.active!.w, 4);
    expect(game2.cameraY).toBeCloseTo(42, 4);
    expect(game2.placedCount).toBe(game.placedCount);
    expect(game2.gameActive).toBe(true);

    game.destroy();
    game2.destroy();
  });

  it('13. canSave returns true during stable play and false after game over', () => {
    const game = createGame(0);
    // Fast-forward through slide-in so active block enters oscillating mode
    game.update(0.3);
    expect(game.canSave()).toBe(true);

    const top = game.tower[0];
    alignActive(game, top.w + 50);
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

    game.deserialize({} as Record<string, unknown>);
    expect(game.tower.length).toBe(originalLen);
    expect(game.tower[0].w).toBe(originalBaseW);

    game.deserialize({ tower: [{ x: 1 }] } as unknown as Record<string, unknown>);
    expect(game.tower.length).toBe(originalLen);
    expect(game.tower[0].w).toBe(originalBaseW);

    game.deserialize({ tower: 'nope' } as unknown as Record<string, unknown>);
    expect(game.tower.length).toBe(originalLen);

    // Legacy snapshot shape (no z/d/h/baseColor) must still load gracefully
    game.deserialize({
      tower: [{ x: 10, y: 20, w: 50, color: '#ff0000' }],
      active: 'garbage',
    } as unknown as Record<string, unknown>);
    expect(game.tower.length).toBe(1);
    expect(game.tower[0].w).toBe(50);
    expect(game.tower[0].d).toBeGreaterThan(0);   // back-compat defaults
    expect(game.tower[0].h).toBeGreaterThan(0);
    expect(game.active).toBeNull();

    game.destroy();
  });

  // ── 2.5D rendering specifics ────────────────────────────────────────

  it('15. projectX applies depth factor (-0.45) to z — depth goes left', () => {
    // Known points: at z=0 there is no skew.
    expect(projectX(100, 0)).toBeCloseTo(100, 6);
    // At z=100, screenX shifts LEFT by 0.45 * 100 = 45 → 100 - 45 = 55.
    expect(projectX(100, 100)).toBeCloseTo(55, 4);
    // Negative z shifts right.
    expect(projectX(50, -40)).toBeCloseTo(50 + (-40) * (-0.45), 4);
  });

  it('16. projectY applies vertical factor (0.35) subtracting from y', () => {
    // z=0 leaves y unchanged (world y grows downward in this game).
    expect(projectY(200, 0)).toBeCloseTo(200, 6);
    // Depth tilts projected y upward (subtracts) — back edges sit higher.
    expect(projectY(200, 100)).toBeCloseTo(165, 4);
    // Equivalent formula check: projectY(y, z) === y - z*0.35
    expect(projectY(0, 120)).toBeCloseTo(-42, 4);
  });

  it('17. shade(hex, factor<1) produces darker colours; factor 1 is identity-ish; factor 0 is black', () => {
    // White → mid grey at 0.5
    const half = shade('#ffffff', 0.5);
    expect(half).toBe('rgb(128,128,128)');
    // Full brightness preserves channels
    expect(shade('#80a0c0', 1)).toBe('rgb(128,160,192)');
    // Zero factor clamps to black
    expect(shade('#abcdef', 0)).toBe('rgb(0,0,0)');
    // Factor > 1 clamps at 255 (no overflow)
    expect(shade('#808080', 10)).toBe('rgb(255,255,255)');
    // Dark face factors from the spec are strictly darker than the top
    const base = '#4FB87C';
    const top = shade(base, 1.0);
    const right = shade(base, 0.78);
    const front = shade(base, 0.6);
    expect(top).not.toBe(right);
    expect(right).not.toBe(front);
    // Roughly-ordered luminance: parse rgb() and compare
    const parseLum = (s: string): number => {
      const m = s.match(/\d+/g);
      if (!m) return 0;
      return parseInt(m[0], 10) + parseInt(m[1], 10) + parseInt(m[2], 10);
    };
    expect(parseLum(top)).toBeGreaterThan(parseLum(right));
    expect(parseLum(right)).toBeGreaterThan(parseLum(front));
  });

  it('18. gradientColor returns the golden top stop at the head and the green bottom far below', () => {
    const atHead = gradientColor(10, 10);      // depth 0
    const farBelow = gradientColor(0, 50);     // depth 50 (clamps to t=1)
    // Top stop is golden '#E8C850'
    expect(atHead.toLowerCase()).toBe('#e8c850');
    // Bottom stop is green '#7CC850'
    expect(farBelow.toLowerCase()).toBe('#7cc850');
    // Midway passes through the middle yellow stop
    const mid = gradientColor(0, 15);
    expect(mid.toLowerCase()).toBe('#e8d040');
  });

  it('19. active block slide-in transitions to oscillating within the enter duration', () => {
    const game = createGame(0);
    const a = game.active!;
    expect(a.mode).toBe('entering');
    expect(a.enterT).toBeCloseTo(0, 4);
    // Advance half the duration
    game.update(a.enterDuration * 0.5);
    expect(game.active!.mode).toBe('entering');
    expect(game.active!.enterT).toBeGreaterThan(0.4);
    expect(game.active!.enterT).toBeLessThan(0.6);
    // Finish the remainder (plus a tiny overshoot) — should be oscillating now
    game.update(a.enterDuration);
    expect(game.active!.mode).toBe('oscillating');
    // Once oscillating, x should be at the resting enterTo position (before drift)
    expect(game.active!.x).toBeCloseTo(a.enterTo, 4);
    game.destroy();
  });

  it('20. slide-in easing follows ease-out cubic (fast start, slow end)', () => {
    const game = createGame(0);
    const a = game.active!;
    const from = a.enterFrom;
    const to = a.enterTo;

    // At t = enterDuration * 0.5, ease-out cubic gives t=0.5 → 1 - 0.5^3 = 0.875
    game.update(a.enterDuration * 0.5);
    const expectedX = from + (to - from) * 0.875;
    expect(game.active!.x).toBeCloseTo(expectedX, 2);
    game.destroy();
  });

  it('21. drop with overhang pushes a FallingChunk with non-zero width', () => {
    const game = createGame(2);   // Hard → zero perfect tolerance
    expect(game.falling.length).toBe(0);
    const top = game.tower[0];
    alignActive(game, 10);

    game.dropActiveBlock();

    expect(game.falling.length).toBe(1);
    const chunk = game.falling[0];
    expect(chunk.w).toBeCloseTo(10, 4);
    // The chunk starts on the side that was overhanging
    expect(chunk.x + chunk.w).toBeCloseTo(top.x + top.w + 10, 4);
    game.destroy();
  });

  it('22. drop with overhang on the other side also spawns a chunk', () => {
    const game = createGame(2);
    const top = game.tower[0];
    // Offset left so the active block hangs off the LEFT edge of the top.
    alignActive(game, -15);

    game.dropActiveBlock();

    expect(game.falling.length).toBe(1);
    const chunk = game.falling[0];
    expect(chunk.w).toBeCloseTo(15, 4);
    expect(chunk.x).toBeCloseTo(top.x - 15, 4);
    // Left-side chunks drift leftward
    expect(chunk.vx).toBeLessThan(0);
    game.destroy();
  });

  it('23. FallingChunk with downward velocity exits the visible area in reasonable time', () => {
    const game = createGame(2);
    const top = game.tower[0];
    alignActive(game, 12);
    game.dropActiveBlock();
    expect(game.falling.length).toBe(1);

    // Simulate ~3 seconds of physics in small steps
    let iterations = 0;
    const MAX_ITER = 200;
    while (game.falling.length > 0 && iterations < MAX_ITER) {
      game.update(0.016);
      iterations++;
    }
    expect(game.falling.length).toBe(0);
    // Shouldn't take all 200 iterations — chunk should be culled well before.
    expect(iterations).toBeLessThan(MAX_ITER);
    game.destroy();
  });

  it('24. perfect drop produces NO falling chunks', () => {
    const game = createGame(0);
    alignActive(game);
    game.dropActiveBlock();
    expect(game.falling.length).toBe(0);
    game.destroy();
  });

  it('25. camera target tracks the projected top of the active block', () => {
    const game = createGame(0);
    // Clear any target the initial spawn set, then force-spawn with a known world y.
    game.targetCameraY = 0;
    // Fake the tower state so spawnNextBlock uses a predictable top.
    game.tower = [{
      x: 100,
      y: 300,                      // make newY deterministic
      z: 0,
      w: 100,
      d: 120,
      h: 28,
      baseColor: '#ffffff',
    }];
    game.spawnNextBlock();
    const a = game.active!;
    // Expected: projectY(a.y, a.z) = a.y (since z=0), so desired = 0.45*640 - a.y
    const expectedTarget = 0.45 * 640 - projectY(a.y, a.z);
    expect(game.targetCameraY).toBeCloseTo(expectedTarget, 4);
    game.destroy();
  });

  it('26. tower block coordinates remain 1D along the x axis (z is uniform)', () => {
    const game = createGame(0);
    // Drop several perfect blocks. z should never change across the tower.
    for (let i = 0; i < 4; i++) {
      alignActive(game);
      game.dropActiveBlock();
    }
    const zs = game.tower.map(b => b.z);
    const uniq = new Set(zs);
    expect(uniq.size).toBe(1);   // all blocks share the same z
    game.destroy();
  });
});
