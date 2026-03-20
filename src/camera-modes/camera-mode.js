export default class CameraMode {
  constructor(name, usesPerspective, viewSizeMultiplier) {
    this.name = name;
    this.usesPerspective = usesPerspective;
    this.viewSizeMultiplier = viewSizeMultiplier;
  }

  applyPosition(_camera, _player) {
    // Override in subclasses
  }

  update(_camera, _player, _dt) {
    // Override in subclasses
  }
}
