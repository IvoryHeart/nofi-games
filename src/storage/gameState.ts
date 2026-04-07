import { get, set, del } from 'idb-keyval';
import type { GameSnapshot } from '../engine/GameEngine';

const STATE_PREFIX = 'gamestate_';

export interface SavedGameState {
  state: GameSnapshot;
  score: number;
  won: boolean;
  difficulty: number;
  savedAt: string; // ISO timestamp
}

function key(gameId: string): string {
  return `${STATE_PREFIX}${gameId}`;
}

export async function saveGameState(
  gameId: string,
  data: Omit<SavedGameState, 'savedAt'>,
): Promise<void> {
  const entry: SavedGameState = { ...data, savedAt: new Date().toISOString() };
  await set(key(gameId), entry);
}

export async function loadGameState(gameId: string): Promise<SavedGameState | null> {
  const entry = (await get(key(gameId))) as SavedGameState | undefined;
  return entry ?? null;
}

export async function clearGameState(gameId: string): Promise<void> {
  await del(key(gameId));
}

export async function hasGameState(gameId: string): Promise<boolean> {
  const entry = await get(key(gameId));
  return entry != null;
}
