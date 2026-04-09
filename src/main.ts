import './styles/theme.css';
import './styles/app.css';
import { loadAllGames } from './games/registry';
import { App } from './app';
import { initSound } from './utils/audio';

/**
 * Bootstrap — optimized for fast First Contentful Paint:
 *
 * 1. index.html has an inline loading shell that renders IMMEDIATELY
 *    (no JS required). FCP happens before this script even runs.
 *
 * 2. We DON'T await loadAllGames() before mounting the app. Instead:
 *    - Mount the app shell first (shows the home screen skeleton)
 *    - loadAllGames() runs in the background
 *    - Once it resolves, the home screen re-renders with populated game cards
 *
 * 3. initSound() is deferred — audio context can't be created until a user
 *    gesture anyway (browser policy), so there's no point blocking on it.
 *
 * This cuts Time to Interactive from "download all 16 game chunks + parse"
 * to "download + parse just the app shell (~60KB)".
 */
async function bootstrap(): Promise<void> {
  const appEl = document.getElementById('app')!;

  // Mount the app shell immediately so the home screen renders ASAP.
  // The loading shell in index.html is replaced by this call.
  const app = new App(appEl);

  // Start loading games and audio in parallel, but don't block the mount.
  const gamesReady = loadAllGames().catch((e) => {
    console.error('Failed to load games:', e);
  });

  // Init sound is non-blocking — AudioContext is lazy anyway.
  void initSound();

  // Mount the app now — it will show the home screen with whatever games
  // are already registered (possibly empty on the very first frame).
  await app.mount();

  // Once all games are loaded, tell the app to refresh the home screen
  // so the game cards appear if they weren't there on the first mount.
  await gamesReady;
  if ((app as unknown as { currentScreen: string }).currentScreen === 'home') {
    await (app as unknown as { showHome: () => Promise<void> }).showHome();
  }
}

bootstrap();
