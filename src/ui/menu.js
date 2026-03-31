import { ChallengeMode } from '../challenge-modes/index.js';
import { FwdDirection, RevDirection } from '../directions/index.js';
import { DayMode, NightMode } from '../modes/index.js';
import { isMobile } from '../utils/index.js';
import { strings } from '../strings.js';

export default class Menu {
  constructor(generateTrackSVG) {
    this._generateTrackSVG = generateTrackSVG;
    this._overlay = document.querySelector('.menu-overlay');
    this._trackCodeInput = document.querySelector('.menu-overlay__track-input');
    this._randomBtn = document.querySelector('.menu-overlay__random-btn');
    this._menuTabToggle = document.querySelector('.menu-overlay__tab-toggle');
    this._eventTab = document.querySelector('.menu-overlay__event-tab');
    this._challengesTab = document.querySelector('.menu-overlay__challenges-tab');
    this._challengeModeToggle = document.querySelector('.menu-overlay__challenge-mode-toggle');
    this._challengePreviewEl = document.querySelector('.menu-overlay__challenge-preview');
    this._lapsWrapEl = document.querySelector('.menu-overlay__laps-wrap');
    this._lapsLabel = this._lapsWrapEl?.querySelector('.menu-overlay__laps-label') ?? null;
    this._lapsMinusBtn = this._lapsWrapEl?.querySelector('.menu-overlay__laps-minus') ?? null;
    this._lapsPlusBtn = this._lapsWrapEl?.querySelector('.menu-overlay__laps-plus') ?? null;
    this._dirToggleBtn = document.querySelector('.menu-overlay__dir-toggle');
    this._dirValueEl = document.querySelector('.menu-overlay__dir-value');
    this._modeToggleBtn = document.querySelector('.menu-overlay__mode-toggle');
    this._modeValueEl = document.querySelector('.menu-overlay__mode-value');
    this._raceTypeBtn = document.querySelector('.menu-overlay__race-type-toggle');
    this._raceTypeValue = document.querySelector('.menu-overlay__race-type-value');
    this._singleConfigEl = document.querySelector('.menu-overlay__single-config');
    this._seriesConfigEl = document.querySelector('.menu-overlay__series-config');
    this._seriesRowEl = document.querySelector('.menu-overlay__series-row');
    this._seriesStagesWrap = document.querySelector('.menu-overlay__series-stages-wrap');
    this._stagesMinusBtn = this._seriesStagesWrap?.querySelector('.menu-overlay__stages-minus') ?? null;
    this._stagesPlusBtn = this._seriesStagesWrap?.querySelector('.menu-overlay__stages-plus') ?? null;
    this._rngAllBtn = document.querySelector('.menu-overlay__rng-all-btn');
    this._stageListEl = document.querySelector('.menu-overlay__stage-list');
    this._touchControlsEl = document.querySelector('.touch-ui');
    this._mobile = isMobile();
    this._challengeCountdownInterval = null;
    this._seriesCarouselInterval = null;
  }

  stopSeriesCarousel() {
    if (this._seriesCarouselInterval) {
      clearInterval(this._seriesCarouselInterval);
      this._seriesCarouselInterval = null;
    }
  }

