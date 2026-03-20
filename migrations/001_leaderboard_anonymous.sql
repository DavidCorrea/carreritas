-- Migration: anonymous leaderboard rows, no per-user uniqueness, optional series linkage.
-- Run once against an existing DB that has the legacy schema (users + best_times + challenge_times).
--
-- Before running: back up the database (pg_dump or Neon snapshot).
-- Fresh databases should use schema.sql only — do not run this file.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'best_times' AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'best_times has no user_id column — migration already applied or schema is new. Skip this file.';
  END IF;
END $$;

BEGIN;

-- 1) New columns on best_times
ALTER TABLE best_times
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS series_run_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS car_settings JSONB NULL;

-- 2) Backfill display_name from linked user (leaderboard will show these names after migration)
UPDATE best_times b
SET display_name = u.username
FROM users u
WHERE u.id = b.user_id
  AND b.display_name IS NULL;

-- Orphan rows (should not exist if FK was enforced)
UPDATE best_times
SET display_name = 'unknown'
WHERE display_name IS NULL;

ALTER TABLE best_times
  ALTER COLUMN display_name SET NOT NULL;

-- 3) Drop foreign key to users (rows are no longer owned by an account)
ALTER TABLE best_times
  DROP CONSTRAINT IF EXISTS best_times_user_id_fkey;

-- 4) Drop per-user uniqueness so many rows can share the same track descriptor
ALTER TABLE best_times
  DROP CONSTRAINT IF EXISTS best_times_user_id_track_code_laps_reversed_night_mode_key;

-- 5) Remove user_id
ALTER TABLE best_times
  DROP COLUMN IF EXISTS user_id;

-- 6) Leaderboard index (recreate if you prefer a clean definition)
DROP INDEX IF EXISTS idx_best_times_leaderboard;
CREATE INDEX idx_best_times_leaderboard
  ON best_times (track_code, laps, reversed, night_mode, time_ms);

CREATE INDEX IF NOT EXISTS idx_best_times_series_run
  ON best_times (series_run_id)
  WHERE series_run_id IS NOT NULL;

-- 7) Series challenge totals table removed — data is not migrated automatically
-- (old rows were one aggregate time per user per challenge_key). Drop it.
DROP TABLE IF EXISTS challenge_times;

COMMIT;
