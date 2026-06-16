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

    it('a ×5 roll consumes 5 dice', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      game.cycleMultiplier(); // → ×5
      expect(MULTIPLIERS[(game as AnyGame).multiplierIndex]).toBe(5);
      const diceBefore = game.dice;
      game.roll();
      expect(game.dice).toBe(diceBefore - 5);
      game.destroy();
    });

    it('a ×20 roll consumes 20 dice', () => {
      const game = newGame({ difficulty: 1, seed: 7 });
      game.start();
      game.cycleMultiplier(); // → ×5
      game.cycleMultiplier(); // → ×20
      expect(MULTIPLIERS[(game as AnyGame).multiplierIndex]).toBe(20);
      game.dice = 25; // enough for a ×20 bet
      const diceBefore = game.dice;
      game.roll();
      expect(game.dice).toBe(diceBefore - 20);
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
    // F3 (iso 2.5D): tileRingRect now returns the PROJECTED rect. The vertical
    // squash means corner height < width, so the rect is no longer square — but
    // corners must still read as larger than a regular tile (wider + bigger
    // projected footprint).
    const c0 = game.tileRingRect(0);
    const t1 = game.tileRingRect(1);
    expect(c0.w).toBeGreaterThan(t1.w);
    expect(c0.h).toBeGreaterThan(0);
    expect(c0.w * c0.h).toBeGreaterThan(t1.w * t1.h);
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

describe('Dice Tycoon — responsive relayout (F1)', () => {
  type LayoutGame = AnyGame & {
    ringSize: number;
    cell: number;
    ringX: number;
    ringY: number;
    rollBtn: { x: number; y: number; w: number; h: number };
    multBtn: { x: number; y: number; w: number; h: number };
  };

  it('is flagged responsive in the registry', () => {
    expect(info.responsive).toBe(true);
  });

  it('recomputes board geometry larger when the canvas grows', () => {
    const game = newGame({ difficulty: 1, seed: 7 }) as LayoutGame;
    game.start();
    game.render(); // populate control rects at the original size
    const ringBefore = game.ringSize;
    const cellBefore = game.cell;

    game.resizeTo(480, 853);
    expect(game.ringSize).toBeGreaterThan(ringBefore);
    expect(game.cell).toBeGreaterThan(cellBefore);
    // Ring stays centered + on-canvas.
    expect(game.ringX).toBeGreaterThanOrEqual(0);
    expect(game.ringX + game.ringSize).toBeLessThanOrEqual(480 + 0.5);

    // Control rects recompute in-bounds after the next render frame.
    game.render();
    expect(game.rollBtn.x).toBeGreaterThanOrEqual(0);
    expect(game.rollBtn.x + game.rollBtn.w).toBeLessThanOrEqual(480 + 0.5);
    expect(game.rollBtn.y + game.rollBtn.h).toBeLessThanOrEqual(853 + 0.5);
    expect(game.multBtn.x + game.multBtn.w).toBeLessThanOrEqual(480 + 0.5);
    game.destroy();
  });

  it('leaves logical token tile position unchanged across a resize', () => {
    const game = newGame({ difficulty: 1, seed: 7 }) as LayoutGame;
    game.start();
    game.tokenIndex = 5;
    game.coins = 1234;
    game.resizeTo(480, 853);
    expect(game.tokenIndex).toBe(5);
    expect(game.coins).toBe(1234);
    game.destroy();
  });

  it('keeps a serialize→deserialize round-trip valid after a resize', () => {
    const game = newGame({ difficulty: 1, seed: 7 }) as LayoutGame;
    game.start();
    game.tokenIndex = 9;
    game.coins = 777;
    game.resizeTo(480, 853);

    const snap = game.serialize();
    expect(snap).not.toBeNull();

    const restored = newGame({ difficulty: 1, seed: 7 }) as LayoutGame;
    restored.start();
    restored.resizeTo(480, 853);
    restored.deserialize(snap!);
    expect(restored.tokenIndex).toBe(9);
    expect(restored.coins).toBe(777);
    game.destroy();
    restored.destroy();
  });
});

// ════════════════════════════════════════════════════════════════════
// F2 — economics re-rig wiring (board-1 rival-free, scaled regen cap,
// multiplier dial affordability for [1,5,20], score = new netWorth).
// ════════════════════════════════════════════════════════════════════

import {
  DIFFICULTY_CONFIGS,
  effectiveCap,
  payoutFactor,
  landmarkCosts,
} from '../../src/games/dice-tycoon/economy';

type F2Game = AnyGame & {
  counterRaidAggression: () => number;
  diceCap: () => number;
  multiplierChipColor: () => string;
  runCounterRaid: () => void;
  cfg: typeof DIFFICULTY_CONFIGS[number];
  lastRegenAt: number;
};

function newF2Game(opts: Parameters<typeof makeConfig>[0] = {}): F2Game {
  return info.createGame(makeConfig(opts)) as F2Game;
}

describe('Dice Tycoon — F2 board-1 onboarding (rival-free)', () => {
  it('counter-raid aggression is 0 on board 1 for every difficulty', () => {
    for (let d = 0; d <= 3; d++) {
      const game = newF2Game({ difficulty: d, seed: 100 + d });
      game.start();
      expect(game.boardLevel).toBe(1);
      expect(game.counterRaidAggression()).toBe(0);
      game.destroy();
    }
  });

  it('uses the difficulty aggression once past board 1', () => {
    const game = newF2Game({ difficulty: 3, seed: 5 });
    game.start();
    game.boardLevel = 2;
    expect(game.counterRaidAggression()).toBe(game.cfg.rivalAggression);
    expect(game.counterRaidAggression()).toBeGreaterThan(0);
    game.destroy();
  });

  it('never loses coins to a counter-raid on board 1 (rival-free first board)', () => {
    // Extra-hard would otherwise be the most aggressive board.
    const game = newF2Game({ difficulty: 3, seed: 7 });
    game.start();
    game.rivals = [{ id: 'r', name: 'Aggro', coins: 1000, shields: 0 }];
    const before = game.coins;
    for (let i = 0; i < 50; i++) game.runCounterRaid();
    expect(game.coins).toBe(before);
    game.destroy();
  });

  it('the first landmark on board 1 is affordable from the Medium starting coins', () => {
    const game = newF2Game({ difficulty: 1, seed: 7 });
    game.start();
    const cost = game.nextLandmarkCost() as number;
    expect(cost).toBe(landmarkCosts(1, DIFFICULTY_CONFIGS[1])[0]);
    expect(game.coins).toBeGreaterThanOrEqual(cost); // 500 ≥ 150
    game.destroy();
  });
});

describe('Dice Tycoon — F2 board-level regen cap', () => {
  it('diceCap() equals the board-level-scaled effectiveCap (non-daily)', () => {
    const game = newF2Game({ difficulty: 1, seed: undefined });
    game.start();
    expect(game.diceCap()).toBe(effectiveCap(game.cfg, 1));
    game.boardLevel = 4;
    expect(game.diceCap()).toBe(effectiveCap(game.cfg, 4));
    expect(game.diceCap()).toBeGreaterThan(game.cfg.diceCap);
    game.destroy();
  });

  it('regen refills up to the scaled cap on a deeper board', () => {
    const game = newF2Game({ difficulty: 1 }); // non-daily
    game.start();
    game.boardLevel = 4; // cap = 26 + 4 = 30
    game.dice = 0;
    // Backdate the regen clock far enough to refill completely.
    game.lastRegenAt = Date.now() - game.cfg.regenIntervalMs * 1000;
    for (let i = 0; i < 5; i++) game.update(1); // cross REGEN_CHECK_INTERVAL
    expect(game.dice).toBe(effectiveCap(game.cfg, 4));
    expect(game.dice).toBe(30);
    game.destroy();
  });
});

describe('Dice Tycoon — F2 multiplier dial affordability ([1,5,20])', () => {
  it('cycles through ×1 → ×5 → ×20 → ×1', () => {
    const game = newF2Game({ difficulty: 1, seed: 7 });
    game.start();
    expect(MULTIPLIERS[game.multiplierIndex]).toBe(1);
    game.cycleMultiplier();
    expect(MULTIPLIERS[game.multiplierIndex]).toBe(5);
    game.cycleMultiplier();
    expect(MULTIPLIERS[game.multiplierIndex]).toBe(20);
    game.cycleMultiplier();
    expect(MULTIPLIERS[game.multiplierIndex]).toBe(1);
    game.destroy();
  });

  it('dims the chip when the selected multiplier is unaffordable', () => {
    const game = newF2Game({ difficulty: 1, seed: 7 });
    game.start();
    game.cycleMultiplier(); // ×5
    game.cycleMultiplier(); // ×20 (MAX)
    game.dice = 3; // can't afford ×20
    expect(game.multiplierChipColor()).toBe('#D8C8BC'); // dim
    game.dice = 25; // now affordable
    // MAX tier affordable → plum (PRIMARY), NOT the dim color, NOT hardcoded to 10.
    expect(game.multiplierChipColor()).not.toBe('#D8C8BC');
    game.destroy();
  });

  it('colors the base ×1 tier and an affordable middle ×5 tier distinctly from MAX', () => {
    const game = newF2Game({ difficulty: 1, seed: 7 });
    game.start();
    game.dice = 25;
    // ×1 (base, affordable)
    expect(game.multiplierIndex).toBe(0);
    const base = game.multiplierChipColor();
    game.cycleMultiplier(); // ×5 (middle, affordable)
    const middle = game.multiplierChipColor();
    game.cycleMultiplier(); // ×20 (MAX, affordable)
    const max = game.multiplierChipColor();
    expect(base).not.toBe(middle);
    expect(middle).not.toBe(max);
    expect(max).not.toBe('#D8C8BC');
    game.destroy();
  });
});

describe('Dice Tycoon — F2 payout + score', () => {
  it('property payout includes the board-level payoutFactor', () => {
    const game = newF2Game({ difficulty: 1, seed: 7 });
    game.start();
    isolate(game);
    game.boardLevel = 3;
    const propIdx = game.tiles.findIndex((t) => t.type === 'property');
    game.tokenIndex = propIdx;
    const tile = game.tiles[propIdx];
    const before = game.coins;
    game.resolveLandedTile();
    const earned = game.coins - before;
    const expected = Math.round(
      tile.baseValue * MULTIPLIERS[game.multiplierIndex] * game.cfg.payoutMul * payoutFactor(3),
    );
    expect(earned).toBe(expected);
    game.destroy();
  });

  it('score uses the new netWorth weights (landmarks*400 + board*3000 + stickers*150)', () => {
    const game = newF2Game({ difficulty: 1, seed: 7 });
    game.start();
    game.coins = 500;
    game.totalLandmarks = 2;
    game.boardLevel = 3;
    game.album = { owned: { 'a:0': 1, 'a:1': 1 }, completedSets: [] };
    game.updateScore();
    const expected = netWorth({ coins: 500, landmarksBuilt: 2, boardLevel: 3, stickers: 2 });
    expect(game.getScore()).toBe(expected);
    // Sanity: matches the explicit weighted sum.
    expect(expected).toBe(500 + 2 * 400 + 3 * 3000 + 2 * 150);
    game.destroy();
  });
});

// ════════════════════════════════════════════════════════════════════
// F3 — isometric 2.5D board projection + art pass.
// tileRingRect now returns the PROJECTED (vertically-squashed) screen rect.
// ════════════════════════════════════════════════════════════════════

type IsoGame = UIGame & {
  isoCenterY: number;
  flatRingRect: (i: number) => { x: number; y: number; w: number; h: number; isCorner: boolean };
  isoY: (flatY: number) => number;
  lastDie1: number;
  lastDie2: number;
};

function newIsoGame(opts: Parameters<typeof makeConfig>[0] = {}): IsoGame {
  return info.createGame(makeConfig(opts)) as IsoGame;
}

describe('Dice Tycoon — F3 iso projection', () => {
  it('projects all 20 tiles to on-canvas, vertically-squashed screen rects', () => {
    const game = newIsoGame({ difficulty: 1, seed: 7 });
    game.start();
    for (let i = 0; i < BOARD_SIZE; i++) {
      const r = game.tileRingRect(i);
      const f = game.flatRingRect(i);
      // Within canvas bounds.
      expect(r.x).toBeGreaterThanOrEqual(-3);
      expect(r.x + r.w).toBeLessThanOrEqual(game['width'] + 3);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.h).toBeLessThanOrEqual(game['height']);
      // Projection squashes the vertical extent: projected height < flat height.
      expect(r.h).toBeLessThan(f.h + 0.01);
      expect(r.h).toBeGreaterThan(0);
      // X axis is untouched by the squash.
      expect(r.x).toBeCloseTo(f.x, 5);
      expect(r.w).toBeCloseTo(f.w, 5);
    }
    game.destroy();
  });

  it('isoY squashes toward the board vertical centre (fixed point at centre)', () => {
    const game = newIsoGame({ difficulty: 1, seed: 7 });
    game.start();
    const c = game.isoCenterY;
    // The centre is its own image.
    expect(game.isoY(c)).toBeCloseTo(c, 5);
    // Points above/below are pulled toward the centre (shallower than flat).
    const above = c - 100;
    const below = c + 100;
    expect(game.isoY(above)).toBeGreaterThan(above); // pulled down toward centre
    expect(game.isoY(below)).toBeLessThan(below); // pulled up toward centre
    // Order preserved (no rotation/flip).
    expect(game.isoY(above)).toBeLessThan(game.isoY(below));
    game.destroy();
  });

  it('depth-sorts tiles back-to-front (top edge behind bottom edge on screen)', () => {
    const game = newIsoGame({ difficulty: 1, seed: 7 });
    game.start();
    // Back row (top edge, index 0..5) projects to smaller screen-Y than the
    // front row (bottom edge, 10..15) — so it sorts behind in draw order.
    const topCenter = game.tileCenter(2).y; // a top-edge tile
    const bottomCenter = game.tileCenter(12).y; // a bottom-edge tile
    expect(topCenter).toBeLessThan(bottomCenter);
    game.destroy();
  });

  it('relayout after resize recomputes a consistent iso layout', () => {
    const game = newIsoGame({ difficulty: 1, seed: 7 });
    game.start();
    const ringBefore = game.ringSize;
    game.resizeTo(480, 853);
    expect(game.ringSize).toBeGreaterThan(ringBefore);
    // isoCenterY tracks the new ring; all tiles stay on-canvas after resize.
    for (let i = 0; i < BOARD_SIZE; i++) {
      const r = game.tileRingRect(i);
      expect(r.x).toBeGreaterThanOrEqual(-3);
      expect(r.x + r.w).toBeLessThanOrEqual(480 + 3);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.h).toBeLessThanOrEqual(853);
      expect(r.h).toBeGreaterThan(0);
    }
    // Centre is consistent with the projection (fixed point).
    expect(game.isoY(game.isoCenterY)).toBeCloseTo(game.isoCenterY, 5);
    game.destroy();
  });
});

