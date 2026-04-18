import { mulberry32 } from '../../utils/rng';
import { Level, Direction, DIR_VECTORS } from './types';
import { solve, scoreDifficulty, bucketFor, DifficultyBucket, SolveResult } from './solver';

export interface GenerateOptions {
  /** Target cols×rows bounding box. Generator carves floor inside this box. */
  cols: number;
  rows: number;
  /** Target number of floor cells. */
  targetFloor: number;
  /** Attempts cap before giving up. */
  maxAttempts?: number;
  /** Seed for determinism. */
  seed: number;
  /** Optional target difficulty bucket; generator retries until it finds one. */
  targetBucket?: DifficultyBucket;
  /** Optional min/max score range (overrides targetBucket if both set). */
  minScore?: number;
  maxScore?: number;
}

export interface GeneratedLevel {
  level: Level;
  result: SolveResult;
  score: number;
  bucket: DifficultyBucket;
}

/** Carve a connected blob of floor tiles inside a cols×rows box using a
 *  growth-from-seed algorithm. Returns null if it couldn't reach target size. */
function carveBlob(
  cols: number,
  rows: number,
  targetFloor: number,
  rng: () => number,
): Uint8Array | null {
  const cells = new Uint8Array(cols * rows);
  const frontier: Array<{ c: number; r: number }> = [];

  // Seed at a random position
  const sc = Math.floor(rng() * cols);
  const sr = Math.floor(rng() * rows);
  cells[sr * cols + sc] = 1;
  frontier.push({ c: sc, r: sr });
  let count = 1;

  const dirs: Direction[] = ['up', 'down', 'left', 'right'];
  let safety = 0;
  while (count < targetFloor && frontier.length > 0 && safety < targetFloor * 20) {
    safety++;
    // Pick a random frontier cell
    const idx = Math.floor(rng() * frontier.length);
    const cell = frontier[idx];
    // Pick a random direction
    const dir = dirs[Math.floor(rng() * 4)];
    const { dc, dr } = DIR_VECTORS[dir];
    const nc = cell.c + dc;
    const nr = cell.r + dr;
    if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) {
      // retry — but occasionally evict stale frontier cells
      if (rng() < 0.05) frontier.splice(idx, 1);
      continue;
    }
    const k = nr * cols + nc;
    if (cells[k] === 1) continue;
    cells[k] = 1;
    frontier.push({ c: nc, r: nr });
    count++;
  }

  if (count < targetFloor) return null;
  return cells;
}

/** Trim the blob's bounding box so the level doesn't carry empty margin. */
function trimBBox(
  cells: Uint8Array,
  cols: number,
  rows: number,
): { cells: Uint8Array; cols: number; rows: number; offsetC: number; offsetR: number } {
  let minC = cols, maxC = -1, minR = rows, maxR = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r * cols + c] === 1) {
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
      }
    }
  }
  if (maxC < 0) {
    return { cells, cols, rows, offsetC: 0, offsetR: 0 };
  }
  const newCols = maxC - minC + 1;
  const newRows = maxR - minR + 1;
  const out = new Uint8Array(newCols * newRows);
  for (let r = 0; r < newRows; r++) {
    for (let c = 0; c < newCols; c++) {
      out[r * newCols + c] = cells[(r + minR) * cols + (c + minC)];
    }
  }
  return { cells: out, cols: newCols, rows: newRows, offsetC: minC, offsetR: minR };
}

/** Count a cell's non-floor neighbors (off-grid counts too). 0 = interior,
 *  1 = edge, 2+ = corner-ish. Used to prefer corner starts where the player
 *  has a guaranteed blocked direction as a visual anchor. */
function wallNeighborCount(
  cells: Uint8Array,
  cols: number,
  rows: number,
  idx: number,
): number {
  const r = Math.floor(idx / cols);
  const c = idx % cols;
  const neighbors: Array<[number, number]> = [
    [c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1],
  ];
  let count = 0;
  for (const [nc, nr] of neighbors) {
    if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) count++;
    else if (cells[nr * cols + nc] === 0) count++;
  }
  return count;
}

