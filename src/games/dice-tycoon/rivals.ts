/**
 * Dice Tycoon — AI rivals & raids (pure logic).
 *
 * PURE module: no DOM, no canvas, no imports from other dice-tycoon files,
 * and crucially NO `Math.random()`. All randomness is injected via an `rng`
 * function returning a float in [0, 1) — this keeps Daily Mode fully
 * deterministic (same seed → same roster & outcomes on every device).
 *
 * See docs/plans/dice-tycoon.md §5.5 (AI rivals & raids).
 *
 * All numeric outputs are guarded so coins never go negative and nothing is
 * NaN: rng values are sanitized, board levels are floored to a sane minimum,
 * and every steal/loss is clamped against the available pile.
 */

export interface Rival {
  id: string;
  name: string;
  coins: number; // their stealable pile
  shields: number; // blocks one raid each
}

export interface RaidResult {
  blocked: boolean; // true if rival had a shield (consumed, nothing stolen)
  stolen: number; // coins transferred to player (0 if blocked)
  vaultIndex: number; // which of 3 vaults the outcome corresponds to (0..2)
}

export interface CounterRaid {
  happened: boolean;
  lostCoins: number; // coins the player loses (0 if shielded or didn't happen)
  shieldUsed: boolean; // true if a player shield absorbed it
  byName: string; // which rival hit them ('' if none)
}

/** Fun rival names — picked deterministically from the rng sequence. */
const RIVAL_NAMES: readonly string[] = [
  'Baron Busto',
  'Lady Ledger',
  'Sir Loansalot',
  'Duke Dicey',
  'Count Cashflow',
  'Vault Vera',
  'Mogul Moe',
  'Tycoon Tess',
  'Penny Pincher',
  'Big Spender Sven',
  'Crooked Cora',
  'Rolling Rhonda',
  'Greedy Gordo',
  'Slick Nick',
  'Madam Monopoly',
  'Heist Hank',
];

/**
 * Return a finite rng value in [0, 1). Defends against a misbehaving injected
 * rng (NaN / out-of-range) so downstream math is never poisoned.
 */
function safeRng(rng: () => number): number {
  const v = rng();
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v >= 1) return 0.9999999999;
  return v;
}

/** Integer in [0, max). max <= 0 yields 0. */
function randInt(rng: () => number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.floor(safeRng(rng) * max);
}

/** Coerce to a finite, non-negative integer. */
function nonNegInt(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

/** Clamp boardLevel to a finite integer >= 1. */
function safeLevel(boardLevel: number): number {
  if (!Number.isFinite(boardLevel) || boardLevel < 1) return 1;
  return Math.floor(boardLevel);
}

/**
 * Deterministic roster of 3–5 rivals from rng + boardLevel.
 *
 * Coins scale to the economy when an optional `coinScale` is provided (the
 * game passes the first landmark cost, keeping rivals decoupled from the
 * economy module — NO cross-module import). With `coinScale`, each rival's
 * pile ≈ `coinScale * (0.15 + aggression*0.4)`, where `aggression` is a seeded
 * per-rival factor in [0,1). When `coinScale` is omitted (or non-positive),
 * the module stays self-contained and falls back to the boardLevel-based
 * scaling. Names are picked without repetition; shields scale with boardLevel.
 */
export function generateRivals(
  rng: () => number,
  boardLevel: number,
  coinScale?: number,
): Rival[] {
  const level = safeLevel(boardLevel);
  const scale = Number.isFinite(coinScale as number) && (coinScale as number) > 0
    ? (coinScale as number)
    : 0;

  // 3..5 rivals.
  const count = 3 + randInt(rng, 3);

  // Pick `count` distinct names by swapping from a working copy (deterministic
  // partial Fisher–Yates so we never loop unbounded or repeat a name).
  const pool = RIVAL_NAMES.slice();
  const chosen: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = randInt(rng, pool.length);
    chosen.push(pool[idx]);
    pool[idx] = pool[pool.length - 1];
    pool.pop();
  }

  const rivals: Rival[] = [];
  for (let i = 0; i < chosen.length; i++) {
    // Seeded per-rival aggression in [0,1) keeps rivals distinct.
    const aggression = safeRng(rng);
    let coins: number;
    if (scale > 0) {
      // Cost-scaled: pile ≈ landmarkCost[0] * (0.15 + aggression*0.4).
      coins = nonNegInt(scale * (0.15 + aggression * 0.4));
    } else {
      // Fallback (module self-contained): boardLevel-based scaling.
      const base = 200 * level;
      coins = nonNegInt(base + aggression * 200 * level);
    }
    // 0..2 shields, with higher boards trending toward more protection.
    const shields = Math.min(3, randInt(rng, 2 + Math.min(level, 2)));
    rivals.push({
      id: `rival-${level}-${i}`,
      name: chosen[i],
      coins,
      shields: nonNegInt(shields),
    });
  }

  return rivals;
}

/** Cap on a single raid/counter-raid swing, as a fraction of player coins. */
const RAID_CAP_FRACTION = 0.25;

