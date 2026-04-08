import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

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

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(opts: {
  width?: number;
  height?: number;
  difficulty?: number;
  seed?: number;
  onScore?: (s: number) => void;
  onGameOver?: (s: number) => void;
  onWin?: (s: number) => void;
} = {}): GameConfig {
  return {
    canvas: document.createElement('canvas'),
    width: opts.width ?? 360,
    height: opts.height ?? 640,
    difficulty: opts.difficulty ?? 1,
    seed: opts.seed,
    onScore: opts.onScore,
    onGameOver: opts.onGameOver,
    onWin: opts.onWin,
  };
}

// Reach into private state via this typed shape — keeps strict typing while
// exposing the internals the tests need to drive.
type MastermindLike = GameEngine & {
  code: number[];
  guesses: number[][];
  feedback: { black: number; white: number }[];
  currentRow: number[];
  pegCount: number;
  colorCount: number;
  maxAttempts: number;
  gameActive: boolean;
  codeRevealed: boolean;
  computeFeedback(guess: number[]): { black: number; white: number };
  submitGuess(): void;
  addColorToRow(color: number): void;
  clearCurrentRow(): void;
};

function makeMastermind(opts: Parameters<typeof makeConfig>[0] = {}): MastermindLike {
  const info = getGame('mastermind')!;
  const game = info.createGame(makeConfig(opts)) as unknown as MastermindLike;
  game.start();
  return game;
}

beforeAll(async () => {
  store.clear();
  await loadAllGames();
});

