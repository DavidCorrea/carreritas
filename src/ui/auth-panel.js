import { strings } from '../strings.js';

export default class AuthPanel {
  constructor(countries, countryFlag) {
    this._authEl = document.getElementById('auth');
    this._authForm = document.getElementById('auth-form');
    this._authTitle = document.getElementById('auth-title');
    this._authUsernameInput = document.getElementById('auth-username');
    this._authPasswordInput = document.getElementById('auth-password');
    this._authCountrySelect = document.getElementById('auth-country');
    this._authSubmitBtn = document.getElementById('auth-submit-btn');
    this._authError = document.getElementById('auth-error');
    this._authToggleText = document.getElementById('auth-toggle');
    this._authClose = document.getElementById('auth-close');
    this._isRegister = false;

    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = strings.auth.countryPlaceholder;
    this._authCountrySelect.appendChild(opt);
    for (let i = 0; i < countries.length; i++) {
      const o = document.createElement('option');
      o.value = countries[i][0];
      o.textContent = countryFlag(countries[i][0]) + ' ' + countries[i][1];
      this._authCountrySelect.appendChild(o);
    }
  }

  _setMode(register) {
    this._isRegister = register;
    this._authError.textContent = '';
    const da = strings.document.auth;
    if (register) {
      this._authTitle.textContent = da.titleRegister;
      this._authSubmitBtn.textContent = da.submitRegister;
      this._authToggleText.innerHTML = da.toggleToLogin;
      this._authCountrySelect.style.display = '';
    } else {
      this._authTitle.textContent = da.titleLogin;
      this._authSubmitBtn.textContent = da.submitLogin;
      this._authToggleText.innerHTML = da.toggleToRegister;
      this._authCountrySelect.style.display = 'none';
    }
    const self = this;
    document.getElementById('auth-switch').addEventListener('click', function () {
      self._setMode(!self._isRegister);
    });
  }

  show() { this._authEl.classList.add('visible'); }
  hide() { this._authEl.classList.remove('visible'); }
  isOpen() { return this._authEl.classList.contains('visible'); }

  showLogin() {
    this._setMode(false);
    this._authUsernameInput.value = '';
    this._authPasswordInput.value = '';
    this._authCountrySelect.value = '';
    this._authEl.classList.add('visible');
    this._authUsernameInput.focus();
  }

  setError(msg) { this._authError.textContent = msg; }
  setSubmitting(busy) { this._authSubmitBtn.disabled = busy; }
  clearError() { this._authError.textContent = ''; }

  getCredentials() {
    return {
      username: this._authUsernameInput.value.trim(),
      password: this._authPasswordInput.value,
      country: this._authCountrySelect.value,
      isRegister: this._isRegister
    };
  }

  setCloseText(text) { this._authClose.textContent = text; }

  onSubmit(handler) { this._authForm.addEventListener('submit', handler); }
  onClose(handler) { this._authClose.addEventListener('click', handler); }

  handleEscapeKey(context) {
    if (this.isOpen()) {
      context.hideAuthPanel();
    }
  }
  handleEnterKey(_context) {}
  handleSpaceKey(_context) {}
}
