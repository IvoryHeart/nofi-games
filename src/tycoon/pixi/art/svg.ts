/**
 * Dice Tycoon — V2 hero pieces as BUNDLED inline-SVG (original art, offline).
 *
 * The SVG STRINGS here are pure data (no Pixi, no files, no CDN) so they can be
 * unit-tested for well-formedness. They author ORIGINAL art — Penny the
 * piggy-bank tycoon mascot (round pink body, coin-slot, green bow tie, gold
 * monocle, belly highlight, contact shadow) and a tier-3 golden landmark
 * finial — NOT Mr. Monopoly. The Pixi-bound loader (`svgToGraphicsContext`,
 * `bakeSvg`) is exercised only on the live app; the strings are validated here.
 *
 * Penny gets smooth curves (radial body shading + monocle) that procedural
 * Graphics polys can't match — the SVG upgrade called for in §B.6.
 */

import { Graphics, GraphicsContext, Sprite, Texture, type Renderer } from 'pixi.js';
import { toHexString, GOLD, GOLD_HI, GOLD_SH, INK } from './palette';

const PINK = 0xf6a8c0;
const PINK_SH = 0xd97fa0;
const PINK_HI = 0xffd2e2;
const PINK_DEEP = 0xc46e92;
const GREEN = 0x3fa97a;
const GREEN_SH = 0x2c8460;

/**
 * Penny the piggy-bank tycoon, as an inline SVG string. Authored in a 100×120
 * viewBox, origin top-left; her standing baseline is ~y=108. Radial gradient
 * body shading, a coin-slot on top (her "hat" replacement), a green bow tie,
 * a gold monocle ring, a soft belly highlight and a contact shadow ellipse.
 * Smooth curves throughout — the point of going SVG over procedural polys.
 */
export const PENNY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120">
  <defs>
    <radialGradient id="pbody" cx="0.38" cy="0.34" r="0.75">
      <stop offset="0" stop-color="${toHexString(PINK_HI)}"/>
      <stop offset="0.55" stop-color="${toHexString(PINK)}"/>
      <stop offset="1" stop-color="${toHexString(PINK_DEEP)}"/>
    </radialGradient>
    <radialGradient id="pcheek" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${toHexString(PINK_SH)}"/>
      <stop offset="1" stop-color="${toHexString(PINK)}"/>
    </radialGradient>
  </defs>
  <ellipse cx="50" cy="112" rx="30" ry="7" fill="#2e2230" fill-opacity="0.18"/>
  <path d="M22 104 q-3 8 5 8 q5 0 5 -7 z" fill="${toHexString(PINK_DEEP)}"/>
  <path d="M78 104 q3 8 -5 8 q-5 0 -5 -7 z" fill="${toHexString(PINK_DEEP)}"/>
  <path d="M18 50 q-6 -12 4 -16 q8 -3 11 6 z" fill="${toHexString(PINK_SH)}"/>
  <path d="M82 50 q6 -12 -4 -16 q-8 -3 -11 6 z" fill="${toHexString(PINK_SH)}"/>
  <ellipse cx="50" cy="62" rx="38" ry="34" fill="url(#pbody)" stroke="${toHexString(PINK_DEEP)}" stroke-width="2"/>
  <ellipse cx="36" cy="48" rx="16" ry="11" fill="#ffffff" fill-opacity="0.32"/>
  <ellipse cx="50" cy="74" rx="15" ry="11" fill="url(#pcheek)"/>
  <circle cx="44" cy="74" r="2.4" fill="${toHexString(PINK_DEEP)}"/>
  <circle cx="56" cy="74" r="2.4" fill="${toHexString(PINK_DEEP)}"/>
  <rect x="36" y="22" width="28" height="7" rx="3" fill="${toHexString(INK)}"/>
  <rect x="40" y="24" width="20" height="2.5" rx="1.2" fill="${toHexString(GOLD_SH)}"/>
  <circle cx="40" cy="58" r="3" fill="${toHexString(INK)}"/>
  <circle cx="62" cy="58" r="3" fill="${toHexString(INK)}"/>
  <circle cx="62" cy="58" r="8" fill="none" stroke="${toHexString(GOLD)}" stroke-width="2.6"/>
  <path d="M70 64 l9 7" stroke="${toHexString(GOLD_SH)}" stroke-width="2" stroke-linecap="round"/>
  <path d="M38 92 l10 -5 0 7 z" fill="${toHexString(GREEN)}"/>
  <path d="M62 92 l-10 -5 0 7 z" fill="${toHexString(GREEN)}"/>
  <circle cx="50" cy="90" r="3.2" fill="${toHexString(GREEN_SH)}"/>
  <ellipse cx="30" cy="98" rx="6" ry="5" fill="${toHexString(PINK_DEEP)}"/>
  <ellipse cx="70" cy="98" rx="6" ry="5" fill="${toHexString(PINK_DEEP)}"/>
