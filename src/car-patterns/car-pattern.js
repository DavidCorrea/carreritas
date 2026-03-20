export default class CarPattern {
  constructor(name) {
    this.name = name;
  }

  createMesh(_group, _opts) {
    // Override in subclasses
  }

  updateColors(_group, _primaryInt, _secondaryInt) {
    // Override in subclasses
  }

  drawPreview(_ctx, _r, _primary, _secondary) {
    // Override in subclasses
  }
}
