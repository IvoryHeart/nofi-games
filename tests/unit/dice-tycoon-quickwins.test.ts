import { describe, it, expect, vi, beforeEach } from 'vitest';

// Storage layer talks to idb-keyval — mock it before importing the storage
// module (same pattern as tests/unit/daily.test.ts).
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import {
  generateDailyTasks,
  applyEvent,
  isComplete,
  allComplete,
  isClaimable,
  claimTask,
  claimDailyBonus,
  completeDay,
  rollToToday,
  claimableCount,
  DAILY_BONUS,
  STREAK_GRAND_PRIZE,
  STREAK_GRAND_PRIZE_DAYS,
  QuickWinState,
  QuickWinTask,
  QuickWinType,
} from '../../src/games/dice-tycoon/quickWins';
import { loadQuickWins, saveQuickWins } from '../../src/storage/quickWins';
import { dailySeed } from '../../src/utils/rng';

/** Build a fresh state with given tasks (test helper). */
function stateWith(tasks: QuickWinTask[], over: Partial<QuickWinState> = {}): QuickWinState {
  return {
    date: '2026-06-17',
    tasks,
    dailyBonusClaimed: false,
    streak: 0,
    bestStreak: 0,
    lastCompletedDate: '',
    grandPrizeClaimed: false,
    ...over,
  };
}

/** Force a state's tasks to all-complete. */
function completeAll(s: QuickWinState): QuickWinState {
  return { ...s, tasks: s.tasks.map((t) => ({ ...t, progress: t.target })) };
}

describe('Quick Wins — daily task generation', () => {
  it('produces exactly 3 tasks for a seed', () => {
    const tasks = generateDailyTasks(20260617);
    expect(tasks).toHaveLength(3);
  });

  it('is deterministic — same seed → identical tasks', () => {
    const a = generateDailyTasks(20260617);
    const b = generateDailyTasks(20260617);
    expect(b).toEqual(a);
  });

  it('picks 3 DISTINCT task types', () => {
    const tasks = generateDailyTasks(20260617);
    const types = new Set(tasks.map((t) => t.type));
    expect(types.size).toBe(3);
  });

  it('different seeds can yield different task sets', () => {
    // Across a spread of seeds, the chosen-type signature should vary.
    const sigs = new Set<string>();
    for (let d = 1; d <= 40; d++) {
      sigs.add(generateDailyTasks(20260600 + d).map((t) => t.type).sort().join(','));
    }
    expect(sigs.size).toBeGreaterThan(1);
  });

  it('every task starts at 0 progress, unclaimed, with a positive target + reward', () => {
    for (const t of generateDailyTasks(20260617)) {
      expect(t.progress).toBe(0);
      expect(t.claimed).toBe(false);
      expect(t.target).toBeGreaterThan(0);
      expect(t.reward.dice + t.reward.coins).toBeGreaterThan(0);
      expect(t.label.length).toBeGreaterThan(0);
    }
  });
});

describe('Quick Wins — applyEvent advances the right counters', () => {
  function taskOf(type: QuickWinType, target = 3): QuickWinTask {
    return { type, label: type, target, progress: 0, reward: { dice: 1, coins: 1 }, claimed: false };
  }

  it('rollN advances on a roll event only', () => {
    let s = stateWith([taskOf('rollN')]);
    s = applyEvent(s, { kind: 'roll' });
    s = applyEvent(s, { kind: 'build' });
    expect(s.tasks[0].progress).toBe(1);
  });

  it('landRailroads advances on a landRailroad event', () => {
    let s = stateWith([taskOf('landRailroads')]);
    s = applyEvent(s, { kind: 'landRailroad' });
    expect(s.tasks[0].progress).toBe(1);
  });

  it('buildLandmark advances by the build count', () => {
    let s = stateWith([taskOf('buildLandmark')]);
    s = applyEvent(s, { kind: 'build', builds: 2 });
    expect(s.tasks[0].progress).toBe(2);
  });

  it('earnCoins accumulates coin deltas', () => {
    let s = stateWith([taskOf('earnCoins', 1000)]);
    s = applyEvent(s, { kind: 'earn', coins: 400 });
    s = applyEvent(s, { kind: 'earn', coins: 700 });
    expect(s.tasks[0].progress).toBe(1000); // clamped at target
  });

  it('completeHeist advances on a heist event', () => {
    let s = stateWith([taskOf('completeHeist')]);
    s = applyEvent(s, { kind: 'heist' });
    expect(s.tasks[0].progress).toBe(1);
  });

  it('passGo advances on a passGo event', () => {
    let s = stateWith([taskOf('passGo')]);
    s = applyEvent(s, { kind: 'passGo' });
    expect(s.tasks[0].progress).toBe(1);
  });

  it('clamps progress at the target and ignores claimed tasks', () => {
    let s = stateWith([taskOf('rollN', 2)]);
    s = applyEvent(s, { kind: 'roll' });
    s = applyEvent(s, { kind: 'roll' });
    s = applyEvent(s, { kind: 'roll' });
    expect(s.tasks[0].progress).toBe(2);
    // Claimed tasks are frozen.
    s = { ...s, tasks: [{ ...s.tasks[0], claimed: true, progress: 1 }] };
    s = applyEvent(s, { kind: 'roll' });
    expect(s.tasks[0].progress).toBe(1);
  });

  it('does not mutate the input state (pure)', () => {
    const s = stateWith([taskOf('rollN')]);
    const out = applyEvent(s, { kind: 'roll' });
    expect(s.tasks[0].progress).toBe(0);
    expect(out).not.toBe(s);
  });
});

