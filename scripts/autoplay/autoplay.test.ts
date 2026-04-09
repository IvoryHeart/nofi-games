/**
 * Auto-play agent — runs locally via `npx vitest run scripts/autoplay/`.
 *
 * Plays each game N times at each difficulty with synthetic inputs and
 * produces a report showing win rates, score distributions, and balance
 * insights. Uses the existing jsdom canvas mock from the test setup.
 *
 * NOT part of the main test suite (`npm test` doesn't include this
 * directory). Run explicitly when you want to evaluate game balance.
 *
 * Usage:
 *   npx vitest run scripts/autoplay/autoplay.test.ts
 *   npx vitest run scripts/autoplay/ --reporter verbose
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock idb-keyval (games import storage modules that depend on it)
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { loadAllGames, getAllGames } from '../../src/games/registry';
import { playGame, bestStrategy, type AutoplayConfig } from './runner';
import { summarize, printReport, type GameReport } from './report';

const ROUNDS_PER_CONFIG = 10;   // games per (game, difficulty) — increase for more signal
const MAX_TICKS = 3000;         // ~50 seconds at 60fps — safety cap
const INPUTS_PER_SECOND = 4;    // how fast the agent acts

beforeAll(async () => {
  await loadAllGames();
});

describe('Auto-play agent', () => {
  const reports: GameReport[] = [];

  it('plays every game at every difficulty and collects results', () => {
    const games = getAllGames();
    const allResults: import('./runner').PlayResult[] = [];

    for (const game of games) {
      const strategy = bestStrategy(game.id);

      for (let diff = 0; diff <= 3; diff++) {
        for (let round = 0; round < ROUNDS_PER_CONFIG; round++) {
          const seed = game.id.charCodeAt(0) * 10000 + diff * 1000 + round;
          const config: AutoplayConfig = {
            game,
            difficulty: diff,
            seed,
            maxTicks: MAX_TICKS,
            inputsPerSecond: INPUTS_PER_SECOND,
            strategy,
          };

          try {
            const result = playGame(config);
            allResults.push(result);
          } catch (err) {
            // Game crashed — record it but don't fail the suite
            console.error(`  💥 ${game.id} diff=${diff} seed=${seed} crashed:`, (err as Error).message);
            allResults.push({
              gameId: game.id,
              difficulty: diff,
              seed,
              score: 0,
              won: false,
              durationMs: 0,
              totalInputs: 0,
              ticksPlayed: 0,
              confusionMoments: 0,
            });
          }
        }
      }
    }

    // Build per-game per-difficulty reports
    const games2 = getAllGames();
    for (const game of games2) {
      for (let diff = 0; diff <= 3; diff++) {
        reports.push(summarize(allResults, game.id, diff));
      }
    }

    // At minimum, we should have played SOME games
    expect(allResults.length).toBeGreaterThan(0);
    expect(reports.length).toBeGreaterThan(0);
  });

  it('prints the balance report', () => {
    printReport(reports);
    // Always passes — the report is the output
    expect(true).toBe(true);
  });

  it('flags any game that crashed during autoplay', () => {
    const crashes = reports.filter((r) => r.crashCount > 0);
    if (crashes.length > 0) {
      console.warn('\n⚠️  Games that crashed during autoplay:');
      for (const c of crashes) {
        console.warn(`  - ${c.gameId} (difficulty ${c.difficulty}): ${c.crashCount} crashes`);
      }
    }
    // Don't fail — just report. Crashes are logged by the runner.
    expect(true).toBe(true);
  });
});
