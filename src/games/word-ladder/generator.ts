import { mulberry32 } from '../../utils/rng';
import { wordsByLength } from '../../words/dictionary';
import { LadderLevel } from './types';

/** Adjacency map cache per word length. Built lazily. Each word maps to the
 *  list of words that differ from it by exactly one letter. */
const adjCache: Map<number, Map<string, string[]>> = new Map();

/** Build (and cache) the word-graph adjacency map for all dictionary words of
 *  the given length. Uses the wildcard trick: two words are adjacent iff they
 *  match on any single-letter-masked pattern (e.g. "fl*g" links FLAG/FLOG). */
export function adjacencyForLength(len: number): Map<string, string[]> {
  const cached = adjCache.get(len);
  if (cached) return cached;

  const words = wordsByLength(len);
  const wildcardGroups: Map<string, string[]> = new Map();

  for (const word of words) {
    for (let i = 0; i < len; i++) {
      const wc = word.slice(0, i) + '*' + word.slice(i + 1);
      let arr = wildcardGroups.get(wc);
      if (!arr) {
        arr = [];
        wildcardGroups.set(wc, arr);
      }
      arr.push(word);
    }
  }

  const adj: Map<string, string[]> = new Map();
  for (const word of words) adj.set(word, []);
  for (const group of wildcardGroups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        adj.get(group[i])!.push(group[j]);
        adj.get(group[j])!.push(group[i]);
      }
    }
  }

  adjCache.set(len, adj);
  return adj;
}

/** BFS from a start word. Returns a Map<word, distance> up to maxDepth. */
function bfsDistances(
  start: string,
  adj: Map<string, string[]>,
  maxDepth: number,
): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(start, 0);
  let frontier = [start];
  for (let d = 1; d <= maxDepth; d++) {
    const next: string[] = [];
    for (const w of frontier) {
      for (const nb of adj.get(w) ?? []) {
        if (dist.has(nb)) continue;
        dist.set(nb, d);
        next.push(nb);
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return dist;
}

/** Reconstruct one optimal path from start to end using the BFS distance map. */
function reconstructPath(
  start: string,
  end: string,
  adj: Map<string, string[]>,
  dist: Map<string, number>,
): string[] | null {
  if (!dist.has(end)) return null;
  const path: string[] = [end];
  let curr = end;
  while (curr !== start) {
    const currDist = dist.get(curr)!;
    const prev = (adj.get(curr) ?? []).find(n => dist.get(n) === currDist - 1);
    if (!prev) return null;
    path.unshift(prev);
    curr = prev;
  }
  return path;
}

export interface GenerateOptions {
  wordLength: number;
  targetSteps: number;
  seed: number;
  /** Outer retries if the initial start word has no matching-distance end. */
  maxAttempts?: number;
}

export function generate(opts: GenerateOptions): LadderLevel | null {
  const { wordLength, targetSteps, seed, maxAttempts = 50 } = opts;
  const adj = adjacencyForLength(wordLength);
  const allWords = wordsByLength(wordLength);
  if (allWords.length === 0) return null;

  const rng = mulberry32(seed);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const start = allWords[Math.floor(rng() * allWords.length)];
    // Word must have at least one neighbor to be a useful start
    if ((adj.get(start) ?? []).length === 0) continue;

    const dist = bfsDistances(start, adj, targetSteps);
    const candidates: string[] = [];
    for (const [w, d] of dist) {
      if (d === targetSteps) candidates.push(w);
    }
    if (candidates.length === 0) continue;
    const end = candidates[Math.floor(rng() * candidates.length)];
    const path = reconstructPath(start, end, adj, dist);
    return { start, end, minSteps: targetSteps, samplePath: path ?? undefined };
  }
  return null;
}

export type LadderBucket = 'easy' | 'medium' | 'hard' | 'expert';

/** Difficulty spec: word length and target step count. */
const SPECS: Record<LadderBucket, { wordLength: number; targetSteps: number }> = {
  easy:   { wordLength: 4, targetSteps: 4 },
  medium: { wordLength: 4, targetSteps: 6 },
  hard:   { wordLength: 5, targetSteps: 7 },
  expert: { wordLength: 5, targetSteps: 9 },
};

/** Produce a daily puzzle, retrying at shorter target depths if the strict
 *  target depth can't be reached from random start words (rare). */
export function generateDaily(seed: number, bucket: LadderBucket): LadderLevel {
  const spec = SPECS[bucket];
  const strict = generate({
    wordLength: spec.wordLength,
    targetSteps: spec.targetSteps,
    seed,
  });
  if (strict) return strict;

  // Fall back to a shorter depth
  const relaxed = generate({
    wordLength: spec.wordLength,
    targetSteps: Math.max(3, spec.targetSteps - 2),
    seed: seed ^ 0x5A5A,
  });
  if (relaxed) return relaxed;

  // Final fallback: known trivial pair
  return {
    start: 'cold',
    end: 'cord',
    minSteps: 1,
    samplePath: ['cold', 'cord'],
  };
}
