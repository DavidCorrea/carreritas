import { ChallengeMode } from '../challenge-modes/index.js';
import { FwdDirection, RevDirection } from '../directions/index.js';
import { DayMode, NightMode } from '../modes/index.js';
import { isMobile } from '../utils/index.js';
import { strings } from '../strings.js';

export default class Menu {
  constructor(generateTrackSVG) {
    this._generateTrackSVG = generateTrackSVG;
    this._overlay = document.getElementById('overlay');
    this._trackCodeInput = document.getElementById('track-code-input');
    this._randomBtn = document.getElementById('random-btn');
    this._menuTabToggle = document.getElementById('menu-tab-toggle');
    this._eventTab = document.getElementById('event-tab');
    this._challengesTab = document.getElementById('challenges-tab');
    this._challengeModeToggle = document.getElementById('challenge-mode-toggle');
    this._challengePreviewEl = document.getElementById('challenge-preview');
    this._lapsValueEl = document.getElementById('laps-value');
    this._lapsLabel = document.getElementById('laps-label');
    this._lapsMinusBtn = document.getElementById('laps-minus');
    this._lapsPlusBtn = document.getElementById('laps-plus');
    this._dirToggleBtn = document.getElementById('dir-toggle');
    this._dirValueEl = document.getElementById('dir-value');
    this._modeToggleBtn = document.getElementById('mode-toggle');
    this._modeValueEl = document.getElementById('mode-value');
    this._raceTypeBtn = document.getElementById('race-type-toggle');
    this._raceTypeValue = document.getElementById('race-type-value');
    this._singleConfigEl = document.getElementById('single-config');
    this._seriesConfigEl = document.getElementById('series-config');
    this._stagesValueEl = document.getElementById('stages-value');
    this._stagesMinusBtn = document.getElementById('stages-minus');
    this._stagesPlusBtn = document.getElementById('stages-plus');
    this._rngAllBtn = document.getElementById('rng-all-btn');
    this._stageListEl = document.getElementById('stage-list');
    this._touchControlsEl = document.getElementById('touch-controls');
    this._mobile = isMobile();
    this._challengeCountdownInterval = null;
  }

  _selectToggle(toggle, val) {
    const sel = toggle.querySelector('.selected');
    if (sel) sel.classList.remove('selected');
    toggle.querySelector('[data-val="' + val + '"]').classList.add('selected');
  }

  show() { this._overlay.classList.remove('hidden'); }
  hide() { this._overlay.classList.add('hidden'); }
  isOpen() { return !this._overlay.classList.contains('hidden'); }

  showTouchControls() { if (this._mobile) this._touchControlsEl.classList.add('active'); }
  hideTouchControls() { if (this._mobile) this._touchControlsEl.classList.remove('active'); }

  setTrackCode(code) { this._trackCodeInput.value = code; }
  getTrackCode() { return this._trackCodeInput.value; }
  isTrackCodeFocused() { return document.activeElement === this._trackCodeInput; }

  setLaps(n) { this._lapsValueEl.textContent = n; }
  getLaps() { return parseInt(this._lapsValueEl.textContent, 10); }
  setLapsLabel(text) { this._lapsLabel.textContent = text; }

  setDirection(direction) {
    const isRev = direction.isRev();
    this._selectToggle(this._dirToggleBtn, isRev ? 'REV' : 'FWD');
  }

  getDirection() {
    const isRev = this._dirToggleBtn.querySelector('.selected').dataset.val === 'REV';
    return isRev ? new RevDirection() : new FwdDirection();
  }

  setMode(mode) {
    const isNight = mode.isNight();
    this._selectToggle(this._modeToggleBtn, isNight ? 'NIGHT' : 'DAY');
  }

  getMode() {
    const isNight = this._modeToggleBtn.querySelector('.selected').dataset.val === 'NIGHT';
    return isNight ? new NightMode() : new DayMode();
  }

  setNightMode(night) {
    const mode = typeof night === 'boolean' ? (night ? new NightMode() : new DayMode()) : night;
    this.setMode(mode);
  }

  getNightMode() { return this.getMode(); }

  setSeriesMode(series) {
    const L = strings.labels;
    const o = strings.document.overlay;
    this._selectToggle(this._raceTypeBtn, series ? 'SERIES' : 'SINGLE');
    this._raceTypeValue.textContent = series ? L.series : L.single;
    this._singleConfigEl.style.display = series ? 'none' : '';
    this._seriesConfigEl.style.display = series ? '' : 'none';
    this._lapsLabel.textContent = series ? o.lapsPerStage : o.laps;
  }

