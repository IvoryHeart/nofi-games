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
 * PX3 — MGO-style art + chrome (original art): readable extruded tiles
 * (tiles.ts), a bottom control bar with glossy dice cubes + GO! + a multiplier
 * dial and a top cash odometer (chrome.ts), a red ribbon event banner
 * (banner.ts), a 3-vault heist overlay (raidOverlay.ts), and VFX (coin shower,
 * building-rise dust, screen shake, glow/blur sheen).
 *
 * Procedural ONLY — no image assets. Everything is Graphics/Container/Text +
 * filters. Offline/PWA preserved (this whole module is a lazy tycoon-only chunk;
 * the nofi `main` bundle never imports it).
 *
 * Pure geometry/chrome math (camera, projection, layout, odometer, pips, banner
 * timing, vault hit-test) lives in ./layout.ts + ./chromeMath.ts and is
 * unit-tested in jsdom — Pixi/WebGL cannot render there, so this file is loaded
 * ONLY via dynamic import on the live app.
 */

import { Application, Container, Graphics, Ticker, BlurFilter } from 'pixi.js';

import { dailySeed } from '../../utils/rng';
import { mulberry32 } from '../../utils/rng';
import { TycoonCore } from '../../games/dice-tycoon/core/TycoonCore';
import { BOARD_SIZE } from '../../games/dice-tycoon/board';
import type { GameSnapshot } from '../../engine/GameEngine';
import {
  Spring,
  ringLayout,
  worldToScreen,
  depthKey,
  cameraTarget,
  boardFitZoom,
  gentleFollowTarget,
  classifyPointer,
  clampPan,
  hopArc,
  hopSquash,
  lerp,
  TILE_CELL,
  TILE_W,
  TILE_H,
  TILE_DEPTH,
  WorldPoint,
} from './layout';
import { makeTile, darken } from './tiles';
import { ControlBar, CashCounter } from './chrome';
import { RibbonBanner } from './banner';
import { RaidOverlay } from './raidOverlay';
import { shakeOffset } from './chromeMath';

// ── Fidelity palette (mirrors docs/plans/dice-tycoon-fidelity.md §A) ──────────
const WARM_BG = 0xfbe3cc;
const GOLD = 0xf7b500;
const GOLD_HI = 0xffe08a;
const GOLD_SH = 0xb97e00;
const CREAM = 0xfff7ec;

const REGEN_CHECK_S = 1; // throttle core.tick() to ~1/s
const HOP_DURATION = 0.16; // seconds per single-tile hop
const PENNY_PINK = 0xf6a8c0;
const PENNY_PINK_SH = 0xd97fa0;
const INK = 0x3a2a36;

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
  /** When set, the coin homes toward this screen target (cash counter). */
  toCash: boolean;
}

/** A dust puff particle for building-rise VFX. */
interface Dust {
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

/** A landmark slot that springs up when built. */
interface Landmark {
  container: Container;
  rise: Spring; // 0..1 scale-Y
  built: boolean;
}

export class TycoonPixiGame {
  private host: HTMLElement;
  private opts: TycoonPixiOptions;
  private app: Application | null = null;
  private core: TycoonCore;

  // Scene graph
  private world = new Container(); // camera-transformed root (shaken)
  private boardLayer = new Container(); // depth-sorted tiles + buildings
  private tokenLayer = new Container(); // Penny + her shadow
  private coinLayer = new Container(); // particle burst (screen-space)
  private token = new Container();
  private tokenShadow = new Graphics();
  private uiLayer = new Container(); // screen-space chrome

  // PX3 chrome modules.
  private controlBar!: ControlBar;
  private cashCounter!: CashCounter;
  private banner = new RibbonBanner();
  private raid!: RaidOverlay;

  private tiles: TileSprite[] = [];
  private landmarks: Landmark[] = []; // 4 landmark risers at center
  private worldPts: WorldPoint[] = [];
  private coins: Coin[] = [];
  private dust: Dust[] = [];

  // Camera springs (x, y, zoom).
  private camX = new Spring(0, 90, 16);
  private camY = new Spring(0, 90, 16);
  private camZoom = new Spring(1, 70, 16);

