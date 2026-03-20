import Constants from './constants.js';
import { fakeChallengeLeaderboardData } from './fake-leaderboard.js';
import Storage, { normalizeCarPatternInSettings } from './storage.js';
import { GuestSession, UserSession } from './session.js';
import {
  hexToInt, disposeGroup, countryFlag, isMobile,
  formatDescriptor,
  parseDescriptor,
  randomTrackCode,
  challengeLabel,
  challengeKey,
  dailyConfig,
  weeklyRaceConfig,
  challengeConfigForMode,
  challengeResetMs,
  formatCountdown,
  utcDateStr,
  utcMondayStr,
  challengeStatsMessage
} from './utils/index.js';
import ApiClient from './api.js';
import Track from './track.js';
import TrackCode from './track-code.js';
import { CarMesh } from './car-mesh.js';
import Player from './player.js';
import Ghost from './ghost.js';
import Camera from './camera.js';
import { DayRenderer, NightRenderer } from './renderers/index.js';
import Input from './input.js';
import Auth from './auth.js';
import UserProfile from './user.js';
import { Menu, Hud, ResultsScreen, ResultsPresenter, RecordsPanel, LeaderboardPanel, AuthPanel, AccountBar, SettingsPanel } from './ui/index.js';
import { FwdDirection, Direction } from './directions/index.js';
import { DayMode, NightMode, Mode } from './modes/index.js';
import { ChallengeMode } from './challenge-modes/index.js';
import RunContext from './run-context/index.js';
import Race from './race.js';
import { StateMachine, MenuState, CountdownState, RacingState, FinishedState, InputContext } from './game-states/index.js';
import { strings } from './strings.js';
const _previewPt = new THREE.Vector3();
const _previewTan = new THREE.Vector3();

/** Slider drags were calling saveSettings every tick (JSON clone + storage + optional API). */
const SAVE_SETTINGS_DEBOUNCE_MS = 350;

/**
 * Fullscreen modals: blur the WebGL layer (backdrop-filter does not sample canvas reliably).
 * Car settings (#settings) is excluded: the menu is hidden while it is open and the scene must stay sharp.
 */
function _isAnyModalOpenForBackdrop() {
  const overlay = document.getElementById('overlay');
  const results = document.getElementById('results');
  const leaderboard = document.getElementById('leaderboard');
  const records = document.getElementById('records');
  const auth = document.getElementById('auth');
  if (!overlay || !results || !leaderboard || !records || !auth) return false;
  return (
    !overlay.classList.contains('hidden') ||
    results.style.display === 'flex' ||
    leaderboard.style.display === 'flex' ||
    !records.classList.contains('hidden') ||
    auth.classList.contains('visible')
  );
}

export default class Game {
  constructor() {
    this._initRaceAndPreviewState();
    this._initRenderingSlots();
    this._initAuthUiAndSession();
    this.init();
  }

  // --- Bootstrap & main loop ---

