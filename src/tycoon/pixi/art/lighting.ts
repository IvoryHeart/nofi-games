/**
 * Dice Tycoon — V2 LIGHTING MODEL (pure shade math).
 *
 * No Pixi, no DOM, no WebGL — the numbers behind the V2 look. A single light
 * comes from the TOP-LEFT (dir ≈ (-0.5,-0.8)). For every iso block (tiles,
 * buildings, token base) this yields:
 *   - top face   : a bright vertical ramp (light → mid), barely shaded;
 *   - LEFT side   : LIT — it faces the light, so a brighter gradient;
 *   - RIGHT side  : SHADOWED — it faces away, so a darker gradient.
 * Plus the supporting cues: an AO seam at the lower V where the side faces meet,
 * a thin crease between adjacent tiles, a warm rim-light on the top-left edges,
 * and a contact shadow offset DOWN-RIGHT to match the light. These factors feed
 * `bake.ts`'s cached gradients — but the math is pure + unit-tested here.
 */

import {
  AO_SEAM,
  BandStops,
  CONTACT_SHADOW,
  RIM_LIGHT,
  darken,
  lighten,
} from './palette';

/** The single scene light direction (top-left), normalised. */
export const LIGHT_DIR = { x: -0.5, y: -0.8 } as const;

/**
 * Per-face shade FACTORS relative to the top face (=1.0). The LEFT face is LIT
 * (factor > the right face), the RIGHT face is SHADOWED (lowest). These multiply
 * how much we darken the base colour for each side face. Tuned so the block
 * reads as a chunky 3D form lit from the top-left (mgo8.png / mgo3.png).
 */
export const FACE = {
  /** Top face: nearly full brightness, gentle vertical ramp. */
  top: 1.0,
  /** Left side face: lit — darken the base only slightly. */
  left: 0.82,
  /** Right side face: in shade — darken the base more. */
  right: 0.58,
} as const;

/**
 * The darken amount (0..1 for `darken()`) applied to a base colour to produce a
 * side face. A LIT face (left) darkens less; a SHADOWED face (right) darkens
 * more. Derived from the FACE factors so lit < shadowed always holds. Pure.
 */
export function faceDarken(face: 'top' | 'left' | 'right'): number {
  // factor 1 → 0 darken; factor 0 → full darken. The top face never darkens.
  return 1 - FACE[face];
}

/** Resolve a side-face base colour from a tile base colour. Pure. */
export function sideFaceColor(base: number, face: 'left' | 'right'): number {
  return darken(base, faceDarken(face));
}

/**
 * A side face's own two-stop gradient {topStop, bottomStop}. The LIT (left) face
 * brightens toward its top edge (catches the light); the SHADOWED (right) face
 * stays dark and only deepens toward the bottom (AO). Pure.
 */
export function sideFaceStops(base: number, face: 'left' | 'right'): { top: number; bottom: number } {
  const mid = sideFaceColor(base, face);
  if (face === 'left') {
    // Lit: a lifted top edge, slightly deepened bottom.
    return { top: lighten(mid, 0.18), bottom: darken(mid, 0.1) };
  }
  // Shadowed: flatter + darker, deepest at the bottom (toward the AO seam).
  return { top: lighten(mid, 0.05), bottom: darken(mid, 0.16) };
}

/** A top-face vertical gradient: bright at the back/top, mid at the front. */
export function topFaceStops(stops: BandStops): { top: number; bottom: number } {
  return { top: stops.light, bottom: stops.mid };
}

// ── Ambient-occlusion / rim / contact cues ───────────────────────────────────

/** The AO seam colour + alpha (the dark band at the lower V of the block). */
export const AO = { color: AO_SEAM, alpha: 0.18 } as const;

/** The thin crease line between adjacent tiles. */
export const CREASE = { color: AO_SEAM, alpha: 0.12, width: 1 } as const;

/** The warm rim-light on the top-left edges of a block. */
export const RIM = { color: RIM_LIGHT, alpha: 0.35, width: 1.5 } as const;

/** The warm contact shadow under a block, offset DOWN-RIGHT to match the light. */
export const CONTACT = { color: CONTACT_SHADOW, alpha: 0.16 } as const;

/**
 * Contact-shadow offset (screen px) for a block of the given footprint. The
 * light is top-left so the shadow falls DOWN and to the RIGHT. Scales gently
 * with the block size. Pure.
 */
export function contactOffset(halfW: number, halfH: number): { dx: number; dy: number } {
  return { dx: halfW * 0.12, dy: halfH * 0.22 + 4 };
}

// ── Window-grid layout (glossy buildings) ────────────────────────────────────

/** One window cell on a building face (local coords, origin = building base). */
export interface WindowCell {
  x: number;
  y: number;
  w: number;
  h: number;
  /** True when this window is "lit" (brighter) — ~15% of windows. */
  lit: boolean;
}

/**
 * Lay out a window grid on a building's front face. Returns evenly spaced
 * rounded-rect cells from `marginX`/`marginTop` insets, with `cols`×`rows`
 * derived from the face size and a target cell size. ~`litRatio` of them are
 * flagged "lit" by a deterministic hash of (row,col,seed) so the pattern is
 * stable per bake (no Math.random — daily determinism friendly). Pure.
 */
export function windowGrid(
  faceW: number,
  faceH: number,
  opts: {
    cell?: number; // target window size
    gap?: number; // gap between windows
    marginX?: number;
    marginTop?: number;
    marginBottom?: number;
    litRatio?: number;
    seed?: number;
  } = {},
): WindowCell[] {
  const cell = opts.cell ?? 6;
  const gap = opts.gap ?? 5;
  const mx = opts.marginX ?? 7;
  const mt = opts.marginTop ?? 10;
  const mb = opts.marginBottom ?? 8;
  const litRatio = opts.litRatio ?? 0.15;
  const seed = opts.seed ?? 1;

  const usableW = faceW - mx * 2;
  const usableH = faceH - mt - mb;
  if (usableW <= 0 || usableH <= 0) return [];
  const pitch = cell + gap;
  const cols = Math.max(1, Math.floor((usableW + gap) / pitch));
  const rows = Math.max(1, Math.floor((usableH + gap) / pitch));
  // Centre the grid in the usable area.
  const gridW = cols * cell + (cols - 1) * gap;
  const gridH = rows * cell + (rows - 1) * gap;
  const x0 = mx + (usableW - gridW) / 2;
  const y0 = mt + (usableH - gridH) / 2;

  const out: WindowCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: x0 + c * pitch,
        y: y0 + r * pitch,
        w: cell,
        h: cell,
        lit: isLit(r, c, seed, litRatio),
      });
    }
  }
  return out;
}

/**
 * Deterministic "is this window lit" predicate. Hashes (row,col,seed) into a
 * unit float and compares to `litRatio`. Stable per (grid,seed) so a baked
 * building always looks the same. Pure — no RNG state. Exported for tests.
 */
export function isLit(row: number, col: number, seed: number, litRatio: number): boolean {
  // A small integer hash (xorshift-ish) → [0,1).
  let h = (row * 73856093) ^ (col * 19349663) ^ (seed * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return (h % 10000) / 10000 < Math.max(0, Math.min(1, litRatio));
}

/** Count lit windows in a grid (test helper). */
export function litCount(cells: WindowCell[]): number {
  return cells.reduce((n, c) => n + (c.lit ? 1 : 0), 0);
}