/** Generate one puzzle. Returns null if no solvable puzzle matches constraints. */
export function generate(opts: GenerateOptions): GeneratedLevel | null {
  const {
    cols,
    rows,
    targetFloor,
    maxAttempts = 200,
    seed,
    targetBucket,
    minScore,
    maxScore,
  } = opts;

  const rng = mulberry32(seed);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const raw = carveBlob(cols, rows, targetFloor, rng);
    if (!raw) continue;
    const trimmed = trimBBox(raw, cols, rows);

    // Collect floor cells and rank by wall-neighbor count — corner-ish cells
    // (>=2 non-floor neighbors) are preferred, then edge cells. Interior
    // cells (count=0) are excluded entirely because they produce "trick"
    // puzzles where only one first-move sequence works and the player has
    // no visual cue for what to try first.
    type Candidate = { idx: number; walls: number; jitter: number };
    const candidates: Candidate[] = [];
    for (let i = 0; i < trimmed.cells.length; i++) {
      if (trimmed.cells[i] !== 1) continue;
      const walls = wallNeighborCount(trimmed.cells, trimmed.cols, trimmed.rows, i);
      if (walls === 0) continue; // skip interior cells
      candidates.push({ idx: i, walls, jitter: rng() });
    }
    // Fallback if the shape has no perimeter cells (impossible for carveBlob
    // output, but safe against degenerate inputs): allow any floor cell.
    if (candidates.length === 0) {
      for (let i = 0; i < trimmed.cells.length; i++) {
        if (trimmed.cells[i] === 1) {
          candidates.push({ idx: i, walls: 0, jitter: rng() });
        }
      }
    }
    // Sort: higher wall count first, then random tiebreaker.
    candidates.sort((a, b) => b.walls - a.walls || a.jitter - b.jitter);

    const maxStarts = Math.min(6, candidates.length);
    for (let s = 0; s < maxStarts; s++) {
      const startIdx = candidates[s].idx;
      const startRow = Math.floor(startIdx / trimmed.cols);
      const startCol = startIdx % trimmed.cols;
      const level: Level = {
        cols: trimmed.cols,
        rows: trimmed.rows,
        cells: trimmed.cells.slice(),
        start: { col: startCol, row: startRow },
      };
      // Fast solve first to filter — skip the costly solution-count pass.
      const fast = solve(level, { skipSolutionCount: true });
      if (!fast) continue;
      const approxScore = scoreDifficulty(fast);
      const approxBucket = bucketFor(approxScore);

      const minOk = minScore !== undefined ? approxScore >= minScore : true;
      const maxOk = maxScore !== undefined ? approxScore <= maxScore : true;
      const bucketOk = targetBucket ? approxBucket === targetBucket : true;
      if (minOk && maxOk && bucketOk) {
        // Passed filter — do the full scoring pass once for the chosen level.
        const full = solve(level) ?? fast;
        const score = scoreDifficulty(full);
        return { level, result: full, score, bucket: bucketFor(score) };
      }
    }
  }

  return null;
}

/** Generate a puzzle with a best-effort bucket match. Tries expanding the
 *  search relaxation if the strict target can't be found. Used by Daily Mode
 *  so we always return *something* valid, even if the score is off-target. */
export function generateDaily(seed: number, bucket: DifficultyBucket): GeneratedLevel {
  const sizeByBucket = {
    easy:   { cols: 4, rows: 5, floor: 10 },
    medium: { cols: 5, rows: 6, floor: 18 },
    hard:   { cols: 6, rows: 8, floor: 28 },
    expert: { cols: 8, rows: 10, floor: 42 },
  } as const;
  // Score windows per bucket — allow some flex so generation doesn't retry
  // forever trying to hit a narrow score band.
  const windowByBucket = {
    easy:   { min: 0,  max: 28 },
    medium: { min: 28, max: 55 },
    hard:   { min: 55, max: 85 },
    expert: { min: 80, max: 300 },
  } as const;
  const spec = sizeByBucket[bucket];
  const win = windowByBucket[bucket];

  const strict = generate({
    cols: spec.cols,
    rows: spec.rows,
    targetFloor: spec.floor,
    seed,
    minScore: win.min,
    maxScore: win.max,
    maxAttempts: 60,
  });
  if (strict) return strict;

  // Relax: accept any solvable puzzle at this size
  const relaxed = generate({
    cols: spec.cols,
    rows: spec.rows,
    targetFloor: spec.floor,
    seed: seed ^ 0xA5A5,
    maxAttempts: 80,
  });
  if (relaxed) return relaxed;

  // Shrink: try a step down in bucket size — some seeds stubbornly refuse
  // larger grids, usually because carveBlob can't grow enough or the solver
  // cap trips on too many dense shapes. Smaller grids almost always yield.
  const shrunk = generate({
    cols: Math.max(3, spec.cols - 2),
    rows: Math.max(3, spec.rows - 2),
    targetFloor: Math.max(6, Math.floor(spec.floor * 0.6)),
    seed: seed ^ 0x7E7E,
    maxAttempts: 60,
  });
  if (shrunk) return shrunk;

  // Last resort: a 1×4 straight corridor. One move, fully paintable — the
  // shape is trivially solvable, unlike 3×3 all-floor where the ball
  // cannot paint the centre cell from a corner start.
  const cells = new Uint8Array(4);
  cells.fill(1);
  const trivial: Level = { cols: 4, rows: 1, cells, start: { col: 0, row: 0 } };
  const solved = solve(trivial);
  return {
    level: trivial,
    result: solved!,
    score: 5,
    bucket: 'easy',
  };
}
