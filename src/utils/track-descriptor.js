import { Direction } from '../directions/index.js';
import { Mode } from '../modes/index.js';

/** Shareable track line: `CODE` + direction + day/night + laps. */
export function formatDescriptor(code, dir, mod, laps) {
  const dirRes = dir instanceof Direction ? dir : Direction.fromBoolean(dir);
  const modeRes = mod instanceof Mode ? mod : Mode.fromBoolean(mod);
  return code + ' ' + dirRes.toChar() + modeRes.toChar() + laps;
}

export function parseDescriptor(str) {
  const parts = str.split(' ');
  const result = { code: parts[0] || '' };
  if (parts.length > 1) {
    const meta = parts[1];
    result.direction = Direction.fromString(meta.charAt(0));
    result.mode = Mode.fromString(meta.charAt(1));
    const lapNum = parseInt(meta.substring(2), 10);
    if (lapNum > 0 && lapNum <= 20) result.laps = lapNum;
  }
  return result;
}

/** Random 18-character track code (same alphabet as seeded challenges). */
export function randomTrackCode() {
  let out = '';
  for (let i = 0; i < 18; i++) {
    out += String.fromCharCode(33 + Math.floor(Math.random() * 94));
  }
  return out;
}
