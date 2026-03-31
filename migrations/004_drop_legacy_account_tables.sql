-- Removes legacy account tables (no longer used after anonymous leaderboards + auth API removal).
-- Order: car_settings references users(id).
--
-- Safe to run once on any DB that may still have these tables from the old schema.
-- Idempotent: uses IF EXISTS.

BEGIN;

DROP TABLE IF EXISTS car_settings;
DROP TABLE IF EXISTS users;

COMMIT;
