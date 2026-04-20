import { mulberry32 } from '../../utils/rng';
import { WaterSortLevel, Tube, isSolvedTube } from './types';
import { isSolvable } from './solver';

export type WaterSortBucket = 'easy' | 'medium' | 'hard' | 'expert';

interface Spec {
  numColors: number;
  capacity: number;
  /** Always 2 empty tubes — constant across tiers. Difficulty scales with
   *  color count rather than tightening the tube budget. */
  extraTubes: number;
  /** How hard we try to verify solvability via BFS. Exceeding this budget
   *  means "unknown" — we accept on the assumption that 2 empty tubes
   *  almost always permit a solution (empirically true for random pool-
   *  shuffle puzzles). Too low a cap would slow generation enormously. */
  verifyBudget: number;
}

const SPECS: Record<WaterSortBucket, Spec> = {
  easy:   { numColors: 4,  capacity: 4, extraTubes: 2, verifyBudget: 150_000 },
  medium: { numColors: 7,  capacity: 4, extraTubes: 2, verifyBudget: 60_000 },
  hard:   { numColors: 10, capacity: 4, extraTubes: 2, verifyBudget: 20_000 },
  expert: { numColors: 12, capacity: 4, extraTubes: 2, verifyBudget: 10_000 },
};

/** A tube counts as "already sorted" at start if it's empty OR fully
 *  filled with a single color. We reject these so every coloured tube
 *  needs meaningful work. */
function anyTubeAlreadySorted(tubes: Tube[]): boolean {
  for (const t of tubes) {
    if (t.contents.length > 0 && isSolvedTube(t)) return true;
  }
  return false;
}

/** Pool-shuffle generator: every unit of every color goes into a single
 *  pool, Fisher-Yates shuffled with the seeded RNG, then distributed
 *  row-by-row into N coloured tubes. Two extra empty tubes are appended.
 *  Rejects configurations where a coloured tube arrived at its target
 *  sorted (which happens rarely). When enabled by the bucket, also
 *  verifies solvability via BFS. */
export function generate(seed: number, bucket: WaterSortBucket): WaterSortLevel {
  const spec = SPECS[bucket];
  const rng = mulberry32(seed);

  for (let attempt = 0; attempt < 80; attempt++) {
    // Build the unit pool: each colour appears `capacity` times
    const pool: number[] = [];
    for (let c = 0; c < spec.numColors; c++) {
      for (let i = 0; i < spec.capacity; i++) pool.push(c);
    }
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Distribute into coloured tubes
    const tubes: Tube[] = [];
    for (let t = 0; t < spec.numColors; t++) {
      const contents = pool.slice(t * spec.capacity, (t + 1) * spec.capacity);
      tubes.push({ capacity: spec.capacity, contents });
    }
    // Append empty tubes
    for (let e = 0; e < spec.extraTubes; e++) {
      tubes.push({ capacity: spec.capacity, contents: [] });
    }
    const level: WaterSortLevel = {
      numColors: spec.numColors,
      capacity: spec.capacity,
      tubes,
    };
    if (anyTubeAlreadySorted(tubes)) continue;

    // Solvability verification (budget-capped — unknown counts as accept)
    const verdict = isSolvable(level, spec.verifyBudget);
    if (verdict === false) continue; // proven unsolvable — reject
    return level;                    // solvable OR unknown (very likely solvable)
  }

  // Last-resort fallback: return the final candidate even if we didn't
  // converge. Almost never hit in practice.
  const pool: number[] = [];
  for (let c = 0; c < spec.numColors; c++) {
    for (let i = 0; i < spec.capacity; i++) pool.push(c);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const tubes: Tube[] = [];
  for (let t = 0; t < spec.numColors; t++) {
    tubes.push({
      capacity: spec.capacity,
      contents: pool.slice(t * spec.capacity, (t + 1) * spec.capacity),
    });
  }
  for (let e = 0; e < spec.extraTubes; e++) {
    tubes.push({ capacity: spec.capacity, contents: [] });
  }
  return { numColors: spec.numColors, capacity: spec.capacity, tubes };
}
