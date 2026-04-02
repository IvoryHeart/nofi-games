import './styles/theme.css';
import './styles/app.css';
import { loadAllGames } from './games/registry';
import { App } from './app';
import { initSound } from './utils/audio';

async function bootstrap(): Promise<void> {
  const appEl = document.getElementById('app')!;

  // Show loading state
  appEl.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;">
      <div style="font-size:36px;font-weight:900;color:#8B5E83;letter-spacing:-1px;">NoFi</div>
      <div class="loading-spinner"></div>
    </div>
  `;

  try {
    await Promise.all([
      loadAllGames(),
      initSound(),
    ]);
  } catch (e) {
    console.error('Failed to load games:', e);
  }

  const app = new App(appEl);
  await app.mount();
}

bootstrap();
