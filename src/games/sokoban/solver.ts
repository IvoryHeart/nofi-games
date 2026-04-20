import { SokobanLevel, Tile, DIR_VECTORS, tileAt } from './types';

function targetsMatch(level: SokobanLevel): boolean {
  let targets = 0;
  for (let i = 0; i < level.tiles.length; i++) {
    if (level.tiles[i] === Tile.Target) targets++;
  }
  return targets === level.boxes.length;
}

function stateKey(
  cols: number,
  pc: number,
  pr: number,
  boxes: Array<{ col: number; row: number }>,
): string {
  const sorted = boxes.map(b => b.row * cols + b.col).sort((a, b) => a - b);
  return `${pc},${pr}|${sorted.join(',')}`;
}

function isWin(
  level: SokobanLevel,
  boxes: Array<{ col: number; row: number }>,
): boolean {
  for (const b of boxes) {
    if (tileAt(level, b.col, b.row) !== Tile.Target) return false;
  }
  return true;
}

/** BFS over (player, boxes) state space. Returns true if every box can
 *  reach a target. Used by tests and offline level validation. */
export function isSolvable(level: SokobanLevel, budget = 200_000): boolean {
  if (!targetsMatch(level)) return false;
  const moves = solveBestMoves(level, budget);
  return moves !== null;
}

/** BFS that tracks depth. Returns the minimum number of PLAYER MOVES
 *  (walks + pushes each count as one) needed to solve the puzzle, or
 *  `null` if the puzzle is unsolvable or the BFS exceeds `budget`. */
export function solveBestMoves(level: SokobanLevel, budget = 500_000): number | null {
  if (!targetsMatch(level)) return null;
  const initBoxes = level.boxes.map(b => ({ col: b.col, row: b.row }));
  if (isWin(level, initBoxes)) return 0;

  type State = {
    pc: number; pr: number;
    boxes: Array<{ col: number; row: number }>;
    depth: number;
  };
  const start: State = {
    pc: level.player.col, pr: level.player.row, boxes: initBoxes, depth: 0,
  };
  const queue: State[] = [start];
  const seen = new Set<string>();
  seen.add(stateKey(level.cols, start.pc, start.pr, start.boxes));
  let head = 0;

  while (head < queue.length) {
    if (seen.size > budget) return null;
    const s = queue[head++];
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const { dc, dr } = DIR_VECTORS[dir];
      const nc = s.pc + dc;
      const nr = s.pr + dr;
      const t = tileAt(level, nc, nr);
      if (t === Tile.Empty || t === Tile.Wall) continue;

      const bIdx = s.boxes.findIndex(b => b.col === nc && b.row === nr);
      if (bIdx >= 0) {
        const bc = nc + dc;
        const br = nr + dr;
        const bt = tileAt(level, bc, br);
        if (bt === Tile.Empty || bt === Tile.Wall) continue;
        if (s.boxes.some(b => b.col === bc && b.row === br)) continue;
        const newBoxes = s.boxes.map((b, i) => i === bIdx ? { col: bc, row: br } : b);
        const key = stateKey(level.cols, nc, nr, newBoxes);
        if (seen.has(key)) continue;
        seen.add(key);
        if (isWin(level, newBoxes)) return s.depth + 1;
        queue.push({ pc: nc, pr: nr, boxes: newBoxes, depth: s.depth + 1 });
      } else {
        const key = stateKey(level.cols, nc, nr, s.boxes);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ pc: nc, pr: nr, boxes: s.boxes, depth: s.depth + 1 });
      }
    }
  }
  return null;
}
