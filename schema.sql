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

CREATE TABLE IF NOT EXISTS best_times (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  track_code       TEXT NOT NULL,
  laps             INTEGER NOT NULL,
  reversed         BOOLEAN NOT NULL DEFAULT false,
  night_mode       BOOLEAN NOT NULL DEFAULT false,
  time_ms          DOUBLE PRECISION NOT NULL,
  ghost_data       JSONB,
  recorded_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, track_code, laps, reversed, night_mode)
);

CREATE INDEX IF NOT EXISTS idx_best_times_leaderboard
  ON best_times (track_code, laps, reversed, night_mode, time_ms);

CREATE TABLE IF NOT EXISTS challenge_times (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  challenge_key TEXT NOT NULL,
  time_ms       DOUBLE PRECISION NOT NULL,
  recorded_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, challenge_key)
);

CREATE INDEX IF NOT EXISTS idx_challenge_times_leaderboard
  ON challenge_times (challenge_key, time_ms);
