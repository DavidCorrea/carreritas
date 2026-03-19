import { C } from './constants.js';
import { storageKey, encodeReplay, decodeReplay, loadLocalBest, GuestSession } from './storage.js';

var authToken = null;
var authUsername = null;
var authCountry = null;

export function isLoggedIn() { return !!authToken; }
export function getUsername() { return authUsername; }
export function getCountry() { return authCountry; }

export function loadAuth() {
  try {
    var saved = JSON.parse(localStorage.getItem(C.storage.authKey));
    if (saved && saved.token && saved.username) {
      authToken = saved.token;
      authUsername = saved.username;
      authCountry = saved.country || null;
      return true;
    }
  } catch (_) {}
  return false;
}

export function persistAuth(token, username, country) {
  authToken = token;
  authUsername = username;
  authCountry = country || null;
  localStorage.setItem(C.storage.authKey, JSON.stringify({ token: token, username: username, country: country || null }));
}

export function clearAuth() {
  authToken = null;
  authUsername = null;
  authCountry = null;
  localStorage.removeItem(C.storage.authKey);
}

export function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    code.charCodeAt(0) - 65 + 0x1F1E6,
    code.charCodeAt(1) - 65 + 0x1F1E6
  );
}

export function apiRequest(method, path, body) {
  var opts = {
    method: method,
    headers: {}
  };
  if (authToken) opts.headers['Authorization'] = 'Bearer ' + authToken;
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return fetch(path, opts).then(function (r) { return r.json(); });
}

export function createUserSession(getChallengeMode) {
  return {
    loadSettings: function (callback) {
      apiRequest('GET', '/api/settings').then(function (data) {
        if (data.settings) { callback(data.settings); return; }
        GuestSession.loadSettings(callback);
      }).catch(function () {
        GuestSession.loadSettings(callback);
      });
    },
    saveSettings: function (settings) {
      localStorage.setItem(C.storage.settingsKey, JSON.stringify(settings));
      apiRequest('PUT', '/api/settings', { settings: settings }).catch(function () {});
    },
    loadBest: function (code, laps, rev, night, callback) {
      var cm = getChallengeMode();
      if (cm !== 'daily-race' && cm !== 'weekly-race') {
        callback(loadLocalBest(code, laps, rev, night));
        return;
      }
      var qs = '?track_code=' + encodeURIComponent(code)
             + '&laps=' + laps
             + '&reversed=' + !!rev
             + '&night_mode=' + !!night;
      apiRequest('GET', '/api/times' + qs).then(function (data) {
        if (data.times && data.times.length > 0) {
          var t = data.times[0];
          var replay = t.ghost_data ? decodeReplay(t.ghost_data) : null;
          callback({ time: t.time_ms, replay: replay });
        } else {
          callback(loadLocalBest(code, laps, rev, night));
        }
      }).catch(function () {
        callback(loadLocalBest(code, laps, rev, night));
      });
    },
    saveBest: function (code, laps, rev, night, time, frames) {
      localStorage.setItem(storageKey(code, laps, rev, night), JSON.stringify({ v: 2, time: time, packed: encodeReplay(frames), date: Date.now() }));
      var cm = getChallengeMode();
      if (cm === 'daily-race' || cm === 'weekly-race') {
        apiRequest('POST', '/api/times', {
          track_code: code, laps: laps, reversed: rev, night_mode: night,
          time_ms: time, ghost_data: encodeReplay(frames)
        }).catch(function () {});
      }
    },
    getAllBestTimes: function (callback) {
      GuestSession.getAllBestTimes(callback);
    }
  };
}

export function fetchLeaderboard(code, laps, rev, night, callback) {
  var qs = '?track_code=' + encodeURIComponent(code)
         + '&laps=' + laps
         + '&reversed=' + !!rev
         + '&night_mode=' + !!night;
  apiRequest('GET', '/api/leaderboard' + qs).then(function (data) {
    callback(data);
  }).catch(function () { callback({ entries: [] }); });
}

export function fetchChallengeLeaderboard(key, callback) {
  apiRequest('GET', '/api/challenge?challenge_key=' + encodeURIComponent(key)).then(function (data) {
    callback(data);
  }).catch(function () { callback({ entries: [] }); });
}
