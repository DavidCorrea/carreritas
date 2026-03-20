import Renderer from './renderer.js';
import Constants from '../constants.js';
import { CAMERA_HEIGHT } from '../intrinsic-constants.js';
import { hexToInt, hexToRgb, disposeMesh, disposeGroup } from '../utils/index.js';

/** Indices in `Constants.camera.modes`: TOP-DOWN, ROTATED, CHASE, FIRST-PERSON, ISOMETRIC */
const CHASE_CAMERA_MODE_INDEX = 2;
const FIRST_PERSON_CAMERA_MODE_INDEX = 3;
const ISOMETRIC_CAMERA_MODE_INDEX = 4;

const NIGHT_LIGHTING_CHASE = {
  ambient: 0.06,
  fogDensity: 0.0055,
  pointIntensity: 1.05
};

/** Typical chase view ray to the track (not the shortest camera→car segment). */
const CHASE_FOG_REFERENCE_RAY = 102;

/** Tighten non-chase fog so top/iso don’t read brighter than chase after distance scaling. */
const NONCHASE_FOG_DENSITY_BOOST = 1.14;

/** Same headlight point light fills more of the frame from above — scale down slightly. */
const NONCHASE_POINT_LIGHT_SCALE = 0.9;

const NIGHT_BG_COLOR = 0x010102;

/** Isometric shows a huge ground area; keep night tight: heavy fog, low fill, small headlight pool. */
const ISOMETRIC_NIGHT_AMBIENT = 0.038;
const ISOMETRIC_POINT_LIGHT_SCALE = 0.76;
/** Extra fog multiplier on top of distance-scaled density (was <1 for readability; now >1 to hide far track). */
const ISOMETRIC_FOG_DENSITY_SCALE = 1.52;

/** First-person: bumper offset; cone uses `fpSpotParamsFromHeadlightShape` + SHAPE slider. */
const FP_BUMPER_OFFSET = Constants.car.radius * 0.48;

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

function createBeamMesh(length, halfAngle, rgb) {
  const segments = 16;
  const positions = [0, 0.02, 0];
  const colors = [rgb.r, rgb.g, rgb.b];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = -halfAngle + 2 * halfAngle * t;
    positions.push(Math.sin(a) * length, 0.02, Math.cos(a) * length);
    colors.push(0, 0, 0);
  }

  for (let j = 0; j < segments; j++) {
    indices.push(0, j + 1, j + 2);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);

  return new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
}

function createGlowMesh(radius, r, g, b) {
  const segments = 24;
  const positions = [0, 0.02, 0];
  const colors = [r, g, b];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(a) * radius, 0.02, Math.sin(a) * radius);
    colors.push(0, 0, 0);
  }

  for (let j = 0; j < segments; j++) {
    indices.push(0, j + 1, j + 2);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);

  return new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
}

function createUnderglowMesh(color, underglowOpacity) {
  const group = new THREE.Group();
  const segments = 40;
  const rgb = hexToRgb(color);
  const colorInt = hexToInt(color);
  const fade = underglowOpacity / 100;

  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(Constants.car.radius * 1.05, segments),
    new THREE.MeshBasicMaterial({ color: colorInt, transparent: true, opacity: 0.45 * fade, depthWrite: false })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.04;
  group.add(inner);

  const edgeR = Constants.car.radius * 0.9;
  const outerR = Constants.car.radius * 2.7;
  const positions = [];
  const colors = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const cx = Math.cos(a), cz = Math.sin(a);
    positions.push(cx * edgeR, 0.05, cz * edgeR);
    colors.push(rgb.r * 1.2 * fade, rgb.g * 1.2 * fade, rgb.b * 1.2 * fade);
    positions.push(cx * outerR, 0.05, cz * outerR);
    colors.push(0, 0, 0);
  }
  for (let k = 0; k < segments; k++) {
    const b = k * 2;
    indices.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  group.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  })));

  return group;
}

function headlightParams(headlightShape) {
  const t = (headlightShape != null ? headlightShape : 50) / 100;
  const length = 80 + (1 - t) * 100;
  const halfAngle = 0.2 + t * 0.5;
  return { length, halfAngle };
}

