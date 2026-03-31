/**
 * Mirrors src/utils/challenge-seed.js for server-side challenge config from a challenge_key.
 * Keys: dr:|ds:|wr:|ws: + YYYY-MM-DD (daily) or week Monday (weekly).
 */

/** Keep in sync with `TRACK_CODE_LENGTH` in src/utils/track-descriptor.js */
const TRACK_CODE_LENGTH = 36;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function seededCode(rng) {
  let out = '';
  for (let i = 0; i < TRACK_CODE_LENGTH; i++) {
    out += String.fromCharCode(33 + Math.floor(rng() * 94));
  }
  return out;
}

function seededRaceConfig(seed) {
  const rng = mulberry32(hashString(seed));
  return {
    code: seededCode(rng),
    laps: Math.floor(rng() * 5) + 1,
    reversed: rng() > 0.5,
    night_mode: rng() > 0.5
  };
}

function seededSeriesConfig(seed) {
  const rng = mulberry32(hashString(seed));
  const count = Math.floor(rng() * 4) + 2;
  const stages = [];
  for (let i = 0; i < count; i++) {
    stages.push({
      code: seededCode(rng),
      reversed: rng() > 0.5,
      night_mode: rng() > 0.5
    });
  }
  return {
    stages,
    stageCount: count,
    laps: Math.floor(rng() * 5) + 1
  };
}

/**
 * @returns {{ type: 'race', config: object } | { type: 'series', config: object } | null}
 */
function configForChallengeKey(key) {
  if (!key || typeof key !== 'string') return null;
  const m = key.match(/^(dr|ds|wr|ws):(.+)$/);
  if (!m) return null;
  const kind = m[1];
  const rest = m[2];

  if (kind === 'dr') {
    return { type: 'race', config: seededRaceConfig(rest) };
  }
  if (kind === 'ds') {
    return { type: 'series', config: seededSeriesConfig('ds-' + rest) };
  }
  if (kind === 'wr') {
    const c = seededRaceConfig('wr-' + rest);
    c.laps = 5;
    return { type: 'race', config: c };
  }
  if (kind === 'ws') {
    const c = seededSeriesConfig('ws-' + rest);
    c.laps = 5;
    return { type: 'series', config: c };
  }
  return null;
}

/**
 * Expected stage descriptors for a series challenge key (same order as client).
 * @returns {Array<{ code: string, laps: number, reversed: boolean, night_mode: boolean }>}
 */
function seriesStagesForChallengeKey(key) {
  const parsed = configForChallengeKey(key);
  if (!parsed || parsed.type !== 'series') return null;
  const laps = parsed.config.laps;
  return parsed.config.stages.map(function (s) {
    return {
      code: s.code,
      laps,
      reversed: s.reversed,
      night_mode: s.night_mode
    };
  });
}

module.exports = {
  configForChallengeKey,
  seriesStagesForChallengeKey,
  seededRaceConfig,
  seededSeriesConfig
};
