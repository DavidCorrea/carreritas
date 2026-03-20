import Storage, { normalizeCarPatternInSettings } from './storage.js';
import ApiClient from './api.js';

const storage = Storage.shared;

export class Session {
  loadSettings(callback) {
    const s = storage.loadCarSettings();
    if (s) {
      callback(s);
      return;
    }
    callback(storage.defaultCarSettingsClone());
  }

  saveSettings(settings) {
    storage.saveCarSettings(settings);
  }

  loadBest(code, laps, direction, mode, callback) {
    callback(storage.loadLocalBest(code, laps, direction, mode));
  }

  saveBest(code, laps, direction, mode, time, frames) {
    storage.saveLocalBest(code, laps, direction, mode, time, frames);
  }

  getAllBestTimes(callback) {
    callback(storage.loadLocalAllBestTimes());
  }
}

export const GuestSession = new Session();

export class UserSession extends Session {
  constructor(apiClient, getChallengeMode) {
    super();
    this.apiClient = apiClient;
    this.getChallengeMode = getChallengeMode;
  }

  static fromAuth(auth, getChallengeMode) {
    const apiClient = new ApiClient(function () { return auth.getToken(); });
    return new UserSession(apiClient, getChallengeMode);
  }

  loadSettings(callback) {
    void (async () => {
      try {
        const data = await this.apiClient.getSettings();
        if (data.settings) {
          normalizeCarPatternInSettings(data.settings);
          callback(data.settings);
          return;
        }
      } catch {
        // fall through to local defaults
      }
      GuestSession.loadSettings(callback);
    })();
  }

  saveSettings(settings) {
    super.saveSettings(settings);
    this.apiClient.updateSettings(settings).catch(function () {});
  }

  loadBest(code, laps, direction, mode, callback) {
    const cm = this.getChallengeMode();
    if (cm !== 'daily-race' && cm !== 'weekly-race') {
      super.loadBest(code, laps, direction, mode, callback);
      return;
    }
    void (async () => {
      try {
        const data = await this.apiClient.getTimes(code, laps, direction, mode);
        if (data.times && data.times.length > 0) {
          const t = data.times[0];
          const replay = t.ghost_data ? storage.decodeReplay(t.ghost_data) : null;
          callback({ time: t.time_ms, replay });
        } else {
          GuestSession.loadBest(code, laps, direction, mode, callback);
        }
      } catch {
        GuestSession.loadBest(code, laps, direction, mode, callback);
      }
    })();
  }

  saveBest(code, laps, direction, mode, time, frames) {
    super.saveBest(code, laps, direction, mode, time, frames);
    const cm = this.getChallengeMode();
    if (cm === 'daily-race' || cm === 'weekly-race') {
      this.apiClient.saveTime(code, laps, direction, mode, time, storage.encodeReplay(frames)).catch(function () {});
    }
  }
}
