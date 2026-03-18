var { getDb } = require('./_db');
var { verifyToken, sendJson } = require('./_auth');

module.exports = async function (req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  var { track_code, laps, reversed, night_mode } = req.query || {};
  if (!track_code || !laps) return sendJson(res, 400, { error: 'track_code and laps required' });

  var sql = getDb();
  var rev = reversed === 'true';
  var night = night_mode === 'true';
  var lapsInt = parseInt(laps);

  var rows = await sql(
    'SELECT u.username, b.time_ms, b.recorded_at FROM best_times b JOIN users u ON u.id = b.user_id WHERE b.track_code = $1 AND b.laps = $2 AND b.reversed = $3 AND b.night_mode = $4 ORDER BY b.time_ms LIMIT 10',
    [track_code, lapsInt, rev, night]
  );

  var result = { entries: rows };

  var user = verifyToken(req);
  if (user) {
    var inTop = rows.some(function (r) { return r.username === user.username; });
    if (!inTop) {
      var userRows = await sql(
        'SELECT b.time_ms, (SELECT COUNT(*) FROM best_times b2 WHERE b2.track_code = $2 AND b2.laps = $3 AND b2.reversed = $4 AND b2.night_mode = $5 AND b2.time_ms < b.time_ms) + 1 AS rank FROM best_times b WHERE b.user_id = $1 AND b.track_code = $2 AND b.laps = $3 AND b.reversed = $4 AND b.night_mode = $5',
        [user.id, track_code, lapsInt, rev, night]
      );
      if (userRows.length > 0) {
        result.user_entry = { username: user.username, time_ms: userRows[0].time_ms, rank: parseInt(userRows[0].rank) };
      }
    }
  }

  sendJson(res, 200, result);
};
