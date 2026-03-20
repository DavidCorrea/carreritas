import { formatTime } from '../utils/index.js';
import { strings } from '../strings.js';

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

  _renderRow(entry, rank, isYou) {
    const row = document.createElement('div');
    let cls = 'lb-entry';
    if (rank <= 3) cls += ' lb-pos-' + rank;
    if (isYou) cls += ' lb-you';
    row.className = cls;

    const rankEl = document.createElement('span');
    rankEl.className = 'lb-rank';
    rankEl.textContent = rank + '.';
    row.appendChild(rankEl);

    if (entry.country) {
      const countryEl = document.createElement('span');
      countryEl.className = 'lb-country';
      countryEl.textContent = this._countryFlag(entry.country);
      row.appendChild(countryEl);
    }

    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = entry.username;
    row.appendChild(name);

    const time = document.createElement('span');
    time.className = 'lb-time';
    time.textContent = formatTime(entry.time_ms);
    row.appendChild(time);

    return row;
  }

  show() { this._leaderboardEl.style.display = 'flex'; }
  hide() { this._leaderboardEl.style.display = 'none'; }
  isOpen() { return this._leaderboardEl.style.display === 'flex'; }

  setTrackText(text) { this._leaderboardTrackEl.textContent = text; }
  clear() { this._leaderboardListEl.innerHTML = ''; }

  render(data, isLoggedIn, getUsername) {
    const entries = data.entries || [];
    this._leaderboardListEl.innerHTML = '';
    if (entries.length === 0 && !data.user_entry) {
      const empty = document.createElement('p');
      empty.className = 'lb-empty';
      empty.textContent = strings.leaderboard.empty;
      this._leaderboardListEl.appendChild(empty);
    } else {
      for (let i = 0; i < entries.length; i++) {
        const isYou = isLoggedIn() && entries[i].username === getUsername();
        this._leaderboardListEl.appendChild(this._renderRow(entries[i], i + 1, isYou));
      }
      if (data.user_entry) {
        const sep = document.createElement('div');
        sep.className = 'lb-separator';
        this._leaderboardListEl.appendChild(sep);
        this._leaderboardListEl.appendChild(this._renderRow(data.user_entry, data.user_entry.rank, true));
      }
    }
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
