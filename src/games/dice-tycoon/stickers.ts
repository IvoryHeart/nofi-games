/**
 * Dice Tycoon — sticker album (pure logic).
 *
 * A small collectible album: 3 themed sets × 4 stickers = 12 stickers total.
 * Card draws and board completions grant seeded sticker drops. Completing all
 * four stickers in a set grants a one-time coins + dice reward.
 *
 * PURE MODULE: no DOM/canvas, no imports from other dice-tycoon files, never
 * uses Math.random(). All randomness is injected via `rng: () => number`
 * (a mulberry32 instance from src/utils/rng), so drops are deterministic given
 * the rng sequence and reproducible in Daily Mode.
 */

export interface StickerSet {
  id: string;
  /** Themed set name. */
  name: string;
  /** 4 sticker names per set. */
  stickerNames: string[];
}

/** 3 sets × 4 stickers = 12 total. Static constant. Order is stable. */
export const STICKER_SETS: StickerSet[] = [
  {
    id: 'wheels',
    name: 'Wheels & Deals',
    stickerNames: ['Vintage Roadster', 'City Tram', 'Hot Air Balloon', 'Steam Locomotive'],
  },
  {
    id: 'landmarks',
    name: 'World Landmarks',
    stickerNames: ['Golden Bridge', 'Clock Tower', 'Grand Casino', 'Lighthouse'],
  },
  {
    id: 'fortune',
    name: 'Lady Fortune',
    stickerNames: ['Lucky Horseshoe', 'Pot of Coins', 'Diamond Ring', 'Crystal Ball'],
  },
];

/** Per-set reward granted once, the first time the set is completed. */
const SET_REWARD: { coins: number; dice: number } = { coins: 500, dice: 5 };

export interface AlbumState {
  /** stickerId -> count owned (duplicates allowed). */
  owned: Record<string, number>;
  /** set ids already completed (reward already granted). */
  completedSets: string[];
}

/** A fresh, empty album. */
export function emptyAlbum(): AlbumState {
  return { owned: {}, completedSets: [] };
}

export interface StickerDrop {
  stickerId: string;
  setId: string;
  /** false if it was a duplicate (already owned before this drop). */
  isNew: boolean;
  /** set id if THIS drop completed a set for the first time, else null. */
  setCompleted: string | null;
  /** reward granted when a set completes (first time only), else null. */
  reward: { coins: number; dice: number } | null;
}

/** Stable id scheme: `${setId}:${index}`. */
function stickerIdFor(set: StickerSet, index: number): string {
  return `${set.id}:${index}`;
}

/**
 * Coerce a possibly-malformed album into a valid shape in place. Treats a
 * missing/invalid `owned` or `completedSets` as empty so callers never crash
 * on legacy or corrupted saves.
 */
function normalize(album: AlbumState): AlbumState {
  if (!album || typeof album !== 'object') {
    return emptyAlbum();
  }
  if (!album.owned || typeof album.owned !== 'object') {
    album.owned = {};
  }
  if (!Array.isArray(album.completedSets)) {
    album.completedSets = [];
  }
  return album;
}

/**
 * Grant one seeded sticker into the album.
 *
 * MUTATES album.owned (increments the chosen sticker's count) and, if a set just
 * completed for the first time, appends to album.completedSets. Deterministic
 * given the rng sequence: it consumes exactly two rng() draws (set, then sticker).
 *
 * A set is complete when all 4 of its stickers are owned. The reward is granted
 * exactly once per set — a later duplicate that lands on an already completed set
 * returns reward: null and setCompleted: null.
 */
export function grantSticker(rng: () => number, album: AlbumState): StickerDrop {
  normalize(album);

  // Pick a set, then a sticker within it. Two draws, in this fixed order.
  const setCount = STICKER_SETS.length; // 3 (> 0 by the static constant)
  const setIndex = Math.min(setCount - 1, Math.max(0, Math.floor(rng() * setCount)));
  const set = STICKER_SETS[setIndex];

  const stickerCount = set.stickerNames.length; // 4
  const stickerIndex = Math.min(
    stickerCount - 1,
    Math.max(0, Math.floor(rng() * stickerCount)),
  );
  const stickerId = stickerIdFor(set, stickerIndex);

  const prevCount = album.owned[stickerId] ?? 0;
  const isNew = prevCount === 0;
  album.owned[stickerId] = prevCount + 1;

  // Determine whether this drop completed the set for the first time.
  let setCompleted: string | null = null;
  let reward: { coins: number; dice: number } | null = null;

  if (isNew && !album.completedSets.includes(set.id)) {
    const allOwned = set.stickerNames.every(
      (_, i) => (album.owned[stickerIdFor(set, i)] ?? 0) > 0,
    );
    if (allOwned) {
      album.completedSets.push(set.id);
      setCompleted = set.id;
      reward = { coins: SET_REWARD.coins, dice: SET_REWARD.dice };
    }
  }

  return { stickerId, setId: set.id, isNew, setCompleted, reward };
}

/** Distinct sticker ids owned (count of unique stickers, ignoring duplicates). */
export function totalStickersOwned(album: AlbumState): number {
  normalize(album);
  let n = 0;
  for (const id of Object.keys(album.owned)) {
    if ((album.owned[id] ?? 0) > 0) n++;
  }
  return n;
}

/** Progress for one set: how many distinct stickers owned out of the set total. */
export function setProgress(
  album: AlbumState,
  setId: string,
): { owned: number; total: number } {
  normalize(album);
  const set = STICKER_SETS.find((s) => s.id === setId);
  if (!set) return { owned: 0, total: 0 };
  let owned = 0;
  for (let i = 0; i < set.stickerNames.length; i++) {
    if ((album.owned[stickerIdFor(set, i)] ?? 0) > 0) owned++;
  }
  return { owned, total: set.stickerNames.length };
}
