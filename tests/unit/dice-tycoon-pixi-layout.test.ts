import { describe, it, expect } from 'vitest';
import {
  ringLayout,
  gridToIso,
  worldToScreen,
  depthKey,
  cameraTarget,
  fitZoom,
  framingMargin,
  boardFitZoom,
  classifyPointer,
  gentleFollowTarget,
  clampPan,
  hopArc,
  hopSquash,
  lerp,
  Spring,
  TILE_W,
  TILE_H,
  TILE_CELL,
} from '../../src/tycoon/pixi/layout';
import { BOARD_SIZE } from '../../src/games/dice-tycoon/board';

/**
 * Pure geometry/camera helpers for the Pixi Tycoon view. NO Pixi/WebGL is
 * touched — these are the unit-testable math extractions the WebGL-bound view
 * consumes (the view itself can't render in jsdom, so it's loaded only via the
 * live app's dynamic import).
 */

describe('ringLayout', () => {
  it('returns exactly BOARD_SIZE points', () => {
    expect(ringLayout().length).toBe(BOARD_SIZE);
  });

  it('places corners (0/5/10/15) at the four extreme grid corners', () => {
    const pts = ringLayout(TILE_CELL);
    const half = (5 * TILE_CELL) / 2; // perimeter of a 6×6 grid centered on 0
    // Corner magnitudes equal `half` on both grid axes.
    for (const i of [0, 5, 10, 15]) {
      expect(Math.abs(pts[i].x)).toBeCloseTo(half);
      expect(Math.abs(pts[i].y)).toBeCloseTo(half);
    }
  });

  it('is centered on the origin (mean ≈ 0)', () => {
    const pts = ringLayout();
    const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    expect(Math.abs(mx)).toBeLessThan(1e-9);
    expect(Math.abs(my)).toBeLessThan(1e-9);
  });

  it('every tile is unique (no two share a position)', () => {
    const pts = ringLayout();
    const seen = new Set(pts.map((p) => `${p.x},${p.y}`));
    expect(seen.size).toBe(BOARD_SIZE);
  });

  it('adjacent tiles are exactly one cell apart (a clean loop)', () => {
    const pts = ringLayout(TILE_CELL);
    for (let i = 0; i < BOARD_SIZE; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % BOARD_SIZE];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      expect(d).toBeCloseTo(TILE_CELL);
    }
  });

  it('scales with the cell parameter', () => {
    const a = ringLayout(1);
    const b = ringLayout(2);
    expect(Math.abs(b[1].x)).toBeCloseTo(Math.abs(a[1].x) * 2);
  });

  it('projects to 20 DISTINCT iso positions forming a diamond', () => {
    const pts = ringLayout(TILE_CELL);
    const proj = pts.map((p) => worldToScreen(p));
    // All distinct on screen.
    const seen = new Set(proj.map((s) => `${s.sx.toFixed(3)},${s.sy.toFixed(3)}`));
    expect(seen.size).toBe(BOARD_SIZE);
    // A diamond is WIDER than tall (2:1 iso): screen-x spread > screen-y spread.
    const xs = proj.map((s) => s.sx);
    const ys = proj.map((s) => s.sy);
    const wSpread = Math.max(...xs) - Math.min(...xs);
    const hSpread = Math.max(...ys) - Math.min(...ys);
    expect(wSpread).toBeGreaterThan(hSpread);
    // The four ring corners project to the four diamond extremes (one each at
    // min/max screen-x and min/max screen-y).
    const cornerProj = [0, 5, 10, 15].map((i) => proj[i]);
    expect(cornerProj.some((s) => s.sx === Math.max(...xs))).toBe(true);
    expect(cornerProj.some((s) => s.sx === Math.min(...xs))).toBe(true);
    expect(cornerProj.some((s) => s.sy === Math.max(...ys))).toBe(true);
    expect(cornerProj.some((s) => s.sy === Math.min(...ys))).toBe(true);
  });
});

