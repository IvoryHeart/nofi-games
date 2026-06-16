import { describe, it, expect } from 'vitest';
import {
  DIFFICULTY_CONFIGS,
  MULTIPLIERS,
  applyRegen,
  msUntilNextDie,
  landmarkCosts,
  salaryFor,
  netWorth,
  effectiveCap,
  payoutFactor,
  type DifficultyConfig,
} from '../../src/games/dice-tycoon/economy';

const MIN = 60_000;
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
  it('is exactly [1, 5, 20]', () => {
    expect([...MULTIPLIERS]).toEqual([1, 5, 20]);
  });
});

describe('dice-tycoon economy: regen intervals (F2)', () => {
  it('uses 8/12/18/25 minute intervals (Easy→Extra)', () => {
    expect(ALL.map((c) => c.regenIntervalMs)).toEqual([
      8 * MIN, 12 * MIN, 18 * MIN, 25 * MIN,
    ]);
  });
});

describe('dice-tycoon economy: effectiveCap (F2)', () => {
  it('equals diceCap at board level 1', () => {
    for (const cfg of ALL) {
      expect(effectiveCap(cfg, 1)).toBe(cfg.diceCap);
    }
  });

  it('adds floor(boardLevel/2)*2 to the base cap', () => {
    const cfg = ALL[1]; // diceCap 26
    expect(effectiveCap(cfg, 1)).toBe(26);     // +0
    expect(effectiveCap(cfg, 2)).toBe(26 + 2); // +2
    expect(effectiveCap(cfg, 3)).toBe(26 + 2); // +2
    expect(effectiveCap(cfg, 4)).toBe(26 + 4); // +4
    expect(effectiveCap(cfg, 5)).toBe(26 + 4); // +4
    expect(effectiveCap(cfg, 6)).toBe(26 + 6); // +6
  });

  it('is non-decreasing in boardLevel and never below the base cap', () => {
    const cfg = ALL[3];
    let prev = -1;
    for (let lvl = 1; lvl <= 12; lvl++) {
      const cap = effectiveCap(cfg, lvl);
      expect(cap).toBeGreaterThanOrEqual(cfg.diceCap);
      expect(cap).toBeGreaterThanOrEqual(prev);
      prev = cap;
    }
  });

  it('clamps degenerate board levels to level 1 and stays finite', () => {
    const cfg = ALL[0];
    expect(effectiveCap(cfg, 0)).toBe(cfg.diceCap);
    expect(effectiveCap(cfg, -3)).toBe(cfg.diceCap);
    expect(isFiniteNum(effectiveCap(cfg, NaN))).toBe(true);
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

describe('dice-tycoon economy: applyRegen + effectiveCap (F2)', () => {
  it('caps at the board-level-scaled effectiveCap, not the base diceCap', () => {
    const cfg = ALL[1]; // diceCap 26
    const lastRegenAt = 0;
    // Far more than enough time at board level 4 (cap = 26 + 4 = 30).
    const now = cfg.regenIntervalMs * 1000;
    const res = applyRegen(0, lastRegenAt, now, cfg, 4);
    expect(res.dice).toBe(effectiveCap(cfg, 4));
    expect(res.dice).toBe(30);
    expect(res.dice).toBeGreaterThan(cfg.diceCap);
  });

  it('defaults boardLevel to 1 (base cap) when omitted', () => {
    const cfg = ALL[2];
    const now = cfg.regenIntervalMs * 1000;
    const res = applyRegen(0, 0, now, cfg);
    expect(res.dice).toBe(cfg.diceCap);
  });

  it('lets a higher board level keep regenerating past the base cap', () => {
    const cfg = ALL[0]; // diceCap 30
    // At base cap already, but level 6 cap is 30 + 6 = 36.
    const res = applyRegen(30, 0, cfg.regenIntervalMs * 10, cfg, 6);
    expect(res.dice).toBe(effectiveCap(cfg, 6));
    expect(res.dice).toBe(36);
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

  it('respects the board-level effectiveCap: at base cap but below scaled cap it still counts down', () => {
    const cfg = ALL[1]; // base 26, level 4 cap 30
    // At the base cap (26) but board level 4 raises the cap to 30 → not full.
    expect(msUntilNextDie(26, 0, 0, cfg, 4)).toBe(cfg.regenIntervalMs);
    // At the scaled cap (30) → full → 0.
    expect(msUntilNextDie(30, 0, 0, cfg, 4)).toBe(0);
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

  // ── F2 two-phase curve ──
  it('board 1 is cheap (Medium ≈ 150/270/490/870, ×1.8 within board)', () => {
    const cfg = ALL[1]; // landmarkCostMul 1.0
    const costs = landmarkCosts(1, cfg);
    expect(costs).toEqual([150, 270, 490, 870]);
  });

  it('boards 2–3 spike at ×2.2 per level (the jolt)', () => {
    const cfg = ALL[1];
    const l1 = landmarkCosts(1, cfg)[0];
    const l2 = landmarkCosts(2, cfg)[0];
    const l3 = landmarkCosts(3, cfg)[0];
    // Each early board's first landmark ~2.2× the previous (rounded to 10s).
    expect(l2 / l1).toBeGreaterThan(2.0);
    expect(l2 / l1).toBeLessThan(2.4);
    expect(l3 / l2).toBeGreaterThan(2.0);
    expect(l3 / l2).toBeLessThan(2.4);
  });

  it('board 4+ compounds at the gentler ×1.35 tail', () => {
    const cfg = ALL[1];
    const l3 = landmarkCosts(3, cfg)[0];
    const l4 = landmarkCosts(4, cfg)[0];
    const l5 = landmarkCosts(5, cfg)[0];
    // The tail ratio is ~1.35 — clearly below the ×2.2 early jump.
    expect(l4 / l3).toBeGreaterThan(1.25);
    expect(l4 / l3).toBeLessThan(1.45);
    expect(l5 / l4).toBeGreaterThan(1.25);
    expect(l5 / l4).toBeLessThan(1.45);
    // The tail grows slower than the early spike.
    const earlyRatio = landmarkCosts(2, cfg)[0] / landmarkCosts(1, cfg)[0];
    expect(l4 / l3).toBeLessThan(earlyRatio);
  });

  it('the curve is monotonic across many board levels', () => {
    const cfg = ALL[2];
    let prev = -1;
    for (let lvl = 1; lvl <= 10; lvl++) {
      const first = landmarkCosts(lvl, cfg)[0];
      expect(first).toBeGreaterThan(prev);
      prev = first;
    }
  });
});

describe('dice-tycoon economy: payoutFactor (F2)', () => {
  it('is 1 + boardLevel*0.15', () => {
    expect(payoutFactor(1)).toBeCloseTo(1.15, 10);
    expect(payoutFactor(2)).toBeCloseTo(1.30, 10);
    expect(payoutFactor(5)).toBeCloseTo(1.75, 10);
  });

  it('increases with board level and clamps degenerate input to level 1', () => {
    expect(payoutFactor(3)).toBeGreaterThan(payoutFactor(2));
    expect(payoutFactor(0)).toBe(payoutFactor(1));
    expect(payoutFactor(-4)).toBe(payoutFactor(1));
    expect(isFiniteNum(payoutFactor(NaN))).toBe(true);
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

  it('grows geometrically as base * 1.25^(level-1) (F2)', () => {
    const cfg = ALL[1]; // base 250
    expect(salaryFor(1, cfg)).toBe(250);
    expect(salaryFor(2, cfg)).toBe(Math.round(250 * 1.25));       // 313
    expect(salaryFor(3, cfg)).toBe(Math.round(250 * 1.25 ** 2));  // 391
    expect(salaryFor(5, cfg)).toBe(Math.round(250 * 1.25 ** 4));  // 610
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

  it('uses the F2 weights: coins + landmarks*400 + board*3000 + stickers*150', () => {
    expect(netWorth({ coins: 0, landmarksBuilt: 1, boardLevel: 0, stickers: 0 })).toBe(400);
    expect(netWorth({ coins: 0, landmarksBuilt: 0, boardLevel: 1, stickers: 0 })).toBe(3000);
    expect(netWorth({ coins: 0, landmarksBuilt: 0, boardLevel: 0, stickers: 1 })).toBe(150);
    expect(
      netWorth({ coins: 1000, landmarksBuilt: 2, boardLevel: 3, stickers: 4 }),
    ).toBe(1000 + 2 * 400 + 3 * 3000 + 4 * 150);
  });

  it('never returns NaN and clamps negatives', () => {
    const nw = netWorth({ coins: NaN, landmarksBuilt: -5, boardLevel: NaN, stickers: -1 });
    expect(isFiniteNum(nw)).toBe(true);
    expect(nw).toBeGreaterThanOrEqual(0);
  });
});
