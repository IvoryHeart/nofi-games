import { mulberry32, shuffle } from '../../utils/rng';
import { SokobanLevel, Tile, DIR_VECTORS, Direction, tileAt } from './types';
import { solveBestMoves } from './solver';

export type SokobanBucket = 'easy' | 'medium' | 'hard' | 'expert';

interface Spec {
  cols: number;
  rows: number;
  boxes: number;
  /** Accept threshold — generated puzzle must require at least this many
   *  player moves to solve (only checked when `verify` is true). */
  minMoves: number;
  /** Number of reverse-moves to apply from the solved state. */
  scrambleSteps: number;
  /** Minimum number of reverse-pulls applied during scrambling (not plain
   *  walks). Ensures the scramble actually displaced boxes even if the
   *  random action picker favours walks on a given run. */
  minPulls: number;
  /** Whether to verify minMoves with a forward BFS. Enabled for easy/medium
   *  where the state space is small enough for fast verification. Disabled
   *  for hard/expert where the solver would hang runtime generation — on
   *  those tiers solvability is still guaranteed by construction (reverse-
   *  play from solved) and difficulty comes from the scramble depth. */
  verify: boolean;
  solveBudget: number;
  /** Outer attempts before giving up and returning the best seen. */
  attempts: number;
}

const SPECS: Record<SokobanBucket, Spec> = {
  easy:   { cols: 6, rows: 6, boxes: 2, minMoves: 10, scrambleSteps:  40, minPulls:  6, verify: true,  solveBudget:  80_000, attempts: 25 },
  medium: { cols: 7, rows: 7, boxes: 3, minMoves: 18, scrambleSteps:  80, minPulls: 12, verify: true,  solveBudget: 200_000, attempts: 15 },
  hard:   { cols: 8, rows: 8, boxes: 4, minMoves: 30, scrambleSteps: 130, minPulls: 20, verify: false, solveBudget: 0,        attempts: 8  },
  expert: { cols: 9, rows: 9, boxes: 5, minMoves: 45, scrambleSteps: 190, minPulls: 30, verify: false, solveBudget: 0,        attempts: 8  },
};

interface ReverseState {
  player: { col: number; row: number };
  boxes: Array<{ col: number; row: number }>;
}

type ReverseAction =
  | { kind: 'walk'; playerTo: { col: number; row: number } }
  | {
      kind: 'pull';
      playerTo: { col: number; row: number };
      boxIdx: number;
      boxTo: { col: number; row: number };
    };

function collectReverseActions(
  state: ReverseState,
  tiles: Uint8Array,
  cols: number,
  rows: number,
): ReverseAction[] {
  const actions: ReverseAction[] = [];
  for (const dir of ['up', 'down', 'left', 'right'] as const) {
    const { dc, dr } = DIR_VECTORS[dir];
    // Target cell we're moving the player TO (direction of reverse movement).
    const newPlayerCol = state.player.col + dc;
    const newPlayerRow = state.player.row + dr;
    if (
      newPlayerCol < 0 || newPlayerCol >= cols ||
      newPlayerRow < 0 || newPlayerRow >= rows
    ) continue;
    const newTile = tiles[newPlayerRow * cols + newPlayerCol];
    if (newTile !== Tile.Floor && newTile !== Tile.Target) continue;
    if (state.boxes.some(b => b.col === newPlayerCol && b.row === newPlayerRow)) continue;

    // Plain reverse-walk is always available
    actions.push({
      kind: 'walk',
      playerTo: { col: newPlayerCol, row: newPlayerRow },
    });

    // Reverse-pull: box was one step BEHIND the player (opposite direction).
    // After the reverse move, the box moves to where the player was.
    // Mirrors forward-push: forward moves player into box space; reverse
    // moves box into player's space while player steps away.
    const boxFromCol = state.player.col - dc;
    const boxFromRow = state.player.row - dr;
    if (boxFromCol < 0 || boxFromCol >= cols || boxFromRow < 0 || boxFromRow >= rows) continue;
    const bIdx = state.boxes.findIndex(b => b.col === boxFromCol && b.row === boxFromRow);
    if (bIdx >= 0) {
      actions.push({
        kind: 'pull',
        playerTo: { col: newPlayerCol, row: newPlayerRow },
        boxIdx: bIdx,
        boxTo: { col: state.player.col, row: state.player.row },
      });
    }
    void dir;
  }
  return actions;
}

function applyReverseAction(state: ReverseState, a: ReverseAction): ReverseState {
  if (a.kind === 'walk') {
    return { player: a.playerTo, boxes: state.boxes };
  }
  const newBoxes = state.boxes.map((b, i) => i === a.boxIdx ? a.boxTo : b);
  return { player: a.playerTo, boxes: newBoxes };
}

/** Apply `steps` random reverse actions. Pulls are weighted 3× so the
 *  scramble actually moves boxes rather than walking the player around.
 *  Returns the final state plus the number of pulls applied. */
function reverseScramble(
  initial: ReverseState,
  tiles: Uint8Array,
  cols: number,
  rows: number,
  steps: number,
  rng: () => number,
): { state: ReverseState; pulls: number } {
  let state = initial;
  let pulls = 0;
  for (let s = 0; s < steps; s++) {
    const actions = collectReverseActions(state, tiles, cols, rows);
    if (actions.length === 0) break;
    const pullActions = actions.filter(a => a.kind === 'pull');
    const walkActions = actions.filter(a => a.kind === 'walk');
    const weighted: ReverseAction[] = [...pullActions, ...pullActions, ...pullActions, ...walkActions];
    const pick = weighted[Math.floor(rng() * weighted.length)];
    if (pick.kind === 'pull') pulls++;
    state = applyReverseAction(state, pick);
  }
  return { state, pulls };
}

