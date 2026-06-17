import { describe, it, expect } from 'vitest';
import {
  odometerStep,
  formatCoins,
  dicePips,
  diceTumbleFace,
  multiplierTone,
  controlBarLayout,
  hitCircle,
  bannerPhase,
  vaultLayout,
  vaultHitTest,
  shakeOffset,
  shutdownTargetLayout,
  shutdownHitTest,
  wreckingBallSwing,
} from '../../src/tycoon/pixi/chromeMath';

/**
 * PX3 PURE chrome math for the Pixi Tycoon view (control bar, cash odometer,
 * dice pips, ribbon banner, vault raid overlay, shake). NO Pixi/WebGL — these
 * are the unit-testable extractions the WebGL-bound view consumes.
 */

describe('odometerStep', () => {
  it('converges to the target in finite steps (count-up)', () => {
    let v = 0;
    let guard = 0;
    while (v !== 1000 && guard++ < 1000) v = odometerStep(v, 1000, 0.2, 3);
    expect(v).toBe(1000);
    expect(guard).toBeLessThan(1000);
  });

  it('converges downward too', () => {
    let v = 500;
    let guard = 0;
    while (v !== 0 && guard++ < 1000) v = odometerStep(v, 0, 0.2, 3);
    expect(v).toBe(0);
  });

  it('snaps when already within minStep', () => {
    expect(odometerStep(999, 1000, 0.2, 5)).toBe(1000);
  });

  it('always advances by at least minStep (no Zeno stall)', () => {
    // Tiny rate, big gap — must still move >= minStep.
    expect(odometerStep(0, 1000, 0.0001, 7)).toBe(7);
  });

  it('guards NaN inputs', () => {
    // NaN current treated as 0, then steps toward target (does not throw).
    expect(odometerStep(NaN, 100, 0.5)).toBe(50);
    // NaN target holds current.
    expect(odometerStep(50, NaN, 0.5)).toBe(50);
  });
});

describe('formatCoins', () => {
  it('comma-groups small numbers', () => {
    expect(formatCoins(1234)).toBe('1,234');
    expect(formatCoins(999)).toBe('999');
  });
  it('abbreviates thousands and millions', () => {
    expect(formatCoins(150000)).toBe('150K');
    expect(formatCoins(1250000)).toBe('1.25M');
    expect(formatCoins(2000000)).toBe('2M');
  });
  it('guards non-finite', () => {
    expect(formatCoins(NaN)).toBe('0');
  });
});

describe('dicePips', () => {
  it('returns the right pip count per face', () => {
    for (let f = 1; f <= 6; f++) {
      expect(dicePips(f, 20).length).toBe(f);
    }
  });
  it('clamps out-of-range faces', () => {
    expect(dicePips(0, 20).length).toBe(1);
    expect(dicePips(99, 20).length).toBe(6);
  });
  it('keeps pips within the cube half-extent', () => {
    for (const p of dicePips(6, 20)) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(20);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(20);
    }
  });
  it('face 1 is centered', () => {
    expect(dicePips(1, 20)).toEqual([{ x: 0, y: 0 }]);
  });
});

describe('diceTumbleFace', () => {
  it('settles to the final face once duration elapses', () => {
    const r = diceTumbleFace(2, 1, 4, 0);
    expect(r.done).toBe(true);
    expect(r.face).toBe(4);
  });
  it('tumbles (not done) before duration', () => {
    const r = diceTumbleFace(0.3, 1, 4, 0);
    expect(r.done).toBe(false);
    expect(r.face).toBeGreaterThanOrEqual(1);
    expect(r.face).toBeLessThanOrEqual(6);
  });
  it('clamps the final face', () => {
    expect(diceTumbleFace(5, 1, 99, 0).face).toBe(6);
    expect(diceTumbleFace(5, 1, 0, 0).face).toBe(1);
  });
});

describe('multiplierTone', () => {
  it('gold for affordable ×1', () => {
    expect(multiplierTone(0, 1)).toBe('gold');
  });
  it('green for affordable premium tiers', () => {
    expect(multiplierTone(1, 5)).toBe('green');
    expect(multiplierTone(2, 20)).toBe('green');
  });
  it('plum when unaffordable', () => {
    expect(multiplierTone(2, 5)).toBe('plum');
    expect(multiplierTone(1, 0)).toBe('plum');
  });
});

describe('controlBarLayout', () => {
  it('centers GO! horizontally', () => {
    const l = controlBarLayout(390, 700);
    expect(l.go.x).toBeCloseTo(195);
  });
  it('keeps the row near the bottom', () => {
    const l = controlBarLayout(390, 700);
    expect(l.rowY).toBeLessThan(700);
    expect(l.rowY).toBeGreaterThan(600);
  });
  it('places dice left of GO! and dial right of GO!', () => {
    const l = controlBarLayout(390, 700);
    expect(l.die1.x).toBeLessThan(l.go.x);
    expect(l.die2.x).toBeLessThan(l.go.x);
    expect(l.dial.x).toBeGreaterThan(l.go.x);
  });
  it('scales the GO! radius within bounds', () => {
    const small = controlBarLayout(200, 400);
    const big = controlBarLayout(900, 700);
    expect(small.goR).toBeGreaterThanOrEqual(30);
    expect(big.goR).toBeLessThanOrEqual(46);
  });
});

