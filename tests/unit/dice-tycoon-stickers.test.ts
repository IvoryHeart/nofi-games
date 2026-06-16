import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/utils/rng';
import {
  STICKER_SETS,
  emptyAlbum,
  grantSticker,
  totalStickersOwned,
  setProgress,
  type AlbumState,
} from '../../src/games/dice-tycoon/stickers';

/** Drop stickers until the named set is fully owned; returns the last drop. */
function fillSet(album: AlbumState, setId: string) {
  const set = STICKER_SETS.find((s) => s.id === setId)!;
  let last = null as ReturnType<typeof grantSticker> | null;
  for (let i = 0; i < set.stickerNames.length; i++) {
    // Force-drop a specific sticker by handing grantSticker a fixed rng,
    // but we control the index by pre-seeding owned counts instead.
    const stickerId = `${setId}:${i}`;
    if ((album.owned[stickerId] ?? 0) === 0) {
      // Simulate a brand-new drop of exactly this sticker.
      last = grantSpecific(album, setId, i);
    }
  }
  return last;
}

/**
 * Test helper: replicate grantSticker's completion logic for a chosen sticker
 * without relying on rng landing on it. Mirrors the module's reward semantics.
 */
function grantSpecific(album: AlbumState, setId: string, index: number) {
  // Use a rng stub whose two draws map to the desired set + sticker index.
  const set = STICKER_SETS.find((s) => s.id === setId)!;
  const setIdx = STICKER_SETS.indexOf(set);
  const draws = [
    (setIdx + 0.5) / STICKER_SETS.length,
    (index + 0.5) / set.stickerNames.length,
  ];
  let i = 0;
  const rng = () => draws[i++];
  return grantSticker(rng, album);
}

describe('STICKER_SETS', () => {
  it('is exactly 3 sets of 4 stickers each (12 total)', () => {
    expect(STICKER_SETS).toHaveLength(3);
    let total = 0;
    for (const set of STICKER_SETS) {
      expect(set.stickerNames).toHaveLength(4);
      expect(typeof set.id).toBe('string');
      expect(typeof set.name).toBe('string');
      total += set.stickerNames.length;
    }
    expect(total).toBe(12);
  });

  it('has unique set ids and unique sticker names within a set', () => {
    const ids = STICKER_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const set of STICKER_SETS) {
      expect(new Set(set.stickerNames).size).toBe(set.stickerNames.length);
    }
  });
});

describe('emptyAlbum', () => {
  it('returns the expected empty shape', () => {
    const a = emptyAlbum();
    expect(a).toEqual({ owned: {}, completedSets: [] });
  });

  it('returns independent instances', () => {
    const a = emptyAlbum();
    const b = emptyAlbum();
    a.owned['x'] = 1;
    a.completedSets.push('y');
    expect(b.owned).toEqual({});
    expect(b.completedSets).toEqual([]);
  });
});

