import { C } from './constants.js';
import { storageKey, encodeReplay, decodeReplay, loadLocalBest, loadLocalAllBestTimes, GuestSession } from './storage.js';
import { hexToInt, hexToRgb, intToHex, disposeMesh, disposeGroup, formatTime } from './utils.js';
import { generateTrack, generateTrackSVG, getStartPosition } from './track.js';
import { createCarMesh, updateCarColors } from './car-mesh.js';
import { Player } from './player.js';
import { Ghost } from './ghost.js';
import { Camera } from './camera.js';
import { NightRenderer } from './night.js';
import { setupInput, getInput } from './input.js';
import { isLoggedIn, getUsername, getCountry, loadAuth as loadAuthState, persistAuth, clearAuth, countryFlag, apiRequest, createUserSession, fetchLeaderboard, fetchChallengeLeaderboard } from './auth.js';
import { createHUD } from './hud.js';
import { createResults } from './results.js';
import { createMenu } from './menu.js';
import { createRecords, createLeaderboard, createAuthPanel, createAccountBar } from './panels.js';
import { createSettingsPanel } from './settings-panel.js';

  var totalLaps = 3;
  var reversed = false;
  var nightMode = false;
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

  var scene, renderer;
  var trackGroup;
  var track;
  var player;
  var cam;
  var nightRenderer;
  var isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  var gameState = 'menu';
  var leaderboardFrom = null;
  var raceTimer = 0;
  var countdownTimer = 0;
  var countdownValue = 0;
  var lastTime = 0;
  var rebuildTimer;
  var currentTrackCode = '';

  var sceneDirty = true;

  var recording = [];
  var recordAccum = 0;
  var bestReplay = null;
  var bestTime = null;
  var lastRaceWasRecord = false;

  var previewNightMode = false;
  var savedNightMode = false;

  var hud = createHUD();
  var results = createResults();
  var menu = createMenu(generateTrackSVG);
  var records = createRecords(generateTrackSVG, formatDescriptor);
  var leaderboard = createLeaderboard(countryFlag);
  var auth = createAuthPanel(C.countries, countryFlag);
  var accountBar = createAccountBar();
  var settingsPanel = createSettingsPanel();

  // ── Sessions ───────────────────────────────────────────────────
  var UserSession = createUserSession(function () { return challengeMode; });
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

  function loadAuth() {
    if (loadAuthState()) session = UserSession;
  }

  function uploadLocalData() {
    apiRequest('PUT', '/api/settings', { settings: carSettings }).catch(function () {});
  }

  function showAuthPanel() {
    auth.showLogin();
  }

  function hideAuthPanel() {
    auth.hide();
  }

  function updateAccountBar() {
    accountBar.update(isLoggedIn(), getUsername(), getCountry(), countryFlag);
  }

  function handleAuthSubmit(e) {
    e.preventDefault();
    var creds = auth.getCredentials();
    if (!creds.username || !creds.password) { auth.setError('Fill in both fields'); return; }
    if (creds.isRegister && !creds.country) { auth.setError('Select a country'); return; }

    var endpoint = creds.isRegister ? '/api/register' : '/api/login';
    auth.setSubmitting(true);
    auth.clearError();

    var body = { username: creds.username, password: creds.password };
    if (creds.isRegister && creds.country) body.country = creds.country;
    apiRequest('POST', endpoint, body)
      .then(function (data) {
        auth.setSubmitting(false);
        if (data.error) { auth.setError(data.error); return; }
        persistAuth(data.token, data.username, data.country);
        session = UserSession;
        hideAuthPanel();
        updateAccountBar();
        uploadLocalData();
        if (!creds.isRegister) {
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
        auth.setSubmitting(false);
        auth.setError('Connection error');
      });
  }


  function showLeaderboardForChallenge(mode) {
    leaderboard.clear();

    var label = challengeLabel(mode);
    var key = challengeKey(mode);
    var isSeries = mode === 'daily-series' || mode === 'weekly-series';

    leaderboard.setTrackText(label);

    if (isSeries) {
      fetchChallengeLeaderboard(key, function (data) {
        leaderboard.render(data, isLoggedIn, getUsername);
      });
    } else {
      var config = mode === 'daily-race' ? dailyConfig() : weeklyRaceConfig();
      fetchLeaderboard(config.code, config.laps, config.reversed, config.nightMode, function (data) {
        leaderboard.render(data, isLoggedIn, getUsername);
      });
    }
  }

  function showLeaderboardForCurrentTrack() {
    leaderboard.clear();
    var desc = formatDescriptor(currentTrackCode, reversed, nightMode, totalLaps);
    leaderboard.setTrackText(desc);
    fetchLeaderboard(currentTrackCode, totalLaps, reversed, nightMode, function (data) {
      leaderboard.render(data, isLoggedIn, getUsername);
    });
  }

  function showLeaderboardPanel() {
    leaderboard.clear();

    if (challengeMode) {
      showLeaderboardForChallenge(challengeMode);
    } else {
      showLeaderboardForCurrentTrack();
    }

    leaderboard.show();
  }

  function hideLeaderboardPanel() {
    leaderboard.hide();
  }


  // ── Rebuild track ─────────────────────────────────────────────────
  function rebuildTrack(code) {
    if (player) { disposeGroup(player.mesh); scene.remove(player.mesh); player = null; }
    ghost.dispose(scene);

    currentTrackCode = code;
    track = generateTrack(code, scene, trackGroup);
    trackGroup = track.group;
    createPlayer();
    loadBest(code, function () { createGhost(); });
    sceneDirty = true;
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
    var start = getStartPosition(track.curve, reversed);
    var mesh = createCarMesh({
      color: hexToInt(carSettings.primaryColor),
      secondaryColor: hexToInt(carSettings.secondaryColor),
      pattern: carSettings.pattern,
      x: start.x, z: start.z, angle: start.angle, opacity: 1
    });
    scene.add(mesh);
    player = new Player(mesh, start.x, start.z, start.angle);
    player.initTrackIndex(track.sampled);
  }

  // ── Ghost ─────────────────────────────────────────────────────────
  var ghost = new Ghost();

  function createGhost() {
    ghost.create(bestReplay, track.curve, reversed, scene);
  }

  // ── Recording ─────────────────────────────────────────────────────
  function recordFrame(dt) {
    recordAccum += dt;
    if (recordAccum >= C.track.recordInterval) {
      recordAccum -= C.track.recordInterval;
      recording.push({ x: player.x, z: player.z, a: player.angle });
    }
  }

  // ── Series ────────────────────────────────────────────────────────
  function buildStageList() {
    menu.buildStageList(stageCount, stageConfigs, parseDescriptor, randomCode, function () {
      challengeMode = null;
    });
  }

  function advanceToNextStage() {
    currentStageIndex++;
    results.hide();
    startCountdown();
  }

  // ── Input ─────────────────────────────────────────────────────────
  function initInput() {
    setupInput(renderer.domElement, isMobile, {
      onKeyDown: function (e) {
        var authOpen = auth.isOpen();
        var lbOpen = leaderboard.isOpen();

        if (e.code === 'Enter' && !authOpen) {
          e.preventDefault();
          if (gameState === 'menu' && !records.isOpen() && !settingsPanel.isOpen() && !lbOpen) {
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
            hideLeaderboardPanel();
            if (leaderboardFrom === 'results') results.show();
            else menu.show();
            leaderboardFrom = null;
          } else if (settingsPanel.isOpen()) {
            hideSettings();
          } else if (records.isOpen()) {
            hideRecords();
          } else if (gameState === 'finished') {
            restartRace();
          }
        }

        if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && !authOpen && !lbOpen) {
          e.preventDefault();
          if (gameState === 'menu' && !records.isOpen() && !settingsPanel.isOpen()) {
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
          cam.cycleMode();
          hud.setCameraLabel(cam.applyMode(player));
          sceneDirty = true;
        }
      },
      onTouchRestart: function () {
        if (gameState === 'racing' || gameState === 'countdown') {
          restartCurrentMap();
        } else if (gameState === 'finished') {
          if (seriesMode && currentStageIndex < stageCount - 1) advanceToNextStage();
          else restartCurrentMap();
        }
      },
      onTouchCamera: function () {
        cam.cycleMode();
        hud.setCameraLabel(cam.applyMode(player));
        sceneDirty = true;
      },
      onTouchMenu: function () {
        if (gameState === 'finished') restartRace();
      }
    });

    menu.onTrackCodeInput(function () {
      challengeMode = null;
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(function () {
        var parsed = parseDescriptor(menu.getTrackCode());
        if (parsed.reversed !== undefined) {
          reversed = parsed.reversed;
          menu.setDirection(reversed);
        }
        if (parsed.nightMode !== undefined) {
          nightMode = parsed.nightMode;
          menu.setNightMode(nightMode);
        }
        if (parsed.laps !== undefined) {
          totalLaps = parsed.laps;
          menu.setLaps(totalLaps);
        }
        menu.setTrackCode(parsed.code);
        if (gameState === 'menu') rebuildTrack(parsed.code);
      }, 200);
    });

    menu.onRandomize(function () {
      challengeMode = null;
      menu.setTrackCode(randomCode());
      if (gameState === 'menu') rebuildTrack(menu.getTrackCode());
    });

    menu.onTabToggle(function (tab) {
      if (tab === 'event') {
        challengeMode = null;
        menu.stopChallengeCountdown();
        seriesMode = menu.getSeriesMode();
        reversed = menu.getDirection();
        nightMode = menu.getNightMode();
        totalLaps = menu.getLaps();
        if (gameState === 'menu') rebuildTrack(menu.getTrackCode());
      } else {
        renderChallengePreview();
      }
    });

    menu.onChallengeToggle(function () {
      renderChallengePreview();
    });

    menu.onLapsMinus(function () {
      if (totalLaps > 1) {
        totalLaps--;
        menu.setLaps(totalLaps);
        challengeMode = null;
        if (gameState === 'menu') rebuildTrack(menu.getTrackCode());
      }
    });

    menu.onLapsPlus(function () {
      if (totalLaps < 20) {
        totalLaps++;
        menu.setLaps(totalLaps);
        challengeMode = null;
        if (gameState === 'menu') rebuildTrack(menu.getTrackCode());
      }
    });

    results.onCopy(function () {
      navigator.clipboard.writeText(formatDescriptor(currentTrackCode, reversed, nightMode, totalLaps)).then(function () {
        results.flashCopyDone();
      });
    });

    results.onShare(function () {
      navigator.clipboard.writeText(buildShareText()).then(function () {
        results.flashShareDone();
      });
    });

    menu.onDirectionToggle(function (isReversed) {
      reversed = isReversed;
      challengeMode = null;
      if (gameState === 'menu') rebuildTrack(menu.getTrackCode());
    });

    menu.onModeToggle(function (isNight) {
      nightMode = isNight;
      challengeMode = null;
      sceneDirty = true;
    });

    menu.onRaceTypeToggle(function (isSeries) {
      challengeMode = null;
      seriesMode = isSeries;
      if (seriesMode) buildStageList();
      if (!seriesMode && gameState === 'menu') rebuildTrack(menu.getTrackCode());
    });

    menu.onStagesMinus(function () {
      if (stageCount > 2) {
        stageCount--;
        menu.setStageCount(stageCount);
        challengeMode = null;
        buildStageList();
      }
    });

    menu.onStagesPlus(function () {
      if (stageCount < 5) {
        stageCount++;
        menu.setStageCount(stageCount);
        challengeMode = null;
        buildStageList();
      }
    });

    menu.onRngAll(function () {
      challengeMode = null;
      for (var i = 0; i < stageCount; i++) {
        stageConfigs[i].code = randomCode();
        stageConfigs[i].reversed = Math.random() > 0.5;
        stageConfigs[i].nightMode = Math.random() > 0.5;
      }
      totalLaps = Math.floor(Math.random() * 5) + 1;
      menu.setLaps(totalLaps);
      buildStageList();
    });

    records.onOpen(function () {
      if (gameState === 'menu') showRecords();
    });

    records.onBack(function () {
      hideRecords();
    });

    settingsPanel.onOpen(function () {
      if (gameState === 'menu') showSettings();
    });

    settingsPanel.onBack(function () {
      hideSettings();
    });

    auth.onSubmit(handleAuthSubmit);
    auth.onClose(hideAuthPanel);
    accountBar.onLogout(function () {
      clearAuth();
      session = GuestSession;
      updateAccountBar();
    });
    accountBar.onLogin(function () {
      showAuthPanel();
    });

    results.onLeaderboardClick(function () {
      leaderboardFrom = 'results';
      results.hide();
      showLeaderboardPanel();
    });
    leaderboard.onMenuOpen(function () {
      if (gameState !== 'menu') return;
      leaderboardFrom = 'menu';
      var mode = menu.getSelectedChallengeMode();
      menu.hide();
      leaderboard.show();
      showLeaderboardForChallenge(mode);
    });
    leaderboard.onBack(function () {
      hideLeaderboardPanel();
      if (leaderboardFrom === 'results') results.show();
      else menu.show();
      leaderboardFrom = null;
    });

    settingsPanel.onPatternSelect(function (pattern) {
      carSettings.pattern = pattern;
      saveSettings();
      applyCarSettings();
    });

    settingsPanel.onColorChange(function (key, value) {
      carSettings[key] = value;
      saveSettings();
      updatePatternPreviews();
      updateCarColorsInPlace();
    });

    settingsPanel.onHeadlightChange(function (key, value) {
      carSettings[key] = value;
      saveSettings();
      switchPreviewToNight();
      nightRenderer.updateColors(carSettings);
      sceneDirty = true;
    });

    settingsPanel.onHeadlightShapeChange(function (value) {
      carSettings.headlightShape = value;
      saveSettings();
      switchPreviewToNight();
      nightRenderer.rebuildMeshes(carSettings);
      sceneDirty = true;
    });

    settingsPanel.onUnderglowChange(function (key, value) {
      carSettings[key] = value;
      saveSettings();
      nightRenderer.updateColors(carSettings);
      sceneDirty = true;
    });

    settingsPanel.onUnderglowOpacityChange(function (value) {
      carSettings.underglowOpacity = value;
      saveSettings();
      nightRenderer.updateColors(carSettings);
      sceneDirty = true;
    });

    settingsPanel.onPreviewModeToggle(function (isNight) {
      previewNightMode = isNight;
      nightMode = previewNightMode;
      sceneDirty = true;
    });

    settingsPanel.onPreviewCameraToggle(function (val) {
      if (val === 'showcase') {
        cam.startShowcase();
      } else {
        cam.showcaseActive = false;
        cam.modeIndex = parseInt(val);
        hud.setCameraLabel(cam.applyMode(player));
      }
      sceneDirty = true;
    });

    settingsPanel.onPreviewDriveToggle(function (running) {
      previewRunning = running;
      if (previewRunning) previewT = 0;
      sceneDirty = true;
    });
  }


  // ── HUD ───────────────────────────────────────────────────────────
  function addLapTimeToHUD(lapNum, lapTime) {
    var prevTime = lapNum > 1 ? player.lapTimes[lapNum - 2] : null;
    hud.addLapTime(lapNum, lapTime, prevTime);
  }

  function updateHUD() {
    hud.update({
      lap: player.lap, totalLaps: totalLaps, bestTime: bestTime,
      raceTimer: raceTimer, speed: player.speed,
      seriesMode: seriesMode, currentStageIndex: currentStageIndex, stageCount: stageCount
    });
  }

  // ── Challenge preview ─────────────────────────────────────────────
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
    var mode = menu.getSelectedChallengeMode();
    loadChallengeConfig(mode);
    var info = challengeConfigForMode(mode);

    menu.renderChallengePreview(info, challengeResetMs, formatCountdown, renderChallengePreview);

    leaderboard.clearChallengeStats();

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
          if (data.entries[j].username === getUsername()) { userRank = j + 1; break; }
        }
        if (!userRank && data.user_entry) userRank = data.user_entry.rank;
      }
      leaderboard.setChallengeStats(challengeStatsMessage(total, userRank));
    });
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
    if (ghost.mesh) ghost.mesh.visible = true;
    gameState = 'countdown';
    menu.hide();
    accountBar.hide();
    raceTimer = 0;
    hud.clearLapTimes();
    hud.show();
    menu.showTouchControls();
    hud.resetCache();
    updateHUD();
    hud.resetLights();
    hud.showCountdown();
    countdownTimer = 0;
    countdownValue = 0;
    sceneDirty = true;
  }

  function updateCountdown(dt) {
    countdownTimer += dt;
    var lit = Math.floor(countdownTimer);
    if (lit > 3) lit = 3;
    if (lit !== countdownValue) {
      countdownValue = lit;
      if (lit <= 3) hud.setRedLights(lit);
    }
    if (countdownTimer >= 3.0 && countdownTimer < 3.6) {
      hud.setGreen();
    }
    if (countdownTimer >= 3.6) {
      gameState = 'racing';
      hud.hideCountdown();
      recording = [{ x: player.x, z: player.z, a: player.angle }];
      recordAccum = 0;
    }
  }

  function showResultsScreen() {
    gameState = 'finished';
    hud.hide();
    menu.hideTouchControls();
    accountBar.show();
    results.show();
    sceneDirty = true;
    results.clear();
    results.showLeaderboardButton(!!challengeMode);

    recording.push({ x: player.x, z: player.z, a: player.angle });
    var isNewBest = !bestTime || player.finishTime < bestTime;
    lastRaceWasRecord = isNewBest;
    if (isNewBest) saveBest(currentTrackCode, player.finishTime, recording);

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
        results.setTitle((challengeMode ? challengeLabel(challengeMode) : 'SERIES') + ' COMPLETE');
        var totalTime = 0;
        for (var s = 0; s < seriesResults.length; s++) totalTime += seriesResults[s].time;
        results.setTrackText(stageCount + ' stages \u00B7 ' + formatTime(totalTime));
        results.showCopyButton(false);
        results.showShareButton(true);

        for (var s = 0; s < seriesResults.length; s++) {
          var sr = seriesResults[s];
          results.addRow(
            '#' + (s + 1) + '  ' + formatTime(sr.time) + '  ' + formatDescriptor(sr.code, sr.reversed, sr.nightMode, totalLaps),
            { className: sr.isNewBest ? 'lap-time lap-fastest' : 'lap-time' }
          );
        }
        results.setPrompt('ENTER Retry  \u00B7  ESC Menu');

        if (challengeMode && isLoggedIn()) {
          var key = challengeKey(challengeMode);
          if (key) {
            apiRequest('POST', '/api/challenge', {
              challenge_key: key, time_ms: totalTime
            }).catch(function () {});
          }
        }
      } else {
        results.setTitle('STAGE ' + (currentStageIndex + 1) + ' COMPLETE');
        results.setTrackText(formatDescriptor(currentTrackCode, reversed, nightMode, totalLaps));
        results.showCopyButton(true);
        results.showShareButton(false);

        if (isNewBest) results.addNewRecordBadge();

        results.addRow('TIME  ' + formatTime(player.finishTime), { className: 'player' });

        var fastestLap = Math.min.apply(null, player.lapTimes);
        for (var i = 0; i < player.lapTimes.length; i++) {
          results.addRow(
            'L' + (i + 1) + '  ' + formatTime(player.lapTimes[i]),
            { className: player.lapTimes[i] === fastestLap ? 'lap-time lap-fastest' : 'lap-time' }
          );
        }
        results.setPrompt('Press ENTER for Stage ' + (currentStageIndex + 2));
      }
    } else {
      results.setTitle((challengeMode ? challengeLabel(challengeMode) : 'RACE') + ' COMPLETE');
      results.setTrackText(formatDescriptor(currentTrackCode, reversed, nightMode, totalLaps));
      results.showCopyButton(true);
      results.showShareButton(true);

      if (isNewBest) results.addNewRecordBadge();

      results.addRow('TIME  ' + formatTime(player.finishTime), { className: 'player' });
      results.addRow('BEST  ' + formatTime(bestTime), { className: 'best' });

      if (!isNewBest) {
        results.addRow('DELTA  +' + (player.finishTime - bestTime).toFixed(2) + 's', { color: '#e8944d' });
      }

      var fastestLap = Math.min.apply(null, player.lapTimes);
      for (var i = 0; i < player.lapTimes.length; i++) {
        results.addRow(
          'L' + (i + 1) + '  ' + formatTime(player.lapTimes[i]),
          { className: player.lapTimes[i] === fastestLap ? 'lap-time lap-fastest' : 'lap-time' }
        );
      }
      results.setPrompt('ENTER Retry  \u00B7  ESC Menu');
    }
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
    results.hide();
    if (player) { disposeGroup(player.mesh); scene.remove(player.mesh); player = null; }
    createPlayer();
    createGhost();
    if (ghost.mesh) ghost.mesh.visible = true;
    gameState = 'countdown';
    menu.hide();
    accountBar.hide();
    raceTimer = 0;
    recording = [];
    recordAccum = 0;
    hud.clearLapTimes();
    hud.show();
    menu.showTouchControls();
    hud.resetCache();
    updateHUD();
    hud.resetLights();
    hud.showCountdown();
    countdownTimer = 0;
    countdownValue = 0;
  }

  function restartRace() {
    results.hide();
    menu.show();
    accountBar.show();
    gameState = 'menu';
    currentStageIndex = 0;
    seriesResults = [];
    if (seriesMode) {
      rebuildTrack(stageConfigs[0].code);
    } else if (challengeMode) {
      rebuildTrack(currentTrackCode);
    } else {
      rebuildTrack(menu.getTrackCode());
    }
  }

  function showRecords() {
    if (settingsPanel.isOpen()) hideSettings();
    menu.hide();
    records.show();

    session.getAllBestTimes(function (recs) {
      records.render(recs, retryRecord);
    });
  }

  function retryRecord(rec) {
    seriesMode = false;
    challengeMode = null;
    reversed = rec.reversed;
    nightMode = rec.nightMode;
    totalLaps = rec.laps;

    menu.setTrackCode(rec.code);
    menu.setLaps(totalLaps);
    menu.setDirection(reversed);
    menu.setNightMode(nightMode);
    menu.setSeriesMode(false);

    records.hide();

    rebuildTrack(rec.code);
    startCountdown();
  }

  function hideRecords() {
    records.hide();
    menu.show();
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

  function updatePatternPreviews() {
    settingsPanel.updatePatternPreviews(drawPatternPreview, carSettings.primaryColor, carSettings.secondaryColor);
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
    scene.add(mesh);
    player.mesh = mesh;
    nightRenderer.rebuildMeshes(carSettings);
    sceneDirty = true;
  }

  function updateCarColorsInPlace() {
    if (!player) return;
    updateCarColors(player.mesh, hexToInt(carSettings.primaryColor), hexToInt(carSettings.secondaryColor), carSettings.pattern);
    sceneDirty = true;
  }

  function showSettings() {
    if (records.isOpen()) hideRecords();
    settingsPanel.setCarSettings(carSettings);
    settingsPanel.buildPatternButtons(C.car.patterns, carSettings.pattern, drawPatternPreview, carSettings.primaryColor, carSettings.secondaryColor);

    savedCameraModeIndex = cam.modeIndex;
    cam.startShowcase();
    settingsPanel.buildCameraToggle(C.camera.modes, cam.modeIndex, cam.showcaseActive);

    savedNightMode = nightMode;
    previewNightMode = nightMode;
    settingsPanel.setPreviewMode(nightMode);

    previewRunning = false;
    previewT = 0;
    settingsPanel.setPreviewDrive(false);

    menu.hide();
    accountBar.hide();
    settingsPanel.show();
    settingsPanel.showBackButton(true);
  }

  function switchPreviewToNight() {
    if (nightMode) return;
    nightMode = true;
    previewNightMode = true;
    settingsPanel.setPreviewMode(true);
  }

  function hideSettings() {
    nightMode = savedNightMode;
    cam.stopShowcase();
    previewRunning = false;
    cam.modeIndex = savedCameraModeIndex;
    hud.setCameraLabel(cam.applyMode(player));
    if (player) {
      var start = getStartPosition(track.curve, reversed);
      player.x = start.x;
      player.z = start.z;
      player.angle = start.angle;
      player.mesh.position.set(player.x, 0, player.z);
      player.mesh.rotation.y = player.angle;
    }
    settingsPanel.hide();
    settingsPanel.showBackButton(false);
    accountBar.show();
    menu.show();
  }

  var _previewPt = new THREE.Vector3();
  var _previewTan = new THREE.Vector3();
  function updatePreviewDrive(dt) {
    if (!player || !track) return;
    previewT = (previewT + C.camera.previewSpeed * dt) % 1;
    track.curve.getPointAt(previewT, _previewPt);
    track.curve.getTangentAt(previewT, _previewTan);
    player.x = _previewPt.x;
    player.z = _previewPt.z;
    player.angle = Math.atan2(_previewTan.x, _previewTan.z);
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.angle;
  }

  // ── Main loop ─────────────────────────────────────────────────────
  function gameLoop(time) {
    requestAnimationFrame(gameLoop);

    var dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
    lastTime = time;

    if (gameState === 'countdown') {
      updateCountdown(dt);
      sceneDirty = true;
    }

    if (gameState === 'racing') {
      raceTimer += dt;

      var input = getInput(menu.isTrackCodeFocused());
      player.updatePhysics(dt, input.accel, input.steer);

      player.wallCollision(track.inner);
      player.wallCollision(track.outer);
      player.mesh.position.set(player.x, 0, player.z);

      player.updateLapTracking(track.sampled, reversed, totalLaps, raceTimer, addLapTimeToHUD);
      recordFrame(dt);
      ghost.update(raceTimer);

      if (player.finished) {
        showResultsScreen();
      }

      updateHUD();
      sceneDirty = true;
    }

    if (settingsPanel.isOpen() && previewRunning) {
      updatePreviewDrive(dt);
      sceneDirty = true;
    }

    if (player) {
      if (cam.showcaseActive) {
        cam.updateShowcase(dt, player);
        sceneDirty = true;
      } else if (sceneDirty) {
        cam.update(player, dt);
      }
    }
    nightRenderer.update(player, nightMode, carSettings.underglowOpacity);
    if (sceneDirty) {
      renderer.render(scene, cam.active);
      sceneDirty = false;
    }
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
      auth.setCloseText('Skip');
      menu.onEventStart(function () {
        if (gameState === 'menu' && !records.isOpen() && !settingsPanel.isOpen() && !leaderboard.isOpen()) startCountdown();
      });
      menu.onChallengeStart(function () {
        if (gameState === 'menu' && !records.isOpen() && !settingsPanel.isOpen() && !leaderboard.isOpen()) startCountdown();
      });
      results.onPromptClick(function () {
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
    var orthoCamera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 1000);
    orthoCamera.position.set(0, C.camera.height, 0);
    orthoCamera.up.set(0, 0, -1);
    orthoCamera.lookAt(0, 0, 0);
    var perspCamera = new THREE.PerspectiveCamera(70, aspect, 1, 2000);
    cam = new Camera(orthoCamera, perspCamera);
    hud.setCameraLabel(C.camera.modes[cam.modeIndex]);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.prepend(renderer.domElement);
    nightRenderer = new NightRenderer(scene, carSettings);

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
      menu.setStageCount(stageCount);
      for (var i = 0; i < descs.length; i++) {
        var parsed = parseDescriptor(descs[i]);
        stageConfigs[i] = {
          code: parsed.code,
          reversed: parsed.reversed || false,
          nightMode: parsed.nightMode || false
        };
        if (i === 0 && parsed.laps !== undefined) {
          totalLaps = parsed.laps;
          menu.setLaps(totalLaps);
        }
      }
      seriesMode = true;
      menu.setSeriesMode(true);
      startCode = stageConfigs[0].code;
      buildStageList();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (sharedDescriptor) {
      var parsed = parseDescriptor(sharedDescriptor);
      startCode = parsed.code;
      if (parsed.reversed !== undefined) {
        reversed = parsed.reversed;
        menu.setDirection(reversed);
      }
      if (parsed.nightMode !== undefined) {
        nightMode = parsed.nightMode;
        menu.setNightMode(nightMode);
      }
      if (parsed.laps !== undefined) {
        totalLaps = parsed.laps;
        menu.setLaps(totalLaps);
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
    menu.setTrackCode(startCode);
    if (!sharedSeries) {
      for (var i = 0; i < stageConfigs.length; i++) stageConfigs[i].code = randomCode();
    }
    rebuildTrack(startCode);
    initInput();

    window.addEventListener('resize', function () {
      cam.handleResize(player);
      renderer.setSize(window.innerWidth, window.innerHeight);
      sceneDirty = true;
    });

    requestAnimationFrame(gameLoop);
  }

export class Game {
  constructor() {
    init();
  }
}
