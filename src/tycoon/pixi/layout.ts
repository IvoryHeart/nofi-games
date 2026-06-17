/**
 * Dice Tycoon — Pixi view PURE geometry helpers.
 *
 * No Pixi, no DOM, no WebGL — just math. Extracted so the camera/projection/
 * layout logic is unit-testable in jsdom (the Pixi Application itself can't be
 * instantiated there). The Pixi view (`TycoonPixiGame`) consumes these to place
 * tiles, project the dimetric board, and drive the token-following camera.
 */

import { BOARD_SIZE } from '../../games/dice-tycoon/board';

/**
 * A point in the board GRID plane (pre-projection). For the isometric board the
 * "world" plane is a flat grid of cells: `x` is the grid column (gx), `y` is the
 * grid row (gy). The iso projection (`worldToScreen` / `gridToIso`) rotates this
 * grid 45° into the on-screen diamond.
 */
export interface WorldPoint {
  x: number;
  y: number;
}

/** A point on screen after the isometric projection (relative to world origin). */
export interface ScreenPoint {
  sx: number;
  sy: number;
}

/**
 * Iso tile footprint on screen. A 2:1 dimetric look (TILE_H ≈ TILE_W/2) reads as
 * a pleasing game-iso angle — tiles run DIAGONALLY as diamonds rather than the
 * old flat Y-squash. `TILE_W`/`TILE_H` are the full width/height of one cell's
 * projected diamond; `TILE_DEPTH` is how tall the extruded block sides are.
 */
export const TILE_W = 116;
export const TILE_H = 58; // 2:1 iso
export const TILE_DEPTH = 22;

/**
 * Legacy name kept so existing call-sites compile. Now expresses the iso H:W
 * ratio (the diamond's vertical squash) rather than a top-down Y-squash.
 */
export const ISO_SQUASH = TILE_H / TILE_W; // 0.5

/** Logical grid size of one tile cell (1 cell = 1 step on the ring). */
export const TILE_CELL = 1;

/**
 * Project a GRID cell (gx, gy) to an isometric SCREEN point. This is the core
 * of the true-iso look: +gx and +gy push screen-x in OPPOSITE directions (the
 * grid rotates into a diamond), while +gx and +gy BOTH push screen-y DOWN (the
 * board recedes back-to-front). Pure.
 *
 *   sx = originX + (gx - gy) * (tileW / 2)
 *   sy = originY + (gx + gy) * (tileH / 2)
 */
export function gridToIso(
  gx: number,
  gy: number,
  tileW = TILE_W,
  tileH = TILE_H,
  originX = 0,
  originY = 0,
): ScreenPoint {
  return {
    sx: originX + (gx - gy) * (tileW / 2),
    sy: originY + (gx + gy) * (tileH / 2),
  };
}

/**
 * Lay the 20-tile loop out as the PERIMETER of a 6×6 grid (perimeter = 20),
 * centered on the grid origin so the projected diamond is centered too. Corners
 * sit at indices 0/5/10/15 (5 tiles per side). Index 0 (START) is one diamond
 * corner; the token walks the perimeter clockwise. The winding only needs to be
 * CONSISTENT (the camera follows whatever this returns). Pure + deterministic.
 *
 * Returns BOARD_SIZE GRID points (gx, gy). `cell` scales the grid spacing
 * (defaults TILE_CELL = 1, i.e. integer cells).
 */
export function ringLayout(cell = TILE_CELL): WorldPoint[] {
  const side = 5; // tiles per side between corners (5 steps → 20 total)
  // A 6×6 grid: columns/rows 0..5. Center it so the mean is ~0.
  const c = 2.5 * cell; // half of (5 cells)
  const pts: WorldPoint[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const edge = Math.floor(i / side); // 0=bottom,1=left,2=top,3=right
    const t = i % side; // 0..4 along the edge
    let gx = 0;
    let gy = 0;
    switch (edge) {
      case 0: // bottom row (gy = +max): right → left
        gx = c - t * cell;
        gy = c;
        break;
      case 1: // left column (gx = -max): bottom → top
        gx = -c;
        gy = c - t * cell;
        break;
      case 2: // top row (gy = -max): left → right
        gx = -c + t * cell;
        gy = -c;
        break;
      default: // right column (gx = +max): top → bottom
        gx = c;
        gy = -c + t * cell;
        break;
    }
    pts.push({ x: gx, y: gy });
  }
  return pts;
}

