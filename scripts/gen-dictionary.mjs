#!/usr/bin/env node
/**
 * Generates src/words/dictionary.ts by merging word lists from all word games.
 * Run: node scripts/gen-dictionary.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const anaSrc = readFileSync('src/games/anagram/Anagram.ts', 'utf8');
const anaMatch = anaSrc.match(/const DICTIONARY_WORDS: string\[\] = \[([\s\S]*?)\];/);
const anaWords = anaMatch[1].match(/'([^']+)'/g).map(w => w.replace(/'/g, '').toLowerCase());

const worSrc = readFileSync('src/games/wordle/Wordle.ts', 'utf8');
const wor4 = worSrc.match(/const WORDS_4 = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map(w => w.replace(/'/g, '').toLowerCase());
const wor5 = worSrc.match(/const WORDS_5 = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map(w => w.replace(/'/g, '').toLowerCase());
const wor6 = worSrc.match(/const WORDS_6 = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map(w => w.replace(/'/g, '').toLowerCase());

const wsSrc = readFileSync('src/games/word-search/WordSearch.ts', 'utf8');
const wsMatch = wsSrc.match(/const WORDS: readonly string\[\] = \[([\s\S]*?)\];/);
const wsWords = wsMatch[1].match(/'([^']+)'/g).map(w => w.replace(/'/g, '').toLowerCase());

// Merge, dedupe, filter: only alphabetic, 3-9 letters, no proper nouns
const skip = new Set(['jane','jean','billy','calif','china','harry','henry','jimmy','jones','lewis','java','june','july','ford','jack','lucy','doug','andy','john','greek']);
const allRaw = [...anaWords, ...wor4, ...wor5, ...wor6, ...wsWords];
const unique = [...new Set(allRaw)].filter(w => /^[a-z]+$/.test(w) && w.length >= 3 && w.length <= 9 && !skip.has(w));
unique.sort();

// Group by length
const byLen = {};
unique.forEach(w => { const l = w.length; if (!byLen[l]) byLen[l] = []; byLen[l].push(w); });

function formatWords(words) {
  const lines = [];
  for (let i = 0; i < words.length; i += 10) {
    const chunk = words.slice(i, i + 10);
    lines.push('  ' + chunk.map(w => `'${w}'`).join(', ') + ',');
  }
  return lines.join('\n');
}

let out = `/**
 * Shared word dictionary for all word-based games (Wordle, Anagram, Word Search).
 *
 * Single source of truth — ${unique.length} unique English words, 3-9 letters.
 * Vite code-splits this into its own chunk, loaded once and cached across games.
 *
 * To add words: append to the appropriate length section below. The Set and
 * length-indexed arrays are computed lazily on first access.
 */

const ALL_WORDS: readonly string[] = [\n`;

const lengths = Object.keys(byLen).map(Number).sort((a, b) => a - b);
for (const len of lengths) {
  out += `  // ${len}-letter words (${byLen[len].length})\n`;
  out += formatWords(byLen[len]) + '\n';
}

out += `];

// ── Lazy-computed indexes ────────────────────────────────────────────

let _set: Set<string> | null = null;
let _byLength: Map<number, readonly string[]> | null = null;

function ensureIndexes(): void {
  if (_set) return;
  _set = new Set(ALL_WORDS);
  const map = new Map<number, string[]>();
  for (const w of ALL_WORDS) {
    const arr = map.get(w.length);
    if (arr) arr.push(w);
    else map.set(w.length, [w]);
  }
  _byLength = map as Map<number, readonly string[]>;
}

/** All unique words as a Set (for O(1) membership checks). */
export function wordSet(): ReadonlySet<string> {
  ensureIndexes();
  return _set!;
}

/** All words of a given length. Returns empty array if none. */
export function wordsByLength(len: number): readonly string[] {
  ensureIndexes();
  return _byLength!.get(len) ?? [];
}

/** Check if a word is in the dictionary. Case-insensitive. */
export function isValidWord(word: string): boolean {
  return wordSet().has(word.toLowerCase());
}

/** The full sorted word list. */
export function allWords(): readonly string[] {
  return ALL_WORDS;
}

/** Total number of unique words in the dictionary. */
export const DICTIONARY_SIZE = ALL_WORDS.length;
`;

writeFileSync('src/words/dictionary.ts', out);
console.log(`Written src/words/dictionary.ts with ${unique.length} words`);
for (const l of lengths) console.log(`  ${l}-letter: ${byLen[l].length}`);
