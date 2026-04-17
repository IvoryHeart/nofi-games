// SVG icons for each game. Designed as 64x64 viewBox, currentColor fill,
// rendered white over the card's gradient background.
// Each icon is a simple silhouette designed to read at 32-128px.
export const GAME_ICONS: Record<string, string> = {
  // Block Drop: three stacked tetromino blocks (L + I + square pattern)
  'block-drop': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><rect x="10" y="10" width="14" height="14" rx="2"/><rect x="24" y="10" width="14" height="14" rx="2"/><rect x="38" y="24" width="14" height="14" rx="2"/><rect x="10" y="38" width="14" height="14" rx="2"/><rect x="24" y="38" width="14" height="14" rx="2"/><rect x="38" y="38" width="14" height="14" rx="2"/></svg>`,

  // Bubble Pop: cluster of four bubbles, one with a highlight dot
  'bubble-pop': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3.5"><circle cx="22" cy="22" r="11"/><circle cx="42" cy="22" r="11"/><circle cx="32" cy="42" r="11"/><circle cx="19" cy="18" r="2.5" fill="currentColor" stroke="none"/></svg>`,

  // Gem Swap: stylized cut diamond with facet lines
  'gem-swap': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"><path d="M14 24 L32 8 L50 24 L32 56 Z"/><path d="M14 24 L50 24"/><path d="M24 24 L32 8 L40 24 L32 56"/></svg>`,

  // 2048: four stacked rounded squares with a small dot motif
  '2048': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3.5"><rect x="8" y="8" width="22" height="22" rx="3"/><rect x="34" y="8" width="22" height="22" rx="3"/><rect x="8" y="34" width="22" height="22" rx="3"/><rect x="34" y="34" width="22" height="22" rx="3" fill="currentColor"/></svg>`,

  // Snake: coiled S-curve serpent body with a head dot
  snake: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 50 L12 32 Q12 20 24 20 L40 20 Q52 20 52 32 L52 44"/><circle cx="52" cy="50" r="4" fill="currentColor" stroke="none"/></svg>`,

  // Minesweeper: 3x3 grid with one flagged cell
  minesweeper: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><rect x="8" y="8" width="48" height="48" rx="3"/><line x1="24" y1="8" x2="24" y2="56"/><line x1="40" y1="8" x2="40" y2="56"/><line x1="8" y1="24" x2="56" y2="24"/><line x1="8" y1="40" x2="56" y2="40"/><path d="M30 28 L30 38 L38 32 Z" fill="currentColor" stroke="none"/><line x1="30" y1="28" x2="30" y2="42" stroke-width="2.5"/></svg>`,

  // Memory Match: two overlapping cards, front one with a heart marker
  'memory-match': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><rect x="10" y="14" width="28" height="40" rx="3" transform="rotate(-8 24 34)"/><rect x="26" y="10" width="28" height="40" rx="3"/><circle cx="40" cy="30" r="5" fill="currentColor" stroke="none"/></svg>`,

  // Sudoku: 3x3 grid with a few solid dots representing filled cells
  sudoku: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"><rect x="8" y="8" width="48" height="48" rx="3"/><line x1="24" y1="8" x2="24" y2="56"/><line x1="40" y1="8" x2="40" y2="56"/><line x1="8" y1="24" x2="56" y2="24"/><line x1="8" y1="40" x2="56" y2="40"/><circle cx="16" cy="16" r="2.5" fill="currentColor" stroke="none"/><circle cx="48" cy="16" r="2.5" fill="currentColor" stroke="none"/><circle cx="32" cy="32" r="2.5" fill="currentColor" stroke="none"/><circle cx="16" cy="48" r="2.5" fill="currentColor" stroke="none"/><circle cx="48" cy="48" r="2.5" fill="currentColor" stroke="none"/></svg>`,

  // Wordle: 5 letter tiles in a row, one filled (correct guess feel)
  wordle: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><rect x="6" y="14" width="10" height="36" rx="2"/><rect x="18" y="14" width="10" height="36" rx="2" fill="currentColor"/><rect x="30" y="14" width="10" height="36" rx="2"/><rect x="42" y="14" width="10" height="36" rx="2" fill="currentColor"/><rect x="54" y="14" width="6" height="36" rx="2"/></svg>`,

  // Lights Out: 3x3 grid with some cells "on" (filled) and some "off"
  'lights-out': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><rect x="8" y="8" width="14" height="14" rx="2" fill="currentColor"/><rect x="25" y="8" width="14" height="14" rx="2"/><rect x="42" y="8" width="14" height="14" rx="2" fill="currentColor"/><rect x="8" y="25" width="14" height="14" rx="2"/><rect x="25" y="25" width="14" height="14" rx="2" fill="currentColor"/><rect x="42" y="25" width="14" height="14" rx="2"/><rect x="8" y="42" width="14" height="14" rx="2" fill="currentColor"/><rect x="25" y="42" width="14" height="14" rx="2"/><rect x="42" y="42" width="14" height="14" rx="2" fill="currentColor"/></svg>`,

  // Stack Block: vertically stacked rounded rectangles, like a tower
  'stack-block': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><rect x="14" y="44" width="36" height="10" rx="2"/><rect x="18" y="32" width="32" height="10" rx="2"/><rect x="20" y="20" width="26" height="10" rx="2"/><rect x="24" y="8" width="20" height="10" rx="2"/></svg>`,

  // Nonogram: small 5x5 grid with some cells filled to look like a picture
  nonogram: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="14" y="14" width="36" height="36" rx="1"/><line x1="22" y1="14" x2="22" y2="50"/><line x1="30" y1="14" x2="30" y2="50"/><line x1="38" y1="14" x2="38" y2="50"/><line x1="14" y1="22" x2="50" y2="22"/><line x1="14" y1="30" x2="50" y2="30"/><line x1="14" y1="38" x2="50" y2="38"/><rect x="22" y="14" width="8" height="8" fill="currentColor"/><rect x="30" y="22" width="8" height="8" fill="currentColor"/><rect x="14" y="30" width="8" height="8" fill="currentColor"/><rect x="38" y="30" width="8" height="8" fill="currentColor"/><rect x="22" y="38" width="8" height="8" fill="currentColor"/></svg>`,

  // Word Search: grid of letters, with some highlighted to suggest a found word
  'word-search': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="currentColor" font-family="monospace" font-size="11" font-weight="700"><text x="10" y="20" opacity="0.5">A</text><text x="22" y="20" opacity="0.5">B</text><text x="34" y="20">C</text><text x="46" y="20" opacity="0.5">D</text><text x="10" y="34" opacity="0.5">E</text><text x="22" y="34">A</text><text x="34" y="34" opacity="0.5">F</text><text x="46" y="34" opacity="0.5">G</text><text x="10" y="48">T</text><text x="22" y="48" opacity="0.5">H</text><text x="34" y="48" opacity="0.5">I</text><text x="46" y="48" opacity="0.5">J</text><line x1="14" y1="50" x2="40" y2="14" stroke="currentColor" stroke-width="2.5" opacity="0.7"/></svg>`,

  // Breakout: paddle at bottom with ball, bricks at top
  breakout: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><rect x="8" y="10" width="11" height="6" rx="1"/><rect x="20" y="10" width="11" height="6" rx="1"/><rect x="32" y="10" width="11" height="6" rx="1"/><rect x="44" y="10" width="11" height="6" rx="1"/><rect x="8" y="18" width="11" height="6" rx="1" opacity="0.6"/><rect x="20" y="18" width="11" height="6" rx="1" opacity="0.6"/><rect x="32" y="18" width="11" height="6" rx="1" opacity="0.6"/><rect x="44" y="18" width="11" height="6" rx="1" opacity="0.6"/><circle cx="40" cy="38" r="4"/><rect x="20" y="50" width="24" height="5" rx="2"/></svg>`,

  // Mastermind: row of colored pegs (4 circles)
  mastermind: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3"><rect x="6" y="14" width="52" height="36" rx="6"/><circle cx="16" cy="32" r="5" fill="currentColor"/><circle cx="28" cy="32" r="5"/><circle cx="40" cy="32" r="5" fill="currentColor"/><circle cx="52" cy="32" r="5"/></svg>`,

  // Anagram: scattered letter tiles
  anagram: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" font-family="sans-serif" font-size="13" font-weight="800"><rect x="6" y="22" width="14" height="14" rx="2" transform="rotate(-8 13 29)"/><text x="13" y="34" text-anchor="middle" fill="currentColor" stroke="none" transform="rotate(-8 13 29)">W</text><rect x="20" y="14" width="14" height="14" rx="2" transform="rotate(5 27 21)"/><text x="27" y="26" text-anchor="middle" fill="currentColor" stroke="none" transform="rotate(5 27 21)">O</text><rect x="34" y="22" width="14" height="14" rx="2" transform="rotate(-3 41 29)"/><text x="41" y="34" text-anchor="middle" fill="currentColor" stroke="none" transform="rotate(-3 41 29)">R</text><rect x="44" y="34" width="14" height="14" rx="2" transform="rotate(7 51 41)"/><text x="51" y="46" text-anchor="middle" fill="currentColor" stroke="none" transform="rotate(7 51 41)">D</text></svg>`,

  // Maze Paint: a painted U-shaped trail with a ball on it
  'maze-paint': `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14 L14 46 L50 46 L50 14"/><circle cx="14" cy="14" r="5" fill="currentColor" stroke="none"/></svg>`,
};
