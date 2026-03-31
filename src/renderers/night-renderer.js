import Renderer from './renderer.js';
import Constants from '../constants.js';
import { CAMERA_HEIGHT, HEADLIGHT_DECAL_POLYGON_OFFSET, ROAD_SURFACE_Y } from '../intrinsic-constants.js';
import { hexToInt, hexToRgb, disposeMesh, disposeGroup } from '../utils/index.js';
import { createUnderglowMesh, applyUnderglowAppearance } from './underglow-mesh.js';

/** Indices in `Constants.camera.modes`: TOP-DOWN, ROTATED, CHASE, FIRST-PERSON, ISOMETRIC */
const TOP_DOWN_CAMERA_MODE_INDEX = 0;
const ROTATED_CAMERA_MODE_INDEX = 1;
const CHASE_CAMERA_MODE_INDEX = 2;
const FIRST_PERSON_CAMERA_MODE_INDEX = 3;
const ISOMETRIC_CAMERA_MODE_INDEX = 4;

const NIGHT_LIGHTING_CHASE = {
  ambient: 0.06,
  fogDensity: 0.0055,
  pointIntensity: 1.05
};

const NIGHT_BG_COLOR = 0x010102;

/**
 * Chase / FP use raw fog density. Top / rotated / isometric sit far above the track — the view ray
 * to the car is ~CAMERA_HEIGHT; Exp2 fog uses that distance, so the same density as chase blacks out
 * the car and underglow. Scale density down from `CHASE_FOG_REFERENCE_RAY` (see `fogDensityForCamera`).
 */
const CHASE_FOG_REFERENCE_RAY = 102;
const NONCHASE_FOG_DENSITY_BOOST = 1.14;
const TOP_ROTATED_FOG_SCALE = 1.48;
const ISOMETRIC_FOG_DENSITY_SCALE = 1.52;

/** Above asphalt (same order of lift as underglow inner) so ortho depth tests don’t reject beams on the road. */
const HEADLIGHT_DECAL_Y = ROAD_SURFACE_Y + 0.012;

/** Headlight point pool — slightly under full so grass spill stays soft (all non–first-person night views). */
const CHASE_NIGHT_POINT_SCALE = 0.9;
/**
 * Stencil-clipped beams (top / rotated / chase / isometric): tuned for readability; shared across those modes.
 * Exp2 scene fog does not affect these meshes (`material.fog` false when stencil beams are on).
 */
const STENCIL_NIGHT_BEAM_XZ_SCALE = 0.82;
const STENCIL_NIGHT_BEAM_OPACITY = 0.92;
const STENCIL_NIGHT_GLOW_XZ_SCALE = 0.85;
const STENCIL_NIGHT_GLOW_OPACITY = 0.68;
/** Additive spill outside the road mask (stencil ≠ 1) — faint so walls still read as blocking. */
const STENCIL_NIGHT_BEAM_FRINGE_OPACITY = 0.14;
/** Fringe on black grass reads hot — mild trim vs base fringe opacity. */
const STENCIL_NIGHT_BEAM_FRINGE_OPACITY_MUL = 0.78;

/** First-person: bumper offset; cone uses `fpSpotParamsFromHeadlightShape` + SHAPE slider. */
const FP_BUMPER_OFFSET = Constants.car.radius * 0.48;

/** Grazing spot for kerb walls (non-FP): low, near-horizontal cone so vertical faces pick up diffuse, not the road. */
const WALL_WASH_SPOT_INTENSITY = 0.42;
const WALL_WASH_BUMPER_Y = 0.55;
const WALL_WASH_TARGET_Y = 0.11;
const WALL_WASH_FWD = Constants.car.radius * 0.48;

function fogDensityForCamera(cameraModeIndex) {
  if (cameraModeIndex === CHASE_CAMERA_MODE_INDEX || cameraModeIndex === FIRST_PERSON_CAMERA_MODE_INDEX) {
    return NIGHT_LIGHTING_CHASE.fogDensity;
  }
  let rayToGround = CAMERA_HEIGHT;
  if (cameraModeIndex === ISOMETRIC_CAMERA_MODE_INDEX) {
    rayToGround = Math.hypot(180, 200, 180);
  }
  return (
    NIGHT_LIGHTING_CHASE.fogDensity *
    (CHASE_FOG_REFERENCE_RAY / rayToGround) *
    NONCHASE_FOG_DENSITY_BOOST
  );
}

