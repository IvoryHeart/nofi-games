/**
 * Dice Tycoon — renderer-agnostic game core (pure logic).
 *
 * Owns ALL game STATE and RULES: board, token, economy (coins/dice/regen),
 * landmarks, rivals, raids, stickers, jackpot, jail, score, save/resume.
 *
 * NO canvas, NO Pixi, NO GameEngine, NO DOM, NO timers. Determinism flows
 * exclusively through an injected `rng: () => number` and an injected `now`
 * (ms) for time-based regen — so the core is headlessly testable in jsdom and
 * shareable by both the canvas view (nofi grid card) and the Pixi view
 * (tycoon app). Methods MUTATE state and RETURN result descriptors the views
 * animate from (the facts; views own the hop/particle/tumble animations).
 *
 * Depends only on the pure modules: economy / board / rivals / stickers.
 */

import {
  DifficultyConfig,
  DIFFICULTY_CONFIGS,
  MULTIPLIERS,
  applyRegen,
  msUntilNextDie,
  landmarkCosts,
  salaryFor,
  netWorth,
  effectiveCap,
  payoutFactor,
} from '../economy';
import {
  BOARD_SIZE,
  Tile,
  BoardTheme,
  generateBoard,
  drawCard,
  Card,
} from '../board';
import {
  Rival,
  generateRivals,
  resolveRaid,
  resolveCounterRaid,
} from '../rivals';
import {
  AlbumState,
  emptyAlbum,
  grantSticker,
  totalStickersOwned,
} from '../stickers';

/** Fixed dice budget for Daily Mode (deterministic, no regen). */
export const DAILY_DICE_BUDGET = 40;

export interface TycoonCoreOpts {
  rng: () => number;
  difficulty: number;
  /** Daily-mode seed (undefined = non-daily, real-time regen on). */
  seed?: number;
  /** Current clock in ms (used to seed the regen accounting). */
  now: number;
}

// ── Result descriptors (views animate from these) ───────────────────────────

/** A single step of a roll's token hop. Emitted per-tile as the token moves. */
export interface StepEvent {
  /** Tile index landed on for this step (0..BOARD_SIZE-1). */
  index: number;
  /** True if this step passed/landed on GO (index 0) and paid salary. */
  passedGo: boolean;
  /** GO salary paid on this step (0 if none). */
  salary: number;
}

/** Result of a roll: the two die faces + the total steps to hop. */
export interface RollResult {
  ok: boolean;
  /** Reason the roll was rejected (only when ok === false). */
  reason?: 'inactive' | 'not-enough-dice' | 'skipped';
  die1: number;
  die2: number;
  steps: number;
}

/** What happened when the token's final tile was resolved. */
export interface LandResult {
  type: Tile['type'];
  /** Net coin delta from the tile itself (+earn / -tax / parking payout, etc.). */
  coinDelta: number;
  /** True if a raid mini-event was opened (resolution is deferred to the view). */
  openedRaid: boolean;
  /** Human-readable status message (mirrors the legacy `flash` strings). */
  message: string;
  /** A coin gain occurred worth a celebratory burst. */
  burst: boolean;
  /** The post-turn systems that ran (counter-raid + any auto-builds). Null when
   *  a raid opened (afterTurn is deferred until the raid closes). */
  afterTurn: AfterTurnResult | null;
}

/** The post-turn systems that run after a tile fully resolves. */
export interface AfterTurnResult {
  counterRaid: CounterRaidResult;
  builds: BuildResult[];
}

export interface RaidResultView {
  blocked: boolean;
  stolen: number;
  vaultIndex: number;
}

/** Result of building the next landmark (and possibly completing the board). */
export interface BuildResult {
  built: boolean;
  /** Slot index just built (0..3), or -1 if nothing built. */
  slot: number;
  name: string;
  boardComplete: BoardCompleteResult | null;
}

/** Emitted when the 4th landmark completes a board and a fresh one is generated. */
export interface BoardCompleteResult {
  bonusCoins: number;
  bonusDice: number;
  /** The new board level after advancing. */
  nextBoardLevel: number;
}

