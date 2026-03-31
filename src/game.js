import Constants from './constants.js';
import {
  initialGpuTierIndex,
  GPU_TIER_PIXEL_RATIOS,
  preferWebglAntialias,
  stepGpuTier
} from './gpu-tier.js';
import Storage from './storage.js';
import { GuestSession } from './session.js';
import {
  hexToInt, disposeGroup, countryFlag, isMobile,
  formatDescriptor,
  parseDescriptor,
  decodeTrackShareToken,
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
  dailySeriesConfig,
  pickRandom,
  provisionalLeaderboardRank
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
import {
  Menu, Hud, ResultsScreen, ResultsPresenter, RecordsPanel, LeaderboardPanel, SettingsPanel,
  ChallengeQualifyScreen
} from './ui/index.js';
import { FwdDirection, Direction } from './directions/index.js';
import { DayMode, NightMode, Mode } from './modes/index.js';
import { ChallengeMode } from './challenge-modes/index.js';
import RunContext from './run-context/index.js';
import Race from './race.js';
import { StateMachine, MenuState, CountdownState, RacingState, FinishedState, InputContext } from './game-states/index.js';
import { strings, formatPlaceholders } from './strings.js';
import { attachDevScreenApi } from './dev-screen-preview.js';
const _previewPt = new THREE.Vector3();
const _previewTan = new THREE.Vector3();

/** Slider drags were calling saveSettings every tick (JSON clone + storage + optional API). */
const SAVE_SETTINGS_DEBOUNCE_MS = 350;

/**
 * Fullscreen modals: blur the WebGL layer (backdrop-filter does not sample canvas reliably).
 * Car settings panel is excluded: the menu is hidden while it is open and the scene must stay sharp.
 */
function _isAnyModalOpenForBackdrop() {
  const overlay = document.querySelector('.menu-overlay');
  const results = document.querySelector('.race-results');
  const leaderboard = document.querySelector('.race-leaderboard');
  const records = document.querySelector('.race-records');
  const challengeQualify = document.querySelector('.challenge-qualify');
  if (!overlay || !results || !leaderboard || !records) return false;
  return (
    !overlay.classList.contains('hidden') ||
    results.style.display === 'flex' ||
    (challengeQualify && challengeQualify.style.display === 'flex') ||
    leaderboard.style.display === 'flex' ||
    !records.classList.contains('hidden')
  );
}

export default class Game {
  constructor() {
    this._initRaceAndPreviewState();
    this._initRenderingSlots();
    this._initPanelsAndSession();
    this.init();
  }

  // --- Bootstrap & main loop ---

  init() {
    if (this.mobile) this._configureMobileShell();
    this._createThreeBootstrap();
    const { startCode, openedSeriesFromUrl } = this._consumeShareUrlParams();
    this._mountInitialTrack(startCode, openedSeriesFromUrl);
    this.stateMachine = new StateMachine(new MenuState());
    this._wireUiCallbacks();
    this.menu.showTab('challenges');
    this.renderChallengePreview();
    this._bindResize();
    this._bindPersistGuards();
    this._initDevTools();
    attachDevScreenApi(this);
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  gameLoop(time) {
    requestAnimationFrame((t) => this.gameLoop(t));
    const dt = this._nextFrameDelta(time);
    const tCpu0 = typeof performance !== 'undefined' ? performance.now() : 0;
    if (stepGpuTier(this._gpuTierState, dt)) {
      this._applyGpuPixelRatio();
      this.sceneDirty = true;
    }
    this.stateMachine.update(dt, this);
    this._runFrameUpdates(dt);
    const cpuWorkMs = typeof performance !== 'undefined' ? performance.now() - tCpu0 : 0;
    const rendered = this._presentIfDirty();
    this._tickDevTools(dt, rendered, cpuWorkMs);
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

  // --- Best times, settings ---

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

  /** At most one `sceneRenderer.updateColors` per frame while scrubbing underglow opacity. */
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
        data = { entries: [], total_count: 0 };
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
    if (this.leaderboardFrom === 'menu') this.menu.show();
    else this.results.show();
    this.leaderboardFrom = null;
  }

  renderLeaderboardData(data) {
    this.leaderboard.render(data);
  }

  // --- Track shape, descriptors, challenge context ---

  _compileScene() {
    if (!this.renderer || !this.scene || !this.cam || !this.cam.active) return;
    this.renderer.compile(this.scene, this.cam.active);
  }

  _applyGpuPixelRatio() {
    if (!this.renderer) return;
    const cap = GPU_TIER_PIXEL_RATIOS[this._gpuTierState.tierIndex];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
  }

  rebuildTrack(code, { resetMenuPreview = true } = {}) {
    if (this.player) { disposeGroup(this.player.mesh); this.scene.remove(this.player.mesh); this.player = null; }
    this.ghost.dispose(this.scene);

    this.currentTrackCode = code;
    this.track = new Track(code, this.scene, this.trackGroup);
    this.trackGroup = this.track.group;
    this.track.applyNightShadowFlags();
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
    this._compileScene();
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
    }, this.menuSeriesPreviewStageIndex);
  }

  advanceToNextStage() {
    if (this.postRaceReplayActive) this._cancelPostRaceReplayOnly();
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
    const { info } = this.loadChallengeConfig(modeStr);

    this.menu.renderChallengePreview(info, challengeResetMs, formatCountdown, () => this.renderChallengePreview());
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
    this.stateMachine.transitionTo(new FinishedState(), this);
    void this._beginChallengePostRaceFlow();
  }

  _serializeCarSettingsForApi() {
    const s = this.carSettings;
    const pat = s.pattern;
    return {
      pattern: pat && pat.name ? pat.name : 'solid',
      primaryColor: s.primaryColor,
      secondaryColor: s.secondaryColor,
      headlightsColor: s.headlightsColor,
      headlightShape: s.headlightShape,
      underglowColor: s.underglowColor,
      underglowOpacity: s.underglowOpacity
    };
  }

  /**
   * Challenge final stage: fetch board — qualify screen or "better luck"; else show RACE COMPLETE.
   */
  async _beginChallengePostRaceFlow() {
    const cm = this.runContext.getChallengeMode();
    if (!cm || (this.seriesMode && !this.currentRun.isFinalStage(this.stageCount))) {
      this.results.show();
      return;
    }

    const fakeLb = Constants.fakeChallengeLeaderboards;
    const key = this.runContext.getChallengeKey(utcDateStr(), utcMondayStr());
    let leaderboardData;
    let compareTime;

    try {
      if (fakeLb) {
        if (cm.isSeries()) {
          const snap = this.currentRun.getSeriesResultsSnapshot();
          compareTime = 0;
          for (let i = 0; i < snap.length; i++) compareTime += snap[i].time;
        } else {
          compareTime = this.player.finishTime;
        }
        leaderboardData = { entries: [] };
      } else if (cm.isSeries()) {
        leaderboardData = await this.apiClient.fetchChallengeLeaderboard(key);
        const snap = this.currentRun.getSeriesResultsSnapshot();
        compareTime = 0;
        for (let i = 0; i < snap.length; i++) compareTime += snap[i].time;
      } else {
        const info = challengeConfigForMode(cm);
        if (!info) {
          this.results.show();
          return;
        }
        leaderboardData = await this.apiClient.fetchLeaderboard(
          info.config.code,
          info.config.laps,
          info.config.direction,
          info.config.mode
        );
        compareTime = this.player.finishTime;
      }
    } catch {
      this.results.show();
      return;
    }

    const entries = leaderboardData.entries || [];
    let qualifies = true;
    if (!fakeLb && entries.length >= 10) {
      qualifies = compareTime <= entries[9].time_ms;
    }
    if (!qualifies) {
      this.results.show();
      this.results.addRow(strings.results.betterLuckNextTime, { className: 'arcade-lb-msg' });
      return;
    }

    const rank = provisionalLeaderboardRank(entries, compareTime);
    const headline = pickRandom(strings.results.challengeQualifyHeadlines);
    const subline = formatPlaceholders(strings.results.challengeQualifySubline, { rank });
    this.challengeQualify.show(headline, subline, Storage.shared.getArcadeName());
    this.inputContext.setActive(this.challengeQualify);
  }

  async _postChallengeLeaderboardTime(displayName) {
    const cm = this.runContext.getChallengeMode();
    if (!cm) return;
    if (Constants.fakeChallengeLeaderboards) return;

    const key = this.runContext.getChallengeKey(utcDateStr(), utcMondayStr());
    let compareTime;
    if (cm.isSeries()) {
      const snap = this.currentRun.getSeriesResultsSnapshot();
      compareTime = 0;
      for (let i = 0; i < snap.length; i++) compareTime += snap[i].time;
    } else {
      compareTime = this.player.finishTime;
    }

    if (cm.isSeries()) {
      const snap = this.currentRun.getSeriesResultsSnapshot();
      const stages = snap.map(function (sr) {
        return {
          track_code: sr.code,
          laps: this.totalLaps,
          reversed: sr.direction.isRev(),
          night_mode: sr.mode.isNight(),
          time_ms: sr.time
        };
      }.bind(this));
      await this.apiClient.submitLeaderboardTime({
        challenge_key: key,
        display_name: displayName,
        stages
      });
    } else {
      const info = challengeConfigForMode(cm);
      const packed = Storage.shared.encodeReplay(this.currentRun.getRecording());
      await this.apiClient.submitLeaderboardTime({
        track_code: info.config.code,
        laps: info.config.laps,
        reversed: info.config.direction.isRev(),
        night_mode: info.config.mode.isNight(),
        time_ms: compareTime,
        display_name: displayName,
        ghost_data: packed,
        car_settings: this._serializeCarSettingsForApi()
      });
    }
  }

  async _onChallengeQualifySubmit(displayName) {
    Storage.shared.setArcadeName(displayName);
    this.challengeQualify.setSubmitting(true);
    try {
      await this._postChallengeLeaderboardTime(displayName);
    } catch {
      /* network / server error — still open leaderboard */
    }
    this.challengeQualify.setSubmitting(false);
    this.challengeQualify.hide();
    this.inputContext.clear(this.challengeQualify);
    this.leaderboardFrom = 'challenge-qualify';
    this.results.hide();
    this.showLeaderboardPanel();
  }

  startPostRaceReplay() {
    if (!this.stateMachine.current.isFinished() || !this.player) return;
    const rec = this.currentRun.getRecording();
    if (rec.length < 2) return;
    this.postRaceReplayActive = true;
    this.postRaceReplayTime = 0;
    if (this.challengeQualify.isFlowActive()) {
      this.challengeQualify.hideForReplay();
      this._challengeQualifyReplayReturn = true;
    } else {
      this._challengeQualifyReplayReturn = false;
    }
    this.results.hide();
    const hint = this.mobile
      ? strings.document.results.replayHintMobile
      : strings.document.results.replayHintDesktop;
    this.results.showReplayHint(hint);
    this.hud.hide();
    this.ghost.setVisibleWhenPresent(false);
    this.cam.startShowcase();
    this._applyReplayPoseAtTime(0);
    this.sceneDirty = true;
  }

  exitPostRaceReplay() {
    if (!this.postRaceReplayActive) return;
    this._cancelPostRaceReplayOnly();
    if (this._challengeQualifyReplayReturn) {
      this.challengeQualify.showAfterReplay();
      this._challengeQualifyReplayReturn = false;
    } else {
      this.results.show();
    }
  }

  _cancelPostRaceReplayOnly() {
    if (!this.postRaceReplayActive) return;
    this.postRaceReplayActive = false;
    this.postRaceReplayTime = 0;
    this.results.hideReplayHint();
    this.hud.show();
    this.ghost.setVisibleWhenPresent(true);
    const rec = this.currentRun.getRecording();
    if (rec.length && this.player) {
      const last = rec[rec.length - 1];
      this.player.setWorldPose(last.x, last.z, last.a);
    }
    this.cam.stopShowcase();
    if (this.player) {
      this.cam.applyMode(this.player);
    }
    this.sceneDirty = true;
  }

  updatePostRaceReplay(dt) {
    if (!this.player || !this.postRaceReplayActive) return;
    const finishTime = this.player.finishTime;
    if (finishTime <= 0) return;
    this.postRaceReplayTime += dt;
    if (this.postRaceReplayTime >= finishTime) {
      this.postRaceReplayTime = 0;
      this.cam.startShowcase();
    }
    this._applyReplayPoseAtTime(this.postRaceReplayTime);
    this.sceneDirty = true;
  }

  _applyReplayPoseAtTime(t) {
    const rec = this.currentRun.getRecording();
    if (!this.player || rec.length === 0) return;
    const interval = Constants.track.recordInterval;
    const frameTime = t / interval;
    const i = Math.floor(frameTime);
    if (i >= rec.length - 1) {
      const last = rec[rec.length - 1];
      this.player.setWorldPose(last.x, last.z, last.a);
      return;
    }
    const frac = frameTime - i;
    const fa = rec[i];
    const fb = rec[i + 1];
    const x = fa.x + (fb.x - fa.x) * frac;
    const z = fa.z + (fb.z - fa.z) * frac;
    let angleDiff = fb.a - fa.a;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const a = fa.a + angleDiff * frac;
    this.player.setWorldPose(x, z, a);
  }

  restartCurrentMap() {
    if (this.postRaceReplayActive) this._cancelPostRaceReplayOnly();
    if (this.challengeQualify.isFlowActive()) {
      this.challengeQualify.hide();
      this.inputContext.clear(this.challengeQualify);
    }
    this.results.hide();
    if (this.player) { disposeGroup(this.player.mesh); this.scene.remove(this.player.mesh); this.player = null; }
    this.createPlayer();
    this.createGhost();
    this.ghost.setVisibleWhenPresent(true);
    this.stateMachine.transitionTo(new CountdownState(), this);
  }

  restartRace() {
    if (this.postRaceReplayActive) this._cancelPostRaceReplayOnly();
    if (this.challengeQualify.isFlowActive()) {
      this.challengeQualify.hide();
      this.inputContext.clear(this.challengeQualify);
    }
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
    if (this.renderer) {
      this.renderer.shadowMap.enabled = newMode.isNight();
      if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
    }
    if (preserveShowcase) {
      this.cam.showcaseTimer = showcaseTimer;
      this.cam.showcaseShotIndex = showcaseShotIndex;
      this.cam.showcaseActive = true;
    }
    this._compileScene();
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
    this.postRaceReplayActive = false;
    this.postRaceReplayTime = 0;
    this._challengeQualifyReplayReturn = false;

    this.seriesMode = false;
    /** Which series stage the menu 3D preview reflects (0-based). */
    this.menuSeriesPreviewStageIndex = 0;
    this.runContext = RunContext.event();
    this.stageCount = dailySeriesConfig().stageCount;
    this.stageConfigs = [
      { code: '', direction: new FwdDirection(), mode: new DayMode() },
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

  _initPanelsAndSession() {
    this.apiClient = new ApiClient();

    this.hud = new Hud();
    this.results = new ResultsScreen();
    this.menu = new Menu(function (code) { return new TrackCode(code).toSVG(); });
    this.records = new RecordsPanel(function (code) { return new TrackCode(code).toSVG(); }, formatDescriptor);
    this.leaderboard = new LeaderboardPanel(countryFlag);
    this.settingsPanel = new SettingsPanel();
    this.ghost = new Ghost();
    this.resultsPresenter = new ResultsPresenter(this.results);
    this.challengeQualify = new ChallengeQualifyScreen();

    this.session = GuestSession;

    this.menu.setStageCount(this.stageCount);
    this.menu.setLaps(this.totalLaps);
  }

  // ---------------------------------------------------------------------------
  // Private — init() pipeline
  // ---------------------------------------------------------------------------

  _configureMobileShell() {
    document.body.classList.add('mobile');
    const m = strings.mobile;
    const el = (sel) => document.querySelector(sel);
    const ep = el('.menu-overlay__start-prompt--event');
    const cp = el('.menu-overlay__start-prompt--challenge');
    const rp = el('.race-results__prompt');
    const lb = el('.race-leaderboard__back');
    const rb = el('.race-records__back');
    const sb = el('.car-settings__back');
    if (ep) ep.textContent = m.tapStart;
    if (cp) cp.textContent = m.tapStart;
    if (rp) rp.textContent = m.tapRetry;
    const cqp = el('.challenge-qualify__prompt');
    if (cqp) cqp.textContent = m.tapRetry;
    if (lb) lb.textContent = m.back;
    if (rb) rb.textContent = m.back;
    if (sb) sb.textContent = m.back;
    const menuTouchHint = el('.menu-overlay__touch-hint');
    if (menuTouchHint) menuTouchHint.textContent = m.menuOverlayHint;
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
    /** Wide Z slab: strict top-down ortho can clip the y≈0 world plane oddly with up=(0,0,-1); car mesh sits higher so it still drew. */
    const orthoCamera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.5, 10000);
    orthoCamera.position.set(0, Constants.camera.height, 0);
    orthoCamera.up.set(0, 0, -1);
    orthoCamera.lookAt(0, 0, 0);
    // Low near plane: hood/first-person geometry sits close to the camera; near=1 clipped it.
    const perspCamera = new THREE.PerspectiveCamera(70, aspect, 0.05, 2000);
    this.cam = new Camera(orthoCamera, perspCamera);
    this.hud.setCameraLabel(this._displayCameraName(this.cam.getCurrentModeName()));

    this._gpuTierState = {
      tierIndex: initialGpuTierIndex(),
      frameTimeEma: 0.016,
      cooldown: 1.5
    };
    this.renderer = new THREE.WebGLRenderer({
      antialias: preferWebglAntialias(),
      powerPreference: 'high-performance',
      stencil: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this._applyGpuPixelRatio();
    if (THREE.SRGBColorSpace !== undefined) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding !== undefined) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }
    const gameView = document.createElement('div');
    gameView.className = 'game-view';
    gameView.setAttribute('aria-hidden', 'true');
    gameView.appendChild(this.renderer.domElement);
    document.body.prepend(gameView);
    this._setupGameBackdropSync(gameView);

    this.sceneRenderer = this.mode.isNight() ? new NightRenderer(this.scene, this.carSettings) : new DayRenderer(this.scene, this.carSettings);

    this.renderer.shadowMap.enabled = this.mode.isNight();
    if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    const groundMat = new THREE.MeshLambertMaterial({ color: 0x5d8a4a });
    /** Top-down ortho puts road and grass at nearly identical NDC depth; if grass writes depth it wins most pixels. Road/lines must own depth where they exist. */
    groundMat.depthWrite = false;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.matrixAutoUpdate = false;
    ground.frustumCulled = false;
    /** Earlier draw order; road mesh is above in Y and uses polygon offset vs this plane. */
    ground.renderOrder = -1;
    ground.updateMatrix();
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _setupGameBackdropSync(gameView) {
    const sync = () => {
      gameView.classList.toggle('game-blurred', _isAnyModalOpenForBackdrop());
    };
    sync();
    const mo = new MutationObserver(sync);
    const opts = { attributes: true, attributeFilter: ['class', 'style'] };
    const roots = ['.menu-overlay', '.race-results', '.challenge-qualify', '.race-leaderboard', '.race-records'];
    for (let i = 0; i < roots.length; i++) {
      const el = document.querySelector(roots[i]);
      if (el) mo.observe(el, opts);
    }
  }

  _consumeShareUrlParams() {
    let startCode = randomTrackCode();
    let openedSeriesFromUrl = false;
    const params = new URLSearchParams(window.location.search);
    const sharedCompact = params.get('r');
    const sharedDescriptor = params.get('t');
    const sharedSeries = params.get('s');
    if (sharedSeries) {
      openedSeriesFromUrl = true;
      const descs = sharedSeries.split(',');
      this.stageCount = descs.length;
      this.menu.setStageCount(this.stageCount);
      for (let di = 0; di < descs.length; di++) {
        const raw = (descs[di] || '').trim();
        const compact = decodeTrackShareToken(raw);
        const stageParsed = compact || parseDescriptor(raw);
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
    } else if (sharedCompact) {
      const parsed = decodeTrackShareToken(sharedCompact);
      if (parsed) {
        startCode = parsed.code;
        this.applyParsedDescriptorMeta(parsed);
      }
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
      this._applyGpuPixelRatio();
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
    this._bindRecordsAndLeaderboard();
    this._bindSettingsPanelCallbacks();
  }

  _bindKeyboardAndTouch() {
    this.input = new Input(this.renderer.domElement, {
      onKeyDown: (e) => {
        if (e.code === 'Backquote' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          this._toggleDevTools();
          return;
        }

        if (e.code === 'Enter') {
          const ae = document.activeElement;
          if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && ae.closest('.challenge-qualify')) {
            return;
          }
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
        if (this.postRaceReplayActive) {
          this.exitPostRaceReplay();
          return;
        }
        if (this.challengeQualify.isFlowActive()) {
          this.restartCurrentMap();
          return;
        }
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
        if (this.postRaceReplayActive) {
          this.exitPostRaceReplay();
          return;
        }
        if (this.challengeQualify.isFlowActive()) {
          this.restartRace();
          return;
        }
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
        const lapsFromMenuTab = this.menu.getLaps();
        if (Number.isFinite(lapsFromMenuTab)) this.totalLaps = lapsFromMenuTab;
        const stagesFromMenu = this.menu.getStageCount();
        if (Number.isFinite(stagesFromMenu)) this.stageCount = stagesFromMenu;
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
      this.clearChallengeMode();
      const fromMenu = this.menu.getLaps();
      if (Number.isFinite(fromMenu)) this.totalLaps = fromMenu;
      if (!Number.isFinite(this.totalLaps)) this.totalLaps = 3;
      if (this.totalLaps <= 1) return;
      this.totalLaps--;
      this.menu.setLaps(this.totalLaps);
    });

    this.menu.onLapsPlus(() => {
      this.clearChallengeMode();
      const fromMenu = this.menu.getLaps();
      if (Number.isFinite(fromMenu)) this.totalLaps = fromMenu;
      if (!Number.isFinite(this.totalLaps)) this.totalLaps = 3;
      if (this.totalLaps >= 20) return;
      this.totalLaps++;
      this.menu.setLaps(this.totalLaps);
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
      const lapsFromMenu = this.menu.getLaps();
      if (Number.isFinite(lapsFromMenu)) this.totalLaps = lapsFromMenu;
      const stagesFromMenu = this.menu.getStageCount();
      if (Number.isFinite(stagesFromMenu)) this.stageCount = stagesFromMenu;
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
      this.clearChallengeMode();
      const fromMenu = this.menu.getStageCount();
      if (Number.isFinite(fromMenu)) this.stageCount = fromMenu;
      if (!Number.isFinite(this.stageCount)) this.stageCount = 3;
      if (this.stageCount <= 2) return;
      this.stageCount--;
      this.menu.setStageCount(this.stageCount);
      this.buildStageList();
      if (this.menuSeriesPreviewStageIndex >= this.stageCount) {
        this.menuSeriesPreviewStageIndex = this.stageCount - 1;
      }
    });

    this.menu.onStagesPlus(() => {
      this.clearChallengeMode();
      const fromMenu = this.menu.getStageCount();
      if (Number.isFinite(fromMenu)) this.stageCount = fromMenu;
      if (!Number.isFinite(this.stageCount)) this.stageCount = 3;
      if (this.stageCount >= 6) return;
      this.stageCount++;
      this.menu.setStageCount(this.stageCount);
      this.buildStageList();
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

  _bindRecordsAndLeaderboard() {
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

    this.results.onReplay(() => {
      if (this.stateMachine.current.isFinished()) this.startPostRaceReplay();
    });
    this.results.onReplayHintDismiss(() => {
      if (this.postRaceReplayActive) this.exitPostRaceReplay();
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
      if (this.leaderboardFrom === 'menu') this.menu.show();
      else this.results.show();
      this.leaderboardFrom = null;
    });

    this.challengeQualify.onSubmit(this._onChallengeQualifySubmit.bind(this));
    this.challengeQualify.onReplay(() => {
      if (this.stateMachine.current.isFinished()) this.startPostRaceReplay();
    });
    this.challengeQualify.onShare(() => {
      navigator.clipboard.writeText(this.resultsPresenter.buildShareText(this)).then(() => {
        this.challengeQualify.flashShareDone();
      });
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
      if (this.cam.isShowcaseActive()) this.cam.startShowcase();
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
    if (this.postRaceReplayActive) return;
    this.hud.setCameraLabel(this._displayCameraName(this.cam.cycleMode(this.player)));
    this.sceneDirty = true;
  }

  // ---------------------------------------------------------------------------
  // Private — gameLoop
  // ---------------------------------------------------------------------------

  _nextFrameDelta(time) {
    const raw = this.lastTime ? (time - this.lastTime) / 1000 : 0.016;
    const dt = Number.isFinite(raw) ? Math.max(0, Math.min(raw, 0.05)) : 0.016;
    this.lastTime = time;
    return dt;
  }

  _runFrameUpdates(dt) {
    this._tickSettingsPreviewDrive(dt);
    this._syncCameraToFrame(dt);
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
        this.cam.updateShowcase(dt, this.player, this.previewRunning);
      } else {
        this.cam.update(this.player, dt);
      }
      this.sceneDirty = true;
      return;
    }

    if (this.cam.isShowcaseActive()) {
      const runningShots = this.previewRunning || this.postRaceReplayActive;
      this.cam.updateShowcase(dt, this.player, runningShots);
      this.sceneDirty = true;
      return;
    }
    this.cam.update(this.player, dt);
  }

  _presentIfDirty() {
    if (!this.sceneDirty) return false;
    if (this.sceneRenderer) {
      this.sceneRenderer.update(this.player, this.carSettings.underglowOpacity, this.cam.getModeIndex());
    }
    this.renderer.render(this.scene, this.cam.active);
    this.sceneDirty = false;
    return true;
  }

  _initDevTools() {
    this._devToolsVisible = false;
    this._devToolsEl = document.getElementById('dev-tools');
    this._perfEls = this._devToolsEl
      ? {
          fps: document.getElementById('perf-fps'),
          ms: document.getElementById('perf-ms'),
          cpu: document.getElementById('perf-cpu'),
          gpu: document.getElementById('perf-gpu')
        }
      : null;
    if (!this._perfEls || !this._perfEls.fps) return;
    this._perfFpsEma = 60;
    this._perfMsEma = 16.7;
    this._perfCpuEma = 0;
    this._perfLastCalls = 0;
    this._perfLastTris = 0;
    try {
      const persisted =
        localStorage.getItem('carreritas_dev_tools') ?? localStorage.getItem('carreritas_perf_meter');
      if (persisted === '1') {
        this._setDevToolsVisible(true);
      }
    } catch (_e) {
      /* ignore */
    }
  }

  _setDevToolsVisible(visible) {
    this._devToolsVisible = visible;
    if (!this._devToolsEl) return;
    this._devToolsEl.classList.toggle('dev-tools--hidden', !visible);
    this._devToolsEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
    try {
      localStorage.setItem('carreritas_dev_tools', visible ? '1' : '0');
    } catch (_e) {
      /* ignore */
    }
  }

  _toggleDevTools() {
    this._setDevToolsVisible(!this._devToolsVisible);
  }

  _tickDevTools(dt, rendered, cpuWorkMs) {
    if (!this._perfEls || !this._perfEls.fps) return;
    const a = 0.08;
    this._perfFpsEma = this._perfFpsEma * (1 - a) + (1 / Math.max(dt, 1e-6)) * a;
    this._perfMsEma = this._perfMsEma * (1 - a) + dt * 1000 * a;
    this._perfCpuEma = this._perfCpuEma * (1 - a) + cpuWorkMs * a;
    if (rendered && this.renderer) {
      const r = this.renderer.info.render;
      this._perfLastCalls = r.calls;
      this._perfLastTris = r.triangles;
    }
    if (!this._devToolsVisible) return;
    this._perfEls.fps.textContent = this._perfFpsEma.toFixed(0);
    this._perfEls.ms.textContent = this._perfMsEma.toFixed(1);
    this._perfEls.cpu.textContent = this._perfCpuEma.toFixed(1);
    const tris = this._perfLastTris;
    const trisStr = tris >= 1000 ? (tris / 1000).toFixed(1) + 'k' : String(tris);
    this._perfEls.gpu.textContent = `${this._perfLastCalls} · ${trisStr}`;
  }

}
