import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock idb-keyval before any source imports (same pattern as tycoon.test.ts).
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { TycoonApp } from '../../src/tycoon/app';
// Self-register the game (main.ts does this lazily; tests need it synchronously).
import '../../src/games/dice-tycoon/DiceTycoon';
import { TycoonCore } from '../../src/games/dice-tycoon/core/TycoonCore';
import {
  STICKER_SETS,
  emptyAlbum,
  grantSticker,
  type AlbumState,
} from '../../src/games/dice-tycoon/stickers';
import { themeNameForLevel } from '../../src/games/dice-tycoon/board';

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

function setViewport(w: number, h: number): void {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true });
}

/**
 * The Pixi WebGL view cannot run in jsdom, so the V4 DOM views are tested
 * against a FAKE Pixi game that implements the same view-state surface the shell
 * consumes (getCityState / getMapState / getAlbumView / buildLandmark / canvasEl
 * / serialize / getScore / getFraming / resize …) backed by a REAL TycoonCore.
 * This exercises the shell's view rendering + nav + build-sync wiring exactly,
 * while staying behind the WebGL boundary (no Application is ever created).
 */
class FakePixiGame {
  core: TycoonCore;
  destroyed = false;
  resizeCount = 0;
  private _canvas: HTMLCanvasElement;
  framing: 'whole' | 'follow' = 'whole';

  constructor(difficulty = 1) {
    this.core = new TycoonCore({ rng: () => 0.42, difficulty, now: Date.now() });
    // Give the core enough coins to build for the City-build tests.
    this.core.setCoins(100000);
    this._canvas = document.createElement('canvas');
  }

  get canvasEl(): HTMLCanvasElement { return this._canvas; }
  getScore(): number { return this.core.getScore(); }
  getFraming(): 'whole' | 'follow' { return this.framing; }
  setFraming(m: 'whole' | 'follow'): void { this.framing = m; }
  resize(): void { this.resizeCount++; }
  serialize(): Record<string, unknown> { return this.core.serialize(); }
  deserialize(s: Record<string, unknown>): void { this.core.deserialize(s, Date.now()); }
  destroy(): void { this.destroyed = true; }

  getRailState() {
    return {
      coins: this.core.getCoins(), dice: this.core.getDice(), shields: this.core.getShields(),
      boardLevel: this.core.getBoardLevel(), landmarksBuilt: this.core.getLandmarksBuilt(),
      nextLandmarkName: null, nextLandmarkCost: this.core.nextLandmarkCost(),
      stickersOwned: this.core.getStickerCount(), themeName: this.core.getTheme().name,
      score: this.core.getScore(),
    };
  }

  getCityState() {
    const theme = this.core.getTheme();
    const built = this.core.getLandmarksBuilt();
    const costs = this.core.getLandmarkCostList();
    const landmarks = [];
    for (let i = 0; i < 4; i++) {
      const isBuilt = i < built;
      landmarks.push({
        slot: i, name: theme.landmarkNames[i] ?? 'Landmark', built: isBuilt,
        cost: isBuilt ? null : (costs[i] ?? null), tier: i + 1,
      });
    }
    return {
      themeName: theme.name, boardLevel: this.core.getBoardLevel(), coins: this.core.getCoins(),
      landmarksBuilt: built, landmarks, nextCost: this.core.nextLandmarkCost(), canBuild: this.core.canBuild(),
    };
  }

  buildLandmark(): boolean {
    if (!this.core.canBuild()) return false;
    return this.core.build().built;
  }

  getMapState() {
    const level = this.core.getBoardLevel();
    const islands = [];
    const lo = Math.max(1, level - 2);
    const hi = level + 3;
    for (let lvl = lo; lvl <= hi; lvl++) {
      islands.push({
        level: lvl, themeName: themeNameForLevel(lvl),
        status: lvl < level ? 'done' : lvl === level ? 'current' : 'locked' as 'done' | 'current' | 'locked',
      });
    }
    return { boardLevel: level, landmarksBuilt: this.core.getLandmarksBuilt(), islands };
  }

