var jwt = require('jsonwebtoken');

var SECRET = process.env.JWT_SECRET;

function createToken(userId, username) {
  return jwt.sign({ id: userId, username: username }, SECRET, { expiresIn: '30d' });
}

function verifyToken(req) {
  var header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), SECRET);
  } catch (_) {
    return null;
  }
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

module.exports = { createToken, verifyToken, sendJson };
