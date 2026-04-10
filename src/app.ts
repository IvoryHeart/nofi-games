import { getAllGames, getGame, GameInfo } from './games/registry';
import { GAME_ICONS } from './games/icons';
import { GameEngine, GameConfig, ResumeData } from './engine/GameEngine';
import {
  saveScore, getStats, GameStats,
  getFavourites, toggleFavourite,
  getGameSettings, saveGameSettings,
  getSettings, saveSettings, AppSettings,
} from './storage/scores';
import {
  saveGameState, loadGameState, clearGameState,
} from './storage/gameState';
import {
  markDailyComplete, isDailyComplete, getStreak, bumpStreak, StreakData,
} from './storage/daily';
import { dailySeed, todayDateString } from './utils/rng';
import { sound } from './utils/audio';
import { hapticLight, hapticMedium, hapticHeavy, hapticError, setHapticsEnabled } from './utils/haptics';
import { bindKeys, KeyMap } from './utils/keyboardNav';
import { burst as confettiBurst, pickWinMessage } from './utils/confetti';
import { showHelpOverlay, buildGameHelp, buildScreenHelp } from './utils/helpOverlay';
import { registerDevice, sendSession, queuePartialSession, flushPendingQueue, removeFromQueue } from './telemetry/client';
import { hasConsent, setConsent, showConsentPrompt } from './telemetry/consent';

const DIFF_COLORS = ['#5CB85C', '#F5A623', '#E85D5D', '#6B4566'];
const DIFF_LABELS = ['Easy', 'Medium', 'Hard', 'Extra Hard'];

type Screen = 'home' | 'difficulty' | 'game' | 'scores' | 'settings' | 'daily';

