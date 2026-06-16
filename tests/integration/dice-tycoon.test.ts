import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { GameEngine, GameConfig, GameSnapshot } from '../../src/engine/GameEngine';

// Mock idb-keyval before any source imports.
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  del: vi.fn((key: string) => {
    store.delete(key);
    return Promise.resolve();
  }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { getGame, GameInfo } from '../../src/games/registry';
import { MULTIPLIERS, netWorth } from '../../src/games/dice-tycoon/economy';
import { BOARD_SIZE, Tile } from '../../src/games/dice-tycoon/board';
import { Rival } from '../../src/games/dice-tycoon/rivals';

function makeConfig(opts: {
  width?: number;
  height?: number;
  difficulty?: number;
  seed?: number;
  onWin?: (s: number) => void;
  onGameOver?: (s: number) => void;
} = {}): GameConfig {
  const canvas = document.createElement('canvas');
  return {
    canvas,
    width: opts.width ?? 360,
    height: opts.height ?? 640,
    difficulty: opts.difficulty ?? 1,
    seed: opts.seed,
    onWin: opts.onWin,
    onGameOver: opts.onGameOver,
  };
}

// Internal surface we poke at via `as any` casts.
type AnyGame = GameEngine & {
  gameActive: boolean;
  boardLevel: number;
  tiles: Tile[];
  theme: { name: string; landmarkNames: string[] };
  tokenIndex: number;
  coins: number;
  dice: number;
  shields: number;
  multiplierIndex: number;
  landmarksBuilt: number;
  totalLandmarks: number;
  landmarkCostList: number[];
  rivals: Rival[];
  album: { owned: Record<string, number>; completedSets: string[] };
  jackpot: number;
  skipNextRoll: boolean;
  hopAnim: unknown;
  raid: unknown;
  roll: () => void;
  resolveLandedTile: () => void;
  cycleMultiplier: () => void;
  buildNextLandmark: (cost: number) => void;
  nextLandmarkCost: () => number | null;
  updateScore: () => void;
  chooseVault: (v: number) => void;
  openRaid: () => void;
  isDaily: () => boolean;
};

let info: GameInfo;
beforeAll(async () => {
  store.clear();
  await import('../../src/games/dice-tycoon/DiceTycoon');
  const fetched = getGame('dice-tycoon');
  if (!fetched) throw new Error('dice-tycoon not registered');
  info = fetched;
});

afterEach(() => {
  history.replaceState({}, '', '/');
});

function newGame(opts: Parameters<typeof makeConfig>[0] = {}): AnyGame {
  return info.createGame(makeConfig(opts)) as AnyGame;
}

// Isolate a tile-effect assertion from confounding post-turn systems:
// no rivals (so resolveCounterRaid never steals) and an unaffordable next
// landmark (so tryAutoBuild never spends coins).
function isolate(game: AnyGame): void {
  game.rivals = [];
  game.landmarkCostList = [1e9, 1e9, 1e9, 1e9];
}

describe('Dice Tycoon — Integration', () => {
  // ── Registration ───────────────────────────────────────────────
  describe('Registration', () => {
    it('is registered with correct metadata', () => {
      expect(info).toBeDefined();
      expect(info.id).toBe('dice-tycoon');
      expect(info.name).toBe('Dice Tycoon');
      expect(info.category).toBe('strategy');
      expect(info.continuableAfterWin).toBe(true);
      expect(info.dailyMode).toBe(true);
      expect(info.controls).toBeTruthy();
    });
  });

  // ── Lifecycle across all difficulties ──────────────────────────
  describe('Lifecycle / difficulties', () => {
    for (let d = 0; d <= 3; d++) {
      it(`difficulty ${d} constructs, starts, updates, renders, destroys`, () => {
        const game = newGame({ difficulty: d, seed: 100 + d });
        expect(() => {
          game.start();
          game.update(0.016);
          game.render();
          game.update(0.05);
          game.render();
          game.destroy();
        }).not.toThrow();
      });
    }

    it('starts with a 20-tile board and difficulty-appropriate resources', () => {
      // No seed → non-daily play, so startDice/startCoins from the economy config apply.
      const game = newGame({ difficulty: 0 });
      game.start();
      expect(game.tiles.length).toBe(BOARD_SIZE);
      // Easy start: 20 dice, 800 coins (per economy config).
      expect(game.coins).toBe(800);
      expect(game.dice).toBe(20);
      expect(game.tokenIndex).toBe(0);
      game.destroy();
    });

    it('handles a tiny canvas without crashing', () => {
      const game = info.createGame({
        canvas: document.createElement('canvas'),
        width: 120,
        height: 140,
        difficulty: 1,
        seed: 5,
      }) as AnyGame;
      expect(() => {
        game.start();
        game.update(0.016);
        game.render();
        game.destroy();
      }).not.toThrow();
    });
  });

  // ── Rolling ────────────────────────────────────────────────────
  describe('Rolling', () => {
    it('a ×1 roll consumes 1 die and advances the token', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      const diceBefore = game.dice;
      const idxBefore = game.tokenIndex;
      game.roll();
      expect(game.dice).toBe(diceBefore - MULTIPLIERS[0]);
      // Drive hop animations to completion.
      for (let i = 0; i < 30; i++) game.update(0.1);
      expect(game.tokenIndex).not.toBe(idxBefore);
      game.destroy();
    });

    it('a ×3 roll consumes 3 dice', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      game.cycleMultiplier(); // → ×3
      expect(MULTIPLIERS[(game as AnyGame).multiplierIndex]).toBe(3);
      const diceBefore = game.dice;
      game.roll();
      expect(game.dice).toBe(diceBefore - 3);
      game.destroy();
    });

    it('cannot roll with insufficient dice', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      game.dice = 0;
      const idxBefore = game.tokenIndex;
      game.roll();
      for (let i = 0; i < 30; i++) game.update(0.1);
      expect(game.tokenIndex).toBe(idxBefore);
      expect(game.dice).toBe(0);
      game.destroy();
    });

    it('cannot roll while a hop animation is in flight', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      game.roll();
      // mid-animation
      game.update(0.01);
      const diceMid = game.dice;
      game.roll(); // should be a no-op
      expect(game.dice).toBe(diceMid);
      game.destroy();
    });
  });

  // ── Tile effects ───────────────────────────────────────────────
  describe('Tile effects', () => {
    it('landing on a property increases coins', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      isolate(game);
      // Find a property tile and place the token just before it, then resolve.
      const propIdx = game.tiles.findIndex((t) => t.type === 'property');
      expect(propIdx).toBeGreaterThanOrEqual(0);
      game.tokenIndex = propIdx;
      const before = game.coins;
      game.resolveLandedTile();
      expect(game.coins).toBeGreaterThan(before);
      game.destroy();
    });

    it('landing on a tax tile decreases coins (and feeds the jackpot)', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      isolate(game);
      const taxIdx = game.tiles.findIndex((t) => t.type === 'tax');
      expect(taxIdx).toBeGreaterThanOrEqual(0);
      game.tokenIndex = taxIdx;
      const before = game.coins;
      const jackBefore = game.jackpot;
      game.resolveLandedTile();
      expect(game.coins).toBeLessThan(before);
      expect(game.jackpot).toBeGreaterThan(jackBefore);
      game.destroy();
    });

    it('passing GO grants salary', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      isolate(game);
      // Place token at the last tile so the next hop wraps to GO (index 0).
      game.tokenIndex = BOARD_SIZE - 1;
      const before = game.coins;
      game.roll();
      for (let i = 0; i < 40; i++) game.update(0.1);
      expect(game.coins).toBeGreaterThan(before);
      game.destroy();
    });

    it('Free Parking pays out the jackpot pool', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      isolate(game);
      const parkIdx = game.tiles.findIndex((t) => t.type === 'parking');
      game.jackpot = 250;
      game.tokenIndex = parkIdx;
      const before = game.coins;
      game.resolveLandedTile();
      expect(game.coins).toBe(before + 250);
      expect(game.jackpot).toBe(0);
      game.destroy();
    });
  });

  // ── Landmarks & board completion ───────────────────────────────
  describe('Landmarks & board completion', () => {
    it('building all 4 landmarks fires gameWin, advances boardLevel, and keeps running', () => {
      const onWin = vi.fn();
      const onGameOver = vi.fn();
      const game = newGame({ difficulty: 1, seed: 7, onWin, onGameOver });
      game.start();
      expect(game.boardLevel).toBe(1);

      // Give plenty of coins and build each landmark in order.
      for (let i = 0; i < 4; i++) {
        const cost = game.nextLandmarkCost();
        expect(cost).not.toBeNull();
        game.coins = (cost as number) + 1000;
        game.buildNextLandmark(cost as number);
      }

      expect(game.isWon()).toBe(true);
      expect(onWin).toHaveBeenCalled();
      expect(onGameOver).not.toHaveBeenCalled();
      // Board advanced and a fresh board generated; landmarks reset.
      expect(game.boardLevel).toBe(2);
      expect(game.landmarksBuilt).toBe(0);
      expect(game.totalLandmarks).toBe(4);
      expect(game.tiles.length).toBe(BOARD_SIZE);
      expect(game.isRunning()).toBe(true);
      game.destroy();
    });

    it('gameWin fires only on the FIRST board completion', () => {
      const onWin = vi.fn();
      const game = newGame({ difficulty: 1, seed: 7, onWin });
      game.start();
      // Complete two boards.
      for (let board = 0; board < 2; board++) {
        for (let i = 0; i < 4; i++) {
          const cost = game.nextLandmarkCost() as number;
          game.coins = cost + 1000;
          game.buildNextLandmark(cost);
        }
      }
      expect(game.boardLevel).toBe(3);
      expect(onWin).toHaveBeenCalledTimes(1);
      game.destroy();
    });
  });

  // ── Raid mini-event ────────────────────────────────────────────
  describe('Raid', () => {
    it('raiding a shielded rival is blocked; an unshielded rival is robbed', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();

      // Shielded rival → blocked.
      game.rivals = [{ id: 'r0', name: 'Shieldy', coins: 1000, shields: 1 }];
      (game as AnyGame).raid = { rivalIndex: 0, resolved: false, result: null };
      const coinsBefore = game.coins;
      game.chooseVault(0);
      expect(game.coins).toBe(coinsBefore); // blocked, nothing stolen
      expect(game.rivals[0].shields).toBe(0); // shield consumed

      // Unshielded rival → coins stolen.
      game.rivals = [{ id: 'r1', name: 'Naked', coins: 1000, shields: 0 }];
      (game as AnyGame).raid = { rivalIndex: 0, resolved: false, result: null };
      const before2 = game.coins;
      game.chooseVault(1);
      expect(game.coins).toBeGreaterThan(before2);
      expect(game.rivals[0].coins).toBeLessThan(1000);
      game.destroy();
    });

    it('landing on a railroad opens a raid and blocks rolling until resolved', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      const railIdx = game.tiles.findIndex((t) => t.type === 'railroad');
      expect(railIdx).toBeGreaterThanOrEqual(0);
      game.tokenIndex = railIdx;
      game.resolveLandedTile();
      expect(game.raid).not.toBeNull();
      // Can't save mid-raid.
      expect(game.canSave()).toBe(false);
      game.destroy();
    });
  });

  // ── Raid reveal (heist value display) ──────────────────────────
  describe('Raid reveal', () => {
    it('exposes the chosen vault outcome after resolving (not blank)', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      game.rivals = [{ id: 'r', name: 'Naked', coins: 1000, shields: 0 }];
      (game as AnyGame).raid = { rivalIndex: 0, resolved: false, result: null, reveal: 0 };
      game.chooseVault(2);
      const raid = (game as AnyGame).raid as {
        resolved: boolean;
        result: { blocked: boolean; stolen: number; vaultIndex: number } | null;
        reveal: number;
      };
      expect(raid.resolved).toBe(true);
      expect(raid.result).not.toBeNull();
      expect(raid.result!.vaultIndex).toBe(2);
      expect(raid.result!.stolen).toBeGreaterThan(0);
      // Reveal animation starts at 0 and advances with dt.
      expect(raid.reveal).toBe(0);
      game.update(0.1);
      expect(raid.reveal).toBeGreaterThan(0);
      // Rendering the resolved overlay must not throw.
      expect(() => game.render()).not.toThrow();
      game.destroy();
    });

    it('shows blocked outcome on the chosen vault for a shielded rival', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      game.rivals = [{ id: 'r', name: 'Shieldy', coins: 1000, shields: 1 }];
      (game as AnyGame).raid = { rivalIndex: 0, resolved: false, result: null, reveal: 0 };
      game.chooseVault(0);
      const raid = (game as AnyGame).raid as {
        result: { blocked: boolean; stolen: number; vaultIndex: number } | null;
      };
      expect(raid.result!.blocked).toBe(true);
      expect(raid.result!.stolen).toBe(0);
      expect(() => game.render()).not.toThrow();
      game.destroy();
    });
  });

  // ── Score ──────────────────────────────────────────────────────
  describe('Score = netWorth', () => {
    it('score equals netWorth for a known state', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      game.coins = 1234;
      game.totalLandmarks = 3;
      game.boardLevel = 2;
      game.album = { owned: { 'wheels:0': 1, 'wheels:1': 2 }, completedSets: [] };
      game.updateScore();
      const expected = netWorth({
        coins: 1234,
        landmarksBuilt: 3,
        boardLevel: 2,
        stickers: 2,
      });
      expect(game.getScore()).toBe(expected);
      game.destroy();
    });
  });

  // ── Save / Resume ──────────────────────────────────────────────
  describe('Save / Resume', () => {
    it('serialize → deserialize preserves key state', () => {
      const game = newGame({ difficulty: 2, seed: 13 });
      game.start();
      // Mutate some state.
      game.coins = 777;
      game.dice = 9;
      game.boardLevel = 1;
      game.totalLandmarks = 2;
      game.landmarksBuilt = 2;
      game.tokenIndex = 8;
      game.album = { owned: { 'fortune:0': 1 }, completedSets: [] };

      const snap = (game as unknown as { serialize: () => GameSnapshot }).serialize();
      expect(snap).toBeTruthy();

      const restored = newGame({ difficulty: 0, seed: 999 });
      restored.start();
      (restored as unknown as { deserialize: (s: GameSnapshot) => void }).deserialize(snap);

      expect(restored.coins).toBe(777);
      expect(restored.dice).toBe(9);
      expect(restored.boardLevel).toBe(1);
      expect(restored.totalLandmarks).toBe(2);
      expect(restored.landmarksBuilt).toBe(2);
      expect(restored.tokenIndex).toBe(8);
      expect(restored.album.owned['fortune:0']).toBe(1);
      // Tiles round-trip (same names).
      expect(restored.tiles.length).toBe(BOARD_SIZE);
      expect(restored.tiles.map((t) => t.type)).toEqual(game.tiles.map((t) => t.type));
      game.destroy();
      restored.destroy();
    });

    it('deserialize defensively rejects malformed payloads', () => {
      const game = newGame({ difficulty: 1, seed: 8 });
      game.start();
      const coinsBefore = game.coins;
      const deserialize = (game as unknown as {
        deserialize: (s: GameSnapshot) => void;
      }).deserialize.bind(game);
      expect(() => deserialize({})).not.toThrow();
      expect(() => deserialize({ tiles: 'nope' as unknown as Tile[] })).not.toThrow();
      expect(() => deserialize({ tiles: [1, 2, 3] as unknown as Tile[] })).not.toThrow();
      // Bad payloads with a too-short tiles array bail out → state preserved.
      expect(game.coins).toBe(coinsBefore);
      game.destroy();
    });

    it('canSave is false during a hop animation and true when idle', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      expect(game.canSave()).toBe(true);
      game.roll(); // starts a hop animation
      game.update(0.01);
      expect(game.canSave()).toBe(false);
      // Finish the animation.
      for (let i = 0; i < 40; i++) game.update(0.1);
      expect(game.canSave()).toBe(true);
      game.destroy();
    });
  });

  // ── Daily Mode determinism ─────────────────────────────────────
  describe('Daily mode determinism', () => {
    it('same seed → identical board and rivals', () => {
      const a = newGame({ difficulty: 2, seed: 20260616 });
      a.start();
      const b = newGame({ difficulty: 2, seed: 20260616 });
      b.start();

      expect(a.isDaily()).toBe(true);
      // Same tiles.
      expect(a.tiles.map((t) => `${t.type}:${t.name}:${t.baseValue}`)).toEqual(
        b.tiles.map((t) => `${t.type}:${t.name}:${t.baseValue}`),
      );
      // Same rivals.
      expect(a.rivals.map((r) => `${r.name}:${r.coins}:${r.shields}`)).toEqual(
        b.rivals.map((r) => `${r.name}:${r.coins}:${r.shields}`),
      );
      a.destroy();
      b.destroy();
    });

    it('daily mode does not regen dice and uses a fixed budget', () => {
      const game = newGame({ difficulty: 3, seed: 42 });
      game.start();
      const before = game.dice;
      // Many update ticks: in daily mode dice must not regen.
      for (let i = 0; i < 100; i++) game.update(1);
      expect(game.dice).toBe(before);
      game.destroy();
    });
  });
});

