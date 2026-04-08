import { describe, it, expect, beforeAll, vi } from 'vitest';
import { GameEngine, GameConfig } from '../../src/engine/GameEngine';

// Mock idb-keyval before any source imports
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { loadAllGames, getGame } from '../../src/games/registry';

interface PlacedWord {
  word: string;
  row: number;
  col: number;
  dr: number;
  dc: number;
  found: boolean;
}

function makeConfig(width = 360, height = 640, difficulty = 0, seed?: number, onScore?: (s: number) => void): GameConfig {
  const canvas = document.createElement('canvas');
  return { canvas, width, height, difficulty, seed, onScore };
}

function createGame(difficulty = 0, seed?: number) {
  const info = getGame('word-search')!;
  return info.createGame(makeConfig(360, 640, difficulty, seed)) as unknown as {
    start: (resume?: { state: Record<string, unknown>; score: number; won?: boolean } | null) => void;
    update: (dt: number) => void;
    render: () => void;
    destroy: () => void;
    pause: () => void;
    resume: () => void;
    serialize: () => Record<string, unknown>;
    deserialize: (state: Record<string, unknown>) => void;
    canSave: () => boolean;
    isWon: () => boolean;
    isRunning: () => boolean;
    getScore: () => number;
    handlePointerDown: (x: number, y: number) => void;
    handlePointerMove: (x: number, y: number) => void;
    handlePointerUp: (x: number, y: number) => void;
    // Internals (accessed for verification only)
    size: number;
    grid: string[][];
    placedWords: PlacedWord[];
    gameActive: boolean;
    winning: boolean;
    gridX: number;
    gridY: number;
    cellSize: number;
    dragging: boolean;
  };
}

const EXPECTED_SIZES = [8, 10, 12, 14];
const EXPECTED_WORD_COUNTS = [5, 8, 12, 16];

beforeAll(async () => {
  store.clear();
  await loadAllGames();
});

describe('Word Search – Registration', () => {
  it('should be registered in the registry under id "word-search"', () => {
    const info = getGame('word-search');
    expect(info).toBeDefined();
    expect(info!.id).toBe('word-search');
    expect(info!.name).toBe('Word Search');
    expect(info!.category).toBe('puzzle');
    expect(info!.dailyMode).toBe(true);
    expect(info!.canvasWidth).toBe(360);
    expect(info!.canvasHeight).toBe(640);
    expect(info!.controls).toContain('Drag');
  });
});

describe('Word Search – Difficulty instantiation', () => {
  it('instantiates without throwing at all 4 difficulties', () => {
    for (let d = 0; d <= 3; d++) {
      const game = createGame(d);
      expect(game).toBeInstanceOf(GameEngine);
      game.start();
      game.destroy();
    }
  });

  it('builds grids with correct dimensions per difficulty', () => {
    for (let d = 0; d <= 3; d++) {
      const game = createGame(d);
      game.start();
      expect(game.size).toBe(EXPECTED_SIZES[d]);
      expect(game.grid.length).toBe(EXPECTED_SIZES[d]);
      for (const row of game.grid) {
        expect(row.length).toBe(EXPECTED_SIZES[d]);
      }
      expect(game.placedWords.length).toBe(EXPECTED_WORD_COUNTS[d]);
      game.destroy();
    }
  });
});

describe('Word Search – Lifecycle', () => {
  it('start/update/render/destroy without crashing', () => {
    const game = createGame(1);
    expect(() => {
      game.start();
      game.update(0.016);
      game.render();
      game.update(0.016);
      game.render();
      game.update(0.05);
      game.render();
      game.destroy();
    }).not.toThrow();
  });

  it('survives multiple update cycles at every difficulty', () => {
    for (let d = 0; d <= 3; d++) {
      const game = createGame(d);
      game.start();
      for (let i = 0; i < 10; i++) {
        game.update(0.016);
        game.render();
      }
      game.destroy();
    }
  });
});

