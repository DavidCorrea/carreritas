export default class InputContext {
  constructor() {
    this.active = null;
  }

  setActive(component) {
    this.active = component;
  }

  clear(component) {
    if (this.active === component) {
      this.active = null;
    }
  }

  getActiveHandler(keyName) {
    if (this.active && this.active['handle' + keyName]) {
      return this.active;
    }
    return null;
  }
}
