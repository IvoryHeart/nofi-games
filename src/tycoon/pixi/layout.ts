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
 * viewport — the floor below which the camera won't zoom out. The actual camera
 * zooms IN a bit past this for the "follow Penny" close framing, but never out
 * far enough to lose the board off-screen. Pure.
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
 * The follow zoom: zoom in toward Penny, clamped to a band relative to the
 * board-fit floor. Aims ~1.6× the fit floor for a comfortable close-but-
 * contextual frame, clamped so we never exceed `maxIn`× the floor. Pure.
 */
export function followZoom(fit: number, maxIn = 1.9): number {
  const aim = fit * 1.6;
  return Math.min(aim, fit * maxIn);
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