/** Build a simple rectangular room with walled border and floor interior. */
function buildRoomTiles(cols: number, rows: number): Uint8Array {
  const tiles = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) tiles[idx] = Tile.Wall;
      else tiles[idx] = Tile.Floor;
    }
  }
  return tiles;
}

/** Pick target cells biased toward corners / edges of the interior, which
 *  produce more interesting puzzles than random interior placement. */
function pickTargets(cols: number, rows: number, n: number, rng: () => number): number[] {
  const candidates: Array<{ idx: number; score: number }> = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      // Score: higher for cells closer to a corner / edge
      const edgeProximity = Math.min(c - 1, cols - 2 - c) + Math.min(r - 1, rows - 2 - r);
      candidates.push({ idx: r * cols + c, score: -edgeProximity + rng() * 1.5 });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  // Take top 2/3 and pick n from them for some randomness
  const pool = candidates.slice(0, Math.max(n * 2, Math.floor(candidates.length * 0.6)));
  const shuffled = shuffle(pool.slice(), rng);
  const chosen: number[] = [];
  for (const c of shuffled) {
    if (chosen.length >= n) break;
    // Spread targets apart a bit so boxes don't start clumped
    let tooClose = false;
    for (const prev of chosen) {
      const pr = Math.floor(prev / cols), pc = prev % cols;
      const r = Math.floor(c.idx / cols), co = c.idx % cols;
      if (Math.abs(pr - r) + Math.abs(pc - co) <= 1) { tooClose = true; break; }
    }
    if (!tooClose) chosen.push(c.idx);
  }
  return chosen;
}

/** Generate a solvable Sokoban puzzle with at least `spec.minMoves` required
 *  forward moves. Because we scramble by reverse-play from the solved state,
 *  solvability is guaranteed by construction — we just verify minimum
 *  difficulty via a forward BFS. */
export function generate(seed: number, bucket: SokobanBucket): SokobanLevel {
  const spec = SPECS[bucket];
  const rng = mulberry32(seed);

  let best: SokobanLevel | null = null;
  let bestMoves = -1;

  for (let attempt = 0; attempt < spec.attempts; attempt++) {
    const tiles = buildRoomTiles(spec.cols, spec.rows);
    const targetIdxs = pickTargets(spec.cols, spec.rows, spec.boxes, rng);
    if (targetIdxs.length < spec.boxes) continue;
    for (const t of targetIdxs) tiles[t] = Tile.Target;

    // Initial reverse-scramble state: boxes on targets, player on a non-box
    // interior floor cell.
    const interior: number[] = [];
    for (let r = 1; r < spec.rows - 1; r++) {
      for (let c = 1; c < spec.cols - 1; c++) {
        interior.push(r * spec.cols + c);
      }
    }
    const boxSet = new Set(targetIdxs);
    const freeFloor = shuffle(interior.filter(i => !boxSet.has(i)), rng);
    if (freeFloor.length === 0) continue;
    const startPlayerIdx = freeFloor[0];

    const initState: ReverseState = {
      player: { col: startPlayerIdx % spec.cols, row: Math.floor(startPlayerIdx / spec.cols) },
      boxes: targetIdxs.map(i => ({ col: i % spec.cols, row: Math.floor(i / spec.cols) })),
    };

    const { state: scrambled, pulls } = reverseScramble(
      initState, tiles, spec.cols, spec.rows, spec.scrambleSteps, rng,
    );

    // Reject scrambles that didn't displace enough boxes. This is our
    // difficulty proxy on hard/expert tiers where the full BFS solver
    // can't finish in reasonable time.
    if (pulls < spec.minPulls) continue;

    // Also require every box to have moved off its target at least once.
    // (We only check current state — a box that was pulled off and later
    // landed back on its target counts as solved at start which makes
    // the puzzle feel incomplete.)
    let offTargetBoxes = 0;
    for (const b of scrambled.boxes) {
      if (tileAt({ cols: spec.cols, rows: spec.rows, tiles, player: scrambled.player, boxes: scrambled.boxes },
                 b.col, b.row) !== Tile.Target) offTargetBoxes++;
    }
    if (offTargetBoxes < Math.min(spec.boxes, 2)) continue;

    const level: SokobanLevel = {
      cols: spec.cols, rows: spec.rows, tiles,
      player: { col: scrambled.player.col, row: scrambled.player.row },
      boxes: scrambled.boxes,
    };

    // On small tiers, verify via forward BFS that the puzzle meets the
    // minimum-moves threshold. On large tiers, trust scramble count.
    if (!spec.verify) return level;
    const mm = solveBestMoves(level, spec.solveBudget);
    if (mm === null) continue;
    if (mm >= spec.minMoves) return level;
    if (mm > bestMoves) { best = level; bestMoves = mm; }
  }

  if (best) return best;

  // Absolute last resort: a guaranteed-solvable trivial puzzle. Won't be
  // hit in practice with the current spec values.
  const tiles = buildRoomTiles(5, 5);
  tiles[2 * 5 + 3] = Tile.Target;
  return {
    cols: 5, rows: 5, tiles,
    player: { col: 1, row: 2 },
    boxes: [{ col: 2, row: 2 }],
  };
}
