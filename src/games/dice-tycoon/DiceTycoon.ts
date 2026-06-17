import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { mulberry32 } from '../../utils/rng';
import { registerGame } from '../registry';
import {
  MULTIPLIERS,
} from './economy';
import {
  BOARD_SIZE,
  Tile,
  TileType,
} from './board';
import {
  Rival,
} from './rivals';
import {
  AlbumState,
} from './stickers';
import { TycoonCore } from './core/TycoonCore';

// ── Constants ────────────────────────────────────────────────────────────────
//
// F3 palette: the richer gold-accented "Monopoly GO" feel from the fidelity doc
// (docs/plans/dice-tycoon-fidelity.md §A). Warm felt background, gold = value,
// plum primary, ink outlines.

const BG_COLOR = '#FBE3CC'; // felt background
const BG_DEEP = '#E9C9A8'; // deeper felt (board surround)
const RING_BG = '#E9C9A8'; // outer board backing
const BOARD_FELT = '#F3DEC4'; // inner play-surface inside the ring
const TILE_BORDER = '#3A2A361F'; // ink outline @ ~12%
const ACCENT = '#F7B500'; // gold hero
const GOLD_HI = '#FFE08A';
const GOLD_SH = '#B97E00';
const PRIMARY = '#8B5E83';
const PRIMARY_DEEP = '#5E3C58';
const INK = '#3A2A36';
const CREAM = '#FFF7EC';
const TEXT_DARK = '#3A2A36';
const TEXT_MUTED = '#8C7768';

const HOP_DURATION = 0.09; // seconds per tile hop (~90ms)
const REGEN_CHECK_INTERVAL = 1; // seconds between regen checks (non-daily)
const LANDMARK_RISE_DURATION = 0.45; // seconds for a landmark to rise into place

// Vertical squash for the shallow 2.5D dimetric look. 1 = flat top-down,
// 0 = fully crushed. ~0.6 reads as "tilted back" yet stays legible at 360px.
// Applied around the board's vertical centre, so it never rotates the ring —
// keeping the top edge x-monotonic / columns y-monotonic (legibility + tests).
const ISO_SQUASH = 0.62;
// Extruded depth (logical px) for tile / building side faces (the 2.5D emboss).
const ISO_DEPTH = 5;

// Tile TOP (face) colors by type — fidelity palette. Plaza properties cycle a
// 6-color band; specials get their group color.
const PLAZA_BANDS = ['#E0566B', '#F2913D', '#F4C233', '#5BB872', '#3FA9C9', '#7E6BD6'];

const TILE_COLORS: Record<string, string> = {
  go: '#FFF7EC',
  property: '#F4C233', // overridden per-property by PLAZA_BANDS
  tax: '#9A3B4E', // Levy
  chance: '#F49B2A', // Fortune
  treasure: '#5E3C58', // Vault
  railroad: '#3A2A36', // Depot/Heist
  jail: '#FFF7EC',
  parking: '#FFF7EC',
  gotojail: '#FFF7EC',
};

// Icon / accent color drawn on each tile type.
const TILE_ICON_COLOR: Record<string, string> = {
  go: '#F7B500',
  property: '#FFFFFF',
  tax: '#FFE2D6',
  chance: '#FFFFFF',
  treasure: '#F7B500',
  railroad: '#F7B500',
  jail: '#8C7768',
  parking: '#5BB872',
  gotojail: '#9A3B4E',
};

// Corner accent fills (the 4 big special squares) — cream + gold.
const CORNER_FILLS: Record<string, string> = {
  go: '#FFF1CC',
  jail: '#FFF7EC',
  parking: '#FFF7EC',
  gotojail: '#FFF7EC',
};

/** Per-property Plaza band color. Uses the tile's color-group `band` when the
 *  board provides it (groups of 2–3 share a color); falls back to the ring index
 *  for legacy tiles without a band. */
function plazaColor(tile: Tile): string {
  const b = typeof tile.band === 'number' ? tile.band : tile.index;
  return PLAZA_BANDS[((b % PLAZA_BANDS.length) + PLAZA_BANDS.length) % PLAZA_BANDS.length];
}

