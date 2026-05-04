export function getBootstrapTs(gameEntryPath = './game/index'): string {
  // IMPORTANT: CSS must be imported as a separate file, NOT placed in the
  // HTML <head>. The Sandpack Parcel bundler only injects the <body> from
  // the HTML entry; <head> content (including <style> tags) is silently
  // discarded. CSS imports in JS are transpiled into runtime <style>
  // injection by the bundler's CSS loader.
  return `
import './styles.css';
import * as GameModule from '${gameEntryPath}';

const GameClass = (GameModule as any).default
  || Object.values(GameModule).find(
    (v) => typeof v === 'function' && v.prototype,
  );

if (!GameClass) {
  throw new Error('No game class found in ${gameEntryPath}');
}

const container = document.getElementById('game-container')!;
const canvas = container.querySelector('canvas')!;

let game: any;

function createGame(width: number, height: number) {
  if (game) {
    game.stop?.();
    game.destroy?.();
  }
  game = new GameClass({ canvas, width, height, difficulty: 1 });
  game.start();
  (window as any).__game = game;
}

// Wait a frame so the CSS injected by the bundler's CSS loader is applied
// and the fixed-position container has its final viewport dimensions.
requestAnimationFrame(() => {
  const ro = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const { width, height } = entry.contentRect;
    if (width > 0 && height > 0) {
      createGame(Math.floor(width), Math.floor(height));
    }
  });
  ro.observe(container);
});
`;
}

/**
 * CSS for the game preview, served as a separate file at /src/styles.css.
 * Imported by the bootstrap JS so the Sandpack Parcel bundler's CSS loader
 * injects it at runtime. Placing this in the HTML <head> does NOT work --
 * see the comment in getBootstrapTs.
 */
export function getGameCss(): string {
  return `* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; }
#game-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FEF0E4;
}
canvas {
  display: block;
}`;
}

export function getIndexHtml(): string {
  // No <style> in <head> -- the Sandpack Parcel bundler discards <head>
  // content. All CSS is loaded via JS import (see getGameCss / getBootstrapTs).
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
</head>
<body>
  <div id="game-container">
    <canvas></canvas>
  </div>
</body>
</html>`;
}
