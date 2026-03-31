import Constants from './constants.js';
import { ROAD_SURFACE_Y } from './intrinsic-constants.js';
import { disposeGroup } from './utils/index.js';
import TrackCode from './track-code.js';
import { buildClipperOffsetRingsFromCurve } from './track-clipper.js';

const startBoxGeom = new THREE.BoxGeometry(Constants.track.width / 8, 0.1, 3);
/** Ground has depthWrite: false; road uses normal depth tests with a slight offset so asphalt does not z-fight the grass plane. */
const ROAD_POLYGON_OFFSET = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 };
/** Night top/rotated/chase: additive headlight meshes test stencil ref 1 — road fragments write it (see `night-renderer.js`). */
const ROAD_STENCIL_WRITE = {
  stencilWrite: true,
  stencilRef: 1,
  stencilWriteMask: 0xff,
  stencilFunc: THREE.AlwaysStencilFunc,
  stencilFuncMask: 0xff,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilZPass: THREE.ReplaceStencilOp,
};
/**
 * After the road marks stencil 1, kerbs replace with 0 where they cover pixels so night beams
 * (Equal 1) do not read as passing through walls — the “lit road” mask is eroded at kerb edges.
 */
const KERB_STENCIL_CLEAR = {
  stencilWrite: true,
  stencilRef: 0,
  stencilWriteMask: 0xff,
  stencilFunc: THREE.AlwaysStencilFunc,
  stencilFuncMask: 0xff,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilZPass: THREE.ReplaceStencilOp,
};
/**
 * Stronger pull toward the camera than `ROAD_POLYGON_OFFSET` so kerb wins depth at shared edge
 * pixels under orthographic top-down; otherwise stencil stays 1 from the road and night beams
 * still match Equal 1 through the wall line.
 */
const KERB_POLYGON_OFFSET = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 };
const startWhiteMat = new THREE.MeshBasicMaterial(Object.assign({ color: 0xffffff }, ROAD_POLYGON_OFFSET));
const startBlackMat = new THREE.MeshBasicMaterial(Object.assign({ color: 0x222222 }, ROAD_POLYGON_OFFSET));
startBoxGeom._shared = true;
startWhiteMat._shared = true;
startBlackMat._shared = true;

/** Circumradius of triangle (p0,p1,p2) in XZ — approximates local radius of curvature at p1. */
function circumradiusXZ(p0, p1, p2) {
  const a = Math.hypot(p2.x - p1.x, p2.z - p1.z);
  const b = Math.hypot(p2.x - p0.x, p2.z - p0.z);
  const c = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const cross = (p1.x - p0.x) * (p2.z - p0.z) - (p1.z - p0.z) * (p2.x - p0.x);
  const area = Math.abs(cross) * 0.5;
  if (area < 1e-8) return Infinity;
  return (a * b * c) / (4 * area);
}

function xzUnitTangent(curve, u) {
  const t = curve.getTangentAt(u);
  const L = Math.hypot(t.x, t.z);
  if (L < 1e-12) return { x: 1, z: 0 };
  return { x: t.x / L, z: t.z / L };
}

/**
 * ds/|dθ| from tangents at u±du — catches tight bends that three sparse samples on the ring can miss.
 * spanDiv larger ⇒ smaller du ⇒ more local (min across spans stays conservative).
 */
function radiusFromTangentSpread(curve, u, n, spanDiv) {
  const du = 1 / (spanDiv * n);
  const u0 = (u - du + 1) % 1;
  const u1 = (u + du + 1) % 1;
  const t0 = xzUnitTangent(curve, u0);
  const t1 = xzUnitTangent(curve, u1);
  const cross = t0.x * t1.z - t0.z * t1.x;
  const dot = Math.max(-1, Math.min(1, t0.x * t1.x + t0.z * t1.z));
  const dtheta = Math.abs(Math.atan2(cross, dot));
  const p0 = curve.getPointAt(u0);
  const p1 = curve.getPointAt(u1);
  const ds = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  if (dtheta < 1e-7) return Infinity;
  return ds / dtheta;
}