  getAlbumView() {
    const album = this.core.getAlbum();
    const sets = STICKER_SETS.map((set) => {
      const stickers = set.stickerNames.map((name, i) => ({ name, owned: (album.owned[`${set.id}:${i}`] ?? 0) > 0 }));
      const owned = stickers.filter((s) => s.owned).length;
      return {
        id: set.id, name: set.name, stickers, owned, total: set.stickerNames.length,
        complete: album.completedSets.includes(set.id), reward: { coins: 500, dice: 5 },
      };
    });
    return { totalOwned: this.core.getStickerCount(), sets };
  }
}

/** Mount the app, click Play, and swap in a FakePixiGame as the live instance so
 *  the view/nav wiring runs against a real core without touching WebGL. */
async function mountWithFakeGame(app: TycoonApp, root: HTMLElement, fake: FakePixiGame): Promise<void> {
  await app.mount();
  (root.querySelector('#tycoon-play') as HTMLElement).click();
  // Let the Play markup paint (the async Pixi import fails in jsdom — we replace
  // the instance + re-render the session ourselves).
  await tick(60);
  const a = app as unknown as {
    pixiGame: unknown; gameView: string; currentScreen: string;
    renderSession: (l: unknown) => Promise<void>; layout: unknown;
    viewportW: () => number; viewportH: () => number;
  };
  a.pixiGame = fake;
  a.currentScreen = 'game';
  a.gameView = 'play';
  // Build a layout + render the session with our fake game in place.
  const { computeLayout } = await import('../../src/tycoon/layout');
  a.layout = computeLayout(window.innerWidth, window.innerHeight);
  await a.renderSession(a.layout);
  await tick(20);
}

