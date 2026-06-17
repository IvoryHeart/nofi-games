import { saveScore, getStats, getSettings, saveSettings, AppSettings } from '../storage/scores';
import { saveGameState, loadGameState } from '../storage/gameState';
import { sound } from '../utils/audio';
import { hapticLight, hapticMedium, setHapticsEnabled } from '../utils/haptics';
import { burst as confettiBurst, pickWinMessage } from '../utils/confetti';
// Type-only import of the Pixi view — the runtime value is loaded lazily via a
// dynamic import() so the Pixi (+ pixi.js) chunk never enters the synchronous
// app-shell path (offline-first; bundle isolation; jsdom tests touch no WebGL).
import type {
  TycoonPixiGame,
  TycoonEvent,
  CityState,
  MapState,
  AlbumView,
} from './pixi/TycoonPixiGame';
import { computeLayout, LayoutResult } from './layout';
import { loadQuickWins, saveQuickWins } from '../storage/quickWins';
import {
  QuickWinState,
  QuickWinTask,
  isComplete as qwIsComplete,
  isClaimable as qwIsClaimable,
  allComplete as qwAllComplete,
  claimableCount as qwClaimableCount,
  DAILY_BONUS,
  STREAK_GRAND_PRIZE_DAYS,
  QuickWinType,
} from '../games/dice-tycoon/quickWins';

const GAME_ID = 'dice-tycoon';
const DIFF_COLORS = ['#5CB85C', '#F5A623', '#E85D5D', '#6B4566'];
const DIFF_LABELS = ['Easy', 'Medium', 'Hard', 'Extra Hard'];

/** Cap on the recent-activity feed (desktop right rail). */
const FEED_MAX = 30;

/** Glyph per feed-event kind (desktop right rail). */
const FEED_ICON: Record<TycoonEvent['kind'], string> = {
  payout: '💰',
  tax: '💸',
  raid: '⚔️',
  build: '🏗',
  board: '🎉',
  salary: '🪙',
  info: 'ℹ️',
};

type Screen = 'home' | 'game' | 'settings';

/** In-game views switched by the bottom nav (V4). 'play' is the live Pixi board;
 *  'city'/'map'/'album'/'tasks' are DOM views that keep the Pixi game alive
 *  (hidden, not destroyed) so a tab switch never tears down the GPU. */
type GameView = 'play' | 'city' | 'map' | 'album' | 'tasks';

/** Bottom-nav tabs. F4a repurposes the old disabled 'Events' slot as 'Tasks'
 *  (the Quick Wins daily tasks + streak view). */
const NAV_TABS: ReadonlyArray<{ view: GameView; label: string; icon: string; path: string; disabled?: boolean }> = [
  { view: 'play', label: 'Play', icon: '🎲', path: '/play' },
  { view: 'city', label: 'City', icon: '🏙', path: '/city' },
  { view: 'map', label: 'Map', icon: '🗺', path: '/map' },
  { view: 'album', label: 'Album', icon: '📔', path: '/album' },
  { view: 'tasks', label: 'Tasks', icon: '✅', path: '/tasks' },
];

/** Map a URL path to a game view (V4 per-URL convention). */
function viewForPath(path: string): GameView | null {
  switch (path) {
    case '/play': return 'play';
    case '/city': return 'city';
    case '/map': return 'map';
    case '/album': return 'album';
    case '/tasks': return 'tasks';
    default: return null;
  }
}

/**
 * Minimal standalone shell for the Dice Tycoon app (tycoon.nofi.games).
 *
 * A lean cousin of src/app.ts: only the screens Dice Tycoon needs — a landing
 * page with a difficulty pick + Play button, a full-screen game view with a
 * back button and score pill (win/gameover handled at this shell layer), and a
 * settings stub (sound toggle reusing the shared AppSettings storage).
 *
 * Reuses the shared engine, storage, audio, haptics and confetti modules. Loads
 * ONLY the dice-tycoon chunk (imported by main.ts), not all 23 games.
 */
export class TycoonApp {
  private root: HTMLElement;
  private currentScreen: Screen = 'home';
  private currentDifficulty = 1;
  /** The active Pixi view (lazy-loaded). Null when not on the game screen. */
  private pixiGame: TycoonPixiGame | null = null;
  private winMessageCounter = 0;
  /** rAF-debounced window resize handler, active only on the game screen. */
  private resizeHandler: (() => void) | null = null;
  private resizeRaf = 0;
  /** Current responsive layout (recomputed on resize on the game screen). */
  private layout: LayoutResult | null = null;
  /** Interval id polling rail state from the live game (cockpit/compact). */
  private railTimer: ReturnType<typeof setInterval> | null = null;
  /** Newest-first recent-activity feed (right rail). Capped at FEED_MAX. */
  private feed: TycoonEvent[] = [];
  /** Current in-game view (V4). Only meaningful while a game session is live. */
  private gameView: GameView = 'play';
  /** Today's Quick Wins state (daily tasks + streak). Loaded on game start,
   *  fed by the Pixi game, persisted on change/exit. Null pre-load. */
  private quickWins: QuickWinState | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async mount(): Promise<void> {
    // Apply persisted audio preference so the toggle and gameplay agree.
    const settings = await getSettings();
    sound.enabled = settings.soundEnabled;
    setHapticsEnabled(settings.vibrationEnabled);

    this.showHome();

    window.addEventListener('popstate', () => {
      if (this.currentScreen === 'game') {
        // V4: a game-view URL (/play|/city|/map|/album) restores that view in
        // place (Pixi stays alive); anything else backs out of the session.
        const view = viewForPath(window.location.pathname);
        if (view) this.switchView(view, false);
        else this.exitGame();
      } else if (this.currentScreen === 'settings') this.showHome();
      else this.showHome();
    });
  }

  // ── Home / landing ─────────────────────────────────────────────────────────