/** Outcome of the post-turn counter-raid check. */
export interface CounterRaidResult {
  happened: boolean;
  shieldUsed: boolean;
  lostCoins: number;
  byName: string;
}

export class TycoonCore {
  // Economy / config
  private cfg: DifficultyConfig = DIFFICULTY_CONFIGS[1];
  private _seed: number | undefined;
  private _rng: () => number;
  private _difficulty = 1;
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

  // Win latch (mirrors GameEngine.won; the view bridges gameWin()).
  private won = false;

  // Hop queue (logical step bookkeeping; the VIEW owns the visual hop anim).
  private hopsLeft = 0;

  // Last rolled die faces (transient display state).
  private _lastDie1 = 1;
  private _lastDie2 = 1;

  // Raid state (the core is authoritative; the view owns the overlay anim).
  private raidRivalIndex = -1;
  private raidResolved = false;
  private raidResult: RaidResultView | null = null;

  constructor(opts: TycoonCoreOpts) {
    this._rng = opts.rng;
    this._seed = opts.seed;
    this._difficulty = opts.difficulty;
    this.init(opts.now);
  }

  /** Daily mode = a seed is present (fixed dice budget, no real-time regen). */
  isDaily(): boolean {
    return this._seed != null;
  }

  /** Live dice cap: board-level-scaled effectiveCap for non-daily play. Daily
   *  mode runs a fixed budget with no cap enforcement. */
  diceCap(): number {
    return this.isDaily()
      ? Number.MAX_SAFE_INTEGER
      : effectiveCap(this.cfg, this.boardLevel);
  }

