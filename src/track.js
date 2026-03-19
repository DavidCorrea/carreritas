import { C } from './constants.js';
import { disposeGroup } from './utils.js';

var startBoxGeom = new THREE.BoxGeometry(C.track.width / 8, 0.1, 3);
var startWhiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
var startBlackMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
startBoxGeom._shared = true;
startWhiteMat._shared = true;
startBlackMat._shared = true;

function computeTrackPoints2D(code) {
  var str = code;
  while (str.length < 18) str += ' ';
  str = str.substring(0, 18);

  var radii = [];
  for (var i = 0; i < 18; i++) {
    var c = str.charCodeAt(i);
    var norm = (Math.min(Math.max(c, 32), 126) - 32) / 94;
    radii.push(140 + norm * 240);
  }

  var smoothed = [];
  for (var i = 0; i < 18; i++) {
    var prev = radii[(i + 17) % 18];
    var curr = radii[i];
    var next = radii[(i + 1) % 18];
    smoothed.push(prev * 0.25 + curr * 0.5 + next * 0.25);
  }

  var shift = 0;
  for (var i = 0; i < str.length; i++) shift += str.charCodeAt(i);
  shift = shift % 18;

  var points = [];
  for (var i = 0; i < 18; i++) {
    var idx = (i + shift) % 18;
    var angle = (idx / 18) * Math.PI * 2;
    points.push({ x: Math.cos(angle) * smoothed[idx], y: Math.sin(angle) * smoothed[idx] });
  }
  return points;
}

export function stringToTrackPoints(code) {
  var pts = computeTrackPoints2D(code);
  var points = [];
  for (var i = 0; i < pts.length; i++) {
    points.push(new THREE.Vector3(pts[i].x, 0, pts[i].y));
  }
  return points;
}

function catmullRomPoint2D(p0, p1, p2, p3, t) {
  var dx, dy;
  dx = p1.x - p0.x; dy = p1.y - p0.y;
  var d01 = Math.pow(dx * dx + dy * dy, 0.25);
  dx = p2.x - p1.x; dy = p2.y - p1.y;
  var d12 = Math.pow(dx * dx + dy * dy, 0.25);
  dx = p3.x - p2.x; dy = p3.y - p2.y;
  var d23 = Math.pow(dx * dx + dy * dy, 0.25);
  if (d01 < 1e-4) d01 = 1;
  if (d12 < 1e-4) d12 = 1;
  if (d23 < 1e-4) d23 = 1;
  var t1 = d01, t2 = t1 + d12, t3 = t2 + d23;
  var tt = t1 + t * (t2 - t1);
  var a1x = (t1 - tt) / t1 * p0.x + tt / t1 * p1.x;
  var a1y = (t1 - tt) / t1 * p0.y + tt / t1 * p1.y;
  var a2x = (t2 - tt) / (t2 - t1) * p1.x + (tt - t1) / (t2 - t1) * p2.x;
  var a2y = (t2 - tt) / (t2 - t1) * p1.y + (tt - t1) / (t2 - t1) * p2.y;
  var a3x = (t3 - tt) / (t3 - t2) * p2.x + (tt - t2) / (t3 - t2) * p3.x;
  var a3y = (t3 - tt) / (t3 - t2) * p2.y + (tt - t2) / (t3 - t2) * p3.y;
  var b1x = (t2 - tt) / t2 * a1x + tt / t2 * a2x;
  var b1y = (t2 - tt) / t2 * a1y + tt / t2 * a2y;
  var b2x = (t3 - tt) / (t3 - t1) * a2x + (tt - t1) / (t3 - t1) * a3x;
  var b2y = (t3 - tt) / (t3 - t1) * a2y + (tt - t1) / (t3 - t1) * a3y;
  return {
    x: (t2 - tt) / (t2 - t1) * b1x + (tt - t1) / (t2 - t1) * b2x,
    y: (t2 - tt) / (t2 - t1) * b1y + (tt - t1) / (t2 - t1) * b2y
  };
}

export function generateTrackSVG(code) {
  var pts = computeTrackPoints2D(code);
  var SEGS = 20;
  var center = [];
  for (var seg = 0; seg < 18; seg++) {
    var p0 = pts[(seg + 17) % 18];
    var p1 = pts[seg];
    var p2 = pts[(seg + 1) % 18];
    var p3 = pts[(seg + 2) % 18];
    for (var j = 0; j < SEGS; j++) {
      center.push(catmullRomPoint2D(p0, p1, p2, p3, j / SEGS));
    }
  }
  var d = 'M' + center[0].x.toFixed(1) + ' ' + center[0].y.toFixed(1);
  for (var i = 1; i < center.length; i++) {
    d += 'L' + center[i].x.toFixed(1) + ' ' + center[i].y.toFixed(1);
  }
  d += 'Z';
  var n = center.length;
  var tx = center[1].x - center[n - 1].x;
  var ty = center[1].y - center[n - 1].y;
  var tl = Math.sqrt(tx * tx + ty * ty);
  var hw = C.track.width / 2;
  var snx = -ty / tl, sny = tx / tl;
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (var i = 0; i < center.length; i++) {
    if (center[i].x - hw < minX) minX = center[i].x - hw;
    if (center[i].x + hw > maxX) maxX = center[i].x + hw;
    if (center[i].y - hw < minY) minY = center[i].y - hw;
    if (center[i].y + hw > maxY) maxY = center[i].y + hw;
  }
  var pad = 5;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
    (minX - pad).toFixed(0) + ' ' + (minY - pad).toFixed(0) + ' ' +
    (maxX - minX + pad * 2).toFixed(0) + ' ' + (maxY - minY + pad * 2).toFixed(0) +
    '">' +
    '<path d="' + d + '" fill="none" stroke="#555" stroke-width="' + C.track.width + '" stroke-linejoin="round"/>' +
    '<line x1="' + (center[0].x - snx * hw).toFixed(1) + '" y1="' + (center[0].y - sny * hw).toFixed(1) +
    '" x2="' + (center[0].x + snx * hw).toFixed(1) + '" y2="' + (center[0].y + sny * hw).toFixed(1) +
    '" stroke="#fff" stroke-width="3"/>' +
    '</svg>';
}

