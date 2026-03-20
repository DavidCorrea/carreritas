import Constants from './constants.js';
import { Direction } from './directions/index.js';
import { Mode } from './modes/index.js';

/** JSON round-trips and API payloads lose class prototypes — always resolve to a real pattern instance. */
export function resolveCarPattern(pattern) {
  if (pattern && typeof pattern.createMesh === 'function') return pattern;
  if (typeof pattern === 'string') {
    return Constants.car.patterns.find(function (p) { return p.name === pattern; }) || Constants.car.patterns[0];
  }
  if (pattern && typeof pattern === 'object' && pattern.name) {
    return Constants.car.patterns.find(function (p) { return p.name === pattern.name; }) || Constants.car.patterns[0];
  }
  return Constants.car.patterns[0];
}

export function normalizeCarPatternInSettings(settings) {
  if (!settings) return;
  settings.pattern = resolveCarPattern(settings.pattern);
}

export default class Storage {
  static get shared() {
    if (!Storage._shared) Storage._shared = new Storage();
    return Storage._shared;
  }

  _getItem(key) {
    return localStorage.getItem(key);
  }

  _setItem(key, value) {
    localStorage.setItem(key, value);
  }

  _removeItem(key) {
    localStorage.removeItem(key);
  }

  _keyAt(index) {
    return localStorage.key(index);
  }

  _length() {
    return localStorage.length;
  }

  defaultCarSettingsClone() {
    const clone = JSON.parse(JSON.stringify(Constants.car.defaultSettings));
    clone.pattern = resolveCarPattern(clone.pattern);
    return clone;
  }

  loadCarSettings() {
    try {
      const raw = this._getItem(Constants.storage.settingsKey);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved) return null;
      const s = {};
      for (const k in Constants.car.defaultSettings) s[k] = saved[k] !== undefined ? saved[k] : Constants.car.defaultSettings[k];
      s.pattern = resolveCarPattern(s.pattern);
      return s;
    } catch (_) {}
    return null;
  }

  saveCarSettings(settings) {
    this._setItem(Constants.storage.settingsKey, JSON.stringify(settings));
  }

  getAuthRecord() {
    try {
      const raw = this._getItem(Constants.storage.authKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  setAuthRecord(record) {
    this._setItem(Constants.storage.authKey, JSON.stringify(record));
  }

  removeAuthRecord() {
    this._removeItem(Constants.storage.authKey);
  }

  mergeAuthRecord(partial) {
    const existing = this.getAuthRecord() || {};
    for (const k in partial) {
      if (partial[k] !== undefined) existing[k] = partial[k];
    }
    this.setAuthRecord(existing);
  }

  clearAuthProfileKeepToken() {
    const saved = this.getAuthRecord();
    if (saved && saved.token) {
      this.setAuthRecord({ token: saved.token });
    } else {
      this.removeAuthRecord();
    }
  }

  storageKey(code, laps, direction, mode) {
    const rev = direction.isRev();
    const night = mode.isNight();
    return Constants.storage.prefix + code + '_' + laps + 'L' + (rev ? '_R' : '') + (night ? '_N' : '');
  }

  encodeReplay(frames) {
    if (frames.length === 0) return [];
    const packed = [];
    let px = Math.round(frames[0].x * 10);
    let pz = Math.round(frames[0].z * 10);
    let pa = Math.round(frames[0].a * 100);
    packed.push(px, pz, pa);
    for (let i = 1; i < frames.length; i++) {
      const cx = Math.round(frames[i].x * 10);
      const cz = Math.round(frames[i].z * 10);
      const ca = Math.round(frames[i].a * 100);
      packed.push(cx - px, cz - pz, ca - pa);
      px = cx; pz = cz; pa = ca;
    }
    return packed;
  }

  decodeReplay(packed) {
    const frames = [];
    if (packed.length < 3) return frames;
    let px = packed[0], pz = packed[1], pa = packed[2];
    frames.push({ x: px / 10, z: pz / 10, a: pa / 100 });
    for (let i = 3; i < packed.length; i += 3) {
      px += packed[i];
      pz += packed[i + 1];
      pa += packed[i + 2];
      frames.push({ x: px / 10, z: pz / 10, a: pa / 100 });
    }
    return frames;
  }

  saveLocalBest(code, laps, direction, mode, time, frames) {
    this._setItem(
      this.storageKey(code, laps, direction, mode),
      JSON.stringify({ v: 2, time, packed: this.encodeReplay(frames), date: Date.now() })
    );
  }

  loadLocalBest(code, laps, direction, mode) {
    try {
      const data = JSON.parse(this._getItem(this.storageKey(code, laps, direction, mode)));
      if (!data || !data.time) return null;
      if (data.v === 2 && data.packed && data.packed.length >= 3) {
        return { time: data.time, replay: this.decodeReplay(data.packed) };
      } else if (data.frames && data.frames.length > 0) {
        const replay = [];
        for (let i = 0; i < data.frames.length; i++) {
          replay.push({ x: data.frames[i].x, z: data.frames[i].z, a: data.frames[i].a });
        }
        return { time: data.time, replay };
      }
    } catch (_) {}
    return null;
  }

  loadLocalAllBestTimes() {
    const results = [];
    for (let i = 0; i < this._length(); i++) {
      const key = this._keyAt(i);
      if (!key) continue;
      const match = key.match(/^haxrace_ghost_(.+)_(\d+)L(_R)?(_N)?$/);
      if (!match) continue;
      try {
        const data = JSON.parse(this._getItem(key));
        if (data && data.time) {
          results.push({
            code: match[1],
            laps: parseInt(match[2]),
            direction: Direction.fromBoolean(!!match[3]),
            mode: Mode.fromBoolean(!!match[4]),
            reversed: !!match[3],
            nightMode: !!match[4],
            time: data.time,
            date: data.date || null
          });
        }
      } catch (_) {}
    }
    results.sort(function (a, b) { return a.time - b.time; });
    return results;
  }
}