function buildBeamGeometry(length, halfAngle, rgb) {
  const segments = 10;
  const y = HEADLIGHT_DECAL_Y;
  const positions = [0, y, 0];
  const colors = [rgb.r, rgb.g, rgb.b];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = -halfAngle + 2 * halfAngle * t;
    positions.push(Math.sin(a) * length, y, Math.cos(a) * length);
    colors.push(0, 0, 0);
  }

  for (let j = 0; j < segments; j++) {
    indices.push(0, j + 1, j + 2);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom._shared = true;
  return geom;
}

/** Stencil Equal 1 (road): bright L/R cones — same stack as fringe/glow (MeshBasicMaterial). */
function createBeamBrightMaterial() {
  const mat = new THREE.MeshBasicMaterial(
    Object.assign(
      {
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      },
      HEADLIGHT_DECAL_POLYGON_OFFSET
    )
  );
  mat._shared = true;
  return mat;
}

/** Dim stencil pass (NotEqual 1): shared by L/R fringe meshes — grass vs road is stencil-only. */
function createBeamFringeMaterial() {
  const mat = new THREE.MeshBasicMaterial(
    Object.assign(
      {
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      },
      HEADLIGHT_DECAL_POLYGON_OFFSET
    )
  );
  mat._shared = true;
  return mat;
}

function createBeamMesh(length, halfAngle, rgb, brightMaterial) {
  const geom = buildBeamGeometry(length, halfAngle, rgb);
  const mesh = new THREE.Mesh(geom, brightMaterial);
  mesh.renderOrder = 6;
  return mesh;
}

function createGlowMesh(radius, r, g, b) {
  const segments = 16;
  const y = HEADLIGHT_DECAL_Y;
  const positions = [0, y, 0];
  const colors = [r, g, b];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
    colors.push(0, 0, 0);
  }

  for (let j = 0; j < segments; j++) {
    indices.push(0, j + 1, j + 2);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);

  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshBasicMaterial(
      Object.assign(
        {
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: true,
        },
        HEADLIGHT_DECAL_POLYGON_OFFSET
      )
    )
  );
  mesh.renderOrder = 7;
  return mesh;
}

function headlightParams(headlightShape) {
  const t = (headlightShape != null ? headlightShape : 50) / 100;
  const length = 80 + (1 - t) * 100;
  const halfAngle = 0.2 + t * 0.5;
  return { length, halfAngle };
}

/** Writes FP spotlight cone params into `out` (no per-frame allocation). Beam length still follows `headlightParams`; FP aim is independent so the pool stays on the road ahead. */
function fpSpotParamsFromHeadlightShapeInto(headlightShape, out) {
  const hp = headlightParams(headlightShape);
  const t = (headlightShape != null ? headlightShape : 50) / 100;
  out.angle = Math.min(Math.PI / 2 - 0.02, 2 * hp.halfAngle);
  out.penumbra = 0.06 + (hp.halfAngle - 0.2) * 0.35;
  out.intensity = 3.4 + t * 1.4;
  // Target a few dozen metres ahead (not tied to chase beam length, which hits 80–180m and read as “aiming at the horizon”).
  // Wider cone (low t) = slightly closer hotspot; narrow (high t) = a bit farther but still capped.
  out.aimDist = 28 + t * 22;
  const fwd = Math.max(0, out.aimDist - FP_BUMPER_OFFSET);
  const rayLen = Math.hypot(fwd, 2.05 - 0.06);
  out.distance = Math.min(160, 32 + rayLen * 1.35);
}

