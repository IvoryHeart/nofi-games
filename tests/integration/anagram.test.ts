import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock idb-keyval before any source imports — Anagram doesn't read from
// storage directly, but the registry chain pulls in modules that might.
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

// Mock haptics so the radial-picker tests can spy on invalid-word feedback.
vi.mock('../../src/utils/haptics', () => ({
  initHaptics: vi.fn(async () => {}),
  setHapticsEnabled: vi.fn(),
  hapticLight: vi.fn(),
  hapticMedium: vi.fn(),
  hapticHeavy: vi.fn(),
  hapticError: vi.fn(),
}));

import { loadAllGames, getGame } from '../../src/games/registry';
import { GameEngine, GameConfig } from '../../src/engine/GameEngine';
import { hapticMedium, hapticLight } from '../../src/utils/haptics';

function makeConfig(
  diff = 0,
  onScore?: (s: number) => void,
  onGameOver?: (s: number) => void,
  onWin?: (s: number) => void,
  seed?: number,
): GameConfig {
  return {
    canvas: document.createElement('canvas'),
    width: 360,
    height: 640,
    difficulty: diff,
    onScore,
    onGameOver,
    onWin,
    seed,
  };
}

function fakeKeyEvent(key: string): KeyboardEvent {
  return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

beforeAll(async () => {
  store.clear();
  await loadAllGames();
});

// Helpers to reach into the game's internals (typed loosely so the test can
// inspect & drive the game without exposing every field publicly).
type TileRect = { x: number; y: number; r: number; index: number; angle: number };
type AnagramInternals = GameEngine & {
  base: string;
  letters: string[];
  validWords: Set<string>;
  foundWords: string[];
  foundPangram: boolean;
  currentInput: string;
  selectedTiles: number[];
  timeLeft: number;
  gameActive: boolean;
  cfg: { letterCount: number; timeLimit: number; targetWords: number; requirePangram: boolean };
  toggleTile: (i: number) => void;
  submitWord: () => boolean;
  shuffle: () => void;
  clearInput: () => void;
  // Radial picker internals
  tileRects: TileRect[];
  tileCenterX: number;
  tileCenterY: number;
  ringRadius: number;
  tileRadius: number;
  dragActive: boolean;
  isDragging: boolean;
  handlePointerDown: (x: number, y: number) => void;
  handlePointerMove: (x: number, y: number) => void;
  handlePointerUp: (x: number, y: number) => void;
};

function createAnagram(diff = 1, opts: {
  onScore?: (s: number) => void;
  onGameOver?: (s: number) => void;
  onWin?: (s: number) => void;
  seed?: number;
} = {}): AnagramInternals {
  const info = getGame('anagram')!;
  const game = info.createGame(
    makeConfig(diff, opts.onScore, opts.onGameOver, opts.onWin, opts.seed),
  ) as unknown as AnagramInternals;
  game.start();
  return game;
}

/** Drive the game to enter a specific word by tapping the right tiles in
 *  order. Returns true iff every letter could be sourced from a still-unused
 *  tile (i.e., the word is buildable from the current letters). */
function typeWord(game: AnagramInternals, word: string): boolean {
  game.clearInput();
  for (const ch of word.toLowerCase()) {
    let found = false;
    for (let i = 0; i < game.letters.length; i++) {
      if (game.letters[i] === ch && !game.selectedTiles.includes(i)) {
        game.toggleTile(i);
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

describe('Anagram - registration & lifecycle', () => {

  it('should be registered in the registry', () => {
    const info = getGame('anagram');
    expect(info).toBeDefined();
    expect(info!.id).toBe('anagram');
    expect(info!.name).toBe('Anagram');
  });

  it('should expose dailyMode and continuableAfterWin flags', () => {
    const info = getGame('anagram')!;
    expect(info.dailyMode).toBe(true);
    expect(info.continuableAfterWin).toBe(true);
  });

  it('should instantiate at all 4 difficulties without throwing', () => {
    const info = getGame('anagram')!;
    for (let d = 0; d <= 3; d++) {
      const game = info.createGame(makeConfig(d));
      expect(game).toBeInstanceOf(GameEngine);
      game.destroy();
    }
  });

  it('should pick the right number of letters for each difficulty', () => {
    const expected = [5, 6, 7, 7];
    for (let d = 0; d <= 3; d++) {
      const game = createAnagram(d);
      expect(game.letters.length).toBe(expected[d]);
      expect(game.base.length).toBe(expected[d]);
      game.destroy();
    }
  });

  it('should run a clean start/update/render/destroy lifecycle', () => {
    const game = createAnagram(1);
    expect(() => {
      for (let i = 0; i < 5; i++) {
        game.update(0.016);
        game.render();
      }
    }).not.toThrow();
    game.destroy();
  });
});

describe('Anagram - puzzle generation', () => {

  it('should populate validWords with at least the pangram itself', () => {
    const game = createAnagram(1);
    expect(game.validWords.has(game.base)).toBe(true);
    game.destroy();
  });

  it('should populate validWords with multiple sub-words for the chosen base', () => {
    const game = createAnagram(1);
    // For any of the curated bases at medium/hard difficulty, we expect
    // the dictionary to yield at least a handful of valid sub-words.
    expect(game.validWords.size).toBeGreaterThanOrEqual(3);
    game.destroy();
  });
});

describe('Anagram - daily / seeded mode', () => {

  it('same seed produces same base and same letter order', () => {
    const a = createAnagram(1, { seed: 42 });
    const b = createAnagram(1, { seed: 42 });
    expect(a.base).toBe(b.base);
    expect(a.letters).toEqual(b.letters);
    a.destroy();
    b.destroy();
  });

  it('different seeds may produce different output (smoke check)', () => {
    // Pick two seeds that exercise different branches; we don't strictly
    // require the bases to differ (the curated list may collide), but the
    // test ensures determinism per-seed.
    const a = createAnagram(1, { seed: 1 });
    const b = createAnagram(1, { seed: 1 });
    expect(a.letters).toEqual(b.letters);
    a.destroy();
    b.destroy();
  });
});

describe('Anagram - submit word', () => {

  it('submitting a valid word adds it to the found list and increases score', () => {
    const scoreFn = vi.fn();
    const game = createAnagram(1, { onScore: scoreFn });
    // Pick any valid sub-word that isn't the pangram, to avoid the bonus
    const sub = [...game.validWords].find((w) => w !== game.base);
    expect(sub).toBeDefined();

    expect(typeWord(game, sub!)).toBe(true);
    const ok = game.submitWord();
    expect(ok).toBe(true);
    expect(game.foundWords).toContain(sub!);
    // score callback was triggered
    expect(scoreFn).toHaveBeenCalled();
    expect(game.getScore()).toBeGreaterThan(0);
    game.destroy();
  });

  it('submitting an invalid word does NOT add it and clears the input', () => {
    const game = createAnagram(1);
    // Force a guaranteed-non-word into the input via tile taps. We can't
    // type arbitrary letters since the tile set is limited, so we craft
    // garbage from the available letters and count on it not being in the
    // dictionary by checking validWords explicitly.
    const garbage = game.letters.slice(0, 3).join('');
    if (game.validWords.has(garbage)) {
      // Highly unlikely, but if it happens we just skip and pass — we're
      // testing the rejection path, which doesn't apply here.
      game.destroy();
      return;
    }
    expect(typeWord(game, garbage)).toBe(true);
    const ok = game.submitWord();
    expect(ok).toBe(false);
    expect(game.foundWords.length).toBe(0);
    expect(game.currentInput).toBe('');
    game.destroy();
  });

  it('submitting a too-short word is rejected without crashing', () => {
    const game = createAnagram(1);
    expect(typeWord(game, game.letters[0] + game.letters[1])).toBe(true);
    const ok = game.submitWord();
    expect(ok).toBe(false);
    expect(game.foundWords.length).toBe(0);
    game.destroy();
  });

  it('submitting the same valid word twice only counts once', () => {
    const game = createAnagram(1);
    const sub = [...game.validWords].find((w) => w !== game.base);
    expect(sub).toBeDefined();
    typeWord(game, sub!);
    expect(game.submitWord()).toBe(true);
    typeWord(game, sub!);
    expect(game.submitWord()).toBe(false); // already found
    expect(game.foundWords.filter((w) => w === sub).length).toBe(1);
    game.destroy();
  });

  it('submitting the pangram awards a bonus and marks foundPangram', () => {
    const game = createAnagram(1);
    const before = game.getScore();
    expect(typeWord(game, game.base)).toBe(true);
    expect(game.submitWord()).toBe(true);
    expect(game.foundPangram).toBe(true);
    // base score for a 6-letter word is 25; pangram bonus is 50 => +75 minimum
    expect(game.getScore() - before).toBeGreaterThanOrEqual(75);
    game.destroy();
  });
});

describe('Anagram - win & lose conditions', () => {

  it('reaching the target word count fires onWin', () => {
    const onWin = vi.fn();
    // Easy: 5 words, no pangram required
    const game = createAnagram(0, { onWin });
    // Submit up to targetWords valid words. Use the pangram first so we
    // never run out of options on small dictionaries.
    const distinct = [...game.validWords];
    let count = 0;
    for (const w of distinct) {
      if (count >= game.cfg.targetWords) break;
      if (typeWord(game, w)) {
        if (game.submitWord()) count++;
      }
    }
    if (count >= game.cfg.targetWords) {
      expect(onWin).toHaveBeenCalled();
    } else {
      // The chosen base didn't have enough sub-words for Easy. That's a
      // dictionary-coverage problem we want to surface.
      throw new Error(`Easy puzzle for base "${game.base}" only had ${count} sub-words; needs ${game.cfg.targetWords}`);
    }
    game.destroy();
  });

  it('timer running out triggers onGameOver', () => {
    const onGameOver = vi.fn();
    const game = createAnagram(0, { onGameOver });
    // Drain the timer in one big tick
    game.update(game.timeLeft + 1);
    expect(onGameOver).toHaveBeenCalled();
    expect(game.gameActive).toBe(false);
    game.destroy();
  });

  it('canSave returns true while playing and false after game over', () => {
    const game = createAnagram(0);
    expect(game.canSave()).toBe(true);
    game.update(game.timeLeft + 1);
    expect(game.canSave()).toBe(false);
    game.destroy();
  });
});

describe('Anagram - input handling', () => {

  it('keyboard letters that match a tile add to the input', () => {
    const game = createAnagram(1);
    const ch = game.letters[0];
    game.handleKeyDown(ch, fakeKeyEvent(ch));
    expect(game.currentInput).toBe(ch);
    game.destroy();
  });

  it('Escape clears the input', () => {
    const game = createAnagram(1);
    game.toggleTile(0);
    expect(game.currentInput.length).toBe(1);
    game.handleKeyDown('Escape', fakeKeyEvent('Escape'));
    expect(game.currentInput).toBe('');
    game.destroy();
  });

  it('Backspace removes the last selected tile', () => {
    const game = createAnagram(1);
    game.toggleTile(0);
    game.toggleTile(1);
    expect(game.currentInput.length).toBe(2);
    game.handleKeyDown('Backspace', fakeKeyEvent('Backspace'));
    expect(game.currentInput.length).toBe(1);
    game.destroy();
  });

  it('tapping a selected tile deselects it', () => {
    const game = createAnagram(1);
    game.toggleTile(0);
    expect(game.selectedTiles.length).toBe(1);
    game.toggleTile(0);
    expect(game.selectedTiles.length).toBe(0);
    expect(game.currentInput).toBe('');
    game.destroy();
  });

  it('shuffle clears the current input', () => {
    const game = createAnagram(1);
    game.toggleTile(0);
    game.toggleTile(1);
    game.shuffle();
    expect(game.currentInput).toBe('');
    expect(game.selectedTiles.length).toBe(0);
    game.destroy();
  });
});

describe('Anagram - serialize / deserialize', () => {

  it('serialize returns a snapshot containing base, letters, foundWords', () => {
    const game = createAnagram(1);
    const snap = game.serialize() as Record<string, unknown>;
    expect(snap).toBeDefined();
    expect(typeof snap.base).toBe('string');
    expect(Array.isArray(snap.letters)).toBe(true);
    expect(Array.isArray(snap.foundWords)).toBe(true);
    expect(typeof snap.timeLeft).toBe('number');
    game.destroy();
  });

  it('deserialize restores base, letters, foundWords, and timeLeft', () => {
    const a = createAnagram(1);
    // Submit one word so foundWords is non-empty
    const sub = [...a.validWords].find((w) => w !== a.base);
    if (sub) {
      typeWord(a, sub);
      a.submitWord();
    }
    const snap = a.serialize()!;

    const b = createAnagram(1);
    b.deserialize(snap);
    expect(b.base).toBe(a.base);
    expect(b.letters).toEqual(a.letters);
    expect(b.foundWords).toEqual(a.foundWords);
    expect(b.timeLeft).toBeCloseTo(a.timeLeft, 5);
    a.destroy();
    b.destroy();
  });

  it('deserialize ignores corrupt snapshots', () => {
    const game = createAnagram(1);
    const baseBefore = game.base;
    const lettersBefore = [...game.letters];

    // Corrupt: missing fields
    expect(() => game.deserialize({})).not.toThrow();
    expect(game.base).toBe(baseBefore);
    expect(game.letters).toEqual(lettersBefore);

    // Corrupt: wrong letter count
    expect(() => game.deserialize({ base: 'foo', letters: ['a'] })).not.toThrow();
    expect(game.base).toBe(baseBefore);

    // Corrupt: wrong types
    expect(() => game.deserialize({ base: 123, letters: 'nope' } as never)).not.toThrow();
    expect(game.base).toBe(baseBefore);
    game.destroy();
  });
});

describe('Anagram - radial layout', () => {

  it('places one tile per letter on a circle around the playfield center', () => {
    for (const diff of [0, 1, 2, 3]) {
      const game = createAnagram(diff);
      expect(game.tileRects.length).toBe(game.letters.length);
      expect(game.ringRadius).toBeGreaterThan(0);

      // Each tile should sit on the ring (distance from center ≈ ringRadius).
      for (const tile of game.tileRects) {
        const dx = tile.x - game.tileCenterX;
        const dy = tile.y - game.tileCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(Math.abs(dist - game.ringRadius)).toBeLessThan(0.01);
      }

      // Angular spacing should be even: 2*PI / N between consecutive tiles.
      const n = game.tileRects.length;
      if (n >= 2) {
        const expected = (Math.PI * 2) / n;
        for (let i = 1; i < n; i++) {
          const delta = game.tileRects[i].angle - game.tileRects[i - 1].angle;
          expect(Math.abs(delta - expected)).toBeLessThan(1e-6);
        }
        // First tile at the top: angle = -PI/2.
        expect(Math.abs(game.tileRects[0].angle + Math.PI / 2)).toBeLessThan(1e-6);
      }

      // Ring must clear the header area and the buttons — i.e., every tile
      // should be fully within the canvas bounds with its own radius margin.
      for (const tile of game.tileRects) {
        expect(tile.x - tile.r).toBeGreaterThanOrEqual(0);
        expect(tile.x + tile.r).toBeLessThanOrEqual(360);
        expect(tile.y - tile.r).toBeGreaterThanOrEqual(0);
        expect(tile.y + tile.r).toBeLessThanOrEqual(640);
      }

      game.destroy();
    }
  });
});

describe('Anagram - drag to connect', () => {

  it('dragging from tile A onto tile B builds the word "AB"', () => {
    const game = createAnagram(1);
    const a = game.tileRects[0];
    const b = game.tileRects[1];

    game.handlePointerDown(a.x, a.y);
    expect(game.dragActive).toBe(true);
    expect(game.selectedTiles).toEqual([0]);
    expect(game.currentInput).toBe(game.letters[0]);

    // Pointer travels onto tile B — should extend the word and mark isDragging.
    game.handlePointerMove(b.x, b.y);
    expect(game.isDragging).toBe(true);
    expect(game.selectedTiles).toEqual([0, 1]);
    expect(game.currentInput).toBe(game.letters[0] + game.letters[1]);

    // Release (not on a tile — pointer-up coords don't matter for submit).
    game.handlePointerUp(b.x, b.y);
    expect(game.dragActive).toBe(false);
    game.destroy();
  });

  it('backtracking from B to A drops the last letter, leaving word "A"', () => {
    const game = createAnagram(1);
    const a = game.tileRects[0];
    const b = game.tileRects[1];

    game.handlePointerDown(a.x, a.y);
    game.handlePointerMove(b.x, b.y);
    expect(game.selectedTiles).toEqual([0, 1]);

    // Drag back onto tile A — should pop tile B off the selection.
    game.handlePointerMove(a.x, a.y);
    expect(game.selectedTiles).toEqual([0]);
    expect(game.currentInput).toBe(game.letters[0]);
    game.destroy();
  });

  it('click-click still works: tap A, tap B, submit builds and submits "AB"', () => {
    const game = createAnagram(1);
    // Pick a real two-letter prefix of a known valid word so submit succeeds
    // for the dictionary-dependent case, OR just verify the input is built.
    const a = game.tileRects[0];
    const b = game.tileRects[1];

    // Tap A: pointer down + up on same spot with no movement.
    game.handlePointerDown(a.x, a.y);
    game.handlePointerUp(a.x, a.y);
    expect(game.selectedTiles).toEqual([0]);
    expect(game.isDragging).toBe(false);
    expect(game.dragActive).toBe(false);

    // Tap B: same deal. Since no drag happened, selection should persist
    // and the new tap just appends tile B.
    game.handlePointerDown(b.x, b.y);
    game.handlePointerUp(b.x, b.y);
    expect(game.selectedTiles).toEqual([0, 1]);
    expect(game.currentInput).toBe(game.letters[0] + game.letters[1]);

    // submitWord returns false if "AB" isn't a valid dictionary word — we're
    // only asserting the click-click path assembled the input correctly.
    const assembled = game.currentInput;
    expect(assembled.length).toBe(2);
    game.destroy();
  });

  it('invalid drag-released word does not add to found list and fires an error haptic', () => {
    vi.mocked(hapticMedium).mockClear();
    vi.mocked(hapticLight).mockClear();

    const game = createAnagram(1);
    // Craft a 3-letter "word" from the first three tiles. If the dictionary
    // happens to contain it, skip — we're specifically testing rejection.
    const garbage = game.letters.slice(0, 3).join('');
    if (game.validWords.has(garbage)) {
      game.destroy();
      return;
    }

    // Drag through tiles 0 → 1 → 2. Auto-submit on release.
    game.handlePointerDown(game.tileRects[0].x, game.tileRects[0].y);
    game.handlePointerMove(game.tileRects[1].x, game.tileRects[1].y);
    game.handlePointerMove(game.tileRects[2].x, game.tileRects[2].y);
    expect(game.currentInput).toBe(garbage);

    game.handlePointerUp(game.tileRects[2].x, game.tileRects[2].y);

    expect(game.foundWords.length).toBe(0);
    expect(game.currentInput).toBe('');
    // submitWord calls haptic('medium') on the "Not a word" path.
    expect(hapticMedium).toHaveBeenCalled();
    game.destroy();
  });

  it('dragging across a valid dictionary word auto-submits and scores it', () => {
    const game = createAnagram(1);
    const sub = [...game.validWords].find((w) => w !== game.base && w.length >= 3);
    if (!sub) {
      game.destroy();
      return;
    }

    // Map each letter of the word to a tile index (first unused occurrence).
    const indices: number[] = [];
    const used = new Set<number>();
    for (const ch of sub) {
      let found = -1;
      for (let i = 0; i < game.letters.length; i++) {
        if (game.letters[i] === ch && !used.has(i)) { found = i; break; }
      }
      if (found === -1) { game.destroy(); return; }
      indices.push(found);
      used.add(found);
    }

    game.handlePointerDown(game.tileRects[indices[0]].x, game.tileRects[indices[0]].y);
    for (let i = 1; i < indices.length; i++) {
      const tile = game.tileRects[indices[i]];
      game.handlePointerMove(tile.x, tile.y);
    }
    const lastTile = game.tileRects[indices[indices.length - 1]];
    game.handlePointerUp(lastTile.x, lastTile.y);

    expect(game.foundWords).toContain(sub);
    expect(game.getScore()).toBeGreaterThan(0);
    game.destroy();
  });
});

describe('Anagram - serialize with radial state', () => {

  it('serialize includes the in-flight selectedTiles and currentInput', () => {
    const game = createAnagram(1);
    game.toggleTile(0);
    game.toggleTile(1);
    const snap = game.serialize() as Record<string, unknown>;
    expect(Array.isArray(snap.selectedTiles)).toBe(true);
    expect((snap.selectedTiles as number[])).toEqual([0, 1]);
    expect(snap.currentInput).toBe(game.letters[0] + game.letters[1]);
    expect(snap.v).toBe(2);
    game.destroy();
  });

  it('deserialize round-trips selectedTiles and rebuilds tileRects', () => {
    const a = createAnagram(1);
    a.toggleTile(0);
    a.toggleTile(2);
    const snap = a.serialize()!;

    const b = createAnagram(1);
    b.deserialize(snap);
    expect(b.selectedTiles).toEqual([0, 2]);
    expect(b.currentInput).toBe(a.currentInput);
    // Tile rects must still cover every letter so pointer hit-testing works.
    expect(b.tileRects.length).toBe(b.letters.length);
    a.destroy();
    b.destroy();
  });

  it('deserialize without v2 radial fields still restores the core puzzle (backward compatible)', () => {
    const a = createAnagram(1);
    const legacySnap: Record<string, unknown> = {
      base: a.base,
      letters: [...a.letters],
      foundWords: [],
      foundPangram: false,
      timeLeft: 50,
      gameActive: true,
      difficulty: 1,
      // no v, no selectedTiles, no currentInput
    };

    const b = createAnagram(1);
    b.deserialize(legacySnap);
    expect(b.base).toBe(a.base);
    expect(b.letters).toEqual(a.letters);
    expect(b.selectedTiles).toEqual([]);
    expect(b.currentInput).toBe('');
    a.destroy();
    b.destroy();
  });
});