/** Smallest plausible local radius — parallel offset must stay below this to avoid inner-loop overlaps. */
function conservativeRadiusXZ(curve, i, n) {
  const um = ((i - 1 + n) % n) / n;
  const u = i / n;
  const up = ((i + 1) % n) / n;
  const pm = curve.getPointAt(um);
  const p = curve.getPointAt(u);
  const pp = curve.getPointAt(up);
  let R = circumradiusXZ(pm, p, pp);
  for (const spanDiv of [4, 8, 16, 32]) {
    const r = radiusFromTangentSpread(curve, u, n, spanDiv);
    if (Number.isFinite(r)) R = Math.min(R, r);
  }
  return R;
}

/**
 * Parallel offset in XZ using curve tangents. When offset > local radius of curvature, a constant-width
 * parallel curve self-intersects (classic offset / “grassfire” singularity); we clamp half-width per sample.
 */
/**
 * @param {THREE.Vector3[]} innerOut
 * @param {THREE.Vector3[]} outerOut
 * @param {number[]|null} [halfWidthsOut] final per-spine-sample half-widths (same order as getPointAt(i/n)).
 * @param {number} [curvatureSafety] defaults to `Constants.track.curvatureOffsetSafety` (walls pass stricter value).
 */
function buildOffsetRingsFromCurve(curve, divisions, halfW, innerOut, outerOut, halfWidthsOut, curvatureSafety) {
  innerOut.length = 0;
  outerOut.length = 0;
  const n = Math.max(8, divisions | 0);
  const safety = curvatureSafety !== undefined && curvatureSafety !== null
    ? curvatureSafety
    : Constants.track.curvatureOffsetSafety;
  const halfWidths = [];
  for (let i = 0; i < n; i++) {
    const R = conservativeRadiusXZ(curve, i, n);
    const cap = R < 1e6 && Number.isFinite(R) ? R * safety : Infinity;
    halfWidths[i] = Math.min(halfW, cap);
  }
  const rawHalf = halfWidths.slice();
  for (let pass = 0; pass < 2; pass++) {
    const prev = halfWidths.slice();
    for (let i = 0; i < n; i++) {
      const im = (i - 1 + n) % n;
      const ip = (i + 1) % n;
      const s = prev[im] * 0.25 + prev[i] * 0.5 + prev[ip] * 0.25;
      halfWidths[i] = Math.min(s, rawHalf[i]);
    }
  }
  if (halfWidthsOut) {
    halfWidthsOut.length = n;
    for (let i = 0; i < n; i++) halfWidthsOut[i] = halfWidths[i];
  }
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    let tx = t.x, tz = t.z;
    let len = Math.hypot(tx, tz);
    if (len < 1e-8) {
      const u2 = (u + 1 / n) % 1;
      const p2 = curve.getPointAt(u2);
      tx = p2.x - p.x;
      tz = p2.z - p.z;
      len = Math.hypot(tx, tz);
    }
    if (len < 1e-8) {
      tx = 1;
      tz = 0;
      len = 1;
    }
    tx /= len;
    tz /= len;
    const nx = -tz;
    const nz = tx;
    const hw = halfWidths[i];
    innerOut.push(new THREE.Vector3(p.x - nx * hw, 0, p.z - nz * hw));
    outerOut.push(new THREE.Vector3(p.x + nx * hw, 0, p.z + nz * hw));
  }
}

/** Signed area in XZ (positive ⇒ CCW when viewed from +Y). */
function signedAreaRing(pts) {
  let s = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    s += pts[i].x * pts[j].z - pts[j].x * pts[i].z;
  }
  return s * 0.5;
}

