/** A tube holds a stack of colored "liquid" segments. Index 0 = bottom,
 *  highest index = top. Fill count never exceeds `capacity`. Each value is
 *  a color index into PALETTE (0..numColors-1). */
export interface Tube {
  capacity: number;
  contents: number[];
}

export interface WaterSortLevel {
  numColors: number;
  capacity: number;
  tubes: Tube[];
}

/** 12 high-contrast hues for Water Sort, chosen to be maximally distinct at
 *  a glance even when stacked as thin horizontal bands. Saturation is high
 *  across the board (these are puzzle colours, not UI chrome, so the app's
 *  warm-palette rule doesn't apply) and hue spacing is roughly 30° around
 *  the wheel with a few manual nudges for extra separation. When two bands
 *  sit next to each other in a tube, the player must be able to tell them
 *  apart in half a second. */
export const PALETTE: string[] = [
  '#F44336', //  0 red
  '#FF9800', //  1 orange
  '#FFEB3B', //  2 yellow
  '#CDDC39', //  3 lime
  '#4CAF50', //  4 green
  '#009688', //  5 teal
  '#00BCD4', //  6 cyan
  '#2196F3', //  7 blue
  '#673AB7', //  8 deep purple
  '#E91E63', //  9 pink
  '#795548', // 10 brown
  '#607D8B', // 11 slate
];

/** Top color of a tube (the value at the highest filled slot), or -1 if empty. */
export function topColor(tube: Tube): number {
  return tube.contents.length === 0 ? -1 : tube.contents[tube.contents.length - 1];
}

/** Number of same-colored segments stacked at the top of the tube. Used to
 *  decide how many units to pour in one tap. */
export function topSegmentLength(tube: Tube): number {
  if (tube.contents.length === 0) return 0;
  const c = tube.contents[tube.contents.length - 1];
  let n = 1;
  for (let i = tube.contents.length - 2; i >= 0; i--) {
    if (tube.contents[i] === c) n++;
    else break;
  }
  return n;
}

/** A tube is "solved" iff it is empty, OR it is full of one color. */
export function isSolvedTube(tube: Tube): boolean {
  if (tube.contents.length === 0) return true;
  if (tube.contents.length !== tube.capacity) return false;
  const first = tube.contents[0];
  for (let i = 1; i < tube.contents.length; i++) {
    if (tube.contents[i] !== first) return false;
  }
  return true;
}

export function isLevelSolved(level: WaterSortLevel): boolean {
  for (const t of level.tubes) {
    if (!isSolvedTube(t)) return false;
  }
  return true;
}

/** Can we pour from `src` into `dst`? Rules:
 *  - src must have at least one unit
 *  - dst must have room (contents.length < capacity)
 *  - dst must be empty OR its top color must match src's top color */
export function canPour(src: Tube, dst: Tube): boolean {
  if (src === dst) return false;
  if (src.contents.length === 0) return false;
  if (dst.contents.length >= dst.capacity) return false;
  if (dst.contents.length === 0) return true;
  return topColor(src) === topColor(dst);
}

/** Perform a pour. Moves as many same-color top units as will fit in dst.
 *  Returns the number of units transferred. Mutates both tubes. */
export function pour(src: Tube, dst: Tube): number {
  if (!canPour(src, dst)) return 0;
  const color = topColor(src);
  const srcSegLen = topSegmentLength(src);
  const dstSpace = dst.capacity - dst.contents.length;
  const n = Math.min(srcSegLen, dstSpace);
  for (let i = 0; i < n; i++) {
    src.contents.pop();
    dst.contents.push(color);
  }
  return n;
}

export function cloneLevel(level: WaterSortLevel): WaterSortLevel {
  return {
    numColors: level.numColors,
    capacity: level.capacity,
    tubes: level.tubes.map(t => ({ capacity: t.capacity, contents: t.contents.slice() })),
  };
}
