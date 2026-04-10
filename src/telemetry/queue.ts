/**
 * Pending telemetry queue — stores partial session data in IndexedDB
 * so it survives app kills and can be flushed on next launch.
 *
 * Used when the player backgrounds the app or the tab loses focus —
 * situations where we can't reliably await a network request.
 * On next mount, flushPendingQueue() sends everything and clears the queue.
 */

import { get, set } from 'idb-keyval';

const QUEUE_KEY = 'telemetry_pending';

export interface PendingSession {
  session_id: string;
  device_id: string;
  game_id: string;
  difficulty: number;
  score: number;
  won: boolean;
  is_daily: boolean;
  is_final: boolean;
  duration_ms: number;
  total_inputs: number;
  avg_interval_ms: number | null;
  confusion_count: number;
  misclick_count: number;
  queued_at: string; // ISO timestamp
}

/** Append a session to the pending queue in IndexedDB. Synchronous-safe:
 *  returns a promise but callers can fire-and-forget. */
export async function queueSession(session: PendingSession): Promise<void> {
  try {
    const existing = ((await get(QUEUE_KEY)) as PendingSession[] | undefined) || [];
    // Deduplicate: replace any existing entry with the same session_id
    // (e.g. multiple visibility-hidden events for the same game session).
    const filtered = existing.filter(s => s.session_id !== session.session_id);
    filtered.push(session);
    await set(QUEUE_KEY, filtered);
  } catch {
    // Swallow — telemetry must never break gameplay.
  }
}

/** Remove a specific session_id from the queue (e.g. after direct send succeeds). */
export async function removeFromQueue(sessionId: string): Promise<void> {
  try {
    const existing = ((await get(QUEUE_KEY)) as PendingSession[] | undefined) || [];
    const filtered = existing.filter(s => s.session_id !== sessionId);
    await set(QUEUE_KEY, filtered);
  } catch {
    // Swallow.
  }
}

/** Read and clear the entire pending queue. Returns the entries for the caller to send. */
export async function drainQueue(): Promise<PendingSession[]> {
  try {
    const entries = ((await get(QUEUE_KEY)) as PendingSession[] | undefined) || [];
    if (entries.length > 0) {
      await set(QUEUE_KEY, []);
    }
    return entries;
  } catch {
    return [];
  }
}