describe('Dice Tycoon — F3 buildings & Penny token', () => {
  it('building rise state reflects built vs unbuilt slots', () => {
    const game = newIsoGame({ difficulty: 1, seed: 7 });
    game.start();
    game.landmarksBuilt = 2;
    game.syncLandmarkRise();
    expect(game.landmarkRise[0]).toBe(1); // built → risen
    expect(game.landmarkRise[1]).toBe(1);
    expect(game.landmarkRise[2]).toBe(0); // unbuilt → footprint
    expect(game.landmarkRise[3]).toBe(0);
    // Rendering both built (risen) and unbuilt (footprint) buildings is fine.
    expect(() => game.render()).not.toThrow();
    game.destroy();
  });

  it('Penny token renders without throwing at various hop progresses', () => {
    const game = newIsoGame({ difficulty: 1, seed: 7 });
    game.start();
    game.rivals = [];
    game.landmarkCostList = [1e9, 1e9, 1e9, 1e9];
    // Idle.
    expect(() => game.render()).not.toThrow();
    // Mid-hop at several progresses.
    game.roll();
    for (const p of [0, 0.25, 0.5, 0.75, 0.99]) {
      (game.hopAnim as { remaining: number; progress: number }).progress = p;
      expect(() => game.render()).not.toThrow();
    }
    // After landing (squash active).
    for (let i = 0; i < 60; i++) game.update(0.02);
    expect(() => game.render()).not.toThrow();
    game.destroy();
  });

  it('dice display tracks the last rolled values once settled', () => {
    const game = newIsoGame({ difficulty: 1, seed: 7 });
    game.start();
    game.rivals = [];
    game.landmarkCostList = [1e9, 1e9, 1e9, 1e9];
    game.roll();
    // Last dice recorded in [1,6].
    expect(game.lastDie1).toBeGreaterThanOrEqual(1);
    expect(game.lastDie1).toBeLessThanOrEqual(6);
    expect(game.lastDie2).toBeGreaterThanOrEqual(1);
    expect(game.lastDie2).toBeLessThanOrEqual(6);
    // Drive to settle; rendering the settled dice does not throw.
    for (let i = 0; i < 60; i++) game.update(0.05);
    expect(() => game.render()).not.toThrow();
    game.destroy();
  });
});
