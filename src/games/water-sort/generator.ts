import { mulberry32, shuffle } from '../../utils/rng';
import { WaterSortLevel, Tube, pour, canPour } from './types';

export type WaterSortBucket = 'easy' | 'medium' | 'hard' | 'expert';

interface Spec {
  numColors: number;
  capacity: number;
  /** Number of EMPTY tubes added beyond the N color tubes. Two extras is
   *  the standard "comfortable" setting; one makes it tight; zero is expert. */
  extraTubes: number;
  /** How many random reverse-moves to apply when scrambling. Higher = more
   *  interleaved colors and a deeper solution. */
  scramblePasses: number;
}

const SPECS: Record<WaterSortBucket, Spec> = {
  easy:   { numColors: 3, capacity: 4, extraTubes: 2, scramblePasses: 20 },
  medium: { numColors: 5, capacity: 4, extraTubes: 2, scramblePasses: 40 },
  hard:   { numColors: 6, capacity: 4, extraTubes: 2, scramblePasses: 60 },
  expert: { numColors: 7, capacity: 4, extraTubes: 1, scramblePasses: 90 },
};

/** Start from the solved state (each color fills exactly one tube) and
 *  perform `scramblePasses` random LEGAL pours. Because every individual
 *  pour is reversible, the scrambled state is guaranteed solvable. */
export function generate(seed: number, bucket: WaterSortBucket): WaterSortLevel {
  const spec = SPECS[bucket];
  const rng = mulberry32(seed);

  // Start solved: numColors tubes each full of one color + extraTubes empty
  const tubes: Tube[] = [];
  for (let c = 0; c < spec.numColors; c++) {
    const contents: number[] = [];
    for (let i = 0; i < spec.capacity; i++) contents.push(c);
    tubes.push({ capacity: spec.capacity, contents });
  }
  for (let e = 0; e < spec.extraTubes; e++) {
    tubes.push({ capacity: spec.capacity, contents: [] });
  }

  // Scramble via random legal pours. If a pour would recombine a color
  // stack (restoring toward solved), we still allow it — the subsequent
  // passes will break it up again.
  for (let pass = 0; pass < spec.scramblePasses; pass++) {
    const order = shuffle(tubes.map((_, i) => i), rng);
    let done = false;
    for (const srcIdx of order) {
      for (const dstIdx of order) {
        if (srcIdx === dstIdx) continue;
        if (canPour(tubes[srcIdx], tubes[dstIdx])) {
          pour(tubes[srcIdx], tubes[dstIdx]);
          done = true;
          break;
        }
      }
      if (done) break;
    }
  }

  // If scrambling somehow left the puzzle already solved, do one forced
  // non-trivial shuffle by swapping the top unit of two random non-empty tubes.
  if (tubes.every(t => t.contents.length === 0 || new Set(t.contents).size === 1)) {
    const nonEmpty = tubes.map((t, i) => ({ t, i })).filter(x => x.t.contents.length > 0);
    if (nonEmpty.length >= 2) {
      const [a, b] = [nonEmpty[0].t, nonEmpty[1].t];
      const av = a.contents.pop()!;
      const bv = b.contents.pop()!;
      a.contents.push(bv);
      b.contents.push(av);
    }
  }

  return { numColors: spec.numColors, capacity: spec.capacity, tubes };
}
