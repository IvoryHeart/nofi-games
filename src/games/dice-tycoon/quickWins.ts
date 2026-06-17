/**
 * Dice Tycoon — Quick Wins daily tasks (pure logic).
 *
 * Three seeded daily tasks + a 7-day streak grand prize. Everything here is a
 * PURE function of its arguments — no DOM, no canvas, no timers, no Math.random.
 * Tasks are SEEDED from the calendar date (via dailySeed()) so every player gets
 * the same 3 tasks on the same UTC day, fully offline.
 *
 * The game feeds events (derived from the same activity-feed events TycoonCore
 * emits through the Pixi view) into `applyEvent()` which advances task counters.
 * The storage layer (src/storage/quickWins.ts) persists progress + the streak,
 * mirroring src/storage/daily.ts.
 *
 * Determinism: generation consumes a fixed number of mulberry32 draws from the
 * date seed; the chosen set + targets are identical for the same seed.
 */

import { mulberry32 } from '../../utils/rng';

/** The kinds of daily task a player can be assigned. */
export type QuickWinType =
  | 'rollN'          // roll the dice N times
  | 'landRailroads'  // land on Depot/Heist (railroad) tiles N times
  | 'buildLandmark'  // build N landmarks
  | 'earnCoins'      // earn N coins from payouts (property/salary/parking/cards)
  | 'completeHeist'  // resolve N heists (vault picks)
  | 'passGo';        // pass/land on GO N times (collect salary)

/** A single daily task: a target to reach + the reward for completing it. */
export interface QuickWinTask {
  /** Stable id within a day (the task type — at most one of each per day). */
  type: QuickWinType;
  /** Human label for the UI. */
  label: string;
  /** Target count to complete the task. */
  target: number;
  /** Current progress (0..target). */
  progress: number;
  /** Reward granted when this task is claimed. */
  reward: QuickWinReward;
  /** True once the player has claimed this task's reward. */
  claimed: boolean;
}

/** A claimable reward (dice and/or coins). */
export interface QuickWinReward {
  dice: number;
  coins: number;
}

/** The full Quick Wins state for one day + the running streak. */
export interface QuickWinState {
  /** UTC date string (YYYY-MM-DD) these tasks belong to. */
  date: string;
  /** The day's 3 tasks (distinct types). */
  tasks: QuickWinTask[];
  /** True once the all-3-complete daily bonus has been claimed. */
  dailyBonusClaimed: boolean;
  /** Consecutive-day completion streak (days all-3-completed in a row). */
  streak: number;
  /** Best streak ever reached. */
  bestStreak: number;
  /** Last UTC date the all-3 daily bonus was claimed (drives streak math). */
  lastCompletedDate: string;
  /** True once the 7-day streak grand prize has been claimed (per streak run). */
  grandPrizeClaimed: boolean;
}

/** The all-3-complete daily bonus (granted once per day on top of per-task). */
export const DAILY_BONUS: QuickWinReward = { dice: 5, coins: 1000 };

/** The 7-day streak grand prize (granted when the streak first hits 7). */
export const STREAK_GRAND_PRIZE: QuickWinReward = { dice: 25, coins: 10000 };

/** The streak length that unlocks the grand prize. */
export const STREAK_GRAND_PRIZE_DAYS = 7;

/** Static catalogue of every task type, its label template + target/reward
 *  tiers. generateDailyTasks() seeds a target + reward from these tiers. */
interface TaskDef {
  type: QuickWinType;
  /** label(target) → display string. */
  label: (target: number) => string;
  /** Candidate targets (seed picks one). */
  targets: number[];
  /** Reward scales with the chosen target index (parallel to `targets`). */
  rewards: QuickWinReward[];
}