beforeEach(() => {
  // Use real timers by default; specific tests will switch when needed.
  vi.useRealTimers();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Mastermind', () => {

  describe('Registration', () => {
    it('is registered in the registry', () => {
      expect(getGame('mastermind')).toBeDefined();
    });

    it('has the expected metadata', () => {
      const info = getGame('mastermind')!;
      expect(info.id).toBe('mastermind');
      expect(info.name).toBe('Mastermind');
      expect(info.category).toBe('puzzle');
      expect(info.dailyMode).toBe(true);
      expect(info.canvasWidth).toBe(360);
      expect(info.canvasHeight).toBe(640);
      expect(info.controls).toContain('Tap');
      expect(info.bgGradient).toEqual(['#704F9C', '#9F7BC9']);
    });
  });

  describe('Instantiation at all difficulties', () => {
    it('instantiates at all 4 difficulties without throwing', () => {
      const info = getGame('mastermind')!;
      for (let d = 0; d <= 3; d++) {
        const game = info.createGame(makeConfig({ difficulty: d }));
        expect(game).toBeInstanceOf(GameEngine);
        game.destroy();
      }
    });

    it('produces difficulty-appropriate peg counts and palette sizes', () => {
      const expected = [
        { pegCount: 4, colorCount: 6, maxAttempts: 12 }, // Easy
        { pegCount: 4, colorCount: 6, maxAttempts: 10 }, // Medium
        { pegCount: 5, colorCount: 7, maxAttempts: 10 }, // Hard
        { pegCount: 5, colorCount: 8, maxAttempts: 8 },  // Extra Hard
      ];
      for (let d = 0; d <= 3; d++) {
        const game = makeMastermind({ difficulty: d, seed: 42 });
        expect(game.pegCount).toBe(expected[d].pegCount);
        expect(game.colorCount).toBe(expected[d].colorCount);
        expect(game.maxAttempts).toBe(expected[d].maxAttempts);
        expect(game.code.length).toBe(expected[d].pegCount);
        // Every code peg must be a valid color index
        for (const c of game.code) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(expected[d].colorCount);
        }
        game.destroy();
      }
    });
  });

  describe('Lifecycle', () => {
    it('completes start → update → render → destroy without throwing', () => {
      const game = makeMastermind({ seed: 7 });
      expect(() => {
        (game as unknown as { update: (dt: number) => void }).update(0.016);
        (game as unknown as { render: () => void }).render();
        (game as unknown as { update: (dt: number) => void }).update(0.016);
        (game as unknown as { render: () => void }).render();
        game.destroy();
      }).not.toThrow();
    });

    it('handles small canvas dimensions gracefully (100x100)', () => {
      const info = getGame('mastermind')!;
      expect(() => {
        const g = info.createGame(makeConfig({ width: 100, height: 100 }));
        g.start();
        (g as unknown as { update: (dt: number) => void }).update(0.016);
        (g as unknown as { render: () => void }).render();
        g.destroy();
      }).not.toThrow();
    });
  });

  describe('computeFeedback', () => {
    // We test the algorithm directly via a fresh game with a known code.
    // Use seeded init then overwrite code/pegCount to test specific scenarios.
    function withCode(code: number[], colorCount = 8): MastermindLike {
      const game = makeMastermind({ seed: 1, difficulty: 3 });
      game.code = code.slice();
      game.pegCount = code.length;
      game.colorCount = colorCount;
      return game;
    }

    it('all correct → black=N, white=0', () => {
      const game = withCode([0, 1, 2, 3]);
      const fb = game.computeFeedback([0, 1, 2, 3]);
      expect(fb.black).toBe(4);
      expect(fb.white).toBe(0);
      game.destroy();
    });

    it('all wrong colors → 0 black, 0 white', () => {
      const game = withCode([0, 0, 0, 0]);
      const fb = game.computeFeedback([1, 1, 1, 1]);
      expect(fb.black).toBe(0);
      expect(fb.white).toBe(0);
      game.destroy();
    });

    it('correct color in wrong position → white peg', () => {
      // Code = [0,1,2,3], guess = [1,0,3,2] — every color is present but
      // none in the right slot.
      const game = withCode([0, 1, 2, 3]);
      const fb = game.computeFeedback([1, 0, 3, 2]);
      expect(fb.black).toBe(0);
      expect(fb.white).toBe(4);
      game.destroy();
    });

    it('mixed: 1 black + 1 white + 2 absent', () => {
      // Code = [0,1,2,3], guess = [0,2,4,5]
      //   pos 0: 0==0 → black
      //   pos 1: 2 vs 1 — but 2 exists in code at pos 2 → white
      //   pos 2,3: 4,5 not in code → nothing
      const game = withCode([0, 1, 2, 3]);
      const fb = game.computeFeedback([0, 2, 4, 5]);
      expect(fb.black).toBe(1);
      expect(fb.white).toBe(1);
      game.destroy();
    });

    it('handles duplicates correctly: guess [1,1,2,3] vs code [1,2,2,3]', () => {
      // Position 0: 1==1 → black
      // Position 1: 1 vs 2 → guessLeft[1]++, codeLeft[2]++
      // Position 2: 2==2 → black
      // Position 3: 3==3 → black
      // White = min(guessLeft[1]=1, codeLeft[1]=0) + min(guessLeft[2]=0, codeLeft[2]=1) = 0
      const game = withCode([1, 2, 2, 3]);
      const fb = game.computeFeedback([1, 1, 2, 3]);
      expect(fb.black).toBe(3);
      expect(fb.white).toBe(0);
      game.destroy();
    });

    it('handles duplicates correctly: guess [0,0,1,1] vs code [0,1,0,2]', () => {
      // Pos 0: 0==0 → black
      // Pos 1: 0 vs 1 → guessLeft[0]++, codeLeft[1]++
      // Pos 2: 1 vs 0 → guessLeft[1]++, codeLeft[0]++
      // Pos 3: 1 vs 2 → guessLeft[1]++, codeLeft[2]++
      // White = min(g[0]=1, c[0]=1) + min(g[1]=2, c[1]=1) + min(g[2]=0, c[2]=1) = 1 + 1 + 0 = 2
      const game = withCode([0, 1, 0, 2]);
      const fb = game.computeFeedback([0, 0, 1, 1]);
      expect(fb.black).toBe(1);
      expect(fb.white).toBe(2);
      game.destroy();
    });

    it('does not double-count when guess has more duplicates than code', () => {
      // Code = [3,3,3,4], guess = [3,3,3,3]
      // Pos 0,1,2: black → 3 black
      // Pos 3: 3 vs 4 → guessLeft[3]++, codeLeft[4]++
      // White = min(1, 0) = 0
      const game = withCode([3, 3, 3, 4]);
      const fb = game.computeFeedback([3, 3, 3, 3]);
      expect(fb.black).toBe(3);
      expect(fb.white).toBe(0);
      game.destroy();
    });
  });

  describe('Submitting guesses', () => {
    it('submitting an incomplete row does nothing', () => {
      const game = makeMastermind({ seed: 5 });
      game.addColorToRow(0);
      game.addColorToRow(1);
      // Row only has 2 of pegCount pegs filled
      expect(game.currentRow.length).toBe(2);
      const guessesBefore = game.guesses.length;
      game.submitGuess();
      expect(game.guesses.length).toBe(guessesBefore);
      // Current row preserved
      expect(game.currentRow.length).toBe(2);
      game.destroy();
    });

    it('submitting a correct guess fires onWin', () => {
      vi.useFakeTimers();
      const onWin = vi.fn();
      const game = makeMastermind({ seed: 5, onWin });
      const target = game.code.slice();
      for (const c of target) game.addColorToRow(c);
      game.submitGuess();
      expect(game.guesses.length).toBe(1);
      expect(game.feedback[0].black).toBe(game.pegCount);
      expect(game.feedback[0].white).toBe(0);
      expect(onWin).toHaveBeenCalledTimes(1);
      // Score should be the max bonus (attemptsUsed=1)
      const expectedBonus = 100 * (game.maxAttempts - 1 + 1);
      expect(onWin.mock.calls[0][0]).toBe(expectedBonus);
      // Game should be marked inactive immediately, then gameOver triggers after 1500ms
      expect(game.gameActive).toBe(false);
      vi.advanceTimersByTime(1600);
      vi.useRealTimers();
      game.destroy();
    });

    it('submitting wrong guesses uses up attempts', () => {
      const game = makeMastermind({ seed: 5 });
      // Build a guess that is guaranteed wrong: use a color that doesn't match
      // the first slot of the code, repeated.
      const wrong = (game.code[0] + 1) % game.colorCount;
      for (let n = 0; n < 3; n++) {
        for (let i = 0; i < game.pegCount; i++) game.addColorToRow(wrong);
        game.submitGuess();
      }
      expect(game.guesses.length).toBe(3);
      expect(game.gameActive).toBe(true);
      game.destroy();
    });

    it('running out of attempts ends the game without winning', () => {
      vi.useFakeTimers();
      const onWin = vi.fn();
      const onGameOver = vi.fn();
      const game = makeMastermind({ seed: 99, difficulty: 1, onWin, onGameOver });
      // Build a guess that is guaranteed not to match the entire code:
      // shift every code peg by 1 modulo colorCount. This ensures pos[0] differs.
      // To make it surely never match, use a pattern that swaps adjacent values.
      const wrongGuess: number[] = [];
      for (let i = 0; i < game.pegCount; i++) {
        wrongGuess.push((game.code[i] + 1) % game.colorCount);
      }
      // Verify our wrongGuess truly differs from code in every position
      let allDiffer = true;
      for (let i = 0; i < game.pegCount; i++) {
        if (wrongGuess[i] === game.code[i]) { allDiffer = false; break; }
      }
      expect(allDiffer).toBe(true);

      for (let n = 0; n < game.maxAttempts; n++) {
        for (const c of wrongGuess) game.addColorToRow(c);
        game.submitGuess();
      }
      expect(game.guesses.length).toBe(game.maxAttempts);
      expect(game.gameActive).toBe(false);
      expect(game.codeRevealed).toBe(true);
      expect(onWin).not.toHaveBeenCalled();
      // After the reveal delay, gameOver should fire
      vi.advanceTimersByTime(1600);
      expect(onGameOver).toHaveBeenCalled();
      vi.useRealTimers();
      game.destroy();
    });
  });

  describe('Daily mode determinism', () => {
    it('same seed produces the same code at the same difficulty', () => {
      const a = makeMastermind({ seed: 12345, difficulty: 2 });
      const b = makeMastermind({ seed: 12345, difficulty: 2 });
      expect(a.code).toEqual(b.code);
      a.destroy();
      b.destroy();
    });

    it('different seeds usually produce different codes', () => {
      const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const codes = seeds.map(s => {
        const g = makeMastermind({ seed: s, difficulty: 3 });
        const c = g.code.slice();
        g.destroy();
        return JSON.stringify(c);
      });
      const unique = new Set(codes);
      // We allow some collisions but at least most should differ.
      expect(unique.size).toBeGreaterThan(seeds.length / 2);
    });
  });

  describe('Serialize / Deserialize', () => {
    it('round-trips guesses, feedback, and code', () => {
      const game = makeMastermind({ seed: 42, difficulty: 1 });
      // Make one wrong guess (so we have something in the history)
      const wrong = (game.code[0] + 1) % game.colorCount;
      for (let i = 0; i < game.pegCount; i++) game.addColorToRow(wrong);
      game.submitGuess();
      const snap = game.serialize();
      const originalCode = game.code.slice();
      const originalGuesses = game.guesses.map(g => g.slice());
      const originalFeedback = game.feedback.map(f => ({ ...f }));
      game.destroy();

      // Now restore in a fresh game instance
      const restored = makeMastermind({ seed: 42, difficulty: 1 });
      restored.deserialize(snap);
      expect(restored.code).toEqual(originalCode);
      expect(restored.guesses).toEqual(originalGuesses);
      expect(restored.feedback).toEqual(originalFeedback);
      expect(restored.pegCount).toBe(4);
      expect(restored.colorCount).toBe(6);
      expect(restored.maxAttempts).toBe(10);
      restored.destroy();
    });

    it('canSave is true during play and false once game is over', () => {
      vi.useFakeTimers();
      const game = makeMastermind({ seed: 123, difficulty: 1 });
      expect(game.canSave()).toBe(true);

      // Win the game in one shot
      for (const c of game.code) game.addColorToRow(c);
      game.submitGuess();
      expect(game.canSave()).toBe(false);
      vi.advanceTimersByTime(1600);
      vi.useRealTimers();
      game.destroy();
    });

    it('deserialize is defensive against malformed state', () => {
      const game = makeMastermind({ seed: 1, difficulty: 1 });
      const originalCode = game.code.slice();

      // Throw a bag of garbage at it
      expect(() => game.deserialize({} as Record<string, unknown>)).not.toThrow();
      expect(() => game.deserialize({ guesses: 'not an array' } as unknown as Record<string, unknown>)).not.toThrow();
      expect(() => game.deserialize({ code: 'nope', guesses: null } as unknown as Record<string, unknown>)).not.toThrow();
      expect(() => game.deserialize({
        code: [99, 99, 99, 99],
        guesses: [[1, 2, 3]], // wrong length — should be filtered out
        feedback: [{ black: 1, white: 0 }],
        currentRow: ['x', 'y', null], // bad types — should be filtered
        pegCount: 4,
        colorCount: 6,
        maxAttempts: 10,
      } as unknown as Record<string, unknown>)).not.toThrow();

      // After garbage, the game should still be operable
      expect(() => {
        (game as unknown as { update: (dt: number) => void }).update(0.016);
        (game as unknown as { render: () => void }).render();
      }).not.toThrow();

      // Sanity: feeding a totally empty object leaves a usable game
      const game2 = makeMastermind({ seed: 7, difficulty: 0 });
      const code2 = game2.code.slice();
      game2.deserialize({} as Record<string, unknown>);
      // Code should be unchanged because the empty payload had no `code`
      expect(game2.code).toEqual(code2);
      game2.destroy();

      void originalCode;
      game.destroy();
    });
  });
});
