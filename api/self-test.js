/**
 * Minimal sanity checks for server challenge helpers (no DB).
 * Run: npm test
 */
const assert = require('assert');
const { configForChallengeKey, seriesStagesForChallengeKey } = require('./_challenge-seed.js');

const race = configForChallengeKey('dr:2025-03-17');
assert.ok(race && race.type === 'race' && typeof race.config.code === 'string');

const seriesKey = 'ds:2025-03-17';
const stages = seriesStagesForChallengeKey(seriesKey);
assert.ok(stages && stages.length >= 2);
assert.strictEqual(typeof stages[0].code, 'string');
assert.strictEqual(typeof stages[0].laps, 'number');

console.log('api self-test ok');