const TASK_DEFS: TaskDef[] = [
  {
    type: 'rollN',
    label: (n) => `Roll the dice ${n} times`,
    targets: [5, 8, 12],
    rewards: [{ dice: 2, coins: 200 }, { dice: 3, coins: 350 }, { dice: 5, coins: 600 }],
  },
  {
    type: 'landRailroads',
    label: (n) => `Land on ${n} Depot${n > 1 ? 's' : ''} (Heist)`,
    targets: [1, 2, 3],
    rewards: [{ dice: 2, coins: 150 }, { dice: 3, coins: 300 }, { dice: 4, coins: 500 }],
  },
  {
    type: 'buildLandmark',
    label: (n) => `Build ${n} landmark${n > 1 ? 's' : ''}`,
    targets: [1, 2, 3],
    rewards: [{ dice: 3, coins: 250 }, { dice: 4, coins: 450 }, { dice: 6, coins: 750 }],
  },
  {
    type: 'earnCoins',
    label: (n) => `Earn ${n.toLocaleString()} coins`,
    targets: [1000, 2500, 5000],
    rewards: [{ dice: 2, coins: 200 }, { dice: 3, coins: 400 }, { dice: 5, coins: 700 }],
  },
  {
    type: 'completeHeist',
    label: (n) => `Pull off ${n} heist${n > 1 ? 's' : ''}`,
    targets: [1, 2, 3],
    rewards: [{ dice: 3, coins: 300 }, { dice: 4, coins: 500 }, { dice: 6, coins: 800 }],
  },
  {
    type: 'passGo',
    label: (n) => `Pass GO ${n} time${n > 1 ? 's' : ''}`,
    targets: [2, 4, 6],
    rewards: [{ dice: 2, coins: 200 }, { dice: 3, coins: 350 }, { dice: 4, coins: 550 }],
  },
];