function buildTrackSurface(inner, outer, trackGroup) {
  var verts = [], idx = [];
  for (var i = 0; i < inner.length; i++) {
    verts.push(inner[i].x, 0.01, inner[i].z);
    verts.push(outer[i].x, 0.01, outer[i].z);
  }
  for (var i = 0; i < inner.length; i++) {
    var n = (i + 1) % inner.length;
    var a = i * 2, b = i * 2 + 1, c = n * 2, d = n * 2 + 1;
    idx.push(a, c, b, b, c, d);
  }
  var geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geom.setIndex(idx);
  trackGroup.add(new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ color: 0x444444 })));
}

function buildWalls(inner, outer, trackGroup) {
  var step = 2;
  var count = Math.ceil(inner.length / step) + Math.ceil(outer.length / step);
  var geom = new THREE.SphereGeometry(1.8, 6, 4);
  var mesh = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial({ color: 0xcccccc }), count);
  var dummy = new THREE.Object3D();
  var n = 0;
  for (var i = 0; i < inner.length; i += step) {
    dummy.position.set(inner[i].x, 1.8, inner[i].z);
    dummy.updateMatrix();
    mesh.setMatrixAt(n++, dummy.matrix);
  }
  for (var i = 0; i < outer.length; i += step) {
    dummy.position.set(outer[i].x, 1.8, outer[i].z);
    dummy.updateMatrix();
    mesh.setMatrixAt(n++, dummy.matrix);
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  trackGroup.add(mesh);
}

function buildStartLine(curve, trackGroup) {
  var p = curve.getPointAt(0);
  var t = curve.getTangentAt(0).normalize();
  var nx = -t.z, nz = t.x;
  var angle = Math.atan2(t.x, t.z);
  var squares = 8;
  var size = C.track.width / squares;
  var whiteInst = new THREE.InstancedMesh(startBoxGeom, startWhiteMat, 4);
  var blackInst = new THREE.InstancedMesh(startBoxGeom, startBlackMat, 4);
  var dummy = new THREE.Object3D();
  var wi = 0, bi = 0;
  for (var i = 0; i < squares; i++) {
    var offset = (i - squares / 2 + 0.5) * size;
    dummy.position.set(p.x + nx * offset, 0.05, p.z + nz * offset);
    dummy.rotation.y = angle;
    dummy.updateMatrix();
    if (i % 2 === 0) whiteInst.setMatrixAt(wi++, dummy.matrix);
    else blackInst.setMatrixAt(bi++, dummy.matrix);
  }
  whiteInst.instanceMatrix.needsUpdate = true;
  blackInst.instanceMatrix.needsUpdate = true;
  trackGroup.add(whiteInst);
  trackGroup.add(blackInst);
}

export function generateTrack(code, scene, oldGroup) {
  if (oldGroup) {
    disposeGroup(oldGroup);
    scene.remove(oldGroup);
  }

  var trackGroup = new THREE.Group();
  scene.add(trackGroup);

  var pts = stringToTrackPoints(code);
  var curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
  var sampled = curve.getSpacedPoints(C.track.samples);
  var halfW = C.track.width / 2;
  var inner = [], outer = [];

  for (var i = 0; i < sampled.length; i++) {
    var t = i / sampled.length;
    var tan = curve.getTangentAt(t);
    var nx = -tan.z, nz = tan.x;
    var len = Math.sqrt(nx * nx + nz * nz);
    nx /= len; nz /= len;
    inner.push(new THREE.Vector3(
      sampled[i].x - nx * halfW, 0, sampled[i].z - nz * halfW
    ));
    outer.push(new THREE.Vector3(
      sampled[i].x + nx * halfW, 0, sampled[i].z + nz * halfW
    ));
  }

  buildTrackSurface(inner, outer, trackGroup);
  buildWalls(inner, outer, trackGroup);
  buildStartLine(curve, trackGroup);

  trackGroup.traverse(function (child) {
    child.matrixAutoUpdate = false;
    child.frustumCulled = false;
    child.updateMatrix();
  });

  return { curve: curve, sampled: sampled, inner: inner, outer: outer, group: trackGroup };
}

export function getStartPosition(curve, reversed) {
  var p = curve.getPointAt(0);
  var t = curve.getTangentAt(0).normalize();
  var angle = Math.atan2(t.x, t.z);
  if (reversed) {
    angle += Math.PI;
    return { x: p.x + t.x * 12, z: p.z + t.z * 12, angle: angle };
  }
  return { x: p.x + t.x * -12, z: p.z + t.z * -12, angle: angle };
}