export default class NightRenderer extends Renderer {
  constructor(scene, carSettings) {
    super(scene, carSettings);
    /** Skip redundant fog/ambient work when camera mode unchanged. */
    this._nightCachedIdx = undefined;
    /** Recompute FP cone only when SHAPE slider changes. */
    this._fpHeadlightShapeCached = null;
    /** Beam geometry matches this shape; FP spotlight uses `carSettings` without rebuilding beams. */
    this._beamShapeAtRebuild = null;
    this._fpSpotScratch = { angle: 0, distance: 0, penumbra: 0, intensity: 0, aimDist: 0 };
    this.ambientLight = null;
    this.carPointLight = null;
    this.beamMeshL = null;
    this.beamMeshR = null;
    /** Shared geometry with L/R; dim pass where stencil ≠ road ref (`NotEqualStencilFunc`). */
    this.beamMeshLFringe = null;
    this.beamMeshRFringe = null;
    this.glowMesh = null;
    this.tailMesh = null;
    this.underglowMesh = null;
    this.underglowLight = null;
    this.fpHeadlightSpot = null;
    /** Forward spot (non-FP) to lift Lambert kerb walls in the headlight cone; no shadows. */
    this.wallWashSpot = null;
    /** Cached clip mode for `_applyHeadlightStencilClip` (Equal ref 1 + write mask 0). */
    this._beamStencilClipCached = undefined;
    this.setup(carSettings);
    this.applyNightSettings();
  }

  setup(carSettings) {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(this.ambientLight);

    const hlRgb = hexToRgb(carSettings.headlightsColor);
    const hp = headlightParams(carSettings.headlightShape);
    this.carPointLight = new THREE.PointLight(0xffe0a0, 0, 90, 2);
    this.scene.add(this.carPointLight);

    const hlInt = hexToInt(carSettings.headlightsColor);
    fpSpotParamsFromHeadlightShapeInto(carSettings.headlightShape, this._fpSpotScratch);
    const fp0 = this._fpSpotScratch;
    this.fpHeadlightSpot = new THREE.SpotLight(hlInt, fp0.intensity, fp0.distance, fp0.angle, fp0.penumbra, 2);
    this.fpHeadlightSpot.castShadow = false;
    this.fpHeadlightSpot.visible = false;
    this.scene.add(this.fpHeadlightSpot);
    this.scene.add(this.fpHeadlightSpot.target);

    this.wallWashSpot = new THREE.SpotLight(
      hlInt,
      WALL_WASH_SPOT_INTENSITY,
      Math.min(220, hp.length * 1.05),
      Math.min(Math.PI / 2 - 0.04, 2 * hp.halfAngle + 0.14),
      0.3,
      0
    );
    this.wallWashSpot.castShadow = false;
    this.wallWashSpot.fog = false;
    this.wallWashSpot.visible = false;
    this.wallWashSpot.decay = 0;
    this.scene.add(this.wallWashSpot);
    this.scene.add(this.wallWashSpot.target);

    this._beamBrightMat = createBeamBrightMaterial();
    this.beamMeshL = createBeamMesh(hp.length, hp.halfAngle, hlRgb, this._beamBrightMat);
    this.beamMeshR = createBeamMesh(hp.length, hp.halfAngle, hlRgb, this._beamBrightMat);
    this._fringeMat = createBeamFringeMaterial();
    this.beamMeshLFringe = new THREE.Mesh(this.beamMeshL.geometry, this._fringeMat);
    this.beamMeshRFringe = new THREE.Mesh(this.beamMeshR.geometry, this._fringeMat);
    this.beamMeshLFringe.renderOrder = 6;
    this.beamMeshRFringe.renderOrder = 6;
    this.glowMesh = createGlowMesh(35, hlRgb.r * 0.4, hlRgb.g * 0.3, hlRgb.b * 0.1);
    this.tailMesh = createGlowMesh(15, 0.15, 0.02, 0);

    this.underglowMesh = createUnderglowMesh(carSettings.underglowColor, carSettings.underglowOpacity);
    this.underglowLight = new THREE.PointLight(hexToInt(carSettings.underglowColor), 0, 60, 2);

    this.scene.add(
      this.beamMeshL,
      this.beamMeshR,
      this.beamMeshLFringe,
      this.beamMeshRFringe,
      this.glowMesh,
      this.tailMesh,
      this.underglowMesh,
      this.underglowLight
    );
    this.beamMeshL.visible = false;
    this.beamMeshR.visible = false;
    this.beamMeshLFringe.visible = false;
    this.beamMeshRFringe.visible = false;
    this.glowMesh.visible = false;
    this.tailMesh.visible = false;
    this.underglowMesh.visible = false;
    this._fpHeadlightShapeCached = carSettings.headlightShape;
    this._beamShapeAtRebuild = carSettings.headlightShape;
  }

