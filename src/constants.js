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
      shots: [
        { duration: 6, radius: 45, height: 12, speed: 0.3, lookY: 5 },
        { duration: 7, radius: 80, height: 50, speed: -0.2, lookY: 0 },
        { duration: 5, radiusStart: 90, radiusEnd: 30, height: 18, speed: 0.15, lookY: 8 },
        { duration: 6, radius: 55, height: 30, speed: 0.25, lookY: 3 }
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
