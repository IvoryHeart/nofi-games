import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import {
  markDailyComplete, getDailyCompletion, isDailyComplete, clearDailyCompletion,
  getCompletionsForDate, getStreak, bumpStreak, resetStreak,
} from '../../src/storage/daily';

beforeEach(() => {
  store.clear();
});

describe('daily completion', () => {
  it('markDailyComplete writes a completion entry', async () => {
    const entry = await markDailyComplete('wordle', '2026-04-08', 350);
    expect(entry.gameId).toBe('wordle');
    expect(entry.date).toBe('2026-04-08');
    expect(entry.score).toBe(350);
    expect(entry.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('getDailyCompletion reads back what was written', async () => {
    await markDailyComplete('nonogram', '2026-04-08', 100);
    const c = await getDailyCompletion('nonogram', '2026-04-08');
    expect(c).not.toBeNull();
    expect(c?.score).toBe(100);
  });

  it('getDailyCompletion returns null for missing entries', async () => {
    expect(await getDailyCompletion('wordle', '2026-04-08')).toBeNull();
  });

  it('isDailyComplete reflects completion status', async () => {
    expect(await isDailyComplete('wordle', '2026-04-08')).toBe(false);
    await markDailyComplete('wordle', '2026-04-08', 1);
    expect(await isDailyComplete('wordle', '2026-04-08')).toBe(true);
  });

  it('clearDailyCompletion removes an entry', async () => {
    await markDailyComplete('wordle', '2026-04-08', 100);
    expect(await isDailyComplete('wordle', '2026-04-08')).toBe(true);
    await clearDailyCompletion('wordle', '2026-04-08');
    expect(await isDailyComplete('wordle', '2026-04-08')).toBe(false);
  });

  it('different game / date combinations are isolated', async () => {
    await markDailyComplete('wordle', '2026-04-08', 100);
    expect(await isDailyComplete('wordle', '2026-04-09')).toBe(false);
    expect(await isDailyComplete('nonogram', '2026-04-08')).toBe(false);
  });

  it('overwriting a completion replaces the old entry', async () => {
    await markDailyComplete('wordle', '2026-04-08', 100);
    await markDailyComplete('wordle', '2026-04-08', 200);
    const c = await getDailyCompletion('wordle', '2026-04-08');
    expect(c?.score).toBe(200);
  });
});

describe('getCompletionsForDate', () => {
  it('returns all games completed on a given date', async () => {
    await markDailyComplete('wordle', '2026-04-08', 100);
    await markDailyComplete('nonogram', '2026-04-08', 200);
    await markDailyComplete('mastermind', '2026-04-08', 300);
    await markDailyComplete('wordle', '2026-04-09', 400); // different day

    const today = await getCompletionsForDate('2026-04-08');
    expect(today.length).toBe(3);
    const ids = today.map((c) => c.gameId).sort();
    expect(ids).toEqual(['mastermind', 'nonogram', 'wordle']);
  });

  it('returns empty array when nothing was completed', async () => {
    expect(await getCompletionsForDate('2026-04-08')).toEqual([]);
  });
});

describe('streak', () => {
  it('returns zero streak when nothing has been recorded', async () => {
    const s = await getStreak();
    expect(s).toEqual({ current: 0, best: 0, lastDate: '' });
  });

  it('first bump initializes streak to 1', async () => {
    const s = await bumpStreak('2026-04-08');
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
    expect(s.lastDate).toBe('2026-04-08');
  });

  it('bumping the same day twice does not double-count', async () => {
    await bumpStreak('2026-04-08');
    const s = await bumpStreak('2026-04-08');
    expect(s.current).toBe(1);
  });

  it('bumping consecutive days continues the streak', async () => {
    await bumpStreak('2026-04-08');
    await bumpStreak('2026-04-09');
    const s = await bumpStreak('2026-04-10');
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });

  it('skipping a day resets the streak to 1', async () => {
    await bumpStreak('2026-04-08');
    await bumpStreak('2026-04-09');
    // Skip 2026-04-10
    const s = await bumpStreak('2026-04-11');
    expect(s.current).toBe(1);
    expect(s.best).toBe(2); // best is preserved
  });

  it('best is preserved across resets', async () => {
    await bumpStreak('2026-04-01');
    await bumpStreak('2026-04-02');
    await bumpStreak('2026-04-03');
    await bumpStreak('2026-04-04');
    // Best is now 4
    await bumpStreak('2026-04-08'); // skip → reset to 1
    const s = await getStreak();
    expect(s.current).toBe(1);
    expect(s.best).toBe(4);
  });

  it('crossing month boundaries works', async () => {
    await bumpStreak('2026-03-31');
    const s = await bumpStreak('2026-04-01');
    expect(s.current).toBe(2);
  });

  it('crossing year boundaries works', async () => {
    await bumpStreak('2026-12-31');
    const s = await bumpStreak('2027-01-01');
    expect(s.current).toBe(2);
  });

  it('resetStreak zeroes everything', async () => {
    await bumpStreak('2026-04-08');
    await bumpStreak('2026-04-09');
    await resetStreak();
    const s = await getStreak();
    expect(s).toEqual({ current: 0, best: 0, lastDate: '' });
  });
});
