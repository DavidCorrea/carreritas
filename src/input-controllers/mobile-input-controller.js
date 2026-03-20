import InputController from './input-controller.js';
import KeyboardInputController from './keyboard-input-controller.js';

export default class MobileInputController extends InputController {
  static canHandle(isMobile) {
    return isMobile;
  }

  constructor(canvas, callbacks) {
    super(canvas, callbacks);
    this.touchState = { accel: 0, steer: 0 };
    this.touchIds = { steer: null, throttle: null };
    this.steerOriginX = 0;
    this.DEAD_ZONE = 15;
    
    // Mobile also supports keyboard for some actions
    this.keyboardController = new KeyboardInputController(canvas, callbacks);
    
    // DOM elements
    this.steerIndicator = null;
    this.steerDot = null;
    this.gasHighlight = null;
    this.brakeHighlight = null;
    this.restartBtn = null;
    this.cameraBtn = null;
    this.menuBtn = null;
    
    // Event handlers
    this.touchStartHandler = null;
    this.touchMoveHandler = null;
    this.touchEndHandler = null;
  }

  setup() {
    // Setup keyboard for non-driving actions
    this.keyboardController.setup();
    
    // Get DOM elements
    this.steerIndicator = document.getElementById('touch-steer-indicator');
    this.steerDot = document.getElementById('touch-steer-dot');
    this.gasHighlight = document.getElementById('touch-gas-highlight');
    this.brakeHighlight = document.getElementById('touch-brake-highlight');
    this.restartBtn = document.getElementById('touch-restart-btn');
    this.cameraBtn = document.getElementById('touch-camera-btn');
    this.menuBtn = document.getElementById('touch-menu-btn');

    this.touchStartHandler = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        this.processTouch(e.changedTouches[i]);
      }
    };

    this.touchMoveHandler = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.touchIds.steer) {
          const dx = t.clientX - this.steerOriginX;
          if (dx < -this.DEAD_ZONE) {
            this.touchState.steer = 1;
          } else if (dx > this.DEAD_ZONE) {
            this.touchState.steer = -1;
          } else {
            this.touchState.steer = 0;
          }
          const dotPct = 50 + Math.max(-40, Math.min(40, dx)) * (40 / 60);
          this.steerDot.style.left = dotPct + '%';
        } else if (t.identifier === this.touchIds.throttle) {
          const ratio = t.clientY / window.innerHeight;
          if (ratio < 0.65) {
            this.touchState.accel = 1;
            this.gasHighlight.classList.add('active');
            this.brakeHighlight.classList.remove('active');
          } else {
            this.touchState.accel = -1;
            this.brakeHighlight.classList.add('active');
            this.gasHighlight.classList.remove('active');
          }
        }
      }
    };

    this.touchEndHandler = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const id = e.changedTouches[i].identifier;
        if (id === this.touchIds.steer) {
          this.touchIds.steer = null;
          this.touchState.steer = 0;
          this.steerIndicator.classList.remove('active');
        }
        if (id === this.touchIds.throttle) {
          this.touchIds.throttle = null;
          this.touchState.accel = 0;
          this.gasHighlight.classList.remove('active');
          this.brakeHighlight.classList.remove('active');
        }
      }
    };

    this.canvas.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    this.canvas.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
    this.canvas.addEventListener('touchend', this.touchEndHandler, { passive: false });
    this.canvas.addEventListener('touchcancel', this.touchEndHandler, { passive: false });

    // Setup touch buttons
    if (this.callbacks.onTouchRestart) {
      this.addTouchBtn(this.restartBtn, this.callbacks.onTouchRestart);
    }
    if (this.callbacks.onTouchCamera) {
      this.addTouchBtn(this.cameraBtn, this.callbacks.onTouchCamera);
    }
    if (this.callbacks.onTouchMenu) {
      this.addTouchBtn(this.menuBtn, this.callbacks.onTouchMenu);
    }
  }

  processTouch(touch) {
    const halfW = window.innerWidth / 2;
    if (touch.clientX < halfW) {
      this.touchIds.steer = touch.identifier;
      this.steerOriginX = touch.clientX;
      this.steerIndicator.style.left = (touch.clientX - 40) + 'px';
      this.steerIndicator.style.top = (touch.clientY - 40) + 'px';
      this.steerIndicator.classList.add('active');
      this.steerDot.style.left = '50%';
    } else {
      this.touchIds.throttle = touch.identifier;
      const ratio = touch.clientY / window.innerHeight;
      if (ratio < 0.65) {
        this.touchState.accel = 1;
        this.gasHighlight.classList.add('active');
        this.brakeHighlight.classList.remove('active');
      } else {
        this.touchState.accel = -1;
        this.brakeHighlight.classList.add('active');
        this.gasHighlight.classList.remove('active');
      }
    }
  }

  addTouchBtn(el, fn) {
    el.addEventListener('touchstart', function (e) {
      e.stopPropagation();
      e.preventDefault();
      fn();
    }, { passive: false });
  }

  getInput(isTrackCodeFocused) {
    // Get keyboard input for non-driving actions
    const kbInput = this.keyboardController.getInput(isTrackCodeFocused);
    
    // For driving, use touch input if available, otherwise fall back to keyboard
    const input = { accel: kbInput.accel, steer: kbInput.steer };
    
    if (!isTrackCodeFocused) {
      if (this.touchState.accel) input.accel = this.touchState.accel;
      if (this.touchState.steer) input.steer = this.touchState.steer;
    }
    
    return input;
  }

  cleanup() {
    this.keyboardController.cleanup();
    
    if (this.touchStartHandler) {
      this.canvas.removeEventListener('touchstart', this.touchStartHandler);
    }
    if (this.touchMoveHandler) {
      this.canvas.removeEventListener('touchmove', this.touchMoveHandler);
    }
    if (this.touchEndHandler) {
      this.canvas.removeEventListener('touchend', this.touchEndHandler);
      this.canvas.removeEventListener('touchcancel', this.touchEndHandler);
    }
  }
}