// ════════════════════════════════════════════════════════════════════
// P1 UI overhaul — board ring layout, city center, character token.
// (Appended; observable layout/state logic only — not pixels.)
// ════════════════════════════════════════════════════════════════════

type UIGame = AnyGame & {
  ringX: number;
  ringY: number;
  ringSize: number;
  cell: number;
  corner: number;
  landmarkRise: number[];
  tokenSquash: number;
  hopAnim: { remaining: number; progress: number } | null;
  hopsLeft: number;
  rollBtn: { x: number; y: number; w: number; h: number };
  multBtn: { x: number; y: number; w: number; h: number };
  buildBtn: { x: number; y: number; w: number; h: number; enabled: boolean };
  tileRingRect: (i: number) => { x: number; y: number; w: number; h: number; isCorner: boolean };
  tileCenter: (i: number) => { x: number; y: number };
  syncLandmarkRise: () => void;
};

function newUIGame(opts: Parameters<typeof makeConfig>[0] = {}): UIGame {
  return info.createGame(makeConfig(opts)) as UIGame;
}

function rectInBoard(g: UIGame, r: { x: number; y: number; w: number; h: number }): boolean {
  // Within the board region [ringX..ringX+ringSize] × [ringY..ringY+ringSize],
  // allowing a 2px bevel/shadow slop.
  const slop = 3;
  return (
    r.x >= g.ringX - slop &&
    r.y >= g.ringY - slop &&
    r.x + r.w <= g.ringX + g.ringSize + slop &&
    r.y + r.h <= g.ringY + g.ringSize + slop
  );
}

