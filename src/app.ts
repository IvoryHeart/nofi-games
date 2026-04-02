import { getAllGames, getGame, GameInfo } from './games/registry';
import { GameEngine, GameConfig } from './engine/GameEngine';
import {
  saveScore, getStats, GameStats,
  getFavourites, toggleFavourite,
  getGameSettings, saveGameSettings,
  getSettings, saveSettings, AppSettings,
} from './storage/scores';
import { sound } from './utils/audio';
import { hapticLight, hapticMedium, hapticHeavy, hapticError, setHapticsEnabled } from './utils/haptics';

const DIFF_COLORS = ['#5CB85C', '#F5A623', '#E85D5D', '#6B4566'];
const DIFF_LABELS = ['Easy', 'Medium', 'Hard', 'Extra Hard'];

type Screen = 'home' | 'difficulty' | 'game' | 'scores' | 'settings';

export class App {
  private root: HTMLElement;
  private currentScreen: Screen = 'home';
  private currentGameId: string | null = null;
  private currentDifficulty = 0;
  private gameInstance: GameEngine | null = null;
  private favourites: string[] = [];
  private resizeHandler: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async mount(): Promise<void> {
    this.favourites = await getFavourites();
    this.showHome();
    window.addEventListener('popstate', () => {
      if (this.currentScreen === 'game') this.exitGame();
      else if (this.currentScreen === 'difficulty') this.showHome();
      else if (this.currentScreen === 'scores') this.showDifficulty(this.currentGameId!);
      else if (this.currentScreen === 'settings') this.showHome();
      else this.showHome();
    });
  }

