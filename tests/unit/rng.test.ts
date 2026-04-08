import { describe, it, expect } from 'vitest';
import { mulberry32, dailySeed, todayDateString, randInt, shuffle, pick } from '../../src/utils/rng';

describe('mulberry32', () => {
  it('produces deterministic output for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let differs = false;
    for (let i = 0; i < 10; i++) {
      if (a() !== b()) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  it('outputs values in [0, 1)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has reasonable distribution', () => {
    // Pull 10000 values and check they roughly cover the range
    const rng = mulberry32(7);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 10000; i++) {
      const v = rng();
      buckets[Math.floor(v * 10)]++;
    }
    // Each bucket should have roughly 1000 values (±300 is generous)
    for (const count of buckets) {
      expect(count).toBeGreaterThan(700);
      expect(count).toBeLessThan(1300);
    }
  });

  it('handles seed 0', () => {
    const rng = mulberry32(0);
    const v = rng();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('coerces non-int seeds via >>> 0', () => {
    const a = mulberry32(3.7);
    const b = mulberry32(3);
    // Both should be valid generators
    expect(typeof a()).toBe('number');
    expect(typeof b()).toBe('number');
  });
});

describe('dailySeed', () => {
  it('returns the same number for the same UTC date', () => {
    const d1 = new Date('2026-04-08T05:00:00Z');
    const d2 = new Date('2026-04-08T23:59:59Z');
    expect(dailySeed(d1)).toBe(dailySeed(d2));
  });

  it('returns different numbers for adjacent days', () => {
    const d1 = new Date('2026-04-08T12:00:00Z');
    const d2 = new Date('2026-04-09T12:00:00Z');
    expect(dailySeed(d1)).not.toBe(dailySeed(d2));
  });

  it('encodes year, month, day', () => {
    const d = new Date('2026-04-08T12:00:00Z');
    expect(dailySeed(d)).toBe(20260408);
  });

  it('defaults to today when no date passed', () => {
    const v = dailySeed();
    expect(typeof v).toBe('number');
    expect(v).toBeGreaterThan(20000000);
  });
});

describe('todayDateString', () => {
  it('returns YYYY-MM-DD format', () => {
    const d = new Date('2026-04-08T15:30:00Z');
    expect(todayDateString(d)).toBe('2026-04-08');
  });

  it('uses UTC, not local time', () => {
    // Late evening UTC vs early morning next day in some locales
    const d = new Date('2026-04-08T23:59:00Z');
    expect(todayDateString(d)).toBe('2026-04-08');
  });

  it('defaults to today when no date passed', () => {
    const s = todayDateString();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('randInt', () => {
  it('produces values in [0, max)', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 200; i++) {
      const v = randInt(rng, 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe('shuffle', () => {
  it('preserves all elements', () => {
    const rng = mulberry32(123);
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle([...arr], rng);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic with the same seed', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(7));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(7));
    expect(a).toEqual(b);
  });

  it('actually shuffles (vs identity) for non-trivial arrays', () => {
    const original = Array.from({ length: 20 }, (_, i) => i);
    const shuffled = shuffle([...original], mulberry32(42));
    expect(shuffled).not.toEqual(original);
  });

  it('handles empty array', () => {
    expect(shuffle([], mulberry32(1))).toEqual([]);
  });

  it('handles single-element array', () => {
    expect(shuffle([42], mulberry32(1))).toEqual([42]);
  });

  it('uses Math.random as default', () => {
    // Just verify it doesn't throw
    const result = shuffle([1, 2, 3]);
    expect(result.length).toBe(3);
  });
});

describe('pick', () => {
  it('returns an element from the array', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const rng = mulberry32(1);
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(pick(arr, rng));
    }
  });

  it('is deterministic with seeded rng', () => {
    const arr = [10, 20, 30, 40, 50];
    expect(pick(arr, mulberry32(5))).toBe(pick(arr, mulberry32(5)));
  });
});