/** Darken a hex color toward black by `amt` (0..1) — for extruded side faces. */
function darken(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const m = (c: number) => Math.max(0, Math.round(c * (1 - amt)));
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(m(r))}${to2(m(g))}${to2(m(b))}`;
}

interface RaidState {
  rivalIndex: number;
  resolved: boolean;
  result: { blocked: boolean; stolen: number; vaultIndex: number } | null;
  reveal: number; // elapsed seconds since resolution (drives the vault pop)
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // remaining seconds
  maxLife: number;
  color: string;
}

const MAX_PARTICLES = 40;
const RAID_REVEAL_DURATION = 0.25; // seconds for the chosen-vault pop
const BANNER_DURATION = 1.5; // seconds for the BOARD COMPLETE banner

// ── Game ─────────────────────────────────────────────────────────────────────

class DiceTycoonGame extends GameEngine {
  // ── Renderer-agnostic logic core (owns ALL game state + rules) ─────────────
  // The canvas view holds a TycoonCore and delegates every rule to it. All the
  // logical state below is exposed via accessor properties that read/write the
  // core, so render() and input handlers (and the test suite) keep their flat
  // field access while the single source of truth lives in the core.
  private core!: TycoonCore;

  // Accessor proxies → core. These keep behaviour byte-identical while routing
  // through the shared logic. (get/set so `this.coins = x` writes the core.)
  private get cfg() { return this.core.getCfg(); }
  private get gameActive() { return this.core.isActive(); }
  private set gameActive(v: boolean) { this.core.setActive(v); }

  private get boardLevel() { return this.core.getBoardLevel(); }
  private set boardLevel(v: number) { this.core.setBoardLevel(v); }
  private get tiles() { return this.core.getTiles(); }
  private set tiles(v: Tile[]) { this.core.setTiles(v); }
  private get theme() { return this.core.getTheme(); }
  private get tokenIndex() { return this.core.getTokenIndex(); }
  private set tokenIndex(v: number) { this.core.setTokenIndex(v); }

  private get coins() { return this.core.getCoins(); }
  private set coins(v: number) { this.core.setCoins(v); }
  private get dice() { return this.core.getDice(); }
  private set dice(v: number) { this.core.setDice(v); }
  private get lastRegenAt() { return this.core.getLastRegenAt(); }
  private set lastRegenAt(v: number) { this.core.setLastRegenAt(v); }
  private get shields() { return this.core.getShields(); }
  private set shields(v: number) { this.core.setShields(v); }
  private get multiplierIndex() { return this.core.getMultiplierIndex(); }
  private set multiplierIndex(v: number) { this.core.setMultiplierIndex(v); }

  private get landmarksBuilt() { return this.core.getLandmarksBuilt(); }
  private set landmarksBuilt(v: number) { this.core.setLandmarksBuilt(v); }
  private get totalLandmarks() { return this.core.getTotalLandmarks(); }
  private set totalLandmarks(v: number) { this.core.setTotalLandmarks(v); }
  private get landmarkCostList() { return this.core.getLandmarkCostList(); }
  private set landmarkCostList(v: number[]) { this.core.setLandmarkCostList(v); }

  private get rivals() { return this.core.getRivals(); }
  private set rivals(v: Rival[]) { this.core.setRivals(v); }
  private get album() { return this.core.getAlbum(); }
  private set album(v: AlbumState) { this.core.setAlbum(v); }

  private get jackpot() { return this.core.getJackpot(); }
  private set jackpot(v: number) { this.core.setJackpot(v); }
  private get skipNextRoll() { return this.core.getSkipNextRoll(); }
  private set skipNextRoll(v: boolean) { this.core.setSkipNextRoll(v); }

  private get lastDie1() { return this.core.getLastDie1(); }
  private set lastDie1(v: number) { this.core.setLastDie1(v); }
  private get lastDie2() { return this.core.getLastDie2(); }
  private set lastDie2(v: number) { this.core.setLastDie2(v); }

  // ── View-only transient state (animations / UI — NOT in the core) ──────────
  private hopAnim: { remaining: number; progress: number } | null = null;
  private hopsLeft = 0; // remaining visual hops in the current roll (view-side)
  private raid: RaidState | null = null;
  private message = '';
  private messageTimer = 0;
  private regenTimer = 0;

  // Transient visual juice (never serialized).
  private particles: Particle[] = [];
  private panelPop = 0; // elapsed seconds of the landmark/build scale-pop (0 = idle)
  private bannerTimer = 0; // elapsed seconds of the BOARD COMPLETE banner (0 = idle)

  // Per-landmark "rise into place" animation progress (0..1). Index = landmark
  // slot. A value < 1 means it is still rising. Purely visual, never serialized.
  private landmarkRise: number[] = [0, 0, 0, 0];
  // Token landing squash/stretch (elapsed seconds since last landing, 0 = idle).
  private tokenSquash = 0;

  // Layout (computed in init)
  private ringX = 0;
  private ringY = 0;
  private ringSize = 0;
  private cell = 0; // regular (non-corner) tile edge length
  private corner = 0; // corner tile edge length (larger)
  private isoCenterY = 0; // vertical anchor for the 2.5D squash projection

  // Hit targets (recomputed each render)
  private rollBtn = { x: 0, y: 0, w: 0, h: 0 };
  private multBtn = { x: 0, y: 0, w: 0, h: 0 };
  private buildBtn = { x: 0, y: 0, w: 0, h: 0, enabled: false };
  private vaultRects: Array<{ x: number; y: number; w: number; h: number }> = [];

  constructor(config: GameConfig) {
    super(config);
    // Construct the logic core eagerly so the accessor proxies (which read the
    // core) are valid even before start()/init() runs. init() re-seeds it with
    // a fresh rng + clock.
    this.core = new TycoonCore({
      rng: this.rng,
      difficulty: this.difficulty,
      seed: this.seed,
      now: Date.now(),
    });
  }

  private isDaily(): boolean {
    return this.core.isDaily();
  }

  /** Live dice cap: board-level-scaled effectiveCap for non-daily play. Daily
   *  mode runs a fixed budget with no cap enforcement. */
  private diceCap(): number {
    return this.core.diceCap();
  }

  /** Counter-raid aggression actually applied. Board 1 is a clean, rival-free
   *  onboarding board (aggression 0); deeper boards use the difficulty knob. */
  private counterRaidAggression(): number {
    return this.core.counterRaidAggression();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  init(): void {
    // Re-seed this.rng from the seed so the core's init() consumes the exact
    // rng sequence the legacy single-init did (the constructor's throwaway core
    // already advanced the shared rng; re-seeding here makes init() canonical
    // and keeps daily-mode determinism byte-identical).
    this.rng = this.seed != null ? mulberry32(this.seed) : Math.random;

    this.core = new TycoonCore({
      rng: this.rng,
      difficulty: this.difficulty,
      seed: this.seed,
      now: Date.now(),
    });

    this.computeLayout();

    // Reset all view-only transient state.
    this.hopAnim = null;
    this.hopsLeft = 0;
    this.raid = null;
    this.message = 'Tap or Space to roll';
    this.messageTimer = 0;
    this.regenTimer = 0;
    this.particles = [];
    this.panelPop = 0;
    this.bannerTimer = 0;
    this.landmarkRise = [0, 0, 0, 0];
    this.tokenSquash = 0;

    this.updateScore();
  }

  /** Sync the landmark-rise visual state with the number actually built.
   *  Built slots snap to fully risen (1); unbuilt stay at 0. Called after
   *  init/deserialize/board-advance so resumed games render without replaying
   *  the rise animation. */
  private syncLandmarkRise(): void {
    for (let i = 0; i < 4; i++) {
      this.landmarkRise[i] = i < this.landmarksBuilt ? 1 : 0;
    }
  }

  private computeLayout(): void {
    const top = 72; // HUD_CLEARANCE
    // Reserve a control strip (~52px) below the board for roll/multiplier.
    const controlStrip = 52;
    const available = this.height - top - controlStrip - 8;

    // The flat board footprint is a square. Its 2.5D projection squashes the
    // vertical extent by ISO_SQUASH, so the *projected* board only occupies
    // ringSize*ISO_SQUASH vertically — meaning we can afford a larger flat
    // footprint than the raw vertical budget (better tile legibility), as long
    // as the squashed height + the building rise headroom still fit.
    //
    // We size the footprint so that footprint*ISO_SQUASH fits the available
    // height, then clamp to the width. Whatever wins keeps the board on-screen
    // at 360px while letting it grow on desktop.
    const byHeight = available / ISO_SQUASH;
    const byWidth = this.width - 12;
    this.ringSize = Math.max(40, Math.min(byWidth, byHeight));
    this.ringX = (this.width - this.ringSize) / 2;

    // Vertically centre the *projected* board within the available band.
    const projH = this.ringSize * ISO_SQUASH;
    this.ringY = top + 4 + Math.max(0, (available - projH) / 2);

    // Ring is a square with 2 larger corners + (BOARD_SIZE/4 - 1) regular tiles
    // per edge. edge = 2*corner + perSide*cell, corner = 1.35*cell.
    // perSide = BOARD_SIZE/4 - 1 (= 9 at N=40)  →  edge = (2*1.35 + perSide)*cell.
    const perSide = BOARD_SIZE / 4 - 1;
    this.cell = this.ringSize / (2 * 1.35 + perSide);
    this.corner = this.cell * 1.35;

    // Pre-compute the projection anchor (vertical centre of the flat board, in
    // logical screen space) used by isoY(). All tile geometry derives from it.
    this.isoCenterY = this.ringY + this.ringSize / 2;
  }

  /** Project a logical board-Y (flat top-down) to its 2.5D screen-Y: squash
   *  toward the board's vertical centre by ISO_SQUASH. X is unchanged (an
   *  oblique/cabinet 2.5D — no rotation, so the ring stays readable & tests'
   *  monotonic edge ordering holds). */
  private isoY(flatY: number): number {
    return this.isoCenterY + (flatY - this.isoCenterY) * ISO_SQUASH;
  }

  /** Re-derive all geometry for a new canvas size (responsive shell drives this
   *  via GameEngine.resizeTo). Logical state — token tile index, coins, dice,
   *  board, rivals — is untouched; only pixel-space layout + cached hit-test
   *  rects are recomputed. The control/build/vault rects are normally rebuilt
   *  every render(), but we clear them here too so any pointer event that lands
   *  between the resize and the next frame hit-tests against fresh geometry
   *  rather than the stale pre-resize rects. */
  protected relayout(): void {
    this.computeLayout();
    this.rollBtn = { x: 0, y: 0, w: 0, h: 0 };
    this.multBtn = { x: 0, y: 0, w: 0, h: 0 };
    this.buildBtn = { x: 0, y: 0, w: 0, h: 0, enabled: false };
    this.vaultRects = [];
  }

  update(dt: number): void {
    if (!this.gameActive) return;

    if (this.messageTimer > 0) {
      this.messageTimer = Math.max(0, this.messageTimer - dt);
    }

    // Visual juice timers (dt-based, never frame counts).
    this.updateParticles(dt);
    if (this.panelPop > 0) {
      this.panelPop = this.panelPop + dt > 0.4 ? 0 : this.panelPop + dt;
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer = this.bannerTimer + dt >= BANNER_DURATION ? 0 : this.bannerTimer + dt;
    }
    if (this.raid && this.raid.resolved && this.raid.reveal < RAID_REVEAL_DURATION) {
      this.raid.reveal = Math.min(RAID_REVEAL_DURATION, this.raid.reveal + dt);
    }

    // Landmark rise: advance any slot that is still rising toward 1.
    for (let i = 0; i < this.landmarkRise.length; i++) {
      if (this.landmarkRise[i] > 0 && this.landmarkRise[i] < 1) {
        this.landmarkRise[i] = Math.min(1, this.landmarkRise[i] + dt / LANDMARK_RISE_DURATION);
      }
    }

    // Token landing squash settles back to neutral over ~0.18s.
    if (this.tokenSquash > 0) {
      this.tokenSquash = this.tokenSquash + dt >= 0.18 ? 0 : this.tokenSquash + dt;
    }

    // Dice regen — non-daily only, throttled. Delegated to the core (which
    // takes the injected clock); daily mode no-regens inside the core.
    if (!this.isDaily()) {
      this.regenTimer += dt;
      if (this.regenTimer >= REGEN_CHECK_INTERVAL) {
        this.regenTimer = 0;
        this.core.tick(Date.now());
      }
    }

    // Token hop animation. The visual hop is view-owned; the per-step logic
    // (salary, token advance) and final tile resolution are delegated to core.
    if (this.hopAnim) {
      this.hopAnim.progress = Math.min(1, this.hopAnim.progress + dt / HOP_DURATION);
      if (this.hopAnim.progress >= 1) {
        this.advanceTokenOneStep();
        this.tokenSquash = 0.0001; // > 0 so update() animates the landing squash
        if (this.hopsLeft > 0) {
          this.hopAnim = { remaining: this.hopsLeft, progress: 0 };
        } else {
          this.hopAnim = null;
          this.resolveLandedTile();
        }
      }
    }
  }

  // ── Rolling ──────────────────────────────────────────────────────────────

  private canRoll(): boolean {
    if (!this.gameActive) return false;
    if (this.hopAnim) return false;
    if (this.raid && !this.raid.resolved) return false;
    const cost = MULTIPLIERS[this.multiplierIndex];
    return this.dice >= cost;
  }

  private roll(): void {
    // View-side gating: block while a hop is in flight or a raid is unresolved
    // (those are view-owned transient states). The core gates on dice/active.
    if (this.hopAnim || (this.raid && !this.raid.resolved)) return;

    const result = this.core.roll(Date.now());
    this.updateScore();

    if (!result.ok) {
      if (result.reason === 'not-enough-dice') {
        this.flash('Not enough dice');
      } else if (result.reason === 'skipped') {
        this.flash('Locked up — turn skipped');
      }
      return;
    }

    // Kick off the visual hop for the rolled total.
    this.hopsLeft = result.steps;
    this.hopAnim = { remaining: result.steps, progress: 0 };
    this.flash(`Rolled ${result.die1} + ${result.die2} = ${result.steps}`);
    this.playSound('move');
    this.haptic('light');
  }

  /** Move the token one tile forward (delegated to core); play GO FX on pass. */
  private advanceTokenOneStep(): void {
    this.hopsLeft = Math.max(0, this.hopsLeft - 1);
    const step = this.core.advanceTokenOneStep();
    if (step.passedGo) {
      this.flash(`Passed GO! +${step.salary}`);
      this.coinBurst();
    }
  }

  // ── Tile resolution ────────────────────────────────────────────────────────

  /** Resolve the landed tile via the core, then drive view FX from the result.
   *  If a raid opened, mirror it into the view-side overlay object. */
  private resolveLandedTile(): void {
    const before = this.coins;
    const res = this.core.resolveLandedTile();

    if (res.openedRaid) {
      // The core opened a raid; mirror into the view overlay for the animation.
      this.raid = {
        rivalIndex: this.core.getRaidRivalIndex(),
        resolved: false,
        result: null,
        reveal: 0,
      };
      this.flash('Heist! Pick a vault');
      this.updateScore();
      return; // Raid blocks turn resolution until the player taps a vault.
    }

    if (res.openedShutdown) {
      // The canvas grid card has no rich Shutdown overlay (that lives in the
      // Pixi tycoon app). Auto-resolve the demolish and animate the result.
      const sd = this.core.resolveShutdownTarget(0);
      const after = this.core.closeShutdown();
      if (sd) {
        if (sd.blocked) this.flash('Shutdown blocked by shield!');
        else if (sd.demolished) {
          this.flash(`Demolished! +${sd.payout}`);
          if (sd.payout > 0) this.coinBurst();
        }
      }
      this.applyAfterTurnFx(after);
      this.updateScore();
      return;
    }

    // Drive the same FX the legacy switch produced, derived from the result.
    if (res.message) this.flash(res.message);
    if (res.type === 'property' && res.coinDelta > 0) this.playSound('score');
    if (res.burst || this.coins > before) this.coinBurst();

    // Post-turn systems already ran inside the core; animate them.
    if (res.afterTurn) this.applyAfterTurnFx(res.afterTurn);
    this.updateScore();
  }

  /** Animate the post-turn systems (counter-raid messaging + auto-build rises /
   *  board-complete celebration). The LOGIC ran in the core; this is FX only. */
  private applyAfterTurnFx(at: { counterRaid: { happened: boolean; shieldUsed: boolean; lostCoins: number; byName: string }; builds: Array<{ built: boolean; slot: number; name: string; boardComplete: { bonusCoins: number; bonusDice: number; nextBoardLevel: number } | null }> }): void {
    const cr = at.counterRaid;
    if (cr.happened) {
      if (cr.shieldUsed) {
        this.flash(`${cr.byName} raided — shield blocked!`);
      } else if (cr.lostCoins > 0) {
        this.flash(`${cr.byName} stole ${cr.lostCoins}!`);
        this.haptic('heavy');
      }
    }
    for (const b of at.builds) {
      if (!b.built) continue;
      this.onLandmarkBuilt(b.slot, b.name, b.boardComplete);
    }
  }

  /** View FX for a single landmark build (+ optional board completion). The
   *  coins/dice/board logic already happened in the core. */
  private onLandmarkBuilt(
    slot: number,
    name: string,
    boardComplete: { bonusCoins: number; bonusDice: number; nextBoardLevel: number } | null,
  ): void {
    if (!boardComplete) {
      this.flash(`Built ${name}!`);
      this.playSound('score');
      this.haptic('medium');
    }
    // Celebratory scale-pop + a few particles on the center panel.
    this.panelPop = 0.0001;
    if (slot >= 0 && slot < this.landmarkRise.length) this.landmarkRise[slot] = 0.0001;
    const cx = this.width / 2;
    const cy = this.isoCenterY;
    this.spawnBurst(cx, cy, 10, ['#8B5E83', '#E8B85C', '#C9883F']);

    if (boardComplete) {
      // First completion ever fires the (idempotent) app-shell win celebration.
      this.gameWin();
      this.flash('Board complete!');
      // On-canvas celebration: a bigger burst + the BOARD COMPLETE banner.
      this.bannerTimer = 0.0001;
      this.spawnBurst(cx, cy, MAX_PARTICLES, ['#8B5E83', '#E8B85C', '#C9883F', '#F0C878']);
      this.playSound('win');
      this.haptic('heavy');
      // The core already advanced to a fresh board; reset view rise/squash.
      this.landmarkRise = [0, 0, 0, 0];
      this.tokenSquash = 0;
    }
  }

  /** Run a counter-raid via the core and emit its FX. Kept as a view method
   *  because tests invoke it directly to assert board-1 rival-free behaviour. */
  private runCounterRaid(): void {
    const cr = this.core.runCounterRaid();
    if (!cr.happened) return;
    if (cr.shieldUsed) {
      this.flash(`${cr.byName} raided — shield blocked!`);
    } else if (cr.lostCoins > 0) {
      this.flash(`${cr.byName} stole ${cr.lostCoins}!`);
      this.haptic('heavy');
    }
  }

  // ── Raid mini-event ────────────────────────────────────────────────────────

  private chooseVault(vault: number): void {
    if (!this.raid || this.raid.resolved) return;
    // Sync the view overlay's target into the core (tests set this.raid
    // directly), then resolve via the core.
    this.core.setRaidState(this.raid.rivalIndex, false, null);
    const rival = this.rivals[this.raid.rivalIndex];
    if (!rival) {
      this.raid = null;
      const at = this.core.closeRaid();
      this.applyAfterTurnFx(at);
      this.updateScore();
      return;
    }
    const result = this.core.chooseVault(vault);
    if (!result) return;
    this.raid.result = result;
    this.raid.resolved = true;
    this.raid.reveal = 0; // restart the chosen-vault pop animation
    if (result.blocked) {
      this.flash(`${rival.name} blocked your raid!`);
    } else {
      this.flash(`Stole ${result.stolen} from ${rival.name}!`);
      this.playSound('score');
      this.haptic('medium');
      if (result.stolen > 0) {
        // Burst over the chosen vault for a satisfying steal.
        const v = this.vaultRects[vault];
        if (v) this.spawnBurst(v.x + v.w / 2, v.y + v.h / 2, 10, ['#E8B85C', '#C9D8A0', '#F0C878']);
        else this.coinBurst();
      }
    }
    this.updateScore();
  }

  private closeRaid(): void {
    this.raid = null;
    const at = this.core.closeRaid();
    this.applyAfterTurnFx(at);
    this.updateScore();
  }

  // ── Landmarks & board completion ─────────────────────────────────────────

  private nextLandmarkCost(): number | null {
    return this.core.nextLandmarkCost();
  }

  /** Build the next landmark via the core, then animate the result. Kept as a
   *  method (not just a core call) because tests invoke it directly. */
  private buildNextLandmark(cost: number): void {
    const result = this.core.buildNextLandmark(cost);
    if (result.built) {
      this.onLandmarkBuilt(result.slot, result.name, result.boardComplete);
    }
  }

  // ── Score ──────────────────────────────────────────────────────────────────

  private updateScore(): void {
    this.setScore(this.core.getScore());
  }

  private flash(msg: string): void {
    this.message = msg;
    this.messageTimer = 2.2;
  }

  // ── Visual juice (transient — never serialized) ─────────────────────────────

  /** Advance particles: drift up under gravity and fade. Dead ones are pruned. */
  private updateParticles(dt: number): void {
    if (this.particles.length === 0) return;
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt; // gentle gravity so the burst arcs back down
    }
    // Prune in-place; cheap and keeps the array bounded.
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  /**
   * Spawn a small coin/celebration burst at (x, y). Colors default to warm gold.
   * Capped at MAX_PARTICLES so the array can never grow unbounded.
   * Uses this.rng() for jitter (daily-mode safe — purely visual).
   */
  private spawnBurst(x: number, y: number, count: number, colors: string[]): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const ang = this.rng() * Math.PI * 2;
      const spd = 40 + this.rng() * 90;
      const life = 0.5 + this.rng() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 80, // bias upward so it floats up first
        life,
        maxLife: life,
        color: colors[Math.floor(this.rng() * colors.length)] || ACCENT,
      });
    }
  }

  /** A coin-gain burst over the center panel — used whenever the player earns coins. */
  private coinBurst(): void {
    const cx = this.width / 2;
    const cy = this.isoCenterY;
    this.spawnBurst(cx, cy, 8, ['#E8B85C', '#C9883F', '#F0C878']);
  }

  private drawParticles(): void {
    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      this.ctx.globalAlpha = a;
      this.drawCircle(p.x, p.y, 3, p.color);
    }
    this.ctx.globalAlpha = 1;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  render(): void {
    this.clear(BG_COLOR);
    this.drawBoardSurround();
    this.drawDepthSorted();
    this.drawCenterHud();
    this.drawParticles();
    this.drawControls();
    if (this.raid) this.drawRaidOverlay();
    if (this.bannerTimer > 0) this.drawBanner();
  }

  /** "BOARD COMPLETE!" banner that eases in and out over BANNER_DURATION. */
  private drawBanner(): void {
    const half = BANNER_DURATION / 2;
    // 0→1 ease in for the first half, 1→0 ease out for the second.
    const t = this.bannerTimer <= half
      ? this.easeOut(this.bannerTimer / half)
      : this.easeOut(Math.max(0, (BANNER_DURATION - this.bannerTimer) / half));
    const a = Math.max(0, Math.min(1, t));
    const cx = this.width / 2;
    const cy = this.isoCenterY;
    const bw = Math.min(this.width * 0.78, 300);
    const bh = 56;
    this.ctx.globalAlpha = a;
    this.drawRoundRect(cx - bw / 2, cy - bh / 2, bw, bh, 12, PRIMARY, GOLD_HI);
    this.drawText('BOARD COMPLETE!', cx, cy, { size: 18, color: GOLD_HI, weight: '800' });
    this.ctx.globalAlpha = 1;
  }

  // ── 2.5D projection helpers ──────────────────────────────────────────────
  //
  // The board keeps a FLAT logical footprint (the square [ringX..+ringSize] ×
  // [ringY..+ringSize]). For the shallow 2.5D look we squash the vertical extent
  // toward the board's vertical centre (isoY). No rotation — an oblique/cabinet
  // 2.5D — so the top edge stays x-monotonic and the side columns y-monotonic
  // (readable at 360px; the engine's hop/edge ordering tests still hold).

  /** Flat (top-down) tile rect — the logical footprint, NOT yet projected.
   *  Corner indices and per-edge offsets derive from BOARD_SIZE: corners at
   *  0/N4/N2/3N4, with (N/4 - 1) regular tiles per edge between them. */
  private flatRingRect(index: number): { x: number; y: number; w: number; h: number; isCorner: boolean } {
    const n = BOARD_SIZE;
    const i = ((index % n) + n) % n;
    const q = n / 4; // tiles per quadrant incl. its leading corner (= 10 at N=40)
    const k = this.corner;
    const c = this.cell;
    const x0 = this.ringX;
    const y0 = this.ringY;
    const right = x0 + this.ringSize - k;
    const bottom = y0 + this.ringSize - k;

    // Corners: 0=GO (top-left), q=JAIL (top-right), 2q=PARKING (bottom-right),
    // 3q=GO TO JAIL (bottom-left).
    if (i === 0) return { x: x0, y: y0, w: k, h: k, isCorner: true };
    if (i === q) return { x: right, y: y0, w: k, h: k, isCorner: true };
    if (i === 2 * q) return { x: right, y: bottom, w: k, h: k, isCorner: true };
    if (i === 3 * q) return { x: x0, y: bottom, w: k, h: k, isCorner: true };

    if (i < q) return { x: x0 + k + (i - 1) * c, y: y0, w: c, h: k, isCorner: false }; // top edge: L→R
    if (i < 2 * q) return { x: right, y: y0 + k + (i - q - 1) * c, w: k, h: c, isCorner: false }; // right edge: T→B
    if (i < 3 * q) return { x: right - (i - 2 * q) * c, y: bottom, w: c, h: k, isCorner: false }; // bottom edge: R→L
    return { x: x0, y: bottom - (i - 3 * q) * c, w: k, h: c, isCorner: false }; // left edge: B→T
  }

  /**
   * Map a tile index 0..19 to its PROJECTED (2.5D) rect on screen. The flat
   * footprint is squashed vertically via isoY(); x and width are unchanged.
   * Corners (0/5/10/15) are larger. Used both for rendering and hit-tests, so
   * tests assert the on-screen geometry directly.
   */
  private tileRingRect(index: number): { x: number; y: number; w: number; h: number; isCorner: boolean } {
    const f = this.flatRingRect(index);
    const top = this.isoY(f.y);
    const bot = this.isoY(f.y + f.h);
    return { x: f.x, y: top, w: f.w, h: bot - top, isCorner: f.isCorner };
  }

  /** Center point of a tile's projected rect. */
  private tileCenter(index: number): { x: number; y: number } {
    const r = this.tileRingRect(index);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  /** True if the tile faces toward the top of the board (top/left half) — used
   *  to keep the city-facing band & label oriented sensibly. */
  private isInnerTop(f: { y: number; h: number }): boolean {
    return f.y + f.h / 2 < this.ringY + this.ringSize / 2;
  }

  private drawBoardSurround(): void {
    // Felt surround under the board (projected square) with a soft drop shadow.
    const topY = this.isoY(this.ringY - 3);
    const botY = this.isoY(this.ringY + this.ringSize + 3);
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(58,42,54,0.22)';
    this.ctx.shadowBlur = 12;
    this.ctx.shadowOffsetY = 4;
    const g = this.ctx.createLinearGradient(0, topY, 0, botY);
    g.addColorStop(0, RING_BG);
    g.addColorStop(1, BG_DEEP);
    this.ctx.fillStyle = g;
    this.ctx.beginPath();
    this.ctx.roundRect(this.ringX - 4, topY, this.ringSize + 8, botY - topY, 12);
    this.ctx.fill();
    this.ctx.restore();

    // Inner felt plot (city ground) inside the ring.
    const inset = this.corner;
    const ix = this.ringX + inset;
    const iw = this.ringSize - 2 * inset;
    const iyTop = this.isoY(this.ringY + inset);
    const iyBot = this.isoY(this.ringY + this.ringSize - inset);
    if (iw > 0 && iyBot - iyTop > 0) {
      this.drawRoundRect(ix, iyTop, iw, iyBot - iyTop, 6, BOARD_FELT, TILE_BORDER);
    }
  }

  /**
   * Depth-sort + draw every board element (tiles, risen buildings, token)
   * back-to-front by their flat ground-Y, so closer (lower-on-screen) elements
   * overlap farther ones correctly in the 2.5D scene.
   */
  private drawDepthSorted(): void {
    type Item = { sort: number; draw: () => void };
    const items: Item[] = [];

    // Tiles: sort by the flat bottom edge (ground line).
    for (let i = 0; i < BOARD_SIZE; i++) {
      const tile = this.tiles[i];
      if (!tile) continue;
      const f = this.flatRingRect(i);
      items.push({ sort: f.y + f.h, draw: () => this.drawTile(i, tile, f) });
    }

    // Buildings live in the inner plot; sort by their ground row.
    const plots = this.landmarkPlots();
    for (let s = 0; s < plots.length; s++) {
      const p = plots[s];
      items.push({ sort: p.groundFlatY, draw: () => this.drawLandmark(s, p) });
    }

    // Token: sort by its current flat tile bottom (+ a hair so it sits above its tile).
    const tf = this.flatRingRect(this.tokenIndex);
    items.push({ sort: tf.y + tf.h + 0.5, draw: () => this.drawToken() });

    items.sort((a, b) => a.sort - b.sort);
    for (const it of items) it.draw();
  }

  /** Draw one ring tile as a 2.5D parallelogram with an extruded depth edge. */
  private drawTile(index: number, tile: Tile, f: { x: number; y: number; w: number; h: number; isCorner: boolean }): void {
    const pad = 0.75;
    const x = f.x + pad;
    const fw = Math.max(2, f.w - pad * 2);
    const topY = this.isoY(f.y) + pad;
    const botY = this.isoY(f.y + f.h) - pad;
    const fh = Math.max(2, botY - topY);
    const rad = Math.max(1.5, Math.min(4, fw * 0.14));
    const depth = Math.max(2, Math.min(ISO_DEPTH, fh * 0.5));

    if (f.isCorner) {
      this.drawCornerTile(tile, x, topY, fw, fh, rad, depth);
      return;
    }

    const isProp = tile.type === 'property';
    const body = isProp ? plazaColor(tile) : (TILE_COLORS[tile.type] || CREAM);

    // Extruded side face (darker) below the top, for the embossed look.
    this.ctx.fillStyle = darken(body, 0.32);
    this.ctx.beginPath();
    this.ctx.roundRect(x, topY + depth, fw, fh, rad);
    this.ctx.fill();

    // Top face.
    this.drawRoundRect(x, topY, fw, fh, rad, body, TILE_BORDER);
    // Glossy specular on the top.
    this.ctx.globalAlpha = 0.18;
    this.drawRoundRect(x + fw * 0.12, topY + fh * 0.12, fw * 0.76, fh * 0.3, rad * 0.6, '#FFFFFF');
    this.ctx.globalAlpha = 1;

    // City-facing color band (a thin gold/ink edge) on the inner side.
    const innerTop = this.isInnerTop(f);
    const bandT = Math.max(2, fh * 0.16);
    this.drawRoundRect(x, innerTop ? topY + fh - bandT : topY, fw, bandT, 1.5, darken(body, 0.18));

    // Procedural icon + (room permitting) short name.
    const cx = x + fw / 2;
    const cy = topY + fh / 2;
    const iconR = Math.max(3, Math.min(fw, fh) * 0.24);
    const iconColor = TILE_ICON_COLOR[tile.type] || INK;
    this.drawTileIcon(tile.type, cx, cy - (fh > 20 ? fh * 0.08 : 0), iconR, iconColor);

    // Names only when tiles are large enough to stay legible (drop on 360px).
    if (Math.min(fw, fh) >= 22 && fh > 18) {
      const dark = body === '#FFF7EC' || isProp;
      this.drawText(this.tileName(tile), cx, topY + fh - Math.max(5, fh * 0.14), {
        size: Math.max(6, Math.min(8, fw * 0.15)),
        color: dark && !isProp ? TEXT_DARK : '#FFFFFF',
        weight: '700',
      });
    }
  }

  private drawCornerTile(tile: Tile, x: number, y: number, w: number, h: number, rad: number, depth: number): void {
    const fill = CORNER_FILLS[tile.type] || CREAM;
    // Extruded base.
    this.ctx.fillStyle = darken(fill, 0.28);
    this.ctx.beginPath();
    this.ctx.roundRect(x, y + depth, w, h, rad);
    this.ctx.fill();
    // Top face with a gold rim.
    this.drawRoundRect(x, y, w, h, rad, fill, ACCENT);
    this.ctx.globalAlpha = 0.16;
    this.drawRoundRect(x + w * 0.12, y + h * 0.1, w * 0.76, h * 0.28, rad * 0.6, '#FFFFFF');
    this.ctx.globalAlpha = 1;

    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h);
    let icon = '';
    let label = '';
    switch (tile.type) {
      case 'go': icon = '→'; label = 'START'; break;
      case 'jail': icon = '\u{1F512}'; label = 'LOCKUP'; break;
      case 'parking': icon = '\u{1F17F}'; label = 'VACATION'; break;
      case 'gotojail': icon = '\u{1F46E}'; label = 'CUSTOMS'; break;
      default: label = tile.name;
    }
    if (icon) {
      this.drawText(icon, cx, cy - r * 0.16, { size: r * 0.32, color: GOLD_SH, weight: '800' });
    }
    if (r >= 24) {
      this.drawText(label, cx, cy + r * 0.26, { size: Math.max(6, r * 0.13), color: TEXT_DARK, weight: '800' });
    }
  }

  /** Small procedural icon per tile type drawn with primitives (no glyph fonts). */
  private drawTileIcon(type: TileType, cx: number, cy: number, r: number, color: string): void {
    switch (type) {
      case 'property': {
        // Little building: body + roof + window.
        const bw = r * 1.4, bh = r * 1.4;
        this.drawRoundRect(cx - bw / 2, cy - bh / 2 + r * 0.2, bw, bh * 0.8, 1.5, color);
        // roof triangle
        this.ctx.beginPath();
        this.ctx.moveTo(cx - bw * 0.6, cy - bh * 0.3);
        this.ctx.lineTo(cx, cy - bh * 0.8);
        this.ctx.lineTo(cx + bw * 0.6, cy - bh * 0.3);
        this.ctx.closePath();
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.drawRoundRect(cx - r * 0.18, cy, r * 0.36, r * 0.4, 1, '#FFFFFFAA');
        break;
      }
      case 'tax': {
        // Coin with a down arrow (money leaving).
        this.drawCircle(cx, cy - r * 0.1, r * 0.62, color, '#FFFFFF', 1.5);
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy + r * 0.2);
        this.ctx.lineTo(cx - r * 0.4, cy + r * 0.7);
        this.ctx.lineTo(cx + r * 0.4, cy + r * 0.7);
        this.ctx.closePath();
        this.ctx.fillStyle = color;
        this.ctx.fill();
        break;
      }
      case 'chance': {
        this.drawCircle(cx, cy, r * 0.78, color);
        this.drawText('?', cx, cy, { size: r * 1.1, color: '#FFFFFF', weight: '800' });
        break;
      }
      case 'treasure': {
        // Chest: lid + body + clasp.
        const bw = r * 1.5, bh = r * 1.1;
        this.drawRoundRect(cx - bw / 2, cy - bh * 0.1, bw, bh * 0.7, 1.5, color);
        this.drawRoundRect(cx - bw / 2, cy - bh * 0.55, bw, bh * 0.5, 2, color);
        this.drawRoundRect(cx - r * 0.12, cy - bh * 0.15, r * 0.24, bh * 0.4, 1, '#FFE9B0');
        break;
      }
      case 'railroad': {
        // Skull/heist marker (current '☠' semantics) — round skull + eyes.
        this.drawCircle(cx, cy - r * 0.1, r * 0.62, color);
        this.drawCircle(cx - r * 0.24, cy - r * 0.15, r * 0.16, '#FBF1E6');
        this.drawCircle(cx + r * 0.24, cy - r * 0.15, r * 0.16, '#FBF1E6');
        this.drawRoundRect(cx - r * 0.3, cy + r * 0.35, r * 0.6, r * 0.22, 1, color);
        break;
      }
      default:
        this.drawCircle(cx, cy, r * 0.5, color);
    }
  }

  private tileName(tile: Tile): string {
    switch (tile.type) {
      case 'railroad': return 'Heist';
      case 'chance': return 'Chance';
      case 'treasure': return 'Trove';
      case 'tax': return 'Tax';
      case 'property': return tile.name.length > 8 ? tile.name.slice(0, 8) : tile.name;
      default: return tile.name;
    }
  }

  /** "Penny" the piggy-bank tycoon token (fidelity §A) with a parabolic hop
   *  arc, squash/stretch landing, and a detaching ground shadow. Positioned via
   *  the 2.5D projection. ~12 path ops + gold rim + one specular highlight. */
  private drawToken(): void {
    const drawIndex = this.tokenIndex;
    const cur = this.tileCenter(drawIndex);
    let px = cur.x;
    let py = cur.y;
    let arc = 0; // upward lift during a hop (screen px)

    if (this.hopAnim) {
      const p = Math.max(0, Math.min(1, this.hopAnim.progress));
      const next = this.tileCenter((drawIndex + 1) % BOARD_SIZE);
      px = this.lerp(cur.x, next.x, this.easeOut(p));
      py = this.lerp(cur.y, next.y, this.easeOut(p));
      arc = Math.sin(p * Math.PI) * this.corner * 0.5; // parabolic arc
    }

    const base = Math.max(6, this.corner * 0.34);
    // Landing squash/stretch: wide+short on landing, eases back to round.
    let sx = 1, sy = 1;
    if (this.tokenSquash > 0 && !this.hopAnim) {
      const s = Math.min(1, this.tokenSquash / 0.18);
      const k = (1 - this.easeOut(s)) * 0.32;
      sx = 1 + k;
      sy = 1 - k;
    } else if (arc > 0) {
      const stretch = (arc / (this.corner * 0.5)) * 0.16;
      sx = 1 - stretch;
      sy = 1 + stretch;
    }

    const cy = py - arc;
    // Detaching ground shadow (shrinks as Penny rises).
    const shadowR = base * (1 - arc / (this.corner * 0.7)) * 0.95;
    if (shadowR > 0.5) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.22;
      this.ctx.translate(px, py + base * 0.5);
      this.ctx.scale(1, ISO_SQUASH);
      this.drawCircle(0, 0, Math.max(1, shadowR), INK);
      this.ctx.restore();
    }

    this.ctx.save();
    this.ctx.translate(px, cy);
    this.ctx.scale(sx, sy);
    const r = base;
    // Round pink body + belly.
    this.drawCircle(0, 0, r, '#F4A6B8', ACCENT, 1.5); // gold rim
    this.drawCircle(0, r * 0.16, r * 0.62, '#FBD3DC');
    // Coin-slot on top (dark ink), instead of a hat.
    this.drawRoundRect(-r * 0.34, -r * 1.02, r * 0.68, r * 0.18, r * 0.08, '#3A2A36');
    // Snout + nostrils.
    this.drawRoundRect(-r * 0.28, r * 0.12, r * 0.56, r * 0.4, r * 0.18, '#F4A6B8', '#D98AA0');
    this.drawCircle(-r * 0.1, r * 0.32, r * 0.06, '#C97A8E');
    this.drawCircle(r * 0.1, r * 0.32, r * 0.06, '#C97A8E');
    // Gold monocle over the right eye.
    this.drawCircle(r * 0.3, -r * 0.18, r * 0.2, 'rgba(255,255,255,0.15)', ACCENT, 2);
    this.drawCircle(-r * 0.28, -r * 0.18, r * 0.07, '#3A2A36'); // left eye
    this.drawCircle(r * 0.3, -r * 0.18, r * 0.07, '#3A2A36'); // right eye
    // Green bow tie.
    this.ctx.fillStyle = '#5BB872';
    this.ctx.beginPath();
    this.ctx.moveTo(0, r * 0.62);
    this.ctx.lineTo(-r * 0.42, r * 0.44);
    this.ctx.lineTo(-r * 0.42, r * 0.82);
    this.ctx.closePath();
    this.ctx.moveTo(0, r * 0.62);
    this.ctx.lineTo(r * 0.42, r * 0.44);
    this.ctx.lineTo(r * 0.42, r * 0.82);
    this.ctx.closePath();
    this.ctx.fill();
    this.drawCircle(0, r * 0.62, r * 0.1, '#3E8F52');
    // Ears.
    this.drawCircle(-r * 0.62, -r * 0.66, r * 0.2, '#F4A6B8');
    this.drawCircle(r * 0.62, -r * 0.66, r * 0.2, '#F4A6B8');
    // One specular highlight.
    this.ctx.globalAlpha = 0.55;
    this.drawCircle(-r * 0.34, -r * 0.42, r * 0.18, '#FFFFFF');
    this.ctx.globalAlpha = 1;
    this.ctx.restore();
  }

  /** Plot geometry for the 4 inner-city landmark buildings (flat ground rows
   *  used both for depth-sort and rendering). A 2×2 arrangement inside the
   *  ring's inner plot; back row first so it sorts behind the front row. */
  private landmarkPlots(): Array<{ cx: number; bw: number; fullH: number; groundFlatY: number; groundScreenY: number }> {
    const inset = this.corner;
    const ix = this.ringX + inset + 4;
    const iw = this.ringSize - 2 * inset - 8;
    const flatTop = this.ringY + inset + 4;
    const flatPlot = this.ringSize - 2 * inset - 8;
    const plots: Array<{ cx: number; bw: number; fullH: number; groundFlatY: number; groundScreenY: number }> = [];
    if (iw <= 0 || flatPlot <= 0) return plots;

    // Reserve the upper ~30% of the plot for the HUD text; buildings sit in the
    // lower band so the city reads as a skyline behind the readout.
    const bandTop = flatTop + flatPlot * 0.34;
    const bandH = flatPlot * 0.6;
    const colW = iw / 2;
    const rowH = bandH / 2;
    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const plotCx = ix + colW * (col + 0.5);
      const groundFlatY = bandTop + rowH * (row + 1); // ground line of this plot (flat)
      const bw = colW * (0.42 + (i % 2) * 0.07);
      // Three visual tiers: house → tower → landmark by slot.
      const tierH = [0.7, 0.95, 1.2, 1.05][i] || 1;
      const fullH = rowH * tierH;
      plots.push({
        cx: plotCx,
        bw,
        fullH,
        groundFlatY,
        groundScreenY: this.isoY(groundFlatY),
      });
    }
    return plots;
  }

  /** Draw a single 2.5D landmark building: extruded box + roof, rising on build.
   *  Built = solid & risen; unbuilt = faint footprint outline. */
  private drawLandmark(slot: number, p: { cx: number; bw: number; fullH: number; groundScreenY: number }): void {
    const built = slot < this.landmarksBuilt;
    const rise = Math.max(0, Math.min(1, this.landmarkRise[slot] || 0));
    const baseY = p.groundScreenY;
    const bw = p.bw;
    const bx = p.cx - bw / 2;
    const tier = slot; // 0..3 silhouette variety
    const sideW = Math.max(2, Math.min(6, bw * 0.16)); // extruded side face width

    if (!built) {
      // Faint footprint: a squashed diamond outline on the ground.
      this.ctx.save();
      this.ctx.globalAlpha = 0.5;
      this.ctx.setLineDash([3, 3]);
      this.ctx.strokeStyle = 'rgba(94,60,88,0.5)';
      this.ctx.lineWidth = 1.2;
      const fh = p.fullH * ISO_SQUASH * 0.5;
      this.ctx.strokeRect(bx, baseY - fh, bw, fh);
      this.ctx.restore();
      return;
    }

    const eased = this.easeOut(rise);
    const curH = Math.max(1, p.fullH * eased);
    const topY = baseY - curH;

    // Ground shadow patch (squashed ellipse).
    this.ctx.save();
    this.ctx.globalAlpha = 0.16;
    this.ctx.translate(p.cx, baseY + 1);
    this.ctx.scale(1, ISO_SQUASH);
    this.drawCircle(0, 0, bw * 0.62, INK);
    this.ctx.restore();

    // Extruded right side face (darker plum) for the box depth.
    this.ctx.fillStyle = PRIMARY_DEEP;
    this.ctx.beginPath();
    this.ctx.moveTo(bx + bw, topY);
    this.ctx.lineTo(bx + bw + sideW, topY - sideW * 0.5);
    this.ctx.lineTo(bx + bw + sideW, baseY - sideW * 0.5);
    this.ctx.lineTo(bx + bw, baseY);
    this.ctx.closePath();
    this.ctx.fill();

    // Front face.
    this.drawRoundRect(bx, topY, bw, curH, 2, PRIMARY, TILE_BORDER);

    // Roof: a gold cap whose silhouette varies by tier.
    if (tier % 3 === 2) {
      // Landmark tier: a peaked gold roof.
      this.ctx.fillStyle = ACCENT;
      this.ctx.beginPath();
      this.ctx.moveTo(bx - 1, topY + 1);
      this.ctx.lineTo(p.cx, topY - curH * 0.22);
      this.ctx.lineTo(bx + bw + 1, topY + 1);
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      this.drawRoundRect(bx - 1, topY - 2, bw + 2, 3, 1, ACCENT);
    }

    // Lit windows once mostly risen.
    if (eased > 0.55 && curH > 10) {
      const rows = Math.max(2, Math.round(curH / Math.max(6, bw * 0.5)));
      const cols = 2;
      const mw = bw / (cols + 1);
      const mh = curH / (rows + 1);
      for (let rr = 0; rr < rows; rr++) {
        for (let cc = 0; cc < cols; cc++) {
          const wx = bx + mw * (cc + 1) - mw * 0.2;
          const wy = topY + mh * (rr + 1) - mh * 0.2;
          if (mw * 0.4 > 0.5 && mh * 0.4 > 0.5) {
            this.drawRoundRect(wx, wy, mw * 0.4, mh * 0.4, 0.5, GOLD_HI);
          }
        }
      }
    }
    // Specular sheen down the left edge.
    this.ctx.globalAlpha = 0.16;
    this.drawRoundRect(bx + 1, topY + 1, bw * 0.22, curH - 2, 1, '#FFFFFF');
    this.ctx.globalAlpha = 1;
  }

  /** Center readout (theme, progress, coins/dice/shields, next-landmark + BUILD)
   *  drawn in screen space over the city. Sits in the upper inner band so the
   *  rising skyline shows beneath it. */
  private drawCenterHud(): void {
    const inset = this.corner;
    const ix = this.ringX + inset + 4;
    const iw = this.ringSize - 2 * inset - 8;
    const flatTop = this.ringY + inset + 4;
    const flatPlot = this.ringSize - 2 * inset - 8;
    if (iw <= 0 || flatPlot <= 0) {
      this.buildBtn = { x: 0, y: 0, w: 0, h: 0, enabled: false };
      return;
    }
    const cx = ix + iw / 2;
    const topScreen = this.isoY(flatTop);

    // Header: theme + board + progress.
    this.drawText(`${this.theme.name} · Board ${this.boardLevel}`, cx, topScreen + 9, {
      size: Math.min(11, iw * 0.075), color: GOLD_SH, weight: '800',
    });
    this.drawText(`${this.landmarksBuilt}/4 built`, cx, topScreen + 21, {
      size: Math.min(9, iw * 0.058), color: TEXT_MUTED, weight: '700',
    });

    // Bottom readout block (below the skyline), in screen space.
    const botScreen = this.isoY(flatTop + flatPlot);
    const lineH = Math.min(15, flatPlot * 0.07);
    let y = botScreen - lineH * 3.4;

    this.drawText(`\u{1F4B0} ${this.coins}`, cx, y, {
      size: Math.min(15, iw * 0.1), color: TEXT_DARK, weight: '800',
    });
    y += lineH;
    const diceStr = this.isDaily() ? `\u{1F3B2} ${this.dice}` : `\u{1F3B2} ${this.dice}/${this.diceCap()}`;
    this.drawText(`${diceStr}   \u{1F6E1} ${this.shields}   ⭐ ${this.core.getStickerCount()}/12`, cx, y, {
      size: Math.min(10, iw * 0.062), color: TEXT_DARK, weight: '600',
    });
    y += lineH * 0.95;

    const cost = this.nextLandmarkCost();
    if (cost != null) {
      const name = this.theme.landmarkNames[this.landmarksBuilt] || 'Landmark';
      this.drawText(`Next: ${name} · ${cost}`, cx, y, {
        size: Math.min(9, iw * 0.06), color: TEXT_MUTED, weight: '600',
      });
      y += lineH * 0.85;
      const affordable = this.coins >= cost;
      const bw = iw * 0.62;
      const bh = Math.min(22, lineH * 1.4);
      this.buildBtn = { x: cx - bw / 2, y, w: bw, h: bh, enabled: affordable };
      this.drawGlossyButton(this.buildBtn.x, this.buildBtn.y, bw, bh,
        affordable ? PRIMARY : '#D8C8BC', `BUILD ${cost}`, affordable);
    } else {
      this.buildBtn = { x: 0, y: 0, w: 0, h: 0, enabled: false };
      this.drawText('City complete!', cx, y, {
        size: Math.min(10, iw * 0.062), color: PRIMARY, weight: '800',
      });
    }

    // Status message (just under the board surround).
    if (this.messageTimer > 0 && this.message) {
      this.drawText(this.message, cx, botScreen + 2, {
        size: Math.min(9, iw * 0.06), color: GOLD_SH, weight: '700',
      });
    }
  }

  /** Glossy gradient + bevel + specular pill used by the chrome buttons. */
  private drawGlossyButton(x: number, y: number, w: number, h: number, base: string, label: string, bright: boolean): void {
    if (w <= 0 || h <= 0) return;
    // Drop shadow / bevel base.
    this.drawRoundRect(x, y + 2, w, h, h * 0.32, darken(base, 0.4));
    // Gradient face.
    const g = this.ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, bright ? base : base);
    g.addColorStop(1, darken(base, 0.22));
    this.ctx.fillStyle = g;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, h * 0.32);
    this.ctx.fill();
    // Specular top sheen.
    this.ctx.globalAlpha = 0.28;
    this.drawRoundRect(x + w * 0.06, y + h * 0.12, w * 0.88, h * 0.32, h * 0.2, '#FFFFFF');
    this.ctx.globalAlpha = 1;
    this.drawText(label, x + w / 2, y + h / 2, {
      size: Math.min(15, h * 0.5), color: bright ? '#FFFFFF' : '#9A8A7C', weight: '800',
    });
  }

  /** Bottom control strip: glossy GO! button, tumbling dice, multiplier dial.
   *  Lives in screen space (NOT iso-projected) so it stays easily tappable. */
  private drawControls(): void {
    const top = this.isoY(this.ringY + this.ringSize) + 10;
    const avail = this.height - top - 6;
    if (avail <= 8) {
      // No room — make the whole board a roll tap target.
      this.rollBtn = { x: this.ringX, y: this.ringY, w: this.ringSize, h: this.ringSize };
      this.multBtn = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    const h = Math.min(46, avail);
    const y = top;
    const gap = 8;
    const multW = Math.min(86, this.width * 0.26);
    const diceArea = Math.min(72, this.width * 0.2);
    const rollW = this.width - 16 - multW - diceArea - gap * 2;

    // GO! button (gold glossy when rollable).
    const canRoll = this.canRoll();
    this.rollBtn = { x: 8, y, w: rollW, h };
    const cost = MULTIPLIERS[this.multiplierIndex];
    this.drawGlossyButton(8, y, rollW, h, canRoll ? ACCENT : '#D8C8BC',
      cost > 1 ? `GO! ×${cost}` : 'GO!', canRoll);

    // Tumbling / settled dice cubes next to GO!.
    this.drawDicePair(8 + rollW + gap, y, diceArea, h);

    // Multiplier dial (circular chip, color-coded by affordability).
    this.multBtn = { x: 8 + rollW + gap + diceArea + gap, y, w: multW, h };
    this.drawMultiplierDial(this.multBtn.x, y, multW, h);
  }

  /** Two dice cubes showing the last roll's pips, tumbling while a hop is in
   *  flight and settled on real values otherwise. Procedural pips. */
  private drawDicePair(x: number, y: number, w: number, h: number): void {
    const size = Math.min(h * 0.78, w * 0.42);
    const cy = y + h / 2;
    const tumbling = !!this.hopAnim;
    for (let d = 0; d < 2; d++) {
      const dx = x + w * (d === 0 ? 0.28 : 0.72) - size / 2;
      const dy = cy - size / 2;
      this.ctx.save();
      if (tumbling) {
        // Tumble: small spin + jitter while moving.
        const ang = (this.hopAnim!.progress * (d === 0 ? 6 : -5)) % (Math.PI * 2);
        this.ctx.translate(dx + size / 2, dy + size / 2);
        this.ctx.rotate(ang);
        this.ctx.translate(-(dx + size / 2), -(dy + size / 2));
      }
      this.drawRoundRect(dx, dy, size, size, size * 0.2, CREAM, GOLD_SH);
      // Pips: settled = the actual last roll; tumbling = a shifting face.
      const pips = tumbling
        ? 1 + Math.floor(this.hopAnim!.progress * 6 + d * 3) % 6
        : (d === 0 ? this.lastDie1 : this.lastDie2);
      this.drawDicePips(dx, dy, size, Math.max(1, Math.min(6, pips)));
      this.ctx.restore();
    }
  }

  private drawDicePips(x: number, y: number, s: number, n: number): void {
    const r = Math.max(1, s * 0.09);
    const a = x + s * 0.26, b = x + s * 0.5, c = x + s * 0.74;
    const p = y + s * 0.26, q = y + s * 0.5, u = y + s * 0.74;
    const dots: Array<[number, number]> = [];
    if (n % 2 === 1) dots.push([b, q]);
    if (n >= 2) dots.push([a, p], [c, u]);
    if (n >= 4) dots.push([c, p], [a, u]);
    if (n === 6) dots.push([a, q], [c, q]);
    for (const [dx, dy] of dots) this.drawCircle(dx, dy, r, INK);
  }

  /** Circular multiplier dial chip with an affordability-charged arc sweep. */
  private drawMultiplierDial(x: number, y: number, w: number, h: number): void {
    const r = Math.min(w, h) * 0.46;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const color = this.multiplierChipColor();
    // Base disc + bevel.
    this.drawCircle(cx, cy + 1.5, r, darken(color, 0.4));
    this.drawCircle(cx, cy, r, color, GOLD_HI, 2);
    // Charge arc: fraction of MULTIPLIERS reached.
    const frac = (this.multiplierIndex + 1) / MULTIPLIERS.length;
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.globalAlpha = 0.6;
    this.ctx.lineWidth = Math.max(1.5, r * 0.16);
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r * 0.78, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
    this.drawText(`×${MULTIPLIERS[this.multiplierIndex]}`, cx, cy, {
      size: Math.min(15, r * 0.95), color: '#FFFFFF', weight: '800',
    });
  }

  private drawRaidOverlay(): void {
    if (!this.raid) return;
    // Dim backdrop.
    this.ctx.fillStyle = 'rgba(61, 43, 53, 0.55)';
    this.ctx.fillRect(0, 72, this.width, this.height - 72);

    const rival = this.rivals[this.raid.rivalIndex];
    const cx = this.width / 2;
    const panelY = this.height * 0.32;
    this.drawText('HEIST', cx, panelY - 34, { size: 22, color: '#FFFFFF', weight: '800' });
    // Show the stakes BEFORE picking: target rival's name + their coin pile.
    const stakes = rival ? `Target: ${rival.name} · ${rival.coins} \u{1F4B0}` : 'Target';
    this.drawText(stakes, cx, panelY - 10, { size: 13, color: '#FFE8C8', weight: '700' });

    const vw = Math.min(76, this.width * 0.24);
    const gap = (this.width - vw * 3) / 4;
    const vy = panelY + 14;
    this.vaultRects = [];
    const resolved = this.raid.resolved && this.raid.result;
    const chosenIdx = resolved ? this.raid.result!.vaultIndex : -1;
    // Pop scale for the chosen vault on reveal (eased, dt-driven).
    const popT = resolved ? Math.min(1, this.raid.reveal / RAID_REVEAL_DURATION) : 1;
    const popScale = 1 + Math.sin(this.easeOut(popT) * Math.PI) * 0.18;

    for (let i = 0; i < 3; i++) {
      const x = gap + i * (vw + gap);
      this.vaultRects.push({ x, y: vy, w: vw, h: vw });
      const isChosen = i === chosenIdx;

      let scale = 1;
      if (isChosen) scale = popScale;
      const drawW = vw * scale;
      const drawH = vw * scale;
      const dx = x + (vw - drawW) / 2;
      const dy = vy + (vw - drawH) / 2;

      this.drawRoundRect(dx, dy, drawW, drawH, 10, isChosen ? ACCENT : '#6B4E63', '#FFFFFF');

      const vcx = x + vw / 2;
      const vcy = vy + vw / 2;
      if (!resolved) {
        // Pre-pick: every vault shows '?'.
        this.drawText('?', vcx, vcy, { size: 28, color: '#FFFFFF', weight: '800' });
      } else if (isChosen) {
        // Reveal the outcome ONLY on the chosen vault.
        const r = this.raid.result!;
        if (r.blocked) {
          this.drawText('\u{1F6E1}', vcx, vcy - 8, { size: 26, color: '#FFFFFF', weight: '800' });
          this.drawText('BLOCKED', vcx, vcy + 16, { size: 12, color: '#FFE0E0', weight: '800' });
        } else {
          this.drawText(`+${r.stolen}`, vcx, vcy, {
            size: Math.min(24, vw * 0.36), color: '#FFF1C8', weight: '800',
          });
        }
      } else {
        // Unpicked vaults show a faint dash — never blank.
        this.drawText('–', vcx, vcy, { size: 26, color: 'rgba(255,255,255,0.35)', weight: '700' });
      }
    }

    if (resolved) {
      const r = this.raid.result!;
      const msg = r.blocked ? 'Blocked by shield!' : `Stole ${r.stolen} coins!`;
      this.drawText(msg, cx, vy + vw + 26, { size: 16, color: '#FFFFFF', weight: '800' });
      this.drawText('Tap to continue', cx, vy + vw + 48, { size: 12, color: '#FFE8C8', weight: '600' });
    } else {
      this.drawText('Pick a vault to raid', cx, vy + vw + 24, { size: 13, color: '#FFE8C8', weight: '600' });
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  protected handleKeyDown(key: string, e: KeyboardEvent): void {
    if (!this.gameActive) return;
    if (this.raid) {
      // Number keys pick vaults; any other resolves/continues.
      if (!this.raid.resolved && (key === '1' || key === '2' || key === '3')) {
        e.preventDefault();
        this.chooseVault(parseInt(key, 10) - 1);
      } else if (this.raid.resolved) {
        e.preventDefault();
        this.closeRaid();
      }
      return;
    }
    if (key === ' ' || key === 'Enter') {
      e.preventDefault();
      this.roll();
      return;
    }
    if (key === 'm' || key === 'M') {
      e.preventDefault();
      this.cycleMultiplier();
      return;
    }
    if (key === 'b' || key === 'B') {
      e.preventDefault();
      this.manualBuild();
    }
  }

  private cycleMultiplier(): void {
    const mult = this.core.cycleMultiplier();
    this.flash(`Multiplier ×${mult}`);
    this.haptic('light');
  }

  /** Color for the multiplier chip, generalized for ANY MULTIPLIERS array
   *  (e.g. [1,5,20]) — never hardcodes a tier value:
   *   - dim grey when the selected tier costs more dice than we hold
   *   - plum (PRIMARY) for the MAX tier when affordable (the big swing)
   *   - gold for the base ×1 tier
   *   - green for the affordable middle tiers
   */
  private multiplierChipColor(): string {
    const cost = MULTIPLIERS[this.multiplierIndex];
    if (this.dice < cost) return '#D8C8BC'; // unaffordable → dim
    const isMax = this.multiplierIndex === MULTIPLIERS.length - 1;
    if (isMax) return PRIMARY; // plum for the top multiplier
    if (this.multiplierIndex === 0) return ACCENT; // gold for the base tier
    return '#7FA869'; // green for affordable intermediate tiers
  }

  private manualBuild(): void {
    const cost = this.nextLandmarkCost();
    if (cost != null && this.coins >= cost) {
      this.buildNextLandmark(cost);
      this.updateScore();
    } else {
      this.flash('Cannot build yet');
    }
  }

  protected handlePointerUp(x: number, y: number): void {
    if (!this.gameActive) return;

    // Raid overlay takes priority.
    if (this.raid) {
      if (this.raid.resolved) {
        this.closeRaid();
        return;
      }
      for (let i = 0; i < this.vaultRects.length; i++) {
        const v = this.vaultRects[i];
        if (this.hit(v, x, y)) {
          this.chooseVault(i);
          return;
        }
      }
      return;
    }

    if (this.hit(this.multBtn, x, y)) {
      this.cycleMultiplier();
      return;
    }
    if (this.buildBtn.enabled && this.hit(this.buildBtn, x, y)) {
      this.manualBuild();
      return;
    }
    if (this.hit(this.rollBtn, x, y)) {
      this.roll();
      return;
    }
    // Tap anywhere else also rolls (full-board tap, like Twenty48 swipe area).
    this.roll();
  }

  private hit(r: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
    return r.w > 0 && r.h > 0 && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  getHudStats(): Array<{ label: string; value: string }> {
    return [
      { label: 'Coins', value: String(this.coins) },
      { label: 'Board', value: String(this.boardLevel) },
    ];
  }

  // ── Save / Resume ────────────────────────────────────────────────────────

  /** Byte-compatible with the legacy save shape — produced by the core so the
   *  canvas and Pixi views share one save format. */
  serialize(): GameSnapshot {
    return this.core.serialize();
  }

  deserialize(state: GameSnapshot): void {
    // The core validates defensively and bails on a malformed tiles array,
    // leaving state untouched — same semantics as before.
    const ok = this.core.deserialize(state, Date.now());
    if (!ok) return;

    // Reset view-only transient animation / raid state.
    this.hopAnim = null;
    this.hopsLeft = 0;
    this.raid = null;
    this.regenTimer = 0;
    this.messageTimer = 0;
    this.particles = [];
    this.panelPop = 0;
    this.bannerTimer = 0;
    this.tokenSquash = 0;
    // Resumed games render built landmarks as already-risen (no replay).
    this.syncLandmarkRise();

    this.updateScore();
  }

  canSave(): boolean {
    return this.gameActive && !this.hopAnim && !this.raid && this.bannerTimer <= 0;
  }
}

// ── Registration ──────────────────────────────────────────────────────────

registerGame({
  id: 'dice-tycoon',
  name: 'Dice Tycoon',
  description: 'Roll, build & raid your way around the board',
  icon: '\u{1F3B2}',
  color: '--game-dice-tycoon',
  bgGradient: ['#C9883F', '#E8B85C'],
  category: 'strategy',
  createGame: (config) => new DiceTycoonGame(config),
  canvasWidth: 360,
  canvasHeight: 640,
  controls: 'Tap or Space to roll · M to change multiplier',
  continuableAfterWin: true,
  dailyMode: true,
  // Render derives entirely from this.width/height; relayout() recomputes on
  // resize. Lets the tycoon shell size the canvas to the viewport (portrait
  // on phones, framed ~480px portrait on desktop) and call resizeTo().
  responsive: true,
});

export { DiceTycoonGame };
