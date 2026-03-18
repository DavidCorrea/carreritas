var { getDb } = require('./_db');
var { verifyToken, sendJson } = require('./_auth');

module.exports = async function (req, res) {
  var user = verifyToken(req);
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  var sql = getDb();

  if (req.method === 'GET') {
    var q = req.query || {};
    if (q.track_code && q.laps) {
      var rows = await sql(
        'SELECT track_code, laps, reversed, night_mode, time_ms, ghost_data, recorded_at FROM best_times WHERE user_id = $1 AND track_code = $2 AND laps = $3 AND reversed = $4 AND night_mode = $5 ORDER BY time_ms LIMIT 1',
        [user.id, q.track_code, parseInt(q.laps), q.reversed === 'true', q.night_mode === 'true']
      );
      sendJson(res, 200, { times: rows });
    } else {
      var rows = await sql(
        'SELECT track_code, laps, reversed, night_mode, time_ms, recorded_at FROM best_times WHERE user_id = $1 ORDER BY time_ms',
        [user.id]
      );
      sendJson(res, 200, { times: rows });
    }
  } else if (req.method === 'POST') {
    var b = req.body || {};
    if (!b.track_code || !b.time_ms || !b.laps) return sendJson(res, 400, { error: 'Missing fields' });

    var existing = await sql(
      'SELECT time_ms FROM best_times WHERE user_id = $1 AND track_code = $2 AND laps = $3 AND reversed = $4 AND night_mode = $5',
      [user.id, b.track_code, b.laps, !!b.reversed, !!b.night_mode]
    );

    if (existing.length > 0 && existing[0].time_ms <= b.time_ms) {
      return sendJson(res, 200, { ok: true, updated: false });
    }

    await sql(
      'INSERT INTO best_times (user_id, track_code, laps, reversed, night_mode, time_ms, ghost_data) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (user_id, track_code, laps, reversed, night_mode) DO UPDATE SET time_ms = $6, ghost_data = $7, recorded_at = now()',
      [user.id, b.track_code, b.laps, !!b.reversed, !!b.night_mode, b.time_ms, b.ghost_data ? JSON.stringify(b.ghost_data) : null]
    );
    sendJson(res, 200, { ok: true, updated: true });
  } else {
    sendJson(res, 405, { error: 'Method not allowed' });
  }
};