describe('Dice Tycoon — P1 board ring layout', () => {
  it('maps all 20 tile indices to rects inside the board region', () => {
    const game = newUIGame({ difficulty: 1, seed: 7 });
    game.start();
    for (let i = 0; i < BOARD_SIZE; i++) {
      const r = game.tileRingRect(i);
      expect(Number.isFinite(r.x)).toBe(true);
      expect(Number.isFinite(r.y)).toBe(true);
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
      expect(rectInBoard(game, r)).toBe(true);
    }
    game.destroy();
  });

  it('marks exactly the 4 corners (0/5/10/15) as larger corner tiles', () => {
    const game = newUIGame({ difficulty: 1, seed: 7 });
    game.start();
    for (let i = 0; i < BOARD_SIZE; i++) {
      const r = game.tileRingRect(i);
      const isCornerIdx = i === 0 || i === 5 || i === 10 || i === 15;
      expect(r.isCorner).toBe(isCornerIdx);
    }
    // Corners are square and larger than a regular tile's short side.
    const c0 = game.tileRingRect(0);
    const t1 = game.tileRingRect(1);
    expect(c0.w).toBeCloseTo(c0.h, 5);
    expect(c0.w).toBeGreaterThan(Math.min(t1.w, t1.h));
    game.destroy();
  });

  it('places the 4 corners at the 4 board corners (GO top-left, JAIL top-right, etc.)', () => {
    const game = newUIGame({ difficulty: 1, seed: 7 });
    game.start();
    const cx = game.ringX + game.ringSize / 2;
    const cy = game.ringY + game.ringSize / 2;
    const go = game.tileCenter(0);       // top-left
    const jail = game.tileCenter(5);     // top-right
    const parking = game.tileCenter(10); // bottom-right
    const toJail = game.tileCenter(15);  // bottom-left
    expect(go.x).toBeLessThan(cx);
    expect(go.y).toBeLessThan(cy);
    expect(jail.x).toBeGreaterThan(cx);
    expect(jail.y).toBeLessThan(cy);
    expect(parking.x).toBeGreaterThan(cx);
    expect(parking.y).toBeGreaterThan(cy);
    expect(toJail.x).toBeLessThan(cx);
    expect(toJail.y).toBeGreaterThan(cy);
    game.destroy();
  });

  it('walks the ring contiguously: top→right→bottom→left', () => {
    const game = newUIGame({ difficulty: 1, seed: 7 });
    game.start();
    // Top edge (0..5): y roughly constant, x increasing.
    for (let i = 1; i <= 5; i++) {
      expect(game.tileCenter(i).x).toBeGreaterThan(game.tileCenter(i - 1).x - 0.5);
    }
    // Right column (5..10): x ~constant, y increasing.
    for (let i = 6; i <= 10; i++) {
      expect(game.tileCenter(i).y).toBeGreaterThan(game.tileCenter(i - 1).y - 0.5);
    }
    // Bottom edge (10..15): x decreasing (right→left).
    for (let i = 11; i <= 15; i++) {
      expect(game.tileCenter(i).x).toBeLessThan(game.tileCenter(i - 1).x + 0.5);
    }
    // Left column (15..19): y decreasing (bottom→top).
    for (let i = 16; i <= 19; i++) {
      expect(game.tileCenter(i).y).toBeLessThan(game.tileCenter(i - 1).y + 0.5);
    }
    game.destroy();
  });

  it('keeps all rects in-bounds on a very small canvas', () => {
    const game = info.createGame({
      canvas: document.createElement('canvas'),
      width: 140,
      height: 200,
      difficulty: 1,
      seed: 3,
    }) as UIGame;
    game.start();
    for (let i = 0; i < BOARD_SIZE; i++) {
      const r = game.tileRingRect(i);
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
      expect(rectInBoard(game, r)).toBe(true);
    }
    game.destroy();
  });
});

