(function () {
  var TRACK_WIDTH = 55;
  var CAR_RADIUS = 6;
  var MAX_SPEED = 280;
  var ACCELERATION = 200;
  var BRAKE_FORCE = 320;
  var STEER_SPEED = 2.8;
  var FRICTION = 0.985;
  var GRIP = 3.5;
  var totalLaps = 3;
  var reversed = false;
  var nightMode = false;
  var VIEW_SIZE = 450;
  var CAMERA_HEIGHT = 300;
  var CAMERA_MODES = ['TOP-DOWN', 'ROTATED', 'CHASE', 'ISOMETRIC'];
  var cameraModeIndex = 0;

  var SHOWCASE_SHOTS = [
    { duration: 6, radius: 45, height: 12, speed: 0.3, lookY: 5 },
    { duration: 7, radius: 80, height: 50, speed: -0.2, lookY: 0 },
    { duration: 5, radiusStart: 90, radiusEnd: 30, height: 18, speed: 0.15, lookY: 8 },
    { duration: 6, radius: 55, height: 30, speed: 0.25, lookY: 3 }
  ];
  var SHOWCASE_TRANSITION = 1.5;
  var showcaseActive = false;
  var showcaseTimer = 0;
  var showcaseShotIndex = 0;
  var savedCameraModeIndex = 0;
  var previewRunning = false;
  var previewT = 0;
  var PREVIEW_SPEED = 0.05;
  var TRACK_SAMPLES = 400;
  var RECORD_INTERVAL = 0.1;
  var STORAGE_PREFIX = 'haxrace_ghost_';

  var seriesMode = false;
  var challengeMode = null;
  var stageCount = 3;
  var stageConfigs = [
    { code: '', reversed: false, nightMode: false },
    { code: '', reversed: false, nightMode: false },
    { code: '', reversed: false, nightMode: false },
    { code: '', reversed: false, nightMode: false },
    { code: '', reversed: false, nightMode: false }
  ];
  var currentStageIndex = 0;
  var seriesResults = [];

  var GHOST_COLOR = 0x4da6e8;
  var SETTINGS_KEY = 'carreritas_settings';
  var DEFAULT_SETTINGS = {
    pattern: 'solid',
    primaryColor: '#e84d4d',
    secondaryColor: '#ffffff',
    headlightsColor: '#ffe0a0',
    headlightShape: 50,
    underglowColor: '#ff00ff',
    underglowOpacity: 100
  };
  var carSettings = (function () {
    try {
      var saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (saved) {
        var s = {};
        for (var k in DEFAULT_SETTINGS) s[k] = saved[k] !== undefined ? saved[k] : DEFAULT_SETTINGS[k];
        return s;
      }
    } catch (_) {}
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  })();

  function hexToInt(hex) {
    return parseInt(hex.replace('#', ''), 16);
  }

  function hexToRgb(hex) {
    var n = hexToInt(hex);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
  }

  function intToHex(n) {
    return '#' + ('000000' + n.toString(16)).slice(-6);
  }

  var scene, camera, renderer;
  var orthoCamera, perspCamera;
  var trackGroup;
  var track;
  var player;
  var ghostMesh;
  var keys = {};
  var ambientLight, carPointLight;
  var beamMeshL, beamMeshR, glowMesh, tailMesh;
  var underglowMesh, underglowLight;
  var gameState = 'menu';
  var recordsVisible = false;
  var leaderboardFrom = null;
  var raceTimer = 0;
  var countdownTimer = 0;
  var countdownValue = 0;
  var lastTime = 0;
  var rebuildTimer;
  var currentTrackCode = '';

  var recording = [];
  var recordAccum = 0;
  var bestReplay = null;
  var bestTime = null;
  var lastRaceWasRecord = false;

  var hud = document.getElementById('hud');
  var lapDisplay = document.getElementById('lap-display');
  var lapTimesList = document.getElementById('lap-times-list');
  var bestDisplay = document.getElementById('best-display');
  var timeDisplay = document.getElementById('time-display');
  var speedDisplay = document.getElementById('speed-display');
  var overlay = document.getElementById('overlay');
  var countdownEl = document.getElementById('countdown');
  var semLights = countdownEl.querySelectorAll('.sem-light');
  var resultsEl = document.getElementById('results');
  var resultsList = document.getElementById('results-list');
  var resultsTrackCode = document.getElementById('results-track-code');
  var resultsTrackText = document.getElementById('results-track-text');
  var copyTrackBtn = document.getElementById('copy-track-btn');
  var shareBtn = document.getElementById('share-btn');
  var trackCodeInput = document.getElementById('track-code-input');
  var randomBtn = document.getElementById('random-btn');
  var menuTabToggle = document.getElementById('menu-tab-toggle');
  var eventTab = document.getElementById('event-tab');
  var challengesTab = document.getElementById('challenges-tab');
  var challengeModeToggle = document.getElementById('challenge-mode-toggle');
  var challengePreviewEl = document.getElementById('challenge-preview');
  var lapsValueEl = document.getElementById('laps-value');
  var lapsLabel = document.getElementById('laps-label');
  var lapsMinusBtn = document.getElementById('laps-minus');
  var lapsPlusBtn = document.getElementById('laps-plus');
  var dirToggleBtn = document.getElementById('dir-toggle');
  var dirValueEl = document.getElementById('dir-value');
  var modeToggleBtn = document.getElementById('mode-toggle');
  var modeValueEl = document.getElementById('mode-value');
  var raceTypeBtn = document.getElementById('race-type-toggle');
  var raceTypeValue = document.getElementById('race-type-value');
  var singleConfigEl = document.getElementById('single-config');
  var seriesConfigEl = document.getElementById('series-config');
  var stagesValueEl = document.getElementById('stages-value');
  var stagesMinusBtn = document.getElementById('stages-minus');
  var stagesPlusBtn = document.getElementById('stages-plus');
  var rngAllBtn = document.getElementById('rng-all-btn');
  var stageListEl = document.getElementById('stage-list');
  var stageDisplayEl = document.getElementById('stage-display');
  var cameraDisplayEl = document.getElementById('camera-display');
  var recordsEl = document.getElementById('records');
  var recordsListEl = document.getElementById('records-list');
  var recordsBtn = document.getElementById('records-btn');
  var recordsBackEl = document.getElementById('records-back');
  var leaderboardEl = document.getElementById('leaderboard');
  var leaderboardListEl = document.getElementById('leaderboard-list');
  var leaderboardTrackEl = document.getElementById('leaderboard-track');
  var leaderboardBtn = document.getElementById('leaderboard-btn');
  var leaderboardBackEl = document.getElementById('leaderboard-back');
  var authEl = document.getElementById('auth');
  var authForm = document.getElementById('auth-form');
  var authTitle = document.getElementById('auth-title');
  var authUsernameInput = document.getElementById('auth-username');
  var authPasswordInput = document.getElementById('auth-password');
  var authSubmitBtn = document.getElementById('auth-submit-btn');
  var authError = document.getElementById('auth-error');
  var authSwitch = document.getElementById('auth-switch');
  var authToggleText = document.getElementById('auth-toggle');
  var authClose = document.getElementById('auth-close');
  var accountBar = document.getElementById('account-bar');
  var accountUsername = document.getElementById('account-username');
  var logoutBtn = document.getElementById('logout-btn');
  var loginBtn = document.getElementById('login-btn');
  var settingsEl = document.getElementById('settings');
  var settingsBtn = document.getElementById('settings-btn');
  var leaderboardMenuBtn = document.getElementById('leaderboard-menu-btn');
  var leaderboardSelectEl = document.getElementById('leaderboard-select');
  var leaderboardEntriesEl = document.getElementById('leaderboard-entries');
  var settingsBackEl = document.getElementById('settings-back');
  var colorPrimaryEl = document.getElementById('color-primary');
  var colorSecondaryEl = document.getElementById('color-secondary');
  var colorHeadlightsEl = document.getElementById('color-headlights');
  var headlightShapeEl = document.getElementById('headlight-shape');
  var headlightShapeLabel = document.getElementById('headlight-shape-label');
  var colorUnderglowEl = document.getElementById('color-underglow');
  var underglowOpacityEl = document.getElementById('underglow-opacity');
  var underglowOpacityLabel = document.getElementById('underglow-opacity-label');
  var patternOptionsEl = document.getElementById('pattern-options');
  var previewModeToggle = document.getElementById('preview-mode-toggle');
  var previewCameraToggle = document.getElementById('preview-camera-toggle');
  var previewDriveToggle = document.getElementById('preview-drive-toggle');
  var settingsVisible = false;
  var previewNightMode = false;
  var savedNightMode = false;

  // ── Persistence ─────────────────────────────────────────────────
  function storageKey(code, laps, rev, night) {
    return STORAGE_PREFIX + code + '_' + laps + 'L' + (rev ? '_R' : '') + (night ? '_N' : '');
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

  // ── Sessions ───────────────────────────────────────────────────
  var GuestSession = {
    loadSettings: function (callback) {
      try {
        var saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        if (saved) {
          var s = {};
          for (var k in DEFAULT_SETTINGS) s[k] = saved[k] !== undefined ? saved[k] : DEFAULT_SETTINGS[k];
          callback(s);
          return;
        }
      } catch (_) {}
      callback(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
    },
    saveSettings: function (settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

  var UserSession = {
    loadSettings: function (callback) {
      apiRequest('GET', '/api/settings').then(function (data) {
        if (data.settings) { callback(data.settings); return; }
        GuestSession.loadSettings(callback);
      }).catch(function () {
        GuestSession.loadSettings(callback);
      });
    },
    saveSettings: function (settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      apiRequest('PUT', '/api/settings', { settings: settings }).catch(function () {});
    },
    loadBest: function (code, laps, rev, night, callback) {
      if (challengeMode !== 'daily-race' && challengeMode !== 'weekly-race') {
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
      if (challengeMode === 'daily-race' || challengeMode === 'weekly-race') {
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

  var session = GuestSession;

  function loadBest(code, callback) {
    bestReplay = null;
    bestTime = null;
    session.loadBest(code, totalLaps, reversed, nightMode, function (result) {
      if (result) {
        bestTime = result.time;
        bestReplay = result.replay;
      }
      if (callback) callback();
    });
  }

  function saveBest(code, time, frames) {
    bestReplay = frames;
    bestTime = time;
    session.saveBest(code, totalLaps, reversed, nightMode, time, frames);
  }

  function saveSettings() {
    session.saveSettings(carSettings);
  }

  // ── Auth ───────────────────────────────────────────────────────
  var AUTH_KEY = 'carreritas_auth';
  var authToken = null;
  var authUsername = null;
  var authIsRegister = false;

  function loadAuth() {
    try {
      var saved = JSON.parse(localStorage.getItem(AUTH_KEY));
      if (saved && saved.token && saved.username) {
        authToken = saved.token;
        authUsername = saved.username;
        session = UserSession;
      }
    } catch (_) {}
  }

  function persistAuth(token, username) {
    authToken = token;
    authUsername = username;
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token: token, username: username }));
  }

  function clearAuth() {
    authToken = null;
    authUsername = null;
    localStorage.removeItem(AUTH_KEY);
  }

  function isLoggedIn() { return !!authToken; }

  function apiRequest(method, path, body) {
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

  function uploadLocalData() {
    apiRequest('PUT', '/api/settings', { settings: carSettings }).catch(function () {});
  }

  function showAuthPanel() {
    authIsRegister = false;
    authTitle.textContent = 'LOGIN';
    authSubmitBtn.textContent = 'LOGIN';
    authToggleText.innerHTML = 'No account? <a id="auth-switch">Register</a>';
    authError.textContent = '';
    authUsernameInput.value = '';
    authPasswordInput.value = '';
    authEl.classList.add('visible');
    document.getElementById('auth-switch').addEventListener('click', toggleAuthMode);
    authUsernameInput.focus();
  }

  function hideAuthPanel() {
    authEl.classList.remove('visible');
  }

  function toggleAuthMode() {
    authIsRegister = !authIsRegister;
    authError.textContent = '';
    if (authIsRegister) {
      authTitle.textContent = 'REGISTER';
      authSubmitBtn.textContent = 'REGISTER';
      authToggleText.innerHTML = 'Have an account? <a id="auth-switch">Login</a>';
    } else {
      authTitle.textContent = 'LOGIN';
      authSubmitBtn.textContent = 'LOGIN';
      authToggleText.innerHTML = 'No account? <a id="auth-switch">Register</a>';
    }
    document.getElementById('auth-switch').addEventListener('click', toggleAuthMode);
  }

  function updateAccountBar() {
    if (isLoggedIn()) {
      accountUsername.textContent = authUsername;
      loginBtn.style.display = 'none';
      logoutBtn.style.display = '';
    } else {
      accountUsername.textContent = '';
      loginBtn.style.display = '';
      logoutBtn.style.display = 'none';
    }
  }

  function handleAuthSubmit(e) {
    e.preventDefault();
    var username = authUsernameInput.value.trim();
    var password = authPasswordInput.value;
    if (!username || !password) { authError.textContent = 'Fill in both fields'; return; }

    var endpoint = authIsRegister ? '/api/register' : '/api/login';
    authSubmitBtn.disabled = true;
    authError.textContent = '';

    apiRequest('POST', endpoint, { username: username, password: password })
      .then(function (data) {
        authSubmitBtn.disabled = false;
        if (data.error) { authError.textContent = data.error; return; }
        persistAuth(data.token, data.username);
        session = UserSession;
        hideAuthPanel();
        updateAccountBar();
        uploadLocalData();
        if (!authIsRegister) {
          session.loadSettings(function (remote) {
            for (var k in DEFAULT_SETTINGS) {
              if (remote[k] !== undefined) carSettings[k] = remote[k];
            }
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(carSettings));
            applyCarSettings();
          });
        }
      })
      .catch(function () {
        authSubmitBtn.disabled = false;
        authError.textContent = 'Connection error';
      });
  }

  // ── MOCK: remove this block to restore real leaderboards ──
  var MOCK_LB = true;
  var mockNames = ['speedfreak', 'turbokid', 'driftlord', 'nitrocat', 'blazer99', 'ghostrider', 'apexwolf', 'trackhawk', 'burnout_x', 'revhead', 'slipstream', 'railgun'];
  var mockLeaderboardView = null;
  function mockEntries(count, baseTime) {
    var entries = [];
    for (var i = 0; i < count; i++) {
      entries.push({ username: mockNames[i], time_ms: baseTime + i * 1200 + Math.floor(Math.random() * 800) });
    }
    return entries;
  }
  function mockData(mode) {
    var me = authUsername || 'you';
    if (mode === 'daily-race') {
      var entries = mockEntries(10, 22400);
      entries[0].username = me;
      return { entries: entries };
    }
    if (mode === 'daily-series') {
      var entries = mockEntries(10, 68000);
      entries[2].username = me;
      return { entries: entries };
    }
    if (mode === 'weekly-race') {
      var entries = mockEntries(10, 45000);
      entries[9].username = me;
      return { entries: entries };
    }
    if (mode === 'weekly-series') {
      var entries = mockEntries(10, 120000);
      return { entries: entries, user_entry: { username: me, time_ms: 158340, rank: 23 } };
    }
    return { entries: mockEntries(5, 30000) };
  }
  // ── END MOCK ──

  function fetchLeaderboard(code, laps, rev, night, callback) {
    if (MOCK_LB) { callback(mockData(mockLeaderboardView)); return; }
    var qs = '?track_code=' + encodeURIComponent(code)
           + '&laps=' + laps
           + '&reversed=' + !!rev
           + '&night_mode=' + !!night;
    apiRequest('GET', '/api/leaderboard' + qs).then(function (data) {
      callback(data);
    }).catch(function () { callback({ entries: [] }); });
  }

  function fetchChallengeLeaderboard(key, callback) {
    if (MOCK_LB) { callback(mockData(mockLeaderboardView)); return; }
    apiRequest('GET', '/api/challenge?challenge_key=' + encodeURIComponent(key)).then(function (data) {
      callback(data);
    }).catch(function () { callback({ entries: [] }); });
  }

  function renderLeaderboardRow(entry, rank, isYou) {
    var row = document.createElement('div');
    var cls = 'lb-entry';
    if (rank <= 3) cls += ' lb-pos-' + rank;
    if (isYou) cls += ' lb-you';
    row.className = cls;

    var rankEl = document.createElement('span');
    rankEl.className = 'lb-rank';
    rankEl.textContent = rank + '.';
    row.appendChild(rankEl);

    var name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = entry.username;
    row.appendChild(name);

    var time = document.createElement('span');
    time.className = 'lb-time';
    time.textContent = formatTime(entry.time_ms);
    row.appendChild(time);

    return row;
  }

  function renderLeaderboardEntries(data) {
    var entries = data.entries || [];
    leaderboardListEl.innerHTML = '';
    if (entries.length === 0 && !data.user_entry) {
      var empty = document.createElement('p');
      empty.className = 'lb-empty';
      empty.textContent = 'No times yet';
      leaderboardListEl.appendChild(empty);
    } else {
      for (var i = 0; i < entries.length; i++) {
        var isYou = isLoggedIn() && entries[i].username === authUsername;
        leaderboardListEl.appendChild(renderLeaderboardRow(entries[i], i + 1, isYou));
      }

      if (data.user_entry) {
        var sep = document.createElement('div');
        sep.className = 'lb-separator';
        leaderboardListEl.appendChild(sep);
        leaderboardListEl.appendChild(renderLeaderboardRow(data.user_entry, data.user_entry.rank, true));
      }
    }
  }

  function showLeaderboardSelect() {
    leaderboardSelectEl.style.display = '';
    leaderboardEntriesEl.style.display = 'none';
    overlay.classList.add('hidden');
    leaderboardEl.style.display = 'flex';
  }

  function showLeaderboardForChallenge(mode) {
    leaderboardSelectEl.style.display = 'none';
    leaderboardEntriesEl.style.display = '';
    leaderboardListEl.innerHTML = '';
    mockLeaderboardView = mode;

    var label = challengeLabel(mode);
    var key = challengeKey(mode);
    var isSeries = mode === 'daily-series' || mode === 'weekly-series';

    leaderboardTrackEl.textContent = label;

    if (isSeries) {
      fetchChallengeLeaderboard(key, renderLeaderboardEntries);
    } else {
      var config = mode === 'daily-race' ? dailyConfig() : weeklyRaceConfig();
      fetchLeaderboard(config.code, config.laps, config.reversed, config.nightMode, renderLeaderboardEntries);
    }
  }

  function showLeaderboardForCurrentTrack() {
    leaderboardSelectEl.style.display = 'none';
    leaderboardEntriesEl.style.display = '';
    leaderboardListEl.innerHTML = '';
    var desc = formatDescriptor(currentTrackCode, reversed, nightMode, totalLaps);
    leaderboardTrackEl.textContent = desc;
    fetchLeaderboard(currentTrackCode, totalLaps, reversed, nightMode, renderLeaderboardEntries);
  }

  function showLeaderboard() {
    leaderboardSelectEl.style.display = 'none';
    leaderboardEntriesEl.style.display = '';
    leaderboardListEl.innerHTML = '';

    if (challengeMode) {
      showLeaderboardForChallenge(challengeMode);
    } else {
      showLeaderboardForCurrentTrack();
    }

    leaderboardEl.style.display = 'flex';
  }

  function hideLeaderboard() {
    leaderboardEl.style.display = 'none';
  }

  // ── String → track points (polar) ────────────────────────────────
  function stringToTrackPoints(str) {
    while (str.length < 18) str += ' ';
    str = str.substring(0, 18);

    var radii = [];
    for (var i = 0; i < 18; i++) {
      var code = str.charCodeAt(i);
      var norm = (Math.min(Math.max(code, 32), 126) - 32) / 94;
      radii.push(140 + norm * 240);
    }

    var smoothed = [];
    for (var i = 0; i < 18; i++) {
      var prev = radii[(i + 17) % 18];
      var curr = radii[i];
      var next = radii[(i + 1) % 18];
      smoothed.push(prev * 0.25 + curr * 0.5 + next * 0.25);
    }

    var shift = 0;
    for (var i = 0; i < str.length; i++) shift += str.charCodeAt(i);
    shift = shift % 18;

    var points = [];
    for (var i = 0; i < 18; i++) {
      var idx = (i + shift) % 18;
      var angle = (idx / 18) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle) * smoothed[idx],
        0,
        Math.sin(angle) * smoothed[idx]
      ));
    }
    return points;
  }

  // ── Track SVG generation ────────────────────────────────────────
  function catmullRomPoint2D(p0, p1, p2, p3, t) {
    var dx, dy;
    dx = p1.x - p0.x; dy = p1.y - p0.y;
    var d01 = Math.pow(dx * dx + dy * dy, 0.25);
    dx = p2.x - p1.x; dy = p2.y - p1.y;
    var d12 = Math.pow(dx * dx + dy * dy, 0.25);
    dx = p3.x - p2.x; dy = p3.y - p2.y;
    var d23 = Math.pow(dx * dx + dy * dy, 0.25);
    if (d01 < 1e-4) d01 = 1;
    if (d12 < 1e-4) d12 = 1;
    if (d23 < 1e-4) d23 = 1;
    var t1 = d01, t2 = t1 + d12, t3 = t2 + d23;
    var tt = t1 + t * (t2 - t1);
    var a1x = (t1 - tt) / t1 * p0.x + tt / t1 * p1.x;
    var a1y = (t1 - tt) / t1 * p0.y + tt / t1 * p1.y;
    var a2x = (t2 - tt) / (t2 - t1) * p1.x + (tt - t1) / (t2 - t1) * p2.x;
    var a2y = (t2 - tt) / (t2 - t1) * p1.y + (tt - t1) / (t2 - t1) * p2.y;
    var a3x = (t3 - tt) / (t3 - t2) * p2.x + (tt - t2) / (t3 - t2) * p3.x;
    var a3y = (t3 - tt) / (t3 - t2) * p2.y + (tt - t2) / (t3 - t2) * p3.y;
    var b1x = (t2 - tt) / t2 * a1x + tt / t2 * a2x;
    var b1y = (t2 - tt) / t2 * a1y + tt / t2 * a2y;
    var b2x = (t3 - tt) / (t3 - t1) * a2x + (tt - t1) / (t3 - t1) * a3x;
    var b2y = (t3 - tt) / (t3 - t1) * a2y + (tt - t1) / (t3 - t1) * a3y;
    return {
      x: (t2 - tt) / (t2 - t1) * b1x + (tt - t1) / (t2 - t1) * b2x,
      y: (t2 - tt) / (t2 - t1) * b1y + (tt - t1) / (t2 - t1) * b2y
    };
  }

  function generateTrackSVG(code) {
    var str = code;
    while (str.length < 18) str += ' ';
    str = str.substring(0, 18);
    var radii = [];
    for (var i = 0; i < 18; i++) {
      var c = str.charCodeAt(i);
      var norm = (Math.min(Math.max(c, 32), 126) - 32) / 94;
      radii.push(140 + norm * 240);
    }
    var smoothed = [];
    for (var i = 0; i < 18; i++) {
      var prev = radii[(i + 17) % 18];
      var curr = radii[i];
      var next = radii[(i + 1) % 18];
      smoothed.push(prev * 0.25 + curr * 0.5 + next * 0.25);
    }
    var shift = 0;
    for (var i = 0; i < str.length; i++) shift += str.charCodeAt(i);
    shift = shift % 18;

    var pts = [];
    for (var i = 0; i < 18; i++) {
      var idx = (i + shift) % 18;
      var angle = (idx / 18) * Math.PI * 2;
      pts.push({ x: Math.cos(angle) * smoothed[idx], y: Math.sin(angle) * smoothed[idx] });
    }
    var SEGS = 20;
    var center = [];
    for (var seg = 0; seg < 18; seg++) {
      var p0 = pts[(seg + 17) % 18];
      var p1 = pts[seg];
      var p2 = pts[(seg + 1) % 18];
      var p3 = pts[(seg + 2) % 18];
      for (var j = 0; j < SEGS; j++) {
        center.push(catmullRomPoint2D(p0, p1, p2, p3, j / SEGS));
      }
    }
    var d = 'M' + center[0].x.toFixed(1) + ' ' + center[0].y.toFixed(1);
    for (var i = 1; i < center.length; i++) {
      d += 'L' + center[i].x.toFixed(1) + ' ' + center[i].y.toFixed(1);
    }
    d += 'Z';
    var n = center.length;
    var tx = center[1].x - center[n - 1].x;
    var ty = center[1].y - center[n - 1].y;
    var tl = Math.sqrt(tx * tx + ty * ty);
    var hw = TRACK_WIDTH / 2;
    var snx = -ty / tl, sny = tx / tl;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < center.length; i++) {
      if (center[i].x - hw < minX) minX = center[i].x - hw;
      if (center[i].x + hw > maxX) maxX = center[i].x + hw;
      if (center[i].y - hw < minY) minY = center[i].y - hw;
      if (center[i].y + hw > maxY) maxY = center[i].y + hw;
    }
    var pad = 5;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
      (minX - pad).toFixed(0) + ' ' + (minY - pad).toFixed(0) + ' ' +
      (maxX - minX + pad * 2).toFixed(0) + ' ' + (maxY - minY + pad * 2).toFixed(0) +
      '">' +
      '<path d="' + d + '" fill="none" stroke="#555" stroke-width="' + TRACK_WIDTH + '" stroke-linejoin="round"/>' +
      '<line x1="' + (center[0].x - snx * hw).toFixed(1) + '" y1="' + (center[0].y - sny * hw).toFixed(1) +
      '" x2="' + (center[0].x + snx * hw).toFixed(1) + '" y2="' + (center[0].y + sny * hw).toFixed(1) +
      '" stroke="#fff" stroke-width="3"/>' +
      '</svg>';
  }

  // ── Track generation ──────────────────────────────────────────────
  function generateTrack(code) {
    if (trackGroup) scene.remove(trackGroup);
    trackGroup = new THREE.Group();
    scene.add(trackGroup);

    var pts = stringToTrackPoints(code);
    var curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    var sampled = curve.getSpacedPoints(TRACK_SAMPLES);
    var halfW = TRACK_WIDTH / 2;
    var inner = [], outer = [];

    for (var i = 0; i < sampled.length; i++) {
      var t = i / sampled.length;
      var tan = curve.getTangentAt(t);
      var nx = -tan.z, nz = tan.x;
      var len = Math.sqrt(nx * nx + nz * nz);
      nx /= len; nz /= len;
      inner.push(new THREE.Vector3(
        sampled[i].x - nx * halfW, 0, sampled[i].z - nz * halfW
      ));
      outer.push(new THREE.Vector3(
        sampled[i].x + nx * halfW, 0, sampled[i].z + nz * halfW
      ));
    }

    buildTrackSurface(inner, outer);
    buildWalls(inner, outer);
    buildStartLine(curve);

    return { curve: curve, sampled: sampled, inner: inner, outer: outer };
  }

  function buildTrackSurface(inner, outer) {
    var verts = [], idx = [];
    for (var i = 0; i < inner.length; i++) {
      verts.push(inner[i].x, 0.01, inner[i].z);
      verts.push(outer[i].x, 0.01, outer[i].z);
    }
    for (var i = 0; i < inner.length; i++) {
      var n = (i + 1) % inner.length;
      var a = i * 2, b = i * 2 + 1, c = n * 2, d = n * 2 + 1;
      idx.push(a, c, b, b, c, d);
    }
    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geom.setIndex(idx);
    trackGroup.add(new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ color: 0x444444 })));
  }

  function buildWalls(inner, outer) {
    var step = 2;
    var count = Math.ceil(inner.length / step) + Math.ceil(outer.length / step);
    var geom = new THREE.SphereGeometry(1.8, 8, 6);
    var mesh = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial({ color: 0xcccccc }), count);
    var dummy = new THREE.Object3D();
    var n = 0;
    for (var i = 0; i < inner.length; i += step) {
      dummy.position.set(inner[i].x, 1.8, inner[i].z);
      dummy.updateMatrix();
      mesh.setMatrixAt(n++, dummy.matrix);
    }
    for (var i = 0; i < outer.length; i += step) {
      dummy.position.set(outer[i].x, 1.8, outer[i].z);
      dummy.updateMatrix();
      mesh.setMatrixAt(n++, dummy.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    trackGroup.add(mesh);
  }

  function buildStartLine(curve) {
    var p = curve.getPointAt(0);
    var t = curve.getTangentAt(0).normalize();
    var nx = -t.z, nz = t.x;
    var angle = Math.atan2(t.x, t.z);
    var squares = 8;
    var size = TRACK_WIDTH / squares;
    for (var i = 0; i < squares; i++) {
      var color = i % 2 === 0 ? 0xffffff : 0x222222;
      var box = new THREE.Mesh(
        new THREE.BoxGeometry(size, 0.1, 3),
        new THREE.MeshLambertMaterial({ color: color })
      );
      var offset = (i - squares / 2 + 0.5) * size;
      box.position.set(p.x + nx * offset, 0.05, p.z + nz * offset);
      box.rotation.y = angle;
      trackGroup.add(box);
    }
  }

  // ── Car mesh creation ─────────────────────────────────────────────
  var PATTERNS = ['solid', 'ring', 'half', 'stripe', 'gradient', 'radial', 'spiral', 'dots', 'bullseye'];

  function createCarMesh(opts) {
    var group = new THREE.Group();
    var transparent = opts.opacity < 1;
    var primary = opts.color;
    var secondary = opts.secondaryColor || primary;
    var pattern = opts.pattern || 'solid';
    var matOpts = { transparent: transparent, opacity: opts.opacity };

    if (pattern === 'half') {
      var halfA = new THREE.Mesh(
        new THREE.CircleGeometry(CAR_RADIUS, 20, 0, Math.PI),
        new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
      );
      halfA.rotation.x = -Math.PI / 2;
      halfA.position.y = 2;
      group.add(halfA);

      var halfB = new THREE.Mesh(
        new THREE.CircleGeometry(CAR_RADIUS, 20, Math.PI, Math.PI),
        new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
      );
      halfB.rotation.x = -Math.PI / 2;
      halfB.position.y = 2;
      group.add(halfB);
    } else if (pattern === 'gradient' || pattern === 'radial') {
      var aSegs = 32;
      var rSegs = 10;
      var pRgb = hexToRgb(intToHex(primary));
      var sRgb = hexToRgb(intToHex(secondary));
      var gPositions = [];
      var gColors = [];
      var gIndices = [];

      for (var ri = 0; ri <= rSegs; ri++) {
        var rFrac = ri / rSegs;
        var rad = rFrac * CAR_RADIUS;
        for (var ai = 0; ai <= aSegs; ai++) {
          var ang = (ai / aSegs) * Math.PI * 2;
          var px = Math.cos(ang) * rad;
          var py = Math.sin(ang) * rad;
          gPositions.push(px, py, 0);
          var t;
          if (pattern === 'gradient') {
            t = (py / CAR_RADIUS + 1) * 0.5;
          } else {
            t = 1 - rFrac;
          }
          gColors.push(pRgb.r * t + sRgb.r * (1 - t));
          gColors.push(pRgb.g * t + sRgb.g * (1 - t));
          gColors.push(pRgb.b * t + sRgb.b * (1 - t));
        }
      }

      var stride = aSegs + 1;
      for (var ri = 0; ri < rSegs; ri++) {
        for (var ai = 0; ai < aSegs; ai++) {
          var a = ri * stride + ai;
          var b = a + 1;
          var c = a + stride;
          var d = c + 1;
          gIndices.push(a, c, b, b, c, d);
        }
      }

      var geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(gPositions, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(gColors, 3));
      geom.setIndex(gIndices);
      geom.computeVertexNormals();
      var gDisc = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({
        vertexColors: true, transparent: transparent, opacity: opts.opacity
      }));
      gDisc.rotation.x = -Math.PI / 2;
      gDisc.position.y = 2;
      group.add(gDisc);
    } else if (pattern === 'spiral') {
      var blades = 6;
      var sliceAngle = (Math.PI * 2) / blades;
      for (var si = 0; si < blades; si++) {
        var sliceColor = si % 2 === 0 ? primary : secondary;
        var slice = new THREE.Mesh(
          new THREE.CircleGeometry(CAR_RADIUS, 8, si * sliceAngle, sliceAngle),
          new THREE.MeshLambertMaterial(Object.assign({ color: sliceColor }, matOpts))
        );
        slice.rotation.x = -Math.PI / 2;
        slice.position.y = 2;
        group.add(slice);
      }
    } else if (pattern === 'dots') {
      var dotsDisc = new THREE.Mesh(
        new THREE.CircleGeometry(CAR_RADIUS, 20),
        new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
      );
      dotsDisc.rotation.x = -Math.PI / 2;
      dotsDisc.position.y = 2;
      group.add(dotsDisc);
      var dotAngles = [0.4, 1.4, 2.5, 3.7, 5.0];
      var dotDist = CAR_RADIUS * 0.55;
      var dotR = CAR_RADIUS * 0.17;
      for (var di = 0; di < dotAngles.length; di++) {
        var da = dotAngles[di];
        var dMesh = new THREE.Mesh(
          new THREE.CircleGeometry(dotR, 10),
          new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
        );
        dMesh.rotation.x = -Math.PI / 2;
        dMesh.position.set(Math.sin(da) * dotDist, 2.15, Math.cos(da) * dotDist);
        group.add(dMesh);
      }
    } else if (pattern === 'bullseye') {
      var beDisc = new THREE.Mesh(
        new THREE.CircleGeometry(CAR_RADIUS, 20),
        new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
      );
      beDisc.rotation.x = -Math.PI / 2;
      beDisc.position.y = 2;
      group.add(beDisc);
      var beRing = new THREE.Mesh(
        new THREE.CircleGeometry(CAR_RADIUS * 0.65, 16),
        new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
      );
      beRing.rotation.x = -Math.PI / 2;
      beRing.position.y = 2.1;
      group.add(beRing);
      var beCenter = new THREE.Mesh(
        new THREE.CircleGeometry(CAR_RADIUS * 0.35, 12),
        new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
      );
      beCenter.rotation.x = -Math.PI / 2;
      beCenter.position.y = 2.15;
      group.add(beCenter);
    } else {
      var disc = new THREE.Mesh(
        new THREE.CircleGeometry(CAR_RADIUS, 20),
        new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 2;
      group.add(disc);
    }

    if (pattern === 'stripe') {
      var stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(CAR_RADIUS * 2, CAR_RADIUS * 0.35),
        new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.y = 2.15;
      group.add(stripe);
    }

    var ringColor = pattern === 'ring' ? secondary : 0x000000;
    var ringOpacity = pattern === 'ring' ? 0.8 * opts.opacity : 0.3 * opts.opacity;
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(CAR_RADIUS * 0.82, CAR_RADIUS, 20),
      new THREE.MeshLambertMaterial({ color: ringColor, transparent: true, opacity: ringOpacity })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 2.1;
    group.add(ring);

    var dot = new THREE.Mesh(
      new THREE.CircleGeometry(CAR_RADIUS * 0.22, 12),
      new THREE.MeshLambertMaterial(Object.assign({ color: 0xffffff }, matOpts))
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(0, 2.5, CAR_RADIUS * 0.55);
    group.add(dot);

    if (!transparent) {
      var shadow = new THREE.Mesh(
        new THREE.CircleGeometry(CAR_RADIUS * 1.1, 20),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(1, 0.005, -1);
      group.add(shadow);
    }

    group.position.set(opts.x, 0, opts.z);
    group.rotation.y = opts.angle;
    scene.add(group);
    return group;
  }

  function getStartPosition() {
    var p = track.curve.getPointAt(0);
    var t = track.curve.getTangentAt(0).normalize();
    var angle = Math.atan2(t.x, t.z);
    if (reversed) {
      angle += Math.PI;
      return { x: p.x + t.x * 12, z: p.z + t.z * 12, angle: angle };
    }
    return { x: p.x + t.x * -12, z: p.z + t.z * -12, angle: angle };
  }

  // ── Rebuild track ─────────────────────────────────────────────────
  function rebuildTrack(code) {
    if (player) { scene.remove(player.mesh); player = null; }
    if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }

    currentTrackCode = code;
    track = generateTrack(code);
    createPlayer();
    loadBest(code, function () { createGhost(); });
  }

  function randomCode() {
    var out = '';
    for (var i = 0; i < 18; i++) {
      out += String.fromCharCode(33 + Math.floor(Math.random() * 94));
    }
    return out;
  }

  function formatDescriptor(code, rev, night, laps) {
    return code + ' ' + (rev ? 'R' : 'F') + (night ? 'N' : 'D') + laps;
  }

  function parseDescriptor(str) {
    var parts = str.split(' ');
    var result = { code: parts[0] || '' };
    if (parts.length > 1) {
      var meta = parts[1];
      if (meta.charAt(0) === 'F') result.reversed = false;
      else if (meta.charAt(0) === 'R') result.reversed = true;
      if (meta.charAt(1) === 'D') result.nightMode = false;
      else if (meta.charAt(1) === 'N') result.nightMode = true;
      var lapNum = parseInt(meta.substring(2), 10);
      if (lapNum > 0 && lapNum <= 20) result.laps = lapNum;
    }
    return result;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function seededCode(rng) {
    var out = '';
    for (var i = 0; i < 18; i++) {
      out += String.fromCharCode(33 + Math.floor(rng() * 94));
    }
    return out;
  }

  function hashString(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function utcDateStr() {
    var now = new Date();
    return now.getUTCFullYear() + '-' +
      String(now.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(now.getUTCDate()).padStart(2, '0');
  }

  function utcMondayStr() {
    var now = new Date();
    var daysSinceMonday = (now.getUTCDay() + 6) % 7;
    var monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
    return monday.getUTCFullYear() + '-' +
      String(monday.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(monday.getUTCDate()).padStart(2, '0');
  }

  function seededRaceConfig(seed) {
    var rng = mulberry32(hashString(seed));
    return {
      code: seededCode(rng),
      reversed: rng() > 0.5,
      nightMode: rng() > 0.5,
      laps: Math.floor(rng() * 5) + 1
    };
  }

  function seededSeriesConfig(seed) {
    var rng = mulberry32(hashString(seed));
    var count = Math.floor(rng() * 4) + 2;
    var stages = [];
    for (var i = 0; i < count; i++) {
      stages.push({
        code: seededCode(rng),
        reversed: rng() > 0.5,
        nightMode: rng() > 0.5
      });
    }
    return {
      stages: stages,
      stageCount: count,
      laps: Math.floor(rng() * 5) + 1
    };
  }

  // Bare date seed for backward compat
  function dailyConfig() {
    return seededRaceConfig(utcDateStr());
  }

  function dailySeriesConfig() {
    return seededSeriesConfig('ds-' + utcDateStr());
  }

  function weeklyRaceConfig() {
    var config = seededRaceConfig('wr-' + utcMondayStr());
    config.laps = 5;
    return config;
  }

  function weeklySeriesConfig() {
    var config = seededSeriesConfig('ws-' + utcMondayStr());
    config.laps = 5;
    return config;
  }

  function challengeKey(mode) {
    if (mode === 'daily-race') return 'dr:' + utcDateStr();
    if (mode === 'daily-series') return 'ds:' + utcDateStr();
    if (mode === 'weekly-race') return 'wr:' + utcMondayStr();
    if (mode === 'weekly-series') return 'ws:' + utcMondayStr();
    return null;
  }

  function challengeLabel(mode) {
    if (mode === 'daily-race') return 'DAILY RACE';
    if (mode === 'daily-series') return 'DAILY SERIES';
    if (mode === 'weekly-race') return 'WEEKLY RACE';
    if (mode === 'weekly-series') return 'WEEKLY SERIES';
    return null;
  }

  // ── Player ────────────────────────────────────────────────────────
  function createPlayer() {
    var start = getStartPosition();
    var mesh = createCarMesh({
      color: hexToInt(carSettings.primaryColor),
      secondaryColor: hexToInt(carSettings.secondaryColor),
      pattern: carSettings.pattern,
      x: start.x, z: start.z, angle: start.angle, opacity: 1
    });
    player = {
      mesh: mesh, x: start.x, z: start.z, angle: start.angle,
      vx: 0, vz: 0, speed: 0,
      lap: 0, sectorsVisited: 0, currentSector: 0,
      finished: false, finishTime: 0,
      lapTimes: [], lapStartTime: 0
    };
    var initialT = getTrackT(player);
    player.currentSector = Math.min(Math.floor(initialT * 4), 3);
  }

  // ── Ghost ─────────────────────────────────────────────────────────
  function createGhost() {
    if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
    if (!bestReplay) return;
    var start = getStartPosition();
    ghostMesh = createCarMesh({
      color: GHOST_COLOR, x: start.x, z: start.z, angle: start.angle, opacity: 0.35
    });
    ghostMesh.traverse(function (child) {
      if (child.isMesh && child.material.type === 'MeshLambertMaterial') {
        var m = child.material;
        child.material = new THREE.MeshBasicMaterial({
          color: m.color, transparent: m.transparent, opacity: m.opacity
        });
      }
    });
  }

  function updateGhost() {
    if (!ghostMesh || !bestReplay) return;

    var frameTime = raceTimer / RECORD_INTERVAL;
    var i = Math.floor(frameTime);

    if (i >= bestReplay.length - 1) {
      ghostMesh.visible = false;
      return;
    }

    var frac = frameTime - i;
    var fa = bestReplay[i], fb = bestReplay[i + 1];

    var x = fa.x + (fb.x - fa.x) * frac;
    var z = fa.z + (fb.z - fa.z) * frac;

    var angleDiff = fb.a - fa.a;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    ghostMesh.position.set(x, 0, z);
    ghostMesh.rotation.y = fa.a + angleDiff * frac;
    ghostMesh.visible = true;
  }

  // ── Recording ─────────────────────────────────────────────────────
  function recordFrame(dt) {
    recordAccum += dt;
    if (recordAccum >= RECORD_INTERVAL) {
      recordAccum -= RECORD_INTERVAL;
      recording.push({ x: player.x, z: player.z, a: player.angle });
    }
  }

  // ── Physics ───────────────────────────────────────────────────────
  function updatePlayerPhysics(dt, accel, steer) {
    if (player.speed > 5) {
      player.angle += steer * STEER_SPEED * dt;
    }

    var fx = Math.sin(player.angle);
    var fz = Math.cos(player.angle);

    if (accel > 0) {
      var fwdSpeed = player.vx * fx + player.vz * fz;
      if (fwdSpeed < MAX_SPEED) {
        player.vx += fx * ACCELERATION * accel * dt;
        player.vz += fz * ACCELERATION * accel * dt;
      }
    } else if (accel < 0) {
      player.vx += fx * BRAKE_FORCE * accel * dt;
      player.vz += fz * BRAKE_FORCE * accel * dt;
    }

    var rx = -fz, rz = fx;
    var lateral = player.vx * rx + player.vz * rz;
    var gripDamp = 1 - Math.min(GRIP * dt, 0.95);
    player.vx -= rx * lateral * (1 - gripDamp);
    player.vz -= rz * lateral * (1 - gripDamp);

    var fricPow = Math.pow(FRICTION, dt * 60);
    player.vx *= fricPow;
    player.vz *= fricPow;

    player.x += player.vx * dt;
    player.z += player.vz * dt;
    player.speed = Math.sqrt(player.vx * player.vx + player.vz * player.vz);

    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.angle;
  }

  // ── Wall collision ────────────────────────────────────────────────
  function pointSegDist(px, pz, ax, az, bx, bz) {
    var dx = bx - ax, dz = bz - az;
    var lenSq = dx * dx + dz * dz;
    if (lenSq < 0.001) return { d: Math.sqrt((px - ax) * (px - ax) + (pz - az) * (pz - az)), cx: ax, cz: az };
    var t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
    var cx = ax + t * dx, cz = az + t * dz;
    var ex = px - cx, ez = pz - cz;
    return { d: Math.sqrt(ex * ex + ez * ez), cx: cx, cz: cz };
  }

  function wallCollision(edge) {
    var r = CAR_RADIUS + 1.8;
    for (var i = 0; i < edge.length; i++) {
      var j = (i + 1) % edge.length;
      var res = pointSegDist(player.x, player.z, edge[i].x, edge[i].z, edge[j].x, edge[j].z);
      if (res.d < r && res.d > 0.01) {
        var nx = (player.x - res.cx) / res.d;
        var nz = (player.z - res.cz) / res.d;
        player.x = res.cx + nx * r;
        player.z = res.cz + nz * r;

        var dot = player.vx * nx + player.vz * nz;
        if (dot < 0) {
          player.vx -= 1.5 * dot * nx;
          player.vz -= 1.5 * dot * nz;
          player.vx *= 0.7;
          player.vz *= 0.7;
        }
      }
    }
  }

  // ── Track projection & laps ───────────────────────────────────────
  function getTrackT(car) {
    var best = 0, bestD = Infinity;
    for (var i = 0; i < track.sampled.length; i++) {
      var dx = car.x - track.sampled[i].x;
      var dz = car.z - track.sampled[i].z;
      var d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best / track.sampled.length;
  }

  function updateLapTracking() {
    var t = getTrackT(player);
    var sector = Math.floor(t * 4);
    if (sector > 3) sector = 3;

    if (sector !== player.currentSector) {
      var expected = reversed ? (player.currentSector + 3) % 4 : (player.currentSector + 1) % 4;
      if (sector === expected) {
        player.sectorsVisited++;
        var finishSector = reversed ? 3 : 0;
        if (sector === finishSector && player.sectorsVisited >= 4) {
          var lapTime = raceTimer - player.lapStartTime;
          player.lapTimes.push(lapTime);
          player.lapStartTime = raceTimer;
          addLapTimeToHUD(player.lap + 1, lapTime);
          player.lap++;
          player.sectorsVisited = 0;
          if (player.lap >= totalLaps && !player.finished) {
            player.finished = true;
            player.finishTime = raceTimer;
          }
        }
      }
      player.currentSector = sector;
    }
  }

  // ── Series ────────────────────────────────────────────────────────
  function buildStageList() {
    stageListEl.innerHTML = '';
    for (var i = 0; i < stageCount; i++) {
      var block = document.createElement('div');
      block.className = 'stage-block';

      var num = document.createElement('span');
      num.className = 'stage-num';
      num.textContent = '#' + (i + 1);
      block.appendChild(num);

      var content = document.createElement('div');
      content.className = 'stage-content';

      var topRow = document.createElement('div');
      topRow.className = 'stage-row';

      var input = document.createElement('input');
      input.className = 'stage-code';
      input.type = 'text';
      input.maxLength = 23;
      input.value = stageConfigs[i].code;
      input.spellcheck = false;
      input.autocomplete = 'off';
      (function (idx) {
        input.addEventListener('input', function (e) {
          challengeMode = null;
          var parsed = parseDescriptor(e.target.value);
          stageConfigs[idx].code = parsed.code;
          e.target.value = parsed.code;
          var stageBlock = e.target.closest('.stage-block');
          if (parsed.reversed !== undefined) {
            stageConfigs[idx].reversed = parsed.reversed;
            var dirSeg = stageBlock.querySelectorAll('.seg-control-sm')[0];
            dirSeg.querySelector('.selected').classList.remove('selected');
            dirSeg.querySelector('[data-val="' + (parsed.reversed ? 'REV' : 'FWD') + '"]').classList.add('selected');
          }
          if (parsed.nightMode !== undefined) {
            stageConfigs[idx].nightMode = parsed.nightMode;
            var modeSeg = stageBlock.querySelectorAll('.seg-control-sm')[1];
            modeSeg.querySelector('.selected').classList.remove('selected');
            modeSeg.querySelector('[data-val="' + (parsed.nightMode ? 'NIGHT' : 'DAY') + '"]').classList.add('selected');
          }
        });
      })(i);
      topRow.appendChild(input);

      var rngBtn = document.createElement('button');
      rngBtn.className = 'stage-btn';
      rngBtn.type = 'button';
      rngBtn.textContent = 'RNG';
      (function (idx, inp) {
        rngBtn.addEventListener('click', function () {
          challengeMode = null;
          stageConfigs[idx].code = randomCode();
          inp.value = stageConfigs[idx].code;
        });
      })(i, input);
      topRow.appendChild(rngBtn);

      content.appendChild(topRow);

      var bottomRow = document.createElement('div');
      bottomRow.className = 'stage-options';

      var dirSeg = document.createElement('div');
      dirSeg.className = 'seg-control seg-control-sm';
      var dirFwd = document.createElement('button');
      dirFwd.type = 'button';
      dirFwd.className = 'seg-option' + (stageConfigs[i].reversed ? '' : ' selected');
      dirFwd.dataset.val = 'FWD';
      dirFwd.textContent = 'FWD';
      var dirRev = document.createElement('button');
      dirRev.type = 'button';
      dirRev.className = 'seg-option' + (stageConfigs[i].reversed ? ' selected' : '');
      dirRev.dataset.val = 'REV';
      dirRev.textContent = 'REV';
      dirSeg.appendChild(dirFwd);
      dirSeg.appendChild(dirRev);
      (function (idx, seg) {
        seg.addEventListener('click', function (e) {
          var btn = e.target.closest('.seg-option');
          if (!btn || btn.classList.contains('selected')) return;
          challengeMode = null;
          seg.querySelector('.selected').classList.remove('selected');
          btn.classList.add('selected');
          stageConfigs[idx].reversed = btn.dataset.val === 'REV';
        });
      })(i, dirSeg);
      bottomRow.appendChild(dirSeg);

      var modeSeg = document.createElement('div');
      modeSeg.className = 'seg-control seg-control-sm';
      var modeDay = document.createElement('button');
      modeDay.type = 'button';
      modeDay.className = 'seg-option' + (stageConfigs[i].nightMode ? '' : ' selected');
      modeDay.dataset.val = 'DAY';
      modeDay.textContent = 'DAY';
      var modeNight = document.createElement('button');
      modeNight.type = 'button';
      modeNight.className = 'seg-option' + (stageConfigs[i].nightMode ? ' selected' : '');
      modeNight.dataset.val = 'NIGHT';
      modeNight.textContent = 'NIGHT';
      modeSeg.appendChild(modeDay);
      modeSeg.appendChild(modeNight);
      (function (idx, seg) {
        seg.addEventListener('click', function (e) {
          var btn = e.target.closest('.seg-option');
          if (!btn || btn.classList.contains('selected')) return;
          challengeMode = null;
          seg.querySelector('.selected').classList.remove('selected');
          btn.classList.add('selected');
          stageConfigs[idx].nightMode = btn.dataset.val === 'NIGHT';
        });
      })(i, modeSeg);
      bottomRow.appendChild(modeSeg);

      content.appendChild(bottomRow);
      block.appendChild(content);
      stageListEl.appendChild(block);
    }
  }

  function advanceToNextStage() {
    currentStageIndex++;
    resultsEl.style.display = 'none';
    startCountdown();
  }

  // ── Input ─────────────────────────────────────────────────────────
  function setupInput() {
    window.addEventListener('keydown', function (e) {
      keys[e.code] = true;
      var authOpen = authEl.classList.contains('visible');
      var lbOpen = leaderboardEl.style.display === 'flex';

      if (e.code === 'Enter' && !authOpen) {
        e.preventDefault();
        if (gameState === 'menu' && !recordsVisible && !settingsVisible && !lbOpen) {
          startCountdown();
        } else if (gameState === 'finished') {
          if (seriesMode && currentStageIndex < stageCount - 1) {
            advanceToNextStage();
          } else {
            restartCurrentMap();
          }
        }
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (authEl.classList.contains('visible')) {
          hideAuthPanel();
        } else if (leaderboardEl.style.display === 'flex') {
          if (leaderboardFrom === 'menu' && leaderboardEntriesEl.style.display !== 'none') {
            leaderboardEntriesEl.style.display = 'none';
            leaderboardSelectEl.style.display = '';
          } else {
            hideLeaderboard();
            if (leaderboardFrom === 'results') resultsEl.style.display = 'flex';
            else overlay.classList.remove('hidden');
            leaderboardFrom = null;
          }
        } else if (settingsVisible) {
          hideSettings();
        } else if (recordsVisible) {
          hideRecords();
        } else if (gameState === 'finished') {
          restartRace();
        }
      }

      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && !authOpen && !lbOpen) {
        e.preventDefault();
        if (gameState === 'menu' && !recordsVisible && !settingsVisible) {
          startCountdown();
        } else if (gameState === 'racing' || gameState === 'countdown') {
          restartCurrentMap();
        } else if (gameState === 'finished') {
          if (seriesMode && currentStageIndex < stageCount - 1) {
            advanceToNextStage();
          } else {
            restartCurrentMap();
          }
        }
      }

      if (e.code === 'KeyC' && document.activeElement.tagName !== 'INPUT') {
        cameraModeIndex = (cameraModeIndex + 1) % CAMERA_MODES.length;
        applyCameraMode();
      }
    });

    window.addEventListener('keyup', function (e) { keys[e.code] = false; });

    trackCodeInput.addEventListener('input', function () {
      challengeMode = null;
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(function () {
        var parsed = parseDescriptor(trackCodeInput.value);
        if (parsed.reversed !== undefined) {
          reversed = parsed.reversed;
          dirToggleBtn.querySelector('.selected').classList.remove('selected');
          dirToggleBtn.querySelector('[data-val="' + (reversed ? 'REV' : 'FWD') + '"]').classList.add('selected');
        }
        if (parsed.nightMode !== undefined) {
          nightMode = parsed.nightMode;
          modeToggleBtn.querySelector('.selected').classList.remove('selected');
          modeToggleBtn.querySelector('[data-val="' + (nightMode ? 'NIGHT' : 'DAY') + '"]').classList.add('selected');
        }
        if (parsed.laps !== undefined) {
          totalLaps = parsed.laps;
          lapsValueEl.textContent = totalLaps;
        }
        trackCodeInput.value = parsed.code;
        if (gameState === 'menu') rebuildTrack(parsed.code);
      }, 200);
    });

    randomBtn.addEventListener('click', function () {
      challengeMode = null;
      trackCodeInput.value = randomCode();
      if (gameState === 'menu') rebuildTrack(trackCodeInput.value);
    });

    menuTabToggle.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      menuTabToggle.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      if (btn.dataset.val === 'event') {
        eventTab.style.display = '';
        challengesTab.style.display = 'none';
        challengeMode = null;
      } else {
        eventTab.style.display = 'none';
        challengesTab.style.display = '';
        renderChallengePreview();
      }
    });

    challengeModeToggle.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      challengeModeToggle.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      renderChallengePreview();
    });

    function challengeConfigForMode(mode) {
      if (mode === 'daily-race') return { type: 'race', config: dailyConfig() };
      if (mode === 'daily-series') return { type: 'series', config: dailySeriesConfig() };
      if (mode === 'weekly-race') return { type: 'race', config: weeklyRaceConfig() };
      if (mode === 'weekly-series') return { type: 'series', config: weeklySeriesConfig() };
      return null;
    }

    function loadChallengeConfig(mode) {
      var info = challengeConfigForMode(mode);
      if (!info) return;
      challengeMode = mode;

      if (info.type === 'race') {
        seriesMode = false;
        reversed = info.config.reversed;
        nightMode = info.config.nightMode;
        totalLaps = info.config.laps;
        currentTrackCode = info.config.code;
        if (gameState === 'menu') rebuildTrack(info.config.code);
      } else {
        seriesMode = true;
        stageCount = info.config.stageCount;
        for (var i = 0; i < info.config.stages.length; i++) {
          stageConfigs[i] = {
            code: info.config.stages[i].code,
            reversed: info.config.stages[i].reversed,
            nightMode: info.config.stages[i].nightMode
          };
        }
        totalLaps = info.config.laps;
        if (gameState === 'menu') rebuildTrack(info.config.stages[0].code);
      }
    }

    function renderChallengePreview() {
      var mode = challengeModeToggle.querySelector('.selected').dataset.val;

      loadChallengeConfig(mode);

      var info = challengeConfigForMode(mode);
      challengePreviewEl.innerHTML = '';

      var tracksDiv = document.createElement('div');
      tracksDiv.className = 'challenge-preview-tracks';

      if (info.type === 'race') {
        var stage = document.createElement('div');
        stage.className = 'challenge-preview-stage';
        stage.innerHTML = generateTrackSVG(info.config.code);
        var desc = document.createElement('div');
        desc.className = 'challenge-preview-stage-info';
        desc.textContent = (info.config.reversed ? 'REV' : 'FWD') + ' \u00B7 ' +
          (info.config.nightMode ? 'NIGHT' : 'DAY');
        stage.appendChild(desc);
        tracksDiv.appendChild(stage);
        challengePreviewEl.appendChild(tracksDiv);

        var summary = document.createElement('div');
        summary.className = 'challenge-preview-summary';
        summary.textContent = info.config.laps + (info.config.laps === 1 ? ' LAP' : ' LAPS');
        challengePreviewEl.appendChild(summary);
      } else {
        for (var i = 0; i < info.config.stages.length; i++) {
          var s = info.config.stages[i];
          var stageEl = document.createElement('div');
          stageEl.className = 'challenge-preview-stage';
          stageEl.innerHTML = generateTrackSVG(s.code);
          var num = document.createElement('div');
          num.className = 'challenge-preview-stage-num';
          num.textContent = '#' + (i + 1);
          stageEl.appendChild(num);
          var inf = document.createElement('div');
          inf.className = 'challenge-preview-stage-info';
          inf.textContent = (s.reversed ? 'REV' : 'FWD') + ' \u00B7 ' +
            (s.nightMode ? 'NIGHT' : 'DAY');
          stageEl.appendChild(inf);
          tracksDiv.appendChild(stageEl);
        }
        challengePreviewEl.appendChild(tracksDiv);

        var summary = document.createElement('div');
        summary.className = 'challenge-preview-summary';
        summary.textContent = info.config.stageCount + ' stages \u00B7 ' +
          info.config.laps + (info.config.laps === 1 ? ' lap' : ' laps') + ' per stage';
        challengePreviewEl.appendChild(summary);
      }
    }

    lapsMinusBtn.addEventListener('click', function () {
      if (totalLaps > 1) {
        totalLaps--;
        lapsValueEl.textContent = totalLaps;
        challengeMode = null;
        if (gameState === 'menu') rebuildTrack(trackCodeInput.value);
      }
    });

    lapsPlusBtn.addEventListener('click', function () {
      if (totalLaps < 20) {
        totalLaps++;
        lapsValueEl.textContent = totalLaps;
        challengeMode = null;
        if (gameState === 'menu') rebuildTrack(trackCodeInput.value);
      }
    });

    copyTrackBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(formatDescriptor(currentTrackCode, reversed, nightMode, totalLaps)).then(function () {
        copyTrackBtn.textContent = '\u2713';
        setTimeout(function () { copyTrackBtn.innerHTML = '&#9112;'; }, 1500);
      });
    });

    shareBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(buildShareText()).then(function () {
        shareBtn.textContent = 'COPIED!';
        setTimeout(function () { shareBtn.textContent = 'SHARE'; }, 1500);
      });
    });

    dirToggleBtn.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      dirToggleBtn.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      reversed = btn.dataset.val === 'REV';
      dirValueEl.textContent = reversed ? 'REV' : 'FWD';
      challengeMode = null;
      if (gameState === 'menu') rebuildTrack(trackCodeInput.value);
    });

    modeToggleBtn.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      modeToggleBtn.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      nightMode = btn.dataset.val === 'NIGHT';
      modeValueEl.textContent = nightMode ? 'NIGHT' : 'DAY';
      challengeMode = null;
    });

    raceTypeBtn.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      raceTypeBtn.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      challengeMode = null;
      seriesMode = btn.dataset.val === 'SERIES';
      raceTypeValue.textContent = seriesMode ? 'SERIES' : 'SINGLE';
      singleConfigEl.style.display = seriesMode ? 'none' : '';
      seriesConfigEl.style.display = seriesMode ? '' : 'none';
      lapsLabel.textContent = seriesMode ? 'LAPS PER STAGE' : 'LAPS';
      if (seriesMode) buildStageList();
      if (!seriesMode && gameState === 'menu') rebuildTrack(trackCodeInput.value);
    });

    stagesMinusBtn.addEventListener('click', function () {
      if (stageCount > 2) {
        stageCount--;
        stagesValueEl.textContent = stageCount;
        challengeMode = null;
        buildStageList();
      }
    });

    stagesPlusBtn.addEventListener('click', function () {
      if (stageCount < 5) {
        stageCount++;
        stagesValueEl.textContent = stageCount;
        challengeMode = null;
        buildStageList();
      }
    });

    rngAllBtn.addEventListener('click', function () {
      challengeMode = null;
      for (var i = 0; i < stageCount; i++) {
        stageConfigs[i].code = randomCode();
        stageConfigs[i].reversed = Math.random() > 0.5;
        stageConfigs[i].nightMode = Math.random() > 0.5;
      }
      totalLaps = Math.floor(Math.random() * 5) + 1;
      lapsValueEl.textContent = totalLaps;
      buildStageList();
    });

    recordsBtn.addEventListener('click', function () {
      if (gameState === 'menu') showRecords();
    });

    recordsBackEl.addEventListener('click', function () {
      hideRecords();
    });

    settingsBtn.addEventListener('click', function () {
      if (gameState === 'menu') showSettings();
    });

    settingsBackEl.addEventListener('click', function () {
      hideSettings();
    });

    authForm.addEventListener('submit', handleAuthSubmit);
    authClose.addEventListener('click', hideAuthPanel);
    logoutBtn.addEventListener('click', function () {
      clearAuth();
      session = GuestSession;
      updateAccountBar();
    });
    loginBtn.addEventListener('click', function () {
      showAuthPanel();
    });

    leaderboardBtn.addEventListener('click', function () {
      leaderboardFrom = 'results';
      resultsEl.style.display = 'none';
      showLeaderboard();
    });
    leaderboardMenuBtn.addEventListener('click', function () {
      if (gameState !== 'menu') return;
      leaderboardFrom = 'menu';
      showLeaderboardSelect();
    });
    leaderboardSelectEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.lb-select-btn');
      if (!btn) return;
      showLeaderboardForChallenge(btn.dataset.challenge);
      leaderboardEl.style.display = 'flex';
    });
    leaderboardBackEl.addEventListener('click', function () {
      if (leaderboardFrom === 'menu' && leaderboardEntriesEl.style.display !== 'none') {
        leaderboardEntriesEl.style.display = 'none';
        leaderboardSelectEl.style.display = '';
        return;
      }
      hideLeaderboard();
      if (leaderboardFrom === 'results') resultsEl.style.display = 'flex';
      else overlay.classList.remove('hidden');
      leaderboardFrom = null;
    });

    patternOptionsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.pattern-btn');
      if (!btn) return;
      var sel = patternOptionsEl.querySelector('.selected');
      if (sel) sel.classList.remove('selected');
      btn.classList.add('selected');
      carSettings.pattern = btn.dataset.pattern;
      saveSettings();
      applyCarSettings();
    });

    colorPrimaryEl.addEventListener('input', function () {
      carSettings.primaryColor = colorPrimaryEl.value;
      saveSettings();
      updatePatternPreviews();
      applyCarSettings();
    });

    colorSecondaryEl.addEventListener('input', function () {
      carSettings.secondaryColor = colorSecondaryEl.value;
      saveSettings();
      updatePatternPreviews();
      applyCarSettings();
    });

    colorHeadlightsEl.addEventListener('input', function () {
      carSettings.headlightsColor = colorHeadlightsEl.value;
      saveSettings();
      switchPreviewToNight();
      rebuildLightMeshes();
    });

    headlightShapeEl.addEventListener('input', function () {
      carSettings.headlightShape = parseInt(headlightShapeEl.value);
      saveSettings();
      switchPreviewToNight();
      rebuildLightMeshes();
    });

    colorUnderglowEl.addEventListener('input', function () {
      carSettings.underglowColor = colorUnderglowEl.value;
      saveSettings();
      rebuildLightMeshes();
    });

    underglowOpacityEl.addEventListener('input', function () {
      carSettings.underglowOpacity = parseInt(underglowOpacityEl.value);
      underglowOpacityLabel.textContent = carSettings.underglowOpacity + '%';
      saveSettings();
      rebuildLightMeshes();
    });

    previewModeToggle.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      previewModeToggle.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      previewNightMode = btn.dataset.val === 'NIGHT';
      nightMode = previewNightMode;
    });

    previewCameraToggle.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      previewCameraToggle.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      if (btn.dataset.val === 'showcase') {
        showcaseActive = true;
        showcaseTimer = 0;
        showcaseShotIndex = 0;
        camera = perspCamera;
      } else {
        showcaseActive = false;
        cameraModeIndex = parseInt(btn.dataset.val);
        applyCameraMode();
      }
    });

    previewDriveToggle.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      previewDriveToggle.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      previewRunning = btn.dataset.val === 'RUNNING';
      if (previewRunning) previewT = 0;
    });
  }

  function getPlayerInput() {
    if (document.activeElement === trackCodeInput) return { accel: 0, steer: 0 };
    var accel = 0, steer = 0;
    if (keys['ArrowUp'] || keys['KeyW']) accel = 1;
    if (keys['ArrowDown'] || keys['KeyS']) accel = accel === 1 ? 0 : -1;
    if (keys['ArrowLeft'] || keys['KeyA']) steer = 1;
    if (keys['ArrowRight'] || keys['KeyD']) steer = -1;
    return { accel: accel, steer: steer };
  }

  // ── HUD ───────────────────────────────────────────────────────────
  function addLapTimeToHUD(lapNum, lapTime) {
    var div = document.createElement('div');
    div.className = 'hud-box';
    div.style.marginTop = '8px';
    var text = 'L' + lapNum + '  ' + formatTime(lapTime);
    if (lapNum > 1) {
      var prevTime = player.lapTimes[lapNum - 2];
      var delta = lapTime - prevTime;
      var sign = delta >= 0 ? '+' : '-';
      text += '  ' + sign + formatTime(Math.abs(delta));
      div.style.color = delta <= 0 ? '#4ecdc4' : '#e84d4d';
    }
    div.textContent = text;
    lapTimesList.appendChild(div);
  }

  function updateHUD() {
    var displayLap = Math.min(player.lap + 1, totalLaps);
    lapDisplay.textContent = 'LAP ' + displayLap + ' / ' + totalLaps;
    bestDisplay.textContent = 'BEST ' + (bestTime ? formatTime(bestTime) : '--:--.--');
    timeDisplay.textContent = formatTime(raceTimer);
    speedDisplay.textContent = Math.round(player.speed * 1.2) + ' km/h';
    if (seriesMode) {
      stageDisplayEl.style.display = 'block';
      stageDisplayEl.textContent = 'STAGE ' + (currentStageIndex + 1) + ' / ' + stageCount;
    } else {
      stageDisplayEl.style.display = 'none';
    }
  }

  // ── Game state ────────────────────────────────────────────────────
  function startCountdown() {
    if (seriesMode) {
      if (currentStageIndex === 0) seriesResults = [];
      var stage = stageConfigs[currentStageIndex];
      reversed = stage.reversed;
      nightMode = stage.nightMode;
      currentTrackCode = stage.code;
      rebuildTrack(stage.code);
    }
    gameState = 'countdown';
    overlay.classList.add('hidden');
    hud.style.display = 'block';
    updateHUD();
    for (var i = 0; i < semLights.length; i++) {
      semLights[i].className = 'sem-light';
    }
    countdownEl.style.display = 'flex';
    countdownTimer = 0;
    countdownValue = 0;
  }

  function updateCountdown(dt) {
    countdownTimer += dt;
    var lit = Math.floor(countdownTimer);
    if (lit > 3) lit = 3;
    if (lit !== countdownValue) {
      countdownValue = lit;
      if (lit <= 3) {
        for (var i = 0; i < semLights.length; i++) {
          if (i < lit) {
            semLights[i].className = 'sem-light red';
          }
        }
      }
    }
    if (countdownTimer >= 3.0 && countdownTimer < 3.6) {
      for (var i = 0; i < semLights.length; i++) {
        if (semLights[i].classList.contains('red')) {
          semLights[i].className = 'sem-light green';
        }
      }
    }
    if (countdownTimer >= 3.6) {
      gameState = 'racing';
      countdownEl.style.display = 'none';
      raceTimer = 0;
      recording = [{ x: player.x, z: player.z, a: player.angle }];
      recordAccum = 0;
      lapTimesList.innerHTML = '';
    }
  }

  function showResults() {
    gameState = 'finished';
    hud.style.display = 'none';
    resultsEl.style.display = 'flex';
    resultsList.innerHTML = '';
    leaderboardBtn.style.display = challengeMode ? '' : 'none';

    recording.push({ x: player.x, z: player.z, a: player.angle });
    var isNewBest = !bestTime || player.finishTime < bestTime;
    lastRaceWasRecord = isNewBest;
    if (isNewBest) saveBest(currentTrackCode, player.finishTime, recording);

    var existingRecord = resultsEl.querySelector('.new-record');
    if (existingRecord) existingRecord.remove();

    var resultsH2 = resultsEl.querySelector('h2');
    var promptEl = resultsEl.querySelector('.start-prompt');

    if (seriesMode) {
      seriesResults.push({
        code: currentTrackCode,
        reversed: reversed,
        nightMode: nightMode,
        time: player.finishTime,
        lapTimes: player.lapTimes.slice(),
        isNewBest: isNewBest
      });

      var isFinalStage = currentStageIndex >= stageCount - 1;

      if (isFinalStage) {
        resultsH2.textContent = (challengeMode ? challengeLabel(challengeMode) : 'SERIES') + ' COMPLETE';
        var totalTime = 0;
        for (var s = 0; s < seriesResults.length; s++) totalTime += seriesResults[s].time;
        resultsTrackText.textContent = stageCount + ' stages \u00B7 ' + formatTime(totalTime);
        copyTrackBtn.style.display = 'none';
        shareBtn.style.display = '';

        for (var s = 0; s < seriesResults.length; s++) {
          var sr = seriesResults[s];
          var stageLi = document.createElement('li');
          stageLi.className = 'lap-time';
          stageLi.textContent = '#' + (s + 1) + '  ' + formatTime(sr.time) + '  ' + formatDescriptor(sr.code, sr.reversed, sr.nightMode, totalLaps);
          if (sr.isNewBest) stageLi.className += ' lap-fastest';
          resultsList.appendChild(stageLi);
        }
        promptEl.textContent = 'ENTER Retry  \u00B7  ESC Menu';

        if (challengeMode && isLoggedIn()) {
          var key = challengeKey(challengeMode);
          if (key) {
            apiRequest('POST', '/api/challenge', {
              challenge_key: key, time_ms: totalTime
            }).catch(function () {});
          }
        }
      } else {
        resultsH2.textContent = 'STAGE ' + (currentStageIndex + 1) + ' COMPLETE';
        resultsTrackText.textContent = formatDescriptor(currentTrackCode, reversed, nightMode, totalLaps);
        copyTrackBtn.style.display = '';
        shareBtn.style.display = 'none';

        if (isNewBest) {
          var badge = document.createElement('p');
          badge.className = 'new-record';
          badge.textContent = 'NEW RECORD!';
          resultsEl.insertBefore(badge, resultsList);
        }

        var li = document.createElement('li');
        li.className = 'player';
        li.textContent = 'TIME  ' + formatTime(player.finishTime);
        resultsList.appendChild(li);

        var fastestLap = Math.min.apply(null, player.lapTimes);
        for (var i = 0; i < player.lapTimes.length; i++) {
          var lapLi = document.createElement('li');
          lapLi.className = 'lap-time';
          lapLi.textContent = 'L' + (i + 1) + '  ' + formatTime(player.lapTimes[i]);
          if (player.lapTimes[i] === fastestLap) lapLi.className += ' lap-fastest';
          resultsList.appendChild(lapLi);
        }
        promptEl.textContent = 'Press ENTER for Stage ' + (currentStageIndex + 2);
      }
    } else {
      resultsH2.textContent = (challengeMode ? challengeLabel(challengeMode) : 'RACE') + ' COMPLETE';
      resultsTrackText.textContent = formatDescriptor(currentTrackCode, reversed, nightMode, totalLaps);
      copyTrackBtn.style.display = '';
      shareBtn.style.display = '';

      if (isNewBest) {
        var badge = document.createElement('p');
        badge.className = 'new-record';
        badge.textContent = 'NEW RECORD!';
        resultsEl.insertBefore(badge, resultsList);
      }

      var li = document.createElement('li');
      li.className = 'player';
      li.textContent = 'TIME  ' + formatTime(player.finishTime);
      resultsList.appendChild(li);

      var li2 = document.createElement('li');
      li2.className = 'best';
      li2.textContent = 'BEST  ' + formatTime(bestTime);
      resultsList.appendChild(li2);

      if (!isNewBest) {
        var li3 = document.createElement('li');
        li3.textContent = 'DELTA  +' + (player.finishTime - bestTime).toFixed(2) + 's';
        li3.style.color = '#e8944d';
        resultsList.appendChild(li3);
      }

      var fastestLap = Math.min.apply(null, player.lapTimes);
      for (var i = 0; i < player.lapTimes.length; i++) {
        var lapLi = document.createElement('li');
        lapLi.className = 'lap-time';
        lapLi.textContent = 'L' + (i + 1) + '  ' + formatTime(player.lapTimes[i]);
        if (player.lapTimes[i] === fastestLap) lapLi.className += ' lap-fastest';
        resultsList.appendChild(lapLi);
      }
      promptEl.textContent = 'ENTER Retry  \u00B7  ESC Menu';
    }
  }

  function formatTime(s) {
    var m = Math.floor(s / 60);
    var sec = (s % 60).toFixed(2);
    if (sec < 10) sec = '0' + sec;
    return m + ':' + sec;
  }

  var SHARE_BASE = 'https://carreritas.vercel.app/';

  function shareURL() {
    if (seriesMode) {
      var descs = [];
      for (var i = 0; i < seriesResults.length; i++) {
        var sr = seriesResults[i];
        descs.push(formatDescriptor(sr.code, sr.reversed, sr.nightMode, totalLaps));
      }
      return SHARE_BASE + '?s=' + encodeURIComponent(descs.join(','));
    }
    return SHARE_BASE + '?t=' + encodeURIComponent(formatDescriptor(currentTrackCode, reversed, nightMode, totalLaps));
  }

  var SHARE_OPENERS = [
    'Just set this time.',
    'Not bad, right?',
    'Could\'ve been worse.',
    'Not my best run... or is it?',
    'Look at this.'
  ];
  var SHARE_OPENERS_RECORD = [
    'New record. No big deal.',
    'Just casually dropped a record.',
    'Personal best. I make it look easy.',
    'Record broken. Again.',
    'Peak performance.',
    'Cinema.',
    'This is giving main character energy.',
    'No cap, that was clean.',
    'Lowkey ate that.',
    'Slay.'
  ];
  var SHARE_CLOSERS = [
    'Think you can beat me?',
    'Your turn.',
    'No pressure.',
    'Your move.',
    'Beat that.'
  ];
  var SHARE_CLOSERS_RECORD = [
    'Good luck beating this.',
    'Try to do better, I dare you.',
    'I\'ll wait.',
    'Don\'t even bother.',
    'Set the bar. Your problem now.',
    'It\'s giving unbeatable.',
    'Rent free in the leaderboard.',
    'Stay mad.'
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function buildShareText() {
    var openers = lastRaceWasRecord ? SHARE_OPENERS_RECORD : SHARE_OPENERS;
    var closers = lastRaceWasRecord ? SHARE_CLOSERS_RECORD : SHARE_CLOSERS;
    var lines = [pick(openers), ''];

    if (challengeMode) lines.push(challengeLabel(challengeMode));

    if (seriesMode) {
      var totalTime = 0;
      for (var s = 0; s < seriesResults.length; s++) totalTime += seriesResults[s].time;
      lines.push(stageCount + ' stages \u00B7 ' + formatTime(totalTime));
      for (var s = 0; s < seriesResults.length; s++) {
        var sr = seriesResults[s];
        lines.push('#' + (s + 1) + '  ' + formatTime(sr.time));
      }
    } else {
      lines.push('TIME  ' + formatTime(player.finishTime));
      if (player.lapTimes.length > 1) {
        var fastestLap = Math.min.apply(null, player.lapTimes);
        for (var i = 0; i < player.lapTimes.length; i++) {
          var marker = player.lapTimes[i] === fastestLap ? ' \u2605' : '';
          lines.push('L' + (i + 1) + '  ' + formatTime(player.lapTimes[i]) + marker);
        }
      }
    }

    lines.push('');
    lines.push(pick(closers));
    lines.push(shareURL());
    return lines.join('\n');
  }

  function restartCurrentMap() {
    resultsEl.style.display = 'none';
    if (player) { scene.remove(player.mesh); player = null; }
    createPlayer();
    createGhost();
    gameState = 'countdown';
    overlay.classList.add('hidden');
    hud.style.display = 'block';
    for (var i = 0; i < semLights.length; i++) {
      semLights[i].className = 'sem-light';
    }
    countdownEl.style.display = 'flex';
    countdownTimer = 0;
    countdownValue = 0;
    raceTimer = 0;
    recording = [];
    recordAccum = 0;
    lapTimesList.innerHTML = '';
  }

  function restartRace() {
    resultsEl.style.display = 'none';
    overlay.classList.remove('hidden');
    gameState = 'menu';
    currentStageIndex = 0;
    seriesResults = [];
    if (seriesMode) {
      rebuildTrack(stageConfigs[0].code);
    } else if (challengeMode) {
      rebuildTrack(currentTrackCode);
    } else {
      rebuildTrack(trackCodeInput.value);
    }
  }

  function renderRecords(records) {
    recordsListEl.innerHTML = '';

    if (records.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'records-empty';
      empty.textContent = 'No records yet';
      recordsListEl.appendChild(empty);
    } else {
      records.sort(function (a, b) {
        if (a.code !== b.code) return a.code < b.code ? -1 : 1;
        if (a.reversed !== b.reversed) return a.reversed ? 1 : -1;
        if (a.nightMode !== b.nightMode) return a.nightMode ? 1 : -1;
        return a.time - b.time;
      });

      for (var i = 0; i < records.length; i++) {
        var rec = records[i];

        var card = document.createElement('div');
        card.className = 'record-card';

        var svgDiv = document.createElement('div');
        svgDiv.className = 'record-card-svg';
        svgDiv.innerHTML = generateTrackSVG(rec.code);
        card.appendChild(svgDiv);

        var info = document.createElement('div');
        info.className = 'record-card-info';

        var codeP = document.createElement('p');
        codeP.className = 'record-card-code';
        codeP.textContent = formatDescriptor(rec.code, rec.reversed, rec.nightMode, rec.laps);
        info.appendChild(codeP);

        var row = document.createElement('div');
        row.className = 'record-card-row';

        var time = document.createElement('span');
        time.className = 'record-time';
        time.textContent = formatTime(rec.time);
        row.appendChild(time);

        if (rec.date) {
          var dateSpan = document.createElement('span');
          dateSpan.className = 'record-date';
          var d = new Date(rec.date);
          dateSpan.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
          row.appendChild(dateSpan);
        }

        var retryBtn = document.createElement('button');
        retryBtn.className = 'record-retry';
        retryBtn.type = 'button';
        retryBtn.textContent = 'RETRY';
        (function (r) {
          retryBtn.addEventListener('click', function () { retryRecord(r); });
        })(rec);
        row.appendChild(retryBtn);

        info.appendChild(row);
        card.appendChild(info);
        recordsListEl.appendChild(card);
      }
    }
  }

  function showRecords() {
    recordsListEl.innerHTML = '';
    overlay.classList.add('hidden');
    recordsEl.classList.remove('hidden');
    recordsVisible = true;

    session.getAllBestTimes(function (records) {
      renderRecords(records);
    });
  }

  function retryRecord(rec) {
    seriesMode = false;
    challengeMode = null;
    reversed = rec.reversed;
    nightMode = rec.nightMode;
    totalLaps = rec.laps;

    trackCodeInput.value = rec.code;
    lapsValueEl.textContent = totalLaps;

    dirToggleBtn.querySelector('.selected').classList.remove('selected');
    dirToggleBtn.querySelector('[data-val="' + (reversed ? 'REV' : 'FWD') + '"]').classList.add('selected');

    modeToggleBtn.querySelector('.selected').classList.remove('selected');
    modeToggleBtn.querySelector('[data-val="' + (nightMode ? 'NIGHT' : 'DAY') + '"]').classList.add('selected');

    raceTypeBtn.querySelector('.selected').classList.remove('selected');
    raceTypeBtn.querySelector('[data-val="SINGLE"]').classList.add('selected');
    singleConfigEl.style.display = '';
    seriesConfigEl.style.display = 'none';
    lapsLabel.textContent = 'LAPS';

    recordsEl.classList.add('hidden');
    recordsVisible = false;

    rebuildTrack(rec.code);
    startCountdown();
  }

  function hideRecords() {
    recordsEl.classList.add('hidden');
    overlay.classList.remove('hidden');
    recordsVisible = false;
  }

  // ── Settings ────────────────────────────────────────────────────────
  function drawPatternPreview(canvas, pattern, primary, secondary) {
    var ctx = canvas.getContext('2d');
    var s = canvas.width;
    var r = s / 2;
    ctx.clearRect(0, 0, s, s);

    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.fill();

    if (pattern === 'ring') {
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.fillStyle = secondary;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r, r, r * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = primary;
      ctx.fill();
    } else if (pattern === 'half') {
      ctx.beginPath();
      ctx.arc(r, r, r, Math.PI * 0.5, Math.PI * 1.5);
      ctx.fillStyle = secondary;
      ctx.fill();
    } else if (pattern === 'stripe') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = secondary;
      ctx.fillRect(0, r - r * 0.18, s, r * 0.36);
      ctx.restore();
    } else if (pattern === 'gradient') {
      var grad = ctx.createLinearGradient(r, 0, r, s);
      grad.addColorStop(0, primary);
      grad.addColorStop(1, secondary);
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    } else if (pattern === 'radial') {
      var rGrad = ctx.createRadialGradient(r, r, 0, r, r, r);
      rGrad.addColorStop(0, primary);
      rGrad.addColorStop(1, secondary);
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.fillStyle = rGrad;
      ctx.fill();
    } else if (pattern === 'spiral') {
      var blades = 6;
      var sliceA = (Math.PI * 2) / blades;
      for (var si = 0; si < blades; si++) {
        ctx.beginPath();
        ctx.moveTo(r, r);
        ctx.arc(r, r, r, si * sliceA - Math.PI / 2, (si + 1) * sliceA - Math.PI / 2);
        ctx.closePath();
        ctx.fillStyle = si % 2 === 0 ? primary : secondary;
        ctx.fill();
      }
    } else if (pattern === 'dots') {
      var dotAngles = [0.4, 1.4, 2.5, 3.7, 5.0];
      var dotDist = r * 0.55;
      var dotR = r * 0.17;
      for (var di = 0; di < dotAngles.length; di++) {
        ctx.beginPath();
        ctx.arc(r + Math.cos(dotAngles[di]) * dotDist, r + Math.sin(dotAngles[di]) * dotDist, dotR, 0, Math.PI * 2);
        ctx.fillStyle = secondary;
        ctx.fill();
      }
    } else if (pattern === 'bullseye') {
      ctx.beginPath();
      ctx.arc(r, r, r * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = secondary;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r, r, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = primary;
      ctx.fill();
    }
  }

  function buildPatternButtons() {
    patternOptionsEl.innerHTML = '';
    for (var i = 0; i < PATTERNS.length; i++) {
      var p = PATTERNS[i];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pattern-btn' + (p === carSettings.pattern ? ' selected' : '');
      btn.dataset.pattern = p;
      var cvs = document.createElement('canvas');
      cvs.width = 64;
      cvs.height = 64;
      drawPatternPreview(cvs, p, carSettings.primaryColor, carSettings.secondaryColor);
      btn.appendChild(cvs);
      patternOptionsEl.appendChild(btn);
    }
  }

  function updatePatternPreviews() {
    var buttons = patternOptionsEl.querySelectorAll('.pattern-btn');
    for (var i = 0; i < buttons.length; i++) {
      var cvs = buttons[i].querySelector('canvas');
      drawPatternPreview(cvs, buttons[i].dataset.pattern, carSettings.primaryColor, carSettings.secondaryColor);
    }
  }

  function applyCarSettings() {
    if (!player) return;
    scene.remove(player.mesh);
    var mesh = createCarMesh({
      color: hexToInt(carSettings.primaryColor),
      secondaryColor: hexToInt(carSettings.secondaryColor),
      pattern: carSettings.pattern,
      x: player.x, z: player.z, angle: player.angle, opacity: 1
    });
    player.mesh = mesh;
    rebuildLightMeshes();
  }

  function buildCameraToggle() {
    previewCameraToggle.innerHTML = '';
    var showcaseBtn = document.createElement('button');
    showcaseBtn.type = 'button';
    showcaseBtn.className = 'seg-option' + (showcaseActive ? ' selected' : '');
    showcaseBtn.dataset.val = 'showcase';
    showcaseBtn.textContent = 'SHOWCASE';
    previewCameraToggle.appendChild(showcaseBtn);
    for (var i = 0; i < CAMERA_MODES.length; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seg-option' + (!showcaseActive && i === cameraModeIndex ? ' selected' : '');
      btn.dataset.val = String(i);
      btn.textContent = CAMERA_MODES[i];
      previewCameraToggle.appendChild(btn);
    }
  }

  function showSettings() {
    colorPrimaryEl.value = carSettings.primaryColor;
    colorSecondaryEl.value = carSettings.secondaryColor;
    colorHeadlightsEl.value = carSettings.headlightsColor;
    headlightShapeEl.value = carSettings.headlightShape;
    colorUnderglowEl.value = carSettings.underglowColor;
    underglowOpacityEl.value = carSettings.underglowOpacity;
    underglowOpacityLabel.textContent = carSettings.underglowOpacity + '%';
    buildPatternButtons();

    savedCameraModeIndex = cameraModeIndex;
    showcaseActive = true;
    showcaseTimer = 0;
    showcaseShotIndex = 0;
    camera = perspCamera;
    buildCameraToggle();

    savedNightMode = nightMode;
    previewNightMode = nightMode;
    var sel = previewModeToggle.querySelector('.selected');
    if (sel) sel.classList.remove('selected');
    previewModeToggle.querySelector('[data-val="' + (nightMode ? 'NIGHT' : 'DAY') + '"]').classList.add('selected');

    previewRunning = false;
    previewT = 0;
    var driveSel = previewDriveToggle.querySelector('.selected');
    if (driveSel) driveSel.classList.remove('selected');
    previewDriveToggle.querySelector('[data-val="IDLE"]').classList.add('selected');

    overlay.classList.add('hidden');
    settingsEl.classList.remove('hidden');
    settingsBackEl.style.display = '';
    settingsVisible = true;
  }

  function switchPreviewToNight() {
    if (nightMode) return;
    nightMode = true;
    previewNightMode = true;
    var sel = previewModeToggle.querySelector('.selected');
    if (sel) sel.classList.remove('selected');
    previewModeToggle.querySelector('[data-val="NIGHT"]').classList.add('selected');
  }

  function hideSettings() {
    nightMode = savedNightMode;
    showcaseActive = false;
    previewRunning = false;
    cameraModeIndex = savedCameraModeIndex;
    applyCameraMode();
    if (player) {
      var start = getStartPosition();
      player.x = start.x;
      player.z = start.z;
      player.angle = start.angle;
      player.mesh.position.set(player.x, 0, player.z);
      player.mesh.rotation.y = player.angle;
    }
    settingsEl.classList.add('hidden');
    settingsBackEl.style.display = 'none';
    overlay.classList.remove('hidden');
    settingsVisible = false;
  }

  function updatePreviewDrive(dt) {
    if (!player || !track) return;
    previewT = (previewT + PREVIEW_SPEED * dt) % 1;
    var pt = track.curve.getPointAt(previewT);
    var tan = track.curve.getTangentAt(previewT);
    player.x = pt.x;
    player.z = pt.z;
    player.angle = Math.atan2(tan.x, tan.z);
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.angle;
  }

  // ── Camera ────────────────────────────────────────────────────────
  function showcaseShotPosition(shot, elapsed, angleOffset) {
    var r = shot.radiusStart != null
      ? shot.radiusStart + (shot.radiusEnd - shot.radiusStart) * (elapsed / shot.duration)
      : shot.radius;
    var ang = angleOffset + elapsed * shot.speed;
    return {
      x: player.x + Math.sin(ang) * r,
      y: shot.height,
      z: player.z + Math.cos(ang) * r,
      lookY: shot.lookY
    };
  }

  function updateShowcaseCamera(dt) {
    if (!player) return;
    camera = perspCamera;

    showcaseTimer += dt;
    var shot = SHOWCASE_SHOTS[showcaseTimer < 0 ? 0 : showcaseShotIndex];
    var elapsed = showcaseTimer;

    if (elapsed >= shot.duration) {
      showcaseTimer = 0;
      elapsed = 0;
      showcaseShotIndex = (showcaseShotIndex + 1) % SHOWCASE_SHOTS.length;
      shot = SHOWCASE_SHOTS[showcaseShotIndex];
    }

    var angleOffset = showcaseShotIndex * 1.8;
    var pos = showcaseShotPosition(shot, elapsed, angleOffset);

    if (elapsed < SHOWCASE_TRANSITION) {
      var prevIndex = (showcaseShotIndex - 1 + SHOWCASE_SHOTS.length) % SHOWCASE_SHOTS.length;
      var prevShot = SHOWCASE_SHOTS[prevIndex];
      var prevAngle = prevIndex * 1.8;
      var prevPos = showcaseShotPosition(prevShot, prevShot.duration, prevAngle);
      var t = elapsed / SHOWCASE_TRANSITION;
      t = t * t * (3 - 2 * t);
      pos.x = prevPos.x + (pos.x - prevPos.x) * t;
      pos.y = prevPos.y + (pos.y - prevPos.y) * t;
      pos.z = prevPos.z + (pos.z - prevPos.z) * t;
      pos.lookY = prevPos.lookY + (pos.lookY - prevPos.lookY) * t;
    }

    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(player.x, pos.lookY, player.z);
  }

  function updateCamera() {
    var mode = CAMERA_MODES[cameraModeIndex];
    if (mode === 'TOP-DOWN') {
      camera.position.x += (player.x - camera.position.x) * 0.08;
      camera.position.z += (player.z - camera.position.z) * 0.08;
      camera.position.y = CAMERA_HEIGHT;
      camera.up.set(0, 0, -1);
      camera.lookAt(camera.position.x, 0, camera.position.z);
    } else if (mode === 'ROTATED') {
      camera.position.x += (player.x - camera.position.x) * 0.08;
      camera.position.z += (player.z - camera.position.z) * 0.08;
      camera.position.y = CAMERA_HEIGHT;
      camera.up.set(-Math.sin(player.angle), 0, -Math.cos(player.angle));
      camera.lookAt(camera.position.x, 0, camera.position.z);
    } else if (mode === 'CHASE') {
      var chaseDist = 60;
      var chaseHeight = 35;
      var lookAhead = 20;
      var behindX = player.x - Math.sin(player.angle) * chaseDist;
      var behindZ = player.z - Math.cos(player.angle) * chaseDist;
      camera.position.x += (behindX - camera.position.x) * 0.05;
      camera.position.z += (behindZ - camera.position.z) * 0.05;
      camera.position.y += (chaseHeight - camera.position.y) * 0.05;
      camera.lookAt(
        player.x + Math.sin(player.angle) * lookAhead,
        0,
        player.z + Math.cos(player.angle) * lookAhead
      );
    } else if (mode === 'ISOMETRIC') {
      var isoOff = 180;
      camera.position.x += (player.x + isoOff - camera.position.x) * 0.08;
      camera.position.z += (player.z + isoOff - camera.position.z) * 0.08;
      camera.position.y = 200;
      camera.up.set(0, 1, 0);
      camera.lookAt(camera.position.x - isoOff, 0, camera.position.z - isoOff);
    }
  }

  function applyCameraMode() {
    var mode = CAMERA_MODES[cameraModeIndex];
    if (mode === 'CHASE') {
      camera = perspCamera;
    } else {
      camera = orthoCamera;
      var aspect = window.innerWidth / window.innerHeight;
      var vs = (mode === 'ISOMETRIC') ? VIEW_SIZE * 1.4 : VIEW_SIZE;
      var hw = vs / 2, hh = hw / aspect;
      orthoCamera.left = -hw;
      orthoCamera.right = hw;
      orthoCamera.top = hh;
      orthoCamera.bottom = -hh;
      orthoCamera.updateProjectionMatrix();
    }
    if (player) {
      if (mode === 'TOP-DOWN' || mode === 'ROTATED') {
        camera.position.set(player.x, CAMERA_HEIGHT, player.z);
      } else if (mode === 'CHASE') {
        camera.position.set(
          player.x - Math.sin(player.angle) * 60, 35,
          player.z - Math.cos(player.angle) * 60
        );
        camera.lookAt(player.x, 0, player.z);
      } else if (mode === 'ISOMETRIC') {
        camera.position.set(player.x + 180, 200, player.z + 180);
        camera.lookAt(player.x, 0, player.z);
      }
    }
    cameraDisplayEl.textContent = mode;
  }

  // ── Night mode (3D) ──────────────────────────────────────────────
  function createBeamMesh(length, halfAngle, rgb) {
    var segments = 16;
    var positions = [0, 0.02, 0];
    var colors = [rgb.r, rgb.g, rgb.b];
    var indices = [];

    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      var a = -halfAngle + 2 * halfAngle * t;
      positions.push(Math.sin(a) * length, 0.02, Math.cos(a) * length);
      colors.push(0, 0, 0);
    }

    for (var i = 0; i < segments; i++) {
      indices.push(0, i + 1, i + 2);
    }

    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);

    return new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
  }

  function createGlowMesh(radius, r, g, b) {
    var segments = 24;
    var positions = [0, 0.02, 0];
    var colors = [r, g, b];
    var indices = [];

    for (var i = 0; i <= segments; i++) {
      var a = (i / segments) * Math.PI * 2;
      positions.push(Math.cos(a) * radius, 0.02, Math.sin(a) * radius);
      colors.push(0, 0, 0);
    }

    for (var i = 0; i < segments; i++) {
      indices.push(0, i + 1, i + 2);
    }

    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);

    return new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
  }

  function createUnderglowMesh(color) {
    var group = new THREE.Group();
    var segments = 40;
    var rgb = hexToRgb(color);
    var colorInt = hexToInt(color);
    var fade = carSettings.underglowOpacity / 100;

    var inner = new THREE.Mesh(
      new THREE.CircleGeometry(CAR_RADIUS * 1.05, segments),
      new THREE.MeshBasicMaterial({ color: colorInt, transparent: true, opacity: 0.45 * fade, depthWrite: false })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.04;
    group.add(inner);

    var edgeR = CAR_RADIUS * 0.9;
    var outerR = CAR_RADIUS * 2.7;
    var positions = [];
    var colors = [];
    var indices = [];
    for (var i = 0; i <= segments; i++) {
      var a = (i / segments) * Math.PI * 2;
      var cx = Math.cos(a), cz = Math.sin(a);
      positions.push(cx * edgeR, 0.05, cz * edgeR);
      colors.push(rgb.r * 1.2 * fade, rgb.g * 1.2 * fade, rgb.b * 1.2 * fade);
      positions.push(cx * outerR, 0.05, cz * outerR);
      colors.push(0, 0, 0);
    }
    for (var i = 0; i < segments; i++) {
      var b = i * 2;
      indices.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    }
    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    group.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    })));

    return group;
  }

  function headlightParams() {
    var t = (carSettings.headlightShape != null ? carSettings.headlightShape : 50) / 100;
    var length = 80 + (1 - t) * 100;
    var halfAngle = 0.2 + t * 0.5;
    return { length: length, halfAngle: halfAngle };
  }

  function setupLights() {
    ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    var hlRgb = hexToRgb(carSettings.headlightsColor);
    var hp = headlightParams();
    carPointLight = new THREE.PointLight(0xffe0a0, 0, 90, 2);
    scene.add(carPointLight);

    beamMeshL = createBeamMesh(hp.length, hp.halfAngle, hlRgb);
    beamMeshR = createBeamMesh(hp.length, hp.halfAngle, hlRgb);
    glowMesh = createGlowMesh(35, hlRgb.r * 0.4, hlRgb.g * 0.3, hlRgb.b * 0.1);
    tailMesh = createGlowMesh(15, 0.15, 0.02, 0);

    underglowMesh = createUnderglowMesh(carSettings.underglowColor);
    underglowLight = new THREE.PointLight(hexToInt(carSettings.underglowColor), 0, 60, 2);

    scene.add(beamMeshL, beamMeshR, glowMesh, tailMesh, underglowMesh, underglowLight);
    beamMeshL.visible = false;
    beamMeshR.visible = false;
    glowMesh.visible = false;
    tailMesh.visible = false;
    underglowMesh.visible = false;
  }

  function rebuildLightMeshes() {
    scene.remove(beamMeshL, beamMeshR, glowMesh, tailMesh, underglowMesh, underglowLight);

    var hlRgb = hexToRgb(carSettings.headlightsColor);
    var hp = headlightParams();

    beamMeshL = createBeamMesh(hp.length, hp.halfAngle, hlRgb);
    beamMeshR = createBeamMesh(hp.length, hp.halfAngle, hlRgb);
    glowMesh = createGlowMesh(35, hlRgb.r * 0.4, hlRgb.g * 0.3, hlRgb.b * 0.1);
    tailMesh = createGlowMesh(15, 0.15, 0.02, 0);

    underglowMesh = createUnderglowMesh(carSettings.underglowColor);
    underglowLight = new THREE.PointLight(hexToInt(carSettings.underglowColor), 0, 60, 2);

    scene.add(beamMeshL, beamMeshR, glowMesh, tailMesh, underglowMesh, underglowLight);
    beamMeshL.visible = false;
    beamMeshR.visible = false;
    glowMesh.visible = false;
    tailMesh.visible = false;
    underglowMesh.visible = false;
  }

  function updateNightMode() {
    var isNight = nightMode;
    ambientLight.intensity = isNight ? 0 : 1.0;
    scene.background.set(isNight ? 0x000000 : 0x5d8a4a);
    carPointLight.intensity = isNight ? 0.8 : 0;

    var hasPlayer = !!player;
    var showBeams = isNight && hasPlayer;
    beamMeshL.visible = showBeams;
    beamMeshR.visible = showBeams;
    glowMesh.visible = showBeams;
    tailMesh.visible = showBeams;
    underglowMesh.visible = hasPlayer;
    underglowLight.intensity = hasPlayer ? 2.5 * (carSettings.underglowOpacity / 100) : 0;

    if (!hasPlayer) return;

    var fx = Math.sin(player.angle);
    var fz = Math.cos(player.angle);

    underglowMesh.position.set(player.x, 0, player.z);
    underglowLight.position.set(player.x, 1.5, player.z);

    if (!showBeams) return;

    var headlightFwd = CAR_RADIUS * 0.6;

    beamMeshL.position.set(player.x + fx * headlightFwd, 0, player.z + fz * headlightFwd);
    beamMeshL.rotation.y = player.angle - 0.06;
    beamMeshR.position.set(player.x + fx * headlightFwd, 0, player.z + fz * headlightFwd);
    beamMeshR.rotation.y = player.angle + 0.06;

    glowMesh.position.set(player.x, 0, player.z);
    tailMesh.position.set(player.x - fx * CAR_RADIUS, 0, player.z - fz * CAR_RADIUS);

    carPointLight.position.set(player.x, 8, player.z);
  }

  // ── Main loop ─────────────────────────────────────────────────────
  function gameLoop(time) {
    requestAnimationFrame(gameLoop);

    var dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
    lastTime = time;

    if (gameState === 'countdown') {
      updateCountdown(dt);
    }

    if (gameState === 'racing') {
      raceTimer += dt;

      var input = getPlayerInput();
      updatePlayerPhysics(dt, input.accel, input.steer);

      wallCollision(track.inner);
      wallCollision(track.outer);
      player.mesh.position.set(player.x, 0, player.z);

      updateLapTracking();
      recordFrame(dt);
      updateGhost();

      if (player.finished) {
        showResults();
      }

      updateHUD();
    }

    if (settingsVisible && previewRunning) {
      updatePreviewDrive(dt);
    }

    if (player) {
      if (showcaseActive) {
        updateShowcaseCamera(dt);
      } else {
        updateCamera();
      }
    }
    updateNightMode();
    renderer.render(scene, camera);
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    loadAuth();
    updateAccountBar();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5d8a4a);

    var aspect = window.innerWidth / window.innerHeight;
    var halfW = VIEW_SIZE / 2;
    var halfH = halfW / aspect;
    orthoCamera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 1000);
    orthoCamera.position.set(0, CAMERA_HEIGHT, 0);
    orthoCamera.up.set(0, 0, -1);
    orthoCamera.lookAt(0, 0, 0);
    perspCamera = new THREE.PerspectiveCamera(70, aspect, 1, 2000);
    camera = orthoCamera;
    cameraDisplayEl.textContent = CAMERA_MODES[cameraModeIndex];

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.prepend(renderer.domElement);
    setupLights();

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000, 40, 40),
      new THREE.MeshLambertMaterial({ color: 0x5d8a4a })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    var startCode = randomCode();
    var params = new URLSearchParams(window.location.search);
    var sharedDescriptor = params.get('t');
    var sharedSeries = params.get('s');
    if (sharedSeries) {
      var descs = sharedSeries.split(',');
      stageCount = descs.length;
      stagesValueEl.textContent = stageCount;
      for (var i = 0; i < descs.length; i++) {
        var parsed = parseDescriptor(descs[i]);
        stageConfigs[i] = {
          code: parsed.code,
          reversed: parsed.reversed || false,
          nightMode: parsed.nightMode || false
        };
        if (i === 0 && parsed.laps !== undefined) {
          totalLaps = parsed.laps;
          lapsValueEl.textContent = totalLaps;
        }
      }
      seriesMode = true;
      raceTypeBtn.querySelector('.selected').classList.remove('selected');
      raceTypeBtn.querySelector('[data-val="SERIES"]').classList.add('selected');
      singleConfigEl.style.display = 'none';
      seriesConfigEl.style.display = '';
      lapsLabel.textContent = 'LAPS PER STAGE';
      startCode = stageConfigs[0].code;
      buildStageList();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (sharedDescriptor) {
      var parsed = parseDescriptor(sharedDescriptor);
      startCode = parsed.code;
      if (parsed.reversed !== undefined) {
        reversed = parsed.reversed;
        dirToggleBtn.querySelector('.selected').classList.remove('selected');
        dirToggleBtn.querySelector('[data-val="' + (reversed ? 'REV' : 'FWD') + '"]').classList.add('selected');
      }
      if (parsed.nightMode !== undefined) {
        nightMode = parsed.nightMode;
        modeToggleBtn.querySelector('.selected').classList.remove('selected');
        modeToggleBtn.querySelector('[data-val="' + (nightMode ? 'NIGHT' : 'DAY') + '"]').classList.add('selected');
      }
      if (parsed.laps !== undefined) {
        totalLaps = parsed.laps;
        lapsValueEl.textContent = totalLaps;
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
    trackCodeInput.value = startCode;
    if (!sharedSeries) {
      for (var i = 0; i < stageConfigs.length; i++) stageConfigs[i].code = randomCode();
    }
    rebuildTrack(startCode);
    setupInput();

    window.addEventListener('resize', function () {
      var a = window.innerWidth / window.innerHeight;
      var vs = (CAMERA_MODES[cameraModeIndex] === 'ISOMETRIC') ? VIEW_SIZE * 1.4 : VIEW_SIZE;
      var hw = vs / 2, hh = hw / a;
      orthoCamera.left = -hw; orthoCamera.right = hw;
      orthoCamera.top = hh; orthoCamera.bottom = -hh;
      orthoCamera.updateProjectionMatrix();
      perspCamera.aspect = a;
      perspCamera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    requestAnimationFrame(gameLoop);
  }

  init();
})();
