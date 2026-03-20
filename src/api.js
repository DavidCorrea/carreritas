export default class ApiClient {
  constructor(getToken) {
    this.getToken = getToken;
  }

  async _request(method, path, body) {
    const opts = {
      method,
      headers: {}
    };
    const token = this.getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(path, opts);
    return r.json();
  }

  login(username, password) {
    return this._request('POST', '/api/login', { username, password });
  }

  register(username, password, country) {
    return this._request('POST', '/api/register', { username, password, country });
  }

  getSettings() {
    return this._request('GET', '/api/settings');
  }

  updateSettings(settings) {
    return this._request('PUT', '/api/settings', { settings });
  }

  getTimes(code, laps, direction, mode) {
    const qs = '?track_code=' + encodeURIComponent(code)
           + '&laps=' + laps
           + '&reversed=' + (direction.isRev() ? 'true' : 'false')
           + '&night_mode=' + (mode.isNight() ? 'true' : 'false');
    return this._request('GET', '/api/times' + qs);
  }

  saveTime(code, laps, direction, mode, time, ghostData) {
    return this._request('POST', '/api/times', {
      track_code: code,
      laps,
      reversed: direction.isRev(),
      night_mode: mode.isNight(),
      time_ms: time,
      ghost_data: ghostData
    });
  }

  saveChallengeTime(challengeKey, time) {
    return this._request('POST', '/api/challenge', {
      challenge_key: challengeKey,
      time_ms: time
    });
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
