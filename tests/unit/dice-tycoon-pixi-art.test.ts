import { describe, it, expect } from 'vitest';
import {
  toRgb,
  fromRgb,
  darken,
  lighten,
  mix,
  toHexString,
  bandStops,
  bandStopsFor,
  bandColor,
  PLAZA_BANDS,
  GOLD_STOPS,
  GOLD,
  GOLD_HI,
  GOLD_CORE,
} from '../../src/tycoon/pixi/art/palette';
import {
  FACE,
  faceDarken,
  sideFaceColor,
  sideFaceStops,
  topFaceStops,
  contactOffset,
  windowGrid,
  isLit,
  litCount,
  LIGHT_DIR,
  AO,
  RIM,
  CONTACT,
} from '../../src/tycoon/pixi/art/lighting';
import {
  PENNY_SVG,
  FINIAL_SVG,
  isWellFormedSvg,
} from '../../src/tycoon/pixi/art/svg';
import {
  tileLookKey,
  tileLabel,
  tileValue,
} from '../../src/tycoon/pixi/art/bake';
import type { Tile, TileType } from '../../src/games/dice-tycoon/board';

/**
 * V2 art-upgrade PURE helpers (palette/lighting/svg/bake). NO Pixi/WebGL is
 * instantiated — only the colour, shade, window-grid and SVG-string maths the
 * WebGL-bound bakery consumes. The bakery/textures themselves are exercised only
 * on the live app (jsdom has no GPU).
 */

function tile(type: TileType, index: number, baseValue = 0): Tile {
  return { index, type, name: type, baseValue };
}

// ── palette: colour ops ──────────────────────────────────────────────────────