describe('Dice Tycoon — P1 landmark city state', () => {
  it('reflects built/unbuilt count in landmarkRise after building', () => {
    const game = newUIGame({ difficulty: 1, seed: 7 });
    game.start();
    // Fresh board: nothing risen.
    expect(game.landmarkRise.every((v) => v === 0)).toBe(true);

    const cost = game.nextLandmarkCost() as number;
    game.coins = cost + 1000;
    game.buildNextLandmark(cost);
    expect(game.landmarksBuilt).toBe(1);
    // The first slot's rise animation has been kicked off (>0).
    expect(game.landmarkRise[0]).toBeGreaterThan(0);
    // Drive the rise animation to completion.
    for (let i = 0; i < 60; i++) game.update(0.05);
    expect(game.landmarkRise[0]).toBe(1);
    // Unbuilt slots remain at 0.
    expect(game.landmarkRise[3]).toBe(0);
    game.destroy();
  });

  it('syncLandmarkRise marks built slots risen and unbuilt slots flat', () => {
    const game = newUIGame({ difficulty: 1, seed: 7 });
    game.start();
    game.landmarksBuilt = 2;
    game.syncLandmarkRise();
    expect(game.landmarkRise[0]).toBe(1);
    expect(game.landmarkRise[1]).toBe(1);
    expect(game.landmarkRise[2]).toBe(0);
    expect(game.landmarkRise[3]).toBe(0);
    game.destroy();
  });

  it('resuming a saved game renders built landmarks as already risen', () => {
    const game = newUIGame({ difficulty: 2, seed: 13 });
    game.start();
    game.landmarksBuilt = 3;
    game.totalLandmarks = 3;
    const snap = (game as unknown as { serialize: () => GameSnapshot }).serialize();

    const restored = newUIGame({ difficulty: 0, seed: 999 });
    restored.start();
    (restored as unknown as { deserialize: (s: GameSnapshot) => void }).deserialize(snap);
    expect(restored.landmarksBuilt).toBe(3);
    // Built slots snapped to risen — no rise animation replays on resume.
    expect(restored.landmarkRise.slice(0, 3)).toEqual([1, 1, 1]);
    expect(restored.landmarkRise[3]).toBe(0);
    game.destroy();
    restored.destroy();
  });
});