describe('gridToIso (true isometric rotation)', () => {
  it('rotates: +gx and +gy push screen-x in OPPOSITE directions', () => {
    const base = gridToIso(0, 0);
    const plusX = gridToIso(1, 0);
    const plusY = gridToIso(0, 1);
    expect(plusX.sx - base.sx).toBeGreaterThan(0); // +gx → +sx
    expect(plusY.sx - base.sx).toBeLessThan(0); // +gy → -sx
  });

  it('recedes: +gx AND +gy both push screen-y DOWN (greater sy)', () => {
    const base = gridToIso(0, 0);
    expect(gridToIso(1, 0).sy - base.sy).toBeGreaterThan(0);
    expect(gridToIso(0, 1).sy - base.sy).toBeGreaterThan(0);
  });

  it('uses the exact iso transform sx=(gx-gy)*W/2, sy=(gx+gy)*H/2', () => {
    const s = gridToIso(3, 1, 100, 50, 10, 20);
    expect(s.sx).toBe(10 + (3 - 1) * 50);
    expect(s.sy).toBe(20 + (3 + 1) * 25);
  });

  it('is a 2:1 dimetric (TILE_H ≈ TILE_W/2)', () => {
    expect(TILE_H).toBeCloseTo(TILE_W / 2);
  });
});

describe('worldToScreen (isometric projection)', () => {
  it('delegates to the iso transform (rotated diamond, not a Y-squash)', () => {
    const sp = worldToScreen({ x: 2, y: 1 });
    const direct = gridToIso(2, 1);
    expect(sp.sx).toBeCloseTo(direct.sx);
    expect(sp.sy).toBeCloseTo(direct.sy);
  });

  it('a pure +gx move goes down-RIGHT; a pure +gy move goes down-LEFT', () => {
    const o = worldToScreen({ x: 0, y: 0 });
    const rx = worldToScreen({ x: 1, y: 0 });
    const ry = worldToScreen({ x: 0, y: 1 });
    expect(rx.sx).toBeGreaterThan(o.sx);
    expect(rx.sy).toBeGreaterThan(o.sy);
    expect(ry.sx).toBeLessThan(o.sx);
    expect(ry.sy).toBeGreaterThan(o.sy);
  });
});

describe('depthKey (iso back-to-front along gx+gy)', () => {
  it('orders nearer (greater gx+gy) tiles after farther ones', () => {
    expect(depthKey({ x: 2, y: 2 })).toBeGreaterThan(depthKey({ x: -2, y: -2 }));
    expect(depthKey({ x: 3, y: 0 })).toBeGreaterThan(depthKey({ x: 0, y: 0 }));
    expect(depthKey({ x: 0, y: 3 })).toBeGreaterThan(depthKey({ x: 0, y: 0 }));
  });

  it('matches the iso depth axis (equal gx+gy → equal depth)', () => {
    expect(depthKey({ x: 2, y: 1 })).toBeCloseTo(depthKey({ x: 1, y: 2 }));
  });

  it('back-to-front sorting the ring yields a near corner last', () => {
    const pts = ringLayout(TILE_CELL);
    const order = pts
      .map((p, i) => ({ i, key: depthKey(p) }))
      .sort((a, b) => a.key - b.key);
    // The last (front-most) tile has the greatest gx+gy of the ring.
    const maxSum = Math.max(...pts.map((p) => p.x + p.y));
    expect(pts[order[order.length - 1].i].x + pts[order[order.length - 1].i].y).toBeCloseTo(
      maxSum,
    );
  });
});

describe('cameraTarget', () => {
  it('centers the focus point in the viewport at zoom 1', () => {
    const t = cameraTarget({ sx: 0, sy: 0 }, 400, 800, 1);
    expect(t.x).toBe(200);
    expect(t.y).toBe(400);
  });

  it('accounts for zoom (focus offset scales)', () => {
    const t = cameraTarget({ sx: 100, sy: 0 }, 400, 800, 2);
    // viewportCenter.x (200) - focus.sx(100)*zoom(2) = 0
    expect(t.x).toBe(0);
  });

  it('a focus at the center stays centered regardless of zoom', () => {
    const t = cameraTarget({ sx: 0, sy: 0 }, 360, 640, 3.5);
    expect(t.x).toBe(180);
    expect(t.y).toBe(320);
  });
});

describe('fitZoom', () => {
  it('fits the limiting axis (smaller of zx/zy)', () => {
    // board 1000x1000 into 400x800 → zx=400/1150≈0.347 < zy=800/1150≈0.695
    const z = fitZoom(1000, 1000, 400, 800);
    expect(z).toBeCloseTo(400 / (1000 * 1.15));
  });

  it('returns a positive finite zoom for a sane viewport', () => {
    expect(fitZoom(1200, 1200, 360, 640)).toBeGreaterThan(0);
  });

  it('guards a zero viewport (never NaN/0)', () => {
    const z = fitZoom(1000, 1000, 0, 0);
    expect(Number.isFinite(z)).toBe(true);
    expect(z).toBeGreaterThan(0);
  });
});

