/**
 * Dice Tycoon — V2 art BAKERY (Pixi-bound: gradients + RenderTexture baking).
 *
 * There are only a handful of DISTINCT looks on the board: ~8 tile faces
 * (6 plaza bands + tax/fortune/vault/depot), 4 corner emblems, and 3 building
 * tiers per band. We:
 *   (a) build each distinct per-face `FillGradient` ONCE (a FillGradient
 *       allocates a texture — never per tile per frame) and reuse it;
 *   (b) draw each distinct iso BLOCK once and bake it to a `RenderTexture` via
 *       `renderer.generateTexture(...)` at 2× DPR (crisp on retina/zoom);
 *   (c) hand out lightweight `Sprite`s of those textures instead of live
 *       Graphics — the board is then a few hundred sprites sharing ~20 textures.
 *
 * Everything GPU (gradients + textures) is owned by a `TileBakery` instance and
 * DESTROYED on teardown. WebGL-bound → exercised only on the live app; the pure
 * lighting/palette/layout maths it leans on are unit-tested separately.
 */

import {
  Container,
  FillGradient,
  Graphics,
  RenderTexture,
  Sprite,
  Texture,
  Text,
  type Renderer,
} from 'pixi.js';
import { Tile } from '../../../games/dice-tycoon/board';
import { TILE_W, TILE_H, TILE_DEPTH } from '../layout';
import {
  BandStops,
  CREAM,
  GOLD,
  GOLD_HI,
  GOLD_SH,
  INK,
  TILE_BASE,
  bandStopsFor,
  bandStops,
  darken,
  lighten,
} from './palette';
import {
  AO,
  CONTACT,
  CREASE,
  RIM,
  contactOffset,
  sideFaceStops,
  topFaceStops,
  windowGrid,
} from './lighting';

const BAKE_SCALE = 2; // 2× DPR — crisp on retina + when zoomed.
const CORNER_SCALE = 1.18;

/** Our original corner labels (NOT Monopoly's). */
const CORNER_LABELS: Record<string, string> = {
  go: 'START',
  jail: 'LOCKUP',
  parking: 'VACATION',
  gotojail: 'CUSTOMS',
};

/** The distinct "look key" for a tile — drives bake caching. Pure. */
export function tileLookKey(tile: Tile, index: number): string {
  if (tile.type === 'property') return `plaza:${index % 6}`;
  if (index % 5 === 0) return `corner:${tile.type}`;
  return `tile:${tile.type}`;
}

/** Short value/label text under a tile (unchanged contract from V1 tiles.ts). */
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
 * Owns every baked tile/building RenderTexture + every cached FillGradient for
 * the lifetime of the Pixi view. Bake at init (after the app exists); reuse the
 * cached textures for all 20 tiles + city; DESTROY everything on teardown.
 */
export class TileBakery {
  private renderer: Renderer;
  private texCache = new Map<string, Texture>();
  private gradients: FillGradient[] = [];
  private extraTextures: Texture[] = [];

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  // ── Cached gradients ───────────────────────────────────────────────────────

  /** A cached vertical two-stop FillGradient over (0,top)→(0,bottom). */
  private vGrad(top: number, bottom: number, h: number): FillGradient {
    const g = new FillGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    this.gradients.push(g);
    return g;
  }

  // ── Tile baking ────────────────────────────────────────────────────────────

  /**
   * Get (baking on first request) the baked iso-tile texture for `tile`/`index`.
   * Distinct looks are cached by `tileLookKey`. The returned texture is centred
   * so a Sprite with anchor (0.5,0.5) sits at the tile's projected screen point
   * exactly like the old live-Graphics container did.
   */
  tileTexture(tile: Tile, index: number): Texture {
    const key = tileLookKey(tile, index);
    const cached = this.texCache.get(key);
    if (cached) return cached;
    const g = this.drawTileBlock(tile, index);
    const tex = this.bake(g);
    g.destroy();
    this.texCache.set(key, tex);
    return tex;
  }

  /** A ready-to-place Sprite for a tile (shares the cached texture). */
  tileSprite(tile: Tile, index: number): Sprite {
    const sp = new Sprite(this.tileTexture(tile, index));
    sp.anchor.set(0.5, 0.5);
    return sp;
  }

