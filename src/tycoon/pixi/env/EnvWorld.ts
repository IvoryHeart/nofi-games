/**
 * Dice Tycoon — V3 ENVIRONMENT builder (Pixi v8, WebGL-bound, live-app only).
 *
 * Builds the procedural iso-world that frames the board (docs §C), a back→front
 * stack of layers in two containers:
 *   • SCREEN-space chrome layers (sky gradient, drifting clouds, far/mid skyline,
 *     foreground bushes, vignette) — parallax-scrolled from the camera pan.
 *   • WORLD-space ground layers (water ring, iso island, scattered props) — these
 *     ride the camera/zoom transform so they sit registered with the board.
 *
 * EVERY static layer is baked ONCE to a RenderTexture (~6–10 draw calls total).
 * Ambient particles share ONE texture and are pooled (Pixi batches them), capped
 * per breakpoint. The ambient ticker pauses when the tab is hidden. On a board
 * change the whole world re-bakes once and crossfades old→new.
 *
 * All maths (theme selection, skyline gen, parallax, scatter, caps) lives in the
 * pure, unit-tested `./envMath`. This file is the GPU plumbing only and is
 * exercised on the live app (no WebGL in jsdom). It owns every RenderTexture /
 * gradient / Graphics it creates and destroys them on `destroy()`.
 */

import {
  Container,
  FillGradient,
  Graphics,
  Sprite,
  Texture,
  BlurFilter,
  type Renderer,
} from 'pixi.js';
import { lighten, darken, toRgb } from '../art/palette';
import {
  EnvTheme,
  PropPlacement,
  AABB,
  PARALLAX,
  parallaxOffset,
  islandRadius,
  scatterProps,
  generateSkyline,
  particleCap,
  crossfadeAlpha,
} from './envMath';

/** A pooled ambient particle (cloud blob / sparkle / ember / dust mote). */
interface Particle {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Base alpha + a pulse phase (sparkles/embers twinkle). */
  baseAlpha: number;
  phase: number;
  pulse: number;
}

const CROSSFADE_S = 0.6;

/**
 * One self-contained environment "world" for a single EnvTheme. The board-change
 * crossfade keeps two of these alive briefly (old fading out, new fading in).
 * Owns its baked textures + gradients; `destroy()` frees them.
 */
class EnvLayerSet {
  /** Screen-fixed/parallax chrome (sky, clouds, skyline, fg, vignette). */
  readonly screenRoot = new Container();
  /** World-space ground (water, island, props) — added INSIDE the world. */
  readonly worldRoot = new Container();

  private renderer: Renderer;
  private theme: EnvTheme;
  private vw: number;
  private vh: number;
  private islandR: number;

  // Parallax layer handles (screen-space).
  private skyLayer = new Container();
  private cloudLayer = new Container();
  private skylineFarLayer = new Container();
  private skylineMidLayer = new Container();
  private foregroundLayer = new Container();
  private vignetteLayer = new Container();

  // Particle pool (clouds/sparkles/embers/dust) — shares one texture.
  private particles: Particle[] = [];
  private particleTex: Texture | null = null;

  // Owned GPU resources for teardown.
  private textures: Texture[] = [];
  private gradients: FillGradient[] = [];
  private graphics: Graphics[] = [];

  private driftT = 0;

  constructor(
    renderer: Renderer,
    theme: EnvTheme,
    vw: number,
    vh: number,
    boardExtent: number,
    seed: number,
    cap: number,
  ) {
    this.renderer = renderer;
    this.theme = theme;
    this.vw = Math.max(1, vw);
    this.vh = Math.max(1, vh);
    this.islandR = islandRadius(boardExtent);

    // World-space ground layers (ride the camera). Built first so the board
    // (added by the host between worldRoot and the rest) sorts above them.
    this.buildWater();
    this.buildIsland();
    this.buildProps(seed);
    this.worldRoot.addChild(...this.worldGround);

    // Screen-space parallax chrome.
    this.buildSky();
    this.buildSkyline(seed);
    this.buildForeground();
    this.buildVignette();
    this.buildParticles(cap);
    this.screenRoot.addChild(
      this.skyLayer,
      this.cloudLayer,
      this.skylineFarLayer,
      this.skylineMidLayer,
      this.foregroundLayer,
      this.vignetteLayer,
    );
    this.layoutScreenLayers();
  }