  applyNightSettings() {
    this.scene.background.set(NIGHT_BG_COLOR);
    this.scene.fog = new THREE.FogExp2(0x000000, NIGHT_LIGHTING_CHASE.fogDensity);
    this.ambientLight.intensity = NIGHT_LIGHTING_CHASE.ambient;
    this.carPointLight.intensity = NIGHT_LIGHTING_CHASE.pointIntensity;
  }

  /**
   * Top-down / rotated / chase / isometric: clip additive decals to the road mask (stencil ref 1). Kerbs clear
   * that mask at wall pixels (`track.js`).
   *
   * Three.js only enables GL_STENCIL_TEST when `material.stencilWrite` is true (`WebGLRenderer.setMaterial`).
   * For read-only testing we set `stencilWrite: true` and `stencilWriteMask: 0` so the equal test runs
   * but no stencil bits are modified.
   * Beam fringes use `NotEqualStencilFunc` (ref 1) for a dim additive pass only where stencil ≠ road.
   * Chase (perspective): road mesh uses `polygonOffset` so asphalt wins the depth buffer over the
   * decal plane — `HEADLIGHT_DECAL_POLYGON_OFFSET` pulls beams slightly farther forward than the road
   * but not as far as kerbs, so bright cones stay on the track (stencil Equal 1) and walls still win.
   */
  _applyHeadlightStencilClip(roadStencilEnabled) {
    if (this._beamStencilClipCached === roadStencilEnabled) return;
    this._beamStencilClipCached = roadStencilEnabled;
    const brightMeshes = [this.beamMeshL, this.beamMeshR, this.glowMesh, this.tailMesh];
    if (this.underglowMesh) {
      const ch = this.underglowMesh.children;
      for (let c = 0; c < ch.length; c++) brightMeshes.push(ch[c]);
    }
    const fringeMeshes = [this.beamMeshLFringe, this.beamMeshRFringe];

    for (let i = 0; i < brightMeshes.length; i++) {
      const m = brightMeshes[i] && brightMeshes[i].material;
      if (!m) continue;
      if (roadStencilEnabled) {
        m.stencilWrite = true;
        m.stencilWriteMask = 0;
        m.stencilFunc = THREE.EqualStencilFunc;
        m.stencilRef = 1;
        m.stencilFuncMask = 0xff;
        m.stencilFail = THREE.KeepStencilOp;
        m.stencilZFail = THREE.KeepStencilOp;
        m.stencilZPass = THREE.KeepStencilOp;
      } else {
        m.stencilWrite = false;
        m.stencilWriteMask = 0xff;
        m.stencilFunc = THREE.AlwaysStencilFunc;
        m.stencilRef = 0;
      }
    }
    for (let j = 0; j < fringeMeshes.length; j++) {
      const m = fringeMeshes[j] && fringeMeshes[j].material;
      if (!m) continue;
      if (roadStencilEnabled) {
        m.stencilWrite = true;
        m.stencilWriteMask = 0;
        m.stencilFunc = THREE.NotEqualStencilFunc;
        m.stencilRef = 1;
        m.stencilFuncMask = 0xff;
        m.stencilFail = THREE.KeepStencilOp;
        m.stencilZFail = THREE.KeepStencilOp;
        m.stencilZPass = THREE.KeepStencilOp;
      } else {
        m.stencilWrite = false;
        m.stencilWriteMask = 0xff;
        m.stencilFunc = THREE.AlwaysStencilFunc;
        m.stencilRef = 0;
      }
    }
  }