  /**
   * Draw one EXTRUDED ISOMETRIC tile block with the FULL V2 lighting model into
   * a Graphics, ready to bake. Origin = the tile's projected centre. Mirrors the
   * old `makeTile` geometry but replaces every flat `darken()` face with a
   * gradient + adds the AO seam, crease, rim-light and contact shadow.
   */
  private drawTileBlock(tile: Tile, index: number): Container {
    const root = new Container();
    const isCorner = index % 5 === 0;
    const scale = isCorner ? CORNER_SCALE : 1;
    const hw = (TILE_W / 2) * scale;
    const hh = (TILE_H / 2) * scale;
    const depth = TILE_DEPTH * (isCorner ? 1.5 : 1);

    const base =
      tile.type === 'property'
        ? bandStopsFor(index).mid
        : TILE_BASE[tile.type] ?? CREAM;
    const top: BandStops =
      tile.type === 'property' ? bandStopsFor(index) : bandStops(base);

    const g = new Graphics();

    // Warm contact shadow, offset DOWN-RIGHT to match the top-left light.
    const off = contactOffset(hw, hh);
    g.ellipse(off.dx, hh + depth + off.dy, hw * 0.94, hh * 0.62).fill({
      color: CONTACT.color,
      alpha: CONTACT.alpha,
    });

    // LEFT side face — LIT: brighter two-stop gradient (top edge catches light).
    const lStops = sideFaceStops(base, 'left');
    const leftPoly = [-hw, 0, 0, hh, 0, hh + depth, -hw, depth];
    g.poly(leftPoly).fill(this.vGrad(lStops.top, lStops.bottom, depth + hh));

    // RIGHT side face — SHADOWED: darker, flatter gradient.
    const rStops = sideFaceStops(base, 'right');
    const rightPoly = [0, hh, hw, 0, hw, depth, 0, hh + depth];
    g.poly(rightPoly).fill(this.vGrad(rStops.top, rStops.bottom, depth + hh));

    // AO SEAM — the dark band at the lower V where the two side faces meet.
    g.moveTo(0, hh).lineTo(0, hh + depth).stroke({ color: AO.color, width: 3, alpha: AO.alpha });

    // TOP face — bright vertical ramp (light at the back, mid at the front).
    const tStops = topFaceStops(top);
    const diamond = [0, -hh, hw, 0, 0, hh, -hw, 0];
    g.poly(diamond).fill(this.vGrad(tStops.top, tStops.bottom, hh * 2));

    // Glossy specular sweep across the back-left of the top face.
    g.poly([0, -hh, hw * 0.42, -hh * 0.42, 0, 0, -hw * 0.42, -hh * 0.42]).fill({
      color: 0xffffff,
      alpha: 0.16,
    });

    // Ink outline + a thin crease around the top diamond.
    g.poly(diamond).stroke({ color: INK, width: 1.5, alpha: 0.22 });
    // RIM LIGHT on the top-LEFT edges (the two edges facing the light).
    g.moveTo(0, -hh).lineTo(-hw, 0).stroke({ color: RIM.color, width: RIM.width, alpha: RIM.alpha });
    g.moveTo(-hw, 0).lineTo(0, hh).stroke({ color: RIM.color, width: RIM.width, alpha: RIM.alpha * 0.6 });
    // Crease between the top face and the (right) side face.
    g.moveTo(0, hh).lineTo(hw, 0).stroke({ color: CREASE.color, width: CREASE.width, alpha: CREASE.alpha });

    root.addChild(g);

    if (isCorner) {
      addCornerEmblem(root, tile, hw, hh);
      const cl = new Text({
        text: CORNER_LABELS[tile.type] ?? tile.type.toUpperCase(),
        style: { fill: INK, fontSize: 11, fontWeight: '900', fontFamily: 'system-ui, sans-serif', align: 'center' },
      });
      cl.anchor.set(0.5);
      cl.y = hh * 0.5;
      root.addChild(cl);
    } else {
      addTileIcon(root, tile, hw, hh);
      const name = new Text({
        text: tileLabel(tile),
        style: { fill: INK, fontSize: 9, fontWeight: '800', fontFamily: 'system-ui, sans-serif', align: 'center' },
      });
      name.anchor.set(0.5);
      name.y = hh * 0.08;
      name.scale.set(0.92);
      root.addChild(name);

      const val = tileValue(tile);
      if (val) {
        const chipY = hh * 0.46;
        const cr = hh * 0.5;
        const chip = new Graphics();
        chip.circle(0, chipY, cr).fill(this.goldRadial(cr)).stroke({ color: GOLD_SH, width: 2 });
        // Gold spark glint dot (top-left).
        chip.circle(-cr * 0.32, chipY - cr * 0.34, cr * 0.22).fill({ color: 0xffffff, alpha: 0.85 });
        root.addChild(chip);
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
        root.addChild(vt);
      }
    }
    return root;
  }

