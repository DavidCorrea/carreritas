import Storage from './storage.js';

const storage = Storage.shared;

export default class Auth {
  constructor() {
    this.token = null;
  }

  isLoggedIn() {
    return !!this.token;
  }

  getToken() {
    return this.token;
  }

  loadAuth() {
    const saved = storage.getAuthRecord();
    if (saved && saved.token) {
      this.token = saved.token;
      return true;
    }
    return false;
  }

  persistAuth(token) {
    this.token = token;
    storage.mergeAuthRecord({ token });
  }

  clearAuth() {
    this.token = null;
    storage.removeAuthRecord();
  }
}
