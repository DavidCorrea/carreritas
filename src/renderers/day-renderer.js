import Renderer from './renderer.js';

export default class DayRenderer extends Renderer {
  constructor(scene, carSettings) {
    super(scene, carSettings);
    this.ambientLight = null;
    this.setup(carSettings);
  }

  setup(_carSettings) {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(this.ambientLight);
    this.applyDaySettings();
  }

  applyDaySettings() {
    this.ambientLight.intensity = 1.0;
    this.scene.background.set(0x5d8a4a);
    this.scene.fog = null;
  }

  updateColors(_carSettings) {
    // Day mode doesn't need color updates
  }

  rebuildMeshes(_carSettings) {
    // Day mode doesn't have special meshes
  }

  update(_player, _underglowOpacity, _cameraModeIndex) {
    // Day mode doesn't need per-frame updates
  }

  cleanup() {
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight = null;
    }
  }
}
