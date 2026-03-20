/** Base + concrete modes in one module to avoid circular imports between these files. */

export default class Mode {
  isDay() { return false; }
  isNight() { return false; }
  equals(other) { return this.constructor === other.constructor; }
  toString() { throw new Error('Subclass must implement toString()'); }
  toChar() { throw new Error('Subclass must implement toChar()'); }

  static fromBoolean(nightMode) {
    return nightMode ? new NightMode() : new DayMode();
  }

  static fromString(str) {
    if (!str) return new DayMode();
    const upper = str.toUpperCase();
    if (upper === 'N' || upper === 'NIGHT') return new NightMode();
    return new DayMode();
  }
}

export class DayMode extends Mode {
  isDay() { return true; }
  toString() { return 'DAY'; }
  toChar() { return 'D'; }
}

export class NightMode extends Mode {
  isNight() { return true; }
  toString() { return 'NIGHT'; }
  toChar() { return 'N'; }
}