  _applyNightLightingForCamera(cameraModeIndex) {
    const idx = cameraModeIndex ?? CHASE_CAMERA_MODE_INDEX;
    if (this._nightCachedIdx === idx) return;
    this._nightCachedIdx = idx;

    if (idx === FIRST_PERSON_CAMERA_MODE_INDEX) {
      // FP: spotlight to the road; no overhead point pool. Slightly higher fill so the hood read matches.
      this.carPointLight.intensity = 0;
      this.ambientLight.intensity = NIGHT_LIGHTING_CHASE.ambient * 1.08;
    } else {
      this.ambientLight.intensity = NIGHT_LIGHTING_CHASE.ambient;
      this.carPointLight.intensity = NIGHT_LIGHTING_CHASE.pointIntensity * CHASE_NIGHT_POINT_SCALE;
    }

    if (this.scene.fog) {
      let d = fogDensityForCamera(idx);
      if (idx === TOP_DOWN_CAMERA_MODE_INDEX || idx === ROTATED_CAMERA_MODE_INDEX) {
        d *= TOP_ROTATED_FOG_SCALE;
      }
      if (idx === ISOMETRIC_CAMERA_MODE_INDEX) {
        d *= ISOMETRIC_FOG_DENSITY_SCALE;
      }
      this.scene.fog.density = d;
      this.scene.fog.color.setHex(0x000000);
      this.scene.background.setHex(NIGHT_BG_COLOR);
    }
  }

  updateColors(carSettings) {
    const hlRgb = hexToRgb(carSettings.headlightsColor);

    const beamAttrL = this.beamMeshL.geometry.getAttribute('color');
    beamAttrL.setXYZ(0, hlRgb.r, hlRgb.g, hlRgb.b);
    beamAttrL.needsUpdate = true;
    const beamAttrR = this.beamMeshR.geometry.getAttribute('color');
    beamAttrR.setXYZ(0, hlRgb.r, hlRgb.g, hlRgb.b);
    beamAttrR.needsUpdate = true;

    const glowAttr = this.glowMesh.geometry.getAttribute('color');
    glowAttr.setXYZ(0, hlRgb.r * 0.4, hlRgb.g * 0.3, hlRgb.b * 0.1);
    glowAttr.needsUpdate = true;

    applyUnderglowAppearance(this.underglowMesh, this.underglowLight, carSettings);

    if (this.fpHeadlightSpot) {
      this.fpHeadlightSpot.color.setHex(hexToInt(carSettings.headlightsColor));
    }
    if (this.wallWashSpot) {
      this.wallWashSpot.color.setHex(hexToInt(carSettings.headlightsColor));
    }
  }

  /**
   * Headlight cone geometry (beams + glow); underglow is independent of SHAPE.
   * Used when SHAPE drifts in chase/non-FP while dragging — avoids underglow teardown/recreate flicker.
   */
  _rebuildHeadlightBeamMeshes(carSettings) {
    if (this.beamMeshLFringe) {
      this.scene.remove(this.beamMeshLFringe, this.beamMeshRFringe);
      if (this._fringeMat) {
        this._fringeMat.dispose();
        this._fringeMat = null;
      }
      this.beamMeshLFringe = null;
      this.beamMeshRFringe = null;
    }
    const sharedBeamGeom = this.beamMeshL && this.beamMeshL.geometry;
    if (this._beamBrightMat) {
      this._beamBrightMat.dispose();
      this._beamBrightMat = null;
    }
    disposeMesh(this.beamMeshL);
    disposeMesh(this.beamMeshR);
    if (sharedBeamGeom && sharedBeamGeom._shared) {
      sharedBeamGeom.dispose();
    }
    disposeMesh(this.glowMesh);
    disposeMesh(this.tailMesh);
    this.scene.remove(this.beamMeshL, this.beamMeshR, this.glowMesh, this.tailMesh);

    const hlRgb = hexToRgb(carSettings.headlightsColor);
    const hp = headlightParams(carSettings.headlightShape);

    this._beamBrightMat = createBeamBrightMaterial();
    this.beamMeshL = createBeamMesh(hp.length, hp.halfAngle, hlRgb, this._beamBrightMat);
    this.beamMeshR = createBeamMesh(hp.length, hp.halfAngle, hlRgb, this._beamBrightMat);
    this._fringeMat = createBeamFringeMaterial();
    this.beamMeshLFringe = new THREE.Mesh(this.beamMeshL.geometry, this._fringeMat);
    this.beamMeshRFringe = new THREE.Mesh(this.beamMeshR.geometry, this._fringeMat);
    this.beamMeshLFringe.renderOrder = 6;
    this.beamMeshRFringe.renderOrder = 6;
    this.glowMesh = createGlowMesh(35, hlRgb.r * 0.4, hlRgb.g * 0.3, hlRgb.b * 0.1);
    this.tailMesh = createGlowMesh(15, 0.15, 0.02, 0);

    this.scene.add(this.beamMeshL, this.beamMeshR, this.beamMeshLFringe, this.beamMeshRFringe, this.glowMesh, this.tailMesh);
    this.beamMeshL.visible = false;
    this.beamMeshR.visible = false;
    this.beamMeshLFringe.visible = false;
    this.beamMeshRFringe.visible = false;
    this.glowMesh.visible = false;
    this.tailMesh.visible = false;
    this._fpHeadlightShapeCached = null;
    this._beamShapeAtRebuild = carSettings.headlightShape;
    this._beamStencilClipCached = undefined;
  }

