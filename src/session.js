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
  constructor(apiClient) {
    super();
    this.apiClient = apiClient;
  }

  static fromAuth(auth) {
    const apiClient = new ApiClient(function () { return auth.getToken(); });
    return new UserSession(apiClient);
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
    super.loadBest(code, laps, direction, mode, callback);
  }

  saveBest(code, laps, direction, mode, time, frames) {
    super.saveBest(code, laps, direction, mode, time, frames);
  }
}
