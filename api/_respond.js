function sendJson(res, status, body) {
  res.status(status).json(body);
}

module.exports = { sendJson };
