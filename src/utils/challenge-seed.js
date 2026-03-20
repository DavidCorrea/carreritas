import { Direction } from '../directions/index.js';
import { Mode } from '../modes/index.js';
import { strings, formatPlaceholders } from '../strings.js';
import { pickRandom } from './core.js';

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function seededCode(rng) {
  let out = '';
  for (let i = 0; i < 18; i++) {
    out += String.fromCharCode(33 + Math.floor(rng() * 94));
  }
  return out;
}

export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function utcDateStr() {
  const now = new Date();
  return now.getUTCFullYear() + '-' +
    String(now.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(now.getUTCDate()).padStart(2, '0');
}

export function utcMondayStr() {
  const now = new Date();
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
  return monday.getUTCFullYear() + '-' +
    String(monday.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(monday.getUTCDate()).padStart(2, '0');
}

export function seededRaceConfig(seed) {
  const rng = mulberry32(hashString(seed));
  return {
    code: seededCode(rng),
    direction: Direction.fromBoolean(rng() > 0.5),
    mode: Mode.fromBoolean(rng() > 0.5),
    laps: Math.floor(rng() * 5) + 1
  };
}

export function seededSeriesConfig(seed) {
  const rng = mulberry32(hashString(seed));
  const count = Math.floor(rng() * 4) + 2;
  const stages = [];
  for (let i = 0; i < count; i++) {
    stages.push({
      code: seededCode(rng),
      direction: Direction.fromBoolean(rng() > 0.5),
      mode: Mode.fromBoolean(rng() > 0.5)
    });
  }
  return {
    stages,
    stageCount: count,
    laps: Math.floor(rng() * 5) + 1
  };
}

export function dailyConfig() {
  return seededRaceConfig(utcDateStr());
}

export function dailySeriesConfig() {
  return seededSeriesConfig('ds-' + utcDateStr());
}

export function weeklyRaceConfig() {
  const config = seededRaceConfig('wr-' + utcMondayStr());
  config.laps = 5;
  return config;
}

export function weeklySeriesConfig() {
  const config = seededSeriesConfig('ws-' + utcMondayStr());
  config.laps = 5;
  return config;
}

export function challengeResetMs(cm) {
  const now = new Date();
  if (cm.isDailyRace() || cm.isDailySeries()) {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
  }
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7 - daysSinceMonday) - now.getTime();
}

export function formatCountdown(ms) {
  const tc = strings.timeCountdown;
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return tc.withDays(d, h, m);
  if (h > 0) return tc.withHours(h, m, s);
  return tc.withMinutes(m, s);
}

export function challengeKey(cm) {
  if (cm.isNone()) return null;
  return cm.toKey(utcDateStr(), utcMondayStr());
}

export function challengeLabel(cm) {
  if (cm.isNone()) return null;
  const slug = cm.slug();
  return strings.challengeModes[slug] || cm.toString();
}

export function challengeConfigForMode(cm) {
  if (cm.isDailyRace()) return { type: 'race', config: dailyConfig() };
  if (cm.isDailySeries()) return { type: 'series', config: dailySeriesConfig() };
  if (cm.isWeeklyRace()) return { type: 'race', config: weeklyRaceConfig() };
  if (cm.isWeeklySeries()) return { type: 'series', config: weeklySeriesConfig() };
  return null;
}

export function challengeStatsMessage(totalCount, userRank, isLoggedIn) {
  const cs = strings.challengeStats;
  const taunts = strings.challengeTaunts;
  if (totalCount === 0) return pickRandom(cs.empty);
  if (!isLoggedIn) return formatPlaceholders(pickRandom(cs.notLoggedIn), { n: totalCount });
  if (!userRank) return formatPlaceholders(pickRandom(cs.notParticipated), { n: totalCount });
  if (userRank === 1) return formatPlaceholders(pickRandom(cs.first), { n: totalCount });
  const ratio = userRank / totalCount;
  const pool = ratio <= 0.2 ? taunts.close : ratio <= 0.5 ? taunts.mid : taunts.far;
  return formatPlaceholders(pickRandom(cs.ranked), {
    n: totalCount,
    rank: userRank,
    taunt: pickRandom(pool)
  });
}