  // User pan offset (screen px) applied on top of the board-fit framing. Drag
  // to pan; clamped so the board can't be dragged fully off-screen. Eases back
  // toward 0 after the user has been idle for a beat.
  private panOffset = { x: 0, y: 0 };
  private panIdle = 0; // seconds since the last pan interaction
  // Active drag tracking (pointer id + last + accumulated movement).
  private dragId: number | null = null;
  private dragLast = { x: 0, y: 0 };
  private dragMoved = 0; // total px travelled (tap-vs-drag classifier)
  private panning = false; // crossed the drag threshold this gesture

  // Token visual position (springs toward the hop target for overshoot).
  private tokenScale = new Spring(1, 260, 13);

  // Screen-shake state.
  private shakeLife = 0;
  private shakeMaxLife = 0.4;
  private shakeMag = 0;
  private shakeT = 0;

  // Animation state
  private hopQueue: HopAnim[] = [];
  private activeHop: HopAnim | null = null;
  private rolling = false; // a roll's hops are in flight (gates input)
  private regenAccum = 0;
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
    this.world.addChild(this.boardLayer, this.tokenLayer);
    app.stage.addChild(this.coinLayer); // screen-space particles above the board
    app.stage.addChild(this.uiLayer);

    this.buildBoard();
    this.buildToken();
    this.buildCoinPool();
    this.buildChrome();

    // Place camera instantly on the token (no opening lurch).
    this.snapCameraToToken();
    this.layoutChrome();
    this.refreshHud(true);

    app.ticker.add(this.onTick);

    // Drag-to-pan on the board. Rolling is NEVER bound to tap-anywhere — it
    // happens only via the GO! button or Space/Enter. A pointer-down + move
    // beyond ~8px enters PAN mode (translates the camera, clamped); a short tap
    // does nothing harmful.
    app.stage.eventMode = 'static';
    app.stage.hitArea = { contains: () => true } as { contains: () => boolean };
    app.stage.on('pointerdown', this.onPointerDown);
    app.stage.on('pointermove', this.onPointerMove);
    app.stage.on('pointerup', this.onPointerUp);
    app.stage.on('pointerupoutside', this.onPointerUp);

    // Keyboard: Space / Enter rolls (the GO! button's keyboard equivalent).
    window.addEventListener('keydown', this.onKeyDown);
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    const app = this.app;
    if (!app) return;
    this.app = null;
    try {
      app.ticker.remove(this.onTick);
      app.stage.off('pointerdown', this.onPointerDown);
      app.stage.off('pointermove', this.onPointerMove);
      app.stage.off('pointerup', this.onPointerUp);
      app.stage.off('pointerupoutside', this.onPointerUp);
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
      this.refreshHud(true);
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
    this.landmarks = [];

    const tiles = this.core.getTiles();
    // Depth-sortable draw list: each tile keyed by its iso depth (gx+gy), plus
    // the city cluster at the grid origin (depth 0). Back-to-front so nearer
    // blocks (greater gx+gy, lower on screen) overlap farther ones correctly.
    type Item = { key: number; node: Container };
    const items: Item[] = tiles.map((_, i) => ({
      key: depthKey(this.worldPts[i]),
      node: (() => {
        const sprite = makeTile(tiles[i], i, this.worldPts[i]);
        this.tiles.push({ container: sprite, index: i });
        return sprite;
      })(),
    }));
    // City center: 4 landmark slots that rise as built, at the diamond center
    // (grid origin → depth 0). It rises ABOVE far tiles but BELOW the near tiles.
    items.push({ key: 0, node: this.buildCity() });

    items.sort((a, b) => a.key - b.key);
    for (const it of items) this.boardLayer.addChild(it.node);
  }

