import Constants from './constants.js';

function computeTrackPoints2D(code) {
  let str = code;
  while (str.length < 18) str += ' ';
  str = str.substring(0, 18);

  const radii = [];
  for (let i = 0; i < 18; i++) {
    const c = str.charCodeAt(i);
    const norm = (Math.min(Math.max(c, 32), 126) - 32) / 94;
    radii.push(140 + norm * 240);
  }

  const smoothed = [];
  for (let i = 0; i < 18; i++) {
    const prev = radii[(i + 17) % 18];
    const curr = radii[i];
    const next = radii[(i + 1) % 18];
    smoothed.push(prev * 0.25 + curr * 0.5 + next * 0.25);
  }

  let shift = 0;
  for (let i = 0; i < str.length; i++) shift += str.charCodeAt(i);
  shift = shift % 18;

  const points = [];
  for (let i = 0; i < 18; i++) {
    const idx = (i + shift) % 18;
    const angle = (idx / 18) * Math.PI * 2;
    points.push({ x: Math.cos(angle) * smoothed[idx], y: Math.sin(angle) * smoothed[idx] });
  }
  return points;
}

function catmullRomPoint2D(p0, p1, p2, p3, t) {
  let dx, dy;
  dx = p1.x - p0.x; dy = p1.y - p0.y;
  let d01 = (dx * dx + dy * dy)**0.25;
  dx = p2.x - p1.x; dy = p2.y - p1.y;
  let d12 = (dx * dx + dy * dy)**0.25;
  dx = p3.x - p2.x; dy = p2.y - p1.y;
  let d23 = (dx * dx + dy * dy)**0.25;
  if (d01 < 1e-4) d01 = 1;
  if (d12 < 1e-4) d12 = 1;
  if (d23 < 1e-4) d23 = 1;
  const t1 = d01, t2 = t1 + d12, t3 = t2 + d23;
  const tt = t1 + t * (t2 - t1);
  const a1x = (t1 - tt) / t1 * p0.x + tt / t1 * p1.x;
  const a1y = (t1 - tt) / t1 * p0.y + tt / t1 * p1.y;
  const a2x = (t2 - tt) / (t2 - t1) * p1.x + (tt - t1) / (t2 - t1) * p2.x;
  const a2y = (t2 - tt) / (t2 - t1) * p1.y + (tt - t1) / (t2 - t1) * p2.y;
  const a3x = (t3 - tt) / (t3 - t2) * p2.x + (tt - t2) / (t3 - t2) * p3.x;
  const a3y = (t3 - tt) / (t3 - t2) * p2.y + (tt - t2) / (t3 - t2) * p3.y;
  const b1x = (t2 - tt) / t2 * a1x + tt / t2 * a2x;
  const b1y = (t2 - tt) / t2 * a1y + tt / t2 * a2y;
  const b2x = (t3 - tt) / (t3 - t1) * a2x + (tt - t1) / (t3 - t1) * a3x;
  const b2y = (t3 - tt) / (t3 - t1) * a2y + (tt - t1) / (t3 - t1) * a3y;
  return {
    x: (t2 - tt) / (t2 - t1) * b1x + (tt - t1) / (t2 - t1) * b2x,
    y: (t2 - tt) / (t2 - t1) * b1y + (tt - t1) / (t2 - t1) * b2y
  };
}

export default class TrackCode {
  constructor(code) {
    // Normalize: pad to 18 chars, truncate if longer
    let str = code || '';
    while (str.length < 18) str += ' ';
    this._code = str.substring(0, 18);
  }

  toString() {
    return this._code;
  }

  toPoints() {
    const pts = computeTrackPoints2D(this._code);
    const points = [];
    for (let i = 0; i < pts.length; i++) {
      points.push(new THREE.Vector3(pts[i].x, 0, pts[i].y));
    }
    return points;
  }

  toSVG() {
    const pts = computeTrackPoints2D(this._code);
    const SEGS = 20;
    const center = [];
    for (let seg = 0; seg < 18; seg++) {
      const p0 = pts[(seg + 17) % 18];
      const p1 = pts[seg];
      const p2 = pts[(seg + 1) % 18];
      const p3 = pts[(seg + 2) % 18];
      for (let j = 0; j < SEGS; j++) {
        center.push(catmullRomPoint2D(p0, p1, p2, p3, j / SEGS));
      }
    }
    let d = 'M' + center[0].x.toFixed(1) + ' ' + center[0].y.toFixed(1);
    for (let pi = 1; pi < center.length; pi++) {
      d += 'L' + center[pi].x.toFixed(1) + ' ' + center[pi].y.toFixed(1);
    }
    d += 'Z';
    const n = center.length;
    const tx = center[1].x - center[n - 1].x;
    const ty = center[1].y - center[n - 1].y;
    const tl = Math.sqrt(tx * tx + ty * ty);
    const hw = Constants.track.width / 2;
    const snx = -ty / tl, sny = tx / tl;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let bi = 0; bi < center.length; bi++) {
      if (center[bi].x - hw < minX) minX = center[bi].x - hw;
      if (center[bi].x + hw > maxX) maxX = center[bi].x + hw;
      if (center[bi].y - hw < minY) minY = center[bi].y - hw;
      if (center[bi].y + hw > maxY) maxY = center[bi].y + hw;
    }
    const pad = 5;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
      (minX - pad).toFixed(0) + ' ' + (minY - pad).toFixed(0) + ' ' +
      (maxX - minX + pad * 2).toFixed(0) + ' ' + (maxY - minY + pad * 2).toFixed(0) +
      '">' +
      '<path d="' + d + '" fill="none" stroke="#555" stroke-width="' + Constants.track.width + '" stroke-linejoin="round"/>' +
      '<line x1="' + (center[0].x - snx * hw).toFixed(1) + '" y1="' + (center[0].y - sny * hw).toFixed(1) +
      '" x2="' + (center[0].x + snx * hw).toFixed(1) + '" y2="' + (center[0].y + sny * hw).toFixed(1) +
      '" stroke="#fff" stroke-width="3"/>' +
      '</svg>';
  }
}
