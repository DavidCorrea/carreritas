/** Base + concrete challenge modes in one module to avoid circular imports between these files. */

export default class ChallengeMode {
  isDailyRace() { return false; }
  isDailySeries() { return false; }
  isWeeklyRace() { return false; }
  isWeeklySeries() { return false; }
  isNone() { return false; }
  isSeries() { return false; }
  equals(other) { return this.constructor === other.constructor; }
  toString() { throw new Error('Subclass must implement toString()'); }
  /** API / menu `data-val` id, e.g. `daily-race`. Display labels live in `strings.js`. */
  slug() { return null; }
  toKey(_dateStr, _mondayStr) { throw new Error('Subclass must implement toKey()'); }

  static fromString(str) {
    if (!str) return new NoneMode();
    if (str === 'daily-race') return new DailyRaceMode();
    if (str === 'daily-series') return new DailySeriesMode();
    if (str === 'weekly-race') return new WeeklyRaceMode();
    if (str === 'weekly-series') return new WeeklySeriesMode();
    return new NoneMode();
  }
}

export class NoneMode extends ChallengeMode {
  isNone() { return true; }
  toString() { return ''; }
  toKey(_dateStr, _mondayStr) { return null; }
}

export class DailyRaceMode extends ChallengeMode {
  isDailyRace() { return true; }
  slug() { return 'daily-race'; }
  toString() { return 'DAILY RACE'; }
  toKey(dateStr, _mondayStr) { return 'dr:' + dateStr; }
}

export class DailySeriesMode extends ChallengeMode {
  isDailySeries() { return true; }
  isSeries() { return true; }
  slug() { return 'daily-series'; }
  toString() { return 'DAILY SERIES'; }
  toKey(dateStr, _mondayStr) { return 'ds:' + dateStr; }
}

export class WeeklyRaceMode extends ChallengeMode {
  isWeeklyRace() { return true; }
  slug() { return 'weekly-race'; }
  toString() { return 'WEEKLY RACE'; }
  toKey(_dateStr, mondayStr) { return 'wr:' + mondayStr; }
}

export class WeeklySeriesMode extends ChallengeMode {
  isWeeklySeries() { return true; }
  isSeries() { return true; }
  slug() { return 'weekly-series'; }
  toString() { return 'WEEKLY SERIES'; }
  toKey(_dateStr, mondayStr) { return 'ws:' + mondayStr; }
}
