#!/usr/bin/env node
/**
 * Applies migrations/003_best_times_display_name.sql (adds best_times.display_name).
 * Loads ../.env when DATABASE_URL is unset. Requires pg (local Postgres or any URL pg accepts).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadDotEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(root, '.env');
  let raw;
  try {
    raw = fs.readFileSync(envPath, 'utf8');
  } catch {
    console.error('Set DATABASE_URL or add a .env file with DATABASE_URL.');
    process.exit(1);
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const sqlPath = path.join(root, 'migrations', '003_best_times_display_name.sql');
const sqlText = fs.readFileSync(sqlPath, 'utf8');

const pool = new pg.Pool({ connectionString: url });
try {
  await pool.query(sqlText);
  console.log('OK: applied migrations/003_best_times_display_name.sql');
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
} finally {
  await pool.end();
}