describe('Quick Wins — completion predicates', () => {
  it('isComplete reflects progress >= target', () => {
    expect(isComplete({ type: 'rollN', label: '', target: 3, progress: 3, reward: { dice: 0, coins: 0 }, claimed: false })).toBe(true);
    expect(isComplete({ type: 'rollN', label: '', target: 3, progress: 2, reward: { dice: 0, coins: 0 }, claimed: false })).toBe(false);
  });

  it('allComplete is true only when every task is done', () => {
    const tasks = generateDailyTasks(20260617);
    expect(allComplete(tasks)).toBe(false);
    const done = tasks.map((t) => ({ ...t, progress: t.target }));
    expect(allComplete(done)).toBe(true);
    expect(allComplete([])).toBe(false);
  });

  it('isClaimable is true only when complete AND unclaimed', () => {
    const t: QuickWinTask = { type: 'rollN', label: '', target: 1, progress: 1, reward: { dice: 1, coins: 1 }, claimed: false };
    expect(isClaimable(t)).toBe(true);
    expect(isClaimable({ ...t, claimed: true })).toBe(false);
    expect(isClaimable({ ...t, progress: 0 })).toBe(false);
  });
});

describe('Quick Wins — claiming rewards', () => {
  it('claimTask grants the reward once and marks the task claimed', () => {
    let s = stateWith(generateDailyTasks(20260617));
    s = completeAll(s);
    const type = s.tasks[0].type;
    const r1 = claimTask(s, type);
    expect(r1.reward).toEqual(s.tasks[0].reward);
    expect(r1.state.tasks[0].claimed).toBe(true);
    // Re-claim is a no-op.
    const r2 = claimTask(r1.state, type);
    expect(r2.reward).toBeNull();
  });

  it('claimTask refuses an incomplete task', () => {
    const s = stateWith(generateDailyTasks(20260617));
    const r = claimTask(s, s.tasks[0].type);
    expect(r.reward).toBeNull();
  });

  it('claimDailyBonus grants the bonus + advances the streak only when all 3 done', () => {
    let s = stateWith(generateDailyTasks(20260617));
    expect(claimDailyBonus(s).reward).toBeNull(); // not all done
    s = completeAll(s);
    const res = claimDailyBonus(s);
    expect(res.reward).toEqual(DAILY_BONUS);
    expect(res.state.dailyBonusClaimed).toBe(true);
    expect(res.state.streak).toBe(1);
    // Re-claim is a no-op.
    expect(claimDailyBonus(res.state).reward).toBeNull();
  });

  it('claimableCount counts per-task claims + the daily bonus', () => {
    let s = stateWith(generateDailyTasks(20260617));
    expect(claimableCount(s)).toBe(0);
    s = completeAll(s);
    expect(claimableCount(s)).toBe(4); // 3 tasks + bonus
    const after = claimTask(s, s.tasks[0].type).state;
    expect(claimableCount(after)).toBe(3);
  });
});

