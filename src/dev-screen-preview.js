/**
 * Dev-only: jump to any major UI with fake data (Vite `import.meta.env.DEV`).
 *
 * URL: ?devScreen=<id>  (stripped after load)
 * Console: __carreritasDev.go('<id>')  — same ids as below
 */
import { ChallengeMode } from './challenge-modes/index.js';
import { FwdDirection, RevDirection } from './directions/index.js';
import { DayMode, NightMode } from './modes/index.js';
import RunContext from './run-context/index.js';
import { FinishedState, MenuState } from './game-states/index.js';
import { strings, formatPlaceholders } from './strings.js';
import { formatDescriptor, formatTime, pickRandom } from './utils/index.js';

const DEV_TRACK = 'abcdefghijklmnopqr';

/** @type {readonly string[]} */
export const DEV_SCREEN_IDS = [
  'menu',
  'menu-event',
  'results',
  'results-stage',
  'results-series',
  'leaderboard',
  'leaderboard-challenge',
  'records',
  'settings',
  'qualify',
  'hud',
  'hud-series'
];

function isDev() {
  return typeof import.meta !== 'undefined' && import.meta.env.DEV === true;
}

export function consumeDevScreenParam() {
  if (!isDev() || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('devScreen');
  if (!raw) return null;
  const name = raw.trim().toLowerCase();
  const url = new URL(window.location.href);
  url.searchParams.delete('devScreen');
  const q = url.searchParams.toString();
  window.history.replaceState({}, '', url.pathname + (q ? '?' + q : '') + url.hash);
  return name;
}

function devClearInputContext(game) {
  game.inputContext.clear(game.challengeQualify);
  game.inputContext.clear(game.leaderboard);
  game.inputContext.clear(game.records);
  game.inputContext.clear(game.settingsPanel);
}

function devCloseAllOverlays(game) {
  if (game.postRaceReplayActive) game.exitPostRaceReplay();
  game.challengeQualify.hide();
  game.results.hide();
  game.results.hideReplayHint();
  game.leaderboard.hide();
  game.records.hide();
  if (game.settingsPanel.isOpen()) game.hideSettings();
  game.hud.hide();
  game.menu.hide();
  devClearInputContext(game);
  game.leaderboardFrom = null;
}

function devForceFinishedState(game) {
  game.stateMachine.current.onExit(game);
  game.stateMachine.current = new FinishedState();
  game.stateMachine.current.onEnter(game);
}

function devForceMenuState(game) {
  game.stateMachine.current.onExit(game);
  game.stateMachine.current = new MenuState();
  game.stateMachine.current.onEnter(game);
}

function seedMinimalReplay(game) {
  const rec = game.currentRun.getRecording();
  rec.length = 0;
  rec.push({ x: 0, z: 0, a: 0 }, { x: 2, z: 0, a: 0 });
}

function formatDevScreenLabel(id) {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' · ');
}

/**
 * @param {object} game
 * @param {HTMLElement} devToolsPanel `#dev-tools` — dev controls mount inside this panel
 */
