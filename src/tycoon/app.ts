import { saveScore, getStats, getSettings, saveSettings, AppSettings } from '../storage/scores';
import { saveGameState, loadGameState } from '../storage/gameState';
import { sound } from '../utils/audio';
import { hapticLight, hapticMedium, setHapticsEnabled } from '../utils/haptics';
import { burst as confettiBurst, pickWinMessage } from '../utils/confetti';
// Type-only import of the Pixi view — the runtime value is loaded lazily via a
// dynamic import() so the Pixi (+ pixi.js) chunk never enters the synchronous
// app-shell path (offline-first; bundle isolation; jsdom tests touch no WebGL).
import type { TycoonPixiGame } from './pixi/TycoonPixiGame';

const GAME_ID = 'dice-tycoon';
const DIFF_COLORS = ['#5CB85C', '#F5A623', '#E85D5D', '#6B4566'];
const DIFF_LABELS = ['Easy', 'Medium', 'Hard', 'Extra Hard'];

/** Desktop cap so the portrait canvas reads as an intentional phone-size card
 *  on a wide viewport rather than a stretched strip. On narrow phones the
 *  canvas simply fills the available width. */
const MAX_W = 480;

type Screen = 'home' | 'game' | 'settings';

/**
 * Viewport-aware canvas sizing for the Dice Tycoon portrait board.
 *
 * Fills the available height and derives width from the game's portrait aspect
 * (canvasWidth/canvasHeight ≈ 0.5625). On a wide viewport the on-screen width is
 * clamped to MAX_W (centered framed card); on a narrow phone the width is the
 * limiting dimension, so we fill width and derive height instead. All values are
 * floored to whole pixels for crisp DPR-scaled rendering.
 *
 * Pure + exported so the shell logic is unit-testable without a real DOM.
 */
export function computeSize(availW: number, availH: number, aspect: number): { w: number; h: number } {
  const w = Math.max(1, availW);
  const h = Math.max(1, availH);
  // First try: fill height, derive width from aspect.
  let dw = h * aspect;
  let dh = h;
  // If that overflows the available width (or the desktop cap), fill the
  // clamped width instead and derive height.
  const widthCap = Math.min(w, MAX_W);
  if (dw > widthCap) {
    dw = widthCap;
    dh = widthCap / aspect;
  }
  return { w: Math.max(1, Math.floor(dw)), h: Math.max(1, Math.floor(dh)) };
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
  /** Portrait aspect for the Pixi renderer card (matches the canvas board). */
  private readonly aspect = 360 / 640; // ≈ 0.5625

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

    const stats = await getStats(GAME_ID);
    history.pushState({ screen: 'game' }, '');

    // Pixi appends its OWN canvas into #pixi-host — no static <canvas> needed.
    this.root.innerHTML = `
      <div class="game-screen tycoon-game">
        <div class="game-container" id="game-container">
          <div class="game-loading"><div class="loading-spinner"></div></div>
          <div class="tycoon-pixi-host" id="pixi-host"></div>
          <div class="game-hud-overlay">
            <button class="hud-btn" id="hud-back" aria-label="Exit game"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>
            <div class="hud-center">
              <div class="hud-score-pill">
                <div class="hud-stat">
                  <div class="hud-stat-label">Net Worth</div>
                  <div class="hud-stat-value" id="hud-score">0</div>
                </div>
                <div class="hud-stat">
                  <div class="hud-stat-label">Best</div>
                  <div class="hud-stat-value" id="hud-best">${stats.bestScore.toLocaleString()}</div>
                </div>
              </div>
            </div>
            <div class="hud-btn-group"></div>
          </div>
        </div>
      </div>
    `;

    this.root.querySelector('#hud-back')!.addEventListener('click', () => {
      hapticLight();
      sound.play('tap');
      this.exitGame();
    });

    // Let layout settle before measuring.
    await new Promise((r) => requestAnimationFrame(r));

    const host = document.getElementById('pixi-host');
    const container = document.getElementById('game-container');
    if (!host || !container) return;

    const finalCw = container.clientWidth || 360;
    const finalCh = container.clientHeight || 640;
    const { w: displayW, h: displayH } = computeSize(finalCw, finalCh, this.aspect);
    host.style.width = `${displayW}px`;
    host.style.height = `${displayH}px`;

    try {
      // Lazy-load the Pixi view ONLY now (keeps pixi.js out of the shell path).
      const { TycoonPixiGame } = await import('./pixi/TycoonPixiGame');
      // Bail if the user navigated away while the chunk loaded.
      if (this.currentScreen !== 'game') return;

      const game = new TycoonPixiGame(host, {
        difficulty,
        width: displayW,
        height: displayH,
        onScore: (score) => {
          const el = document.getElementById('hud-score');
          if (el) el.textContent = score.toLocaleString();
        },
        onWin: (finalScore) => this.handleWin(finalScore),
        onGameOver: (finalScore) => this.handleGameOver(finalScore),
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

      // Keep the Pixi renderer matched to the viewport (rAF-debounced).
      this.resizeHandler = () => {
        cancelAnimationFrame(this.resizeRaf);
        this.resizeRaf = requestAnimationFrame(() => {
          if (this.currentScreen !== 'game' || !this.pixiGame) return;
          const c = document.getElementById('game-container');
          const h = document.getElementById('pixi-host');
          if (!c || !h) return;
          const next = computeSize(c.clientWidth || finalCw, c.clientHeight || finalCh, this.aspect);
          h.style.width = `${next.w}px`;
          h.style.height = `${next.h}px`;
          this.pixiGame.resize(next.w, next.h);
        });
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
