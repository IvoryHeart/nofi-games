/**
 * Dice Tycoon — economy module (pure logic, no DOM / canvas / RNG).
 *
 * Owns the numeric tuning and the deterministic math for the game's
 * resource economy: difficulty configs, energy-style dice regeneration,
 * landmark pricing, GO salary, and the net-worth score proxy.
 *
 * Every function here is a pure function of its arguments. No `Math.random()`,
 * no timers, no I/O. Consumers pass the current clock (`now`) explicitly so the
 * module stays testable and deterministic (Daily Mode safe). See spec sections
 * 5.3 (economy), 5.7 (score), 5.9 (difficulty).
 */

export interface DifficultyConfig {
  /** real-time ms to regenerate 1 die */
  regenIntervalMs: number;
  /** max stored dice */
  diceCap: number;
  startDice: number;
  startCoins: number;
  /** 0..1 chance a rival counter-raids you per resolved roll */
  rivalAggression: number;
  /** scales base landmark costs */
  landmarkCostMul: number;
  /** GO salary at boardLevel 1 */
  salary: number;
  /** scales all property payouts */
  payoutMul: number;
}

const MIN = 60_000;

/**
 * [Easy, Medium, Hard, Extra].
 * Easy = fast regen / cheap / passive / generous start.
 * Extra = slowest regen / most expensive / most aggressive / leanest start.
 */
export const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  // Easy
  {
    regenIntervalMs: 5 * MIN,
    diceCap: 30,
    startDice: 20,
    startCoins: 800,
    rivalAggression: 0.1,
    landmarkCostMul: 0.8,
    salary: 300,
    payoutMul: 1.2,
  },
  // Medium
  {
    regenIntervalMs: 8 * MIN,
    diceCap: 26,
    startDice: 14,
    startCoins: 500,
    rivalAggression: 0.25,
    landmarkCostMul: 1.0,
    salary: 250,
    payoutMul: 1.0,
  },
  // Hard
  {
    regenIntervalMs: 12 * MIN,
    diceCap: 22,
    startDice: 10,
    startCoins: 300,
    rivalAggression: 0.45,
    landmarkCostMul: 1.3,
    salary: 200,
    payoutMul: 0.85,
  },
  // Extra
  {
    regenIntervalMs: 18 * MIN,
    diceCap: 20,
    startDice: 6,
    startCoins: 150,
    rivalAggression: 0.65,
    landmarkCostMul: 1.7,
    salary: 150,
    payoutMul: 0.7,
  },
];

/** Roll multipliers. Betting N dice scales rewards/penalties by N. */
export const MULTIPLIERS: readonly number[] = [1, 3, 10] as const;

/** Coerce to a finite number, falling back to `fallback` on NaN/Infinity. */
function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Energy-style dice regeneration.
 *
 * elapsed = floor((now - lastRegenAt) / interval)
 * newDice = min(cap, dice + elapsed)
 *
 * lastRegenAt advances by elapsed*interval to preserve the sub-interval
 * remainder, UNLESS the new value reaches the cap — then lastRegenAt = now
 * (regen pauses while full; the clock restarts when a die is later spent).
 *
 * Guards:
 *  - if dice >= cap, returns { dice: cap, lastRegenAt: now } immediately.
 *  - clamps now >= lastRegenAt (a backwards clock yields zero elapsed).
 *  - never produces NaN.
 */
