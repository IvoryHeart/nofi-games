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
import type { LandResult } from '../../games/dice-tycoon/core/TycoonCore';
import {
  QuickWinState,
  QuickWinEvent,
  QuickWinType,
  QuickWinReward,
  applyEvent as qwApplyEvent,
  claimTask as qwClaimTask,
  claimDailyBonus as qwClaimDailyBonus,
} from '../../games/dice-tycoon/quickWins';
import { BOARD_SIZE, themeNameForLevel } from '../../games/dice-tycoon/board';
import {
  STICKER_SETS,
  SET_REWARD,
  setProgress,
} from '../../games/dice-tycoon/stickers';
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
import { ControlBar, CashCounter } from './chrome';
import { RibbonBanner } from './banner';
import { RaidOverlay } from './raidOverlay';
import { ShutdownOverlay } from './shutdownOverlay';
import { shakeOffset } from './chromeMath';
import { TileBakery } from './art/bake';
import { PENNY_SVG, bakeSvg, spriteFromTexture } from './art/svg';
import { EnvWorld } from './env/EnvWorld';
import { envThemeFor } from './env/envMath';
import type { GraphicsContext, Sprite, Texture } from 'pixi.js';

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
  /** Initial camera framing: 'whole' fits the board (desktop/compact), 'follow'
   *  zooms in on the token (phone). Defaults to 'whole'. */
  framing?: Framing;
  /** Notable game events for the desktop activity feed (payouts/taxes/raids/
   *  builds/board-complete). One event per call; the shell renders + caps. */
  onEvent?: (e: TycoonEvent) => void;
  /** Quick Wins task progress changed (the shell persists + re-renders the
   *  Tasks panel). Fired after applyEvent advances any counter. */
  onQuickWin?: (state: QuickWinState) => void;
}

/** Camera framing mode (mirrors the layout module). */
export type Framing = 'whole' | 'follow';

/** A notable game event surfaced to the activity feed. */
export interface TycoonEvent {
  /** Coarse kind, drives the feed icon/colour. */
  kind: 'payout' | 'tax' | 'raid' | 'build' | 'board' | 'salary' | 'info';
  /** Short human label (already punchy). */
  text: string;
  /** Optional signed coin delta (+earn / −loss). */
  coins?: number;
}

/** One landmark slot in the City/Build view (V4). */
export interface CityLandmark {
  /** Slot index 0..3. */
  slot: number;
  name: string;
  built: boolean;
  /** Build cost (the price to construct this slot), or null when already built. */
  cost: number | null;
  /** Visual tier (1..4) used for the card height/badge. */
  tier: number;
}

/** Read-only state the City/Build view (V4) renders. */
export interface CityState {
  themeName: string;
  boardLevel: number;
  coins: number;
  landmarksBuilt: number;
  /** The 4 landmark slots on the current board. */
  landmarks: CityLandmark[];
  /** Cost of the NEXT buildable landmark, or null when the board is complete. */
  nextCost: number | null;
  /** True when the next landmark is affordable right now. */
  canBuild: boolean;
}

/** One island in the World Map view (V4). */
export interface MapIsland {
  level: number;
  themeName: string;
  /** 'done' (a past board), 'current' (the active board), or 'locked' (ahead). */
  status: 'done' | 'current' | 'locked';
}

/** Read-only state the World Map view (V4) renders. */
export interface MapState {
  boardLevel: number;
  landmarksBuilt: number;
  islands: MapIsland[];
}

/** One sticker cell in the Album view (V4). */
export interface AlbumSticker {
  name: string;
  owned: boolean;
}

/** One set in the Album view (V4). */
export interface AlbumSetView {
  id: string;
  name: string;
  stickers: AlbumSticker[];
  owned: number;
  total: number;
  complete: boolean;
  reward: { coins: number; dice: number };
}

/** Read-only state the Sticker Album view (V4) renders. */
export interface AlbumView {
  totalOwned: number;
  sets: AlbumSetView[];
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

