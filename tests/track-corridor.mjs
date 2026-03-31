/**
 * Boundary collision clearance is car radius + corridorShell (see player.trackCorridorCollision).
 * Half-width slack checks remain useful for pinch geometry vs nominal width.
 */
import assert from 'assert';
import { CAR_RADIUS } from '../src/intrinsic-constants.js';

/** Keep in sync with Constants.track.corridorShell + CAR_RADIUS (see player.trackCorridorCollision). */
const clearance = CAR_RADIUS + 0.85;

function halfAlongEdge(hi, hj, t) {
  return hi * (1 - t) + hj * t;
}

function inwardSlack(hi, hj, t) {
  return halfAlongEdge(hi, hj, t) - clearance;
}

assert.ok(inwardSlack(24, 24, 0.5) > 8, 'nominal half-width leaves slack');
assert.ok(inwardSlack(4, 4, 0) < 0, 'pinch below clearance is detectable');
assert.strictEqual(halfAlongEdge(10, 20, 0.5), 15, 'lerp along edge');

console.log('track-corridor ok');