export function applyRegen(
  dice: number,
  lastRegenAt: number,
  now: number,
  cfg: DifficultyConfig
): { dice: number; lastRegenAt: number } {
  const cap = Math.max(0, Math.floor(finite(cfg.diceCap)));
  const interval = Math.max(1, Math.floor(finite(cfg.regenIntervalMs, MIN)));
  const safeNow = finite(now);
  const d = Math.max(0, Math.floor(finite(dice)));

  // Already full: no regen, reset the clock.
  if (d >= cap) {
    return { dice: cap, lastRegenAt: safeNow };
  }

  const lra = Math.min(finite(lastRegenAt, safeNow), safeNow); // clamp now >= lastRegenAt
  const elapsed = Math.max(0, Math.floor((safeNow - lra) / interval));
  const newDice = Math.min(cap, d + elapsed);

  // Reached the cap as a result of this regen: pause the clock at now.
  if (newDice >= cap) {
    return { dice: cap, lastRegenAt: safeNow };
  }

  // Advance the clock by the consumed whole intervals, preserving the remainder.
  return { dice: newDice, lastRegenAt: lra + elapsed * interval };
}

/**
 * Milliseconds remaining until the next die arrives.
 * Returns 0 if already at (or above) the cap.
 */
export function msUntilNextDie(
  dice: number,
  lastRegenAt: number,
  now: number,
  cfg: DifficultyConfig
): number {
  const cap = Math.max(0, Math.floor(finite(cfg.diceCap)));
  const d = Math.max(0, Math.floor(finite(dice)));
  if (d >= cap) return 0;

  const interval = Math.max(1, Math.floor(finite(cfg.regenIntervalMs, MIN)));
  const safeNow = finite(now);
  const lra = Math.min(finite(lastRegenAt, safeNow), safeNow);

  // Time already accrued within the current interval.
  const sinceLast = safeNow - lra;
  const intoCurrent = ((sinceLast % interval) + interval) % interval;
  const remaining = interval - intoCurrent;
  // remaining is in (0, interval]; if exactly aligned, the next die is `interval` away.
  return Math.max(0, Math.round(remaining));
}

/**
 * The 4 landmark costs for a board.
 *
 * Costs increase within a board (each landmark dearer than the last) and scale
 * up with `boardLevel` and `cfg.landmarkCostMul`. Returns whole-coin integers.
 */
export function landmarkCosts(boardLevel: number, cfg: DifficultyConfig): number[] {
  const level = Math.max(1, Math.floor(finite(boardLevel, 1)));
  const mul = Math.max(0, finite(cfg.landmarkCostMul, 1));
  // Board scaling: each board level is ~55% pricier than the last.
  const boardScale = Math.pow(1.55, level - 1);
  const base = 200;

  const costs: number[] = [];
  for (let i = 0; i < 4; i++) {
    // Within-board scaling: each successive landmark costs ~1.8x more.
    const withinBoard = Math.pow(1.8, i);
    const raw = base * withinBoard * boardScale * mul;
    // Round to the nearest 10 coins for tidy prices; ensure strictly positive.
    costs.push(Math.max(10, Math.round(raw / 10) * 10));
  }
  return costs;
}

/** GO salary, scaled up by board level from the difficulty's base salary. */
export function salaryFor(boardLevel: number, cfg: DifficultyConfig): number {
  const level = Math.max(1, Math.floor(finite(boardLevel, 1)));
  const base = Math.max(0, finite(cfg.salary, 0));
  // +30% per board level beyond the first.
  const raw = base * (1 + 0.3 * (level - 1));
  return Math.max(0, Math.round(raw));
}

/**
 * Score = net-worth proxy (spec 5.7). Strictly monotonic in each input so the
 * HUD reads as a satisfying, always-growing number.
 *
 *   coins + landmarksBuilt*250 + boardLevel*1000 + stickers*120
 */
export function netWorth(opts: {
  coins: number;
  landmarksBuilt: number;
  boardLevel: number;
  stickers: number;
}): number {
  const coins = Math.max(0, finite(opts.coins));
  const landmarks = Math.max(0, finite(opts.landmarksBuilt));
  const board = Math.max(0, finite(opts.boardLevel));
  const stickers = Math.max(0, finite(opts.stickers));

  const score = coins + landmarks * 250 + board * 1000 + stickers * 120;
  return Math.max(0, Math.round(score));
}
