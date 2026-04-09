#!/usr/bin/env node
/**
 * Telemetry analysis dashboard.
 *
 * Queries Supabase for real player data and prints key metrics:
 * - Win rate by game + difficulty
 * - Average session duration
 * - Confusion hotspots (games with high pause counts)
 * - Player retention (unique devices per day)
 * - Score distributions
 *
 * Uses the Supabase Management API (same as migrations) so it can
 * read all data regardless of RLS. Requires SUPABASE_ACCESS_TOKEN.
 *
 * Usage:
 *   npm run analyze
 *   SUPABASE_ACCESS_TOKEN=xxx npm run analyze
 */

import { readFileSync } from 'fs';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || 'ppyauaqitrdcetcodkqv';

if (!TOKEN) {
  // Try reading from .env.local
  try {
    const envFile = readFileSync('.env.local', 'utf-8');
    const match = envFile.match(/SUPABASE_ACCESS_TOKEN=(.+)/);
    if (match && match[1].trim()) {
      process.env.SUPABASE_ACCESS_TOKEN = match[1].trim();
    }
  } catch { /* ignore */ }
}

const FINAL_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!FINAL_TOKEN) {
  console.error('❌  SUPABASE_ACCESS_TOKEN not set. Pass it as an env var or add to .env.local');
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function query(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FINAL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Query failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  NoFi.Games — Telemetry Dashboard');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Total sessions + unique devices
  try {
    const overview = await query(`
      SELECT
        COUNT(*) AS total_sessions,
        COUNT(DISTINCT device_id) AS unique_devices,
        COUNT(*) FILTER (WHERE won = true) AS wins,
        ROUND(AVG(duration_ms) / 1000.0, 1) AS avg_duration_s,
        ROUND(AVG(confusion_count), 1) AS avg_confusion
      FROM play_sessions
    `);
    console.log('  📊 Overview');
    console.log('  ' + JSON.stringify(overview, null, 2).split('\n').join('\n  '));
  } catch (e) {
    console.log('  📊 Overview: no data yet or query error:', e.message);
  }

  // 2. Win rate by game + difficulty
  try {
    const winRates = await query(`
      SELECT
        game_id,
        difficulty,
        COUNT(*) AS plays,
        ROUND(100.0 * COUNT(*) FILTER (WHERE won) / NULLIF(COUNT(*), 0), 1) AS win_pct,
        ROUND(AVG(score), 0) AS avg_score,
        ROUND(AVG(duration_ms) / 1000.0, 1) AS avg_dur_s,
        ROUND(AVG(confusion_count), 1) AS avg_confusion
      FROM play_sessions
      GROUP BY game_id, difficulty
      ORDER BY game_id, difficulty
    `);
    console.log('\n  🎮 Win Rates by Game + Difficulty');
    console.log('  ' + JSON.stringify(winRates, null, 2).split('\n').join('\n  '));
  } catch (e) {
    console.log('\n  🎮 Win Rates: no data yet or query error:', e.message);
  }

  // 3. Most played games
  try {
    const popular = await query(`
      SELECT game_id, COUNT(*) AS plays,
             COUNT(DISTINCT device_id) AS unique_players
      FROM play_sessions
      GROUP BY game_id
      ORDER BY plays DESC
      LIMIT 10
    `);
    console.log('\n  🔥 Most Played Games');
    console.log('  ' + JSON.stringify(popular, null, 2).split('\n').join('\n  '));
  } catch (e) {
    console.log('\n  🔥 Most Played: no data yet');
  }

  // 4. Confusion hotspots (games where players pause a lot)
  try {
    const confusion = await query(`
      SELECT game_id, difficulty,
             ROUND(AVG(confusion_count), 1) AS avg_confusion,
             COUNT(*) AS sample_size
      FROM play_sessions
      WHERE confusion_count > 0
      GROUP BY game_id, difficulty
      HAVING COUNT(*) >= 3
      ORDER BY avg_confusion DESC
      LIMIT 10
    `);
    console.log('\n  🤔 Confusion Hotspots (games where players pause >5s often)');
    console.log('  ' + JSON.stringify(confusion, null, 2).split('\n').join('\n  '));
  } catch (e) {
    console.log('\n  🤔 Confusion Hotspots: no data yet');
  }

  // 5. Daily active devices (last 7 days)
  try {
    const daily = await query(`
      SELECT DATE(started_at) AS day,
             COUNT(DISTINCT device_id) AS devices,
             COUNT(*) AS sessions
      FROM play_sessions
      WHERE started_at > now() - interval '7 days'
      GROUP BY day
      ORDER BY day DESC
    `);
    console.log('\n  📅 Daily Active (last 7 days)');
    console.log('  ' + JSON.stringify(daily, null, 2).split('\n').join('\n  '));
  } catch (e) {
    console.log('\n  📅 Daily Active: no data yet');
  }

  // 6. Device breakdown
  try {
    const devices = await query(`
      SELECT platform, COUNT(*) AS count
      FROM devices
      GROUP BY platform
      ORDER BY count DESC
    `);
    console.log('\n  📱 Devices by Platform');
    console.log('  ' + JSON.stringify(devices, null, 2).split('\n').join('\n  '));
  } catch (e) {
    console.log('\n  📱 Devices: no data yet');
  }

  // 7. Replay log stats
  try {
    const replays = await query(`
      SELECT COUNT(*) AS total_replays,
             ROUND(AVG(jsonb_array_length(events)), 0) AS avg_events_per_replay
      FROM replay_logs
    `);
    console.log('\n  🎬 Replay Logs');
    console.log('  ' + JSON.stringify(replays, null, 2).split('\n').join('\n  '));
  } catch (e) {
    console.log('\n  🎬 Replay Logs: no data yet');
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('❌  Analysis failed:', err.message);
  process.exit(1);
});