</svg>`;

/**
 * A tier-3 golden landmark finial (the crowning spire piece). 60×80 viewBox,
 * a tapered gold obelisk with a star/diamond cap + gloss. Used atop the top
 * landmark tower. Original, generic — no IP.
 */
export const FINIAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">
  <defs>
    <linearGradient id="fg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${toHexString(GOLD_HI)}"/>
      <stop offset="0.5" stop-color="${toHexString(GOLD)}"/>
      <stop offset="1" stop-color="${toHexString(GOLD_SH)}"/>
    </linearGradient>
  </defs>
  <path d="M30 4 L42 40 L30 52 L18 40 Z" fill="url(#fg)" stroke="${toHexString(GOLD_SH)}" stroke-width="1.5"/>
  <path d="M22 40 L38 40 L34 74 L26 74 Z" fill="url(#fg)" stroke="${toHexString(GOLD_SH)}" stroke-width="1.5"/>
  <path d="M30 8 L33 38 L30 48 Z" fill="#ffffff" fill-opacity="0.4"/>
  <circle cx="30" cy="6" r="4" fill="${toHexString(GOLD_HI)}"/>
</svg>`;

/**
 * VERY light structural validity check for an inline-SVG string. Pure — used by
 * the loader as a guard and by unit tests. Confirms the root tag, viewBox, an
 * xmlns, and balanced `<svg>` open/close. Not a full XML parser (jsdom's
 * DOMParser handles the real parse in tests). Returns true when plausibly OK.
 */
export function isWellFormedSvg(svg: string): boolean {
  if (typeof svg !== 'string' || svg.length < 16) return false;
  const s = svg.trim();
  if (!s.startsWith('<svg')) return false;
  if (!s.endsWith('</svg>')) return false;
  if (!/\sviewBox\s*=\s*"/.test(s)) return false;
  if (!/xmlns\s*=\s*"http:\/\/www\.w3\.org\/2000\/svg"/.test(s)) return false;
  // No unescaped stray ampersands (would break XML parse).
  if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(s)) return false;
  return true;
}

// ── Pixi-bound loaders (live app only) ───────────────────────────────────────

/**
 * Turn an inline-SVG string into a Pixi v8 `GraphicsContext`. The context is a
 * GPU resource — callers MUST `.destroy()` it on teardown. Synchronous in v8
 * (svg() parses immediately). Live-app only (no WebGL in tests).
 */
export function svgToGraphicsContext(svg: string): GraphicsContext {
  return new GraphicsContext().svg(svg);
}

/**
 * Bake an inline-SVG into a `RenderTexture` at `scale` DPR (2× for crisp retina
 * /zoom) via the live renderer. Returns the texture + the source context so the
 * caller can destroy BOTH on teardown. Live-app only.
 */
export function bakeSvg(
  renderer: Renderer,
  svg: string,
  scale = 2,
): { texture: Texture; context: GraphicsContext } {
  const context = svgToGraphicsContext(svg);
  // Graphics built from the context; generateTexture rasterises it at `scale`.
  const g = new Graphics(context);
  const texture = renderer.generateTexture({ target: g, resolution: scale });
  g.destroy();
  return { texture, context };
}

/** Make a Sprite from a baked texture, centred + scaled to a target height. */
export function spriteFromTexture(texture: Texture, targetHeight: number): Sprite {
  const sp = new Sprite(texture);
  sp.anchor.set(0.5, 1); // anchor at the baseline (feet)
  const h = texture.height || 1;
  const s = targetHeight / h;
  sp.scale.set(s);
  return sp;
}

