import ClipperLib from 'clipper-lib';
import * as THREE from 'three';
import {
  clipperScale,
  clipperCenterlineMultiplier,
  clipperMaxCenterlinePoints,
  clipperArcToleranceFactor,
} from './track-clipper-config.js';

function signedAreaClipperPath(path) {
  let s = 0;
  const n = path.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    s += path[i].X * path[j].Y - path[j].X * path[i].Y;
  }
  return s * 0.5;
}

function intPathToVector3Ring(path) {
  const inv = 1 / clipperScale;
  return path.map((p) => new THREE.Vector3(p.X * inv, 0, p.Y * inv));
}

/**
 * Parallel road outline via Clipper offset (round joins, closed spine).
 * Returns null if offset is degenerate or topology is not a simple annulus.
 * @param {THREE.CatmullRomCurve3} curve
 * @param {number} divisions spine sample count (same order of magnitude as gameplay `n`)
 * @param {number} halfW half road width in world units
 * @returns {{ inner: THREE.Vector3[], outer: THREE.Vector3[] } | null}
 */
export function buildClipperOffsetRingsFromCurve(curve, divisions, halfW) {
  const mult = Math.max(1, clipperCenterlineMultiplier | 0);
  const maxPts = Math.max(32, clipperMaxCenterlinePoints | 0);
  let nClip = Math.max(8, (Math.max(8, divisions | 0) * mult) | 0);
  nClip = Math.min(nClip, maxPts);

  const centerline = [];
  for (let i = 0; i < nClip; i++) {
    const p = curve.getPointAt(i / nClip);
    centerline.push({
      X: Math.round(p.x * clipperScale),
      Y: Math.round(p.z * clipperScale),
    });
  }

  const deltaInt = Math.max(1, Math.round(halfW * clipperScale));
  const arcTol = Math.max(1, Math.round(deltaInt * clipperArcToleranceFactor));

  const co = new ClipperLib.ClipperOffset(2, arcTol);
  co.AddPath(centerline, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedLine);
  const solution = new ClipperLib.Paths();
  co.Execute(solution, deltaInt);

  if (solution.length !== 2) return null;
  const pathA = solution[0];
  const pathB = solution[1];
  if (pathA.length < 3 || pathB.length < 3) return null;

  const absA = Math.abs(signedAreaClipperPath(pathA));
  const absB = Math.abs(signedAreaClipperPath(pathB));
  const outerP = absA >= absB ? pathA : pathB;
  const innerP = absA >= absB ? pathB : pathA;

  if (ClipperLib.Clipper.PointInPolygon(innerP[0], outerP) !== 1) return null;

  return {
    inner: intPathToVector3Ring(innerP),
    outer: intPathToVector3Ring(outerP),
  };
}
