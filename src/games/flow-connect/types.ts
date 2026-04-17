export interface Endpoint {
  col: number;
  row: number;
  /** Color index (0..N-1). Two endpoints share a color iff they are a pair. */
  color: number;
}

export interface FlowLevel {
  cols: number;
  rows: number;
  /** Two endpoints per color. Exactly 2 * numColors entries. */
  endpoints: Endpoint[];
  /** Optional pre-solved paths used by tests + difficulty scoring.
   *  Each entry is one color's full path from endpoint A to endpoint B
   *  (inclusive of both endpoints). */
  solution?: Array<Array<{ col: number; row: number }>>;
}

export const PALETTE: string[] = [
  '#D14E5C', // warm red
  '#E8A065', // warm orange
  '#8DC5A2', // sage green
  '#8B5E83', // plum
  '#D4A574', // sand
  '#6A8CAD', // dusty blue (accent)
  '#C57B9C', // rose
  '#9B6BC9', // lavender
];

/** Cell-level state during play. */
export interface CellFill {
  /** -1 = empty; otherwise the color index. */
  color: number;
}

/** Compress two (col,row) into a single integer key. Valid for cols*rows < 4096. */
export function cellKey(cols: number, col: number, row: number): number {
  return row * cols + col;
}

export function keyToColRow(cols: number, key: number): { col: number; row: number } {
  return { col: key % cols, row: Math.floor(key / cols) };
}

export function isAdjacent(
  a: { col: number; row: number },
  b: { col: number; row: number },
): boolean {
  const dc = Math.abs(a.col - b.col);
  const dr = Math.abs(a.row - b.row);
  return (dc === 1 && dr === 0) || (dc === 0 && dr === 1);
}
