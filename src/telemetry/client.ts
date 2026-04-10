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
import { queueSession, removeFromQueue, drainQueue, type PendingSession } from './queue';
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

/** Send a play session summary. Called on game-over, win, and exit/pause.
 *  `sessionId` ties partial + final events for the same play session.
 *  `isFinal` distinguishes a completed game from a mid-game checkpoint. */
export async function sendSession(opts: {
  sessionId: string;
  gameId: string;
  difficulty: number;
  score: number;
  won: boolean;
  isDaily: boolean;
  isFinal: boolean;
  replayLog: ReplayLog;
}): Promise<void> {
  if (!isActive()) return;

  const metrics: SessionMetrics = enrichSession(opts.replayLog);
  const deviceId = getDeviceId();

  await post('play_sessions', {
    session_id: opts.sessionId,
    device_id: deviceId,
    game_id: opts.gameId,
    difficulty: opts.difficulty,
    score: opts.score,
    won: opts.won,
    is_daily: opts.isDaily,
    is_final: opts.isFinal,
    duration_ms: metrics.durationMs,
    total_inputs: metrics.totalInputs,
    avg_interval_ms: metrics.avgIntervalMs,
    confusion_count: metrics.confusionCount,
    misclick_count: metrics.misclickCount,
    ended_at: new Date().toISOString(),
  });

  // Store the full replay log only for final sessions. Partials don't need
  // the full event stream — the final one will capture everything.
  // session_id_ext links to our client-generated session UUID (not the
  // server-generated play_sessions.id FK).
  if (opts.isFinal) {
    await post('replay_logs', {
      session_id_ext: opts.sessionId,
      seed: opts.replayLog.seed ?? null,
      events: opts.replayLog.events,
    });
  }
}

/** Build a PendingSession payload from current game state.
 *  Used by the app shell to queue telemetry when it can't await network. */
export function buildPendingSession(opts: {
  sessionId: string;
  gameId: string;
  difficulty: number;
  score: number;
  won: boolean;
  isDaily: boolean;
  isFinal: boolean;
  replayLog: ReplayLog;
}): PendingSession | null {
  if (!isActive()) return null;

  const metrics = enrichSession(opts.replayLog);
  return {
    session_id: opts.sessionId,
    device_id: getDeviceId(),
    game_id: opts.gameId,
    difficulty: opts.difficulty,
    score: opts.score,
    won: opts.won,
    is_daily: opts.isDaily,
    is_final: opts.isFinal,
    duration_ms: metrics.durationMs,
    total_inputs: metrics.totalInputs,
    avg_interval_ms: metrics.avgIntervalMs,
    confusion_count: metrics.confusionCount,
    misclick_count: metrics.misclickCount,
    queued_at: new Date().toISOString(),
  };
}

/** Queue a partial session to IndexedDB (fire-and-forget safe). */
export function queuePartialSession(opts: {
  sessionId: string;
  gameId: string;
  difficulty: number;
  score: number;
  won: boolean;
  isDaily: boolean;
  replayLog: ReplayLog;
}): void {
  const pending = buildPendingSession({ ...opts, isFinal: false });
  if (pending) void queueSession(pending);
}

/** Flush any pending sessions from IndexedDB. Called on app mount. */
export async function flushPendingQueue(): Promise<void> {
  if (!isActive()) return;
  const entries = await drainQueue();
  for (const entry of entries) {
    const { queued_at, ...rest } = entry;
    await post('play_sessions', { ...rest, ended_at: queued_at });
  }
}

/** Remove a session from the pending queue (called after direct send). */
export { removeFromQueue } from './queue';
