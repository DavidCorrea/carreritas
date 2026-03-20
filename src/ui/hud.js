import { formatTime } from '../utils/index.js';
import { strings } from '../strings.js';

export default class Hud {
  constructor() {
    this._hudEl = document.getElementById('hud');
    this._lapDisplay = document.getElementById('lap-display');
    this._lapTimesList = document.getElementById('lap-times-list');
    this._bestDisplay = document.getElementById('best-display');
    this._timeDisplay = document.getElementById('time-display');
    this._speedDisplay = document.getElementById('speed-display');
    this._stageDisplayEl = document.getElementById('stage-display');
    this._countdownEl = document.getElementById('countdown');
    this._semLights = this._countdownEl.querySelectorAll('.sem-light');
    this._cameraDisplayEl = document.getElementById('camera-display');

    this._lap = -1;
    this._best = -1;
    this._stage = -1;
    this._series = -1;
    this._time = '';
    this._speed = -1;
  }

  show() { this._hudEl.style.display = 'block'; }
  hide() { this._hudEl.style.display = 'none'; }

  update(state) {
    const displayLap = Math.min(state.lap + 1, state.totalLaps);
    if (displayLap !== this._lap) {
      this._lap = displayLap;
      this._lapDisplay.textContent = strings.hud.lap(displayLap, state.totalLaps);
    }
    if (state.bestTime !== this._best) {
      this._best = state.bestTime;
      this._bestDisplay.textContent = strings.hud.best(state.bestTime ? formatTime(state.bestTime) : strings.hud.bestEmpty);
    }
    const timeStr = formatTime(state.raceTimer);
    if (timeStr !== this._time) {
      this._time = timeStr;
      this._timeDisplay.textContent = timeStr;
    }
    const speedVal = Math.round(state.speed * 1.2);
    if (speedVal !== this._speed) {
      this._speed = speedVal;
      this._speedDisplay.textContent = strings.hud.speed(speedVal);
    }
    const stageKey = state.seriesMode ? state.currentStageIndex : -1;
    if (stageKey !== this._stage || (state.seriesMode ? 1 : 0) !== this._series) {
      this._stage = stageKey;
      this._series = state.seriesMode ? 1 : 0;
      if (state.seriesMode) {
        this._stageDisplayEl.style.display = 'block';
        this._stageDisplayEl.textContent = strings.hud.stage(state.currentStageIndex + 1, state.stageCount);
        this._lapDisplay.style.top = '62px';
        this._lapTimesList.style.top = '104px';
      } else {
        this._stageDisplayEl.style.display = 'none';
        this._lapDisplay.style.top = '20px';
        this._lapTimesList.style.top = '62px';
      }
    }
  }

  addLapTime(lapNum, lapTime, prevLapTime) {
    const div = document.createElement('div');
    div.className = 'hud-box';
    if (lapNum > 1) div.style.marginTop = '4px';
    let text = strings.results.lapRow(lapNum, formatTime(lapTime));
    if (lapNum > 1 && prevLapTime != null) {
      const delta = lapTime - prevLapTime;
      const sign = delta >= 0 ? '+' : '-';
      text += '  ' + sign + formatTime(Math.abs(delta));
      div.style.color = delta <= 0 ? '#4ecdc4' : '#e84d4d';
    }
    div.textContent = text;
    this._lapTimesList.appendChild(div);
  }

  clearLapTimes() { this._lapTimesList.innerHTML = ''; }

  resetCache() {
    this._lap = -1;
    this._best = -1;
    this._stage = -1;
    this._series = -1;
    this._time = '';
    this._speed = -1;
  }

  showCountdown() { this._countdownEl.style.display = 'flex'; }
  hideCountdown() { this._countdownEl.style.display = 'none'; }

  resetLights() {
    for (let i = 0; i < this._semLights.length; i++) {
      this._semLights[i].className = 'sem-light';
    }
  }

  setRedLights(count) {
    for (let i = 0; i < this._semLights.length; i++) {
      if (i < count) this._semLights[i].className = 'sem-light red';
    }
  }

  setGreen() {
    for (let i = 0; i < this._semLights.length; i++) {
      if (this._semLights[i].classList.contains('red')) {
        this._semLights[i].className = 'sem-light green';
      }
    }
  }

  setCameraLabel(text) { this._cameraDisplayEl.textContent = text; }
}