  init() {
    this._bootstrapSessionUi();
    if (this.mobile) this._configureMobileShell();
    this._createThreeBootstrap();
    const { startCode, openedSeriesFromUrl } = this._consumeShareUrlParams();
    this._mountInitialTrack(startCode, openedSeriesFromUrl);
    this.stateMachine = new StateMachine(new MenuState());
    this._wireUiCallbacks();
    this._bindResize();
    this._bindPersistGuards();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  gameLoop(time) {
    requestAnimationFrame((t) => this.gameLoop(t));
    const dt = this._nextFrameDelta(time);
    this.stateMachine.update(dt, this);
    this._runFrameUpdates(dt);
    this._presentIfDirty();
  }

  updatePreviewDrive(dt) {
    if (!this.player || !this.track) return;
    this.previewT = (this.previewT + Constants.camera.previewSpeed * dt) % 1;
    const u = this.direction.isRev() ? 1 - this.previewT : this.previewT;
    this.track.curve.getPointAt(u, _previewPt);
    this.track.curve.getTangentAt(u, _previewTan);
    let angle = Math.atan2(_previewTan.x, _previewTan.z);
    if (this.direction.isRev()) angle += Math.PI;
    this.player.setWorldPose(_previewPt.x, _previewPt.z, angle);
  }

  // --- Best times, settings sync, auth ---

  loadBest(code, callback) {
    this.bestReplay = null;
    this.bestTime = null;
    this.session.loadBest(code, this.totalLaps, this.direction, this.mode, (result) => {
      if (result) {
        this.bestTime = result.time;
        this.bestReplay = result.replay;
      }
      if (callback) callback();
    });
  }

  saveBest(code, time, frames) {
    this.bestReplay = frames;
    this.bestTime = time;
    this.session.saveBest(code, this.totalLaps, this.direction, this.mode, time, frames);
  }

  saveSettings() {
    if (this._saveSettingsTimer) {
      clearTimeout(this._saveSettingsTimer);
      this._saveSettingsTimer = null;
    }
    this._persistSettings();
  }

  /** Debounced persist for high-frequency sliders (SHAPE, underglow %). */
  scheduleSaveSettings() {
    if (this._saveSettingsTimer) {
      clearTimeout(this._saveSettingsTimer);
    }
    const self = this;
    this._saveSettingsTimer = setTimeout(function () {
      self._saveSettingsTimer = null;
      self._persistSettings();
    }, SAVE_SETTINGS_DEBOUNCE_MS);
  }

  _persistSettings() {
    const settingsToSave = JSON.parse(JSON.stringify(this.carSettings));
    if (settingsToSave.pattern && typeof settingsToSave.pattern === 'object') {
      settingsToSave.pattern = settingsToSave.pattern.name;
    }
    this.session.saveSettings(settingsToSave);
  }

  /** At most one NightRenderer.updateColors per frame while scrubbing underglow opacity. */
  _scheduleUnderglowColorPreviewUpdate() {
    if (this._underglowColorRaf) return;
    this._underglowColorRaf = requestAnimationFrame(() => {
      this._underglowColorRaf = null;
      if (this.sceneRenderer) this.sceneRenderer.updateColors(this.carSettings);
    });
  }

  _flushUnderglowColorPreview() {
    if (!this._underglowColorRaf) return;
    cancelAnimationFrame(this._underglowColorRaf);
    this._underglowColorRaf = null;
    if (this.sceneRenderer) this.sceneRenderer.updateColors(this.carSettings);
  }

  loadAuth() {
    if (this.authManager.loadAuth()) {
      this.userProfile.load();
      this.session = this.userSession;
    }
  }

  uploadLocalData() {
    this.apiClient.updateSettings(this.carSettings).catch(function () {});
  }

  showAuthPanel() {
    this.auth.showLogin();
    this.inputContext.setActive(this.auth);
  }

  hideAuthPanel() {
    this.auth.hide();
    this.inputContext.clear(this.auth);
  }

  updateAccountBar() {
    this.accountBar.update(this.authManager.isLoggedIn(), this.userProfile.getUsername(), this.userProfile.getCountry(), countryFlag);
  }

  async handleAuthSubmit(e) {
    e.preventDefault();
    const creds = this.auth.getCredentials();
    if (!creds.username || !creds.password) { this.auth.setError(strings.auth.fillFields); return; }
    if (creds.isRegister && !creds.country) { this.auth.setError(strings.auth.selectCountry); return; }

    this.auth.setSubmitting(true);
    this.auth.clearError();

    try {
      const data = creds.isRegister
        ? await this.apiClient.register(creds.username, creds.password, creds.country)
        : await this.apiClient.login(creds.username, creds.password);
      this.auth.setSubmitting(false);
      if (data.error) { this.auth.setError(data.error); return; }
      this.authManager.persistAuth(data.token);
      this.userProfile.save(data.username, data.country);
      this.session = this.userSession;
      this.hideAuthPanel();
      this.updateAccountBar();
      this.uploadLocalData();
      if (!creds.isRegister) {
        this.session.loadSettings((remote) => {
          for (const k in Constants.car.defaultSettings) {
            if (remote[k] !== undefined) this.carSettings[k] = remote[k];
          }
          normalizeCarPatternInSettings(this.carSettings);
          Storage.shared.saveCarSettings(this.carSettings);
          this.applyCarSettings();
        });
      }
    } catch {
      this.auth.setSubmitting(false);
      this.auth.setError(strings.auth.connectionError);
    }
  }

  // --- Leaderboard ---

  showLeaderboardForChallenge(modeOrStr) {
    this.leaderboard.showLoadingPlaceholder();

    const cm = typeof modeOrStr === 'string' ? ChallengeMode.fromString(modeOrStr) : modeOrStr;
    const label = challengeLabel(cm);
    const key = challengeKey(cm);

    this.leaderboard.setTrackText(label);

    void (async () => {
      let data;
      if (Constants.fakeChallengeLeaderboards) {
        data = await fakeChallengeLeaderboardData(cm.slug(), this.userProfile.getUsername(), this.userProfile.getCountry());
      } else if (cm.isSeries()) {
        data = await this.apiClient.fetchChallengeLeaderboard(key);
      } else {
        const config = cm.isDailyRace() ? dailyConfig() : weeklyRaceConfig();
        data = await this.apiClient.fetchLeaderboard(config.code, config.laps, config.direction, config.mode);
      }
      this.renderLeaderboardData(data);
    })();
  }

  showLeaderboardForCurrentTrack() {
    this.leaderboard.showLoadingPlaceholder();
    const desc = formatDescriptor(this.currentTrackCode, this.direction, this.mode, this.totalLaps);
    this.leaderboard.setTrackText(desc);
    void (async () => {
      const data = await this.apiClient.fetchLeaderboard(this.currentTrackCode, this.totalLaps, this.direction, this.mode);
      this.renderLeaderboardData(data);
    })();
  }

  showLeaderboardPanel() {
    this.runContext.openLeaderboardPanel(this);

    this.leaderboard.show();
    this.inputContext.setActive(this.leaderboard);
  }

  hideLeaderboardPanel() {
    this.leaderboard.hide();
    this.inputContext.clear(this.leaderboard);
    if (this.leaderboardFrom === 'results') this.results.show();
    else this.menu.show();
    this.leaderboardFrom = null;
  }

  renderLeaderboardData(data) {
    this.leaderboard.render(data, this.authManager.isLoggedIn.bind(this.authManager), this.userProfile.getUsername.bind(this.userProfile));
  }

  // --- Track shape, descriptors, challenge context ---

  rebuildTrack(code, { resetMenuPreview = true } = {}) {
    if (this.player) { disposeGroup(this.player.mesh); this.scene.remove(this.player.mesh); this.player = null; }
    this.ghost.dispose(this.scene);

    this.currentTrackCode = code;
    this.track = new Track(code, this.scene, this.trackGroup);
    this.trackGroup = this.track.group;
    this.createPlayer();
    this.loadBest(code, () => { this.createGhost(); });
    if (
      resetMenuPreview &&
      (!this.stateMachine || this.stateMachine.current.isMenu()) &&
      !this.records.isOpen() &&
      !this.settingsPanel.isOpen()
    ) {
      this.menuPreviewActive = false;
    }
    this.sceneDirty = true;
  }

  /** Direction, day/night, and laps from a parsed descriptor; updates menu + renderer when relevant. */
  applyParsedDescriptorMeta(parsed) {
    if (parsed.direction) {
      this.direction = parsed.direction;
      this.menu.setDirection(this.direction);
    }
    if (parsed.mode) {
      this.mode = parsed.mode;
      this.menu.setMode(this.mode);
      this.switchRenderer(this.mode);
    }
    if (parsed.laps !== undefined) {
      this.totalLaps = parsed.laps;
      this.menu.setLaps(this.totalLaps);
    }
  }

  /**
   * Bare track codes omit direction/mode/laps; those still come from the menu toggles.
   * Without this merge, `this.direction` stays stale while the UI shows FWD/REV.
   */
  _applyParsedDescriptorWithMenuFallback(parsed) {
    this.applyParsedDescriptorMeta(parsed);
    this.menu.setTrackCode(parsed.code);
    if (!parsed.direction) {
      this.direction = this.menu.getDirection();
      this.menu.setDirection(this.direction);
    }
    if (!parsed.mode) {
      this.mode = this.menu.getMode();
      this.switchRenderer(this.mode);
      this.menu.setMode(this.mode);
    }
    if (parsed.laps === undefined) {
      this.totalLaps = this.menu.getLaps();
      this.menu.setLaps(this.totalLaps);
    }
  }

  clearChallengeMode() {
    this.runContext = RunContext.event();
  }

  rebuildTrackFromMenuIfInMenu() {
    if (!this.stateMachine.current.isMenu()) return;
    if (this.seriesMode) {
      this.syncMenuPreviewToSeriesStage(this.menuSeriesPreviewStageIndex);
    } else {
      this.syncSingleRaceMenuPreviewFromMenu();
    }
  }

  /** Single-race menu: rebuild track only when code or direction changes; mode/laps alone do not restart the menu showcase. */
  syncSingleRaceMenuPreviewFromMenu() {
    if (!this.stateMachine.current.isMenu()) return;
    const parsed = parseDescriptor(this.menu.getTrackCode());
    const prevCode = this.currentTrackCode;
    const prevDirRev = this.direction.isRev();
    this._applyParsedDescriptorWithMenuFallback(parsed);
    const codeChanged = parsed.code !== prevCode;
    const dirChanged = this.direction.isRev() !== prevDirRev;
    this.switchRenderer(this.mode);
    if (codeChanged || dirChanged) {
      this.rebuildTrack(parsed.code, { resetMenuPreview: true });
    } else {
      if (this.track && this.player) {
        const start = this.track.getStartPosition(this.direction);
        this.player.setWorldPose(start.x, start.z, start.angle);
      }
      this.loadBest(parsed.code, () => { this.createGhost(); });
      this.sceneDirty = true;
    }
  }

  /** Series menu: preview matches `stageConfigs[stageIndex]` (code, direction, mode). */
  syncMenuPreviewToSeriesStage(stageIndex) {
    if (!this.stateMachine.current.isMenu() || !this.seriesMode) return;
    const s = this.stageConfigs[stageIndex];
    if (!s || !s.code) return;

    const prevCode = this.currentTrackCode;
    const prevDirRev = this.direction.isRev();
    const codeChanged = s.code !== prevCode;
    const dirChanged = s.direction.isRev() !== prevDirRev;

    this.direction = s.direction;
    this.mode = s.mode;
    this.menuSeriesPreviewStageIndex = stageIndex;
    this.switchRenderer(this.mode);

    if (!codeChanged && !dirChanged) {
      if (this.track && this.player) {
        const start = this.track.getStartPosition(this.direction);
        this.player.setWorldPose(start.x, start.z, start.angle);
      }
      this.loadBest(s.code, () => { this.createGhost(); });
      this.sceneDirty = true;
      return;
    }
    this.rebuildTrack(s.code, { resetMenuPreview: true });
  }

  // --- Player, ghost, multi-stage series ---

  createPlayer() {
    const start = this.track.getStartPosition(this.direction);
    const mesh = new CarMesh({
      color: hexToInt(this.carSettings.primaryColor),
      secondaryColor: hexToInt(this.carSettings.secondaryColor),
      pattern: this.carSettings.pattern,
      x: start.x, z: start.z, angle: start.angle, opacity: 1
    });
    this.scene.add(mesh);
    this.player = new Player(mesh, start.x, start.z, start.angle);
    this.player.initTrackIndex(this.track.sampled);
  }

  createGhost() {
    this.ghost.create(this.bestReplay, this.track, this.direction, this.scene);
  }

  buildStageList() {
    this.menu.buildStageList(this.stageCount, this.stageConfigs, parseDescriptor, randomTrackCode, () => {
      this.clearChallengeMode();
    }, (stageIndex) => {
      this.syncMenuPreviewToSeriesStage(stageIndex);
    });
  }

  advanceToNextStage() {
    this.currentRun.incrementStageIndex();
    this.results.hide();
    this.startCountdown();
  }

  // --- HUD & scheduled challenge preview ---

  addLapTimeToHUD(lapNum, lapTime) {
    const prevTime = lapNum > 1 ? this.player.lapTimes[lapNum - 2] : null;
    this.hud.addLapTime(lapNum, lapTime, prevTime);
  }

  updateHUD() {
    if (!this.hud || !this.player) return;
    this.hud.update({
      lap: this.player.lap, totalLaps: this.totalLaps, bestTime: this.bestTime,
      raceTimer: this.currentRun.raceTimer, speed: this.player.speed,
      seriesMode: this.seriesMode, currentStageIndex: this.currentRun.currentStageIndex, stageCount: this.stageCount
    });
  }

  loadChallengeConfig(challengeModeStr) {
    const cm = ChallengeMode.fromString(challengeModeStr);
    const info = challengeConfigForMode(cm);
    if (!info) {
      return { cm, info: null };
    }
    this.runContext = RunContext.challenge(cm);

    if (info.type === 'race') {
      this.seriesMode = false;
      this.direction = info.config.direction;
      this.mode = info.config.mode;
      this.switchRenderer(this.mode);
      this.totalLaps = info.config.laps;
      this.currentTrackCode = info.config.code;
      if (this.stateMachine.current.isMenu()) this.rebuildTrack(info.config.code, { resetMenuPreview: true });
    } else {
      this.seriesMode = true;
      this.stageCount = info.config.stageCount;
      for (let i = 0; i < info.config.stages.length; i++) {
        this.stageConfigs[i] = {
          code: info.config.stages[i].code,
          direction: info.config.stages[i].direction,
          mode: info.config.stages[i].mode
        };
      }
      this.totalLaps = info.config.laps;
      const s0 = info.config.stages[0];
      this.direction = s0.direction;
      this.mode = s0.mode;
      this.switchRenderer(this.mode);
      this.menuSeriesPreviewStageIndex = 0;
      if (this.stateMachine.current.isMenu()) this.rebuildTrack(s0.code, { resetMenuPreview: true });
    }
    return { cm, info };
  }

  renderChallengePreview() {
    const modeStr = this.menu.getSelectedChallengeMode();
    const { cm, info } = this.loadChallengeConfig(modeStr);

    this.menu.renderChallengePreview(info, challengeResetMs, formatCountdown, () => this.renderChallengePreview());

    this.leaderboard.clearChallengeStats();

    const isSeries = cm.isSeries();

    void (async () => {
      let data;
      if (Constants.fakeChallengeLeaderboards) {
        data = await fakeChallengeLeaderboardData(cm.slug(), this.userProfile.getUsername(), this.userProfile.getCountry());
      } else if (isSeries) {
        data = await this.apiClient.fetchChallengeLeaderboard(this.runContext.getChallengeKey(utcDateStr(), utcMondayStr()));
      } else {
        data = await this.apiClient.fetchLeaderboard(
          info.config.code,
          info.config.laps,
          info.config.direction,
          info.config.mode
        );
      }
      const total = data.total_count || 0;
      let userRank = null;
      if (this.authManager.isLoggedIn() && data.entries) {
        for (let j = 0; j < data.entries.length; j++) {
          if (data.entries[j].username === this.userProfile.getUsername()) { userRank = j + 1; break; }
        }
        if (!userRank && data.user_entry) userRank = data.user_entry.rank;
      }
      this.leaderboard.setChallengeStats(challengeStatsMessage(total, userRank, this.authManager.isLoggedIn()));
    })();
  }

  // --- State machine entry points ---

  startCountdown() {
    if (this.seriesMode) {
      const run = this.currentRun;
      run.clearSeriesResultsIfFirstStage();
      const stage = this.stageConfigs[run.currentStageIndex];
      this.direction = stage.direction;
      this.mode = stage.mode;
      this.switchRenderer(this.mode);
      this.currentTrackCode = stage.code;
      this.rebuildTrack(stage.code);
    }
    this.stateMachine.transitionTo(new CountdownState(), this);
  }

  transitionToRacing() {
    this.stateMachine.transitionTo(new RacingState(), this);
  }

  showResultsScreen() {
    this.resultsPresenter.present(this);
    this.results.show();
    this.stateMachine.transitionTo(new FinishedState(), this);
  }

  restartCurrentMap() {
    this.results.hide();
    if (this.player) { disposeGroup(this.player.mesh); this.scene.remove(this.player.mesh); this.player = null; }
    this.createPlayer();
    this.createGhost();
    this.ghost.setVisibleWhenPresent(true);
    this.stateMachine.transitionTo(new CountdownState(), this);
  }

  restartRace() {
    this.results.hide();
    this.currentRun.resetSeriesProgress();
    if (this.seriesMode) {
      this.rebuildTrack(this.stageConfigs[0].code);
    } else {
      this.rebuildTrack(this.runContext.trackCodeForRestartNonSeries(this));
    }
    this.stateMachine.transitionTo(new MenuState(), this);
  }

  // --- Local best-time records panel ---

  showRecords() {
    if (this.settingsPanel.isOpen()) this.hideSettings();
    this.menuPreviewActive = false;
    this.menu.hide();
    this.accountBar.hide();
    this.records.show();
    this.inputContext.setActive(this.records);

    this.session.getAllBestTimes((recs) => {
      this.records.render(recs, this.retryRecord.bind(this));
    });
  }

  retryRecord(rec) {
    this.seriesMode = false;
    this.clearChallengeMode();
    this.direction = rec.direction || Direction.fromBoolean(rec.reversed);
    this.mode = rec.mode || Mode.fromBoolean(rec.nightMode);
    this.switchRenderer(this.mode);
    this.totalLaps = rec.laps;

    this.menu.setTrackCode(rec.code);
    this.menu.setLaps(this.totalLaps);
    this.menu.setDirection(this.direction);
    this.menu.setMode(this.mode);
    this.menu.setSeriesMode(false);

    this.records.hide();
    this.inputContext.clear(this.records);

    this.rebuildTrack(rec.code);
    this.startCountdown();
  }

  hideRecords() {
    if (this.stateMachine.current.isMenu() && !this.settingsPanel.isOpen() && !this.leaderboard.isOpen()) {
      this.menuPreviewActive = false;
    }
    this.records.hide();
    this.inputContext.clear(this.records);
    this.accountBar.show();
    this.menu.show();
  }

  // --- Car paint, settings overlay, day/night renderer ---

  drawPatternPreview(canvas, pattern, primary, secondary) {
    const ctx = canvas.getContext('2d');
    const s = canvas.width;
    const r = s / 2;
    ctx.clearRect(0, 0, s, s);
    pattern.drawPreview(ctx, r, primary, secondary);
  }

  updatePatternPreviews() {
    this.settingsPanel.updatePatternPreviews(this.drawPatternPreview.bind(this), this.carSettings.primaryColor, this.carSettings.secondaryColor, Constants.car.patterns);
  }

  applyCarSettings() {
    if (!this.player) return;
    disposeGroup(this.player.mesh);
    this.scene.remove(this.player.mesh);
    const { x, z, a: angle } = this.player.getReplaySample();
    const mesh = new CarMesh({
      color: hexToInt(this.carSettings.primaryColor),
      secondaryColor: hexToInt(this.carSettings.secondaryColor),
      pattern: this.carSettings.pattern,
      x, z, angle, opacity: 1
    });
    this.scene.add(mesh);
    this.player.setCarMesh(mesh);
    if (this.sceneRenderer) this.sceneRenderer.rebuildMeshes(this.carSettings);
    this.sceneDirty = true;
  }

  updateCarColorsInPlace() {
    if (!this.player || !(this.player.mesh instanceof CarMesh)) return;
    this.player.mesh.updateColors(hexToInt(this.carSettings.primaryColor), hexToInt(this.carSettings.secondaryColor));
    this.sceneDirty = true;
  }

  showSettings() {
    if (this.records.isOpen()) this.hideRecords();
    this.menuPreviewActive = false;
    this.settingsPanel.setCarSettings(this.carSettings);
    this.settingsPanel.buildPatternButtons(Constants.car.patterns, this.carSettings.pattern, this.drawPatternPreview.bind(this), this.carSettings.primaryColor, this.carSettings.secondaryColor);

    this.savedCameraModeIndex = this.cam.getModeIndex();
    this.cam.startShowcase();
    this.settingsPanel.buildCameraToggle(Constants.camera.modes, this.cam.getModeIndex(), this.cam.isShowcaseActive());

    this.savedMode = this.mode;
    this.settingsPanel.setPreviewMode(this.mode.isNight());

    this.previewRunning = false;
    this.previewT = 0;
    this.settingsPanel.setPreviewDrive(false);

    this.menu.hide();
    this.accountBar.hide();
    this.settingsPanel.show();
    this.inputContext.setActive(this.settingsPanel);
    this.settingsPanel.showBackButton(true);
  }

  switchRenderer(newMode) {
    const inMenu = this.stateMachine && this.stateMachine.current.isMenu();
    const overlaysClosed =
      !this.settingsPanel.isOpen() && !this.records.isOpen();
    const preserveShowcase = inMenu && overlaysClosed && this.cam && this.cam.isShowcaseActive();
    let showcaseTimer = 0;
    let showcaseShotIndex = 0;
    if (preserveShowcase) {
      showcaseTimer = this.cam.showcaseTimer;
      showcaseShotIndex = this.cam.showcaseShotIndex;
    }
    if (this.sceneRenderer) {
      if (this.sceneRenderer.cleanup) this.sceneRenderer.cleanup();
    }
    this.sceneRenderer = newMode.isNight() ? new NightRenderer(this.scene, this.carSettings) : new DayRenderer(this.scene, this.carSettings);
    if (preserveShowcase) {
      this.cam.showcaseTimer = showcaseTimer;
      this.cam.showcaseShotIndex = showcaseShotIndex;
      this.cam.showcaseActive = true;
    }
  }

  switchPreviewToNight() {
    if (this.mode.isNight()) return;
    this.mode = new NightMode();
    this.settingsPanel.setPreviewMode(true);
    this.switchRenderer(this.mode);
  }

  hideSettings() {
    this.saveSettings();
    this._flushUnderglowColorPreview();
    if (this.stateMachine.current.isMenu() && !this.records.isOpen() && !this.leaderboard.isOpen()) {
      this.menuPreviewActive = false;
    }
    this.mode = this.savedMode;
    this.switchRenderer(this.mode);
    this.cam.stopShowcase();
    this.previewRunning = false;
    this.hud.setCameraLabel(this._displayCameraName(this.cam.setMode(this.savedCameraModeIndex, this.player)));
    if (this.player) {
      const start = this.track.getStartPosition(this.direction);
      this.player.setWorldPose(start.x, start.z, start.angle);
    }
    this.settingsPanel.hide();
    this.inputContext.clear(this.settingsPanel);
    this.settingsPanel.showBackButton(false);
    this.accountBar.show();
    this.menu.show();
  }


  // ---------------------------------------------------------------------------
  // Private — object graph from constructor()
  // ---------------------------------------------------------------------------

  _initRaceAndPreviewState() {
    this.totalLaps = 3;
    this.direction = new FwdDirection();
    this.mode = new DayMode();
    this.savedCameraModeIndex = 0;
    this.previewRunning = false;
    this.previewT = 0;
    this.menuPreviewActive = false;
    this.menuPreviewLastRender = 0;

    this.seriesMode = false;
    /** Which series stage the menu 3D preview reflects (0-based). */
    this.menuSeriesPreviewStageIndex = 0;
    this.runContext = RunContext.event();
    this.stageCount = 3;
    this.stageConfigs = [
      { code: '', direction: new FwdDirection(), mode: new DayMode() },
      { code: '', direction: new FwdDirection(), mode: new DayMode() },
      { code: '', direction: new FwdDirection(), mode: new DayMode() },
      { code: '', direction: new FwdDirection(), mode: new DayMode() },
      { code: '', direction: new FwdDirection(), mode: new DayMode() }
    ];
    this.currentRun = new Race();

    this.carSettings = Storage.shared.loadCarSettings() ?? Storage.shared.defaultCarSettingsClone();

    this.mobile = isMobile();
    this.inputContext = new InputContext();
    this.leaderboardFrom = null;
    this.lastTime = 0;
    this.rebuildTimer = undefined;
    this._saveSettingsTimer = null;
    this._underglowColorRaf = null;
    this.currentTrackCode = '';

    this.sceneDirty = true;

    this.bestReplay = null;
    this.bestTime = null;

    this.savedMode = new DayMode();
  }

  _initRenderingSlots() {
    this.scene = null;
    this.renderer = null;
    this.trackGroup = null;
    this.track = null;
    this.player = null;
    this.cam = null;
    this.sceneRenderer = null;
    this.stateMachine = null;
    this.input = null;
  }

  _initAuthUiAndSession() {
    this.authManager = new Auth();
    this.userProfile = new UserProfile();
    this.apiClient = new ApiClient(() => this.authManager.getToken());

    this.hud = new Hud();
    this.results = new ResultsScreen();
    this.menu = new Menu(function (code) { return new TrackCode(code).toSVG(); });
    this.records = new RecordsPanel(function (code) { return new TrackCode(code).toSVG(); }, formatDescriptor);
    this.leaderboard = new LeaderboardPanel(countryFlag);
    this.auth = new AuthPanel(Constants.countries, countryFlag);
    this.accountBar = new AccountBar();
    this.settingsPanel = new SettingsPanel();
    this.ghost = new Ghost();
    this.resultsPresenter = new ResultsPresenter(this.results);

    this.userSession = UserSession.fromAuth(this.authManager, () => this.runContext.getChallengeSlug());
    this.session = GuestSession;
  }

  // ---------------------------------------------------------------------------
  // Private — init() pipeline
  // ---------------------------------------------------------------------------

  _bootstrapSessionUi() {
    this.loadAuth();
    this.updateAccountBar();
  }

  _configureMobileShell() {
    document.body.classList.add('mobile');
    const m = strings.mobile;
    const el = (id) => document.getElementById(id);
    const ep = el('event-start-prompt');
    const cp = el('challenge-start-prompt');
    const rp = el('results-prompt');
    const lb = el('leaderboard-back');
    const rb = el('records-back');
    const sb = el('settings-back');
    if (ep) ep.textContent = m.tapStart;
    if (cp) cp.textContent = m.tapStart;
    if (rp) rp.textContent = m.tapRetry;
    if (lb) lb.textContent = m.back;
    if (rb) rb.textContent = m.back;
    if (sb) sb.textContent = m.back;
    this.auth.setCloseText(strings.document.auth.closeMobile);
    const startFromMenuIfReady = () => {
      if (this.stateMachine.current.isMenu() && !this.records.isOpen() && !this.settingsPanel.isOpen() && !this.leaderboard.isOpen()) {
        this.startCountdown();
      }
    };
    this.menu.onEventStart(startFromMenuIfReady);
    this.menu.onChallengeStart(startFromMenuIfReady);
    this.results.onPromptClick(() => {
      if (this.stateMachine.current.isFinished()) {
        if (this.stateMachine.current.handleEnterKey) {
          this.stateMachine.current.handleEnterKey(this);
        }
      }
    });
  }

  _createThreeBootstrap() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x5d8a4a);

