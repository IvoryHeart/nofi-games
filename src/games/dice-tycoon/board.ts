/**
 * Dice Tycoon — board generation (pure logic).
 *
 * No DOM, no canvas, no imports from other dice-tycoon files, and NEVER
 * `Math.random()`. All randomness flows through an injected `rng: () => number`
 * (a float in [0, 1)), so a given seed + boardLevel always yields an identical
 * board — required for Daily Mode determinism.
 *
 * See docs/plans/dice-tycoon.md §5.1 (board), §5.2 (tiles), §5.4 (landmarks).
 */

/** 40-tile looping ring (standard board size). Corners sit at indices
 *  0, 10, 20, 30 (= 0, N/4, N/2, 3N/4); railroad "Depot" tiles at 5/15/25/35. */
export const BOARD_SIZE = 40;

export type TileType =
  | 'go'
  | 'property'
  | 'tax'
  | 'chance'
  | 'treasure'
  | 'railroad'
  | 'jail'
  | 'parking'
  | 'gotojail';

/** A Depot (railroad) tile runs one of two mini-events when landed on:
 *  'heist'    — steal coins from a rival via the 3-vault pick (tiered).
 *  'shutdown' — demolish one of a rival's landmarks for a cash payout.
 *  The four depots alternate (seeded) between the two modes. */
export type DepotMode = 'heist' | 'shutdown';

export interface Tile {
  /** Position on the ring, 0..BOARD_SIZE-1. */
  index: number;
  type: TileType;
  /** Short human label. */
  name: string;
  /** property: payout base; tax: penalty base; everything else: 0. */
  baseValue: number;
  /** property only: plaza color-group band (0..5). Undefined for non-property
   *  tiles. Renderers may fall back to `index % 6` when absent (legacy saves). */
  band?: number;
  /** railroad/Depot only: which mini-event this depot runs ('heist'|'shutdown').
   *  Absent on non-depot tiles and on legacy saves (treated as 'heist'). */
  depotMode?: DepotMode;
}

export interface BoardTheme {
  name: string;
  /** Exactly 4 landmark names. */
  landmarkNames: string[];
}

export interface Card {
  /** Human-readable description. */
  text: string;
  kind: 'coins' | 'dice' | 'shield' | 'sticker' | 'move';
  /** coins/dice count, sticker/shield count, or — for 'move' — a target tile index. */
  amount: number;
}

/** The four corner tile types, in clockwise order from index 0. */
const CORNER_TYPES: readonly TileType[] = ['go', 'jail', 'parking', 'gotojail'];

/** Corner ring index for slot k (0..3): 0, N/4, N/2, 3N/4. Derived from
 *  BOARD_SIZE so the corners always sit a quarter-lap apart. */
export function cornerIndex(slot: number): number {
  return ((slot % 4) * BOARD_SIZE) / 4;
}

/** The corner index → type map, derived from BOARD_SIZE (0/10/20/30 at N=40). */
const CORNERS: Record<number, TileType> = (() => {
  const m: Record<number, TileType> = {};
  for (let k = 0; k < 4; k++) m[cornerIndex(k)] = CORNER_TYPES[k];
  return m;
})();

/** Ring index of the Jail/Lockup corner (target of "Go To Jail"). N/4. */
export const JAIL_INDEX = cornerIndex(1);

/** Railroad/Depot ring indices: the classic mid-side positions 5/15/25/35
 *  (= corner + N/8). Derived from BOARD_SIZE. */
export function railroadIndices(): number[] {
  const off = BOARD_SIZE / 8;
  const out: number[] = [];
  for (let k = 0; k < 4; k++) out.push(cornerIndex(k) + off);
  return out;
}

/**
 * Assign each of the 4 Depot tiles a mini-event mode, alternating
 * heist/shutdown around the ring from a seeded starting parity. This guarantees
 * a MIX every board (2 heists + 2 shutdowns) while the starting parity varies
 * deterministically by seed — so a given seed/level is reproducible (Daily Mode).
 *
 * Returns an index→mode map keyed by the railroad ring indices (5/15/25/35).
 */
