/**
 * Round-trip for compact share tokens (public helpers in track-descriptor).
 * Run: npm test
 */
import assert from 'assert';
import {
  encodeTrackShareToken,
  decodeTrackShareToken,
  TRACK_CODE_LENGTH,
  normalizeTrackCode
} from '../src/utils/track-descriptor.js';
import { FwdDirection, RevDirection } from '../src/directions/index.js';
import { DayMode, NightMode } from '../src/modes/index.js';

const code = 'x'.repeat(TRACK_CODE_LENGTH);
const t = encodeTrackShareToken(code, new FwdDirection(), new DayMode(), 3);
assert.ok(t.startsWith('r1.'), 'prefix');
const back = decodeTrackShareToken(t);
assert.strictEqual(back.code, normalizeTrackCode(code));
assert.strictEqual(back.laps, 3);
assert.ok(back.direction.isFwd());
assert.ok(back.mode.isDay());

const t2 = encodeTrackShareToken(code, new RevDirection(), new NightMode(), 12);
const back2 = decodeTrackShareToken(t2);
assert.ok(back2.direction.isRev());
assert.ok(back2.mode.isNight());
assert.strictEqual(back2.laps, 12);

assert.strictEqual(decodeTrackShareToken('bad'), null);
assert.strictEqual(decodeTrackShareToken('r1.not-base64!!!'), null);
