export const STORAGE_SCORES_STUB = `
export interface Settings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  volume: number;
}

export async function getSettings(): Promise<Settings> {
  return { soundEnabled: true, vibrationEnabled: true, volume: 80 };
}

export async function saveSettings(_s: Partial<Settings>): Promise<void> {}
`;

export const REGISTRY_STUB = `
import { GameEngine, GameConfig } from '../engine/GameEngine';

export interface GameInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgGradient?: [string, string];
  category: 'puzzle' | 'arcade' | 'strategy' | 'card';
  createGame: (config: GameConfig) => GameEngine;
  canvasWidth: number;
  canvasHeight: number;
  controls?: string;
  perGameSettings?: { key: string; label: string; type: 'toggle' }[];
  continuableAfterWin?: boolean;
  dailyMode?: boolean;
}

const registry: Map<string, GameInfo> = new Map();

export function registerGame(info: GameInfo): void {
  registry.set(info.id, info);
}

export function getGame(id: string): GameInfo | undefined {
  return registry.get(id);
}

export function getAllGames(): GameInfo[] {
  return Array.from(registry.values());
}
`;
