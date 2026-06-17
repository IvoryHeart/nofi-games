import { get, set } from 'idb-keyval';

import { dailySeed, todayDateString } from '../utils/rng';
import {
  QuickWinState,
  rollToToday,
} from '../games/dice-tycoon/quickWins';

/**
 * Persistence for Dice Tycoon Quick Wins (daily tasks + streak).
 *
 * Backed by IndexedDB via idb-keyval — fully offline. A single key holds the
 * whole Quick Wins state (today's 3 tasks + progress + claimed flags + the
 * streak counter). On load we ROLL the persisted state to the current UTC day:
 * a new calendar date generates fresh seeded tasks and either preserves the
 * streak (if yesterday was completed) or resets it (a missed day). Mirrors the
 * date-keyed pattern in src/storage/daily.ts.
 */

const QUICKWINS_KEY = 'tycoon_quickwins';

/** Load today's Quick Wins state, generating/rolling it forward as needed.
 *  Always returns a state whose `date` is today's UTC date. Persists if the
 *  roll produced a new day (so the fresh tasks + streak transition stick). */
export async function loadQuickWins(date: Date = new Date()): Promise<QuickWinState> {
  const today = todayDateString(date);
  const seed = dailySeed(date);
  const prev = ((await get(QUICKWINS_KEY)) as QuickWinState | undefined) ?? null;
  const rolled = rollToToday(sanitize(prev), today, seed);
  // Persist if the date advanced (fresh tasks / streak transition) so a reload
  // doesn't regenerate-and-diverge. Cheap idempotent write.
  if (!prev || prev.date !== today) {
    await set(QUICKWINS_KEY, rolled);
  }
  return rolled;
}

/** Persist the current Quick Wins state (after applyEvent / a claim). */
export async function saveQuickWins(state: QuickWinState): Promise<void> {
  await set(QUICKWINS_KEY, state);
}

/** Defensive sanitize of a persisted blob: drop anything not shaped like a
 *  QuickWinState so a corrupt/legacy value can't crash the roll. */
function sanitize(s: QuickWinState | null): QuickWinState | null {
  if (!s || typeof s !== 'object') return null;
  if (typeof s.date !== 'string' || !Array.isArray(s.tasks)) return null;
  return s;
}
