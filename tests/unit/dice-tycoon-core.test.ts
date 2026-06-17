/**
 * Dice Tycoon — headless TycoonCore tests.
 *
 * These exercise the renderer-agnostic logic core directly (NO canvas, NO
 * GameEngine, NO DOM). They are the safety net for the PX1 extraction: the core
 * owns all state + rules and is deterministic via an injected rng + injected
 * clock (`now`). The canvas DiceTycoon view delegates to this same core, so
 * behaviour parity is proven by both these tests and the existing integration
 * suite staying green.
 */

import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/utils/rng';
import {
  TycoonCore,
  DAILY_DICE_BUDGET,
} from '../../src/games/dice-tycoon/core/TycoonCore';
import {
  DIFFICULTY_CONFIGS,
  MULTIPLIERS,
  effectiveCap,
  netWorth,
  landmarkCosts,
} from '../../src/games/dice-tycoon/economy';
import { BOARD_SIZE } from '../../src/games/dice-tycoon/board';
import { totalStickersOwned } from '../../src/games/dice-tycoon/stickers';

const T0 = 1_700_000_000_000; // a fixed reference clock

function core(opts: { difficulty?: number; seed?: number; now?: number } = {}): TycoonCore {
  const seed = opts.seed;
  const rng = seed != null ? mulberry32(seed) : Math.random;
  return new TycoonCore({
    rng,
    difficulty: opts.difficulty ?? 1,
    seed,
    now: opts.now ?? T0,
  });
}

describe('TycoonCore — construction & getters', () => {
  it('starts with a 40-tile board and difficulty-appropriate resources (non-daily)', () => {
    const c = core({ difficulty: 0 }); // Easy, non-daily
    expect(c.getTiles().length).toBe(BOARD_SIZE);
    expect(c.getCoins()).toBe(DIFFICULTY_CONFIGS[0].startCoins); // 800
    expect(c.getDice()).toBe(DIFFICULTY_CONFIGS[0].startDice); // 20
    expect(c.getTokenIndex()).toBe(0);
    expect(c.getBoardLevel()).toBe(1);
    expect(c.isActive()).toBe(true);
    expect(c.isWon()).toBe(false);
  });

  it('daily mode uses the fixed dice budget and reports isDaily', () => {
    const c = core({ difficulty: 1, seed: 999 });
    expect(c.isDaily()).toBe(true);
    expect(c.getDice()).toBe(DAILY_DICE_BUDGET); // 40
  });

  it('seeds the regen clock with the injected now (no Date.now in the core)', () => {
    const c = core({ difficulty: 1, now: 555 });
    expect(c.getLastRegenAt()).toBe(555);
  });
});

