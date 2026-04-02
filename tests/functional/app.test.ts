import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { App } from '../../src/app';
import { loadAllGames, getAllGames } from '../../src/games/registry';

describe('App Functional Tests', () => {
  let root: HTMLElement;
  let app: App;

  beforeEach(async () => {
    store.clear();
    root = document.createElement('div');
    root.id = 'app';
    document.body.appendChild(root);
    await loadAllGames();
    app = new App(root);
  });

  afterEach(() => { root.remove(); });

  describe('Home Screen', () => {
    it('should render with NoFi title', async () => {
      await app.mount();
      const title = root.querySelector('.home-hero h1');
      expect(title?.textContent).toBe('NoFi');
    });

    it('should show all registered games as cards', async () => {
      await app.mount();
      const cards = root.querySelectorAll('.game-card');
      expect(cards.length).toBe(getAllGames().length);
    });

    it('should show game names on cards', async () => {
      await app.mount();
      const names = root.querySelectorAll('.game-card-name');
      const nameTexts = Array.from(names).map(n => n.textContent);
      expect(nameTexts).toContain('Block Drop');
      expect(nameTexts).toContain('Snake');
      expect(nameTexts).toContain('2048');
    });

    it('should have favourite buttons on cards', async () => {
      await app.mount();
      const favBtns = root.querySelectorAll('.game-card-fav');
      expect(favBtns.length).toBe(getAllGames().length);
    });

    it('should have settings button in header', async () => {
      await app.mount();
      const btn = root.querySelector('#settings-btn');
      expect(btn).toBeTruthy();
    });

    it('should have game card thumbnails with gradients', async () => {
      await app.mount();
      const thumbs = root.querySelectorAll('.game-card-thumb');
      expect(thumbs.length).toBeGreaterThan(0);
      for (const thumb of Array.from(thumbs)) {
        const bg = (thumb as HTMLElement).style.background;
        expect(bg).toBeTruthy();
      }
    });
  });

  describe('Navigation to Difficulty Screen', () => {
    it('should show difficulty screen when card is clicked', async () => {
      await app.mount();
      const firstCard = root.querySelector('.game-card') as HTMLElement;
      firstCard.click();
      await new Promise(r => setTimeout(r, 50));
      const diffLabel = root.querySelector('.diff-label');
      expect(diffLabel).toBeTruthy();
    });

    it('should show difficulty face canvas', async () => {
      await app.mount();
      const firstCard = root.querySelector('.game-card') as HTMLElement;
      firstCard.click();
      await new Promise(r => setTimeout(r, 50));
      const faceCanvas = root.querySelector('#face-canvas');
      expect(faceCanvas).toBeTruthy();
    });

    it('should show difficulty slider', async () => {
      await app.mount();
      const firstCard = root.querySelector('.game-card') as HTMLElement;
      firstCard.click();
      await new Promise(r => setTimeout(r, 50));
      const slider = root.querySelector('#diff-slider') as HTMLInputElement;
      expect(slider).toBeTruthy();
      expect(slider.min).toBe('0');
      expect(slider.max).toBe('3');
    });

    it('should show Play button', async () => {
      await app.mount();
      const firstCard = root.querySelector('.game-card') as HTMLElement;
      firstCard.click();
      await new Promise(r => setTimeout(r, 50));
      const playBtn = root.querySelector('#diff-play');
      expect(playBtn).toBeTruthy();
      expect(playBtn?.textContent).toContain('Play');
    });

    it('should have back button', async () => {
      await app.mount();
      const firstCard = root.querySelector('.game-card') as HTMLElement;
      firstCard.click();
      await new Promise(r => setTimeout(r, 50));
      const backBtn = root.querySelector('#diff-back');
      expect(backBtn).toBeTruthy();
    });

    it('should have favourite and settings buttons', async () => {
      await app.mount();
      const firstCard = root.querySelector('.game-card') as HTMLElement;
      firstCard.click();
      await new Promise(r => setTimeout(r, 50));
      expect(root.querySelector('#diff-fav')).toBeTruthy();
      expect(root.querySelector('#diff-settings')).toBeTruthy();
    });
  });

  describe('Game Screen', () => {
    it('should show game with floating HUD when Play is clicked', async () => {
      await app.mount();
      const firstCard = root.querySelector('.game-card') as HTMLElement;
      firstCard.click();
      await new Promise(r => setTimeout(r, 50));
      const playBtn = root.querySelector('#diff-play') as HTMLElement;
      playBtn.click();
      await new Promise(r => setTimeout(r, 50));
      const canvas = root.querySelector('#game-canvas');
      expect(canvas).toBeTruthy();
      const hudScore = root.querySelector('#hud-score');
      expect(hudScore).toBeTruthy();
    });

    it('should have floating back and pause buttons', async () => {
      await app.mount();
      const firstCard = root.querySelector('.game-card') as HTMLElement;
      firstCard.click();
      await new Promise(r => setTimeout(r, 50));
      (root.querySelector('#diff-play') as HTMLElement).click();
      await new Promise(r => setTimeout(r, 50));
      expect(root.querySelector('#hud-back')).toBeTruthy();
      expect(root.querySelector('#hud-pause')).toBeTruthy();
    });
  });

  describe('Settings Screen', () => {
    it('should navigate to settings', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await new Promise(r => setTimeout(r, 50));
      const title = root.querySelector('.header-title');
      expect(title?.textContent).toBe('Settings');
    });

    it('should show audio controls', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await new Promise(r => setTimeout(r, 50));
      expect(root.querySelector('#s-volume')).toBeTruthy();
      expect(root.querySelector('#s-music')).toBeTruthy();
      expect(root.querySelector('#s-sound')).toBeTruthy();
      expect(root.querySelector('#s-vibration')).toBeTruthy();
    });

    it('should show FPS display', async () => {
      await app.mount();
      (root.querySelector('#settings-btn') as HTMLElement).click();
      await new Promise(r => setTimeout(r, 50));
      expect(root.querySelector('.fps-display')).toBeTruthy();
      expect(root.querySelector('#fps-num')).toBeTruthy();
    });
  });
});
