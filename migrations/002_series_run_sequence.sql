-- Run after 001 if series_run_id_seq is missing (safe if already exists)
CREATE SEQUENCE IF NOT EXISTS series_run_id_seq;
