import { SokobanLevel, Tile, DIR_VECTORS, tileAt } from './types';

/** BFS over (player, boxes) state space. Returns true if every box can reach
 *  a target. Used by tests and offline level validation — too expensive to
 *  call at runtime, so we only ship levels that pass this check. */
export function isSolvable(level: SokobanLevel, budget = 200_000): boolean {
  const totalBoxes = level.boxes.length;
  const targets: Array<{ col: number; row: number }> = [];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (tileAt(level, c, r) === Tile.Target) targets.push({ col: c, row: r });
    }
  }
  if (targets.length !== totalBoxes) return false;

  // Serialize a state as a string key for the seen set.
  const stateKey = (pc: number, pr: number, boxes: Array<{ col: number; row: number }>): string => {
    // Sort boxes so box-identity doesn't matter (permutations are the same state).
    const sorted = boxes
      .map(b => b.row * level.cols + b.col)
      .sort((a, b) => a - b);
    return `${pc},${pr}|${sorted.join(',')}`;
  };

  const isWin = (boxes: Array<{ col: number; row: number }>): boolean => {
    for (const b of boxes) {
      if (tileAt(level, b.col, b.row) !== Tile.Target) return false;
    }
    return true;
  };

  type State = {
    pc: number; pr: number;
    boxes: Array<{ col: number; row: number }>;
  };
  const initBoxes = level.boxes.map(b => ({ col: b.col, row: b.row }));
  const start: State = { pc: level.player.col, pr: level.player.row, boxes: initBoxes };
  if (isWin(start.boxes)) return true;

  const queue: State[] = [start];
  const seen = new Set<string>();
  seen.add(stateKey(start.pc, start.pr, start.boxes));
  let head = 0;

  while (head < queue.length) {
    if (seen.size > budget) return false; // too complex; give up as "unknown"
    const s = queue[head++];
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const { dc, dr } = DIR_VECTORS[dir];
      const nc = s.pc + dc;
      const nr = s.pr + dr;
      const t = tileAt(level, nc, nr);
      if (t === Tile.Empty || t === Tile.Wall) continue;

      const bIdx = s.boxes.findIndex(b => b.col === nc && b.row === nr);
      if (bIdx >= 0) {
        // Try to push
        const bc = nc + dc;
        const br = nr + dr;
        const bt = tileAt(level, bc, br);
        if (bt === Tile.Empty || bt === Tile.Wall) continue;
        if (s.boxes.some(b => b.col === bc && b.row === br)) continue;
        const newBoxes = s.boxes.map((b, i) => i === bIdx ? { col: bc, row: br } : b);
        const key = stateKey(nc, nr, newBoxes);
        if (seen.has(key)) continue;
        seen.add(key);
        if (isWin(newBoxes)) return true;
        queue.push({ pc: nc, pr: nr, boxes: newBoxes });
      } else {
        // Walk
        const key = stateKey(nc, nr, s.boxes);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ pc: nc, pr: nr, boxes: s.boxes });
      }
    }
  }
  return false;
}
