var { getDb } = require('./_db');
var { verifyToken, sendJson } = require('./_auth');

module.exports = async function (req, res) {
  var user = verifyToken(req);
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  var sql = getDb();

  if (req.method === 'GET') {
    var rows = await sql('SELECT settings FROM car_settings WHERE user_id = $1', [user.id]);
    sendJson(res, 200, { settings: rows.length > 0 ? rows[0].settings : null });
  } else if (req.method === 'PUT') {
    var settings = req.body && req.body.settings;
    if (!settings) return sendJson(res, 400, { error: 'Settings required' });
    await sql(
      'INSERT INTO car_settings (user_id, settings) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET settings = $2',
      [user.id, JSON.stringify(settings)]
    );
    sendJson(res, 200, { ok: true });
  } else {
    sendJson(res, 405, { error: 'Method not allowed' });
  }
};