export function depotModes(rng: () => number): Record<number, DepotMode> {
  const indices = railroadIndices();
  // Seeded starting parity: 0 → [heist, shutdown, heist, shutdown], 1 → swapped.
  const startShutdown = randInt(rng, 2) === 1;
  const map: Record<number, DepotMode> = {};
  for (let k = 0; k < indices.length; k++) {
    const isShutdown = (k % 2 === 0) === startShutdown;
    map[indices[k]] = isShutdown ? 'shutdown' : 'heist';
  }
  return map;
}

/** Themed board sets. Rotated by boardLevel so each board feels fresh. */
const THEMES: ReadonlyArray<{
  name: string;
  landmarkNames: [string, string, string, string];
  /** Pool of label words for property tiles. */
  propertyNames: readonly string[];
}> = [
  {
    name: 'Old Town',
    landmarkNames: ['Town Hall', 'Clock Tower', 'Grand Library', 'Old Cathedral'],
    propertyNames: ['Baker St', 'Mill Lane', 'Market Row', 'Cobble Way', 'Iron Gate', 'Harbour Side'],
  },
  {
    name: 'Neon City',
    landmarkNames: ['Sky Spire', 'Hologram Plaza', 'Pulse Arena', 'Cyber Dome'],
    propertyNames: ['Neon Ave', 'Pixel Plaza', 'Volt Quay', 'Laser Loop', 'Chrome Walk', 'Synth Strip'],
  },
  {
    name: 'Sunset Beach',
    landmarkNames: ['Lighthouse', 'Boardwalk Pier', 'Coral Resort', 'Marina Bay'],
    propertyNames: ['Palm Cove', 'Surf Road', 'Shell Bay', 'Tide Walk', 'Reef Point', 'Dune Drive'],
  },
  {
    name: 'Frostpeak',
    landmarkNames: ['Ice Palace', 'Aurora Lodge', 'Glacier Bridge', 'Summit Observatory'],
    propertyNames: ['Frost Lane', 'Pine Ridge', 'Snowfall Way', 'Crystal Pass', 'Glacier Row', 'North Trail'],
  },
];

/** Pick a theme deterministically by board level (1-based or 0-based both fine). */
function themeForLevel(boardLevel: number): (typeof THEMES)[number] {
  const lvl = Number.isFinite(boardLevel) ? Math.floor(boardLevel) : 1;
  // Guard negative/zero so the modulo index is always valid.
  const idx = ((lvl % THEMES.length) + THEMES.length) % THEMES.length;
  return THEMES[idx];
}

/** The theme NAME a given board level resolves to (matches generateBoard's
 *  rotation). Exported so the World Map view can label upcoming/locked islands
 *  without generating their boards. */
export function themeNameForLevel(boardLevel: number): string {
  return themeForLevel(boardLevel).name;
}

/** Integer in [0, max). Guards a zero/invalid max. */
function randInt(rng: () => number, max: number): number {
  if (max <= 0) return 0;
  return Math.floor(rng() * max) % max;
}

/**
 * Generate a deterministic BOARD_SIZE-tile board for the given rng sequence +
 * level (standard 40-space layout).
 *
 * Guarantees:
 *  - exactly BOARD_SIZE tiles, indices 0..BOARD_SIZE-1
 *  - corners fixed at 0/N4/N2/3N4: go=Start, jail=Lockup, parking=Vacation,
 *    gotojail=Customs (derived from BOARD_SIZE via cornerIndex())
 *  - 4 railroad "Depot" tiles at the classic mid-side spots 5/15/25/35
 *  - 2 tax (Levy), 3 chance (Fortune) and 3 treasure (Vault) spread around
 *  - all remaining slots are property "Plaza" tiles, in color groups of 2–3
 *    that cycle the 6 plaza bands with baseValue increasing clockwise
 *  - baseValue scales with boardLevel; deterministic from rng+level
 */
