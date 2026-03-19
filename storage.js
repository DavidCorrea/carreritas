function storageKey(code, laps, rev, night) {
  return C.storage.prefix + code + '_' + laps + 'L' + (rev ? '_R' : '') + (night ? '_N' : '');
}

function encodeReplay(frames) {
  if (frames.length === 0) return [];
  var packed = [];
  var px = Math.round(frames[0].x * 10);
  var pz = Math.round(frames[0].z * 10);
  var pa = Math.round(frames[0].a * 100);
  packed.push(px, pz, pa);
  for (var i = 1; i < frames.length; i++) {
    var cx = Math.round(frames[i].x * 10);
    var cz = Math.round(frames[i].z * 10);
    var ca = Math.round(frames[i].a * 100);
    packed.push(cx - px, cz - pz, ca - pa);
    px = cx; pz = cz; pa = ca;
  }
  return packed;
}

function decodeReplay(packed) {
  var frames = [];
  if (packed.length < 3) return frames;
  var px = packed[0], pz = packed[1], pa = packed[2];
  frames.push({ x: px / 10, z: pz / 10, a: pa / 100 });
  for (var i = 3; i < packed.length; i += 3) {
    px += packed[i];
    pz += packed[i + 1];
    pa += packed[i + 2];
    frames.push({ x: px / 10, z: pz / 10, a: pa / 100 });
  }
  return frames;
}

function loadLocalBest(code, laps, rev, night) {
  try {
    var data = JSON.parse(localStorage.getItem(storageKey(code, laps, rev, night)));
    if (!data || !data.time) return null;
    if (data.v === 2 && data.packed && data.packed.length >= 3) {
      return { time: data.time, replay: decodeReplay(data.packed) };
    } else if (data.frames && data.frames.length > 0) {
      var replay = [];
      for (var i = 0; i < data.frames.length; i++) {
        replay.push({ x: data.frames[i].x, z: data.frames[i].z, a: data.frames[i].a });
      }
      return { time: data.time, replay: replay };
    }
  } catch (_) {}
  return null;
}

function loadLocalAllBestTimes() {
  var results = [];
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    var match = key.match(/^haxrace_ghost_(.+)_(\d+)L(_R)?(_N)?$/);
    if (!match) continue;
    try {
      var data = JSON.parse(localStorage.getItem(key));
      if (data && data.time) {
        results.push({
          code: match[1],
          laps: parseInt(match[2]),
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

var GuestSession = {
  loadSettings: function (callback) {
    try {
      var saved = JSON.parse(localStorage.getItem(C.storage.settingsKey));
      if (saved) {
        var s = {};
        for (var k in C.car.defaultSettings) s[k] = saved[k] !== undefined ? saved[k] : C.car.defaultSettings[k];
        callback(s);
        return;
      }
    } catch (_) {}
    callback(JSON.parse(JSON.stringify(C.car.defaultSettings)));
  },
  saveSettings: function (settings) {
    localStorage.setItem(C.storage.settingsKey, JSON.stringify(settings));
  },
  loadBest: function (code, laps, rev, night, callback) {
    callback(loadLocalBest(code, laps, rev, night));
  },
  saveBest: function (code, laps, rev, night, time, frames) {
    localStorage.setItem(storageKey(code, laps, rev, night), JSON.stringify({ v: 2, time: time, packed: encodeReplay(frames), date: Date.now() }));
  },
  getAllBestTimes: function (callback) {
    callback(loadLocalAllBestTimes());
  }
};
