/**
 * Dice Tycoon — V3 ENVIRONMENT pure math (no Pixi, no DOM, no WebGL).
 *
 * The procedural iso-world that frames the board (docs §C): sky → clouds →
 * skyline → water → iso island → ground props → board → foreground props →
 * vignette. EVERY decision that can be expressed as numbers lives here so it can
 * be unit-tested in jsdom — the Pixi-bound builder (`EnvWorld`) consumes these
 * to bake the static layers + drive parallax. Pure + deterministic: a given
 * EnvTheme + seed always yields the identical skyline silhouette and prop
 * scatter (so the baked layers are stable across resumes / re-bakes).
 *
 * The 4 EnvThemes (Park / Coastal / Neon / Desert) are selected from the board's
 * BoardTheme/boardLevel, so the environment matches the city the player is in.
 */

import { mulberry32 } from '../../../utils/rng';

// ── EnvTheme config ──────────────────────────────────────────────────────────

/** One ambient particle style for the sky/water layers. */
export type EnvParticle = 'clouds' | 'sparkles' | 'embers' | 'dust';

/** A scattered ground-prop kind (procedural Graphics baked to a texture). */
export type EnvProp = 'tree' | 'bush' | 'rock' | 'lamp' | 'palm' | 'cactus' | 'pylon';

/**
 * A full environment theme: desaturated/atmospheric palettes (the env must
 * RECEDE behind the saturated board) plus the procedural knobs that drive the
 * generators. All colours are 0xRRGGBB ints. Pure data — no GPU here.
 */
export interface EnvTheme {
  /** Stable id (matches the preset key). */
  id: 'park' | 'coastal' | 'neon' | 'desert';
  /** Human label (debug / parity with board theme). */
  name: string;
  /** Sky vertical gradient [top, bottom] — top hazier/cooler, bottom warm. */
  sky: [number, number];
  /** Sun/moon glow disc tint. */
  glow: number;
  /** Far + mid skyline band tints (farther = lighter/bluer = more atmospheric). */
  skylineFar: number;
  skylineMid: number;
  /** Iso ground island: top gradient [back,front] + beveled side. */
  groundTop: [number, number];
  groundSide: number;
  /** Coastal water ring on? + its iso gradient [outer, inner]. */
  water: boolean;
  waterColors: [number, number];
  /** Ambient particle style for the sky layer. */
  particle: EnvParticle;
  /** Ground-prop kinds scattered in the island margin (seeded). */
  props: EnvProp[];
  /** Skyline generator: seed + density (buildings per band). */
  skylineSeed: number;
  skylineDensity: number;
  /** Vignette / warm-grade corner tint (multiply blend, screen-fixed). */
  vignette: number;
}

/** The 4 authoritative presets (docs §C per-theme table). Desaturated so the
 *  board stays hero. Exported frozen — the builder reads, never mutates. */
export const ENV_THEMES: Readonly<Record<EnvTheme['id'], EnvTheme>> = Object.freeze({
  // Park: green rolling grass, soft blue sky, leafy props, no water.
  park: {
    id: 'park',
    name: 'Park',
    sky: [0xa9c7e8, 0xfef0e4],
    glow: 0xfff3d8,
    skylineFar: 0xc3d4e0,
    skylineMid: 0x9fb6c4,
    groundTop: [0xb6d06a, 0x96bd4a],
    groundSide: 0x6f9437,
    water: false,
    waterColors: [0x5fc4d8, 0x8fd9e6],
    particle: 'clouds',
    props: ['tree', 'bush', 'rock', 'lamp'],
    skylineSeed: 0x5a17,
    skylineDensity: 14,
    vignette: 0x3a2a3e,
  },
  // Coastal: beach + a blue water ring, lighthouse-y haze, palms.
  coastal: {
    id: 'coastal',
    name: 'Coastal',
    sky: [0x9fc6e8, 0xfdeede],
    glow: 0xfff0cf,
    skylineFar: 0xbcd2dd,
    skylineMid: 0x93b4c2,
    groundTop: [0xeadfc0, 0xd9c79e],
    groundSide: 0xb29a6c,
    water: true,
    waterColors: [0x4fb6cf, 0x86d6e3],
    particle: 'sparkles',
    props: ['palm', 'rock', 'bush', 'lamp'],
    skylineSeed: 0xc0a5,
    skylineDensity: 16,
    vignette: 0x35283c,
  },
  // Neon: dusk city, purple-magenta sky, glowing skyline, ember motes, pylons.
  neon: {
    id: 'neon',
    name: 'Neon',
    sky: [0x3a2a55, 0x7d4a86],
    glow: 0xff9ad6,
    skylineFar: 0x5a4a78,
    skylineMid: 0x7a5a96,
    groundTop: [0x4a3a63, 0x352a4a],
    groundSide: 0x241a33,
    water: false,
    waterColors: [0x4a6ad8, 0x7a9ae8],
    particle: 'embers',
    props: ['pylon', 'lamp', 'rock', 'bush'],
    skylineSeed: 0x9e02,
    skylineDensity: 22,
    vignette: 0x1e1430,
  },
  // Desert: warm sand dunes, hazy ochre sky, distant mesas, cacti + dust.
  desert: {
    id: 'desert',
    name: 'Desert',
    sky: [0xe9c79a, 0xfef0e4],
    glow: 0xfff0c8,
    skylineFar: 0xd8c2a4,
    skylineMid: 0xc2a880,
    groundTop: [0xe8c88f, 0xd4ad6c],
    groundSide: 0xa9824a,
    water: false,
    waterColors: [0x5fc4d8, 0x8fd9e6],
    particle: 'dust',
    props: ['cactus', 'rock', 'cactus', 'rock'],
    skylineSeed: 0x3df1,
    skylineDensity: 12,
    vignette: 0x3a2a2e,
  },
});