export function generateBoard(
  rng: () => number,
  boardLevel: number,
): { tiles: Tile[]; theme: BoardTheme } {
  const lvl = Number.isFinite(boardLevel) && boardLevel >= 1 ? Math.floor(boardLevel) : 1;
  const theme = themeForLevel(lvl);

  const types: Record<number, TileType> = {};

  // Fixed railroads at the four mid-side positions.
  for (const r of railroadIndices()) types[r] = 'railroad';

  // Seeded Heist/Shutdown split across the 4 depots (drawn here so the rng
  // sequence stays deterministic for a given seed/level).
  const modes = depotModes(rng);

  // The non-corner, non-railroad slots, in clockwise order.
  const open: number[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (i in CORNERS) continue;
    if (types[i] === 'railroad') continue;
    open.push(i);
  }

  // Spread the special tiles (2 tax + 3 chance + 3 treasure) deterministically
  // across the open slots so each side of the board has a mix and properties
  // still form runs. We pick evenly-spaced positions within `open`, nudged by
  // the rng so a given seed/level varies which exact open slots get specials.
  const specials: TileType[] = ['tax', 'tax', 'chance', 'chance', 'chance', 'treasure', 'treasure', 'treasure'];
  const n = open.length;
  const stride = n / specials.length;
  const used = new Set<number>();
  for (let s = 0; s < specials.length; s++) {
    // Evenly-spaced anchor + a small seeded jitter, clamped into a unique slot.
    let p = Math.floor(s * stride + randInt(rng, Math.max(1, Math.floor(stride))));
    let guard = 0;
    while ((used.has(p) || p >= n) && guard++ < n) p = (p + 1) % n;
    used.add(p);
    types[open[p]] = specials[s];
  }

  // Everything still open is a property. Walk clockwise assigning each property
  // a plaza band; bands run in groups of 2–3 (a deterministic, seeded run
  // length per group) so neighbouring plazas share a color like classic groups.
  let bandIndex = 0;
  let runLeft = 0;
  let propertyCounter = 0;
  const propBand: Record<number, number> = {};
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (i in CORNERS || types[i]) continue;
    if (runLeft <= 0) {
      // Group size 2 or 3, advance to the next band color.
      runLeft = 2 + randInt(rng, 2);
      if (propertyCounter > 0) bandIndex = (bandIndex + 1) % PLAZA_BANDS;
    }
    propBand[i] = bandIndex;
    runLeft--;
    propertyCounter++;
  }

  let propSeen = 0;
  const tiles: Tile[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const corner = CORNERS[i];
    if (corner) {
      tiles.push({ index: i, type: corner, name: cornerName(corner), baseValue: 0 });
      continue;
    }
    const type = types[i] ?? 'property';
    if (type === 'property') {
      tiles.push(buildProperty(i, lvl, theme, propSeen, propBand[i] ?? 0));
      propSeen++;
    } else if (type === 'railroad') {
      const mode = modes[i] ?? 'heist';
      tiles.push({
        index: i,
        type: 'railroad',
        name: mode === 'shutdown' ? 'Shutdown' : 'Heist',
        baseValue: 0,
        depotMode: mode,
      });
    } else {
      tiles.push(buildTile(i, type, lvl, theme, 0));
    }
  }

  return {
    tiles,
    theme: { name: theme.name, landmarkNames: theme.landmarkNames.slice() },
  };
}

/** Number of plaza band colors the property tiles cycle through. */
const PLAZA_BANDS = 6;

function cornerName(type: TileType): string {
  switch (type) {
    case 'go': return 'GO';
    case 'jail': return 'Jail';
    case 'parking': return 'Free Parking';
    case 'gotojail': return 'Go To Jail';
    default: return type;
  }
}

/**
 * Build a property "Plaza" tile. `propIndex` is the property's 0-based position
 * clockwise from GO (so baseValue rises around the lap), `band` its plaza color
 * group (0..PLAZA_BANDS-1, used by the renderers for the color band).
 *
 * baseValue rises with propIndex (each property ~6 coins dearer clockwise) on a
 * 40 floor, then scales geometrically with board level (×1.22/level) — so a full
 * lap of ~24 plazas climbs from ~40 to ~180 at level 1, matching the longer lap.
 */
