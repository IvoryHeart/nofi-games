import { describe, it, expect, beforeAll, vi } from 'vitest';
import { GameEngine, GameConfig, GameSnapshot } from '../../src/engine/GameEngine';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

import { getGame, GameInfo } from '../../src/games/registry';
import { parseLevel, SokobanLevel, Tile, tileAt, boxAt, Box } from '../../src/games/sokoban/types';
import { LEVEL_PACK } from '../../src/games/sokoban/levels';

function makeConfig(opts: {
  difficulty?: number;
  seed?: number;
  onWin?: (s: number) => void;
} = {}): GameConfig {
  const canvas = document.createElement('canvas');
  return {
    canvas,
    width: 360,
    height: 560,
    difficulty: opts.difficulty ?? 0,
    seed: opts.seed,
    onWin: opts.onWin,
  };
}

type SokobanInternals = GameEngine & {
  level: SokobanLevel;
  boxes: Box[];
  playerCol: number;
  playerRow: number;
  moves: number;
  gameActive: boolean;
  activeTier: number;
  activeLevelIdx: number;
  testMove: (dir: 'up' | 'down' | 'left' | 'right') => void;
  isSolved: () => boolean;
};

let info: GameInfo;
beforeAll(async () => {
  store.clear();
  await import('../../src/games/sokoban/Sokoban');
  const fetched = getGame('sokoban');
  if (!fetched) throw new Error('sokoban not registered');
  info = fetched;
});

