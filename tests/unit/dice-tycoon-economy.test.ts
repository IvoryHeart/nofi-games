import { describe, it, expect } from 'vitest';
import {
  DIFFICULTY_CONFIGS,
  MULTIPLIERS,
  applyRegen,
  msUntilNextDie,
  landmarkCosts,
  salaryFor,
  netWorth,
  type DifficultyConfig,
} from '../../src/games/dice-tycoon/economy';

const ALL: DifficultyConfig[] = DIFFICULTY_CONFIGS;
const LEVELS = [0, 1, 2, 3]; // Easy, Medium, Hard, Extra

function isFiniteNum(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

describe('dice-tycoon economy: DIFFICULTY_CONFIGS', () => {
  it('has exactly 4 entries [Easy, Medium, Hard, Extra]', () => {
    expect(ALL).toHaveLength(4);
  });

  it('every field is a finite number with rivalAggression in 0..1', () => {
    for (const cfg of ALL) {
      expect(isFiniteNum(cfg.regenIntervalMs)).toBe(true);
      expect(isFiniteNum(cfg.diceCap)).toBe(true);
      expect(isFiniteNum(cfg.startDice)).toBe(true);
      expect(isFiniteNum(cfg.startCoins)).toBe(true);
      expect(isFiniteNum(cfg.landmarkCostMul)).toBe(true);
      expect(isFiniteNum(cfg.salary)).toBe(true);
      expect(isFiniteNum(cfg.payoutMul)).toBe(true);
      expect(cfg.rivalAggression).toBeGreaterThanOrEqual(0);
      expect(cfg.rivalAggression).toBeLessThanOrEqual(1);
    }
  });

  it('startDice never exceeds diceCap and is positive', () => {
    for (const cfg of ALL) {
      expect(cfg.startDice).toBeGreaterThan(0);
      expect(cfg.startDice).toBeLessThanOrEqual(cfg.diceCap);
      expect(cfg.diceCap).toBeGreaterThanOrEqual(20);
      expect(cfg.diceCap).toBeLessThanOrEqual(30);
    }
  });

  it('difficulty ramps: Easy easier than Extra across every axis', () => {
    const easy = ALL[0];
    const extra = ALL[3];
    // Regen: Easy faster (smaller interval) than Extra.
    expect(easy.regenIntervalMs).toBeLessThan(extra.regenIntervalMs);
    // Aggression: Easy passive, Extra aggressive.
    expect(easy.rivalAggression).toBeLessThan(extra.rivalAggression);
    // Costs: Easy cheap, Extra expensive.
    expect(easy.landmarkCostMul).toBeLessThan(extra.landmarkCostMul);
    // Start resources: Easy generous, Extra lean.
    expect(easy.startDice).toBeGreaterThan(extra.startDice);
    expect(easy.startCoins).toBeGreaterThan(extra.startCoins);
    // Payout & salary: Easy generous.
    expect(easy.payoutMul).toBeGreaterThan(extra.payoutMul);
    expect(easy.salary).toBeGreaterThan(extra.salary);
  });

  it('axes are monotonic across all four levels', () => {
    for (let i = 1; i < ALL.length; i++) {
      // Harder => slower regen (non-decreasing interval).
      expect(ALL[i].regenIntervalMs).toBeGreaterThanOrEqual(ALL[i - 1].regenIntervalMs);
      // Harder => more aggressive (non-decreasing).
      expect(ALL[i].rivalAggression).toBeGreaterThanOrEqual(ALL[i - 1].rivalAggression);
      // Harder => pricier (non-decreasing cost mul).
      expect(ALL[i].landmarkCostMul).toBeGreaterThanOrEqual(ALL[i - 1].landmarkCostMul);
      // Harder => fewer/equal start dice & coins.
      expect(ALL[i].startDice).toBeLessThanOrEqual(ALL[i - 1].startDice);
      expect(ALL[i].startCoins).toBeLessThanOrEqual(ALL[i - 1].startCoins);
    }
  });
});

describe('dice-tycoon economy: MULTIPLIERS', () => {
  it('is exactly [1, 3, 10]', () => {
    expect([...MULTIPLIERS]).toEqual([1, 3, 10]);
  });
});

describe('dice-tycoon economy: applyRegen', () => {
  it('credits a partial elapsed amount and preserves the remainder', () => {
    for (const i of LEVELS) {
      const cfg = ALL[i];
      const interval = cfg.regenIntervalMs;
      const start = 0;
      const lastRegenAt = 1_000_000;
      // 3 full intervals + half an interval elapsed.
      const now = lastRegenAt + 3 * interval + interval / 2;
      const res = applyRegen(start, lastRegenAt, now, cfg);
      expect(res.dice).toBe(3);
      // Clock advanced by exactly 3 intervals, leaving the half-interval remainder.
      expect(res.lastRegenAt).toBe(lastRegenAt + 3 * interval);
      // The leftover should equal half an interval.
      expect(now - res.lastRegenAt).toBeCloseTo(interval / 2, 5);
      expect(isFiniteNum(res.dice)).toBe(true);
      expect(isFiniteNum(res.lastRegenAt)).toBe(true);
    }
  });

  it('credits one die after exactly one interval', () => {
    const cfg = ALL[1];
    const lastRegenAt = 500;
    const res = applyRegen(5, lastRegenAt, lastRegenAt + cfg.regenIntervalMs, cfg);
    expect(res.dice).toBe(6);
    expect(res.lastRegenAt).toBe(lastRegenAt + cfg.regenIntervalMs);
  });

  it('credits zero dice before a full interval elapses and keeps lastRegenAt', () => {
    const cfg = ALL[0];
    const lastRegenAt = 2000;
    const now = lastRegenAt + cfg.regenIntervalMs - 1;
    const res = applyRegen(4, lastRegenAt, now, cfg);
    expect(res.dice).toBe(4);
    expect(res.lastRegenAt).toBe(lastRegenAt);
  });

  it('clamps to the cap when more than enough time elapsed and sets lastRegenAt = now', () => {
    for (const i of LEVELS) {
      const cfg = ALL[i];
      const lastRegenAt = 0;
      const now = cfg.regenIntervalMs * (cfg.diceCap + 100);
      const res = applyRegen(0, lastRegenAt, now, cfg);
      expect(res.dice).toBe(cfg.diceCap);
      expect(res.lastRegenAt).toBe(now); // clock reset at cap
    }
  });

  it('returns { dice: cap, lastRegenAt: now } immediately when already at cap', () => {
    for (const i of LEVELS) {
      const cfg = ALL[i];
      const now = 999_999;
      const res = applyRegen(cfg.diceCap, 0, now, cfg);
      expect(res.dice).toBe(cfg.diceCap);
      expect(res.lastRegenAt).toBe(now);
    }
  });

  it('treats over-cap input as capped', () => {
    const cfg = ALL[2];
    const res = applyRegen(cfg.diceCap + 50, 0, 12345, cfg);
    expect(res.dice).toBe(cfg.diceCap);
    expect(res.lastRegenAt).toBe(12345);
  });

  it('clamps a backwards clock (now < lastRegenAt) to zero elapsed', () => {
    const cfg = ALL[1];
    const res = applyRegen(3, 10_000, 5_000, cfg);
    expect(res.dice).toBe(3);
    expect(isFiniteNum(res.dice)).toBe(true);
    expect(isFiniteNum(res.lastRegenAt)).toBe(true);
  });

  it('never produces NaN given NaN inputs', () => {
    const cfg = ALL[0];
    const res = applyRegen(NaN, NaN, NaN, cfg);
    expect(isFiniteNum(res.dice)).toBe(true);
    expect(isFiniteNum(res.lastRegenAt)).toBe(true);
    expect(res.dice).toBeGreaterThanOrEqual(0);
  });

  it('does not lose progress across repeated calls (chained regen)', () => {
    const cfg = ALL[1];
    const interval = cfg.regenIntervalMs;
    let dice = 0;
    let lra = 0;
    // First call: 1.5 intervals -> +1 die, remainder 0.5.
    let res = applyRegen(dice, lra, 1.5 * interval, cfg);
    dice = res.dice;
    lra = res.lastRegenAt;
    expect(dice).toBe(1);
    // Second call: another 0.5 interval completes the next full interval -> +1.
    res = applyRegen(dice, lra, 2 * interval, cfg);
    expect(res.dice).toBe(2);
  });
});

describe('dice-tycoon economy: msUntilNextDie', () => {
  it('returns 0 at cap for every difficulty', () => {
    for (const i of LEVELS) {
      const cfg = ALL[i];
      expect(msUntilNextDie(cfg.diceCap, 0, 500, cfg)).toBe(0);
      expect(msUntilNextDie(cfg.diceCap + 5, 0, 500, cfg)).toBe(0);
    }
  });

  it('returns the full interval right after a die was credited', () => {
    const cfg = ALL[0];
    const ms = msUntilNextDie(3, 1000, 1000, cfg);
    expect(ms).toBe(cfg.regenIntervalMs);
  });

  it('decreases toward 0 as time progresses within an interval', () => {
    const cfg = ALL[1];
    const lra = 0;
    const early = msUntilNextDie(2, lra, cfg.regenIntervalMs * 0.25, cfg);
    const late = msUntilNextDie(2, lra, cfg.regenIntervalMs * 0.75, cfg);
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0);
    expect(early).toBeLessThanOrEqual(cfg.regenIntervalMs);
  });

  it('is always a finite non-negative number', () => {
    for (const i of LEVELS) {
      const cfg = ALL[i];
      const ms = msUntilNextDie(1, NaN, NaN, cfg);
      expect(isFiniteNum(ms)).toBe(true);
      expect(ms).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('dice-tycoon economy: landmarkCosts', () => {
  it('returns exactly 4 strictly increasing positive integer costs', () => {
    for (const i of LEVELS) {
      const cfg = ALL[i];
      for (const level of [1, 2, 5]) {
        const costs = landmarkCosts(level, cfg);
        expect(costs).toHaveLength(4);
        for (let k = 0; k < 4; k++) {
          expect(Number.isInteger(costs[k])).toBe(true);
          expect(costs[k]).toBeGreaterThan(0);
          if (k > 0) expect(costs[k]).toBeGreaterThan(costs[k - 1]);
        }
      }
    }
  });

  it('scales up with board level (each landmark dearer at a higher level)', () => {
    const cfg = ALL[1];
    const lvl1 = landmarkCosts(1, cfg);
    const lvl2 = landmarkCosts(2, cfg);
    const lvl3 = landmarkCosts(3, cfg);
    for (let k = 0; k < 4; k++) {
      expect(lvl2[k]).toBeGreaterThan(lvl1[k]);
      expect(lvl3[k]).toBeGreaterThan(lvl2[k]);
    }
  });

  it('scales with cfg.landmarkCostMul (Extra costs more than Easy at same level)', () => {
    const easy = landmarkCosts(2, ALL[0]);
    const extra = landmarkCosts(2, ALL[3]);
    for (let k = 0; k < 4; k++) {
      expect(extra[k]).toBeGreaterThan(easy[k]);
    }
  });

  it('clamps boardLevel < 1 to level 1', () => {
    const cfg = ALL[0];
    expect(landmarkCosts(0, cfg)).toEqual(landmarkCosts(1, cfg));
    expect(landmarkCosts(-5, cfg)).toEqual(landmarkCosts(1, cfg));
  });

  it('never returns NaN', () => {
    const cfg = ALL[2];
    const costs = landmarkCosts(NaN, cfg);
    costs.forEach((c) => expect(isFiniteNum(c)).toBe(true));
  });
});

describe('dice-tycoon economy: salaryFor', () => {
  it('equals the config salary at board level 1', () => {
    for (const i of LEVELS) {
      const cfg = ALL[i];
      expect(salaryFor(1, cfg)).toBe(Math.round(cfg.salary));
    }
  });

  it('increases monotonically with board level', () => {
    const cfg = ALL[1];
    let prev = -1;
    for (let lvl = 1; lvl <= 8; lvl++) {
      const s = salaryFor(lvl, cfg);
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });

  it('Easy salary >= Extra salary at the same level', () => {
    for (const lvl of [1, 3, 5]) {
      expect(salaryFor(lvl, ALL[0])).toBeGreaterThanOrEqual(salaryFor(lvl, ALL[3]));
    }
  });

  it('clamps board level below 1 and avoids NaN', () => {
    const cfg = ALL[0];
    expect(salaryFor(0, cfg)).toBe(salaryFor(1, cfg));
    expect(isFiniteNum(salaryFor(NaN, cfg))).toBe(true);
  });
});

describe('dice-tycoon economy: netWorth', () => {
  const base = { coins: 100, landmarksBuilt: 2, boardLevel: 1, stickers: 3 };

  it('is a finite non-negative integer', () => {
    const nw = netWorth(base);
    expect(Number.isInteger(nw)).toBe(true);
    expect(nw).toBeGreaterThanOrEqual(0);
  });

  it('is strictly monotonic in coins', () => {
    expect(netWorth({ ...base, coins: 200 })).toBeGreaterThan(netWorth(base));
  });

  it('is strictly monotonic in landmarksBuilt', () => {
    expect(netWorth({ ...base, landmarksBuilt: 3 })).toBeGreaterThan(netWorth(base));
  });

  it('is strictly monotonic in boardLevel', () => {
    expect(netWorth({ ...base, boardLevel: 2 })).toBeGreaterThan(netWorth(base));
  });

  it('is strictly monotonic in stickers', () => {
    expect(netWorth({ ...base, stickers: 4 })).toBeGreaterThan(netWorth(base));
  });

  it('is zero for an empty fresh state', () => {
    expect(netWorth({ coins: 0, landmarksBuilt: 0, boardLevel: 0, stickers: 0 })).toBe(0);
  });

  it('never returns NaN and clamps negatives', () => {
    const nw = netWorth({ coins: NaN, landmarksBuilt: -5, boardLevel: NaN, stickers: -1 });
    expect(isFiniteNum(nw)).toBe(true);
    expect(nw).toBeGreaterThanOrEqual(0);
  });
});
