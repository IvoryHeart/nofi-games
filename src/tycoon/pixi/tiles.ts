/**
 * Dice Tycoon — Pixi PX3 readable MGO-style tile builder.
 *
 * Procedural ONLY (Graphics + Text, no image assets). Builds the chunky, glossy,
 * extruded board tiles seen in /tmp/mgo3.png: a coloured top face with a per-
 * group colour band, extruded side faces for depth, a procedural icon, a name
 * label, a value, and a gold coin chip where relevant. Larger corner tiles carry
 * a corner label (Start/Lockup/Vacation/Customs).
 *
 * This module is WebGL-bound (it returns Pixi Containers) so it is exercised only
 * via the live app's dynamic import; the pure label/value formatting it relies on
 * is in chromeMath/TycoonCore and unit-tested separately.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { Tile } from '../../games/dice-tycoon/board';
import { worldToScreen, depthKey, TILE_CELL, ISO_SQUASH, WorldPoint } from './layout';

// Fidelity palette (mirrors docs/plans/dice-tycoon-fidelity.md §A).
const GOLD = 0xf7b500;
const GOLD_HI = 0xffe08a;
const GOLD_SH = 0xb97e00;
const INK = 0x3a2a36;
const CREAM = 0xfff7ec;

// Per-property-group colour bands (Plaza groups). Vibrant + warm.
const PLAZA_BANDS = [0xe0566b, 0xf2913d, 0xf4c233, 0x5bb872, 0x3fa9c9, 0x7e6bd6];

// Top-face colours per non-property tile type.
const TILE_TOP: Record<string, number> = {
  go: 0x5bb872,
  property: 0xf4c233,
  tax: 0x9a3b4e,
  chance: 0xf49b2a,
  treasure: 0x5e3c58,
  railroad: 0x3a4a6a,
  jail: 0xcaa46a,
  parking: 0x3fa9c9,
  gotojail: 0x9a3b4e,
};

/** Our original corner labels (NOT Monopoly's). */
const CORNER_LABELS: Record<string, string> = {
  go: 'START',
  jail: 'LOCKUP',
  parking: 'VACATION',
  gotojail: 'CUSTOMS',
};

