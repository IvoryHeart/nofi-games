import { Level, Direction, DIRS, DIR_VECTORS, LevelStats, floorCells, isFloor } from './types';

/** Simulate a slide from (col, row) in the given direction. Returns the ending
 *  cell (the last floor cell before the ball would leave the grid or hit empty).
 *  Also returns the list of cells traversed, inclusive of start and end. */
export function slide(
  level: Level,
  col: number,
  row: number,
  dir: Direction,
): { col: number; row: number; path: Array<{ col: number; row: number }> } {
  const { dc, dr } = DIR_VECTORS[dir];
  const path: Array<{ col: number; row: number }> = [{ col, row }];
  let c = col;
  let r = row;
  while (isFloor(level, c + dc, r + dr)) {
    c += dc;
    r += dr;
    path.push({ col: c, row: r });
  }
  return { col: c, row: r, path };
}

interface SearchNode {
  col: number;
  row: number;
  mask: bigint;
  dist: number;
  prev: SearchNode | null;
  dir: Direction | null;
}

/** Cap BFS to this many states. Far beyond any puzzle we'd ship, but bounds
 *  the cost of pathological inputs the generator might throw at it. */
const MAX_STATES = 150_000;

export interface SolveResult {
  /** Minimal number of slides required to paint every floor cell. */
  minMoves: number;
  /** One optimal move sequence. */
  solution: Direction[];
  /** Number of unique (pos, mask) states explored by BFS. */
  statesExplored: number;
  /** Count of optimal-length solutions. */
  solutionCount: number;
  /** Avg legal move count for states along the optimal path. */
  avgBranching: number;
  /** Fraction of moves on the optimal path that revisit painted cells. */
  backtrackRatio: number;
  /** Moves from states-along-path that lead into dead states (unsolvable). */
  trapDirs: number;
  /** Total floor cells in the level. */
  floorCount: number;
}

export interface SolveOptions {
  /** Skip the optimal-solution counting pass. Speeds up generator filtering
   *  at the cost of reporting solutionCount as 1. Default: false. */
  skipSolutionCount?: boolean;
}

/** BFS solver. Returns `null` if no solution exists.
 *  Complexity bounded by the number of (pos, paintedMask) states.
 *  For our puzzle sizes (≤ ~50 floor cells, ≤ ~400 positions) this is fine. */
export function solve(level: Level, opts: SolveOptions = {}): SolveResult | null {
  const floors = floorCells(level);
  const floorCount = floors.length;
  if (floorCount === 0) return null;

  // Build a lookup from (col,row) → bit index
  const bitIdx = new Map<number, number>();
  for (const f of floors) {
    bitIdx.set(f.row * level.cols + f.col, f.index);
  }

  const totalMask = (1n << BigInt(floorCount)) - 1n;
  const startKey = level.start.row * level.cols + level.start.col;
  const startBit = bitIdx.get(startKey);
  if (startBit === undefined) return null; // start isn't a floor cell

  const startMask = 1n << BigInt(startBit);
  const seen = new Map<string, SearchNode>();
  const startKeyStr = `${level.start.col},${level.start.row}|${startMask.toString(16)}`;
  const startNode: SearchNode = {
    col: level.start.col,
    row: level.start.row,
    mask: startMask,
    dist: 0,
    prev: null,
    dir: null,
  };
  seen.set(startKeyStr, startNode);

  const queue: SearchNode[] = [startNode];
  let head = 0;
  let firstWin: SearchNode | null = null;

  while (head < queue.length) {
    if (seen.size > MAX_STATES) return null; // puzzle too complex to solve — reject
    const node = queue[head++];
    if (node.mask === totalMask) {
      firstWin = node;
      break;
    }
    for (const dir of DIRS) {
      const end = slide(level, node.col, node.row, dir);
      if (end.col === node.col && end.row === node.row) continue;
      let mask = node.mask;
      for (const cell of end.path) {
        const k = cell.row * level.cols + cell.col;
        const bit = bitIdx.get(k);
        if (bit !== undefined) mask |= 1n << BigInt(bit);
      }
      const key = `${end.col},${end.row}|${mask.toString(16)}`;
      if (seen.has(key)) continue;
      const next: SearchNode = {
        col: end.col,
        row: end.row,
        mask,
        dist: node.dist + 1,
        prev: node,
        dir,
      };
      seen.set(key, next);
      queue.push(next);
    }
  }

  if (!firstWin) return null;

  // Reconstruct one solution path
  const solution: Direction[] = [];
  const path: SearchNode[] = [];
  for (let n: SearchNode | null = firstWin; n; n = n.prev) {
    path.unshift(n);
    if (n.dir) solution.unshift(n.dir);
  }

  // Branching + backtracking metrics along the solution path.
  // Trap detection is intentionally skipped — computing it exactly requires
  // a reverse-reachability pass over the entire state graph which dominates
  // runtime on larger puzzles. The remaining signals (moves, states, branching,
  // backtrack, solution count) are enough to bucket difficulty reliably.
  let branchingSum = 0;
  let branchingCount = 0;
  let backtrackMoves = 0;

  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    let legalMoves = 0;
    for (const dir of DIRS) {
      const end = slide(level, node.col, node.row, dir);
      if (end.col === node.col && end.row === node.row) continue;
      legalMoves++;
    }
    branchingSum += legalMoves;
    branchingCount++;

    // Backtrack: if on this slide the destination was already painted before slide
    if (i > 0) {
      const prev = path[i - 1];
      const endBit = bitIdx.get(node.row * level.cols + node.col);
      if (endBit !== undefined && (prev.mask & (1n << BigInt(endBit))) !== 0n) {
        backtrackMoves++;
      }
    }
  }

  const solutionCount = opts.skipSolutionCount
    ? 1
    : countOptimalSolutions(level, firstWin.dist, bitIdx, totalMask);

  return {
    minMoves: firstWin.dist,
    solution,
    statesExplored: seen.size,
    solutionCount,
    avgBranching: branchingCount > 0 ? branchingSum / branchingCount : 0,
    backtrackRatio: path.length > 1 ? backtrackMoves / (path.length - 1) : 0,
    trapDirs: 0,
    floorCount,
  };
}

