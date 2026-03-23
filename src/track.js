import Constants from './constants.js';
import { disposeGroup } from './utils/index.js';
import TrackCode from './track-code.js';

const startBoxGeom = new THREE.BoxGeometry(Constants.track.width / 8, 0.1, 3);
const startWhiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const startBlackMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
startBoxGeom._shared = true;
startWhiteMat._shared = true;
startBlackMat._shared = true;

export default class Track {
  constructor(code, scene, oldGroup) {
    if (oldGroup) {
      disposeGroup(oldGroup);
      scene.remove(oldGroup);
    }

    this.code = code instanceof TrackCode ? code : new TrackCode(code);
    this.scene = scene;
    const trackGroup = new THREE.Group();
    scene.add(trackGroup);

    const pts = this.code.toPoints();
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    this.sampled = this.curve.getSpacedPoints(Constants.track.samples);
    const halfW = Constants.track.width / 2;
    this.inner = [];
    this.outer = [];

    for (let i = 0; i < this.sampled.length; i++) {
      const t = i / this.sampled.length;
      const tan = this.curve.getTangentAt(t);
      let nx = -tan.z, nz = tan.x;
      const len = Math.sqrt(nx * nx + nz * nz);
      nx /= len; nz /= len;
      this.inner.push(new THREE.Vector3(
        this.sampled[i].x - nx * halfW, 0, this.sampled[i].z - nz * halfW
      ));
      this.outer.push(new THREE.Vector3(
        this.sampled[i].x + nx * halfW, 0, this.sampled[i].z + nz * halfW
      ));
    }

    this._buildTrackSurface(this.inner, this.outer, trackGroup);
    this._buildWalls(this.inner, this.outer, trackGroup);
    this._buildStartLine(this.curve, trackGroup);

    // InstancedMesh frustum bounds do not reliably wrap all instances — culling causes visible flicker.
    trackGroup.traverse(function (child) {
      child.matrixAutoUpdate = false;
      child.frustumCulled = false;
      child.updateMatrix();
    });

    this.group = trackGroup;
  }

  _buildTrackSurface(inner, outer, trackGroup) {
    const verts = [], idx = [];
    for (let i = 0; i < inner.length; i++) {
      verts.push(inner[i].x, 0.01, inner[i].z);
      verts.push(outer[i].x, 0.01, outer[i].z);
    }
    for (let ti = 0; ti < inner.length; ti++) {
      const n = (ti + 1) % inner.length;
      const a = ti * 2, b = ti * 2 + 1, c = n * 2, d = n * 2 + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geom.setIndex(idx);
    trackGroup.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: 0x444444 })));
  }

  _buildWalls(inner, outer, trackGroup) {
    const step = 2;
    const count = Math.ceil(inner.length / step) + Math.ceil(outer.length / step);
    const geom = new THREE.SphereGeometry(1.8, 6, 4);
    const mesh = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial({ color: 0xcccccc }), count);
    const dummy = new THREE.Object3D();
    let n = 0;
    for (let i = 0; i < inner.length; i += step) {
      dummy.position.set(inner[i].x, 1.8, inner[i].z);
      dummy.updateMatrix();
      mesh.setMatrixAt(n++, dummy.matrix);
    }
    for (let oi = 0; oi < outer.length; oi += step) {
      dummy.position.set(outer[oi].x, 1.8, outer[oi].z);
      dummy.updateMatrix();
      mesh.setMatrixAt(n++, dummy.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    trackGroup.add(mesh);
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
    const t = this.curve.getTangentAt(0).normalize();
    let angle = Math.atan2(t.x, t.z);
    if (reversed) {
      angle += Math.PI;
      return { x: p.x + t.x * 12, z: p.z + t.z * 12, angle };
    }
    return { x: p.x + t.x * -12, z: p.z + t.z * -12, angle };
  }
}