  // Accumulated world-ground children (built before worldRoot assembly).
  private worldGround: Container[] = [];

  // ── Bake helpers ───────────────────────────────────────────────────────────

  /** Bake a node to a RenderTexture (auto-fits content bounds). Owned for
   *  teardown. Callers anchor the resulting Sprite (0.5) to centre it. */
  private bake(node: Container): Texture {
    const tex = this.renderer.generateTexture({ target: node, resolution: 1, antialias: true });
    this.textures.push(tex);
    return tex;
  }

  private vGrad(x0: number, y0: number, x1: number, y1: number, top: number, bottom: number): FillGradient {
    const g = new FillGradient(x0, y0, x1, y1);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    this.gradients.push(g);
    return g;
  }

  private track<T extends Graphics>(g: T): T {
    this.graphics.push(g);
    return g;
  }

  // ── Layer 0: sky gradient ────────────────────────────────────────────────

  private buildSky(): void {
    this.drawSky();
  }

  private drawSky(): void {
    this.skyLayer.removeChildren();
    const g = this.track(new Graphics());
    const grad = this.vGrad(0, 0, 0, this.vh, this.theme.sky[0], this.theme.sky[1]);
    g.rect(0, 0, this.vw, this.vh).fill(grad);
    // Sun/moon glow disc, upper area.
    g.circle(this.vw * 0.72, this.vh * 0.2, Math.min(this.vw, this.vh) * 0.22).fill({
      color: this.theme.glow,
      alpha: 0.5,
    });
    g.circle(this.vw * 0.72, this.vh * 0.2, Math.min(this.vw, this.vh) * 0.12).fill({
      color: this.theme.glow,
      alpha: 0.55,
    });
    this.skyLayer.addChild(g);
  }

  // ── Layers 2–3: far + mid skyline (baked silhouette bands) ────────────────

  private buildSkyline(seed: number): void {
    this.drawSkylineBand(this.skylineFarLayer, seed ^ 0x1111, this.theme.skylineDensity, this.theme.skylineFar, 0.62, true);
    this.drawSkylineBand(this.skylineMidLayer, seed ^ 0x2222, Math.round(this.theme.skylineDensity * 0.7), this.theme.skylineMid, 1, false);
  }

  private drawSkylineBand(layer: Container, seed: number, density: number, tint: number, maxH: number, far: boolean): void {
    layer.removeChildren();
    const bandW = Math.max(this.vw * 1.6, 640); // wider than the viewport (parallax)
    const bandH = Math.min(this.vh * (far ? 0.3 : 0.4), 360);
    const buildings = generateSkyline(seed, density, { minH: far ? 0.4 : 0.5, maxH });
    const g = this.track(new Graphics());
    for (const b of buildings) {
      const bw = b.w * bandW;
      const bx = b.x * bandW;
      const bh = b.h * bandH;
      const by = bandH - bh;
      g.rect(bx, by, bw, bh).fill({ color: tint, alpha: far ? 0.85 : 0.95 });
      // Roof variety on the silhouette top.
      if (b.roof === 1) g.rect(bx + bw * 0.3, by - bandH * 0.06, bw * 0.4, bandH * 0.06).fill({ color: tint, alpha: far ? 0.85 : 0.95 });
      else if (b.roof === 2) g.poly([bx + bw * 0.5, by - bandH * 0.1, bx + bw * 0.35, by, bx + bw * 0.65, by]).fill({ color: tint, alpha: far ? 0.85 : 0.95 });
    }
    // Bake the band as-is (content sits at (0,0)..(bandW,bandH)); place by anchor.
    const baked = this.renderer.generateTexture({ target: g, antialias: true });
    this.textures.push(baked);
    const sp = new Sprite(baked);
    sp.anchor.set(0.5, 1);
    layer.addChild(sp);
    (layer as Container & { _bandH?: number })._bandH = bandH;
  }

  // ── Layer 4: water ring (coastal, world-space) ────────────────────────────