/**
 * Map the board's level (cycles the 4 board themes Old Town / Neon City /
 * Sunset Beach / Frostpeak) onto an EnvTheme. The mapping is by board theme
 * name first (robust to level offsets), falling back to `boardLevel % 4`.
 * Deterministic + total — any input yields a valid preset.
 *
 *   Old Town    → Park
 *   Neon City   → Neon
 *   Sunset Beach→ Coastal
 *   Frostpeak   → Desert (warm; closest structural fit available)
 */
export function envThemeFor(themeName: string | undefined, boardLevel: number): EnvTheme {
  const byName: Record<string, EnvTheme['id']> = {
    'old town': 'park',
    'neon city': 'neon',
    'sunset beach': 'coastal',
    'frostpeak': 'desert',
  };
  const key = (themeName ?? '').trim().toLowerCase();
  if (byName[key]) return ENV_THEMES[byName[key]];
  // Fallback: rotate by level so it is still deterministic + total.
  const order: EnvTheme['id'][] = ['park', 'neon', 'coastal', 'desert'];
  const lvl = Number.isFinite(boardLevel) ? Math.floor(boardLevel) : 0;
  const idx = ((lvl % order.length) + order.length) % order.length;
  return ENV_THEMES[order[idx]];
}

// ── Seeded skyline generation ────────────────────────────────────────────────

/** One building silhouette in a skyline band (normalised: x in [0,1] of band
 *  width, w/h as fractions). Pure data — the builder draws a rect per entry. */
export interface SkylineBuilding {
  x: number; // left edge, 0..1 across the band
  w: number; // width, fraction of band width
  h: number; // height, fraction of band height (0..1)
  /** Roof style index 0..2 (flat / stepped / spire) for silhouette variety. */
  roof: number;
}

/**
 * Generate a deterministic skyline silhouette band. Same (seed, count) → the
 * identical array, so the baked RenderTexture is stable across re-bakes. The far
 * band passes a smaller `maxH` (shorter, hazier) than the mid band. Buildings
 * march left→right with small gaps; heights vary within [minH, maxH]. Pure.
 */
export function generateSkyline(
  seed: number,
  count: number,
  opts: { minH?: number; maxH?: number } = {},
): SkylineBuilding[] {
  const n = Math.max(1, Math.floor(count));
  const minH = opts.minH ?? 0.35;
  const maxH = opts.maxH ?? 1;
  const rng = mulberry32(seed >>> 0);
  const out: SkylineBuilding[] = [];
  // Lay buildings across [0,1] in n slots, each building filling most of its
  // slot with a small jitter so the band reads as a varied silhouette.
  const slot = 1 / n;
  for (let i = 0; i < n; i++) {
    const wFrac = 0.55 + rng() * 0.4; // 55–95% of the slot
    const w = slot * wFrac;
    const pad = slot - w;
    const x = i * slot + pad * rng();
    const h = minH + rng() * (maxH - minH);
    const roof = Math.floor(rng() * 3) % 3;
    out.push({ x, w, h, roof });
  }
  return out;
}

// ── Parallax ─────────────────────────────────────────────────────────────────

/**
 * Per-layer parallax factor (docs §C table). 0 = screen-fixed (sky/vignette),
 * higher = scrolls more with the camera pan, 1 = rides the world exactly (sits
 * with the board). Far layers sit near 0 (barely move), near layers near 1.
 * Indices follow the back→front layer stack.
 */
export const PARALLAX = Object.freeze({
  sky: 0, // screen-fixed
  clouds: 0.08,
  skylineFar: 0.18,
  skylineMid: 0.34,
  water: 0.78,
  island: 1, // locked to the world (sits with the board)
  groundProps: 1,
  foreground: 1.18, // slight over-scroll for depth
  vignette: 0,
});

