import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/utils/rng';
import {
  BOARD_SIZE,
  cornerIndex,
  railroadIndices,
  JAIL_INDEX,
  generateBoard,
  drawCard,
  type Tile,
  type TileType,
} from '../../src/games/dice-tycoon/board';

// Standard 40-space layout: corners at 0/10/20/30, derived from BOARD_SIZE.
const CORNER_TYPES: Record<number, TileType> = {
  [cornerIndex(0)]: 'go',
  [cornerIndex(1)]: 'jail',
  [cornerIndex(2)]: 'parking',
  [cornerIndex(3)]: 'gotojail',
};

function countType(tiles: Tile[], type: TileType): number {
  return tiles.filter((t) => t.type === type).length;
}

describe('dice-tycoon board: generateBoard', () => {
  it('returns exactly BOARD_SIZE (40) tiles with sequential indices', () => {
    const { tiles } = generateBoard(mulberry32(1), 1);
    expect(BOARD_SIZE).toBe(40);
    expect(tiles).toHaveLength(40);
    tiles.forEach((t, i) => expect(t.index).toBe(i));
  });

  it('derives corner indices from BOARD_SIZE (0, N/4, N/2, 3N/4)', () => {
    expect(cornerIndex(0)).toBe(0);
    expect(cornerIndex(1)).toBe(10);
    expect(cornerIndex(2)).toBe(20);
    expect(cornerIndex(3)).toBe(30);
    expect(JAIL_INDEX).toBe(10);
  });

  it('places the four corners at fixed indices/types', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { tiles } = generateBoard(mulberry32(seed), (seed % 4) + 1);
      for (const idxStr of Object.keys(CORNER_TYPES)) {
        const idx = Number(idxStr);
        expect(tiles[idx].type).toBe(CORNER_TYPES[idx]);
      }
    }
  });

  it('is deterministic: same seed + level => identical board', () => {
    const a = generateBoard(mulberry32(12345), 3);
    const b = generateBoard(mulberry32(12345), 3);
    expect(a.tiles).toEqual(b.tiles);
    expect(a.theme).toEqual(b.theme);
  });

  it('differs across seeds (at least sometimes)', () => {
    const a = generateBoard(mulberry32(1), 1);
    const b = generateBoard(mulberry32(99999), 1);
    // Boards with different seeds should not be byte-identical in their tile types.
    const aTypes = a.tiles.map((t) => t.type).join(',');
    const bTypes = b.tiles.map((t) => t.type).join(',');
    expect(aTypes).not.toBe(bTypes);
  });

  it('has exactly 4 railroad/Depot tiles at the classic 5/15/25/35 spots', () => {
    const expectedRails = railroadIndices();
    expect(expectedRails).toEqual([5, 15, 25, 35]);
    for (let seed = 0; seed < 30; seed++) {
      const { tiles } = generateBoard(mulberry32(seed * 7 + 1), (seed % 4) + 1);
      const railroads = tiles.filter((t) => t.type === 'railroad');
      expect(railroads.length).toBe(4);
      expect(railroads.map((r) => r.index).sort((a, b) => a - b)).toEqual(expectedRails);
      for (const r of railroads) {
        expect(r.index in CORNER_TYPES).toBe(false);
      }
    }
  });

  it('fills non-corner, non-railroad tiles with the themed mix only', () => {
    const allowed = new Set<TileType>(['property', 'tax', 'chance', 'treasure', 'railroad']);
    const { tiles } = generateBoard(mulberry32(77), 2);
    for (let i = 0; i < BOARD_SIZE; i++) {
      if (i in CORNER_TYPES) continue;
      expect(allowed.has(tiles[i].type)).toBe(true);
    }
  });

  it('always produces at least one property tile', () => {
    for (let seed = 0; seed < 15; seed++) {
      const { tiles } = generateBoard(mulberry32(seed * 13 + 3), 1);
      expect(countType(tiles, 'property')).toBeGreaterThanOrEqual(1);
    }
  });

  it('scales baseValue with board level', () => {
    const lvl1 = generateBoard(mulberry32(555), 1);
    const lvl3 = generateBoard(mulberry32(555), 3);
    // Same seed → same tile-type layout (level does not alter rng draws for
    // layout in our impl beyond theme), so we can compare matching property tiles.
    const sumProp = (b: { tiles: Tile[] }) =>
      b.tiles.filter((t) => t.type === 'property').reduce((s, t) => s + t.baseValue, 0);
    const sumTax = (b: { tiles: Tile[] }) =>
      b.tiles.filter((t) => t.type === 'tax').reduce((s, t) => s + t.baseValue, 0);
    expect(sumProp(lvl3)).toBeGreaterThan(sumProp(lvl1));
    if (sumTax(lvl1) > 0) {
      expect(sumTax(lvl3)).toBeGreaterThan(sumTax(lvl1));
    }
  });

  it('gives corners and non-economic tiles a baseValue of 0', () => {
    const { tiles } = generateBoard(mulberry32(31), 2);
    for (const t of tiles) {
      if (t.type === 'property' || t.type === 'tax') {
        expect(t.baseValue).toBeGreaterThan(0);
      } else {
        expect(t.baseValue).toBe(0);
      }
    }
  });

  it('returns a theme with a name and exactly 4 landmark names', () => {
    for (let lvl = 1; lvl <= 8; lvl++) {
      const { theme } = generateBoard(mulberry32(lvl), lvl);
      expect(typeof theme.name).toBe('string');
      expect(theme.name.length).toBeGreaterThan(0);
      expect(theme.landmarkNames).toHaveLength(4);
      theme.landmarkNames.forEach((n) => expect(n.length).toBeGreaterThan(0));
    }
  });

  it('rotates themes by board level', () => {
    const names = new Set<string>();
    for (let lvl = 1; lvl <= 4; lvl++) {
      names.add(generateBoard(mulberry32(lvl), lvl).theme.name);
    }
    // 4 consecutive levels should surface multiple distinct themes.
    expect(names.size).toBeGreaterThanOrEqual(3);
  });

  it('handles degenerate board levels without NaN or crashing', () => {
    for (const lvl of [0, -1, 1.5, NaN]) {
      const { tiles, theme } = generateBoard(mulberry32(5), lvl);
      expect(tiles).toHaveLength(40);
      expect(theme.landmarkNames).toHaveLength(4);
      tiles.forEach((t) => expect(Number.isNaN(t.baseValue)).toBe(false));
    }
  });

  it('produces no NaN baseValues for normal levels', () => {
    for (let lvl = 1; lvl <= 6; lvl++) {
      const { tiles } = generateBoard(mulberry32(lvl * 3), lvl);
      tiles.forEach((t) => expect(Number.isFinite(t.baseValue)).toBe(true));
    }
  });

  // ── F2 baseValue formulas ──
  it('property baseValue = round((40 + propIndex*6) * 1.22^(level-1)), rising clockwise', () => {
    for (const lvl of [1, 3, 5]) {
      const { tiles } = generateBoard(mulberry32(2024), lvl);
      // Properties are numbered 0,1,2,... clockwise from GO; baseValue rises.
      let propIndex = 0;
      let prev = -Infinity;
      for (const t of tiles) {
        if (t.type !== 'property') continue;
        const expected = Math.round((40 + propIndex * 6) * Math.pow(1.22, lvl - 1));
        expect(t.baseValue).toBe(expected);
        expect(t.baseValue).toBeGreaterThan(prev); // strictly increasing clockwise
        prev = t.baseValue;
        propIndex++;
      }
    }
  });

  it('tax baseValue = round(25 * 1.18^(level-1))', () => {
    for (const lvl of [1, 2, 4]) {
      const { tiles } = generateBoard(mulberry32(808), lvl);
      const expected = Math.round(25 * Math.pow(1.18, lvl - 1));
      for (const t of tiles) {
        if (t.type === 'tax') expect(t.baseValue).toBe(expected);
      }
    }
  });

  it('property/tax baseValue grows geometrically across levels (same seed)', () => {
    const seed = 4242;
    const propAt = (lvl: number) =>
      generateBoard(mulberry32(seed), lvl).tiles.find((t) => t.type === 'property')!.baseValue;
    const taxAt = (lvl: number) =>
      generateBoard(mulberry32(seed), lvl).tiles.find((t) => t.type === 'tax')?.baseValue ?? 0;
    expect(propAt(2)).toBeGreaterThan(propAt(1));
    expect(propAt(3)).toBeGreaterThan(propAt(2));
    if (taxAt(1) > 0) {
      expect(taxAt(3)).toBeGreaterThan(taxAt(1));
    }
  });

  // ── F2 tile mix ──
  it('keeps the 4 fixed corners, exactly 40 tiles, and exactly 4 railroads across seeds', () => {
    for (let seed = 0; seed < 40; seed++) {
      const { tiles } = generateBoard(mulberry32(seed * 11 + 5), (seed % 4) + 1);
      expect(tiles).toHaveLength(40);
      for (const idxStr of Object.keys(CORNER_TYPES)) {
        const idx = Number(idxStr);
        expect(tiles[idx].type).toBe(CORNER_TYPES[idx]);
      }
      const rails = tiles.filter((t) => t.type === 'railroad');
      expect(rails.length).toBe(4);
      for (const r of rails) expect(r.index in CORNER_TYPES).toBe(false);
    }
  });

  it('the richer mix yields tax and railroad tiles across seeds', () => {
    let sawTax = false;
    let sawHeist = false;
    for (let seed = 0; seed < 40; seed++) {
      const { tiles } = generateBoard(mulberry32(seed * 3 + 1), 2);
      if (countType(tiles, 'tax') > 0) sawTax = true;
      if (countType(tiles, 'railroad') >= 2) sawHeist = true;
    }
    expect(sawTax).toBe(true);
    expect(sawHeist).toBe(true);
  });

  it('remains deterministic with the new mix (same seed + level)', () => {
    const a = generateBoard(mulberry32(31337), 4);
    const b = generateBoard(mulberry32(31337), 4);
    expect(a.tiles).toEqual(b.tiles);
  });

  // ── 40-space structure (counts + property color groups) ──
  it('has the expected special-tile counts: 2 tax, 3 chance, 3 treasure', () => {
    for (let seed = 0; seed < 30; seed++) {
      const { tiles } = generateBoard(mulberry32(seed * 5 + 2), (seed % 4) + 1);
      expect(countType(tiles, 'tax')).toBe(2);
      expect(countType(tiles, 'chance')).toBe(3);
      expect(countType(tiles, 'treasure')).toBe(3);
    }
  });

  it('fills the rest with ~22+ property tiles (4 corners + 4 rail + 8 special)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { tiles } = generateBoard(mulberry32(seed * 9 + 3), 1);
      // 40 - 4 corners - 4 railroads - 8 specials = 24 properties.
      expect(countType(tiles, 'property')).toBe(24);
    }
  });

  it('assigns property color-group bands in runs of 2–3 cycling 6 plaza colors', () => {
    const { tiles } = generateBoard(mulberry32(7), 1);
    const props = tiles.filter((t) => t.type === 'property');
    // Every property has a band in 0..5.
    for (const p of props) {
      expect(typeof p.band).toBe('number');
      expect(p.band!).toBeGreaterThanOrEqual(0);
      expect(p.band!).toBeLessThan(6);
    }
    // Bands form contiguous runs (groups) — count the run lengths.
    let runLen = 1;
    const runLengths: number[] = [];
    for (let i = 1; i < props.length; i++) {
      if (props[i].band === props[i - 1].band) runLen++;
      else { runLengths.push(runLen); runLen = 1; }
    }
    runLengths.push(runLen);
    // Most groups should be 2 or 3 (allow a trailing partial run).
    const grouped = runLengths.filter((l) => l >= 2).length;
    expect(grouped).toBeGreaterThanOrEqual(runLengths.length - 1);
  });
});

