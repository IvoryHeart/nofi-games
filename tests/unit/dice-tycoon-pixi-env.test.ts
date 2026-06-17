/**
 * Dice Tycoon — V3 ENVIRONMENT pure-helper tests (no Pixi / no WebGL).
 *
 * Exercises every deterministic decision in `envMath.ts` so the GPU-bound
 * `EnvWorld` builder (untested in jsdom) can be trusted to bake stable, framed,
 * theme-correct layers. Covers: theme selection by board level/name, seeded
 * skyline silhouettes, per-layer parallax, prop scatter (board-AABB avoidance +
 * determinism), island sizing, particle caps, and crossfade easing.
 */

import { describe, it, expect } from 'vitest';
import {
  ENV_THEMES,
  envThemeFor,
  generateSkyline,
  PARALLAX,
  parallaxOffset,
  islandRadius,
  inAABB,
  scatterProps,
  particleCap,
  crossfadeAlpha,
  type EnvTheme,
  type AABB,
} from '../../src/tycoon/pixi/env/envMath';

describe('envMath — EnvTheme presets', () => {
  it('exposes exactly the 4 themes with matching ids', () => {
    const ids = Object.keys(ENV_THEMES).sort();
    expect(ids).toEqual(['coastal', 'desert', 'neon', 'park']);
    for (const id of ids) {
      expect(ENV_THEMES[id as EnvTheme['id']].id).toBe(id);
    }
  });

  it('is frozen (the builder must never mutate it)', () => {
    expect(Object.isFrozen(ENV_THEMES)).toBe(true);
  });

  it('every theme carries the full knob set with valid colour ints', () => {
    for (const t of Object.values(ENV_THEMES)) {
      expect(t.sky).toHaveLength(2);
      expect(t.groundTop).toHaveLength(2);
      expect(t.waterColors).toHaveLength(2);
      expect(t.skylineDensity).toBeGreaterThan(0);
      expect(t.props.length).toBeGreaterThan(0);
      for (const c of [t.glow, t.skylineFar, t.skylineMid, t.groundSide, t.vignette, ...t.sky]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(0xffffff);
      }
    }
  });

  it('only coastal enables the water ring', () => {
    expect(ENV_THEMES.coastal.water).toBe(true);
    expect(ENV_THEMES.park.water).toBe(false);
    expect(ENV_THEMES.neon.water).toBe(false);
    expect(ENV_THEMES.desert.water).toBe(false);
  });
});

describe('envMath — envThemeFor (board → env mapping)', () => {
  it('maps each board theme name to its env theme (case/space-insensitive)', () => {
    expect(envThemeFor('Old Town', 1).id).toBe('park');
    expect(envThemeFor('NEON CITY', 2).id).toBe('neon');
    expect(envThemeFor('  sunset beach ', 3).id).toBe('coastal');
    expect(envThemeFor('Frostpeak', 4).id).toBe('desert');
  });

  it('is deterministic — same input → same theme', () => {
    expect(envThemeFor('Neon City', 7)).toBe(envThemeFor('Neon City', 7));
  });

  it('falls back to a level rotation for unknown names (total + deterministic)', () => {
    const a = envThemeFor('Unknown Place', 0);
    const b = envThemeFor('Unknown Place', 0);
    expect(a).toBe(b);
    // rotation cycles through all 4 across consecutive levels
    const cycled = new Set(
      [0, 1, 2, 3].map((lvl) => envThemeFor('???', lvl).id),
    );
    expect(cycled.size).toBe(4);
  });

  it('handles undefined / non-finite level gracefully', () => {
    expect(envThemeFor(undefined, 0).id).toBeDefined();
    expect(envThemeFor(undefined, NaN).id).toBeDefined();
    expect(envThemeFor('', -5).id).toBeDefined();
  });

  it('negative levels still wrap to a valid preset', () => {
    expect(['park', 'neon', 'coastal', 'desert']).toContain(envThemeFor('x', -1).id);
    expect(['park', 'neon', 'coastal', 'desert']).toContain(envThemeFor('x', -9).id);
  });
});

