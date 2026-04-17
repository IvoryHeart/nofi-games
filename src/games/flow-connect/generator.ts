import { mulberry32, shuffle } from '../../utils/rng';
import { FlowLevel, Endpoint } from './types';

interface HamiltonianOptions {
  cols: number;
  rows: number;
  seed: number;
  /** Time budget (ms) to find a Hamiltonian path via DFS. DFS can occasionally
   *  take a long time on small grids; bail and try another seed. */
  budgetMs?: number;
}

/** Randomized DFS Hamiltonian-path search. Returns null if the budget is
 *  exhausted or no path exists (no path exists e.g. on certain bipartite
 *  colorings when start cell is wrong — the retry loop handles that). */
function findHamiltonianPath(
  opts: HamiltonianOptions,
): Array<{ col: number; row: number }> | null {
  const { cols, rows, budgetMs = 60 } = opts;
  const rng = mulberry32(opts.seed);
  const total = cols * rows;
  const visited = new Uint8Array(total);
  const path: Array<{ col: number; row: number }> = [];
  const deadline = Date.now() + budgetMs;

  const startCol = Math.floor(rng() * cols);
  const startRow = Math.floor(rng() * rows);
  visited[startRow * cols + startCol] = 1;
  path.push({ col: startCol, row: startRow });

  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];

  function dfs(): boolean {
    if (path.length === total) return true;
    if (Date.now() > deadline) return false;
    const curr = path[path.length - 1];
    // Shuffle direction order at each step for randomness. Apply Warnsdorff-
    // style neighbor ordering: prefer neighbors with fewer unvisited neighbors,
    // which biases toward corners/dead-ends first and dramatically speeds up
    // DFS on grids.
    const shuffled = shuffle(dirs.slice(), rng);
    const ordered = shuffled
      .map(([dc, dr]) => {
        const nc = curr.col + dc;
        const nr = curr.row + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) return null;
        if (visited[nr * cols + nc]) return null;
        // Degree = number of unvisited neighbors from this cell
        let deg = 0;
        for (const [dc2, dr2] of dirs) {
          const mc = nc + dc2;
          const mr = nr + dr2;
          if (mc < 0 || mc >= cols || mr < 0 || mr >= rows) continue;
          if (!visited[mr * cols + mc]) deg++;
        }
        return { nc, nr, deg };
      })
      .filter((x): x is { nc: number; nr: number; deg: number } => x !== null)
      .sort((a, b) => a.deg - b.deg);

    for (const { nc, nr } of ordered) {
      visited[nr * cols + nc] = 1;
      path.push({ col: nc, row: nr });
      if (dfs()) return true;
      path.pop();
      visited[nr * cols + nc] = 0;
    }
    return false;
  }

  return dfs() ? path : null;
}

/** Slice a Hamiltonian path into `numColors` contiguous segments of at least
 *  `minSegLen` cells. Returns the per-color path arrays. */
function sliceIntoColors(
  fullPath: Array<{ col: number; row: number }>,
  numColors: number,
  minSegLen: number,
  rng: () => number,
): Array<Array<{ col: number; row: number }>> | null {
  const total = fullPath.length;
  if (total < numColors * minSegLen) return null;

  // Generate `numColors - 1` internal split points. Segments must each be at
  // least minSegLen. Do rejection sampling: pick random splits until all
  // segments meet the minimum.
  for (let tries = 0; tries < 50; tries++) {
    const splits: number[] = [];
    for (let i = 0; i < numColors - 1; i++) {
      splits.push(Math.floor(rng() * (total - 1)) + 1);
    }
    splits.sort((a, b) => a - b);
    // Dedup + enforce monotonic increase
    const dedup = Array.from(new Set(splits));
    if (dedup.length !== numColors - 1) continue;

    const boundaries = [0, ...dedup, total];
    let ok = true;
    for (let i = 0; i < boundaries.length - 1; i++) {
      if (boundaries[i + 1] - boundaries[i] < minSegLen) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    const segments: Array<Array<{ col: number; row: number }>> = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      segments.push(fullPath.slice(boundaries[i], boundaries[i + 1]));
    }
    return segments;
  }
  return null;
}

export interface GenerateOptions {
  cols: number;
  rows: number;
  numColors: number;
  /** Minimum cells per color path. Paths of length 1 would mean both endpoints
   *  overlap — disallowed. 2+ is required; 3+ plays better. */
  minSegLen?: number;
  seed: number;
  /** Outer attempts to find a valid puzzle. */
  maxAttempts?: number;
}

/** Generate a solvable Flow Connect puzzle. Strategy: find a random
 *  Hamiltonian path on the grid, then slice it into `numColors` segments.
 *  Each segment becomes one color, with its first and last cells as
 *  endpoints. Coverage is guaranteed by construction. */
export function generate(opts: GenerateOptions): FlowLevel | null {
  const {
    cols,
    rows,
    numColors,
    minSegLen = 3,
    seed,
    maxAttempts = 12,
  } = opts;

  const outerRng = mulberry32(seed);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const innerSeed = Math.floor(outerRng() * 2_147_483_647);
    const path = findHamiltonianPath({ cols, rows, seed: innerSeed, budgetMs: 80 });
    if (!path) continue;
    const segments = sliceIntoColors(path, numColors, minSegLen, outerRng);
    if (!segments) continue;

    const endpoints: Endpoint[] = [];
    for (let c = 0; c < segments.length; c++) {
      const seg = segments[c];
      endpoints.push({ col: seg[0].col, row: seg[0].row, color: c });
      endpoints.push({ col: seg[seg.length - 1].col, row: seg[seg.length - 1].row, color: c });
    }

    return {
      cols,
      rows,
      endpoints,
      solution: segments,
    };
  }
  return null;
}

export type FlowBucket = 'easy' | 'medium' | 'hard' | 'expert';

/** Produce a best-effort daily puzzle for a bucket. Falls back to a simpler
 *  configuration if the strict target can't be generated quickly. */
export function generateDaily(seed: number, bucket: FlowBucket): FlowLevel {
  const specs = {
    easy:   { cols: 5, rows: 5, colors: 4 },
    medium: { cols: 6, rows: 6, colors: 5 },
    hard:   { cols: 7, rows: 7, colors: 6 },
    expert: { cols: 8, rows: 8, colors: 7 },
  } as const;
  const spec = specs[bucket];
  const strict = generate({
    cols: spec.cols,
    rows: spec.rows,
    numColors: spec.colors,
    seed,
  });
  if (strict) return strict;
  // Fallback: drop one color
  const relaxed = generate({
    cols: spec.cols,
    rows: spec.rows,
    numColors: Math.max(3, spec.colors - 1),
    seed: seed ^ 0xC3C3,
  });
  if (relaxed) return relaxed;
  // Last resort: a trivial 3x3 with 2 colors
  return {
    cols: 3,
    rows: 3,
    endpoints: [
      { col: 0, row: 0, color: 0 },
      { col: 2, row: 0, color: 0 },
      { col: 0, row: 2, color: 1 },
      { col: 2, row: 2, color: 1 },
    ],
  };
}
