import { CAR_RADIUS, CAMERA_HEIGHT } from './intrinsic-constants.js';
import { TopDownMode, RotatedMode, ChaseMode, FirstPersonMode, IsometricMode } from './camera-modes/index.js';
import { SolidPattern, RingPattern, HalfPattern, StripePattern, GradientPattern, RadialPattern, SpiralPattern, DotsPattern, BullseyePattern } from './car-patterns/index.js';
import {
  clipperScale,
  clipperCenterlineMultiplier,
  clipperMaxCenterlinePoints,
  clipperArcToleranceFactor,
} from './track-clipper-config.js';
const MENU_PREVIEW_FPS = 60;

const Constants = {
  physics: {
    maxSpeed: 280,
    acceleration: 200,
    brakeForce: 320,
    /** Slightly slower steering response — line choice matters more. */
    steerSpeed: 2.6,
    /** A bit more drag — harder to carry speed through mistakes. */
    friction: 0.982,
    /** Less lateral damping — easier to scrub speed or slide wide in fast corners. */
    grip: 2.75
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
    /** Narrower driving corridor than the original 48 — less room at the edges. */
    width: 40,
    /** Samples along closed spline — road mesh, spine, collision (must stay aligned). */
    samples: 1200,
    /**
     * Wall LineLoops use `samples * this` divisions — shorter chords, fewer sharp corners between samples.
     */
    wallLineSampleMultiplier: 8,
    /**
     * Stricter than `curvatureOffsetSafety`: used **only** for wall LineLoop geometry so inner offset stays
     * simple (no bowties). Road mesh / collision keep `curvatureOffsetSafety` — kerb can sit slightly inside
     * the asphalt on the tightest bends.
     */
    wallLineCurvatureSafety: 0.58,
    /**
     * Parallel offset must stay inside local radius of curvature or the inner offset self-crosses (loops/spikes).
     * d = min(halfWidth, R * this); R uses several conservative estimates (see track.js).
     */
    curvatureOffsetSafety: 0.83,
    clipperScale,
    clipperCenterlineMultiplier,
    clipperMaxCenterlinePoints,
    clipperArcToleranceFactor,

    /** Kerb cap extends this far from the road edge, radially from track centroid. */
    /** Slab depth: road edge → outer face (reads as a thin wall in plan). */
    kerbExtrudeWidth: 0.7,
    /** Bottom of the wall (just above asphalt; see `track.js` ROAD_SURFACE_Y). */
    kerbBaseY: 0.034,
    /** Top of the track-edge wall (span was reduced 40% from the prior tall wall). */
    kerbCapY: 1.872,

    /** Extra margin beyond car radius for corridor collision — tighter than 1.2 so edge corrections bite sooner. */
    corridorShell: 0.85,
    recordInterval: 0.1
  },

  camera: {
    viewSize: 450,
    height: CAMERA_HEIGHT,
    modes: [new TopDownMode(), new RotatedMode(), new ChaseMode(), new FirstPersonMode(), new IsometricMode()],
    previewSpeed: 0.05,
    showcase: {
      /** Multiplier on orbit `radius` / `radiusStart`/`radiusEnd` (keeps camera closer to the car). */
      orbitDistanceScale: 0.78,
      /** Multiplier on fixed `lateral` and `forward` rig distances. */
      fixedLateralScale: 0.72,
      /** Slightly lower orbit + fixed rig heights so crane shots don’t lose the car. */
      showcaseHeightScale: 0.9,
      /** Extra Y on orbit shots marked `aerial: true` (satellite / drone reads). */
      aerialHeightBoost: 1.06,
      /** Menu + settings preview when car is idle: classic orbiting shots only. */
      shotsIdle: [
        { duration: 6, radius: 45, height: 12, speed: 0.3, lookY: 5 },
        { duration: 5, type: 'fixed', forward: 100, height: 11, lookY: 2.4, fov: 52 },
        { duration: 7, radius: 50, height: 74, speed: 0.09, lookY: 0.25, fov: 56, aerial: true, radiusZScale: 0.55 },
        { duration: 7, radius: 72, height: 42, speed: -0.2, lookY: 0 },
        { duration: 6, radiusStart: 34, radiusEnd: 70, heightStart: 26, heightEnd: 78, speed: 0.1, lookYStart: 2.8, lookYEnd: -0.15, fov: 54, aerial: true },
        { duration: 5, radius: 46, height: 64, speed: -0.13, lookY: 0.6, fov: 58, aerial: true, heightSwayAmp: 3.5, heightSwaySpeed: 1.05 },
        { duration: 5, radiusStart: 78, radiusEnd: 28, height: 18, speed: 0.15, lookY: 8 },
        { duration: 6, radius: 52, height: 28, speed: 0.25, lookY: 3 }
      ],
      /**
       * Settings preview with drive RUNNING + post-race replay: mixed beats — close lens, long approach, tripods, kerb, crane, sweeps.
       * `type: 'fixed'` + `lateral` = trackside tripod. `type: 'fixed'` + `forward` = camera down the road ahead of the car (car grows toward camera).
       * Orbit: optional `heightStart`/`heightEnd`, `lookYStart`/`lookYEnd`, `heightSwayAmp`/`heightSwaySpeed`, `radiusZScale` (ellipse), `aerial: true` (+ aerialHeightBoost).
       * `fov` optional (deg).
       */
      shotsRunning: [
        { duration: 4, radius: 28, height: 11, speed: 0.42, lookY: 4, fov: 54 },
        { duration: 5, radius: 44, height: 70, speed: 0.11, lookY: 0.15, fov: 54, aerial: true, radiusZScale: 0.6 },
        { duration: 6, type: 'fixed', forward: 112, height: 8.5, lookY: 2.1, fov: 46 },
        { duration: 5, radius: 62, height: 36, speed: -0.16, lookY: 2, fov: 62 },
        { duration: 6, radiusStart: 58, radiusEnd: 26, heightStart: 62, heightEnd: 16, speed: -0.12, lookYStart: 0.4, lookYEnd: 5, fov: 52 },
        { duration: 4, type: 'fixed', lateral: 102, height: 21, lookY: 3.2, side: 1 },
        { duration: 4, type: 'fixed', lateral: 82, height: 5.5, lookY: 1.2, side: -1 },
        { duration: 4, type: 'fixed', lateral: 42, height: 7, lookY: 3.8, side: -1, fov: 66 },
        { duration: 5, type: 'fixed', lateral: 118, height: 42, lookY: -0.5, fov: 48 },
        { duration: 5, type: 'fixed', forward: 96, height: 5.8, lookY: 1.0, fov: 54 },
        { duration: 4, radius: 38, height: 56, speed: 0.26, lookY: 0.45, fov: 60, aerial: true, heightSwayAmp: 2.2, heightSwaySpeed: 1.35, radiusZScale: 0.72 },
        { duration: 5, radiusStart: 72, radiusEnd: 32, height: 20, speed: 0.22, lookY: 6, fov: 58 }
      ],
      transition: 1.5
    }
  },

  storage: {
    prefix: 'haxrace_ghost_',
    settingsKey: 'carreritas_settings',
    arcadeNameKey: 'carreritas_arcade_name'
  },

  share: {
    base: 'https://carreritas.vercel.app/'
  },

  menu: {
    previewFps: MENU_PREVIEW_FPS,
    previewFrameIntervalMs: 1000 / MENU_PREVIEW_FPS,
  },

  /**
   * When true, challenge leaderboard is not fetched from the API (empty TOP 10 in dev).
   * Post-race name prompt still runs; submit is skipped. Default: on in Vite dev, off in production.
   * Override with `VITE_FAKE_CHALLENGE_LEADERBOARD=true` / `=false`.
   */
  fakeChallengeLeaderboards: (() => {
    if (typeof import.meta === 'undefined') return false;
    const v = import.meta.env.VITE_FAKE_CHALLENGE_LEADERBOARD;
    if (v === 'false') return false;
    if (v === 'true') return true;
    return import.meta.env.DEV === true;
  })()
};

// Set default pattern after patterns array is created
Constants.car.defaultSettings.pattern = Constants.car.patterns[0];

export default Constants;
