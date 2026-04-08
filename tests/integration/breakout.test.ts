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
import { GameConfig, GameSnapshot } from '../../src/engine/GameEngine';

function makeConfig(
  w = 360,
  h = 540,
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

function fakeKeyEvent(key: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key });
  e.preventDefault = vi.fn();
  return e;
}

beforeAll(async () => {
  await loadAllGames();
});

interface BreakoutInternal {
  start(): void;
  destroy(): void;
  init(): void;
  update(dt: number): void;
  render(): void;
  serialize(): GameSnapshot;
  deserialize(state: GameSnapshot): void;
  canSave(): boolean;
  handleKeyDown(key: string, e: KeyboardEvent): void;
  handlePointerDown(x: number, y: number): void;
  handlePointerMove(x: number, y: number): void;
  bricks: Array<{ x: number; y: number; w: number; h: number; alive: boolean; hitsRemaining: number; color: string }>;
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;
  ballRadius: number;
  ballOnPaddle: boolean;
  paddleX: number;
  paddleY: number;
  paddleW: number;
  paddleH: number;
  lives: number;
  level: number;
  gameActive: boolean;
}

function create(diff = 0, onScore?: (s: number) => void, onGameOver?: (s: number) => void): BreakoutInternal {
  const info = getGame('breakout')!;
  const game = info.createGame(makeConfig(360, 540, diff, onScore, onGameOver)) as unknown as BreakoutInternal;
  game.start();
  return game;
}

describe('Breakout – registration', () => {
  it('is registered with the game registry', () => {
    const info = getGame('breakout');
    expect(info).toBeDefined();
    expect(info!.id).toBe('breakout');
    expect(info!.name).toBe('Breakout');
    expect(info!.category).toBe('arcade');
    expect(info!.canvasWidth).toBe(360);
    expect(info!.canvasHeight).toBe(540);
    expect(info!.dailyMode).toBeFalsy();
  });
});

describe('Breakout – instantiation across difficulties', () => {
  it.each([0, 1, 2, 3])('instantiates and runs cleanly at difficulty %i', (diff) => {
    const game = create(diff);
    expect(() => {
      game.update(0.016);
      game.render();
    }).not.toThrow();
    expect(game.bricks.length).toBeGreaterThan(0);
    expect(game.lives).toBeGreaterThan(0);
    game.destroy();
  });

  it('lives count matches difficulty mapping', () => {
    const expected = [5, 3, 3, 1];
    for (let d = 0; d < 4; d++) {
      const g = create(d);
      expect(g.lives).toBe(expected[d]);
      g.destroy();
    }
  });
});

describe('Breakout – initial state', () => {
  it('spawns bricks at start', () => {
    const game = create(1);
    expect(game.bricks.length).toBeGreaterThan(0);
    const alive = game.bricks.filter(b => b.alive).length;
    expect(alive).toBe(game.bricks.length);
    game.destroy();
  });

  it('ball starts attached to the paddle', () => {
    const game = create();
    expect(game.ballOnPaddle).toBe(true);
    expect(game.ballVX).toBe(0);
    expect(game.ballVY).toBe(0);
    // Centered horizontally over paddle
    expect(game.ballX).toBeCloseTo(game.paddleX + game.paddleW / 2, 1);
    game.destroy();
  });
});

describe('Breakout – ball launch', () => {
  it('launches with non-zero velocity on space key', () => {
    const game = create();
    expect(game.ballOnPaddle).toBe(true);
    game.handleKeyDown(' ', fakeKeyEvent(' '));
    expect(game.ballOnPaddle).toBe(false);
    const speed = Math.hypot(game.ballVX, game.ballVY);
    expect(speed).toBeGreaterThan(0);
    // Should be heading upward
    expect(game.ballVY).toBeLessThan(0);
    game.destroy();
  });

  it('launches and moves when updated', () => {
    const game = create();
    game.handleKeyDown(' ', fakeKeyEvent(' '));
    const startY = game.ballY;
    game.update(0.05);
    expect(game.ballY).toBeLessThan(startY); // moved upward
    game.destroy();
  });
});

