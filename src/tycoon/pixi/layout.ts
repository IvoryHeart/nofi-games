/**
 * Dice Tycoon — Pixi view PURE geometry helpers.
 *
 * No Pixi, no DOM, no WebGL — just math. Extracted so the camera/projection/
 * layout logic is unit-testable in jsdom (the Pixi Application itself can't be
 * instantiated there). The Pixi view (`TycoonPixiGame`) consumes these to place
 * tiles, project the dimetric board, and drive the token-following camera.
 */

import { BOARD_SIZE } from '../../games/dice-tycoon/board';

/** A point in the flat board "world" plane (pre-projection). */
export interface WorldPoint {
  x: number;
  y: number;
}

/** A point on screen after dimetric projection (relative to the world origin). */
export interface ScreenPoint {
  sx: number;
  sy: number;
}

/**
 * Vertical squash for the shallow 2.5D dimetric look (matches the canvas view's
 * ISO_SQUASH). 1 = flat top-down, lower = tilted further back. ~0.62 reads as
 * "tilted back" yet stays legible at 360px.
 */
export const ISO_SQUASH = 0.62;

/** Logical world size of one tile cell (square footprint before projection). */
export const TILE_CELL = 120;

/**
 * Lay the 20-tile loop out as a square ring in WORLD space (flat, un-projected),
 * centered on the origin. Corners sit at indices 0/5/10/15 (5 tiles per side).
 * Index 0 (GO) is the bottom-right corner; the token walks the perimeter
 * clockwise. The exact winding only needs to be CONSISTENT (the camera follows
 * whatever this returns). Pure + deterministic.
 *
 * Returns BOARD_SIZE world points. `cell` controls spacing (defaults TILE_CELL).
 */
export function ringLayout(cell = TILE_CELL): WorldPoint[] {
  const side = 5; // tiles per side between corners (5 steps → 20 total)
  const half = (side * cell) / 2;
  const pts: WorldPoint[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const edge = Math.floor(i / side); // 0=bottom,1=left,2=top,3=right
    const t = i % side; // 0..4 along the edge
    let x = 0;
    let y = 0;
    switch (edge) {
      case 0: // bottom edge: right → left
        x = half - t * cell;
        y = half;
        break;
      case 1: // left edge: bottom → top
        x = -half;
        y = half - t * cell;
        break;
      case 2: // top edge: left → right
        x = -half + t * cell;
        y = -half;
        break;
      default: // right edge: top → bottom
        x = half;
        y = -half + t * cell;
        break;
    }
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Project a flat world point into dimetric screen space. The board is tilted
 * back by squashing the Y axis (no rotation, so columns stay y-monotonic and
 * legible). `squash` defaults to ISO_SQUASH. Coordinates are RELATIVE to the
 * world container origin (the camera/world Container then translates them).
 */
export function worldToScreen(p: WorldPoint, squash = ISO_SQUASH): ScreenPoint {
  return { sx: p.x, sy: p.y * squash };
}

/**
 * Depth sort key for a projected point: larger = closer to the viewer (drawn on
 * top). Tiles/buildings lower on screen (greater sy) render above those behind.
 * Pure.
 */
export function depthKey(p: WorldPoint, squash = ISO_SQUASH): number {
  return p.y * squash;
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
