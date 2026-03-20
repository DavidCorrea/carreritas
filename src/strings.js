/**
 * Single source for user-visible copy (English). Import `strings` where needed;
 * call `applyStaticDocumentCopy()` once at startup for markup in index.html.
 */

export const strings = {
  document: {
    pageTitle: 'Carreritas',
    hud: {
      lapDisplayPlaceholder: 'LAP 1 / 3',
      bestPlaceholder: 'BEST --:--.--',
      timePlaceholder: '0:00.00',
      speedPlaceholder: '0 km/h',
      controlsHint: 'W/\u2191 S/\u2193 A/\u2190 D/\u2192 \u00a0 SPACE Restart \u00a0 C Camera'
    },
    accountBar: {
      bestRuns: 'BEST RUNS',
      carSettings: 'CAR SETTINGS',
      login: 'LOGIN',
      logout: 'LOGOUT'
    },
    auth: {
      titleLogin: 'LOGIN',
      titleRegister: 'REGISTER',
      submitLogin: 'LOGIN',
      submitRegister: 'REGISTER',
      usernamePlaceholder: 'Username',
      passwordPlaceholder: 'Password',
      toggleToRegister: 'No account? <a id="auth-switch">Register</a>',
      toggleToLogin: 'Have an account? <a id="auth-switch">Login</a>',
      closeDesktop: 'ESC Skip',
      closeMobile: 'Skip'
    },
    overlay: {
      title: 'CARRERITAS',
      subtitles: [
        'W / \u2191 Accelerate \u00a0\u00a0 S / \u2193 Brake',
        'A / \u2190 Steer Left \u00a0\u00a0 D / \u2194 Steer Right',
        'SPACE Restart \u00a0\u00a0 C Camera'
      ],
      tabEvent: 'EVENT',
      tabChallenges: 'CHALLENGES',
      race: 'RACE',
      raceTypeSingle: 'SINGLE',
      raceTypeSeries: 'SERIES',
      trackCode: 'TRACK CODE',
      randomBtn: 'RNG',
      direction: 'DIRECTION',
      mode: 'MODE',
      fwd: 'FWD',
      rev: 'REV',
      day: 'DAY',
      night: 'NIGHT',
      stages: 'STAGES',
      rngAll: 'RNG ALL',
      laps: 'LAPS',
      lapsPerStage: 'LAPS PER STAGE',
      eventStartPrompt: 'Press ENTER to start',
      challengeStartPrompt: 'Press ENTER to start',
      challengeModes: {
        'daily-race': 'DAILY RACE',
        'daily-series': 'DAILY SERIES',
        'weekly-race': 'WEEKLY RACE',
        'weekly-series': 'WEEKLY SERIES'
      },
      leaderboardBtn: 'LEADERBOARD',
      github: 'GitHub'
    },
    results: {
      titleDefault: 'RACE COMPLETE',
      copyTrackTitle: 'Copy track code',
      shareTitle: 'Share results',
      shareBtn: 'SHARE',
      leaderboardBtn: 'LEADERBOARD',
      /** Desktop keyboard hint after race (also used for series complete). */
      promptRetryMenu: 'ENTER Retry \u00b7 ESC Menu'
    },
    leaderboard: {
      title: 'LEADERBOARD',
      back: 'ESC Back'
    },
    records: {
      title: 'BEST RUNS',
      back: 'ESC Back'
    },
    settings: {
      pattern: 'PATTERN',
      primary: 'PRIMARY',
      secondary: 'SECONDARY',
      headlights: 'HEADLIGHTS',
      underglow: 'UNDERGLOW',
      shape: 'SHAPE',
      previewDay: 'DAY',
      previewNight: 'NIGHT',
      previewIdle: 'IDLE',
      previewRunning: 'RUNNING',
      back: 'ESC Back'
    },
    touch: {
      steer: 'STEER',
      gasBrake: 'GAS / BRAKE'
    }
  },

  labels: {
    fwd: 'FWD',
    rev: 'REV',
    day: 'DAY',
    night: 'NIGHT',
    single: 'SINGLE',
    series: 'SERIES'
  },

  challengeModes: {
    'daily-race': 'DAILY RACE',
    'daily-series': 'DAILY SERIES',
    'weekly-race': 'WEEKLY RACE',
    'weekly-series': 'WEEKLY SERIES'
  },

  challengeStats: {
    empty: [
      'No one\u2019s posted a time yet \u2014 be the first',
      'Wide open \u2014 no times on the board',
      'Unclaimed \u2014 set the pace',
      'Ghost town \u2014 leave the first mark',
      'Empty board \u2014 this one\u2019s yours',
      'Zero entries \u2014 make history',
      'Blank slate \u2014 someone\u2019s gotta go first',
      'The board is cold \u2014 warm it up'
    ],
    notLoggedIn: [
      '{n} on the board \u2014 log in to compete',
      '{n} posted so far \u2014 log in to join',
      '{n} in the mix \u2014 log in and show up',
      '{n} already in \u2014 log in to challenge them',
      '{n} on the clock \u2014 log in to post yours',
      'The board has {n} \u2014 log in and make it {n}+1',
      '{n} left their mark \u2014 log in to leave yours',
      '{n} threw down \u2014 log in and answer'
    ],
    notParticipated: [
      '{n} in and counting \u2014 jump in',
      '{n} on the board \u2014 think you can hang?',
      '{n} posted \u2014 yours isn\u2019t one yet',
      '{n} showed up \u2014 where are you?',
      '{n} already went for it \u2014 your turn',
      'Board\u2019s got {n} \u2014 go add your name',
      '{n} threw down a time \u2014 you in?',
      '{n} and counting \u2014 don\u2019t just watch'
    ],
    first: [
      '{n} in \u2014 you\u2019re on top',
      'Leading the pack out of {n}',
      'On top with {n} behind you',
      'Crown is yours \u2014 {n} tried',
      'Fastest out of {n} \u2014 hold it',
      '{n} in your rearview',
      'Untouched \u2014 {n} couldn\u2019t catch you',
      'The one to beat out of {n}'
    ],
    ranked: [
      '#{rank} of {n} \u2014 {taunt}',
      'Sitting at #{rank} out of {n} \u2014 {taunt}',
      'You\u2019re #{rank} of {n} \u2014 {taunt}',
      'Clocked in at #{rank} of {n} \u2014 {taunt}',
      '#{rank} out of {n} \u2014 {taunt}',
      'Holding #{rank} in a field of {n} \u2014 {taunt}',
      'Landed #{rank} of {n} \u2014 {taunt}',
      '#{rank} with {n} on the board \u2014 {taunt}'
    ]
  },

  challengeTaunts: {
    close: [
      'almost there', 'one push away', 'podium\u2019s right there',
      'so close', 'one good lap away', 'within striking distance',
      'the top is right there', 'can you smell it'
    ],
    mid: [
      'room to climb', 'not bad, not great', 'warming up',
      'middle of the pack', 'decent but not done',
      'solid start', 'respectable', 'keep pushing'
    ],
    far: [
      'got some work to do', 'long way up', 'brave showing',
      'it\u2019s the taking part that counts', 'everyone starts somewhere',
      'the only way is up', 'character building', 'shaking off the rust'
    ]
  },

  share: {
    openers: [
      'Just set this time.',
      'Not bad, right?',
      'Could\'ve been worse.',
      'Not my best run... or is it?',
      'Look at this.'
    ],
    openersRecord: [
      'New record. No big deal.',
      'Just casually dropped a record.',
      'Personal best. I make it look easy.',
      'Record broken. Again.',
      'Peak performance.',
      'Cinema.',
      'This is giving main character energy.',
      'No cap, that was clean.',
      'Lowkey ate that.',
      'Slay.'
    ],
    closers: [
      'Think you can beat me?',
      'Your turn.',
      'No pressure.',
      'Your move.',
      'Beat that.'
    ],
    closersRecord: [
      'Good luck beating this.',
      'Try to do better, I dare you.',
      'I\'ll wait.',
      'Don\'t even bother.',
      'Set the bar. Your problem now.',
      'It\'s giving unbeatable.',
      'Rent free in the leaderboard.',
      'Stay mad.'
    ]
  },

  auth: {
    countryPlaceholder: 'Select country',
    fillFields: 'Fill in both fields',
    selectCountry: 'Select a country',
    connectionError: 'Connection error'
  },

  hud: {
    lap: (current, total) => 'LAP ' + current + ' / ' + total,
    best: (timeStr) => 'BEST ' + timeStr,
    bestEmpty: '--:--.--',
    speed: (kmh) => kmh + ' km/h',
    stage: (current, total) => 'STAGE ' + current + ' / ' + total
  },

  menu: {
    challengeCountdown: (duration) => 'Changes in ' + duration,
    lapWord: 'LAP',
    lapsWord: 'LAPS',
    lapWordLower: 'lap',
    lapsWordLower: 'laps',
    stagesSummary: (n, laps, lapsWord) => n + ' stages \u00b7 ' + laps + ' ' + lapsWord + ' per stage'
  },

  results: {
    newRecordBadge: 'NEW RECORD!',
    copied: 'COPIED!',
    share: 'SHARE',
    copyDoneCheck: '\u2713',
    copyTrackGlyphHtml: '&#9112;',
    completeSuffix: ' COMPLETE',
    raceWord: 'RACE',
    seriesWord: 'SERIES',
    stageComplete: (n) => 'STAGE ' + n + ' COMPLETE',
    promptNextStage: (n) => 'Press ENTER for Stage ' + n,
    timeRow: (t) => 'TIME  ' + t,
    bestRow: (t) => 'BEST  ' + t,
    deltaRow: (seconds) => 'DELTA  +' + seconds + 's',
    lapRow: (n, t) => 'L' + n + '  ' + t,
    seriesRow: (n, t, desc) => '#' + n + '  ' + t + '  ' + desc,
    shareStagesLine: (n, totalTime) => n + ' stages \u00b7 ' + totalTime,
    shareTimeLine: (t) => 'TIME  ' + t,
    shareLapLine: (n, t, star) => 'L' + n + '  ' + t + star,
    starFastest: ' \u2605'
  },

  records: {
    empty: 'No records yet',
    retry: 'RETRY'
  },

  leaderboard: {
    empty: 'No times yet'
  },

  settings: {
    showcase: 'SHOWCASE'
  },

  camera: {
    labels: {
      'TOP-DOWN': 'TOP-DOWN',
      ROTATED: 'ROTATED',
      CHASE: 'CHASE',
      ISOMETRIC: 'ISOMETRIC'
    }
  },

  mobile: {
    tapRetry: 'Tap to retry',
    tapStart: 'Tap to start',
    back: 'Back'
  },

  /** Countdown parts for `formatCountdown` in `utils/challenge-seed.js` (challenge reset timer). */
  timeCountdown: {
    withDays: (d, h, m) => d + 'd ' + h + 'h ' + m + 'm',
    withHours: (h, m, s) => h + 'h ' + m + 'm ' + s + 's',
    withMinutes: (m, s) => m + 'm ' + s + 's'
  }
};