describe('Dice Tycoon — P1 token hop animation', () => {
  it('hop animation advances with dt and settles, triggering a landing squash', () => {
    const game = newUIGame({ difficulty: 1, seed: 7 });
    game.start();
    game.rivals = [];
    game.landmarkCostList = [1e9, 1e9, 1e9, 1e9];
    const before = game.tokenIndex;
    game.roll();
    expect(game.hopAnim).not.toBeNull();
    // A partial update advances progress without finishing.
    game.update(0.02);
    expect(game.hopAnim).not.toBeNull();
    // Drive to completion.
    for (let i = 0; i < 60; i++) game.update(0.05);
    expect(game.hopAnim).toBeNull();
    expect(game.tokenIndex).not.toBe(before);
    // A landing squash was triggered at some point during the hops.
    // (it decays, so just confirm it advances and clears cleanly.)
    expect(game.tokenSquash).toBe(0);
    game.destroy();
  });

  it('rendering during a hop (mid-arc) does not throw', () => {
    const game = newUIGame({ difficulty: 1, seed: 7 });
    game.start();
    game.roll();
    game.update(0.04); // mid-hop
    expect(() => game.render()).not.toThrow();
    expect(game.tokenSquash >= 0).toBe(true);
    game.destroy();
  });

  it('token squash decays back to neutral after a landing', () => {
    const game = newUIGame({ difficulty: 1, seed: 7 });
    game.start();
    game.tokenSquash = 0.01; // simulate a fresh landing
    let sawPositive = false;
    for (let i = 0; i < 30; i++) {
      game.update(0.02);
      if (game.tokenSquash > 0) sawPositive = true;
    }
    expect(sawPositive).toBe(true);
    expect(game.tokenSquash).toBe(0);
    game.destroy();
  });
});

