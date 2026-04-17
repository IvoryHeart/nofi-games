export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRS: Direction[] = ['up', 'down', 'left', 'right'];

export const DIR_VECTORS: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

export interface Level {
  cols: number;
  rows: number;
  /** Row-major flat array. 0 = empty (off-grid), 1 = floor tile. */
  cells: Uint8Array;
  /** Starting ball position (must be a floor cell). */
  start: { col: number; row: number };
}

export interface LevelStats {
  floorCount: number;
  minMoves: number;
  statesExplored: number;
  avgBranching: number;
  backtrackRatio: number;
  solutionCount: number;
  trapDirs: number;
  /** Normalized 0–100 difficulty score. */
  score: number;
}

/** Parse a compact string grid into a Level.
 *  '#' = floor, '@' = floor + ball start, anything else = empty. */
export function parseLevel(map: string[]): Level {
  const rows = map.length;
  const cols = Math.max(...map.map(r => r.length));
  const cells = new Uint8Array(cols * rows);
  let start: { col: number; row: number } | null = null;
  for (let r = 0; r < rows; r++) {
    const row = map[r];
    for (let c = 0; c < cols; c++) {
      const ch = c < row.length ? row[c] : ' ';
      if (ch === '#' || ch === '@') cells[r * cols + c] = 1;
      if (ch === '@') start = { col: c, row: r };
    }
  }
  if (!start) throw new Error('Level missing ball start (@)');
  return { cols, rows, cells, start };
}

export function cellAt(level: Level, col: number, row: number): number {
  if (col < 0 || col >= level.cols || row < 0 || row >= level.rows) return 0;
  return level.cells[row * level.cols + col];
}

export function isFloor(level: Level, col: number, row: number): boolean {
  return cellAt(level, col, row) === 1;
}

/** Enumerate all floor cell indexes. Order is stable (row-major). */
export function floorCells(level: Level): Array<{ col: number; row: number; index: number }> {
  const out: Array<{ col: number; row: number; index: number }> = [];
  let idx = 0;
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (level.cells[r * level.cols + c] === 1) {
        out.push({ col: c, row: r, index: idx++ });
      }
    }
  }
  return out;
}