describe('Breakout – physics', () => {
  it('bounces off the right wall, reversing x velocity', () => {
    const game = create();
    game.handleKeyDown(' ', fakeKeyEvent(' '));
    // Force ball to the right edge moving rightward
    game.ballX = 360 - game.ballRadius - 0.5;
    game.ballY = 200;
    game.ballVX = 200;
    game.ballVY = -200;
    game.ballOnPaddle = false;
    game.update(0.02);
    expect(game.ballVX).toBeLessThan(0);
    game.destroy();
  });

  it('bounces off the left wall, reversing x velocity', () => {
    const game = create();
    game.handleKeyDown(' ', fakeKeyEvent(' '));
    game.ballX = game.ballRadius + 0.5;
    game.ballY = 200;
    game.ballVX = -200;
    game.ballVY = -200;
    game.ballOnPaddle = false;
    game.update(0.02);
    expect(game.ballVX).toBeGreaterThan(0);
    game.destroy();
  });

  it('bounces off the paddle and reverses y velocity', () => {
    const game = create();
    game.ballOnPaddle = false;
    // Place ball just above paddle, moving down
    game.ballX = game.paddleX + game.paddleW / 2;
    game.ballY = game.paddleY - game.ballRadius;
    game.ballVX = 0;
    game.ballVY = 200;
    game.update(0.02);
    expect(game.ballVY).toBeLessThan(0);
    game.destroy();
  });
});

describe('Breakout – brick collision', () => {
  it('removes a brick on hit and adds score', () => {
    const scoreFn = vi.fn();
    const game = create(0, scoreFn);
    const target = game.bricks[0];
    const initialAlive = game.bricks.filter(b => b.alive).length;
    // Aim ball at brick
    game.ballOnPaddle = false;
    game.ballX = target.x + target.w / 2;
    game.ballY = target.y + target.h + game.ballRadius - 1;
    game.ballVX = 0;
    game.ballVY = -200;
    game.update(0.02);
    const aliveAfter = game.bricks.filter(b => b.alive).length;
    // For easy/level1, brick has 1 hit -> dead immediately
    expect(aliveAfter).toBeLessThan(initialAlive);
    expect(scoreFn).toHaveBeenCalled();
    game.destroy();
  });
});

describe('Breakout – lives and game over', () => {
  it('decrements lives when ball falls below paddle', () => {
    const game = create(0);
    const startLives = game.lives;
    game.ballOnPaddle = false;
    game.ballX = 100;
    game.ballY = 540 + 100; // already below
    game.ballVX = 0;
    game.ballVY = 100;
    game.update(0.02);
    expect(game.lives).toBe(startLives - 1);
    // Should respawn on paddle
    expect(game.ballOnPaddle).toBe(true);
    game.destroy();
  });

  it('ends the game when lives reach zero', () => {
    const overFn = vi.fn();
    const game = create(3, undefined, overFn); // extra hard: 1 life
    expect(game.lives).toBe(1);
    game.ballOnPaddle = false;
    game.ballX = 100;
    game.ballY = 540 + 100;
    game.ballVX = 0;
    game.ballVY = 100;
    game.update(0.02);
    expect(game.lives).toBe(0);
    expect(game.gameActive).toBe(false);
    expect(overFn).toHaveBeenCalled();
    game.destroy();
  });
});

describe('Breakout – level progression', () => {
  it('clearing all bricks advances to a new level with bricks regenerated', () => {
    const game = create(0);
    const startLevel = game.level;
    // Kill every brick except one
    for (let i = 0; i < game.bricks.length - 1; i++) {
      game.bricks[i].alive = false;
      game.bricks[i].hitsRemaining = 0;
    }
    const last = game.bricks[game.bricks.length - 1];
    // Hit the last brick
    game.ballOnPaddle = false;
    game.ballX = last.x + last.w / 2;
    game.ballY = last.y + last.h + game.ballRadius - 1;
    game.ballVX = 0;
    game.ballVY = -200;
    game.update(0.02);
    expect(game.level).toBe(startLevel + 1);
    // New bricks spawned
    expect(game.bricks.filter(b => b.alive).length).toBeGreaterThan(0);
    // Ball reattached to paddle for level start
    expect(game.ballOnPaddle).toBe(true);
    game.destroy();
  });
});