/**
 * Player raids `rival`, choosing one of 3 face-down vaults (0..2).
 * The vaults hold seeded amounts; a shield blocks and is consumed (nothing
 * stolen). `multiplier` (1/5/20) scales the stolen amount.
 *
 * `playerCoins` (optional) caps a single steal at ~25% of the player's current
 * pile, so a big ×20 raid can't trivialize the economy in one tap. Omit it (or
 * pass a non-positive value) to leave the steal uncapped (back-compat).
 *
 * MUTATES the rival (reduces coins / shields) and returns the result.
 * Coins never go negative; no NaN.
 */
export function resolveRaid(
  rng: () => number,
  rival: Rival,
  multiplier: number,
  chosenVault: number,
  playerCoins?: number,
): RaidResult {
  // Sanitize rival state defensively.
  rival.coins = nonNegInt(rival.coins);
  rival.shields = nonNegInt(rival.shields);

  // Clamp vault index into 0..2.
  let vaultIndex = Number.isFinite(chosenVault) ? Math.floor(chosenVault) : 0;
  if (vaultIndex < 0) vaultIndex = 0;
  if (vaultIndex > 2) vaultIndex = 2;

  // Sanitize multiplier (the game uses 1/5/20; allow any finite >= 1).
  let mult = Number.isFinite(multiplier) ? Math.floor(multiplier) : 1;
  if (mult < 1) mult = 1;

  // Roll all 3 vault fractions so the outcome is a deterministic function of
  // the rng sequence regardless of which vault the player picks (we always
  // consume the same number of rng draws).
  const fractions: number[] = [safeRng(rng), safeRng(rng), safeRng(rng)];

  // Shield blocks the raid entirely and is consumed.
  if (rival.shields > 0) {
    rival.shields -= 1;
    return { blocked: true, stolen: 0, vaultIndex };
  }

  // Chosen vault holds a fraction (5%..30%) of the rival's pile.
  const frac = 0.05 + fractions[vaultIndex] * 0.25;
  const rawSteal = Math.floor(rival.coins * frac * mult);
  // Never steal more than the rival actually has; never negative.
  let stolen = Math.max(0, Math.min(rival.coins, nonNegInt(rawSteal)));

  // Cap the swing at ~25% of the player's current coins (when supplied).
  if (Number.isFinite(playerCoins as number) && (playerCoins as number) > 0) {
    const cap = Math.floor(nonNegInt(playerCoins as number) * RAID_CAP_FRACTION);
    stolen = Math.min(stolen, cap);
  }

  rival.coins = Math.max(0, rival.coins - stolen);

  return { blocked: false, stolen, vaultIndex };
}

/**
 * After the player's roll resolves, a random rival may raid the player back.
 *
 * With probability `aggression` (0..1) a rival strikes. If the player holds a
 * shield, one is consumed (shieldUsed=true, lostCoins=0). Otherwise the player
 * loses a seeded cut (8%..25%) of their coins.
 *
 * PURE: returns the result; the CALLER applies coin/shield changes from the
 * returned numbers. Does not mutate any caller state.
 */
export function resolveCounterRaid(
  rng: () => number,
  aggression: number,
  playerCoins: number,
  playerShields: number,
  rivals: Rival[],
): CounterRaid {
  const none: CounterRaid = {
    happened: false,
    lostCoins: 0,
    shieldUsed: false,
    byName: '',
  };

  // Clamp aggression into [0, 1].
  let aggr = Number.isFinite(aggression) ? aggression : 0;
  if (aggr < 0) aggr = 0;
  if (aggr > 1) aggr = 1;

  // Draw the trigger roll FIRST so the rng sequence is consistent whether or
  // not a raid ends up happening. aggression=0 → never; aggression=1 → always.
  const trigger = safeRng(rng);
  if (trigger >= aggr) return none;

  // Need at least one rival to attack with.
  const list = Array.isArray(rivals) ? rivals : [];
  if (list.length === 0) return none;

  const attacker = list[randInt(rng, list.length)];
  const byName = attacker && typeof attacker.name === 'string' ? attacker.name : '';

  const coins = nonNegInt(playerCoins);
  const shields = nonNegInt(playerShields);

  // A held shield absorbs the raid; no coins lost.
  if (shields > 0) {
    // Consume a cut roll anyway to keep the rng sequence deterministic.
    safeRng(rng);
    return { happened: true, lostCoins: 0, shieldUsed: true, byName };
  }

  // Player loses 8%..25% of their coins, clamped to what they have and to the
  // ~25% single-raid cap (so no counter-raid swing exceeds a quarter of the pile).
  const frac = 0.08 + safeRng(rng) * 0.17;
  const cap = Math.floor(coins * RAID_CAP_FRACTION);
  const rawLoss = Math.min(Math.floor(coins * frac), cap);
  const lostCoins = Math.max(0, Math.min(coins, nonNegInt(rawLoss)));

  return { happened: true, lostCoins, shieldUsed: false, byName };
}
