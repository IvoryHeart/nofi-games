import { describe, it, expect } from 'vitest';
import {
  wordSet,
  wordsByLength,
  isValidWord,
  allWords,
  DICTIONARY_SIZE,
} from '../../src/words/dictionary';

describe('DICTIONARY_SIZE', () => {
  it('is at least 7000', () => {
    expect(DICTIONARY_SIZE).toBeGreaterThanOrEqual(7000);
  });
});

describe('allWords', () => {
  it('returns an array of lowercase strings sorted within each length group', () => {
    const words = allWords();
    expect(words.length).toBe(DICTIONARY_SIZE);
    // Words are grouped by length, sorted alphabetically within each group
    for (let i = 1; i < words.length; i++) {
      if (words[i].length === words[i - 1].length) {
        expect(words[i] >= words[i - 1]).toBe(true);
      }
    }
    for (const w of words) {
      expect(typeof w).toBe('string');
      expect(w).toBe(w.toLowerCase());
    }
  });

  it('contains only lowercase alphabetic characters', () => {
    const words = allWords();
    const pattern = /^[a-z]+$/;
    for (const w of words) {
      expect(pattern.test(w)).toBe(true);
    }
  });

  it('has no duplicates', () => {
    const words = allWords();
    const unique = new Set(words);
    expect(unique.size).toBe(words.length);
  });
});

describe('wordsByLength', () => {
  it('returns only 3-letter words, count > 400', () => {
    const words = wordsByLength(3);
    expect(words.length).toBeGreaterThan(400);
    for (const w of words) {
      expect(w.length).toBe(3);
    }
  });

  it('returns only 4-letter words, count > 1500', () => {
    const words = wordsByLength(4);
    expect(words.length).toBeGreaterThan(1500);
    for (const w of words) {
      expect(w.length).toBe(4);
    }
  });

  it('returns only 5-letter words, count > 1800', () => {
    const words = wordsByLength(5);
    expect(words.length).toBeGreaterThan(1800);
    for (const w of words) {
      expect(w.length).toBe(5);
    }
  });

  it('returns only 6-letter words, count > 1900', () => {
    const words = wordsByLength(6);
    expect(words.length).toBeGreaterThan(1900);
    for (const w of words) {
      expect(w.length).toBe(6);
    }
  });

  it('returns only 7-letter words, count > 1400', () => {
    const words = wordsByLength(7);
    expect(words.length).toBeGreaterThan(1400);
    for (const w of words) {
      expect(w.length).toBe(7);
    }
  });

  it('returns empty array for length 99', () => {
    const words = wordsByLength(99);
    expect(words).toEqual([]);
  });

  it('results for all lengths sum to DICTIONARY_SIZE', () => {
    let total = 0;
    for (let len = 1; len <= 20; len++) {
      total += wordsByLength(len).length;
    }
    expect(total).toBe(DICTIONARY_SIZE);
  });
});

describe('wordSet', () => {
  it('returns a Set with size matching DICTIONARY_SIZE', () => {
    const set = wordSet();
    expect(set.size).toBe(DICTIONARY_SIZE);
  });
});

describe('isValidWord', () => {
  it('returns true for a common word (hello)', () => {
    expect(isValidWord('hello')).toBe(true);
  });

  it('returns true for uppercase input (case-insensitive)', () => {
    expect(isValidWord('HELLO')).toBe(true);
  });

  it('returns false for a nonsense string', () => {
    expect(isValidWord('xyzzyplugh')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidWord('')).toBe(false);
  });
});

describe('common game words exist', () => {
  it.each(['snake', 'block', 'puzzle', 'brain', 'stone', 'water', 'music'])(
    '"%s" is in the dictionary',
    (word) => {
      expect(isValidWord(word)).toBe(true);
    },
  );
});

describe('words used by Wordle are present', () => {
  it.each([
    // 4-letter words
    'game', 'word', 'play', 'luck',
    // 5-letter words
    'crane', 'stare', 'house', 'light', 'stone',
    // 6-letter words
    'battle', 'castle', 'garden', 'silver', 'wonder',
  ])('"%s" is in the dictionary', (word) => {
    expect(isValidWord(word)).toBe(true);
  });
});