function buildProperty(
  index: number,
  boardLevel: number,
  theme: (typeof THEMES)[number],
  propIndex: number,
  band: number,
): Tile {
  const name = theme.propertyNames[propIndex % theme.propertyNames.length];
  const baseValue = Math.round((40 + propIndex * 6) * Math.pow(1.22, boardLevel - 1));
  return { index, type: 'property', name, baseValue, band };
}

function buildTile(
  index: number,
  type: TileType,
  boardLevel: number,
  theme: (typeof THEMES)[number],
  propertyCounter: number,
): Tile {
  switch (type) {
    case 'property': {
      const name = theme.propertyNames[propertyCounter % theme.propertyNames.length];
      const baseValue = Math.round((40 + propertyCounter * 6) * Math.pow(1.22, boardLevel - 1));
      return { index, type, name, baseValue };
    }
    case 'tax': {
      // Tax penalty scales geometrically with level (×1.18/level).
      const baseValue = Math.round(25 * Math.pow(1.18, boardLevel - 1));
      return { index, type, name: 'Tax', baseValue };
    }
    case 'chance':
      return { index, type, name: 'Chance', baseValue: 0 };
    case 'treasure':
      return { index, type, name: 'Treasure', baseValue: 0 };
    case 'railroad':
      return { index, type, name: 'Heist', baseValue: 0 };
    default:
      return { index, type, name: cornerName(type), baseValue: 0 };
  }
}

/**
 * Draw a seeded card. `chance` is a mixed bag (can be harmful: negative coins or
 * a forced move); `treasure` is always beneficial (coins/dice/shield/sticker).
 * Deterministic from rng.
 */
export function drawCard(
  rng: () => number,
  kind: 'chance' | 'treasure',
  boardLevel: number,
): Card {
  const lvl = Number.isFinite(boardLevel) && boardLevel >= 1 ? Math.floor(boardLevel) : 1;

  if (kind === 'treasure') {
    // Mostly-positive: coins / dice / shield / sticker. Never harmful.
    const roll = randInt(rng, 4);
    switch (roll) {
      case 0: {
        const amount = (30 + randInt(rng, 5) * 20) * lvl; // 30..110 × lvl
        return { text: `Treasure! +${amount} coins`, kind: 'coins', amount };
      }
      case 1: {
        const amount = 1 + randInt(rng, 3); // 1..3 dice
        return { text: `Bonus roll! +${amount} dice`, kind: 'dice', amount };
      }
      case 2: {
        return { text: 'A protective shield!', kind: 'shield', amount: 1 };
      }
      default: {
        return { text: 'You found a sticker!', kind: 'sticker', amount: 1 };
      }
    }
  }

  // chance: mixed — can be negative coins or a forced move.
  const roll = randInt(rng, 6);
  switch (roll) {
    case 0: {
      const amount = (20 + randInt(rng, 6) * 15) * lvl; // positive coins
      return { text: `Lucky break! +${amount} coins`, kind: 'coins', amount };
    }
    case 1: {
      const amount = -((20 + randInt(rng, 5) * 15) * lvl); // negative coins
      return { text: `Unlucky! ${amount} coins`, kind: 'coins', amount };
    }
    case 2: {
      const amount = 1 + randInt(rng, 2); // +1..2 dice
      return { text: `+${amount} dice`, kind: 'dice', amount };
    }
    case 3: {
      return { text: 'Shield acquired', kind: 'shield', amount: 1 };
    }
    case 4: {
      return { text: 'Sticker found', kind: 'sticker', amount: 1 };
    }
    default: {
      const target = randInt(rng, BOARD_SIZE); // forced move to a tile index 0..19
      return { text: `Advance to tile ${target}`, kind: 'move', amount: target };
    }
  }
}