describe('Word Search – Word placement', () => {
  it('places every hidden word into the grid as a contiguous letter run', () => {
    for (let d = 0; d <= 3; d++) {
      const game = createGame(d);
      game.start();
      for (const pw of game.placedWords) {
        // Walk the placement and verify the letters spell the word
        let actual = '';
        for (let i = 0; i < pw.word.length; i++) {
          const r = pw.row + pw.dr * i;
          const c = pw.col + pw.dc * i;
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThan(game.size);
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(game.size);
          actual += game.grid[r][c];
        }
        expect(actual).toBe(pw.word);
      }
      game.destroy();
    }
  });

  it('Easy difficulty uses only horizontal or vertical placements', () => {
    const game = createGame(0);
    game.start();
    for (const pw of game.placedWords) {
      const isHoriz = pw.dr === 0 && Math.abs(pw.dc) === 1;
      const isVert = Math.abs(pw.dr) === 1 && pw.dc === 0;
      expect(isHoriz || isVert).toBe(true);
      // Easy = no reversed
      expect(pw.dr).toBeGreaterThanOrEqual(0);
      expect(pw.dc).toBeGreaterThanOrEqual(0);
    }
    game.destroy();
  });

  it('fills every cell with an uppercase letter (no empty strings)', () => {
    const game = createGame(2);
    game.start();
    for (let r = 0; r < game.size; r++) {
      for (let c = 0; c < game.size; c++) {
        const ch = game.grid[r][c];
        expect(ch).toMatch(/^[A-Z]$/);
      }
    }
    game.destroy();
  });
});

describe('Word Search – Drag selection', () => {
  function cellCenter(game: ReturnType<typeof createGame>, row: number, col: number): { x: number; y: number } {
    return {
      x: game.gridX + col * game.cellSize + game.cellSize / 2,
      y: game.gridY + row * game.cellSize + game.cellSize / 2,
    };
  }

  it('drag start/move/up updates internal drag state', () => {
    const game = createGame(0);
    game.start();
    const pw = game.placedWords[0];
    const startPt = cellCenter(game, pw.row, pw.col);
    game.handlePointerDown(startPt.x, startPt.y);
    expect(game.dragging).toBe(true);
    const endPt = cellCenter(game, pw.row + pw.dr * (pw.word.length - 1), pw.col + pw.dc * (pw.word.length - 1));
    game.handlePointerMove(endPt.x, endPt.y);
    expect(game.dragging).toBe(true);
    game.handlePointerUp(endPt.x, endPt.y);
    expect(game.dragging).toBe(false);
    game.destroy();
  });

  it('finding a valid word marks it found and adds score', () => {
    const game = createGame(0);
    game.start();
    const pw = game.placedWords[0];
    expect(pw.found).toBe(false);
    const before = game.getScore();

    const startPt = cellCenter(game, pw.row, pw.col);
    const endPt = cellCenter(game, pw.row + pw.dr * (pw.word.length - 1), pw.col + pw.dc * (pw.word.length - 1));
    game.handlePointerDown(startPt.x, startPt.y);
    game.handlePointerMove(endPt.x, endPt.y);
    game.handlePointerUp(endPt.x, endPt.y);

    expect(game.placedWords[0].found).toBe(true);
    expect(game.getScore()).toBeGreaterThan(before);
    game.destroy();
  });

  it('an invalid drag does not mark any word found', () => {
    const game = createGame(0);
    game.start();
    // Drag a single cell (length 1) — should not match
    const pt = cellCenter(game, 0, 0);
    game.handlePointerDown(pt.x, pt.y);
    game.handlePointerUp(pt.x, pt.y);
    expect(game.placedWords.every(p => !p.found)).toBe(true);
    game.destroy();
  });

  it('finding all words triggers onWin', () => {
    const onWin = vi.fn();
    const info = getGame('word-search')!;
    const canvas = document.createElement('canvas');
    const game = info.createGame({
      canvas, width: 360, height: 640, difficulty: 0, onWin,
    }) as unknown as ReturnType<typeof createGame>;
    game.start();

    for (const pw of game.placedWords) {
      const startPt = cellCenter(game, pw.row, pw.col);
      const endPt = cellCenter(
        game,
        pw.row + pw.dr * (pw.word.length - 1),
        pw.col + pw.dc * (pw.word.length - 1),
      );
      game.handlePointerDown(startPt.x, startPt.y);
      game.handlePointerMove(endPt.x, endPt.y);
      game.handlePointerUp(endPt.x, endPt.y);
    }

    expect(onWin).toHaveBeenCalled();
    expect(game.isWon()).toBe(true);
    game.destroy();
  });
});

