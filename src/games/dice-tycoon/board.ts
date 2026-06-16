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

/** 20-tile looping ring. Corners sit at indices 0, 5, 10, 15. */
export const BOARD_SIZE = 20;

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

export interface Tile {
  /** Position on the ring, 0..19. */
  index: number;
  type: TileType;
  /** Short human label. */
  name: string;
  /** property: payout base; tax: penalty base; everything else: 0. */
  baseValue: number;
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

/** Corner indices and their fixed tile types (§5.1). */
const CORNERS: Record<number, TileType> = {
  0: 'go',
  5: 'jail',
  10: 'parking',
  15: 'gotojail',
};

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

/** Integer in [0, max). Guards a zero/invalid max. */
function randInt(rng: () => number, max: number): number {
  if (max <= 0) return 0;
  return Math.floor(rng() * max) % max;
}

/**
 * Generate a deterministic 20-tile board for the given rng sequence + level.
 *
 * Guarantees:
 *  - exactly BOARD_SIZE tiles, indices 0..19
 *  - corners fixed: 0=go, 5=jail, 10=parking, 15=gotojail
 *  - at least 2 railroad/heist tiles on non-corner spots
 *  - remaining tiles a themed mix of property/tax/chance/treasure
 *  - baseValue scales with boardLevel
 */
export function generateBoard(
  rng: () => number,
  boardLevel: number,
): { tiles: Tile[]; theme: BoardTheme } {
  const lvl = Number.isFinite(boardLevel) && boardLevel >= 1 ? Math.floor(boardLevel) : 1;
  const theme = themeForLevel(lvl);

  // The 16 non-corner slots.
  const nonCorner: number[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (!(i in CORNERS)) nonCorner.push(i);
  }

  // Decide tile types for the non-corner slots.
  // Guaranteed >= 2 railroads, placed on two distinct random non-corner slots.
  const types: Record<number, TileType> = {};

  // Shuffle a copy of the non-corner slots deterministically (Fisher–Yates).
  const pool = nonCorner.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  // First 2..3 shuffled slots become railroads (always >= 2).
  const railroadCount = 2 + randInt(rng, 2); // 2 or 3
  for (let k = 0; k < railroadCount && k < pool.length; k++) {
    types[pool[k]] = 'railroad';
  }

  // Remaining non-corner slots: themed weighted mix.
  // Properties dominate (the economic core); slightly more tax/heist density
  // for the MGO risk-tax feel. Extra railroads from the pool show up as 'Heist'.
  const mix: TileType[] = [
    'property', 'property', 'property', 'property',
    'tax', 'tax',
    'chance', 'chance',
    'treasure',
    'railroad',
  ];
  for (let k = railroadCount; k < pool.length; k++) {
    types[pool[k]] = mix[randInt(rng, mix.length)];
  }

  let propertyCounter = 0;
  const tiles: Tile[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const corner = CORNERS[i];
    if (corner) {
      tiles.push({ index: i, type: corner, name: cornerName(corner), baseValue: 0 });
      continue;
    }
    const type = types[i] ?? 'property';
    tiles.push(buildTile(i, type, lvl, theme, propertyCounter));
    if (type === 'property') propertyCounter++;
  }

  return {
    tiles,
    theme: { name: theme.name, landmarkNames: theme.landmarkNames.slice() },
  };
}

function cornerName(type: TileType): string {
  switch (type) {
    case 'go': return 'GO';
    case 'jail': return 'Jail';
    case 'parking': return 'Free Parking';
    case 'gotojail': return 'Go To Jail';
    default: return type;
  }
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
      // Payout base scales geometrically with level (×1.22/level); mild
      // per-property variation by index (40 / 52 / 64 / 76 at level 1).
      const baseValue = Math.round((40 + (index % 4) * 12) * Math.pow(1.22, boardLevel - 1));
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
