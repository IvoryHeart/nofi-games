/**
 * Seeded pseudo-random number generators for deterministic puzzle generation.
 *
 * Used by Daily Mode so every player gets the same puzzle on the same day,
 * and by tests that need reproducible game state.
 *
 * Mulberry32 is a small, fast, well-distributed PRNG. It's not cryptographic
 * but is more than enough for puzzle generation and shuffling.
 */

/** Build a seeded RNG. Returns a function that yields a float in [0, 1). */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function rng(): number {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Daily seed: stable per UTC day. Same date → same number on every device. */
export function dailySeed(date: Date = new Date()): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return y * 10000 + m * 100 + d;
}

/** ISO date string YYYY-MM-DD in UTC. Used as the storage key for daily completions. */
export function todayDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Pick a random integer in [0, max). */
export function randInt(rng: () => number, max: number): number {
  return Math.floor(rng() * max);
}

/** Fisher–Yates shuffle in place using the supplied RNG. Returns the array. */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick one element uniformly at random. */
export function pick<T>(arr: readonly T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}