  /** @param {HTMLElement} slidesEl */
  _startSeriesCarousel(slidesEl, total) {
    this.stopSeriesCarousel();
    if (total < 1 || typeof window === 'undefined') return;
    const slides = slidesEl.querySelectorAll('.challenge-preview-stage--slide');
    if (slides.length !== total) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (total < 2) return;
    let idx = 0;
    const tick = () => {
      slides[idx].classList.remove('is-active');
      idx = (idx + 1) % total;
      slides[idx].classList.add('is-active');
    };
    this._seriesCarouselInterval = setInterval(tick, 3500);
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

  /** Always read/write the value inside `.menu-overlay__laps-wrap` (moves between single vs series row). */
  setLaps(n) {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v)) return;
    const el = this._lapsWrapEl?.querySelector('.menu-overlay__laps-value');
    if (!el) return;
    el.textContent = String(Math.max(1, Math.min(20, v)));
  }

  getLaps() {
    const el = this._lapsWrapEl?.querySelector('.menu-overlay__laps-value');
    if (!el) return NaN;
    const n = parseInt(String(el.textContent ?? '').trim(), 10);
    return Number.isFinite(n) ? n : NaN;
  }
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
    if (series) {
      this._seriesRowEl.insertBefore(this._lapsWrapEl, this._rngAllBtn);
    } else {
      this._singleConfigEl.appendChild(this._lapsWrapEl);
    }
  }

  getSeriesMode() { return this._raceTypeBtn.querySelector('.selected').dataset.val === 'SERIES'; }

  /** Always read/write the value inside `.menu-overlay__series-stages-wrap` (same pattern as laps). */
  setStageCount(n) {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v)) return;
    const el = this._seriesStagesWrap?.querySelector('.menu-overlay__stages-value');
    if (!el) return;
    el.textContent = String(Math.max(2, Math.min(6, v)));
  }

  getStageCount() {
    const el = this._seriesStagesWrap?.querySelector('.menu-overlay__stages-value');
    if (!el) return NaN;
    const n = parseInt(String(el.textContent ?? '').trim(), 10);
    return Number.isFinite(n) ? n : NaN;
  }

  getSelectedChallengeMode() {
    return this._challengeModeToggle.querySelector('.selected').dataset.val;
  }

  showTab(name) {
    this._selectToggle(this._menuTabToggle, name);
    if (name === 'event') {
      this._eventTab.style.display = 'flex';
      this._challengesTab.style.display = 'none';
      if (this._raceTypeBtn) this._raceTypeBtn.style.display = 'flex';
      if (this._challengeModeToggle) this._challengeModeToggle.style.display = 'none';
    } else {
      this._eventTab.style.display = 'none';
      this._challengesTab.style.display = 'flex';
      if (this._raceTypeBtn) this._raceTypeBtn.style.display = 'none';
      if (this._challengeModeToggle) this._challengeModeToggle.style.display = 'grid';
    }
    const ep = document.querySelector('.menu-overlay__start-prompt--event');
    const cp = document.querySelector('.menu-overlay__start-prompt--challenge');
    if (ep && cp) {
      if (name === 'event') {
        ep.style.display = '';
        cp.style.display = 'none';
      } else {
        ep.style.display = 'none';
        cp.style.display = '';
      }
    }
  }

  stopChallengeCountdown() {
    if (this._challengeCountdownInterval) {
      clearInterval(this._challengeCountdownInterval);
      this._challengeCountdownInterval = null;
    }
  }

  renderChallengePreview(info, challengeResetMs, formatCountdown, onRefresh) {
    const lbBtn = document.querySelector('.menu-overlay__leaderboard-btn');
    if (lbBtn) lbBtn.remove();

    this._challengePreviewEl.innerHTML = '';
    this.stopChallengeCountdown();
    this.stopSeriesCarousel();

    const tracksDiv = document.createElement('div');
    tracksDiv.className = 'challenge-preview-tracks';

    const menuCol = document.createElement('div');
    menuCol.className = 'challenge-preview-menu-col';

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
      menuCol.appendChild(summary);
    } else {
      tracksDiv.classList.add('challenge-preview-tracks--series');
      const slidesEl = document.createElement('div');
      slidesEl.className = 'challenge-preview-series-slides';
      const n = info.config.stages.length;
      for (let i = 0; i < n; i++) {
        const s = info.config.stages[i];
        const stageEl = document.createElement('div');
        stageEl.className = 'challenge-preview-stage challenge-preview-stage--slide' + (i === 0 ? ' is-active' : '');
        stageEl.innerHTML = this._generateTrackSVG(s.code);
        const num = document.createElement('div');
        num.className = 'challenge-preview-stage-num';
        num.textContent = '#' + (i + 1);
        const inf = document.createElement('div');
        inf.className = 'challenge-preview-stage-info';
        const L = strings.labels;
        inf.textContent = (s.direction ? (s.direction.isRev() ? L.rev : L.fwd) : (s.reversed ? L.rev : L.fwd)) + ' \u00B7 ' +
          (s.mode ? (s.mode.isNight() ? L.night : L.day) : (s.nightMode ? L.night : L.day));
        const meta = document.createElement('div');
        meta.className = 'challenge-preview-stage-meta';
        meta.appendChild(num);
        meta.appendChild(inf);
        stageEl.appendChild(meta);
        slidesEl.appendChild(stageEl);
      }
      tracksDiv.appendChild(slidesEl);
      this._challengePreviewEl.appendChild(tracksDiv);
      this._startSeriesCarousel(slidesEl, n);

      const seriesSummary = document.createElement('div');
      seriesSummary.className = 'challenge-preview-summary';
      const m = strings.menu;
      seriesSummary.textContent = m.stagesSummary(
        info.config.stageCount,
        info.config.laps,
        info.config.laps === 1 ? m.lapWordLower : m.lapsWordLower
      );
      menuCol.appendChild(seriesSummary);
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
    menuCol.appendChild(countdown);
    if (lbBtn) menuCol.appendChild(lbBtn);
    this._challengePreviewEl.appendChild(menuCol);
  }

  buildStageList(stageCount, stageConfigs, parseDescriptor, randomCode, onChallengeReset, onStageChange, initialStageIndex = 0) {
    this._stageListEl.innerHTML = '';
    const scroll = this._stageListEl.parentElement;
    const oldNav = scroll && scroll.querySelector('.menu-overlay__stage-carousel-nav');
    if (oldNav) oldNav.remove();

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
            const dirSeg = stageBlock.querySelectorAll('.seg--sm')[0];
            dirSeg.querySelector('.selected').classList.remove('selected');
            dirSeg.querySelector('[data-val="' + (parsed.direction.isRev() ? 'REV' : 'FWD') + '"]').classList.add('selected');
          }
          if (parsed.mode) {
            stageConfigs[idx].mode = parsed.mode;
            const modeSeg = stageBlock.querySelectorAll('.seg--sm')[1];
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
      dirSeg.className = 'seg seg--sm';
      const L = strings.labels;
      const dirFwd = document.createElement('button');
      dirFwd.type = 'button';
      const isRev = stageConfigs[i].direction ? stageConfigs[i].direction.isRev() : (stageConfigs[i].reversed || false);
      dirFwd.className = 'seg__option' + (isRev ? '' : ' selected');
      dirFwd.dataset.val = 'FWD';
      dirFwd.textContent = L.fwd;
      const dirRev = document.createElement('button');
      dirRev.type = 'button';
      dirRev.className = 'seg__option' + (isRev ? ' selected' : '');
      dirRev.dataset.val = 'REV';
      dirRev.textContent = L.rev;
      dirSeg.appendChild(dirFwd);
      dirSeg.appendChild(dirRev);
      (function (idx, seg) {
        seg.addEventListener('click', function (e) {
          const btn = e.target?.closest('.seg__option');
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
      modeSeg.className = 'seg seg--sm';
      const isNight = stageConfigs[i].mode ? stageConfigs[i].mode.isNight() : (stageConfigs[i].nightMode || false);
      const modeDay = document.createElement('button');
      modeDay.type = 'button';
      modeDay.className = 'seg__option' + (isNight ? '' : ' selected');
      modeDay.dataset.val = 'DAY';
      modeDay.textContent = L.day;
      const modeNight = document.createElement('button');
      modeNight.type = 'button';
      modeNight.className = 'seg__option' + (isNight ? ' selected' : '');
      modeNight.dataset.val = 'NIGHT';
      modeNight.textContent = L.night;
      modeSeg.appendChild(modeDay);
      modeSeg.appendChild(modeNight);
      (function (idx, seg) {
        seg.addEventListener('click', function (e) {
          const btn = e.target?.closest('.seg__option');
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

    this._setupStageCarousel(stageCount, onStageChange, initialStageIndex);
  }

  _setupStageCarousel(stageCount, onStageChange, initialStageIndex) {
    const blocks = () => [...this._stageListEl.querySelectorAll('.stage-block')];
    if (blocks().length !== stageCount) return;

    if (stageCount <= 1) {
      blocks().forEach((el) => {
        el.classList.remove('stage-block--carousel', 'stage-block--active');
      });
      return;
    }

    const scroll = this._stageListEl.parentElement;
    if (!scroll) return;

    let cur = Math.min(Math.max(0, initialStageIndex | 0), stageCount - 1);

    const nav = document.createElement('div');
    nav.className = 'menu-overlay__stage-carousel-nav';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'menu-overlay__stage-carousel-btn menu-overlay__stage-carousel-prev';
    prev.setAttribute('aria-label', 'Previous stage');
    prev.textContent = '\u2039';

    const indexEl = document.createElement('span');
    indexEl.className = 'menu-overlay__stage-carousel-index';
    indexEl.setAttribute('role', 'status');
    indexEl.setAttribute('aria-live', 'polite');

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'menu-overlay__stage-carousel-btn menu-overlay__stage-carousel-next';
    next.setAttribute('aria-label', 'Next stage');
    next.textContent = '\u203A';

    nav.appendChild(prev);
    nav.appendChild(indexEl);
    nav.appendChild(next);
    scroll.insertBefore(nav, this._stageListEl);

    const apply = () => {
      blocks().forEach((el, i) => {
        el.classList.add('stage-block--carousel');
        el.classList.toggle('stage-block--active', i === cur);
      });
      indexEl.textContent = (cur + 1) + ' / ' + stageCount;
      prev.disabled = cur === 0;
      next.disabled = cur === stageCount - 1;
    };

    prev.addEventListener('click', () => {
      if (cur <= 0) return;
      cur--;
      apply();
      if (typeof onStageChange === 'function') onStageChange(cur);
    });
    next.addEventListener('click', () => {
      if (cur >= stageCount - 1) return;
      cur++;
      apply();
      if (typeof onStageChange === 'function') onStageChange(cur);
    });

    apply();
    if (typeof onStageChange === 'function') onStageChange(cur);
  }

  onTrackCodeInput(handler) {
    this._trackCodeInput.addEventListener('input', handler);
  }

  onRandomize(handler) {
    this._randomBtn.addEventListener('click', handler);
  }

  onLapsMinus(handler) {
    if (this._lapsMinusBtn) this._lapsMinusBtn.addEventListener('click', handler);
  }

  onLapsPlus(handler) {
    if (this._lapsPlusBtn) this._lapsPlusBtn.addEventListener('click', handler);
  }

  onDirectionToggle(handler) {
    this._dirToggleBtn.addEventListener('click', (e) => {
      const btn = e.target?.closest('.seg__option');
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
      const btn = e.target?.closest('.seg__option');
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
      const btn = e.target?.closest('.seg__option');
      if (!btn || btn.classList.contains('selected')) return;
      const series = btn.dataset.val === 'SERIES';
      this.setSeriesMode(series);
      handler(series);
    });
  }

  onTabToggle(handler) {
    this._menuTabToggle.addEventListener('click', (e) => {
      const btn = e.target?.closest('.seg__option');
      if (!btn || btn.classList.contains('selected')) return;
      const tab = btn.dataset.val;
      this.showTab(tab);
      handler(tab);
    });
  }

  onChallengeToggle(handler) {
    this._challengeModeToggle.addEventListener('click', (e) => {
      const btn = e.target?.closest('.seg__option');
      if (!btn || btn.classList.contains('selected')) return;
      this._challengeModeToggle.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      handler();
    });
  }

  onStagesMinus(handler) {
    if (this._stagesMinusBtn) this._stagesMinusBtn.addEventListener('click', handler);
  }

  onStagesPlus(handler) {
    if (this._stagesPlusBtn) this._stagesPlusBtn.addEventListener('click', handler);
  }
  onRngAll(handler) { this._rngAllBtn.addEventListener('click', handler); }

  onEventStart(handler) {
    const el = document.querySelector('.menu-overlay__start-prompt--event');
    if (el) el.addEventListener('click', handler);
  }

  onChallengeStart(handler) {
    const el = document.querySelector('.menu-overlay__start-prompt--challenge');
    if (el) el.addEventListener('click', handler);
  }
}