  /** Counter-raid aggression actually applied. Board 1 is a clean, rival-free
   *  onboarding board (aggression 0); deeper boards use the difficulty knob. */
  counterRaidAggression(): number {
    return this.boardLevel <= 1 ? 0 : this.cfg.rivalAggression;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** (Re)initialize to a fresh game. `now` seeds the regen clock. */
  init(now: number): void {
    const diff = Math.min(Math.max(this._difficulty, 0), 3);
    this.cfg = DIFFICULTY_CONFIGS[diff];

    this.boardLevel = 1;
    const board = generateBoard(this._rng, this.boardLevel);
    this.tiles = board.tiles;
    this.theme = board.theme;
    this.tokenIndex = 0;

    this.coins = this.cfg.startCoins;
    this.dice = this.isDaily() ? DAILY_DICE_BUDGET : this.cfg.startDice;
    this.lastRegenAt = now;
    this.shields = 0;
    this.multiplierIndex = 0;

    this.landmarksBuilt = 0;
    this.totalLandmarks = 0;
    this.landmarkCostList = landmarkCosts(this.boardLevel, this.cfg);

    // Rivals' bankrolls scale to the economy via the first landmark cost
    // (coinScale), keeping the rivals module decoupled from economy.ts.
    this.rivals = generateRivals(this._rng, this.boardLevel, this.landmarkCostList[0]);
    this.album = emptyAlbum();

    this.jackpot = 0;
    this.skipNextRoll = false;
    this.hopsLeft = 0;
    this._lastDie1 = 1;
    this._lastDie2 = 1;
    this.raidRivalIndex = -1;
    this.raidResolved = false;
    this.raidResult = null;
    this.won = false;

    this.gameActive = true;
  }

  // ── Rolling ──────────────────────────────────────────────────────────────

  /** True if a roll is currently allowed (active + enough dice). NOTE: the VIEW
   *  additionally gates on its hop animation / open raid being in flight —
   *  those are view-owned transient states. */
  canRoll(): boolean {
    if (!this.gameActive) return false;
    const cost = MULTIPLIERS[this.multiplierIndex];
    return this.dice >= cost;
  }

  /**
   * Spend dice + roll two faces. Sets up the step queue (hopsLeft) for the view
   * to animate. Pays NO salary / resolves NO tile here — the view drives that
   * via advanceTokenOneStep() per completed hop, then resolveLandedTile().
   *
   * `now` is used for the regen-clock reset when spending while at the cap.
   */
  roll(now: number): RollResult {
    if (!this.gameActive) {
      return { ok: false, reason: 'inactive', die1: 0, die2: 0, steps: 0 };
    }
    const cost = MULTIPLIERS[this.multiplierIndex];
    if (this.dice < cost) {
      return { ok: false, reason: 'not-enough-dice', die1: 0, die2: 0, steps: 0 };
    }

    // Spend a die against regen accounting: spending while at the cap restarts
    // the regen clock.
    if (!this.isDaily() && this.dice >= this.diceCap()) {
      this.lastRegenAt = now;
    }

    this.dice = Math.max(0, this.dice - cost);

    // Jail: skip this roll (the dice were consumed to "post bail"-style turn).
    if (this.skipNextRoll) {
      this.skipNextRoll = false;
      this.hopsLeft = 0;
      return { ok: false, reason: 'skipped', die1: 0, die2: 0, steps: 0 };
    }

    const d1 = 1 + Math.floor(this._rng() * 6);
    const d2 = 1 + Math.floor(this._rng() * 6);
    this._lastDie1 = d1;
    this._lastDie2 = d2;
    const steps = d1 + d2;
    this.hopsLeft = steps;
    return { ok: true, die1: d1, die2: d2, steps };
  }

  /** True while a roll's hop queue still has steps pending. */
  hasPendingHops(): boolean {
    return this.hopsLeft > 0;
  }

  /** Advance the token one tile forward; pay GO salary on pass/land. Returns a
   *  StepEvent describing the step so the view can animate the hop + payout. */
  advanceTokenOneStep(): StepEvent {
    this.hopsLeft = Math.max(0, this.hopsLeft - 1);
    const next = (this.tokenIndex + 1) % BOARD_SIZE;
    this.tokenIndex = next;
    if (next === 0) {
      const salary = salaryFor(this.boardLevel, this.cfg);
      this.coins += salary;
      return { index: next, passedGo: true, salary };
    }
    return { index: next, passedGo: false, salary: 0 };
  }

  // ── Tile resolution ────────────────────────────────────────────────────────

  /** Resolve the tile the token currently sits on. Returns a LandResult; if a
   *  raid opened, `openedRaid` is true and the view must drive chooseVault().
   *  When no raid opens, the post-turn systems (counter-raid + auto-build) run
   *  here exactly as before via afterTurn(). */
  resolveLandedTile(): LandResult {
    const tile = this.tiles[this.tokenIndex];
    if (!tile) {
      const afterTurn = this.afterTurn();
      return { type: 'go', coinDelta: 0, openedRaid: false, message: '', burst: false, afterTurn };
    }

    const mult = MULTIPLIERS[this.multiplierIndex];
    let res: LandResult;

    switch (tile.type) {
      case 'go': {
        const salary = salaryFor(this.boardLevel, this.cfg);
        this.coins += salary;
        res = { type: 'go', coinDelta: salary, openedRaid: false, message: `On GO! +${salary}`, burst: true, afterTurn: null };
        break;
      }
      case 'property': {
        const earn = Math.round(
          tile.baseValue * mult * this.cfg.payoutMul * payoutFactor(this.boardLevel),
        );
        this.coins += earn;
        res = { type: 'property', coinDelta: earn, openedRaid: false, message: `${tile.name} +${earn}`, burst: true, afterTurn: null };
        break;
      }
      case 'tax': {
        const loss = Math.round(tile.baseValue * mult);
        const paid = Math.min(this.coins, loss);
        this.coins = Math.max(0, this.coins - loss);
        this.jackpot += paid;
        res = { type: 'tax', coinDelta: -loss, openedRaid: false, message: `Tax -${loss}`, burst: false, afterTurn: null };
        break;
      }
      case 'chance': {
        res = this.applyCardResult(drawCard(this._rng, 'chance', this.boardLevel));
        break;
      }
      case 'treasure': {
        res = this.applyCardResult(drawCard(this._rng, 'treasure', this.boardLevel));
        break;
      }
      case 'railroad': {
        // Open a raid mini-event vs a seeded rival. The view defers resolution.
        const opened = this.openRaid();
        if (opened) {
          return { type: 'railroad', coinDelta: 0, openedRaid: true, message: 'Heist! Pick a vault', burst: false, afterTurn: null };
        }
        // No rivals → openRaid already ran afterTurn; report it.
        return { type: 'railroad', coinDelta: 0, openedRaid: false, message: '', burst: false, afterTurn: this._lastAfterTurn };
      }
      case 'jail': {
        this.skipNextRoll = true;
        res = { type: 'jail', coinDelta: 0, openedRaid: false, message: 'Jailed! Skip next roll', burst: false, afterTurn: null };
        break;
      }
      case 'parking': {
        const won = this.jackpot;
        this.coins += won;
        this.jackpot = 0;
        res = { type: 'parking', coinDelta: won, openedRaid: false, message: `Free Parking! +${won}`, burst: won > 0, afterTurn: null };
        break;
      }
      case 'gotojail': {
        this.tokenIndex = 5; // jail tile
        this.skipNextRoll = true;
        res = { type: 'gotojail', coinDelta: 0, openedRaid: false, message: 'Go to Jail!', burst: false, afterTurn: null };
        break;
      }
      default:
        res = { type: tile.type, coinDelta: 0, openedRaid: false, message: '', burst: false, afterTurn: null };
    }

    res.afterTurn = this.afterTurn();
    return res;
  }

  /** Apply a drawn card and return a land-result for the view. Mirrors the
   *  legacy applyCard() exactly (including the forced-move settle path). */
  private applyCardResult(card: Card): LandResult {
    let coinDelta = 0;
    let burst = false;
    switch (card.kind) {
      case 'coins': {
        if (card.amount >= 0) {
          this.coins += card.amount;
          if (card.amount > 0) burst = true;
          coinDelta = card.amount;
        } else {
          const before = this.coins;
          this.coins = Math.max(0, this.coins + card.amount);
          coinDelta = this.coins - before;
        }
        break;
      }
      case 'dice': {
        this.dice = Math.min(this.diceCap(), this.dice + Math.max(0, card.amount));
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
        const target = Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor(card.amount)));
        this.tokenIndex = target;
        this.settleMoveTile();
        return { type: 'chance', coinDelta: 0, openedRaid: false, message: card.text, burst: false, afterTurn: null };
      }
    }
    return { type: 'chance', coinDelta, openedRaid: false, message: card.text, burst, afterTurn: null };
  }

  /** Settle a tile reached by a forced 'move' card (no GO salary, no chained
   *  cards). Mirrors the legacy settleMoveTile() exactly. */
  private settleMoveTile(): void {
    const tile = this.tiles[this.tokenIndex];
    if (!tile) return;
    const mult = MULTIPLIERS[this.multiplierIndex];
    switch (tile.type) {
      case 'property': {
        const earn = Math.round(
          tile.baseValue * mult * this.cfg.payoutMul * payoutFactor(this.boardLevel),
        );
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
    }
  }

  private grantOneSticker(): { setCompleted: boolean; rewardCoins: number; isNew: boolean } {
    const drop = grantSticker(this._rng, this.album);
    if (drop.setCompleted && drop.reward) {
      this.coins += drop.reward.coins;
      this.dice = Math.min(this.diceCap(), this.dice + drop.reward.dice);
      return { setCompleted: true, rewardCoins: drop.reward.coins, isNew: drop.isNew };
    }
    return { setCompleted: false, rewardCoins: 0, isNew: drop.isNew };
  }

  /** Post-turn systems run after a non-raid tile resolves: counter-raid then
   *  auto-build. Returns the counter-raid result + any builds for the view. */
  private _lastAfterTurn: AfterTurnResult = { counterRaid: { happened: false, shieldUsed: false, lostCoins: 0, byName: '' }, builds: [] };
  afterTurn(): AfterTurnResult {
    const counterRaid = this.runCounterRaid();
    const builds = this.tryAutoBuild();
    this._lastAfterTurn = { counterRaid, builds };
    return this._lastAfterTurn;
  }

  runCounterRaid(): CounterRaidResult {
    const result = resolveCounterRaid(
      this._rng,
      this.counterRaidAggression(),
      this.coins,
      this.shields,
      this.rivals,
    );
    if (!result.happened) {
      return { happened: false, shieldUsed: false, lostCoins: 0, byName: '' };
    }
    if (result.shieldUsed) {
      this.shields = Math.max(0, this.shields - 1);
    } else if (result.lostCoins > 0) {
      this.coins = Math.max(0, this.coins - result.lostCoins);
    }
    return {
      happened: true,
      shieldUsed: result.shieldUsed,
      lostCoins: result.lostCoins,
      byName: result.byName,
    };
  }

  // ── Raid mini-event ────────────────────────────────────────────────────────

  isRaidOpen(): boolean {
    return this.raidRivalIndex >= 0;
  }
  isRaidResolved(): boolean {
    return this.raidResolved;
  }
  getRaidRivalIndex(): number {
    return this.raidRivalIndex;
  }
  getRaidResult(): RaidResultView | null {
    return this.raidResult;
  }

  /** Open a raid against a seeded rival. Returns false (and runs afterTurn) if
   *  there are no rivals. */
  openRaid(): boolean {
    if (this.rivals.length === 0) {
      this.afterTurn();
      return false;
    }
    const rivalIndex = Math.floor(this._rng() * this.rivals.length) % this.rivals.length;
    this.raidRivalIndex = rivalIndex;
    this.raidResolved = false;
    this.raidResult = null;
    return true;
  }

  /** Resolve an open raid by choosing one of 3 vaults. Returns the outcome the
   *  view animates (blocked / stolen / vaultIndex). */
  chooseVault(vault: number): RaidResultView | null {
    if (!this.isRaidOpen() || this.raidResolved) return null;
    const rival = this.rivals[this.raidRivalIndex];
    if (!rival) {
      this.closeRaid();
      return null;
    }
    const mult = MULTIPLIERS[this.multiplierIndex];
    const result = resolveRaid(this._rng, rival, mult, vault, this.coins);
    this.raidResult = result;
    this.raidResolved = true;
    if (!result.blocked) {
      this.coins += result.stolen;
    }
    return result;
  }

  /** Close the raid and run the deferred post-turn systems. */
  closeRaid(): AfterTurnResult {
    this.raidRivalIndex = -1;
    this.raidResolved = false;
    this.raidResult = null;
    return this.afterTurn();
  }

  // ── Landmarks & board completion ─────────────────────────────────────────

  nextLandmarkCost(): number | null {
    if (this.landmarksBuilt >= 4) return null;
    return this.landmarkCostList[this.landmarksBuilt] ?? null;
  }

  /** True if the next landmark is affordable right now. */
  canBuild(): boolean {
    const cost = this.nextLandmarkCost();
    return cost != null && this.coins >= cost;
  }

  /** Auto-build the next affordable landmark(s) after each turn. Returns the
   *  list of builds (for the view to animate rises / banners). */
  tryAutoBuild(): BuildResult[] {
    const builds: BuildResult[] = [];
    let guard = 0;
    while (guard++ < 4) {
      const cost = this.nextLandmarkCost();
      if (cost == null) break;
      if (this.coins < cost) break;
      builds.push(this.buildNextLandmark(cost));
    }
    return builds;
  }

  /** Manual build entry: builds the next landmark if affordable. Returns a
   *  BuildResult (built=false if unaffordable). */
  build(): BuildResult {
    const cost = this.nextLandmarkCost();
    if (cost != null && this.coins >= cost) {
      return this.buildNextLandmark(cost);
    }
    return { built: false, slot: -1, name: '', boardComplete: null };
  }

  /** Build the next landmark for `cost`. Mirrors the legacy buildNextLandmark()
   *  exactly, including board completion on the 4th. */
  buildNextLandmark(cost: number): BuildResult {
    this.coins = Math.max(0, this.coins - cost);
    this.landmarksBuilt += 1;
    this.totalLandmarks += 1;
    const slot = this.landmarksBuilt - 1;
    const name = this.theme.landmarkNames[slot] || 'Landmark';

    let boardComplete: BoardCompleteResult | null = null;
    if (this.landmarksBuilt >= 4) {
      boardComplete = this.completeBoard();
    }
    return { built: true, slot, name, boardComplete };
  }

  /** Complete a board: fire the win latch, grant the bonus, advance to a fresh
   *  board. Mirrors the legacy completeBoard() exactly (sans canvas FX). */
  private completeBoard(): BoardCompleteResult {
    // First completion ever fires the (idempotent) win latch.
    this.won = true;

    const bonusCoins = 500 * this.boardLevel;
    this.coins += bonusCoins;
    this.dice = Math.min(this.diceCap(), this.dice + 5);
    this.grantOneSticker();

    // Advance to a fresh board (continuable).
    this.boardLevel += 1;
    const board = generateBoard(this._rng, this.boardLevel);
    this.tiles = board.tiles;
    this.theme = board.theme;
    this.tokenIndex = 0;
    this.landmarksBuilt = 0;
    this.landmarkCostList = landmarkCosts(this.boardLevel, this.cfg);
    this.rivals = generateRivals(this._rng, this.boardLevel, this.landmarkCostList[0]);
    this.skipNextRoll = false;

    return { bonusCoins, bonusDice: 5, nextBoardLevel: this.boardLevel };
  }

  cycleMultiplier(): number {
    this.multiplierIndex = (this.multiplierIndex + 1) % MULTIPLIERS.length;
    return MULTIPLIERS[this.multiplierIndex];
  }

  // ── Regen / time ───────────────────────────────────────────────────────────

  /** Credit any elapsed dice regen up to `now`. Non-daily only (daily mode
   *  uses a fixed budget). Idempotent: safe to call every frame/tick. */
  applyRegen(now: number): void {
    if (this.isDaily()) return;
    const r = applyRegen(this.dice, this.lastRegenAt, now, this.cfg, this.boardLevel);
    this.dice = r.dice;
    this.lastRegenAt = r.lastRegenAt;
  }

  /** Time-based tick: thin alias the view calls on its throttled regen check. */
  tick(now: number): void {
    this.applyRegen(now);
  }

  /** Milliseconds until the next die arrives (0 if at cap / daily). */
  msUntilNextDie(now: number): number {
    if (this.isDaily()) return 0;
    return msUntilNextDie(this.dice, this.lastRegenAt, now, this.cfg, this.boardLevel);
  }

  // ── Score ──────────────────────────────────────────────────────────────────

  /** Net-worth score (spec 5.7). Monotonic in coins/landmarks/board/stickers. */
  getScore(): number {
    return netWorth({
      coins: this.coins,
      landmarksBuilt: this.totalLandmarks,
      boardLevel: this.boardLevel,
      stickers: totalStickersOwned(this.album),
    });
  }

  // ── State getters/setters (views render from these) ─────────────────────────

  getCfg(): DifficultyConfig { return this.cfg; }
  isActive(): boolean { return this.gameActive; }
  setActive(v: boolean): void { this.gameActive = v; }
  isWon(): boolean { return this.won; }
  setWon(v: boolean): void { this.won = v; }

  getBoardLevel(): number { return this.boardLevel; }
  setBoardLevel(v: number): void { this.boardLevel = v; }
  getTiles(): Tile[] { return this.tiles; }
  setTiles(t: Tile[]): void { this.tiles = t; }
  getTheme(): BoardTheme { return this.theme; }
  getTokenIndex(): number { return this.tokenIndex; }
  setTokenIndex(v: number): void { this.tokenIndex = v; }

  getCoins(): number { return this.coins; }
  setCoins(v: number): void { this.coins = v; }
  getDice(): number { return this.dice; }
  setDice(v: number): void { this.dice = v; }
  getLastRegenAt(): number { return this.lastRegenAt; }
  setLastRegenAt(v: number): void { this.lastRegenAt = v; }
  getShields(): number { return this.shields; }
  setShields(v: number): void { this.shields = v; }
  getMultiplierIndex(): number { return this.multiplierIndex; }
  setMultiplierIndex(v: number): void { this.multiplierIndex = v; }

  getLandmarksBuilt(): number { return this.landmarksBuilt; }
  setLandmarksBuilt(v: number): void { this.landmarksBuilt = v; }
  getTotalLandmarks(): number { return this.totalLandmarks; }
  setTotalLandmarks(v: number): void { this.totalLandmarks = v; }
  getLandmarkCostList(): number[] { return this.landmarkCostList; }
  setLandmarkCostList(v: number[]): void { this.landmarkCostList = v; }

  getRivals(): Rival[] { return this.rivals; }
  setRivals(v: Rival[]): void { this.rivals = v; }
  getAlbum(): AlbumState { return this.album; }
  setAlbum(v: AlbumState): void { this.album = v; }
  getStickerCount(): number { return totalStickersOwned(this.album); }

  getJackpot(): number { return this.jackpot; }
  setJackpot(v: number): void { this.jackpot = v; }
  getSkipNextRoll(): boolean { return this.skipNextRoll; }
  setSkipNextRoll(v: boolean): void { this.skipNextRoll = v; }

  getLastDie1(): number { return this._lastDie1; }
  setLastDie1(v: number): void { this._lastDie1 = v; }
  getLastDie2(): number { return this._lastDie2; }
  setLastDie2(v: number): void { this._lastDie2 = v; }

  /** Directly seed the open-raid state (used by the view when it owns the
   *  overlay lifecycle, and by tests that inject a raid). */
  setRaidState(rivalIndex: number, resolved: boolean, result: RaidResultView | null): void {
    this.raidRivalIndex = rivalIndex;
    this.raidResolved = resolved;
    this.raidResult = result;
  }

  // ── Save / Resume ────────────────────────────────────────────────────────
  //
  // The serialized shape is BYTE-COMPATIBLE with the legacy
  // DiceTycoonGame.serialize() so live users' saved games still load.

  serialize(): Record<string, unknown> {
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

  /** Restore from a snapshot. Validates defensively (silently bails on a
   *  malformed tiles array). `now` credits elapsed regen for time away.
   *  Returns true if the snapshot was applied, false if rejected. */
  deserialize(state: Record<string, unknown>, now: number): boolean {
    const tiles = state.tiles as Tile[] | undefined;
    if (!tiles || !Array.isArray(tiles) || tiles.length !== BOARD_SIZE) return false;

    this.tiles = tiles.map((t) => ({ ...t }));

    const theme = state.theme as BoardTheme | undefined;
    if (theme && typeof theme.name === 'string' && Array.isArray(theme.landmarkNames)) {
      this.theme = { name: theme.name, landmarkNames: theme.landmarkNames.slice() };
    }

    this.boardLevel = this.num(state.boardLevel, 1, 1);
    this.tokenIndex = Math.max(0, Math.min(BOARD_SIZE - 1, this.num(state.tokenIndex, 0, 0)));
    this.coins = this.num(state.coins, 0, 0);
    this.dice = this.num(state.dice, 0, 0);
    this.lastRegenAt = this.num(state.lastRegenAt, now, 0);
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
      const r = applyRegen(this.dice, this.lastRegenAt, now, this.cfg, this.boardLevel);
      this.dice = r.dice;
      this.lastRegenAt = r.lastRegenAt;
    }

    // Reset hop bookkeeping / raid (transient).
    this.hopsLeft = 0;
    this.raidRivalIndex = -1;
    this.raidResolved = false;
    this.raidResult = null;

    return true;
  }

  private num(v: unknown, fallback: number, min: number): number {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    return Math.max(min, n);
  }
}