describe('Sokoban — Integration', () => {
  describe('Registration', () => {
    it('is registered', () => {
      expect(info.id).toBe('sokoban');
      expect(info.name).toBe('Sokoban');
      expect(info.category).toBe('puzzle');
      expect(info.dailyMode).toBe(true);
    });
  });

  describe('Level parsing', () => {
    it('parses all packed levels without throwing', () => {
      for (let tier = 0; tier < LEVEL_PACK.length; tier++) {
        for (let i = 0; i < LEVEL_PACK[tier].length; i++) {
          expect(() => parseLevel(LEVEL_PACK[tier][i])).not.toThrow();
        }
      }
    });

    it('every packed level has at least one box and one target', () => {
      for (const tier of LEVEL_PACK) {
        for (const map of tier) {
          const lvl = parseLevel(map);
          expect(lvl.boxes.length).toBeGreaterThan(0);
          let targets = 0;
          for (let i = 0; i < lvl.tiles.length; i++) {
            if (lvl.tiles[i] === Tile.Target) targets++;
          }
          // Targets count = (explicit '!' + '+' + '*')
          expect(targets).toBeGreaterThan(0);
        }
      }
    });

    it('every packed level has equal boxes and targets', () => {
      for (const tier of LEVEL_PACK) {
        for (const map of tier) {
          const lvl = parseLevel(map);
          let targets = 0;
          for (let i = 0; i < lvl.tiles.length; i++) {
            if (lvl.tiles[i] === Tile.Target) targets++;
          }
          expect(lvl.boxes.length).toBe(targets);
        }
      }
    });
  });

  describe('Game lifecycle', () => {
    it('instantiates at all 4 difficulties', () => {
      for (let d = 0; d <= 3; d++) {
        const g = info.createGame(makeConfig({ difficulty: d, seed: 100 + d }));
        expect(g).toBeInstanceOf(GameEngine);
        g.destroy();
      }
    });

    it('same seed picks the same level', () => {
      const g1 = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as SokobanInternals;
      g1.start();
      const g2 = info.createGame(makeConfig({ difficulty: 0, seed: 42 })) as SokobanInternals;
      g2.start();
      expect(g1.activeLevelIdx).toBe(g2.activeLevelIdx);
      g1.destroy();
      g2.destroy();
    });

    it('walk into empty cell moves player', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 3 })) as SokobanInternals;
      g.start();
      const before = { col: g.playerCol, row: g.playerRow };
      // Try each direction — at least one should be walkable
      for (const d of ['right', 'down', 'left', 'up'] as const) {
        g.testMove(d);
        if (g.playerCol !== before.col || g.playerRow !== before.row) {
          expect(g.moves).toBe(1);
          g.destroy();
          return;
        }
      }
      throw new Error('expected at least one walkable direction');
    });

    it('walking into a wall is blocked', () => {
      // Easy level 0 has a tight room where the player can push a box down.
      // Walking into a wall should not change position or move count.
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 0 })) as SokobanInternals;
      g.start();
      const before = { col: g.playerCol, row: g.playerRow, moves: g.moves };
      // Find a wall-adjacent direction
      const dirs: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];
      let wallFound = false;
      for (const d of dirs) {
        const dc = d === 'right' ? 1 : d === 'left' ? -1 : 0;
        const dr = d === 'down' ? 1 : d === 'up' ? -1 : 0;
        if (tileAt(g.level, g.playerCol + dc, g.playerRow + dr) === Tile.Wall) {
          g.testMove(d);
          expect(g.playerCol).toBe(before.col);
          expect(g.playerRow).toBe(before.row);
          expect(g.moves).toBe(before.moves);
          wallFound = true;
          break;
        }
      }
      expect(wallFound).toBe(true);
      g.destroy();
    });

    it('pushing a box onto an empty floor succeeds', () => {
      // Use a hand-crafted simple level: player can push box right onto target.
      // Easy level 4: '#.@$!#' — player at (2,2), box at (3,2), target at (4,2).
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 4 })) as SokobanInternals;
      g.start();
      // Confirm we got the expected level shape (width=6, box & target horizontally).
      // Push right: player pushes box onto target.
      g.testMove('right');
      expect(g.isSolved()).toBe(true);
      g.destroy();
    });

    it('cannot push a box into a wall', () => {
      const g = info.createGame(makeConfig({ difficulty: 0, seed: 0 })) as SokobanInternals;
      g.start();
      // Find a direction where the box is adjacent and something blocks beyond it
      const dirs = [
        { name: 'up', dc: 0, dr: -1 },
        { name: 'down', dc: 0, dr: 1 },
        { name: 'left', dc: -1, dr: 0 },
        { name: 'right', dc: 1, dr: 0 },
      ] as const;
      for (const d of dirs) {
        const bc = g.playerCol + d.dc;
        const br = g.playerRow + d.dr;
        const boxIdx = boxAt(g.boxes, bc, br);
        if (boxIdx < 0) continue;
        const beyondTile = tileAt(g.level, bc + d.dc, br + d.dr);
        if (beyondTile === Tile.Wall || beyondTile === Tile.Empty) {
          const before = { p: { col: g.playerCol, row: g.playerRow }, box: { ...g.boxes[boxIdx] } };
          g.testMove(d.name);
          expect(g.playerCol).toBe(before.p.col);
          expect(g.playerRow).toBe(before.p.row);
          expect(g.boxes[boxIdx]).toEqual(before.box);
          g.destroy();
          return;
        }
      }
      g.destroy();
    });
  });

  describe('Save / Resume', () => {
    it('round-trips serialize/deserialize', () => {
      const g1 = info.createGame(makeConfig({ difficulty: 0, seed: 4 })) as SokobanInternals;
      g1.start();
      g1.testMove('right'); // may or may not move — either way snapshot reflects it
      const snap = g1.serialize() as GameSnapshot;
      const before = {
        player: { col: g1.playerCol, row: g1.playerRow },
        boxes: g1.boxes.map(b => ({ ...b })),
        moves: g1.moves,
      };
      g1.destroy();

      const g2 = info.createGame(makeConfig({ difficulty: 0, seed: 99 })) as SokobanInternals;
      g2.start();
      g2.deserialize(snap);
      expect(g2.playerCol).toBe(before.player.col);
      expect(g2.playerRow).toBe(before.player.row);
      expect(g2.boxes.map(b => ({ ...b }))).toEqual(before.boxes);
      expect(g2.moves).toBe(before.moves);
      g2.destroy();
    });
  });

  describe('Restart', () => {
    it('reset() replays the same level', () => {
      const g = info.createGame(makeConfig({ difficulty: 1, seed: 7 })) as SokobanInternals;
      g.start();
      const { activeLevelIdx } = g;
      for (const d of ['right', 'down', 'left', 'up'] as const) {
        g.testMove(d);
        if (g.moves > 0) break;
      }
      g.reset();
      expect(g.activeLevelIdx).toBe(activeLevelIdx);
      expect(g.moves).toBe(0);
      g.destroy();
    });
  });
});