/**
 * The screen offset a parallax layer should sit at, given the camera world
 * translation (`camX`, `camY` — the world Container's position). A factor of 1
 * means the layer rides the world exactly (returns the cam translation). A
 * factor of 0 means screen-fixed (returns 0). Intermediate factors scroll
 * proportionally. Returned values are absolute screen positions for a
 * SCREEN-SPACE layer. Pure.
 */
export function parallaxOffset(camX: number, camY: number, factor: number): { x: number; y: number } {
  const f = Math.max(0, factor);
  return { x: camX * f, y: camY * f };
}

// ── Iso island sizing ────────────────────────────────────────────────────────

/**
 * Radius (in projected screen px, pre-zoom) of the iso ground island the board
 * sits on. The board's projected half-extent is `boardExtent`; the island is a
 * generous ring around it so the board reads as planted on land with margin for
 * scattered props (docs §C: radius ≈ boardExtent * 1.6). Pure. Guards a
 * zero/negative extent.
 */
export function islandRadius(boardExtent: number, factor = 1.6): number {
  const e = Math.max(1, boardExtent);
  return e * Math.max(1, factor);
}

// ── Ground-prop scatter ──────────────────────────────────────────────────────

/** One scattered prop placement (screen coords relative to board centre). */
export interface PropPlacement {
  x: number;
  y: number;
  kind: EnvProp;
  /** Scale 0.7..1.3 for size variety. */
  scale: number;
  /** Render depth (for back-to-front sort against the board). */
  depth: number;
}

/** Axis-aligned bounding box (the board's projected footprint to avoid). */
export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** True if (x,y) lies inside the AABB (inclusive). Pure. */
export function inAABB(x: number, y: number, box: AABB): boolean {
  return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
}

/**
 * Scatter `count` props deterministically in the ring between the board AABB and
 * the island edge (radius `islandR`), AVOIDING the board footprint (padded by
 * `boardPad`). Seeded → identical scatter for a (seed, theme) so the baked prop
 * layer is stable. Rejection-samples within an iteration cap (no infinite loop).
 * Returns placements sorted back→front by depth. Pure.
 */
export function scatterProps(
  seed: number,
  count: number,
  box: AABB,
  islandR: number,
  props: EnvProp[],
  boardPad = 24,
): PropPlacement[] {
  const n = Math.max(0, Math.floor(count));
  const rng = mulberry32(seed >>> 0);
  const out: PropPlacement[] = [];
  const padded: AABB = {
    minX: box.minX - boardPad,
    minY: box.minY - boardPad,
    maxX: box.maxX + boardPad,
    maxY: box.maxY + boardPad,
  };
  const kinds = props.length ? props : (['rock'] as EnvProp[]);
  const maxTries = n * 40 + 200; // guaranteed exit
  let tries = 0;
  while (out.length < n && tries < maxTries) {
    tries++;
    const ang = rng() * Math.PI * 2;
    // Sample radius biased outward (sqrt) so props spread across the ring, not
    // bunched at the centre. Keep inside the island, on its iso (2:1) footprint.
    const rr = Math.sqrt(rng()) * islandR * 0.96;
    const x = Math.cos(ang) * rr;
    const y = Math.sin(ang) * rr * 0.5; // 2:1 iso squash
    if (inAABB(x, y, padded)) continue; // never on the board
    out.push({
      x,
      y,
      kind: kinds[Math.floor(rng() * kinds.length) % kinds.length],
      scale: 0.7 + rng() * 0.6,
      depth: y, // lower on screen = nearer = drawn later
    });
  }
  out.sort((a, b) => a.depth - b.depth);
  return out;
}

// ── Particle caps (responsive) ───────────────────────────────────────────────

/**
 * Ambient particle count cap for a viewport. Mobile (narrow / portrait) gets
 * ~30, desktop (wide landscape) ~60. Pure — the pool is sized to this and never
 * grows per frame.
 */
export function particleCap(vw: number, vh: number): number {
  const w = Math.max(1, vw);
  const mobile = w < 700 || vh > vw; // narrow or portrait → mobile budget
  return mobile ? 30 : 60;
}

// ── Crossfade ────────────────────────────────────────────────────────────────

/**
 * Eased alpha for a board-change crossfade at `progress` 0..1. The OUTGOING
 * world fades 1→0; the INCOMING world fades 0→1 (use `1 - returned`). Smoothstep
 * so the swap reads as a soft dissolve, not a linear wipe. Pure.
 */
export function crossfadeAlpha(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  const eased = t * t * (3 - 2 * t); // smoothstep
  return 1 - eased; // outgoing alpha
}