describe('hitCircle', () => {
  it('detects inside / outside', () => {
    expect(hitCircle(10, 10, 10, 10, 5)).toBe(true);
    expect(hitCircle(20, 20, 10, 10, 5)).toBe(false);
  });
});

describe('bannerPhase', () => {
  it('is hidden before and after the cycle', () => {
    expect(bannerPhase(-1).vis).toBe(0);
    const after = bannerPhase(10);
    expect(after.vis).toBe(0);
    expect(after.done).toBe(true);
  });
  it('reaches full visibility during the hold', () => {
    expect(bannerPhase(0.28 + 0.5).vis).toBe(1);
  });
  it('fades out near the end', () => {
    const late = bannerPhase(0.28 + 1.1 + 0.35);
    expect(late.vis).toBeLessThan(1);
    expect(late.vis).toBeGreaterThan(0);
    expect(late.done).toBe(false);
  });
  it('eases in from ~0', () => {
    expect(bannerPhase(0.01).vis).toBeLessThan(0.3);
  });
});

describe('vaultLayout + vaultHitTest', () => {
  it('lays out exactly `count` vaults', () => {
    const rects = vaultLayout(3, 0, 300, 200);
    expect(rects.length).toBe(3);
  });
  it('centers the grid within the panel', () => {
    const rects = vaultLayout(3, 0, 300, 200, 3, 14);
    const minX = Math.min(...rects.map((r) => r.x - r.w / 2));
    const maxX = Math.max(...rects.map((r) => r.x + r.w / 2));
    expect((minX + maxX) / 2).toBeCloseTo(150, 0);
  });
  it('hit-tests a tap inside a vault', () => {
    const rects = vaultLayout(3, 0, 300, 200);
    const target = rects[1];
    expect(vaultHitTest(rects, target.x, target.y)).toBe(1);
  });
  it('returns -1 outside all vaults', () => {
    const rects = vaultLayout(3, 0, 300, 200);
    expect(vaultHitTest(rects, -999, -999)).toBe(-1);
  });
  it('handles zero vaults', () => {
    expect(vaultLayout(0, 0, 300, 200)).toEqual([]);
    expect(vaultHitTest([], 0, 0)).toBe(-1);
  });
});

describe('shakeOffset', () => {
  it('is zero when life is exhausted', () => {
    expect(shakeOffset(0, 1, 10, 1)).toEqual({ x: 0, y: 0 });
  });
  it('produces a bounded jitter while alive', () => {
    const o = shakeOffset(1, 1, 10, 0.5);
    expect(Math.abs(o.x)).toBeLessThanOrEqual(10);
    expect(Math.abs(o.y)).toBeLessThanOrEqual(10);
  });
  it('decays as life drops', () => {
    const full = shakeOffset(1, 1, 10, 0.5);
    const low = shakeOffset(0.2, 1, 10, 0.5);
    expect(Math.hypot(low.x, low.y)).toBeLessThan(Math.hypot(full.x, full.y) + 0.001);
  });
});

// ── F4b: Shutdown overlay geometry + wrecking-ball swing ─────────────────────

describe('shutdownTargetLayout + shutdownHitTest (F4b)', () => {
  it('lays out N targets in a centered row within the panel', () => {
    const rects = shutdownTargetLayout(3, 0, 300, 200);
    expect(rects).toHaveLength(3);
    for (const r of rects) {
      expect(r.y).toBe(200);
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
    }
    // Centered: the row's bounding box is symmetric around panel center (150).
    const minX = Math.min(...rects.map((r) => r.x - r.w / 2));
    const maxX = Math.max(...rects.map((r) => r.x + r.w / 2));
    expect((minX + maxX) / 2).toBeCloseTo(150, 1);
  });

  it('caps visible targets at 4', () => {
    expect(shutdownTargetLayout(9, 0, 400, 100)).toHaveLength(4);
  });

  it('returns no rects for zero/negative counts', () => {
    expect(shutdownTargetLayout(0, 0, 300, 200)).toHaveLength(0);
    expect(shutdownTargetLayout(-2, 0, 300, 200)).toHaveLength(0);
  });

  it('hit-tests a tap against the target rects', () => {
    const rects = shutdownTargetLayout(3, 0, 300, 200);
    const t = rects[1];
    expect(shutdownHitTest(rects, t.x, t.y)).toBe(1);
    expect(shutdownHitTest(rects, -999, -999)).toBe(-1);
  });
});

describe('wreckingBallSwing (F4b)', () => {
  it('swings the angle forward monotonically with progress', () => {
    const a = wreckingBallSwing(0).angle;
    const b = wreckingBallSwing(0.5).angle;
    const c = wreckingBallSwing(1).angle;
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('reports impact only past the swing midpoint', () => {
    expect(wreckingBallSwing(0.2).impact).toBe(false);
    expect(wreckingBallSwing(0.9).impact).toBe(true);
  });

  it('clamps progress outside [0,1] (no NaN)', () => {
    const lo = wreckingBallSwing(-1);
    const hi = wreckingBallSwing(2);
    expect(Number.isFinite(lo.angle)).toBe(true);
    expect(Number.isFinite(hi.angle)).toBe(true);
  });
});