function edgeKeyUndirected(a, b) {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

/** Signed area in XZ for a closed loop of vertex indices (ShapeGeometry positions are in XZ after remap). */
function signedAreaIndexLoop(loopIdx, pos) {
  let s = 0;
  const n = loopIdx.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ai = loopIdx[i];
    const aj = loopIdx[j];
    const xi = pos.getX(ai);
    const zi = pos.getZ(ai);
    const xj = pos.getX(aj);
    const zj = pos.getZ(aj);
    s += xi * zj - xj * zi;
  }
  return s * 0.5;
}

/**
 * Boundary edges of an indexed mesh (used by exactly one triangle). Walk into closed polylines.
 * Annulus ShapeGeometry yields two loops: outer (larger |area|) and inner hole.
 * @returns {{ outer: THREE.Vector3[], inner: THREE.Vector3[] } | null}
 */
function extractKerbPolylinesFromRoadGeometry(geometry, yLift) {
  const idx = geometry.index;
  const pos = geometry.attributes.position;
  if (!idx || !pos || idx.count < 9) return null;

  const edgeUseCount = new Map();
  for (let f = 0; f < idx.count; f += 3) {
    const a = idx.getX(f);
    const b = idx.getX(f + 1);
    const c = idx.getX(f + 2);
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const k = edgeKeyUndirected(u, v);
      edgeUseCount.set(k, (edgeUseCount.get(k) || 0) + 1);
    }
  }

  const adj = new Map();
  edgeUseCount.forEach((cnt, k) => {
    if (cnt !== 1) return;
    const [a, b] = k.split(',').map(Number);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  });

  const edgeUsed = new Set();
  const loops = [];

  edgeUseCount.forEach((cnt, k) => {
    if (cnt !== 1 || edgeUsed.has(k)) return;
    const [a0, b0] = k.split(',').map(Number);

    const loopIdx = [a0];
    let prev = a0;
    let cur = b0;
    let guard = 0;
    while (cur !== a0 && guard++ < idx.count + 4) {
      loopIdx.push(cur);
      edgeUsed.add(edgeKeyUndirected(prev, cur));
      const nb = adj.get(cur);
      if (!nb || nb.length === 0) {
        loopIdx.length = 0;
        break;
      }
      let next = null;
      for (let ni = 0; ni < nb.length; ni++) {
        if (nb[ni] !== prev) {
          next = nb[ni];
          break;
        }
      }
      if (next === null) {
        loopIdx.length = 0;
        break;
      }
      prev = cur;
      cur = next;
    }

    if (loopIdx.length >= 3 && cur === a0) {
      edgeUsed.add(edgeKeyUndirected(prev, a0));
      loops.push(loopIdx);
    }
  });

  if (loops.length !== 2) return null;

  loops.sort(
    (A, B) => Math.abs(signedAreaIndexLoop(B, pos)) - Math.abs(signedAreaIndexLoop(A, pos))
  );

  const toLifted = (loopIdx) =>
    loopIdx.map((vi) => new THREE.Vector3(pos.getX(vi), yLift, pos.getZ(vi)));

  return {
    outer: toLifted(loops[0]),
    inner: toLifted(loops[1])
  };
}

/**
 * Single flat mesh for the road ring: outer contour + inner hole (no overlapping corner quads).
 * Shape is built in 2D with (world x, world z) → remapped to XZ plane.
 * @returns {THREE.Mesh}
 */
function buildAnnulusShapeGeometry(inner, outer, trackGroup) {
  const outerPts = outer.slice();
  if (signedAreaRing(outerPts) < 0) outerPts.reverse();
  const innerPts = inner.slice();
  if (signedAreaRing(innerPts) > 0) innerPts.reverse();

  const shape = new THREE.Shape();
  shape.moveTo(outerPts[0].x, outerPts[0].z);
  for (let i = 1; i < outerPts.length; i++) {
    shape.lineTo(outerPts[i].x, outerPts[i].z);
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(innerPts[0].x, innerPts[0].z);
  for (let i = 1; i < innerPts.length; i++) {
    hole.lineTo(innerPts[i].x, innerPts[i].z);
  }
  hole.closePath();
  shape.holes.push(hole);

  const geom = new THREE.ShapeGeometry(shape);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getY(i);
    pos.setXYZ(i, x, ROAD_SURFACE_Y, z);
  }
  pos.needsUpdate = true;
  geom.computeBoundingSphere();
  geom.computeVertexNormals();
  /** Lambert: responds to night lights / spotlight (FP); day ambient ≈ previous flat Basic look. */
  const mat = new THREE.MeshLambertMaterial(Object.assign({ color: 0x444444 }, ROAD_POLYGON_OFFSET, ROAD_STENCIL_WRITE));
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geom, mat);
  trackGroup.add(mesh);
  return mesh;
}