/** Clamp to a finite non-negative integer. */
function nn(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Deterministically pick 3 DISTINCT tasks for the day from a date seed.
 *
 * Same `dateSeed` → same 3 tasks (type, target, reward) on every device. Uses a
 * seeded mulberry32 to shuffle the task catalogue, take the first 3, then seed a
 * target tier per task. Targets/rewards are stable for the seed.
 */
export function generateDailyTasks(dateSeed: number): QuickWinTask[] {
  const rng = mulberry32((dateSeed >>> 0) ^ 0x7a5c0001);
  // Fisher–Yates over a copy of the catalogue indices (seeded, deterministic).
  const order = TASK_DEFS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const chosen = order.slice(0, 3);
  return chosen.map((idx) => {
    const def = TASK_DEFS[idx];
    const tier = Math.min(def.targets.length - 1, Math.floor(rng() * def.targets.length));
    const target = def.targets[tier];
    return {
      type: def.type,
      label: def.label(target),
      target,
      progress: 0,
      reward: { ...def.rewards[tier] },
      claimed: false,
    };
  });
}

/**
 * A minimal projection of a game event Quick Wins counts. Mirrors the shape of
 * the data the game already produces (land/build/roll results) so the wiring can
 * feed it directly. Only the fields each kind needs are read.
 */
export interface QuickWinEvent {
  kind: 'roll' | 'passGo' | 'landRailroad' | 'build' | 'earn' | 'heist';
  /** Coins earned (for 'earn'); positive payouts only. */
  coins?: number;
  /** Number of landmarks built in this event (for 'build'). Defaults to 1. */
  builds?: number;
}

/**
 * Advance task progress from a single game event. PURE: returns a NEW state
 * (does not mutate the input) so callers can persist the result. Already-claimed
 * tasks and tasks at/over target are left untouched (clamped at target).
 */
export function applyEvent(state: QuickWinState, event: QuickWinEvent): QuickWinState {
  const tasks = state.tasks.map((t) => {
    if (t.claimed || t.progress >= t.target) return t;
    const inc = incrementFor(t.type, event);
    if (inc <= 0) return t;
    return { ...t, progress: Math.min(t.target, t.progress + inc) };
  });
  return { ...state, tasks };
}

/** How much a given event advances a given task type. */
function incrementFor(type: QuickWinType, event: QuickWinEvent): number {
  switch (type) {
    case 'rollN':
      return event.kind === 'roll' ? 1 : 0;
    case 'passGo':
      return event.kind === 'passGo' ? 1 : 0;
    case 'landRailroads':
      return event.kind === 'landRailroad' ? 1 : 0;
    case 'buildLandmark':
      return event.kind === 'build' ? Math.max(1, nn(event.builds ?? 1)) : 0;
    case 'earnCoins':
      return event.kind === 'earn' ? nn(event.coins ?? 0) : 0;
    case 'completeHeist':
      return event.kind === 'heist' ? 1 : 0;
    default:
      return 0;
  }
}

/** True if a task has reached its target. */
export function isComplete(task: QuickWinTask): boolean {
  return task.progress >= task.target;
}

/** True if ALL of the day's tasks are complete. */
export function allComplete(tasks: QuickWinTask[]): boolean {
  return tasks.length > 0 && tasks.every(isComplete);
}

/** True if a task is complete AND not yet claimed (a claimable reward waits). */
export function isClaimable(task: QuickWinTask): boolean {
  return !task.claimed && isComplete(task);
}

/**
 * Claim a single completed task's reward. PURE: returns the new state + the
 * granted reward (null if the task wasn't claimable). The caller applies the
 * reward to the game (coins/dice) + persists.
 */
export function claimTask(
  state: QuickWinState,
  type: QuickWinType,
): { state: QuickWinState; reward: QuickWinReward | null } {
  const idx = state.tasks.findIndex((t) => t.type === type);
  if (idx < 0) return { state, reward: null };
  const task = state.tasks[idx];
  if (!isClaimable(task)) return { state, reward: null };
  const tasks = state.tasks.slice();
  tasks[idx] = { ...task, claimed: true };
  return { state: { ...state, tasks }, reward: { ...task.reward } };
}

/**
 * Claim the all-3-complete daily bonus. PURE. Returns the granted reward + the
 * new state with `dailyBonusClaimed` set. Bumps the streak (and surfaces the
 * 7-day grand prize) via `completeDay()`. No-op (reward null) unless all 3 tasks
 * are complete and the bonus hasn't already been claimed today.
 */
export function claimDailyBonus(
  state: QuickWinState,
): { state: QuickWinState; reward: QuickWinReward | null; grandPrize: QuickWinReward | null } {
  if (state.dailyBonusClaimed || !allComplete(state.tasks)) {
    return { state, reward: null, grandPrize: null };
  }
  const advanced = completeDay({ ...state, dailyBonusClaimed: true }, state.date);
  let grandPrize: QuickWinReward | null = null;
  let next = advanced;
  if (next.streak >= STREAK_GRAND_PRIZE_DAYS && !next.grandPrizeClaimed) {
    grandPrize = { ...STREAK_GRAND_PRIZE };
    next = { ...next, grandPrizeClaimed: true };
  }
  return { state: next, reward: { ...DAILY_BONUS }, grandPrize };
}

/**
 * Advance the streak after a day's all-3 completion. Mirrors storage/daily.ts
 * bumpStreak semantics but as a PURE function over the state:
 *  - same day already completed: no-op
 *  - yesterday was the last completed day: streak += 1
 *  - older / never: streak resets to 1 (fresh run → grandPrizeClaimed cleared)
 */
export function completeDay(state: QuickWinState, today: string): QuickWinState {
  if (state.lastCompletedDate === today) return state;
  const yesterday = prevDate(today);
  let streak: number;
  let grandPrizeClaimed = state.grandPrizeClaimed;
  if (state.lastCompletedDate === yesterday) {
    streak = state.streak + 1;
  } else {
    // A missed day (or first ever) restarts the run — grand prize re-arms.
    streak = 1;
    grandPrizeClaimed = false;
  }
  const bestStreak = Math.max(state.bestStreak, streak);
  return { ...state, streak, bestStreak, lastCompletedDate: today, grandPrizeClaimed };
}

/** Previous UTC calendar day for a YYYY-MM-DD string. */
function prevDate(date: string): string {
  const t = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return '';
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

/**
 * Roll the persisted state forward to `today` with `dateSeed`. This is the
 * single entry point the storage layer uses on load:
 *  - same date: keep the day's tasks/progress as-is
 *  - new date: fresh tasks for the seed; if `today` is NOT consecutive with the
 *    last all-3 completion, the streak resets (a missed day), otherwise it's
 *    preserved (the streak only ADVANCES on an actual all-3 completion).
 */
export function rollToToday(
  prev: QuickWinState | null,
  today: string,
  dateSeed: number,
): QuickWinState {
  if (prev && prev.date === today) return prev;

  const tasks = generateDailyTasks(dateSeed);

  // No prior state → a clean first day.
  if (!prev) {
    return {
      date: today,
      tasks,
      dailyBonusClaimed: false,
      streak: 0,
      bestStreak: 0,
      lastCompletedDate: '',
      grandPrizeClaimed: false,
    };
  }

  // New day: carry the streak ONLY if yesterday was the last completed day;
  // a gap means the streak is broken (collapses to 0, grand prize re-arms).
  const yesterday = prevDate(today);
  const continuous = prev.lastCompletedDate === yesterday || prev.lastCompletedDate === today;
  return {
    date: today,
    tasks,
    dailyBonusClaimed: false,
    streak: continuous ? prev.streak : 0,
    bestStreak: prev.bestStreak,
    lastCompletedDate: prev.lastCompletedDate,
    grandPrizeClaimed: continuous ? prev.grandPrizeClaimed : false,
  };
}

/** Total claimable reward count across the day (for a UI badge). */
export function claimableCount(state: QuickWinState): number {
  let n = state.tasks.filter(isClaimable).length;
  if (allComplete(state.tasks) && !state.dailyBonusClaimed) n += 1;
  return n;
}
