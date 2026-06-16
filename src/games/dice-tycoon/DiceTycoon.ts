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
const TILE_BG = '#F5E6D8';
const TILE_BORDER = '#D4C4B4';
const ACCENT = '#C9883F';
const PRIMARY = '#8B5E83';
const TOKEN_COLOR = '#8B5E83';
const TEXT_DARK = '#3D2B35';
const TEXT_MUTED = '#9B8778';

const HOP_DURATION = 0.09; // seconds per tile hop (~90ms)
const REGEN_CHECK_INTERVAL = 1; // seconds between regen checks (non-daily)

// Fixed dice budget for Daily Mode (deterministic, no regen).
const DAILY_DICE_BUDGET = 40;

// Tile fill colors by type — warm palette only.
const TILE_COLORS: Record<string, string> = {
  go: '#E8B85C',
  property: '#F5E6D8',
  tax: '#E0A0A0',
  chance: '#F0C878',
  treasure: '#C9D8A0',
  railroad: '#D8A878',
  jail: '#C8B8A8',
  parking: '#A8C8B8',
  gotojail: '#C89898',
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

  // Layout (computed in init)
  private ringX = 0;
  private ringY = 0;
  private ringSize = 0;
  private cell = 0;

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

    this.gameActive = true;
    this.updateScore();
  }

  private computeLayout(): void {
    const top = 72; // HUD_CLEARANCE
    const available = this.height - top;
    // Reserve the bottom ~38% for the center action panel by sizing the ring
    // to fit width and the upper portion of the canvas.
    const maxRing = Math.min(this.width - 16, available - 8);
    this.ringSize = Math.max(40, maxRing);
    this.ringX = (this.width - this.ringSize) / 2;
    this.ringY = top + 4;
    // 6 tiles per side (corners shared): perimeter cells across one edge = 6.
    this.cell = this.ringSize / 6;
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

  /** Map a tile index 0..19 to its top-left pixel on the ring (6×6 perimeter). */
  private tilePos(index: number): { x: number; y: number } {
    const c = this.cell;
    const n = BOARD_SIZE; // 20
    const i = ((index % n) + n) % n;
    // Perimeter walk: 5 tiles per side between corners → 6 per side counting one corner.
    // Sides: bottom (0..5), left (5..10), top (10..15), right (15..20→0).
    let col = 0;
    let row = 0;
    if (i <= 5) {
      // bottom edge, left→right reversed so GO sits bottom-right going counter? Use bottom-left=GO.
      col = i; // 0..5 across bottom
      row = 5;
    } else if (i <= 10) {
      col = 5;
      row = 5 - (i - 5); // up the right side
    } else if (i <= 15) {
      col = 5 - (i - 10); // across the top right→left
      row = 0;
    } else {
      col = 0;
      row = i - 15; // down the left side
    }
    return { x: this.ringX + col * c, y: this.ringY + row * c };
  }

  private drawRing(): void {
    const c = this.cell;
    // Backing.
    this.drawRoundRect(this.ringX - 2, this.ringY - 2, this.ringSize + 4, this.ringSize + 4, 8, RING_BG);

    for (let i = 0; i < BOARD_SIZE; i++) {
      const tile = this.tiles[i];
      if (!tile) continue;
      const { x, y } = this.tilePos(i);
      const fill = TILE_COLORS[tile.type] || TILE_BG;
      this.drawRoundRect(x + 1, y + 1, c - 2, c - 2, 4, fill, TILE_BORDER);

      // Label — short, fits the cell.
      const label = this.tileShortLabel(tile);
      this.drawText(label, x + c / 2, y + c / 2, {
        size: Math.max(7, Math.min(11, c * 0.22)),
        color: TEXT_DARK,
        weight: '700',
      });
    }
  }

  private tileShortLabel(tile: Tile): string {
    switch (tile.type) {
      case 'go': return 'GO';
      case 'jail': return 'JAIL';
      case 'parking': return 'P';
      case 'gotojail': return '→J';
      case 'railroad': return '☠';
      case 'chance': return '?';
      case 'treasure': return '★';
      case 'tax': return 'TAX';
      case 'property': return tile.name.length > 6 ? tile.name.slice(0, 6) : tile.name;
      default: return '';
    }
  }

  private drawToken(): void {
    const c = this.cell;
    let drawIndex = this.tokenIndex;
    let t = 0;
    if (this.hopAnim) {
      drawIndex = this.tokenIndex;
      t = this.easeOut(this.hopAnim.progress);
    }
    const cur = this.tilePos(drawIndex);
    let px = cur.x + c / 2;
    let py = cur.y + c / 2;
    if (this.hopAnim && t < 1) {
      const next = this.tilePos((drawIndex + 1) % BOARD_SIZE);
      px = this.lerp(cur.x + c / 2, next.x + c / 2, t);
      py = this.lerp(cur.y + c / 2, next.y + c / 2, t);
    }
    this.drawCircle(px, py, Math.max(5, c * 0.28), TOKEN_COLOR, '#FFFFFF', 2);
  }

  private drawCenterPanel(): void {
    const c = this.cell;
    // Inner area of the ring.
    const ix = this.ringX + c + 6;
    const iy = this.ringY + c + 6;
    const iw = this.ringSize - 2 * c - 12;
    const ih = this.ringSize - 2 * c - 12;
    if (iw <= 0 || ih <= 0) return;

    // Landmark build pop: briefly scale the panel up then settle (eased, dt-driven).
    let popped = false;
    if (this.panelPop > 0) {
      const p = Math.min(1, this.panelPop / 0.4);
      const scale = 1 + Math.sin(this.easeOut(p) * Math.PI) * 0.06; // peak +6%
      const pcx = ix + iw / 2;
      const pcy = iy + ih / 2;
      this.ctx.save();
      this.ctx.translate(pcx, pcy);
      this.ctx.scale(scale, scale);
      this.ctx.translate(-pcx, -pcy);
      popped = true;
    }

    this.drawRoundRect(ix, iy, iw, ih, 8, '#FFFDF8', TILE_BORDER);

    const cx = ix + iw / 2;
    let y = iy + 14;
    const line = Math.max(14, ih * 0.1);

    this.drawText('DICE TYCOON', cx, y, { size: Math.min(13, iw * 0.09), color: ACCENT, weight: '800' });
    y += line;
    this.drawText(`${this.theme.name} · Board ${this.boardLevel}`, cx, y, {
      size: Math.min(10, iw * 0.07), color: TEXT_MUTED, weight: '600',
    });
    y += line;

    this.drawText(`\u{1F4B0} ${this.coins}`, cx, y, { size: Math.min(14, iw * 0.1), color: TEXT_DARK, weight: '700' });
    y += line;
    const diceStr = this.isDaily() ? `\u{1F3B2} ${this.dice}` : `\u{1F3B2} ${this.dice}/${this.cfg.diceCap}`;
    this.drawText(`${diceStr}   \u{1F6E1} ${this.shields}`, cx, y, {
      size: Math.min(12, iw * 0.085), color: TEXT_DARK, weight: '600',
    });
    y += line;

    if (!this.isDaily() && this.dice < this.cfg.diceCap) {
      const ms = msUntilNextDie(this.dice, this.lastRegenAt, Date.now(), this.cfg);
      const secs = Math.ceil(ms / 1000);
      const mm = Math.floor(secs / 60);
      const ss = secs % 60;
      this.drawText(`Next die ${mm}:${String(ss).padStart(2, '0')}`, cx, y, {
        size: Math.min(9, iw * 0.065), color: TEXT_MUTED, weight: '600',
      });
      y += line * 0.85;
    }

    // Next landmark cost.
    const cost = this.nextLandmarkCost();
    if (cost != null) {
      const name = this.theme.landmarkNames[this.landmarksBuilt] || 'Landmark';
      this.drawText(`Next: ${name}`, cx, y, { size: Math.min(9, iw * 0.065), color: TEXT_MUTED, weight: '600' });
      y += line * 0.8;
      const affordable = this.coins >= cost;
      this.buildBtn = { x: ix + iw * 0.15, y, w: iw * 0.7, h: line * 1.1, enabled: affordable };
      this.drawRoundRect(this.buildBtn.x, this.buildBtn.y, this.buildBtn.w, this.buildBtn.h, 6,
        affordable ? PRIMARY : '#D8C8BC');
      this.drawText(`Build ${cost}`, cx, this.buildBtn.y + this.buildBtn.h / 2, {
        size: Math.min(10, iw * 0.07), color: '#FFFFFF', weight: '700',
      });
      y += line * 1.3;
    } else {
      this.buildBtn = { x: 0, y: 0, w: 0, h: 0, enabled: false };
    }

    this.drawText(`Stickers ${totalStickersOwned(this.album)}/12`, cx, y, {
      size: Math.min(9, iw * 0.062), color: TEXT_MUTED, weight: '600',
    });
    y += line * 0.85;

    // Status message.
    if (this.messageTimer > 0 && this.message) {
      this.drawText(this.message, cx, y, { size: Math.min(9, iw * 0.06), color: ACCENT, weight: '700' });
    }

    // End the build-pop transform before drawing the (unscaled) controls.
    if (popped) this.ctx.restore();

    // Roll + multiplier chips below the ring.
    this.drawControls();
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
