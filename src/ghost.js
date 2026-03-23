import Constants from './constants.js';
import { disposeGroup } from './utils/index.js';
import { CarMesh } from './car-mesh.js';

export default class Ghost {
  constructor() {
    this.mesh = null;
    this.replay = null;
  }

  create(replay, track, direction, scene) {
    this.dispose(scene);
    this.replay = replay;
    if (!replay) return;

    const start = track.getStartPosition(direction);
    this.mesh = new CarMesh({
      color: Constants.car.ghostColor, x: start.x, z: start.z, angle: start.angle, opacity: 0.35
    });
    scene.add(this.mesh);
    this.mesh.traverse(function (child) {
      if (child.isMesh && child.material.type === 'MeshLambertMaterial') {
        const m = child.material;
        child.material = new THREE.MeshBasicMaterial({
          color: m.color, transparent: m.transparent, opacity: m.opacity
        });
        if (!m._sharedCarPalette) m.dispose();
      }
    });
    this.mesh.visible = false;
  }

  update(raceTimer) {
    if (!this.mesh || !this.replay) return;

    const frameTime = raceTimer / Constants.track.recordInterval;
    const i = Math.floor(frameTime);

    if (i >= this.replay.length - 1) {
      this.mesh.visible = false;
      return;
    }

    let frac = frameTime - i;
    // First interval: linear lerp acts like constant speed from grid to the ~0.1s sample; the car
    // actually accelerates from rest, so the chord overshoots and the ghost “jumps” when the race starts.
    if (i === 0) {
      frac *= frac;
    }
    const fa = this.replay[i], fb = this.replay[i + 1];

    const x = fa.x + (fb.x - fa.x) * frac;
    const z = fa.z + (fb.z - fa.z) * frac;

    let angleDiff = fb.a - fa.a;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = fa.a + angleDiff * frac;
    this.mesh.visible = true;
  }

  setVisibleWhenPresent(visible) {
    if (this.mesh) this.mesh.visible = visible;
  }

  dispose(scene) {
    if (this.mesh) {
      disposeGroup(this.mesh);
      scene.remove(this.mesh);
      this.mesh = null;
    }
    this.replay = null;
  }
}
