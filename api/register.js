var bcrypt = require('bcryptjs');
var { getDb } = require('./_db');
var { createToken, sendJson } = require('./_auth');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  var { username, password, country } = req.body || {};
  if (!username || !password) return sendJson(res, 400, { error: 'Username and password required' });

  username = username.trim();
  if (username.length < 3 || username.length > 20) return sendJson(res, 400, { error: 'Username must be 3-20 characters' });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return sendJson(res, 400, { error: 'Username: letters, numbers, underscores only' });
  if (password.length < 6) return sendJson(res, 400, { error: 'Password must be at least 6 characters' });
  if (!country || typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) return sendJson(res, 400, { error: 'Country required' });

  var sql = getDb();
  var hash = await bcrypt.hash(password, 10);

  try {
    var rows = await sql('INSERT INTO users (username, password, country) VALUES ($1, $2, $3) RETURNING id', [username, hash, country]);
    var token = createToken(rows[0].id, username);
    sendJson(res, 201, { token: token, username: username, country: country });
  } catch (err) {
    if (err.code === '23505') return sendJson(res, 409, { error: 'Username already taken' });
    throw err;
  }
};
