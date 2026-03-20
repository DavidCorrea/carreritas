import { strings } from '../strings.js';

export default class SettingsPanel {
  constructor() {
    this._settingsEl = document.getElementById('settings');
    this._settingsBtn = document.getElementById('settings-btn');
    this._settingsBackEl = document.getElementById('settings-back');
    this._colorPrimaryEl = document.getElementById('color-primary');
    this._colorSecondaryEl = document.getElementById('color-secondary');
    this._colorHeadlightsEl = document.getElementById('color-headlights');
    this._headlightShapeEl = document.getElementById('headlight-shape');
    this._colorUnderglowEl = document.getElementById('color-underglow');
    this._underglowOpacityEl = document.getElementById('underglow-opacity');
    this._underglowOpacityLabel = document.getElementById('underglow-opacity-label');
    this._patternOptionsEl = document.getElementById('pattern-options');
    this._previewModeToggle = document.getElementById('preview-mode-toggle');
    this._previewCameraToggle = document.getElementById('preview-camera-toggle');
    this._previewDriveToggle = document.getElementById('preview-drive-toggle');
    this._patternClickHandler = null;
  }

  _selectToggle(toggle, val) {
    const sel = toggle.querySelector('.selected');
    if (sel) sel.classList.remove('selected');
    toggle.querySelector('[data-val="' + val + '"]').classList.add('selected');
  }

  show() { this._settingsEl.classList.remove('hidden'); }
  hide() { this._settingsEl.classList.add('hidden'); }
  isOpen() { return !this._settingsEl.classList.contains('hidden'); }

  showBackButton(visible) { this._settingsBackEl.style.display = visible ? '' : 'none'; }

  setCarSettings(settings) {
    this._colorPrimaryEl.value = settings.primaryColor;
    this._colorSecondaryEl.value = settings.secondaryColor;
    this._colorHeadlightsEl.value = settings.headlightsColor;
    this._headlightShapeEl.value = settings.headlightShape;
    this._colorUnderglowEl.value = settings.underglowColor;
    this._underglowOpacityEl.value = settings.underglowOpacity;
    this._underglowOpacityLabel.textContent = settings.underglowOpacity + '%';
  }

  buildPatternButtons(patterns, selected, drawFn, primaryColor, secondaryColor) {
    this._patternOptionsEl.innerHTML = '';
    for (let i = 0; i < patterns.length; i++) {
      const p = patterns[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pattern-btn' + (p === selected || (p.name && selected && p.name === selected.name) ? ' selected' : '');
      btn.dataset.pattern = p.name;
      const cvs = document.createElement('canvas');
      cvs.width = 64;
      cvs.height = 64;
      drawFn(cvs, p, primaryColor, secondaryColor);
      btn.appendChild(cvs);
      this._patternOptionsEl.appendChild(btn);
    }
  }

  updatePatternPreviews(drawFn, primaryColor, secondaryColor, patterns) {
    const buttons = this._patternOptionsEl.querySelectorAll('.pattern-btn');
    for (let i = 0; i < buttons.length; i++) {
      const cvs = buttons[i].querySelector('canvas');
      const patternName = buttons[i].dataset.pattern;
      const pattern = patterns.find(function(p) { return p.name === patternName; });
      if (pattern) {
        drawFn(cvs, pattern, primaryColor, secondaryColor);
      }
    }
  }

  buildCameraToggle(modes, currentIndex, showcaseActive) {
    this._previewCameraToggle.innerHTML = '';
    const showcaseBtn = document.createElement('button');
    showcaseBtn.type = 'button';
    showcaseBtn.className = 'seg-option' + (showcaseActive ? ' selected' : '');
    showcaseBtn.dataset.val = 'showcase';
    showcaseBtn.textContent = strings.settings.showcase;
    this._previewCameraToggle.appendChild(showcaseBtn);
    for (let i = 0; i < modes.length; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seg-option' + (!showcaseActive && i === currentIndex ? ' selected' : '');
      btn.dataset.val = String(i);
      btn.textContent = strings.camera.labels[modes[i].name] || modes[i].name;
      this._previewCameraToggle.appendChild(btn);
    }
  }

  setPreviewMode(night) { this._selectToggle(this._previewModeToggle, night ? 'NIGHT' : 'DAY'); }
  setPreviewDrive(running) { this._selectToggle(this._previewDriveToggle, running ? 'RUNNING' : 'IDLE'); }

  onOpen(handler) { this._settingsBtn.addEventListener('click', handler); }
  onBack(handler) { this._settingsBackEl.addEventListener('click', handler); }

  onPatternSelect(handler, patterns) {
    if (this._patternClickHandler) {
      this._patternOptionsEl.removeEventListener('click', this._patternClickHandler);
    }
    const self = this;
    this._patternClickHandler = function (e) {
      const btn = e.target?.closest('.pattern-btn');
      if (!btn) return;
      const sel = self._patternOptionsEl.querySelector('.selected');
      if (sel) sel.classList.remove('selected');
      btn.classList.add('selected');
      const patternName = btn.dataset.pattern;
      const pattern = patterns.find(function(p) { return p.name === patternName; });
      if (pattern) {
        handler(pattern);
      }
    };
    this._patternOptionsEl.addEventListener('click', this._patternClickHandler);
  }

  onColorChange(handler) {
    const primary = this._colorPrimaryEl;
    const secondary = this._colorSecondaryEl;
    primary.addEventListener('input', function () { handler('primaryColor', primary.value); });
    secondary.addEventListener('input', function () { handler('secondaryColor', secondary.value); });
  }

  onHeadlightChange(handler) {
    const el = this._colorHeadlightsEl;
    el.addEventListener('input', function () { handler('headlightsColor', el.value); });
  }

  /** While dragging; fires often (no heavy GPU work here). */
  onHeadlightShapeInput(handler) {
    const el = this._headlightShapeEl;
    el.addEventListener('input', function () { handler(parseInt(el.value, 10)); });
  }

  /** Once per commit (mouseup / keyboard); use for mesh rebuilds. */
  onHeadlightShapeCommit(handler) {
    const el = this._headlightShapeEl;
    el.addEventListener('change', function () { handler(parseInt(el.value, 10)); });
  }

  onUnderglowChange(handler) {
    const el = this._colorUnderglowEl;
    el.addEventListener('input', function () { handler('underglowColor', el.value); });
  }

  onUnderglowOpacityChange(handler) {
    const self = this;
    this._underglowOpacityEl.addEventListener('input', function () {
      const val = parseInt(self._underglowOpacityEl.value);
      self._underglowOpacityLabel.textContent = val + '%';
      handler(val);
    });
  }

  onPreviewModeToggle(handler) {
    const self = this;
    this._previewModeToggle.addEventListener('click', function (e) {
      const btn = e.target?.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      self._previewModeToggle.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      handler(btn.dataset.val === 'NIGHT');
    });
  }

  onPreviewCameraToggle(handler) {
    const self = this;
    this._previewCameraToggle.addEventListener('click', function (e) {
      const btn = e.target?.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      self._previewCameraToggle.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      handler(btn.dataset.val);
    });
  }

  onPreviewDriveToggle(handler) {
    const self = this;
    this._previewDriveToggle.addEventListener('click', function (e) {
      const btn = e.target?.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      self._previewDriveToggle.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      handler(btn.dataset.val === 'RUNNING');
    });
  }

  handleEscapeKey(context) {
    if (this.isOpen()) {
      context.hideSettings();
    }
  }
  handleEnterKey(_context) {}
  handleSpaceKey(_context) {}
}