describe('grantSticker — determinism', () => {
  it('same seed + same album state produces the same drop', () => {
    const a1 = emptyAlbum();
    const a2 = emptyAlbum();
    const d1 = grantSticker(mulberry32(123), a1);
    const d2 = grantSticker(mulberry32(123), a2);
    expect(d1).toEqual(d2);
    expect(a1).toEqual(a2);
  });

  it('different seeds can produce different stickers', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 50; s++) {
      const d = grantSticker(mulberry32(s), emptyAlbum());
      seen.add(d.stickerId);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('produces a valid stickerId/setId for the picked sticker', () => {
    const d = grantSticker(mulberry32(7), emptyAlbum());
    const set = STICKER_SETS.find((s) => s.id === d.setId)!;
    expect(set).toBeDefined();
    expect(d.stickerId.startsWith(`${d.setId}:`)).toBe(true);
    const idx = Number(d.stickerId.split(':')[1]);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(set.stickerNames.length);
  });

  it('a long deterministic run never produces an out-of-range index', () => {
    const album = emptyAlbum();
    const rng = mulberry32(999);
    for (let i = 0; i < 500; i++) {
      const d = grantSticker(rng, album);
      const set = STICKER_SETS.find((s) => s.id === d.setId)!;
      const idx = Number(d.stickerId.split(':')[1]);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(set.stickerNames.length);
    }
  });
});

describe('grantSticker — duplicate detection', () => {
  it('marks isNew=false when the same sticker is granted again', () => {
    const album = emptyAlbum();
    const first = grantSpecific(album, 'wheels', 0);
    expect(first.isNew).toBe(true);
    expect(album.owned['wheels:0']).toBe(1);

    const dup = grantSpecific(album, 'wheels', 0);
    expect(dup.isNew).toBe(false);
    expect(dup.stickerId).toBe('wheels:0');
    expect(album.owned['wheels:0']).toBe(2);
  });

  it('increments the owned count on each grant (duplicates allowed)', () => {
    const album = emptyAlbum();
    for (let i = 1; i <= 4; i++) {
      grantSpecific(album, 'fortune', 2);
      expect(album.owned['fortune:2']).toBe(i);
    }
  });
});

describe('grantSticker — set completion & reward', () => {
  it('completes a set on the final sticker and grants the reward once', () => {
    const album = emptyAlbum();
    const set = STICKER_SETS[0];

    // First three stickers: no completion.
    for (let i = 0; i < 3; i++) {
      const d = grantSpecific(album, set.id, i);
      expect(d.setCompleted).toBeNull();
      expect(d.reward).toBeNull();
    }

    // Fourth sticker completes the set.
    const last = grantSpecific(album, set.id, 3);
    expect(last.setCompleted).toBe(set.id);
    expect(last.reward).not.toBeNull();
    expect(last.reward!.coins).toBeGreaterThan(0);
    expect(last.reward!.dice).toBeGreaterThan(0);
    expect(album.completedSets).toContain(set.id);
  });

  it('does NOT re-grant the reward on a later duplicate of a completed set', () => {
    const album = emptyAlbum();
    const set = STICKER_SETS[1];
    const last = fillSet(album, set.id)!;
    expect(last.setCompleted).toBe(set.id);
    expect(last.reward).not.toBeNull();
    expect(album.completedSets.filter((s) => s === set.id)).toHaveLength(1);

    // Granting any sticker from the completed set again -> no new reward.
    const dup = grantSpecific(album, set.id, 0);
    expect(dup.isNew).toBe(false);
    expect(dup.setCompleted).toBeNull();
    expect(dup.reward).toBeNull();
    expect(album.completedSets.filter((s) => s === set.id)).toHaveLength(1);
  });

  it('completing one set does not affect other sets', () => {
    const album = emptyAlbum();
    fillSet(album, 'wheels');
    expect(album.completedSets).toEqual(['wheels']);
    expect(setProgress(album, 'landmarks')).toEqual({ owned: 0, total: 4 });
  });
});

describe('totalStickersOwned', () => {
  it('counts distinct sticker ids, not duplicates', () => {
    const album = emptyAlbum();
    expect(totalStickersOwned(album)).toBe(0);

    grantSpecific(album, 'wheels', 0);
    grantSpecific(album, 'wheels', 0); // duplicate
    expect(totalStickersOwned(album)).toBe(1);

    grantSpecific(album, 'wheels', 1);
    grantSpecific(album, 'landmarks', 0);
    expect(totalStickersOwned(album)).toBe(3);
  });
});

describe('setProgress', () => {
  it('reports owned-of-total for a set', () => {
    const album = emptyAlbum();
    expect(setProgress(album, 'fortune')).toEqual({ owned: 0, total: 4 });
    grantSpecific(album, 'fortune', 0);
    grantSpecific(album, 'fortune', 0); // duplicate, still 1 distinct
    expect(setProgress(album, 'fortune')).toEqual({ owned: 1, total: 4 });
    grantSpecific(album, 'fortune', 1);
    expect(setProgress(album, 'fortune')).toEqual({ owned: 2, total: 4 });
  });

  it('returns {owned:0,total:0} for an unknown set id', () => {
    expect(setProgress(emptyAlbum(), 'nope')).toEqual({ owned: 0, total: 0 });
  });
});

describe('malformed album handling', () => {
  it('treats missing owned/completedSets as empty', () => {
    const bad = {} as unknown as AlbumState;
    expect(totalStickersOwned(bad)).toBe(0);
    expect(setProgress(bad, 'wheels')).toEqual({ owned: 0, total: 4 });
    const d = grantSticker(mulberry32(1), bad);
    expect(d.stickerId).toBeDefined();
    expect((bad as AlbumState).owned[d.stickerId]).toBe(1);
    expect(Array.isArray((bad as AlbumState).completedSets)).toBe(true);
  });
});