  /** The city center: a cluster of tall glossy 3D landmark towers (mgo4.png).
   *  Slots rise with a spring scale-Y as the core builds them. Returns the
   *  container so the caller can depth-sort it into the board draw order. */
  private buildCity(): Container {
    const city = new Container();
    const built = this.core.getLandmarksBuilt();
    const tiers = [
      { color: 0x8b5e83, w: 50, h: 64 }, // mid-rise
      { color: 0x3fa9c9, w: 60, h: 96 }, // tower
      { color: 0xe0566b, w: 44, h: 132 }, // spire
      { color: GOLD, w: 38, h: 168 }, // golden landmark
    ];
    for (let i = 0; i < 4; i++) {
      const tier = tiers[i];
      const b = new Container();
      const g = new Graphics();
      const hw = tier.w / 2;
      // Soft ground shadow.
      g.ellipse(0, 6, hw * 1.1, 8).fill({ color: 0x000000, alpha: 0.18 });
      // Tower body: lit front, shaded right side, glossy roof cap.
      g.rect(-hw, -tier.h, tier.w, tier.h).fill(tier.color);
      g.rect(hw - 9, -tier.h, 9, tier.h).fill(darken(tier.color, 0.32));
      g.rect(-hw, -tier.h, hw * 0.5, tier.h).fill({ color: 0xffffff, alpha: 0.14 });
      // Roof / crown.
      g.poly([-hw, -tier.h, hw, -tier.h, hw - 6, -tier.h - 12, -hw + 6, -tier.h - 12])
        .fill(i === 3 ? GOLD_HI : darken(tier.color, 0.15));
      // Windows.
      for (let wy = -tier.h + 14; wy < -8; wy += 16) {
        for (let wx = -hw + 7; wx < hw - 11; wx += 13) {
          g.rect(wx, wy, 5, 8).fill({ color: GOLD_HI, alpha: 0.75 });
        }
      }
      // Floating diamond gem above unbuilt slots (MGO build cue).
      b.addChild(g);
      // Spread the four buildings so they read as a city cluster.
      b.x = (i - 1.5) * 32;
      b.y = -6 + (i % 2) * 8;
      b.pivot.y = 0;
      const rise = new Spring(i < built ? 1 : 0, 130, 14);
      b.scale.y = i < built ? 1 : 0.001;
      city.addChild(b);
      this.landmarks.push({ container: b, rise, built: i < built });
    }
    city.y = -4;
    return city;
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

  // ── Coin + dust particle pools (screen-space) ─────────────────────────────

  private buildCoinPool(): void {
    this.coins = [];
    for (let i = 0; i < 72; i++) {
      const cr = 5 + (i % 3) * 2;
      const g = new Graphics();
      g.circle(0, 0, cr).fill(GOLD).stroke({ color: GOLD_SH, width: 1.5 });
      g.circle(0, 0, cr * 0.45).fill({ color: GOLD_HI, alpha: 0.7 });
      g.visible = false;
      this.coinLayer.addChild(g);
      this.coins.push({ gfx: g, vx: 0, vy: 0, life: 0, maxLife: 1, toCash: false });
    }
    this.dust = [];
    for (let i = 0; i < 24; i++) {
      const g = new Graphics();
      g.circle(0, 0, 4 + (i % 3)).fill({ color: 0xe8d8c0, alpha: 0.85 });
      g.visible = false;
      this.coinLayer.addChild(g);
      this.dust.push({ gfx: g, vx: 0, vy: 0, life: 0, maxLife: 1 });
    }
  }

  /** Emit a coin shower at a tile index. When `toCash`, coins fly toward the
   *  cash counter (payout). Coords are projected to SCREEN space (coinLayer). */
  private emitCoins(atIndex: number, count: number, toCash = false): void {
    const wp = this.worldPts[atIndex];
    const wsp = worldToScreen(wp);
    // Project the world point to screen space via the live camera transform.
    const sx = wsp.sx * this.world.scale.x + this.world.x;
    const sy = wsp.sy * this.world.scale.y + this.world.y - 20;
    let emitted = 0;
    for (const c of this.coins) {
      if (c.life > 0) continue;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 130 + Math.random() * 170;
      c.vx = Math.cos(ang) * speed;
      c.vy = Math.sin(ang) * speed;
      c.maxLife = 0.7 + Math.random() * 0.5;
      c.life = c.maxLife;
      c.toCash = toCash;
      c.gfx.x = sx;
      c.gfx.y = sy;
      c.gfx.visible = true;
      c.gfx.alpha = 1;
      if (++emitted >= count) break;
    }
  }

  /** Emit a coin shower at an explicit screen point (raid vault burst). */
  private emitCoinsAt(sx: number, sy: number, count: number): void {
    let emitted = 0;
    for (const c of this.coins) {
      if (c.life > 0) continue;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = 130 + Math.random() * 180;
      c.vx = Math.cos(ang) * speed;
      c.vy = Math.sin(ang) * speed;
      c.maxLife = 0.7 + Math.random() * 0.5;
      c.life = c.maxLife;
      c.toCash = true;
      c.gfx.x = sx;
      c.gfx.y = sy;
      c.gfx.visible = true;
      c.gfx.alpha = 1;
      if (++emitted >= count) break;
    }
  }

  /** Emit a dust ring at a screen point (building-rise VFX). */
  private emitDust(sx: number, sy: number, count: number): void {
    let emitted = 0;
    for (const d of this.dust) {
      if (d.life > 0) continue;
      const ang = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      d.vx = Math.cos(ang) * speed;
      d.vy = Math.sin(ang) * speed - 20;
      d.maxLife = 0.5 + Math.random() * 0.4;
      d.life = d.maxLife;
      d.gfx.x = sx;
      d.gfx.y = sy;
      d.gfx.visible = true;
      d.gfx.alpha = 0.85;
      if (++emitted >= count) break;
    }
  }

  // ── Screen-space chrome (PX3 modules) ─────────────────────────────────────

  private buildChrome(): void {
    this.controlBar = new ControlBar(
      () => this.tryRoll(),
      () => {
        this.core.cycleMultiplier();
        this.refreshHud();
      },
    );
    this.cashCounter = new CashCounter();
    this.raid = new RaidOverlay(
      (i) => this.core.chooseVault(i),
      () => this.onRaidClosed(),
      (sx, sy, big) => {
        this.emitCoinsAt(sx, sy, big ? 22 : 8);
        if (big) this.triggerShake(0.42, 7);
      },
    );

    this.uiLayer.addChild(
      this.cashCounter.root,
      this.controlBar.root,
      this.banner.root,
      this.raid.root,
    );
  }

  private layoutChrome(): void {
    if (!this.controlBar) return;
    this.controlBar.setViewport(this.vw, this.vh);
    this.cashCounter.layout(this.vw, this.vh);
    this.banner.layout(this.vw, this.vh);
    this.raid.setViewport(this.vw, this.vh);
  }

  /** Refresh HUD readouts. `snap` jumps the cash odometer (resume/resize). */
  private refreshHud(snap = false): void {
    if (this.cashCounter) {
      this.cashCounter.setCoins(this.core.getCoins(), snap);
      this.cashCounter.setMeta(this.core.getDice(), this.core.getShields(), this.core.getBoardLevel());
    }
    if (this.controlBar) {
      const canRoll = this.core.canRoll() && !this.rolling && !this.core.isRaidOpen();
      this.controlBar.refresh(this.core.getMultiplierIndex(), this.core.getDice(), canRoll);
    }
    this.opts.onScore?.(this.core.getScore());
    this.opts.onUpdate?.();
  }

  /** Show the red ribbon banner for a big moment. */
  private showBanner(msg: string): void {
    this.banner.show(msg);
  }

  // ── VFX: screen shake ───────────────────────────────────────────────────────

  private triggerShake(maxLife: number, mag: number): void {
    this.shakeLife = maxLife;
    this.shakeMaxLife = maxLife;
    this.shakeMag = mag;
    this.shakeT = 0;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  /** Pointer-down: begin tracking a potential drag. Does NOT roll. */
  private onPointerDown = (e: { global: { x: number; y: number }; pointerId?: number }): void => {
    if (this.core.isRaidOpen()) return; // raid overlay owns input while open
    if (this.dragId != null) return; // ignore secondary pointers (multi-touch)
    this.dragId = e.pointerId ?? 0;
    this.dragLast = { x: e.global.x, y: e.global.y };
    this.dragMoved = 0;
    this.panning = false;
  };

  /** Pointer-move: once past the threshold, enter PAN mode and translate the
   *  camera by the drag delta (clamped). Suspends auto-follow while panning. */
  private onPointerMove = (e: { global: { x: number; y: number }; pointerId?: number }): void => {
    if (this.dragId == null || (e.pointerId ?? 0) !== this.dragId) return;
    const gx = e.global.x;
    const gy = e.global.y;
    const dx = gx - this.dragLast.x;
    const dy = gy - this.dragLast.y;
    this.dragLast = { x: gx, y: gy };
    this.dragMoved += Math.hypot(dx, dy);
    if (!this.panning && classifyPointer(this.dragMoved, 0) === 'drag') {
      this.panning = true;
    }
    if (this.panning) {
      this.panOffset.x += dx;
      this.panOffset.y += dy;
      this.panIdle = 0;
      this.clampPanOffset();
    }
  };

  /** Pointer-up: end the gesture. A short tap (never crossed the threshold)
   *  does nothing — rolling is button/keys only. */
  private onPointerUp = (e: { pointerId?: number }): void => {
    if (this.dragId == null || (e.pointerId ?? 0) !== this.dragId) return;
    this.dragId = null;
    this.panning = false;
  };

  /** Space / Enter roll (the GO! button's keyboard equivalent). Esc is owned
   *  by the shell (exit), so we ignore it here. */
  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.destroyed) return;
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.tryRoll();
    }
  };