function mountDevScreenDock(game, devToolsPanel) {
  const root = document.createElement('div');
  root.className = 'dev-tools__screens';
  root.setAttribute('aria-label', 'Dev screen preview');

  const bar = document.createElement('div');
  bar.className = 'dev-tools__screens-bar';

  const title = document.createElement('span');
  title.className = 'dev-tools__screens-title';
  title.textContent = 'Screens';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'dev-tools__screens-toggle';
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-label', 'Collapse screen list');
  toggle.textContent = '\u2212';

  bar.appendChild(title);
  bar.appendChild(toggle);

  const list = document.createElement('div');
  list.className = 'dev-tools__screens-list';

  for (let i = 0; i < DEV_SCREEN_IDS.length; i++) {
    const sid = DEV_SCREEN_IDS[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dev-tools__screens-btn';
    btn.dataset.screen = sid;
    btn.textContent = formatDevScreenLabel(sid);
    btn.title = sid;
    btn.addEventListener('click', function () {
      applyDevScreen(game, sid);
    });
    list.appendChild(btn);
  }

  root.appendChild(bar);
  root.appendChild(list);

  toggle.addEventListener('click', function () {
    const collapsed = root.classList.toggle('dev-tools__screens--collapsed');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', collapsed ? 'Expand screen list' : 'Collapse screen list');
    toggle.textContent = collapsed ? '+' : '\u2212';
  });

  devToolsPanel.classList.add('dev-tools--with-dev');
  devToolsPanel.appendChild(root);
}

function fakeLeaderboardEntries() {
  return [
    { display_name: 'SwiftFox', username: 'SwiftFox', country: 'US', time_ms: 42.51 },
    { display_name: 'TrackRat', username: 'TrackRat', country: 'DE', time_ms: 43.02 },
    { display_name: 'NightLap', username: 'NightLap', country: 'JP', time_ms: 43.88 },
    { display_name: 'Kerbs', username: 'Kerbs', country: 'BR', time_ms: 44.1 },
    { display_name: 'Draft', username: 'Draft', country: null, time_ms: 44.55 }
  ];
}

/** @param {object} game Game instance */
export function applyDevScreen(game, screen) {
  if (!isDev()) return;

  const id = String(screen).trim().toLowerCase();
  if (!DEV_SCREEN_IDS.includes(id)) {
    console.warn('[devScreen] unknown:', id, 'try:', DEV_SCREEN_IDS.join(', '));
    return;
  }

  devCloseAllOverlays(game);

  const r = strings.results;
  const labelFn = (cm) => {
    const slug = cm.slug();
    return strings.challengeModes[slug] || slug;
  };

  if (id === 'menu' || id === 'menu-event') {
    devForceMenuState(game);
    game.clearChallengeMode();
    game.seriesMode = false;
    game.menu.showTab(id === 'menu-event' ? 'event' : 'challenges');
    game.menu.show();
    return;
  }

  if (id === 'results') {
    game.clearChallengeMode();
    game.seriesMode = false;
    game.runContext = RunContext.event();
    game.totalLaps = 3;
    game.currentTrackCode = DEV_TRACK;
    game.direction = new FwdDirection();
    game.mode = new DayMode();
    game.bestTime = 118.4;
    if (game.player) {
      game.player.finishTime = 121.07;
      game.player.lapTimes = [40.2, 40.55, 40.32];
    }
    game.currentRun.resetSeriesProgress();
    game.currentRun.setLastRaceWasRecord(false);
    seedMinimalReplay(game);

    devForceFinishedState(game);

    const results = game.results;
    results.clear();
    results.setTitle(game.runContext.resultsTitleAfterSingleRaceComplete(r, labelFn));
    results.setTrackText(formatDescriptor(game.currentTrackCode, game.direction, game.mode, game.totalLaps));
    results.showCopyButton(true);
    results.showShareButton(true);
    results.addRow(r.timeRow(formatTime(game.player.finishTime)), { className: 'player' });
    results.addRow(r.bestRow(formatTime(game.bestTime)), { className: 'best' });
    results.addRow(r.deltaRow((game.player.finishTime - game.bestTime).toFixed(2)), { color: '#e8944d' });
    const fastest = Math.min.apply(null, game.player.lapTimes);
    for (let lj = 0; lj < game.player.lapTimes.length; lj++) {
      results.addRow(
        r.lapRow(lj + 1, formatTime(game.player.lapTimes[lj])),
        { className: game.player.lapTimes[lj] === fastest ? 'lap-time lap-fastest' : 'lap-time' }
      );
    }
    results.setPrompt(strings.document.results.promptRetryMenu);
    results.showLeaderboardButton(true);
    results.show();
    return;
  }

  if (id === 'results-stage') {
    game.clearChallengeMode();
    game.seriesMode = true;
    game.stageCount = 3;
    game.totalLaps = 3;
    game.currentTrackCode = DEV_TRACK;
    game.direction = new RevDirection();
    game.mode = new NightMode();
    game.currentRun.resetSeriesProgress();
    game.currentRun.pushSeriesStageResult({
      code: DEV_TRACK,
      direction: new FwdDirection(),
      mode: new DayMode(),
      time: 48.2,
      lapTimes: [48.2],
      isNewBest: true
    });
    /* Still on stage slot 0 until advance — matches ResultsPresenter after stage 1. */
    if (game.player) {
      game.player.finishTime = 49.01;
      game.player.lapTimes = [49.01];
    }
    game.currentRun.setLastRaceWasRecord(true);
    seedMinimalReplay(game);

    devForceFinishedState(game);

    const results = game.results;
    results.clear();
    results.addNewRecordBadge();
    results.setTitle(r.stageComplete(game.currentRun.currentStageIndex + 1));
    results.setTrackText(formatDescriptor(game.currentTrackCode, game.direction, game.mode, game.totalLaps));
    results.showCopyButton(true);
    results.showShareButton(false);
    results.addRow(r.timeRow(formatTime(game.player.finishTime)), { className: 'player' });
    results.addRow(r.lapRow(1, formatTime(game.player.lapTimes[0])), { className: 'lap-time lap-fastest' });
    results.setPrompt(r.promptNextStage(game.currentRun.currentStageIndex + 2));
    results.showLeaderboardButton(false);
    results.show();
    return;
  }

  if (id === 'results-series') {
    const cm = ChallengeMode.fromString('daily-series');
    game.runContext = RunContext.challenge(cm);
    game.seriesMode = true;
    game.stageCount = 3;
    game.totalLaps = 3;
    game.currentRun.resetSeriesProgress();
    game.currentRun.pushSeriesStageResult({
      code: DEV_TRACK,
      direction: new FwdDirection(),
      mode: new DayMode(),
      time: 50.1,
      lapTimes: [50.1],
      isNewBest: false
    });
    game.currentRun.incrementStageIndex();
    game.currentRun.pushSeriesStageResult({
      code: DEV_TRACK,
      direction: new RevDirection(),
      mode: new NightMode(),
      time: 51.2,
      lapTimes: [51.2],
      isNewBest: true
    });
    game.currentRun.incrementStageIndex();
    game.currentRun.pushSeriesStageResult({
      code: DEV_TRACK,
      direction: new FwdDirection(),
      mode: new DayMode(),
      time: 49.55,
      lapTimes: [49.55],
      isNewBest: false
    });

    if (game.player) {
      game.player.finishTime = 49.55;
      game.player.lapTimes = [49.55];
    }
    game.currentRun.setLastRaceWasRecord(false);
    seedMinimalReplay(game);

    devForceFinishedState(game);

    const snap = game.currentRun.getSeriesResultsSnapshot();
    let total = 0;
    for (let i = 0; i < snap.length; i++) total += snap[i].time;

    const results = game.results;
    results.clear();
    results.setTitle(game.runContext.resultsTitleAfterSeriesComplete(r, labelFn));
    results.setTrackText(game.stageCount + ' stages \u00B7 ' + formatTime(total));
    results.showCopyButton(false);
    results.showShareButton(true);
    for (let sj = 0; sj < snap.length; sj++) {
      const sr = snap[sj];
      results.addRow(
        r.seriesRow(sj + 1, formatTime(sr.time), formatDescriptor(sr.code, sr.direction, sr.mode, game.totalLaps)),
        { className: sr.isNewBest ? 'lap-time lap-fastest' : 'lap-time' }
      );
    }
    results.setPrompt(strings.document.results.promptRetryMenu);
    results.showLeaderboardButton(true);
    results.show();
    return;
  }

  if (id === 'leaderboard') {
    devForceMenuState(game);
    game.leaderboardFrom = 'menu';
    game.leaderboard.setTrackText(formatDescriptor(DEV_TRACK, new FwdDirection(), new DayMode(), 3));
    game.renderLeaderboardData({ entries: fakeLeaderboardEntries(), total_count: 42 });
    game.leaderboard.show();
    game.inputContext.setActive(game.leaderboard);
    return;
  }

  if (id === 'leaderboard-challenge') {
    devForceMenuState(game);
    game.leaderboardFrom = 'menu';
    const cm = ChallengeMode.fromString('daily-race');
    game.leaderboard.setTrackText(labelFn(cm));
    game.renderLeaderboardData({
      entries: fakeLeaderboardEntries().concat([
        { display_name: 'Six', username: 'Six', country: 'FR', time_ms: 45.0 },
        { display_name: 'Seven', username: 'Seven', country: 'ES', time_ms: 45.4 },
        { display_name: 'Eight', username: 'Eight', country: 'IT', time_ms: 45.9 },
        { display_name: 'Nine', username: 'Nine', country: 'GB', time_ms: 46.2 },
        { display_name: 'Ten', username: 'Ten', country: 'CA', time_ms: 46.5 }
      ]),
      total_count: 120
    });
    game.leaderboard.show();
    game.inputContext.setActive(game.leaderboard);
    return;
  }

  if (id === 'records') {
    devForceMenuState(game);
    game.menu.hide();
    game.records.show();
    game.records.render(
      [
        {
          code: DEV_TRACK,
          laps: 3,
          direction: new FwdDirection(),
          mode: new DayMode(),
          reversed: false,
          nightMode: false,
          time: 118.4,
          date: Date.now() - 86400000
        },
        {
          code: DEV_TRACK,
          laps: 1,
          direction: new RevDirection(),
          mode: new NightMode(),
          reversed: true,
          nightMode: true,
          time: 42.1,
          date: Date.now() - 172800000
        }
      ],
      function () {}
    );
    game.inputContext.setActive(game.records);
    return;
  }

  if (id === 'settings') {
    devForceMenuState(game);
    game.showSettings();
    return;
  }

  if (id === 'qualify') {
    devForceFinishedState(game);
    game.results.hide();
    const rank = 4;
    game.challengeQualify.show(
      pickRandom(r.challengeQualifyHeadlines),
      formatPlaceholders(r.challengeQualifySubline, { rank }),
      'Dev Racer'
    );
    game.inputContext.setActive(game.challengeQualify);
    return;
  }

  if (id === 'hud' || id === 'hud-series') {
    devForceMenuState(game);
    game.menu.hide();
    game.hud.resetCache();
    game.hud.clearLapTimes();
    game.hud.show();
    if (id === 'hud-series') {
      game.hud.update({
        lap: 1,
        totalLaps: 2,
        bestTime: 95.2,
        raceTimer: 96.05,
        speed: 155,
        seriesMode: true,
        currentStageIndex: 1,
        stageCount: 4
      });
      game.hud.addLapTime(1, 48.1, null);
    } else {
      game.hud.update({
        lap: 2,
        totalLaps: 3,
        bestTime: 118.4,
        raceTimer: 121.07,
        speed: 162,
        seriesMode: false,
        currentStageIndex: 0,
        stageCount: 3
      });
      game.hud.addLapTime(1, 40.2, null);
      game.hud.addLapTime(2, 40.55, 40.2);
    }
    return;
  }
}

/** @param {object} game Game instance */
export function attachDevScreenApi(game) {
  if (!isDev()) return;
  const param = consumeDevScreenParam();
  if (param) applyDevScreen(game, param);
  const devToolsPanel = document.getElementById('dev-tools');
  if (!devToolsPanel) return;
  mountDevScreenDock(game, devToolsPanel);
  window.__carreritasDev = {
    screens: DEV_SCREEN_IDS,
    go: (name) => applyDevScreen(game, name),
    dock: devToolsPanel
  };
}
