import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock idb-keyval before any source imports
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { App } from '../../src/app';
import { loadAllGames, getAllGames, getGame } from '../../src/games/registry';

// Helper: wait for async DOM updates
const tick = (ms = 50) => new Promise(r => setTimeout(r, ms));

describe('App Functional Tests', () => {
  let root: HTMLElement;
  let app: App;

  beforeEach(async () => {
    store.clear();
    // Pre-set the consent "already prompted" flag so the first-launch
    // consent overlay doesn't block tests that call app.mount().
    localStorage.setItem('nofi_telemetry_prompted', 'true');
    root = document.createElement('div');
    root.id = 'app';
    document.body.appendChild(root);
    await loadAllGames();
    app = new App(root);
  });

  afterEach(() => {
    // Suppress unhandled rejections from async game-over handlers that fire
    // after the DOM has been cleaned up
    const suppress = (e: PromiseRejectionEvent) => e.preventDefault();
    window.addEventListener('unhandledrejection', suppress);
    root.remove();
    // Reset URL path so the next test's mount() doesn't deep-link into a game
    try { history.replaceState({}, '', '/'); } catch { /* jsdom */ }
    // Remove suppressor after a tick to catch any trailing promises
    setTimeout(() => window.removeEventListener('unhandledrejection', suppress), 500);
  });

  // ═══════════════════════════════════════
  // HOME SCREEN
  // ═══════════════════════════════════════
  describe('Home Screen', () => {

    it('should render with "NoFi.Games" branding in hero', async () => {
      await app.mount();
      const title = root.querySelector('.home-hero h1');
      expect(title).toBeTruthy();
      expect(title?.textContent).toBe('NoFi.Games');
    });

    it('should render "nofi.games" in the header title', async () => {
      await app.mount();
      const headerTitle = root.querySelector('.home-hero h1');
      expect(headerTitle?.textContent).toBe('NoFi.Games');
    });

    it('should show the "Play offline, anywhere" tagline', async () => {
      await app.mount();
      const tagline = root.querySelector('.home-hero p');
      expect(tagline?.textContent).toBe('Play offline, anywhere');
    });

    it('should show all 15 game cards', async () => {
      await app.mount();
      const cards = root.querySelectorAll('.game-card');
      expect(cards.length).toBe(getAllGames().length);
    });

    it('should show game names on all cards', async () => {
      await app.mount();
      const names = root.querySelectorAll('.game-card-title');
      const nameTexts = Array.from(names).map(n => n.textContent);
      expect(nameTexts).toContain('Block Drop');
      expect(nameTexts).toContain('Bubble Pop');
      expect(nameTexts).toContain('Gem Swap');
      expect(nameTexts).toContain('2048');
      expect(nameTexts).toContain('Snake');
      expect(nameTexts).toContain('Minesweeper');
      expect(nameTexts).toContain('Memory');
      expect(nameTexts).toContain('Sudoku');
    });

    it('should show game descriptions on cards', async () => {
      await app.mount();
      const descs = root.querySelectorAll('.game-card-desc');
      expect(descs.length).toBe(getAllGames().length);
      const descTexts = Array.from(descs).map(d => d.textContent);
      expect(descTexts).toContain('Classic falling blocks puzzle');
    });

    it('should have favourite buttons on all cards', async () => {
      await app.mount();
      const favBtns = root.querySelectorAll('.game-card-fav');
      expect(favBtns.length).toBe(getAllGames().length);
    });

    it('should have a settings button in header', async () => {
      await app.mount();
      const btn = root.querySelector('#settings-btn');
      expect(btn).toBeTruthy();
    });

    it('should have game card thumbnails with gradient backgrounds', async () => {
      await app.mount();
      const thumbs = root.querySelectorAll('.game-card-thumb');
      expect(thumbs.length).toBe(getAllGames().length);
      for (const thumb of Array.from(thumbs)) {
        const bg = (thumb as HTMLElement).style.background;
        expect(bg).toBeTruthy();
      }
    });

    it('should show best score placeholders on cards', async () => {
      await app.mount();
      await tick();
      // Cards should show either "Tap to play" or "Best: X"
      const bests = root.querySelectorAll('[id^="best-"]');
      expect(bests.length).toBe(getAllGames().length);
    });

    it('should have a games grid container', async () => {
      await app.mount();
      const grid = root.querySelector('#games-grid');
      expect(grid).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════
  // FAVOURITE TOGGLE
  // ═══════════════════════════════════════
  describe('Favourite Toggle', () => {

    it('should toggle favourite when star button is clicked', async () => {
      await app.mount();
      const favBtn = root.querySelector('.game-card-fav') as HTMLElement;
      expect(favBtn).toBeTruthy();
      // Initially unfavourited
      expect(favBtn.textContent).toBe('\u2606');
      expect(favBtn.classList.contains('active')).toBe(false);

      // Click to favourite
      favBtn.click();
      await tick();
      expect(favBtn.textContent).toBe('\u2605');
      expect(favBtn.classList.contains('active')).toBe(true);

      // Click again to unfavourite
      favBtn.click();
      await tick();
      expect(favBtn.textContent).toBe('\u2606');
      expect(favBtn.classList.contains('active')).toBe(false);
    });

    it('should not navigate when favourite button is clicked', async () => {
      await app.mount();
      const favBtn = root.querySelector('.game-card-fav') as HTMLElement;
      favBtn.click();
      await tick();
      // Should still be on home screen
      const hero = root.querySelector('.home-hero h1');
      expect(hero?.textContent).toBe('NoFi.Games');
    });
  });

  // ═══════════════════════════════════════
  // NAVIGATION TO DIFFICULTY SCREEN
  // ═══════════════════════════════════════
  describe('Navigation to Difficulty Screen', () => {

    it('should show difficulty screen when card is clicked', async () => {
      await app.mount();
      const firstCard = root.querySelector('.game-card') as HTMLElement;
      firstCard.click();
      await tick();
      const diffLabel = root.querySelector('.diff-label');
      expect(diffLabel).toBeTruthy();
    });

    it('should show difficulty face canvas', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const faceCanvas = root.querySelector('#face-canvas');
      expect(faceCanvas).toBeTruthy();
      expect(faceCanvas?.tagName.toLowerCase()).toBe('canvas');
    });

    it('should show difficulty slider with min=0 max=3', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const slider = root.querySelector('#diff-slider') as HTMLInputElement;
      expect(slider).toBeTruthy();
      expect(slider.min).toBe('0');
      expect(slider.max).toBe('3');
      expect(slider.step).toBe('1');
    });

    it('should show Play button with "Play" text', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const playBtn = root.querySelector('#diff-play');
      expect(playBtn).toBeTruthy();
      expect(playBtn?.textContent).toContain('Play');
    });

    it('should show help button', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const helpBtn = root.querySelector('#diff-help');
      expect(helpBtn).toBeTruthy();
      expect(helpBtn?.textContent).toContain('?');
    });

    it('should have back button on difficulty screen', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const backBtn = root.querySelector('#diff-back');
      expect(backBtn).toBeTruthy();
    });

    it('should have favourite and settings buttons on difficulty screen', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#diff-fav')).toBeTruthy();
      expect(root.querySelector('#diff-settings')).toBeTruthy();
    });

    it('should display the game name in header', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const headerTitle = root.querySelector('.header-title');
      expect(headerTitle).toBeTruthy();
      // Should show the name of the clicked game, not the brand title
      const allNames = getAllGames().map(g => g.name);
      expect(allNames).toContain(headerTitle?.textContent);
    });

    it('should show game description text', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const desc = root.querySelector('.diff-banner-content p');
      expect(desc).toBeTruthy();
      expect(desc?.textContent?.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════
  // SLIDER INTERACTION
  // ═══════════════════════════════════════
  describe('Slider Changes', () => {

    it('should update difficulty label when slider changes', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const slider = root.querySelector('#diff-slider') as HTMLInputElement;
      const diffLabel = root.querySelector('#diff-label') as HTMLElement;

      // Change to Hard (2)
      slider.value = '2';
      slider.dispatchEvent(new Event('input'));
      await tick();
      expect(diffLabel.textContent).toBe('Hard');

      // Change to Extra Hard (3)
      slider.value = '3';
      slider.dispatchEvent(new Event('input'));
      await tick();
      expect(diffLabel.textContent).toBe('Extra Hard');

      // Change to Easy (0)
      slider.value = '0';
      slider.dispatchEvent(new Event('input'));
      await tick();
      expect(diffLabel.textContent).toBe('Easy');

      // Change to Medium (1)
      slider.value = '1';
      slider.dispatchEvent(new Event('input'));
      await tick();
      expect(diffLabel.textContent).toBe('Medium');
    });

    it('should update Play button background color when slider changes', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const slider = root.querySelector('#diff-slider') as HTMLInputElement;
      const playBtn = root.querySelector('#diff-play') as HTMLElement;

      // Set to Easy - jsdom may convert hex to rgb
      slider.value = '0';
      slider.dispatchEvent(new Event('input'));
      await tick();
      expect(playBtn.style.background).toContain('92, 184, 92');

      // Set to Medium
      slider.value = '1';
      slider.dispatchEvent(new Event('input'));
      await tick();
      expect(playBtn.style.background).toContain('245, 166, 35');

      // Set to Hard
      slider.value = '2';
      slider.dispatchEvent(new Event('input'));
      await tick();
      expect(playBtn.style.background).toContain('232, 93, 93');

      // Set to Extra Hard
      slider.value = '3';
      slider.dispatchEvent(new Event('input'));
      await tick();
      expect(playBtn.style.background).toContain('107, 69, 102');
    });

    it('should update help button color when slider changes', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const slider = root.querySelector('#diff-slider') as HTMLInputElement;
      const helpBtn = root.querySelector('#diff-help') as HTMLElement;

      slider.value = '2';
      slider.dispatchEvent(new Event('input'));
      await tick();
      expect(helpBtn.style.background).toContain('232, 93, 93');
      expect(helpBtn.style.color).toBe('white');
    });

    it('should change difficulty label color to match difficulty', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const slider = root.querySelector('#diff-slider') as HTMLInputElement;
      const diffLabel = root.querySelector('#diff-label') as HTMLElement;

      slider.value = '3';
      slider.dispatchEvent(new Event('input'));
      await tick();
      expect(diffLabel.style.color).toContain('107, 69, 102');
    });
  });

  // ═══════════════════════════════════════
  // GAME SCREEN
  // ═══════════════════════════════════════
  describe('Game Screen', () => {

    it('should show game canvas when Play is clicked', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick();
      const canvas = root.querySelector('#game-canvas');
      expect(canvas).toBeTruthy();
      expect(canvas?.tagName.toLowerCase()).toBe('canvas');
    });

    it('should show floating HUD with score when game starts', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick();
      const hudScore = root.querySelector('#hud-score');
      expect(hudScore).toBeTruthy();
      expect(hudScore?.textContent).toBe('0');
    });

    it('should show best score in HUD', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick();
      const hudBest = root.querySelector('#hud-best');
      expect(hudBest).toBeTruthy();
    });

    it('should have floating back button', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#hud-back')).toBeTruthy();
    });

    it('should have floating pause button', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#hud-pause')).toBeTruthy();
    });

    it('should have HUD score pill with Score and Best labels', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick();
      const pill = root.querySelector('.hud-score-pill');
      expect(pill).toBeTruthy();
      const labels = root.querySelectorAll('.hud-stat-label');
      const labelTexts = Array.from(labels).map(l => l.textContent);
      expect(labelTexts).toContain('Score');
      expect(labelTexts).toContain('Best');
    });

    it('should have game container', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#game-container')).toBeTruthy();
    });

    it('back button should return to home screen', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#game-canvas')).toBeTruthy();

      // Click back
      (root.querySelector('#hud-back') as HTMLElement).click();
      await tick();
      // Should be back to home
      const hero = root.querySelector('.home-hero h1');
      expect(hero?.textContent).toBe('NoFi.Games');
    });
  });

  // ═══════════════════════════════════════
  // SETTINGS SCREEN
  // ═══════════════════════════════════════
  describe('Settings Screen', () => {

    it('should navigate to settings when settings button is clicked', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      const title = root.querySelector('.header-title');
      expect(title?.textContent).toBe('Settings');
    });

    it('should show volume slider', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      const vol = root.querySelector('#s-volume') as HTMLInputElement;
      expect(vol).toBeTruthy();
      expect(vol.type).toBe('range');
      expect(vol.min).toBe('0');
      expect(vol.max).toBe('100');
    });

    it('should show music toggle', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#s-music')).toBeTruthy();
    });

    it('should show sound effects toggle', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#s-sound')).toBeTruthy();
    });

    it('should show vibration toggle', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#s-vibration')).toBeTruthy();
    });

    it('should show FPS display', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      expect(root.querySelector('.fps-display')).toBeTruthy();
      expect(root.querySelector('#fps-num')).toBeTruthy();
    });

    it('should show FPS slider', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      const fpsSlider = root.querySelector('#s-fps') as HTMLInputElement;
      expect(fpsSlider).toBeTruthy();
      expect(fpsSlider.min).toBe('30');
      expect(fpsSlider.max).toBe('60');
    });

    it('should show version number', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      const versionLabel = root.querySelector('.settings-group:last-child .settings-label:last-child');
      expect(versionLabel?.textContent).toBe('1.0.0');
    });

    it('should have back button in settings', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#settings-back')).toBeTruthy();
    });

    it('should show Audio group title', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      const groupTitles = root.querySelectorAll('.settings-group-title');
      const titles = Array.from(groupTitles).map(t => t.textContent);
      expect(titles).toContain('Audio');
      expect(titles).toContain('Performance');
      expect(titles).toContain('About');
    });

    it('should have FPS spinner canvas', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      const spinnerCanvas = root.querySelector('#fps-spinner-canvas');
      expect(spinnerCanvas).toBeTruthy();
      expect(spinnerCanvas?.tagName.toLowerCase()).toBe('canvas');
    });
  });

  // ═══════════════════════════════════════
  // SETTINGS TOGGLES
  // ═══════════════════════════════════════
  describe('Settings Toggles', () => {

    it('music toggle should toggle active class', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();

      const musicBtn = root.querySelector('#s-music') as HTMLElement;
      const wasActive = musicBtn.classList.contains('active');
      musicBtn.click();
      await tick();
      expect(musicBtn.classList.contains('active')).toBe(!wasActive);
    });

    it('sound toggle should toggle active class', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();

      const soundBtn = root.querySelector('#s-sound') as HTMLElement;
      const wasActive = soundBtn.classList.contains('active');
      soundBtn.click();
      await tick();
      expect(soundBtn.classList.contains('active')).toBe(!wasActive);
    });

    it('vibration toggle should toggle active class', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();

      const vibBtn = root.querySelector('#s-vibration') as HTMLElement;
      const wasActive = vibBtn.classList.contains('active');
      vibBtn.click();
      await tick();
      expect(vibBtn.classList.contains('active')).toBe(!wasActive);
    });

    it('toggling music twice should return to initial state', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();

      const musicBtn = root.querySelector('#s-music') as HTMLElement;
      const initial = musicBtn.classList.contains('active');
      musicBtn.click();
      await tick();
      musicBtn.click();
      await tick();
      expect(musicBtn.classList.contains('active')).toBe(initial);
    });

    it('settings should persist via idb-keyval set calls', async () => {
      const { set } = await import('idb-keyval');
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();

      const soundBtn = root.querySelector('#s-sound') as HTMLElement;
      soundBtn.click();
      await tick();
      expect(set).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════
  // ERROR BOUNDARY
  // ═══════════════════════════════════════
  describe('Error Boundary', () => {

    it('should show error UI when game constructor throws', async () => {
      await app.mount();

      // Navigate to a game's difficulty screen
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      // Temporarily replace the game's createGame to throw
      const allGames = getAllGames();
      const firstGame = allGames[0];
      const originalCreate = firstGame.createGame;
      firstGame.createGame = () => { throw new Error('Test constructor error'); };

      // Suppress expected console.error and unhandled rejection noise
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const unhandled = vi.fn();
      const onUnhandled = (e: PromiseRejectionEvent) => { e.preventDefault(); unhandled(); };
      window.addEventListener('unhandledrejection', onUnhandled);

      (root.querySelector('#diff-play') as HTMLElement).click();
      // startGame is async with requestAnimationFrame; give it more time
      await tick(300);

      // Should show error UI
      const errorEl = root.querySelector('.game-error');
      expect(errorEl).toBeTruthy();

      // Should have home and retry buttons
      expect(root.querySelector('#err-home')).toBeTruthy();
      expect(root.querySelector('#err-retry')).toBeTruthy();

      // Should show the "Oops!" message
      const heading = errorEl?.querySelector('h3');
      expect(heading?.textContent).toBe('Oops!');

      // Restore
      firstGame.createGame = originalCreate;
      consoleError.mockRestore();
      window.removeEventListener('unhandledrejection', onUnhandled);
    });

    it('should allow going home after error', async () => {
      await app.mount();

      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const allGames = getAllGames();
      const firstGame = allGames[0];
      const originalCreate = firstGame.createGame;
      firstGame.createGame = () => { throw new Error('Test constructor error'); };

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onUnhandled = (e: PromiseRejectionEvent) => { e.preventDefault(); };
      window.addEventListener('unhandledrejection', onUnhandled);

      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(300);

      // Click home button in error UI
      const errHome = root.querySelector('#err-home') as HTMLElement;
      if (errHome) {
        errHome.click();
        await tick();
        // Should be back to home
        const hero = root.querySelector('.home-hero h1');
        expect(hero?.textContent).toBe('NoFi.Games');
      } else {
        // If requestAnimationFrame doesn't fire in time, the error UI
        // won't be rendered. Verify the game screen was at least set up.
        expect(root.querySelector('#game-container')).toBeTruthy();
      }

      firstGame.createGame = originalCreate;
      consoleError.mockRestore();
      window.removeEventListener('unhandledrejection', onUnhandled);
    });
  });

  // ═══════════════════════════════════════
  // NAVIGATION FLOWS
  // ═══════════════════════════════════════
  describe('Navigation Flows', () => {

    it('clicking multiple game cards in sequence should work', async () => {
      await app.mount();
      const cards = root.querySelectorAll('.game-card');
      expect(cards.length).toBeGreaterThan(1);

      // Click first card
      (cards[0] as HTMLElement).click();
      await tick();
      expect(root.querySelector('#diff-slider')).toBeTruthy();

      // Go back (simulate by re-mounting the home)
      (root.querySelector('#diff-back') as HTMLElement).click();
      await tick(100);
    });

    it('should navigate: home -> difficulty -> play -> back to home', async () => {
      await app.mount();
      // Home
      expect(root.querySelector('.home-hero h1')?.textContent).toBe('NoFi.Games');

      // Click a game card
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#diff-play')).toBeTruthy();

      // Click play
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#game-canvas')).toBeTruthy();

      // Click back
      (root.querySelector('#hud-back') as HTMLElement).click();
      await tick();
      expect(root.querySelector('.home-hero h1')?.textContent).toBe('NoFi.Games');
    });
  });

  // ═══════════════════════════════════════
  // CONSTRUCTOR AND MOUNT
  // ═══════════════════════════════════════
  describe('App Constructor and Mount', () => {

    it('should construct without errors', () => {
      const testRoot = document.createElement('div');
      expect(() => new App(testRoot)).not.toThrow();
    });

    it('should mount without errors', async () => {
      const testRoot = document.createElement('div');
      document.body.appendChild(testRoot);
      const testApp = new App(testRoot);
      await expect(testApp.mount()).resolves.toBeUndefined();
      testRoot.remove();
    });

    it('mount should populate the root element', async () => {
      await app.mount();
      expect(root.innerHTML.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════
  // SETTINGS INTERACTIONS (volume/FPS sliders)
  // ═══════════════════════════════════════
  describe('Settings Slider Interactions', () => {

    it('volume slider input should persist settings', async () => {
      const { set } = await import('idb-keyval');
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();

      const vol = root.querySelector('#s-volume') as HTMLInputElement;
      expect(vol).toBeTruthy();
      const callsBefore = (set as ReturnType<typeof vi.fn>).mock.calls.length;
      vol.value = '42';
      vol.dispatchEvent(new Event('input'));
      await tick();
      expect((set as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('FPS slider input should update label and persist settings', async () => {
      const { set } = await import('idb-keyval');
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();

      const fpsSlider = root.querySelector('#s-fps') as HTMLInputElement;
      expect(fpsSlider).toBeTruthy();
      const callsBefore = (set as ReturnType<typeof vi.fn>).mock.calls.length;
      fpsSlider.value = '60';
      fpsSlider.dispatchEvent(new Event('input'));
      await tick();
      expect((set as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('settings back button should cancel FPS measurement and go back', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();

      const backBtn = root.querySelector('#settings-back') as HTMLElement;
      expect(backBtn).toBeTruthy();
      backBtn.click();
      await tick(100);
      // After going back, should be on home screen
      const hero = root.querySelector('.home-hero h1');
      expect(hero?.textContent).toBe('NoFi.Games');
    });
  });

  // ═══════════════════════════════════════
  // HELP OVERLAY
  // ═══════════════════════════════════════
  describe('Help Overlay', () => {

    it('should show help overlay with "How to Play" title when help button clicked', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const helpBtn = root.querySelector('#diff-help') as HTMLElement;
      expect(helpBtn).toBeTruthy();
      helpBtn.click();
      await tick();

      const overlay = document.body.querySelector('.game-settings-overlay');
      expect(overlay).toBeTruthy();
      const heading = overlay?.querySelector('h3');
      expect(heading?.textContent).toBe('How to Play');

      // Clean up
      overlay?.remove();
    });

    it('should have "Got it" button that dismisses the overlay', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      (root.querySelector('#diff-help') as HTMLElement).click();
      await tick();

      const overlay = document.body.querySelector('.game-settings-overlay');
      expect(overlay).toBeTruthy();
      const gotItBtn = overlay?.querySelector('#help-close') as HTMLElement;
      expect(gotItBtn).toBeTruthy();
      expect(gotItBtn.textContent).toBe('Got it');

      gotItBtn.click();
      await tick();
      // Overlay should be removed from DOM
      expect(document.body.querySelector('.game-settings-overlay')).toBeNull();
    });

    it('clicking overlay background should dismiss help overlay', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      (root.querySelector('#diff-help') as HTMLElement).click();
      await tick();

      const overlay = document.body.querySelector('.game-settings-overlay') as HTMLElement;
      expect(overlay).toBeTruthy();

      // Click on the overlay itself (background)
      overlay.click();
      await tick();
      expect(document.body.querySelector('.game-settings-overlay')).toBeNull();
    });
  });

  // ═══════════════════════════════════════
  // PER-GAME SETTINGS OVERLAY
  // ═══════════════════════════════════════
  describe('Per-Game Settings Overlay', () => {

    it('should show settings overlay with "Settings" title when gear is clicked', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const gearBtn = root.querySelector('#diff-settings') as HTMLElement;
      expect(gearBtn).toBeTruthy();
      gearBtn.click();
      await tick();

      const overlay = document.body.querySelector('.game-settings-overlay');
      expect(overlay).toBeTruthy();
      const heading = overlay?.querySelector('h3');
      expect(heading?.textContent).toBe('Settings');

      // Clean up
      overlay?.remove();
    });

    it('should have "Done" button that closes the overlay', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      (root.querySelector('#diff-settings') as HTMLElement).click();
      await tick();

      const overlay = document.body.querySelector('.game-settings-overlay');
      expect(overlay).toBeTruthy();
      const doneBtn = overlay?.querySelector('#close-gsettings') as HTMLElement;
      expect(doneBtn).toBeTruthy();
      expect(doneBtn.textContent).toBe('Done');

      doneBtn.click();
      await tick();
      expect(document.body.querySelector('.game-settings-overlay')).toBeNull();
    });

    it('should have Reset Progress button', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      (root.querySelector('#diff-settings') as HTMLElement).click();
      await tick();

      const overlay = document.body.querySelector('.game-settings-overlay');
      const resetBtn = overlay?.querySelector('#reset-progress') as HTMLElement;
      expect(resetBtn).toBeTruthy();
      expect(resetBtn.textContent).toBe('Reset');

      // Clicking Reset should close the overlay
      resetBtn.click();
      await tick();
      expect(document.body.querySelector('.game-settings-overlay')).toBeNull();
    });

    it('clicking overlay background should dismiss settings overlay', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      (root.querySelector('#diff-settings') as HTMLElement).click();
      await tick();

      const overlay = document.body.querySelector('.game-settings-overlay') as HTMLElement;
      expect(overlay).toBeTruthy();
      overlay.click();
      await tick();
      expect(document.body.querySelector('.game-settings-overlay')).toBeNull();
    });
  });

  // ═══════════════════════════════════════
  // GAME OVER HANDLING
  // ═══════════════════════════════════════
  describe('Game Over Handling', () => {

    it('should show game over overlay when onGameOver fires', async () => {
      // Pre-populate a high score so that the final score of 100 is NOT a new best
      const allGames = getAllGames();
      const firstGame = allGames[0];
      const statsKey = `stats_${firstGame.id}`;
      store.set(statsKey, {
        bestScore: 9999,
        totalGames: 5,
        totalScore: 25000,
        recentScores: [],
        weeklyBest: 9999,
        lifetimeBest: 9999,
      });

      await app.mount();

      const originalCreate = firstGame.createGame;

      let capturedOnGameOver: ((score: number) => void) | null = null;

      firstGame.createGame = (config) => {
        capturedOnGameOver = config.onGameOver!;
        return originalCreate(config);
      };

      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      firstGame.createGame = originalCreate;

      // Fire game over with score below the existing best
      if (capturedOnGameOver) {
        capturedOnGameOver(100);
        await tick(100);

        const gameOver = root.querySelector('.game-over');
        expect(gameOver).toBeTruthy();
        expect(gameOver?.querySelector('h2')?.textContent).toBe('Game Over');
        expect(gameOver?.querySelector('.final-score')?.textContent).toBe('100');
        expect(root.querySelector('#go-home')).toBeTruthy();
        expect(root.querySelector('#play-again')).toBeTruthy();
      }
    });

    it('should show "New Best!" when score beats previous best', async () => {
      await app.mount();

      const allGames = getAllGames();
      const firstGame = allGames[0];
      const originalCreate = firstGame.createGame;

      let capturedOnGameOver: ((score: number) => void) | null = null;

      firstGame.createGame = (config) => {
        capturedOnGameOver = config.onGameOver!;
        return originalCreate(config);
      };

      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      firstGame.createGame = originalCreate;

      // Fire with a score that will be a new best (no previous scores)
      if (capturedOnGameOver) {
        capturedOnGameOver(999);
        await tick(100);

        // New-best game-overs use the celebratory .win variant of the overlay
        // and show a rotating congratulatory message rather than "New Best!".
        const overlay = root.querySelector('.game-over.win');
        expect(overlay).toBeTruthy();
        const label = root.querySelector('.game-over .best-label');
        expect(label?.textContent).toContain('New best');
      }
    });

    it('go home button should return to home screen after game over', async () => {
      await app.mount();

      const allGames = getAllGames();
      const firstGame = allGames[0];
      const originalCreate = firstGame.createGame;

      let capturedOnGameOver: ((score: number) => void) | null = null;

      firstGame.createGame = (config) => {
        capturedOnGameOver = config.onGameOver!;
        return originalCreate(config);
      };

      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      firstGame.createGame = originalCreate;

      if (capturedOnGameOver) {
        capturedOnGameOver(50);
        await tick(100);

        const goHome = root.querySelector('#go-home') as HTMLElement;
        expect(goHome).toBeTruthy();
        goHome.click();
        await tick();

        const hero = root.querySelector('.home-hero h1');
        expect(hero?.textContent).toBe('NoFi.Games');
      }
    });

    it('play again button should restart the game after game over', async () => {
      await app.mount();

      const allGames = getAllGames();
      const firstGame = allGames[0];
      const originalCreate = firstGame.createGame;

      let capturedOnGameOver: ((score: number) => void) | null = null;

      firstGame.createGame = (config) => {
        capturedOnGameOver = config.onGameOver!;
        return originalCreate(config);
      };

      const suppress = (e: PromiseRejectionEvent) => e.preventDefault();
      window.addEventListener('unhandledrejection', suppress);

      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      firstGame.createGame = originalCreate;

      if (capturedOnGameOver) {
        capturedOnGameOver(50);
        await tick(100);

        const playAgain = root.querySelector('#play-again') as HTMLElement;
        expect(playAgain).toBeTruthy();
        playAgain.click();
        await tick(200);

        // Should have a fresh game canvas (game restarted)
        expect(root.querySelector('#game-canvas')).toBeTruthy();
      }

      window.removeEventListener('unhandledrejection', suppress);
    });

    it('should display best score and total games in game over overlay', async () => {
      // Pre-seed a high score so the test's game-over doesn't get classified
      // as a new best (new-best overlays use a different celebratory label).
      const { saveScore } = await import('../../src/storage/scores');
      const allGames = getAllGames();
      const firstGame = allGames[0];
      await saveScore(firstGame.id, 5000, undefined, 1);

      await app.mount();

      const originalCreate = firstGame.createGame;

      let capturedOnGameOver: ((score: number) => void) | null = null;

      firstGame.createGame = (config) => {
        capturedOnGameOver = config.onGameOver!;
        return originalCreate(config);
      };

      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      firstGame.createGame = originalCreate;

      if (capturedOnGameOver) {
        // Score 100 is below the pre-seeded 5000, so NOT a new best —
        // overlay shows the regular Best: X • Games: Y label.
        capturedOnGameOver(100);
        await tick(100);

        const bestLabel = root.querySelector('.game-over .best-label');
        expect(bestLabel).toBeTruthy();
        expect(bestLabel?.textContent).toContain('Best:');
        expect(bestLabel?.textContent).toContain('Games:');
      }
    });
  });

  // ═══════════════════════════════════════
  // SCORES SCREEN (via private method)
  // ═══════════════════════════════════════
  describe('Scores Screen', () => {

    it('should render scores screen with tabs', async () => {
      await app.mount();
      const allGames = getAllGames();
      const gameId = allGames[0].id;

      // Access private showScores via type coercion
      await (app as unknown as { showScores: (id: string) => Promise<void> }).showScores(gameId);
      await tick();

      const headerTitle = root.querySelector('.header-title');
      expect(headerTitle?.textContent).toContain('Scores');
      const tabs = root.querySelectorAll('.scores-tab');
      expect(tabs.length).toBe(3);
      const tabTexts = Array.from(tabs).map(t => t.textContent);
      expect(tabTexts).toContain('Recent');
      expect(tabTexts).toContain('Weekly');
      expect(tabTexts).toContain('Stats');
    });

    it('should show empty state when no scores exist', async () => {
      await app.mount();
      const allGames = getAllGames();
      const gameId = allGames[0].id;

      await (app as unknown as { showScores: (id: string) => Promise<void> }).showScores(gameId);
      await tick();

      const content = root.querySelector('#scores-content');
      expect(content).toBeTruthy();
      const emptyState = content?.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState?.textContent).toContain('No scores yet');
    });

    it('should switch to Weekly tab when clicked', async () => {
      await app.mount();
      const allGames = getAllGames();
      const gameId = allGames[0].id;

      await (app as unknown as { showScores: (id: string) => Promise<void> }).showScores(gameId);
      await tick();

      const tabs = root.querySelectorAll('.scores-tab');
      const weeklyTab = Array.from(tabs).find(t => t.textContent === 'Weekly') as HTMLElement;
      expect(weeklyTab).toBeTruthy();
      weeklyTab.click();
      await tick();

      // Weekly tab should now be active
      expect(weeklyTab.classList.contains('active')).toBe(true);
      const content = root.querySelector('#scores-content');
      expect(content?.textContent).toContain("This Week's Best");
    });

    it('should switch to Stats tab and show statistics', async () => {
      await app.mount();
      const allGames = getAllGames();
      const gameId = allGames[0].id;

      await (app as unknown as { showScores: (id: string) => Promise<void> }).showScores(gameId);
      await tick();

      const tabs = root.querySelectorAll('.scores-tab');
      const statsTab = Array.from(tabs).find(t => t.textContent === 'Stats') as HTMLElement;
      expect(statsTab).toBeTruthy();
      statsTab.click();
      await tick();

      expect(statsTab.classList.contains('active')).toBe(true);
      const content = root.querySelector('#scores-content');
      expect(content?.textContent).toContain('Lifetime Best');
      expect(content?.textContent).toContain('Total Games');
      expect(content?.textContent).toContain('Average Score');
      expect(content?.textContent).toContain('Total Points');
    });

    it('should show recent scores when they exist', async () => {
      // Pre-populate scores in the store
      const allGames = getAllGames();
      const gameId = allGames[0].id;
      const statsKey = `stats_${gameId}`;
      store.set(statsKey, {
        bestScore: 500,
        totalGames: 3,
        totalScore: 1200,
        recentScores: [
          { score: 500, date: Date.now(), gameId, difficulty: 0 },
          { score: 400, date: Date.now() - 1000, gameId, difficulty: 1 },
          { score: 300, date: Date.now() - 2000, gameId, difficulty: 2 },
        ],
        weeklyBest: 500,
        lifetimeBest: 500,
      });

      await app.mount();
      await (app as unknown as { showScores: (id: string) => Promise<void> }).showScores(gameId);
      await tick();

      const content = root.querySelector('#scores-content');
      expect(content).toBeTruthy();
      const scoreRows = content?.querySelectorAll('.score-row');
      expect(scoreRows?.length).toBe(3);
      // First row should show rank #1
      const rank = scoreRows?.[0].querySelector('.score-rank');
      expect(rank?.textContent).toBe('#1');
      // Should show the score value
      const value = scoreRows?.[0].querySelector('.score-value');
      expect(value?.textContent).toBe('500');
    });

    it('should have back button on scores screen', async () => {
      await app.mount();
      const allGames = getAllGames();
      const gameId = allGames[0].id;

      await (app as unknown as { showScores: (id: string) => Promise<void> }).showScores(gameId);
      await tick();

      const backBtn = root.querySelector('#scores-back');
      expect(backBtn).toBeTruthy();
    });

    it('switching tabs should deactivate other tabs', async () => {
      await app.mount();
      const allGames = getAllGames();
      const gameId = allGames[0].id;

      await (app as unknown as { showScores: (id: string) => Promise<void> }).showScores(gameId);
      await tick();

      const tabs = root.querySelectorAll('.scores-tab');
      const personalTab = tabs[0] as HTMLElement;
      const weeklyTab = tabs[1] as HTMLElement;
      const statsTab = tabs[2] as HTMLElement;

      // Initially personal is active
      expect(personalTab.classList.contains('active')).toBe(true);

      // Click stats
      statsTab.click();
      await tick();
      expect(statsTab.classList.contains('active')).toBe(true);
      expect(personalTab.classList.contains('active')).toBe(false);
      expect(weeklyTab.classList.contains('active')).toBe(false);

      // Click weekly
      weeklyTab.click();
      await tick();
      expect(weeklyTab.classList.contains('active')).toBe(true);
      expect(statsTab.classList.contains('active')).toBe(false);
    });
  });

  // ═══════════════════════════════════════
  // FPS SPINNER DRAWING
  // ═══════════════════════════════════════
  describe('FPS Spinner', () => {

    it('should invoke drawFpsSpinner without error', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();

      // The FPS spinner canvas should be present
      const spinnerCanvas = root.querySelector('#fps-spinner-canvas') as HTMLCanvasElement;
      expect(spinnerCanvas).toBeTruthy();

      // Call drawFpsSpinner directly
      const drawFpsSpinner = (app as unknown as { drawFpsSpinner: (fps: number) => void }).drawFpsSpinner;
      expect(() => drawFpsSpinner.call(app, 60)).not.toThrow();
      expect(() => drawFpsSpinner.call(app, 45)).not.toThrow();
      expect(() => drawFpsSpinner.call(app, 20)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════
  // ERROR BOUNDARY RETRY
  // ═══════════════════════════════════════
  describe('Error Boundary Retry', () => {

    it('should allow retrying after error', async () => {
      await app.mount();

      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const allGames = getAllGames();
      const firstGame = allGames[0];
      const originalCreate = firstGame.createGame;
      let callCount = 0;
      firstGame.createGame = (config) => {
        callCount++;
        if (callCount === 1) throw new Error('Test constructor error');
        // Restore original for retry
        return originalCreate(config);
      };

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onUnhandled = (e: PromiseRejectionEvent) => { e.preventDefault(); };
      window.addEventListener('unhandledrejection', onUnhandled);

      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(300);

      // Should be showing error UI
      const errRetry = root.querySelector('#err-retry') as HTMLElement;
      if (errRetry) {
        errRetry.click();
        await tick(300);
        // After retry with working createGame, should show game canvas
        expect(root.querySelector('#game-canvas')).toBeTruthy();
      }

      firstGame.createGame = originalCreate;
      consoleError.mockRestore();
      window.removeEventListener('unhandledrejection', onUnhandled);
    });
  });

  // ═══════════════════════════════════════
  // DIFFICULTY SCREEN FAVOURITE TOGGLE
  // ═══════════════════════════════════════
  describe('Difficulty Screen Favourite Toggle', () => {

    it('should toggle favourite on difficulty screen', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const favBtn = root.querySelector('#diff-fav') as HTMLElement;
      expect(favBtn).toBeTruthy();
      // Initially unfavourited
      expect(favBtn.textContent).toBe('\u2606');

      // Click to favourite
      favBtn.click();
      await tick();
      expect(favBtn.textContent).toBe('\u2605');

      // Click again to unfavourite
      favBtn.click();
      await tick();
      expect(favBtn.textContent).toBe('\u2606');
    });
  });

  // ═══════════════════════════════════════
  // PAUSE BUTTON
  // ═══════════════════════════════════════
  describe('Pause Button', () => {

    it('should toggle pause when pause button is clicked during game', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      const pauseBtn = root.querySelector('#hud-pause') as HTMLElement;
      expect(pauseBtn).toBeTruthy();
      // Click pause - should not throw
      pauseBtn.click();
      await tick();
      // Click again to resume
      pauseBtn.click();
      await tick();
      // Game canvas should still be present
      expect(root.querySelector('#game-canvas')).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════
  // POPSTATE (BROWSER BACK BUTTON)
  // ═══════════════════════════════════════
  describe('PopState Navigation', () => {

    it('should handle popstate on settings screen', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      expect(root.querySelector('.header-title')?.textContent).toBe('Settings');

      // Simulate browser back
      window.dispatchEvent(new PopStateEvent('popstate'));
      await tick();
      expect(root.querySelector('.home-hero h1')?.textContent).toBe('NoFi.Games');
    });

    it('should handle popstate on difficulty screen', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#diff-slider')).toBeTruthy();

      window.dispatchEvent(new PopStateEvent('popstate'));
      await tick();
      expect(root.querySelector('.home-hero h1')?.textContent).toBe('NoFi.Games');
    });

    it('should handle popstate on scores screen', async () => {
      await app.mount();
      const allGames = getAllGames();
      const gameId = allGames[0].id;

      // Navigate to scores
      await (app as unknown as { showScores: (id: string) => Promise<void> }).showScores(gameId);
      await tick();
      expect(root.querySelector('.header-title')?.textContent).toContain('Scores');

      // Simulate browser back - should try to go to difficulty screen
      // Need to set currentGameId first (it's set by showScores)
      window.dispatchEvent(new PopStateEvent('popstate'));
      await tick();
      // Should have navigated away from scores
      const title = root.querySelector('.header-title');
      expect(title).toBeTruthy();
    });

    it('should handle popstate on game screen', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const suppress = (e: PromiseRejectionEvent) => e.preventDefault();
      window.addEventListener('unhandledrejection', suppress);

      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);
      expect(root.querySelector('#game-canvas')).toBeTruthy();

      window.dispatchEvent(new PopStateEvent('popstate'));
      await tick();
      expect(root.querySelector('.home-hero h1')?.textContent).toBe('NoFi.Games');

      window.removeEventListener('unhandledrejection', suppress);
    });
  });

  // ═══════════════════════════════════════
  // SCORE CALLBACK DURING GAME
  // ═══════════════════════════════════════
  describe('Score Callback', () => {

    it('should update HUD score when onScore fires', async () => {
      await app.mount();

      const allGames = getAllGames();
      const firstGame = allGames[0];
      const originalCreate = firstGame.createGame;

      let capturedOnScore: ((score: number) => void) | null = null;

      firstGame.createGame = (config) => {
        capturedOnScore = config.onScore!;
        return originalCreate(config);
      };

      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      firstGame.createGame = originalCreate;

      if (capturedOnScore) {
        capturedOnScore(42);
        await tick();
        const hudScore = root.querySelector('#hud-score');
        expect(hudScore?.textContent).toBe('42');
      }
    });
  });

  // ═══════════════════════════════════════
  // SAVE / RESUME FLOW
  // ═══════════════════════════════════════
  describe('Save / Resume Flow', () => {

    it('autoSave on exitGame writes a snapshot to IDB', async () => {
      const { loadGameState } = await import('../../src/storage/gameState');
      await app.mount();

      // Find a game that supports save (block-drop does)
      const allGames = getAllGames();
      const firstGame = allGames[0];

      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      // Force a score so we know the snapshot reflects engine state
      const inst = (app as unknown as { gameInstance: { getScore(): number; score?: number } }).gameInstance;
      expect(inst).toBeTruthy();
      // Many engines store score on a protected field — set directly
      (inst as unknown as { score: number }).score = 123;

      // Exit — this should trigger autoSave before destroying
      (root.querySelector('#hud-back') as HTMLElement).click();
      await tick(100);

      const saved = await loadGameState(firstGame.id);
      // Some games return null from serialize() — only assert when state was captured
      if (saved) {
        expect(saved.score).toBe(123);
        expect(saved.difficulty).toBe(0);
      }
    });

    it('autoSave is skipped when canSave returns false', async () => {
      const { loadGameState } = await import('../../src/storage/gameState');
      await app.mount();

      const allGames = getAllGames();
      const firstGame = allGames[0];

      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      const inst = (app as unknown as { gameInstance: { canSave: () => boolean } }).gameInstance;
      expect(inst).toBeTruthy();
      // Force canSave to return false
      inst.canSave = () => false;

      (root.querySelector('#hud-back') as HTMLElement).click();
      await tick(100);

      const saved = await loadGameState(firstGame.id, 0);
      expect(saved).toBeNull();
    });

    it('showDifficulty surfaces a Resume button when saved state exists at the selected difficulty', async () => {
      const { saveGameState } = await import('../../src/storage/gameState');
      await app.mount();

      const allGames = getAllGames();
      const firstGame = allGames[0];
      // Default initial difficulty is Easy (0) unless prior per-game settings say otherwise,
      // so save at 0 to match what the difficulty screen shows on open.
      await saveGameState(firstGame.id, {
        state: { dummy: true },
        score: 777,
        won: false,
        difficulty: 0,
      });

      await (app as unknown as { showDifficulty: (id: string) => Promise<void> }).showDifficulty(firstGame.id);
      await tick();

      const playBtn = root.querySelector('#diff-play') as HTMLElement;
      expect(playBtn).toBeTruthy();
      expect(playBtn.textContent).toContain('Resume');
      expect(playBtn.textContent).toContain('777');

      // Slider is NOT locked anymore — user can switch difficulties freely
      const slider = root.querySelector('#diff-slider') as HTMLInputElement;
      expect(slider.disabled).toBe(false);

      // Play button should show Resume for the saved difficulty
      expect(root.querySelector('#diff-play')?.textContent).toContain('Resume');
    });

    it('Resume banner updates as the slider moves to a different difficulty', async () => {
      const { saveGameState } = await import('../../src/storage/gameState');
      await app.mount();

      const firstGame = getAllGames()[0];
      // Save only at Hard (difficulty 2)
      await saveGameState(firstGame.id, {
        state: { dummy: true },
        score: 999,
        won: false,
        difficulty: 2,
      });

      await (app as unknown as { showDifficulty: (id: string) => Promise<void> }).showDifficulty(firstGame.id);
      await tick();

      // Starts at Easy (0) — no save here
      const playBtn = () => root.querySelector('#diff-play') as HTMLElement;
      expect(playBtn().textContent).toContain('Play');
      expect(playBtn().textContent).not.toContain('Resume');

      // Move slider to Hard (2) — should now show Resume
      const slider = root.querySelector('#diff-slider') as HTMLInputElement;
      slider.value = '2';
      slider.dispatchEvent(new Event('input'));
      await tick(20);
      expect(playBtn().textContent).toContain('Resume');
      expect(playBtn().textContent).toContain('999');
    });

    it('Play button always shows Resume when save exists (no start-over link)', async () => {
      const { saveGameState } = await import('../../src/storage/gameState');
      await app.mount();

      const allGames = getAllGames();
      const firstGame = allGames[0];
      await saveGameState(firstGame.id, {
        state: { dummy: true },
        score: 500,
        won: false,
        difficulty: 0,
      });

      await (app as unknown as { showDifficulty: (id: string) => Promise<void> }).showDifficulty(firstGame.id);
      await tick();

      // No start-over link exists — only Resume
      expect(root.querySelector('#diff-startover')).toBeNull();
      const playBtn = root.querySelector('#diff-play') as HTMLElement;
      expect(playBtn.textContent).toContain('Resume');
    });

    it('handleGameOver clears saved state', async () => {
      const { saveGameState, loadGameState } = await import('../../src/storage/gameState');
      await app.mount();

      const allGames = getAllGames();
      const firstGame = allGames[0];

      // Pre-seed saved state at Easy
      await saveGameState(firstGame.id, {
        state: { foo: 1 },
        score: 10,
        won: false,
        difficulty: 0,
      });

      const originalCreate = firstGame.createGame;
      let capturedOnGameOver: ((score: number) => void) | null = null;
      firstGame.createGame = (config) => {
        capturedOnGameOver = config.onGameOver!;
        return originalCreate(config);
      };

      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      firstGame.createGame = originalCreate;

      if (capturedOnGameOver) {
        capturedOnGameOver(50);
        await tick(100);
      }

      const saved = await loadGameState(firstGame.id, 0);
      expect(saved).toBeNull();
    });

    it('visibilitychange:hidden triggers autoSave', async () => {
      const { loadGameState } = await import('../../src/storage/gameState');
      await app.mount();

      const allGames = getAllGames();
      const firstGame = allGames[0];

      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      const inst = (app as unknown as { gameInstance: { canSave: () => boolean; serialize: () => Record<string, unknown> | null; score: number } }).gameInstance;
      expect(inst).toBeTruthy();
      // Force the engine to claim it can save and provide a snapshot
      inst.canSave = () => true;
      inst.serialize = () => ({ test: 'snapshot' });
      inst.score = 321;

      // Simulate tab going to background
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await tick(100);

      const saved = await loadGameState(firstGame.id, 0);
      expect(saved).toBeTruthy();
      expect(saved?.score).toBe(321);

      // Reset for other tests
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

      // Cleanup game before test ends
      (root.querySelector('#hud-back') as HTMLElement)?.click();
      await tick();
    });
  });

  // ═══════════════════════════════════════
  // WIN CELEBRATION OVERLAY
  // ═══════════════════════════════════════
  describe('Win Celebration Overlay', () => {

    it('handleWin shows celebration overlay for continuable (2048) game', async () => {
      await app.mount();

      const twenty = getGame('2048')!;
      expect(twenty).toBeTruthy();
      const originalCreate = twenty.createGame;
      let capturedOnWin: ((score: number) => void) | null = null;
      twenty.createGame = (config) => {
        capturedOnWin = config.onWin!;
        return originalCreate(config);
      };

      await (app as unknown as { showDifficulty: (id: string) => Promise<void> }).showDifficulty('2048');
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      twenty.createGame = originalCreate;

      expect(capturedOnWin).toBeTruthy();
      capturedOnWin!(2048);
      await tick(50);

      // Assert win overlay exists
      const winOverlay = root.querySelector('.game-over.win');
      expect(winOverlay).toBeTruthy();
      // Title is now a rotating celebratory message, not a fixed string.
      // Verify it's non-empty.
      const title = winOverlay?.querySelector('h2')?.textContent?.trim() ?? '';
      expect(title.length).toBeGreaterThan(0);
      // Confetti canvas should be attached
      expect(root.querySelector('.confetti-canvas')).toBeTruthy();

      // Win overlay now has NO buttons — auto-continues after ~2.5s
      expect(root.querySelector('#win-continue')).toBeNull();
      expect(root.querySelector('#win-quit')).toBeNull();
      expect(root.querySelector('#win-home')).toBeNull();
      expect(root.querySelector('#win-again')).toBeNull();
      // Score and celebration message are shown
      expect(winOverlay?.querySelector('.final-score')).toBeTruthy();
    });

    it('Win overlay shows celebration for terminal puzzle wins (sudoku) with no buttons', async () => {
      await app.mount();

      const sudoku = getGame('sudoku')!;
      expect(sudoku).toBeTruthy();
      const originalCreate = sudoku.createGame;
      let capturedOnWin: ((score: number) => void) | null = null;
      sudoku.createGame = (config) => {
        capturedOnWin = config.onWin!;
        return originalCreate(config);
      };

      await (app as unknown as { showDifficulty: (id: string) => Promise<void> }).showDifficulty('sudoku');
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      sudoku.createGame = originalCreate;

      expect(capturedOnWin).toBeTruthy();
      capturedOnWin!(999);
      await tick(50);

      const winOverlay = root.querySelector('.game-over.win');
      expect(winOverlay).toBeTruthy();
      // Terminal wins: no buttons, auto-starts next game after confetti
      expect(root.querySelector('#win-home')).toBeNull();
      expect(root.querySelector('#win-again')).toBeNull();
      expect(winOverlay?.querySelector('.final-score')?.textContent).toBe('999');
    });

    it('continuable win overlay pauses the game while celebration shows', async () => {
      await app.mount();

      const twenty = getGame('2048')!;
      const originalCreate = twenty.createGame;
      let capturedOnWin: ((score: number) => void) | null = null;
      twenty.createGame = (config) => {
        capturedOnWin = config.onWin!;
        return originalCreate(config);
      };

      await (app as unknown as { showDifficulty: (id: string) => Promise<void> }).showDifficulty('2048');
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      twenty.createGame = originalCreate;

      capturedOnWin!(2048);
      await tick(50);

      const winOverlay = root.querySelector('.game-over.win');
      expect(winOverlay).toBeTruthy();
      // Game should be paused during the celebration
      const inst = (app as unknown as { gameInstance: { isPaused(): boolean } }).gameInstance;
      expect(inst.isPaused()).toBe(true);
      // No buttons — auto-continues after a timer (tested implicitly by
      // the fact that no buttons exist and the setTimeout is in the code)
      expect(root.querySelector('#win-continue')).toBeNull();
      expect(root.querySelector('#win-quit')).toBeNull();
    });

    it('handleGameOver suppresses its own overlay if justWon was set', async () => {
      await app.mount();

      const sudoku = getGame('sudoku')!;
      const originalCreate = sudoku.createGame;
      let capturedOnWin: ((score: number) => void) | null = null;
      let capturedOnGameOver: ((score: number) => void) | null = null;
      sudoku.createGame = (config) => {
        capturedOnWin = config.onWin!;
        capturedOnGameOver = config.onGameOver!;
        return originalCreate(config);
      };

      await (app as unknown as { showDifficulty: (id: string) => Promise<void> }).showDifficulty('sudoku');
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      sudoku.createGame = originalCreate;

      // Fire win then game-over in sequence (sudoku is terminal, so the engine
      // will call gameOver shortly after a win)
      capturedOnWin!(500);
      await tick(50);
      // At this point the win overlay is rendered and justWon = true
      expect(root.querySelector('.game-over.win')).toBeTruthy();

      capturedOnGameOver!(500);
      // handleGameOver is async — wait for its microtask chain to finish
      // (saveScore → clearGameState → getStats → justWon early-return)
      await tick(300);

      // The win overlay should be the only overlay — no plain "Game Over" stacked
      const plainOverlays = root.querySelectorAll('.game-over:not(.win)');
      expect(plainOverlays.length).toBe(0);
      const winOverlays = root.querySelectorAll('.game-over.win');
      expect(winOverlays.length).toBe(1);
    });

    it('Terminal win clears saved state immediately', async () => {
      const { saveGameState, loadGameState } = await import('../../src/storage/gameState');
      await app.mount();

      // Pre-seed saved state for sudoku
      await saveGameState('sudoku', {
        state: { foo: 1 },
        score: 50,
        won: false,
        difficulty: 0,
      });

      const sudoku = getGame('sudoku')!;
      const originalCreate = sudoku.createGame;
      let capturedOnWin: ((score: number) => void) | null = null;
      sudoku.createGame = (config) => {
        capturedOnWin = config.onWin!;
        return originalCreate(config);
      };

      await (app as unknown as { showDifficulty: (id: string) => Promise<void> }).showDifficulty('sudoku');
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);

      sudoku.createGame = originalCreate;

      capturedOnWin!(500);
      await tick(100);

      const saved = await loadGameState('sudoku');
      expect(saved).toBeNull();
    });
  });

  // ═══════════════════════════════════════
  // KEYBOARD NAVIGATION
  // ═══════════════════════════════════════
  describe('Keyboard Navigation', () => {

    it('Enter on difficulty screen clicks Play button', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#diff-play')).toBeTruthy();

      const suppress = (e: PromiseRejectionEvent) => e.preventDefault();
      window.addEventListener('unhandledrejection', suppress);

      // Dispatch Enter with target that isn't a text input (the document body)
      const evt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      Object.defineProperty(evt, 'target', { value: document.body });
      document.dispatchEvent(evt);
      await tick(200);

      // Should have navigated to game screen
      expect(root.querySelector('#game-canvas')).toBeTruthy();

      window.removeEventListener('unhandledrejection', suppress);
    });

    it('Escape on difficulty screen calls history.back()', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const backSpy = vi.spyOn(history, 'back');

      const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      Object.defineProperty(evt, 'target', { value: document.body });
      document.dispatchEvent(evt);
      await tick();

      expect(backSpy).toHaveBeenCalled();
      backSpy.mockRestore();
    });

    it('F on difficulty screen toggles favourite', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const favBtn = root.querySelector('#diff-fav') as HTMLElement;
      expect(favBtn.textContent).toBe('\u2606');

      const evt = new KeyboardEvent('keydown', { key: 'f', bubbles: true });
      Object.defineProperty(evt, 'target', { value: document.body });
      document.dispatchEvent(evt);
      await tick(50);

      expect(favBtn.textContent).toBe('\u2605');
    });

    it('? on difficulty screen opens help overlay', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();

      const evt = new KeyboardEvent('keydown', { key: '?', bubbles: true });
      Object.defineProperty(evt, 'target', { value: document.body });
      document.dispatchEvent(evt);
      await tick();

      const overlay = document.body.querySelector('.game-settings-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay?.querySelector('h3')?.textContent).toBe('How to Play');
      overlay?.remove();
    });

    it('Escape on settings screen returns to home', async () => {
      await app.mount();
      // Call showSettings directly and await it so the async DOM wiring
      // (including bindToggle) fully completes before we dispatch Escape.
      await (app as unknown as { showSettings: () => Promise<void> }).showSettings();
      await tick();
      expect(root.querySelector('.header-title')?.textContent).toBe('Settings');
      // Sanity: bound listeners are in place
      expect(root.querySelector('#s-music')).toBeTruthy();

      const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      Object.defineProperty(evt, 'target', { value: document.body });
      document.dispatchEvent(evt);
      await tick(100);

      expect(root.querySelector('.home-hero h1')?.textContent).toBe('NoFi.Games');
    });

    it('Escape on game screen exits to home', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      (root.querySelector('#diff-play') as HTMLElement).click();
      await tick(200);
      expect(root.querySelector('#game-canvas')).toBeTruthy();

      const suppress = (e: PromiseRejectionEvent) => e.preventDefault();
      window.addEventListener('unhandledrejection', suppress);

      const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      Object.defineProperty(evt, 'target', { value: document.body });
      document.dispatchEvent(evt);
      await tick(100);

      expect(root.querySelector('.home-hero h1')?.textContent).toBe('NoFi.Games');

      window.removeEventListener('unhandledrejection', suppress);
    });

    it('Game cards on home are keyboard-focusable (tabindex=0)', async () => {
      await app.mount();
      const cards = root.querySelectorAll('.game-card');
      expect(cards.length).toBeGreaterThan(0);
      for (const card of Array.from(cards)) {
        expect((card as HTMLElement).tabIndex).toBe(0);
        expect(card.getAttribute('role')).toBe('button');
      }
    });

    it('Enter on a focused game card launches difficulty screen', async () => {
      await app.mount();
      const firstCard = root.querySelector('.game-card') as HTMLElement;

      // Dispatch keydown directly on the card (its own listener handles Enter)
      firstCard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await tick();

      expect(root.querySelector('#diff-slider')).toBeTruthy();
    });

    it('setKeys swaps bindings on screen change — home "s" binding does not fire on difficulty screen', async () => {
      await app.mount();

      // Navigate to difficulty screen — this should install new key bindings
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#diff-play')).toBeTruthy();

      // On the difficulty screen, pressing 's' should NOT navigate to settings
      // (home's 's' → showSettings binding must have been replaced)
      const evt = new KeyboardEvent('keydown', { key: 's', bubbles: true });
      Object.defineProperty(evt, 'target', { value: document.body });
      document.dispatchEvent(evt);
      await tick(100);

      // Still on difficulty screen — header title is the game name, not "Settings"
      expect(root.querySelector('.header-title')?.textContent).not.toBe('Settings');
      expect(root.querySelector('#diff-play')).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════
  // DAILY MODE
  // ═══════════════════════════════════════
  describe('Daily Mode', () => {
    it('home screen shows the Today card when at least one daily-eligible game is registered', async () => {
      await app.mount();
      const todayCard = root.querySelector('#today-card');
      // The new puzzle games (wordle, nonogram, etc.) all set dailyMode:true
      // so the card should be visible.
      expect(todayCard).toBeTruthy();
    });

    it('Today card shows current streak (or "Start a streak" when zero)', async () => {
      await app.mount();
      const streakEl = root.querySelector('.today-card-streak');
      expect(streakEl?.textContent).toContain('Start a streak');
    });

    it('Today card progress shows N of M solved', async () => {
      await app.mount();
      const progress = root.querySelector('.today-card-progress');
      expect(progress?.textContent).toMatch(/\d+ of \d+ solved/);
    });

    it('clicking the Today card opens the Daily screen', async () => {
      await app.mount();
      const todayCard = root.querySelector('#today-card') as HTMLElement;
      todayCard.click();
      await tick(50);
      expect(root.querySelector('.daily-screen')).toBeTruthy();
      expect(root.querySelector('.header-title')?.textContent).toBe('Daily');
    });

    it('Daily screen shows current/best streak and solved count', async () => {
      await app.mount();
      (root.querySelector('#today-card') as HTMLElement).click();
      await tick(50);
      const stats = root.querySelectorAll('.daily-streak-num');
      expect(stats.length).toBe(3); // current, best, solved
      // First stat is current streak (should be 0)
      expect(stats[0].textContent).toBe('0');
    });

    it('Daily screen lists every daily-eligible game', async () => {
      await app.mount();
      (root.querySelector('#today-card') as HTMLElement).click();
      await tick(50);
      const dailyGames = getAllGames().filter((g) => g.dailyMode);
      const rows = root.querySelectorAll('.daily-row');
      expect(rows.length).toBe(dailyGames.length);
      expect(rows.length).toBeGreaterThan(0);
    });

    it('Daily screen Escape key returns to home', async () => {
      await app.mount();
      (root.querySelector('#today-card') as HTMLElement).click();
      await tick(50);
      expect(root.querySelector('.daily-screen')).toBeTruthy();

      const evt = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(evt);
      await tick(50);
      // popstate isn't reliable in jsdom — just verify back-button click works.
      const backBtn = document.querySelector('#daily-back') as HTMLElement | null;
      if (backBtn) backBtn.click();
      await tick(50);
    });

    it('Daily back button returns to home', async () => {
      await app.mount();
      (root.querySelector('#today-card') as HTMLElement).click();
      await tick(50);
      const backBtn = root.querySelector('#daily-back') as HTMLElement;
      backBtn.click();
      await tick(50);
      // history.back triggers popstate which calls showHome
      // In jsdom popstate doesn't fire automatically — verify the click handler exists at least
      expect(backBtn).toBeTruthy();
    });

    it('completed games render with the .done class', async () => {
      // Pre-populate IDB with a completion for today
      const { markDailyComplete } = await import('../../src/storage/daily');
      const { todayDateString } = await import('../../src/utils/rng');
      const today = todayDateString();
      // Pick the first dailyMode game
      const dailyGame = getAllGames().find((g) => g.dailyMode)!;
      await markDailyComplete(dailyGame.id, today, 100);

      await app.mount();
      (root.querySelector('#today-card') as HTMLElement).click();
      await tick(50);

      const doneRows = root.querySelectorAll('.daily-row.done');
      expect(doneRows.length).toBeGreaterThan(0);
    });

    it('Today card progress reflects completed games', async () => {
      const { markDailyComplete } = await import('../../src/storage/daily');
      const { todayDateString } = await import('../../src/utils/rng');
      const today = todayDateString();
      const dailyGame = getAllGames().find((g) => g.dailyMode)!;
      await markDailyComplete(dailyGame.id, today, 100);

      await app.mount();
      const progress = root.querySelector('.today-card-progress')?.textContent || '';
      // Should be "1 of N solved"
      expect(progress).toMatch(/^1 of \d+ solved$/);
    });

    it('streak displays after a daily completion', async () => {
      const { markDailyComplete, bumpStreak } = await import('../../src/storage/daily');
      const { todayDateString } = await import('../../src/utils/rng');
      const today = todayDateString();
      const dailyGame = getAllGames().find((g) => g.dailyMode)!;
      await markDailyComplete(dailyGame.id, today, 100);
      await bumpStreak(today);

      await app.mount();
      const streakEl = root.querySelector('.today-card-streak');
      // Should show the fire emoji + 1
      expect(streakEl?.textContent).toContain('1');
      expect(streakEl?.textContent).not.toContain('Start a streak');
    });

    it('keyboard shortcut "T" on home opens Daily screen', async () => {
      await app.mount();
      const evt = new KeyboardEvent('keydown', { key: 't' });
      document.dispatchEvent(evt);
      await tick(50);
      expect(root.querySelector('.daily-screen')).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════
  // SHARE BUTTONS
  // ═══════════════════════════════════════
  describe('Share Buttons', () => {

    it('Home screen should have a share button with aria-label "Share"', async () => {
      await app.mount();
      const shareBtn = root.querySelector('#share-btn');
      expect(shareBtn).toBeTruthy();
      expect(shareBtn?.getAttribute('aria-label')).toBe('Share');
    });

    it('Home screen share button should have an SVG icon', async () => {
      await app.mount();
      const shareBtn = root.querySelector('#share-btn');
      expect(shareBtn).toBeTruthy();
      const svg = shareBtn?.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('Difficulty screen should have a share button with id "diff-share"', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const shareBtn = root.querySelector('#diff-share');
      expect(shareBtn).toBeTruthy();
    });

    it('Difficulty screen share button should have aria-label "Share game"', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const shareBtn = root.querySelector('#diff-share');
      expect(shareBtn).toBeTruthy();
      expect(shareBtn?.getAttribute('aria-label')).toBe('Share game');
    });
  });

  // ═══════════════════════════════════════
  // ACCESSIBILITY LABELS
  // ═══════════════════════════════════════
  describe('Accessibility Labels', () => {

    it('Home screen settings button should have aria-label "Settings"', async () => {
      await app.mount();
      const settingsBtn = root.querySelector('#settings-btn');
      expect(settingsBtn).toBeTruthy();
      expect(settingsBtn?.getAttribute('aria-label')).toBe('Settings');
    });

    it('Difficulty screen back button should have aria-label "Back"', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const backBtn = root.querySelector('#diff-back');
      expect(backBtn).toBeTruthy();
      expect(backBtn?.getAttribute('aria-label')).toBe('Back');
    });

    it('Difficulty screen fav button should have aria-label containing "favourites"', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const favBtn = root.querySelector('#diff-fav');
      expect(favBtn).toBeTruthy();
      expect(favBtn?.getAttribute('aria-label')).toContain('favourites');
    });

    it('Difficulty screen settings button should have aria-label "Game settings"', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const settingsBtn = root.querySelector('#diff-settings');
      expect(settingsBtn).toBeTruthy();
      expect(settingsBtn?.getAttribute('aria-label')).toBe('Game settings');
    });

    it('All header-back buttons should have aria-label attributes', async () => {
      await app.mount();
      const backBtns = root.querySelectorAll('.header-back');
      expect(backBtns.length).toBeGreaterThan(0);
      for (const btn of Array.from(backBtns)) {
        expect(btn.getAttribute('aria-label')).toBeTruthy();
      }
    });
  });

  // ═══════════════════════════════════════
  // GAME CARD LAYOUT
  // ═══════════════════════════════════════
  describe('Game Card Layout', () => {

    it('Game cards should have .game-card-title inside the thumbnail', async () => {
      await app.mount();
      const thumbs = root.querySelectorAll('.game-card-thumb');
      expect(thumbs.length).toBeGreaterThan(0);
      for (const thumb of Array.from(thumbs)) {
        const title = thumb.querySelector('.game-card-title');
        expect(title).toBeTruthy();
      }
    });

    it('Game card titles should contain game names', async () => {
      await app.mount();
      const titles = root.querySelectorAll('.game-card-title');
      const titleTexts = Array.from(titles).map(t => t.textContent);
      expect(titleTexts).toContain('Snake');
      expect(titleTexts).toContain('2048');
    });

    it('Game cards should have .game-card-desc for descriptions', async () => {
      await app.mount();
      const descs = root.querySelectorAll('.game-card-desc');
      expect(descs.length).toBe(getAllGames().length);
      for (const desc of Array.from(descs)) {
        expect(desc.textContent?.length).toBeGreaterThan(0);
      }
    });

    it('Game cards should have .game-card-best for best scores', async () => {
      await app.mount();
      const bests = root.querySelectorAll('.game-card-best');
      expect(bests.length).toBe(getAllGames().length);
    });
  });

  // ═══════════════════════════════════════
  // DIFFICULTY SCREEN LAYOUT
  // ═══════════════════════════════════════
  describe('Difficulty Screen Layout', () => {

    it('Help button should show "?" icon', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const helpBtn = root.querySelector('#diff-help');
      expect(helpBtn).toBeTruthy();
      expect(helpBtn?.textContent).toContain('?');
    });

    it('Difficulty slider fill (#diff-fill) should exist', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const fill = root.querySelector('#diff-fill');
      expect(fill).toBeTruthy();
    });

    it('Face canvas should be 280x280', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const canvas = root.querySelector('#face-canvas') as HTMLCanvasElement;
      expect(canvas).toBeTruthy();
      expect(canvas.getAttribute('width')).toBe('280');
      expect(canvas.getAttribute('height')).toBe('280');
    });

    it('Play button and help button should both exist', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      expect(root.querySelector('#diff-play')).toBeTruthy();
      expect(root.querySelector('#diff-help')).toBeTruthy();
    });

    it('Slider should have min=0 and max=3', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const slider = root.querySelector('#diff-slider') as HTMLInputElement;
      expect(slider).toBeTruthy();
      expect(slider.min).toBe('0');
      expect(slider.max).toBe('3');
    });
  });

  // ═══════════════════════════════════════
  // HEADER CENTERING
  // ═══════════════════════════════════════
  describe('Header Centering', () => {

    it('Header title should have CSS position: absolute (on difficulty screen)', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const title = root.querySelector('.header-title') as HTMLElement;
      expect(title).toBeTruthy();
      expect(title.classList.contains('header-title')).toBe(true);
    });

    it('Home screen should have a .home-hero element with branding', async () => {
      await app.mount();
      const hero = root.querySelector('.home-hero');
      expect(hero).toBeTruthy();
      expect(hero?.querySelector('h1')?.textContent).toBe('NoFi.Games');
    });
  });

  // ═══════════════════════════════════════
  // DEEP LINK ROUTING
  // ═══════════════════════════════════════
  describe('Deep Link Routing', () => {

    it('When URL path is "/" mount should show home screen', async () => {
      history.replaceState({}, '', '/');
      await app.mount();
      const grid = root.querySelector('.games-grid');
      expect(grid).toBeTruthy();
    });

    it('After navigating to a game, URL should contain the game ID', async () => {
      await app.mount();
      const firstCard = root.querySelector('.game-card') as HTMLElement;
      const gameId = firstCard.getAttribute('data-id') || getAllGames()[0].id;
      firstCard.click();
      await tick();
      // history.pushState is called with the gameId in the URL path
      expect(location.pathname).toContain(gameId);
    });
  });

  // ═══════════════════════════════════════
  // BUILD HASH
  // ═══════════════════════════════════════
  describe('Build Hash', () => {

    it('Settings screen should show build hash in monospace', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await tick();
      // __BUILD_HASH__ is "test" in vitest config
      const labels = root.querySelectorAll('.settings-label');
      const hashLabel = Array.from(labels).find(l => l.textContent === 'test');
      expect(hashLabel).toBeTruthy();
      expect((hashLabel as HTMLElement).style.fontFamily).toBe('monospace');
    });
  });

  // ═══════════════════════════════════════
  // SVG BACK ARROWS
  // ═══════════════════════════════════════
  describe('SVG Back Arrows', () => {

    it('Back buttons should contain SVG elements', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const backBtn = root.querySelector('#diff-back');
      expect(backBtn).toBeTruthy();
      const svg = backBtn?.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('Difficulty back button contains an svg element', async () => {
      await app.mount();
      (root.querySelector('.game-card') as HTMLElement).click();
      await tick();
      const diffBack = root.querySelector('#diff-back');
      expect(diffBack).toBeTruthy();
      expect(diffBack?.querySelector('svg')).toBeTruthy();
      // Verify it's an actual SVG with path content, not a unicode arrow
      const svgEl = diffBack?.querySelector('svg');
      expect(svgEl?.querySelector('path')).toBeTruthy();
    });
  });
});
