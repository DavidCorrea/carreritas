export default class Renderer {
  constructor(scene, carSettings) {
    this.scene = scene;
    this.carSettings = carSettings;
  }

  setup(_carSettings) {
    // Override in subclasses
  }

  updateColors(_carSettings) {
    // Override in subclasses
  }

  rebuildMeshes(_carSettings) {
    // Override in subclasses
  }

  update(_player, _underglowOpacity, _cameraModeIndex) {
    // Override in subclasses
  }
}