/** Count optimal-length solutions by running a layered BFS (depth-bounded).
 *  For deep or wide puzzles we bail and return 1 — the solution-count signal
 *  is a small contributor to difficulty scoring, not worth a long wait. */
function countOptimalSolutions(
  level: Level,
  targetDepth: number,
  bitIdx: Map<number, number>,
  totalMask: bigint,
): number {
  if (targetDepth > 25) return 1;
  const startBit = bitIdx.get(level.start.row * level.cols + level.start.col)!;
  const startMask = 1n << BigInt(startBit);
  const startKey = `${level.start.col},${level.start.row}|${startMask.toString(16)}`;
  type LS = { col: number; row: number; mask: bigint };
  const ways = new Map<string, number>();
  ways.set(startKey, 1);
  let frontier: LS[] = [{ col: level.start.col, row: level.start.row, mask: startMask }];

  for (let d = 0; d < targetDepth; d++) {
    const next: LS[] = [];
    const nextWays = new Map<string, number>();
    for (const node of frontier) {
      const fromKey = `${node.col},${node.row}|${node.mask.toString(16)}`;
      const fromWays = ways.get(fromKey) ?? 0;
      if (fromWays === 0) continue;
      for (const dir of DIRS) {
        const end = slide(level, node.col, node.row, dir);
        if (end.col === node.col && end.row === node.row) continue;
        let mask = node.mask;
        for (const cell of end.path) {
          const k = cell.row * level.cols + cell.col;
          const bit = bitIdx.get(k);
          if (bit !== undefined) mask |= 1n << BigInt(bit);
        }
        const key = `${end.col},${end.row}|${mask.toString(16)}`;
        const prev = nextWays.get(key) ?? 0;
        if (prev === 0) next.push({ col: end.col, row: end.row, mask });
        nextWays.set(key, prev + fromWays);
      }
    }
    frontier = next;
    if (frontier.length > 20_000) return 1; // give up — rare and not useful
    for (const [k, v] of nextWays) ways.set(k, v);
  }
  let total = 0;
  for (const n of frontier) {
    if (n.mask === totalMask) {
      const k = `${n.col},${n.row}|${n.mask.toString(16)}`;
      total += ways.get(k) ?? 0;
    }
  }
  return total;
}

/** Compute a normalized 0–100 difficulty score from a solve result. Weights
 *  are chosen so that a trivial 3-move puzzle sits near 5 and a dense 25-move
 *  puzzle with traps approaches 90. */
export function scoreDifficulty(r: SolveResult): number {
  const movesComp = Math.min(r.minMoves / 30, 1) * 30; // 0..30
  const statesComp = Math.min(Math.log2(Math.max(r.statesExplored, 1)) / 14, 1) * 20; // 0..20
  const branchComp = Math.min(Math.max((r.avgBranching - 1) / 2, 0), 1) * 15; // 0..15
  const backtrackComp = Math.min(r.backtrackRatio * 2.5, 1) * 15; // 0..15
  const uniqueComp = (r.solutionCount <= 1 ? 1 : 1 / Math.log2(r.solutionCount + 1)) * 10; // 0..10
  const trapComp = Math.min(r.trapDirs / 10, 1) * 10; // 0..10
  return Math.round(movesComp + statesComp + branchComp + backtrackComp + uniqueComp + trapComp);
}

export function stats(level: Level): LevelStats | null {
  const r = solve(level);
  if (!r) return null;
  return {
    floorCount: r.floorCount,
    minMoves: r.minMoves,
    statesExplored: r.statesExplored,
    avgBranching: r.avgBranching,
    backtrackRatio: r.backtrackRatio,
    solutionCount: r.solutionCount,
    trapDirs: r.trapDirs,
    score: scoreDifficulty(r),
  };
}

export type DifficultyBucket = 'easy' | 'medium' | 'hard' | 'expert';

export function bucketFor(score: number): DifficultyBucket {
  if (score < 25) return 'easy';
  if (score < 50) return 'medium';
  if (score < 75) return 'hard';
  return 'expert';
}
