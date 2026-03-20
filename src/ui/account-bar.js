export default class AccountBar {
  constructor() {
    this._accountBar = document.getElementById('account-bar');
    this._accountUsername = document.getElementById('account-username');
    this._logoutBtn = document.getElementById('logout-btn');
    this._loginBtn = document.getElementById('login-btn');
  }

  show() { this._accountBar.style.display = ''; }
  hide() { this._accountBar.style.display = 'none'; }

  update(loggedIn, username, country, countryFlag) {
    if (loggedIn) {
      this._accountUsername.textContent = (country ? countryFlag(country) + ' ' : '') + username;
      this._loginBtn.style.display = 'none';
      this._logoutBtn.style.display = '';
    } else {
      this._accountUsername.textContent = '';
      this._loginBtn.style.display = '';
      this._logoutBtn.style.display = 'none';
    }
  }

  onLogin(handler) { this._loginBtn.addEventListener('click', handler); }
  onLogout(handler) { this._logoutBtn.addEventListener('click', handler); }
}
