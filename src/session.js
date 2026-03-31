import Storage from './storage.js';

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
