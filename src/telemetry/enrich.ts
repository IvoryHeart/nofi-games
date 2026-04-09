/**
 * Session enrichment: compute analytics metrics from a ReplayLog.
 *
 * These derived values are sent with the play session summary so the
 * analytics dashboard doesn't need to re-process the raw event stream.
 */

import type { ReplayLog, GameEvent } from '../engine/GameEngine';

export interface SessionMetrics {
  totalInputs: number;
  avgIntervalMs: number | null;
  confusionCount: number;  // pauses > CONFUSION_THRESHOLD_MS between inputs
  misclickCount: number;   // inputs that didn't change game state (future: needs game cooperation)
  durationMs: number;
}

/** A pause longer than this between consecutive inputs is a "confusion moment". */
const CONFUSION_THRESHOLD_MS = 5000;

/** Compute session-level metrics from the raw event stream. */
export function enrichSession(log: ReplayLog): SessionMetrics {
  const events = log.events;
  const inputs = events.filter(isPlayerInput);

  let confusionCount = 0;
  let totalGap = 0;
  let gapCount = 0;

  for (let i = 1; i < inputs.length; i++) {
    const gap = inputs[i].t - inputs[i - 1].t;
    totalGap += gap;
    gapCount++;
    if (gap >= CONFUSION_THRESHOLD_MS) {
      confusionCount++;
    }
  }

  return {
    totalInputs: inputs.length,
    avgIntervalMs: gapCount > 0 ? totalGap / gapCount : null,
    confusionCount,
    misclickCount: 0, // Placeholder — needs game-level cooperation to detect no-ops
    durationMs: log.durationMs ?? 0,
  };
}

/** Filter to just player-initiated actions (not passive moves or system events). */
function isPlayerInput(e: GameEvent): boolean {
  return e.kind === 'key-down' || e.kind === 'pointer-down' || e.kind === 'pointer-up';
}
