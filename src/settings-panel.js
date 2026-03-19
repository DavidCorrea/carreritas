export function createSettingsPanel() {
  var settingsEl = document.getElementById('settings');
  var settingsBtn = document.getElementById('settings-btn');
  var settingsBackEl = document.getElementById('settings-back');
  var colorPrimaryEl = document.getElementById('color-primary');
  var colorSecondaryEl = document.getElementById('color-secondary');
  var colorHeadlightsEl = document.getElementById('color-headlights');
  var headlightShapeEl = document.getElementById('headlight-shape');
  var colorUnderglowEl = document.getElementById('color-underglow');
  var underglowOpacityEl = document.getElementById('underglow-opacity');
  var underglowOpacityLabel = document.getElementById('underglow-opacity-label');
  var patternOptionsEl = document.getElementById('pattern-options');
  var previewModeToggle = document.getElementById('preview-mode-toggle');
  var previewCameraToggle = document.getElementById('preview-camera-toggle');
  var previewDriveToggle = document.getElementById('preview-drive-toggle');

  function selectToggle(toggle, val) {
    var sel = toggle.querySelector('.selected');
    if (sel) sel.classList.remove('selected');
    toggle.querySelector('[data-val="' + val + '"]').classList.add('selected');
  }

  return {
    show: function () { settingsEl.classList.remove('hidden'); },
    hide: function () { settingsEl.classList.add('hidden'); },
    isOpen: function () { return !settingsEl.classList.contains('hidden'); },

    showBackButton: function (visible) { settingsBackEl.style.display = visible ? '' : 'none'; },

    setCarSettings: function (settings) {
      colorPrimaryEl.value = settings.primaryColor;
      colorSecondaryEl.value = settings.secondaryColor;
      colorHeadlightsEl.value = settings.headlightsColor;
      headlightShapeEl.value = settings.headlightShape;
      colorUnderglowEl.value = settings.underglowColor;
      underglowOpacityEl.value = settings.underglowOpacity;
      underglowOpacityLabel.textContent = settings.underglowOpacity + '%';
    },

    buildPatternButtons: function (patterns, selected, drawFn, primaryColor, secondaryColor) {
      patternOptionsEl.innerHTML = '';
      for (var i = 0; i < patterns.length; i++) {
        var p = patterns[i];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pattern-btn' + (p === selected ? ' selected' : '');
        btn.dataset.pattern = p;
        var cvs = document.createElement('canvas');
        cvs.width = 64;
        cvs.height = 64;
        drawFn(cvs, p, primaryColor, secondaryColor);
        btn.appendChild(cvs);
        patternOptionsEl.appendChild(btn);
      }
    },

    updatePatternPreviews: function (drawFn, primaryColor, secondaryColor) {
      var buttons = patternOptionsEl.querySelectorAll('.pattern-btn');
      for (var i = 0; i < buttons.length; i++) {
        var cvs = buttons[i].querySelector('canvas');
        drawFn(cvs, buttons[i].dataset.pattern, primaryColor, secondaryColor);
      }
    },

    buildCameraToggle: function (modes, currentIndex, showcaseActive) {
      previewCameraToggle.innerHTML = '';
      var showcaseBtn = document.createElement('button');
      showcaseBtn.type = 'button';
      showcaseBtn.className = 'seg-option' + (showcaseActive ? ' selected' : '');
      showcaseBtn.dataset.val = 'showcase';
      showcaseBtn.textContent = 'SHOWCASE';
      previewCameraToggle.appendChild(showcaseBtn);
      for (var i = 0; i < modes.length; i++) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'seg-option' + (!showcaseActive && i === currentIndex ? ' selected' : '');
        btn.dataset.val = String(i);
        btn.textContent = modes[i];
        previewCameraToggle.appendChild(btn);
      }
    },

    setPreviewMode: function (night) { selectToggle(previewModeToggle, night ? 'NIGHT' : 'DAY'); },
    setPreviewDrive: function (running) { selectToggle(previewDriveToggle, running ? 'RUNNING' : 'IDLE'); },

    onOpen: function (handler) { settingsBtn.addEventListener('click', handler); },
    onBack: function (handler) { settingsBackEl.addEventListener('click', handler); },

    onPatternSelect: function (handler) {
      patternOptionsEl.addEventListener('click', function (e) {
        var btn = e.target.closest('.pattern-btn');
        if (!btn) return;
        var sel = patternOptionsEl.querySelector('.selected');
        if (sel) sel.classList.remove('selected');
        btn.classList.add('selected');
        handler(btn.dataset.pattern);
      });
    },

    onColorChange: function (handler) {
      colorPrimaryEl.addEventListener('input', function () { handler('primaryColor', colorPrimaryEl.value); });
      colorSecondaryEl.addEventListener('input', function () { handler('secondaryColor', colorSecondaryEl.value); });
    },

    onHeadlightChange: function (handler) {
      colorHeadlightsEl.addEventListener('input', function () { handler('headlightsColor', colorHeadlightsEl.value); });
    },

    onHeadlightShapeChange: function (handler) {
      headlightShapeEl.addEventListener('input', function () { handler(parseInt(headlightShapeEl.value)); });
    },

    onUnderglowChange: function (handler) {
      colorUnderglowEl.addEventListener('input', function () { handler('underglowColor', colorUnderglowEl.value); });
    },

    onUnderglowOpacityChange: function (handler) {
      underglowOpacityEl.addEventListener('input', function () {
        var val = parseInt(underglowOpacityEl.value);
        underglowOpacityLabel.textContent = val + '%';
        handler(val);
      });
    },

    onPreviewModeToggle: function (handler) {
      previewModeToggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.seg-option');
        if (!btn || btn.classList.contains('selected')) return;
        previewModeToggle.querySelector('.selected').classList.remove('selected');
        btn.classList.add('selected');
        handler(btn.dataset.val === 'NIGHT');
      });
    },

    onPreviewCameraToggle: function (handler) {
      previewCameraToggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.seg-option');
        if (!btn || btn.classList.contains('selected')) return;
        previewCameraToggle.querySelector('.selected').classList.remove('selected');
        btn.classList.add('selected');
        handler(btn.dataset.val);
      });
    },

    onPreviewDriveToggle: function (handler) {
      previewDriveToggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.seg-option');
        if (!btn || btn.classList.contains('selected')) return;
        previewDriveToggle.querySelector('.selected').classList.remove('selected');
        btn.classList.add('selected');
        handler(btn.dataset.val === 'RUNNING');
      });
    }
  };
}