/**
 * Fallback: overlapping quads per edge (only if Shape triangulation is unusable).
 * @returns {THREE.Mesh}
 */
function buildTrackSurfaceSegments(sampled, halfW, trackGroup) {
  const verts = [];
  const idx = [];
  const n = sampled.length;
  let base = 0;
  for (let i = 0; i < n; i++) {
    const iNext = (i + 1) % n;
    const p0 = sampled[i];
    const p1 = sampled[iNext];
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const elen = Math.hypot(dx, dz);
    if (elen < 1e-8) continue;
    const nx = -dz / elen;
    const nz = dx / elen;
    const y = ROAD_SURFACE_Y;
    verts.push(
      p0.x - nx * halfW, y, p0.z - nz * halfW,
      p0.x + nx * halfW, y, p0.z + nz * halfW,
      p1.x - nx * halfW, y, p1.z - nz * halfW,
      p1.x + nx * halfW, y, p1.z + nz * halfW
    );
    const a = base;
    const b = base + 1;
    const c = base + 2;
    const d = base + 3;
    idx.push(a, c, b, b, c, d);
    base += 4;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial(Object.assign({ color: 0x444444 }, ROAD_POLYGON_OFFSET, ROAD_STENCIL_WRITE));
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geom, mat);
  trackGroup.add(mesh);
  return mesh;
}

/**
 * Concrete-style grey curb (top + street-side vertical face).
 * Negative polygon offset (stronger than road) so kerb passes depth at edge pixels and stencil
 * ref 0 is written there; additive beams use positive Y, not polygon offset, for depth vs kerb.
 */
const kerbCurbMat = new THREE.MeshLambertMaterial(
  Object.assign({ color: 0x858585, side: THREE.DoubleSide }, KERB_POLYGON_OFFSET, KERB_STENCIL_CLEAR)
);
kerbCurbMat._shared = true;

function xzCentroidFromRings(innerPts, outerPts) {
  let sx = 0;
  let sz = 0;
  let c = 0;
  if (innerPts && innerPts.length >= 3) {
    for (let i = 0; i < innerPts.length; i++) {
      sx += innerPts[i].x;
      sz += innerPts[i].z;
      c++;
    }
  }
  if (outerPts && outerPts.length >= 3) {
    for (let i = 0; i < outerPts.length; i++) {
      sx += outerPts[i].x;
      sz += outerPts[i].z;
      c++;
    }
  }
  if (c < 1) return { x: 0, z: 0 };
  return { x: sx / c, z: sz / c };
}

function radialDirXZ(p, centroid) {
  const dx = p.x - centroid.x;
  const dz = p.z - centroid.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-10) return { x: 1, z: 0 };
  return { x: dx / len, z: dz / len };
}

/**
 * Thin wall along the road edge: top cap + inner & outer vertical quads (closed slab in cross-section).
 * @param {THREE.Vector3[]} ring
 * @param {{ x: number, z: number }} centroid
 * @param {boolean} isOuter true = extrude away from centroid (outer asphalt edge)
 */
