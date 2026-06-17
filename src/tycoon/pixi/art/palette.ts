/**
 * Dice Tycoon — V2 art PALETTE (pure colour math).
 *
 * No Pixi, no DOM, no WebGL — just colour derivation so the art looks far
 * richer than V1's flat faces (the #1 gap noted in dice-tycoon-views-art.md §B).
 * Extends the fidelity §A palette with per-plaza-band gradient stops
 * {light,mid,dark}, a gold core ramp, desaturated ground tones and an ink
 * outline. All of this is consumed by `lighting.ts` + `bake.ts` to build the
 * cached `FillGradient`s and baked `RenderTexture`s — but the numbers live here,
 * pure + unit-tested (no GPU needed).
 */

// ── Hero / chrome constants (mirror fidelity §A) ─────────────────────────────
export const GOLD = 0xf7b500;
export const GOLD_HI = 0xffe08a;
export const GOLD_SH = 0xb97e00;
export const GOLD_CORE = 0xe89a00; // deepest gold (radial centre start)
export const INK = 0x2e2230; // V2 ink (warmer/darker than V1's 0x3a2a36)
export const CREAM = 0xfff7ec;
export const WARM_BG = 0xfbe3cc;

/** Desaturated ground tones — chosen so the colourful tiles POP against them. */
export const GROUND = {
  grass: 0xa7c957,
  water: 0x5fc4d8,
  plaza: 0xe8dcc8,
} as const;

/** Rim-light + contact-shadow tints (warm, matching the top-left light). */
export const RIM_LIGHT = 0xffe08a; // applied @ ~35%
export const CONTACT_SHADOW = 0x2e2230; // applied @ ~16%, offset down-right
export const AO_SEAM = 0x2e2230; // applied @ ~18%, the lower-V dark band

// ── Pure colour ops ──────────────────────────────────────────────────────────

/** Clamp a channel to 0..255 and round. */
function clampByte(c: number): number {
  return Math.max(0, Math.min(255, Math.round(c)));
}

/** Split a 0xRRGGBB int into [r,g,b]. */
export function toRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

/** Recombine [r,g,b] into a 0xRRGGBB int (channels clamped). */
export function fromRgb(r: number, g: number, b: number): number {
  return (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b);
}

/** Darken toward black by `amt` (0..1). amt=0 → unchanged, amt=1 → black. */
export function darken(hex: number, amt: number): number {
  const k = Math.max(0, Math.min(1, amt));
  const [r, g, b] = toRgb(hex);
  return fromRgb(r * (1 - k), g * (1 - k), b * (1 - k));
}

/** Lighten toward white by `amt` (0..1). amt=0 → unchanged, amt=1 → white. */
export function lighten(hex: number, amt: number): number {
  const k = Math.max(0, Math.min(1, amt));
  const [r, g, b] = toRgb(hex);
  return fromRgb(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k);
}

/** Linear blend between two colours by `t` (0..1). t=0 → a, t=1 → b. */
export function mix(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return fromRgb(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
}

/** Convert a 0xRRGGBB int to a CSS `#rrggbb` string (for SVG authoring). */
export function toHexString(hex: number): string {
  return '#' + (hex & 0xffffff).toString(16).padStart(6, '0');
}

// ── Per-plaza-band gradient stops ────────────────────────────────────────────

/** A top-face vertical gradient ramp: light (top) → mid → dark (bottom). */
export interface BandStops {
  light: number;
  mid: number;
  dark: number;
}

/**
 * The six plaza band BASE colours (our own order/hexes — fidelity §A). These are
 * the mid tone; the light/dark stops are derived so every band shares ONE
 * consistent lighting recipe (top brighter, bottom shaded).
 */
export const PLAZA_BANDS = [
  0xe0566b, // A red
  0xf2913d, // B orange
  0xf4c233, // C yellow
  0x5bb872, // D green
  0x3fa9c9, // E cyan
  0x7e6bd6, // F violet
] as const;

/** Base top-face colours for non-property tile types (fidelity §A). */
export const TILE_BASE: Record<string, number> = {
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

/**
 * Derive the {light,mid,dark} top-face ramp from a base colour. The light stop
 * is a lifted tint (sun-struck top), the mid stop is the base, the dark stop is
 * a deepened shade (front of the top face catching less light). Pure +
 * deterministic. `intensity` (0..1) scales the spread.
 */
export function bandStops(base: number, intensity = 1): BandStops {
  const k = Math.max(0, Math.min(1, intensity));
  return {
    light: lighten(base, 0.28 * k),
    mid: base,
    dark: darken(base, 0.16 * k),
  };
}

/** The cached ramp for plaza band `index` (stable per tile index). Pure. */
export function bandStopsFor(index: number): BandStops {
  const n = PLAZA_BANDS.length;
  return bandStops(PLAZA_BANDS[((index % n) + n) % n]);
}

/** Per-property-group band BASE colour (stable per tile index). Pure. */
export function bandColor(index: number): number {
  const n = PLAZA_BANDS.length;
  return PLAZA_BANDS[((index % n) + n) % n];
}

/** The gold ramp stops for radial/linear gold gradients (GO!, dial, coins). */
export const GOLD_STOPS: BandStops = { light: GOLD_HI, mid: GOLD, dark: GOLD_CORE };
