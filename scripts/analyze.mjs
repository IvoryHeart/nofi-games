#!/usr/bin/env node
/**
 * Telemetry analysis dashboard — outputs clean Markdown tables.
 *
 * Usage:
 *   npm run analyze              # print to console
 *   npm run analyze -- --md      # output raw markdown (for GitHub Issues)
 */

import { readFileSync } from 'fs';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || (() => {
  try {
    const f = readFileSync('.env.local', 'utf-8');
    const m = f.match(/SUPABASE_ACCESS_TOKEN=(.+)/);
    return m?.[1]?.trim() || '';
  } catch { return ''; }
})();

const REF = process.env.SUPABASE_PROJECT_REF || 'ppyauaqitrdcetcodkqv';

if (!TOKEN) {
  console.error('❌  SUPABASE_ACCESS_TOKEN not set. Pass it as an env var or add to .env.local');
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function query(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Query failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  // Supabase Management API returns an array of row objects
  return Array.isArray(data) ? data : [];
}

/** Format rows as a markdown table. */
function table(rows, columns) {
  if (!rows || rows.length === 0) return '_No data yet._\n';
  const cols = columns || Object.keys(rows[0]);
  const header = '| ' + cols.join(' | ') + ' |';
  const sep = '| ' + cols.map(() => '---').join(' | ') + ' |';
  const body = rows.map(r => '| ' + cols.map(c => r[c] ?? '—').join(' | ') + ' |').join('\n');
  return header + '\n' + sep + '\n' + body + '\n';
}

const DIFF = ['Easy', 'Medium', 'Hard', 'Extra Hard'];

async function main() {
  const sections = [];

  sections.push('## 📊 Overview\n');
  try {
    const rows = await query(`
      SELECT COUNT(*) AS total_sessions,
             COUNT(DISTINCT device_id) AS unique_players,
             COUNT(*) FILTER (WHERE won) AS total_wins,
             ROUND(100.0 * COUNT(*) FILTER (WHERE won) / NULLIF(COUNT(*), 0), 1) AS win_pct,
             ROUND(AVG(duration_ms) / 1000.0, 1) AS avg_duration_s
      FROM play_sessions
    `);
    if (rows.length > 0) {
      const r = rows[0];
      sections.push(`- **Sessions**: ${r.total_sessions}  |  **Players**: ${r.unique_players}  |  **Wins**: ${r.total_wins} (${r.win_pct}%)  |  **Avg duration**: ${r.avg_duration_s}s\n`);
    } else {
      sections.push('_No sessions recorded yet._\n');
    }
  } catch (e) { sections.push(`_Query error: ${e.message}_\n`); }

  sections.push('\n## 🎮 Win Rates by Game & Difficulty\n');
  try {
    const rows = await query(`
      SELECT game_id AS game, difficulty AS diff,
             COUNT(*) AS plays,
             ROUND(100.0 * COUNT(*) FILTER (WHERE won) / NULLIF(COUNT(*), 0), 1) AS win_pct,
             ROUND(AVG(score), 0) AS avg_score,
             MAX(score) AS best_score,
             ROUND(AVG(duration_ms) / 1000.0, 1) AS avg_dur_s,
             ROUND(AVG(confusion_count), 1) AS confusion
      FROM play_sessions
      GROUP BY game_id, difficulty
      ORDER BY game_id, difficulty
    `);
    // Replace difficulty numbers with labels
    for (const r of rows) { r.diff = DIFF[r.diff] || r.diff; }
    sections.push(table(rows, ['game', 'diff', 'plays', 'win_pct', 'avg_score', 'best_score', 'avg_dur_s', 'confusion']));
  } catch (e) { sections.push(`_Query error: ${e.message}_\n`); }

  sections.push('\n## 🔥 Most Played\n');
  try {
    const rows = await query(`
      SELECT game_id AS game, COUNT(*) AS plays,
             COUNT(DISTINCT device_id) AS players,
             ROUND(100.0 * COUNT(*) FILTER (WHERE won) / NULLIF(COUNT(*), 0), 1) AS win_pct
      FROM play_sessions GROUP BY game_id ORDER BY plays DESC LIMIT 10
    `);
    sections.push(table(rows, ['game', 'plays', 'players', 'win_pct']));
  } catch (e) { sections.push(`_Query error: ${e.message}_\n`); }

  sections.push('\n## 🤔 Confusion Hotspots\n');
  sections.push('_Games where players pause >5 seconds frequently (possible UX friction):_\n\n');
  try {
    const rows = await query(`
      SELECT game_id AS game, difficulty AS diff,
             ROUND(AVG(confusion_count), 1) AS avg_confusion,
             COUNT(*) AS sample
      FROM play_sessions WHERE confusion_count > 0
      GROUP BY game_id, difficulty HAVING COUNT(*) >= 2
      ORDER BY avg_confusion DESC LIMIT 10
    `);
    for (const r of rows) { r.diff = DIFF[r.diff] || r.diff; }
    sections.push(table(rows, ['game', 'diff', 'avg_confusion', 'sample']));
  } catch (e) { sections.push(`_Query error: ${e.message}_\n`); }

  sections.push('\n## 📅 Daily Active (last 7 days)\n');
  try {
    const rows = await query(`
      SELECT DATE(started_at) AS day,
             COUNT(DISTINCT device_id) AS players,
             COUNT(*) AS sessions
      FROM play_sessions WHERE started_at > now() - interval '7 days'
      GROUP BY day ORDER BY day DESC
    `);
    sections.push(table(rows, ['day', 'players', 'sessions']));
  } catch (e) { sections.push(`_Query error: ${e.message}_\n`); }

  sections.push('\n## 📱 Platform Split\n');
  try {
    const rows = await query(`
      SELECT platform, COUNT(*) AS devices FROM devices GROUP BY platform ORDER BY devices DESC
    `);
    sections.push(table(rows, ['platform', 'devices']));
  } catch (e) { sections.push(`_Query error: ${e.message}_\n`); }

  sections.push('\n## ⚠️ Balance Warnings\n');
  try {
    const rows = await query(`
      SELECT game_id AS game, difficulty AS diff,
             COUNT(*) AS plays,
             ROUND(100.0 * COUNT(*) FILTER (WHERE won) / NULLIF(COUNT(*), 0), 1) AS win_pct,
             ROUND(AVG(confusion_count), 1) AS confusion
      FROM play_sessions
      GROUP BY game_id, difficulty
      HAVING COUNT(*) >= 3
      ORDER BY game_id, difficulty
    `);
    const warnings = [];
    for (const r of rows) {
      const d = DIFF[r.diff] || r.diff;
      if (r.diff === 0 && parseFloat(r.win_pct) < 40)
        warnings.push(`- ⚠️ **${r.game}** ${d}: ${r.win_pct}% win rate — may be too hard for beginners`);
      if (r.diff >= 2 && parseFloat(r.win_pct) > 80)
        warnings.push(`- ⚠️ **${r.game}** ${d}: ${r.win_pct}% win rate — may be too easy`);
      if (parseFloat(r.confusion) > 3)
        warnings.push(`- 🤔 **${r.game}** ${d}: ${r.confusion} avg confusion moments — UX friction?`);
    }
    sections.push(warnings.length > 0 ? warnings.join('\n') + '\n' : '_No balance issues detected with sufficient data._\n');
  } catch (e) { sections.push(`_Query error: ${e.message}_\n`); }

  console.log(sections.join('\n'));
}

main().catch(err => {
  console.error('❌  Analysis failed:', err.message);
  process.exit(1);
});