  // Quick Wins daily-tasks state. Owned here (the game feeds events into it);
  // null until the shell injects today's state via setQuickWins(). The shell
  // persists it (storage/quickWins.ts) and renders the Tasks panel.
  private quickWins: QuickWinState | null = null;

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
  private shutdown!: ShutdownOverlay;

  // V2 art bakery: cached gradient/RenderTexture looks for tiles + buildings.
  private bakery: TileBakery | null = null;
  // V3 procedural environment (sky/skyline/water/iso island/props/vignette).
  // screenRoot sits BEHIND the world on the stage; worldRoot sits INSIDE the
  // world container BEHIND the board so it pans + zooms registered with it.
  private env: EnvWorld | null = null;
  private envLevel = -1; // board level the env was last (re)baked for
  // V2 SVG-baked Penny (token). Texture + its source GraphicsContext are GPU
  // resources owned here and destroyed on teardown.
  private pennyTex: Texture | null = null;
  private pennyCtx: GraphicsContext | null = null;
  private pennySprite: Sprite | null = null;

  private tiles: TileSprite[] = [];
  private landmarks: Landmark[] = []; // 4 landmark risers at center
  private worldPts: WorldPoint[] = [];
  private coins: Coin[] = [];
  private dust: Dust[] = [];

  // Camera springs (x, y, zoom).
  private camX = new Spring(0, 90, 16);
  private camY = new Spring(0, 90, 16);
  private camZoom = new Spring(1, 70, 16);

  // Framing mode: 'whole' fits the entire board (desktop/compact), 'follow'
  // zooms in on the token (phone). Drives the camera goal zoom + follow.
  private framing: Framing = 'whole';

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
    this.framing = opts.framing ?? 'whole';

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

    // V3 environment: its screen-space chrome (sky/skyline/clouds/fg/vignette)
    // is added to the stage FIRST so it sits BEHIND the camera world; its
    // world-space ground (water/island/props) is added INSIDE the world BEFORE
    // the board so it pans + zooms with the camera and the board sorts above it.
    this.env = new EnvWorld(app.renderer, this.vw, this.vh, this.boardEnvExtent());
    app.stage.addChild(this.env.screenRoot);
    app.stage.addChild(this.world);
    this.world.addChild(this.env.worldRoot, this.boardLayer, this.tokenLayer);
    app.stage.addChild(this.coinLayer); // screen-space particles above the board
    app.stage.addChild(this.uiLayer);

    // V2: bake every distinct tile/building look ONCE to a RenderTexture (2× DPR)
    // now that the renderer exists. The board then renders cheap shared Sprites.
    this.bakery = new TileBakery(app.renderer);

