import { formatTime } from '../utils/index.js';

const LB_TOP_SLOTS = 10;
/** Delay step between rows (top → bottom), ms. */
const LB_ROW_STAGGER_MS = 48;

export default class LeaderboardPanel {
  constructor(countryFlag) {
    this._countryFlag = countryFlag;
    this._leaderboardEl = document.getElementById('leaderboard');
    this._leaderboardListEl = document.getElementById('leaderboard-list');
    this._leaderboardTrackEl = document.getElementById('leaderboard-track');
    this._leaderboardBackEl = document.getElementById('leaderboard-back');
    this._leaderboardMenuBtn = document.getElementById('leaderboard-menu-btn');
    this._challengeLbSubtitle = document.getElementById('challenge-lb-subtitle');
  }

  /**
   * @param {number} rowIndex 0-based order in the list (top row = 0) for staggered fade.
   */
  _renderRow(entry, rank, isYou, rowIndex = 0) {
    const row = document.createElement('div');
    let cls = 'lb-entry';
    if (rank <= 3) cls += ' lb-pos-' + rank;
    if (isYou) cls += ' lb-you';
    row.className = cls;
    row.style.setProperty('--lb-stagger', rowIndex * LB_ROW_STAGGER_MS + 'ms');

    const rankEl = document.createElement('span');
    rankEl.className = 'lb-rank';
    rankEl.textContent = rank + '.';
    row.appendChild(rankEl);

    if (entry.country) {
      const countryEl = document.createElement('span');
      countryEl.className = 'lb-country lb-cell-fade';
      countryEl.textContent = this._countryFlag(entry.country);
      row.appendChild(countryEl);
    } else {
      const countryEl = document.createElement('span');
      countryEl.className = 'lb-country lb-country-empty lb-cell-fade';
      countryEl.setAttribute('aria-hidden', 'true');
      row.appendChild(countryEl);
    }

    const name = document.createElement('span');
    name.className = 'lb-name lb-cell-fade';
    name.textContent = entry.username;
    row.appendChild(name);

    const time = document.createElement('span');
    time.className = 'lb-time lb-cell-fade';
    time.textContent = formatTime(entry.time_ms);
    row.appendChild(time);

    return row;
  }

  _scheduleCellFadeIn(listEl) {
    const cells = listEl.querySelectorAll('.lb-cell-fade');
    if (cells.length === 0) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let i = 0; i < cells.length; i++) cells[i].classList.add('lb-cell-fade-in');
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        for (let i = 0; i < cells.length; i++) cells[i].classList.add('lb-cell-fade-in');
      });
    });
  }

  show() { this._leaderboardEl.style.display = 'flex'; }
  hide() { this._leaderboardEl.style.display = 'none'; }
  isOpen() { return this._leaderboardEl.style.display === 'flex'; }

  setTrackText(text) { this._leaderboardTrackEl.textContent = text; }

  clear() {
    this._leaderboardListEl.innerHTML = '';
  }

  /**
   * Same layout as loaded state: ten empty slots (no shimmer) while fetch runs.
   */
  showLoadingPlaceholder(rowCount = LB_TOP_SLOTS) {
    const list = this._leaderboardListEl;
    list.innerHTML = '';
    list.setAttribute('aria-busy', 'true');
    for (let r = 1; r <= rowCount; r++) {
      list.appendChild(this._renderEmptySlot(r));
    }
  }

  _renderEmptySlot(rank) {
    const row = document.createElement('div');
    let cls = 'lb-entry lb-empty-slot';
    if (rank <= 3) cls += ' lb-pos-' + rank;
    row.className = cls;
    row.setAttribute('aria-hidden', 'true');

    const rankEl = document.createElement('span');
    rankEl.className = 'lb-rank';
    rankEl.textContent = rank + '.';
    row.appendChild(rankEl);

    const countryEl = document.createElement('span');
    countryEl.className = 'lb-country lb-country-empty';
    row.appendChild(countryEl);

    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = '\u2014';
    row.appendChild(name);

    const time = document.createElement('span');
    time.className = 'lb-time';
    time.textContent = '\u2014';
    row.appendChild(time);

    return row;
  }

  render(data, isLoggedIn, getUsername) {
    const entries = data.entries || [];
    const list = this._leaderboardListEl;
    list.removeAttribute('aria-busy');
    list.innerHTML = '';

    const n = Math.min(entries.length, LB_TOP_SLOTS);
    for (let i = 0; i < n; i++) {
      const isYou = isLoggedIn() && entries[i].username === getUsername();
      list.appendChild(this._renderRow(entries[i], i + 1, isYou, i));
    }
    for (let r = n + 1; r <= LB_TOP_SLOTS; r++) {
      list.appendChild(this._renderEmptySlot(r));
    }

    if (data.user_entry) {
      const sep = document.createElement('div');
      sep.className = 'lb-separator';
      list.appendChild(sep);
      list.appendChild(this._renderRow(data.user_entry, data.user_entry.rank, true, LB_TOP_SLOTS));
    }

    this._scheduleCellFadeIn(list);
  }

  setChallengeStats(message) {
    this._challengeLbSubtitle.querySelector('span').textContent = message;
    this._challengeLbSubtitle.classList.add('visible');
  }

  clearChallengeStats() {
    this._challengeLbSubtitle.classList.remove('visible');
    this._challengeLbSubtitle.querySelector('span').textContent = '';
  }

  onBack(handler) { this._leaderboardBackEl.addEventListener('click', handler); }
  onMenuOpen(handler) { this._leaderboardMenuBtn.addEventListener('click', handler); }

  handleEscapeKey(context) {
    if (this.isOpen()) {
      context.hideLeaderboardPanel();
    }
  }
  handleEnterKey(_context) {}
  handleSpaceKey(_context) {}
}
