import { describe, it, expect } from 'vitest';
import {
  computeLayout,
  layoutMode,
  PHONE_MAX,
  COCKPIT_MIN,
  TOP_BAR_H,
  PHONE_TOP_HUD_H,
  PHONE_BOTTOM_H,
  RAIL_W,
  COMPACT_RAIL_W,
} from '../../src/tycoon/layout';

// Pure layout logic — the V1 replacement for the obsolete MAX_W=480 computeSize
// clamp. No DOM / no Pixi (none of this touches WebGL), so it lives in unit/.

describe('layoutMode breakpoints', () => {
  it('classifies phone below 700', () => {
    expect(layoutMode(0)).toBe('phone');
    expect(layoutMode(360)).toBe('phone');
    expect(layoutMode(PHONE_MAX - 1)).toBe('phone');
  });

  it('classifies compact in [700, 1024)', () => {
    expect(layoutMode(PHONE_MAX)).toBe('compact');
    expect(layoutMode(900)).toBe('compact');
    expect(layoutMode(COCKPIT_MIN - 1)).toBe('compact');
  });

  it('classifies cockpit at/above 1024', () => {
    expect(layoutMode(COCKPIT_MIN)).toBe('cockpit');
    expect(layoutMode(1920)).toBe('cockpit');
  });
});

describe('computeLayout — phone (edge-to-edge)', () => {
  it('uses the FULL viewport width for the stage (no 480 cap)', () => {
    const r = computeLayout(390, 780);
    expect(r.mode).toBe('phone');
    expect(r.stageRect.w).toBe(390);
    expect(r.stageRect.h).toBe(780 - PHONE_TOP_HUD_H - PHONE_BOTTOM_H);
  });

  it('defaults to token-follow framing with no rails', () => {
    const r = computeLayout(414, 896);
    expect(r.framing).toBe('follow');
    expect(r.leftRail).toBe(false);
    expect(r.rightRail).toBe(false);
    expect(r.topBarH).toBe(0);
  });

  it('never returns a width capped at 480 even on a small phone', () => {
    // A 480-wide phone gets the full 480 (no centered card narrower than that).
    expect(computeLayout(480, 800).stageRect.w).toBe(480);
    expect(computeLayout(600, 800).stageRect.w).toBe(600);
  });
});

describe('computeLayout — compact (one rail)', () => {
  it('shows one (left) rail and a board filling the rest', () => {
    const r = computeLayout(900, 700);
    expect(r.mode).toBe('compact');
    expect(r.leftRail).toBe(true);
    expect(r.rightRail).toBe(false);
    expect(r.framing).toBe('whole');
    expect(r.stageRect.w).toBe(900 - COMPACT_RAIL_W);
    expect(r.stageRect.h).toBe(700 - TOP_BAR_H);
  });

  it('keeps the compact board much wider than the old 480 card', () => {
    expect(computeLayout(1000, 720).stageRect.w).toBeGreaterThan(480);
  });
});

describe('computeLayout — cockpit (two rails)', () => {
  it('frames a big center stage between two rails + a top bar', () => {
    const r = computeLayout(1440, 900);
    expect(r.mode).toBe('cockpit');
    expect(r.leftRail).toBe(true);
    expect(r.rightRail).toBe(true);
    expect(r.framing).toBe('whole');
    expect(r.stageRect.w).toBe(1440 - RAIL_W * 2);
    expect(r.stageRect.h).toBe(900 - TOP_BAR_H);
    expect(r.topBarH).toBe(TOP_BAR_H);
  });
});

describe('computeLayout — stage grows with width (no cap)', () => {
  it('stage width grows with width WITHIN the cockpit range (no cap)', () => {
    // Within a single mode the stage scales 1:1 with the viewport (rails are a
    // fixed subtraction). Boundaries intentionally re-add a rail, so we test
    // monotonic growth inside cockpit (the desktop "use the real-estate" case).
    const widths = [1024, 1280, 1600, 1920, 2560];
    const stages = widths.map((w) => computeLayout(w, 900).stageRect.w);
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i]).toBeGreaterThan(stages[i - 1]);
    }
    // The widest desktop board is dramatically bigger than the old 480 cap.
    expect(stages[stages.length - 1]).toBeGreaterThan(480 * 2);
  });

  it('clamps degenerate (tiny) viewports to >= 1px without throwing', () => {
    const r = computeLayout(1, 1);
    expect(r.stageRect.w).toBeGreaterThanOrEqual(1);
    expect(r.stageRect.h).toBeGreaterThanOrEqual(1);
  });

  it('returns integer dimensions', () => {
    const r = computeLayout(1377.7, 843.2);
    expect(Number.isInteger(r.stageRect.w)).toBe(true);
    expect(Number.isInteger(r.stageRect.h)).toBe(true);
  });
});