  rebuildMeshes(carSettings) {
    this._rebuildHeadlightBeamMeshes(carSettings);

    disposeGroup(this.underglowMesh);
    this.scene.remove(this.underglowMesh, this.underglowLight);

    this.underglowMesh = createUnderglowMesh(carSettings.underglowColor, carSettings.underglowOpacity);
    this.underglowLight = new THREE.PointLight(hexToInt(carSettings.underglowColor), 0, 60, 2);

    this.scene.add(this.underglowMesh, this.underglowLight);
    this.underglowMesh.visible = false;
    this._beamStencilClipCached = undefined;
  }

  update(player, underglowOpacity, cameraModeIndex) {
    this._applyNightLightingForCamera(cameraModeIndex);

    /** Top / rotated / chase / isometric: road stencil + scaled beam/glow (chase uses its own scale). */
    const useRoadStencilBeams =
      cameraModeIndex === TOP_DOWN_CAMERA_MODE_INDEX ||
      cameraModeIndex === ROTATED_CAMERA_MODE_INDEX ||
      cameraModeIndex === CHASE_CAMERA_MODE_INDEX ||
      cameraModeIndex === ISOMETRIC_CAMERA_MODE_INDEX;

    const hasPlayer = !!player;
    const isFirstPerson = cameraModeIndex === FIRST_PERSON_CAMERA_MODE_INDEX;
    /** FP: spotlight only; chase/iso/top: additive beam meshes on the ground. */
    const showBeamMeshes = hasPlayer && !isFirstPerson;
    this.underglowMesh.visible = hasPlayer && underglowOpacity > 0;
    this.underglowLight.intensity = hasPlayer ? 2.5 * (underglowOpacity / 100) : 0;

    if (!hasPlayer) {
      if (this.fpHeadlightSpot) {
        this.fpHeadlightSpot.visible = false;
        this.fpHeadlightSpot.intensity = 0;
      }
      if (this.wallWashSpot) {
        this.wallWashSpot.visible = false;
        this.wallWashSpot.intensity = 0;
      }
      this.beamMeshL.visible = false;
      this.beamMeshR.visible = false;
      if (this.beamMeshLFringe) this.beamMeshLFringe.visible = false;
      if (this.beamMeshRFringe) this.beamMeshRFringe.visible = false;
      this.glowMesh.visible = false;
      this.tailMesh.visible = false;
      return;
    }

    if (!isFirstPerson && this.carSettings.headlightShape !== this._beamShapeAtRebuild) {
      this._rebuildHeadlightBeamMeshes(this.carSettings);
    }

    this._applyHeadlightStencilClip(useRoadStencilBeams);

    if (useRoadStencilBeams) {
      const bs = STENCIL_NIGHT_BEAM_XZ_SCALE;
      const brightOp = STENCIL_NIGHT_BEAM_OPACITY;
      const fringeOp = STENCIL_NIGHT_BEAM_FRINGE_OPACITY * STENCIL_NIGHT_BEAM_FRINGE_OPACITY_MUL;
      const gs = STENCIL_NIGHT_GLOW_XZ_SCALE;
      const glowOp = STENCIL_NIGHT_GLOW_OPACITY;
      this.beamMeshL.scale.set(bs, 1, bs);
      this.beamMeshR.scale.set(bs, 1, bs);
      if (this._beamBrightMat) {
        this._beamBrightMat.opacity = brightOp;
      }
      this.beamMeshLFringe.scale.set(bs, 1, bs);
      this.beamMeshRFringe.scale.set(bs, 1, bs);
      if (this._fringeMat) {
        this._fringeMat.opacity = fringeOp;
      }
      this.glowMesh.scale.set(gs, 1, gs);
      this.glowMesh.material.opacity = glowOp;
      this.tailMesh.scale.set(gs * 0.9, 1, gs * 0.9);
      this.tailMesh.material.opacity = glowOp;
    } else {
      this.beamMeshL.scale.set(1, 1, 1);
      this.beamMeshR.scale.set(1, 1, 1);
      if (this._beamBrightMat) {
        this._beamBrightMat.opacity = 1;
      }
      this.beamMeshLFringe.scale.set(1, 1, 1);
      this.beamMeshRFringe.scale.set(1, 1, 1);
      if (this._fringeMat) {
        this._fringeMat.opacity = 1;
      }
      this.glowMesh.scale.set(1, 1, 1);
      this.glowMesh.material.opacity = 1;
      this.tailMesh.scale.set(1, 1, 1);
      this.tailMesh.material.opacity = 1;
    }

    /** Scene fog still hides distant track; stencil beams/underglow ignore fog (same as chase) so reach reads beam-limited. */
    const headlightDecalsFog = !useRoadStencilBeams;
    const decalMeshes = [
      this.beamMeshL,
      this.beamMeshR,
      this.beamMeshLFringe,
      this.beamMeshRFringe,
      this.glowMesh,
      this.tailMesh,
    ];
    for (let di = 0; di < decalMeshes.length; di++) {
      const mat = decalMeshes[di] && decalMeshes[di].material;
      if (mat) mat.fog = headlightDecalsFog;
    }
    if (this.underglowMesh) {
      const ug = this.underglowMesh.children;
      for (let ui = 0; ui < ug.length; ui++) {
        const um = ug[ui].material;
        if (um) um.fog = headlightDecalsFog;
      }
    }

    this.beamMeshL.visible = showBeamMeshes;
    this.beamMeshR.visible = showBeamMeshes;
    const showFringe = showBeamMeshes && useRoadStencilBeams;
    this.beamMeshLFringe.visible = showFringe;
    this.beamMeshRFringe.visible = showFringe;
    this.glowMesh.visible = showBeamMeshes;
    this.tailMesh.visible = showBeamMeshes;

    const fx = Math.sin(player.angle);
    const fz = Math.cos(player.angle);

    this.underglowMesh.position.set(player.x, 0, player.z);
    this.underglowLight.position.set(player.x, 1.5, player.z);

    if (isFirstPerson) {
      if (this.fpHeadlightSpot) {
        const shape = this.carSettings.headlightShape;
        if (this._fpHeadlightShapeCached !== shape) {
          this._fpHeadlightShapeCached = shape;
          fpSpotParamsFromHeadlightShapeInto(shape, this._fpSpotScratch);
        }
        const fp = this._fpSpotScratch;
        this.fpHeadlightSpot.angle = fp.angle;
        this.fpHeadlightSpot.distance = fp.distance;
        this.fpHeadlightSpot.penumbra = fp.penumbra;
        this.fpHeadlightSpot.intensity = fp.intensity;
        const aim = fp.aimDist;
        this.fpHeadlightSpot.visible = true;
        this.fpHeadlightSpot.position.set(
          player.x + fx * FP_BUMPER_OFFSET,
          2.05,
          player.z + fz * FP_BUMPER_OFFSET
        );
        this.fpHeadlightSpot.target.position.set(
          player.x + fx * aim,
          0.06,
          player.z + fz * aim
        );
        this.fpHeadlightSpot.target.updateMatrixWorld();
      }
      if (this.wallWashSpot) {
        this.wallWashSpot.visible = false;
        this.wallWashSpot.intensity = 0;
      }
      return;
    }

    const headlightFwd = Constants.car.radius * 0.6;

    if (this.fpHeadlightSpot) {
      this.fpHeadlightSpot.visible = false;
      this.fpHeadlightSpot.intensity = 0;
    }

    if (this.wallWashSpot) {
      const hpW = headlightParams(this.carSettings.headlightShape);
      this.wallWashSpot.visible = showBeamMeshes;
      this.wallWashSpot.intensity = showBeamMeshes ? WALL_WASH_SPOT_INTENSITY : 0;
      if (showBeamMeshes) {
        this.wallWashSpot.angle = Math.min(Math.PI / 2 - 0.04, 2 * hpW.halfAngle + 0.14);
        this.wallWashSpot.distance = Math.min(220, hpW.length * 1.05);
        this.wallWashSpot.penumbra = 0.26 + hpW.halfAngle * 0.35;
        this.wallWashSpot.position.set(player.x + fx * WALL_WASH_FWD, WALL_WASH_BUMPER_Y, player.z + fz * WALL_WASH_FWD);
        const aim = hpW.length * 0.92;
        this.wallWashSpot.target.position.set(player.x + fx * aim, WALL_WASH_TARGET_Y, player.z + fz * aim);
        this.wallWashSpot.target.updateMatrixWorld();
      }
    }

    this.beamMeshL.position.set(player.x + fx * headlightFwd, 0, player.z + fz * headlightFwd);
    this.beamMeshL.rotation.set(0, player.angle - 0.06, 0);

    this.beamMeshR.position.set(player.x + fx * headlightFwd, 0, player.z + fz * headlightFwd);
    this.beamMeshR.rotation.set(0, player.angle + 0.06, 0);

    this.beamMeshLFringe.position.copy(this.beamMeshL.position);
    this.beamMeshLFringe.rotation.copy(this.beamMeshL.rotation);
    this.beamMeshRFringe.position.copy(this.beamMeshR.position);
    this.beamMeshRFringe.rotation.copy(this.beamMeshR.rotation);

    this.glowMesh.position.set(player.x, 0, player.z);
    this.tailMesh.position.set(player.x - fx * Constants.car.radius, 0, player.z - fz * Constants.car.radius);

    this.carPointLight.position.set(player.x, 8, player.z);
  }

