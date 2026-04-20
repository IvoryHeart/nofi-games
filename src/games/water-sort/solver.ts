import { WaterSortLevel, Tube, canPour, pour, isLevelSolved, cloneLevel } from './types';

/** Serialize a tube array as a canonical key for BFS de-duplication.
 *  Tube identity doesn't matter — two states are equivalent if they are
 *  permutations of each other — so we sort the serialized tube strings. */
function stateKey(tubes: Tube[]): string {
  const parts = tubes.map(t => t.contents.join(','));
  parts.sort();
  return parts.join('|');
}

/** BFS over tube states. Returns `true` if the puzzle is solvable, `false`
 *  otherwise. Returns `null` if the budget is exhausted (unknown). */
export function isSolvable(
  level: WaterSortLevel,
  budget = 200_000,
): boolean | null {
  if (isLevelSolved(level)) return true;
  const start = cloneLevel(level);
  const seen = new Set<string>();
  seen.add(stateKey(start.tubes));
  const queue: WaterSortLevel[] = [start];
  let head = 0;

  while (head < queue.length) {
    if (seen.size > budget) return null;
    const s = queue[head++];
    for (let i = 0; i < s.tubes.length; i++) {
      for (let j = 0; j < s.tubes.length; j++) {
        if (i === j) continue;
        if (!canPour(s.tubes[i], s.tubes[j])) continue;
        const next = cloneLevel(s);
        pour(next.tubes[i], next.tubes[j]);
        const key = stateKey(next.tubes);
        if (seen.has(key)) continue;
        if (isLevelSolved(next)) return true;
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return false;
}
