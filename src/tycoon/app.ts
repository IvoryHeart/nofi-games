import { saveScore, getStats, getSettings, saveSettings, AppSettings } from '../storage/scores';
import { saveGameState, loadGameState } from '../storage/gameState';
import { sound } from '../utils/audio';
import { hapticLight, hapticMedium, setHapticsEnabled } from '../utils/haptics';
import { burst as confettiBurst, pickWinMessage } from '../utils/confetti';
// Type-only import of the Pixi view — the runtime value is loaded lazily via a
// dynamic import() so the Pixi (+ pixi.js) chunk never enters the synchronous
// app-shell path (offline-first; bundle isolation; jsdom tests touch no WebGL).
import type { TycoonPixiGame, TycoonEvent } from './pixi/TycoonPixiGame';
import { computeLayout, LayoutResult } from './layout';

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
      if (this.currentScreen === 'game') this.exitGame();
      else if (this.currentScreen === 'settings') this.showHome();
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

    const stats = await getStats(GAME_ID);
    history.pushState({ screen: 'game' }, '');

    // Responsive layout from the live viewport: phone (edge-to-edge), compact
    // (one rail) or cockpit (top bar + two rails). The Pixi host gets the
    // CENTER-STAGE rect — never the old 480 device-card.
    const layout = computeLayout(this.viewportW(), this.viewportH());
    this.layout = layout;
    this.root.innerHTML = this.gameMarkup(layout, stats.bestScore);
    this.bindGameChrome();

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
      });
      this.pixiGame = game;

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

  /** Build the game-screen markup for the given layout mode. Phone is the lean
   *  edge-to-edge overlay; compact/cockpit add a top bar + DOM rails around the
   *  center-stage Pixi host. */
  private gameMarkup(layout: LayoutResult, bestScore: number): string {
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
        <div class="game-screen tycoon-game tycoon-phone">
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
      <div class="game-screen tycoon-game tycoon-cockpit tycoon-${layout.mode}">
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
      <div class="tycoon-rail-card tycoon-feed-card">
        <div class="tycoon-rail-title">Recent Activity</div>
        <ul class="tycoon-feed">${items}</ul>
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