function buildKerbCurbGeometry(ring, centroid, isOuter) {
  const n = ring.length;
  const extrudeW = Constants.track.kerbExtrudeWidth;
  const baseY = Constants.track.kerbBaseY;
  const topY = Constants.track.kerbCapY;
  const sign = isOuter ? 1 : -1;

  const pos = [];
  const idx = [];

  for (let i = 0; i < n; i++) {
    const p = ring[i];
    const r = radialDirXZ(p, centroid);
    const ox = r.x * sign;
    const oz = r.z * sign;
    pos.push(p.x, topY, p.z);
    pos.push(p.x + ox * extrudeW, topY, p.z + oz * extrudeW);
  }

  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    idx.push(a, b, b + 1, a, b + 1, a + 1);
  }

  const outerBaseStart = pos.length / 3;
  for (let i = 0; i < n; i++) {
    const p = ring[i];
    const r = radialDirXZ(p, centroid);
    const ox = r.x * sign;
    const oz = r.z * sign;
    pos.push(p.x + ox * extrudeW, baseY, p.z + oz * extrudeW);
  }

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const bot0 = outerBaseStart + i;
    const bot1 = outerBaseStart + next;
    const top0 = i * 2 + 1;
    const top1 = next * 2 + 1;
    idx.push(bot0, bot1, top1, bot0, top1, top0);
  }

  const innerBaseStart = pos.length / 3;
  for (let i = 0; i < n; i++) {
    const p = ring[i];
    pos.push(p.x, baseY, p.z);
  }

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const bot0 = innerBaseStart + i;
    const bot1 = innerBaseStart + next;
    const top0 = i * 2;
    const top1 = next * 2;
    idx.push(bot0, bot1, top1, bot0, top1, top0);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  return geom;
}

