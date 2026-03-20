CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  country    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS car_settings (
  user_id  INTEGER PRIMARY KEY REFERENCES users(id),
  settings JSONB NOT NULL
);

-- One row per submitted time on a single track (official challenge flows).
-- Top-10 trimming is enforced in application logic. series_run_id links stages of one series run.
CREATE SEQUENCE IF NOT EXISTS series_run_id_seq;

CREATE TABLE IF NOT EXISTS best_times (
  id               SERIAL PRIMARY KEY,
  track_code       TEXT NOT NULL,
  laps             INTEGER NOT NULL,
  reversed         BOOLEAN NOT NULL DEFAULT false,
  night_mode       BOOLEAN NOT NULL DEFAULT false,
  time_ms          DOUBLE PRECISION NOT NULL,
  display_name     TEXT NOT NULL,
  series_run_id    BIGINT NULL,
  ghost_data       JSONB,
  car_settings     JSONB,
  recorded_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_best_times_leaderboard
  ON best_times (track_code, laps, reversed, night_mode, time_ms);

CREATE INDEX IF NOT EXISTS idx_best_times_series_run
  ON best_times (series_run_id)
  WHERE series_run_id IS NOT NULL;