    this.buildBoard();
    // Build the env world for the current board theme (instant first show).
    this.syncEnvTheme(false);
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
      // V2: free baked RenderTextures + cached gradients + the SVG resources
      // BEFORE the app tears down its GPU context.
      this.bakery?.destroy();
      this.bakery = null;
      // V3: free every env RenderTexture/gradient + remove its listeners BEFORE
      // the GPU context is destroyed (no leak).
      this.env?.destroy();
      this.env = null;
      try {
        this.pennyTex?.destroy(true);
      } catch {
        /* already gone */
      }
      try {
        this.pennyCtx?.destroy();
      } catch {
        /* already gone */
      }
      this.pennyTex = null;
      this.pennyCtx = null;
      this.pennySprite = null;
      app.destroy({ removeView: true }, { children: true });
    } catch {
      /* already torn down */
    }
  }

  getScore(): number {
    return this.core.getScore();
  }

  /** The live Pixi <canvas>, so the shell can re-home it into a new stage cell
   *  on a layout-mode change without tearing down the GPU app. Null pre-init. */
  get canvasEl(): HTMLCanvasElement | null {
    return this.app?.canvas ?? null;
  }

  /** A lightweight read-only snapshot of the game state the DOM rails render.
   *  Polled by the shell on a timer — no per-frame churn. */
  getRailState(): {
    coins: number;
    dice: number;
    shields: number;
    boardLevel: number;
    landmarksBuilt: number;
    nextLandmarkName: string | null;
    nextLandmarkCost: number | null;
    stickersOwned: number;
    themeName: string;
    score: number;
  } {
    const built = this.core.getLandmarksBuilt();
    const names = this.core.getTheme().landmarkNames;
    const nextLandmarkCost = this.core.nextLandmarkCost();
    return {
      coins: this.core.getCoins(),
      dice: this.core.getDice(),
      shields: this.core.getShields(),
      boardLevel: this.core.getBoardLevel(),
      landmarksBuilt: built,
      nextLandmarkName: nextLandmarkCost != null ? (names[built] ?? 'Landmark') : null,
      nextLandmarkCost,
      stickersOwned: this.core.getStickerCount(),
      themeName: this.core.getTheme().name,
      score: this.core.getScore(),
    };
  }

  // ── Quick Wins (daily tasks + streak) ────────────────────────────────────────

  /** Inject today's Quick Wins state (the shell loads/persists it). */
  setQuickWins(state: QuickWinState): void {
    this.quickWins = state;
  }

  /** Current Quick Wins state (the shell's Tasks panel reads this). */
  getQuickWins(): QuickWinState | null {
    return this.quickWins;
  }

  /** Feed one Quick Wins event into today's tasks (advances counters). Fires
   *  onQuickWin when any counter moves so the shell persists + re-renders. */
  private feedQuickWin(event: QuickWinEvent): void {
    if (!this.quickWins) return;
    const before = this.quickWins;
    const after = qwApplyEvent(before, event);
    // Only notify when something actually advanced (cheap reference check on
    // the tasks array — applyEvent returns a fresh object always, so compare
    // progress sums to avoid spurious persists).
    this.quickWins = after;
    if (sumProgress(after.tasks) !== sumProgress(before.tasks)) {
      this.opts.onQuickWin?.(after);
    }
  }

  /** Claim a completed task's reward: grants coins/dice to the live core, then
   *  surfaces a celebration. Returns the granted reward (null if not claimable).
   *  The shell persists the new state + re-renders. */
  claimQuickWinTask(type: QuickWinType): QuickWinReward | null {
    if (!this.quickWins) return null;
    const { state, reward } = qwClaimTask(this.quickWins, type);
    if (!reward) return null;
    this.quickWins = state;
    this.grantQuickWinReward(reward, 'TASK DONE!');
    this.opts.onQuickWin?.(state);
    return reward;
  }

  /** Claim the all-3-complete daily bonus (+ the 7-day grand prize when due).
   *  Grants the rewards to the core, advances the streak, celebrates. Returns
   *  the granted rewards (both null when not claimable). */
  claimQuickWinDailyBonus(): { bonus: QuickWinReward | null; grandPrize: QuickWinReward | null } {
    if (!this.quickWins) return { bonus: null, grandPrize: null };
    const { state, reward, grandPrize } = qwClaimDailyBonus(this.quickWins);
    if (!reward) return { bonus: null, grandPrize: null };
    this.quickWins = state;
    this.grantQuickWinReward(reward, 'DAILY BONUS!');
    if (grandPrize) {
      this.grantQuickWinReward(grandPrize, '7-DAY STREAK!');
    }
    this.opts.onQuickWin?.(state);
    return { bonus: reward, grandPrize };
  }

  /** Apply a Quick Wins reward (coins + dice) to the live core + celebrate with
   *  a coin shower, banner + score refresh. Shared by task/bonus/grand-prize. */
  private grantQuickWinReward(reward: QuickWinReward, banner: string): void {
    if (reward.coins > 0) this.core.setCoins(this.core.getCoins() + reward.coins);
    if (reward.dice > 0) {
      this.core.setDice(Math.min(this.core.diceCap(), this.core.getDice() + reward.dice));
    }
    if (this.app) {
      this.showBanner(banner);
      this.emitCoins(0, Math.min(28, 8 + reward.dice * 2), true);
      this.triggerShake(0.3, 5);
      this.refreshHud(true);
    }
    this.emitEvent('info', `${banner} +${reward.coins} 🪙 +${reward.dice} 🎲`, reward.coins);
  }

  // ── V4 view state (City / Map / Album DOM views) ─────────────────────────────

  /** Read-only snapshot the City/Build view renders. The 4 landmark slots of the
   *  CURRENT board with built/cost/tier. Costs come from the SAME core list the
   *  Pixi auto-build path uses, so the City view and the board agree exactly. */
  getCityState(): CityState {
    const theme = this.core.getTheme();
    const built = this.core.getLandmarksBuilt();
    const costs = this.core.getLandmarkCostList();
    const landmarks: CityLandmark[] = [];
    for (let i = 0; i < 4; i++) {
      const isBuilt = i < built;
      landmarks.push({
        slot: i,
        name: theme.landmarkNames[i] ?? 'Landmark',
        built: isBuilt,
        // Only the NEXT slot is buildable; earlier are built, later are gated
        // behind it (their cost shows for context but the build button targets
        // the next slot, matching the sequential core.build() path).
        cost: isBuilt ? null : (costs[i] ?? null),
        tier: i + 1,
      });
    }
    return {
      themeName: theme.name,
      boardLevel: this.core.getBoardLevel(),
      coins: this.core.getCoins(),
      landmarksBuilt: built,
      landmarks,
      nextCost: this.core.nextLandmarkCost(),
      canBuild: this.core.canBuild(),
    };
  }

  /** Build the next landmark from the City view. Drives the SAME core.build()
   *  path the auto-build uses (coins deduct, progress advances, persists on the
   *  next save), then re-syncs the live board visuals so returning to Play shows
   *  the new landmark (or a freshly generated board on completion). Returns true
   *  if a landmark was built. */
  buildLandmark(): boolean {
    if (!this.core.canBuild()) return false;
    const res = this.core.build();
    if (!res.built) return false;
    this.emitEvent('build', res.name ? `Built ${res.name}` : 'Landmark built');
    this.feedQuickWin({ kind: 'build', builds: 1 }); // Quick Wins: a build
    // Re-sync the Pixi scene + fire the SAME celebration the Play view shows.
    // Polish: a City-view build that completes a board now routes through the
    // shared celebrateBoardComplete() (RibbonBanner "BOARD COMPLETE!" + the
    // dice-bundle burst), so it's no longer silent.
    if (this.app) {
      if (res.boardComplete) {
        this.celebrateBoardComplete(res.boardComplete.bonusDice);
      } else {
        this.rebuildBoard();
        this.celebrateSingleBuild(res.slot);
      }
      this.refreshHud(true);
    }
    return true;
  }

  /** Read-only snapshot the World Map view renders: completed boards, the
   *  current (highlighted) board, and a few upcoming/locked islands. */
  getMapState(): MapState {
    const level = this.core.getBoardLevel();
    const islands: MapIsland[] = [];
    // Show prior boards (done), the current board, and 3 upcoming (locked).
    const lo = Math.max(1, level - 2);
    const hi = level + 3;
    for (let lvl = lo; lvl <= hi; lvl++) {
      islands.push({
        level: lvl,
        themeName: themeNameForLevel(lvl),
        status: lvl < level ? 'done' : lvl === level ? 'current' : 'locked',
      });
    }
    return { boardLevel: level, landmarksBuilt: this.core.getLandmarksBuilt(), islands };
  }

  /** Read-only snapshot the Sticker Album view renders: 3 sets × 4 stickers with
   *  owned/unowned, per-set completion + reward. Read from the live core album. */
  getAlbumView(): AlbumView {
    const album = this.core.getAlbum();
    const sets: AlbumSetView[] = STICKER_SETS.map((set) => {
      const stickers: AlbumSticker[] = set.stickerNames.map((name, i) => ({
        name,
        owned: (album.owned[`${set.id}:${i}`] ?? 0) > 0,
      }));
      const prog = setProgress(album, set.id);
      return {
        id: set.id,
        name: set.name,
        stickers,
        owned: prog.owned,
        total: prog.total,
        complete: album.completedSets.includes(set.id),
        reward: { coins: SET_REWARD.coins, dice: SET_REWARD.dice },
      };
    });
    return { totalOwned: this.core.getStickerCount(), sets };
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
      this.syncEnvTheme(false); // resume may land on a different board theme
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
    // V3: re-frame the sky/vignette/island for the new viewport.
    this.env?.setBoardExtent(this.boardEnvExtent());
    this.env?.resize(this.vw, this.vh);
    // Re-target camera zoom to the new fit (snap so resize doesn't lurch).
    this.snapCameraToToken();
  }

  /** Switch camera framing: 'whole' fits the entire board (desktop/compact);
   *  'follow' zooms in on the token (phone — ~8-10 tiles, drag-pan retained).
   *  Re-uses the existing camera springs / boardFitZoom — no camera rewrite. The
   *  springs ease to the new zoom (no jarring snap) so the toggle reads nicely. */
  setFraming(mode: Framing): void {
    if (this.framing === mode) return;
    this.framing = mode;
    // Drop any user pan so the re-frame is clean, then let the springs ease in
    // via the per-frame cameraGoal() (no hard snap — the toggle should glide).
    this.panOffset = { x: 0, y: 0 };
    this.panIdle = 999;
  }

  /** Current framing mode (the shell's zoom toggle reads + flips this). */
  getFraming(): Framing {
    return this.framing;
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
        // V2: a cheap Sprite of the baked tile texture (anchored centre),
        // positioned at the tile's projected screen point.
        const sprite = this.bakery!.tileSprite(tiles[i], i);
        const sp = worldToScreen(this.worldPts[i]);
        sprite.x = sp.sx;
        sprite.y = sp.sy;
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
    for (let i = 0; i < 4; i++) {
      // V2: a glossy baked building Sprite (per-tier window grid + AO + gloss +
      // rim + tier-3 gold finial), anchored at its base for the scale-Y rise.
      const b = new Container();
      const sprite = this.bakery!.buildingSprite(i);
      b.addChild(sprite);
      // Spread the four buildings so they read as a city cluster.
      b.x = (i - 1.5) * 32;
      b.y = -6 + (i % 2) * 8;
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

    // V2: Penny as a baked SVG sprite (smooth radial-shaded body, gold monocle,
    // green bow tie, coin-slot) — the §B.6 hero upgrade. Baked once at 2× DPR;
    // texture + source context are destroyed on teardown. Falls back to the
    // procedural piggy if SVG baking is unavailable.
    if (this.app && !this.pennyTex) {
      try {
        const baked = bakeSvg(this.app.renderer, PENNY_SVG, 2);
        this.pennyTex = baked.texture;
        this.pennyCtx = baked.context;
      } catch {
        this.pennyTex = null;
      }
    }
    if (this.pennyTex) {
      this.pennySprite = spriteFromTexture(this.pennyTex, 64);
      this.token.addChild(this.pennySprite);
      this.tokenLayer.addChild(this.tokenShadow, this.token);
      this.placeTokenAtIndex(this.core.getTokenIndex(), 0);
      return;
    }

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
      // V2 gold-spark glint dot (top-left), so chips catch the light (mgo2.png).
      g.circle(-cr * 0.4, -cr * 0.4, cr * 0.22).fill({ color: 0xffffff, alpha: 0.9 });
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
      (i) => {
        const res = this.core.chooseVault(i);
        if (res) {
          if (res.blocked) this.emitEvent('raid', 'Heist blocked!');
          else this.emitEvent('raid', 'Vault cracked!', res.stolen);
          // Quick Wins: a resolved heist counts (blocked or not), plus any loot.
          this.feedQuickWin({ kind: 'heist' });
          if (!res.blocked && res.stolen > 0) this.feedQuickWin({ kind: 'earn', coins: res.stolen });
        }
        return res;
      },
      () => this.onRaidClosed(),
      (sx, sy, big) => {
        this.emitCoinsAt(sx, sy, big ? 22 : 8);
        if (big) this.triggerShake(0.42, 7);
      },
    );
    this.shutdown = new ShutdownOverlay(
      (i) => {
        const res = this.core.resolveShutdownTarget(i);
        if (res) {
          if (res.blocked) this.emitEvent('raid', 'Shutdown blocked!');
          else if (res.demolished) this.emitEvent('raid', 'Landmark demolished!', res.payout);
          this.feedQuickWin({ kind: 'heist' });
          if (res.payout > 0) this.feedQuickWin({ kind: 'earn', coins: res.payout });
        }
        return res;
      },
      () => this.onShutdownClosed(),
      (sx, sy, big) => {
        this.emitCoinsAt(sx, sy, big ? 22 : 8);
        if (big) this.triggerShake(0.5, 8);
      },
    );

    this.uiLayer.addChild(
      this.cashCounter.root,
      this.controlBar.root,
      this.banner.root,
      this.raid.root,
      this.shutdown.root,
    );
  }

  private layoutChrome(): void {
    if (!this.controlBar) return;
    this.controlBar.setViewport(this.vw, this.vh);
    this.cashCounter.layout(this.vw, this.vh);
    this.banner.layout(this.vw, this.vh);
    this.raid.setViewport(this.vw, this.vh);
    this.shutdown.setViewport(this.vw, this.vh);
  }

  /** Refresh HUD readouts. `snap` jumps the cash odometer (resume/resize). */
  private refreshHud(snap = false): void {
    if (this.cashCounter) {
      this.cashCounter.setCoins(this.core.getCoins(), snap);
      this.cashCounter.setMeta(this.core.getDice(), this.core.getShields(), this.core.getBoardLevel());
    }
    if (this.controlBar) {
      const canRoll = this.core.canRoll() && !this.rolling && !this.core.isRaidOpen() && !this.core.isShutdownOpen();
      this.controlBar.refresh(this.core.getMultiplierIndex(), this.core.getDice(), canRoll);
    }
    this.opts.onScore?.(this.core.getScore());
    this.opts.onUpdate?.();
  }

  /** Show the red ribbon banner for a big moment. */
  private showBanner(msg: string): void {
    this.banner.show(msg);
  }

  /** Push a notable event to the activity feed (desktop right rail). No-op when
   *  the shell didn't subscribe (phone / compact). */
  private emitEvent(kind: TycoonEvent['kind'], text: string, coins?: number): void {
    this.opts.onEvent?.({ kind, text, coins });
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
    if (this.core.isRaidOpen() || this.core.isShutdownOpen()) return; // overlay owns input while open
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
    if (this.rolling || !this.core.canRoll() || this.core.isRaidOpen() || this.core.isShutdownOpen()) return;
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
    this.feedQuickWin({ kind: 'roll' }); // Quick Wins: a roll counts
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

    // V3 environment: drive parallax from the live camera translation, advance
    // ambient particles + crossfade. EnvWorld pauses its own ambient drift when
    // the tab is hidden (visibilitychange) — particles don't churn off-screen.
    if (this.env) {
      this.env.applyParallax(this.world.x, this.world.y);
      this.env.update(dt);
    }

    // PX3 chrome animation.
    this.controlBar.update(dt);
    this.cashCounter.update(dt);
    this.banner.update(dt);
    this.raid.update(dt);
    this.shutdown.update(dt);

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
        this.emitEvent('salary', `Salary collected`, ev.salary);
        this.feedQuickWin({ kind: 'passGo' });
        this.feedQuickWin({ kind: 'earn', coins: ev.salary });
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
    this.emitLandEvent(land);

    // Quick Wins: count coins earned this turn + a railroad landing.
    if (land.coinDelta > 0) this.feedQuickWin({ kind: 'earn', coins: land.coinDelta });
    if (land.type === 'railroad') this.feedQuickWin({ kind: 'landRailroad' });

    if (land.openedRaid) {
      // PX3: open the rich vault heist overlay; the core is authoritative.
      this.openRaidOverlay();
      return; // builds are deferred until the raid closes
    }
    if (land.openedShutdown) {
      // Open the Shutdown (demolish) overlay; the core is authoritative.
      this.openShutdownOverlay();
      return; // builds are deferred until the shutdown closes
    }
    if (land.afterTurn) {
      this.applyBuilds(land.afterTurn.builds);
      this.applyCounterRaid(land.afterTurn.counterRaid);
    }

    this.refreshHud();
    if (this.core.isWon()) this.opts.onWin?.(this.core.getScore());
  }

  /** Translate a resolved tile into an activity-feed event (desktop right rail). */
  private emitLandEvent(land: LandResult): void {
    if (!this.opts.onEvent) return;
    switch (land.type) {
      case 'property':
        if (land.coinDelta > 0) this.emitEvent('payout', land.message || 'Rent collected', land.coinDelta);
        break;
      case 'go':
      case 'parking':
        if (land.coinDelta > 0) this.emitEvent('payout', land.message || 'Payout', land.coinDelta);
        break;
      case 'tax':
        this.emitEvent('tax', land.message || 'Tax paid', land.coinDelta);
        break;
      case 'chance':
      case 'treasure':
        this.emitEvent(land.coinDelta < 0 ? 'tax' : 'payout', land.message || 'Card drawn', land.coinDelta || undefined);
        break;
      case 'railroad':
        if (land.openedRaid) this.emitEvent('raid', 'Heist! Pick a vault');
        break;
      case 'jail':
      case 'gotojail':
        this.emitEvent('info', land.message || 'Jailed');
        break;
    }
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

  // ── Shutdown overlay flow ────────────────────────────────────────────────

  private openShutdownOverlay(): void {
    this.showBanner('ATTACK!');
    const rivals = this.core.getRivals();
    const rival = rivals[this.core.getShutdownRivalIndex()];
    if (!rival) {
      this.onShutdownClosed();
      return;
    }
    this.shutdown.show(rival);
    this.refreshHud(); // dims GO! while the shutdown is open
  }

  private onShutdownClosed(): void {
    const after = this.core.closeShutdown();
    this.applyBuilds(after.builds);
    this.applyCounterRaid(after.counterRaid);
    this.refreshHud();
    if (this.core.isWon()) this.opts.onWin?.(this.core.getScore());
  }

  private applyCounterRaid(cr: { happened: boolean; shieldUsed: boolean; lostCoins: number }): void {
    if (!cr.happened) return;
    if (cr.shieldUsed) {
      this.showBanner('BLOCKED!');
      this.emitEvent('raid', 'Raid blocked by shield');
    } else if (cr.lostCoins > 0) {
      this.showBanner('RAIDED!');
      this.emitEvent('raid', 'Coins raided!', -cr.lostCoins);
      this.triggerShake(0.3, 5);
    }
  }

  /** Animate any landmark builds (rise the matching slot) + board completion.
   *  Routes through the SHARED celebration helpers so a build from ANY view
   *  (Play auto-build OR the City-view Build button) fires the same FX. */
  private applyBuilds(builds: { built: boolean; slot: number; name?: string; boardComplete: { bonusCoins?: number; bonusDice?: number } | unknown }[]): void {
    for (const b of builds) {
      if (!b.built) continue;
      this.emitEvent('build', b.name ? `Built ${b.name}` : 'Landmark built');
      this.feedQuickWin({ kind: 'build', builds: 1 }); // Quick Wins: a build
      if (b.boardComplete) {
        const bc = (b.boardComplete ?? {}) as { bonusCoins?: number; bonusDice?: number };
        this.celebrateBoardComplete(bc.bonusDice ?? 0);
        return;
      }
      this.celebrateSingleBuild(b.slot);
    }
  }

  /** Shared single-landmark build celebration: rise the tower, dust + coins. */
  private celebrateSingleBuild(slot: number): void {
    const lm = this.landmarks[slot];
    if (!lm) return;
    lm.built = true;
    lm.rise.target = 1;
    this.showBanner('BUILD!');
    const lp = lm.container;
    const sx = lp.x * this.world.scale.x + this.world.x;
    const sy = lp.y * this.world.scale.y + this.world.y;
    this.emitDust(sx, sy + 4, 10);
    this.emitCoins(0, 8, true);
  }

  /** Shared BOARD-COMPLETE celebration: rebuild + re-theme the scene, fire the
   *  RibbonBanner + a DICE-BUNDLE coin burst (scaled by the bonus dice so the
   *  reward reads), shake. Called from BOTH the Play auto-build path AND the
   *  City-view Build button (the silent-City-build polish fix). */
  private celebrateBoardComplete(bonusDice: number): void {
    // New board generated by the core — rebuild the whole scene.
    this.rebuildBoard();
    // V3: re-bake the environment for the new board theme + crossfade.
    this.syncEnvTheme(true);
    this.placeTokenAtIndex(this.core.getTokenIndex(), 0);
    this.snapCameraToToken();
    this.showBanner('BOARD COMPLETE!');
    this.emitEvent('board', `Board ${this.core.getBoardLevel()} complete! +${bonusDice} 🎲`);
    // Dice-bundle reward burst — scale the shower by the bonus dice so the
    // grant is visible (a bigger board → a bigger shower).
    this.emitCoins(0, Math.min(40, 24 + bonusDice * 2), true);
    this.triggerShake(0.5, 9);
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

  /** Half-extent (projected screen px, pre-zoom) of the board footprint the iso
   *  island wraps. The island radius is derived from this in envMath. We use the
   *  larger of the two projected half-extents so the island fully contains the
   *  diamond. */
  private boardEnvExtent(): number {
    const ext = this.boardExtents();
    return Math.max(1, Math.max(ext.w, ext.h) * 0.5);
  }

  /** A stable env seed for the current board (theme + level) so the skyline +
   *  prop scatter are identical across resumes / re-bakes of the same board. */
  private envSeed(): number {
    const name = this.core.getTheme().name || '';
    let h = 0x9e37 ^ this.core.getBoardLevel();
    for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) >>> 0;
    return h >>> 0;
  }

  /** (Re)build the env world for the current board theme. On the first call the
   *  world shows instantly; on a board change it crossfades old→new. Re-baked
   *  once per board (guarded by `envLevel`). */
  private syncEnvTheme(_crossfade: boolean): void {
    if (!this.env) return;
    const level = this.core.getBoardLevel();
    if (level === this.envLevel) return; // already baked for this board
    this.envLevel = level;
    this.env.setBoardExtent(this.boardEnvExtent());
    const theme = envThemeFor(this.core.getTheme().name, level);
    this.env.setTheme(theme, this.envSeed());
  }

  /** The default/idle zoom for the current framing. 'whole' fits the entire
   *  board; 'follow' zooms in tighter (~8-10 tiles around the token) but never
   *  past a 2× of the fit so blocks stay readable. Re-uses boardFitZoom. */
  private targetZoom(): number {
    const ext = this.boardExtents();
    const fit = boardFitZoom(ext.w, ext.h, this.vw, this.vh);
    if (this.framing === 'follow') {
      // Phone framing: bump the fit zoom so on-screen tiles read ~48px+ and the
      // token area shows ~8-10 tiles. Capped so we never zoom in absurdly far on
      // a tiny board / huge viewport.
      return Math.min(fit * 1.85, fit + 0.9);
    }
    return fit;
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
    // The translation that would center the token.
    const focus = { sx: this.token.x, sy: this.token.y + 18 };
    const tokenCentered = cameraTarget(focus, this.vw, this.vh, zoom);
    let base: { x: number; y: number };
    if (this.framing === 'follow') {
      // Phone framing: keep the token centered (token-follow). Drag-pan offsets
      // still apply (and clampPan keeps the board on-screen).
      base = tokenCentered;
    } else {
      // Whole-board framing: fit-centered, gently drifted toward the token while
      // a hop is in flight (suspended while the user is actively panning).
      const following = this.dragId == null && this.panIdle > 0.35;
      base = following ? gentleFollowTarget(fit, tokenCentered, 60) : fit;
    }
    return {
      x: base.x + this.panOffset.x,
      y: base.y + this.panOffset.y,
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

/** Sum of Quick Wins task progress (cheap change-detector for persists). */
function sumProgress(tasks: { progress: number }[]): number {
  let n = 0;
  for (const t of tasks) n += t.progress;
  return n;
}