describe('Quick Wins — streak math', () => {
  it('completeDay bumps the streak on consecutive days', () => {
    let s = stateWith([], { lastCompletedDate: '', streak: 0 });
    s = completeDay(s, '2026-06-17');
    expect(s.streak).toBe(1);
    s = completeDay(s, '2026-06-18');
    expect(s.streak).toBe(2);
    s = completeDay(s, '2026-06-19');
    expect(s.streak).toBe(3);
    expect(s.bestStreak).toBe(3);
  });

  it('completeDay resets the streak after a missed day', () => {
    let s = stateWith([], { lastCompletedDate: '2026-06-17', streak: 3, bestStreak: 3 });
    // Skip the 18th — complete the 19th.
    s = completeDay(s, '2026-06-19');
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(3); // best preserved
  });

  it('completeDay is a no-op when the same day is completed twice', () => {
    let s = stateWith([], { lastCompletedDate: '2026-06-17', streak: 2 });
    s = completeDay(s, '2026-06-17');
    expect(s.streak).toBe(2);
  });

  it('claimDailyBonus surfaces the 7-day grand prize exactly once', () => {
    let s = stateWith([], { lastCompletedDate: '2026-06-16', streak: 6, bestStreak: 6 });
    s = completeAll({ ...s, tasks: generateDailyTasks(1) });
    s = { ...s, date: '2026-06-17' };
    const res = claimDailyBonus(s);
    expect(res.state.streak).toBe(STREAK_GRAND_PRIZE_DAYS);
    expect(res.grandPrize).toEqual(STREAK_GRAND_PRIZE);
    expect(res.state.grandPrizeClaimed).toBe(true);
  });
});

describe('Quick Wins — rollToToday (daily reset)', () => {
  it('creates a fresh first-day state with no prior', () => {
    const s = rollToToday(null, '2026-06-17', 20260617);
    expect(s.date).toBe('2026-06-17');
    expect(s.tasks).toHaveLength(3);
    expect(s.streak).toBe(0);
  });

  it('keeps the same-day state untouched', () => {
    const prev = stateWith(generateDailyTasks(20260617), { streak: 4 });
    const same = rollToToday(prev, '2026-06-17', 20260617);
    expect(same).toBe(prev);
  });

  it('generates fresh tasks on a new day and preserves a continuous streak', () => {
    const prev = stateWith(
      generateDailyTasks(20260616),
      { date: '2026-06-16', streak: 5, bestStreak: 5, lastCompletedDate: '2026-06-16', grandPrizeClaimed: false },
    );
    const next = rollToToday(prev, '2026-06-17', 20260617);
    expect(next.date).toBe('2026-06-17');
    expect(next.tasks).toEqual(generateDailyTasks(20260617));
    expect(next.tasks[0].progress).toBe(0);
    expect(next.streak).toBe(5); // carried (yesterday completed)
    expect(next.dailyBonusClaimed).toBe(false);
  });

  it('breaks the streak when a day was missed', () => {
    const prev = stateWith(
      generateDailyTasks(20260615),
      { date: '2026-06-15', streak: 5, bestStreak: 5, lastCompletedDate: '2026-06-15' },
    );
    // Jump to the 17th — the 16th was missed.
    const next = rollToToday(prev, '2026-06-17', 20260617);
    expect(next.streak).toBe(0);
    expect(next.bestStreak).toBe(5);
    expect(next.grandPrizeClaimed).toBe(false);
  });
});

describe('Quick Wins — storage layer (idb-keyval)', () => {
  beforeEach(() => store.clear());

  it('loadQuickWins generates + persists today on first load', async () => {
    const date = new Date('2026-06-17T10:00:00Z');
    const s = await loadQuickWins(date);
    expect(s.date).toBe('2026-06-17');
    expect(s.tasks).toEqual(generateDailyTasks(dailySeed(date)));
    // Persisted.
    const again = await loadQuickWins(date);
    expect(again.date).toBe('2026-06-17');
  });

  it('saveQuickWins round-trips the state', async () => {
    const date = new Date('2026-06-17T10:00:00Z');
    let s = await loadQuickWins(date);
    s = completeAll(s);
    s = claimDailyBonus(s).state;
    await saveQuickWins(s);
    const loaded = await loadQuickWins(date);
    expect(loaded.dailyBonusClaimed).toBe(true);
    expect(loaded.streak).toBe(1);
  });

  it('rolls to fresh tasks on a calendar-date change, carrying a continuous streak', async () => {
    const day1 = new Date('2026-06-17T10:00:00Z');
    let s = await loadQuickWins(day1);
    s = completeAll(s);
    s = claimDailyBonus(s).state; // streak → 1, lastCompletedDate 2026-06-17
    await saveQuickWins(s);

    const day2 = new Date('2026-06-18T10:00:00Z');
    const next = await loadQuickWins(day2);
    expect(next.date).toBe('2026-06-18');
    expect(next.tasks[0].progress).toBe(0);
    expect(next.streak).toBe(1); // carried (yesterday completed)
    expect(next.dailyBonusClaimed).toBe(false);
  });
});
