import InputController from './input-controller.js';

export default class KeyboardInputController extends InputController {
  static canHandle(isMobile) {
    return !isMobile;
  }

  constructor(canvas, callbacks) {
    super(canvas, callbacks);
    this.keys = {};
    this._input = { accel: 0, steer: 0 };
    this.keyDownHandler = null;
    this.keyUpHandler = null;
  }

  setup() {
    this.keyDownHandler = (e) => {
      this.keys[e.code] = true;
      if (this.callbacks.onKeyDown) this.callbacks.onKeyDown(e);
    };
    this.keyUpHandler = (e) => {
      this.keys[e.code] = false;
    };

    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  }

  getInput(isTrackCodeFocused) {
    if (isTrackCodeFocused) {
      this._input.accel = 0;
      this._input.steer = 0;
      return this._input;
    }

    this._input.accel = 0;
    this._input.steer = 0;

    if (this.keys['ArrowUp'] || this.keys['KeyW']) this._input.accel = 1;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) {
      this._input.accel = this._input.accel === 1 ? 0 : -1;
    }
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) this._input.steer = 1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) this._input.steer = -1;

    return this._input;
  }

  cleanup() {
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler);
    }
    if (this.keyUpHandler) {
      window.removeEventListener('keyup', this.keyUpHandler);
    }
  }
}
