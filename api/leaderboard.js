const { getDb } = require('./_db');
const { verifyToken, sendJson } = require('./_auth');

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

  const result = { entries, total_count: countRows[0].total };

  const user = verifyToken(req);
  if (user) {
    const inTop = rows.some(function (r) { return r.display_name === user.username; });
    if (!inTop) {
      const userRows = await sql(
        `SELECT b.time_ms,
          (SELECT COUNT(*)::int FROM best_times b2
           WHERE b2.track_code = $2 AND b2.laps = $3 AND b2.reversed = $4 AND b2.night_mode = $5
             AND b2.series_run_id IS NULL AND b2.time_ms < b.time_ms) + 1 AS rank
         FROM best_times b
         WHERE b.display_name = $1 AND b.track_code = $2 AND b.laps = $3 AND b.reversed = $4 AND b.night_mode = $5
           AND b.series_run_id IS NULL
         ORDER BY b.time_ms ASC
         LIMIT 1`,
        [user.username, track_code, lapsInt, rev, night]
      );
      if (userRows.length > 0) {
        result.user_entry = {
          username: user.username,
          display_name: user.username,
          country: null,
          time_ms: userRows[0].time_ms,
          rank: parseInt(userRows[0].rank, 10)
        };
      }
    }
  }

  sendJson(res, 200, result);
};
