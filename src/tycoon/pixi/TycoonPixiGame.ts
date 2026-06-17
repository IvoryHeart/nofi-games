/**
 * Dice Tycoon — Pixi.js v8 WebGL view (Tycoon app only).
 *
 * A slick 2.5D board renderer driven by the SHARED renderer-agnostic
 * `TycoonCore` (PX1). This class does NOT extend the canvas GameEngine — it
 * mounts its own Pixi Application into a host element and exposes a lifecycle
 * compatible with the tycoon shell (start/destroy/serialize/deserialize/getScore
 * + onScore/onWin/onGameOver/onUpdate callbacks) so the shell's HUD score pill,
 * win/gameover overlays and save/resume all work.
 *
 * Procedural ONLY — no image assets. Everything is Graphics/Container/Text +
 * filters. Offline/PWA preserved (this whole module is a lazy tycoon-only chunk;
 * the nofi `main` bundle never imports it).
 *
 * Pure geometry (camera math, dimetric projection, ring layout, spring/hop
 * easing) lives in ./layout.ts and is unit-tested in jsdom — Pixi/WebGL cannot
 * render there, so this file is loaded ONLY via dynamic import on the live app.
 */

import {
  Application,
  Container,
  Graphics,
  Text,
  Ticker,
  BlurFilter,
} from 'pixi.js';

import { dailySeed } from '../../utils/rng';
import { mulberry32 } from '../../utils/rng';
import { TycoonCore } from '../../games/dice-tycoon/core/TycoonCore';
import { BOARD_SIZE, Tile } from '../../games/dice-tycoon/board';
import { MULTIPLIERS } from '../../games/dice-tycoon/economy';
import type { GameSnapshot } from '../../engine/GameEngine';
import {
  Spring,
  ringLayout,
  worldToScreen,
  depthKey,
  cameraTarget,
  fitZoom,
  followZoom,
  hopArc,
  hopSquash,
  lerp,
  TILE_CELL,
  ISO_SQUASH,
  WorldPoint,
} from './layout';

// ── Fidelity palette (mirrors docs/plans/dice-tycoon-fidelity.md §A) ──────────
const WARM_BG = 0xfbe3cc;
const GOLD = 0xf7b500;
const GOLD_HI = 0xffe08a;
const GOLD_SH = 0xb97e00;
const INK = 0x3a2a36;
const CREAM = 0xfff7ec;

const PLAZA_BANDS = [0xe0566b, 0xf2913d, 0xf4c233, 0x5bb872, 0x3fa9c9, 0x7e6bd6];
const TILE_TOP: Record<string, number> = {
  go: CREAM,
  property: 0xf4c233,
  tax: 0x9a3b4e,
  chance: 0xf49b2a,
  treasure: 0x5e3c58,
  railroad: 0x3a2a36,
  jail: CREAM,
  parking: CREAM,
  gotojail: CREAM,
};

const REGEN_CHECK_S = 1; // throttle core.tick() to ~1/s
const HOP_DURATION = 0.16; // seconds per single-tile hop
const PENNY_PINK = 0xf6a8c0;
const PENNY_PINK_SH = 0xd97fa0;

/** True only if a real WebGL context can be obtained (false in jsdom). Keeps
 *  the view from ever touching Pixi rendering in the test environment. */