  /** Re-clamp the current pan offset against the live board-fit framing so the
   *  board can never be dragged fully off-screen. */
  private clampPanOffset(): void {
    const ext = this.boardExtents();
    const zoom = this.camZoom.target || boardFitZoom(ext.w, ext.h, this.vw, this.vh);
    // The fit camera centers the board at viewport center; clampPan works in
    // absolute world-translation space, so add the centered base, clamp, subtract.
    const base = cameraTarget({ sx: 0, sy: 0 }, this.vw, this.vh, zoom);
    const abs = { x: base.x + this.panOffset.x, y: base.y + this.panOffset.y };
    const clamped = clampPan(abs, this.vw, this.vh, ext.w, ext.h, zoom);
    this.panOffset.x = clamped.x - base.x;
    this.panOffset.y = clamped.y - base.y;
  }

  private tryRoll(): void {
    if (this.rolling || !this.core.canRoll() || this.core.isRaidOpen()) return;
    this.roll();
  }

  private roll(): void {
    const res = this.core.roll(Date.now());
    this.refreshHud();
    if (!res.ok) {
      // Jail-skip / not-enough — nothing to animate.
      if (res.reason === 'skipped') this.showBanner('JAILED!');
      return;
    }
    this.rolling = true;
    // On a fresh roll, ease the camera back toward the board-fit framing (drop
    // any user pan) so the follow reads cleanly.
    this.panIdle = 999;
    // Tumble the glossy dice cubes; they settle on the real faces.
    this.controlBar.rollDice(res.die1, res.die2);
    if (res.die1 === res.die2) this.triggerShake(0.3, 5); // doubles!
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
    this.stepDust(dt);
    this.stepCamera(dt);
    this.stepLandmarks(dt);

    // PX3 chrome animation.
    this.controlBar.update(dt);
    this.cashCounter.update(dt);
    this.banner.update(dt);
    this.raid.update(dt);

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
        this.emitCoins(0, 8, true);
        this.showBanner(`SALARY +${ev.salary}`);
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

    if (land.burst && land.coinDelta > 0) {
      this.emitCoins(idx, Math.min(28, 8 + Math.floor(land.coinDelta / 30)), true);
    }
    if (land.message) this.showBanner(this.shortMessage(land.type, land.message));

    if (land.openedRaid) {
      // PX3: open the rich vault heist overlay; the core is authoritative.
      this.openRaidOverlay();
      return; // builds are deferred until the raid closes
    }
    if (land.afterTurn) {
      this.applyBuilds(land.afterTurn.builds);
      this.applyCounterRaid(land.afterTurn.counterRaid);
    }

    this.refreshHud();
    if (this.core.isWon()) this.opts.onWin?.(this.core.getScore());
  }