  getSeriesMode() { return this._raceTypeBtn.querySelector('.selected').dataset.val === 'SERIES'; }

  setStageCount(n) { this._stagesValueEl.textContent = n; }

  getSelectedChallengeMode() {
    return this._challengeModeToggle.querySelector('.selected').dataset.val;
  }

  showTab(name) {
    this._selectToggle(this._menuTabToggle, name);
    if (name === 'event') {
      this._eventTab.style.display = '';
      this._challengesTab.style.display = 'none';
    } else {
      this._eventTab.style.display = 'none';
      this._challengesTab.style.display = '';
    }
  }

  stopChallengeCountdown() {
    if (this._challengeCountdownInterval) {
      clearInterval(this._challengeCountdownInterval);
      this._challengeCountdownInterval = null;
    }
  }

  renderChallengePreview(info, challengeResetMs, formatCountdown, onRefresh) {
    this._challengePreviewEl.innerHTML = '';
    this.stopChallengeCountdown();

    const tracksDiv = document.createElement('div');
    tracksDiv.className = 'challenge-preview-tracks';

    if (info.type === 'race') {
      const stage = document.createElement('div');
      stage.className = 'challenge-preview-stage';
      stage.innerHTML = this._generateTrackSVG(info.config.code);
      const desc = document.createElement('div');
      desc.className = 'challenge-preview-stage-info';
      const L = strings.labels;
      desc.textContent = (info.config.direction ? (info.config.direction.isRev() ? L.rev : L.fwd) : (info.config.reversed ? L.rev : L.fwd)) + ' \u00B7 ' +
        (info.config.mode ? (info.config.mode.isNight() ? L.night : L.day) : (info.config.nightMode ? L.night : L.day));
      stage.appendChild(desc);
      tracksDiv.appendChild(stage);
      this._challengePreviewEl.appendChild(tracksDiv);

      const summary = document.createElement('div');
      summary.className = 'challenge-preview-summary';
      const m = strings.menu;
      summary.textContent = info.config.laps + (info.config.laps === 1 ? ' ' + m.lapWord : ' ' + m.lapsWord);
      this._challengePreviewEl.appendChild(summary);
    } else {
      for (let i = 0; i < info.config.stages.length; i++) {
        const s = info.config.stages[i];
        const stageEl = document.createElement('div');
        stageEl.className = 'challenge-preview-stage';
        stageEl.innerHTML = this._generateTrackSVG(s.code);
        const num = document.createElement('div');
        num.className = 'challenge-preview-stage-num';
        num.textContent = '#' + (i + 1);
        stageEl.appendChild(num);
        const inf = document.createElement('div');
        inf.className = 'challenge-preview-stage-info';
        const L = strings.labels;
        inf.textContent = (s.direction ? (s.direction.isRev() ? L.rev : L.fwd) : (s.reversed ? L.rev : L.fwd)) + ' \u00B7 ' +
          (s.mode ? (s.mode.isNight() ? L.night : L.day) : (s.nightMode ? L.night : L.day));
        stageEl.appendChild(inf);
        tracksDiv.appendChild(stageEl);
      }
      this._challengePreviewEl.appendChild(tracksDiv);

      const seriesSummary = document.createElement('div');
      seriesSummary.className = 'challenge-preview-summary';
      const m = strings.menu;
      seriesSummary.textContent = m.stagesSummary(
        info.config.stageCount,
        info.config.laps,
        info.config.laps === 1 ? m.lapWordLower : m.lapsWordLower
      );
      this._challengePreviewEl.appendChild(seriesSummary);
    }

    const countdown = document.createElement('div');
    countdown.className = 'challenge-preview-countdown';
    const modeSlug = this._challengeModeToggle.querySelector('.selected').dataset.val;
    const cm = ChallengeMode.fromString(modeSlug);
    const updateCountdown = () => {
      const remaining = challengeResetMs(cm);
      if (remaining <= 0) {
        onRefresh();
        return;
      }
      countdown.textContent = strings.menu.challengeCountdown(formatCountdown(remaining));
    };
    updateCountdown();
    this._challengeCountdownInterval = setInterval(updateCountdown, 1000);
    this._challengePreviewEl.appendChild(countdown);
  }

