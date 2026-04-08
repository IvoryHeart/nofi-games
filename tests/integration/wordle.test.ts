import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock idb-keyval before any source imports
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { GameEngine, GameConfig } from '../../src/engine/GameEngine';
import { loadAllGames, getGame } from '../../src/games/registry';

function makeConfig(opts: {
  width?: number;
  height?: number;
  difficulty?: number;
  seed?: number;
  onScore?: (s: number) => void;
  onGameOver?: (s: number) => void;
  onWin?: (s: number) => void;
} = {}): GameConfig {
  const canvas = document.createElement('canvas');
  return {
    canvas,
    width: opts.width ?? 360,
    height: opts.height ?? 600,
    difficulty: opts.difficulty ?? 1,
    seed: opts.seed,
    onScore: opts.onScore,
    onGameOver: opts.onGameOver,
    onWin: opts.onWin,
  };
}

// Helper: build a Wordle game and reach into private state via `as any` cast
type WordleLike = GameEngine & {
  targetWord: string;
  guesses: string[];
  currentInput: string;
  wordLength: number;
  maxGuesses: number;
  gameActive: boolean;
  hintShown: boolean;
  shake: number;
  won: boolean;
  winDelay: number;
  winDelayTotal: number;
};

function makeWordle(opts: Parameters<typeof makeConfig>[0] = {}): WordleLike {
  const info = getGame('wordle')!;
  const game = info.createGame(makeConfig(opts)) as unknown as WordleLike;
  game.start();
  return game;
}

function pressKey(game: WordleLike, key: string): void {
  // Synthesize a KeyboardEvent and call the bound listener directly via window dispatch
  const evt = new KeyboardEvent('keydown', { key, cancelable: true });
  window.dispatchEvent(evt);
}

beforeAll(async () => {
  store.clear();
  await loadAllGames();
});

