export function getBootstrapTs(gameEntryPath = './game/index'): string {
  return `
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

const ro = new ResizeObserver((entries) => {
  const entry = entries[0];
  if (!entry) return;
  const { width, height } = entry.contentRect;
  if (width > 0 && height > 0) {
    createGame(Math.floor(width), Math.floor(height));
  }
});
ro.observe(container);
`;
}

export function getIndexHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #game-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #FEF0E4;
    }
    canvas {
      display: block;
      max-width: 100%;
      max-height: 100%;
    }
  </style>
</head>
<body>
  <div id="game-container">
    <canvas></canvas>
  </div>
</body>
</html>`;
}
