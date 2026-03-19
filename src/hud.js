import { formatTime } from './utils.js';

export function createHUD() {
  var hudEl = document.getElementById('hud');
  var lapDisplay = document.getElementById('lap-display');
  var lapTimesList = document.getElementById('lap-times-list');
  var bestDisplay = document.getElementById('best-display');
  var timeDisplay = document.getElementById('time-display');
  var speedDisplay = document.getElementById('speed-display');
  var stageDisplayEl = document.getElementById('stage-display');
  var countdownEl = document.getElementById('countdown');
  var semLights = countdownEl.querySelectorAll('.sem-light');
  var cameraDisplayEl = document.getElementById('camera-display');

  var _lap = -1, _best = -1, _stage = -1, _series = -1, _time = '', _speed = -1;

  return {
    show: function () { hudEl.style.display = 'block'; },
    hide: function () { hudEl.style.display = 'none'; },

    update: function (state) {
      var displayLap = Math.min(state.lap + 1, state.totalLaps);
      if (displayLap !== _lap) {
        _lap = displayLap;
        lapDisplay.textContent = 'LAP ' + displayLap + ' / ' + state.totalLaps;
      }
      if (state.bestTime !== _best) {
        _best = state.bestTime;
        bestDisplay.textContent = 'BEST ' + (state.bestTime ? formatTime(state.bestTime) : '--:--.--');
      }
      var timeStr = formatTime(state.raceTimer);
      if (timeStr !== _time) {
        _time = timeStr;
        timeDisplay.textContent = timeStr;
      }
      var speedVal = Math.round(state.speed * 1.2);
      if (speedVal !== _speed) {
        _speed = speedVal;
        speedDisplay.textContent = speedVal + ' km/h';
      }
      var stageKey = state.seriesMode ? state.currentStageIndex : -1;
      if (stageKey !== _stage || (state.seriesMode ? 1 : 0) !== _series) {
        _stage = stageKey;
        _series = state.seriesMode ? 1 : 0;
        if (state.seriesMode) {
          stageDisplayEl.style.display = 'block';
          stageDisplayEl.textContent = 'STAGE ' + (state.currentStageIndex + 1) + ' / ' + state.stageCount;
          lapDisplay.style.top = '62px';
          lapTimesList.style.top = '104px';
        } else {
          stageDisplayEl.style.display = 'none';
          lapDisplay.style.top = '20px';
          lapTimesList.style.top = '62px';
        }
      }
    },

    addLapTime: function (lapNum, lapTime, prevLapTime) {
      var div = document.createElement('div');
      div.className = 'hud-box';
      if (lapNum > 1) div.style.marginTop = '4px';
      var text = 'L' + lapNum + '  ' + formatTime(lapTime);
      if (lapNum > 1 && prevLapTime != null) {
        var delta = lapTime - prevLapTime;
        var sign = delta >= 0 ? '+' : '-';
        text += '  ' + sign + formatTime(Math.abs(delta));
        div.style.color = delta <= 0 ? '#4ecdc4' : '#e84d4d';
      }
      div.textContent = text;
      lapTimesList.appendChild(div);
    },

    clearLapTimes: function () { lapTimesList.innerHTML = ''; },

    resetCache: function () {
      _lap = -1; _best = -1; _stage = -1; _series = -1; _time = ''; _speed = -1;
    },

    showCountdown: function () { countdownEl.style.display = 'flex'; },
    hideCountdown: function () { countdownEl.style.display = 'none'; },

    resetLights: function () {
      for (var i = 0; i < semLights.length; i++) {
        semLights[i].className = 'sem-light';
      }
    },

    setRedLights: function (count) {
      for (var i = 0; i < semLights.length; i++) {
        if (i < count) semLights[i].className = 'sem-light red';
      }
    },

    setGreen: function () {
      for (var i = 0; i < semLights.length; i++) {
        if (semLights[i].classList.contains('red')) {
          semLights[i].className = 'sem-light green';
        }
      }
    },

    setCameraLabel: function (text) { cameraDisplayEl.textContent = text; }
  };
}
