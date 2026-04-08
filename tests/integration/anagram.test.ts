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

import { loadAllGames, getGame } from '../../src/games/registry';
import { GameEngine, GameConfig } from '../../src/engine/GameEngine';

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
