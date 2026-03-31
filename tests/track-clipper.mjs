/**
 * Clipper road offset: simple annulus (two loops), finite geometry for track-like splines.
 * Inlines the same control-point recipe as TrackCode (no Constants / car stack in Node).
 */
import assert from 'assert';
import * as THREE from 'three';
import { buildClipperOffsetRingsFromCurve } from '../src/track-clipper.js';

const TRACK_CODE_LENGTH = 36;

function normalizeTrackCode(code) {
  let str = code || '';
  if (str.length === 0) str = '!';
  while (str.length < TRACK_CODE_LENGTH) str += str[str.length - 1];
  return str.substring(0, TRACK_CODE_LENGTH);
}

function computeTrackPoints2D(code) {
  const str = normalizeTrackCode(code);
  const radii = [];
  for (let i = 0; i < TRACK_CODE_LENGTH; i++) {
    const c = str.charCodeAt(i);
    const norm = (Math.min(Math.max(c, 32), 126) - 32) / 94;
    radii.push(100 + norm * 320);
  }
  function smoothRadiiRing(arr) {
    const out = [];
    for (let i = 0; i < TRACK_CODE_LENGTH; i++) {
      const prev = arr[(i + TRACK_CODE_LENGTH - 1) % TRACK_CODE_LENGTH];
      const curr = arr[i];
      const next = arr[(i + 1) % TRACK_CODE_LENGTH];
      out.push(prev * 0.2 + curr * 0.6 + next * 0.2);
    }
    return out;
  }
  let smoothed = smoothRadiiRing(radii);
  smoothed = smoothRadiiRing(smoothed);
  let shift = 0;
  for (let i = 0; i < str.length; i++) shift += str.charCodeAt(i);
  shift = shift % TRACK_CODE_LENGTH;
  const points = [];
  for (let i = 0; i < TRACK_CODE_LENGTH; i++) {
    const idx = (i + shift) % TRACK_CODE_LENGTH;
    const angle = (idx / TRACK_CODE_LENGTH) * Math.PI * 2;
    points.push({ x: Math.cos(angle) * smoothed[idx], y: Math.sin(angle) * smoothed[idx] });
  }
  return points;
}

function curveFromCodeString(code) {
  const pts2d = computeTrackPoints2D(code);
  const pts = pts2d.map((p) => new THREE.Vector3(p.x, 0, p.y));
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
}

function finiteVec3(v) {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

function randomCode() {
  let s = '';
  for (let i = 0; i < TRACK_CODE_LENGTH; i++) {
    s += String.fromCharCode(32 + Math.floor(Math.random() * 94));
  }
  return s;
}

const circlePts = [];
for (let i = 0; i < 48; i++) {
  const u = (i / 48) * Math.PI * 2;
  circlePts.push(new THREE.Vector3(Math.cos(u) * 200, 0, Math.sin(u) * 200));
}
const circleCurve = new THREE.CatmullRomCurve3(circlePts, true, 'centripetal');
const circleRings = buildClipperOffsetRingsFromCurve(circleCurve, 200, 24);
assert.ok(circleRings && circleRings.inner.length >= 3 && circleRings.outer.length >= 3, 'circle annulus');

for (let trial = 0; trial < 80; trial++) {
  const curve = curveFromCodeString(randomCode());
  const rings = buildClipperOffsetRingsFromCurve(curve, 400, 24);
  assert.ok(rings != null, `trial ${trial}: clipper should succeed for track-like codes`);
  assert.ok(rings.inner.length >= 3 && rings.outer.length >= 3, 'two non-degenerate loops');
  for (const p of rings.inner) assert.ok(finiteVec3(p), 'inner finite');
  for (const p of rings.outer) assert.ok(finiteVec3(p), 'outer finite');
}

console.log('track-clipper ok');
