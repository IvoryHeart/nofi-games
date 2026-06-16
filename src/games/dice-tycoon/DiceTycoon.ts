import { GameEngine, GameConfig, GameSnapshot } from '../../engine/GameEngine';
import { registerGame } from '../registry';
import {
  DifficultyConfig,
  DIFFICULTY_CONFIGS,
  MULTIPLIERS,
  applyRegen,
  msUntilNextDie,
  landmarkCosts,
  salaryFor,
  netWorth,
} from './economy';
import {
  BOARD_SIZE,
  Tile,
  TileType,
  BoardTheme,
  generateBoard,
  drawCard,
  Card,
} from './board';
import {
  Rival,
  generateRivals,
  resolveRaid,
  resolveCounterRaid,
} from './rivals';
import {
  AlbumState,
  emptyAlbum,
  grantSticker,
  totalStickersOwned,
} from './stickers';

// ── Constants ────────────────────────────────────────────────────────────────

const BG_COLOR = '#FEF0E4';
const RING_BG = '#E5D5C5';
const BOARD_FELT = '#EFE0CF'; // inner play-surface inside the ring
const TILE_BG = '#FBF1E6';
const TILE_BORDER = '#D4C4B4';
const ACCENT = '#C9883F';
const PRIMARY = '#8B5E83';
const TOKEN_COLOR = '#8B5E83';
const TEXT_DARK = '#3D2B35';
const TEXT_MUTED = '#9B8778';

const HOP_DURATION = 0.09; // seconds per tile hop (~90ms)
const REGEN_CHECK_INTERVAL = 1; // seconds between regen checks (non-daily)
const LANDMARK_RISE_DURATION = 0.45; // seconds for a landmark to rise into place

// Fixed dice budget for Daily Mode (deterministic, no regen).
const DAILY_DICE_BUDGET = 40;

// Tile fill (body) colors by type — warm palette only.
const TILE_COLORS: Record<string, string> = {
  go: '#E8B85C',
  property: '#FBF1E6',
  tax: '#F0DAD2',
  chance: '#FBEBC8',
  treasure: '#E8EFD2',
  railroad: '#EFD9C4',
  jail: '#E6DACB',
  parking: '#DCE9DE',
  gotojail: '#EFD3CB',
};

// Header-band (group) swatch by type — encodes the tile group, warm palette.
const TILE_BANDS: Record<string, string> = {
  go: '#C9883F',
  property: '#8B5E83', // property group band (warm plum)
  tax: '#C97A6E',
  chance: '#D9A441',
  treasure: '#9CAF6A',
  railroad: '#B5784A',
  jail: '#9B8778',
  parking: '#7FA889',
  gotojail: '#B5645A',
};