function hasWebGL(): boolean {
  try {
    if (typeof document === 'undefined') return false;
    const c = document.createElement('canvas');
    const gl =
      c.getContext('webgl2') ||
      c.getContext('webgl') ||
      c.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

function darken(hex: number, amt: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const m = (c: number) => Math.max(0, Math.round(c * (1 - amt)));
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

export interface TycoonPixiOptions {
  /** Difficulty 0..3 (flows into the core). */
  difficulty: number;
  /** Daily seed; undefined = real-time regen mode. */
  seed?: number;
  /** Initial viewport size (CSS px). */
  width: number;
  height: number;
  onScore?: (score: number) => void;
  onWin?: (score: number) => void;
  onGameOver?: (score: number) => void;
  /** Called every frame after state updates (HUD polling hook). */
  onUpdate?: () => void;
}

/** A queued visual hop the ticker animates (one tile of a roll). */
interface HopAnim {
  from: number; // tile index
  to: number; // tile index
  elapsed: number;
}

/** A coin particle in the burst pool. */
interface Coin {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

/** Per-tile rendered sprite bundle. */
interface TileSprite {
  container: Container;
  index: number;
}

export class TycoonPixiGame {
  private host: HTMLElement;
  private opts: TycoonPixiOptions;
  private app: Application | null = null;
  private core: TycoonCore;

  // Scene graph
  private world = new Container(); // camera-transformed root
  private boardLayer = new Container(); // depth-sorted tiles + buildings
  private tokenLayer = new Container(); // Penny + her shadow
  private coinLayer = new Container(); // particle burst
  private token = new Container();
  private tokenShadow = new Graphics();
  private uiLayer = new Container(); // screen-space chrome (GO!, cash, dice)
  private goButton = new Container();
  private cashText: Text | null = null;
  private diceText: Text | null = null;
  private multText: Text | null = null;
  private flashText: Text | null = null;

  private tiles: TileSprite[] = [];
  private buildingSprites: Container[] = []; // 4 landmark risers at center
  private worldPts: WorldPoint[] = [];
  private coins: Coin[] = [];

  // Camera springs (x, y, zoom).
  private camX = new Spring(0, 90, 16);
  private camY = new Spring(0, 90, 16);
  private camZoom = new Spring(1, 70, 16);

  // Token visual position (springs toward the hop target for overshoot).
  private tokenScale = new Spring(1, 260, 13);

  // Animation state
  private hopQueue: HopAnim[] = [];
  private activeHop: HopAnim | null = null;
  private rolling = false; // a roll's hops are in flight (gates input)
  private regenAccum = 0;
  private flashTimer = 0;
  private destroyed = false;
  private started = false;

  private vw: number;
  private vh: number;

  constructor(host: HTMLElement, opts: TycoonPixiOptions) {
    this.host = host;
    this.opts = opts;
    this.vw = Math.max(1, opts.width);
    this.vh = Math.max(1, opts.height);

    // Daily mode determinism flows through the core's injected rng (a seeded
    // mulberry32 when a seed is present, else Math.random for casual play).
    const rng = opts.seed != null ? mulberry32(opts.seed) : Math.random;
    this.core = new TycoonCore({
      rng,
      difficulty: opts.difficulty,
      seed: opts.seed,
      now: Date.now(),
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Mount Pixi, build the scene, start the ticker. `resume` true means a save
   *  was deserialized into the core before start() — skip the fresh layout reset
   *  of the token (it's read from the core). Async (Pixi v8 init negotiates GPU). */
  async start(_resume = false): Promise<void> {
    if (this.started || this.destroyed) return;
    this.started = true;

    // Bail in a non-renderable environment (jsdom / no WebGL). The shell handles
    // the rejection gracefully; tests never instantiate a real Application.
    if (!hasWebGL()) {
      throw new Error('WebGL unavailable — Pixi Tycoon view requires a GPU canvas');
    }

    const app = new Application();
    await app.init({
      width: this.vw,
      height: this.vh,
      background: WARM_BG,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: 'webgl',
    });
    if (this.destroyed) {
      // Destroyed mid-init (shell exited before GPU came back) — tear down.
      app.destroy({ removeView: true }, { children: true });
      return;
    }
    this.app = app;
    this.host.appendChild(app.canvas);

    app.stage.addChild(this.world);
    this.world.addChild(this.boardLayer, this.tokenLayer, this.coinLayer);
    app.stage.addChild(this.uiLayer);

    this.buildBoard();
    this.buildToken();
    this.buildCoinPool();
    this.buildChrome();

    // Place camera instantly on the token (no opening lurch).
    this.snapCameraToToken();
    this.layoutChrome();
    this.refreshHud();

    app.ticker.add(this.onTick);

    // Pointer-to-roll anywhere on the board (the GO! button is the affordance,
    // but the whole stage is tappable for the casual feel).
    app.stage.eventMode = 'static';
    app.stage.hitArea = { contains: () => true } as { contains: () => boolean };
    app.stage.on('pointertap', this.onPointerTap);
  }

  destroy(): void {
    this.destroyed = true;
    const app = this.app;
    if (!app) return;
    this.app = null;
    try {
      app.ticker.remove(this.onTick);
      app.stage.off('pointertap', this.onPointerTap);
      app.destroy({ removeView: true }, { children: true });
    } catch {
      /* already torn down */
    }
  }

  getScore(): number {
    return this.core.getScore();
  }

  serialize(): GameSnapshot {
    return this.core.serialize();
  }

  /** Restore core state from a snapshot (SAME format as the canvas view, so
   *  saves are cross-compatible). Must be called BEFORE start(). */
  deserialize(state: GameSnapshot): void {
    const ok = this.core.deserialize(state, Date.now());
    if (!ok) return;
    // If the scene is already built (resume after start), re-sync visuals.
    if (this.app) {
      this.rebuildBoard();
      this.snapCameraToToken();
      this.refreshHud();
    }
  }

  /** Resize the renderer + chrome to a new viewport (shell drives this). */
  resize(w: number, h: number): void {
    this.vw = Math.max(1, w);
    this.vh = Math.max(1, h);
    if (!this.app) return;
    this.app.renderer.resize(this.vw, this.vh);
    this.layoutChrome();
    // Re-target camera zoom to the new fit (snap so resize doesn't lurch).
    this.snapCameraToToken();
  }

  // ── Board construction ───────────────────────────────────────────────────

  private buildBoard(): void {
    this.worldPts = ringLayout(TILE_CELL);
    this.rebuildBoard();
  }

  /** (Re)draw all 20 tiles + the city-center buildings from current core state.
   *  Used on init, board-advance and resume. */
  private rebuildBoard(): void {
    this.boardLayer.removeChildren();
    this.tiles = [];
    this.buildingSprites = [];

    const tiles = this.core.getTiles();
    // Build tile sprites, depth-sorted (back tiles first).
    const order = tiles
      .map((t, i) => ({ i, key: depthKey(this.worldPts[i]) }))
      .sort((a, b) => a.key - b.key);

    for (const { i } of order) {
      const sprite = this.makeTile(tiles[i], i);
      const sp = worldToScreen(this.worldPts[i]);
      sprite.x = sp.sx;
      sprite.y = sp.sy;
      this.boardLayer.addChild(sprite);
      this.tiles.push({ container: sprite, index: i });
    }

    // City center: 4 landmark slots that rise as built. Drawn at world origin,
    // depth-sorted last (it's the visual focal point in the middle).
    this.buildCity();
  }

  /** One 2.5D tile: a dimetric quad top + extruded side faces + a procedural
   *  icon/label. Corners are larger. */
  private makeTile(tile: Tile, index: number): Container {
    const c = new Container();
    const isCorner = index % 5 === 0;
    const cell = TILE_CELL * (isCorner ? 1.18 : 0.92);
    const hw = cell / 2;
    const hh = (cell / 2) * ISO_SQUASH;
    const depth = 10;

    const topColor =
      tile.type === 'property'
        ? PLAZA_BANDS[index % PLAZA_BANDS.length]
        : TILE_TOP[tile.type] ?? CREAM;
    const sideColor = darken(topColor, 0.34);

    const g = new Graphics();
    // Side faces (front + right) for the emboss.
    g.poly([-hw, hh, hw, hh, hw, hh + depth, -hw, hh + depth]).fill(sideColor);
    g.poly([hw, -hh, hw, hh, hw, hh + depth, hw, -hh + depth]).fill(darken(topColor, 0.5));
    // Top face.
    g.rect(-hw, -hh, cell, cell * ISO_SQUASH).fill(topColor);
    // Ink outline (subtle).
    g.rect(-hw, -hh, cell, cell * ISO_SQUASH).stroke({ color: INK, width: 1.5, alpha: 0.22 });
    // Specular highlight band (top-left).
    g.poly([-hw, -hh, hw * 0.4, -hh, -hw * 0.2, hh * 0.2, -hw, hh * 0.2]).fill({
      color: 0xffffff,
      alpha: 0.16,
    });
    c.addChild(g);

    // Gold value chip on corners + a short label.
    if (isCorner) {
      const chip = new Graphics()
        .circle(0, 0, hw * 0.34)
        .fill(GOLD)
        .stroke({ color: GOLD_SH, width: 2 });
      chip.y = -hh * 0.1;
      c.addChild(chip);
    } else {
      this.addTileIcon(c, tile, hw, hh);
    }

    const label = new Text({
      text: this.tileLabel(tile),
      style: {
        fill: tile.type === 'railroad' || tile.type === 'treasure' ? GOLD_HI : INK,
        fontSize: isCorner ? 13 : 10,
        fontWeight: '800',
        fontFamily: 'system-ui, sans-serif',
        align: 'center',
      },
    });
    label.anchor.set(0.5);
    label.y = hh + depth + 9;
    label.scale.set(0.9);
    c.addChild(label);
    return c;
  }

  private tileLabel(tile: Tile): string {
    switch (tile.type) {
      case 'go':
        return 'GO';
      case 'property':
        return `+${tile.baseValue}`;
      case 'tax':
        return `-${tile.baseValue}`;
      case 'chance':
        return '?';
      case 'treasure':
        return 'Vault';
      case 'railroad':
        return 'Heist';
      case 'jail':
        return 'Jail';
      case 'parking':
        return 'Park';
      case 'gotojail':
        return 'Go Jail';
      default:
        return '';
    }
  }

  /** A small procedural glyph centered on a non-corner tile (no image assets). */
  private addTileIcon(c: Container, tile: Tile, hw: number, hh: number): void {
    const g = new Graphics();
    const s = Math.min(hw, hh) * 0.5;
    const accent = 0xffffff;
    switch (tile.type) {
      case 'property':
        // a tiny house
        g.poly([-s * 0.6, s * 0.3, 0, -s * 0.5, s * 0.6, s * 0.3]).fill(accent);
        g.rect(-s * 0.45, s * 0.3, s * 0.9, s * 0.5).fill({ color: accent, alpha: 0.85 });
        break;
      case 'tax':
        g.poly([0, -s * 0.6, s * 0.55, s * 0.5, -s * 0.55, s * 0.5]).fill(0xffe2d6);
        g.rect(-s * 0.08, -s * 0.2, s * 0.16, s * 0.45).fill(0x9a3b4e);
        g.circle(0, s * 0.45, s * 0.1).fill(0x9a3b4e);
        break;
      case 'chance':
        g.circle(0, 0, s * 0.6).fill({ color: accent, alpha: 0.9 });
        break;
      case 'treasure':
        g.rect(-s * 0.6, -s * 0.25, s * 1.2, s * 0.7).fill(GOLD);
        g.rect(-s * 0.6, -s * 0.4, s * 1.2, s * 0.2).fill(GOLD_HI);
        break;
      case 'railroad':
        g.circle(0, 0, s * 0.55).fill(GOLD).stroke({ color: GOLD_SH, width: 2 });
        g.circle(0, 0, s * 0.2).fill(INK);
        break;
      default:
        return;
    }
    c.addChild(g);
  }

  /** The city center: a stacked 3-tier landmark cluster. Slots rise with an
   *  ease-out scale-Y as the core builds them. Drawn on top of the board. */
  private buildCity(): void {
    const city = new Container();
    const built = this.core.getLandmarksBuilt();
    const tiers = [
      { color: 0x8b5e83, w: 60, h: 36 }, // house
      { color: 0x6b4566, w: 74, h: 56 }, // tower
      { color: 0x5e3c58, w: 52, h: 86 }, // landmark spire
      { color: GOLD, w: 40, h: 110 }, // golden landmark
    ];
    for (let i = 0; i < 4; i++) {
      const tier = tiers[i];
      const b = new Container();
      const g = new Graphics();
      const hw = tier.w / 2;
      // Building body with a lit front + shaded side, capped with a roof chip.
      g.rect(-hw, -tier.h, tier.w, tier.h).fill(tier.color);
      g.rect(hw - 8, -tier.h, 8, tier.h).fill(darken(tier.color, 0.3));
      g.rect(-hw, -tier.h, tier.w, 8).fill({ color: i === 3 ? GOLD_HI : 0xffffff, alpha: 0.9 });
      // Little windows.
      for (let wy = -tier.h + 16; wy < -10; wy += 16) {
        for (let wx = -hw + 8; wx < hw - 12; wx += 14) {
          g.rect(wx, wy, 6, 8).fill({ color: GOLD_HI, alpha: 0.7 });
        }
      }
      b.addChild(g);
      // Spread the four buildings slightly so they read as a cluster.
      b.x = (i - 1.5) * 30;
      b.y = -8 + (i % 2) * 6;
      b.scale.y = i < built ? 1 : 0.001; // un-built slots are flat
      b.visible = true;
      city.addChild(b);
      this.buildingSprites.push(b);
    }
    city.y = -6; // nudge up so it sits "inside" the ring
    this.boardLayer.addChild(city);
  }

  // ── Token (Penny piggy-bank) ─────────────────────────────────────────────

  private buildToken(): void {
    // Detaching shadow (lives behind the token, in the same layer).
    this.tokenShadow.clear();
    this.tokenShadow.ellipse(0, 0, 26, 12).fill({ color: 0x000000, alpha: 0.22 });
    this.tokenShadow.filters = [new BlurFilter({ strength: 4, quality: 2 })];

    this.token.removeChildren();
    const g = new Graphics();
    // Body (round pink piggy).
    g.ellipse(0, -22, 30, 26).fill(PENNY_PINK).stroke({ color: PENNY_PINK_SH, width: 2 });
    // Belly highlight.
    g.ellipse(-6, -26, 14, 10).fill({ color: 0xffffff, alpha: 0.35 });
    // Snout.
    g.ellipse(0, -16, 13, 9).fill(PENNY_PINK_SH);
    g.circle(-4, -16, 2).fill(INK);
    g.circle(4, -16, 2).fill(INK);
    // Coin-slot on top (the "hat" replacement).
    g.rect(-10, -50, 20, 5).fill(INK);
    g.rect(-10, -50, 20, 5).stroke({ color: GOLD_SH, width: 1 });
    // Ears.
    g.poly([-22, -40, -12, -46, -14, -34]).fill(PENNY_PINK_SH);
    g.poly([22, -40, 12, -46, 14, -34]).fill(PENNY_PINK_SH);
    // Eye + gold monocle.
    g.circle(10, -28, 3).fill(INK);
    g.circle(10, -28, 7).stroke({ color: GOLD, width: 2.5 });
    // Green bow tie.
    g.poly([-8, -10, 0, -13, 0, -7]).fill(0x3fa97a);
    g.poly([8, -10, 0, -13, 0, -7]).fill(0x3fa97a);
    g.circle(0, -10, 2.5).fill(0x2c8460);
    // Little feet.
    g.circle(-12, 2, 5).fill(PENNY_PINK_SH);
    g.circle(12, 2, 5).fill(PENNY_PINK_SH);
    this.token.addChild(g);

    this.tokenLayer.addChild(this.tokenShadow, this.token);
    this.placeTokenAtIndex(this.core.getTokenIndex(), 0);
  }

  /** Position the token + shadow at a tile index, with an optional hop lift. */
  private placeTokenAtIndex(index: number, lift: number): void {
    const wp = this.worldPts[index];
    const sp = worldToScreen(wp);
    this.token.x = sp.sx;
    this.token.y = sp.sy - lift;
    this.tokenShadow.x = sp.sx;
    this.tokenShadow.y = sp.sy + 4;
    // Shadow shrinks as Penny rises (detaches).
    const k = 1 - Math.min(lift / 60, 0.6);
    this.tokenShadow.scale.set(k);
    this.tokenShadow.alpha = 0.25 * k;
  }

  // ── Coin particle pool ─────────────────────────────────────────────────────

  private buildCoinPool(): void {
    this.coins = [];
    for (let i = 0; i < 60; i++) {
      const cr = 5 + (i % 3) * 2;
      const g = new Graphics();
      g.circle(0, 0, cr).fill(GOLD_HI).stroke({ color: GOLD_SH, width: 1.5 });
      g.circle(0, 0, cr * 0.45).fill({ color: CREAM, alpha: 0.5 });
      g.visible = false;
      this.coinLayer.addChild(g);
      this.coins.push({ gfx: g, vx: 0, vy: 0, life: 0, maxLife: 1 });
    }
  }

  private emitCoins(atIndex: number, count: number): void {
    const wp = this.worldPts[atIndex];
    const sp = worldToScreen(wp);
    let emitted = 0;
    for (const c of this.coins) {
      if (c.life > 0) continue;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 120 + Math.random() * 150;
      c.vx = Math.cos(ang) * speed;
      c.vy = Math.sin(ang) * speed;
      c.maxLife = 0.7 + Math.random() * 0.5;
      c.life = c.maxLife;
      c.gfx.x = sp.sx;
      c.gfx.y = sp.sy - 20;
      c.gfx.visible = true;
      c.gfx.alpha = 1;
      if (++emitted >= count) break;
    }
  }

  // ── Screen-space chrome (minimal — PX3 polishes) ──────────────────────────

  private buildChrome(): void {
    // GO! button (bottom-center). A glossy gold pill.
    this.goButton.removeChildren();
    const g = new Graphics();
    g.roundRect(-58, -26, 116, 52, 26).fill(GOLD).stroke({ color: GOLD_SH, width: 3 });
    g.roundRect(-52, -22, 104, 18, 14).fill({ color: 0xffffff, alpha: 0.3 });
    this.goButton.addChild(g);
    const goLabel = new Text({
      text: 'GO!',
      style: { fill: INK, fontSize: 24, fontWeight: '900', fontFamily: 'system-ui, sans-serif' },
    });
    goLabel.anchor.set(0.5);
    this.goButton.addChild(goLabel);
    this.goButton.eventMode = 'static';
    this.goButton.cursor = 'pointer';
    this.goButton.on('pointertap', (e) => {
      e.stopPropagation();
      this.tryRoll();
    });
    this.uiLayer.addChild(this.goButton);

    // Cash + dice + multiplier readouts (top, minimal).
    this.cashText = new Text({
      text: '',
      style: { fill: INK, fontSize: 16, fontWeight: '800', fontFamily: 'system-ui, sans-serif' },
    });
    this.diceText = new Text({
      text: '',
      style: { fill: 0x6b4566, fontSize: 14, fontWeight: '700', fontFamily: 'system-ui, sans-serif' },
    });
    this.multText = new Text({
      text: '',
      style: { fill: INK, fontSize: 14, fontWeight: '900', fontFamily: 'system-ui, sans-serif' },
    });
    this.multText.eventMode = 'static';
    this.multText.cursor = 'pointer';
    this.multText.on('pointertap', (e) => {
      e.stopPropagation();
      this.core.cycleMultiplier();
      this.refreshHud();
    });
    this.flashText = new Text({
      text: '',
      style: { fill: GOLD_SH, fontSize: 18, fontWeight: '900', fontFamily: 'system-ui, sans-serif', align: 'center' },
    });
    this.flashText.anchor.set(0.5);
    this.flashText.alpha = 0;
    this.uiLayer.addChild(this.cashText, this.diceText, this.multText, this.flashText);
  }

  private layoutChrome(): void {
    if (!this.cashText || !this.diceText || !this.multText || !this.flashText) return;
    this.goButton.x = this.vw / 2;
    this.goButton.y = this.vh - 56;
    this.cashText.x = 14;
    this.cashText.y = 50;
    this.diceText.x = 14;
    this.diceText.y = 72;
    this.multText.anchor.set(1, 0);
    this.multText.x = this.vw - 14;
    this.multText.y = 50;
    this.flashText.x = this.vw / 2;
    this.flashText.y = this.vh * 0.3;
  }

  private refreshHud(): void {
    if (this.cashText) this.cashText.text = `\u{1F4B0} ${this.core.getCoins().toLocaleString()}`;
    if (this.diceText) this.diceText.text = `\u{1F3B2} ${this.core.getDice()}`;
    if (this.multText) this.multText.text = `×${MULTIPLIERS[this.core.getMultiplierIndex()]}`;
    // Dim the GO button when a roll isn't affordable / a hop is in flight.
    const canRoll = this.core.canRoll() && !this.rolling;
    this.goButton.alpha = canRoll ? 1 : 0.45;
    this.opts.onScore?.(this.core.getScore());
    this.opts.onUpdate?.();
  }

  private showFlash(msg: string): void {
    if (!this.flashText || !msg) return;
    this.flashText.text = msg;
    this.flashText.alpha = 1;
    this.flashText.scale.set(0.7);
    this.flashTimer = 1.4;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private onPointerTap = (): void => {
    this.tryRoll();
  };

  private tryRoll(): void {
    if (this.rolling || !this.core.canRoll() || this.core.isRaidOpen()) return;
    this.roll();
  }

  private roll(): void {
    const res = this.core.roll(Date.now());
    this.refreshHud();
    if (!res.ok) {
      // Jail-skip / not-enough — nothing to animate.
      if (res.reason === 'skipped') this.showFlash('Jailed! Skipped');
      return;
    }
    this.rolling = true;
    this.showFlash(`\u{1F3B2} ${res.die1} + ${res.die2}`);
    // Queue one HopAnim per logical step (the core advances per completed hop).
    this.hopQueue = [];
    for (let s = 0; s < res.steps; s++) {
      const from = (this.core.getTokenIndex() + s) % BOARD_SIZE;
      const to = (from + 1) % BOARD_SIZE;
      this.hopQueue.push({ from, to, elapsed: 0 });
    }
    this.tokenScale.snap(1);
  }

  // ── Frame loop ─────────────────────────────────────────────────────────────

  private onTick = (ticker: Ticker): void => {
    if (this.destroyed || !this.app) return;
    const dt = Math.min(ticker.deltaMS / 1000, 1 / 30);

    // Regen tick (throttled).
    this.regenAccum += dt;
    if (this.regenAccum >= REGEN_CHECK_S) {
      this.regenAccum = 0;
      const before = this.core.getDice();
      this.core.tick(Date.now());
      if (this.core.getDice() !== before) this.refreshHud();
    }

    this.stepHops(dt);
    this.stepCoins(dt);
    this.stepCamera(dt);
    this.stepFlash(dt);

    // Idle Penny bob when not hopping.
    if (!this.activeHop) {
      const t = ticker.lastTime / 1000;
      this.token.y -= Math.sin(t * 2.2) * 0.15;
    }
    const s = this.tokenScale.step(dt);
    this.token.scale.set(s);
  };

  /** Advance the visual hop queue; on each completed hop, advance the core one
   *  step (paying GO salary); when the queue drains, resolve the landed tile. */
  private stepHops(dt: number): void {
    if (!this.activeHop) {
      const next = this.hopQueue.shift();
      if (next) this.activeHop = next;
      else return;
    }
    const hop = this.activeHop!;
    hop.elapsed += dt;
    const p = Math.min(hop.elapsed / HOP_DURATION, 1);

    const a = worldToScreen(this.worldPts[hop.from]);
    const b = worldToScreen(this.worldPts[hop.to]);
    const lift = hopArc(p, 38);
    const sq = hopSquash(p, 0.16);
    this.token.x = lerp(a.sx, b.sx, p);
    this.token.y = lerp(a.sy, b.sy, p) - lift;
    this.token.scale.set(this.tokenScale.value * sq.sx, this.tokenScale.value * sq.sy);
    // Shadow stays on the ground, detaching as Penny rises.
    this.tokenShadow.x = this.token.x;
    this.tokenShadow.y = lerp(a.sy, b.sy, p) + 4;
    const k = 1 - Math.min(lift / 60, 0.55);
    this.tokenShadow.scale.set(k);
    this.tokenShadow.alpha = 0.25 * k;

    if (p >= 1) {
      // Logical step: core advances + pays salary.
      const ev = this.core.advanceTokenOneStep();
      if (ev.passedGo && ev.salary > 0) {
        this.emitCoins(0, 8);
        this.showFlash(`GO! +${ev.salary}`);
        this.refreshHud();
      }
      this.activeHop = null;
      this.tokenScale.snap(1.16); // little landing pop
      if (this.hopQueue.length === 0) this.onHopsComplete();
    }
  }

  /** Called when the token's last hop settles: resolve the tile, animate the
   *  payout, run builds, fire callbacks. */
  private onHopsComplete(): void {
    this.rolling = false;
    const land = this.core.resolveLandedTile();
    const idx = this.core.getTokenIndex();

    if (land.message) this.showFlash(land.message);
    if (land.burst && land.coinDelta > 0) {
      this.emitCoins(idx, Math.min(24, 8 + Math.floor(land.coinDelta / 30)));
    }

    if (land.openedRaid) {
      // PX3 owns the rich raid overlay; here we auto-resolve a vault so the loop
      // keeps flowing (the core is authoritative). Pick the middle vault.
      this.core.chooseVault(1);
      const rr = this.core.getRaidResult();
      if (rr && !rr.blocked && rr.stolen > 0) {
        this.emitCoins(idx, 16);
        this.showFlash(`Heist! +${rr.stolen}`);
      } else {
        this.showFlash('Heist blocked!');
      }
      const after = this.core.closeRaid();
      this.applyBuilds(after.builds);
    } else if (land.afterTurn) {
      this.applyBuilds(land.afterTurn.builds);
    }

    this.refreshHud();
    if (this.core.isWon()) this.opts.onWin?.(this.core.getScore());
  }

  /** Animate any landmark builds (rise the matching slot) + board completion. */
  private applyBuilds(builds: { built: boolean; slot: number; boardComplete: unknown }[]): void {
    for (const b of builds) {
      if (!b.built) continue;
      if (b.boardComplete) {
        // New board generated by the core — rebuild the whole scene.
        this.rebuildBoard();
        this.placeTokenAtIndex(this.core.getTokenIndex(), 0);
        this.snapCameraToToken();
        this.showFlash('BOARD COMPLETE!');
        this.emitCoins(0, 24);
        return;
      }
      const sprite = this.buildingSprites[b.slot];
      if (sprite) {
        // Pop the building up (the ticker doesn't tween scale.y per-building, so
        // set it directly — ease handled by a quick spring-free set; PX3 adds the
        // dust + roof sparkle).
        sprite.scale.y = 1;
        this.emitCoins(0, 10);
      }
    }
  }

  // ── Camera ─────────────────────────────────────────────────────────────────

  /** Board projected bounding half-extents (world px) for the fit zoom. */
  private boardExtents(): { w: number; h: number } {
    let maxX = 0;
    let maxY = 0;
    for (const p of this.worldPts) {
      const sp = worldToScreen(p);
      maxX = Math.max(maxX, Math.abs(sp.sx));
      maxY = Math.max(maxY, Math.abs(sp.sy));
    }
    return { w: (maxX + TILE_CELL) * 2, h: (maxY + TILE_CELL) * 2 };
  }

  private targetZoom(): number {
    const ext = this.boardExtents();
    const fit = fitZoom(ext.w, ext.h, this.vw, this.vh);
    return followZoom(fit);
  }

  private cameraGoal(): { x: number; y: number; zoom: number } {
    const zoom = this.targetZoom();
    // Follow the token's CURRENT visual screen position (relative to world).
    const focus = { sx: this.token.x, sy: this.token.y + 18 };
    const t = cameraTarget(focus, this.vw, this.vh, zoom);
    return { x: t.x, y: t.y, zoom };
  }

  private stepCamera(dt: number): void {
    const goal = this.cameraGoal();
    this.camX.target = goal.x;
    this.camY.target = goal.y;
    this.camZoom.target = goal.zoom;
    const z = this.camZoom.step(dt);
    this.world.scale.set(z);
    this.world.x = this.camX.step(dt);
    this.world.y = this.camY.step(dt);
  }

  private snapCameraToToken(): void {
    // Place the token visually first so the camera goal is correct.
    this.placeTokenAtIndex(this.core.getTokenIndex(), 0);
    const goal = this.cameraGoal();
    this.camX.snap(goal.x);
    this.camY.snap(goal.y);
    this.camZoom.snap(goal.zoom);
    this.world.scale.set(goal.zoom);
    this.world.x = goal.x;
    this.world.y = goal.y;
  }

  // ── Particles / flash ──────────────────────────────────────────────────────

  private stepCoins(dt: number): void {
    for (const c of this.coins) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.vy += 520 * dt;
      c.gfx.x += c.vx * dt;
      c.gfx.y += c.vy * dt;
      c.gfx.rotation += dt * 6;
      c.gfx.alpha = Math.max(0, c.life / c.maxLife);
      if (c.life <= 0) c.gfx.visible = false;
    }
  }

  private stepFlash(dt: number): void {
    if (!this.flashText || this.flashTimer <= 0) return;
    this.flashTimer -= dt;
    // Ease the scale up + fade out near the end.
    const s = this.flashText.scale.x;
    this.flashText.scale.set(s + (1 - s) * Math.min(1, dt * 10));
    if (this.flashTimer < 0.4) this.flashText.alpha = Math.max(0, this.flashTimer / 0.4);
    if (this.flashTimer <= 0) this.flashText.alpha = 0;
  }
}

/** Resolve a daily seed for the Tycoon Pixi view (exported for the shell). */
export function tycoonDailySeed(): number {
  return dailySeed();
}
