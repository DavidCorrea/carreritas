export function createMenu(generateTrackSVG) {
  var overlay = document.getElementById('overlay');
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
  var touchControlsEl = document.getElementById('touch-controls');
  var isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  var challengeCountdownInterval = null;

  function selectToggle(toggle, val) {
    var sel = toggle.querySelector('.selected');
    if (sel) sel.classList.remove('selected');
    toggle.querySelector('[data-val="' + val + '"]').classList.add('selected');
  }

  return {
    show: function () { overlay.classList.remove('hidden'); },
    hide: function () { overlay.classList.add('hidden'); },
    isOpen: function () { return !overlay.classList.contains('hidden'); },

    showTouchControls: function () { if (isMobile) touchControlsEl.classList.add('active'); },
    hideTouchControls: function () { if (isMobile) touchControlsEl.classList.remove('active'); },

    setTrackCode: function (code) { trackCodeInput.value = code; },
    getTrackCode: function () { return trackCodeInput.value; },
    isTrackCodeFocused: function () { return document.activeElement === trackCodeInput; },

    setLaps: function (n) { lapsValueEl.textContent = n; },
    getLaps: function () { return parseInt(lapsValueEl.textContent, 10); },
    setLapsLabel: function (text) { lapsLabel.textContent = text; },

    setDirection: function (reversed) { selectToggle(dirToggleBtn, reversed ? 'REV' : 'FWD'); },
    getDirection: function () { return dirToggleBtn.querySelector('.selected').dataset.val === 'REV'; },

    setNightMode: function (night) { selectToggle(modeToggleBtn, night ? 'NIGHT' : 'DAY'); },
    getNightMode: function () { return modeToggleBtn.querySelector('.selected').dataset.val === 'NIGHT'; },

    setSeriesMode: function (series) {
      selectToggle(raceTypeBtn, series ? 'SERIES' : 'SINGLE');
      raceTypeValue.textContent = series ? 'SERIES' : 'SINGLE';
      singleConfigEl.style.display = series ? 'none' : '';
      seriesConfigEl.style.display = series ? '' : 'none';
      lapsLabel.textContent = series ? 'LAPS PER STAGE' : 'LAPS';
    },
    getSeriesMode: function () { return raceTypeBtn.querySelector('.selected').dataset.val === 'SERIES'; },

    setStageCount: function (n) { stagesValueEl.textContent = n; },

    getSelectedChallengeMode: function () {
      return challengeModeToggle.querySelector('.selected').dataset.val;
    },

    showTab: function (name) {
      selectToggle(menuTabToggle, name);
      if (name === 'event') {
        eventTab.style.display = '';
        challengesTab.style.display = 'none';
      } else {
        eventTab.style.display = 'none';
        challengesTab.style.display = '';
      }
    },

    stopChallengeCountdown: function () {
      if (challengeCountdownInterval) {
        clearInterval(challengeCountdownInterval);
        challengeCountdownInterval = null;
      }
    },

    renderChallengePreview: function (info, challengeResetMs, formatCountdown, onRefresh) {
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
      var mode = challengeModeToggle.querySelector('.selected').dataset.val;
      function updateCountdown() {
        var remaining = challengeResetMs(mode);
        if (remaining <= 0) {
          onRefresh();
          return;
        }
        countdown.textContent = 'Changes in ' + formatCountdown(remaining);
      }
      updateCountdown();
      challengeCountdownInterval = setInterval(updateCountdown, 1000);
      challengePreviewEl.appendChild(countdown);
    },

    buildStageList: function (stageCount, stageConfigs, parseDescriptor, randomCode, onChallengeReset) {
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
            onChallengeReset();
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
            onChallengeReset();
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
            onChallengeReset();
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
            onChallengeReset();
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
    },

    onTrackCodeInput: function (handler) {
      trackCodeInput.addEventListener('input', handler);
    },

    onRandomize: function (handler) {
      randomBtn.addEventListener('click', handler);
    },

    onLapsMinus: function (handler) { lapsMinusBtn.addEventListener('click', handler); },
    onLapsPlus: function (handler) { lapsPlusBtn.addEventListener('click', handler); },

    onDirectionToggle: function (handler) {
      dirToggleBtn.addEventListener('click', function (e) {
        var btn = e.target.closest('.seg-option');
        if (!btn || btn.classList.contains('selected')) return;
        dirToggleBtn.querySelector('.selected').classList.remove('selected');
        btn.classList.add('selected');
        var reversed = btn.dataset.val === 'REV';
        dirValueEl.textContent = reversed ? 'REV' : 'FWD';
        handler(reversed);
      });
    },

    onModeToggle: function (handler) {
      modeToggleBtn.addEventListener('click', function (e) {
        var btn = e.target.closest('.seg-option');
        if (!btn || btn.classList.contains('selected')) return;
        modeToggleBtn.querySelector('.selected').classList.remove('selected');
        btn.classList.add('selected');
        var night = btn.dataset.val === 'NIGHT';
        modeValueEl.textContent = night ? 'NIGHT' : 'DAY';
        handler(night);
      });
    },

    onRaceTypeToggle: function (handler) {
      raceTypeBtn.addEventListener('click', function (e) {
        var btn = e.target.closest('.seg-option');
        if (!btn || btn.classList.contains('selected')) return;
        raceTypeBtn.querySelector('.selected').classList.remove('selected');
        btn.classList.add('selected');
        var series = btn.dataset.val === 'SERIES';
        raceTypeValue.textContent = series ? 'SERIES' : 'SINGLE';
        singleConfigEl.style.display = series ? 'none' : '';
        seriesConfigEl.style.display = series ? '' : 'none';
        lapsLabel.textContent = series ? 'LAPS PER STAGE' : 'LAPS';
        handler(series);
      });
    },

    onTabToggle: function (handler) {
      menuTabToggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.seg-option');
        if (!btn || btn.classList.contains('selected')) return;
        menuTabToggle.querySelector('.selected').classList.remove('selected');
        btn.classList.add('selected');
        var tab = btn.dataset.val;
        if (tab === 'event') {
          eventTab.style.display = '';
          challengesTab.style.display = 'none';
        } else {
          eventTab.style.display = 'none';
          challengesTab.style.display = '';
        }
        handler(tab);
      });
    },

    onChallengeToggle: function (handler) {
      challengeModeToggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.seg-option');
        if (!btn || btn.classList.contains('selected')) return;
        challengeModeToggle.querySelector('.selected').classList.remove('selected');
        btn.classList.add('selected');
        handler();
      });
    },

    onStagesMinus: function (handler) { stagesMinusBtn.addEventListener('click', handler); },
    onStagesPlus: function (handler) { stagesPlusBtn.addEventListener('click', handler); },
    onRngAll: function (handler) { rngAllBtn.addEventListener('click', handler); },

    onEventStart: function (handler) {
      var el = document.getElementById('event-start-prompt');
      if (el) el.addEventListener('click', handler);
    },
    onChallengeStart: function (handler) {
      var el = document.getElementById('challenge-start-prompt');
      if (el) el.addEventListener('click', handler);
    }
  };
}
