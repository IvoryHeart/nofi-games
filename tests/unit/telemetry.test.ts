import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
}));

// Mock consent — default: no consent (telemetry inactive)
vi.mock('../../src/telemetry/consent', () => ({
  hasConsent: vi.fn(() => false),
}));

// Mock deviceId
vi.mock('../../src/telemetry/deviceId', () => ({
  getDeviceId: vi.fn(() => 'test-device-id'),
  getDeviceInfo: vi.fn(() => ({
    platform: 'desktop',
    screenW: 1920,
    screenH: 1080,
    timezone: 'UTC',
    language: 'en-US',
  })),
}));

import {
  queueSession,
  removeFromQueue,
  drainQueue,
  type PendingSession,
} from '../../src/telemetry/queue';

import {
  isActive,
  buildPendingSession,
  queuePartialSession,
} from '../../src/telemetry/client';

import { hasConsent } from '../../src/telemetry/consent';
import type { ReplayLog } from '../../src/engine/GameEngine';

// ── Helpers ──

function makePendingSession(overrides: Partial<PendingSession> = {}): PendingSession {
  return {
    session_id: 'sess-1',
    device_id: 'dev-1',
    game_id: 'snake',
    difficulty: 1,
    score: 100,
    won: false,
    is_daily: false,
    is_final: false,
    duration_ms: 5000,
    total_inputs: 20,
    avg_interval_ms: 250,
    confusion_count: 0,
    misclick_count: 0,
    queued_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeReplayLog(overrides: Partial<ReplayLog> = {}): ReplayLog {
  return {
    seed: 42,
    difficulty: 1,
    events: [
      { t: 0, kind: 'pointer-down', payload: { x: 10, y: 10 } },
      { t: 200, kind: 'pointer-up', payload: { x: 10, y: 10 } },
      { t: 1000, kind: 'key-down', payload: { key: 'ArrowUp' } },
      { t: 3000, kind: 'pointer-down', payload: { x: 50, y: 50 } },
    ],
    durationMs: 3000,
    ...overrides,
  };
}

// ── queue.ts ──

describe('Telemetry Queue (queue.ts)', () => {
  beforeEach(() => { store.clear(); });

  describe('queueSession()', () => {
    it('adds an entry to the queue', async () => {
      const session = makePendingSession();
      await queueSession(session);

      const queued = store.get('telemetry_pending') as PendingSession[];
      expect(queued).toHaveLength(1);
      expect(queued[0].session_id).toBe('sess-1');
      expect(queued[0].game_id).toBe('snake');
    });

    it('deduplicates by session_id (replaces existing)', async () => {
      const first = makePendingSession({ session_id: 'dup-1', score: 50 });
      const second = makePendingSession({ session_id: 'dup-1', score: 200 });

      await queueSession(first);
      await queueSession(second);

      const queued = store.get('telemetry_pending') as PendingSession[];
      expect(queued).toHaveLength(1);
      expect(queued[0].score).toBe(200);
    });

    it('does not deduplicate different session_ids', async () => {
      await queueSession(makePendingSession({ session_id: 'a' }));
      await queueSession(makePendingSession({ session_id: 'b' }));

      const queued = store.get('telemetry_pending') as PendingSession[];
      expect(queued).toHaveLength(2);
    });
  });

  describe('removeFromQueue()', () => {
    it('removes only the specified session', async () => {
      await queueSession(makePendingSession({ session_id: 'keep' }));
      await queueSession(makePendingSession({ session_id: 'remove-me' }));
      await queueSession(makePendingSession({ session_id: 'also-keep' }));

      await removeFromQueue('remove-me');

      const queued = store.get('telemetry_pending') as PendingSession[];
      expect(queued).toHaveLength(2);
      expect(queued.map(s => s.session_id)).toEqual(['keep', 'also-keep']);
    });

    it('is a no-op when session_id is not found', async () => {
      await queueSession(makePendingSession({ session_id: 'existing' }));
      await removeFromQueue('non-existent');

      const queued = store.get('telemetry_pending') as PendingSession[];
      expect(queued).toHaveLength(1);
      expect(queued[0].session_id).toBe('existing');
    });
  });

  describe('drainQueue()', () => {
    it('returns all entries and clears the queue', async () => {
      await queueSession(makePendingSession({ session_id: 's1' }));
      await queueSession(makePendingSession({ session_id: 's2' }));
      await queueSession(makePendingSession({ session_id: 's3' }));

      const drained = await drainQueue();
      expect(drained).toHaveLength(3);
      expect(drained.map(s => s.session_id)).toEqual(['s1', 's2', 's3']);

      // Queue should be empty after drain
      const remaining = store.get('telemetry_pending') as PendingSession[];
      expect(remaining).toEqual([]);
    });

    it('returns empty array when queue is empty', async () => {
      const drained = await drainQueue();
      expect(drained).toEqual([]);
    });

    it('returns empty array when key does not exist in store', async () => {
      // store has nothing — no telemetry_pending key
      const drained = await drainQueue();
      expect(drained).toEqual([]);
      // Should not have written anything since there were no entries
      expect(store.has('telemetry_pending')).toBe(false);
    });
  });

  describe('multiple sessions', () => {
    it('queues six sessions independently', async () => {
      for (let i = 1; i <= 6; i++) {
        await queueSession(makePendingSession({
          session_id: `sess-${i}`,
          game_id: `game-${i}`,
          score: i * 100,
        }));
      }

      const queued = store.get('telemetry_pending') as PendingSession[];
      expect(queued).toHaveLength(6);
      expect(queued[0].session_id).toBe('sess-1');
      expect(queued[5].session_id).toBe('sess-6');
      expect(queued[5].score).toBe(600);
    });
  });
});

// ── client.ts ──

describe('Telemetry Client (client.ts)', () => {
  beforeEach(() => {
    store.clear();
    vi.mocked(hasConsent).mockReturnValue(false);
  });

  describe('isActive()', () => {
    it('returns false when consent is off', () => {
      vi.mocked(hasConsent).mockReturnValue(false);
      expect(isActive()).toBe(false);
    });

    it('requires consent to be true', () => {
      // When consent is granted and env vars are present, isActive is true.
      // When consent is off, isActive is false — this is the primary guard.
      vi.mocked(hasConsent).mockReturnValue(true);
      // Result depends on whether VITE_SUPABASE_* env vars are set.
      // In CI/local with .env.local, they are present, so isActive() = true.
      // Without them, isActive() = false. We test the consent gate here.
      const result = isActive();
      // At minimum, flipping consent off should always disable telemetry.
      vi.mocked(hasConsent).mockReturnValue(false);
      expect(isActive()).toBe(false);
    });
  });

  describe('buildPendingSession()', () => {
    it('returns null when isActive is false', () => {
      const result = buildPendingSession({
        sessionId: 'test-session',
        gameId: 'snake',
        difficulty: 1,
        score: 500,
        won: true,
        isDaily: false,
        isFinal: true,
        replayLog: makeReplayLog(),
      });
      expect(result).toBeNull();
    });

    it('returns null when consent is off even with valid replay log', () => {
      vi.mocked(hasConsent).mockReturnValue(false);
      const result = buildPendingSession({
        sessionId: 's1',
        gameId: '2048',
        difficulty: 2,
        score: 1000,
        won: false,
        isDaily: true,
        isFinal: false,
        replayLog: makeReplayLog({ durationMs: 10000 }),
      });
      expect(result).toBeNull();
    });
  });

  describe('queuePartialSession()', () => {
    it('does not queue when telemetry is inactive', async () => {
      queuePartialSession({
        sessionId: 'partial-1',
        gameId: 'wordle',
        difficulty: 1,
        score: 0,
        won: false,
        isDaily: false,
        replayLog: makeReplayLog(),
      });

      // Give the fire-and-forget promise a tick to settle
      await new Promise(r => setTimeout(r, 0));

      // Nothing should be queued since isActive() is false
      expect(store.has('telemetry_pending')).toBe(false);
    });
  });
});
