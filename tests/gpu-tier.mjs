/**
 * Client-style module run in Node (no navigator / matchMedia).
 */
import assert from 'assert';
import {
  GPU_TIER_PIXEL_RATIOS,
  initialGpuTierIndex,
  stepGpuTier
} from '../src/gpu-tier.js';

assert.ok(Array.isArray(GPU_TIER_PIXEL_RATIOS));
assert.ok(GPU_TIER_PIXEL_RATIOS.length >= 2);
assert.ok(GPU_TIER_PIXEL_RATIOS.every((x) => x > 0 && x <= 2));

const idx = initialGpuTierIndex();
assert.ok(idx >= 0 && idx < GPU_TIER_PIXEL_RATIOS.length);

const state = { tierIndex: GPU_TIER_PIXEL_RATIOS.length - 1, frameTimeEma: 0.03, cooldown: 0 };
let tierChanges = 0;
for (let i = 0; i < 400; i++) {
  if (stepGpuTier(state, 0.016)) tierChanges++;
}
assert.ok(state.tierIndex >= 0 && state.tierIndex < GPU_TIER_PIXEL_RATIOS.length);

console.log('tests/gpu-tier.mjs ok');
