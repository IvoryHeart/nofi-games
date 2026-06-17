/**
 * Dice Tycoon — Pixi PX3 PURE chrome math.
 *
 * No Pixi, no DOM, no WebGL — just math + formatting for the MGO-style chrome
 * (control bar, cash odometer, dice pips, ribbon banner, vault raid overlay).
 * Extracted so the visual layout/timing logic is unit-testable in jsdom (the
 * Pixi Application can't render there). The view consumes these to draw glossy
 * dice pips, odometer-roll the cash counter, position the bottom control bar,
 * lay out vault tiles, and time the red ribbon banner.
 */

import { MULTIPLIERS } from '../../games/dice-tycoon/economy';

// ── Cash odometer ────────────────────────────────────────────────────────────

/**
 * One eased step of an odometer count-up from `current` toward `target`. Returns
 * the new displayed integer. Moves a fraction `rate` of the remaining gap, but
 * always at least `minStep` so the count reaches the target in finite time (no
 * Zeno stall). When within `minStep` of the target it snaps. Pure.
 */
export function odometerStep(
  current: number,
  target: number,
  rate: number,
  minStep = 1,
): number {
  if (!Number.isFinite(current)) current = 0;
  if (!Number.isFinite(target)) return current;
  const diff = target - current;
  if (Math.abs(diff) <= Math.max(1, minStep)) return target;
  const k = Math.min(Math.max(rate, 0), 1);
  const dir = diff > 0 ? 1 : -1;
  const move = Math.max(minStep, Math.abs(diff) * k);
  const next = current + dir * Math.min(move, Math.abs(diff));
  return Math.round(next);
}