  cleanup() {
    if (this.beamMeshLFringe) {
      this.scene.remove(this.beamMeshLFringe, this.beamMeshRFringe);
      if (this._fringeMat) {
        this._fringeMat.dispose();
        this._fringeMat = null;
      }
      this.beamMeshLFringe = null;
      this.beamMeshRFringe = null;
    }
    const sharedBeamGeom = this.beamMeshL && this.beamMeshL.geometry;
    if (this._beamBrightMat) {
      this._beamBrightMat.dispose();
      this._beamBrightMat = null;
    }
    if (this.beamMeshL) disposeMesh(this.beamMeshL);
    if (this.beamMeshR) disposeMesh(this.beamMeshR);
    if (sharedBeamGeom && sharedBeamGeom._shared) {
      sharedBeamGeom.dispose();
    }
    if (this.glowMesh) disposeMesh(this.glowMesh);
    if (this.tailMesh) disposeMesh(this.tailMesh);
    if (this.underglowMesh) disposeGroup(this.underglowMesh);
    
    if (this.ambientLight) this.scene.remove(this.ambientLight);
    if (this.carPointLight) this.scene.remove(this.carPointLight);
    if (this.fpHeadlightSpot) {
      this.scene.remove(this.fpHeadlightSpot.target);
      this.scene.remove(this.fpHeadlightSpot);
      this.fpHeadlightSpot = null;
    }
    if (this.wallWashSpot) {
      this.scene.remove(this.wallWashSpot.target);
      this.scene.remove(this.wallWashSpot);
      this.wallWashSpot = null;
    }
    if (this.underglowLight) this.scene.remove(this.underglowLight);
    
    if (this.beamMeshL) this.scene.remove(this.beamMeshL);
    if (this.beamMeshR) this.scene.remove(this.beamMeshR);
    if (this.glowMesh) this.scene.remove(this.glowMesh);
    if (this.tailMesh) this.scene.remove(this.tailMesh);
    if (this.underglowMesh) this.scene.remove(this.underglowMesh);
  }
}
