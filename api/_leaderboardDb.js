const MAX_NAME = 20;

function sanitizeDisplayName(name) {
  if (name == null || typeof name !== 'string') return null;
  const t = name.trim();
  if (t.length === 0) return null;
  return t.length > MAX_NAME ? t.slice(0, MAX_NAME) : t;
}

/** Trim to 10 fastest single-track rows for this descriptor (series_run_id must be null). */
async function trimSingleTrackBoard(sql, track_code, laps, reversed, night_mode) {
  await sql(
    `DELETE FROM best_times b
     USING (
       SELECT id FROM best_times
       WHERE track_code = $1 AND laps = $2 AND reversed = $3 AND night_mode = $4
         AND series_run_id IS NULL
       ORDER BY time_ms ASC
       OFFSET 10
     ) del
     WHERE b.id = del.id`,
    [track_code, laps, reversed, night_mode]
  );
}

/**
 * Only the #1 single-track row may keep ghost replay + car_settings.
 * Clears ghost from all rows in the group except the current winner, then sets ghost on the winner if provided.
 */
async function applyChampionGhost(sql, track_code, laps, reversed, night_mode, ghostData, carSettings, insertedId) {
  const top = await sql(
    `SELECT id FROM best_times
     WHERE track_code = $1 AND laps = $2 AND reversed = $3 AND night_mode = $4
       AND series_run_id IS NULL
     ORDER BY time_ms ASC
     LIMIT 1`,
    [track_code, laps, reversed, night_mode]
  );
  if (top.length === 0) return;
  const winnerId = top[0].id;

  await sql(
    `UPDATE best_times SET ghost_data = NULL, car_settings = NULL
     WHERE track_code = $1 AND laps = $2 AND reversed = $3 AND night_mode = $4
       AND series_run_id IS NULL
       AND id <> $5`,
    [track_code, laps, reversed, night_mode, winnerId]
  );

  if (insertedId != null && winnerId !== insertedId) return;
  if (!ghostData && !carSettings) return;

  await sql(
    `UPDATE best_times SET ghost_data = $1, car_settings = $2 WHERE id = $3`,
    [
      ghostData ? JSON.stringify(ghostData) : null,
      carSettings ? JSON.stringify(carSettings) : null,
      winnerId
    ]
  );
}

module.exports = {
  sanitizeDisplayName,
  trimSingleTrackBoard,
  applyChampionGhost,
  MAX_NAME
};
