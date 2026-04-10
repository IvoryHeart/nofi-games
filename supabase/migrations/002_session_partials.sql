-- Add session_id and is_final to play_sessions for mid-game telemetry.
--
-- session_id: ties partial (mid-game) and final (game-over/win) rows for
--   the same play session. Multiple rows per session are expected — the
--   analysis layer filters on is_final for clean stats, or includes
--   partials for abandonment / long-game analysis.
--
-- is_final: false for checkpoints sent on back-button / visibility-hidden,
--   true for game-over and win events.

-- Add columns (IF NOT EXISTS not supported for ADD COLUMN before PG 11,
-- but Supabase runs PG 15+, and the migrate script is idempotent at the
-- file level — re-running is safe because ALTER ADD COLUMN IF NOT EXISTS
-- is supported.)
ALTER TABLE play_sessions
  ADD COLUMN IF NOT EXISTS session_id  UUID,
  ADD COLUMN IF NOT EXISTS is_final    BOOLEAN DEFAULT true;

-- Index for grouping partials + finals by session
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON play_sessions(session_id);

-- Also add session_id to replay_logs so we can link replays to sessions
-- without relying on the foreign-key reference to play_sessions.id.
-- The client sends session_id as a plain UUID, not a FK reference.
ALTER TABLE replay_logs
  ADD COLUMN IF NOT EXISTS session_id_ext UUID;

CREATE INDEX IF NOT EXISTS idx_replays_session_ext ON replay_logs(session_id_ext);