/**
 * Project a grid point into isometric screen space (the diamond). Delegates to
 * `gridToIso`. `tileW`/`tileH` default to TILE_W/TILE_H. Coordinates are
 * RELATIVE to the world container origin (the camera/world Container translates
 * them). Pure.
 */
export function worldToScreen(p: WorldPoint, tileW = TILE_W, tileH = TILE_H): ScreenPoint {
  return gridToIso(p.x, p.y, tileW, tileH);
}

/**
 * Depth sort key for a grid point: larger = closer to the viewer (drawn on
 * top). In true iso, depth runs along `(gx + gy)` — cells with a greater sum are
 * nearer the near corner (lower on screen) and must render ABOVE those behind.
 * Pure.
 */
export function depthKey(p: WorldPoint): number {
  return p.x + p.y;
}

/**
 * Damped spring used for camera + token easing. Mirrors the spike's Spring
 * (exponential velocity damping for overshoot). Pure stepping — mutates and
 * returns the new value.
 */
export class Spring {
  value: number;
  target: number;
  vel = 0;
  stiffness: number;
  damping: number;
  constructor(value: number, stiffness = 90, damping = 14) {
    this.value = value;
    this.target = value;
    this.stiffness = stiffness;
    this.damping = damping;
  }
  step(dt: number): number {
    // Clamp dt so a long pause (tab hidden) can't explode the spring.
    const d = Math.min(Math.max(dt, 0), 1 / 30);
    const force = (this.target - this.value) * this.stiffness;
    this.vel += force * d;
    this.vel *= Math.exp(-this.damping * d);
    this.value += this.vel * d;
    return this.value;
  }
  /** Snap instantly to a target (used on resume / resize). */
  snap(v: number): void {
    this.value = v;
    this.target = v;
    this.vel = 0;
  }
}

/**
 * Compute the world-container translation (pan) needed to center `focus`
 * (a projected screen point) in a viewport of (vw, vh) at the given zoom.
 *
 *   worldPos = viewportCenter - focus * zoom
 *
 * Pure: returns the {x,y} to assign to the world Container's position. The
 * camera springs toward this target.
 */
export function cameraTarget(
  focus: ScreenPoint,
  vw: number,
  vh: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: vw / 2 - focus.sx * zoom,
    y: vh / 2 - focus.sy * zoom,
  };
}

/**
 * Pick a zoom so the whole board (its projected bounding box, padded) fits a
 * viewport. `pad` > 1 leaves a margin of empty space around the board. The
 * result is the largest zoom at which the WHOLE board still fits, so the board
 * reads as a whole. Pure.
 */
export function fitZoom(
  boardW: number,
  boardH: number,
  vw: number,
  vh: number,
  pad = 1.15,
): number {
  const zx = vw / (boardW * pad);
  const zy = vh / (boardH * pad);
  const z = Math.min(zx, zy);
  return Number.isFinite(z) && z > 0 ? z : 1;
}

/**
 * Per-viewport framing margin (the `pad` for `fitZoom`). Narrow phone portrait
 * gets a tighter margin (board fills more of the screen so tiles stay legible);
 * a wide desktop card gets a roomier margin so the board sits as a centered
 * framed object with breathing room. Pure — tuned per aspect/width.
 */
export function framingMargin(vw: number, vh: number): number {
  const portrait = vh >= vw;
  // Phone portrait: snug (1.12) so tiles are big enough to read.
  // Wide/desktop card: roomier (up to ~1.32) so the board is a framed centerpiece.
  if (portrait) return 1.12;
  const wide = vw >= 480;
  return wide ? 1.32 : 1.2;
}

/**
 * The default + idle camera zoom: show the WHOLE board, framed for this
 * viewport. This replaces the old tight follow-zoom — the board reads as a
 * whole by default. Pure.
 */