  private buildWater(): void {
    if (!this.theme.water) return;
    const r = this.islandR * 1.5;
    const g = this.track(new Graphics());
    // Big iso water diamond (2:1), gradient outer→inner.
    const grad = this.vGrad(0, -r * 0.5, 0, r * 0.5, this.theme.waterColors[0], this.theme.waterColors[1]);
    g.poly([0, -r * 0.5, r, 0, 0, r * 0.5, -r, 0]).fill(grad);
    const tex = this.bake(g);
    const sp = new Sprite(tex);
    sp.anchor.set(0.5, 0.5);
    const wrap = new Container();
    wrap.addChild(sp);
    this.worldGround.push(wrap);
  }

  // ── Layer 5: iso ground island ────────────────────────────────────────────

  private buildIsland(): void {
    const r = this.islandR;
    const depth = Math.max(24, r * 0.12);
    const g = this.track(new Graphics());
    // Soft drop shadow beneath the island.
    g.ellipse(r * 0.06, r * 0.5 + depth + 10, r * 0.98, r * 0.34).fill({ color: 0x2e2230, alpha: 0.18 });
    // Beveled side (front faces of the iso diamond extrusion).
    g.poly([-r, 0, 0, r * 0.5, 0, r * 0.5 + depth, -r, depth]).fill(darken(this.theme.groundSide, 0.05));
    g.poly([0, r * 0.5, r, 0, r, depth, 0, r * 0.5 + depth]).fill(darken(this.theme.groundSide, 0.18));
    // AO seam at the lower V.
    g.moveTo(0, r * 0.5).lineTo(0, r * 0.5 + depth).stroke({ color: 0x2e2230, width: 3, alpha: 0.2 });
    // Top face — 2:1 iso diamond, gradient back→front.
    const grad = this.vGrad(0, -r * 0.5, 0, r * 0.5, this.theme.groundTop[0], this.theme.groundTop[1]);
    g.poly([0, -r * 0.5, r, 0, 0, r * 0.5, -r, 0]).fill(grad);
    // Subtle rim light on the back-left edges + a soft edge darkening (shoreline).
    g.moveTo(0, -r * 0.5).lineTo(-r, 0).stroke({ color: lighten(this.theme.groundTop[0], 0.3), width: 3, alpha: 0.4 });
    g.poly([0, -r * 0.5, r, 0, 0, r * 0.5, -r, 0]).stroke({ color: darken(this.theme.groundSide, 0.1), width: 4, alpha: 0.25 });
    const tex = this.bake(g);
    const sp = new Sprite(tex);
    sp.anchor.set(0.5, 0.5);
    const wrap = new Container();
    wrap.addChild(sp);
    this.worldGround.push(wrap);
  }

  // ── Layer 6: ground props (world-space, seeded scatter) ───────────────────

  private buildProps(seed: number): void {
    const box: AABB = this.boardBox(seed);
    const placements = scatterProps(seed ^ 0x7777, this.propCount(), box, this.islandR, this.theme.props);
    // Bake one texture per distinct prop kind, reuse as Sprites.
    const texByKind = new Map<string, Texture>();
    const layer = new Container();
    for (const p of placements) {
      let tex = texByKind.get(p.kind);
      if (!tex) {
        tex = this.bakeProp(p);
        texByKind.set(p.kind, tex);
      }
      const sp = new Sprite(tex);
      sp.anchor.set(0.5, 1); // base of the prop on the ground point
      sp.x = p.x;
      sp.y = p.y;
      sp.scale.set(p.scale);
      sp.zIndex = p.depth;
      layer.addChild(sp);
    }
    layer.sortChildren();
    this.worldGround.push(layer);
  }

  private propCount(): number {
    // Scale prop count with island size (bigger viewport → a few more), capped.
    return Math.min(26, Math.max(10, Math.round(this.islandR / 26)));
  }

  /** The board's projected footprint AABB (props avoid it). Re-derived from the
   *  island radius: the board occupies the inner ~62% of the island. */
  private boardBox(_seed: number): AABB {
    const half = this.islandR * 0.62;
    return { minX: -half, minY: -half * 0.5, maxX: half, maxY: half * 0.5 };
  }

