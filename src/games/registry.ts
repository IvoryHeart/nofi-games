import { GameEngine, GameConfig } from '../engine/GameEngine';

export interface GameInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgGradient?: [string, string]; // gradient for card thumbnail background
  category: 'puzzle' | 'arcade' | 'strategy' | 'card';
  createGame: (config: GameConfig) => GameEngine;
  canvasWidth: number;
  canvasHeight: number;
  controls?: string;
  perGameSettings?: { key: string; label: string; type: 'toggle' }[];
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

export async function loadAllGames(): Promise<void> {
  await Promise.all([
    import('./block-drop/BlockDrop'),
    import('./bubble-pop/BubblePop'),
    import('./gem-swap/GemSwap'),
    import('./twenty48/Twenty48'),
    import('./snake/Snake'),
    import('./minesweeper/Minesweeper'),
    import('./memory-match/MemoryMatch'),
    import('./sudoku/Sudoku'),
  ]);
}
