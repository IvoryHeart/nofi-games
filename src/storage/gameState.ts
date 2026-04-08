import { get, set, del } from 'idb-keyval';
import type { GameSnapshot } from '../engine/GameEngine';

/**
 * Per-game, per-difficulty save/resume.
 *
 * Each (gameId, difficulty) pair has its own independent save slot so the
 * player can pause Hard mid-puzzle, drop to Medium for a quick run, and
 * still come back to the exact Hard state they left. Difficulty is part
 * of the storage key — NOT a field we compare on load.
 */

const STATE_PREFIX = 'gamestate_';

export interface SavedGameState {
  state: GameSnapshot;
  score: number;
  won: boolean;
  difficulty: number;
  savedAt: string; // ISO timestamp
}

function key(gameId: string, difficulty: number): string {
  return `${STATE_PREFIX}${gameId}_${difficulty}`;
}

/** Legacy (pre-per-level) key, used during the one-time migration on read. */
function legacyKey(gameId: string): string {
  return `${STATE_PREFIX}${gameId}`;
}

export async function saveGameState(
  gameId: string,
  data: Omit<SavedGameState, 'savedAt'>,
): Promise<void> {
  const entry: SavedGameState = { ...data, savedAt: new Date().toISOString() };
  await set(key(gameId, data.difficulty), entry);
}

/**
 * Load the saved state for this game at this specific difficulty.
 *
 * Falls back once to the pre-per-level key shape so players who had a save
 * before this change don't lose it — the legacy entry is migrated to the
 * new (gameId, difficulty) slot (using whichever difficulty the legacy
 * entry reports) and then removed. The requested difficulty only dictates
 * whether the migrated entry is also RETURNED by this call.
 *
 * Fixes the previous behavior where a legacy entry at difficulty 2 would
 * linger forever if the player first opened difficulty 0 — the legacy
 * entry now gets migrated regardless of which slot the player opens first.
 */
export async function loadGameState(
  gameId: string,
  difficulty: number,
): Promise<SavedGameState | null> {
  const current = (await get(key(gameId, difficulty))) as SavedGameState | undefined;
  if (current) return current;

  // One-time migration from the legacy single-save-per-game layout.
  const legacy = (await get(legacyKey(gameId))) as SavedGameState | undefined;
  if (legacy) {
    // Migrate to whichever difficulty the legacy entry was saved at,
    // then delete the legacy key unconditionally so it can't leak.
    const legacyDiff = typeof legacy.difficulty === 'number' ? legacy.difficulty : difficulty;
    await set(key(gameId, legacyDiff), legacy);
    await del(legacyKey(gameId));
    // Only return the migrated entry if it matches the requested difficulty.
    if (legacyDiff === difficulty) return legacy;
  }
  return null;
}

export async function clearGameState(gameId: string, difficulty: number): Promise<void> {
  await del(key(gameId, difficulty));
}

/** Remove every saved state for this game across all difficulties. Used when
 *  resetting a game's progress entirely (e.g. the per-game settings "Reset"). */
export async function clearAllGameStates(gameId: string): Promise<void> {
  // We don't maintain an index, so enumerate all four difficulty slots.
  for (let d = 0; d < 4; d++) {
    await del(key(gameId, d));
  }
  await del(legacyKey(gameId));
}

export async function hasGameState(gameId: string, difficulty: number): Promise<boolean> {
  return (await loadGameState(gameId, difficulty)) != null;
}

/** Return the set of difficulties that have a saved state for this game. */
export async function savedDifficulties(gameId: string): Promise<number[]> {
  const out: number[] = [];
  for (let d = 0; d < 4; d++) {
    if ((await get(key(gameId, d))) != null) out.push(d);
  }
  return out;
}
