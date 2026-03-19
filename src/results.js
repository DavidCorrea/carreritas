export function createResults() {
  var resultsEl = document.getElementById('results');
  var resultsList = document.getElementById('results-list');
  var resultsTrackText = document.getElementById('results-track-text');
  var copyTrackBtn = document.getElementById('copy-track-btn');
  var shareBtn = document.getElementById('share-btn');
  var leaderboardBtn = document.getElementById('leaderboard-btn');
  var promptEl = resultsEl.querySelector('.start-prompt');
  var resultsH2 = resultsEl.querySelector('h2');

  return {
    show: function () { resultsEl.style.display = 'flex'; },
    hide: function () { resultsEl.style.display = 'none'; },

    clear: function () {
      resultsList.innerHTML = '';
      var existing = resultsEl.querySelector('.new-record');
      if (existing) existing.remove();
    },

    setTitle: function (text) { resultsH2.textContent = text; },
    setTrackText: function (text) { resultsTrackText.textContent = text; },
    setPrompt: function (text) { promptEl.textContent = text; },

    showCopyButton: function (visible) { copyTrackBtn.style.display = visible ? '' : 'none'; },
    showShareButton: function (visible) { shareBtn.style.display = visible ? '' : 'none'; },
    showLeaderboardButton: function (visible) { leaderboardBtn.style.display = visible ? '' : 'none'; },

    addNewRecordBadge: function () {
      var badge = document.createElement('p');
      badge.className = 'new-record';
      badge.textContent = 'NEW RECORD!';
      resultsEl.insertBefore(badge, resultsList);
    },

    addRow: function (text, opts) {
      var li = document.createElement('li');
      if (opts && opts.className) li.className = opts.className;
      if (opts && opts.color) li.style.color = opts.color;
      li.textContent = text;
      resultsList.appendChild(li);
    },

    flashCopyDone: function () {
      copyTrackBtn.textContent = '\u2713';
      setTimeout(function () { copyTrackBtn.innerHTML = '&#9112;'; }, 1500);
    },

    flashShareDone: function () {
      shareBtn.textContent = 'COPIED!';
      setTimeout(function () { shareBtn.textContent = 'SHARE'; }, 1500);
    },

    onCopy: function (handler) { copyTrackBtn.addEventListener('click', handler); },
    onShare: function (handler) { shareBtn.addEventListener('click', handler); },
    onLeaderboardClick: function (handler) { leaderboardBtn.addEventListener('click', handler); },

    onPromptClick: function (handler) {
      promptEl.addEventListener('click', handler);
    }
  };
}
