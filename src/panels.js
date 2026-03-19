import { formatTime } from './utils.js';

export function createRecords(generateTrackSVG, formatDescriptor) {
  var recordsEl = document.getElementById('records');
  var recordsListEl = document.getElementById('records-list');
  var recordsBtn = document.getElementById('records-btn');
  var recordsBackEl = document.getElementById('records-back');

  return {
    show: function () { recordsEl.classList.remove('hidden'); },
    hide: function () { recordsEl.classList.add('hidden'); },
    isOpen: function () { return !recordsEl.classList.contains('hidden'); },

    render: function (records, onRetry) {
      recordsListEl.innerHTML = '';

      if (records.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'records-empty';
        empty.textContent = 'No records yet';
        recordsListEl.appendChild(empty);
        return;
      }

      records.sort(function (a, b) {
        if (a.code !== b.code) return a.code < b.code ? -1 : 1;
        if (a.reversed !== b.reversed) return a.reversed ? 1 : -1;
        if (a.nightMode !== b.nightMode) return a.nightMode ? 1 : -1;
        return a.time - b.time;
      });

      for (var i = 0; i < records.length; i++) {
        var rec = records[i];

        var card = document.createElement('div');
        card.className = 'record-card';

        var svgDiv = document.createElement('div');
        svgDiv.className = 'record-card-svg';
        svgDiv.innerHTML = generateTrackSVG(rec.code);
        card.appendChild(svgDiv);

        var info = document.createElement('div');
        info.className = 'record-card-info';

        var codeP = document.createElement('p');
        codeP.className = 'record-card-code';
        codeP.textContent = formatDescriptor(rec.code, rec.reversed, rec.nightMode, rec.laps);
        info.appendChild(codeP);

        var row = document.createElement('div');
        row.className = 'record-card-row';

        var time = document.createElement('span');
        time.className = 'record-time';
        time.textContent = formatTime(rec.time);
        row.appendChild(time);

        if (rec.date) {
          var dateSpan = document.createElement('span');
          dateSpan.className = 'record-date';
          var d = new Date(rec.date);
          dateSpan.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
          row.appendChild(dateSpan);
        }

        var retryBtn = document.createElement('button');
        retryBtn.className = 'record-retry';
        retryBtn.type = 'button';
        retryBtn.textContent = 'RETRY';
        (function (r) {
          retryBtn.addEventListener('click', function () { onRetry(r); });
        })(rec);
        row.appendChild(retryBtn);

        info.appendChild(row);
        card.appendChild(info);
        recordsListEl.appendChild(card);
      }
    },

    onOpen: function (handler) { recordsBtn.addEventListener('click', handler); },
    onBack: function (handler) { recordsBackEl.addEventListener('click', handler); }
  };
}

export function createLeaderboard(countryFlag) {
  var leaderboardEl = document.getElementById('leaderboard');
  var leaderboardListEl = document.getElementById('leaderboard-list');
  var leaderboardTrackEl = document.getElementById('leaderboard-track');
  var leaderboardBtn = document.getElementById('leaderboard-btn');
  var leaderboardBackEl = document.getElementById('leaderboard-back');
  var leaderboardMenuBtn = document.getElementById('leaderboard-menu-btn');
  var challengeLbSubtitle = document.getElementById('challenge-lb-subtitle');

  function renderRow(entry, rank, isYou) {
    var row = document.createElement('div');
    var cls = 'lb-entry';
    if (rank <= 3) cls += ' lb-pos-' + rank;
    if (isYou) cls += ' lb-you';
    row.className = cls;

    var rankEl = document.createElement('span');
    rankEl.className = 'lb-rank';
    rankEl.textContent = rank + '.';
    row.appendChild(rankEl);

    if (entry.country) {
      var countryEl = document.createElement('span');
      countryEl.className = 'lb-country';
      countryEl.textContent = countryFlag(entry.country);
      row.appendChild(countryEl);
    }

    var name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = entry.username;
    row.appendChild(name);

    var time = document.createElement('span');
    time.className = 'lb-time';
    time.textContent = formatTime(entry.time_ms);
    row.appendChild(time);

    return row;
  }

  return {
    show: function () { leaderboardEl.style.display = 'flex'; },
    hide: function () { leaderboardEl.style.display = 'none'; },
    isOpen: function () { return leaderboardEl.style.display === 'flex'; },

    setTrackText: function (text) { leaderboardTrackEl.textContent = text; },
    clear: function () { leaderboardListEl.innerHTML = ''; },

    render: function (data, isLoggedIn, getUsername) {
      var entries = data.entries || [];
      leaderboardListEl.innerHTML = '';
      if (entries.length === 0 && !data.user_entry) {
        var empty = document.createElement('p');
        empty.className = 'lb-empty';
        empty.textContent = 'No times yet';
        leaderboardListEl.appendChild(empty);
      } else {
        for (var i = 0; i < entries.length; i++) {
          var isYou = isLoggedIn() && entries[i].username === getUsername();
          leaderboardListEl.appendChild(renderRow(entries[i], i + 1, isYou));
        }
        if (data.user_entry) {
          var sep = document.createElement('div');
          sep.className = 'lb-separator';
          leaderboardListEl.appendChild(sep);
          leaderboardListEl.appendChild(renderRow(data.user_entry, data.user_entry.rank, true));
        }
      }
    },

    setChallengeStats: function (message) {
      challengeLbSubtitle.querySelector('span').textContent = message;
      challengeLbSubtitle.classList.add('visible');
    },

    clearChallengeStats: function () {
      challengeLbSubtitle.classList.remove('visible');
      challengeLbSubtitle.querySelector('span').textContent = '';
    },

    onBack: function (handler) { leaderboardBackEl.addEventListener('click', handler); },
    onMenuOpen: function (handler) { leaderboardMenuBtn.addEventListener('click', handler); }
  };
}