/** Compact coin formatting: 1234 → "1,234", 1_250_000 → "1.25M". Pure. */
export function formatCoins(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const v = Math.round(n);
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${trimNum(v / 1_000_000)}M`;
  if (abs >= 100_000) return `${trimNum(v / 1_000)}K`;
  return v.toLocaleString('en-US');
}

function trimNum(x: number): string {
  const s = x.toFixed(x < 10 ? 2 : 1);
  return s.replace(/\.?0+$/, '');
}

// ── Dice pips ────────────────────────────────────────────────────────────────

/**
 * Pip layout for a die face 1..6 on a cube of half-extent `r` (centered on the
 * cube origin). Returns pip centers in cube-local px. Standard western die
 * arrangement (diagonals + center for odds). Pure — drives the glossy dice
 * cubes in the control bar.
 */
export function dicePips(face: number, r: number): Array<{ x: number; y: number }> {
  const f = Math.min(6, Math.max(1, Math.floor(face)));
  const o = r * 0.5;
  const L = { x: -o, y: -o };
  const R = { x: o, y: -o };
  const C = { x: 0, y: 0 };
  const BL = { x: -o, y: o };
  const BR = { x: o, y: o };
  const ML = { x: -o, y: 0 };
  const MR = { x: o, y: 0 };
  switch (f) {
    case 1:
      return [C];
    case 2:
      return [L, BR];
    case 3:
      return [L, C, BR];
    case 4:
      return [L, R, BL, BR];
    case 5:
      return [L, R, C, BL, BR];
    default:
      return [L, R, ML, MR, BL, BR];
  }
}

/**
 * Eased tumble→settle for a rolling die. Given elapsed `t` and total `duration`
 * seconds, returns the visible face (1..6, cycling fast then slowing) and a
 * `done` flag. Once done the view shows the REAL rolled face. Pure.
 */
export function diceTumbleFace(
  t: number,
  duration: number,
  finalFace: number,
  seed: number,
): { face: number; done: boolean } {
  if (t >= duration) return { face: clampFace(finalFace), done: true };
  const p = Math.min(Math.max(t / Math.max(duration, 0.0001), 0), 1);
  const cycles = Math.floor((1 - (1 - p) * (1 - p)) * 14 + seed);
  const face = (cycles % 6) + 1;
  return { face, done: false };
}

function clampFace(f: number): number {
  return Math.min(6, Math.max(1, Math.floor(Number.isFinite(f) ? f : 1)));
}

// ── Multiplier dial tone ─────────────────────────────────────────────────────

export type MultTone = 'gold' | 'green' | 'plum';

/**
 * Affordability tone for the multiplier dial. Gold when ×1 is affordable, green
 * when an affordable premium tier (×5/×20), plum when the current multiplier is
 * unaffordable. Pure.
 */
export function multiplierTone(multIndex: number, dice: number): MultTone {
  const i = Math.min(MULTIPLIERS.length - 1, Math.max(0, multIndex));
  const cost = MULTIPLIERS[i] ?? 1;
  if (dice < cost) return 'plum';
  return i === 0 ? 'gold' : 'green';
}

// ── Bottom control bar layout ────────────────────────────────────────────────

export interface ControlBarLayout {
  die1: { x: number; y: number };
  die2: { x: number; y: number };
  go: { x: number; y: number };
  dial: { x: number; y: number };
  dieR: number;
  goR: number;
  dialR: number;
  rowY: number;
}

/**
 * MGO-style bottom control bar layout. GO! is the big bottom-center element; two
 * glossy dice cubes sit to its left, the multiplier dial to its right. Scales
 * gently with width. Pure.
 */
export function controlBarLayout(vw: number, vh: number): ControlBarLayout {
  const w = Math.max(1, vw);
  const h = Math.max(1, vh);
  const rowY = h - Math.max(44, Math.min(72, h * 0.09));
  const goR = Math.max(30, Math.min(46, w * 0.1));
  const dieR = goR * 0.46;
  const dialR = goR * 0.62;
  const cx = w / 2;
  const gap = goR * 1.5;
  return {
    go: { x: cx, y: rowY },
    die1: { x: cx - gap - dieR * 2.1, y: rowY },
    die2: { x: cx - gap - dieR * 0.2, y: rowY },
    dial: { x: cx + gap + dialR, y: rowY },
    dieR,
    goR,
    dialR,
    rowY,
  };
}

/** Circle hit-test (screen px). Pure. */
export function hitCircle(px: number, py: number, cx: number, cy: number, r: number): boolean {
  return Math.hypot(px - cx, py - cy) <= r;
}

// ── Red ribbon banner timing ─────────────────────────────────────────────────

export interface BannerPhase {
  vis: number; // 0..1 (alpha + slide + scale)
  done: boolean; // full in/hold/out cycle elapsed
}

/**
 * Ease-in / hold / ease-out envelope for the red ribbon event banner. Returns a
 * 0..1 visibility the view maps to alpha + a downward slide + an overshoot pop.
 * Pure & deterministic.
 */
export function bannerPhase(t: number, inDur = 0.28, hold = 1.1, outDur = 0.4): BannerPhase {
  const total = inDur + hold + outDur;
  if (t <= 0) return { vis: 0, done: false };
  if (t >= total) return { vis: 0, done: true };
  if (t < inDur) return { vis: easeOutBack(t / inDur), done: false };
  if (t < inDur + hold) return { vis: 1, done: false };
  const p = (t - inDur - hold) / outDur;
  return { vis: 1 - easeInCubic(p), done: false };
}

function easeOutBack(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = p - 1;
  return Math.min(1.08, 1 + c3 * x * x * x + c1 * x * x);
}
function easeInCubic(p: number): number {
  const x = Math.min(Math.max(p, 0), 1);
  return x * x * x;
}

// ── Vault raid overlay geometry ──────────────────────────────────────────────

export interface VaultRect {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lay out the raid overlay's vault tiles in a centered grid. The core exposes 3
 * logical vaults; we present them as a readable row. Returns each vault's rect
 * (center + size) so the view can draw + hit-test taps. Pure.
 */
export function vaultLayout(
  count: number,
  panelX: number,
  panelW: number,
  cy: number,
  cols = 3,
  gap = 14,
): VaultRect[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const c = Math.max(1, Math.min(cols, n));
  const rows = Math.ceil(n / c);
  const usable = Math.max(1, panelW - gap * (c + 1));
  const tw = usable / c;
  const th = tw * 1.12;
  const out: VaultRect[] = [];
  const gridW = c * tw + (c - 1) * gap;
  const startX = panelX + (panelW - gridW) / 2 + tw / 2;
  const gridH = rows * th + (rows - 1) * gap;
  const startY = cy - gridH / 2 + th / 2;
  for (let i = 0; i < n; i++) {
    const col = i % c;
    const row = Math.floor(i / c);
    out.push({
      index: i,
      x: startX + col * (tw + gap),
      y: startY + row * (th + gap),
      w: tw,
      h: th,
    });
  }
  return out;
}

/** Hit-test a tap against vault rects; returns the index or -1. Pure. */
export function vaultHitTest(rects: VaultRect[], px: number, py: number): number {
  for (const r of rects) {
    if (
      px >= r.x - r.w / 2 &&
      px <= r.x + r.w / 2 &&
      py >= r.y - r.h / 2 &&
      py <= r.y + r.h / 2
    ) {
      return r.index;
    }
  }
  return -1;
}

// ── Screen shake ─────────────────────────────────────────────────────────────

/**
 * Decaying screen-shake offset. Fades to zero as `life`/`maxLife` drops. Used
 * for big events (board complete, big steal, doubles). Pure.
 */
export function shakeOffset(
  life: number,
  maxLife: number,
  magnitude: number,
  t: number,
): { x: number; y: number } {
  if (life <= 0 || maxLife <= 0) return { x: 0, y: 0 };
  const decay = Math.min(Math.max(life / maxLife, 0), 1);
  const m = magnitude * decay * decay;
  return { x: Math.sin(t * 53.2) * m, y: Math.cos(t * 61.7) * m };
}