    const aspect = window.innerWidth / window.innerHeight;
    const halfW = Constants.camera.viewSize / 2;
    const halfH = halfW / aspect;
    const orthoCamera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 1000);
    orthoCamera.position.set(0, Constants.camera.height, 0);
    orthoCamera.up.set(0, 0, -1);
    orthoCamera.lookAt(0, 0, 0);
    // Low near plane: hood/first-person geometry sits close to the camera; near=1 clipped it.
    const perspCamera = new THREE.PerspectiveCamera(70, aspect, 0.05, 2000);
    this.cam = new Camera(orthoCamera, perspCamera);
    this.hud.setCameraLabel(this._displayCameraName(this.cam.getCurrentModeName()));

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (THREE.SRGBColorSpace !== undefined) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding !== undefined) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }
    const gameView = document.createElement('div');
    gameView.id = 'game-view';
    gameView.setAttribute('aria-hidden', 'true');
    gameView.appendChild(this.renderer.domElement);
    document.body.prepend(gameView);
    this._setupGameBackdropSync(gameView);

    this.sceneRenderer = this.mode.isNight() ? new NightRenderer(this.scene, this.carSettings) : new DayRenderer(this.scene, this.carSettings);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshLambertMaterial({ color: 0x5d8a4a })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.matrixAutoUpdate = false;
    ground.frustumCulled = false;
    ground.updateMatrix();
    this.scene.add(ground);
  }

  _setupGameBackdropSync(gameView) {
    const sync = () => {
      gameView.classList.toggle('game-blurred', _isAnyModalOpenForBackdrop());
    };
    sync();
    const mo = new MutationObserver(sync);
    const opts = { attributes: true, attributeFilter: ['class', 'style'] };
    const ids = ['overlay', 'results', 'leaderboard', 'records', 'auth'];
    for (let i = 0; i < ids.length; i++) {
      const el = document.getElementById(ids[i]);
      if (el) mo.observe(el, opts);
    }
  }

  _consumeShareUrlParams() {
    let startCode = randomTrackCode();
    let openedSeriesFromUrl = false;
    const params = new URLSearchParams(window.location.search);
    const sharedDescriptor = params.get('t');
    const sharedSeries = params.get('s');
    if (sharedSeries) {
      openedSeriesFromUrl = true;
      const descs = sharedSeries.split(',');
      this.stageCount = descs.length;
      this.menu.setStageCount(this.stageCount);
      for (let di = 0; di < descs.length; di++) {
        const stageParsed = parseDescriptor(descs[di]);
        this.stageConfigs[di] = {
          code: stageParsed.code,
          direction: stageParsed.direction || new FwdDirection(),
          mode: stageParsed.mode || new DayMode()
        };
        if (di === 0 && stageParsed.laps !== undefined) {
          this.totalLaps = stageParsed.laps;
          this.menu.setLaps(this.totalLaps);
        }
      }
      this.seriesMode = true;
      this.menu.setSeriesMode(true);
      startCode = this.stageConfigs[0].code;
      this.buildStageList();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (sharedDescriptor) {
      const urlParsed = parseDescriptor(sharedDescriptor);
      startCode = urlParsed.code;
      this.applyParsedDescriptorMeta(urlParsed);
      window.history.replaceState({}, '', window.location.pathname);
    }
    return { startCode, openedSeriesFromUrl };
  }

  _mountInitialTrack(startCode, openedSeriesFromUrl) {
    this.menu.setTrackCode(startCode);
    if (!openedSeriesFromUrl) {
      for (let ci = 0; ci < this.stageConfigs.length; ci++) this.stageConfigs[ci].code = randomTrackCode();
    } else {
      const s0 = this.stageConfigs[0];
      this.direction = s0.direction;
      this.mode = s0.mode;
      this.menuSeriesPreviewStageIndex = 0;
      this.switchRenderer(this.mode);
    }
    this.rebuildTrack(startCode);
  }

  _bindResize() {
    window.addEventListener('resize', () => {
      this.cam.handleResize(this.player);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.sceneDirty = true;
    });
  }

  _bindPersistGuards() {
    const self = this;
    window.addEventListener('pagehide', function () {
      self.saveSettings();
      self._flushUnderglowColorPreview();
    });
  }

  // ---------------------------------------------------------------------------
  // Private — input & DOM callbacks (after state machine exists)
  // ---------------------------------------------------------------------------

  _wireUiCallbacks() {
    this._bindKeyboardAndTouch();
    this._bindMenuCallbacks();
    this._bindRecordsAuthAndLeaderboard();
    this._bindSettingsPanelCallbacks();
  }

  _bindKeyboardAndTouch() {
    this.input = new Input(this.renderer.domElement, {
      onKeyDown: (e) => {
        if (e.code === 'Enter') {
          e.preventDefault();
          const enterHandler = this.inputContext.getActiveHandler('EnterKey');
          if (enterHandler) {
            enterHandler.handleEnterKey(this);
          } else if (this.stateMachine.current.isMenu() && !this.records.isOpen() && !this.settingsPanel.isOpen() && !this.leaderboard.isOpen()) {
            this.startCountdown();
          } else if (this.stateMachine.current.isFinished() && this.stateMachine.current.handleEnterKey) {
            this.stateMachine.current.handleEnterKey(this);
          }
        }

        if (e.code === 'Escape') {
          e.preventDefault();
          const escapeHandler = this.inputContext.getActiveHandler('EscapeKey');
          if (escapeHandler) {
            escapeHandler.handleEscapeKey(this);
          } else if (this.stateMachine.current.isFinished() && this.stateMachine.current.handleEscapeKey) {
            this.stateMachine.current.handleEscapeKey(this);
          }
        }

        if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
          e.preventDefault();
          const handler = this.inputContext.getActiveHandler('SpaceKey');
          if (handler) {
            handler.handleSpaceKey(this);
          } else if (this.stateMachine.current.isMenu() && !this.records.isOpen() && !this.settingsPanel.isOpen()) {
            this.startCountdown();
          } else if (this.stateMachine.current.isRacing() || this.stateMachine.current.isCountdown()) {
            this.restartCurrentMap();
          } else if (this.stateMachine.current.isFinished() && this.stateMachine.current.handleSpaceKey) {
            this.stateMachine.current.handleSpaceKey(this);
          }
        }

        if (e.code === 'KeyC' && document.activeElement.tagName !== 'INPUT') {
          this._cycleCameraMode();
        }
      },
      onTouchRestart: () => {
        if (this.stateMachine.current.isRacing() || this.stateMachine.current.isCountdown()) {
          this.restartCurrentMap();
        } else if (this.stateMachine.current.isFinished()) {
          if (this.stateMachine.current.handleEnterKey) {
            this.stateMachine.current.handleEnterKey(this);
          }
        }
      },
      onTouchCamera: () => {
        this._cycleCameraMode();
      },
      onTouchMenu: () => {
        if (this.stateMachine.current.isFinished()) {
          if (this.stateMachine.current.handleEscapeKey) {
            this.stateMachine.current.handleEscapeKey(this);
          }
        }
      }
    });
  }

  _bindMenuCallbacks() {
    this.menu.onTrackCodeInput(() => {
      this.clearChallengeMode();
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = setTimeout(() => {
        const parsed = parseDescriptor(this.menu.getTrackCode());
        const prevCode = this.currentTrackCode;
        const prevDirRev = this.direction.isRev();
        this._applyParsedDescriptorWithMenuFallback(parsed);
        if (!this.stateMachine.current.isMenu()) return;
        const codeChanged = parsed.code !== prevCode;
        const dirChanged = this.direction.isRev() !== prevDirRev;
        this.switchRenderer(this.mode);
        if (codeChanged || dirChanged) {
          this.rebuildTrack(parsed.code, { resetMenuPreview: true });
        } else {
          if (this.track && this.player) {
            const start = this.track.getStartPosition(this.direction);
            this.player.setWorldPose(start.x, start.z, start.angle);
          }
          this.loadBest(parsed.code, () => { this.createGhost(); });
          this.sceneDirty = true;
        }
      }, 200);
    });

    this.menu.onRandomize(() => {
      this.clearChallengeMode();
      this.menu.setTrackCode(randomTrackCode());
      if (this.stateMachine.current.isMenu()) {
        const parsed = parseDescriptor(this.menu.getTrackCode());
        this._applyParsedDescriptorWithMenuFallback(parsed);
        this.switchRenderer(this.mode);
        this.rebuildTrack(parsed.code, { resetMenuPreview: true });
      }
    });

    this.menu.onTabToggle((tab) => {
      if (tab === 'event') {
        this.clearChallengeMode();
        this.menu.stopChallengeCountdown();
        this.seriesMode = this.menu.getSeriesMode();
        this.totalLaps = this.menu.getLaps();
        if (this.seriesMode) {
          this.menuSeriesPreviewStageIndex = 0;
          this.syncMenuPreviewToSeriesStage(0);
        } else {
          this.syncSingleRaceMenuPreviewFromMenu();
        }
      } else {
        this.renderChallengePreview();
      }
    });

    this.menu.onChallengeToggle(() => {
      this.renderChallengePreview();
    });

    this.menu.onLapsMinus(() => {
      if (this.totalLaps > 1) {
        this.totalLaps--;
        this.menu.setLaps(this.totalLaps);
        this.clearChallengeMode();
      }
    });

    this.menu.onLapsPlus(() => {
      if (this.totalLaps < 20) {
        this.totalLaps++;
        this.menu.setLaps(this.totalLaps);
        this.clearChallengeMode();
      }
    });

    this.menu.onDirectionToggle(() => {
      this.clearChallengeMode();
      if (this.stateMachine.current.isMenu() && this.seriesMode) {
        this.syncMenuPreviewToSeriesStage(this.menuSeriesPreviewStageIndex);
        return;
      }
      this.direction = this.menu.getDirection();
      const parsed = parseDescriptor(this.menu.getTrackCode());
      this.menu.setTrackCode(parsed.code);
      this.applyParsedDescriptorMeta({ code: parsed.code, mode: parsed.mode, laps: parsed.laps });
      if (this.stateMachine.current.isMenu()) {
        this.switchRenderer(this.mode);
        this.rebuildTrack(parsed.code, { resetMenuPreview: true });
      }
    });

    this.menu.onModeToggle((isNight) => {
      this.mode = isNight ? new NightMode() : new DayMode();
      this.clearChallengeMode();
      this.switchRenderer(this.mode);
      this.sceneDirty = true;
    });

    this.menu.onRaceTypeToggle((isSeries) => {
      this.clearChallengeMode();
      this.seriesMode = isSeries;
      if (this.seriesMode) {
        this.menuSeriesPreviewStageIndex = 0;
        this.buildStageList();
        this.syncMenuPreviewToSeriesStage(0);
      } else {
        this.syncSingleRaceMenuPreviewFromMenu();
      }
    });

    this.menu.onStagesMinus(() => {
      if (this.stageCount > 2) {
        this.stageCount--;
        this.menu.setStageCount(this.stageCount);
        this.clearChallengeMode();
        this.buildStageList();
        if (this.menuSeriesPreviewStageIndex >= this.stageCount) {
          this.menuSeriesPreviewStageIndex = this.stageCount - 1;
        }
      }
    });

    this.menu.onStagesPlus(() => {
      if (this.stageCount < 5) {
        this.stageCount++;
        this.menu.setStageCount(this.stageCount);
        this.clearChallengeMode();
        this.buildStageList();
      }
    });

    this.menu.onRngAll(() => {
      this.clearChallengeMode();
      for (let i = 0; i < this.stageCount; i++) {
        this.stageConfigs[i].code = randomTrackCode();
        this.stageConfigs[i].direction = Direction.fromBoolean(Math.random() > 0.5);
        this.stageConfigs[i].mode = Mode.fromBoolean(Math.random() > 0.5);
      }
      this.totalLaps = Math.floor(Math.random() * 5) + 1;
      this.menu.setLaps(this.totalLaps);
      this.menuSeriesPreviewStageIndex = 0;
      this.buildStageList();
      this.syncMenuPreviewToSeriesStage(0);
    });
  }

  _bindRecordsAuthAndLeaderboard() {
    this.results.onCopy(() => {
      navigator.clipboard.writeText(formatDescriptor(this.currentTrackCode, this.direction, this.mode, this.totalLaps)).then(() => {
        this.results.flashCopyDone();
      });
    });

    this.results.onShare(() => {
      navigator.clipboard.writeText(this.resultsPresenter.buildShareText(this)).then(() => {
        this.results.flashShareDone();
      });
    });

    this.records.onOpen(() => {
      if (this.stateMachine.current.isMenu()) this.showRecords();
    });

    this.records.onBack(() => {
      this.hideRecords();
    });

    this.settingsPanel.onOpen(() => {
      if (this.stateMachine.current.isMenu()) this.showSettings();
    });

    this.settingsPanel.onBack(() => {
      this.hideSettings();
    });

    this.auth.onSubmit(this.handleAuthSubmit.bind(this));
    this.auth.onClose(this.hideAuthPanel.bind(this));
    this.accountBar.onLogout(() => {
      this.authManager.clearAuth();
      this.userProfile.username = null;
      this.userProfile.country = null;
      this.session = GuestSession;
      this.updateAccountBar();
    });
    this.accountBar.onLogin(() => {
      this.showAuthPanel();
    });

    this.results.onLeaderboardClick(() => {
      this.leaderboardFrom = 'results';
      this.results.hide();
      this.showLeaderboardPanel();
    });
    this.leaderboard.onMenuOpen(() => {
      if (!this.stateMachine.current.isMenu()) return;
      this.leaderboardFrom = 'menu';
      const modeStr = this.menu.getSelectedChallengeMode();
      this.menu.hide();
      this.leaderboard.show();
      this.inputContext.setActive(this.leaderboard);
      this.showLeaderboardForChallenge(modeStr);
    });
    this.leaderboard.onBack(() => {
      this.hideLeaderboardPanel();
      if (this.leaderboardFrom === 'results') this.results.show();
      else this.menu.show();
      this.leaderboardFrom = null;
    });
  }

  _bindSettingsPanelCallbacks() {
    this.settingsPanel.onPatternSelect((pattern) => {
      this.carSettings.pattern = pattern;
      this.saveSettings();
      this.applyCarSettings();
    }, Constants.car.patterns);

    this.settingsPanel.onColorChange((key, value) => {
      this.carSettings[key] = value;
      this.saveSettings();
      this.updatePatternPreviews();
      this.updateCarColorsInPlace();
    });

    this.settingsPanel.onHeadlightChange((key, value) => {
      this.carSettings[key] = value;
      this.saveSettings();
      this.switchPreviewToNight();
      if (this.sceneRenderer) this.sceneRenderer.updateColors(this.carSettings);
      this.sceneDirty = true;
    });

    this.settingsPanel.onHeadlightShapeInput((value) => {
      this.carSettings.headlightShape = value;
      this.scheduleSaveSettings();
      this.switchPreviewToNight();
      this.sceneDirty = true;
    });
    this.settingsPanel.onHeadlightShapeCommit((value) => {
      this.carSettings.headlightShape = value;
      this.saveSettings();
      this.switchPreviewToNight();
      if (this.sceneRenderer) this.sceneRenderer.rebuildMeshes(this.carSettings);
      this.sceneDirty = true;
    });

    this.settingsPanel.onUnderglowChange((key, value) => {
      this.carSettings[key] = value;
      this.saveSettings();
      if (this.sceneRenderer) this.sceneRenderer.updateColors(this.carSettings);
      this.sceneDirty = true;
    });

    this.settingsPanel.onUnderglowOpacityChange((value) => {
      this.carSettings.underglowOpacity = value;
      this.scheduleSaveSettings();
      this._scheduleUnderglowColorPreviewUpdate();
      this.sceneDirty = true;
    });

    this.settingsPanel.onPreviewModeToggle((isNight) => {
      this.mode = isNight ? new NightMode() : new DayMode();
      this.switchRenderer(this.mode);
      this.sceneDirty = true;
    });

    this.settingsPanel.onPreviewCameraToggle((val) => {
      if (val === 'showcase') {
        this.cam.startShowcase();
      } else {
        const name = this.cam.exitShowcaseToMode(parseInt(val, 10), this.player);
        this.hud.setCameraLabel(this._displayCameraName(name));
      }
      this.sceneDirty = true;
    });

    this.settingsPanel.onPreviewDriveToggle((running) => {
      this.previewRunning = running;
      if (this.previewRunning) this.previewT = 0;
      this.sceneDirty = true;
    });
  }

  // ---------------------------------------------------------------------------
  // Private — camera
  // ---------------------------------------------------------------------------

  _displayCameraName(internalName) {
    return strings.camera.labels[internalName] || internalName;
  }

  _cycleCameraMode() {
    this.hud.setCameraLabel(this._displayCameraName(this.cam.cycleMode(this.player)));
    this.sceneDirty = true;
  }

  // ---------------------------------------------------------------------------
  // Private — gameLoop
  // ---------------------------------------------------------------------------

  _nextFrameDelta(time) {
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.05) : 0.016;
    this.lastTime = time;
    return dt;
  }

  _runFrameUpdates(dt) {
    this._tickSettingsPreviewDrive(dt);
    this._syncCameraToFrame(dt);
    this._tickSceneRenderer();
  }

  _tickSettingsPreviewDrive(dt) {
    if (!this.settingsPanel.isOpen() || !this.previewRunning) return;
    this.updatePreviewDrive(dt);
    this.sceneDirty = true;
  }

  _syncCameraToFrame(dt) {
    if (!this.player) return;
    const state = this.stateMachine.current;
    if (state.isMenu()) {
      // MenuState skips camera updates while overlays are open; Car Settings still needs
      // per-frame showcase orbit or chase / other fixed modes (applyMode only runs once).
      if (!this.settingsPanel.isOpen()) return;
      if (this.cam.isShowcaseActive()) {
        this.cam.updateShowcase(dt, this.player);
      } else {
        this.cam.update(this.player, dt);
      }
      this.sceneDirty = true;
      return;
    }

    if (this.cam.isShowcaseActive()) {
      this.cam.updateShowcase(dt, this.player);
      this.sceneDirty = true;
      return;
    }
    this.cam.update(this.player, dt);
  }

  _tickSceneRenderer() {
    if (!this.sceneRenderer) return;
    if (!this.mode.isNight()) return;
    this.sceneRenderer.update(this.player, this.carSettings.underglowOpacity, this.cam.getModeIndex());
  }

  _presentIfDirty() {
    if (!this.sceneDirty) return;
    this.renderer.render(this.scene, this.cam.active);
    this.sceneDirty = false;
  }

}
