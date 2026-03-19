(function () {
  var totalLaps = 3;
  var reversed = false;
  var nightMode = false;
  var cameraModeIndex = 0;

  var showcaseActive = false;
  var showcaseTimer = 0;
  var showcaseShotIndex = 0;
  var savedCameraModeIndex = 0;
  var previewRunning = false;
  var previewT = 0;

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

  var carSettings = (function () {
    try {
      var saved = JSON.parse(localStorage.getItem(C.storage.settingsKey));
      if (saved) {
        var s = {};
        for (var k in C.car.defaultSettings) s[k] = saved[k] !== undefined ? saved[k] : C.car.defaultSettings[k];
        return s;
      }
    } catch (_) {}
    return JSON.parse(JSON.stringify(C.car.defaultSettings));
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
  var isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  var touchState = { accel: 0, steer: 0 };
  var touchIds = { steer: null, throttle: null };
  var steerOriginX = 0;
  var ambientLight, carPointLight;
  var beamMeshL, beamMeshR, glowMesh, tailMesh;
  var underglowMesh, underglowLight;
  var gameState = 'menu';
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
  var authCountrySelect = document.getElementById('auth-country');
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
  var challengeLbSubtitle = document.getElementById('challenge-lb-subtitle');
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
  var touchControlsEl = document.getElementById('touch-controls');
  var touchSteerIndicator = document.getElementById('touch-steer-indicator');
  var touchSteerDot = document.getElementById('touch-steer-dot');
  var touchGasHighlight = document.getElementById('touch-gas-highlight');
  var touchBrakeHighlight = document.getElementById('touch-brake-highlight');
  var touchRestartBtn = document.getElementById('touch-restart-btn');
  var touchCameraBtn = document.getElementById('touch-camera-btn');
  var touchMenuBtn = document.getElementById('touch-menu-btn');
  var previewNightMode = false;
  var savedNightMode = false;

  var views = {
    menu:        { show: function () { overlay.classList.remove('hidden'); },       hide: function () { overlay.classList.add('hidden'); },       isOpen: function () { return !overlay.classList.contains('hidden'); } },
    hud:         { show: function () { hud.style.display = 'block'; if (isMobile) touchControlsEl.classList.add('active'); }, hide: function () { hud.style.display = 'none'; if (isMobile) touchControlsEl.classList.remove('active'); } },
    countdown:   { show: function () { countdownEl.style.display = 'flex'; },      hide: function () { countdownEl.style.display = 'none'; } },
    results:     { show: function () { resultsEl.style.display = 'flex'; },        hide: function () { resultsEl.style.display = 'none'; } },
    records:     { show: function () { recordsEl.classList.remove('hidden'); },     hide: function () { recordsEl.classList.add('hidden'); },     isOpen: function () { return !recordsEl.classList.contains('hidden'); } },
    settings:    { show: function () { settingsEl.classList.remove('hidden'); },    hide: function () { settingsEl.classList.add('hidden'); },    isOpen: function () { return !settingsEl.classList.contains('hidden'); } },
    leaderboard: { show: function () { leaderboardEl.style.display = 'flex'; },    hide: function () { leaderboardEl.style.display = 'none'; },  isOpen: function () { return leaderboardEl.style.display === 'flex'; } },
    auth:        { show: function () { authEl.classList.add('visible'); },          hide: function () { authEl.classList.remove('visible'); },     isOpen: function () { return authEl.classList.contains('visible'); } },
    accountBar:  { show: function () { accountBar.style.display = ''; },           hide: function () { accountBar.style.display = 'none'; } }
  };

  // ── Sessions ───────────────────────────────────────────────────
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
      localStorage.setItem(C.storage.settingsKey, JSON.stringify(settings));
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
  var authToken = null;
  var authUsername = null;
  var authCountry = null;
  var authIsRegister = false;

  function loadAuth() {
    try {
      var saved = JSON.parse(localStorage.getItem(C.storage.authKey));
      if (saved && saved.token && saved.username) {
        authToken = saved.token;
        authUsername = saved.username;
        authCountry = saved.country || null;
        session = UserSession;
      }
    } catch (_) {}
  }

  function persistAuth(token, username, country) {
    authToken = token;
    authUsername = username;
    authCountry = country || null;
    localStorage.setItem(C.storage.authKey, JSON.stringify({ token: token, username: username, country: country || null }));
  }

  function clearAuth() {
    authToken = null;
    authUsername = null;
    authCountry = null;
    localStorage.removeItem(C.storage.authKey);
  }

  function isLoggedIn() { return !!authToken; }

  function countryFlag(code) {
    if (!code || code.length !== 2) return '';
    return String.fromCodePoint(
      code.charCodeAt(0) - 65 + 0x1F1E6,
      code.charCodeAt(1) - 65 + 0x1F1E6
    );
  }

  function populateCountrySelect() {
    var opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Select country';
    authCountrySelect.appendChild(opt);
    for (var i = 0; i < C.countries.length; i++) {
      var o = document.createElement('option');
      o.value = C.countries[i][0];
      o.textContent = countryFlag(C.countries[i][0]) + ' ' + C.countries[i][1];
      authCountrySelect.appendChild(o);
    }
  }
  populateCountrySelect();

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
    authCountrySelect.value = '';
    authCountrySelect.style.display = 'none';
    views.auth.show();
    document.getElementById('auth-switch').addEventListener('click', toggleAuthMode);
    authUsernameInput.focus();
  }

  function hideAuthPanel() {
    views.auth.hide();
  }

  function toggleAuthMode() {
    authIsRegister = !authIsRegister;
    authError.textContent = '';
    if (authIsRegister) {
      authTitle.textContent = 'REGISTER';
      authSubmitBtn.textContent = 'REGISTER';
      authToggleText.innerHTML = 'Have an account? <a id="auth-switch">Login</a>';
      authCountrySelect.style.display = '';
    } else {
      authTitle.textContent = 'LOGIN';
      authSubmitBtn.textContent = 'LOGIN';
      authToggleText.innerHTML = 'No account? <a id="auth-switch">Register</a>';
      authCountrySelect.style.display = 'none';
    }
    document.getElementById('auth-switch').addEventListener('click', toggleAuthMode);
  }

  function updateAccountBar() {
    if (isLoggedIn()) {
      accountUsername.textContent = (authCountry ? countryFlag(authCountry) + ' ' : '') + authUsername;
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
    if (authIsRegister && !authCountrySelect.value) { authError.textContent = 'Select a country'; return; }

    var endpoint = authIsRegister ? '/api/register' : '/api/login';
    authSubmitBtn.disabled = true;
    authError.textContent = '';

    var body = { username: username, password: password };
    if (authIsRegister && authCountrySelect.value) body.country = authCountrySelect.value;
    apiRequest('POST', endpoint, body)
      .then(function (data) {
        authSubmitBtn.disabled = false;
        if (data.error) { authError.textContent = data.error; return; }
        persistAuth(data.token, data.username, data.country);
        session = UserSession;
        hideAuthPanel();
        updateAccountBar();
        uploadLocalData();
        if (!authIsRegister) {
          session.loadSettings(function (remote) {
            for (var k in C.car.defaultSettings) {
              if (remote[k] !== undefined) carSettings[k] = remote[k];
            }
            localStorage.setItem(C.storage.settingsKey, JSON.stringify(carSettings));
            applyCarSettings();
          });
        }
      })
      .catch(function () {
        authSubmitBtn.disabled = false;
        authError.textContent = 'Connection error';
      });
  }

  function fetchLeaderboard(code, laps, rev, night, callback) {
    var qs = '?track_code=' + encodeURIComponent(code)
           + '&laps=' + laps
           + '&reversed=' + !!rev
           + '&night_mode=' + !!night;
    apiRequest('GET', '/api/leaderboard' + qs).then(function (data) {
      callback(data);
    }).catch(function () { callback({ entries: [] }); });
  }

  function fetchChallengeLeaderboard(key, callback) {
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

    if (entry.country) {
      var countryEl = document.createElement('span');
      countryEl.className = 'lb-country';
      countryEl.textContent = countryFlag(entry.country);
      row.appendChild(countryEl);
    }

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

  function showLeaderboardForChallenge(mode) {
    leaderboardListEl.innerHTML = '';

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
    leaderboardListEl.innerHTML = '';
    var desc = formatDescriptor(currentTrackCode, reversed, nightMode, totalLaps);
    leaderboardTrackEl.textContent = desc;
    fetchLeaderboard(currentTrackCode, totalLaps, reversed, nightMode, renderLeaderboardEntries);
  }

  function showLeaderboard() {
    leaderboardListEl.innerHTML = '';

    if (challengeMode) {
      showLeaderboardForChallenge(challengeMode);
    } else {
      showLeaderboardForCurrentTrack();
    }

    views.leaderboard.show();
  }

  function hideLeaderboard() {
    views.leaderboard.hide();
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
    var hw = C.track.width / 2;
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
      '<path d="' + d + '" fill="none" stroke="#555" stroke-width="' + C.track.width + '" stroke-linejoin="round"/>' +
      '<line x1="' + (center[0].x - snx * hw).toFixed(1) + '" y1="' + (center[0].y - sny * hw).toFixed(1) +
      '" x2="' + (center[0].x + snx * hw).toFixed(1) + '" y2="' + (center[0].y + sny * hw).toFixed(1) +
      '" stroke="#fff" stroke-width="3"/>' +
      '</svg>';
  }

  // ── Track generation ──────────────────────────────────────────────
  function isSharedGeom(geom) {
    for (var k in sharedGeom) { if (sharedGeom[k] === geom) return true; }
    return false;
  }

  function disposeMesh(mesh) {
    if (mesh.geometry && !isSharedGeom(mesh.geometry)) mesh.geometry.dispose();
    if (mesh.material && mesh.material !== startWhiteMat && mesh.material !== startBlackMat) mesh.material.dispose();
  }

  function disposeGroup(group) {
    group.traverse(function (child) {
      if (child.isMesh) disposeMesh(child);
    });
  }

  function generateTrack(code) {
    if (trackGroup) {
      disposeGroup(trackGroup);
      scene.remove(trackGroup);
    }
    trackGroup = new THREE.Group();
    scene.add(trackGroup);

    var pts = stringToTrackPoints(code);
    var curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    var sampled = curve.getSpacedPoints(C.track.samples);
    var halfW = C.track.width / 2;
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

    trackGroup.traverse(function (child) {
      child.matrixAutoUpdate = false;
      child.frustumCulled = false;
      child.updateMatrix();
    });

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
    var geom = new THREE.SphereGeometry(1.8, 6, 4);
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
    var size = C.track.width / squares;
    for (var i = 0; i < squares; i++) {
      var box = new THREE.Mesh(
        sharedGeom.startBox,
        i % 2 === 0 ? startWhiteMat : startBlackMat
      );
      var offset = (i - squares / 2 + 0.5) * size;
      box.position.set(p.x + nx * offset, 0.05, p.z + nz * offset);
      box.rotation.y = angle;
      trackGroup.add(box);
    }
  }

  // ── Car mesh creation ─────────────────────────────────────────────
  var sharedGeom = {
    disc:           new THREE.CircleGeometry(C.car.radius, 20),
    halfA:          new THREE.CircleGeometry(C.car.radius, 20, 0, Math.PI),
    halfB:          new THREE.CircleGeometry(C.car.radius, 20, Math.PI, Math.PI),
    ring:           new THREE.RingGeometry(C.car.radius * 0.82, C.car.radius, 20),
    dot:            new THREE.CircleGeometry(C.car.radius * 0.22, 12),
    shadow:         new THREE.CircleGeometry(C.car.radius * 1.1, 20),
    dotsDot:        new THREE.CircleGeometry(C.car.radius * 0.17, 10),
    bullseyeMid:    new THREE.CircleGeometry(C.car.radius * 0.65, 16),
    bullseyeCenter: new THREE.CircleGeometry(C.car.radius * 0.35, 12),
    stripe:         new THREE.PlaneGeometry(C.car.radius * 2, C.car.radius * 0.35),
    startBox:       new THREE.BoxGeometry(C.track.width / 8, 0.1, 3)
  };
  var startWhiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  var startBlackMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

  function createCarMesh(opts) {
    var group = new THREE.Group();
    var transparent = opts.opacity < 1;
    var primary = opts.color;
    var secondary = opts.secondaryColor || primary;
    var pattern = opts.pattern || 'solid';
    var matOpts = { transparent: transparent, opacity: opts.opacity };

    if (pattern === 'half') {
      var halfA = new THREE.Mesh(
        sharedGeom.halfA,
        new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
      );
      halfA.rotation.x = -Math.PI / 2;
      halfA.position.y = 2;
      group.add(halfA);

      var halfB = new THREE.Mesh(
        sharedGeom.halfB,
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
        var rad = rFrac * C.car.radius;
        for (var ai = 0; ai <= aSegs; ai++) {
          var ang = (ai / aSegs) * Math.PI * 2;
          var px = Math.cos(ang) * rad;
          var py = Math.sin(ang) * rad;
          gPositions.push(px, py, 0);
          var t;
          if (pattern === 'gradient') {
            t = (py / C.car.radius + 1) * 0.5;
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
          new THREE.CircleGeometry(C.car.radius, 8, si * sliceAngle, sliceAngle),
          new THREE.MeshLambertMaterial(Object.assign({ color: sliceColor }, matOpts))
        );
        slice.rotation.x = -Math.PI / 2;
        slice.position.y = 2;
        group.add(slice);
      }
    } else if (pattern === 'dots') {
      var dotsDisc = new THREE.Mesh(
        sharedGeom.disc,
        new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
      );
      dotsDisc.rotation.x = -Math.PI / 2;
      dotsDisc.position.y = 2;
      group.add(dotsDisc);
      var dotAngles = [0.4, 1.4, 2.5, 3.7, 5.0];
      var dotDist = C.car.radius * 0.55;
      for (var di = 0; di < dotAngles.length; di++) {
        var da = dotAngles[di];
        var dMesh = new THREE.Mesh(
          sharedGeom.dotsDot,
          new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
        );
        dMesh.rotation.x = -Math.PI / 2;
        dMesh.position.set(Math.sin(da) * dotDist, 2.15, Math.cos(da) * dotDist);
        group.add(dMesh);
      }
    } else if (pattern === 'bullseye') {
      var beDisc = new THREE.Mesh(
        sharedGeom.disc,
        new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
      );
      beDisc.rotation.x = -Math.PI / 2;
      beDisc.position.y = 2;
      group.add(beDisc);
      var beRing = new THREE.Mesh(
        sharedGeom.bullseyeMid,
        new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
      );
      beRing.rotation.x = -Math.PI / 2;
      beRing.position.y = 2.1;
      group.add(beRing);
      var beCenter = new THREE.Mesh(
        sharedGeom.bullseyeCenter,
        new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
      );
      beCenter.rotation.x = -Math.PI / 2;
      beCenter.position.y = 2.15;
      group.add(beCenter);
    } else {
      var disc = new THREE.Mesh(
        sharedGeom.disc,
        new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 2;
      group.add(disc);
    }

    if (pattern === 'stripe') {
      var stripe = new THREE.Mesh(
        sharedGeom.stripe,
        new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.y = 2.15;
      group.add(stripe);
    }

    var ringColor = pattern === 'ring' ? secondary : 0x000000;
    var ringOpacity = pattern === 'ring' ? 0.8 * opts.opacity : 0.3 * opts.opacity;
    var ring = new THREE.Mesh(
      sharedGeom.ring,
      new THREE.MeshLambertMaterial({ color: ringColor, transparent: true, opacity: ringOpacity })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 2.1;
    group.add(ring);

    var dot = new THREE.Mesh(
      sharedGeom.dot,
      new THREE.MeshLambertMaterial(Object.assign({ color: 0xffffff }, matOpts))
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(0, 2.5, C.car.radius * 0.55);
    group.add(dot);

    if (!transparent) {
      var shadow = new THREE.Mesh(
        sharedGeom.shadow,
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
    if (player) { disposeGroup(player.mesh); scene.remove(player.mesh); player = null; }
    if (ghostMesh) { disposeGroup(ghostMesh); scene.remove(ghostMesh); ghostMesh = null; }

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

  function challengeResetMs(mode) {
    var now = new Date();
    if (mode === 'daily-race' || mode === 'daily-series') {
      return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
    }
    var daysSinceMonday = (now.getUTCDay() + 6) % 7;
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7 - daysSinceMonday) - now.getTime();
  }

  function formatCountdown(ms) {
    var totalSec = Math.floor(ms / 1000);
    var d = Math.floor(totalSec / 86400);
    var h = Math.floor((totalSec % 86400) / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
    return m + 'm ' + s + 's';
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

  var challengeStats = {
    empty: [
      "No one\u2019s posted a time yet \u2014 be the first",
      "Wide open \u2014 no times on the board",
      "Unclaimed \u2014 set the pace",
      "Ghost town \u2014 leave the first mark",
      "Empty board \u2014 this one\u2019s yours",
      "Zero entries \u2014 make history",
      "Blank slate \u2014 someone\u2019s gotta go first",
      "The board is cold \u2014 warm it up"
    ],
    notLoggedIn: [
      "{n} on the board \u2014 log in to compete",
      "{n} posted so far \u2014 log in to join",
      "{n} in the mix \u2014 log in and show up",
      "{n} already in \u2014 log in to challenge them",
      "{n} on the clock \u2014 log in to post yours",
      "The board has {n} \u2014 log in and make it {n}+1",
      "{n} left their mark \u2014 log in to leave yours",
      "{n} threw down \u2014 log in and answer"
    ],
    notParticipated: [
      "{n} in and counting \u2014 jump in",
      "{n} on the board \u2014 think you can hang?",
      "{n} posted \u2014 yours isn\u2019t one yet",
      "{n} showed up \u2014 where are you?",
      "{n} already went for it \u2014 your turn",
      "Board\u2019s got {n} \u2014 go add your name",
      "{n} threw down a time \u2014 you in?",
      "{n} and counting \u2014 don\u2019t just watch"
    ],
    first: [
      "{n} in \u2014 you\u2019re on top",
      "Leading the pack out of {n}",
      "On top with {n} behind you",
      "Crown is yours \u2014 {n} tried",
      "Fastest out of {n} \u2014 hold it",
      "{n} in your rearview",
      "Untouched \u2014 {n} couldn\u2019t catch you",
      "The one to beat out of {n}"
    ],
    ranked: [
      "#{rank} of {n} \u2014 {taunt}",
      "Sitting at #{rank} out of {n} \u2014 {taunt}",
      "You\u2019re #{rank} of {n} \u2014 {taunt}",
      "Clocked in at #{rank} of {n} \u2014 {taunt}",
      "#{rank} out of {n} \u2014 {taunt}",
      "Holding #{rank} in a field of {n} \u2014 {taunt}",
      "Landed #{rank} of {n} \u2014 {taunt}",
      "#{rank} with {n} on the board \u2014 {taunt}"
    ]
  };
  var challengeTaunts = {
    close: [
      "almost there", "one push away", "podium\u2019s right there",
      "so close", "one good lap away", "within striking distance",
      "the top is right there", "can you smell it"
    ],
    mid: [
      "room to climb", "not bad, not great", "warming up",
      "middle of the pack", "decent but not done",
      "solid start", "respectable", "keep pushing"
    ],
    far: [
      "got some work to do", "long way up", "brave showing",
      "it\u2019s the taking part that counts", "everyone starts somewhere",
      "the only way is up", "character building", "shaking off the rust"
    ]
  };

  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function challengeStatsMessage(totalCount, userRank) {
    if (totalCount === 0) return pickRandom(challengeStats.empty);
    if (!isLoggedIn()) return pickRandom(challengeStats.notLoggedIn).replace('{n}', totalCount);
    if (!userRank) return pickRandom(challengeStats.notParticipated).replace('{n}', totalCount);
    if (userRank === 1) return pickRandom(challengeStats.first).replace('{n}', totalCount);
    var ratio = userRank / totalCount;
    var pool = ratio <= 0.2 ? challengeTaunts.close : ratio <= 0.5 ? challengeTaunts.mid : challengeTaunts.far;
    return pickRandom(challengeStats.ranked)
      .replace('{n}', totalCount).replace('{rank}', userRank).replace('{taunt}', pickRandom(pool));
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
    lastTrackIdx = 0;
    var bestD = Infinity;
    for (var i = 0; i < track.sampled.length; i++) {
      var dx = player.x - track.sampled[i].x;
      var dz = player.z - track.sampled[i].z;
      var d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; lastTrackIdx = i; }
    }
    player.currentSector = Math.min(Math.floor(lastTrackIdx / track.sampled.length * 4), 3);
  }

  // ── Ghost ─────────────────────────────────────────────────────────
  function createGhost() {
    if (ghostMesh) { disposeGroup(ghostMesh); scene.remove(ghostMesh); ghostMesh = null; }
    if (!bestReplay) return;
    var start = getStartPosition();
    ghostMesh = createCarMesh({
      color: C.car.ghostColor, x: start.x, z: start.z, angle: start.angle, opacity: 0.35
    });
    ghostMesh.traverse(function (child) {
      if (child.isMesh && child.material.type === 'MeshLambertMaterial') {
        var m = child.material;
        child.material = new THREE.MeshBasicMaterial({
          color: m.color, transparent: m.transparent, opacity: m.opacity
        });
      }
    });
    ghostMesh.visible = false;
  }

  function updateGhost() {
    if (!ghostMesh || !bestReplay) return;

    var frameTime = raceTimer / C.track.recordInterval;
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
    if (recordAccum >= C.track.recordInterval) {
      recordAccum -= C.track.recordInterval;
      recording.push({ x: player.x, z: player.z, a: player.angle });
    }
  }

  // ── Physics ───────────────────────────────────────────────────────
  function updatePlayerPhysics(dt, accel, steer) {
    if (player.speed > 5) {
      player.angle += steer * C.physics.steerSpeed * dt;
    }

    var fx = Math.sin(player.angle);
    var fz = Math.cos(player.angle);

    if (accel > 0) {
      var fwdSpeed = player.vx * fx + player.vz * fz;
      if (fwdSpeed < C.physics.maxSpeed) {
        player.vx += fx * C.physics.acceleration * accel * dt;
        player.vz += fz * C.physics.acceleration * accel * dt;
      }
    } else if (accel < 0) {
      player.vx += fx * C.physics.brakeForce * accel * dt;
      player.vz += fz * C.physics.brakeForce * accel * dt;
    }

    var rx = -fz, rz = fx;
    var lateral = player.vx * rx + player.vz * rz;
    var gripDamp = 1 - Math.min(C.physics.grip * dt, 0.95);
    player.vx -= rx * lateral * (1 - gripDamp);
    player.vz -= rz * lateral * (1 - gripDamp);

    var fricPow = Math.pow(C.physics.friction, dt * 60);
    player.vx *= fricPow;
    player.vz *= fricPow;

    player.x += player.vx * dt;
    player.z += player.vz * dt;
    player.speed = Math.sqrt(player.vx * player.vx + player.vz * player.vz);

    player.mesh.rotation.y = player.angle;
  }

  // ── Wall collision ────────────────────────────────────────────────
  var _psd = { d: 0, cx: 0, cz: 0 };

  function pointSegDist(px, pz, ax, az, bx, bz) {
    var dx = bx - ax, dz = bz - az;
    var lenSq = dx * dx + dz * dz;
    if (lenSq < 0.001) {
      _psd.d = Math.sqrt((px - ax) * (px - ax) + (pz - az) * (pz - az));
      _psd.cx = ax; _psd.cz = az;
      return _psd;
    }
    var t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
    var cx = ax + t * dx, cz = az + t * dz;
    var ex = px - cx, ez = pz - cz;
    _psd.d = Math.sqrt(ex * ex + ez * ez);
    _psd.cx = cx; _psd.cz = cz;
    return _psd;
  }

  var collisionWindow = 40;

  function wallCollision(edge) {
    var r = C.car.radius + 1.8;
    var n = edge.length;
    for (var offset = -collisionWindow; offset <= collisionWindow; offset++) {
      var i = ((lastTrackIdx + offset) % n + n) % n;
      var j = (i + 1) % n;
      pointSegDist(player.x, player.z, edge[i].x, edge[i].z, edge[j].x, edge[j].z);
      if (_psd.d < r && _psd.d > 0.01) {
        var nx = (player.x - _psd.cx) / _psd.d;
        var nz = (player.z - _psd.cz) / _psd.d;
        player.x = _psd.cx + nx * r;
        player.z = _psd.cz + nz * r;

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
  var lastTrackIdx = 0;

  function getTrackT(car) {
    var n = track.sampled.length;
    var best = 0, bestD = Infinity;
    var window = 40;
    for (var offset = -window; offset <= window; offset++) {
      var i = ((lastTrackIdx + offset) % n + n) % n;
      var dx = car.x - track.sampled[i].x;
      var dz = car.z - track.sampled[i].z;
      var d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    lastTrackIdx = best;
    return best / n;
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
    views.results.hide();
    startCountdown();
  }

  // ── Input ─────────────────────────────────────────────────────────
  function setupInput() {
    window.addEventListener('keydown', function (e) {
      keys[e.code] = true;
      var authOpen = views.auth.isOpen();
      var lbOpen = views.leaderboard.isOpen();

      if (e.code === 'Enter' && !authOpen) {
        e.preventDefault();
        if (gameState === 'menu' && !views.records.isOpen() && !views.settings.isOpen() && !lbOpen) {
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
        if (authOpen) {
          hideAuthPanel();
        } else if (lbOpen) {
          hideLeaderboard();
          if (leaderboardFrom === 'results') views.results.show();
          else views.menu.show();
          leaderboardFrom = null;
        } else if (views.settings.isOpen()) {
          hideSettings();
        } else if (views.records.isOpen()) {
          hideRecords();
        } else if (gameState === 'finished') {
          restartRace();
        }
      }

      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && !authOpen && !lbOpen) {
        e.preventDefault();
        if (gameState === 'menu' && !views.records.isOpen() && !views.settings.isOpen()) {
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
        cameraModeIndex = (cameraModeIndex + 1) % C.camera.modes.length;
        applyCameraMode();
      }
    });

    window.addEventListener('keyup', function (e) { keys[e.code] = false; });

    if (isMobile) {
      var DEAD_ZONE = 15;
      var canvas = renderer.domElement;

      function processTouch(touch) {
        var halfW = window.innerWidth / 2;
        if (touch.clientX < halfW) {
          touchIds.steer = touch.identifier;
          steerOriginX = touch.clientX;
          touchSteerIndicator.style.left = (touch.clientX - 40) + 'px';
          touchSteerIndicator.style.top = (touch.clientY - 40) + 'px';
          touchSteerIndicator.classList.add('active');
          touchSteerDot.style.left = '50%';
        } else {
          touchIds.throttle = touch.identifier;
          var ratio = touch.clientY / window.innerHeight;
          if (ratio < 0.65) {
            touchState.accel = 1;
            touchGasHighlight.classList.add('active');
            touchBrakeHighlight.classList.remove('active');
          } else {
            touchState.accel = -1;
            touchBrakeHighlight.classList.add('active');
            touchGasHighlight.classList.remove('active');
          }
        }
      }

      canvas.addEventListener('touchstart', function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) processTouch(e.changedTouches[i]);
      }, { passive: false });

      canvas.addEventListener('touchmove', function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.identifier === touchIds.steer) {
            var dx = t.clientX - steerOriginX;
            if (dx < -DEAD_ZONE) touchState.steer = 1;
            else if (dx > DEAD_ZONE) touchState.steer = -1;
            else touchState.steer = 0;
            var dotPct = 50 + Math.max(-40, Math.min(40, dx)) * (40 / 60);
            touchSteerDot.style.left = dotPct + '%';
          } else if (t.identifier === touchIds.throttle) {
            var ratio = t.clientY / window.innerHeight;
            if (ratio < 0.65) {
              touchState.accel = 1;
              touchGasHighlight.classList.add('active');
              touchBrakeHighlight.classList.remove('active');
            } else {
              touchState.accel = -1;
              touchBrakeHighlight.classList.add('active');
              touchGasHighlight.classList.remove('active');
            }
          }
        }
      }, { passive: false });

      function handleTouchEnd(e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
          var id = e.changedTouches[i].identifier;
          if (id === touchIds.steer) {
            touchIds.steer = null;
            touchState.steer = 0;
            touchSteerIndicator.classList.remove('active');
          }
          if (id === touchIds.throttle) {
            touchIds.throttle = null;
            touchState.accel = 0;
            touchGasHighlight.classList.remove('active');
            touchBrakeHighlight.classList.remove('active');
          }
        }
      }

      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
      canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

      function addTouchBtn(el, fn) {
        el.addEventListener('touchstart', function (e) {
          e.stopPropagation();
          e.preventDefault();
          fn();
        }, { passive: false });
      }

      addTouchBtn(touchRestartBtn, function () {
        if (gameState === 'racing' || gameState === 'countdown') {
          restartCurrentMap();
        } else if (gameState === 'finished') {
          if (seriesMode && currentStageIndex < stageCount - 1) advanceToNextStage();
          else restartCurrentMap();
        }
      });

      addTouchBtn(touchCameraBtn, function () {
        cameraModeIndex = (cameraModeIndex + 1) % C.camera.modes.length;
        applyCameraMode();
      });

      addTouchBtn(touchMenuBtn, function () {
        if (gameState === 'finished') restartRace();
      });
    }

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
        if (challengeCountdownInterval) {
          clearInterval(challengeCountdownInterval);
          challengeCountdownInterval = null;
        }
        seriesMode = raceTypeBtn.querySelector('.selected').dataset.val === 'SERIES';
        reversed = dirToggleBtn.querySelector('.selected').dataset.val === 'REV';
        nightMode = modeToggleBtn.querySelector('.selected').dataset.val === 'NIGHT';
        totalLaps = parseInt(lapsValueEl.textContent, 10);
        if (gameState === 'menu') rebuildTrack(trackCodeInput.value);
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

    var challengeCountdownInterval = null;

    function renderChallengePreview() {
      var mode = challengeModeToggle.querySelector('.selected').dataset.val;

      loadChallengeConfig(mode);

      var info = challengeConfigForMode(mode);
      challengePreviewEl.innerHTML = '';
      if (challengeCountdownInterval) {
        clearInterval(challengeCountdownInterval);
        challengeCountdownInterval = null;
      }

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

      var countdown = document.createElement('div');
      countdown.className = 'challenge-preview-countdown';
      function updateCountdown() {
        var remaining = challengeResetMs(mode);
        if (remaining <= 0) {
          renderChallengePreview();
          return;
        }
        countdown.textContent = 'Changes in ' + formatCountdown(remaining);
      }
      updateCountdown();
      challengeCountdownInterval = setInterval(updateCountdown, 1000);
      challengePreviewEl.appendChild(countdown);

      challengeLbSubtitle.classList.remove('visible');
      challengeLbSubtitle.querySelector('span').textContent = '';

      var isSeries = mode === 'daily-series' || mode === 'weekly-series';
      var fetchFn = isSeries
        ? function (cb) { fetchChallengeLeaderboard(challengeKey(mode), cb); }
        : function (cb) {
            fetchLeaderboard(info.config.code, info.config.laps, info.config.reversed, info.config.nightMode, cb);
          };

      fetchFn(function (data) {
        var total = data.total_count || 0;
        var userRank = null;
        if (isLoggedIn() && data.entries) {
          for (var j = 0; j < data.entries.length; j++) {
            if (data.entries[j].username === authUsername) { userRank = j + 1; break; }
          }
          if (!userRank && data.user_entry) userRank = data.user_entry.rank;
        }
        challengeLbSubtitle.querySelector('span').textContent = challengeStatsMessage(total, userRank);
        challengeLbSubtitle.classList.add('visible');
      });
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
      views.results.hide();
      showLeaderboard();
    });
    leaderboardMenuBtn.addEventListener('click', function () {
      if (gameState !== 'menu') return;
      leaderboardFrom = 'menu';
      var mode = challengeModeToggle.querySelector('.selected').dataset.val;
      views.menu.hide();
      views.leaderboard.show();
      showLeaderboardForChallenge(mode);
    });
    leaderboardBackEl.addEventListener('click', function () {
      hideLeaderboard();
      if (leaderboardFrom === 'results') views.results.show();
      else views.menu.show();
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

  var _input = { accel: 0, steer: 0 };

  function getPlayerInput() {
    if (document.activeElement === trackCodeInput) { _input.accel = 0; _input.steer = 0; return _input; }
    _input.accel = 0; _input.steer = 0;
    if (keys['ArrowUp'] || keys['KeyW']) _input.accel = 1;
    if (keys['ArrowDown'] || keys['KeyS']) _input.accel = _input.accel === 1 ? 0 : -1;
    if (keys['ArrowLeft'] || keys['KeyA']) _input.steer = 1;
    if (keys['ArrowRight'] || keys['KeyD']) _input.steer = -1;
    if (touchState.accel) _input.accel = touchState.accel;
    if (touchState.steer) _input.steer = touchState.steer;
    return _input;
  }

  // ── HUD ───────────────────────────────────────────────────────────
  function addLapTimeToHUD(lapNum, lapTime) {
    var div = document.createElement('div');
    div.className = 'hud-box';
    if (lapNum > 1) div.style.marginTop = '4px';
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

  var _hudLap = -1, _hudBest = -1, _hudStage = -1, _hudSeries = -1;

  function resetHUDCache() {
    _hudLap = -1; _hudBest = -1; _hudStage = -1; _hudSeries = -1;
  }

  function updateHUD() {
    var displayLap = Math.min(player.lap + 1, totalLaps);
    if (displayLap !== _hudLap) {
      _hudLap = displayLap;
      lapDisplay.textContent = 'LAP ' + displayLap + ' / ' + totalLaps;
    }
    if (bestTime !== _hudBest) {
      _hudBest = bestTime;
      bestDisplay.textContent = 'BEST ' + (bestTime ? formatTime(bestTime) : '--:--.--');
    }
    timeDisplay.textContent = formatTime(raceTimer);
    speedDisplay.textContent = Math.round(player.speed * 1.2) + ' km/h';
    var stageKey = seriesMode ? currentStageIndex : -1;
    if (stageKey !== _hudStage || (seriesMode ? 1 : 0) !== _hudSeries) {
      _hudStage = stageKey;
      _hudSeries = seriesMode ? 1 : 0;
      if (seriesMode) {
        stageDisplayEl.style.display = 'block';
        stageDisplayEl.textContent = 'STAGE ' + (currentStageIndex + 1) + ' / ' + stageCount;
        lapDisplay.style.top = '62px';
        lapTimesList.style.top = '104px';
      } else {
        stageDisplayEl.style.display = 'none';
        lapDisplay.style.top = '20px';
        lapTimesList.style.top = '62px';
      }
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
    if (ghostMesh) ghostMesh.visible = true;
    gameState = 'countdown';
    views.menu.hide();
    views.accountBar.hide();
    raceTimer = 0;
    lapTimesList.innerHTML = '';
    views.hud.show();
    resetHUDCache();
    updateHUD();
    for (var i = 0; i < semLights.length; i++) {
      semLights[i].className = 'sem-light';
    }
    views.countdown.show();
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
      views.countdown.hide();
      recording = [{ x: player.x, z: player.z, a: player.angle }];
      recordAccum = 0;
    }
  }

  function showResults() {
    gameState = 'finished';
    views.hud.hide();
    views.accountBar.show();
    views.results.show();
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

  function shareURL() {
    if (seriesMode) {
      var descs = [];
      for (var i = 0; i < seriesResults.length; i++) {
        var sr = seriesResults[i];
        descs.push(formatDescriptor(sr.code, sr.reversed, sr.nightMode, totalLaps));
      }
      return C.share.base + '?s=' + encodeURIComponent(descs.join(','));
    }
    return C.share.base + '?t=' + encodeURIComponent(formatDescriptor(currentTrackCode, reversed, nightMode, totalLaps));
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function buildShareText() {
    var openers = lastRaceWasRecord ? C.share.openersRecord : C.share.openers;
    var closers = lastRaceWasRecord ? C.share.closersRecord : C.share.closers;
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
    views.results.hide();
    if (player) { disposeGroup(player.mesh); scene.remove(player.mesh); player = null; }
    createPlayer();
    createGhost();
    if (ghostMesh) ghostMesh.visible = true;
    gameState = 'countdown';
    views.menu.hide();
    views.accountBar.hide();
    raceTimer = 0;
    recording = [];
    recordAccum = 0;
    lapTimesList.innerHTML = '';
    views.hud.show();
    resetHUDCache();
    updateHUD();
    for (var i = 0; i < semLights.length; i++) {
      semLights[i].className = 'sem-light';
    }
    views.countdown.show();
    countdownTimer = 0;
    countdownValue = 0;
  }

  function restartRace() {
    views.results.hide();
    views.menu.show();
    views.accountBar.show();
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
    if (views.settings.isOpen()) hideSettings();
    recordsListEl.innerHTML = '';
    views.menu.hide();
    views.records.show();

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

    views.records.hide();

    rebuildTrack(rec.code);
    startCountdown();
  }

  function hideRecords() {
    views.records.hide();
    views.menu.show();
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
    for (var i = 0; i < C.car.patterns.length; i++) {
      var p = C.car.patterns[i];
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
    disposeGroup(player.mesh);
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
    for (var i = 0; i < C.camera.modes.length; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seg-option' + (!showcaseActive && i === cameraModeIndex ? ' selected' : '');
      btn.dataset.val = String(i);
      btn.textContent = C.camera.modes[i];
      previewCameraToggle.appendChild(btn);
    }
  }

  function showSettings() {
    if (views.records.isOpen()) hideRecords();
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

    views.menu.hide();
    views.accountBar.hide();
    views.settings.show();
    settingsBackEl.style.display = '';
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
    views.settings.hide();
    settingsBackEl.style.display = 'none';
    views.accountBar.show();
    views.menu.show();
  }

  function updatePreviewDrive(dt) {
    if (!player || !track) return;
    previewT = (previewT + C.camera.previewSpeed * dt) % 1;
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
    var shot = C.camera.showcase.shots[showcaseTimer < 0 ? 0 : showcaseShotIndex];
    var elapsed = showcaseTimer;

    if (elapsed >= shot.duration) {
      showcaseTimer = 0;
      elapsed = 0;
      showcaseShotIndex = (showcaseShotIndex + 1) % C.camera.showcase.shots.length;
      shot = C.camera.showcase.shots[showcaseShotIndex];
    }

    var angleOffset = showcaseShotIndex * 1.8;
    var pos = showcaseShotPosition(shot, elapsed, angleOffset);

    if (elapsed < C.camera.showcase.transition) {
      var prevIndex = (showcaseShotIndex - 1 + C.camera.showcase.shots.length) % C.camera.showcase.shots.length;
      var prevShot = C.camera.showcase.shots[prevIndex];
      var prevAngle = prevIndex * 1.8;
      var prevPos = showcaseShotPosition(prevShot, prevShot.duration, prevAngle);
      var t = elapsed / C.camera.showcase.transition;
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
    var mode = C.camera.modes[cameraModeIndex];
    if (mode === 'TOP-DOWN') {
      camera.position.x += (player.x - camera.position.x) * 0.08;
      camera.position.z += (player.z - camera.position.z) * 0.08;
      camera.position.y = C.camera.height;
      camera.up.set(0, 0, -1);
      camera.lookAt(camera.position.x, 0, camera.position.z);
    } else if (mode === 'ROTATED') {
      camera.position.x += (player.x - camera.position.x) * 0.08;
      camera.position.z += (player.z - camera.position.z) * 0.08;
      camera.position.y = C.camera.height;
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
    var mode = C.camera.modes[cameraModeIndex];
    if (mode === 'CHASE') {
      camera = perspCamera;
    } else {
      camera = orthoCamera;
      var aspect = window.innerWidth / window.innerHeight;
      var vs = (mode === 'ISOMETRIC') ? C.camera.viewSize * 1.4 : C.camera.viewSize;
      var hw = vs / 2, hh = hw / aspect;
      orthoCamera.left = -hw;
      orthoCamera.right = hw;
      orthoCamera.top = hh;
      orthoCamera.bottom = -hh;
      orthoCamera.updateProjectionMatrix();
    }
    if (player) {
      if (mode === 'TOP-DOWN' || mode === 'ROTATED') {
        camera.position.set(player.x, C.camera.height, player.z);
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
      new THREE.CircleGeometry(C.car.radius * 1.05, segments),
      new THREE.MeshBasicMaterial({ color: colorInt, transparent: true, opacity: 0.45 * fade, depthWrite: false })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.04;
    group.add(inner);

    var edgeR = C.car.radius * 0.9;
    var outerR = C.car.radius * 2.7;
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
    disposeMesh(beamMeshL);
    disposeMesh(beamMeshR);
    disposeMesh(glowMesh);
    disposeMesh(tailMesh);
    disposeGroup(underglowMesh);
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

  var prevNightState = null;

  function applyNightToggle() {
    var isNight = nightMode;
    ambientLight.intensity = isNight ? 0 : 1.0;
    scene.background.set(isNight ? 0x000000 : 0x5d8a4a);
    carPointLight.intensity = isNight ? 0.8 : 0;
    prevNightState = isNight;
  }

  function updateNightMode() {
    if (nightMode !== prevNightState) applyNightToggle();

    var hasPlayer = !!player;
    var showBeams = nightMode && hasPlayer;
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

    var headlightFwd = C.car.radius * 0.6;

    beamMeshL.position.set(player.x + fx * headlightFwd, 0, player.z + fz * headlightFwd);
    beamMeshL.rotation.y = player.angle - 0.06;
    beamMeshR.position.set(player.x + fx * headlightFwd, 0, player.z + fz * headlightFwd);
    beamMeshR.rotation.y = player.angle + 0.06;

    glowMesh.position.set(player.x, 0, player.z);
    tailMesh.position.set(player.x - fx * C.car.radius, 0, player.z - fz * C.car.radius);

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

    if (views.settings.isOpen() && previewRunning) {
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

    if (isMobile) {
      document.body.classList.add('mobile');
      var startPrompts = document.querySelectorAll('.start-prompt');
      for (var i = 0; i < startPrompts.length; i++) {
        var text = startPrompts[i].textContent;
        if (text.indexOf('ENTER') !== -1 && text.indexOf('ESC') !== -1) {
          startPrompts[i].textContent = 'Tap to retry';
        } else if (text.indexOf('ENTER') !== -1) {
          startPrompts[i].textContent = 'Tap to start';
        } else if (text.indexOf('ESC') !== -1) {
          startPrompts[i].textContent = 'Back';
        }
      }
      document.getElementById('auth-close').textContent = 'Skip';
      document.getElementById('event-start-prompt').addEventListener('click', function () {
        if (gameState === 'menu' && !views.records.isOpen() && !views.settings.isOpen() && !views.leaderboard.isOpen()) startCountdown();
      });
      document.getElementById('challenge-start-prompt').addEventListener('click', function () {
        if (gameState === 'menu' && !views.records.isOpen() && !views.settings.isOpen() && !views.leaderboard.isOpen()) startCountdown();
      });
      document.getElementById('results-prompt').addEventListener('click', function () {
        if (gameState === 'finished') {
          if (seriesMode && currentStageIndex < stageCount - 1) advanceToNextStage();
          else restartCurrentMap();
        }
      });
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5d8a4a);

    var aspect = window.innerWidth / window.innerHeight;
    var halfW = C.camera.viewSize / 2;
    var halfH = halfW / aspect;
    orthoCamera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 1000);
    orthoCamera.position.set(0, C.camera.height, 0);
    orthoCamera.up.set(0, 0, -1);
    orthoCamera.lookAt(0, 0, 0);
    perspCamera = new THREE.PerspectiveCamera(70, aspect, 1, 2000);
    camera = orthoCamera;
    cameraDisplayEl.textContent = C.camera.modes[cameraModeIndex];

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.prepend(renderer.domElement);
    setupLights();

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshLambertMaterial({ color: 0x5d8a4a })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.matrixAutoUpdate = false;
    ground.frustumCulled = false;
    ground.updateMatrix();
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
      var vs = (C.camera.modes[cameraModeIndex] === 'ISOMETRIC') ? C.camera.viewSize * 1.4 : C.camera.viewSize;
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