export function createAuthPanel(countries, countryFlag) {
  var authEl = document.getElementById('auth');
  var authForm = document.getElementById('auth-form');
  var authTitle = document.getElementById('auth-title');
  var authUsernameInput = document.getElementById('auth-username');
  var authPasswordInput = document.getElementById('auth-password');
  var authCountrySelect = document.getElementById('auth-country');
  var authSubmitBtn = document.getElementById('auth-submit-btn');
  var authError = document.getElementById('auth-error');
  var authToggleText = document.getElementById('auth-toggle');
  var authClose = document.getElementById('auth-close');

  var isRegister = false;

  var opt = document.createElement('option');
  opt.value = '';
  opt.textContent = 'Select country';
  authCountrySelect.appendChild(opt);
  for (var i = 0; i < countries.length; i++) {
    var o = document.createElement('option');
    o.value = countries[i][0];
    o.textContent = countryFlag(countries[i][0]) + ' ' + countries[i][1];
    authCountrySelect.appendChild(o);
  }

  function setMode(register) {
    isRegister = register;
    authError.textContent = '';
    if (register) {
      authTitle.textContent = 'REGISTER';
      authSubmitBtn.textContent = 'REGISTER';
      authToggleText.innerHTML = 'Have an account? <a id="auth-switch">Login</a>';
      authCountrySelect.style.display = '';
    } else {
      authTitle.textContent = 'LOGIN';
      authSubmitBtn.textContent = 'LOGIN';
      authToggleText.innerHTML = 'No account? <a id="auth-switch">Register</a>';
      authCountrySelect.style.display = 'none';
    }
    document.getElementById('auth-switch').addEventListener('click', function () {
      setMode(!isRegister);
    });
  }

  return {
    show: function () { authEl.classList.add('visible'); },
    hide: function () { authEl.classList.remove('visible'); },
    isOpen: function () { return authEl.classList.contains('visible'); },

    showLogin: function () {
      setMode(false);
      authUsernameInput.value = '';
      authPasswordInput.value = '';
      authCountrySelect.value = '';
      authEl.classList.add('visible');
      authUsernameInput.focus();
    },

    setError: function (msg) { authError.textContent = msg; },
    setSubmitting: function (busy) { authSubmitBtn.disabled = busy; },
    clearError: function () { authError.textContent = ''; },

    getCredentials: function () {
      return {
        username: authUsernameInput.value.trim(),
        password: authPasswordInput.value,
        country: authCountrySelect.value,
        isRegister: isRegister
      };
    },

    setCloseText: function (text) { authClose.textContent = text; },

    onSubmit: function (handler) { authForm.addEventListener('submit', handler); },
    onClose: function (handler) { authClose.addEventListener('click', handler); }
  };
}

export function createAccountBar() {
  var accountBar = document.getElementById('account-bar');
  var accountUsername = document.getElementById('account-username');
  var logoutBtn = document.getElementById('logout-btn');
  var loginBtn = document.getElementById('login-btn');

  return {
    show: function () { accountBar.style.display = ''; },
    hide: function () { accountBar.style.display = 'none'; },

    update: function (loggedIn, username, country, countryFlag) {
      if (loggedIn) {
        accountUsername.textContent = (country ? countryFlag(country) + ' ' : '') + username;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = '';
      } else {
        accountUsername.textContent = '';
        loginBtn.style.display = '';
        logoutBtn.style.display = 'none';
      }
    },

    onLogin: function (handler) { loginBtn.addEventListener('click', handler); },
    onLogout: function (handler) { logoutBtn.addEventListener('click', handler); }
  };
}
