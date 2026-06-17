import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock idb-keyval before any source imports (same pattern as app.test.ts).
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { TycoonApp, computeSize } from '../../src/tycoon/app';
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
    // NOTE: the game screen now mounts the Pixi v8 WebGL view, which CANNOT
    // instantiate a real Application in jsdom — so we assert the shell STRUCTURE
    // (HUD pill, back button, Pixi host) that renders synchronously before the
    // async GPU init, not a live game instance. The Pixi view's pure logic is
    // covered by the unit/functional pixi tests + the headless TycoonCore suite.
    it('renders the game screen chrome (HUD pill + Pixi host) on Play', async () => {
      await app.mount();
      (root.querySelector('#tycoon-play') as HTMLElement).click();
      // Assert the SYNCHRONOUS structure that paints right after the rAF settle,
      // before the async Pixi import/GPU-init resolves (which, in jsdom, falls
      // back to the error UI — exercised separately).
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));

      // HUD score pill + back button reused from the main shell.
      expect(root.querySelector('.hud-score-pill')).toBeTruthy();
      expect(root.querySelector('#hud-back')).toBeTruthy();
      // The Pixi host element exists (Pixi appends its own canvas into it on a
      // real GPU; in jsdom it stays empty — that's fine).
      expect(root.querySelector('#pixi-host')).toBeTruthy();
      // No static game canvas anymore (Pixi owns its canvas).
      expect(root.querySelector('#game-canvas')).toBeNull();
    });

    it('returns to the home screen when the back button is clicked', async () => {
      await app.mount();
      (root.querySelector('#tycoon-play') as HTMLElement).click();
      await tick(120); // allow the async Pixi import to settle (error fallback in jsdom)

      // Click whichever home affordance is present (live HUD back OR the WebGL
      // error fallback's home button — both call exitGame()).
      const home =
        (root.querySelector('#hud-back') as HTMLElement | null) ??
        (root.querySelector('#err-home') as HTMLElement | null);
      expect(home).toBeTruthy();
      home!.click();
      await tick();
      expect(root.querySelector('.tycoon-hero h1')?.textContent).toBe('Dice Tycoon');
      // The Pixi view reference should have been cleared on exit.
      const inst = (app as unknown as { pixiGame: unknown }).pixiGame;
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

  describe('Responsive sizing (F1)', () => {
    const ASPECT = 360 / 640; // 0.5625

    it('clamps width to ≤480 on a wide desktop viewport', () => {
      // A tall, wide window: height-fill would demand >480px wide, so it clamps.
      const { w, h } = computeSize(1400, 900, ASPECT);
      expect(w).toBeLessThanOrEqual(480);
      expect(w).toBe(480);
      // Height derives from the clamped width and stays ≤ available height.
      expect(h).toBe(Math.floor(480 / ASPECT));
      expect(h).toBeLessThanOrEqual(900);
    });

    it('fills width (not 480) on a narrow phone viewport', () => {
      const { w, h } = computeSize(360, 760, ASPECT);
      // Height-fill (760*0.5625≈427) exceeds the 360 width cap → fill width.
      expect(w).toBe(360);
      expect(w).toBeLessThan(480);
      expect(h).toBe(Math.floor(360 / ASPECT));
    });

    it('fills height when it is the limiting dimension', () => {
      // Short + wide: height is the constraint, width well under cap.
      const { w, h } = computeSize(1000, 600, ASPECT);
      expect(h).toBe(600);
      expect(w).toBe(Math.floor(600 * ASPECT));
      expect(w).toBeLessThanOrEqual(480);
    });

    it('returns integer pixel dimensions', () => {
      const { w, h } = computeSize(377, 643, ASPECT);
      expect(Number.isInteger(w)).toBe(true);
      expect(Number.isInteger(h)).toBe(true);
    });

    it('cleans up and returns home on exitGame (no resize handler leak)', async () => {
      // The Pixi view's resize handler only registers AFTER a successful GPU
      // init, which jsdom can't do — so we assert the cleanup contract: any
      // registered resize handler is removed, and exit always lands home. We
      // record the handler the shell registered (if any) and confirm it's gone.
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      await app.mount();
      (root.querySelector('#tycoon-play') as HTMLElement).click();
      await tick(120);

      const resizeAdds = addSpy.mock.calls.filter((c) => c[0] === 'resize');
      const registered = resizeAdds.length ? resizeAdds[resizeAdds.length - 1][1] : null;

      // In jsdom the Pixi GPU init is unavailable, so the shell shows its
      // graceful error fallback (with #err-home) instead of the live HUD. Click
      // whichever "home" affordance is present — both call exitGame().
      const home =
        (root.querySelector('#hud-back') as HTMLElement | null) ??
        (root.querySelector('#err-home') as HTMLElement | null);
      expect(home).toBeTruthy();
      home!.click();
      await tick();

      // Always returns to home, cleanly.
      expect(root.querySelector('.tycoon-hero h1')?.textContent).toBe('Dice Tycoon');
      // If a resize handler was registered, it must have been removed.
      if (registered) {
        const removedResize = removeSpy.mock.calls.some(
          (c) => c[0] === 'resize' && c[1] === registered,
        );
        expect(removedResize).toBe(true);
      }
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });
});