describe('envMath — generateSkyline (seeded silhouette)', () => {
  it('same seed + count → identical silhouette', () => {
    const a = generateSkyline(0x1234, 12);
    const b = generateSkyline(0x1234, 12);
    expect(a).toEqual(b);
  });

  it('different seeds → different silhouettes', () => {
    const a = generateSkyline(1, 14);
    const b = generateSkyline(2, 14);
    expect(a).not.toEqual(b);
  });

  it('produces `count` buildings (floored, min 1)', () => {
    expect(generateSkyline(5, 10)).toHaveLength(10);
    expect(generateSkyline(5, 0)).toHaveLength(1); // min 1
    expect(generateSkyline(5, 7.9)).toHaveLength(7); // floored
  });

  it('heights stay within [minH, maxH] and widths/x are normalised', () => {
    const buildings = generateSkyline(99, 20, { minH: 0.4, maxH: 0.9 });
    for (const b of buildings) {
      expect(b.h).toBeGreaterThanOrEqual(0.4);
      expect(b.h).toBeLessThanOrEqual(0.9);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(1);
      expect(b.w).toBeGreaterThan(0);
      expect(b.w).toBeLessThanOrEqual(1 / 20); // within its slot
      expect([0, 1, 2]).toContain(b.roof);
    }
  });

  it('buildings march left→right (non-overlapping slots)', () => {
    const buildings = generateSkyline(7, 10);
    for (let i = 1; i < buildings.length; i++) {
      expect(buildings[i].x).toBeGreaterThanOrEqual(buildings[i - 1].x);
    }
  });
});

describe('envMath — parallax', () => {
  it('layer factors run back→front: sky/vignette fixed, island locked, fg over-scrolls', () => {
    expect(PARALLAX.sky).toBe(0);
    expect(PARALLAX.vignette).toBe(0);
    expect(PARALLAX.island).toBe(1);
    expect(PARALLAX.foreground).toBeGreaterThan(1);
    // monotonic increase from far to near
    expect(PARALLAX.clouds).toBeLessThan(PARALLAX.skylineFar);
    expect(PARALLAX.skylineFar).toBeLessThan(PARALLAX.skylineMid);
    expect(PARALLAX.skylineMid).toBeLessThan(PARALLAX.water);
    expect(PARALLAX.water).toBeLessThan(PARALLAX.island);
  });

  it('factor 0 → screen-fixed (no offset)', () => {
    const o = parallaxOffset(120, -80, 0);
    expect(o.x).toBeCloseTo(0);
    expect(o.y).toBeCloseTo(0); // -0 reads as 0
  });

  it('factor 1 → rides the world exactly', () => {
    expect(parallaxOffset(120, -80, 1)).toEqual({ x: 120, y: -80 });
  });

  it('intermediate factor scrolls proportionally', () => {
    expect(parallaxOffset(100, 50, 0.25)).toEqual({ x: 25, y: 12.5 });
  });

  it('clamps negative factors to 0', () => {
    expect(parallaxOffset(100, 50, -0.5)).toEqual({ x: 0, y: 0 });
  });
});

describe('envMath — islandRadius', () => {
  it('rings generously around the board extent (≈1.6×)', () => {
    expect(islandRadius(100)).toBeCloseTo(160);
  });

  it('island always exceeds the board half-extent', () => {
    for (const ext of [50, 120, 400]) {
      expect(islandRadius(ext)).toBeGreaterThan(ext);
    }
  });

  it('guards zero / negative extent and factor', () => {
    expect(islandRadius(0)).toBeGreaterThanOrEqual(1);
    expect(islandRadius(-50)).toBeGreaterThanOrEqual(1);
    expect(islandRadius(100, 0.5)).toBeGreaterThanOrEqual(100); // factor floored to 1
  });
});

describe('envMath — inAABB', () => {
  const box: AABB = { minX: -10, minY: -5, maxX: 10, maxY: 5 };
  it('detects inside / boundary / outside', () => {
    expect(inAABB(0, 0, box)).toBe(true);
    expect(inAABB(-10, -5, box)).toBe(true); // inclusive
    expect(inAABB(10, 5, box)).toBe(true);
    expect(inAABB(11, 0, box)).toBe(false);
    expect(inAABB(0, 6, box)).toBe(false);
  });
});

