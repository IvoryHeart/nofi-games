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

const MISCLICK_TIME_MS = 200;
const MISCLICK_DIST_PX = 10;

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
    misclickCount: countMisclicks(events),
    durationMs: log.durationMs ?? 0,
  };
}

function countMisclicks(events: GameEvent[]): number {
  const pointerDowns = events.filter(e => e.kind === 'pointer-down');
  let count = 0;
  for (let i = 1; i < pointerDowns.length; i++) {
    const prev = pointerDowns[i - 1];
    const curr = pointerDowns[i];
    if (curr.t - prev.t >= MISCLICK_TIME_MS) continue;
    const dx = (curr.payload.x as number) - (prev.payload.x as number);
    const dy = (curr.payload.y as number) - (prev.payload.y as number);
    if (Math.sqrt(dx * dx + dy * dy) < MISCLICK_DIST_PX) {
      count++;
    }
  }
  return count;
}

/** Filter to just player-initiated actions (not passive moves or system events). */
function isPlayerInput(e: GameEvent): boolean {
  return e.kind === 'key-down' || e.kind === 'pointer-down' || e.kind === 'pointer-up';
}
