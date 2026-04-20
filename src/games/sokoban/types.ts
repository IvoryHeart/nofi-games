export const enum Tile {
  Empty = 0,    // off-grid / void
  Floor = 1,
  Wall = 2,
  Target = 3,   // floor with a target dot underneath
}

export interface Box {
  col: number;
  row: number;
}

export interface SokobanLevel {
  cols: number;
  rows: number;
  /** Row-major flat array of Tile values. */
  tiles: Uint8Array;
  player: { col: number; row: number };
  boxes: Box[];
}

/** Parse a compact string grid. Characters:
 *   '#'  wall
 *   '.'  floor
 *   '!'  target (empty)
 *   '$'  box on floor
 *   '*'  box on target
 *   '@'  player on floor
 *   '+'  player on target
 *  Anything else is void (off-grid). Trailing void rows/columns are kept
 *  so authors can line up levels visually with consistent widths. */
export function parseLevel(map: string[]): SokobanLevel {
  const rows = map.length;
  const cols = Math.max(...map.map(r => r.length));
  const tiles = new Uint8Array(cols * rows);
  const boxes: Box[] = [];
  let player: { col: number; row: number } | null = null;

  for (let r = 0; r < rows; r++) {
    const row = map[r];
    for (let c = 0; c < cols; c++) {
      const ch = c < row.length ? row[c] : ' ';
      const idx = r * cols + c;
      switch (ch) {
        case '#': tiles[idx] = Tile.Wall; break;
        case '.': tiles[idx] = Tile.Floor; break;
        case '!': tiles[idx] = Tile.Target; break;
        case '$': tiles[idx] = Tile.Floor; boxes.push({ col: c, row: r }); break;
        case '*': tiles[idx] = Tile.Target; boxes.push({ col: c, row: r }); break;
        case '@': tiles[idx] = Tile.Floor; player = { col: c, row: r }; break;
        case '+': tiles[idx] = Tile.Target; player = { col: c, row: r }; break;
        default: tiles[idx] = Tile.Empty;
      }
    }
  }

  if (!player) throw new Error('Level missing player (@ or +)');
  if (boxes.length === 0) throw new Error('Level has no boxes');
  return { cols, rows, tiles, player, boxes };
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIR_VECTORS: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

export function tileAt(level: SokobanLevel, col: number, row: number): Tile {
  if (col < 0 || col >= level.cols || row < 0 || row >= level.rows) return Tile.Empty;
  return level.tiles[row * level.cols + col] as Tile;
}

export function boxAt(boxes: Box[], col: number, row: number): number {
  for (let i = 0; i < boxes.length; i++) {
    if (boxes[i].col === col && boxes[i].row === row) return i;
  }
  return -1;
}