/** Writes FP spotlight cone params into `out` (no per-frame allocation). Same mapping as chase beam meshes. */
function fpSpotParamsFromHeadlightShapeInto(headlightShape, out) {
  const hp = headlightParams(headlightShape);
  const t = (headlightShape != null ? headlightShape : 50) / 100;
  out.angle = Math.min(Math.PI / 2 - 0.02, 2 * hp.halfAngle);
  out.distance = 95 + hp.length * 0.72;
  out.penumbra = 0.06 + (hp.halfAngle - 0.2) * 0.35;
  out.intensity = 3.4 + t * 1.4;
  out.aimDist = 55 + hp.length * 0.38;
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
    this.glowMesh = null;
    this.tailMesh = null;
    this.underglowMesh = null;
    this.underglowLight = null;
    this.fpHeadlightSpot = null;
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

    this.beamMeshL = createBeamMesh(hp.length, hp.halfAngle, hlRgb);
    this.beamMeshR = createBeamMesh(hp.length, hp.halfAngle, hlRgb);
    this.glowMesh = createGlowMesh(35, hlRgb.r * 0.4, hlRgb.g * 0.3, hlRgb.b * 0.1);
    this.tailMesh = createGlowMesh(15, 0.15, 0.02, 0);

    this.underglowMesh = createUnderglowMesh(carSettings.underglowColor, carSettings.underglowOpacity);
    this.underglowLight = new THREE.PointLight(hexToInt(carSettings.underglowColor), 0, 60, 2);

    this.scene.add(this.beamMeshL, this.beamMeshR, this.glowMesh, this.tailMesh, this.underglowMesh, this.underglowLight);
    this.beamMeshL.visible = false;
    this.beamMeshR.visible = false;
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

  _applyNightLightingForCamera(cameraModeIndex) {
    const idx = cameraModeIndex ?? CHASE_CAMERA_MODE_INDEX;
    if (this._nightCachedIdx === idx) return;
    this._nightCachedIdx = idx;
    const isChaseLike = idx === CHASE_CAMERA_MODE_INDEX || idx === FIRST_PERSON_CAMERA_MODE_INDEX;
    const isIso = idx === ISOMETRIC_CAMERA_MODE_INDEX;

    let ambient = NIGHT_LIGHTING_CHASE.ambient;
    let pointScale = isChaseLike ? 1 : NONCHASE_POINT_LIGHT_SCALE;
    if (isIso) {
      ambient = ISOMETRIC_NIGHT_AMBIENT;
      pointScale = ISOMETRIC_POINT_LIGHT_SCALE;
    }
    this.ambientLight.intensity = ambient;
    this.carPointLight.intensity = NIGHT_LIGHTING_CHASE.pointIntensity * pointScale;

    if (idx === FIRST_PERSON_CAMERA_MODE_INDEX) {
      // FP uses a spotlight to the road; the overhead point pool reads as a flat disc, not headlights.
      this.carPointLight.intensity = 0;
      this.ambientLight.intensity *= 1.08;
    }

    if (this.scene.fog) {
      let d = fogDensityForCamera(idx);
      if (isIso) {
        d *= ISOMETRIC_FOG_DENSITY_SCALE;
      }
      this.scene.fog.density = d;
      this.scene.fog.color.setHex(0x000000);
      this.scene.background.setHex(NIGHT_BG_COLOR);
    }
  }

  updateColors(carSettings) {
    const hlRgb = hexToRgb(carSettings.headlightsColor);
    const ugRgb = hexToRgb(carSettings.underglowColor);
    const ugFade = carSettings.underglowOpacity / 100;
    const ugColorInt = hexToInt(carSettings.underglowColor);

    const beamAttrL = this.beamMeshL.geometry.getAttribute('color');
    beamAttrL.setXYZ(0, hlRgb.r, hlRgb.g, hlRgb.b);
    beamAttrL.needsUpdate = true;
    const beamAttrR = this.beamMeshR.geometry.getAttribute('color');
    beamAttrR.setXYZ(0, hlRgb.r, hlRgb.g, hlRgb.b);
    beamAttrR.needsUpdate = true;

    const glowAttr = this.glowMesh.geometry.getAttribute('color');
    glowAttr.setXYZ(0, hlRgb.r * 0.4, hlRgb.g * 0.3, hlRgb.b * 0.1);
    glowAttr.needsUpdate = true;

    const innerMesh = this.underglowMesh.children[0];
    innerMesh.material.color.setHex(ugColorInt);
    innerMesh.material.opacity = 0.45 * ugFade;

    const outerMesh = this.underglowMesh.children[1];
    const outerAttr = outerMesh.geometry.getAttribute('color');
    for (let i = 0; i <= 40; i++) {
      outerAttr.setXYZ(i * 2, ugRgb.r * 1.2 * ugFade, ugRgb.g * 1.2 * ugFade, ugRgb.b * 1.2 * ugFade);
    }
    outerAttr.needsUpdate = true;

    this.underglowLight.color.setHex(ugColorInt);

    if (this.fpHeadlightSpot) {
      this.fpHeadlightSpot.color.setHex(hexToInt(carSettings.headlightsColor));
    }
  }

  rebuildMeshes(carSettings) {
    disposeMesh(this.beamMeshL);
    disposeMesh(this.beamMeshR);
    disposeMesh(this.glowMesh);
    disposeMesh(this.tailMesh);
    disposeGroup(this.underglowMesh);
    this.scene.remove(this.beamMeshL, this.beamMeshR, this.glowMesh, this.tailMesh, this.underglowMesh, this.underglowLight);

    const hlRgb = hexToRgb(carSettings.headlightsColor);
    const hp = headlightParams(carSettings.headlightShape);

    this.beamMeshL = createBeamMesh(hp.length, hp.halfAngle, hlRgb);
    this.beamMeshR = createBeamMesh(hp.length, hp.halfAngle, hlRgb);
    this.glowMesh = createGlowMesh(35, hlRgb.r * 0.4, hlRgb.g * 0.3, hlRgb.b * 0.1);
    this.tailMesh = createGlowMesh(15, 0.15, 0.02, 0);

    this.underglowMesh = createUnderglowMesh(carSettings.underglowColor, carSettings.underglowOpacity);
    this.underglowLight = new THREE.PointLight(hexToInt(carSettings.underglowColor), 0, 60, 2);

    this.scene.add(this.beamMeshL, this.beamMeshR, this.glowMesh, this.tailMesh, this.underglowMesh, this.underglowLight);
    this.beamMeshL.visible = false;
    this.beamMeshR.visible = false;
    this.glowMesh.visible = false;
    this.tailMesh.visible = false;
    this.underglowMesh.visible = false;
    this._fpHeadlightShapeCached = null;
    this._beamShapeAtRebuild = carSettings.headlightShape;
  }

  update(player, underglowOpacity, cameraModeIndex) {
    this._applyNightLightingForCamera(cameraModeIndex);

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
      this.beamMeshL.visible = false;
      this.beamMeshR.visible = false;
      this.glowMesh.visible = false;
      this.tailMesh.visible = false;
      return;
    }

    if (!isFirstPerson && this.carSettings.headlightShape !== this._beamShapeAtRebuild) {
      this.rebuildMeshes(this.carSettings);
    }

    this.beamMeshL.visible = showBeamMeshes;
    this.beamMeshR.visible = showBeamMeshes;
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
      return;
    }

    const headlightFwd = Constants.car.radius * 0.6;

    if (this.fpHeadlightSpot) {
      this.fpHeadlightSpot.visible = false;
      this.fpHeadlightSpot.intensity = 0;
    }

    this.beamMeshL.position.set(player.x + fx * headlightFwd, 0, player.z + fz * headlightFwd);
    this.beamMeshL.rotation.set(0, player.angle - 0.06, 0);

    this.beamMeshR.position.set(player.x + fx * headlightFwd, 0, player.z + fz * headlightFwd);
    this.beamMeshR.rotation.set(0, player.angle + 0.06, 0);

    this.glowMesh.position.set(player.x, 0, player.z);
    this.tailMesh.position.set(player.x - fx * Constants.car.radius, 0, player.z - fz * Constants.car.radius);

    this.carPointLight.position.set(player.x, 8, player.z);
  }

  cleanup() {
    if (this.beamMeshL) disposeMesh(this.beamMeshL);
    if (this.beamMeshR) disposeMesh(this.beamMeshR);
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
    if (this.underglowLight) this.scene.remove(this.underglowLight);
    
    if (this.beamMeshL) this.scene.remove(this.beamMeshL);
    if (this.beamMeshR) this.scene.remove(this.beamMeshR);
    if (this.glowMesh) this.scene.remove(this.glowMesh);
    if (this.tailMesh) this.scene.remove(this.tailMesh);
    if (this.underglowMesh) this.scene.remove(this.underglowMesh);
  }
}
