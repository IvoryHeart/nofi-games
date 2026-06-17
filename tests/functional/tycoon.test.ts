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
import { computeLayout, layoutMode } from '../../src/tycoon/layout';
// Import the Dice Tycoon game so it self-registers via registerGame() at module
// level — main.ts does this lazily, but tests need it present synchronously.
import '../../src/games/dice-tycoon/DiceTycoon';
import { getGame } from '../../src/games/registry';

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

/** Force a deterministic jsdom viewport so the responsive layout mode is known. */
function setViewport(w: number, h: number): void {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true });
}

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
    it('renders the game screen chrome (score readout + Pixi host) on Play', async () => {
      setViewport(1280, 800); // cockpit
      await app.mount();
      (root.querySelector('#tycoon-play') as HTMLElement).click();
      // Assert the SYNCHRONOUS structure that paints right after the rAF settle,
      // before the async Pixi import/GPU-init resolves (which, in jsdom, falls
      // back to the error UI — exercised separately).
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));

      // Net-worth score readout + back button present in every layout mode
      // (these live in the cockpit top bar, OUTSIDE the stage container — so
      // they survive the jsdom WebGL error fallback that rewrites the stage).
      expect(root.querySelector('#hud-score')).toBeTruthy();
      expect(root.querySelector('#hud-back')).toBeTruthy();
      // Cockpit framing present (top bar) — NOT the old 480 device card.
      expect(root.querySelector('#tycoon-topbar')).toBeTruthy();
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

  // V1: the OLD MAX_W=480 device-card clamp is GONE. The board now gets the
  // center-stage rect, which GROWS with the viewport (no 480 cap). These tests
  // assert the responsive layout/markup intent that replaced computeSize().
  describe('Responsive layout (V1 real-estate)', () => {
    afterEach(() => setViewport(1024, 768)); // restore a sane jsdom default

    it('renders an EDGE-TO-EDGE board with no rails on a phone viewport', async () => {
      setViewport(390, 780);
      await app.mount();
      (root.querySelector('#tycoon-play') as HTMLElement).click();
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      expect(root.querySelector('.tycoon-phone')).toBeTruthy();
      // The back button lives OUTSIDE the stage container, so it survives even
      // the jsdom WebGL error fallback that replaces the container's contents.
      expect(root.querySelector('#hud-back')).toBeTruthy();
      // No rails / cockpit on phone.
      expect(root.querySelector('.tycoon-rail')).toBeNull();
      expect(root.querySelector('.tycoon-cockpit')).toBeNull();
    });

    it('renders ONE rail on a compact (700–1024) viewport', async () => {
      setViewport(900, 700);
      await app.mount();
      (root.querySelector('#tycoon-play') as HTMLElement).click();
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      expect(root.querySelector('.tycoon-cockpit')).toBeTruthy();
      expect(root.querySelector('#tycoon-topbar')).toBeTruthy();
      expect(root.querySelector('#tycoon-rail-left')).toBeTruthy();
      // Compact drops the right rail.
      expect(root.querySelector('#tycoon-rail-right')).toBeNull();
    });

    it('renders a TOP BAR + TWO rails on a desktop cockpit viewport', async () => {
      setViewport(1440, 900);
      await app.mount();
      (root.querySelector('#tycoon-play') as HTMLElement).click();
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      expect(root.querySelector('#tycoon-topbar')).toBeTruthy();
      expect(root.querySelector('#tycoon-rail-left')).toBeTruthy();
      expect(root.querySelector('#tycoon-rail-right')).toBeTruthy();
    });

    it('classifies layout modes at the 700 / 1024 breakpoints', () => {
      expect(layoutMode(699)).toBe('phone');
      expect(layoutMode(700)).toBe('compact');
      expect(layoutMode(1023)).toBe('compact');
      expect(layoutMode(1024)).toBe('cockpit');
    });

    it('grows the stage rect with width (no 480 cap) and full-width on phone', () => {
      // Phone: stage spans the FULL viewport width (edge-to-edge).
      expect(computeLayout(390, 780).stageRect.w).toBe(390);
      // Desktop: the stage is far wider than the old 480 card and grows with vw.
      const mid = computeLayout(1280, 800).stageRect.w;
      const wide = computeLayout(1920, 1080).stageRect.w;
      expect(mid).toBeGreaterThan(480);
      expect(wide).toBeGreaterThan(mid);
    });

    it('defaults framing to follow on phone, whole on desktop/compact', () => {
      expect(computeLayout(390, 780).framing).toBe('follow');
      expect(computeLayout(900, 700).framing).toBe('whole');
      expect(computeLayout(1440, 900).framing).toBe('whole');
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