// Corner accent fills (the 4 big special squares).
const CORNER_FILLS: Record<string, string> = {
  go: '#E8B85C',
  jail: '#D8C4A8',
  parking: '#BFD8C2',
  gotojail: '#E0A89C',
};

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
  // Economy / config
  private cfg: DifficultyConfig = DIFFICULTY_CONFIGS[1];
  private gameActive = false;

  // Board state
  private boardLevel = 1;
  private tiles: Tile[] = [];
  private theme: BoardTheme = { name: '', landmarkNames: [] };
  private tokenIndex = 0;

  // Resources
  private coins = 0;
  private dice = 0;
  private lastRegenAt = 0;
  private shields = 0;
  private multiplierIndex = 0;

  // Landmarks
  private landmarksBuilt = 0; // on the CURRENT board (0..4)
  private totalLandmarks = 0; // cumulative across all boards (for score)
  private landmarkCostList: number[] = [];

  // Rivals & album
  private rivals: Rival[] = [];
  private album: AlbumState = emptyAlbum();

  // Misc state
  private jackpot = 0;
  private skipNextRoll = false;

  // Transient (not all serialized)
  private hopAnim: { remaining: number; progress: number } | null = null;
  private hopsLeft = 0;
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

  // Hit targets (recomputed each render)
  private rollBtn = { x: 0, y: 0, w: 0, h: 0 };
  private multBtn = { x: 0, y: 0, w: 0, h: 0 };
  private buildBtn = { x: 0, y: 0, w: 0, h: 0, enabled: false };
  private vaultRects: Array<{ x: number; y: number; w: number; h: number }> = [];

  constructor(config: GameConfig) {
    super(config);
  }

  private isDaily(): boolean {
    return this.seed != null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  init(): void {
    const diff = Math.min(Math.max(this.difficulty, 0), 3);
    this.cfg = DIFFICULTY_CONFIGS[diff];

    this.computeLayout();

    this.boardLevel = 1;
    const board = generateBoard(this.rng, this.boardLevel);
    this.tiles = board.tiles;
    this.theme = board.theme;
    this.tokenIndex = 0;

    this.coins = this.cfg.startCoins;
    this.dice = this.isDaily() ? DAILY_DICE_BUDGET : this.cfg.startDice;
    this.lastRegenAt = Date.now();
    this.shields = 0;
    this.multiplierIndex = 0;

    this.landmarksBuilt = 0;
    this.totalLandmarks = 0;
    this.landmarkCostList = landmarkCosts(this.boardLevel, this.cfg);

    this.rivals = generateRivals(this.rng, this.boardLevel);
    this.album = emptyAlbum();

    this.jackpot = 0;
    this.skipNextRoll = false;

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

    this.gameActive = true;
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
    // The board is a square sized to fit width and the upper canvas region.
    const maxBoard = Math.min(this.width - 16, available);
    this.ringSize = Math.max(40, maxBoard);
    this.ringX = (this.width - this.ringSize) / 2;
    this.ringY = top + 4;

    // Ring is a Monopoly square: 2 larger corners + 4 regular tiles per edge.
    // edge = 2*corner + 4*cell, with corner = 1.35 * cell  →  edge = 6.7 * cell.
    this.cell = this.ringSize / 6.7;
    this.corner = this.cell * 1.35;
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

    // Dice regen — non-daily only, throttled.
    if (!this.isDaily()) {
      this.regenTimer += dt;
      if (this.regenTimer >= REGEN_CHECK_INTERVAL) {
        this.regenTimer = 0;
        const r = applyRegen(this.dice, this.lastRegenAt, Date.now(), this.cfg);
        this.dice = r.dice;
        this.lastRegenAt = r.lastRegenAt;
      }
    }

    // Token hop animation.
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
    if (!this.canRoll()) {
      if (this.dice < MULTIPLIERS[this.multiplierIndex]) {
        this.flash('Not enough dice');
      }
      return;
    }

    // Spend a die against regen accounting: spending while not full restarts
    // the regen clock if we were at the cap.
    if (!this.isDaily() && this.dice >= this.cfg.diceCap) {
      this.lastRegenAt = Date.now();
    }

    const cost = MULTIPLIERS[this.multiplierIndex];
    this.dice = Math.max(0, this.dice - cost);

    // Jail: skip this roll (the dice were consumed to "post bail"-style turn).
    if (this.skipNextRoll) {
      this.skipNextRoll = false;
      this.flash('Locked up — turn skipped');
      this.updateScore();
      return;
    }

    // Two dice, each 1..6, via this.rng().
    const d1 = 1 + Math.floor(this.rng() * 6);
    const d2 = 1 + Math.floor(this.rng() * 6);
    const steps = d1 + d2;
    this.hopsLeft = steps;
    this.hopAnim = { remaining: steps, progress: 0 };
    this.flash(`Rolled ${d1} + ${d2} = ${steps}`);
    this.playSound('move');
    this.haptic('light');
    this.updateScore();
  }

  /** Move the token one tile forward; pay GO salary on pass/land. */
  private advanceTokenOneStep(): void {
    this.hopsLeft = Math.max(0, this.hopsLeft - 1);
    const next = (this.tokenIndex + 1) % BOARD_SIZE;
    this.tokenIndex = next;
    // Passing or landing on GO (index 0) grants salary.
    if (next === 0) {
      const salary = salaryFor(this.boardLevel, this.cfg);
      this.coins += salary;
      this.flash(`Passed GO! +${salary}`);
      this.coinBurst();
    }
  }

  // ── Tile resolution ────────────────────────────────────────────────────────

  private resolveLandedTile(): void {
    const tile = this.tiles[this.tokenIndex];
    if (!tile) {
      this.afterTurn();
      return;
    }

    const mult = MULTIPLIERS[this.multiplierIndex];

    switch (tile.type) {
      case 'go': {
        // Landing on GO already credited via advanceTokenOneStep; extra bonus.
        const salary = salaryFor(this.boardLevel, this.cfg);
        this.coins += salary;
        this.flash(`On GO! +${salary}`);
        this.coinBurst();
        break;
      }
      case 'property': {
        const earn = Math.round(
          tile.baseValue * mult * this.cfg.payoutMul,
        );
        this.coins += earn;
        this.flash(`${tile.name} +${earn}`);
        this.playSound('score');
        this.coinBurst();
        break;
      }
      case 'tax': {
        const loss = Math.round(tile.baseValue * mult);
        const paid = Math.min(this.coins, loss);
        this.coins = Math.max(0, this.coins - loss);
        this.jackpot += paid;
        this.flash(`Tax -${loss}`);
        break;
      }
      case 'chance': {
        this.applyCard(drawCard(this.rng, 'chance', this.boardLevel));
        break;
      }
      case 'treasure': {
        this.applyCard(drawCard(this.rng, 'treasure', this.boardLevel));
        break;
      }
      case 'railroad': {
        // Open a raid mini-event vs a seeded rival.
        this.openRaid();
        return; // Raid blocks further turn resolution until the player taps a vault.
      }
      case 'jail': {
        this.skipNextRoll = true;
        this.flash('Jailed! Skip next roll');
        break;
      }
      case 'parking': {
        const won = this.jackpot;
        this.coins += won;
        this.jackpot = 0;
        this.flash(`Free Parking! +${won}`);
        if (won > 0) this.coinBurst();
        break;
      }
      case 'gotojail': {
        this.tokenIndex = 5; // jail tile
        this.skipNextRoll = true;
        this.flash('Go to Jail!');
        break;
      }
    }

    this.afterTurn();
  }

  private applyCard(card: Card): void {
    switch (card.kind) {
      case 'coins': {
        if (card.amount >= 0) {
          this.coins += card.amount;
          if (card.amount > 0) this.coinBurst();
        } else {
          this.coins = Math.max(0, this.coins + card.amount);
        }
        break;
      }
      case 'dice': {
        const cap = this.isDaily() ? Number.MAX_SAFE_INTEGER : this.cfg.diceCap;
        this.dice = Math.min(cap, this.dice + Math.max(0, card.amount));
        break;
      }
      case 'shield': {
        this.shields = Math.min(3, this.shields + Math.max(1, card.amount));
        break;
      }
      case 'sticker': {
        this.grantOneSticker();
        break;
      }
      case 'move': {
        // Forced move to a target tile index. Re-resolve that tile (no recursion
        // into another card-draw beyond one hop: we directly settle it).
        const target = Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor(card.amount)));
        this.tokenIndex = target;
        this.flash(card.text);
        // Resolve the destination tile, but guard against re-entrant raid loops:
        // if it's a railroad, open the raid; else settle simply.
        this.settleMoveTile();
        return;
      }
    }
    this.flash(card.text);
  }

  /** Settle a tile reached by a forced 'move' card (no GO salary, no chained cards). */
  private settleMoveTile(): void {
    const tile = this.tiles[this.tokenIndex];
    if (!tile) return;
    const mult = MULTIPLIERS[this.multiplierIndex];
    switch (tile.type) {
      case 'property': {
        const earn = Math.round(tile.baseValue * mult * this.cfg.payoutMul);
        this.coins += earn;
        break;
      }
      case 'tax': {
        const loss = Math.round(tile.baseValue * mult);
        const paid = Math.min(this.coins, loss);
        this.coins = Math.max(0, this.coins - loss);
        this.jackpot += paid;
        break;
      }
      case 'parking': {
        this.coins += this.jackpot;
        this.jackpot = 0;
        break;
      }
      case 'jail':
      case 'gotojail': {
        this.skipNextRoll = true;
        break;
      }
      // chance/treasure/railroad/go reached via a move card resolve as no-op to
      // avoid chained randomness; keeps determinism simple.
    }
  }

  private grantOneSticker(): void {
    const drop = grantSticker(this.rng, this.album);
    if (drop.setCompleted && drop.reward) {
      this.coins += drop.reward.coins;
      const cap = this.isDaily() ? Number.MAX_SAFE_INTEGER : this.cfg.diceCap;
      this.dice = Math.min(cap, this.dice + drop.reward.dice);
      this.flash(`Set complete! +${drop.reward.coins}`);
    } else {
      this.flash(drop.isNew ? 'New sticker!' : 'Duplicate sticker');
    }
  }

  /** Called after a non-raid tile is fully resolved. */
  private afterTurn(): void {
    this.runCounterRaid();
    this.tryAutoBuild();
    this.updateScore();
  }

  private runCounterRaid(): void {
    const result = resolveCounterRaid(
      this.rng,
      this.cfg.rivalAggression,
      this.coins,
      this.shields,
      this.rivals,
    );
    if (!result.happened) return;
    if (result.shieldUsed) {
      this.shields = Math.max(0, this.shields - 1);
      this.flash(`${result.byName} raided — shield blocked!`);
    } else if (result.lostCoins > 0) {
      this.coins = Math.max(0, this.coins - result.lostCoins);
      this.flash(`${result.byName} stole ${result.lostCoins}!`);
      this.haptic('heavy');
    }
  }

  // ── Raid mini-event ────────────────────────────────────────────────────────

  private openRaid(): void {
    if (this.rivals.length === 0) {
      this.afterTurn();
      return;
    }
    // Choose a target rival deterministically from rng.
    const rivalIndex = Math.floor(this.rng() * this.rivals.length) % this.rivals.length;
    this.raid = { rivalIndex, resolved: false, result: null, reveal: 0 };
    this.flash('Heist! Pick a vault');
  }

  private chooseVault(vault: number): void {
    if (!this.raid || this.raid.resolved) return;
    const rival = this.rivals[this.raid.rivalIndex];
    if (!rival) {
      this.raid = null;
      this.afterTurn();
      return;
    }
    const mult = MULTIPLIERS[this.multiplierIndex];
    const result = resolveRaid(this.rng, rival, mult, vault);
    this.raid.result = result;
    this.raid.resolved = true;
    this.raid.reveal = 0; // restart the chosen-vault pop animation
    if (result.blocked) {
      this.flash(`${rival.name} blocked your raid!`);
    } else {
      this.coins += result.stolen;
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
    this.afterTurn();
  }

  // ── Landmarks & board completion ─────────────────────────────────────────

  private nextLandmarkCost(): number | null {
    if (this.landmarksBuilt >= 4) return null;
    return this.landmarkCostList[this.landmarksBuilt] ?? null;
  }

  private tryAutoBuild(): void {
    // Auto-build the next affordable landmark(s) after each turn.
    let guard = 0;
    while (guard++ < 4) {
      const cost = this.nextLandmarkCost();
      if (cost == null) break;
      if (this.coins < cost) break;
      this.buildNextLandmark(cost);
    }
  }

  private buildNextLandmark(cost: number): void {
    this.coins = Math.max(0, this.coins - cost);
    this.landmarksBuilt += 1;
    this.totalLandmarks += 1;
    const name = this.theme.landmarkNames[this.landmarksBuilt - 1] || 'Landmark';
    this.flash(`Built ${name}!`);
    this.playSound('score');
    this.haptic('medium');

    // Celebratory scale-pop + a few particles on the center panel.
    this.panelPop = 0.0001; // > 0 so update() advances it
    // Kick off the just-built landmark's rise-into-place animation.
    const slot = this.landmarksBuilt - 1;
    if (slot >= 0 && slot < this.landmarkRise.length) this.landmarkRise[slot] = 0.0001;
    const cx = this.width / 2;
    const cy = this.ringY + this.ringSize / 2;
    this.spawnBurst(cx, cy, 10, ['#8B5E83', '#E8B85C', '#C9883F']);

    if (this.landmarksBuilt >= 4) {
      this.completeBoard();
    }
  }

  private completeBoard(): void {
    // First completion ever fires the (idempotent) win celebration.
    this.gameWin();

    // Bonus: coins + dice + a guaranteed sticker.
    const bonusCoins = 500 * this.boardLevel;
    this.coins += bonusCoins;
    const cap = this.isDaily() ? Number.MAX_SAFE_INTEGER : this.cfg.diceCap;
    this.dice = Math.min(cap, this.dice + 5);
    this.grantOneSticker();
    this.flash('Board complete!');

    // On-canvas celebration: a bigger burst + the BOARD COMPLETE banner.
    this.bannerTimer = 0.0001; // > 0 so update() advances it
    const cx = this.width / 2;
    const cy = this.ringY + this.ringSize / 2;
    this.spawnBurst(cx, cy, MAX_PARTICLES, ['#8B5E83', '#E8B85C', '#C9883F', '#F0C878']);
    this.playSound('win');
    this.haptic('heavy');

    // Advance to a fresh board (continuable).
    this.boardLevel += 1;
    const board = generateBoard(this.rng, this.boardLevel);
    this.tiles = board.tiles;
    this.theme = board.theme;
    this.tokenIndex = 0;
    this.landmarksBuilt = 0;
    this.landmarkCostList = landmarkCosts(this.boardLevel, this.cfg);
    this.rivals = generateRivals(this.rng, this.boardLevel);
    this.skipNextRoll = false;
    this.landmarkRise = [0, 0, 0, 0];
    this.tokenSquash = 0;
  }

  // ── Score ──────────────────────────────────────────────────────────────────

  private updateScore(): void {
    this.setScore(
      netWorth({
        coins: this.coins,
        landmarksBuilt: this.totalLandmarks,
        boardLevel: this.boardLevel,
        stickers: totalStickersOwned(this.album),
      }),
    );
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
    const cy = this.ringY + this.ringSize / 2;
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
    this.drawRing();
    this.drawToken();
    this.drawCenterPanel();
    this.drawParticles();
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
    const cy = this.ringY + this.ringSize / 2;
    const bw = Math.min(this.width * 0.78, 300);
    const bh = 56;
    this.ctx.globalAlpha = a;
    this.drawRoundRect(cx - bw / 2, cy - bh / 2, bw, bh, 12, PRIMARY, '#FFFFFF');
    this.drawText('BOARD COMPLETE!', cx, cy, { size: 18, color: '#FFFFFF', weight: '800' });
    this.ctx.globalAlpha = 1;
  }

  /**
   * Map a tile index 0..19 to its rectangle on the ring (flat top-down board).
   *
   * Orientation (per P1 spec):
   *   - top edge:    indices 0..5  (left→right), corner 0 = GO (top-left)
   *   - right column:indices 5..10 (top→bottom), corner 5 = JAIL (top-right)
   *   - bottom edge: indices 10..15 (right→left), corner 10 = FREE PARKING (bottom-right)
   *   - left column: indices 15→0  (bottom→top), corner 15 = GO TO JAIL (bottom-left)
   *
   * Corners (0/5/10/15) are larger squares (size = this.corner); the 4 tiles
   * between two corners are regular (the long side = this.cell, thickness = corner).
   */
  private tileRingRect(index: number): { x: number; y: number; w: number; h: number; isCorner: boolean } {
    const n = BOARD_SIZE; // 20
    const i = ((index % n) + n) % n;
    const k = this.corner;
    const c = this.cell;
    const x0 = this.ringX;
    const y0 = this.ringY;
    const right = x0 + this.ringSize - k; // left edge of the right-hand corners
    const bottom = y0 + this.ringSize - k; // top edge of the bottom corners

    // Corners.
    if (i === 0) return { x: x0, y: y0, w: k, h: k, isCorner: true }; // GO (top-left)
    if (i === 5) return { x: right, y: y0, w: k, h: k, isCorner: true }; // JAIL (top-right)
    if (i === 10) return { x: right, y: bottom, w: k, h: k, isCorner: true }; // PARKING (bottom-right)
    if (i === 15) return { x: x0, y: bottom, w: k, h: k, isCorner: true }; // GO TO JAIL (bottom-left)

    if (i < 5) {
      // top edge, left→right: tiles 1..4 between corner 0 and corner 5.
      return { x: x0 + k + (i - 1) * c, y: y0, w: c, h: k, isCorner: false };
    }
    if (i < 10) {
      // right column, top→bottom: tiles 6..9.
      return { x: right, y: y0 + k + (i - 6) * c, w: k, h: c, isCorner: false };
    }
    if (i < 15) {
      // bottom edge, right→left: tiles 11..14.
      return { x: right - (i - 10) * c, y: bottom, w: c, h: k, isCorner: false };
    }
    // left column, bottom→top: tiles 16..19.
    return { x: x0, y: bottom - (i - 15) * c, w: k, h: c, isCorner: false };
  }

  /** Center point of a tile's ring rect. */
  private tileCenter(index: number): { x: number; y: number } {
    const r = this.tileRingRect(index);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  private drawRing(): void {
    // Outer board backing with a soft shadow for depth.
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(61,43,53,0.18)';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetY = 2;
    this.drawRoundRect(this.ringX - 3, this.ringY - 3, this.ringSize + 6, this.ringSize + 6, 10, RING_BG);
    this.ctx.restore();

    // Inner felt (the city plot) — drawn first so tiles sit on top.
    const inset = this.corner;
    const ix = this.ringX + inset;
    const iy = this.ringY + inset;
    const iw = this.ringSize - 2 * inset;
    const ih = this.ringSize - 2 * inset;
    if (iw > 0 && ih > 0) {
      this.drawRoundRect(ix, iy, iw, ih, 6, BOARD_FELT, TILE_BORDER);
    }

    for (let i = 0; i < BOARD_SIZE; i++) {
      const tile = this.tiles[i];
      if (!tile) continue;
      this.drawTile(i, tile);
    }
  }

  /** Draw one ring tile: bevel body, header band (group color), icon, name. */
  private drawTile(index: number, tile: Tile): void {
    const r = this.tileRingRect(index);
    const pad = 1;
    const x = r.x + pad;
    const y = r.y + pad;
    const w = Math.max(2, r.w - pad * 2);
    const h = Math.max(2, r.h - pad * 2);
    const rad = Math.max(2, Math.min(5, w * 0.15));

    if (r.isCorner) {
      this.drawCornerTile(tile, x, y, w, h, rad);
      return;
    }

    const body = TILE_COLORS[tile.type] || TILE_BG;
    // Bevel: a slightly darker drop then the lighter face on top.
    this.drawRoundRect(x, y + 1.5, w, h, rad, '#00000014');
    this.drawRoundRect(x, y, w, h, rad, body, TILE_BORDER);

    // Header band hugging the inner (city-facing) edge of the tile.
    const band = TILE_BANDS[tile.type] || ACCENT;
    const onVertical = h > w; // left/right columns are taller than wide
    const bandThick = Math.max(3, (onVertical ? w : h) * 0.22);
    // Determine which side faces the city center.
    if (!onVertical) {
      // top or bottom edge. Top edge → band at the bottom; bottom edge → top.
      const isTop = r.y < this.ringY + this.ringSize / 2;
      const by = isTop ? y + h - bandThick : y;
      this.drawRoundRect(x, by, w, bandThick, 2, band);
    } else {
      const isLeft = r.x < this.ringX + this.ringSize / 2;
      const bx = isLeft ? x + w - bandThick : x;
      this.drawRoundRect(bx, y, bandThick, h, 2, band);
    }

    // Procedural icon centered, with the short name beneath when there's room.
    const cx = x + w / 2;
    const cy = y + h / 2;
    const iconR = Math.max(4, Math.min(w, h) * 0.22);
    this.drawTileIcon(tile.type, cx, cy - (h > 22 ? h * 0.1 : 0), iconR, band);

    if (Math.min(w, h) >= 18) {
      const label = this.tileName(tile);
      this.drawText(label, cx, y + h - Math.max(5, h * 0.16), {
        size: Math.max(6, Math.min(9, w * 0.16)),
        color: TEXT_DARK,
        weight: '700',
      });
    }
  }

  private drawCornerTile(tile: Tile, x: number, y: number, w: number, h: number, rad: number): void {
    const fill = CORNER_FILLS[tile.type] || ACCENT;
    this.drawRoundRect(x, y + 2, w, h, rad, '#0000001A');
    this.drawRoundRect(x, y, w, h, rad, fill, '#FFFFFF');
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h);
    let icon = '';
    let label = '';
    switch (tile.type) {
      case 'go': icon = '→'; label = 'GO'; break;        // arrow
      case 'jail': icon = '\u{1F512}'; label = 'JAIL'; break; // lock
      case 'parking': icon = '\u{1F17F}'; label = 'FREE'; break; // P
      case 'gotojail': icon = '\u{1F46E}'; label = 'TO JAIL'; break;
      default: label = tile.name;
    }
    if (icon) {
      this.drawText(icon, cx, cy - r * 0.14, { size: r * 0.34, color: TEXT_DARK, weight: '800' });
    }
    this.drawText(label, cx, cy + r * 0.26, { size: Math.max(7, r * 0.16), color: TEXT_DARK, weight: '800' });
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

  /** A small procedural character token (pawn) with hop arc + squash/stretch. */
  private drawToken(): void {
    const drawIndex = this.tokenIndex;
    const cur = this.tileCenter(drawIndex);
    let px = cur.x;
    let py = cur.y;
    let arc = 0; // upward lift during a hop

    if (this.hopAnim) {
      const p = Math.max(0, Math.min(1, this.hopAnim.progress));
      const next = this.tileCenter((drawIndex + 1) % BOARD_SIZE);
      px = this.lerp(cur.x, next.x, this.easeOut(p));
      py = this.lerp(cur.y, next.y, this.easeOut(p));
      arc = Math.sin(p * Math.PI) * this.corner * 0.5; // vertical hop arc
    }

    const base = Math.max(5, this.corner * 0.3);
    // Landing squash/stretch: wide+short right after landing, eases back to round.
    let sx = 1, sy = 1;
    if (this.tokenSquash > 0 && !this.hopAnim) {
      const s = Math.min(1, this.tokenSquash / 0.18);
      const k = (1 - this.easeOut(s)) * 0.35; // 0.35 → 0
      sx = 1 + k;
      sy = 1 - k;
    } else if (arc > 0) {
      // Mid-air stretch (tall+narrow) at the apex.
      const stretch = (arc / (this.corner * 0.5)) * 0.18;
      sx = 1 - stretch;
      sy = 1 + stretch;
    }

    const cy = py - arc;
    // Shadow on the tile (shrinks as the pawn rises).
    const shadowR = base * (1 - arc / (this.corner * 0.7)) * 0.9;
    if (shadowR > 0.5) {
      this.ctx.globalAlpha = 0.22;
      this.drawCircle(px, py + base * 0.55, Math.max(1, shadowR), '#3D2B35');
      this.ctx.globalAlpha = 1;
    }

    // Pawn: a rounded base + head, in the primary color with a highlight.
    this.ctx.save();
    this.ctx.translate(px, cy);
    this.ctx.scale(sx, sy);
    const r = base;
    // Base (rounded trapezoid-ish): a rounded rect.
    this.drawRoundRect(-r * 0.85, r * 0.1, r * 1.7, r * 0.9, r * 0.4, TOKEN_COLOR, '#FFFFFF');
    // Body sphere.
    this.drawCircle(0, -r * 0.15, r * 0.7, TOKEN_COLOR, '#FFFFFF', 1.5);
    // Head.
    this.drawCircle(0, -r * 0.85, r * 0.5, TOKEN_COLOR, '#FFFFFF', 1.5);
    // Highlight.
    this.ctx.globalAlpha = 0.5;
    this.drawCircle(-r * 0.18, -r * 1.0, r * 0.16, '#FFFFFF');
    this.ctx.globalAlpha = 1;
    this.ctx.restore();
  }

  /** The inner city: 4 procedural landmark buildings + build progress / HUD. */
  private drawCenterPanel(): void {
    const inset = this.corner;
    const ix = this.ringX + inset + 4;
    const iy = this.ringY + inset + 4;
    const iw = this.ringSize - 2 * inset - 8;
    const ih = this.ringSize - 2 * inset - 8;
    if (iw <= 0 || ih <= 0) {
      this.buildBtn = { x: 0, y: 0, w: 0, h: 0, enabled: false };
      return;
    }

    // Build-pop: briefly scale the whole city up then settle (eased, dt-driven).
    let popped = false;
    if (this.panelPop > 0) {
      const p = Math.min(1, this.panelPop / 0.4);
      const scale = 1 + Math.sin(this.easeOut(p) * Math.PI) * 0.05;
      const pcx = ix + iw / 2;
      const pcy = iy + ih / 2;
      this.ctx.save();
      this.ctx.translate(pcx, pcy);
      this.ctx.scale(scale, scale);
      this.ctx.translate(-pcx, -pcy);
      popped = true;
    }

    const cx = ix + iw / 2;

    // ── Header: theme + board + progress ──
    this.drawText(`${this.theme.name} · Board ${this.boardLevel}`, cx, iy + ih * 0.06, {
      size: Math.min(11, iw * 0.07), color: ACCENT, weight: '800',
    });
    this.drawText(`${this.landmarksBuilt}/4 built`, cx, iy + ih * 0.13, {
      size: Math.min(9, iw * 0.055), color: TEXT_MUTED, weight: '700',
    });

    // ── Landmark buildings: a 2×2 grid of plots ──
    const gridTop = iy + ih * 0.18;
    const gridH = ih * 0.42;
    const gridW = iw * 0.86;
    const gridX = ix + (iw - gridW) / 2;
    const colW = gridW / 2;
    const rowH = gridH / 2;
    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const plotX = gridX + col * colW;
      const plotY = gridTop + row * rowH;
      this.drawLandmark(i, plotX + colW * 0.08, plotY + rowH * 0.08, colW * 0.84, rowH * 0.84);
    }

    // ── Coins / dice / shields strip ──
    let y = gridTop + gridH + ih * 0.05;
    const lineH = Math.min(15, ih * 0.075);
    this.drawText(`\u{1F4B0} ${this.coins}`, cx, y, {
      size: Math.min(14, iw * 0.095), color: TEXT_DARK, weight: '800',
    });
    y += lineH;
    const diceStr = this.isDaily() ? `\u{1F3B2} ${this.dice}` : `\u{1F3B2} ${this.dice}/${this.cfg.diceCap}`;
    this.drawText(`${diceStr}   \u{1F6E1} ${this.shields}   ⭐ ${totalStickersOwned(this.album)}/12`, cx, y, {
      size: Math.min(10, iw * 0.06), color: TEXT_DARK, weight: '600',
    });
    y += lineH * 0.95;

    // ── Next landmark + Build button ──
    const cost = this.nextLandmarkCost();
    if (cost != null) {
      const name = this.theme.landmarkNames[this.landmarksBuilt] || 'Landmark';
      this.drawText(`Next: ${name} · ${cost}`, cx, y, {
        size: Math.min(9, iw * 0.058), color: TEXT_MUTED, weight: '600',
      });
      y += lineH * 0.85;
      const affordable = this.coins >= cost;
      const bw = iw * 0.62;
      const bh = Math.min(22, lineH * 1.3);
      this.buildBtn = { x: cx - bw / 2, y, w: bw, h: bh, enabled: affordable };
      this.drawRoundRect(this.buildBtn.x, this.buildBtn.y, this.buildBtn.w, this.buildBtn.h,
        6, affordable ? PRIMARY : '#D8C8BC');
      this.drawText(`BUILD ${cost}`, cx, this.buildBtn.y + bh / 2, {
        size: Math.min(11, iw * 0.07), color: '#FFFFFF', weight: '800',
      });
      y += bh + 4;
    } else {
      this.buildBtn = { x: 0, y: 0, w: 0, h: 0, enabled: false };
      this.drawText('City complete!', cx, y, {
        size: Math.min(10, iw * 0.06), color: PRIMARY, weight: '800',
      });
      y += lineH;
    }

    // ── Status message ──
    if (this.messageTimer > 0 && this.message) {
      this.drawText(this.message, cx, Math.min(y, iy + ih - 8), {
        size: Math.min(9, iw * 0.058), color: ACCENT, weight: '700',
      });
    }

    if (popped) this.ctx.restore();

    // Controls live in the strip below the board.
    this.drawControls();
  }

  /** Draw a single landmark plot: built ones solid & risen, unbuilt ones dashed. */
  private drawLandmark(slot: number, x: number, y: number, w: number, h: number): void {
    const built = slot < this.landmarksBuilt;
    const rise = Math.max(0, Math.min(1, this.landmarkRise[slot] || 0));
    const cx = x + w / 2;
    const baseY = y + h; // ground line
    const name = this.theme.landmarkNames[slot] || '';

    // Building silhouette dimensions (vary a little per slot for skyline variety).
    const bw = w * (0.5 + (slot % 2) * 0.08);
    const fullH = h * (0.62 + (slot % 3) * 0.1);
    const bx = cx - bw / 2;

    if (!built) {
      // Faint dashed outline silhouette.
      this.ctx.save();
      this.ctx.setLineDash([3, 3]);
      this.ctx.strokeStyle = 'rgba(139,94,131,0.4)';
      this.ctx.lineWidth = 1.2;
      this.ctx.strokeRect(bx, baseY - fullH, bw, fullH);
      this.ctx.restore();
      if (h >= 24) {
        this.drawText(name, cx, baseY + h * 0.06, {
          size: Math.max(6, Math.min(8, w * 0.14)), color: TEXT_MUTED, weight: '600',
        });
      }
      return;
    }

    // Built: rise from the ground with an ease-out pop.
    const eased = this.easeOut(rise);
    const curH = fullH * eased;
    const by = baseY - curH;
    // Shadow ground patch.
    this.ctx.globalAlpha = 0.18;
    this.drawRoundRect(bx - 2, baseY - 2, bw + 4, 4, 2, '#3D2B35');
    this.ctx.globalAlpha = 1;
    // Body.
    this.drawRoundRect(bx, by, bw, curH, 2, PRIMARY, '#FFFFFF');
    // Lit windows (only once mostly risen, to read as "alive").
    if (eased > 0.6 && curH > 8) {
      const rows = 3, cols = 2;
      const mw = bw / (cols + 1);
      const mh = curH / (rows + 1);
      for (let r = 0; r < rows; r++) {
        for (let cc = 0; cc < cols; cc++) {
          const wx = bx + mw * (cc + 1) - mw * 0.2;
          const wy = by + mh * (r + 1) - mh * 0.2;
          if (mw * 0.4 > 0.5 && mh * 0.4 > 0.5) {
            this.drawRoundRect(wx, wy, mw * 0.4, mh * 0.4, 0.5, '#FFE9A8');
          }
        }
      }
    }
    // Roof cap accent.
    this.drawRoundRect(bx - 1, by - 2, bw + 2, 3, 1, ACCENT);
    if (h >= 24) {
      this.drawText(name, cx, baseY + h * 0.06, {
        size: Math.max(6, Math.min(8, w * 0.14)), color: TEXT_DARK, weight: '700',
      });
    }
  }

  private drawControls(): void {
    const top = this.ringY + this.ringSize + 8;
    const avail = this.height - top - 6;
    if (avail <= 8) {
      // No room — make roll button the whole ring tap (still tappable anywhere).
      this.rollBtn = { x: this.ringX, y: this.ringY, w: this.ringSize, h: this.ringSize };
      this.multBtn = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    const h = Math.min(44, avail);
    const y = top;
    const gap = 8;
    const multW = Math.min(90, this.width * 0.28);
    const rollW = this.width - 16 - multW - gap;

    this.rollBtn = { x: 8, y, w: rollW, h };
    const canRoll = this.canRoll();
    this.drawRoundRect(this.rollBtn.x, this.rollBtn.y, this.rollBtn.w, this.rollBtn.h, 10,
      canRoll ? ACCENT : '#D8C8BC');
    const cost = MULTIPLIERS[this.multiplierIndex];
    this.drawText(cost > 1 ? `ROLL (${cost} dice)` : 'ROLL', this.rollBtn.x + this.rollBtn.w / 2, y + h / 2, {
      size: 15, color: '#FFFFFF', weight: '800',
    });

    this.multBtn = { x: 8 + rollW + gap, y, w: multW, h };
    this.drawRoundRect(this.multBtn.x, this.multBtn.y, this.multBtn.w, this.multBtn.h, 10, PRIMARY);
    this.drawText(`×${MULTIPLIERS[this.multiplierIndex]}`, this.multBtn.x + this.multBtn.w / 2, y + h / 2, {
      size: 16, color: '#FFFFFF', weight: '800',
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
    this.multiplierIndex = (this.multiplierIndex + 1) % MULTIPLIERS.length;
    this.flash(`Multiplier ×${MULTIPLIERS[this.multiplierIndex]}`);
    this.haptic('light');
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

  serialize(): GameSnapshot {
    return {
      boardLevel: this.boardLevel,
      tiles: this.tiles.map((t) => ({ ...t })),
      theme: { name: this.theme.name, landmarkNames: this.theme.landmarkNames.slice() },
      tokenIndex: this.tokenIndex,
      coins: this.coins,
      dice: this.dice,
      lastRegenAt: this.lastRegenAt,
      shields: this.shields,
      multiplierIndex: this.multiplierIndex,
      landmarksBuilt: this.landmarksBuilt,
      totalLandmarks: this.totalLandmarks,
      landmarkCostList: this.landmarkCostList.slice(),
      rivals: this.rivals.map((r) => ({ ...r })),
      album: {
        owned: { ...this.album.owned },
        completedSets: this.album.completedSets.slice(),
      },
      jackpot: this.jackpot,
      skipNextRoll: this.skipNextRoll,
      gameActive: this.gameActive,
    };
  }

  deserialize(state: GameSnapshot): void {
    const tiles = state.tiles as Tile[] | undefined;
    if (!tiles || !Array.isArray(tiles) || tiles.length !== BOARD_SIZE) return;

    this.tiles = tiles.map((t) => ({ ...t }));

    const theme = state.theme as BoardTheme | undefined;
    if (theme && typeof theme.name === 'string' && Array.isArray(theme.landmarkNames)) {
      this.theme = { name: theme.name, landmarkNames: theme.landmarkNames.slice() };
    }

    this.boardLevel = this.num(state.boardLevel, 1, 1);
    this.tokenIndex = Math.max(0, Math.min(BOARD_SIZE - 1, this.num(state.tokenIndex, 0, 0)));
    this.coins = this.num(state.coins, 0, 0);
    this.dice = this.num(state.dice, 0, 0);
    this.lastRegenAt = this.num(state.lastRegenAt, Date.now(), 0);
    this.shields = Math.max(0, Math.min(3, this.num(state.shields, 0, 0)));
    this.multiplierIndex = Math.max(0, Math.min(MULTIPLIERS.length - 1, this.num(state.multiplierIndex, 0, 0)));
    this.landmarksBuilt = Math.max(0, Math.min(4, this.num(state.landmarksBuilt, 0, 0)));
    this.totalLandmarks = this.num(state.totalLandmarks, this.landmarksBuilt, 0);

    const costs = state.landmarkCostList as number[] | undefined;
    this.landmarkCostList = Array.isArray(costs) && costs.length === 4
      ? costs.slice()
      : landmarkCosts(this.boardLevel, this.cfg);

    const rivals = state.rivals as Rival[] | undefined;
    if (Array.isArray(rivals)) {
      this.rivals = rivals.map((r) => ({ ...r }));
    }

    const album = state.album as AlbumState | undefined;
    if (album && typeof album === 'object' && album.owned && typeof album.owned === 'object') {
      this.album = {
        owned: { ...album.owned },
        completedSets: Array.isArray(album.completedSets) ? album.completedSets.slice() : [],
      };
    }

    this.jackpot = this.num(state.jackpot, 0, 0);
    this.skipNextRoll = (state.skipNextRoll as boolean) ?? false;
    this.gameActive = (state.gameActive as boolean) ?? true;

    // Credit elapsed dice regen for time spent away (non-daily only).
    if (!this.isDaily()) {
      const r = applyRegen(this.dice, this.lastRegenAt, Date.now(), this.cfg);
      this.dice = r.dice;
      this.lastRegenAt = r.lastRegenAt;
    }

    // Reset transient animation / raid state.
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

  private num(v: unknown, fallback: number, min: number): number {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    return Math.max(min, n);
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
});

export { DiceTycoonGame };