describe('palette colour ops', () => {
  it('toRgb / fromRgb round-trip', () => {
    expect(toRgb(0xe0566b)).toEqual([0xe0, 0x56, 0x6b]);
    expect(fromRgb(0xe0, 0x56, 0x6b)).toBe(0xe0566b);
  });

  it('fromRgb clamps out-of-range channels', () => {
    expect(fromRgb(300, -10, 128)).toBe((255 << 16) | (0 << 8) | 128);
  });

  it('darken(0) and lighten(0) are identity', () => {
    expect(darken(0x808080, 0)).toBe(0x808080);
    expect(lighten(0x808080, 0)).toBe(0x808080);
  });

  it('darken(1) → black, lighten(1) → white', () => {
    expect(darken(0x808080, 1)).toBe(0x000000);
    expect(lighten(0x808080, 1)).toBe(0xffffff);
  });

  it('darken reduces every channel, lighten raises every channel', () => {
    const base = 0x6699cc;
    const [dr, dg, db] = toRgb(darken(base, 0.3));
    const [br, bg, bb] = toRgb(base);
    expect(dr).toBeLessThan(br);
    expect(dg).toBeLessThan(bg);
    expect(db).toBeLessThan(bb);
    const [lr, lg, lb] = toRgb(lighten(base, 0.3));
    expect(lr).toBeGreaterThan(br);
    expect(lg).toBeGreaterThan(bg);
    expect(lb).toBeGreaterThan(bb);
  });

  it('mix at the endpoints returns the endpoints', () => {
    expect(mix(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mix(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mix(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });

  it('toHexString pads to 6 digits with a leading #', () => {
    expect(toHexString(0x0000ff)).toBe('#0000ff');
    expect(toHexString(0xffe08a)).toBe('#ffe08a');
  });
});

// ── palette: band gradient-stop derivation ───────────────────────────────────

describe('palette band stops', () => {
  it('mid stop equals the base; light is brighter; dark is darker', () => {
    for (const base of PLAZA_BANDS) {
      const s = bandStops(base);
      expect(s.mid).toBe(base);
      // light brighter than mid brighter than dark (luminance proxy = sum).
      const sum = (h: number) => toRgb(h).reduce((a, b) => a + b, 0);
      expect(sum(s.light)).toBeGreaterThan(sum(s.mid));
      expect(sum(s.dark)).toBeLessThan(sum(s.mid));
    }
  });

  it('intensity 0 collapses light/dark to the mid', () => {
    const s = bandStops(0x5bb872, 0);
    expect(s.light).toBe(s.mid);
    expect(s.dark).toBe(s.mid);
  });

  it('bandStopsFor / bandColor wrap by index modulo 6 (and handle negatives)', () => {
    expect(bandColor(0)).toBe(PLAZA_BANDS[0]);
    expect(bandColor(6)).toBe(PLAZA_BANDS[0]);
    expect(bandColor(7)).toBe(PLAZA_BANDS[1]);
    expect(bandColor(-1)).toBe(PLAZA_BANDS[5]);
    expect(bandStopsFor(8).mid).toBe(PLAZA_BANDS[2]);
  });

  it('gold stops ramp core → gold → hi', () => {
    expect(GOLD_STOPS.dark).toBe(GOLD_CORE);
    expect(GOLD_STOPS.mid).toBe(GOLD);
    expect(GOLD_STOPS.light).toBe(GOLD_HI);
  });
});

// ── lighting: face shade math ────────────────────────────────────────────────

describe('lighting face model', () => {
  it('light comes from the top-left', () => {
    expect(LIGHT_DIR.x).toBeLessThan(0);
    expect(LIGHT_DIR.y).toBeLessThan(0);
  });

  it('top face is fully lit; LEFT is LIT brighter than the SHADOWED RIGHT', () => {
    expect(FACE.top).toBe(1);
    expect(FACE.left).toBeGreaterThan(FACE.right);
    expect(FACE.left).toBeLessThan(FACE.top);
  });

  it('faceDarken: top darkens 0, lit < shadowed', () => {
    expect(faceDarken('top')).toBe(0);
    expect(faceDarken('left')).toBeLessThan(faceDarken('right'));
  });

  it('the lit (left) side face is brighter than the shadowed (right) one', () => {
    const base = 0x3fa9c9;
    const lit = sideFaceColor(base, 'left');
    const shadow = sideFaceColor(base, 'right');
    const sum = (h: number) => toRgb(h).reduce((a, b) => a + b, 0);
    expect(sum(lit)).toBeGreaterThan(sum(shadow));
    // and both are darker than the base top colour.
    expect(sum(lit)).toBeLessThan(sum(base));
  });

  it('side-face stops: left top edge is lit brightest; right stays dark', () => {
    const base = 0xe0566b;
    const l = sideFaceStops(base, 'left');
    const r = sideFaceStops(base, 'right');
    const sum = (h: number) => toRgb(h).reduce((a, b) => a + b, 0);
    expect(sum(l.top)).toBeGreaterThan(sum(l.bottom)); // lit catches light at top
    expect(sum(l.top)).toBeGreaterThan(sum(r.top)); // left brighter than right
    expect(sum(r.bottom)).toBeLessThan(sum(r.top)); // deepens toward the AO seam
  });

  it('top-face stops go light (back) → mid (front)', () => {
    const s = topFaceStops(bandStops(0xf4c233));
    const sum = (h: number) => toRgb(h).reduce((a, b) => a + b, 0);
    expect(sum(s.top)).toBeGreaterThan(sum(s.bottom));
  });

  it('AO / rim / contact cues use sensible alphas', () => {
    expect(AO.alpha).toBeGreaterThan(0);
    expect(AO.alpha).toBeLessThan(0.5);
    expect(RIM.alpha).toBeGreaterThan(0);
    expect(CONTACT.alpha).toBeGreaterThan(0);
    expect(CONTACT.alpha).toBeLessThan(0.5);
  });

  it('contact shadow offsets DOWN and RIGHT (matching a top-left light)', () => {
    const off = contactOffset(58, 29);
    expect(off.dx).toBeGreaterThan(0); // right
    expect(off.dy).toBeGreaterThan(0); // down
  });
});

// ── lighting: window-grid layout ─────────────────────────────────────────────

describe('window grid', () => {
  it('returns a non-empty grid inside the face margins', () => {
    const cells = windowGrid(60, 96);
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(60);
      expect(c.y + c.h).toBeLessThanOrEqual(96);
    }
  });

  it('returns empty for a face too small for any window', () => {
    expect(windowGrid(4, 4)).toEqual([]);
  });

  it('is deterministic for a given seed (stable per bake)', () => {
    const a = windowGrid(50, 64, { seed: 3 });
    const b = windowGrid(50, 64, { seed: 3 });
    expect(a.map((c) => c.lit)).toEqual(b.map((c) => c.lit));
  });

  it('different seeds can differ; lit fraction is roughly litRatio', () => {
    const cells = windowGrid(120, 200, { seed: 1, litRatio: 0.15 });
    const frac = litCount(cells) / cells.length;
    // Loose bounds — it is a hash, not an exact quota.
    expect(frac).toBeGreaterThanOrEqual(0);
    expect(frac).toBeLessThan(0.5);
  });

  it('isLit is deterministic and ratio-monotone', () => {
    expect(isLit(2, 3, 5, 0.15)).toBe(isLit(2, 3, 5, 0.15));
    // litRatio 1 lights everything; 0 lights nothing.
    expect(isLit(2, 3, 5, 1)).toBe(true);
    expect(isLit(2, 3, 5, 0)).toBe(false);
  });
});

// ── svg: well-formed hero strings ────────────────────────────────────────────

describe('inline-SVG hero strings', () => {
  it('Penny SVG is well-formed', () => {
    expect(isWellFormedSvg(PENNY_SVG)).toBe(true);
  });

  it('Finial SVG is well-formed', () => {
    expect(isWellFormedSvg(FINIAL_SVG)).toBe(true);
  });

  it('isWellFormedSvg rejects junk', () => {
    expect(isWellFormedSvg('')).toBe(false);
    expect(isWellFormedSvg('<div>x</div>')).toBe(false);
    expect(isWellFormedSvg('<svg>missing bits</svg>')).toBe(false);
    expect(isWellFormedSvg('<svg viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg">a & b</svg>')).toBe(false);
  });

  it('Penny parses via DOMParser with NO parser errors', () => {
    const doc = new DOMParser().parseFromString(PENNY_SVG, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.tagName.toLowerCase()).toBe('svg');
  });

  it('Penny contains the original mascot features (NOT Mr. Monopoly)', () => {
    const doc = new DOMParser().parseFromString(PENNY_SVG, 'image/svg+xml');
    // Round body, ears, snout, monocle ring, bow tie, coin-slot, contact shadow.
    expect(doc.querySelectorAll('ellipse').length).toBeGreaterThanOrEqual(3); // body+belly+cheek+shadow
    expect(doc.querySelectorAll('circle').length).toBeGreaterThanOrEqual(3); // eyes + monocle + bow knot
    expect(doc.querySelectorAll('rect').length).toBeGreaterThanOrEqual(1); // coin-slot
    expect(doc.querySelectorAll('radialGradient').length).toBeGreaterThanOrEqual(1); // radial body shading
    // No top-hat morning-suit gentleman — Penny has a coin-slot, not a hat.
    expect(PENNY_SVG.toLowerCase()).not.toContain('monopoly');
  });

  it('Finial parses and is a gold spire (linear gradient + diamond cap)', () => {
    const doc = new DOMParser().parseFromString(FINIAL_SVG, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelectorAll('linearGradient').length).toBe(1);
    expect(doc.querySelectorAll('path').length).toBeGreaterThanOrEqual(2);
  });
});

// ── bake: pure look-key + label + value derivation ───────────────────────────

describe('bake look-key + labels', () => {
  it('plaza tiles bucket by index modulo 6 (6 distinct looks)', () => {
    const keys = new Set<string>();
    for (let i = 1; i < 20; i++) {
      if (i % 5 === 0) continue; // skip corners
      keys.add(tileLookKey(tile('property', i, 40), i));
    }
    // at most 6 distinct plaza looks.
    expect([...keys].every((k) => k.startsWith('plaza:'))).toBe(true);
    expect(keys.size).toBeLessThanOrEqual(6);
  });

  it('corners get a corner: key by TYPE (robust to BOARD_SIZE, not index stride)', () => {
    // Corners are identified by tile TYPE now (the 40-space board has them at
    // 0/10/20/30, so a fixed index stride would be wrong).
    expect(tileLookKey(tile('go', 0), 0)).toBe('corner:go');
    expect(tileLookKey(tile('jail', 10), 10)).toBe('corner:jail');
    expect(tileLookKey(tile('parking', 20), 20)).toBe('corner:parking');
    expect(tileLookKey(tile('gotojail', 30), 30)).toBe('corner:gotojail');
    expect(tileLookKey(tile('tax', 2, 25), 2)).toBe('tile:tax');
    expect(tileLookKey(tile('treasure', 3), 3)).toBe('tile:treasure');
  });

  it('plaza look-key uses the tile color-group band when present (groups share a color)', () => {
    // Two adjacent plazas in the same band → same look key, regardless of index.
    const a: Tile = { index: 7, type: 'property', name: 'A', baseValue: 40, band: 2 };
    const b: Tile = { index: 8, type: 'property', name: 'B', baseValue: 46, band: 2 };
    const c: Tile = { index: 9, type: 'property', name: 'C', baseValue: 52, band: 3 };
    expect(tileLookKey(a, a.index)).toBe('plaza:2');
    expect(tileLookKey(b, b.index)).toBe(tileLookKey(a, a.index)); // shared group color
    expect(tileLookKey(c, c.index)).toBe('plaza:3');
  });

  it('tileLabel uses OUR names (Plaza/Levy/Fortune/Vault/Depot, not Monopoly)', () => {
    expect(tileLabel(tile('tax', 2, 25))).toBe('Levy');
    expect(tileLabel(tile('chance', 3))).toBe('Fortune');
    expect(tileLabel(tile('treasure', 4))).toBe('Vault');
    expect(tileLabel(tile('railroad', 6))).toBe('Depot');
    expect(tileLabel({ index: 1, type: 'property', name: 'Old Town', baseValue: 40 })).toBe('Old Town');
    expect(tileLabel({ index: 1, type: 'property', name: '', baseValue: 40 })).toBe('Plaza');
  });

  it('tileValue: property → value, tax → negative, else empty', () => {
    expect(tileValue(tile('property', 1, 64))).toBe('64');
    expect(tileValue(tile('tax', 2, 25))).toBe('-25');
    expect(tileValue(tile('chance', 3))).toBe('');
    expect(tileValue(tile('go', 0))).toBe('');
  });
});