export function darken(hex: number, amt: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const m = (c: number) => Math.max(0, Math.round(c * (1 - amt)));
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

function lighten(hex: number, amt: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const m = (c: number) => Math.min(255, Math.round(c + (255 - c) * amt));
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

/** Per-property-group band colour (stable per tile index). */
export function bandColor(index: number): number {
  return PLAZA_BANDS[index % PLAZA_BANDS.length];
}

/** Short value/label text under a tile (mirrors the view's previous logic). */
export function tileLabel(tile: Tile): string {
  switch (tile.type) {
    case 'go':
      return 'START';
    case 'property':
      return tile.name || 'Plaza';
    case 'tax':
      return 'Levy';
    case 'chance':
      return 'Fortune';
    case 'treasure':
      return 'Vault';
    case 'railroad':
      return 'Depot';
    case 'jail':
      return 'Lockup';
    case 'parking':
      return 'Vacation';
    case 'gotojail':
      return 'Customs';
    default:
      return '';
  }
}

/** Value string for the tile's gold chip (empty when no value). */
export function tileValue(tile: Tile): string {
  if (tile.type === 'property') return `${tile.baseValue}`;
  if (tile.type === 'tax') return `-${tile.baseValue}`;
  return '';
}

/**
 * Build one readable, extruded MGO-style tile container positioned at its
 * projected screen point. Corners are larger and carry a corner label.
 */
export function makeTile(tile: Tile, index: number, worldPt: WorldPoint): Container {
  const c = new Container();
  const isCorner = index % 5 === 0;
  const cell = TILE_CELL * (isCorner ? 1.26 : 0.98);
  const hw = cell / 2;
  const hh = (cell / 2) * ISO_SQUASH;
  const depth = isCorner ? 18 : 13;

  const topColor =
    tile.type === 'property' ? bandColor(index) : TILE_TOP[tile.type] ?? CREAM;
  const sideColor = darken(topColor, 0.34);

  const g = new Graphics();
  // Drop shadow under the tile for separation from the board.
  g.ellipse(0, hh + depth + 3, hw * 0.92, hh * 0.5).fill({ color: 0x000000, alpha: 0.16 });
  // Side faces (front + right) for the emboss.
  g.poly([-hw, hh, hw, hh, hw, hh + depth, -hw, hh + depth]).fill(sideColor);
  g.poly([hw, -hh, hw, hh, hw, hh + depth, hw, -hh + depth]).fill(darken(topColor, 0.5));
  // Cream base plate (the chunky white tile body MGO uses), with a coloured
  // band across the top quarter.
  g.roundRect(-hw, -hh, cell, cell * ISO_SQUASH, 6).fill(CREAM);
  g.rect(-hw, -hh, cell, hh * 0.62).fill(topColor);
  // Glossy specular sweep across the band.
  g.poly([-hw, -hh, hw * 0.5, -hh, -hw * 0.1, -hh + hh * 0.6, -hw, -hh + hh * 0.6]).fill({
    color: 0xffffff,
    alpha: 0.22,
  });
  // Rounded ink outline.
  g.roundRect(-hw, -hh, cell, cell * ISO_SQUASH, 6).stroke({ color: INK, width: 2, alpha: 0.28 });
  c.addChild(g);

  if (isCorner) {
    // Corner: a big procedural emblem + a corner label.
    addCornerEmblem(c, tile, hw, hh);
    const cl = new Text({
      text: CORNER_LABELS[tile.type] ?? tile.type.toUpperCase(),
      style: {
        fill: INK,
        fontSize: 12,
        fontWeight: '900',
        fontFamily: 'system-ui, sans-serif',
        align: 'center',
      },
    });
    cl.anchor.set(0.5);
    cl.y = hh * 0.34;
    c.addChild(cl);
  } else {
    addTileIcon(c, tile, hw, hh);
    // Name label centered on the cream body.
    const name = new Text({
      text: tileLabel(tile),
      style: {
        fill: INK,
        fontSize: 9,
        fontWeight: '800',
        fontFamily: 'system-ui, sans-serif',
        align: 'center',
      },
    });
    name.anchor.set(0.5);
    name.y = hh * 0.18;
    name.scale.set(0.92);
    c.addChild(name);

    // Gold coin chip with the value where relevant (property/tax).
    const val = tileValue(tile);
    if (val) {
      const chipY = hh * 0.55;
      const chip = new Graphics();
      const cr = hw * 0.32;
      chip.circle(0, chipY, cr).fill(GOLD).stroke({ color: GOLD_SH, width: 2 });
      chip.circle(-cr * 0.3, chipY - cr * 0.3, cr * 0.45).fill({ color: GOLD_HI, alpha: 0.8 });
      c.addChild(chip);
      const vt = new Text({
        text: val,
        style: {
          fill: tile.type === 'tax' ? 0x9a3b4e : INK,
          fontSize: 9,
          fontWeight: '900',
          fontFamily: 'system-ui, sans-serif',
        },
      });
      vt.anchor.set(0.5);
      vt.y = chipY;
      vt.scale.set(0.95);
      c.addChild(vt);
    }
  }

  const sp = worldToScreen(worldPt);
  c.x = sp.sx;
  c.y = sp.sy;
  return c;
}

/** A small procedural glyph centered on a non-corner tile (no image assets). */
function addTileIcon(c: Container, tile: Tile, hw: number, hh: number): void {
  const g = new Graphics();
  const s = Math.min(hw, hh) * 0.46;
  const accent = 0xffffff;
  const cy = -hh * 0.36;
  g.y = cy;
  switch (tile.type) {
    case 'property':
      // a tiny glossy building
      g.poly([-s * 0.6, s * 0.3, 0, -s * 0.5, s * 0.6, s * 0.3]).fill(accent);
      g.rect(-s * 0.45, s * 0.3, s * 0.9, s * 0.5).fill({ color: accent, alpha: 0.9 });
      g.rect(-s * 0.18, s * 0.42, s * 0.36, s * 0.38).fill({ color: GOLD_HI, alpha: 0.9 });
      break;
    case 'tax':
      g.poly([0, -s * 0.6, s * 0.55, s * 0.5, -s * 0.55, s * 0.5]).fill(0xffe2d6);
      g.rect(-s * 0.08, -s * 0.2, s * 0.16, s * 0.45).fill(0x9a3b4e);
      g.circle(0, s * 0.45, s * 0.1).fill(0x9a3b4e);
      break;
    case 'chance':
      g.circle(0, 0, s * 0.62).fill({ color: GOLD_HI, alpha: 0.95 }).stroke({ color: GOLD_SH, width: 1.5 });
      break;
    case 'treasure':
      g.rect(-s * 0.6, -s * 0.2, s * 1.2, s * 0.7).fill(GOLD);
      g.rect(-s * 0.6, -s * 0.38, s * 1.2, s * 0.22).fill(GOLD_HI);
      g.rect(-s * 0.1, -s * 0.2, s * 0.2, s * 0.7).fill({ color: GOLD_SH, alpha: 0.7 });
      break;
    case 'railroad':
      g.circle(0, 0, s * 0.58).fill(lighten(0x3a4a6a, 0.2)).stroke({ color: GOLD, width: 2 });
      g.circle(0, 0, s * 0.22).fill(GOLD_HI);
      break;
    default:
      return;
  }
  c.addChild(g);
}

/** A larger procedural emblem for a corner tile. */
function addCornerEmblem(c: Container, tile: Tile, hw: number, hh: number): void {
  const g = new Graphics();
  const s = Math.min(hw, hh) * 0.6;
  g.y = -hh * 0.18;
  switch (tile.type) {
    case 'go': {
      // a bold gold arrow (START)
      g.poly([-s * 0.7, -s * 0.25, s * 0.2, -s * 0.25, s * 0.2, -s * 0.55, s * 0.8, 0, s * 0.2, s * 0.55, s * 0.2, s * 0.25, -s * 0.7, s * 0.25])
        .fill(GOLD)
        .stroke({ color: GOLD_SH, width: 2 });
      break;
    }
    case 'jail': {
      // bars (LOCKUP)
      for (let i = -2; i <= 2; i++) {
        g.rect(i * s * 0.26 - s * 0.05, -s * 0.6, s * 0.1, s * 1.2).fill(INK);
      }
      g.rect(-s * 0.7, -s * 0.05, s * 1.4, s * 0.1).fill(INK);
      break;
    }
    case 'parking': {
      // a palm-ish sun (VACATION)
      g.circle(0, -s * 0.1, s * 0.45).fill(GOLD);
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        g.poly([
          Math.cos(ang) * s * 0.5, Math.sin(ang) * s * 0.5 - s * 0.1,
          Math.cos(ang) * s * 0.78, Math.sin(ang) * s * 0.78 - s * 0.1,
          Math.cos(ang + 0.3) * s * 0.5, Math.sin(ang + 0.3) * s * 0.5 - s * 0.1,
        ]).fill(GOLD_HI);
      }
      break;
    }
    case 'gotojail': {
      // a shield/stamp (CUSTOMS)
      g.poly([0, -s * 0.6, s * 0.55, -s * 0.3, s * 0.45, s * 0.5, 0, s * 0.7, -s * 0.45, s * 0.5, -s * 0.55, -s * 0.3])
        .fill(0x9a3b4e)
        .stroke({ color: CREAM, width: 2 });
      g.rect(-s * 0.28, -s * 0.1, s * 0.56, s * 0.12).fill(CREAM);
      g.rect(-s * 0.06, -s * 0.32, s * 0.12, s * 0.56).fill(CREAM);
      break;
    }
    default:
      return;
  }
  c.addChild(g);
}