describe('dice-tycoon board: drawCard', () => {
  const KINDS = new Set(['coins', 'dice', 'shield', 'sticker', 'move']);

  it('is deterministic for the same seed', () => {
    const a = drawCard(mulberry32(42), 'chance', 2);
    const b = drawCard(mulberry32(42), 'chance', 2);
    expect(a).toEqual(b);
    const c = drawCard(mulberry32(42), 'treasure', 2);
    const d = drawCard(mulberry32(42), 'treasure', 2);
    expect(c).toEqual(d);
  });

  it('treasure cards are never harmful (no negative coins, no forced move)', () => {
    for (let seed = 0; seed < 300; seed++) {
      const card = drawCard(mulberry32(seed * 31 + 7), 'treasure', (seed % 4) + 1);
      expect(KINDS.has(card.kind)).toBe(true);
      expect(card.kind).not.toBe('move');
      if (card.kind === 'coins') {
        expect(card.amount).toBeGreaterThan(0);
      } else {
        expect(card.amount).toBeGreaterThan(0);
      }
      expect(Number.isFinite(card.amount)).toBe(true);
    }
  });

  it('chance cards span the mixed set and can be harmful', () => {
    let sawNegative = false;
    let sawMove = false;
    let sawPositive = false;
    for (let seed = 0; seed < 400; seed++) {
      const card = drawCard(mulberry32(seed * 17 + 1), 'chance', 1);
      expect(KINDS.has(card.kind)).toBe(true);
      expect(Number.isFinite(card.amount)).toBe(true);
      if (card.kind === 'coins' && card.amount < 0) sawNegative = true;
      if (card.kind === 'coins' && card.amount > 0) sawPositive = true;
      if (card.kind === 'move') {
        sawMove = true;
        expect(card.amount).toBeGreaterThanOrEqual(0);
        expect(card.amount).toBeLessThan(BOARD_SIZE);
      }
    }
    expect(sawNegative).toBe(true);
    expect(sawPositive).toBe(true);
    expect(sawMove).toBe(true);
  });

  it('move cards always target a valid tile index', () => {
    for (let seed = 0; seed < 500; seed++) {
      const card = drawCard(mulberry32(seed + 1000), 'chance', 3);
      if (card.kind === 'move') {
        expect(Number.isInteger(card.amount)).toBe(true);
        expect(card.amount).toBeGreaterThanOrEqual(0);
        expect(card.amount).toBeLessThan(BOARD_SIZE);
      }
    }
  });

  it('coin rewards scale with board level', () => {
    // Find a seed that yields a positive-coin treasure at level 1, then compare
    // the same seed at a higher level.
    let found = false;
    for (let seed = 0; seed < 200 && !found; seed++) {
      const lo = drawCard(mulberry32(seed), 'treasure', 1);
      const hi = drawCard(mulberry32(seed), 'treasure', 4);
      if (lo.kind === 'coins' && hi.kind === 'coins') {
        expect(hi.amount).toBeGreaterThan(lo.amount);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('never returns a card with a NaN amount', () => {
    for (let seed = 0; seed < 200; seed++) {
      const t = drawCard(mulberry32(seed), 'treasure', (seed % 5));
      const c = drawCard(mulberry32(seed + 1), 'chance', (seed % 5));
      expect(Number.isNaN(t.amount)).toBe(false);
      expect(Number.isNaN(c.amount)).toBe(false);
    }
  });
});