describe('Word Search – Daily mode determinism', () => {
  it('same seed produces identical grid and placement', () => {
    const a = createGame(1, 12345);
    const b = createGame(1, 12345);
    a.start();
    b.start();
    expect(a.size).toBe(b.size);
    expect(a.grid).toEqual(b.grid);
    expect(a.placedWords.map(p => p.word)).toEqual(b.placedWords.map(p => p.word));
    expect(a.placedWords.map(p => `${p.row},${p.col},${p.dr},${p.dc}`)).toEqual(
      b.placedWords.map(p => `${p.row},${p.col},${p.dr},${p.dc}`),
    );
    a.destroy();
    b.destroy();
  });

  it('different seeds produce different grids', () => {
    const a = createGame(1, 1);
    const b = createGame(1, 9999);
    a.start();
    b.start();
    // Either grid contents or placed words should differ
    const sameGrid = JSON.stringify(a.grid) === JSON.stringify(b.grid);
    const sameWords = JSON.stringify(a.placedWords.map(p => p.word)) ===
      JSON.stringify(b.placedWords.map(p => p.word));
    expect(sameGrid && sameWords).toBe(false);
    a.destroy();
    b.destroy();
  });
});

describe('Word Search – Save / Resume', () => {
  it('serialize/deserialize round-trips grid + found words', () => {
    const game = createGame(0, 42);
    game.start();
    // Mark first word as found via drag
    const pw = game.placedWords[0];
    const cellSize = game.cellSize;
    const startX = game.gridX + pw.col * cellSize + cellSize / 2;
    const startY = game.gridY + pw.row * cellSize + cellSize / 2;
    const endX = game.gridX + (pw.col + pw.dc * (pw.word.length - 1)) * cellSize + cellSize / 2;
    const endY = game.gridY + (pw.row + pw.dr * (pw.word.length - 1)) * cellSize + cellSize / 2;
    game.handlePointerDown(startX, startY);
    game.handlePointerMove(endX, endY);
    game.handlePointerUp(endX, endY);

    const snapshot = game.serialize();
    const score = game.getScore();
    const gridBefore = game.grid.map(row => [...row]);
    const wordsBefore = game.placedWords.map(p => ({ ...p }));
    game.destroy();

    const restored = createGame(0, 42);
    restored.start({ state: snapshot, score });
    expect(restored.grid).toEqual(gridBefore);
    expect(restored.placedWords.length).toBe(wordsBefore.length);
    for (let i = 0; i < wordsBefore.length; i++) {
      expect(restored.placedWords[i].word).toBe(wordsBefore[i].word);
      expect(restored.placedWords[i].found).toBe(wordsBefore[i].found);
      expect(restored.placedWords[i].row).toBe(wordsBefore[i].row);
      expect(restored.placedWords[i].col).toBe(wordsBefore[i].col);
    }
    expect(restored.getScore()).toBe(score);
    // Resumed game should still be playable
    expect(() => {
      restored.update(0.016);
      restored.render();
    }).not.toThrow();
    restored.destroy();
  });

  it('canSave is true during normal gameplay and false during winning/dragging', () => {
    const game = createGame(0);
    game.start();
    expect(game.canSave()).toBe(true);

    // Simulate dragging
    game.dragging = true;
    expect(game.canSave()).toBe(false);
    game.dragging = false;

    // Simulate winning state
    game.winning = true;
    expect(game.canSave()).toBe(false);
    game.winning = false;

    // Game over (gameActive = false) → cannot save
    game.gameActive = false;
    expect(game.canSave()).toBe(false);

    game.destroy();
  });

  it('deserialize is defensive against malformed snapshots', () => {
    const game = createGame(0);
    game.start();
    const gridBefore = game.grid.map(row => [...row]);

    expect(() => game.deserialize({} as Record<string, unknown>)).not.toThrow();
    expect(() => game.deserialize({ grid: 'nope' } as unknown as Record<string, unknown>)).not.toThrow();
    expect(() => game.deserialize({ size: 5, grid: [[1, 2]] } as unknown as Record<string, unknown>)).not.toThrow();
    expect(() => game.deserialize({ size: -1, grid: [], placedWords: [] } as Record<string, unknown>)).not.toThrow();
    expect(() => game.deserialize({ size: 8, grid: gridBefore, placedWords: 'nope' } as unknown as Record<string, unknown>)).not.toThrow();

    // Grid should still be intact and game playable
    expect(game.grid.length).toBe(gridBefore.length);
    expect(() => {
      game.update(0.016);
      game.render();
    }).not.toThrow();
    game.destroy();
  });
});