export function boardFitZoom(
  boardW: number,
  boardH: number,
  vw: number,
  vh: number,
): number {
  return fitZoom(boardW, boardH, vw, vh, framingMargin(vw, vh));
}

/**
 * Classify a pointer gesture by its total movement from press to release.
 * A movement below `threshold` px reads as a TAP (a click — does nothing
 * harmful on the board); at or beyond it reads as a DRAG (pan). Pure.
 */
export function classifyPointer(dx: number, dy: number, threshold = 8): 'tap' | 'drag' {
  return Math.hypot(dx, dy) >= threshold ? 'drag' : 'tap';
}

/**
 * Gentle follow: while a hop is in flight the camera may DRIFT slightly so the
 * token stays comfortably in frame, but it must NOT zoom in or hide the board.
 * Given the board-fit camera target (`fit`, the world translation that frames
 * the whole board centered) and the camera target that would center the token
 * (`tokenCentered`), return a point that nudges from `fit` toward
 * `tokenCentered` but no further than `maxDrift` px on each axis. Pure.
 */
export function gentleFollowTarget(
  fit: { x: number; y: number },
  tokenCentered: { x: number; y: number },
  maxDrift = 60,
): { x: number; y: number } {
  const clampAxis = (base: number, want: number): number => {
    const d = want - base;
    const c = Math.max(-maxDrift, Math.min(maxDrift, d));
    return base + c;
  };
  return {
    x: clampAxis(fit.x, tokenCentered.x),
    y: clampAxis(fit.y, tokenCentered.y),
  };
}

/**
 * Clamp a panned world-container translation so the board can never be dragged
 * fully off-screen. The projected board occupies, in world space, a box of
 * `boardW`×`boardH` centered on the world origin; at `zoom` it spans
 * `boardW*zoom`×`boardH*zoom` on screen. We keep at least `keep` (0..1) of the
 * board's half-extent overlapping the viewport on each axis, so the board's
 * center can never be dragged past the viewport edge. Pure.
 */
export function clampPan(
  pan: { x: number; y: number },
  vw: number,
  vh: number,
  boardW: number,
  boardH: number,
  zoom: number,
  keep = 0.5,
): { x: number; y: number } {
  const clampAxis = (p: number, vSize: number, bSize: number): number => {
    const half = (bSize * zoom) / 2;
    const center = vSize / 2;
    const overlap = half * keep;
    // Allowed band for the board center so at least `overlap` stays on screen.
    const min = -half + overlap; // board pushed toward the negative edge
    const max = vSize + half - overlap; // board pushed toward the positive edge
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    // The natural rest (centered) must always be reachable.
    const restLo = Math.min(lo, center);
    const restHi = Math.max(hi, center);
    return Math.max(restLo, Math.min(restHi, p));
  };
  return {
    x: clampAxis(pan.x, vw, boardW),
    y: clampAxis(pan.y, vh, boardH),
  };
}

/**
 * Arc height (world px, pre-projection) for a token hop at `progress` 0..1.
 * A sine arc peaking at the midpoint, scaled by `peak`. Pure — drives the
 * Penny hop's vertical lift + the detaching shadow.
 */
export function hopArc(progress: number, peak: number): number {
  const t = Math.min(Math.max(progress, 0), 1);
  return Math.sin(t * Math.PI) * peak;
}

/**
 * Squash/stretch scale for the token during a hop. Stretches vertically near
 * takeoff/landing, squashes at the apex. Returns {sx, sy} multipliers near 1.
 * Pure.
 */
export function hopSquash(progress: number, amount = 0.18): { sx: number; sy: number } {
  const t = Math.min(Math.max(progress, 0), 1);
  const k = Math.cos(t * Math.PI * 2) * amount; // +1 at ends, -1 at apex
  return { sx: 1 - k, sy: 1 + k };
}

/**
 * Linear interpolation. Pure helper used by hop tweening between two world pts.
 */
export function lerp(a: number, b: number, t: number): number {
  const k = Math.min(Math.max(t, 0), 1);
  return a + (b - a) * k;
}