  buildStageList(stageCount, stageConfigs, parseDescriptor, randomCode, onChallengeReset, onStageChange) {
    this._stageListEl.innerHTML = '';
    for (let i = 0; i < stageCount; i++) {
      const block = document.createElement('div');
      block.className = 'stage-block';

      const num = document.createElement('span');
      num.className = 'stage-num';
      num.textContent = '#' + (i + 1);
      block.appendChild(num);

      const content = document.createElement('div');
      content.className = 'stage-content';

      const topRow = document.createElement('div');
      topRow.className = 'stage-row';

      const input = document.createElement('input');
      input.className = 'stage-code';
      input.type = 'text';
      input.maxLength = 23;
      input.value = stageConfigs[i].code;
      input.spellcheck = false;
      input.autocomplete = 'off';
      (function (idx) {
        input.addEventListener('input', function (e) {
          onChallengeReset();
          const t = e.target;
          const parsed = parseDescriptor(t?.value ?? '');
          stageConfigs[idx].code = parsed.code;
          if (t) t.value = parsed.code;
          const stageBlock = t?.closest('.stage-block');
          if (!stageBlock) {
            if (typeof onStageChange === 'function') onStageChange(idx);
            return;
          }
          if (parsed.direction) {
            stageConfigs[idx].direction = parsed.direction;
            const dirSeg = stageBlock.querySelectorAll('.seg-control-sm')[0];
            dirSeg.querySelector('.selected').classList.remove('selected');
            dirSeg.querySelector('[data-val="' + (parsed.direction.isRev() ? 'REV' : 'FWD') + '"]').classList.add('selected');
          }
          if (parsed.mode) {
            stageConfigs[idx].mode = parsed.mode;
            const modeSeg = stageBlock.querySelectorAll('.seg-control-sm')[1];
            modeSeg.querySelector('.selected').classList.remove('selected');
            modeSeg.querySelector('[data-val="' + (parsed.mode.isNight() ? 'NIGHT' : 'DAY') + '"]').classList.add('selected');
          }
          if (typeof onStageChange === 'function') onStageChange(idx);
        });
      })(i);
      topRow.appendChild(input);

      const rngBtn = document.createElement('button');
      rngBtn.className = 'stage-btn';
      rngBtn.type = 'button';
      rngBtn.textContent = strings.document.overlay.randomBtn;
      (function (idx, inp) {
        rngBtn.addEventListener('click', function () {
          onChallengeReset();
          stageConfigs[idx].code = randomCode();
          inp.value = stageConfigs[idx].code;
          if (typeof onStageChange === 'function') onStageChange(idx);
        });
      })(i, input);
      topRow.appendChild(rngBtn);

      content.appendChild(topRow);

      const bottomRow = document.createElement('div');
      bottomRow.className = 'stage-options';

      const dirSeg = document.createElement('div');
      dirSeg.className = 'seg-control seg-control-sm';
      const L = strings.labels;
      const dirFwd = document.createElement('button');
      dirFwd.type = 'button';
      const isRev = stageConfigs[i].direction ? stageConfigs[i].direction.isRev() : (stageConfigs[i].reversed || false);
      dirFwd.className = 'seg-option' + (isRev ? '' : ' selected');
      dirFwd.dataset.val = 'FWD';
      dirFwd.textContent = L.fwd;
      const dirRev = document.createElement('button');
      dirRev.type = 'button';
      dirRev.className = 'seg-option' + (isRev ? ' selected' : '');
      dirRev.dataset.val = 'REV';
      dirRev.textContent = L.rev;
      dirSeg.appendChild(dirFwd);
      dirSeg.appendChild(dirRev);
      (function (idx, seg) {
        seg.addEventListener('click', function (e) {
          const btn = e.target?.closest('.seg-option');
          if (!btn || btn.classList.contains('selected')) return;
          onChallengeReset();
          seg.querySelector('.selected').classList.remove('selected');
          btn.classList.add('selected');
          stageConfigs[idx].direction = btn.dataset.val === 'REV' ? new RevDirection() : new FwdDirection();
          if (typeof onStageChange === 'function') onStageChange(idx);
        });
      })(i, dirSeg);
      bottomRow.appendChild(dirSeg);

      const modeSeg = document.createElement('div');
      modeSeg.className = 'seg-control seg-control-sm';
      const isNight = stageConfigs[i].mode ? stageConfigs[i].mode.isNight() : (stageConfigs[i].nightMode || false);
      const modeDay = document.createElement('button');
      modeDay.type = 'button';
      modeDay.className = 'seg-option' + (isNight ? '' : ' selected');
      modeDay.dataset.val = 'DAY';
      modeDay.textContent = L.day;
      const modeNight = document.createElement('button');
      modeNight.type = 'button';
      modeNight.className = 'seg-option' + (isNight ? ' selected' : '');
      modeNight.dataset.val = 'NIGHT';
      modeNight.textContent = L.night;
      modeSeg.appendChild(modeDay);
      modeSeg.appendChild(modeNight);
      (function (idx, seg) {
        seg.addEventListener('click', function (e) {
          const btn = e.target?.closest('.seg-option');
          if (!btn || btn.classList.contains('selected')) return;
          onChallengeReset();
          seg.querySelector('.selected').classList.remove('selected');
          btn.classList.add('selected');
          stageConfigs[idx].mode = btn.dataset.val === 'NIGHT' ? new NightMode() : new DayMode();
          if (typeof onStageChange === 'function') onStageChange(idx);
        });
      })(i, modeSeg);
      bottomRow.appendChild(modeSeg);

      content.appendChild(bottomRow);
      block.appendChild(content);
      this._stageListEl.appendChild(block);
    }
  }

