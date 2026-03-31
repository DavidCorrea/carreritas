import { Direction } from '../directions/index.js';
import { Mode } from '../modes/index.js';

/** Control points around the loop; each character maps to a radius sample. */
export const TRACK_CODE_LENGTH = 36;

const SHARE_PREFIX = 'r1.';
const SHARE_VERSION = 1;
const SHARE_BODY_LEN = 40;

/**
 * Pad/truncate to `TRACK_CODE_LENGTH`. Padding repeats the last typed character so short
 * codes stay smooth; padding with spaces used to map every extra sector to minimum radius
 * (norm 0) and made partial codes look broken.
 * @param {string} [code]
 */
export function normalizeTrackCode(code) {
  let str = code || '';
  if (str.length === 0) str = '!';
  while (str.length < TRACK_CODE_LENGTH) str += str[str.length - 1];
  return str.substring(0, TRACK_CODE_LENGTH);
}

/** Shareable track line: `CODE` + direction + day/night + laps. */
export function formatDescriptor(code, dir, mod, laps) {
  const dirRes = dir instanceof Direction ? dir : Direction.fromBoolean(dir);
  const modeRes = mod instanceof Mode ? mod : Mode.fromBoolean(mod);
  return normalizeTrackCode(code) + ' ' + dirRes.toChar() + modeRes.toChar() + laps;
}

export function parseDescriptor(str) {
  const parts = str.split(' ');
  const result = { code: normalizeTrackCode(parts[0] || '') };
  if (parts.length > 1) {
    const meta = parts[1];
    result.direction = Direction.fromString(meta.charAt(0));
    result.mode = Mode.fromString(meta.charAt(1));
    const lapNum = parseInt(meta.substring(2), 10);
    if (lapNum > 0 && lapNum <= 20) result.laps = lapNum;
  }
  return result;
}

/** Random track code (same alphabet as seeded challenges). */
export function randomTrackCode() {
  let out = '';
  for (let i = 0; i < TRACK_CODE_LENGTH; i++) {
    out += String.fromCharCode(33 + Math.floor(Math.random() * 94));
  }
  return out;
}

function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Compact URL token (`r1.` + base64url). Avoids `%`-heavy query strings for symbolic track codes.
 * @param {string} code
 * @param {import('../directions/direction.js').default} direction
 * @param {import('../modes/mode.js').default} mode
 * @param {number} laps
 */
export function encodeTrackShareToken(code, direction, mode, laps) {
  const norm = normalizeTrackCode(code);
  const buf = new Uint8Array(SHARE_BODY_LEN);
  buf[0] = SHARE_VERSION;
  for (let i = 0; i < TRACK_CODE_LENGTH; i++) {
    const c = norm.charCodeAt(i);
    const b = Math.min(Math.max(c, 33), 126) - 33;
    buf[1 + i] = b;
  }
  const li = Math.min(20, Math.max(1, laps | 0));
  buf[1 + TRACK_CODE_LENGTH] = li;
  buf[2 + TRACK_CODE_LENGTH] = direction.isRev() ? 1 : 0;
  buf[3 + TRACK_CODE_LENGTH] = mode.isNight() ? 1 : 0;
  return SHARE_PREFIX + bytesToBase64Url(buf);
}

/**
 * @returns {null | { code: string, direction: import('../directions/direction.js').default, mode: import('../modes/mode.js').default, laps: number }}
 */
export function decodeTrackShareToken(str) {
  if (!str || typeof str !== 'string' || !str.startsWith(SHARE_PREFIX)) return null;
  let bytes;
  try {
    bytes = base64UrlToBytes(str.slice(SHARE_PREFIX.length));
  } catch {
    return null;
  }
  if (bytes.length !== SHARE_BODY_LEN || bytes[0] !== SHARE_VERSION) return null;
  let code = '';
  for (let i = 0; i < TRACK_CODE_LENGTH; i++) {
    const b = bytes[1 + i];
    if (b > 93) return null;
    code += String.fromCharCode(33 + b);
  }
  const laps = bytes[1 + TRACK_CODE_LENGTH];
  if (laps < 1 || laps > 20) return null;
  const d = bytes[2 + TRACK_CODE_LENGTH];
  const m = bytes[3 + TRACK_CODE_LENGTH];
  if (d > 1 || m > 1) return null;
  return {
    code,
    direction: Direction.fromBoolean(d === 1),
    mode: Mode.fromBoolean(m === 1),
    laps
  };
}
