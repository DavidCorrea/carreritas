const { sendJson } = require('./_auth');

/**
 * Legacy authenticated personal-best sync — disabled. Clients use local Storage + POST /api/submit for challenges.
 */
module.exports = async function (req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 200, { times: [] });
  }
  if (req.method === 'POST') {
    return sendJson(res, 410, { error: 'Use POST /api/submit for leaderboard times' });
  }
  return sendJson(res, 405, { error: 'Method not allowed' });
};