/**
 * Replace `{key}` placeholders in a template string.
 * @param {string} template
 * @param {Record<string, string | number>} vars
 */
export function formatPlaceholders(template, vars) {
  let s = template;
  const keys = Object.keys(vars);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    s = s.split('{' + k + '}').join(String(vars[k]));
  }
  return s;
}

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function _setAttr(id, name, value) {
  const el = document.getElementById(id);
  if (el) el.setAttribute(name, value);
}

/** Apply static strings to index.html (run before Game constructs UI that reads DOM). */
export function applyStaticDocumentCopy() {
  const d = strings.document;
  document.title = d.pageTitle;

  _setText('lap-display', d.hud.lapDisplayPlaceholder);
  _setText('best-display', d.hud.bestPlaceholder);
  _setText('time-display', d.hud.timePlaceholder);
  _setText('speed-display', d.hud.speedPlaceholder);
  _setText('controls-hint', d.hud.controlsHint);

  _setText('records-btn', d.accountBar.bestRuns);
  _setText('settings-btn', d.accountBar.carSettings);
  _setText('login-btn', d.accountBar.login);
  _setText('logout-btn', d.accountBar.logout);

  _setText('auth-title', d.auth.titleLogin);
  _setAttr('auth-username', 'placeholder', d.auth.usernamePlaceholder);
  _setAttr('auth-password', 'placeholder', d.auth.passwordPlaceholder);
  _setText('auth-submit-btn', d.auth.submitLogin);
  _setHtml('auth-toggle', d.auth.toggleToRegister);
  _setText('auth-close', d.auth.closeDesktop);

  const h1 = document.querySelector('#overlay h1');
  if (h1) h1.textContent = d.overlay.title;
  const subs = document.querySelectorAll('#overlay > p.subtitle');
  for (let i = 0; i < subs.length && i < d.overlay.subtitles.length; i++) {
    subs[i].innerHTML = d.overlay.subtitles[i];
  }

  const tabBtns = document.querySelectorAll('#menu-tab-toggle .seg-option');
  if (tabBtns[0]) tabBtns[0].textContent = d.overlay.tabEvent;
  if (tabBtns[1]) tabBtns[1].textContent = d.overlay.tabChallenges;

  const raceBtns = document.querySelectorAll('#race-type-toggle .seg-option');
  if (raceBtns[0]) raceBtns[0].textContent = d.overlay.raceTypeSingle;
  if (raceBtns[1]) raceBtns[1].textContent = d.overlay.raceTypeSeries;

  const trackLabels = document.querySelectorAll('#event-tab .menu-card > .track-label');
  for (let i = 0; i < trackLabels.length; i++) {
    const el = trackLabels[i];
    const t = el.textContent.trim();
    if (t === 'RACE') el.textContent = d.overlay.race;
    else if (t === 'TRACK CODE') el.textContent = d.overlay.trackCode;
    else if (t === 'DIRECTION') el.textContent = d.overlay.direction;
    else if (t === 'MODE') el.textContent = d.overlay.mode;
    else if (t === 'STAGES') el.textContent = d.overlay.stages;
    else if (t === 'LAPS' || t === 'LAPS PER STAGE') el.textContent = d.overlay.laps;
  }

  _setText('random-btn', d.overlay.randomBtn);
  _setText('rng-all-btn', d.overlay.rngAll);

  const dirSeg = document.querySelectorAll('#dir-toggle .seg-option');
  if (dirSeg[0]) dirSeg[0].textContent = d.overlay.fwd;
  if (dirSeg[1]) dirSeg[1].textContent = d.overlay.rev;

  const modeSeg = document.querySelectorAll('#mode-toggle .seg-option');
  if (modeSeg[0]) modeSeg[0].textContent = d.overlay.day;
  if (modeSeg[1]) modeSeg[1].textContent = d.overlay.night;

  _setText('laps-label', d.overlay.laps);
  _setText('race-type-value', d.overlay.raceTypeSingle);
  _setText('dir-value', d.overlay.fwd);
  _setText('mode-value', d.overlay.day);
  _setText('event-start-prompt', d.overlay.eventStartPrompt);
  _setText('challenge-start-prompt', d.overlay.challengeStartPrompt);

  const chBtns = document.querySelectorAll('#challenge-mode-toggle .seg-option');
  const cm = d.overlay.challengeModes;
  const order = ['daily-race', 'daily-series', 'weekly-race', 'weekly-series'];
  for (let i = 0; i < chBtns.length && i < order.length; i++) {
    chBtns[i].textContent = cm[order[i]];
  }

  _setText('leaderboard-menu-btn', d.overlay.leaderboardBtn);

  const gh = document.querySelector('#overlay .github-link');
  if (gh) gh.textContent = d.overlay.github;

  const resH2 = document.querySelector('#results h2');
  if (resH2) resH2.textContent = d.results.titleDefault;
  _setAttr('copy-track-btn', 'title', d.results.copyTrackTitle);
  _setAttr('share-btn', 'title', d.results.shareTitle);
  _setText('share-btn', d.results.shareBtn);
  _setText('leaderboard-btn', d.results.leaderboardBtn);
  _setText('results-prompt', d.results.promptRetryMenu);

  const lbH2 = document.querySelector('#leaderboard h2');
  if (lbH2) lbH2.textContent = d.leaderboard.title;
  _setText('leaderboard-back', d.leaderboard.back);

  const recH2 = document.querySelector('#records h2');
  if (recH2) recH2.textContent = d.records.title;
  _setText('records-back', d.records.back);

  const setLabel = document.querySelectorAll('#settings .track-label');
  for (let i = 0; i < setLabel.length; i++) {
    const el = setLabel[i];
    const id = el.id;
    if (id === 'headlight-shape-label') el.textContent = d.settings.shape;
    else if (id === 'underglow-opacity-label') { /* percentage updated live */ }
    else {
      const t = el.textContent.trim();
      if (t === 'PATTERN') el.textContent = d.settings.pattern;
      else if (t === 'PRIMARY') el.textContent = d.settings.primary;
      else if (t === 'SECONDARY') el.textContent = d.settings.secondary;
      else if (t === 'HEADLIGHTS') el.textContent = d.settings.headlights;
      else if (t === 'UNDERGLOW') el.textContent = d.settings.underglow;
    }
  }

  const prevMode = document.querySelectorAll('#preview-mode-toggle .seg-option');
  if (prevMode[0]) prevMode[0].textContent = d.settings.previewDay;
  if (prevMode[1]) prevMode[1].textContent = d.settings.previewNight;

  const prevDrive = document.querySelectorAll('#preview-drive-toggle .seg-option');
  if (prevDrive[0]) prevDrive[0].textContent = d.settings.previewIdle;
  if (prevDrive[1]) prevDrive[1].textContent = d.settings.previewRunning;

  _setText('settings-back', d.settings.back);

  const tz = document.querySelectorAll('.touch-zone-label');
  if (tz[0]) tz[0].textContent = d.touch.steer;
  if (tz[1]) tz[1].textContent = d.touch.gasBrake;
}
