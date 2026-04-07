import './styles/theme.css';
import './styles/app.css';
import { loadAllGames } from './games/registry';
import { App } from './app';
import { initSound } from './utils/audio';

async function bootstrap(): Promise<void> {
  const appEl = document.getElementById('app')!;

  // Show loading state
  appEl.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;">
      <svg width="72" height="72" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bootLogoBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8B5E83"/>
            <stop offset="100%" stop-color="#E89040"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#bootLogoBg)"/>
        <g fill="#FEF0E4">
          <rect x="22" y="14" width="4" height="36"/>
          <rect x="26" y="18" width="4" height="28"/>
          <rect x="30" y="22" width="4" height="20"/>
          <rect x="34" y="26" width="4" height="12"/>
          <rect x="38" y="30" width="4" height="4"/>
        </g>
      </svg>
      <div style="font-size:28px;font-weight:800;color:#8B5E83;letter-spacing:-0.5px;">nofi.games</div>
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