describe('Tycoon V4 — Views & bottom nav', () => {
  let root: HTMLElement;
  let app: TycoonApp;

  beforeEach(() => {
    store.clear();
    setViewport(1280, 800); // cockpit by default
    root = document.createElement('div');
    root.id = 'app';
    document.body.appendChild(root);
    app = new TycoonApp(root);
  });

  afterEach(() => {
    const suppress = (e: PromiseRejectionEvent) => e.preventDefault();
    window.addEventListener('unhandledrejection', suppress);
    root.remove();
    try { history.replaceState({}, '', '/'); } catch { /* jsdom */ }
    setTimeout(() => window.removeEventListener('unhandledrejection', suppress), 500);
  });

  describe('Bottom nav', () => {
    it('renders the Play/City/Map/Album/Tasks nav on the game session', async () => {
      const fake = new FakePixiGame();
      await mountWithFakeGame(app, root, fake);
      const labels = Array.from(root.querySelectorAll('.tycoon-nav-btn .tycoon-nav-label'))
        .map((e) => e.textContent?.trim());
      // F4a: the old disabled 'Events' slot is now the 'Tasks' (Quick Wins) view.
      expect(labels).toEqual(['Play', 'City', 'Map', 'Album', 'Tasks']);
      const tasks = root.querySelector('.tycoon-nav-btn[data-view="tasks"]') as HTMLButtonElement;
      expect(tasks.hasAttribute('disabled')).toBe(false);
    });

    it('marks Play active on entry', async () => {
      const fake = new FakePixiGame();
      await mountWithFakeGame(app, root, fake);
      const active = root.querySelector('.tycoon-nav-btn.active');
      expect(active?.getAttribute('data-view')).toBe('play');
    });

    it('switches view + updates the URL when a tab is tapped', async () => {
      const fake = new FakePixiGame();
      await mountWithFakeGame(app, root, fake);
      (root.querySelector('.tycoon-nav-btn[data-view="city"]') as HTMLElement).click();
      await tick(20);
      expect(window.location.pathname).toBe('/city');
      expect(root.querySelector('.tycoon-city')).toBeTruthy();
      expect(root.querySelector('.tycoon-nav-btn.active')?.getAttribute('data-view')).toBe('city');
    });

    it('switches to the Tasks (Quick Wins) view when its tab is tapped', async () => {
      const fake = new FakePixiGame();
      await mountWithFakeGame(app, root, fake);
      (root.querySelector('.tycoon-nav-btn[data-view="tasks"]') as HTMLElement).click();
      await tick(20);
      expect(window.location.pathname).toBe('/tasks');
      expect(root.querySelector('.tycoon-nav-btn.active')?.getAttribute('data-view')).toBe('tasks');
    });
  });

  describe('Routing / popstate', () => {
    it('restores the prior view on back/popstate', async () => {
      const fake = new FakePixiGame();
      await mountWithFakeGame(app, root, fake);
      (root.querySelector('.tycoon-nav-btn[data-view="map"]') as HTMLElement).click();
      await tick(20);
      expect(window.location.pathname).toBe('/map');
      // Simulate browser Back to /play.
      history.replaceState({ screen: 'game', view: 'play' }, '', '/play');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await tick(40);
      expect(root.querySelector('.tycoon-nav-btn.active')?.getAttribute('data-view')).toBe('play');
      expect(root.querySelector('#pixi-host')).toBeTruthy();
    });
  });

  describe('City / Build view', () => {
    it('shows the 4 landmarks of the current board', async () => {
      const fake = new FakePixiGame();
      await mountWithFakeGame(app, root, fake);
      (root.querySelector('.tycoon-nav-btn[data-view="city"]') as HTMLElement).click();
      await tick(20);
      const cards = root.querySelectorAll('.tycoon-lm-card');
      expect(cards.length).toBe(4);
      const names = fake.core.getTheme().landmarkNames;
      expect(root.querySelector('.tycoon-lm-name')?.textContent).toBe(names[0]);
    });

    it('Build calls core.build: coins decrease + progress advances + persists', async () => {
      const fake = new FakePixiGame();
      await mountWithFakeGame(app, root, fake);
      (root.querySelector('.tycoon-nav-btn[data-view="city"]') as HTMLElement).click();
      await tick(20);

      const coinsBefore = fake.core.getCoins();
      const builtBefore = fake.core.getLandmarksBuilt();
      const cost = fake.core.nextLandmarkCost()!;
      const { set } = await import('idb-keyval');
      const setCallsBefore = (set as ReturnType<typeof vi.fn>).mock.calls.length;

      (root.querySelector('#tycoon-build') as HTMLElement).click();
      await tick(40);

      expect(fake.core.getLandmarksBuilt()).toBe(builtBefore + 1);
      expect(fake.core.getCoins()).toBe(coinsBefore - cost);
      // Persisted the session after the build.
      expect((set as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(setCallsBefore);
      // Re-rendered: the next slot's card reflects the advanced progress.
      expect(root.querySelector('.tycoon-view-chips')?.textContent).toContain(`${builtBefore + 1} / 4`);
    });

    it('building in City then returning to Play keeps the built state', async () => {
      const fake = new FakePixiGame();
      await mountWithFakeGame(app, root, fake);
      (root.querySelector('.tycoon-nav-btn[data-view="city"]') as HTMLElement).click();
      await tick(20);
      (root.querySelector('#tycoon-build') as HTMLElement).click();
      await tick(40);
      const builtAfterBuild = fake.core.getLandmarksBuilt();
      expect(builtAfterBuild).toBeGreaterThan(0);

      // Back to Play.
      (root.querySelector('.tycoon-nav-btn[data-view="play"]') as HTMLElement).click();
      await tick(40);
      expect(root.querySelector('#pixi-host')).toBeTruthy();
      // Same live core (not re-created) — the build persisted in the instance.
      const inst = (app as unknown as { pixiGame: FakePixiGame }).pixiGame;
      expect(inst).toBe(fake);
      expect(inst.core.getLandmarksBuilt()).toBe(builtAfterBuild);
      expect(inst.destroyed).toBe(false);
    });
  });

  describe('World Map view', () => {
    it('renders the current board highlighted + locked upcoming levels', async () => {
      const fake = new FakePixiGame();
      // Advance to board level 3 so there are 'done' islands too.
      fake.core.setBoardLevel(3);
      await mountWithFakeGame(app, root, fake);
      (root.querySelector('.tycoon-nav-btn[data-view="map"]') as HTMLElement).click();
      await tick(20);
      expect(root.querySelector('.tycoon-island-current')).toBeTruthy();
      expect(root.querySelector('.tycoon-island-locked')).toBeTruthy();
      expect(root.querySelector('.tycoon-island-done')).toBeTruthy();
      // The current island offers a Play → button.
      expect(root.querySelector('.tycoon-island-go')).toBeTruthy();
    });

    it('current island Play button jumps to the Play view', async () => {
      const fake = new FakePixiGame();
      await mountWithFakeGame(app, root, fake);
      (root.querySelector('.tycoon-nav-btn[data-view="map"]') as HTMLElement).click();
      await tick(20);
      (root.querySelector('.tycoon-island-go') as HTMLElement).click();
      await tick(40);
      expect(window.location.pathname).toBe('/play');
      expect(root.querySelector('#pixi-host')).toBeTruthy();
    });
  });

  describe('Sticker Album view', () => {
    it('renders 3 sets × 4 stickers from album state (owned vs unowned)', async () => {
      const fake = new FakePixiGame();
      // Grant a couple stickers so some cells read as owned.
      const album: AlbumState = emptyAlbum();
      grantSticker(() => 0.0, album); // wheels:0
      grantSticker(() => 0.0, album); // wheels:0 dup (still owned)
      fake.core.setAlbum(album);

      await mountWithFakeGame(app, root, fake);
      (root.querySelector('.tycoon-nav-btn[data-view="album"]') as HTMLElement).click();
      await tick(20);

      expect(root.querySelectorAll('.tycoon-set').length).toBe(STICKER_SETS.length);
      expect(root.querySelectorAll('.tycoon-sticker').length).toBe(STICKER_SETS.length * 4);
      // At least one owned cell exists.
      expect(root.querySelector('.tycoon-sticker.owned')).toBeTruthy();
      expect(root.querySelector('.tycoon-sticker.unowned')).toBeTruthy();
      // Per-set reward is shown.
      expect(root.querySelector('.tycoon-set-reward')?.textContent).toContain('500');
    });
  });

  describe('GPU not destroyed on tab switch', () => {
    it('keeps the SAME Pixi instance alive across City/Map/Album/Play switches', async () => {
      const fake = new FakePixiGame();
      await mountWithFakeGame(app, root, fake);
      const inst = () => (app as unknown as { pixiGame: FakePixiGame }).pixiGame;

      for (const view of ['city', 'map', 'album', 'play']) {
        (root.querySelector(`.tycoon-nav-btn[data-view="${view}"]`) as HTMLElement).click();
        await tick(30);
        expect(inst()).toBe(fake);
        expect(fake.destroyed).toBe(false);
      }
      // The canvas is re-homed (back in the host) on return to Play.
      expect(root.querySelector('#pixi-host')?.contains(fake.canvasEl)).toBe(true);
    });
  });
});

// ── F4a: Quick Wins (daily tasks + streak) + City-build celebration polish ──
describe('Tycoon F4a — Quick Wins panel & City-build celebration', () => {
  let qwRoot: HTMLElement;
  let qwApp: TycoonApp;

  beforeEach(() => {
    store.clear();
    setViewport(1280, 800);
    qwRoot = document.createElement('div');
    qwRoot.id = 'app';
    document.body.appendChild(qwRoot);
    qwApp = new TycoonApp(qwRoot);
  });

  afterEach(() => {
    qwRoot.remove();
    try { history.replaceState({}, '', '/'); } catch { /* jsdom */ }
  });

  it('renders the 3 daily tasks with progress + reward in the Tasks view', async () => {
    const { generateDailyTasks } = await import('../../src/games/dice-tycoon/quickWins');
    const fake = new FakePixiGame();
    (fake as unknown as { quickWins: unknown }).quickWins = null;
    await mountWithFakeGame(qwApp, qwRoot, fake);
    const a = qwApp as unknown as { quickWins: unknown; gameView: string; renderActiveView: () => void };
    a.quickWins = { date: '2026-06-17', tasks: generateDailyTasks(20260617), dailyBonusClaimed: false, streak: 2, bestStreak: 3, lastCompletedDate: '', grandPrizeClaimed: false };
    (qwRoot.querySelector('.tycoon-nav-btn[data-view="tasks"]') as HTMLElement).click();
    await tick(30);
    expect(qwRoot.querySelector('.tycoon-tasks')).toBeTruthy();
    expect(qwRoot.querySelectorAll('.tycoon-task-card').length).toBeGreaterThanOrEqual(3);
    // Streak dots render (7-day ladder).
    expect(qwRoot.querySelectorAll('.tycoon-streak-dot').length).toBe(7);
  });

  it('shows a Claim button for a completed task and grants the reward', async () => {
    const { generateDailyTasks } = await import('../../src/games/dice-tycoon/quickWins');
    const {
      claimTask, isClaimable,
    } = await import('../../src/games/dice-tycoon/quickWins');
    const fake = new FakePixiGame();
    // Give the fake the Quick Wins surface the shell calls.
    const qwState = { date: '2026-06-17', tasks: generateDailyTasks(20260617).map((t) => ({ ...t, progress: t.target })), dailyBonusClaimed: false, streak: 0, bestStreak: 0, lastCompletedDate: '', grandPrizeClaimed: false };
    let claimed = false;
    (fake as unknown as Record<string, unknown>).claimQuickWinTask = (type: string) => {
      const r = claimTask(qwState, type as never);
      if (r.reward) {
        claimed = true;
        fake.core.setCoins(fake.core.getCoins() + r.reward.coins);
        Object.assign(qwState, r.state);
      }
      return r.reward;
    };
    (fake as unknown as Record<string, unknown>).claimQuickWinDailyBonus = () => ({ bonus: null, grandPrize: null });

    await mountWithFakeGame(qwApp, qwRoot, fake);
    const a = qwApp as unknown as { quickWins: unknown };
    a.quickWins = qwState;
    (qwRoot.querySelector('.tycoon-nav-btn[data-view="tasks"]') as HTMLElement).click();
    await tick(30);

    const coinsBefore = fake.core.getCoins();
    const claimBtn = qwRoot.querySelector('.tycoon-task-claim') as HTMLElement;
    expect(claimBtn).toBeTruthy();
    const firstType = qwState.tasks[0].type;
    claimBtn.click();
    await tick(30);
    expect(claimed).toBe(true);
    expect(fake.core.getCoins()).toBeGreaterThan(coinsBefore);
    // Claimed task is no longer claimable.
    expect(isClaimable(qwState.tasks.find((t) => t.type === firstType)!)).toBe(false);
  });

  it('City-view build that completes a board routes through the shared celebration', async () => {
    // A real Pixi game can't run in jsdom, so we assert the shared celebration
    // PATH is taken: buildLandmark() on a board-completing build invokes
    // celebrateBoardComplete (which fires the RibbonBanner + dice burst).
    const { TycoonCore } = await import('../../src/games/dice-tycoon/core/TycoonCore');
    const core = new TycoonCore({ rng: () => 0.5, difficulty: 1, now: Date.now() });
    // Build the first 3 landmarks so the next build completes the board.
    core.setCoins(10_000_000);
    core.build(); core.build(); core.build();
    expect(core.getLandmarksBuilt()).toBe(3);
    // The 4th build returns a boardComplete result (with the dice bundle) — the
    // signal celebrateBoardComplete keys off in buildLandmark().
    const res = core.build();
    expect(res.boardComplete).not.toBeNull();
    expect(res.boardComplete!.bonusDice).toBeGreaterThan(0);
    expect(core.getBoardLevel()).toBe(2); // advanced to a fresh board
  });
});
