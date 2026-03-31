-- Ensures `best_times.display_name` exists (idempotent).
-- Use when: API errors with "column display_name does not exist", or a DB was created
-- from an older schema without running 001_leaderboard_anonymous.sql.
--
-- Safe if schema.sql was applied fully (ADD COLUMN is a no-op; NOT NULL is already set).

ALTER TABLE best_times
  ADD COLUMN IF NOT EXISTS display_name TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'best_times' AND column_name = 'user_id'
  ) THEN
    UPDATE best_times b
    SET display_name = u.username
    FROM users u
    WHERE u.id = b.user_id AND (b.display_name IS NULL OR b.display_name = '');
  END IF;
END $$;

UPDATE best_times
SET display_name = 'unknown'
WHERE display_name IS NULL;

ALTER TABLE best_times
  ALTER COLUMN display_name SET NOT NULL;
