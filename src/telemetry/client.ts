/**
 * Telemetry client — sends anonymized play data to Supabase.
 *
 * Architecture:
 *   - Client-side only. Uses the Supabase anon key (safe for public code).
 *   - RLS policies restrict anon to INSERT-only (no reads of other players).
 *   - Zero data sent if consent is off.
 *   - All operations are fire-and-forget with error swallowing — telemetry
 *     must NEVER break gameplay or slow down the app.
 *
 * Credentials come from Vite env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY),
 * which are inlined at build time. They're NOT in the source code.
 */

import { hasConsent } from './consent';
import { getDeviceId, getDeviceInfo } from './deviceId';
import { enrichSession, type SessionMetrics } from './enrich';
import type { ReplayLog } from '../engine/GameEngine';

// Read from Vite env vars — these are empty strings if not set.
const SUPABASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY || '';

/** Whether the telemetry pipeline is operational (credentials present + consent given). */
export function isActive(): boolean {
  return !!(SUPABASE_URL && SUPABASE_KEY && hasConsent());
}

/** POST to the Supabase REST API. Swallows all errors. */
async function post(table: string, body: Record<string, unknown>): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Swallow — telemetry must never break gameplay.
  }
}

/** Register or update the anonymous device profile. Called once on app mount. */
export async function registerDevice(): Promise<void> {
  if (!isActive()) return;
  const info = getDeviceInfo();
  const deviceId = getDeviceId();
  // Use the upsert_device RPC function (created in the migration).
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        p_device_id: deviceId,
        p_platform: info.platform,
        p_screen_w: info.screenW,
        p_screen_h: info.screenH,
        p_timezone: info.timezone,
        p_language: info.language,
      }),
    });
  } catch {
    // Swallow.
  }
}

/** Send a play session summary. Called on game-over and win. */
export async function sendSession(opts: {
  gameId: string;
  difficulty: number;
  score: number;
  won: boolean;
  isDaily: boolean;
  replayLog: ReplayLog;
}): Promise<void> {
  if (!isActive()) return;

  const metrics: SessionMetrics = enrichSession(opts.replayLog);
  const deviceId = getDeviceId();

  await post('play_sessions', {
    device_id: deviceId,
    game_id: opts.gameId,
    difficulty: opts.difficulty,
    score: opts.score,
    won: opts.won,
    is_daily: opts.isDaily,
    duration_ms: metrics.durationMs,
    total_inputs: metrics.totalInputs,
    avg_interval_ms: metrics.avgIntervalMs,
    confusion_count: metrics.confusionCount,
    misclick_count: metrics.misclickCount,
    ended_at: new Date().toISOString(),
  });

  // Store the full replay log for every session. Enables:
  // - Anti-cheat: verify any claimed high score by replaying the log
  // - Seed quality analysis (daily puzzles)
  // - Debugging: "what did the player do before this crash?"
  // - Future replay viewer
  // Size is ~2-50KB per session, manageable at current scale.
  await post('replay_logs', {
    seed: opts.replayLog.seed ?? null,
    events: opts.replayLog.events,
  });
}
