var keys = {};
var touchState = { accel: 0, steer: 0 };
var touchIds = { steer: null, throttle: null };
var steerOriginX = 0;

export function setupInput(canvas, isMobile, callbacks) {
  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (callbacks.onKeyDown) callbacks.onKeyDown(e);
  });

  window.addEventListener('keyup', function (e) { keys[e.code] = false; });

  if (isMobile) {
    var steerIndicator = document.getElementById('touch-steer-indicator');
    var steerDot = document.getElementById('touch-steer-dot');
    var gasHighlight = document.getElementById('touch-gas-highlight');
    var brakeHighlight = document.getElementById('touch-brake-highlight');
    var restartBtn = document.getElementById('touch-restart-btn');
    var cameraBtn = document.getElementById('touch-camera-btn');
    var menuBtn = document.getElementById('touch-menu-btn');

    var DEAD_ZONE = 15;

    function processTouch(touch) {
      var halfW = window.innerWidth / 2;
      if (touch.clientX < halfW) {
        touchIds.steer = touch.identifier;
        steerOriginX = touch.clientX;
        steerIndicator.style.left = (touch.clientX - 40) + 'px';
        steerIndicator.style.top = (touch.clientY - 40) + 'px';
        steerIndicator.classList.add('active');
        steerDot.style.left = '50%';
      } else {
        touchIds.throttle = touch.identifier;
        var ratio = touch.clientY / window.innerHeight;
        if (ratio < 0.65) {
          touchState.accel = 1;
          gasHighlight.classList.add('active');
          brakeHighlight.classList.remove('active');
        } else {
          touchState.accel = -1;
          brakeHighlight.classList.add('active');
          gasHighlight.classList.remove('active');
        }
      }
    }

    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) processTouch(e.changedTouches[i]);
    }, { passive: false });

    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === touchIds.steer) {
          var dx = t.clientX - steerOriginX;
          if (dx < -DEAD_ZONE) touchState.steer = 1;
          else if (dx > DEAD_ZONE) touchState.steer = -1;
          else touchState.steer = 0;
          var dotPct = 50 + Math.max(-40, Math.min(40, dx)) * (40 / 60);
          steerDot.style.left = dotPct + '%';
        } else if (t.identifier === touchIds.throttle) {
          var ratio = t.clientY / window.innerHeight;
          if (ratio < 0.65) {
            touchState.accel = 1;
            gasHighlight.classList.add('active');
            brakeHighlight.classList.remove('active');
          } else {
            touchState.accel = -1;
            brakeHighlight.classList.add('active');
            gasHighlight.classList.remove('active');
          }
        }
      }
    }, { passive: false });

    function handleTouchEnd(e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var id = e.changedTouches[i].identifier;
        if (id === touchIds.steer) {
          touchIds.steer = null;
          touchState.steer = 0;
          steerIndicator.classList.remove('active');
        }
        if (id === touchIds.throttle) {
          touchIds.throttle = null;
          touchState.accel = 0;
          gasHighlight.classList.remove('active');
          brakeHighlight.classList.remove('active');
        }
      }
    }

    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    function addTouchBtn(el, fn) {
      el.addEventListener('touchstart', function (e) {
        e.stopPropagation();
        e.preventDefault();
        fn();
      }, { passive: false });
    }

    if (callbacks.onTouchRestart) addTouchBtn(restartBtn, callbacks.onTouchRestart);
    if (callbacks.onTouchCamera) addTouchBtn(cameraBtn, callbacks.onTouchCamera);
    if (callbacks.onTouchMenu) addTouchBtn(menuBtn, callbacks.onTouchMenu);
  }
}

var _input = { accel: 0, steer: 0 };

export function getInput(isTrackCodeFocused) {
  if (isTrackCodeFocused) { _input.accel = 0; _input.steer = 0; return _input; }
  _input.accel = 0; _input.steer = 0;
  if (keys['ArrowUp'] || keys['KeyW']) _input.accel = 1;
  if (keys['ArrowDown'] || keys['KeyS']) _input.accel = _input.accel === 1 ? 0 : -1;
  if (keys['ArrowLeft'] || keys['KeyA']) _input.steer = 1;
  if (keys['ArrowRight'] || keys['KeyD']) _input.steer = -1;
  if (touchState.accel) _input.accel = touchState.accel;
  if (touchState.steer) _input.steer = touchState.steer;
  return _input;
}