export default class Track {
  constructor(code, scene, oldGroup) {
    if (oldGroup) {
      disposeGroup(oldGroup);
      scene.remove(oldGroup);
    }

    this.code = code instanceof TrackCode ? code : new TrackCode(code);
    this.scene = scene;
    const trackGroup = new THREE.Group();
    /** Parent must not frustum-cull: culling tests the Group’s bounds before children; a bad sphere hides the whole track while the car (sibling on the scene) stays visible. */
    trackGroup.frustumCulled = false;
    scene.add(trackGroup);

    const pts = this.code.toPoints();
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const n = Math.max(8, Constants.track.samples | 0);
    /** Spine matches offset sampling (uniform u) so corridor collision indices align with visuals. */
    this.sampled = [];
    for (let i = 0; i < n; i++) {
      const p = this.curve.getPointAt(i / n);
      this.sampled.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    const halfW = Constants.track.width / 2;
    this.inner = [];
    this.outer = [];
    this.spineHalfWidths = [];
    const clipperRings = buildClipperOffsetRingsFromCurve(this.curve, n, halfW);
    const roadRingsFromClipper = clipperRings != null;
    if (clipperRings) {
      this.inner.push(...clipperRings.inner);
      this.outer.push(...clipperRings.outer);
      this.spineHalfWidths.length = n;
      for (let i = 0; i < n; i++) this.spineHalfWidths[i] = halfW;
    } else {
      buildOffsetRingsFromCurve(this.curve, n, halfW, this.inner, this.outer, this.spineHalfWidths);
    }

    this.roadMesh = null;
    let roadIsStrip = false;
    try {
      this.roadMesh = buildAnnulusShapeGeometry(this.inner, this.outer, trackGroup);
      const g = this.roadMesh.geometry;
      const triCount = g.index ? g.index.count / 3 : 0;
      /** triangulateShape can yield no faces for pathological rings without throwing — fall back to strips. */
      if (triCount < 1) {
        trackGroup.remove(this.roadMesh);
        this.roadMesh.geometry.dispose();
        this.roadMesh.material.dispose();
        this.roadMesh = null;
        throw new Error('empty annulus');
      }
    } catch (_err) {
      roadIsStrip = true;
      this.roadMesh = buildTrackSurfaceSegments(this.sampled, halfW, trackGroup);
    }

    const kerbY = 0.045;
    const liftKerb = (ring) => ring.map((p) => new THREE.Vector3(p.x, kerbY, p.z));
    const fromMesh = this.roadMesh && extractKerbPolylinesFromRoadGeometry(this.roadMesh.geometry, kerbY);
    if (fromMesh) {
      this._addWallLineLoops(trackGroup, fromMesh.inner, fromMesh.outer);
    } else if (!roadIsStrip || roadRingsFromClipper) {
      this._addWallLineLoops(trackGroup, liftKerb(this.inner), liftKerb(this.outer));
    } else {
      const wallMult = Math.max(1, Constants.track.wallLineSampleMultiplier | 0);
      const nWall = Math.max(n, (n * wallMult) | 0);
      const wallInner = [];
      const wallOuter = [];
      buildOffsetRingsFromCurve(
        this.curve,
        nWall,
        halfW,
        wallInner,
        wallOuter,
        null,
        Constants.track.wallLineCurvatureSafety
      );
      /** Strip road + analytic offset: inner offset can self-cross — draw outer kerb only. */
      this._addWallLineLoops(trackGroup, null, liftKerb(wallOuter));
    }
    this._buildStartLine(this.curve, trackGroup);

    // InstancedMesh frustum bounds do not reliably wrap all instances — culling causes visible flicker.
    trackGroup.traverse(function (child) {
      child.matrixAutoUpdate = false;
      child.frustumCulled = false;
      child.updateMatrix();
    });

    this.group = trackGroup;
  }

  /** Night fringe shadow: kerbs cast, all track meshes + instanced start line receive. */
  applyNightShadowFlags() {
    this.group.traverse((child) => {
      if (!child.isMesh) return;
      child.receiveShadow = true;
      if (child.userData.isKerb) child.castShadow = true;
    });
  }

  /**
   * Grey track-edge wall (top + inner/outer vertical faces) extruded radially from centroid.
   */
  _addWallLineLoops(trackGroup, innerPts, outerPts) {
    const centroid = xzCentroidFromRings(innerPts, outerPts);
    if (outerPts && outerPts.length >= 3) {
      const g = buildKerbCurbGeometry(outerPts, centroid, true);
      const mesh = new THREE.Mesh(g, kerbCurbMat);
      mesh.renderOrder = 2;
      mesh.userData.isKerb = true;
      trackGroup.add(mesh);
    }
    if (innerPts && innerPts.length >= 3) {
      const g = buildKerbCurbGeometry(innerPts, centroid, false);
      const mesh = new THREE.Mesh(g, kerbCurbMat);
      mesh.renderOrder = 2;
      mesh.userData.isKerb = true;
      trackGroup.add(mesh);
    }
  }

  _buildStartLine(curve, trackGroup) {
    const p = curve.getPointAt(0);
    const t = curve.getTangentAt(0).normalize();
    const nx = -t.z, nz = t.x;
    const angle = Math.atan2(t.x, t.z);
    const squares = 8;
    const size = Constants.track.width / squares;
    const whiteInst = new THREE.InstancedMesh(startBoxGeom, startWhiteMat, 4);
    const blackInst = new THREE.InstancedMesh(startBoxGeom, startBlackMat, 4);
    const dummy = new THREE.Object3D();
    let wi = 0, bi = 0;
    for (let i = 0; i < squares; i++) {
      const offset = (i - squares / 2 + 0.5) * size;
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

  getStartPosition(direction) {
    const reversed = direction.isRev();
    const p = this.curve.getPointAt(0);
    const t3 = this.curve.getTangentAt(0);
    let tx = t3.x;
    let tz = t3.z;
    const len = Math.hypot(tx, tz);
    if (len > 1e-10) {
      tx /= len;
      tz /= len;
    } else {
      tx = 0;
      tz = 1;
    }
    let angle = Math.atan2(tx, tz);
    if (reversed) {
      angle += Math.PI;
      return { x: p.x + tx * 12, z: p.z + tz * 12, angle };
    }
    return { x: p.x + tx * -12, z: p.z + tz * -12, angle };
  }
}
