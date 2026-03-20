import Storage from './storage.js';

const storage = Storage.shared;

export default class UserProfile {
  constructor() {
    this.username = null;
    this.country = null;
  }

  getUsername() {
    return this.username;
  }

  getCountry() {
    return this.country;
  }

  load() {
    const saved = storage.getAuthRecord();
    if (saved && saved.username) {
      this.username = saved.username;
      this.country = saved.country || null;
      return true;
    }
    return false;
  }

  save(username, country) {
    this.username = username;
    this.country = country || null;
    storage.mergeAuthRecord({
      username,
      country: country || null
    });
  }

  clear() {
    this.username = null;
    this.country = null;
    storage.clearAuthProfileKeepToken();
  }
}
