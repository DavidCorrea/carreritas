const bcrypt = require('bcryptjs');
const { getDb } = require('./_db');
const { createToken, sendJson } = require('./_auth');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const { username: rawUsername, password } = req.body || {};
  if (!rawUsername || !password) return sendJson(res, 400, { error: 'Username and password required' });

  const username = rawUsername.trim();
  const sql = getDb();
  const rows = await sql('SELECT id, username, password, country FROM users WHERE username = $1', [username]);

  if (rows.length === 0) return sendJson(res, 401, { error: 'Invalid username or password' });

  const valid = await bcrypt.compare(password, rows[0].password);
  if (!valid) return sendJson(res, 401, { error: 'Invalid username or password' });

  const token = createToken(rows[0].id, rows[0].username);
  sendJson(res, 200, { token, username: rows[0].username, country: rows[0].country });
};