  /** Bake one procedural prop (tree/bush/rock/lamp/palm/cactus/pylon). */
  private bakeProp(p: PropPlacement): Texture {
    const g = this.track(new Graphics());
    const s = 22;
    // Contact shadow.
    g.ellipse(0, 0, s * 0.7, s * 0.28).fill({ color: 0x2e2230, alpha: 0.16 });
    switch (p.kind) {
      case 'tree': {
        g.rect(-s * 0.12, -s * 0.7, s * 0.24, s * 0.7).fill(0x7a5234);
        g.circle(0, -s * 1.0, s * 0.62).fill(0x4f7a36);
        g.circle(-s * 0.3, -s * 0.85, s * 0.4).fill(0x5e8c40);
        g.circle(s * 0.28, -s * 1.15, s * 0.36).fill(0x6a9c48);
        break;
      }
      case 'bush': {
        g.circle(-s * 0.3, -s * 0.3, s * 0.4).fill(0x4f7a36);
        g.circle(s * 0.3, -s * 0.3, s * 0.42).fill(0x5e8c40);
        g.circle(0, -s * 0.5, s * 0.45).fill(0x6a9c48);
        break;
      }
      case 'rock': {
        g.poly([-s * 0.5, 0, -s * 0.3, -s * 0.5, s * 0.2, -s * 0.55, s * 0.5, 0]).fill(0x9a9088);
        g.poly([-s * 0.3, -s * 0.5, s * 0.2, -s * 0.55, 0, -s * 0.2]).fill(0xb5aca2);
        break;
      }
      case 'lamp': {
        g.rect(-s * 0.07, -s * 1.3, s * 0.14, s * 1.3).fill(0x4a4048);
        g.circle(0, -s * 1.35, s * 0.22).fill({ color: 0xffe08a, alpha: 0.95 }).stroke({ color: 0x4a4048, width: 2 });
        break;
      }
      case 'palm': {
        g.rect(-s * 0.1, -s * 1.1, s * 0.2, s * 1.1).fill(0x8a6a44);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.5;
          g.poly([0, -s * 1.1, Math.cos(a) * s * 0.9, -s * 1.1 + Math.sin(a) * s * 0.7, Math.cos(a + 0.2) * s * 0.6, -s * 1.05])
            .fill(0x4f8a4a);
        }
        break;
      }
      case 'cactus': {
        g.roundRect(-s * 0.16, -s * 1.1, s * 0.32, s * 1.1, s * 0.16).fill(0x5a8a4a);
        g.roundRect(-s * 0.5, -s * 0.8, s * 0.18, s * 0.5, s * 0.09).fill(0x5a8a4a);
        g.roundRect(s * 0.32, -s * 0.95, s * 0.18, s * 0.55, s * 0.09).fill(0x4f7a40);
        break;
      }
      case 'pylon': {
        g.poly([-s * 0.4, 0, -s * 0.12, -s * 1.4, s * 0.12, -s * 1.4, s * 0.4, 0]).fill(0x4a4060);
        g.circle(0, -s * 1.4, s * 0.16).fill({ color: 0xff9ad6, alpha: 0.9 });
        g.rect(-s * 0.45, -s * 0.9, s * 0.9, s * 0.1).fill(0x6a5a86);
        break;
      }
    }
    const tex = this.bake(g);
    return tex;
  }

  // ── Layer 8: foreground bushes (blurred, screen corners) ──────────────────

  private buildForeground(): void {
    this.drawForeground();
  }

  private drawForeground(): void {
    this.foregroundLayer.removeChildren();
    const leaf = this.theme.id === 'desert' ? 0xc2a880 : this.theme.id === 'neon' ? 0x4a3a63 : 0x4f7a36;
    const mk = (flip: number): Container => {
      const g = this.track(new Graphics());
      const s = Math.max(110, this.vw * 0.16);
      g.circle(0, 0, s * 0.7).fill(leaf);
      g.circle(-s * 0.5, s * 0.2, s * 0.55).fill(lighten(leaf, 0.08));
      g.circle(s * 0.4, s * 0.3, s * 0.5).fill(darken(leaf, 0.1));
      g.filters = [new BlurFilter({ strength: 6, quality: 2 })];
      const c = new Container();
      c.addChild(g);
      c.x = flip < 0 ? -20 : this.vw + 20;
      c.y = this.vh + 20;
      c.scale.x = flip;
      return c;
    };
    this.foregroundLayer.addChild(mk(-1), mk(1));
  }

  // ── Layer 9: vignette + warm grade ────────────────────────────────────────

  private buildVignette(): void {
    this.drawVignette();
  }

  private drawVignette(): void {
    this.vignetteLayer.removeChildren();
    const g = this.track(new Graphics());
    // Per-stop alpha isn't part of the FillGradient colorStops type (matches
    // bake.ts's gold radial, which has none) — encode alpha into the colour via
    // an rgba() CSS string so the centre is transparent and the corners tint.
    const [vr, vg, vb] = toRgb(this.theme.vignette);
    const rgba = (a: number): string => `rgba(${vr},${vg},${vb},${a})`;
    const grad = new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.72,
      colorStops: [
        { offset: 0, color: rgba(0) },
        { offset: 0.7, color: rgba(0) },
        { offset: 1, color: rgba(0.55) },
      ],
      textureSpace: 'local',
    });
    this.gradients.push(grad);
    g.rect(0, 0, this.vw, this.vh).fill(grad);
    g.blendMode = 'multiply';
    this.vignetteLayer.addChild(g);
  }

  // ── Layer 1: ambient particles (pooled, one shared texture) ───────────────

  private buildParticles(cap: number): void {
    this.particleTex = this.makeParticleTexture();
    const rng = this.particleRng();
    for (let i = 0; i < cap; i++) {
      const sp = new Sprite(this.particleTex);
      sp.anchor.set(0.5);
      const x = rng() * this.vw;
      const y = this.particleStartY(rng);
      sp.x = x;
      sp.y = y;
      const scale = this.particleScale(rng);
      sp.scale.set(scale);
      const baseAlpha = this.particleAlpha(rng);
      sp.alpha = baseAlpha;
      sp.tint = this.particleTint();
      this.cloudLayer.addChild(sp);
      this.particles.push({
        sprite: sp,
        x,
        y,
        vx: this.particleVx(rng),
        vy: this.particleVy(rng),
        baseAlpha,
        phase: rng() * Math.PI * 2,
        pulse: this.theme.particle === 'sparkles' || this.theme.particle === 'embers' ? 1 : 0,
      });
    }
  }

  private particleRng(): () => number {
    // Local deterministic-enough drift seed (visual only; not save-relevant).
    let s = (this.theme.skylineSeed ^ 0x55aa) >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private makeParticleTexture(): Texture {
    const g = this.track(new Graphics());
    if (this.theme.particle === 'clouds') {
      // Soft cloud blob.
      g.circle(0, 0, 26).fill({ color: 0xffffff, alpha: 0.85 });
      g.circle(-22, 6, 18).fill({ color: 0xffffff, alpha: 0.8 });
      g.circle(22, 6, 20).fill({ color: 0xffffff, alpha: 0.8 });
      g.circle(0, 10, 22).fill({ color: 0xffffff, alpha: 0.8 });
    } else {
      // Small soft round dot for sparkle/ember/dust.
      g.circle(0, 0, 6).fill({ color: 0xffffff, alpha: 0.9 });
      g.circle(0, 0, 3).fill({ color: 0xffffff, alpha: 1 });
    }
    const tex = this.renderer.generateTexture({ target: g, antialias: true });
    this.textures.push(tex);
    return tex;
  }

  private particleTint(): number {
    switch (this.theme.particle) {
      case 'clouds': return 0xffffff;
      case 'sparkles': return 0xfff7d8;
      case 'embers': return this.theme.glow;
      case 'dust': return 0xe8d8b8;
    }
  }
  private particleStartY(rng: () => number): number {
    if (this.theme.particle === 'clouds') return rng() * this.vh * 0.45;
    if (this.theme.particle === 'embers') return rng() * this.vh;
    return rng() * this.vh * 0.7;
  }
  private particleScale(rng: () => number): number {
    if (this.theme.particle === 'clouds') return 0.6 + rng() * 1.1;
    return 0.6 + rng() * 0.9;
  }
  private particleAlpha(rng: () => number): number {
    if (this.theme.particle === 'clouds') return 0.5 + rng() * 0.35;
    return 0.35 + rng() * 0.4;
  }
  private particleVx(rng: () => number): number {
    if (this.theme.particle === 'dust') return 10 + rng() * 18;
    if (this.theme.particle === 'embers') return (rng() - 0.5) * 8;
    return 4 + rng() * 10; // clouds / sparkles drift slowly right
  }
  private particleVy(rng: () => number): number {
    if (this.theme.particle === 'embers') return -(8 + rng() * 14); // rise
    if (this.theme.particle === 'dust') return (rng() - 0.5) * 4;
    return (rng() - 0.5) * 2;
  }

  // ── Per-frame drift + pulse (ambient) ─────────────────────────────────────

  drift(dt: number): void {
    this.driftT += dt;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Wrap around the viewport so the field is endless.
      if (p.x > this.vw + 40) p.x = -40;
      if (p.x < -40) p.x = this.vw + 40;
      if (p.y < -40) p.y = this.vh + 40;
      if (p.y > this.vh + 40) p.y = -40;
      p.sprite.x = p.x;
      p.sprite.y = p.y;
      if (p.pulse) {
        p.phase += dt * 2.4;
        p.sprite.alpha = p.baseAlpha * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(p.phase)));
      }
    }
    // Auto-drift the skyline/cloud layers a touch so the world feels alive even
    // when the camera is still (docs §C: slow auto-drift on layers 1–3).
    const driftX = Math.sin(this.driftT * 0.05) * 8;
    this.skylineFarLayer.x = this.skylineFarBaseX + driftX * 0.4;
    this.skylineMidLayer.x = this.skylineMidBaseX + driftX * 0.7;
  }

  // ── Parallax + resize ─────────────────────────────────────────────────────

  private skylineFarBaseX = 0;
  private skylineMidBaseX = 0;

  /** Position the screen-space layers for the current viewport (centred). */
  private layoutScreenLayers(): void {
    const farBand = (this.skylineFarLayer as Container & { _bandH?: number })._bandH ?? this.vh * 0.3;
    const midBand = (this.skylineMidLayer as Container & { _bandH?: number })._bandH ?? this.vh * 0.4;
    // Skyline sits along the horizon (~45% down on desktop, higher on mobile).
    const horizon = this.vh * 0.5;
    this.skylineFarBaseX = this.vw / 2;
    this.skylineMidBaseX = this.vw / 2;
    this.skylineFarLayer.y = horizon - farBand * 0.05;
    this.skylineMidLayer.y = horizon + midBand * 0.08;
    this.skylineFarLayer.x = this.skylineFarBaseX;
    this.skylineMidLayer.x = this.skylineMidBaseX;
  }

  /** Apply camera-pan parallax to the screen-space layers. `camX/camY` are the
   *  world Container's translation (its on-screen position). */
  applyParallax(camX: number, camY: number): void {
    const cloud = parallaxOffset(camX, camY, PARALLAX.clouds);
    this.cloudLayer.x = cloud.x;
    this.cloudLayer.y = cloud.y * 0.5;
    const far = parallaxOffset(camX, camY, PARALLAX.skylineFar);
    this.skylineFarLayer.x = this.skylineFarBaseX + far.x;
    const mid = parallaxOffset(camX, camY, PARALLAX.skylineMid);
    this.skylineMidLayer.x = this.skylineMidBaseX + mid.x;
    const fg = parallaxOffset(camX, camY, PARALLAX.foreground);
    this.foregroundLayer.x = (fg.x - camX) * 0.15; // subtle counter-drift
  }

  resize(vw: number, vh: number): void {
    this.vw = Math.max(1, vw);
    this.vh = Math.max(1, vh);
    this.drawSky();
    this.drawForeground();
    this.drawVignette();
    this.layoutScreenLayers();
    // Re-wrap any out-of-bounds particles into the new viewport.
    for (const p of this.particles) {
      if (p.x > this.vw + 40) p.x = this.vw - 1;
      if (p.y > this.vh + 40) p.y = this.vh - 1;
    }
  }

  setAlpha(a: number): void {
    this.screenRoot.alpha = a;
    this.worldRoot.alpha = a;
  }

  destroy(): void {
    this.screenRoot.removeFromParent();
    this.worldRoot.removeFromParent();
    for (const t of this.textures) { try { t.destroy(true); } catch { /* gone */ } }
    this.textures = [];
    if (this.particleTex) { try { this.particleTex.destroy(true); } catch { /* gone */ } this.particleTex = null; }
    for (const g of this.graphics) { try { g.destroy(); } catch { /* gone */ } }
    this.graphics = [];
    for (const g of this.gradients) {
      try { (g as unknown as { destroy?: () => void }).destroy?.(); } catch { /* gone */ }
    }
    this.gradients = [];
    try { this.screenRoot.destroy({ children: true }); } catch { /* gone */ }
    try { this.worldRoot.destroy({ children: true }); } catch { /* gone */ }
  }
}