describe('TycoonCore — rolling spends MULTIPLIERS[idx] dice', () => {
  it('a ×1 roll spends 1 die and returns faces summing to steps', () => {
    const c = core({ difficulty: 1, seed: 7 });
    const before = c.getDice();
    const r = c.roll(T0);
    expect(r.ok).toBe(true);
    expect(c.getDice()).toBe(before - MULTIPLIERS[0]); // -1
    expect(r.die1 + r.die2).toBe(r.steps);
    expect(r.die1).toBeGreaterThanOrEqual(1);
    expect(r.die1).toBeLessThanOrEqual(6);
    expect(r.die2).toBeGreaterThanOrEqual(1);
    expect(r.die2).toBeLessThanOrEqual(6);
    expect(r.steps).toBeGreaterThanOrEqual(2);
    expect(r.steps).toBeLessThanOrEqual(12);
  });

  it('a ×5 roll spends 5 dice and a ×20 roll spends 20', () => {
    const c = core({ difficulty: 1, seed: 7 });
    expect(c.cycleMultiplier()).toBe(5);
    let before = c.getDice();
    c.roll(T0);
    expect(c.getDice()).toBe(before - 5);

    expect(c.cycleMultiplier()).toBe(20);
    c.setDice(25); // enough for a ×20 bet
    before = c.getDice();
    c.roll(T0);
    expect(c.getDice()).toBe(before - 20);
  });

  it('rejects a roll with insufficient dice (no state change)', () => {
    const c = core({ difficulty: 1, seed: 7 });
    c.setDice(0);
    const idx = c.getTokenIndex();
    const r = c.roll(T0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-enough-dice');
    expect(c.getDice()).toBe(0);
    expect(c.getTokenIndex()).toBe(idx);
  });

  it('a queued hop steps the token and pays GO salary on wrap', () => {
    const c = core({ difficulty: 1, seed: 7 });
    c.setRivals([]); // isolate from counter-raids
    c.setTokenIndex(BOARD_SIZE - 1); // next step wraps to GO
    const before = c.getCoins();
    c.setDice(10);
    const r = c.roll(T0);
    expect(r.ok).toBe(true);
    const step = c.advanceTokenOneStep();
    expect(step.index).toBe(0);
    expect(step.passedGo).toBe(true);
    expect(step.salary).toBeGreaterThan(0);
    expect(c.getCoins()).toBe(before + step.salary);
    expect(c.getTokenIndex()).toBe(0);
  });

  it('a skipNextRoll consumes dice but skips the hop', () => {
    const c = core({ difficulty: 1, seed: 7 });
    c.setSkipNextRoll(true);
    const before = c.getDice();
    const r = c.roll(T0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('skipped');
    expect(c.getDice()).toBe(before - 1); // dice were spent
    expect(c.getSkipNextRoll()).toBe(false);
    expect(c.hasPendingHops()).toBe(false);
  });
});

describe('TycoonCore — tile resolution', () => {
  function isolate(c: TycoonCore): void {
    c.setRivals([]);
    c.setLandmarkCostList([1e9, 1e9, 1e9, 1e9]);
  }

  it('landing on a property increases coins', () => {
    const c = core({ difficulty: 1, seed: 7 });
    isolate(c);
    const idx = c.getTiles().findIndex((t) => t.type === 'property');
    c.setTokenIndex(idx);
    const before = c.getCoins();
    const res = c.resolveLandedTile();
    expect(res.type).toBe('property');
    expect(c.getCoins()).toBeGreaterThan(before);
    expect(res.coinDelta).toBeGreaterThan(0);
  });

  it('landing on a tax tile decreases coins and feeds the jackpot', () => {
    const c = core({ difficulty: 1, seed: 7 });
    isolate(c);
    const idx = c.getTiles().findIndex((t) => t.type === 'tax');
    c.setTokenIndex(idx);
    const before = c.getCoins();
    const jackBefore = c.getJackpot();
    c.resolveLandedTile();
    expect(c.getCoins()).toBeLessThan(before);
    expect(c.getJackpot()).toBeGreaterThan(jackBefore);
  });

  it('Free Parking pays out the jackpot pool', () => {
    const c = core({ difficulty: 1, seed: 7 });
    isolate(c);
    const idx = c.getTiles().findIndex((t) => t.type === 'parking');
    c.setJackpot(250);
    c.setTokenIndex(idx);
    const before = c.getCoins();
    c.resolveLandedTile();
    expect(c.getCoins()).toBe(before + 250);
    expect(c.getJackpot()).toBe(0);
  });

  it('landing on a railroad opens a raid (resolution deferred)', () => {
    const c = core({ difficulty: 1, seed: 7 });
    const idx = c.getTiles().findIndex((t) => t.type === 'railroad');
    c.setTokenIndex(idx);
    const res = c.resolveLandedTile();
    expect(res.openedRaid).toBe(true);
    expect(c.isRaidOpen()).toBe(true);
    expect(res.afterTurn).toBeNull();
  });
});

describe('TycoonCore — regen with injected now + boardLevel effectiveCap', () => {
  it('refills up to the scaled cap on a deeper board (non-daily)', () => {
    const c = core({ difficulty: 1 }); // non-daily, now = T0
    c.setBoardLevel(4); // cap = 26 + 4 = 30
    c.setDice(0);
    // Backdate the regen clock far enough to refill completely.
    const cfg = DIFFICULTY_CONFIGS[1];
    c.setLastRegenAt(T0 - cfg.regenIntervalMs * 1000);
    c.applyRegen(T0);
    expect(c.getDice()).toBe(effectiveCap(cfg, 4));
    expect(c.getDice()).toBe(30);
  });

  it('daily mode never regens (fixed budget)', () => {
    const c = core({ difficulty: 3, seed: 42 });
    const before = c.getDice();
    c.setLastRegenAt(T0 - 10_000_000_000);
    c.applyRegen(T0); // no-op in daily mode
    c.tick(T0);
    expect(c.getDice()).toBe(before);
  });

  it('diceCap is the board-level-scaled effectiveCap for non-daily', () => {
    const c = core({ difficulty: 1 });
    expect(c.diceCap()).toBe(effectiveCap(DIFFICULTY_CONFIGS[1], 1));
    c.setBoardLevel(4);
    expect(c.diceCap()).toBe(effectiveCap(DIFFICULTY_CONFIGS[1], 4));
    expect(c.diceCap()).toBeGreaterThan(DIFFICULTY_CONFIGS[1].diceCap);
  });

  it('msUntilNextDie is 0 in daily mode and positive otherwise (below cap)', () => {
    const daily = core({ difficulty: 1, seed: 1 });
    expect(daily.msUntilNextDie(T0)).toBe(0);
    const nd = core({ difficulty: 1 });
    nd.setDice(0);
    nd.setLastRegenAt(T0);
    expect(nd.msUntilNextDie(T0)).toBeGreaterThan(0);
  });
});

describe('TycoonCore — build → board completion bonus + advance', () => {
  it('building 4 landmarks completes the board, grants a bonus, and advances', () => {
    const c = core({ difficulty: 1, seed: 7 });
    expect(c.getBoardLevel()).toBe(1);
    let lastComplete = null as ReturnType<TycoonCore['build']>['boardComplete'];
    for (let i = 0; i < 4; i++) {
      const cost = c.nextLandmarkCost();
      expect(cost).not.toBeNull();
      c.setCoins((cost as number) + 1000);
      const res = c.buildNextLandmark(cost as number);
      expect(res.built).toBe(true);
      expect(res.slot).toBe(i);
      lastComplete = res.boardComplete;
    }
    expect(lastComplete).not.toBeNull();
    expect(lastComplete!.nextBoardLevel).toBe(2);
    expect(lastComplete!.bonusCoins).toBe(500 * 1); // 500 * boardLevel (1)
    expect(c.isWon()).toBe(true);
    expect(c.getBoardLevel()).toBe(2);
    expect(c.getLandmarksBuilt()).toBe(0);
    expect(c.getTotalLandmarks()).toBe(4);
    expect(c.getTiles().length).toBe(BOARD_SIZE);
    expect(c.isActive()).toBe(true); // continuable
  });

  it('build() builds only when affordable', () => {
    const c = core({ difficulty: 1, seed: 7 });
    c.setCoins(0);
    c.setLandmarkCostList([1000, 1e9, 1e9, 1e9]);
    expect(c.canBuild()).toBe(false);
    expect(c.build().built).toBe(false);
    c.setCoins(1000);
    expect(c.canBuild()).toBe(true);
    const res = c.build();
    expect(res.built).toBe(true);
    expect(c.getLandmarksBuilt()).toBe(1);
  });

  it('the first landmark on board 1 is affordable from Medium start coins', () => {
    const c = core({ difficulty: 1, seed: 7 });
    const cost = c.nextLandmarkCost();
    expect(cost).toBe(landmarkCosts(1, DIFFICULTY_CONFIGS[1])[0]);
    expect(c.getCoins()).toBeGreaterThanOrEqual(cost as number);
  });
});

describe('TycoonCore — raids: shield-block vs steal, counter-raid board 1', () => {
  it('raiding a shielded rival is blocked; an unshielded rival is robbed', () => {
    const c = core({ difficulty: 1, seed: 7 });

    // Shielded → blocked, nothing stolen, shield consumed.
    c.setRivals([{ id: 'r0', name: 'Shieldy', coins: 1000, shields: 1 }]);
    c.setRaidState(0, false, null);
    const coinsBefore = c.getCoins();
    const blocked = c.chooseVault(0);
    expect(blocked).not.toBeNull();
    expect(blocked!.blocked).toBe(true);
    expect(blocked!.stolen).toBe(0);
    expect(c.getCoins()).toBe(coinsBefore);
    expect(c.getRivals()[0].shields).toBe(0);

    // Unshielded → coins stolen.
    c.setRivals([{ id: 'r1', name: 'Naked', coins: 1000, shields: 0 }]);
    c.setRaidState(0, false, null);
    const before2 = c.getCoins();
    const stolen = c.chooseVault(1);
    expect(stolen!.blocked).toBe(false);
    expect(stolen!.vaultIndex).toBe(1);
    expect(c.getCoins()).toBeGreaterThan(before2);
    expect(c.getRivals()[0].coins).toBeLessThan(1000);
  });

  it('counter-raid aggression is 0 on board 1 for every difficulty', () => {
    for (let d = 0; d <= 3; d++) {
      const c = core({ difficulty: d, seed: 100 + d });
      expect(c.getBoardLevel()).toBe(1);
      expect(c.counterRaidAggression()).toBe(0);
    }
  });

  it('never loses coins to a counter-raid on board 1 (rival-free first board)', () => {
    const c = core({ difficulty: 3, seed: 7 }); // most aggressive difficulty
    c.setRivals([{ id: 'r', name: 'Aggro', coins: 1000, shields: 0 }]);
    const before = c.getCoins();
    for (let i = 0; i < 50; i++) c.runCounterRaid();
    expect(c.getCoins()).toBe(before);
  });

  it('uses the difficulty aggression once past board 1', () => {
    const c = core({ difficulty: 3, seed: 5 });
    c.setBoardLevel(2);
    expect(c.counterRaidAggression()).toBe(DIFFICULTY_CONFIGS[3].rivalAggression);
    expect(c.counterRaidAggression()).toBeGreaterThan(0);
  });
});

describe('TycoonCore — score == netWorth', () => {
  it('getScore equals netWorth for a known state', () => {
    const c = core({ difficulty: 1, seed: 7 });
    c.setCoins(1234);
    c.setTotalLandmarks(3);
    c.setBoardLevel(2);
    c.setAlbum({ owned: { 'wheels:0': 1, 'wheels:1': 2 }, completedSets: [] });
    const expected = netWorth({ coins: 1234, landmarksBuilt: 3, boardLevel: 2, stickers: 2 });
    expect(c.getScore()).toBe(expected);
    expect(c.getStickerCount()).toBe(totalStickersOwned(c.getAlbum()));
  });
});

describe('TycoonCore — serialize/deserialize round-trip + save compatibility', () => {
  it('round-trips state through serialize → deserialize', () => {
    const c = core({ difficulty: 2, seed: 13 });
    c.setCoins(777);
    c.setDice(9);
    c.setBoardLevel(1);
    c.setTotalLandmarks(2);
    c.setLandmarksBuilt(2);
    c.setTokenIndex(8);
    c.setAlbum({ owned: { 'fortune:0': 1 }, completedSets: [] });

    const snap = c.serialize();

    const restored = core({ difficulty: 0, seed: 999 });
    const ok = restored.deserialize(snap, T0);
    expect(ok).toBe(true);
    expect(restored.getCoins()).toBe(777);
    expect(restored.getDice()).toBe(9);
    expect(restored.getBoardLevel()).toBe(1);
    expect(restored.getTotalLandmarks()).toBe(2);
    expect(restored.getLandmarksBuilt()).toBe(2);
    expect(restored.getTokenIndex()).toBe(8);
    expect(restored.getAlbum().owned['fortune:0']).toBe(1);
    expect(restored.getTiles().length).toBe(BOARD_SIZE);
    expect(restored.getTiles().map((t) => t.type)).toEqual(c.getTiles().map((t) => t.type));
  });

  it('deserialize rejects malformed payloads without mutating state', () => {
    const c = core({ difficulty: 1, seed: 8 });
    const coinsBefore = c.getCoins();
    expect(c.deserialize({}, T0)).toBe(false);
    expect(c.deserialize({ tiles: 'nope' as unknown as [] }, T0)).toBe(false);
    expect(c.deserialize({ tiles: [1, 2, 3] as unknown as [] }, T0)).toBe(false);
    expect(c.getCoins()).toBe(coinsBefore);
  });

  it('deserialize rejects a legacy 20-tile snapshot (board size mismatch)', () => {
    const c = core({ difficulty: 1, seed: 9 });
    const coinsBefore = c.getCoins();
    // An old save's board had 20 tiles + tokenIndex 0..19. The current board is
    // 40 tiles, so the snapshot must be rejected and the fresh board kept.
    const twentyTiles = Array.from({ length: 20 }, (_, i) => ({
      index: i, type: 'property' as const, name: 'X', baseValue: 40,
    }));
    expect(c.deserialize({ tiles: twentyTiles, tokenIndex: 17, coins: 99999 }, T0)).toBe(false);
    expect(c.getTiles().length).toBe(BOARD_SIZE); // still the fresh 40-tile board
    expect(c.getCoins()).toBe(coinsBefore); // untouched
  });

  it('deserialize rejects an out-of-range tokenIndex even at the right board size', () => {
    const c = core({ difficulty: 1, seed: 11 });
    const snap = c.serialize();
    (snap as Record<string, unknown>).tokenIndex = BOARD_SIZE; // 40 is out of range (0..39)
    expect(c.deserialize(snap, T0)).toBe(false);
    (snap as Record<string, unknown>).tokenIndex = -1;
    expect(c.deserialize(snap, T0)).toBe(false);
  });

  it('Go To Jail sends the token to the Jail corner (JAIL_INDEX = N/4)', () => {
    const c = core({ difficulty: 1, seed: 13 });
    // Place the token on the gotojail corner (3N/4) and resolve it.
    c.setTokenIndex((BOARD_SIZE * 3) / 4);
    const res = c.resolveLandedTile();
    expect(res.type).toBe('gotojail');
    expect(c.getTokenIndex()).toBe(BOARD_SIZE / 4); // jumped to Jail corner (10)
    expect(c.getSkipNextRoll()).toBe(true);
  });

  it('the serialized shape is BYTE-COMPATIBLE with the legacy save format', () => {
    // A snapshot produced by the legacy DiceTycoon.serialize() shape must
    // deserialize correctly via the core (format unchanged). We assert the
    // exact key set + that an old-shaped snapshot restores cleanly.
    const c = core({ difficulty: 1, seed: 7 });
    const snap = c.serialize();
    expect(Object.keys(snap).sort()).toEqual([
      'album',
      'boardLevel',
      'coins',
      'dice',
      'gameActive',
      'jackpot',
      'landmarkCostList',
      'landmarksBuilt',
      'lastRegenAt',
      'multiplierIndex',
      'rivals',
      'shields',
      'skipNextRoll',
      'theme',
      'tiles',
      'tokenIndex',
      'totalLandmarks',
    ]);

    // Hand-built legacy snapshot (the exact shape the old code wrote).
    const legacy: Record<string, unknown> = {
      boardLevel: 3,
      tiles: c.getTiles().map((t) => ({ ...t })),
      theme: { name: 'Old Town', landmarkNames: ['A', 'B', 'C', 'D'] },
      tokenIndex: 7,
      coins: 4242,
      dice: 12,
      lastRegenAt: T0 - 5000,
      shields: 2,
      multiplierIndex: 1,
      landmarksBuilt: 1,
      totalLandmarks: 9,
      landmarkCostList: [100, 200, 300, 400],
      rivals: [{ id: 'x', name: 'Y', coins: 50, shields: 0 }],
      album: { owned: { 'wheels:0': 1 }, completedSets: [] },
      jackpot: 33,
      skipNextRoll: true,
      gameActive: true,
    };
    const fresh = core({ difficulty: 1, seed: 1 });
    expect(fresh.deserialize(legacy, T0)).toBe(true);
    expect(fresh.getBoardLevel()).toBe(3);
    expect(fresh.getCoins()).toBe(4242);
    expect(fresh.getShields()).toBe(2);
    expect(fresh.getLandmarksBuilt()).toBe(1);
    expect(fresh.getTotalLandmarks()).toBe(9);
    expect(fresh.getJackpot()).toBe(33);
    expect(fresh.getSkipNextRoll()).toBe(true);
    expect(fresh.getTokenIndex()).toBe(7);
  });
});

describe('TycoonCore — determinism with a seeded rng', () => {
  it('two cores with the same seed + inputs reach the same state', () => {
    function run(): TycoonCore {
      const c = core({ difficulty: 2, seed: 20260617 });
      // Drive an identical scripted sequence through each.
      for (let turn = 0; turn < 8; turn++) {
        if (!c.canRoll()) c.setDice(20); // keep both topped up identically
        const r = c.roll(T0 + turn * 1000);
        if (r.ok) {
          while (c.hasPendingHops()) c.advanceTokenOneStep();
          const res = c.resolveLandedTile();
          if (res.openedRaid) c.chooseVault(turn % 3);
        }
      }
      return c;
    }
    const a = run();
    const b = run();

    expect(a.getCoins()).toBe(b.getCoins());
    expect(a.getDice()).toBe(b.getDice());
    expect(a.getTokenIndex()).toBe(b.getTokenIndex());
    expect(a.getBoardLevel()).toBe(b.getBoardLevel());
    expect(a.getScore()).toBe(b.getScore());
    expect(a.serialize()).toEqual(b.serialize());
  });

  it('same seed → identical board and rivals at construction', () => {
    const a = core({ difficulty: 2, seed: 20260616 });
    const b = core({ difficulty: 2, seed: 20260616 });
    expect(a.getTiles().map((t) => `${t.type}:${t.name}:${t.baseValue}`)).toEqual(
      b.getTiles().map((t) => `${t.type}:${t.name}:${t.baseValue}`),
    );
    expect(a.getRivals().map((r) => `${r.name}:${r.coins}:${r.shields}`)).toEqual(
      b.getRivals().map((r) => `${r.name}:${r.coins}:${r.shields}`),
    );
  });
});
