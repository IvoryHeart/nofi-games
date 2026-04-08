import { get, set, del, keys } from 'idb-keyval';

/**
 * Per-game daily completion tracking and global streak counter.
 * Backed by IndexedDB via idb-keyval. All operations are offline.
 */

const COMPLETION_PREFIX = 'daily_';
const STREAK_KEY = 'daily_streak';

export interface DailyCompletion {
  gameId: string;
  date: string;       // YYYY-MM-DD (UTC)
  score: number;
  completedAt: string; // ISO timestamp
}

export interface StreakData {
  current: number;
  best: number;
  lastDate: string;   // YYYY-MM-DD of the most recent completion contributing to the streak
}

function key(gameId: string, date: string): string {
  return `${COMPLETION_PREFIX}${gameId}_${date}`;
}

export async function markDailyComplete(
  gameId: string,
  date: string,
  score: number,
): Promise<DailyCompletion> {
  const entry: DailyCompletion = {
    gameId,
    date,
    score,
    completedAt: new Date().toISOString(),
  };
  await set(key(gameId, date), entry);
  return entry;
}

export async function getDailyCompletion(
  gameId: string,
  date: string,
): Promise<DailyCompletion | null> {
  return ((await get(key(gameId, date))) as DailyCompletion | undefined) ?? null;
}

export async function isDailyComplete(gameId: string, date: string): Promise<boolean> {
  return (await get(key(gameId, date))) != null;
}

export async function clearDailyCompletion(gameId: string, date: string): Promise<void> {
  await del(key(gameId, date));
}

export async function getCompletionsForDate(date: string): Promise<DailyCompletion[]> {
  const allKeys = await keys();
  const matching = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(COMPLETION_PREFIX) && k.endsWith(`_${date}`),
  );
  const results: DailyCompletion[] = [];
  for (const k of matching) {
    const v = (await get(k)) as DailyCompletion | undefined;
    if (v) results.push(v);
  }
  return results;
}

export async function getStreak(): Promise<StreakData> {
  return ((await get(STREAK_KEY)) as StreakData | undefined) ?? {
    current: 0,
    best: 0,
    lastDate: '',
  };
}

/**
 * Bump the streak after a successful daily completion.
 * - Same day: no-op (already counted today).
 * - Yesterday: continue the streak (+1).
 * - Older or never: reset to 1.
 */
export async function bumpStreak(today: string): Promise<StreakData> {
  const streak = await getStreak();
  if (streak.lastDate === today) return streak;

  // Compute yesterday's date string in UTC
  const t = new Date(`${today}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  const yesterday = t.toISOString().slice(0, 10);

  if (streak.lastDate === yesterday) {
    streak.current += 1;
  } else {
    streak.current = 1;
  }

  if (streak.current > streak.best) streak.best = streak.current;
  streak.lastDate = today;
  await set(STREAK_KEY, streak);
  return streak;
}

/** Reset the streak (e.g. for a settings "reset progress" action). */
export async function resetStreak(): Promise<void> {
  await set(STREAK_KEY, { current: 0, best: 0, lastDate: '' });
}