describe('envMath — scatterProps', () => {
  const box: AABB = { minX: -80, minY: -40, maxX: 80, maxY: 40 };
  const kinds = ENV_THEMES.park.props;

  it('seeded → identical scatter for the same inputs', () => {
    const a = scatterProps(0xabcd, 18, box, 300, kinds);
    const b = scatterProps(0xabcd, 18, box, 300, kinds);
    expect(a).toEqual(b);
  });

  it('different seeds → different scatter', () => {
    const a = scatterProps(1, 18, box, 300, kinds);
    const b = scatterProps(2, 18, box, 300, kinds);
    expect(a).not.toEqual(b);
  });

  it('never places a prop inside the padded board AABB', () => {
    const pad = 24;
    const padded: AABB = {
      minX: box.minX - pad,
      minY: box.minY - pad,
      maxX: box.maxX + pad,
      maxY: box.maxY + pad,
    };
    for (const p of scatterProps(7, 30, box, 300, kinds, pad)) {
      expect(inAABB(p.x, p.y, padded)).toBe(false);
    }
  });

  it('only uses the supplied prop kinds', () => {
    for (const p of scatterProps(7, 30, box, 300, kinds)) {
      expect(kinds).toContain(p.kind);
    }
  });

  it('placements stay within the iso island footprint', () => {
    const islandR = 300;
    for (const p of scatterProps(11, 30, box, islandR, kinds)) {
      // iso: x within ±islandR, y squashed 2:1
      expect(Math.abs(p.x)).toBeLessThanOrEqual(islandR);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(islandR * 0.5);
      expect(p.scale).toBeGreaterThanOrEqual(0.7);
      expect(p.scale).toBeLessThanOrEqual(1.3);
    }
  });

  it('returns placements sorted back→front by depth', () => {
    const out = scatterProps(13, 24, box, 300, kinds);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].depth).toBeGreaterThanOrEqual(out[i - 1].depth);
    }
  });

  it('terminates (no infinite loop) even when the board fills the island', () => {
    // A board AABB bigger than the island leaves nowhere to place — must bail.
    const huge: AABB = { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
    const out = scatterProps(3, 20, huge, 50, kinds);
    expect(out.length).toBeLessThanOrEqual(20);
  });

  it('handles zero count and empty kinds defensively', () => {
    expect(scatterProps(1, 0, box, 300, kinds)).toEqual([]);
    const out = scatterProps(1, 5, box, 300, []);
    expect(out.every((p) => p.kind === 'rock')).toBe(true);
  });
});

describe('envMath — particleCap (responsive)', () => {
  it('desktop (wide landscape) gets the larger budget', () => {
    expect(particleCap(1280, 720)).toBe(60);
  });

  it('narrow viewports get the mobile budget', () => {
    expect(particleCap(390, 844)).toBe(30);
  });

  it('portrait (taller than wide) is treated as mobile', () => {
    expect(particleCap(800, 1000)).toBe(30);
  });

  it('guards zero/negative dimensions', () => {
    expect(particleCap(0, 0)).toBeGreaterThan(0);
    expect(particleCap(-100, -100)).toBeGreaterThan(0);
  });
});

describe('envMath — crossfadeAlpha (smoothstep)', () => {
  it('outgoing alpha goes 1→0 across progress', () => {
    expect(crossfadeAlpha(0)).toBeCloseTo(1);
    expect(crossfadeAlpha(1)).toBeCloseTo(0);
    expect(crossfadeAlpha(0.5)).toBeCloseTo(0.5);
  });

  it('is smoothstep-eased (not linear) and monotonic', () => {
    // smoothstep at 0.25 -> 1 - (0.25^2*(3-0.5)) = 1 - 0.15625
    expect(crossfadeAlpha(0.25)).toBeCloseTo(1 - 0.15625);
    expect(crossfadeAlpha(0.2)).toBeGreaterThan(crossfadeAlpha(0.8));
  });

  it('clamps out-of-range progress', () => {
    expect(crossfadeAlpha(-1)).toBeCloseTo(1);
    expect(crossfadeAlpha(2)).toBeCloseTo(0);
  });
});
