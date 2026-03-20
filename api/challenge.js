const { getDb } = require('./_db');
const { verifyToken, sendJson } = require('./_auth');

module.exports = async function (req, res) {
  const sql = getDb();

  if (req.method === 'GET') {
    const key = (req.query || {}).challenge_key;
    if (!key) return sendJson(res, 400, { error: 'challenge_key required' });

    const [rows, countRows] = await Promise.all([
      sql('SELECT u.username, u.country, c.time_ms, c.recorded_at FROM challenge_times c JOIN users u ON u.id = c.user_id WHERE c.challenge_key = $1 ORDER BY c.time_ms LIMIT 10',
        [key]),
      sql('SELECT COUNT(*)::int AS total FROM challenge_times WHERE challenge_key = $1',
        [key])
    ]);

    const result = { entries: rows, total_count: countRows[0].total };

    const user = verifyToken(req);
    if (user) {
      const inTop = rows.some(function (r) { return r.username === user.username; });
      if (!inTop) {
        const userRows = await sql(
          'SELECT c.time_ms, u.country, (SELECT COUNT(*) FROM challenge_times c2 WHERE c2.challenge_key = $2 AND c2.time_ms < c.time_ms) + 1 AS rank FROM challenge_times c JOIN users u ON u.id = c.user_id WHERE c.user_id = $1 AND c.challenge_key = $2',
          [user.id, key]
        );
        if (userRows.length > 0) {
          result.user_entry = { username: user.username, country: userRows[0].country, time_ms: userRows[0].time_ms, rank: parseInt(userRows[0].rank) };
        }
      }
    }

    sendJson(res, 200, result);

  } else if (req.method === 'POST') {
    const poster = verifyToken(req);
    if (!poster) return sendJson(res, 401, { error: 'Unauthorized' });

    const b = req.body || {};
    if (!b.challenge_key || !b.time_ms) return sendJson(res, 400, { error: 'Missing fields' });

    const existing = await sql(
      'SELECT time_ms FROM challenge_times WHERE user_id = $1 AND challenge_key = $2',
      [poster.id, b.challenge_key]
    );

    if (existing.length > 0 && existing[0].time_ms <= b.time_ms) {
      return sendJson(res, 200, { ok: true, updated: false });
    }

    await sql(
      'INSERT INTO challenge_times (user_id, challenge_key, time_ms) VALUES ($1, $2, $3) ON CONFLICT (user_id, challenge_key) DO UPDATE SET time_ms = $3, recorded_at = now()',
      [poster.id, b.challenge_key, b.time_ms]
    );
    sendJson(res, 200, { ok: true, updated: true });

  } else {
    sendJson(res, 405, { error: 'Method not allowed' });
  }
};
