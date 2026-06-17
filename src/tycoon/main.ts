import '../styles/theme.css';
import '../styles/app.css';
import './tycoon.css';
import { TycoonApp } from './app';
import { initSound } from '../utils/audio';

/**
 * Dice Tycoon bootstrap — mirrors src/main.ts's fast-FCP pattern.
 *
 * 1. tycoon.html has an inline loading shell that renders IMMEDIATELY
 *    (no JS required). FCP happens before this script even runs.
 *
 * 2. We DON'T await the game chunk before mounting the shell. Instead:
 *    - Mount the app shell first (shows the home/landing screen)
 *    - The Dice Tycoon game chunk loads in the background via dynamic import
 *    - It self-registers; by the time the user taps "Play" it's ready
 *
 * 3. Unlike src/main.ts (which calls loadAllGames over 23 games), this app
 *    imports ONLY the dice-tycoon chunk — keeping the bundle lean.
 *
 * 4. initSound() is deferred — AudioContext is lazy (needs a user gesture).
 */
async function bootstrap(): Promise<void> {
  const appEl = document.getElementById('app')!;

  // ── SPIKE FLAG: ?pixidemo=1 ────────────────────────────────────────────────
  // De-risking spike for a Pixi.js v8 WebGL renderer (Tycoon app only). When the
  // flag is set, mount the self-contained procedural Pixi slickness demo INSTEAD
  // of the normal home. Loaded via dynamic import() so Pixi only downloads on
  // demand and never enters the normal app path (offline-first; the jsdom test
  // suite never instantiates WebGL). Behaves exactly as today when absent.
  if (new URLSearchParams(location.search).get('pixidemo') === '1') {
    appEl.innerHTML = '<div id="pixi-demo-root" style="position:fixed;inset:0;"></div>';
    const mountEl = document.getElementById('pixi-demo-root')!;
    const { mountPixiDemo } = await import('./pixi/demo');
    await mountPixiDemo(mountEl);
    return;
  }

  // Mount the app shell immediately so the landing screen renders ASAP.
  // The loading shell in tycoon.html is replaced by this call.
  const app = new TycoonApp(appEl);

  // Load ONLY the Dice Tycoon game chunk in the background — it self-registers
  // via registerGame() at module level. Do not block the mount on it.
  const gameReady = import('../games/dice-tycoon/DiceTycoon').catch((e) => {
    console.error('Failed to load Dice Tycoon:', e);
  });

  // Init sound is non-blocking — AudioContext is lazy anyway.
  void initSound();

  await app.mount();
  await gameReady;
}

bootstrap();
