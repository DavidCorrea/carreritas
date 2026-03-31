export default class ApiClient {
  async _request(method, path, body) {
    const opts = {
      method,
      headers: {}
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(path, opts);
    return r.json();
  }

  /**
   * Anonymous leaderboard submission (official challenges).
   */
  submitLeaderboardTime(payload) {
    return this._request('POST', '/api/submit', payload);
  }

  async fetchLeaderboard(code, laps, direction, mode) {
    try {
      const qs = '?track_code=' + encodeURIComponent(code)
             + '&laps=' + laps
             + '&reversed=' + (direction.isRev() ? 'true' : 'false')
             + '&night_mode=' + (mode.isNight() ? 'true' : 'false');
      return await this._request('GET', '/api/leaderboard' + qs);
    } catch {
      return { entries: [] };
    }
  }

  async fetchChallengeLeaderboard(key) {
    try {
      return await this._request('GET', '/api/challenge?challenge_key=' + encodeURIComponent(key));
    } catch {
      return { entries: [] };
    }
  }
}
