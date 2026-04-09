/**
 * Auto-play game runner.
 *
 * Creates a game instance with a mock canvas, feeds synthetic inputs,
 * ticks the update loop, and collects outcome metrics. Runs in Node.js
 * via `npx vitest run scripts/autoplay/` (reuses the jsdom canvas mock).
 *
 * Strategies per game type:
 *   - Random: uniform random inputs (baseline — "what if a monkey plays?")
 *   - Directional: cycle through arrow keys (2048, Snake)
 *   - Tap-grid: random grid cell taps (Minesweeper, Nonogram, Sudoku)
 *   - Type-letters: random letter keypresses (Wordle, Anagram)
 */

import { GameEngine, GameConfig } from '../../src/engine/GameEngine';
import type { GameInfo } from '../../src/games/registry';

export interface PlayResult {
  gameId: string;
  difficulty: number;
  seed: number;
  score: number;
  won: boolean;
  durationMs: number;
  totalInputs: number;
  ticksPlayed: number;
  confusionMoments: number;
}

export interface AutoplayConfig {
  game: GameInfo;
  difficulty: number;
  seed: number;
  maxTicks: number;         // safety cap — abort after this many update() calls
  inputsPerSecond: number;  // how frequently the agent acts
  strategy: 'random' | 'directional' | 'tap-grid' | 'type-letters';
  canvasWidth?: number;
  canvasHeight?: number;
}

const DT = 1 / 60; // simulate 60fps

/**
 * Play one complete game session and return the outcome metrics.
 */
export function playGame(config: AutoplayConfig): PlayResult {
  const {
    game, difficulty, seed, maxTicks,
    inputsPerSecond, strategy,
    canvasWidth = game.canvasWidth || 360,
    canvasHeight = game.canvasHeight || 640,
  } = config;

  let score = 0;
  let won = false;
  let gameOver = false;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const gameConfig: GameConfig = {
    canvas,
    width: canvasWidth,
    height: canvasHeight,
    difficulty,
    seed,
    onScore: (s) => { score = s; },
    onGameOver: () => { gameOver = true; },
    onWin: () => { won = true; },
  };

  const instance = game.createGame(gameConfig);
  instance.start();

  const inputInterval = Math.max(1, Math.round(60 / inputsPerSecond));
  let totalInputs = 0;
  let ticks = 0;

  // Simple seeded random for the agent's own decisions (separate from game RNG)
  let agentSeed = seed * 31337;
  const agentRng = (): number => {
    agentSeed = (agentSeed * 1103515245 + 12345) >>> 0;
    return (agentSeed >>> 16) / 65536;
  };

  const fakeKeyEvent = (key: string): KeyboardEvent => {
    return { key, preventDefault: () => {} } as unknown as KeyboardEvent;
  };

  // Play until game over, win + game over, or tick cap
  while (!gameOver && ticks < maxTicks) {
    // Inject an input every inputInterval ticks
    if (ticks % inputInterval === 0) {
      injectInput(instance, strategy, canvasWidth, canvasHeight, agentRng, fakeKeyEvent);
      totalInputs++;
    }

    instance.update(DT);
    ticks++;
  }

  const eventLog = instance.getEventLog();

  // Count confusion moments (>5s pause equivalent in ticks)
  let confusionMoments = 0;
  const events = eventLog.events;
  for (let i = 1; i < events.length; i++) {
    if (events[i].t - events[i - 1].t > 5000) confusionMoments++;
  }

  instance.destroy();

  return {
    gameId: game.id,
    difficulty,
    seed,
    score,
    won,
    durationMs: ticks * (DT * 1000),
    totalInputs,
    ticksPlayed: ticks,
    confusionMoments,
  };
}

function injectInput(
  game: GameEngine,
  strategy: string,
  w: number,
  h: number,
  rng: () => number,
  fakeKey: (key: string) => KeyboardEvent,
): void {
  const g = game as unknown as {
    handleKeyDown(key: string, e: KeyboardEvent): void;
    handleKeyUp(key: string, e: KeyboardEvent): void;
    handlePointerDown(x: number, y: number): void;
    handlePointerUp(x: number, y: number): void;
  };

  switch (strategy) {
    case 'directional': {
      const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      const key = dirs[Math.floor(rng() * dirs.length)];
      g.handleKeyDown(key, fakeKey(key));
      g.handleKeyUp(key, fakeKey(key));
      break;
    }
    case 'tap-grid': {
      const x = rng() * w;
      const y = rng() * h;
      g.handlePointerDown(x, y);
      g.handlePointerUp(x, y);
      break;
    }
    case 'type-letters': {
      const r = rng();
      if (r < 0.7) {
        // Type a random letter
        const letter = String.fromCharCode(65 + Math.floor(rng() * 26));
        g.handleKeyDown(letter, fakeKey(letter));
      } else if (r < 0.85) {
        // Submit
        g.handleKeyDown('Enter', fakeKey('Enter'));
      } else {
        // Backspace
        g.handleKeyDown('Backspace', fakeKey('Backspace'));
      }
      break;
    }
    case 'random':
    default: {
      const r = rng();
      if (r < 0.4) {
        // Random key
        const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'z', 'x'];
        const key = keys[Math.floor(rng() * keys.length)];
        g.handleKeyDown(key, fakeKey(key));
        g.handleKeyUp(key, fakeKey(key));
      } else {
        // Random tap
        g.handlePointerDown(rng() * w, rng() * h);
        g.handlePointerUp(rng() * w, rng() * h);
      }
      break;
    }
  }
}

/**
 * Pick the best strategy for a given game.
 */
export function bestStrategy(gameId: string): AutoplayConfig['strategy'] {
  switch (gameId) {
    case '2048':
    case 'snake':
    case 'block-drop':
      return 'directional';
    case 'minesweeper':
    case 'nonogram':
    case 'lights-out':
    case 'sudoku':
    case 'memory-match':
    case 'gem-swap':
      return 'tap-grid';
    case 'wordle':
    case 'word-search':
    case 'anagram':
      return 'type-letters';
    case 'breakout':
    case 'stack-block':
    case 'bubble-pop':
    case 'mastermind':
    default:
      return 'random';
  }
}