describe('Wordle', () => {
  describe('Registration', () => {
    it('is registered in the registry', () => {
      expect(getGame('wordle')).toBeDefined();
    });

    it('has the expected metadata', () => {
      const info = getGame('wordle')!;
      expect(info.id).toBe('wordle');
      expect(info.name).toBe('Wordle');
      expect(info.category).toBe('puzzle');
      expect(info.dailyMode).toBe(true);
      expect(info.canvasWidth).toBe(360);
      expect(info.canvasHeight).toBe(600);
      expect(info.controls).toContain('Type');
      expect(info.bgGradient).toEqual(['#6BAA75', '#A8D5B5']);
    });
  });

  describe('Instantiation', () => {
    it('instantiates at all 4 difficulties without throwing', () => {
      const info = getGame('wordle')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig({ difficulty: d }));
        expect(game).toBeInstanceOf(GameEngine);
        game.destroy();
      }
    });

    it('produces difficulty-appropriate word lengths', () => {
      const expectedLengths = [4, 5, 5, 6];
      for (let d = 0; d <= 3; d++) {
        const game = makeWordle({ difficulty: d, seed: 42 });
        expect(game.wordLength).toBe(expectedLengths[d]);
        expect(game.targetWord.length).toBe(expectedLengths[d]);
        game.destroy();
      }
    });

    it('uses 5 guesses on Hard, 6 elsewhere', () => {
      const easy = makeWordle({ difficulty: 0, seed: 1 });
      expect(easy.maxGuesses).toBe(6);
      easy.destroy();

      const hard = makeWordle({ difficulty: 2, seed: 1 });
      expect(hard.maxGuesses).toBe(5);
      hard.destroy();
    });
  });

  describe('Lifecycle', () => {
    it('completes start → update → render → destroy without leaks', () => {
      const game = makeWordle({ seed: 7 });
      expect(() => {
        (game as unknown as { update: (dt: number) => void }).update(0.016);
        (game as unknown as { render: () => void }).render();
        (game as unknown as { update: (dt: number) => void }).update(0.016);
        (game as unknown as { render: () => void }).render();
        game.destroy();
      }).not.toThrow();
    });

    it('handles small canvas dimensions gracefully', () => {
      const info = getGame('wordle')!;
      expect(() => {
        const game = info.createGame(makeConfig({ width: 100, height: 100 }));
        game.start();
        game.destroy();
      }).not.toThrow();
    });
  });

  describe('Input handling', () => {
    it('typing letters appends to current input', () => {
      const game = makeWordle({ seed: 123, difficulty: 1 });
      pressKey(game, 'a');
      pressKey(game, 'b');
      pressKey(game, 'c');
      expect(game.currentInput).toBe('ABC');
      game.destroy();
    });

    it('caps current input at the word length', () => {
      const game = makeWordle({ seed: 123, difficulty: 1 }); // 5 letters
      for (const ch of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
        pressKey(game, ch);
      }
      expect(game.currentInput.length).toBe(5);
      game.destroy();
    });

    it('Backspace removes the last letter', () => {
      const game = makeWordle({ seed: 9, difficulty: 1 });
      pressKey(game, 'a');
      pressKey(game, 'b');
      pressKey(game, 'c');
      pressKey(game, 'Backspace');
      expect(game.currentInput).toBe('AB');
      game.destroy();
    });

    it('Backspace on empty input is a no-op', () => {
      const game = makeWordle({ seed: 9, difficulty: 1 });
      expect(game.currentInput).toBe('');
      pressKey(game, 'Backspace');
      expect(game.currentInput).toBe('');
      game.destroy();
    });

    it('non-letter keys are ignored', () => {
      const game = makeWordle({ seed: 9, difficulty: 1 });
      pressKey(game, '1');
      pressKey(game, '!');
      pressKey(game, ' ');
      expect(game.currentInput).toBe('');
      game.destroy();
    });
  });

  describe('Submitting guesses', () => {
    it('Enter on incomplete guess does nothing (no submission)', () => {
      const game = makeWordle({ seed: 9, difficulty: 1 });
      pressKey(game, 'a');
      pressKey(game, 'b');
      pressKey(game, 'c');
      pressKey(game, 'Enter');
      expect(game.guesses.length).toBe(0);
      // Current input is preserved
      expect(game.currentInput).toBe('ABC');
      // Shake animation should have been triggered
      expect(game.shake).toBeGreaterThan(0);
      game.destroy();
    });

    it('Enter on a complete guess submits it', () => {
      const game = makeWordle({ seed: 9, difficulty: 1 }); // 5 letters
      // Type a 5-letter non-target word
      const fake = game.targetWord === 'ABOUT' ? 'HELLO' : 'ABOUT';
      for (const ch of fake) pressKey(game, ch);
      pressKey(game, 'Enter');
      expect(game.guesses.length).toBe(1);
      expect(game.guesses[0]).toBe(fake);
      expect(game.currentInput).toBe('');
      game.destroy();
    });

    it('correct guess fires onWin and sets won', () => {
      const onWin = vi.fn();
      const game = makeWordle({ seed: 5, difficulty: 1, onWin });
      const target = game.targetWord;
      for (const ch of target) pressKey(game, ch);
      pressKey(game, 'Enter');
      expect(game.won).toBe(true);
      expect(onWin).toHaveBeenCalledTimes(1);
      // Score should be positive (1000 - 100*0 = 1000 on first guess)
      expect(onWin.mock.calls[0][0]).toBeGreaterThan(0);
      game.destroy();
    });

    it('score scales down with more guesses used', () => {
      const onWin = vi.fn();
      const game = makeWordle({ seed: 5, difficulty: 1, onWin });
      const target = game.targetWord;
      // First a wrong guess (use a word from list that isn't target)
      const wrong = target === 'ABOUT' ? 'HELLO' : 'ABOUT';
      for (const ch of wrong) pressKey(game, ch);
      pressKey(game, 'Enter');
      // Now win on guess 2
      for (const ch of target) pressKey(game, ch);
      pressKey(game, 'Enter');
      expect(game.won).toBe(true);
      expect(onWin).toHaveBeenCalledWith(900); // 1000 - 100*1
      game.destroy();
    });

    it('running out of guesses fires onGameOver with score 0', () => {
      const onGameOver = vi.fn();
      const game = makeWordle({ seed: 11, difficulty: 1, onGameOver });
      const target = game.targetWord;
      // Submit 6 wrong guesses
      const candidates = ['ABOUT', 'HELLO', 'WORLD', 'PLANT', 'CRANE', 'STONE', 'BRICK'];
      let submitted = 0;
      let i = 0;
      while (submitted < 6 && i < candidates.length) {
        const c = candidates[i++];
        if (c === target) continue;
        for (const ch of c) pressKey(game, ch);
        pressKey(game, 'Enter');
        submitted++;
      }
      expect(game.guesses.length).toBe(6);
      expect(onGameOver).toHaveBeenCalledTimes(1);
      expect(onGameOver.mock.calls[0][0]).toBe(0);
      game.destroy();
    });
  });

  describe('Win delay animation', () => {
    it('canSave returns false during the win animation', () => {
      const game = makeWordle({ seed: 5, difficulty: 1 });
      const target = game.targetWord;
      for (const ch of target) pressKey(game, ch);
      pressKey(game, 'Enter');
      expect(game.won).toBe(true);
      expect(game.canSave()).toBe(false);
      game.destroy();
    });

    it('post-win delay schedules gameOver after total elapsed time', () => {
      const onGameOver = vi.fn();
      const game = makeWordle({ seed: 5, difficulty: 1, onGameOver });
      const target = game.targetWord;
      for (const ch of target) pressKey(game, ch);
      pressKey(game, 'Enter');
      // Tick past the win delay total
      const ticker = game as unknown as { update: (dt: number) => void };
      ticker.update(0.5);
      ticker.update(0.5);
      ticker.update(0.6);
      expect(onGameOver).toHaveBeenCalledTimes(1);
      game.destroy();
    });
  });

  describe('Daily mode determinism', () => {
    it('same seed produces the same target word', () => {
      const a = makeWordle({ seed: 12345, difficulty: 1 });
      const b = makeWordle({ seed: 12345, difficulty: 1 });
      expect(a.targetWord).toBe(b.targetWord);
      a.destroy();
      b.destroy();
    });

    it('different seeds usually produce different target words', () => {
      const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const words = new Set<string>();
      for (const s of seeds) {
        const g = makeWordle({ seed: s, difficulty: 1 });
        words.add(g.targetWord);
        g.destroy();
      }
      // Across 10 seeds we expect at least a few unique words
      expect(words.size).toBeGreaterThan(1);
    });
  });

  describe('Serialize / Deserialize', () => {
    it('serialize round-trip restores guesses and target', () => {
      const game = makeWordle({ seed: 99, difficulty: 1 });
      const target = game.targetWord;
      // Type and submit one wrong guess
      const wrong = target === 'ABOUT' ? 'HELLO' : 'ABOUT';
      for (const ch of wrong) pressKey(game, ch);
      pressKey(game, 'Enter');
      // Type partial second guess
      pressKey(game, 'c');
      pressKey(game, 'a');
      pressKey(game, 't');

      const snap = (game as unknown as { serialize(): Record<string, unknown> }).serialize();
      game.destroy();

      // Build a fresh game and deserialize
      const fresh = makeWordle({ seed: 99, difficulty: 1 });
      (fresh as unknown as { deserialize(s: Record<string, unknown>): void }).deserialize(snap);
      expect(fresh.targetWord).toBe(target);
      expect(fresh.guesses.length).toBe(1);
      expect(fresh.guesses[0]).toBe(wrong);
      expect(fresh.currentInput).toBe('CAT');
      fresh.destroy();
    });

    it('canSave returns true during normal play', () => {
      const game = makeWordle({ seed: 33, difficulty: 1 });
      expect(game.canSave()).toBe(true);
      game.destroy();
    });

    it('canSave returns false right after a shake (incomplete submit)', () => {
      const game = makeWordle({ seed: 33, difficulty: 1 });
      pressKey(game, 'a');
      pressKey(game, 'b');
      pressKey(game, 'Enter'); // incomplete -> shake
      expect(game.shake).toBeGreaterThan(0);
      expect(game.canSave()).toBe(false);
      game.destroy();
    });

    it('defensive deserialize ignores malformed state', () => {
      const game = makeWordle({ seed: 7, difficulty: 1 });
      const originalTarget = game.targetWord;
      const dsGame = game as unknown as { deserialize(s: Record<string, unknown>): void };
      // Missing targetWord — should leave state untouched
      dsGame.deserialize({});
      expect(game.targetWord).toBe(originalTarget);
      // targetWord with wrong type
      dsGame.deserialize({ targetWord: 42 });
      expect(game.targetWord).toBe(originalTarget);
      // empty string
      dsGame.deserialize({ targetWord: '' });
      expect(game.targetWord).toBe(originalTarget);
      game.destroy();
    });

    it('deserialize handles non-array guesses gracefully', () => {
      const game = makeWordle({ seed: 7, difficulty: 1 });
      const dsGame = game as unknown as { deserialize(s: Record<string, unknown>): void };
      dsGame.deserialize({ targetWord: 'HELLO', guesses: 'not-an-array', currentInput: 'AB' });
      expect(game.targetWord).toBe('HELLO');
      expect(game.guesses).toEqual([]);
      expect(game.currentInput).toBe('AB');
      game.destroy();
    });
  });

  describe('Easy mode hint', () => {
    it('reveals a hint cell after the first wrong guess on Easy', () => {
      const game = makeWordle({ seed: 17, difficulty: 0 }); // 4-letter word
      const target = game.targetWord;
      // Build a wrong 4-letter guess that differs at every position
      let wrong = '';
      for (let i = 0; i < 4; i++) {
        const opts = 'XYZW';
        wrong += opts[i] === target[i] ? 'Q' : opts[i];
      }
      // Ensure it's actually wrong
      if (wrong === target) wrong = 'QQQQ';
      for (const ch of wrong) pressKey(game, ch);
      pressKey(game, 'Enter');
      expect(game.guesses.length).toBe(1);
      expect(game.hintShown).toBe(true);
      game.destroy();
    });

    it('does not show hints on Medium mode', () => {
      const game = makeWordle({ seed: 17, difficulty: 1 });
      const target = game.targetWord;
      const wrong = target === 'ABOUT' ? 'HELLO' : 'ABOUT';
      for (const ch of wrong) pressKey(game, ch);
      pressKey(game, 'Enter');
      expect(game.hintShown).toBe(false);
      game.destroy();
    });
  });

  // ── Render coverage ──────────────────────────────────────────────────────
  describe('Render coverage', () => {
    it('renders cleanly at all 4 difficulties', () => {
      const info = getGame('wordle')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig({ difficulty: d, seed: 100 + d }));
        game.start();
        expect(() => {
          (game as unknown as { render(): void }).render();
        }).not.toThrow();
        game.destroy();
      }
    });

    it('renders with an in-progress current-input row', () => {
      const game = makeWordle({ seed: 77, difficulty: 1 });
      pressKey(game, 'a');
      pressKey(game, 'b');
      (game as unknown as { render(): void }).render();
      expect(game.currentInput).toBe('AB');
      game.destroy();
    });

    it('renders the hint cell after Easy-mode first wrong guess', () => {
      const game = makeWordle({ seed: 17, difficulty: 0 });
      const target = game.targetWord;
      let wrong = '';
      for (let i = 0; i < 4; i++) {
        const opts = 'XYZW';
        wrong += opts[i] === target[i] ? 'Q' : opts[i];
      }
      if (wrong === target) wrong = 'QQQQ';
      for (const ch of wrong) pressKey(game, ch);
      pressKey(game, 'Enter');
      expect(game.hintShown).toBe(true);
      // Render with an empty current input so the hint cell is visible
      (game as unknown as { render(): void }).render();
      // And with a partial current input that leaves the hint position untouched
      pressKey(game, 'a');
      (game as unknown as { render(): void }).render();
      game.destroy();
    });

    it('renders the shake animation offset without throwing', () => {
      const game = makeWordle({ seed: 9, difficulty: 1 });
      pressKey(game, 'a');
      pressKey(game, 'b');
      pressKey(game, 'Enter'); // trigger shake (incomplete guess)
      expect(game.shake).toBeGreaterThan(0);
      (game as unknown as { render(): void }).render();
      // And tick update to decay shake
      (game as unknown as { update(dt: number): void }).update(0.05);
      expect(game.shake).toBeGreaterThanOrEqual(0);
      game.destroy();
    });

    it('renders submitted guesses with a mix of correct / present / absent letters', () => {
      const game = makeWordle({ seed: 5, difficulty: 1 });
      const target = game.targetWord;
      // Build a guess that shares letters with target to surface green/yellow/gray mix
      // Strategy: use first letter from target and fill the rest with letters likely absent
      const filler = 'QZXVJ';
      let mixed = target[0] || 'A';
      for (let i = 1; i < game.wordLength; i++) {
        // If target's later letter isn't already first, put it shifted by 1 (present, not correct)
        if (i < target.length - 1) mixed += target[i + 1];
        else mixed += filler[i % filler.length];
      }
      if (mixed.length !== game.wordLength) {
        mixed = target.split('').reverse().join('');
      }
      for (const ch of mixed) pressKey(game, ch);
      pressKey(game, 'Enter');
      expect(game.guesses.length).toBe(1);
      // Render exercises drawKbKey for all key states (including absent)
      (game as unknown as { render(): void }).render();
      // Also exercise the getKeyboardState rank update (line 327): submit another guess
      if (!game.won) {
        const another = target === 'ABOUT' ? 'ZZZZZ' : 'AAAAA';
        for (const ch of another) pressKey(game, ch);
        pressKey(game, 'Enter');
        (game as unknown as { render(): void }).render();
      }
      game.destroy();
    });

    it('renders after winning (post-win render path)', () => {
      const game = makeWordle({ seed: 5, difficulty: 1 });
      const target = game.targetWord;
      for (const ch of target) pressKey(game, ch);
      pressKey(game, 'Enter');
      expect(game.won).toBe(true);
      (game as unknown as { render(): void }).render();
      game.destroy();
    });

    it('update completes the win-delay and fires gameOver (line 217 branch)', () => {
      const onGameOver = vi.fn();
      const game = makeWordle({ seed: 5, difficulty: 1, onGameOver });
      const target = game.targetWord;
      for (const ch of target) pressKey(game, ch);
      pressKey(game, 'Enter');
      expect(game.won).toBe(true);
      // Single large update tick that spans past winDelayTotal, hitting the
      // `if (this.winDelay >= this.winDelayTotal)` branch in update()
      (game as unknown as { update(dt: number): void }).update(2);
      expect(onGameOver).toHaveBeenCalledTimes(1);
      game.destroy();
    });
  });

  // ── Pointer input coverage (lines 407-440) ───────────────────────────────
  describe('Pointer / tap input', () => {
    function tap(game: WordleLike, x: number, y: number): void {
      (game as unknown as { handlePointerDown(x: number, y: number): void }).handlePointerDown(x, y);
    }

    function keyboardRowY(game: WordleLike, row: number): number {
      const g = game as unknown as { kbY: number; kbKeyH: number; kbGap: number };
      return g.kbY + row * (g.kbKeyH + g.kbGap) + g.kbKeyH / 2;
    }

    function rowStartX(game: WordleLike, row: number): number {
      const g = game as unknown as {
        width: number; kbKeyW: number; kbGap: number; kbWideMul: number;
      };
      const keys = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'][row];
      const hasSpecials = row === 2;
      const keyCount = keys.length + (hasSpecials ? 2 : 0);
      const wideExtra = hasSpecials ? 2 * (g.kbWideMul - 1) * g.kbKeyW : 0;
      const totalW = keyCount * g.kbKeyW + (keyCount - 1) * g.kbGap + wideExtra;
      return (g.width - totalW) / 2;
    }

    it('tapping a letter key in row 0 appends that letter', () => {
      const game = makeWordle({ seed: 3, difficulty: 1 });
      const g = game as unknown as { kbKeyW: number };
      const y = keyboardRowY(game, 0);
      const xStart = rowStartX(game, 0);
      // Tap first key (Q)
      tap(game, xStart + g.kbKeyW / 2, y);
      expect(game.currentInput).toBe('Q');
      game.destroy();
    });

    it('tapping a letter key in row 1 appends that letter', () => {
      const game = makeWordle({ seed: 3, difficulty: 1 });
      const g = game as unknown as { kbKeyW: number };
      const y = keyboardRowY(game, 1);
      const xStart = rowStartX(game, 1);
      // Tap third key in row 1 (D)
      tap(game, xStart + g.kbKeyW * 2.5, y);
      expect(game.currentInput).toBe('D');
      game.destroy();
    });

    it('tapping the ENTER special key on row 2 submits a complete guess', () => {
      const game = makeWordle({ seed: 3, difficulty: 1 });
      const target = game.targetWord;
      const wrong = target === 'ABOUT' ? 'HELLO' : 'ABOUT';
      for (const ch of wrong) pressKey(game, ch);
      const g = game as unknown as { kbKeyW: number; kbWideMul: number };
      const y = keyboardRowY(game, 2);
      const xStart = rowStartX(game, 2);
      tap(game, xStart + (g.kbKeyW * g.kbWideMul) / 2, y);
      expect(game.guesses.length).toBe(1);
      expect(game.guesses[0]).toBe(wrong);
      game.destroy();
    });

    it('tapping the ENTER special key on an incomplete guess triggers shake', () => {
      const game = makeWordle({ seed: 3, difficulty: 1 });
      pressKey(game, 'a');
      const g = game as unknown as { kbKeyW: number; kbWideMul: number };
      const y = keyboardRowY(game, 2);
      const xStart = rowStartX(game, 2);
      tap(game, xStart + (g.kbKeyW * g.kbWideMul) / 2, y);
      expect(game.guesses.length).toBe(0);
      expect(game.shake).toBeGreaterThan(0);
      game.destroy();
    });

    it('tapping a letter key inside row 2 (Z/X/.../M) appends that letter', () => {
      const game = makeWordle({ seed: 3, difficulty: 1 });
      const g = game as unknown as { kbKeyW: number; kbGap: number; kbWideMul: number };
      const y = keyboardRowY(game, 2);
      let x = rowStartX(game, 2);
      // Skip the ENTER special key (wider)
      x += g.kbKeyW * g.kbWideMul + g.kbGap;
      // Tap the first letter of row 2 (Z)
      tap(game, x + g.kbKeyW / 2, y);
      expect(game.currentInput).toBe('Z');
      game.destroy();
    });

    it('tapping the DELETE special key on row 2 removes a letter', () => {
      const game = makeWordle({ seed: 3, difficulty: 1 });
      pressKey(game, 'a');
      pressKey(game, 'b');
      expect(game.currentInput).toBe('AB');

      const g = game as unknown as { kbKeyW: number; kbGap: number; kbWideMul: number };
      const y = keyboardRowY(game, 2);
      let x = rowStartX(game, 2);
      // Skip ENTER
      x += g.kbKeyW * g.kbWideMul + g.kbGap;
      // Skip 7 letters of row 2
      x += 7 * (g.kbKeyW + g.kbGap);
      // Tap center of DEL key
      tap(game, x + (g.kbKeyW * g.kbWideMul) / 2, y);
      expect(game.currentInput).toBe('A');
      game.destroy();
    });

    it('tapping outside the keyboard rows is a no-op', () => {
      const game = makeWordle({ seed: 3, difficulty: 1 });
      tap(game, 0, 0);
      tap(game, 10_000, 10_000);
      expect(game.currentInput).toBe('');
      game.destroy();
    });

    it('tapping is ignored when the game is not active', () => {
      const game = makeWordle({ seed: 5, difficulty: 1 });
      // Win to deactivate
      const target = game.targetWord;
      for (const ch of target) pressKey(game, ch);
      pressKey(game, 'Enter');
      (game as unknown as { update(dt: number): void }).update(2); // finalize
      // Tap should be ignored
      const g = game as unknown as { kbKeyW: number };
      const y = keyboardRowY(game, 0);
      tap(game, rowStartX(game, 0) + g.kbKeyW / 2, y);
      // currentInput shouldn't mutate since gameActive is false
      expect(game.currentInput).toBe('');
      game.destroy();
    });
  });

  describe('cursor indicator', () => {
    it('the active row has its next-empty cell tracked via currentInput.length', () => {
      const game = makeWordle();
      // Empty guess — cursor cell is column 0
      expect(game.currentInput.length).toBe(0);

      // Type one letter — cursor advances to column 1
      pressKey(game, 'a');
      expect(game.currentInput.length).toBe(1);

      // Type three more — cursor at column 4 (last before overflow)
      pressKey(game, 'b');
      pressKey(game, 'c');
      pressKey(game, 'd');
      expect(game.currentInput.length).toBe(4);

      // Backspace one — cursor goes back to column 3
      pressKey(game, 'Backspace');
      expect(game.currentInput.length).toBe(3);

      game.destroy();
    });

    it('render() draws the cursor cell border without throwing', () => {
      // The cursor blinks over time; just verify render() is callable at
      // different time slices without hitting any exceptions.
      const game = makeWordle();
      pressKey(game, 'a');
      pressKey(game, 'b');
      const gr = game as unknown as { render(): void };
      // Render multiple times — the cursor phase advances with performance.now()
      expect(() => {
        gr.render();
        gr.render();
        gr.render();
      }).not.toThrow();
      game.destroy();
    });

    it('cursor cell index equals currentInput.length (next empty slot)', () => {
      const game = makeWordle();
      // Before any input, cursor is at column 0
      expect(game.currentInput.length).toBe(0);
      pressKey(game, 'h');
      // Cursor moved to column 1
      expect(game.currentInput.length).toBe(1);
      pressKey(game, 'i');
      expect(game.currentInput.length).toBe(2);
      game.destroy();
    });
  });
});