  /** Map a land result to a short, punchy banner label (MGO-style). */
  private shortMessage(type: string, fallback: string): string {
    switch (type) {
      case 'property':
        return 'CASH IN!';
      case 'tax':
        return 'LEVY!';
      case 'parking':
        return 'JACKPOT!';
      case 'treasure':
        return 'VAULT!';
      case 'chance':
        return 'FORTUNE!';
      case 'gotojail':
        return 'CUSTOMS!';
      default:
        return fallback.toUpperCase();
    }
  }

  // ── Raid overlay flow ────────────────────────────────────────────────────

  private openRaidOverlay(): void {
    this.showBanner('STEAL!');
    const rivals = this.core.getRivals();
    const rival = rivals[this.core.getRaidRivalIndex()];
    if (!rival) {
      // No rival to raid — close immediately and run deferred systems.
      this.onRaidClosed();
      return;
    }
    this.raid.show(rival, this.core.getShields());
    this.refreshHud(); // dims GO! while the raid is open
  }

  /** Called by the overlay's "tap to continue": close the raid, run deferred
   *  post-turn systems, then resume the loop. */
  private onRaidClosed(): void {
    const after = this.core.closeRaid();
    this.applyBuilds(after.builds);
    this.applyCounterRaid(after.counterRaid);
    this.refreshHud();
    if (this.core.isWon()) this.opts.onWin?.(this.core.getScore());
  }

