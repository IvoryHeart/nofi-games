/**
 * Format autoplay results into a readable report.
 */

import type { PlayResult } from './runner';

export interface GameReport {
  gameId: string;
  difficulty: number;
  rounds: number;
  winRate: number;
  avgScore: number;
  medianScore: number;
  maxScore: number;
  avgDuration: string;
  avgInputs: number;
  avgConfusion: number;
  crashCount: number;
}

export function summarize(results: PlayResult[], gameId: string, difficulty: number): GameReport {
  const filtered = results.filter((r) => r.gameId === gameId && r.difficulty === difficulty);
  if (filtered.length === 0) {
    return {
      gameId, difficulty, rounds: 0,
      winRate: 0, avgScore: 0, medianScore: 0, maxScore: 0,
      avgDuration: '0s', avgInputs: 0, avgConfusion: 0, crashCount: 0,
    };
  }

  const scores = filtered.map((r) => r.score).sort((a, b) => a - b);
  const wins = filtered.filter((r) => r.won).length;
  const totalDuration = filtered.reduce((s, r) => s + r.durationMs, 0);
  const totalInputs = filtered.reduce((s, r) => s + r.totalInputs, 0);
  const totalConfusion = filtered.reduce((s, r) => s + r.confusionMoments, 0);

  return {
    gameId,
    difficulty,
    rounds: filtered.length,
    winRate: wins / filtered.length,
    avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / filtered.length),
    medianScore: scores[Math.floor(scores.length / 2)],
    maxScore: scores[scores.length - 1],
    avgDuration: formatDuration(totalDuration / filtered.length),
    avgInputs: Math.round(totalInputs / filtered.length),
    avgConfusion: Math.round((totalConfusion / filtered.length) * 10) / 10,
    crashCount: 0,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

const DIFF_LABELS = ['Easy', 'Medium', 'Hard', 'Extra Hard'];

export function printReport(reports: GameReport[]): void {
  console.log('\n' + '═'.repeat(80));
  console.log('  NoFi.Games Auto-Play Report');
  console.log('═'.repeat(80));

  for (const r of reports) {
    const bar = '█'.repeat(Math.round(r.winRate * 20)).padEnd(20, '░');
    console.log(`\n  ${r.gameId} (${DIFF_LABELS[r.difficulty] || `Diff ${r.difficulty}`})`);
    console.log(`  ├── Rounds:    ${r.rounds}`);
    console.log(`  ├── Win rate:  ${(r.winRate * 100).toFixed(1)}% ${bar}`);
    console.log(`  ├── Score:     avg ${r.avgScore} / median ${r.medianScore} / max ${r.maxScore}`);
    console.log(`  ├── Duration:  ${r.avgDuration} avg`);
    console.log(`  ├── Inputs:    ${r.avgInputs} avg per game`);
    console.log(`  └── Confusion: ${r.avgConfusion} avg (pauses > 5s)`);
  }

  console.log('\n' + '═'.repeat(80));

  // Flag potential balance issues
  const issues: string[] = [];
  for (const r of reports) {
    if (r.rounds === 0) continue;
    if (r.difficulty === 0 && r.winRate < 0.3) {
      issues.push(`⚠️  ${r.gameId} Easy has ${(r.winRate * 100).toFixed(0)}% win rate — may be too hard for beginners`);
    }
    if (r.difficulty === 2 && r.winRate > 0.8) {
      issues.push(`⚠️  ${r.gameId} Hard has ${(r.winRate * 100).toFixed(0)}% win rate — may be too easy`);
    }
    if (r.avgConfusion > 3) {
      issues.push(`🤔  ${r.gameId} (${DIFF_LABELS[r.difficulty]}) averages ${r.avgConfusion} confusion moments — UX friction?`);
    }
  }

  if (issues.length > 0) {
    console.log('\n  Balance insights:');
    for (const issue of issues) {
      console.log(`  ${issue}`);
    }
  } else {
    console.log('\n  ✅ No obvious balance issues detected.');
  }

  console.log('');
}
