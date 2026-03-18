var bcrypt = require('bcryptjs');
var { getDb } = require('./_db');
var { createToken, sendJson } = require('./_auth');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  var { username, password } = req.body || {};
  if (!username || !password) return sendJson(res, 400, { error: 'Username and password required' });

  username = username.trim();
  var sql = getDb();
  var rows = await sql('SELECT id, username, password FROM users WHERE username = $1', [username]);

  if (rows.length === 0) return sendJson(res, 401, { error: 'Invalid username or password' });

  var valid = await bcrypt.compare(password, rows[0].password);
  if (!valid) return sendJson(res, 401, { error: 'Invalid username or password' });

  var token = createToken(rows[0].id, rows[0].username);
  sendJson(res, 200, { token: token, username: rows[0].username });
};