  private showHome(): void {
    this.currentScreen = 'home';
    this.root.innerHTML = `
      <div class="tycoon-home">
        <button class="tycoon-icon-btn tycoon-home-settings" id="tycoon-settings-btn" aria-label="Settings">⚙</button>
        <div class="tycoon-hero">
          <div class="tycoon-logo" aria-hidden="true">\u{1F3B2}</div>
          <h1>Dice Tycoon</h1>
          <p>Roll, build &amp; raid your way around the board</p>
        </div>
        <div class="tycoon-diff" role="group" aria-label="Difficulty">
          ${DIFF_LABELS.map((label, i) => `
            <button class="tycoon-diff-btn${i === this.currentDifficulty ? ' active' : ''}"
                    data-diff="${i}"
                    style="${i === this.currentDifficulty ? `border-color:${DIFF_COLORS[i]};color:${DIFF_COLORS[i]};` : ''}">
              ${label}
            </button>`).join('')}
        </div>
        <button class="tycoon-play" id="tycoon-play" style="background:${DIFF_COLORS[this.currentDifficulty]};">Play</button>
      </div>
    `;

    this.root.querySelectorAll<HTMLElement>('.tycoon-diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        hapticLight();
        sound.play('tap');
        this.currentDifficulty = Number(btn.dataset.diff);
        this.showHome();
      });
    });

    this.root.querySelector('#tycoon-play')!.addEventListener('click', () => {
      hapticMedium();
      sound.play('tap');
      this.startGame(this.currentDifficulty);
    });

    this.root.querySelector('#tycoon-settings-btn')!.addEventListener('click', () => {
      hapticLight();
      sound.play('tap');
      this.showSettings();
    });
  }

  // ── Game ─────────────────────────────────────────────────────────────────

  private async startGame(difficulty: number): Promise<void> {
    this.currentScreen = 'game';
    this.currentDifficulty = difficulty;
    this.feed = [];
    this.gameView = 'play';

    const stats = await getStats(GAME_ID);
    // V4: the live game gets the /play URL (per-URL convention; the bottom nav
    // pushes /city|/map|/album on top of it).
    history.pushState({ screen: 'game', view: 'play' }, '', '/play');

    // Responsive layout from the live viewport: phone (edge-to-edge), compact
    // (one rail) or cockpit (top bar + two rails). The Pixi host gets the
    // CENTER-STAGE rect — never the old 480 device-card.
    const layout = computeLayout(this.viewportW(), this.viewportH());
    this.layout = layout;
    this.root.innerHTML = this.gameMarkup(layout, stats.bestScore);
    this.bindGameChrome();
    this.bindNav();

    // Let layout settle (CSS grid sizing) before measuring the stage.
    await new Promise((r) => requestAnimationFrame(r));

    const host = document.getElementById('pixi-host');
    const container = document.getElementById('game-container');
    if (!host || !container) return;

    const { w: displayW, h: displayH } = this.measureStage(layout);

    try {
      // Lazy-load the Pixi view ONLY now (keeps pixi.js out of the shell path).
      const { TycoonPixiGame } = await import('./pixi/TycoonPixiGame');
      // Bail if the user navigated away while the chunk loaded.
      if (this.currentScreen !== 'game') return;

      const game = new TycoonPixiGame(host, {
        difficulty,
        width: displayW,
        height: displayH,
        framing: layout.framing,
        onScore: (score) => {
          const el = document.getElementById('hud-score');
          if (el) el.textContent = score.toLocaleString();
        },
        onWin: (finalScore) => this.handleWin(finalScore),
        onGameOver: (finalScore) => this.handleGameOver(finalScore),
        onEvent: (e) => this.pushFeedEvent(e),
        onQuickWin: (s) => this.onQuickWinChanged(s),
      });
      this.pixiGame = game;

      // Load today's Quick Wins (fresh seeded tasks on a new calendar day,
      // streak preserved/reset) and inject into the live game so events advance
      // the daily tasks. Offline; mirrors storage/daily.ts.
      this.quickWins = await loadQuickWins();
      game.setQuickWins(this.quickWins);

      // Resume a saved (game, difficulty) slot if present — SAME serialized
      // format as the canvas view, so saves are cross-compatible. Applied BEFORE
      // start() so the scene builds from the restored core.
      const saved = await loadGameState(GAME_ID, difficulty);
      if (saved?.state) game.deserialize(saved.state);

      await game.start(!!saved);
      // Bail if exited during the async GPU init.
      if (this.currentScreen !== 'game' || this.pixiGame !== game) {
        game.destroy();
        return;
      }

      const loadingEl = container.querySelector('.game-loading');
      if (loadingEl) loadingEl.remove();

      // Seed the HUD score immediately.
      const scoreEl = document.getElementById('hud-score');
      if (scoreEl) scoreEl.textContent = game.getScore().toLocaleString();

      // Poll rail state (cockpit/compact only) — cheap, off the render loop.
      this.renderRails();
      if (layout.leftRail) {
        this.railTimer = setInterval(() => this.renderRails(), 350);
      }

      // Keep the Pixi renderer matched to the viewport. On resize we recompute
      // the layout MODE + center-stage rect; a mode change re-renders the shell.
      this.resizeHandler = () => {
        cancelAnimationFrame(this.resizeRaf);
        this.resizeRaf = requestAnimationFrame(() => this.onResize());
      };
      window.addEventListener('resize', this.resizeHandler);
    } catch (err) {
      console.error('Failed to start Dice Tycoon:', err);
      container.innerHTML = `
        <div class="game-error">
          <div class="game-error-icon">⚠</div>
          <h3 style="color:var(--text-primary);font-weight:800;">Oops!</h3>
          <p>Something went wrong loading the game.</p>
          <div class="btn-group" style="margin-top:8px;">
            <button class="btn btn-primary" id="err-home">Home</button>
          </div>
        </div>
      `;
      container.querySelector('#err-home')?.addEventListener('click', () => this.exitGame());
    }
  }

  // ── Layout helpers ─────────────────────────────────────────────────────────

  private viewportW(): number {
    return Math.max(1, window.innerWidth || this.root.clientWidth || 360);
  }
  private viewportH(): number {
    return Math.max(1, window.innerHeight || this.root.clientHeight || 640);
  }

  /** Build the full game-SESSION markup: the active view (Play board or a DOM
   *  view) wrapped with the bottom nav. The session container persists across
   *  view switches; only the body swaps (Pixi stays alive). */
  private gameMarkup(layout: LayoutResult, bestScore: number): string {
    const body = this.gameView === 'play'
      ? this.playMarkup(layout, bestScore)
      : `<div class="tycoon-view" id="tycoon-view"></div>`;
    return `
      <div class="game-screen tycoon-game tycoon-session tycoon-${layout.mode} tycoon-view-${this.gameView}">
        <div class="tycoon-session-body" id="tycoon-session-body">
          ${body}
        </div>
        ${this.navMarkup()}
      </div>`;
  }

  /** The bottom-nav bar (Play · City · Map · Album · Events). Active-tab styled
   *  from the live `gameView`; Events is a disabled placeholder. */
  private navMarkup(): string {
    const tabs = NAV_TABS.map((t) => {
      const active = t.view === this.gameView ? ' active' : '';
      const dis = t.disabled ? ' disabled aria-disabled="true"' : '';
      return `<button class="tycoon-nav-btn${active}" data-view="${t.view}"${dis}>
          <span class="tycoon-nav-icon">${t.icon}</span>
          <span class="tycoon-nav-label">${t.label}</span>
        </button>`;
    }).join('');
    return `<nav class="tycoon-nav" id="tycoon-nav" role="tablist">${tabs}</nav>`;
  }

  /** The Play view body for a layout mode (the live Pixi board + chrome). Phone
   *  is the lean edge-to-edge overlay; compact/cockpit add a top bar + DOM rails
   *  around the center-stage Pixi host. */
  private playMarkup(layout: LayoutResult, bestScore: number): string {
    const back = `<button class="hud-btn" id="hud-back" aria-label="Exit game"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>`;
    const stage = `
      <div class="tycoon-stage" id="game-container">
        <div class="game-loading"><div class="loading-spinner"></div></div>
        <div class="tycoon-pixi-host" id="pixi-host"></div>
        <button class="tycoon-zoom-toggle" id="tycoon-zoom" aria-label="Toggle zoom">${layout.framing === 'follow' ? '⤢' : '⊕'}</button>
      </div>`;

    if (layout.mode === 'phone') {
      // Edge-to-edge: translucent minimal top HUD over a full-bleed board.
      return `
        <div class="tycoon-play-view tycoon-phone">
          ${stage}
          <div class="game-hud-overlay tycoon-top-hud">
            ${back}
            <div class="hud-center">
              <div class="hud-score-pill">
                <div class="hud-stat"><div class="hud-stat-label">Net Worth</div><div class="hud-stat-value" id="hud-score">0</div></div>
                <div class="hud-stat"><div class="hud-stat-label">Best</div><div class="hud-stat-value" id="hud-best">${bestScore.toLocaleString()}</div></div>
              </div>
            </div>
            <button class="hud-btn" id="tycoon-settings-game" aria-label="Settings">⚙</button>
          </div>
        </div>`;
    }

    // compact / cockpit: CSS grid — top bar, [left rail] center [right rail].
    const leftRail = layout.leftRail ? `<aside class="tycoon-rail tycoon-rail-left" id="tycoon-rail-left"></aside>` : '';
    const rightRail = layout.rightRail ? `<aside class="tycoon-rail tycoon-rail-right" id="tycoon-rail-right"></aside>` : '';
    return `
      <div class="tycoon-play-view tycoon-cockpit tycoon-${layout.mode}">
        <header class="tycoon-topbar-cockpit" id="tycoon-topbar">
          ${back}
          <div class="tycoon-topstats" id="tycoon-topstats"></div>
          <div class="tycoon-top-score">
            <div class="hud-stat"><div class="hud-stat-label">Net Worth</div><div class="hud-stat-value" id="hud-score">0</div></div>
            <div class="hud-stat"><div class="hud-stat-label">Best</div><div class="hud-stat-value" id="hud-best">${bestScore.toLocaleString()}</div></div>
          </div>
          <button class="hud-btn" id="tycoon-settings-game" aria-label="Settings">⚙</button>
        </header>
        <div class="tycoon-cockpit-body">
          ${leftRail}
          ${stage}
          ${rightRail}
        </div>
      </div>`;
  }

  /** Wire the chrome present in every game-screen variant (back, settings, the
   *  framing/zoom toggle). Tolerant of optional elements per mode. */
  private bindGameChrome(): void {
    this.root.querySelector('#hud-back')?.addEventListener('click', () => {
      hapticLight();
      sound.play('tap');
      this.exitGame();
    });
    this.root.querySelector('#tycoon-settings-game')?.addEventListener('click', () => {
      hapticLight();
      sound.play('tap');
      this.exitGame(); // back home; settings is reached from there
    });
    this.root.querySelector('#tycoon-zoom')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFraming();
    });
  }

  /** Wire the bottom-nav tabs (present in EVERY game-session view). A tap on a
   *  tab switches the view (pushing its URL). The disabled Events tab is inert. */
  private bindNav(): void {
    this.root.querySelectorAll<HTMLElement>('.tycoon-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.hasAttribute('disabled')) return;
        const view = btn.dataset.view as GameView | undefined;
        if (!view) return;
        if (view === this.gameView) return;
        hapticLight();
        sound.play('tap');
        this.switchView(view, true);
      });
    });
    // Reflect any pending claims on the Tasks tab badge.
    this.updateTasksNavBadge();
  }

  /** Measure the center-stage rect (the Pixi host fills it) and apply it. Uses
   *  the live container size when available, falling back to the pure layout. */
  private measureStage(layout: LayoutResult): { w: number; h: number } {
    const host = document.getElementById('pixi-host');
    const container = document.getElementById('game-container');
    const w = Math.max(1, Math.floor(container?.clientWidth || layout.stageRect.w));
    const h = Math.max(1, Math.floor(container?.clientHeight || layout.stageRect.h));
    if (host) {
      // The host fills its stage cell (CSS handles it); set explicit px so Pixi
      // and the cell agree exactly.
      host.style.width = `${w}px`;
      host.style.height = `${h}px`;
    }
    return { w, h };
  }

  /** Window-resize handler: recompute the layout mode + stage rect. A MODE
   *  change rebuilds the shell (rails appear/disappear); otherwise we just
   *  re-measure + resize the renderer. */
  private onResize(): void {
    if (this.currentScreen !== 'game' || !this.pixiGame) return;
    const next = computeLayout(this.viewportW(), this.viewportH());
    const prev = this.layout;
    if (!prev || prev.mode !== next.mode) {
      // Mode changed — rebuild the shell markup, re-bind, re-measure, re-resize.
      this.layout = next;
      void this.rebuildGameShell(next);
      return;
    }
    this.layout = next;
    // On a non-Play view the canvas is detached — nothing to re-measure here.
    if (this.gameView !== 'play') return;
    const { w, h } = this.measureStage(next);
    this.pixiGame.resize(w, h);
  }

  /** Rebuild the game-screen shell in place after a layout-MODE change (e.g. a
   *  desktop window narrowed to phone). Preserves the live Pixi game; just
   *  re-homes its canvas into the new stage + re-wires chrome/rails. */
  private async rebuildGameShell(layout: LayoutResult): Promise<void> {
    const game = this.pixiGame;
    if (!game) return;
    const stats = await getStats(GAME_ID);
    if (this.currentScreen !== 'game' || this.pixiGame !== game) return;

    if (this.railTimer) { clearInterval(this.railTimer); this.railTimer = null; }
    this.root.innerHTML = this.gameMarkup(layout, stats.bestScore);
    this.bindGameChrome();
    this.bindNav();
    await new Promise((r) => requestAnimationFrame(r));
    if (this.currentScreen !== 'game' || this.pixiGame !== game) return;

    // On a non-Play view we keep the Pixi canvas detached (alive, hidden) and
    // just re-render the active DOM view for the new layout mode.
    if (this.gameView !== 'play') {
      this.renderActiveView();
      return;
    }

    const host = document.getElementById('pixi-host');
    const loadingEl = document.querySelector('#game-container .game-loading');
    if (loadingEl) loadingEl.remove();
    if (host && game.canvasEl) host.appendChild(game.canvasEl);

    game.setFraming(layout.framing);
    const { w, h } = this.measureStage(layout);
    game.resize(w, h);

    const scoreEl = document.getElementById('hud-score');
    if (scoreEl) scoreEl.textContent = game.getScore().toLocaleString();
    this.syncZoomToggle();
    this.renderRails();
    if (layout.leftRail) this.railTimer = setInterval(() => this.renderRails(), 350);
  }

  // ── V4 views (City / Map / Album) + view switching ───────────────────────────

  /**
   * Switch the in-game view (V4). Keeps the Pixi game ALIVE — when leaving Play
   * we DETACH its <canvas> from the DOM (the Application + ticker stay running,
   * GPU intact) and render the target DOM view; when returning to Play we re-home
   * the canvas into the fresh pixi-host and re-sync (resize). `push` adds a
   * history entry (tab tap); false means we're restoring from popstate.
   */
  private switchView(view: GameView, push: boolean): void {
    if (this.currentScreen !== 'game') return;
    const game = this.pixiGame;
    if (!game) return;

    // Detach the live canvas BEFORE we blow away the DOM, so it survives the
    // innerHTML swap and we can re-home it later (never destroyed → GPU kept).
    if (game.canvasEl && game.canvasEl.parentElement) {
      game.canvasEl.parentElement.removeChild(game.canvasEl);
    }
    if (this.railTimer) { clearInterval(this.railTimer); this.railTimer = null; }

    this.gameView = view;
    const path = NAV_TABS.find((t) => t.view === view)?.path ?? '/play';
    if (push) history.pushState({ screen: 'game', view }, '', path);

    const layout = this.layout ?? computeLayout(this.viewportW(), this.viewportH());
    this.layout = layout;
    void this.renderSession(layout);
  }

  /** Render the current game-session shell (active view + nav), re-homing the
   *  Pixi canvas + re-syncing when the active view is Play. */
  private async renderSession(layout: LayoutResult): Promise<void> {
    const game = this.pixiGame;
    if (!game) return;
    const stats = await getStats(GAME_ID);
    if (this.currentScreen !== 'game' || this.pixiGame !== game) return;

    this.root.innerHTML = this.gameMarkup(layout, stats.bestScore);
    this.bindNav();

    if (this.gameView === 'play') {
      // Returning to Play: re-wire chrome, re-home the canvas, re-sync the size
      // (it may have changed while away) so the board reflects any City builds.
      this.bindGameChrome();
      await new Promise((r) => requestAnimationFrame(r));
      if (this.currentScreen !== 'game' || this.pixiGame !== game) return;
      const host = document.getElementById('pixi-host');
      const loadingEl = document.querySelector('#game-container .game-loading');
      if (loadingEl) loadingEl.remove();
      if (host && game.canvasEl) host.appendChild(game.canvasEl);
      game.setFraming(layout.framing);
      const { w, h } = this.measureStage(layout);
      game.resize(w, h);
      const scoreEl = document.getElementById('hud-score');
      if (scoreEl) scoreEl.textContent = game.getScore().toLocaleString();
      this.syncZoomToggle();
      this.renderRails();
      if (layout.leftRail) this.railTimer = setInterval(() => this.renderRails(), 350);
      return;
    }

    this.renderActiveView();
  }

  /** Render the active non-Play DOM view (City/Map/Album) into the view slot. */
  private renderActiveView(): void {
    const slot = document.getElementById('tycoon-view');
    const game = this.pixiGame;
    if (!slot || !game) return;
    switch (this.gameView) {
      case 'city': this.renderCityView(slot, game.getCityState()); break;
      case 'map': this.renderMapView(slot, game.getMapState()); break;
      case 'album': this.renderAlbumView(slot, game.getAlbumView()); break;
      case 'tasks': this.renderTasksView(slot); break;
      default: break;
    }
  }

  // ── Quick Wins (daily tasks + streak) ───────────────────────────────────────

  /** The Pixi game advanced a task counter — cache + persist the new state and
   *  refresh whichever Quick Wins surface is mounted (Tasks view + right rail). */
  private onQuickWinChanged(state: QuickWinState): void {
    this.quickWins = state;
    void saveQuickWins(state);
    if (this.gameView === 'tasks') this.renderActiveView();
    this.renderRightRail();
    this.updateTasksNavBadge();
  }

  /** Render the Quick Wins Tasks view: the 3 daily tasks (label, progress bar,
   *  reward, Claim), the all-3 daily bonus, and the 7-day streak dots. */
  private renderTasksView(slot: HTMLElement): void {
    const qw = this.quickWins;
    if (!qw) {
      slot.innerHTML = `<div class="tycoon-view-inner tycoon-tasks"><p class="tycoon-view-note">Loading tasks…</p></div>`;
      return;
    }
    slot.innerHTML = this.tasksMarkup(qw);
    this.bindTasksHandlers(slot);
  }

  /** Build the Quick Wins panel markup (shared by the Tasks view body). */
  private tasksMarkup(qw: QuickWinState): string {
    const taskCards = qw.tasks.map((t) => this.taskCardMarkup(t)).join('');
    const all = qwAllComplete(qw.tasks);
    const bonusClaimable = all && !qw.dailyBonusClaimed;
    const bonusCard = `
      <div class="tycoon-task-card tycoon-task-bonus ${all ? 'complete' : ''} ${qw.dailyBonusClaimed ? 'claimed' : ''}">
        <div class="tycoon-task-head">
          <span class="tycoon-task-label">Complete all 3 — Daily Bonus</span>
          <span class="tycoon-task-reward">+${DAILY_BONUS.coins.toLocaleString()} 🪙 +${DAILY_BONUS.dice} 🎲</span>
        </div>
        ${bonusClaimable
          ? `<button class="tycoon-build-btn tycoon-task-claim" data-claim="__bonus__">Claim bonus</button>`
          : `<div class="tycoon-task-state">${qw.dailyBonusClaimed ? 'Claimed ✓' : `${qw.tasks.filter(qwIsComplete).length} / 3 done`}</div>`}
      </div>`;
    return `
      <div class="tycoon-view-inner tycoon-tasks">
        <header class="tycoon-view-head">
          <h2>Quick Wins</h2>
          <div class="tycoon-view-chips">
            <span class="tycoon-chip">🔥 <b>${qw.streak}</b> day streak</span>
            <span class="tycoon-chip">🏆 Best <b>${qw.bestStreak}</b></span>
          </div>
        </header>
        ${this.streakDotsMarkup(qw)}
        <div class="tycoon-task-list">${taskCards}</div>
        ${bonusCard}
      </div>`;
  }

  /** One task card: label, progress bar, reward, and a Claim button when done. */
  private taskCardMarkup(t: QuickWinTask): string {
    const pct = Math.max(0, Math.min(100, Math.round((t.progress / Math.max(1, t.target)) * 100)));
    const done = qwIsComplete(t);
    const claimable = qwIsClaimable(t);
    const action = claimable
      ? `<button class="tycoon-build-btn tycoon-task-claim" data-claim="${t.type}">Claim +${t.reward.coins.toLocaleString()} 🪙 +${t.reward.dice} 🎲</button>`
      : t.claimed
        ? `<div class="tycoon-task-state">Claimed ✓</div>`
        : `<div class="tycoon-task-reward">Reward: +${t.reward.coins.toLocaleString()} 🪙 +${t.reward.dice} 🎲</div>`;
    return `
      <div class="tycoon-task-card ${done ? 'complete' : ''} ${t.claimed ? 'claimed' : ''}">
        <div class="tycoon-task-head">
          <span class="tycoon-task-label">${this.esc(t.label)}</span>
          <span class="tycoon-task-prog">${Math.min(t.progress, t.target)} / ${t.target}</span>
        </div>
        <div class="tycoon-progress"><div class="tycoon-progress-fill" style="width:${pct}%"></div></div>
        ${action}
      </div>`;
  }

  /** A row of 7 streak dots (the grand-prize ladder), filled to the streak. */
  private streakDotsMarkup(qw: QuickWinState): string {
    const filled = Math.min(qw.streak, STREAK_GRAND_PRIZE_DAYS);
    const dots = Array.from({ length: STREAK_GRAND_PRIZE_DAYS }, (_, i) => {
      const on = i < filled;
      const grand = i === STREAK_GRAND_PRIZE_DAYS - 1;
      return `<span class="tycoon-streak-dot ${on ? 'on' : ''} ${grand ? 'grand' : ''}">${grand ? '🏆' : (on ? '✓' : '')}</span>`;
    }).join('');
    const note = qw.streak >= STREAK_GRAND_PRIZE_DAYS
      ? (qw.grandPrizeClaimed ? 'Grand prize claimed!' : 'Grand prize ready — claim the daily bonus!')
      : `${STREAK_GRAND_PRIZE_DAYS - qw.streak} more day${STREAK_GRAND_PRIZE_DAYS - qw.streak === 1 ? '' : 's'} to the grand prize`;
    return `
      <div class="tycoon-streak">
        <div class="tycoon-streak-dots">${dots}</div>
        <div class="tycoon-streak-note">${this.esc(note)}</div>
      </div>`;
  }

  /** Wire the Claim buttons in a Quick Wins surface (Tasks view or right rail).
   *  Claims route through the live game (grants coins/dice + celebrates). */
  private bindTasksHandlers(scope: HTMLElement): void {
    scope.querySelectorAll<HTMLElement>('.tycoon-task-claim').forEach((btn) => {
      btn.addEventListener('click', () => this.onQuickWinClaim(btn.dataset.claim ?? ''));
    });
  }

  /** Handle a Quick Wins claim (a task type or the '__bonus__' daily bonus). */
  private onQuickWinClaim(key: string): void {
    const game = this.pixiGame;
    if (!game || !key) return;
    if (key === '__bonus__') {
      const res = game.claimQuickWinDailyBonus();
      if (!res.bonus) return;
    } else {
      const reward = game.claimQuickWinTask(key as QuickWinType);
      if (!reward) return;
    }
    hapticMedium();
    sound.play('tap');
    // The game's onQuickWin callback already cached + persisted the new state +
    // refreshed surfaces; persist the (now coin/dice-richer) game slot too.
    void this.persistSession();
  }

  /** Update the Tasks nav-tab badge to the live claimable count (a dot when >0). */
  private updateTasksNavBadge(): void {
    const btn = this.root.querySelector('.tycoon-nav-btn[data-view="tasks"]');
    if (!btn) return;
    const n = this.quickWins ? qwClaimableCount(this.quickWins) : 0;
    let badge = btn.querySelector('.tycoon-nav-badge');
    if (n > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'tycoon-nav-badge';
        btn.appendChild(badge);
      }
      badge.textContent = String(n);
    } else if (badge) {
      badge.remove();
    }
  }

  /** City / Build view: the current board's 4 landmarks as a DOM "city" with a
   *  Build button on the next slot (drives game.buildLandmark() → core.build()). */
  private renderCityView(slot: HTMLElement, s: CityState): void {
    const cards = s.landmarks.map((lm) => {
      const state = lm.built ? 'built' : (lm.slot === s.landmarksBuilt ? 'next' : 'locked');
      const costLine = lm.built
        ? `<span class="tycoon-lm-state">Built ✓</span>`
        : `<span class="tycoon-lm-cost">${(lm.cost ?? 0).toLocaleString()} 🪙</span>`;
      const buildBtn = state === 'next'
        ? `<button class="tycoon-build-btn" id="tycoon-build" ${s.canBuild ? '' : 'disabled'}>Build</button>`
        : '';
      return `
        <div class="tycoon-lm-card tycoon-lm-${state}" data-slot="${lm.slot}" style="--tier:${lm.tier}">
          <div class="tycoon-lm-tower" aria-hidden="true"></div>
          <div class="tycoon-lm-info">
            <div class="tycoon-lm-name">${this.esc(lm.name)}</div>
            <div class="tycoon-lm-meta">Tier ${lm.tier} · ${costLine}</div>
            ${buildBtn}
          </div>
        </div>`;
    }).join('');
    const pct = Math.round((s.landmarksBuilt / 4) * 100);
    slot.innerHTML = `
      <div class="tycoon-view-inner tycoon-city">
        <header class="tycoon-view-head">
          <h2>${this.esc(s.themeName)} — City</h2>
          <div class="tycoon-view-chips">
            <span class="tycoon-chip">🪙 <b>${s.coins.toLocaleString()}</b></span>
            <span class="tycoon-chip">🏙 <b>Lv ${s.boardLevel}</b></span>
            <span class="tycoon-chip">${s.landmarksBuilt} / 4 built</span>
          </div>
        </header>
        <div class="tycoon-progress"><div class="tycoon-progress-fill" style="width:${pct}%"></div></div>
        <div class="tycoon-lm-grid">${cards}</div>
        ${s.nextCost == null ? `<p class="tycoon-view-note">All landmarks built — finish this board on Play to advance!</p>` : ''}
      </div>`;
    const buildBtn = slot.querySelector('#tycoon-build') as HTMLElement | null;
    buildBtn?.addEventListener('click', () => this.onCityBuild());
  }

  /** Handle a City-view Build tap: mutate the live core via the Pixi game (so
   *  the Play board re-syncs), persist, then re-render the City view. */
  private onCityBuild(): void {
    const game = this.pixiGame;
    if (!game) return;
    if (!game.buildLandmark()) return;
    hapticMedium();
    sound.play('tap');
    // Persist immediately so a hard refresh keeps the build (exitGame also saves).
    void this.persistSession();
    // Re-render with the post-build state (progress advanced, coins deducted).
    this.renderActiveView();
  }

  /** World Map view: a vertical scroll of board levels as themed island cards. */
  private renderMapView(slot: HTMLElement, s: MapState): void {
    const cards = s.islands.map((isl) => {
      const tap = isl.status === 'current'
        ? `<button class="tycoon-island-go" data-go="1">Play →</button>`
        : (isl.status === 'locked' ? `<span class="tycoon-island-lock">🔒 Locked</span>` : `<span class="tycoon-island-done">✓ Done</span>`);
      return `
        <div class="tycoon-island tycoon-island-${isl.status}" data-level="${isl.level}">
          <div class="tycoon-island-art" aria-hidden="true">🏝</div>
          <div class="tycoon-island-info">
            <div class="tycoon-island-name">Lv ${isl.level} · ${this.esc(isl.themeName)}</div>
            <div class="tycoon-island-sub">${isl.status === 'current' ? `${s.landmarksBuilt} / 4 landmarks` : (isl.status === 'done' ? 'Completed' : 'Coming up')}</div>
            ${tap}
          </div>
        </div>`;
    }).join('');
    slot.innerHTML = `
      <div class="tycoon-view-inner tycoon-map">
        <header class="tycoon-view-head"><h2>World Map</h2>
          <div class="tycoon-view-chips"><span class="tycoon-chip">🏙 <b>Lv ${s.boardLevel}</b></span></div>
        </header>
        <div class="tycoon-island-list">${cards}</div>
      </div>`;
    slot.querySelector('.tycoon-island-go')?.addEventListener('click', () => {
      hapticLight();
      sound.play('tap');
      this.switchView('play', true);
    });
  }

  /** Sticker Album view: 3 sets × 4 stickers, owned/unowned + per-set reward. */
  private renderAlbumView(slot: HTMLElement, a: AlbumView): void {
    const sets = a.sets.map((set) => {
      const cells = set.stickers.map((st) => `
        <div class="tycoon-sticker ${st.owned ? 'owned' : 'unowned'}">
          <span class="tycoon-sticker-icon">${st.owned ? '⭐' : '❓'}</span>
          <span class="tycoon-sticker-name">${this.esc(st.name)}</span>
        </div>`).join('');
      return `
        <div class="tycoon-set ${set.complete ? 'complete' : ''}">
          <div class="tycoon-set-head">
            <div class="tycoon-set-name">${this.esc(set.name)}</div>
            <div class="tycoon-set-prog">${set.owned} / ${set.total}${set.complete ? ' ✓' : ''}</div>
          </div>
          <div class="tycoon-set-grid">${cells}</div>
          <div class="tycoon-set-reward">Reward: ${set.reward.coins.toLocaleString()} 🪙 + ${set.reward.dice} 🎲${set.complete ? ' (claimed)' : ''}</div>
        </div>`;
    }).join('');
    slot.innerHTML = `
      <div class="tycoon-view-inner tycoon-album">
        <header class="tycoon-view-head"><h2>Sticker Album</h2>
          <div class="tycoon-view-chips"><span class="tycoon-chip">📔 <b>${a.totalOwned} / 12</b></span></div>
        </header>
        <div class="tycoon-set-list">${sets}</div>
      </div>`;
  }

  /** Persist the live (game, difficulty) slot from the Pixi core snapshot. Used
   *  after a City build so a refresh keeps it (exitGame persists too). */
  private async persistSession(): Promise<void> {
    const game = this.pixiGame;
    if (!game) return;
    const snapshot = game.serialize();
    const score = game.getScore();
    const won = score > 0 && (snapshot.boardLevel as number) > 1;
    await saveGameState(GAME_ID, {
      state: snapshot,
      score,
      won,
      difficulty: this.currentDifficulty,
    });
  }

  /** Flip the camera framing (whole ⇄ follow) and update the toggle glyph. */
  private toggleFraming(): void {
    if (!this.pixiGame) return;
    hapticLight();
    sound.play('tap');
    const next = this.pixiGame.getFraming() === 'whole' ? 'follow' : 'whole';
    this.pixiGame.setFraming(next);
    this.syncZoomToggle();
  }

  private syncZoomToggle(): void {
    const btn = this.root.querySelector('#tycoon-zoom');
    if (btn && this.pixiGame) {
      btn.textContent = this.pixiGame.getFraming() === 'follow' ? '⤢' : '⊕';
    }
  }

  // ── Rails (cockpit/compact) ────────────────────────────────────────────────

  /** Append a game event to the recent-activity feed (newest-first, capped) and
   *  re-render the right rail if it's mounted. */
  private pushFeedEvent(e: TycoonEvent): void {
    this.feed.unshift(e);
    if (this.feed.length > FEED_MAX) this.feed.length = FEED_MAX;
    this.renderRightRail();
  }

  /** Render both rails from the live game's polled state. No-op when no rails. */
  private renderRails(): void {
    this.renderLeftRail();
    this.renderRightRail();
  }

  private renderLeftRail(): void {
    const rail = document.getElementById('tycoon-rail-left');
    const top = document.getElementById('tycoon-topstats');
    if (!rail && !top) return;
    if (!this.pixiGame) return;
    const s = this.pixiGame.getRailState();

    if (top) {
      top.innerHTML = `
        <div class="tycoon-chip" title="Coins">🪙 <b>${s.coins.toLocaleString()}</b></div>
        <div class="tycoon-chip" title="Dice">🎲 <b>${s.dice}</b></div>
        <div class="tycoon-chip" title="Shields">🛡 <b>${s.shields}</b></div>
        <div class="tycoon-chip" title="Board level">🏙 <b>Lv ${s.boardLevel}</b></div>`;
    }
    if (rail) {
      const pct = Math.round((s.landmarksBuilt / 4) * 100);
      const nextLine = s.nextLandmarkCost != null
        ? `<div class="tycoon-rail-row"><span>${this.esc(s.nextLandmarkName ?? 'Landmark')}</span><b>${s.nextLandmarkCost.toLocaleString()}🪙</b></div>`
        : `<div class="tycoon-rail-row"><span>Board complete!</span></div>`;
      rail.innerHTML = `
        <div class="tycoon-rail-card">
          <div class="tycoon-rail-title">Next Landmark</div>
          ${nextLine}
          <div class="tycoon-progress"><div class="tycoon-progress-fill" style="width:${pct}%"></div></div>
          <div class="tycoon-rail-sub">${s.landmarksBuilt} / 4 built · ${this.esc(s.themeName)}</div>
        </div>
        <div class="tycoon-rail-card">
          <div class="tycoon-rail-title">Stats</div>
          <div class="tycoon-rail-row"><span>Board level</span><b>${s.boardLevel}</b></div>
          <div class="tycoon-rail-row"><span>Shields</span><b>${s.shields}</b></div>
          <div class="tycoon-rail-row"><span>Stickers owned</span><b>${s.stickersOwned}</b></div>
          <div class="tycoon-rail-row"><span>Dice</span><b>${s.dice}</b></div>
        </div>`;
    }
  }

  private renderRightRail(): void {
    const rail = document.getElementById('tycoon-rail-right');
    if (!rail) return;
    const items = this.feed.length
      ? this.feed.map((e) => {
          const icon = FEED_ICON[e.kind] ?? '•';
          const delta = e.coins != null && e.coins !== 0
            ? `<span class="tycoon-feed-delta ${e.coins < 0 ? 'neg' : 'pos'}">${e.coins > 0 ? '+' : ''}${e.coins.toLocaleString()}</span>`
            : '';
          return `<li class="tycoon-feed-item"><span class="tycoon-feed-icon">${icon}</span><span class="tycoon-feed-text">${this.esc(e.text)}</span>${delta}</li>`;
        }).join('')
      : `<li class="tycoon-feed-empty">Roll to see the action…</li>`;
    rail.innerHTML = `
      ${this.quickWinsRailCardMarkup()}
      <div class="tycoon-rail-card tycoon-feed-card">
        <div class="tycoon-rail-title">Recent Activity</div>
        <ul class="tycoon-feed">${items}</ul>
      </div>`;
    // Wire the rail's compact Claim buttons (same handler as the Tasks view).
    this.bindTasksHandlers(rail);
  }

  /** Compact Quick Wins card for the desktop right rail: streak dots + the 3
   *  tasks with mini progress bars + inline Claim buttons. */
  private quickWinsRailCardMarkup(): string {
    const qw = this.quickWins;
    if (!qw) return '';
    const filled = Math.min(qw.streak, STREAK_GRAND_PRIZE_DAYS);
    const dots = Array.from({ length: STREAK_GRAND_PRIZE_DAYS }, (_, i) =>
      `<span class="tycoon-streak-dot ${i < filled ? 'on' : ''} ${i === STREAK_GRAND_PRIZE_DAYS - 1 ? 'grand' : ''}"></span>`,
    ).join('');
    const rows = qw.tasks.map((t) => {
      const pct = Math.max(0, Math.min(100, Math.round((t.progress / Math.max(1, t.target)) * 100)));
      const claim = qwIsClaimable(t)
        ? `<button class="tycoon-task-claim tycoon-task-claim-mini" data-claim="${t.type}">Claim</button>`
        : `<span class="tycoon-rail-prog">${Math.min(t.progress, t.target)}/${t.target}</span>`;
      return `
        <div class="tycoon-rail-task ${t.claimed ? 'claimed' : ''}">
          <div class="tycoon-rail-task-top"><span>${this.esc(t.label)}</span>${claim}</div>
          <div class="tycoon-progress"><div class="tycoon-progress-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');
    const all = qwAllComplete(qw.tasks);
    const bonus = all && !qw.dailyBonusClaimed
      ? `<button class="tycoon-task-claim tycoon-task-claim-mini" data-claim="__bonus__">Claim daily bonus</button>`
      : '';
    return `
      <div class="tycoon-rail-card tycoon-quickwins-card">
        <div class="tycoon-rail-title">Quick Wins · 🔥 ${qw.streak}</div>
        <div class="tycoon-streak-dots tycoon-streak-dots-mini">${dots}</div>
        ${rows}
        ${bonus}
      </div>`;
  }

  /** Minimal HTML-escape for state-derived strings (theme/landmark names). */
  private esc(s: string): string {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
  }

  private async handleWin(finalScore: number): Promise<void> {
    // Dice Tycoon is continuable after win — celebrate only, keep playing.
    await saveScore(GAME_ID, finalScore, undefined, this.currentDifficulty);
    const container = document.getElementById('game-container');
    if (!container) return;
    confettiBurst(container);
    const banner = document.createElement('div');
    banner.className = 'tycoon-win-banner';
    banner.textContent = pickWinMessage(this.winMessageCounter++);
    container.appendChild(banner);
    setTimeout(() => banner.remove(), 2200);
  }

  private async handleGameOver(finalScore: number): Promise<void> {
    await saveScore(GAME_ID, finalScore, undefined, this.currentDifficulty);
    const stats = await getStats(GAME_ID);
    const isBest = finalScore >= stats.bestScore;
    const container = document.getElementById('game-container');
    if (!container) return;

    const overlay = document.createElement('div');
    overlay.className = `game-over${isBest ? ' win' : ''}`;
    overlay.innerHTML = `
      <div class="overlay-card">
        <h2>${isBest ? 'New Best!' : 'Game Over'}</h2>
        <div class="final-score">${finalScore.toLocaleString()}</div>
        <div class="best-label">Best: ${stats.bestScore.toLocaleString()} • Games: ${stats.totalGames}</div>
      </div>
    `;
    container.appendChild(overlay);
    if (isBest) confettiBurst(container);

    // Auto-return home after the celebration, mirroring the main app's flow.
    setTimeout(() => this.exitGame(), 2500);
  }

  private exitGame(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    cancelAnimationFrame(this.resizeRaf);
    if (this.railTimer) {
      clearInterval(this.railTimer);
      this.railTimer = null;
    }
    this.layout = null;
    this.feed = [];
    this.gameView = 'play';
    // Persist + clear today's Quick Wins (the game's onQuickWin already saved on
    // each change; this is a final flush in case a claim happened just before).
    if (this.quickWins) {
      void saveQuickWins(this.quickWins);
      this.quickWins = null;
    }
    if (this.pixiGame) {
      const game = this.pixiGame;
      this.pixiGame = null;
      // Persist the (game, difficulty) slot via the SHARED core snapshot so the
      // canvas view and Pixi view round-trip the same save format. Fire-and-
      // forget — destroy() immediately so the GPU tears down promptly.
      const snapshot = game.serialize();
      const score = game.getScore();
      const won = game.getScore() > 0 && (snapshot.boardLevel as number) > 1;
      void saveGameState(GAME_ID, {
        state: snapshot,
        score,
        won,
        difficulty: this.currentDifficulty,
      });
      game.destroy();
    }
    this.showHome();
  }

  // ── Settings stub ──────────────────────────────────────────────────────────

  private async showSettings(): Promise<void> {
    this.currentScreen = 'settings';
    const settings = await getSettings();
    this.root.innerHTML = `
      <div class="tycoon-settings">
        <div class="tycoon-topbar">
          <button class="tycoon-icon-btn" id="tycoon-settings-back" aria-label="Back"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>
          <h2 class="header-title">Settings</h2>
          <span style="width:40px"></span>
        </div>
        <div class="settings-group">
          <div class="settings-group-title">Audio</div>
          <div class="settings-item">
            <span class="settings-label">Sound effects</span>
            <button class="toggle${settings.soundEnabled ? ' active' : ''}" id="t-sound" role="switch" aria-checked="${settings.soundEnabled}"></button>
          </div>
          <div class="settings-item">
            <span class="settings-label">Vibration</span>
            <button class="toggle${settings.vibrationEnabled ? ' active' : ''}" id="t-vibration" role="switch" aria-checked="${settings.vibrationEnabled}"></button>
          </div>
        </div>
      </div>
    `;

    this.root.querySelector('#tycoon-settings-back')!.addEventListener('click', () => {
      hapticLight();
      sound.play('tap');
      this.showHome();
    });

    const persist = async (patch: Partial<AppSettings>): Promise<void> => {
      const next = { ...(await getSettings()), ...patch };
      await saveSettings(next);
    };

    const soundBtn = this.root.querySelector('#t-sound') as HTMLElement;
    soundBtn.addEventListener('click', async () => {
      const on = !soundBtn.classList.contains('active');
      soundBtn.classList.toggle('active', on);
      soundBtn.setAttribute('aria-checked', String(on));
      sound.enabled = on;
      if (on) sound.play('tap');
      await persist({ soundEnabled: on });
    });

    const vibBtn = this.root.querySelector('#t-vibration') as HTMLElement;
    vibBtn.addEventListener('click', async () => {
      const on = !vibBtn.classList.contains('active');
      vibBtn.classList.toggle('active', on);
      vibBtn.setAttribute('aria-checked', String(on));
      setHapticsEnabled(on);
      if (on) hapticLight();
      await persist({ vibrationEnabled: on });
    });
  }
}
