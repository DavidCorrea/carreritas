import { formatTime } from '../utils/index.js';
import { strings } from '../strings.js';

export default class RecordsPanel {
  constructor(generateTrackSVG, formatDescriptor) {
    this._generateTrackSVG = generateTrackSVG;
    this._formatDescriptor = formatDescriptor;
    this._recordsEl = document.getElementById('records');
    this._recordsListEl = document.getElementById('records-list');
    this._recordsBtn = document.getElementById('records-btn');
    this._recordsBackEl = document.getElementById('records-back');
  }

  show() { this._recordsEl.classList.remove('hidden'); }
  hide() { this._recordsEl.classList.add('hidden'); }
  isOpen() { return !this._recordsEl.classList.contains('hidden'); }

  render(records, onRetry) {
    this._recordsListEl.innerHTML = '';

    if (records.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'records-empty';
      empty.textContent = strings.records.empty;
      this._recordsListEl.appendChild(empty);
      return;
    }

    records.sort(function (a, b) {
      if (a.code !== b.code) return a.code < b.code ? -1 : 1;
      if (a.reversed !== b.reversed) return a.reversed ? 1 : -1;
      if (a.nightMode !== b.nightMode) return a.nightMode ? 1 : -1;
      return a.time - b.time;
    });

    const self = this;
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];

      const card = document.createElement('div');
      card.className = 'record-card';

      const svgDiv = document.createElement('div');
      svgDiv.className = 'record-card-svg';
      svgDiv.innerHTML = self._generateTrackSVG(rec.code);
      card.appendChild(svgDiv);

      const info = document.createElement('div');
      info.className = 'record-card-info';

      const codeP = document.createElement('p');
      codeP.className = 'record-card-code';
      codeP.textContent = self._formatDescriptor(rec.code, rec.reversed, rec.nightMode, rec.laps);
      info.appendChild(codeP);

      const row = document.createElement('div');
      row.className = 'record-card-row';

      const time = document.createElement('span');
      time.className = 'record-time';
      time.textContent = formatTime(rec.time);
      row.appendChild(time);

      if (rec.date) {
        const dateSpan = document.createElement('span');
        dateSpan.className = 'record-date';
        const d = new Date(rec.date);
        dateSpan.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        row.appendChild(dateSpan);
      }

      const retryBtn = document.createElement('button');
      retryBtn.className = 'record-retry';
      retryBtn.type = 'button';
      retryBtn.textContent = strings.records.retry;
      (function (r) {
        retryBtn.addEventListener('click', function () { onRetry(r); });
      })(rec);
      row.appendChild(retryBtn);

      info.appendChild(row);
      card.appendChild(info);
      this._recordsListEl.appendChild(card);
    }
  }

  onOpen(handler) { this._recordsBtn.addEventListener('click', handler); }
  onBack(handler) { this._recordsBackEl.addEventListener('click', handler); }

  handleEscapeKey(context) {
    if (this.isOpen()) {
      context.hideRecords();
    }
  }
  handleEnterKey(_context) {}
  handleSpaceKey(_context) {}
}