  private applyCounterRaid(cr: { happened: boolean; shieldUsed: boolean; lostCoins: number }): void {
    if (!cr.happened) return;
    if (cr.shieldUsed) {
      this.showBanner('BLOCKED!');
    } else if (cr.lostCoins > 0) {
      this.showBanner('RAIDED!');
      this.triggerShake(0.3, 5);
    }
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
        this.showBanner('BUILD! WIN!');
        this.emitCoins(0, 28, true);
        this.triggerShake(0.5, 9);
        return;
      }
      const lm = this.landmarks[b.slot];
      if (lm) {
        // Spring the tower up + kick a dust ring + roof sparkle.
        lm.built = true;
        lm.rise.target = 1;
        this.showBanner('BUILD!');
        const lp = lm.container;
        const sx = lp.x * this.world.scale.x + this.world.x;
        const sy = lp.y * this.world.scale.y + this.world.y;
        this.emitDust(sx, sy + 4, 10);
        this.emitCoins(0, 8, true);
      }
    }
  }

  // ── Landmark rise springs ─────────────────────────────────────────────────

  private stepLandmarks(dt: number): void {
    for (const lm of this.landmarks) {
      const v = lm.rise.step(dt);
      lm.container.scale.y = Math.max(0.001, v);
    }
  }

  // ── Camera ─────────────────────────────────────────────────────────────────

  /** Board projected bounding extents (screen px) for the fit zoom. The board is
   *  now an ISO DIAMOND (wider than tall): we take the projected ring's bounding
   *  box and pad by a tile half-footprint (+ block depth on Y) so the outer tile
   *  blocks aren't clipped. */
  private boardExtents(): { w: number; h: number } {
    let maxX = 0;
    let maxY = 0;
    for (const p of this.worldPts) {
      const sp = worldToScreen(p);
      maxX = Math.max(maxX, Math.abs(sp.sx));
      maxY = Math.max(maxY, Math.abs(sp.sy));
    }
    // Corner tiles are ~1.18× — pad generously so blocks + depth + token height
    // stay framed. Y also accounts for standing token / tower height.
    const padX = TILE_W * 0.75;
    const padY = TILE_H * 0.75 + TILE_DEPTH + 90;
    return { w: (maxX + padX) * 2, h: (maxY + padY) * 2 };
  }

  /** The default/idle zoom: show the WHOLE board, framed for this viewport. */
  private targetZoom(): number {
    const ext = this.boardExtents();
    return boardFitZoom(ext.w, ext.h, this.vw, this.vh);
  }

  /**
   * Camera goal = board-fit framing (whole board centered), GENTLY drifted to
   * keep the token comfortably in view during a hop, plus the user's pan offset.
   * Never zooms in tight or hides the board. When the user is dragging/recently
   * dragged, the pan offset dominates and auto-follow is suspended.
   */
  private cameraGoal(): { x: number; y: number; zoom: number } {
    const zoom = this.targetZoom();
    // Board-fit base: the world translation that centers the whole board.
    const fit = cameraTarget({ sx: 0, sy: 0 }, this.vw, this.vh, zoom);
    // The translation that would center the token (for the gentle drift).
    const focus = { sx: this.token.x, sy: this.token.y + 18 };
    const tokenCentered = cameraTarget(focus, this.vw, this.vh, zoom);
    // Suspend gentle-follow while the user is actively panning / just panned.
    const following = this.dragId == null && this.panIdle > 0.35;
    const drifted = following ? gentleFollowTarget(fit, tokenCentered, 60) : fit;
    return {
      x: drifted.x + this.panOffset.x,
      y: drifted.y + this.panOffset.y,
      zoom,
    };
  }

  private stepCamera(dt: number): void {
    // Ease the user pan offset back toward 0 once they've been idle a beat, so
    // the camera settles back to the board-fit framing.
    if (this.dragId == null) {
      this.panIdle += dt;
      if (this.panIdle > 1.2) {
        const k = Math.min(1, dt * 2.2);
        this.panOffset.x += (0 - this.panOffset.x) * k;
        this.panOffset.y += (0 - this.panOffset.y) * k;
        if (Math.abs(this.panOffset.x) < 0.5) this.panOffset.x = 0;
        if (Math.abs(this.panOffset.y) < 0.5) this.panOffset.y = 0;
      }
    }
    const goal = this.cameraGoal();
    this.camX.target = goal.x;
    this.camY.target = goal.y;
    this.camZoom.target = goal.zoom;
    const z = this.camZoom.step(dt);
    this.world.scale.set(z);

    // Screen shake: a decaying jitter added on top of the camera translation.
    let shake = { x: 0, y: 0 };
    if (this.shakeLife > 0) {
      this.shakeLife = Math.max(0, this.shakeLife - dt);
      this.shakeT += dt;
      shake = shakeOffset(this.shakeLife, this.shakeMaxLife, this.shakeMag, this.shakeT);
    }
    this.world.x = this.camX.step(dt) + shake.x;
    this.world.y = this.camY.step(dt) + shake.y;
  }

  private snapCameraToToken(): void {
    // Place the token visually first so the camera goal is correct.
    this.placeTokenAtIndex(this.core.getTokenIndex(), 0);
    // Reset any user pan on a hard re-frame (resume / resize / board complete).
    this.panOffset = { x: 0, y: 0 };
    const goal = this.cameraGoal();
    this.camX.snap(goal.x);
    this.camY.snap(goal.y);
    this.camZoom.snap(goal.zoom);
    this.world.scale.set(goal.zoom);
    this.world.x = goal.x;
    this.world.y = goal.y;
  }

  // ── Particles ────────────────────────────────────────────────────────────

  private stepCoins(dt: number): void {
    const cash = this.cashCounter ? this.cashCounter.glyphScreenPos() : { x: 24, y: 48 };
    for (const c of this.coins) {
      if (c.life <= 0) continue;
      c.life -= dt;
      if (c.toCash) {
        // Home toward the cash counter (coin-shower into the odometer).
        const dx = cash.x - c.gfx.x;
        const dy = cash.y - c.gfx.y;
        const k = Math.min(1, dt * 9);
        c.vx += dx * k * 4;
        c.vy += dy * k * 4;
        c.vx *= 0.86;
        c.vy *= 0.86;
      } else {
        c.vy += 520 * dt;
      }
      c.gfx.x += c.vx * dt;
      c.gfx.y += c.vy * dt;
      c.gfx.rotation += dt * 6;
      c.gfx.alpha = Math.max(0, c.life / c.maxLife);
      if (c.life <= 0) c.gfx.visible = false;
    }
  }

  private stepDust(dt: number): void {
    for (const d of this.dust) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.vy += 30 * dt;
      d.gfx.x += d.vx * dt;
      d.gfx.y += d.vy * dt;
      const k = d.life / d.maxLife;
      d.gfx.alpha = Math.max(0, k * 0.85);
      d.gfx.scale.set(1 + (1 - k) * 0.8);
      if (d.life <= 0) d.gfx.visible = false;
    }
  }
}

/** Resolve a daily seed for the Tycoon Pixi view (exported for the shell). */
export function tycoonDailySeed(): number {
  return dailySeed();
}
