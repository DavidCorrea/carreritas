import { KeyboardInputController, MobileInputController } from './input-controllers/index.js';
import { isMobile } from './utils/index.js';

const CONTROLLERS = [MobileInputController, KeyboardInputController];

export default class Input {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.isMobile = isMobile();

    // Find the first controller that can handle this configuration
    const ControllerClass = CONTROLLERS.find(function(C) {
      return C.canHandle(this.isMobile);
    }.bind(this));

    this.controller = new ControllerClass(this.canvas, this.callbacks);
    this.controller.setup();
  }

  getInput(isTrackCodeFocused) {
    return this.controller.getInput(isTrackCodeFocused);
  }

  cleanup() {
    this.controller.cleanup();
    this.controller = null;
  }
}
