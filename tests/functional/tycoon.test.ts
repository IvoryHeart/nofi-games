import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock idb-keyval before any source imports (same pattern as app.test.ts).
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { TycoonApp } from '../../src/tycoon/app';
// Import the Dice Tycoon game so it self-registers via registerGame() at module
// level — main.ts does this lazily, but tests need it present synchronously.
import '../../src/games/dice-tycoon/DiceTycoon';
import { getGame } from '../../src/games/registry';

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe('Tycoon App Functional Tests', () => {
  let root: HTMLElement;
  let app: TycoonApp;

  beforeEach(() => {
    store.clear();
    root = document.createElement('div');
    root.id = 'app';
    document.body.appendChild(root);
    app = new TycoonApp(root);
  });

  afterEach(() => {
    // Suppress unhandled rejections from async game teardown after DOM cleanup.
    const suppress = (e: PromiseRejectionEvent) => e.preventDefault();
    window.addEventListener('unhandledrejection', suppress);
    root.remove();
    try { history.replaceState({}, '', '/'); } catch { /* jsdom */ }
    setTimeout(() => window.removeEventListener('unhandledrejection', suppress), 500);
  });

  describe('Home / landing', () => {
    it('renders the Dice Tycoon brand', async () => {
      await app.mount();
      const title = root.querySelector('.tycoon-hero h1');
      expect(title).toBeTruthy();
      expect(title?.textContent).toBe('Dice Tycoon');
    });

    it('shows a Play button', async () => {
      await app.mount();
      const play = root.querySelector('#tycoon-play');
      expect(play).toBeTruthy();
      expect(play?.textContent?.trim()).toBe('Play');
    });

    it('shows the four difficulty options', async () => {
      await app.mount();
      const diffs = root.querySelectorAll('.tycoon-diff-btn');
      expect(diffs.length).toBe(4);
      const labels = Array.from(diffs).map((d) => d.textContent?.trim());
      expect(labels).toEqual(['Easy', 'Medium', 'Hard', 'Extra Hard']);
    });

    it('has the Dice Tycoon game registered', () => {
      expect(getGame('dice-tycoon')).toBeTruthy();
    });

    it('updates active difficulty when a difficulty button is clicked', async () => {
      await app.mount();
      const hard = root.querySelectorAll('.tycoon-diff-btn')[2] as HTMLElement;
      hard.click();
      await tick();
      const active = root.querySelector('.tycoon-diff-btn.active');
      expect(active?.textContent?.trim()).toBe('Hard');
    });

    it('has a settings button', async () => {
      await app.mount();
      expect(root.querySelector('#tycoon-settings-btn')).toBeTruthy();
    });
  });

  describe('Navigation: Home → Play → Game → back', () => {
    it('constructs the engine and shows the game canvas on Play', async () => {
      await app.mount();
      (root.querySelector('#tycoon-play') as HTMLElement).click();
      await tick(200);

      const canvas = root.querySelector('#game-canvas');
      expect(canvas).toBeTruthy();
      expect(canvas?.tagName.toLowerCase()).toBe('canvas');
      // HUD score pill + back button reused from the main shell.
      expect(root.querySelector('.hud-score-pill')).toBeTruthy();
      expect(root.querySelector('#hud-back')).toBeTruthy();
      // The engine instance exists.
      const inst = (app as unknown as { gameInstance: unknown }).gameInstance;
      expect(inst).toBeTruthy();
    });

    it('returns to the home screen when the back button is clicked', async () => {
      await app.mount();
      (root.querySelector('#tycoon-play') as HTMLElement).click();
      await tick(200);
      expect(root.querySelector('#game-canvas')).toBeTruthy();

      (root.querySelector('#hud-back') as HTMLElement).click();
      await tick();
      expect(root.querySelector('.tycoon-hero h1')?.textContent).toBe('Dice Tycoon');
      // Engine should have been destroyed.
      const inst = (app as unknown as { gameInstance: unknown }).gameInstance;
      expect(inst).toBeNull();
    });
  });

  describe('Settings stub', () => {
    it('navigates to settings and shows the sound toggle', async () => {
      await app.mount();
      (root.querySelector('#tycoon-settings-btn') as HTMLElement).click();
      await tick();
      expect(root.querySelector('.header-title')?.textContent).toBe('Settings');
      expect(root.querySelector('#t-sound')).toBeTruthy();
    });

    it('persists settings when the sound toggle is clicked', async () => {
      const { set } = await import('idb-keyval');
      await app.mount();
      (root.querySelector('#tycoon-settings-btn') as HTMLElement).click();
      await tick();

      const soundBtn = root.querySelector('#t-sound') as HTMLElement;
      const callsBefore = (set as ReturnType<typeof vi.fn>).mock.calls.length;
      soundBtn.click();
      await tick();
      expect((set as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('returns home from settings via the back button', async () => {
      await app.mount();
      (root.querySelector('#tycoon-settings-btn') as HTMLElement).click();
      await tick();
      (root.querySelector('#tycoon-settings-back') as HTMLElement).click();
      await tick();
      expect(root.querySelector('.tycoon-hero h1')?.textContent).toBe('Dice Tycoon');
    });
  });
});