describe('Breakout – save / resume', () => {
  it('serialize/deserialize round-trip restores ball, paddle, and bricks', () => {
    const game = create(1);
    // Mutate state into a known configuration
    game.handleKeyDown(' ', fakeKeyEvent(' '));
    game.ballX = 123;
    game.ballY = 234;
    game.ballVX = 50;
    game.ballVY = -150;
    game.paddleX = 88;
    game.bricks[0].alive = false;
    game.bricks[1].hitsRemaining = 5;
    game.lives = 2;
    game.level = 3;

    const snap = game.serialize();
    game.destroy();

    const game2 = create(1);
    game2.deserialize(snap);
    expect(game2.ballX).toBe(123);
    expect(game2.ballY).toBe(234);
    expect(game2.ballVX).toBe(50);
    expect(game2.ballVY).toBe(-150);
    expect(game2.paddleX).toBe(88);
    expect(game2.lives).toBe(2);
    expect(game2.level).toBe(3);
    expect(game2.bricks[0].alive).toBe(false);
    expect(game2.bricks[1].hitsRemaining).toBe(5);
    game2.destroy();
  });

  it('canSave is true during play and false after game over', () => {
    const game = create(3); // 1 life
    expect(game.canSave()).toBe(true);
    // Knock out the only life
    game.ballOnPaddle = false;
    game.ballX = 100;
    game.ballY = 540 + 100;
    game.ballVY = 100;
    game.update(0.02);
    expect(game.canSave()).toBe(false);
    game.destroy();
  });

  it('deserialize tolerates missing/invalid fields without throwing', () => {
    const game = create();
    expect(() => game.deserialize({} as GameSnapshot)).not.toThrow();
    expect(() => game.deserialize({ bricks: 'not-an-array' } as unknown as GameSnapshot)).not.toThrow();
    expect(() => game.deserialize({ bricks: [null, { x: 'bad' }] } as unknown as GameSnapshot)).not.toThrow();
    // Game should still have valid state after garbage input
    expect(game.bricks.length).toBeGreaterThan(0);
    game.destroy();
  });
});

describe('Breakout – paddle bounce angle', () => {
  it('hitting the right edge of the paddle deflects ball rightward', () => {
    const game = create();
    game.ballOnPaddle = false;
    // Right edge of paddle
    game.ballX = game.paddleX + game.paddleW - 1;
    game.ballY = game.paddleY - game.ballRadius;
    game.ballVX = 0;
    game.ballVY = 200;
    game.update(0.02);
    expect(game.ballVX).toBeGreaterThan(0);
    expect(game.ballVY).toBeLessThan(0);
    game.destroy();
  });

  it('hitting the left edge of the paddle deflects ball leftward', () => {
    const game = create();
    game.ballOnPaddle = false;
    game.ballX = game.paddleX + 1;
    game.ballY = game.paddleY - game.ballRadius;
    game.ballVX = 0;
    game.ballVY = 200;
    game.update(0.02);
    expect(game.ballVX).toBeLessThan(0);
    expect(game.ballVY).toBeLessThan(0);
    game.destroy();
  });
});

describe('Breakout – pointer-follow (trackpad/mouse)', () => {
  it('mousemove on the canvas without a button press moves the paddle', () => {
    const game = create(0);
    const canvas = (game as unknown as { canvas: HTMLCanvasElement }).canvas;
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 360, height: 540, right: 360, bottom: 540, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    const startX = game.paddleX;
    // Move cursor to x=200 (logical x)
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 400, bubbles: true }));
    expect(game.paddleX).not.toBe(startX);
    // Paddle center should be near 200
    const center = game.paddleX + game.paddleW / 2;
    expect(Math.abs(center - 200)).toBeLessThan(5);
    game.destroy();
  });

  it('pointer-follow clamps the paddle to the left edge', () => {
    const game = create(0);
    const canvas = (game as unknown as { canvas: HTMLCanvasElement }).canvas;
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 360, height: 540, right: 360, bottom: 540, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: -500, clientY: 400, bubbles: true }));
    expect(game.paddleX).toBe(0);
    game.destroy();
  });

  it('pointer-follow clamps the paddle to the right edge', () => {
    const game = create(0);
    const canvas = (game as unknown as { canvas: HTMLCanvasElement }).canvas;
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 360, height: 540, right: 360, bottom: 540, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000, clientY: 400, bubbles: true }));
    // Paddle right edge should not exceed canvas width
    expect(game.paddleX + game.paddleW).toBeLessThanOrEqual(360);
    // And the paddle should be flush against the right edge
    expect(game.paddleX + game.paddleW).toBe(360);
    game.destroy();
  });

  it('destroy() removes the hover handler', () => {
    const game = create(0);
    const canvas = (game as unknown as { canvas: HTMLCanvasElement }).canvas;
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 360, height: 540, right: 360, bottom: 540, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    game.destroy();
    const xBefore = game.paddleX;
    // After destroy, mousemove should NOT move the paddle
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 400, bubbles: true }));
    expect(game.paddleX).toBe(xBefore);
  });

  it('hover does not move the paddle once gameActive is false', () => {
    const game = create(0);
    const canvas = (game as unknown as { canvas: HTMLCanvasElement }).canvas;
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 360, height: 540, right: 360, bottom: 540, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    // Simulate game-over
    (game as unknown as { gameActive: boolean }).gameActive = false;
    const xBefore = game.paddleX;
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 400, bubbles: true }));
    expect(game.paddleX).toBe(xBefore);
    game.destroy();
  });
});