export class App {
  private root: HTMLElement;
  private currentScreen: Screen = 'home';
  private currentGameId: string | null = null;
  private currentDifficulty = 0;
  private gameInstance: GameEngine | null = null;
  private favourites: string[] = [];
  private resizeHandler: (() => void) | null = null;
  private justWon = false;
  private hasSavedGame = false;
  private keyUnbind: (() => void) | null = null;
  private currentDailyMode = false;
  /** Unique ID for the current play session — ties partial + final telemetry. */
  private sessionId = '';
  /** Incremented every time a win celebration is shown, so the congratulatory
   *  message rotates rather than repeating. Persists across games in a session. */
  private winMessageCounter = 0;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async mount(): Promise<void> {
    this.favourites = await getFavourites();

    // Auto-save + queue partial telemetry when the user backgrounds the tab/app.
    // Fire-and-forget: these handlers can't reliably await on iOS Safari before
    // the page is suspended, so we kick off IDB writes synchronously.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void this.autoSave();
        this.queueTelemetrySnapshot();
      }
    });
    window.addEventListener('beforeunload', () => {
      void this.autoSave();
      this.queueTelemetrySnapshot();
    });
    window.addEventListener('blur', () => { void this.autoSave(); });

    await this.showHome();

    // First-launch consent prompt (shown once, non-blocking after that).
    await showConsentPrompt(document.body);

    // Register the anonymous device with Supabase (if consent was granted),
    // then flush any partial sessions queued from a previous app kill/background.
    void registerDevice().then(() => flushPendingQueue());
    window.addEventListener('popstate', () => {
      if (this.currentScreen === 'game') this.exitGame();
      else if (this.currentScreen === 'difficulty') this.showHome();
      else if (this.currentScreen === 'scores') this.showDifficulty(this.currentGameId!);
      else if (this.currentScreen === 'settings') this.showHome();
      else if (this.currentScreen === 'daily') this.showHome();
      else this.showHome();
    });
  }

  /** Replace the active document-level keybindings. Each screen calls this on entry,
   *  and the bindings are automatically swapped when the next screen registers its own. */
  private setKeys(map: KeyMap): void {
    if (this.keyUnbind) this.keyUnbind();
    this.keyUnbind = bindKeys(map);
  }

  /** Persist current game state if the engine reports it can be saved.
   *  Returns the IDB write promise so callers (e.g. exitGame) can await it,
   *  closing the race window between save and a subsequent loadGameState read. */
  private autoSave(): Promise<void> {
    if (!this.gameInstance || !this.currentGameId) return Promise.resolve();
    if (!this.gameInstance.isRunning()) return Promise.resolve();
    if (!this.gameInstance.canSave()) return Promise.resolve();
    const state = this.gameInstance.serialize();
    if (!state) return Promise.resolve();
    return saveGameState(this.currentGameId, {
      state,
      score: this.gameInstance.getScore(),
      won: this.gameInstance.isWon(),
      difficulty: this.currentDifficulty,
    });
  }

  // ═══════ HOME SCREEN ═══════
  private async showHome(): Promise<void> {
    this.currentScreen = 'home';
    this.currentGameId = null;
    const games = getAllGames();
    const streak = await getStreak();
    const today = todayDateString();
    const dailyGames = games.filter((g) => g.dailyMode);
    let dailyDoneToday = 0;
    for (const g of dailyGames) {
      if (await isDailyComplete(g.id, today)) dailyDoneToday++;
    }

    // Sort: favourites first
    const sorted = [...games].sort((a, b) => {
      const aFav = this.favourites.includes(a.id) ? 0 : 1;
      const bFav = this.favourites.includes(b.id) ? 0 : 1;
      return aFav - bFav;
    });

    this.root.innerHTML = `
      <nav class="header" role="navigation">
        <div class="header-title">NoFi.Games</div>
        <div class="header-actions">
          <button class="header-back" id="share-btn" style="background:var(--color-primary-light);" aria-label="Share">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          <button class="header-back" id="settings-btn" style="background:var(--color-primary-light);" aria-label="Settings">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </button>
        </div>
      </nav>
      <div class="content">
        <div class="home">
          <div class="home-hero">
            <div class="brand-logo" aria-hidden="true">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="heroLogoBg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#8B5E83"/>
                    <stop offset="100%" stop-color="#E89040"/>
                  </linearGradient>
                </defs>
                <rect width="64" height="64" rx="14" fill="url(#heroLogoBg)"/>
                <g fill="#FEF0E4">
                  <rect x="22" y="14" width="4" height="36"/>
                  <rect x="26" y="18" width="4" height="28"/>
                  <rect x="30" y="22" width="4" height="20"/>
                  <rect x="34" y="26" width="4" height="12"/>
                  <rect x="38" y="30" width="4" height="4"/>
                </g>
              </svg>
            </div>
            <h1>NoFi.Games</h1>
            <p>Play offline, anywhere</p>
          </div>
          ${dailyGames.length > 0 ? `
            <button class="today-card" id="today-card" type="button">
              <div class="today-card-left">
                <div class="today-card-label">Today's puzzles</div>
                <div class="today-card-progress">${dailyDoneToday} of ${dailyGames.length} solved</div>
              </div>
              <div class="today-card-right">
                <div class="today-card-streak">${streak.current > 0 ? `\u{1F525} ${streak.current}` : 'Start a streak'}</div>
                <div class="today-card-cta">\u2192</div>
              </div>
            </button>
          ` : ''}
          <div class="games-grid" id="games-grid"></div>
        </div>
      </div>
    `;

    this.root.querySelector('#share-btn')!.addEventListener('click', () => this.shareApp());
    this.root.querySelector('#settings-btn')!.addEventListener('click', () => this.showSettings());
    this.root.querySelector('#today-card')?.addEventListener('click', () => this.showDaily());

    const grid = this.root.querySelector('#games-grid')!;
    sorted.forEach((game, i) => {
      const isFav = this.favourites.includes(game.id);
      const card = document.createElement('div');
      card.className = 'game-card fade-in';
      card.style.animationDelay = `${i * 40}ms`;
      // Make cards keyboard-focusable so Tab + Enter/Space launches them
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Play ${game.name}`);
      const [g1, g2] = game.bgGradient || [game.color.replace('--', 'var(--') + ')', game.color.replace('--', 'var(--') + ')'];
      const bg = game.bgGradient
        ? `linear-gradient(135deg, ${g1}, ${g2})`
        : `var(${game.color})`;
      card.innerHTML = `
        <button class="game-card-fav ${isFav ? 'active' : ''}" data-id="${game.id}" aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}">${isFav ? '\u2605' : '\u2606'}</button>
        <div class="game-card-thumb" style="background:${bg}">${GAME_ICONS[game.id] ? `<div class="game-card-thumb-svg">${GAME_ICONS[game.id]}</div>` : game.icon}</div>
        <div class="game-card-info">
          <div class="game-card-name">${game.name}</div>
          <div class="game-card-desc">${game.description}</div>
          <div class="game-card-best" id="best-${game.id}">...</div>
        </div>
      `;
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.game-card-fav')) return;
        this.showDifficulty(game.id);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.showDifficulty(game.id);
        }
      });
      card.querySelector('.game-card-fav')!.addEventListener('click', async (e) => {
        e.stopPropagation();
        const btn = e.currentTarget as HTMLElement;
        const nowFav = await toggleFavourite(game.id);
        this.favourites = await getFavourites();
        btn.textContent = nowFav ? '\u2605' : '\u2606';
        btn.classList.toggle('active', nowFav);
      });
      grid.appendChild(card);

      getStats(game.id).then(stats => {
        const el = document.getElementById(`best-${game.id}`);
        if (el) el.textContent = stats.bestScore > 0 ? `Best: ${stats.bestScore.toLocaleString()}` : 'Tap to play';
      });
    });

    // Home shortcuts: Comma/S → settings, / → focus first card, T → daily
    this.setKeys({
      ',': () => this.showSettings(),
      's': () => this.showSettings(),
      'S': () => this.showSettings(),
      't': () => { if (dailyGames.length > 0) this.showDaily(); },
      'T': () => { if (dailyGames.length > 0) this.showDaily(); },
      '/': () => {
        const firstCard = this.root.querySelector('.game-card') as HTMLElement | null;
        firstCard?.focus();
      },
      '?': () => showHelpOverlay(document.body, buildScreenHelp('Home')),
      'h': () => showHelpOverlay(document.body, buildScreenHelp('Home')),
      'H': () => showHelpOverlay(document.body, buildScreenHelp('Home')),
    });
  }

  // ═══════ DAILY MODE SCREEN ═══════
  private async showDaily(): Promise<void> {
    this.currentScreen = 'daily';
    history.pushState({ screen: 'daily' }, '');
    const today = todayDateString();
    const allGames = getAllGames();
    const dailyGames = allGames.filter((g) => g.dailyMode);
    const streak = await getStreak();

    // Pre-compute completion state for each game so we can render synchronously
    const completed = new Map<string, boolean>();
    for (const g of dailyGames) {
      completed.set(g.id, await isDailyComplete(g.id, today));
    }
    const doneCount = Array.from(completed.values()).filter(Boolean).length;
    const friendlyDate = new Date(today).toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    this.root.innerHTML = `
      <div class="daily-screen">
        <nav class="header" role="navigation">
          <button class="header-back" id="daily-back" aria-label="Back"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>
          <div class="header-title">Daily</div>
          <div class="header-actions"></div>
        </nav>
        <div class="content">
          <div class="daily-hero">
            <div class="daily-date">${friendlyDate}</div>
            <div class="daily-streak-row">
              <div class="daily-streak-stat">
                <div class="daily-streak-num">${streak.current}</div>
                <div class="daily-streak-label">Current streak</div>
              </div>
              <div class="daily-streak-stat">
                <div class="daily-streak-num">${streak.best}</div>
                <div class="daily-streak-label">Best</div>
              </div>
              <div class="daily-streak-stat">
                <div class="daily-streak-num">${doneCount}/${dailyGames.length}</div>
                <div class="daily-streak-label">Solved today</div>
              </div>
            </div>
          </div>
          <div class="daily-list" id="daily-list"></div>
        </div>
      </div>
    `;

    this.root.querySelector('#daily-back')!.addEventListener('click', () => history.back());

    const list = this.root.querySelector('#daily-list')!;
    dailyGames.forEach((game, i) => {
      const isDone = completed.get(game.id) === true;
      const [g1, g2] = game.bgGradient || ['var(--color-primary)', 'var(--color-primary-light)'];
      const bg = `linear-gradient(135deg, ${g1}, ${g2})`;
      const row = document.createElement('button');
      row.className = `daily-row fade-in ${isDone ? 'done' : ''}`;
      row.style.animationDelay = `${i * 40}ms`;
      row.type = 'button';
      row.innerHTML = `
        <div class="daily-row-thumb" style="background:${bg}">
          ${GAME_ICONS[game.id] ? `<div class="game-card-thumb-svg">${GAME_ICONS[game.id]}</div>` : game.icon}
        </div>
        <div class="daily-row-info">
          <div class="daily-row-name">${game.name}</div>
          <div class="daily-row-status">${isDone ? '\u2713 Solved' : 'Tap to play today\u2019s puzzle'}</div>
        </div>
        <div class="daily-row-cta">${isDone ? '\u2713' : '\u25B6'}</div>
      `;
      row.addEventListener('click', () => {
        // Daily mode launches the game with today's seed at Medium difficulty.
        // The difficulty is locked so everyone solves the same puzzle.
        this.startGame(game.id, 1, false, true);
      });
      list.appendChild(row);
    });

    // Daily-screen shortcuts: Escape → back, 1-9 → quick launch
    this.setKeys({
      Escape: () => history.back(),
      '?': () => showHelpOverlay(document.body, buildScreenHelp('Daily')),
      '1': () => (list.children[0] as HTMLElement | undefined)?.click(),
      '2': () => (list.children[1] as HTMLElement | undefined)?.click(),
      '3': () => (list.children[2] as HTMLElement | undefined)?.click(),
      '4': () => (list.children[3] as HTMLElement | undefined)?.click(),
      '5': () => (list.children[4] as HTMLElement | undefined)?.click(),
      '6': () => (list.children[5] as HTMLElement | undefined)?.click(),
      '7': () => (list.children[6] as HTMLElement | undefined)?.click(),
      '8': () => (list.children[7] as HTMLElement | undefined)?.click(),
      '9': () => (list.children[8] as HTMLElement | undefined)?.click(),
    });
  }

  // ═══════ DIFFICULTY PRE-SCREEN ═══════
  private async showDifficulty(gameId: string): Promise<void> {
    const game = getGame(gameId);
    if (!game) return;
    this.currentScreen = 'difficulty';
    this.currentGameId = gameId;
    history.pushState({ screen: 'difficulty' }, '');

    const gs = await getGameSettings(gameId);
    this.currentDifficulty = gs.lastDifficulty;
    // Saves are per (game, difficulty) so the slider is never locked — each
    // level has its own independent save slot. Check the currently-selected
    // difficulty's save and update the UI on slider change.
    let saved = await loadGameState(gameId, this.currentDifficulty);
    this.hasSavedGame = saved != null;

    const isFav = this.favourites.includes(gameId);

    const playBtnInner = saved
      ? `Resume<span>${DIFF_LABELS[saved.difficulty]} \u2022 ${saved.score.toLocaleString()}</span>`
      : `Play<span>Level 1</span>`;
    const startOverLink = saved
      ? `<button class="diff-startover-link" id="diff-startover">Start over (discard this save)</button>`
      : '';

    this.root.innerHTML = `
      <div class="diff-screen">
        <nav class="header" role="navigation">
          <button class="header-back" id="diff-back" aria-label="Back"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>
          <div class="header-title">${game.name}</div>
          <div class="header-actions">
            <button class="header-back" id="diff-fav" style="background:${isFav ? '#F5A623' : 'var(--color-primary-light)'}; font-size:22px;" aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}">${isFav ? '\u2605' : '\u2606'}</button>
            <button class="header-back" id="diff-settings" style="background:var(--color-primary-light);" aria-label="Game settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </button>
          </div>
        </nav>
        <div class="diff-top">
          <p>${game.description}<br><em style="font-size:11px;color:var(--text-muted);">${game.controls || ''}</em></p>
        </div>
        <div class="diff-body">
          <div class="diff-face" id="diff-face">
            <canvas id="face-canvas" width="200" height="200"></canvas>
          </div>
          <div class="diff-label" id="diff-label">${DIFF_LABELS[this.currentDifficulty]}</div>
          <div class="diff-slider-wrap">
            <div class="diff-slider-track">
              <div class="diff-slider-track-bg" style="background:linear-gradient(to right, #5CB85C, #F5A623, #E85D5D, #6B4566);"></div>
              <div class="diff-slider-fill" id="diff-fill"></div>
            </div>
            <input type="range" class="diff-slider" id="diff-slider" min="0" max="3" step="1" value="${this.currentDifficulty}">
          </div>
        </div>
        <div class="diff-actions">
          <button class="diff-play-btn" id="diff-play">
            ${playBtnInner}
          </button>
          <button class="diff-help-btn" id="diff-help" style="background:var(--bg-secondary);color:var(--text-secondary);">?</button>
        </div>
        <div id="diff-startover-wrap">${startOverLink}</div>
        <div class="hills-bg"></div>
      </div>
    `;

    this.updateDifficultyUI(this.currentDifficulty);

    this.root.querySelector('#diff-back')!.addEventListener('click', () => { history.back(); });
    this.root.querySelector('#diff-play')!.addEventListener('click', () => {
      saveGameSettings(gameId, { lastDifficulty: this.currentDifficulty });
      this.startGame(gameId, this.currentDifficulty, this.hasSavedGame);
    });

    // Re-render only the resume UI (Play button label + start-over link) when the
    // slider moves, without rebuilding the whole screen. Each difficulty has its
    // own save slot so the resume banner changes as the slider moves.
    const refreshResumeUI = async (): Promise<void> => {
      saved = await loadGameState(gameId, this.currentDifficulty);
      this.hasSavedGame = saved != null;
      const playBtn = this.root.querySelector('#diff-play') as HTMLButtonElement | null;
      if (playBtn) {
        playBtn.innerHTML = saved
          ? `Resume<span>${DIFF_LABELS[saved.difficulty]} \u2022 ${saved.score.toLocaleString()}</span>`
          : `Play<span>Level ${this.currentDifficulty + 1}</span>`;
      }
      const startoverWrap = this.root.querySelector('#diff-startover-wrap');
      if (startoverWrap) {
        startoverWrap.innerHTML = saved
          ? `<button class="diff-startover-link" id="diff-startover">Start over (discard this save)</button>`
          : '';
        startoverWrap.querySelector('#diff-startover')?.addEventListener('click', async () => {
          if (!saved) return;
          await clearGameState(gameId, this.currentDifficulty);
          this.hasSavedGame = false;
          await refreshResumeUI();
        });
      }
    };
    // Wire the initial start-over click (refreshResumeUI rewires on each change)
    this.root.querySelector('#diff-startover')?.addEventListener('click', async () => {
      if (!saved) return;
      await clearGameState(gameId, this.currentDifficulty);
      this.hasSavedGame = false;
      await refreshResumeUI();
    });
    this.root.querySelector('#diff-fav')!.addEventListener('click', async () => {
      const nowFav = await toggleFavourite(gameId);
      this.favourites = await getFavourites();
      const btn = this.root.querySelector('#diff-fav') as HTMLElement;
      btn.textContent = nowFav ? '\u2605' : '\u2606';
      btn.style.background = nowFav ? '#F5A623' : 'var(--color-primary-light)';
    });
    this.root.querySelector('#diff-settings')!.addEventListener('click', () => {
      this.showPerGameSettings(game);
    });
    this.root.querySelector('#diff-help')!.addEventListener('click', () => {
      // Brief help
      const helpOverlay = document.createElement('div');
      helpOverlay.className = 'game-settings-overlay';
      helpOverlay.innerHTML = `
        <div class="game-settings-card">
          <h3>How to Play</h3>
          <p style="font-size:14px;line-height:1.6;color:var(--text-secondary);">${game.controls || game.description}</p>
          <br>
          <button class="btn btn-primary" style="width:100%;" id="help-close">Got it</button>
        </div>
      `;
      helpOverlay.addEventListener('click', (e) => {
        if (e.target === helpOverlay || (e.target as HTMLElement).id === 'help-close') helpOverlay.remove();
      });
      document.body.appendChild(helpOverlay);
    });

    const slider = this.root.querySelector('#diff-slider') as HTMLInputElement;
    slider.addEventListener('input', () => {
      const newDiff = parseInt(slider.value);
      if (newDiff !== this.currentDifficulty) {
        hapticLight();
        sound.play('select');
      }
      this.currentDifficulty = newDiff;
      this.updateDifficultyUI(this.currentDifficulty);
      // Each difficulty has its own save slot, so the resume banner must
      // update as the slider moves.
      void refreshResumeUI();
    });

    // Auto-focus the slider so left/right arrows work without clicking first.
    // <input type="range"> handles ←/→ and ↑/↓ natively. Slider is always
    // unlocked now (per-level saves) so always auto-focus.
    slider.focus();

    // Document-level keys: Enter → Play/Resume, Escape → back, F → favourite, ?/H → help
    this.setKeys({
      Enter: () => {
        const playBtn = this.root.querySelector('#diff-play') as HTMLButtonElement | null;
        playBtn?.click();
      },
      Escape: () => history.back(),
      f: () => {
        const favBtn = this.root.querySelector('#diff-fav') as HTMLButtonElement | null;
        favBtn?.click();
      },
      F: () => {
        const favBtn = this.root.querySelector('#diff-fav') as HTMLButtonElement | null;
        favBtn?.click();
      },
      '?': () => {
        const helpBtn = this.root.querySelector('#diff-help') as HTMLButtonElement | null;
        helpBtn?.click();
      },
      h: () => {
        const helpBtn = this.root.querySelector('#diff-help') as HTMLButtonElement | null;
        helpBtn?.click();
      },
      H: () => {
        const helpBtn = this.root.querySelector('#diff-help') as HTMLButtonElement | null;
        helpBtn?.click();
      },
    });
  }

  private updateDifficultyUI(diff: number): void {
    const color = DIFF_COLORS[diff];
    const label = DIFF_LABELS[diff];

    const labelEl = document.getElementById('diff-label');
    if (labelEl) { labelEl.textContent = label; labelEl.style.color = color; }

    const playBtn = document.getElementById('diff-play') as HTMLElement;
    if (playBtn) playBtn.style.background = color;

    const helpBtn = document.getElementById('diff-help') as HTMLElement;
    if (helpBtn) { helpBtn.style.background = color; helpBtn.style.color = 'white'; }

    const slider = document.getElementById('diff-slider') as HTMLInputElement;
    if (slider) {
      const thumbColor = color;
      slider.style.setProperty('--thumb-color', thumbColor);
      // Dynamic thumb color via style
      const style = document.getElementById('diff-slider-style') || document.createElement('style');
      style.id = 'diff-slider-style';
      style.textContent = `
        .diff-slider::-webkit-slider-thumb { background: ${thumbColor}; }
        .diff-slider::-moz-range-thumb { background: ${thumbColor}; }
      `;
      if (!style.parentNode) document.head.appendChild(style);
    }

    this.drawFace(diff);
  }

  private drawFace(diff: number): void {
    const canvas = document.getElementById('face-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = 200, h = 200, cx = 100, cy = 100, r = 80;
    ctx.clearRect(0, 0, w, h);

    const color = DIFF_COLORS[diff];

    // Shadow
    ctx.beginPath();
    ctx.arc(cx, cy + 4, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fill();

    // Face circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = diff === 3 ? '#2D2040' : color;
    ctx.fill();

    // White ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = diff === 3 ? '#4A3660' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    if (diff === 0) {
      // Happy face - big smile
      // Eyes (happy closed arcs)
      ctx.beginPath();
      ctx.arc(cx - 25, cy - 10, 12, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 25, cy - 10, 12, Math.PI, 0);
      ctx.stroke();
      // Big smile
      ctx.beginPath();
      ctx.arc(cx, cy + 5, 35, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else if (diff === 1) {
      // Neutral face - flat eyes, flat mouth
      // Eyes (circles)
      ctx.beginPath();
      ctx.arc(cx - 25, cy - 12, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 25, cy - 12, 8, 0, Math.PI * 2);
      ctx.fill();
      // Flat mouth
      ctx.beginPath();
      ctx.moveTo(cx - 25, cy + 25);
      ctx.lineTo(cx + 25, cy + 25);
      ctx.stroke();
      // Eyebrows (slight furrow)
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 38, cy - 28);
      ctx.lineTo(cx - 14, cy - 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 38, cy - 28);
      ctx.lineTo(cx + 14, cy - 24);
      ctx.stroke();
    } else if (diff === 2) {
      // Angry face
      // Eyes (sharp)
      ctx.beginPath();
      ctx.arc(cx - 25, cy - 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 25, cy - 10, 8, 0, Math.PI * 2);
      ctx.fill();
      // Angry eyebrows
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx - 40, cy - 30);
      ctx.lineTo(cx - 12, cy - 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 40, cy - 30);
      ctx.lineTo(cx + 12, cy - 20);
      ctx.stroke();
      // Frown
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy + 40, 25, 1.2 * Math.PI, 1.8 * Math.PI);
      ctx.stroke();
    } else {
      // Evil/Extra Hard - devil horns, sinister
      // Horns
      ctx.fillStyle = diff === 3 ? '#8B5E83' : 'white';
      ctx.beginPath();
      ctx.moveTo(cx - 55, cy - 55);
      ctx.lineTo(cx - 35, cy - 75);
      ctx.lineTo(cx - 25, cy - 45);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 55, cy - 55);
      ctx.lineTo(cx + 35, cy - 75);
      ctx.lineTo(cx + 25, cy - 45);
      ctx.fill();

      ctx.fillStyle = 'white';
      // Narrow eyes
      ctx.beginPath();
      ctx.ellipse(cx - 25, cy - 8, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 25, cy - 8, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupils
      ctx.fillStyle = diff === 3 ? '#2D2040' : color;
      ctx.beginPath();
      ctx.arc(cx - 25, cy - 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 25, cy - 8, 4, 0, Math.PI * 2);
      ctx.fill();

      // Sinister smile
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy + 10, 30, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.stroke();
    }
  }

  private showPerGameSettings(game: GameInfo): void {
    const overlay = document.createElement('div');
    overlay.className = 'game-settings-overlay';
    overlay.innerHTML = `
      <div class="game-settings-card">
        <h3>Settings</h3>
        ${game.perGameSettings?.map(s => `
          <div class="settings-item">
            <span class="settings-label">${s.label}</span>
            <button class="toggle" data-key="${s.key}"></button>
          </div>
        `).join('') || ''}
        <div class="settings-item" style="border-top:1px solid var(--bg-secondary);margin-top:8px;padding-top:12px;">
          <span class="settings-label" style="color:var(--color-danger);font-weight:700;">Reset Progress</span>
          <button class="btn btn-secondary" style="padding:8px 16px;font-size:12px;background:var(--color-danger);color:white;" id="reset-progress">Reset</button>
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:16px;" id="close-gsettings">Done</button>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector('#close-gsettings')!.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#reset-progress')?.addEventListener('click', () => {
      // TODO: implement reset
      overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  // ═══════ GAME SCREEN (FULL SCREEN) ═══════
  private async startGame(
    gameId: string,
    difficulty: number,
    tryResume = false,
    dailyMode = false,
  ): Promise<void> {
    const game = getGame(gameId);
    if (!game) return;
    this.currentScreen = 'game';
    this.currentGameId = gameId;
    this.currentDifficulty = difficulty;
    this.currentDailyMode = dailyMode;
    this.justWon = false;
    this.sessionId = crypto.randomUUID();

    const stats = await getStats(gameId);
    history.pushState({ screen: 'game' }, '');

    // Daily mode never auto-resumes — each day is a fresh attempt at the same seeded puzzle.
    let resume: ResumeData | null = null;
    if (tryResume && !dailyMode) {
      // Per-level saves: load the slot for the exact difficulty we're starting.
      const saved = await loadGameState(gameId, difficulty);
      if (saved) {
        resume = { state: saved.state, score: saved.score, won: saved.won };
      }
    }
    const initialScore = resume?.score ?? 0;

    // Show loading state first
    this.root.innerHTML = `
      <div class="game-screen">
        <div class="game-container" id="game-container">
          <div class="game-loading">
            <div class="loading-spinner"></div>
          </div>
          <canvas id="game-canvas"></canvas>
          <div class="game-hud-overlay">
            <button class="hud-btn" id="hud-back" aria-label="Exit game"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>
            <div class="hud-score-pill">
              <div class="hud-stat">
                <div class="hud-stat-label">Score</div>
                <div class="hud-stat-value" id="hud-score">${initialScore.toLocaleString()}</div>
              </div>
              <div class="hud-stat">
                <div class="hud-stat-label">Best</div>
                <div class="hud-stat-value" id="hud-best">${stats.bestScore.toLocaleString()}</div>
              </div>
            </div>
            <button class="hud-btn" id="hud-pause" aria-label="Pause">\u23F8</button>
          </div>
        </div>
      </div>
    `;

    this.root.querySelector('#hud-back')!.addEventListener('click', () => {
      hapticLight();
      sound.play('tap');
      this.exitGame();
    });
    this.root.querySelector('#hud-pause')!.addEventListener('click', () => {
      if (this.gameInstance) {
        hapticLight();
        if (this.gameInstance.isPaused()) {
          this.gameInstance.resume();
        } else {
          this.gameInstance.pause();
        }
      }
    });

    // Game-screen shortcuts: Escape → back, ? → help. Pause toggle is exposed
    // via the HUD button; we deliberately do NOT bind P/Space here because
    // individual games may use those keys for gameplay (e.g. hard-drop in
    // Block Drop).
    this.setKeys({
      Escape: () => this.exitGame(),
      '?': () => showHelpOverlay(document.body, buildGameHelp(game.name, [
        { kind: 'keyboard', rows: [[game.controls || 'See the game help', '']] },
      ])),
    });

    // Wait a frame for layout to settle before measuring
    await new Promise(r => requestAnimationFrame(r));

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const container = document.getElementById('game-container')!;

    const cw = container.clientWidth;
    const ch = container.clientHeight;

    // Guard against zero dimensions (container not laid out yet)
    if (cw < 10 || ch < 10) {
      await new Promise(r => setTimeout(r, 100));
    }

    const finalCw = container.clientWidth || 360;
    const finalCh = container.clientHeight || 640;

    const gameRatio = game.canvasWidth / game.canvasHeight;
    const containerRatio = finalCw / finalCh;

    let displayW: number, displayH: number;
    if (containerRatio > gameRatio) {
      displayH = finalCh;
      displayW = finalCh * gameRatio;
    } else {
      displayW = finalCw;
      displayH = finalCw / gameRatio;
    }

    displayW = Math.max(Math.floor(displayW), 100);
    displayH = Math.max(Math.floor(displayH), 100);

    const config: GameConfig = {
      canvas,
      width: displayW,
      height: displayH,
      difficulty,
      // Daily mode seeds the puzzle from today's date so every player gets the same one.
      seed: dailyMode ? dailySeed() : undefined,
      onScore: (score) => {
        const el = document.getElementById('hud-score');
        if (el) el.textContent = score.toLocaleString();
      },
      onGameOver: (finalScore) => {
        this.handleGameOver(game, finalScore, stats);
      },
      onWin: (finalScore) => {
        this.handleWin(game, finalScore);
      },
    };

    try {
      this.gameInstance = game.createGame(config);
      this.gameInstance.start(resume);

      // Remove loading overlay
      const loadingEl = container.querySelector('.game-loading');
      if (loadingEl) loadingEl.remove();
    } catch (err) {
      console.error(`Failed to start game ${gameId}:`, err);
      hapticError();
      const container2 = document.getElementById('game-container');
      if (container2) {
        container2.innerHTML = `
          <div class="game-error">
            <div class="game-error-icon">\u26A0</div>
            <h3 style="color:var(--text-primary);font-weight:800;">Oops!</h3>
            <p>Something went wrong loading this game. Try again or choose another game.</p>
            <div class="btn-group" style="margin-top:8px;">
              <button class="btn btn-secondary" id="err-home">Home</button>
              <button class="btn btn-primary" id="err-retry">Retry</button>
            </div>
          </div>
        `;
        container2.querySelector('#err-home')?.addEventListener('click', () => this.exitGame());
        container2.querySelector('#err-retry')?.addEventListener('click', () => {
          this.gameInstance?.destroy();
          this.startGame(gameId, difficulty);
        });
      }
      return;
    }

    // Handle resize
    this.resizeHandler = () => {
      // Resize is complex with canvas games - for now just note it
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  private async handleGameOver(game: GameInfo, finalScore: number, prevStats: GameStats): Promise<void> {
    await saveScore(game.id, finalScore, undefined, this.currentDifficulty);
    await clearGameState(game.id, this.currentDifficulty);
    // Only finishing today's daily puzzle (with a non-zero score, i.e. completed) bumps the streak.
    if (this.currentDailyMode && finalScore > 0) {
      await this.recordDailyCompletion(game.id, finalScore);
    }
    // Send final session telemetry + clear any queued partial for this session.
    if (this.gameInstance) {
      void sendSession({
        sessionId: this.sessionId,
        gameId: game.id,
        difficulty: this.currentDifficulty,
        score: finalScore,
        won: false,
        isDaily: this.currentDailyMode,
        isFinal: true,
        replayLog: this.gameInstance.getEventLog(),
      });
      void removeFromQueue(this.sessionId);
    }
    const newStats = await getStats(game.id);
    const isNewBest = finalScore > prevStats.bestScore;

    // If we just showed a win overlay, the game-over follow-up shouldn't stack a second overlay
    if (this.justWon) {
      this.justWon = false;
      return;
    }

    if (isNewBest) {
      hapticHeavy();
      sound.play('win');
    } else {
      hapticMedium();
    }

    const container = document.getElementById('game-container');
    if (!container) return;

    // New best scores get a celebratory message + confetti. Plain game-overs
    // get a quiet "Game Over" panel with Home + Play Again.
    const title = isNewBest ? pickWinMessage(this.winMessageCounter++) : 'Game Over';

    const overlay = document.createElement('div');
    overlay.className = isNewBest ? 'game-over win' : 'game-over';
    overlay.innerHTML = `
      <h2>${title}</h2>
      <div class="final-score">${finalScore.toLocaleString()}</div>
      <div class="best-label">${isNewBest ? 'New best score' : `Best: ${newStats.bestScore.toLocaleString()} \u2022 Games: ${newStats.totalGames}`}</div>
      <div class="btn-group" style="margin-top:8px;">
        <button class="btn btn-secondary" id="go-home">Home</button>
        <button class="btn btn-primary" id="play-again">Play Again</button>
      </div>
    `;
    container.appendChild(overlay);

    const stopConfetti = isNewBest
      ? confettiBurst(container, { particles: 80 })
      : () => {};

    overlay.querySelector('#play-again')!.addEventListener('click', () => {
      stopConfetti();
      this.gameInstance?.destroy();
      this.startGame(game.id, this.currentDifficulty);
    });
    overlay.querySelector('#go-home')!.addEventListener('click', () => {
      stopConfetti();
      this.exitGame();
    });
  }

  private handleWin(game: GameInfo, finalScore: number): void {
    this.justWon = true;
    hapticHeavy();
    // Pause the game while the celebration is showing
    this.gameInstance?.pause();

    const continuable = !!game.continuableAfterWin;
    const message = pickWinMessage(this.winMessageCounter++);

    // For terminal wins (Sudoku/Minesweeper/MemoryMatch), persist the score now
    // and clear the saved game for this difficulty. The game's gameOver() will
    // follow shortly.
    if (!continuable) {
      void saveScore(game.id, finalScore, undefined, this.currentDifficulty);
      void clearGameState(game.id, this.currentDifficulty);
    }

    // A win in daily mode counts toward the streak immediately, even for
    // continuable games like 2048 — the moment you reach the win target.
    if (this.currentDailyMode) {
      void this.recordDailyCompletion(game.id, finalScore);
    }

    // Send final win telemetry + clear any queued partial for this session.
    if (this.gameInstance) {
      void sendSession({
        sessionId: this.sessionId,
        gameId: game.id,
        difficulty: this.currentDifficulty,
        score: finalScore,
        won: true,
        isDaily: this.currentDailyMode,
        isFinal: true,
        replayLog: this.gameInstance.getEventLog(),
      });
      void removeFromQueue(this.sessionId);
    }

    const container = document.getElementById('game-container');
    if (!container) return;

    const overlay = document.createElement('div');
    overlay.className = 'game-over win';
    // No buttons: the celebration plays for ~2.5 seconds then auto-starts
    // the next game (or auto-resumes for continuable games like 2048).
    // The user can always use the back button to go home at any time since
    // save/resume persists their state.
    overlay.innerHTML = `
      <h2>${message}</h2>
      <div class="final-score">${finalScore.toLocaleString()}</div>
      <div class="best-label">${continuable ? 'Keep going for a higher score' : 'Puzzle complete'}</div>
    `;
    container.appendChild(overlay);

    // Fire confetti across the container — respects prefers-reduced-motion.
    const stopConfetti = confettiBurst(container, { particles: 100 });

    const cleanup = (): void => {
      stopConfetti();
      overlay.remove();
      this.justWon = false;
    };

    // After the confetti finishes (~2.5 seconds), auto-continue or auto-restart.
    const AUTO_CONTINUE_MS = 2500;
    setTimeout(() => {
      // If the user already navigated away (back button), don't start a new game.
      if (this.currentScreen !== 'game') return;

      cleanup();
      if (continuable) {
        // Continuable (2048): just resume play.
        this.gameInstance?.resume();
      } else {
        // Terminal wins: start a fresh game at the same difficulty.
        this.gameInstance?.destroy();
        this.startGame(game.id, this.currentDifficulty);
      }
    }, AUTO_CONTINUE_MS);
  }

  /** Mark today's daily puzzle complete for this game and bump the global streak. */
  private async recordDailyCompletion(gameId: string, score: number): Promise<void> {
    const today = todayDateString();
    // Don't double-record if the user already completed it today.
    if (await isDailyComplete(gameId, today)) return;
    await markDailyComplete(gameId, today, score);
    await bumpStreak(today);
  }

  private async exitGame(): Promise<void> {
    // Snapshot the running game so the player can resume next time. Await
    // here so the IDB write completes before destroy() — otherwise a fast
    // re-open of the same game can race ahead of the pending save and
    // showDifficulty would read null.
    await this.autoSave();

    // Send a partial telemetry checkpoint (we can await here, unlike
    // visibility-hidden which is fire-and-forget). Then clear the IDB
    // queue entry since we've sent directly.
    if (this.gameInstance && this.currentGameId) {
      void sendSession({
        sessionId: this.sessionId,
        gameId: this.currentGameId,
        difficulty: this.currentDifficulty,
        score: this.gameInstance.getScore(),
        won: this.gameInstance.isWon(),
        isDaily: this.currentDailyMode,
        isFinal: false,
        replayLog: this.gameInstance.getEventLog(),
      });
      void removeFromQueue(this.sessionId);
    }

    if (this.gameInstance) {
      this.gameInstance.destroy();
      this.gameInstance = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    this.showHome();
  }

  private async shareApp(): Promise<void> {
    const shareData = {
      title: 'NoFi.Games',
      text: 'Play 16 casual games offline — no wifi needed!',
      url: 'https://nofi.games',
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        // Brief visual feedback — flash the share button
        const btn = this.root.querySelector('#share-btn') as HTMLElement | null;
        if (btn) {
          btn.style.background = '#5CB85C';
          setTimeout(() => { btn.style.background = 'var(--color-primary-light)'; }, 800);
        }
      }
    } catch {
      // User cancelled the share sheet — ignore.
    }
  }

  /** Queue a partial telemetry snapshot to IndexedDB. Called from
   *  visibilitychange/beforeunload where we can't await network. */
  private queueTelemetrySnapshot(): void {
    if (!this.gameInstance || !this.currentGameId) return;
    queuePartialSession({
      sessionId: this.sessionId,
      gameId: this.currentGameId,
      difficulty: this.currentDifficulty,
      score: this.gameInstance.getScore(),
      won: this.gameInstance.isWon(),
      isDaily: this.currentDailyMode,
      replayLog: this.gameInstance.getEventLog(),
    });
  }

  // ═══════ SETTINGS SCREEN ═══════
  private async showSettings(): Promise<void> {
    this.currentScreen = 'settings';
    history.pushState({ screen: 'settings' }, '');
    const settings = await getSettings();

    // Measure FPS
    let fps = 0;
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let fpsAnimId = 0;
    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFpsTime = now;
        const fpsEl = document.getElementById('fps-num');
        if (fpsEl) fpsEl.textContent = String(fps);
        this.drawFpsSpinner(fps);
      }
      if (this.currentScreen === 'settings') fpsAnimId = requestAnimationFrame(measureFps);
    };

    this.root.innerHTML = `
      <div class="settings-screen">
        <nav class="header" role="navigation">
          <button class="header-back" id="settings-back" aria-label="Back"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>
          <div class="header-title">Settings</div>
          <div class="header-actions"></div>
        </nav>
        <div class="content">
          <div class="settings-panel">
            <div class="settings-group">
              <div class="settings-group-title">Audio</div>
              <div class="settings-item">
                <span class="settings-label">Volume</span>
                <input type="range" class="settings-slider" id="s-volume" min="0" max="100" value="${settings.volume}">
              </div>
              <div class="settings-item">
                <span class="settings-label">Music</span>
                <button class="toggle ${settings.musicEnabled ? 'active' : ''}" id="s-music"></button>
              </div>
              <div class="settings-item">
                <span class="settings-label">Sound Effects</span>
                <button class="toggle ${settings.soundEnabled ? 'active' : ''}" id="s-sound"></button>
              </div>
              <div class="settings-item">
                <span class="settings-label">Vibration</span>
                <button class="toggle ${settings.vibrationEnabled ? 'active' : ''}" id="s-vibration"></button>
              </div>
            </div>
            <div class="settings-group">
              <div class="settings-group-title">Privacy</div>
              <div class="settings-item">
                <span class="settings-label">Help improve games</span>
                <button class="toggle ${hasConsent() ? 'active' : ''}" id="s-telemetry"></button>
              </div>
              <div style="padding:0 0 8px;font-size:11px;color:var(--text-muted);line-height:1.4;">
                When on, anonymous play statistics (no personal info) are sent to help us balance difficulty and fix UX issues. You can turn this off anytime.
              </div>
            </div>
            <div class="settings-group">
              <div class="settings-group-title">Performance</div>
              <div class="settings-item" style="flex-direction:column;align-items:stretch;gap:8px;">
                <div style="display:flex;justify-content:space-between;">
                  <span class="settings-label">Maximum FPS</span>
                  <span class="settings-label" style="color:var(--color-primary);">${settings.maxFps}</span>
                </div>
                <input type="range" class="settings-slider" id="s-fps" min="30" max="60" step="30" value="${settings.maxFps}" style="width:100%;">
              </div>
              <div class="settings-item" style="justify-content:center;">
                <div class="fps-display">
                  <div class="fps-number" id="fps-num">--</div>
                  <div class="fps-label">FPS</div>
                  <canvas id="fps-spinner-canvas" class="fps-spinner" width="40" height="40"></canvas>
                </div>
              </div>
            </div>
            <div class="settings-group">
              <div class="settings-group-title">About</div>
              <div class="settings-item">
                <span class="settings-label">Version</span>
                <span class="settings-label" style="color:var(--text-muted);">1.0.0</span>
              </div>
              <div class="settings-item">
                <span class="settings-label">Build</span>
                <span class="settings-label" style="color:var(--text-muted);font-family:monospace;font-size:12px;">${__BUILD_HASH__}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="hills-bg"></div>
      </div>
    `;

    // Start FPS measurement
    fpsAnimId = requestAnimationFrame(measureFps);

    this.root.querySelector('#settings-back')!.addEventListener('click', () => {
      cancelAnimationFrame(fpsAnimId);
      history.back();
    });

    // Settings shortcuts: Escape → back, ? → help
    this.setKeys({
      Escape: () => {
        cancelAnimationFrame(fpsAnimId);
        history.back();
      },
      '?': () => showHelpOverlay(document.body, buildScreenHelp('Settings')),
    });

    // Toggles. Guard every lookup — the settings screen may be torn down
    // before this code runs (e.g. user presses Escape during the async getSettings() await).
    const bindToggle = (id: string, key: keyof AppSettings) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', async () => {
        hapticLight();
        (settings as unknown as Record<string, unknown>)[key] = !(settings as unknown as Record<string, unknown>)[key];
        btn.classList.toggle('active');
        if (key === 'soundEnabled') sound.enabled = settings.soundEnabled;
        if (key === 'vibrationEnabled') setHapticsEnabled(settings.vibrationEnabled);
        await saveSettings(settings);
      });
    };
    bindToggle('s-music', 'musicEnabled');
    bindToggle('s-sound', 'soundEnabled');
    bindToggle('s-vibration', 'vibrationEnabled');

    // Telemetry consent toggle (separate from AppSettings — stored in its own key)
    const telBtn = document.getElementById('s-telemetry');
    telBtn?.addEventListener('click', () => {
      hapticLight();
      const nowEnabled = !hasConsent();
      setConsent(nowEnabled);
      telBtn.classList.toggle('active', nowEnabled);
      if (nowEnabled) void registerDevice();
    });

    const volumeEl = document.getElementById('s-volume');
    volumeEl?.addEventListener('input', async (e) => {
      settings.volume = parseInt((e.target as HTMLInputElement).value);
      sound.volume = settings.volume / 100;
      await saveSettings(settings);
    });
    const fpsEl = document.getElementById('s-fps');
    fpsEl?.addEventListener('input', async (e) => {
      settings.maxFps = parseInt((e.target as HTMLInputElement).value);
      const label = (e.target as HTMLInputElement).parentElement?.querySelector('.settings-label:last-child');
      if (label) label.textContent = String(settings.maxFps);
      await saveSettings(settings);
    });
  }

  private drawFpsSpinner(fps: number): void {
    const canvas = document.getElementById('fps-spinner-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 40, 40);

    // Simple pac-man style spinner
    const t = performance.now() / 1000;
    const mouthAngle = 0.3 + 0.2 * Math.sin(t * 8);
    ctx.beginPath();
    ctx.arc(20, 20, 12, mouthAngle, Math.PI * 2 - mouthAngle);
    ctx.lineTo(20, 20);
    ctx.closePath();
    ctx.fillStyle = fps >= 55 ? '#5CB85C' : fps >= 30 ? '#F5A623' : '#E85D5D';
    ctx.fill();
  }

  // ═══════ SCORES ═══════
  private async showScores(gameId: string): Promise<void> {
    const game = getGame(gameId);
    if (!game) return;
    const stats = await getStats(gameId);
    this.currentScreen = 'scores';
    history.pushState({ screen: 'scores' }, '');

    this.root.innerHTML = `
      <div class="settings-screen">
        <nav class="header" role="navigation">
          <button class="header-back" id="scores-back" aria-label="Back"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>
          <div class="header-title">${game.name} Scores</div>
          <div class="header-actions"></div>
        </nav>
        <div class="content">
          <div class="scores-panel">
            <div class="scores-tabs">
              <button class="scores-tab active" data-tab="personal">Recent</button>
              <button class="scores-tab" data-tab="weekly">Weekly</button>
              <button class="scores-tab" data-tab="stats">Stats</button>
            </div>
            <div id="scores-content"></div>
          </div>
        </div>
      </div>
    `;

    this.root.querySelector('#scores-back')!.addEventListener('click', () => history.back());
    const tabs = this.root.querySelectorAll('.scores-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderScoreTab((tab as HTMLElement).dataset.tab!, stats);
      });
    });
    this.renderScoreTab('personal', stats);

    // Scores shortcuts: Escape → back, 1/2/3 → switch tabs
    const tabAt = (i: number) => (tabs[i] as HTMLElement | undefined)?.click();
    this.setKeys({
      Escape: () => history.back(),
      '1': () => tabAt(0),
      '2': () => tabAt(1),
      '3': () => tabAt(2),
    });
  }

  private renderScoreTab(tab: string, stats: GameStats): void {
    const content = document.getElementById('scores-content');
    if (!content) return;

    if (tab === 'personal') {
      if (stats.recentScores.length === 0) {
        content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">\u2605</div><p>No scores yet. Play a game!</p></div>`;
        return;
      }
      content.innerHTML = stats.recentScores.map((s, i) => `
        <div class="score-row fade-in" style="animation-delay:${i * 30}ms">
          <div class="score-rank">#${i + 1}</div>
          <div class="score-info">
            <div class="score-value">${s.score.toLocaleString()}</div>
            <div class="score-date">${new Date(s.date).toLocaleDateString()} \u2022 ${DIFF_LABELS[s.difficulty ?? 0]}</div>
          </div>
        </div>
      `).join('');
    } else if (tab === 'weekly') {
      content.innerHTML = `
        <div class="score-row"><div class="score-info"><div class="hud-stat-label">This Week's Best</div><div class="score-value">${stats.weeklyBest.toLocaleString()}</div></div></div>
        <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">Online leaderboards coming soon!</div>
      `;
    } else {
      const avg = stats.totalGames > 0 ? Math.round(stats.totalScore / stats.totalGames) : 0;
      content.innerHTML = `
        <div class="score-row"><div class="score-info"><div class="hud-stat-label">Lifetime Best</div></div><div class="score-value">${stats.lifetimeBest.toLocaleString()}</div></div>
        <div class="score-row"><div class="score-info"><div class="hud-stat-label">Total Games</div></div><div class="score-value">${stats.totalGames.toLocaleString()}</div></div>
        <div class="score-row"><div class="score-info"><div class="hud-stat-label">Average Score</div></div><div class="score-value">${avg.toLocaleString()}</div></div>
        <div class="score-row"><div class="score-info"><div class="hud-stat-label">Total Points</div></div><div class="score-value">${stats.totalScore.toLocaleString()}</div></div>
      `;
    }
  }
}