  private goldRadialCache: FillGradient | null = null;

  /** A cached radial gold gradient for coin chips (core → gold → hi rim).
   *  Local texture-space (0..1), so it auto-scales to whatever shape it fills. */
  private goldRadial(_r: number): FillGradient {
    if (this.goldRadialCache) return this.goldRadialCache;
    const g = new FillGradient({
      type: 'radial',
      center: { x: 0.4, y: 0.36 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.55,
      colorStops: [
        { offset: 0, color: GOLD_HI },
        { offset: 0.55, color: GOLD },
        { offset: 1, color: GOLD_SH },
      ],
      textureSpace: 'local',
    });
    this.gradients.push(g);
    this.goldRadialCache = g;
    return g;
  }

  // ── Building baking ──────────────────────────────────────────────────────

  /**
   * Get (baking on first request) a glossy building texture for `tier` (0..3).
   * Each tier is baked once and shared. Anchored at the BASE (0.5,1) so the
   * 3-tier rise animation can scale-Y from the ground.
   */
  buildingTexture(tier: number): Texture {
    const key = `bldg:${tier}`;
    const cached = this.texCache.get(key);
    if (cached) return cached;
    const g = this.drawBuilding(tier);
    const tex = this.bake(g);
    g.destroy();
    this.texCache.set(key, tex);
    return tex;
  }

  /** A building Sprite anchored at its base (for scale-Y rise). */
  buildingSprite(tier: number): Sprite {
    const sp = new Sprite(this.buildingTexture(tier));
    sp.anchor.set(0.5, 1);
    return sp;
  }

  /** Draw a glossy extruded building per the §B recipe: per-face gradient +
   *  window grid (~15% lit) + AO + gloss sweep + rim + gold roof finial (tier 3). */
  private drawBuilding(tier: number): Container {
    const root = new Container();
    const specs = [
      { color: 0x8b5e83, w: 50, h: 64 }, // mid-rise
      { color: 0x3fa9c9, w: 60, h: 96 }, // tower
      { color: 0xe0566b, w: 44, h: 132 }, // spire
      { color: GOLD, w: 38, h: 168 }, // golden landmark
    ];
    const s = specs[Math.max(0, Math.min(3, tier))];
    const hw = s.w / 2;
    const g = new Graphics();

    // Ground shadow.
    g.ellipse(hw * 0.12, 6, hw * 1.1, 9).fill({ color: CONTACT.color, alpha: CONTACT.alpha + 0.02 });

    // Front face — vertical gradient (lighter top, mid bottom).
    g.rect(-hw, -s.h, s.w, s.h).fill(this.vGrad(lighten(s.color, 0.16), s.color, s.h));
    // Right (shadowed) face slab.
    g.rect(hw - 9, -s.h, 9, s.h).fill(this.vGrad(darken(s.color, 0.28), darken(s.color, 0.42), s.h));
    // Left (lit) edge highlight strip.
    g.rect(-hw, -s.h, hw * 0.42, s.h).fill({ color: 0xffffff, alpha: 0.12 });
    // AO at the building base.
    g.rect(-hw, -10, s.w, 10).fill({ color: AO.color, alpha: AO.alpha * 0.7 });

    // Window grid (~15% lit, deterministic per tier).
    for (const win of windowGrid(s.w, s.h, { seed: tier + 1 })) {
      const wx = -hw + win.x;
      const wy = -s.h + win.y;
      g.roundRect(wx, wy, win.w, win.h, 1.4).fill({
        color: win.lit ? GOLD_HI : 0x2b3a52,
        alpha: win.lit ? 0.92 : 0.55,
      });
    }

    // Roof cap.
    g.poly([-hw, -s.h, hw, -s.h, hw - 6, -s.h - 12, -hw + 6, -s.h - 12]).fill(
      tier === 3 ? GOLD_HI : darken(s.color, 0.15),
    );
    // Gloss sweep down the front-left.
    g.poly([-hw, -s.h, -hw + s.w * 0.3, -s.h, -hw + s.w * 0.12, -4, -hw, -4]).fill({
      color: 0xffffff,
      alpha: 0.1,
    });
    // Rim light on the top-left vertical edge.
    g.moveTo(-hw, -s.h).lineTo(-hw, -4).stroke({ color: RIM.color, width: 1.5, alpha: RIM.alpha });
    g.moveTo(-hw, -s.h).lineTo(hw, -s.h).stroke({ color: RIM.color, width: 1.2, alpha: RIM.alpha * 0.7 });

    // Tier-3 gold roof finial.
    if (tier === 3) {
      g.poly([0, -s.h - 12, 8, -s.h + 2, 0, -s.h + 10, -8, -s.h + 2]).fill(GOLD).stroke({ color: GOLD_SH, width: 1.5 });
      g.poly([0, -s.h - 26, 5, -s.h - 12, -5, -s.h - 12]).fill(GOLD_HI);
    }
    root.addChild(g);
    return root;
  }

  // ── Bake primitive ─────────────────────────────────────────────────────────

  /** Bake a container to a RenderTexture at 2× DPR. The caller destroys the
   *  source container; the texture is tracked + destroyed by `destroy()`. */
  private bake(node: Container): Texture {
    return this.renderer.generateTexture({
      target: node,
      resolution: BAKE_SCALE,
      antialias: true,
    });
  }

  /** Track an externally-created texture (e.g. a baked SVG) for teardown. */
  track(tex: Texture): void {
    this.extraTextures.push(tex);
  }

  // ── Teardown ───────────────────────────────────────────────────────────────

  /** Destroy every baked texture + cached gradient. Idempotent. */
  destroy(): void {
    for (const t of this.texCache.values()) {
      try {
        t.destroy(true);
      } catch {
        /* already gone */
      }
    }
    this.texCache.clear();
    for (const t of this.extraTextures) {
      try {
        t.destroy(true);
      } catch {
        /* already gone */
      }
    }
    this.extraTextures = [];
    for (const g of this.gradients) {
      try {
        (g as unknown as { destroy?: () => void }).destroy?.();
      } catch {
        /* gradients may not expose destroy in all builds */
      }
    }
    this.gradients = [];
  }
}

// ── Procedural emblems/icons (drawn ONCE per look into the bake) ──────────────

/** A small procedural glyph on the BACK half of a non-corner tile's top face. */
function addTileIcon(c: Container, tile: Tile, hw: number, hh: number): void {
  const g = new Graphics();
  const s = Math.min(hw, hh) * 0.7;
  const accent = 0xffffff;
  g.y = -hh * 0.42;
  switch (tile.type) {
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
    case 'property':
      g.poly([-s * 0.6, s * 0.3, 0, -s * 0.5, s * 0.6, s * 0.3]).fill(accent);
      g.rect(-s * 0.45, s * 0.3, s * 0.9, s * 0.5).fill({ color: accent, alpha: 0.9 });
      g.rect(-s * 0.18, s * 0.42, s * 0.36, s * 0.38).fill({ color: GOLD_HI, alpha: 0.9 });
      break;
    default:
      return;
  }
  c.addChild(g);
}

/** A larger procedural emblem for a corner tile (on the top face). */
function addCornerEmblem(c: Container, tile: Tile, hw: number, hh: number): void {
  const g = new Graphics();
  const s = Math.min(hw, hh) * 0.85;
  g.y = -hh * 0.28;
  switch (tile.type) {
    case 'go':
      g.poly([-s * 0.7, -s * 0.25, s * 0.2, -s * 0.25, s * 0.2, -s * 0.55, s * 0.8, 0, s * 0.2, s * 0.55, s * 0.2, s * 0.25, -s * 0.7, s * 0.25])
        .fill(GOLD)
        .stroke({ color: GOLD_SH, width: 2 });
      break;
    case 'jail':
      for (let i = -2; i <= 2; i++) {
        g.rect(i * s * 0.26 - s * 0.05, -s * 0.6, s * 0.1, s * 1.2).fill(INK);
      }
      g.rect(-s * 0.7, -s * 0.05, s * 1.4, s * 0.1).fill(INK);
      break;
    case 'parking':
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
    case 'gotojail':
      g.poly([0, -s * 0.6, s * 0.55, -s * 0.3, s * 0.45, s * 0.5, 0, s * 0.7, -s * 0.45, s * 0.5, -s * 0.55, -s * 0.3])
        .fill(0x9a3b4e)
        .stroke({ color: CREAM, width: 2 });
      g.rect(-s * 0.28, -s * 0.1, s * 0.56, s * 0.12).fill(CREAM);
      g.rect(-s * 0.06, -s * 0.32, s * 0.12, s * 0.56).fill(CREAM);
      break;
    default:
      return;
  }
  c.addChild(g);
}