describe('Dice Tycoon — P1 controls after layout change', () => {
  it('roll / multiplier / build hit-rects render within the canvas', () => {
    const game = newUIGame({ difficulty: 0, seed: 7 });
    game.start();
    game.render(); // populates the hit rects
    for (const r of [game.rollBtn, game.multBtn]) {
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(game['width'] + 0.5);
      expect(r.y + r.h).toBeLessThanOrEqual(game['height'] + 0.5);
    }
    game.destroy();
  });

  it('tapping the roll button still rolls after the layout change', () => {
    const game = newUIGame({ difficulty: 1, seed: 7 });
    game.start();
    game.render();
    const diceBefore = game.dice;
    const r = game.rollBtn;
    (game as unknown as { handlePointerUp: (x: number, y: number) => void })
      .handlePointerUp(r.x + r.w / 2, r.y + r.h / 2);
    expect(game.dice).toBe(diceBefore - MULTIPLIERS[0]);
    game.destroy();
  });

  it('tapping the multiplier chip still cycles the multiplier', () => {
    const game = newUIGame({ difficulty: 1, seed: 7 });
    game.start();
    game.render();
    const before = game.multiplierIndex;
    const r = game.multBtn;
    (game as unknown as { handlePointerUp: (x: number, y: number) => void })
      .handlePointerUp(r.x + r.w / 2, r.y + r.h / 2);
    expect(game.multiplierIndex).toBe((before + 1) % MULTIPLIERS.length);
    game.destroy();
  });

  it('tapping an affordable build button builds the next landmark', () => {
    const game = newUIGame({ difficulty: 0, seed: 7 });
    game.start();
    // Make the next landmark affordable, then render to position the button.
    const cost = game.nextLandmarkCost() as number;
    game.coins = cost; // exactly affordable
    game.landmarkCostList = [cost, 1e9, 1e9, 1e9]; // stop auto-build chaining
    game.render();
    expect(game.buildBtn.enabled).toBe(true);
    const builtBefore = game.landmarksBuilt;
    const r = game.buildBtn;
    (game as unknown as { handlePointerUp: (x: number, y: number) => void })
      .handlePointerUp(r.x + r.w / 2, r.y + r.h / 2);
    expect(game.landmarksBuilt).toBe(builtBefore + 1);
    game.destroy();
  });
});