/**
 * The environment façade the Pixi view owns. Holds the active EnvLayerSet (plus
 * a fading-out one during a crossfade), exposes screen + world roots for the
 * host to slot into the scene graph, and forwards drift/parallax/resize. Pauses
 * its own ambient drift when the tab is hidden.
 */
export class EnvWorld {
  /** Screen-space root (sky/clouds/skyline/fg/vignette) — added to the stage
   *  BEHIND the board's screen-space chrome but in front of nothing. */
  readonly screenRoot = new Container();
  /** World-space root (water/island/props) — added INSIDE the camera world,
   *  BEHIND the board layer. */
  readonly worldRoot = new Container();

  private renderer: Renderer;
  private vw: number;
  private vh: number;
  private boardExtent: number;

  private current: EnvLayerSet | null = null;
  private fading: EnvLayerSet | null = null;
  private fadeT = 0;

  private hidden = false;
  private onVisibility = (): void => {
    this.hidden = typeof document !== 'undefined' && document.hidden;
  };

  constructor(renderer: Renderer, vw: number, vh: number, boardExtent: number) {
    this.renderer = renderer;
    this.vw = Math.max(1, vw);
    this.vh = Math.max(1, vh);
    this.boardExtent = Math.max(1, boardExtent);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
    }
  }

  /** Build (or rebuild + crossfade to) the world for a theme. The first call
   *  shows instantly; later calls crossfade old→new. `seed` keeps the silhouette
   *  /scatter stable across resumes. */
  setTheme(theme: EnvTheme, seed: number): void {
    const cap = particleCap(this.vw, this.vh);
    const next = new EnvLayerSet(this.renderer, theme, this.vw, this.vh, this.boardExtent, seed, cap);
    if (!this.current) {
      this.current = next;
      this.screenRoot.addChild(next.screenRoot);
      this.worldRoot.addChild(next.worldRoot);
      return;
    }
    // Crossfade: keep the old one fading out, fade the new one in.
    if (this.fading) this.fading.destroy(); // a faster swap drops the older fade
    this.fading = this.current;
    this.current = next;
    next.setAlpha(0);
    this.screenRoot.addChild(next.screenRoot);
    this.worldRoot.addChild(next.worldRoot);
    this.fadeT = 0;
  }

  /** Per-frame ambient + crossfade step. Skips drift while the tab is hidden. */
  update(dt: number): void {
    if (!this.hidden) this.current?.drift(dt);
    if (this.fading) {
      this.fadeT += dt;
      const p = Math.min(1, this.fadeT / CROSSFADE_S);
      const outAlpha = crossfadeAlpha(p);
      this.fading.setAlpha(outAlpha);
      this.current?.setAlpha(1 - outAlpha);
      if (p >= 1) {
        this.fading.destroy();
        this.fading = null;
        this.current?.setAlpha(1);
      }
    }
  }

  /** Drive parallax from the live camera world translation. */
  applyParallax(camX: number, camY: number): void {
    this.current?.applyParallax(camX, camY);
    this.fading?.applyParallax(camX, camY);
  }

  resize(vw: number, vh: number): void {
    this.vw = Math.max(1, vw);
    this.vh = Math.max(1, vh);
    this.current?.resize(this.vw, this.vh);
    this.fading?.resize(this.vw, this.vh);
  }

  /** Update the board extent (board-complete may grow it) for the next re-bake. */
  setBoardExtent(extent: number): void {
    this.boardExtent = Math.max(1, extent);
  }

  destroy(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    this.current?.destroy();
    this.fading?.destroy();
    this.current = null;
    this.fading = null;
    try { this.screenRoot.destroy({ children: true }); } catch { /* gone */ }
    try { this.worldRoot.destroy({ children: true }); } catch { /* gone */ }
  }
}
