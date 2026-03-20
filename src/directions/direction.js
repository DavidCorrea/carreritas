/** Base + concrete directions in one module to avoid circular imports between these files. */

export default class Direction {
  isFwd() { return false; }
  isRev() { return false; }
  equals(other) { return this.constructor === other.constructor; }
  toString() { throw new Error('Subclass must implement toString()'); }
  toChar() { throw new Error('Subclass must implement toChar()'); }

  static fromBoolean(reversed) {
    return reversed ? new RevDirection() : new FwdDirection();
  }

  static fromString(str) {
    if (!str) return new FwdDirection();
    const upper = str.toUpperCase();
    if (upper === 'R' || upper === 'REV') return new RevDirection();
    return new FwdDirection();
  }
}

export class FwdDirection extends Direction {
  isFwd() { return true; }
  toString() { return 'FWD'; }
  toChar() { return 'F'; }
}

export class RevDirection extends Direction {
  isRev() { return true; }
  toString() { return 'REV'; }
  toChar() { return 'R'; }
}
