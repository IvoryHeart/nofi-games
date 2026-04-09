-- NoFi.Games telemetry schema
-- Idempotent: safe to run multiple times (IF NOT EXISTS / OR REPLACE).
-- Applied automatically by scripts/migrate.mjs on deploy.

-- ══════════════════════════════════════════════════════════════════
-- 1. Devices — anonymous player profiles (one per browser)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS devices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   TEXT UNIQUE NOT NULL,   -- client-generated UUID in localStorage
  created_at  TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  -- Device characteristics for player segmentation
  platform    TEXT,         -- 'mobile' | 'desktop' | 'tablet'
  screen_w    INT,
  screen_h    INT,
  timezone    TEXT,
  language    TEXT
);

-- ══════════════════════════════════════════════════════════════════
-- 2. Play sessions — one row per game played (~200 bytes each)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS play_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       TEXT NOT NULL,
  game_id         TEXT NOT NULL,
  difficulty      INT NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  duration_ms     INT,
  score           INT DEFAULT 0,
  won             BOOLEAN DEFAULT false,
  is_daily        BOOLEAN DEFAULT false,
  -- Aggregated metrics computed from the replay log client-side
  total_inputs    INT DEFAULT 0,
  avg_interval_ms FLOAT,            -- average ms between inputs
  confusion_count INT DEFAULT 0,    -- pauses > 5 seconds
  misclick_count  INT DEFAULT 0     -- inputs with no game-state effect
);

-- Index for analytics queries (game-level stats, per-device history)
CREATE INDEX IF NOT EXISTS idx_sessions_game ON play_sessions(game_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON play_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_daily ON play_sessions(is_daily, started_at);

-- ══════════════════════════════════════════════════════════════════
-- 3. Replay logs — full event streams (heavier, stored selectively)
--    Only for: daily puzzles, shared replays, reported bugs.
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS replay_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES play_sessions(id) ON DELETE CASCADE,
  seed        INT,
  events      JSONB NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_replays_session ON replay_logs(session_id);

-- ══════════════════════════════════════════════════════════════════
-- 4. Row Level Security — anon can INSERT, read only own rows
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE replay_logs ENABLE ROW LEVEL SECURITY;

-- Devices: anyone can register a device, read/update only their own.
-- DROP + CREATE makes this idempotent (CREATE POLICY has no IF NOT EXISTS).
DROP POLICY IF EXISTS "devices_insert" ON devices;
CREATE POLICY "devices_insert" ON devices
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "devices_select_own" ON devices;
CREATE POLICY "devices_select_own" ON devices
  FOR SELECT USING (device_id = current_setting('request.jwt.claims', true)::json->>'device_id');

-- Play sessions: anyone can insert, read only their own
DROP POLICY IF EXISTS "sessions_insert" ON play_sessions;
CREATE POLICY "sessions_insert" ON play_sessions
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "sessions_select_own" ON play_sessions;
CREATE POLICY "sessions_select_own" ON play_sessions
  FOR SELECT USING (device_id = current_setting('request.jwt.claims', true)::json->>'device_id');

-- Replay logs: anyone can insert, no public reads (only service role for analytics)
DROP POLICY IF EXISTS "replays_insert" ON replay_logs;
CREATE POLICY "replays_insert" ON replay_logs
  FOR INSERT WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════
-- 5. Helper: update last_seen_at on device upsert
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION upsert_device(
  p_device_id TEXT,
  p_platform TEXT DEFAULT NULL,
  p_screen_w INT DEFAULT NULL,
  p_screen_h INT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_language TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO devices (device_id, platform, screen_w, screen_h, timezone, language)
  VALUES (p_device_id, p_platform, p_screen_w, p_screen_h, p_timezone, p_language)
  ON CONFLICT (device_id)
  DO UPDATE SET
    last_seen_at = now(),
    platform = COALESCE(EXCLUDED.platform, devices.platform),
    screen_w = COALESCE(EXCLUDED.screen_w, devices.screen_w),
    screen_h = COALESCE(EXCLUDED.screen_h, devices.screen_h),
    timezone = COALESCE(EXCLUDED.timezone, devices.timezone),
    language = COALESCE(EXCLUDED.language, devices.language)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
