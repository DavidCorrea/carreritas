import { strings } from '../strings.js';

export default class ResultsScreen {
  constructor() {
    this._resultsEl = document.querySelector('.race-results');
    this._resultsList = document.querySelector('.race-results__list');
    this._resultsTrackText = document.querySelector('.race-results__track-text');
    this._copyTrackBtn = document.querySelector('.race-results__copy-track');
    this._replayBtn = document.querySelector('.race-results__replay');
    this._shareBtn = document.querySelector('.race-results__share');
    this._leaderboardBtn = document.querySelector('.race-results__leaderboard');
    this._promptEl = this._resultsEl?.querySelector('.race-results__prompt');
    this._resultsH2 = this._resultsEl?.querySelector('h2');
    this._replayHintEl = document.querySelector('.replay-hint');
  }

  show() { if (this._resultsEl) this._resultsEl.style.display = 'flex'; }
  hide() { if (this._resultsEl) this._resultsEl.style.display = 'none'; }

  clear() {
    this._resultsList.innerHTML = '';
    const existing = this._resultsEl.querySelector('.new-record');
    if (existing) existing.remove();
  }

  setTitle(text) { this._resultsH2.textContent = text; }
  setTrackText(text) { this._resultsTrackText.textContent = text; }
  setPrompt(text) { this._promptEl.textContent = text; }

  showCopyButton(visible) { this._copyTrackBtn.style.display = visible ? '' : 'none'; }
  showShareButton(visible) { this._shareBtn.style.display = visible ? '' : 'none'; }
  showLeaderboardButton(visible) { this._leaderboardBtn.style.display = visible ? '' : 'none'; }

  addNewRecordBadge() {
    const badge = document.createElement('p');
    badge.className = 'new-record';
    badge.textContent = strings.results.newRecordBadge;
    this._resultsEl.insertBefore(badge, this._resultsList);
  }

  addRow(text, opts) {
    const li = document.createElement('li');
    if (opts && opts.className) li.className = opts.className;
    if (opts && opts.color) li.style.color = opts.color;
    li.textContent = text;
    this._resultsList.appendChild(li);
  }

  flashCopyDone() {
    this._copyTrackBtn.textContent = strings.results.copyDoneCheck;
    setTimeout(() => { this._copyTrackBtn.innerHTML = strings.results.copyTrackGlyphHtml; }, 1500);
  }

  flashShareDone() {
    this._shareBtn.textContent = strings.results.copied;
    setTimeout(() => { this._shareBtn.textContent = strings.document.results.shareBtn; }, 1500);
  }

  onCopy(handler) { this._copyTrackBtn.addEventListener('click', handler); }
  onReplay(handler) { this._replayBtn.addEventListener('click', handler); }
  onShare(handler) { this._shareBtn.addEventListener('click', handler); }
  onLeaderboardClick(handler) { this._leaderboardBtn.addEventListener('click', handler); }
  onPromptClick(handler) { this._promptEl.addEventListener('click', handler); }

  /** @param {string} text */
  showReplayHint(text) {
    if (!this._replayHintEl) return;
    this._replayHintEl.textContent = text;
    this._replayHintEl.classList.remove('hidden');
  }

  hideReplayHint() {
    if (!this._replayHintEl) return;
    this._replayHintEl.classList.add('hidden');
  }

  onReplayHintDismiss(handler) {
    if (!this._replayHintEl) return;
    this._replayHintEl.addEventListener('click', handler);
  }
}
