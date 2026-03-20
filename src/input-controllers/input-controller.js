export default class InputController {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
  }

  static canHandle(_isMobile) {
    // Override in subclasses
    return false;
  }

  setup() {
    // Override in subclasses
  }

  getInput(_isTrackCodeFocused) {
    // Override in subclasses
    return { accel: 0, steer: 0 };
  }

  cleanup() {
    // Override in subclasses if needed
  }
}
