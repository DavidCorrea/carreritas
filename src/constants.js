import { CAR_RADIUS, CAMERA_HEIGHT } from './intrinsic-constants.js';
import { TopDownMode, RotatedMode, ChaseMode, FirstPersonMode, IsometricMode } from './camera-modes/index.js';
import { SolidPattern, RingPattern, HalfPattern, StripePattern, GradientPattern, RadialPattern, SpiralPattern, DotsPattern, BullseyePattern } from './car-patterns/index.js';

const MENU_PREVIEW_FPS = 60;

const Constants = {
  physics: {
    maxSpeed: 280,
    acceleration: 200,
    brakeForce: 320,
    steerSpeed: 2.8,
    friction: 0.985,
    grip: 3.5
  },

  car: {
    radius: CAR_RADIUS,
    ghostColor: 0x4da6e8,
    patterns: [new SolidPattern(), new RingPattern(), new HalfPattern(), new StripePattern(), new GradientPattern(), new RadialPattern(), new SpiralPattern(), new DotsPattern(), new BullseyePattern()],
    defaultSettings: {
      pattern: null, // Will be set to patterns[0] after initialization
      primaryColor: '#e84d4d',
      secondaryColor: '#ffffff',
      headlightsColor: '#ffe0a0',
      headlightShape: 50,
      underglowColor: '#ff00ff',
      underglowOpacity: 100
    }
  },

  track: {
    width: 55,
    samples: 400,
    recordInterval: 0.1
  },

  camera: {
    viewSize: 450,
    height: CAMERA_HEIGHT,
    modes: [new TopDownMode(), new RotatedMode(), new ChaseMode(), new FirstPersonMode(), new IsometricMode()],
    previewSpeed: 0.05,
    showcase: {
      /** Menu + settings preview when car is idle: classic orbiting shots only. */
      shotsIdle: [
        { duration: 6, radius: 45, height: 12, speed: 0.3, lookY: 5 },
        { duration: 7, radius: 80, height: 50, speed: -0.2, lookY: 0 },
        { duration: 5, radiusStart: 90, radiusEnd: 30, height: 18, speed: 0.15, lookY: 8 },
        { duration: 6, radius: 55, height: 30, speed: 0.25, lookY: 3 }
      ],
      /**
       * Settings preview with drive RUNNING: mixed beats — close lens, tripods, kerb cam, crane, sweeps.
       * `type: 'fixed'` = world-locked at shot start; car passes through frame. `fov` optional (deg).
       */
      shotsRunning: [
        { duration: 4, radius: 28, height: 11, speed: 0.42, lookY: 4, fov: 54 },
        { duration: 5, radius: 68, height: 42, speed: -0.16, lookY: 2, fov: 62 },
        { duration: 4, type: 'fixed', lateral: 118, height: 21, lookY: 3.2, side: 1 },
        { duration: 4, type: 'fixed', lateral: 92, height: 5.5, lookY: 1.2, side: -1 },
        { duration: 4, type: 'fixed', lateral: 44, height: 7, lookY: 3.8, side: -1, fov: 66 },
        { duration: 5, type: 'fixed', lateral: 135, height: 50, lookY: -1, fov: 48 },
        { duration: 5, radiusStart: 86, radiusEnd: 36, height: 20, speed: 0.22, lookY: 6, fov: 58 }
      ],
      transition: 1.5
    }
  },

  storage: {
    prefix: 'haxrace_ghost_',
    settingsKey: 'carreritas_settings',
    authKey: 'carreritas_auth'
  },

  share: {
    base: 'https://carreritas.vercel.app/'
  },

  menu: {
    previewFps: MENU_PREVIEW_FPS,
    previewFrameIntervalMs: 1000 / MENU_PREVIEW_FPS,
  },

  /**
   * When true, challenge leaderboard API responses are replaced with mock data
   * (`fake-leaderboard.js`). Default: on in Vite dev, off in production. Override with
   * `VITE_FAKE_CHALLENGE_LEADERBOARD=true` / `=false`.
   */
  fakeChallengeLeaderboards: (() => {
    if (typeof import.meta === 'undefined') return false;
    const v = import.meta.env.VITE_FAKE_CHALLENGE_LEADERBOARD;
    if (v === 'false') return false;
    if (v === 'true') return true;
    return import.meta.env.DEV === true;
  })(),

  countries: []
};

// Set default pattern after patterns array is created
Constants.car.defaultSettings.pattern = Constants.car.patterns[0];

export default Constants;
