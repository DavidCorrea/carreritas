const { getDb } = require('./_db');
const { sendJson } = require('./_respond');

module.exports = async function (req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const { track_code, laps, reversed, night_mode } = req.query || {};
  if (!track_code || !laps) return sendJson(res, 400, { error: 'track_code and laps required' });

  const sql = getDb();
  const rev = reversed === 'true';
  const night = night_mode === 'true';
  const lapsInt = parseInt(laps, 10);

  const [rows, countRows] = await Promise.all([
    sql(
      `SELECT display_name, time_ms, recorded_at FROM best_times
       WHERE track_code = $1 AND laps = $2 AND reversed = $3 AND night_mode = $4 AND series_run_id IS NULL
       ORDER BY time_ms ASC
       LIMIT 10`,
      [track_code, lapsInt, rev, night]
    ),
    sql(
      `SELECT COUNT(*)::int AS total FROM best_times
       WHERE track_code = $1 AND laps = $2 AND reversed = $3 AND night_mode = $4 AND series_run_id IS NULL`,
      [track_code, lapsInt, rev, night]
    )
  ]);

  const entries = rows.map(function (r) {
    return {
      display_name: r.display_name,
      username: r.display_name,
      time_ms: r.time_ms,
      recorded_at: r.recorded_at,
      country: null
    };
  });

  sendJson(res, 200, { entries, total_count: countRows[0].total });
};