  // ═══════ HOME SCREEN ═══════
  private showHome(): void {
    this.currentScreen = 'home';
    this.currentGameId = null;
    const games = getAllGames();

    // Sort: favourites first
    const sorted = [...games].sort((a, b) => {
      const aFav = this.favourites.includes(a.id) ? 0 : 1;
      const bFav = this.favourites.includes(b.id) ? 0 : 1;
      return aFav - bFav;
    });

    this.root.innerHTML = `
      <div class="header">
        <div class="header-title">NoFi</div>
        <div class="header-actions">
          <button class="header-back" id="settings-btn" style="background:var(--color-primary-light);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </button>
        </div>
      </div>
      <div class="content">
        <div class="home">
          <div class="home-hero">
            <h1>NoFi</h1>
            <p>Play offline, anywhere</p>
          </div>
          <div class="games-grid" id="games-grid"></div>
        </div>
      </div>
    `;

    this.root.querySelector('#settings-btn')!.addEventListener('click', () => this.showSettings());

    const grid = this.root.querySelector('#games-grid')!;
    sorted.forEach((game, i) => {
      const isFav = this.favourites.includes(game.id);
      const card = document.createElement('div');
      card.className = 'game-card fade-in';
      card.style.animationDelay = `${i * 40}ms`;
      const [g1, g2] = game.bgGradient || [game.color.replace('--', 'var(--') + ')', game.color.replace('--', 'var(--') + ')'];
      const bg = game.bgGradient
        ? `linear-gradient(135deg, ${g1}, ${g2})`
        : `var(${game.color})`;
      card.innerHTML = `
        <button class="game-card-fav ${isFav ? 'active' : ''}" data-id="${game.id}">${isFav ? '\u2605' : '\u2606'}</button>
        <div class="game-card-thumb" style="background:${bg}">${game.icon}</div>
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
      card.querySelector('.game-card-fav')!.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nowFav = await toggleFavourite(game.id);
        this.favourites = await getFavourites();
        const btn = e.currentTarget as HTMLElement;
        btn.textContent = nowFav ? '\u2605' : '\u2606';
        btn.classList.toggle('active', nowFav);
      });
      grid.appendChild(card);

      getStats(game.id).then(stats => {
        const el = document.getElementById(`best-${game.id}`);
        if (el) el.textContent = stats.bestScore > 0 ? `Best: ${stats.bestScore.toLocaleString()}` : 'Tap to play';
      });
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
    const isFav = this.favourites.includes(gameId);

    this.root.innerHTML = `
      <div class="diff-screen">
        <div class="header">
          <button class="header-back" id="diff-back">\u2190</button>
          <div class="header-title">${game.name}</div>
          <div class="header-actions">
            <button class="header-back" id="diff-fav" style="background:${isFav ? '#F5A623' : 'var(--color-primary-light)'}; font-size:16px;">${isFav ? '\u2605' : '\u2606'}</button>
            <button class="header-back" id="diff-settings" style="background:var(--color-primary-light);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </button>
          </div>
        </div>
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
            Play<span>Level 1</span>
          </button>
          <button class="diff-help-btn" id="diff-help" style="background:var(--bg-secondary);color:var(--text-secondary);">?</button>
        </div>
        <div class="hills-bg"></div>
      </div>
    `;

    this.updateDifficultyUI(this.currentDifficulty);

    this.root.querySelector('#diff-back')!.addEventListener('click', () => { history.back(); });
    this.root.querySelector('#diff-play')!.addEventListener('click', () => {
      saveGameSettings(gameId, { lastDifficulty: this.currentDifficulty });
      this.startGame(gameId, this.currentDifficulty);
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
  private async startGame(gameId: string, difficulty: number): Promise<void> {
    const game = getGame(gameId);
    if (!game) return;
    this.currentScreen = 'game';
    this.currentGameId = gameId;
    this.currentDifficulty = difficulty;

    const stats = await getStats(gameId);
    history.pushState({ screen: 'game' }, '');

    // Show loading state first
    this.root.innerHTML = `
      <div class="game-screen">
        <div class="game-container" id="game-container">
          <div class="game-loading">
            <div class="loading-spinner"></div>
          </div>
          <canvas id="game-canvas"></canvas>
          <div class="game-hud-overlay">
            <button class="hud-btn" id="hud-back">\u2190</button>
            <div class="hud-score-pill">
              <div class="hud-stat">
                <div class="hud-stat-label">Score</div>
                <div class="hud-stat-value" id="hud-score">0</div>
              </div>
              <div class="hud-stat">
                <div class="hud-stat-label">Best</div>
                <div class="hud-stat-value" id="hud-best">${stats.bestScore.toLocaleString()}</div>
              </div>
            </div>
            <button class="hud-btn" id="hud-pause">\u23F8</button>
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
        if ((this.gameInstance as unknown as { paused: boolean }).paused) {
          this.gameInstance.resume();
        } else {
          this.gameInstance.pause();
        }
      }
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
      onScore: (score) => {
        const el = document.getElementById('hud-score');
        if (el) el.textContent = score.toLocaleString();
      },
      onGameOver: (finalScore) => {
        this.handleGameOver(game, finalScore, stats);
      },
    };

    try {
      this.gameInstance = game.createGame(config);
      this.gameInstance.start();

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
    const newStats = await getStats(game.id);
    const isNewBest = finalScore > prevStats.bestScore;

    if (isNewBest) {
      hapticHeavy();
      sound.play('win');
    } else {
      hapticMedium();
    }

    const container = document.getElementById('game-container');
    if (!container) return;

    const overlay = document.createElement('div');
    overlay.className = 'game-over';
    overlay.innerHTML = `
      <h2>${isNewBest ? 'New Best!' : 'Game Over'}</h2>
      <div class="final-score">${finalScore.toLocaleString()}</div>
      <div class="best-label">Best: ${newStats.bestScore.toLocaleString()} \u2022 Games: ${newStats.totalGames}</div>
      <div class="btn-group" style="margin-top:8px;">
        <button class="btn btn-secondary" id="go-home">Home</button>
        <button class="btn btn-primary" id="play-again">Play Again</button>
      </div>
    `;
    container.appendChild(overlay);

    overlay.querySelector('#play-again')!.addEventListener('click', () => {
      this.gameInstance?.destroy();
      this.startGame(game.id, this.currentDifficulty);
    });
    overlay.querySelector('#go-home')!.addEventListener('click', () => this.exitGame());
  }

  private exitGame(): void {
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
        <div class="header">
          <button class="header-back" id="settings-back">\u2190</button>
          <div class="header-title">Settings</div>
          <div class="header-actions"></div>
        </div>
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

    // Toggles
    const bindToggle = (id: string, key: keyof AppSettings) => {
      const btn = document.getElementById(id)!;
      btn.addEventListener('click', async () => {
        hapticLight();
        (settings as unknown as Record<string, unknown>)[key] = !(settings as unknown as Record<string, unknown>)[key];
        btn.classList.toggle('active');
        // Sync sound/haptics state
        if (key === 'soundEnabled') sound.enabled = settings.soundEnabled;
        if (key === 'vibrationEnabled') setHapticsEnabled(settings.vibrationEnabled);
        await saveSettings(settings);
      });
    };
    bindToggle('s-music', 'musicEnabled');
    bindToggle('s-sound', 'soundEnabled');
    bindToggle('s-vibration', 'vibrationEnabled');

    document.getElementById('s-volume')!.addEventListener('input', async (e) => {
      settings.volume = parseInt((e.target as HTMLInputElement).value);
      sound.volume = settings.volume / 100;
      await saveSettings(settings);
    });
    document.getElementById('s-fps')!.addEventListener('input', async (e) => {
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
        <div class="header">
          <button class="header-back" id="scores-back">\u2190</button>
          <div class="header-title">${game.name} Scores</div>
          <div class="header-actions"></div>
        </div>
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
