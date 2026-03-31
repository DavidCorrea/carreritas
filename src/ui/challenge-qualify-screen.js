import { strings } from '../strings.js';

/**
 * Shown after a challenge run that qualifies for the leaderboard (before RACE COMPLETE).
 */
export default class ChallengeQualifyScreen {
  constructor() {
    this._el = document.querySelector('.challenge-qualify');
    this._titleEl = document.querySelector('.challenge-qualify__title');
    this._sublineEl = document.querySelector('.challenge-qualify__subline');
    this._form = document.querySelector('.challenge-qualify__form');
    this._input = document.querySelector('.challenge-qualify__name');
    this._submitBtn = document.querySelector('.challenge-qualify__submit');
    this._replayBtn = document.querySelector('.challenge-qualify__replay');
    this._shareBtn = document.querySelector('.challenge-qualify__share');
    this._flowActive = false;
    this._hiddenForReplay = false;
  }

  isFlowActive() {
    return this._flowActive;
  }

  show(title, subline, defaultName) {
    this._flowActive = true;
    this._hiddenForReplay = false;
    this._titleEl.textContent = title;
    this._sublineEl.textContent = subline;
    this._input.value = defaultName || '';
    this._el.classList.remove('challenge-qualify--visible');
    this._el.style.display = 'flex';
    this._el.setAttribute('aria-hidden', 'false');
    this._submitBtn.disabled = false;
    this._input.disabled = false;
    const self = this;
    void self._el.offsetHeight;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        self._el.classList.add('challenge-qualify--visible');
        self._input.focus();
        self._input.select();
      });
    });
  }

  hide() {
    this._flowActive = false;
    this._hiddenForReplay = false;
    this._el.classList.remove('challenge-qualify--visible');
    this._el.style.display = 'none';
    this._el.setAttribute('aria-hidden', 'true');
  }

  hideForReplay() {
    if (!this._flowActive) return;
    this._hiddenForReplay = true;
    this._el.classList.remove('challenge-qualify--visible');
    this._el.style.display = 'none';
  }

  showAfterReplay() {
    if (!this._flowActive || !this._hiddenForReplay) return;
    this._hiddenForReplay = false;
    this._el.classList.remove('challenge-qualify--visible');
    this._el.style.display = 'flex';
    const self = this;
    void self._el.offsetHeight;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        self._el.classList.add('challenge-qualify--visible');
      });
    });
  }

  setSubmitting(disabled) {
    this._submitBtn.disabled = disabled;
    this._input.disabled = disabled;
  }

  getTrimmedName() {
    return this._input.value.trim().slice(0, 20);
  }

  onSubmit(handler) {
    const self = this;
    this._form.addEventListener('submit', function (e) {
      e.preventDefault();
      const name = self.getTrimmedName();
      if (!name) {
        self._input.focus();
        return;
      }
      handler(name);
    });
  }

  onReplay(handler) {
    this._replayBtn.addEventListener('click', handler);
  }

  onShare(handler) {
    this._shareBtn.addEventListener('click', handler);
  }

  flashShareDone() {
    this._shareBtn.textContent = strings.results.copied;
    const self = this;
    setTimeout(function () {
      self._shareBtn.textContent = strings.document.results.shareBtn;
    }, 1500);
  }

  handleEnterKey(context) {
    const ae = document.activeElement;
    if (ae && ae.closest && ae.closest('.challenge-qualify__form') && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      return;
    }
    context.restartCurrentMap();
  }

  handleEscapeKey(context) {
    context.restartRace();
  }
}
