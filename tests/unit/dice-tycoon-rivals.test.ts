import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/utils/rng';
import {
  generateRivals,
  resolveRaid,
  resolveCounterRaid,
  resolveShutdown,
  type Rival,
  type HeistTier,
} from '../../src/games/dice-tycoon/rivals';

const seed = (s = 12345) => mulberry32(s);

describe('generateRivals', () => {
  it('is deterministic: same seed + level → identical roster', () => {
    const a = generateRivals(seed(7), 1);
    const b = generateRivals(seed(7), 1);
    expect(a).toEqual(b);
  });

  it('produces different rosters for different seeds', () => {
    const a = generateRivals(seed(1), 1);
    const b = generateRivals(seed(2), 1);
    expect(a).not.toEqual(b);
  });

  it('returns 3..5 rivals across many seeds', () => {
    for (let s = 0; s < 200; s++) {
      const r = generateRivals(seed(s), 1 + (s % 4));
      expect(r.length).toBeGreaterThanOrEqual(3);
      expect(r.length).toBeLessThanOrEqual(5);
    }
  });

  it('gives every rival a name, non-negative coins, and 0..3 shields', () => {
    const rivals = generateRivals(seed(99), 3);
    for (const r of rivals) {
      expect(typeof r.name).toBe('string');
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.id.length).toBeGreaterThan(0);
      expect(Number.isFinite(r.coins)).toBe(true);
      expect(r.coins).toBeGreaterThanOrEqual(0);
      expect(r.shields).toBeGreaterThanOrEqual(0);
      expect(r.shields).toBeLessThanOrEqual(3);
    }
  });

  it('assigns distinct names within a roster', () => {
    for (let s = 0; s < 50; s++) {
      const rivals = generateRivals(seed(s), 2);
      const names = rivals.map((r) => r.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('scales coin piles with boardLevel', () => {
    let lowSum = 0;
    let highSum = 0;
    for (let s = 0; s < 40; s++) {
      lowSum += generateRivals(seed(s), 1).reduce((a, r) => a + r.coins, 0);
      highSum += generateRivals(seed(s), 5).reduce((a, r) => a + r.coins, 0);
    }
    expect(highSum).toBeGreaterThan(lowSum);
  });

  it('handles invalid boardLevel defensively (no NaN, treated as level 1)', () => {
    const bad = generateRivals(seed(3), NaN);
    const zero = generateRivals(seed(3), 0);
    const neg = generateRivals(seed(3), -5);
    const one = generateRivals(seed(3), 1);
    for (const roster of [bad, zero, neg]) {
      for (const r of roster) {
        expect(Number.isFinite(r.coins)).toBe(true);
        expect(r.coins).toBeGreaterThanOrEqual(0);
      }
    }
    // All clamp to level 1 → identical to level 1.
    expect(bad).toEqual(one);
    expect(zero).toEqual(one);
    expect(neg).toEqual(one);
  });
});

describe('resolveRaid', () => {
  const unshieldedRival = (coins = 1000): Rival => ({
    id: 'r0',
    name: 'Test Rival',
    coins,
    shields: 0,
  });

  it('is deterministic for the same seed + inputs', () => {
    const ra = unshieldedRival();
    const rb = unshieldedRival();
    const a = resolveRaid(seed(55), ra, 1, 1);
    const b = resolveRaid(seed(55), rb, 1, 1);
    expect(a).toEqual(b);
    expect(ra).toEqual(rb);
  });

  it('a shield blocks the raid and is consumed (nothing stolen)', () => {
    const rival: Rival = { id: 'r1', name: 'Guarded', coins: 500, shields: 1 };
    const res = resolveRaid(seed(1), rival, 10, 0);
    expect(res.blocked).toBe(true);
    expect(res.stolen).toBe(0);
    expect(rival.shields).toBe(0); // consumed
    expect(rival.coins).toBe(500); // untouched
  });

  it('mutates rival coins by the stolen amount on an unblocked raid', () => {
    const rival = unshieldedRival(1000);
    const res = resolveRaid(seed(9), rival, 1, 2);
    expect(res.blocked).toBe(false);
    expect(res.stolen).toBeGreaterThan(0);
    expect(rival.coins).toBe(1000 - res.stolen);
  });

  it('higher multiplier scales the stolen amount (same seed/vault)', () => {
    const r1 = unshieldedRival(10000);
    const r3 = unshieldedRival(10000);
    const r10 = unshieldedRival(10000);
    const s1 = resolveRaid(seed(21), r1, 1, 0);
    const s3 = resolveRaid(seed(21), r3, 3, 0);
    const s10 = resolveRaid(seed(21), r10, 10, 0);
    expect(s3.stolen).toBeGreaterThan(s1.stolen);
    expect(s10.stolen).toBeGreaterThan(s3.stolen);
  });

  it('never steals more than the rival has; coins never negative', () => {
    for (let s = 0; s < 100; s++) {
      const rival = unshieldedRival(50);
      const res = resolveRaid(seed(s), rival, 10, s % 3);
      expect(res.stolen).toBeLessThanOrEqual(50);
      expect(res.stolen).toBeGreaterThanOrEqual(0);
      expect(rival.coins).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(rival.coins)).toBe(true);
      expect(Number.isFinite(res.stolen)).toBe(true);
    }
  });

  it('clamps chosenVault into 0..2 and reports it', () => {
    expect(resolveRaid(seed(1), unshieldedRival(), 1, -5).vaultIndex).toBe(0);
    expect(resolveRaid(seed(1), unshieldedRival(), 1, 99).vaultIndex).toBe(2);
    expect(resolveRaid(seed(1), unshieldedRival(), 1, 1).vaultIndex).toBe(1);
    expect(resolveRaid(seed(1), unshieldedRival(), 1, NaN).vaultIndex).toBe(0);
  });

  it('a zero-coin rival yields zero stolen, no NaN', () => {
    const rival = unshieldedRival(0);
    const res = resolveRaid(seed(4), rival, 10, 1);
    expect(res.stolen).toBe(0);
    expect(rival.coins).toBe(0);
  });

  it('different vaults can yield different steal amounts (seeded outcome)', () => {
    const amounts = new Set<number>();
    for (let v = 0; v < 3; v++) {
      const rival = unshieldedRival(100000);
      amounts.add(resolveRaid(seed(123), rival, 1, v).stolen);
    }
    expect(amounts.size).toBeGreaterThan(1);
  });

  it('handles invalid multiplier (NaN/0) as at least 1×', () => {
    const rNaN = unshieldedRival(1000);
    const rZero = unshieldedRival(1000);
    const rOne = unshieldedRival(1000);
    const sNaN = resolveRaid(seed(8), rNaN, NaN, 0);
    const sZero = resolveRaid(seed(8), rZero, 0, 0);
    const sOne = resolveRaid(seed(8), rOne, 1, 0);
    expect(sNaN.stolen).toBe(sOne.stolen);
    expect(sZero.stolen).toBe(sOne.stolen);
  });
});

describe('resolveCounterRaid', () => {
  const rivals = (): Rival[] => generateRivals(seed(77), 1);

  it('aggression=0 never happens', () => {
    for (let s = 0; s < 200; s++) {
      const res = resolveCounterRaid(seed(s), 0, 1000, 0, rivals());
      expect(res.happened).toBe(false);
      expect(res.lostCoins).toBe(0);
      expect(res.shieldUsed).toBe(false);
      expect(res.byName).toBe('');
    }
  });

  it('aggression=1 always happens', () => {
    for (let s = 0; s < 200; s++) {
      const res = resolveCounterRaid(seed(s), 1, 1000, 0, rivals());
      expect(res.happened).toBe(true);
      expect(res.byName.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same seed + inputs', () => {
    const a = resolveCounterRaid(seed(33), 1, 800, 0, rivals());
    const b = resolveCounterRaid(seed(33), 1, 800, 0, rivals());
    expect(a).toEqual(b);
  });

  it('a player shield absorbs the raid: lostCoins=0, shieldUsed=true', () => {
    const res = resolveCounterRaid(seed(5), 1, 1000, 1, rivals());
    expect(res.happened).toBe(true);
    expect(res.shieldUsed).toBe(true);
    expect(res.lostCoins).toBe(0);
    expect(res.byName.length).toBeGreaterThan(0);
  });

  it('without a shield the player loses a positive, clamped cut', () => {
    const res = resolveCounterRaid(seed(5), 1, 1000, 0, rivals());
    expect(res.happened).toBe(true);
    expect(res.shieldUsed).toBe(false);
    expect(res.lostCoins).toBeGreaterThan(0);
    expect(res.lostCoins).toBeLessThanOrEqual(1000);
  });

  it('never reports a loss exceeding the player coins; never negative/NaN', () => {
    for (let s = 0; s < 100; s++) {
      const res = resolveCounterRaid(seed(s), 1, 30, 0, rivals());
      expect(res.lostCoins).toBeGreaterThanOrEqual(0);
      expect(res.lostCoins).toBeLessThanOrEqual(30);
      expect(Number.isFinite(res.lostCoins)).toBe(true);
    }
  });

  it('does not mutate the passed rivals array or its members', () => {
    const list = rivals();
    const snapshot = JSON.parse(JSON.stringify(list));
    resolveCounterRaid(seed(2), 1, 1000, 0, list);
    expect(list).toEqual(snapshot);
  });

  it('returns no raid when the rival list is empty', () => {
    const res = resolveCounterRaid(seed(1), 1, 1000, 0, []);
    expect(res.happened).toBe(false);
    expect(res.byName).toBe('');
  });

  it('clamps out-of-range aggression', () => {
    // aggression > 1 behaves like 1 (always), < 0 like 0 (never).
    const always = resolveCounterRaid(seed(1), 5, 1000, 0, rivals());
    const never = resolveCounterRaid(seed(1), -5, 1000, 0, rivals());
    expect(always.happened).toBe(true);
    expect(never.happened).toBe(false);
  });

  it('handles zero player coins without NaN', () => {
    const res = resolveCounterRaid(seed(1), 1, 0, 0, rivals());
    expect(res.lostCoins).toBe(0);
    expect(Number.isFinite(res.lostCoins)).toBe(true);
  });

  // ── F2: single-raid 25% cap ──
  it('never loses more than 25% of the player coins in a single counter-raid', () => {
    for (let s = 0; s < 300; s++) {
      const coins = 1000;
      const res = resolveCounterRaid(seed(s), 1, coins, 0, rivals());
      if (res.happened && !res.shieldUsed) {
        expect(res.lostCoins).toBeLessThanOrEqual(Math.floor(coins * 0.25));
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// F2 — economics re-rig: coinScale param, fallback, single-raid 25% cap.
// ════════════════════════════════════════════════════════════════════

describe('generateRivals — coinScale (F2)', () => {
  it('derives coins ≈ coinScale*(0.15 + aggression*0.4) → within [0.15, 0.55]*scale', () => {
    const scale = 10000;
    for (let s = 0; s < 80; s++) {
      const roster = generateRivals(seed(s), 3, scale);
      for (const r of roster) {
        expect(r.coins).toBeGreaterThanOrEqual(0);
        // 0.15*scale = 1500 lower bound, 0.55*scale = 5500 upper bound.
        expect(r.coins).toBeGreaterThanOrEqual(Math.floor(0.15 * scale) - 1);
        expect(r.coins).toBeLessThanOrEqual(Math.ceil(0.55 * scale) + 1);
      }
    }
  });

  it('a larger coinScale yields larger rival piles (same seed/level)', () => {
    const small = generateRivals(seed(9), 2, 1000).reduce((a, r) => a + r.coins, 0);
    const big = generateRivals(seed(9), 2, 50000).reduce((a, r) => a + r.coins, 0);
    expect(big).toBeGreaterThan(small);
  });

  it('falls back to boardLevel scaling when coinScale is omitted or non-positive', () => {
    const omitted = generateRivals(seed(4), 3);
    const zero = generateRivals(seed(4), 3, 0);
    const neg = generateRivals(seed(4), 3, -100);
    const nan = generateRivals(seed(4), 3, NaN);
    // All four take the fallback path → identical rosters (same rng sequence).
    expect(zero).toEqual(omitted);
    expect(neg).toEqual(omitted);
    expect(nan).toEqual(omitted);
    for (const r of omitted) expect(r.coins).toBeGreaterThan(0);
  });

  it('fallback still scales coin piles with boardLevel', () => {
    let lowSum = 0;
    let highSum = 0;
    for (let s = 0; s < 40; s++) {
      lowSum += generateRivals(seed(s), 1).reduce((a, r) => a + r.coins, 0);
      highSum += generateRivals(seed(s), 5).reduce((a, r) => a + r.coins, 0);
    }
    expect(highSum).toBeGreaterThan(lowSum);
  });

  it('is deterministic with a coinScale (same seed + level + scale)', () => {
    const a = generateRivals(seed(77), 3, 8000);
    const b = generateRivals(seed(77), 3, 8000);
    expect(a).toEqual(b);
  });
});

describe('resolveRaid — single-raid 25% cap (F2)', () => {
  const unshielded = (coins = 100000): Rival => ({ id: 'r', name: 'R', coins, shields: 0 });

  it('caps the steal at 25% of the player coins when playerCoins is supplied', () => {
    for (let s = 0; s < 100; s++) {
      const rival = unshielded(1_000_000);
      const playerCoins = 1000;
      const res = resolveRaid(seed(s), rival, 20, s % 3, playerCoins);
      expect(res.stolen).toBeLessThanOrEqual(Math.floor(playerCoins * 0.25));
    }
  });

  it('leaves the steal uncapped when playerCoins is omitted (back-compat)', () => {
    const rival = unshielded(1_000_000);
    const res = resolveRaid(seed(3), rival, 20, 0);
    // Uncapped, ×20 of a huge pile → well over a small 25%-cap would allow.
    expect(res.stolen).toBeGreaterThan(250);
  });

  it('still never steals more than the rival has, even under the cap', () => {
    const rival = unshielded(40);
    const res = resolveRaid(seed(1), rival, 20, 1, 1_000_000);
    expect(res.stolen).toBeLessThanOrEqual(40);
    expect(rival.coins).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic with the playerCoins cap (same inputs)', () => {
    const a = resolveRaid(seed(8), unshielded(), 5, 1, 2000);
    const b = resolveRaid(seed(8), unshielded(), 5, 1, 2000);
    expect(a).toEqual(b);
  });
});

// ════════════════════════════════════════════════════════════════════
// F4b — tiered Heist + Shutdown + net-worth×multiplier scaling.
// ════════════════════════════════════════════════════════════════════

describe('generateRivals — landmarks (F4b Shutdown targets)', () => {
  it('every generated rival has 1..4 standing landmarks', () => {
    for (let s = 0; s < 80; s++) {
      const roster = generateRivals(seed(s), 1 + (s % 5));
      for (const r of roster) {
        expect(r.landmarks).toBeGreaterThanOrEqual(1);
        expect(r.landmarks).toBeLessThanOrEqual(4);
      }
    }
  });

  it('is still deterministic with the new landmarks field', () => {
    expect(generateRivals(seed(42), 3)).toEqual(generateRivals(seed(42), 3));
  });
});

describe('resolveRaid — tiered outcomes (F4b)', () => {
  const unshielded = (coins = 100000): Rival => ({ id: 'r', name: 'R', coins, shields: 0 });

  it('reports a tier (small/big/jackpot) and all 3 vault tiers', () => {
    const res = resolveRaid(seed(5), unshielded(), 1, 1);
    expect(['small', 'big', 'jackpot']).toContain(res.tier);
    expect(res.vaultTiers).toHaveLength(3);
    for (const t of res.vaultTiers!) expect(['small', 'big', 'jackpot']).toContain(t);
    // The chosen vault's tier matches vaultTiers[vaultIndex].
    expect(res.tier).toBe(res.vaultTiers![res.vaultIndex]);
  });

  it('jackpot steals more than big, big more than small (same pile, same mult)', () => {
    // Build a rival/seed for each tier by scanning vaults.
    const sample = (): Record<HeistTier, number> => {
      const out: Partial<Record<HeistTier, number>> = {};
      for (let s = 0; s < 400 && Object.keys(out).length < 3; s++) {
        for (let v = 0; v < 3; v++) {
          const r = unshielded(100000);
          const res = resolveRaid(seed(s), r, 1, v);
          if (res.tier && out[res.tier] == null) out[res.tier] = res.stolen;
        }
      }
      return out as Record<HeistTier, number>;
    };
    const amounts = sample();
    expect(amounts.small).toBeLessThan(amounts.big);
    expect(amounts.big).toBeLessThan(amounts.jackpot);
  });

  it('tier distribution is deterministic and includes all three across seeds', () => {
    const seen = new Set<HeistTier>();
    for (let s = 0; s < 200; s++) {
      const res = resolveRaid(seed(s), unshielded(), 1, s % 3);
      if (res.tier) seen.add(res.tier);
    }
    expect(seen.has('small')).toBe(true);
    expect(seen.has('big')).toBe(true);
    expect(seen.has('jackpot')).toBe(true);
  });

  it('scaleBasis (net-worth×mult) increases the steal floor', () => {
    // Same seed/vault/pile; a non-zero scaleBasis adds to the floor.
    const noScale = resolveRaid(seed(11), unshielded(1000), 1, 0);
    const withScale = resolveRaid(seed(11), unshielded(1000), 1, 0, undefined, 50000);
    expect(withScale.stolen).toBeGreaterThan(noScale.stolen);
  });

  it('a shield still blocks a tiered raid (nothing stolen, tier reported)', () => {
    const rival: Rival = { id: 'g', name: 'Guard', coins: 9000, shields: 1 };
    const res = resolveRaid(seed(3), rival, 20, 1, 1000, 100000);
    expect(res.blocked).toBe(true);
    expect(res.stolen).toBe(0);
    expect(rival.shields).toBe(0);
    expect(rival.coins).toBe(9000);
    expect(res.tier).toBeDefined();
  });

  it('never NaN/negative even with scaleBasis + cap', () => {
    for (let s = 0; s < 150; s++) {
      const rival = unshielded(50);
      const res = resolveRaid(seed(s), rival, 20, s % 3, 1000, 99999);
      expect(Number.isFinite(res.stolen)).toBe(true);
      expect(res.stolen).toBeGreaterThanOrEqual(0);
      expect(res.stolen).toBeLessThanOrEqual(50);
      expect(rival.coins).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('resolveShutdown — demolish a rival landmark (F4b)', () => {
  const rival = (landmarks = 3, shields = 0, coins = 5000): Rival => ({
    id: 'r', name: 'R', coins, shields, landmarks,
  });

  it('demolishes one landmark and pays a positive scaling payout', () => {
    const r = rival(3);
    const res = resolveShutdown(seed(7), r, 1, 1000, 20000);
    expect(res.demolished).toBe(true);
    expect(res.blocked).toBe(false);
    expect(res.payout).toBeGreaterThan(0);
    expect(res.landmarksLeft).toBe(2);
    expect(r.landmarks).toBe(2);
  });

  it('a shield blocks the wreck (consumed, nothing demolished, payout 0)', () => {
    const r = rival(3, 1);
    const res = resolveShutdown(seed(7), r, 1, 1000, 20000);
    expect(res.blocked).toBe(true);
    expect(res.demolished).toBe(false);
    expect(res.payout).toBe(0);
    expect(r.shields).toBe(0);
    expect(r.landmarks).toBe(3); // untouched
  });

  it('a rival with no landmarks left yields nothing demolished, payout 0', () => {
    const r = rival(0);
    const res = resolveShutdown(seed(1), r, 5, 1000, 50000);
    expect(res.demolished).toBe(false);
    expect(res.payout).toBe(0);
    expect(res.landmarksLeft).toBe(0);
  });

  it('payout scales with net-worth×multiplier (scaleBasis) and the multiplier', () => {
    const lowScale = resolveShutdown(seed(9), rival(3), 1, 0, 1000).payout;
    const highScale = resolveShutdown(seed(9), rival(3), 1, 0, 100000).payout;
    expect(highScale).toBeGreaterThan(lowScale);
    const lowMult = resolveShutdown(seed(9), rival(3), 1, 0, 50000).payout;
    const highMult = resolveShutdown(seed(9), rival(3), 20, 0, 50000).payout;
    expect(highMult).toBeGreaterThan(lowMult);
  });

  it('is deterministic for the same seed + inputs', () => {
    const a = resolveShutdown(seed(33), rival(3), 5, 2000, 30000);
    const b = resolveShutdown(seed(33), rival(3), 5, 2000, 30000);
    expect(a).toEqual(b);
  });

  it('defaults landmarks when the rival lacks the field (back-compat)', () => {
    const r: Rival = { id: 'r', name: 'R', coins: 1000, shields: 0 };
    const res = resolveShutdown(seed(2), r, 1, 1000, 10000);
    expect(res.demolished).toBe(true);
    expect(res.landmarksLeft).toBe(1); // default 2 → 1
  });

  it('never NaN/negative and does not touch the rival coin pile', () => {
    for (let s = 0; s < 120; s++) {
      const r = rival(1 + (s % 4), 0, 4000);
      const res = resolveShutdown(seed(s), r, 20, 500, 80000);
      expect(Number.isFinite(res.payout)).toBe(true);
      expect(res.payout).toBeGreaterThanOrEqual(0);
      expect(r.coins).toBe(4000); // Shutdown pays from insurance, not their pile
    }
  });
});