describe('framingMargin', () => {
  it('uses a snug margin in phone portrait (board fills more of the screen)', () => {
    const portrait = framingMargin(360, 700);
    expect(portrait).toBeCloseTo(1.12);
  });

  it('uses a roomier margin on a wide desktop card (framed centerpiece)', () => {
    const wide = framingMargin(640, 420);
    expect(wide).toBeGreaterThan(framingMargin(360, 700));
  });

  it('returns a positive padding for any sane viewport', () => {
    expect(framingMargin(1, 1)).toBeGreaterThan(1);
    expect(framingMargin(1000, 200)).toBeGreaterThan(1);
  });
});

describe('boardFitZoom (default framing shows the WHOLE board)', () => {
  // A board roughly the projected ring size (≈ 1000×620 incl. tile margin).
  const BW = 1000;
  const BH = 620;

  it('never zooms in past the fit (whole board stays on screen)', () => {
    for (const [vw, vh] of [
      [360, 700],
      [414, 896],
      [480, 360],
      [640, 420],
    ]) {
      const z = boardFitZoom(BW, BH, vw, vh);
      // The whole board must fit: scaled board <= viewport on both axes.
      expect(BW * z).toBeLessThanOrEqual(vw + 1e-6);
      expect(BH * z).toBeLessThanOrEqual(vh + 1e-6);
    }
  });

  it('is no tighter than a bare fit with margin 1 (zoomed OUT, not in)', () => {
    const z = boardFitZoom(BW, BH, 360, 700);
    expect(z).toBeLessThanOrEqual(fitZoom(BW, BH, 360, 700, 1) + 1e-9);
  });

  it('frames a wide desktop card looser (bigger margin) than a phone portrait', () => {
    // The wide-card margin leaves more empty space around the board than the
    // snug phone-portrait margin — so for the SAME viewport size the desktop
    // framing zooms out further (board occupies a smaller fraction).
    const portraitMargin = framingMargin(360, 700);
    const wideMargin = framingMargin(640, 420);
    expect(wideMargin).toBeGreaterThan(portraitMargin);
    // And applied: same board into the same-sized box gives a smaller zoom for
    // the looser (wide) margin.
    const tight = fitZoom(BW, BH, 500, 500, portraitMargin);
    const loose = fitZoom(BW, BH, 500, 500, wideMargin);
    expect(loose).toBeLessThan(tight);
  });
});

describe('classifyPointer (tap vs drag threshold)', () => {
  it('classifies sub-threshold movement as a TAP (no roll)', () => {
    expect(classifyPointer(3, 4)).toBe('tap'); // hypot = 5 < 8
    expect(classifyPointer(0, 0)).toBe('tap');
    expect(classifyPointer(7.9, 0)).toBe('tap');
  });

  it('classifies movement at/over the threshold as a DRAG (pan)', () => {
    expect(classifyPointer(8, 0)).toBe('drag');
    expect(classifyPointer(0, 9)).toBe('drag');
    expect(classifyPointer(6, 6)).toBe('drag'); // hypot ≈ 8.49
  });

  it('honors a custom threshold', () => {
    expect(classifyPointer(10, 0, 20)).toBe('tap');
    expect(classifyPointer(25, 0, 20)).toBe('drag');
  });
});

describe('gentleFollowTarget (subtle drift, never far from board-fit)', () => {
  const fit = { x: 100, y: 100 };

  it('stays within maxDrift of the board-fit framing on each axis', () => {
    const far = { x: 100 + 500, y: 100 - 500 };
    const t = gentleFollowTarget(fit, far, 60);
    expect(Math.abs(t.x - fit.x)).toBeLessThanOrEqual(60 + 1e-9);
    expect(Math.abs(t.y - fit.y)).toBeLessThanOrEqual(60 + 1e-9);
  });

  it('passes through small drifts unclamped', () => {
    const near = { x: 130, y: 80 };
    const t = gentleFollowTarget(fit, near, 60);
    expect(t.x).toBeCloseTo(130);
    expect(t.y).toBeCloseTo(80);
  });

  it('drifts TOWARD the token (correct direction)', () => {
    const right = gentleFollowTarget(fit, { x: 1000, y: 100 }, 60);
    expect(right.x).toBeGreaterThan(fit.x);
    const left = gentleFollowTarget(fit, { x: -1000, y: 100 }, 60);
    expect(left.x).toBeLessThan(fit.x);
  });
});

