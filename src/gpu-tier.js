/**
 * Adaptive pixel ratio tiering + startup MSAA heuristic.
 * Tier 0 = highest quality (max DPR), higher index = lower load.
 */

export const GPU_TIER_PIXEL_RATIOS = Object.freeze([2, 1.5, 1.25, 1]);

const EMA_ALPHA = 0.08;
/** Above this (seconds/frame) we try to lower tier (~42 FPS if sustained). */
const DEGRADE_EMA_S = 0.024;
/** Below this we try to raise tier (~70 FPS). */
const UPGRADE_EMA_S = 0.013;
const DEGRADE_COOLDOWN_S = 2.2;
const UPGRADE_COOLDOWN_S = 4;

/** Initial tier index (0..GPU_TIER_PIXEL_RATIOS.length-1). */
export function initialGpuTierIndex() {
  const maxIdx = GPU_TIER_PIXEL_RATIOS.length - 1;
  let t = 0;
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 8) : 8;
  if (cores <= 4) t = 2;
  else if (cores <= 6) t = 1;
  if (typeof navigator !== 'undefined' && navigator.deviceMemory != null && navigator.deviceMemory <= 4) {
    t = Math.max(t, 2);
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(pointer: coarse)').matches) t = Math.max(t, 1);
  }
  return Math.min(t, maxIdx);
}

/** Fewer CPU cores / memory → disable MSAA (cheaper fill). */
export function preferWebglAntialias() {
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 8) : 8;
  if (cores <= 4) return false;
  if (typeof navigator !== 'undefined' && navigator.deviceMemory != null && navigator.deviceMemory <= 4) {
    return false;
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(pointer: coarse)').matches) return false;
  }
  return true;
}

/**
 * @param {{ tierIndex: number, frameTimeEma: number, cooldown: number }} state
 * @param {number} dt
 * @returns {boolean} true if tier changed
 */
export function stepGpuTier(state, dt) {
  state.frameTimeEma = state.frameTimeEma * (1 - EMA_ALPHA) + dt * EMA_ALPHA;
  if (state.cooldown > 0) {
    state.cooldown -= dt;
    return false;
  }
  const maxIdx = GPU_TIER_PIXEL_RATIOS.length - 1;
  if (state.frameTimeEma > DEGRADE_EMA_S && state.tierIndex < maxIdx) {
    state.tierIndex++;
    state.cooldown = DEGRADE_COOLDOWN_S;
    return true;
  }
  if (state.frameTimeEma < UPGRADE_EMA_S && state.tierIndex > 0) {
    state.tierIndex--;
    state.cooldown = UPGRADE_COOLDOWN_S;
    return true;
  }
  return false;
}
