import { strings } from '../strings.js';

export default class ResultsScreen {
  constructor() {
    this._resultsEl = document.getElementById('results');
    this._resultsList = document.getElementById('results-list');
    this._resultsTrackText = document.getElementById('results-track-text');
    this._copyTrackBtn = document.getElementById('copy-track-btn');
    this._replayBtn = document.getElementById('replay-btn');
    this._shareBtn = document.getElementById('share-btn');
    this._leaderboardBtn = document.getElementById('leaderboard-btn');
    this._promptEl = this._resultsEl.querySelector('.start-prompt');
    this._resultsH2 = this._resultsEl.querySelector('h2');
    this._replayHintEl = document.getElementById('replay-hint');
  }

  show() { this._resultsEl.style.display = 'flex'; }
  hide() { this._resultsEl.style.display = 'none'; }

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