  onTrackCodeInput(handler) {
    this._trackCodeInput.addEventListener('input', handler);
  }

  onRandomize(handler) {
    this._randomBtn.addEventListener('click', handler);
  }

  onLapsMinus(handler) { this._lapsMinusBtn.addEventListener('click', handler); }
  onLapsPlus(handler) { this._lapsPlusBtn.addEventListener('click', handler); }

  onDirectionToggle(handler) {
    this._dirToggleBtn.addEventListener('click', (e) => {
      const btn = e.target?.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      this._dirToggleBtn.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      const reversed = btn.dataset.val === 'REV';
      const L = strings.labels;
      this._dirValueEl.textContent = reversed ? L.rev : L.fwd;
      handler(reversed);
    });
  }

  onModeToggle(handler) {
    this._modeToggleBtn.addEventListener('click', (e) => {
      const btn = e.target?.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      this._modeToggleBtn.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      const night = btn.dataset.val === 'NIGHT';
      const L = strings.labels;
      this._modeValueEl.textContent = night ? L.night : L.day;
      handler(night);
    });
  }

  onRaceTypeToggle(handler) {
    this._raceTypeBtn.addEventListener('click', (e) => {
      const btn = e.target?.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      this._raceTypeBtn.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      const series = btn.dataset.val === 'SERIES';
      const L = strings.labels;
      const o = strings.document.overlay;
      this._raceTypeValue.textContent = series ? L.series : L.single;
      this._singleConfigEl.style.display = series ? 'none' : '';
      this._seriesConfigEl.style.display = series ? '' : 'none';
      this._lapsLabel.textContent = series ? o.lapsPerStage : o.laps;
      handler(series);
    });
  }

  onTabToggle(handler) {
    this._menuTabToggle.addEventListener('click', (e) => {
      const btn = e.target?.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      this._menuTabToggle.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      const tab = btn.dataset.val;
      if (tab === 'event') {
        this._eventTab.style.display = '';
        this._challengesTab.style.display = 'none';
      } else {
        this._eventTab.style.display = 'none';
        this._challengesTab.style.display = '';
      }
      handler(tab);
    });
  }

  onChallengeToggle(handler) {
    this._challengeModeToggle.addEventListener('click', (e) => {
      const btn = e.target?.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      this._challengeModeToggle.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      handler();
    });
  }

  onStagesMinus(handler) { this._stagesMinusBtn.addEventListener('click', handler); }
  onStagesPlus(handler) { this._stagesPlusBtn.addEventListener('click', handler); }
  onRngAll(handler) { this._rngAllBtn.addEventListener('click', handler); }

  onEventStart(handler) {
    const el = document.getElementById('event-start-prompt');
    if (el) el.addEventListener('click', handler);
  }

  onChallengeStart(handler) {
    const el = document.getElementById('challenge-start-prompt');
    if (el) el.addEventListener('click', handler);
  }
}