describe('clampPan (board can never be dragged fully off-screen)', () => {
  const BW = 1000;
  const BH = 620;
  const vw = 360;
  const vh = 700;
  const zoom = boardFitZoom(BW, BH, vw, vh);

  it('passes a small pan through unchanged', () => {
    const base = cameraTarget({ sx: 0, sy: 0 }, vw, vh, zoom);
    const want = { x: base.x + 20, y: base.y + 20 };
    const c = clampPan(want, vw, vh, BW, BH, zoom);
    expect(c.x).toBeCloseTo(want.x);
    expect(c.y).toBeCloseTo(want.y);
  });

  it('clamps an extreme pan so part of the board stays on screen', () => {
    const wayOff = { x: 100000, y: 100000 };
    const c = clampPan(wayOff, vw, vh, BW, BH, zoom);
    const half = (BW * zoom) / 2;
    // The board center must keep at least half its extent within the viewport,
    // i.e. center cannot exceed vw + half*0.5 (keep=0.5 default).
    expect(c.x).toBeLessThanOrEqual(vw + half * 0.5 + 1e-6);
    const halfY = (BH * zoom) / 2;
    expect(c.y).toBeLessThanOrEqual(vh + halfY * 0.5 + 1e-6);
  });

  it('clamps a far-negative pan symmetrically', () => {
    const wayOff = { x: -100000, y: -100000 };
    const c = clampPan(wayOff, vw, vh, BW, BH, zoom);
    const half = (BW * zoom) / 2;
    expect(c.x).toBeGreaterThanOrEqual(-half * 0.5 - 1e-6);
  });

  it('always lets the centered (rest) position be reachable', () => {
    const center = cameraTarget({ sx: 0, sy: 0 }, vw, vh, zoom);
    const c = clampPan(center, vw, vh, BW, BH, zoom);
    expect(c.x).toBeCloseTo(center.x);
    expect(c.y).toBeCloseTo(center.y);
  });
});

describe('hopArc', () => {
  it('is zero at the endpoints and peaks at the midpoint', () => {
    expect(hopArc(0, 40)).toBeCloseTo(0);
    expect(hopArc(1, 40)).toBeCloseTo(0);
    expect(hopArc(0.5, 40)).toBeCloseTo(40);
  });

  it('clamps out-of-range progress', () => {
    expect(hopArc(-1, 40)).toBeCloseTo(0);
    expect(hopArc(2, 40)).toBeCloseTo(0);
  });
});

describe('hopSquash', () => {
  it('stretches at takeoff/landing and squashes at the apex', () => {
    const ends = hopSquash(0, 0.2);
    expect(ends.sy).toBeGreaterThan(1); // stretched tall
    expect(ends.sx).toBeLessThan(1);
    const apex = hopSquash(0.5, 0.2);
    expect(apex.sy).toBeLessThan(1); // squashed flat
    expect(apex.sx).toBeGreaterThan(1);
  });

  it('volume-ish: sx and sy move oppositely', () => {
    const m = hopSquash(0.25, 0.2);
    expect((m.sx - 1) * (m.sy - 1)).toBeLessThanOrEqual(0);
  });
});

describe('lerp', () => {
  it('interpolates linearly and clamps t', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, -1)).toBe(0);
    expect(lerp(0, 10, 2)).toBe(10);
  });
});

describe('Spring', () => {
  it('converges toward its target over time', () => {
    const s = new Spring(0, 120, 18);
    s.target = 100;
    for (let i = 0; i < 200; i++) s.step(1 / 60);
    expect(s.value).toBeCloseTo(100, 0);
  });

  it('snap() jumps instantly and zeroes velocity', () => {
    const s = new Spring(0);
    s.target = 999;
    s.step(1 / 60);
    s.snap(50);
    expect(s.value).toBe(50);
    expect(s.target).toBe(50);
    // A step at the snapped value barely moves (no residual velocity).
    const before = s.value;
    s.step(1 / 60);
    expect(Math.abs(s.value - before)).toBeLessThan(1e-6);
  });

  it('clamps a huge dt so a long pause cannot explode it', () => {
    const s = new Spring(0, 200, 10);
    s.target = 100;
    s.step(10); // 10 seconds in one frame
    expect(Number.isFinite(s.value)).toBe(true);
    // Clamped to 1/30s, so it cannot overshoot wildly past the target.
    expect(Math.abs(s.value)).toBeLessThan(1000);
  });
});
