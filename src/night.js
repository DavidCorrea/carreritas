import { C } from './constants.js';
import { hexToInt, hexToRgb, disposeMesh, disposeGroup } from './utils.js';

function createBeamMesh(length, halfAngle, rgb) {
  var segments = 16;
  var positions = [0, 0.02, 0];
  var colors = [rgb.r, rgb.g, rgb.b];
  var indices = [];

  for (var i = 0; i <= segments; i++) {
    var t = i / segments;
    var a = -halfAngle + 2 * halfAngle * t;
    positions.push(Math.sin(a) * length, 0.02, Math.cos(a) * length);
    colors.push(0, 0, 0);
  }

  for (var i = 0; i < segments; i++) {
    indices.push(0, i + 1, i + 2);
  }

  var geom = new THREE.BufferGeometry();
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
  var segments = 24;
  var positions = [0, 0.02, 0];
  var colors = [r, g, b];
  var indices = [];

  for (var i = 0; i <= segments; i++) {
    var a = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(a) * radius, 0.02, Math.sin(a) * radius);
    colors.push(0, 0, 0);
  }

  for (var i = 0; i < segments; i++) {
    indices.push(0, i + 1, i + 2);
  }

  var geom = new THREE.BufferGeometry();
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
  var group = new THREE.Group();
  var segments = 40;
  var rgb = hexToRgb(color);
  var colorInt = hexToInt(color);
  var fade = underglowOpacity / 100;

  var inner = new THREE.Mesh(
    new THREE.CircleGeometry(C.car.radius * 1.05, segments),
    new THREE.MeshBasicMaterial({ color: colorInt, transparent: true, opacity: 0.45 * fade, depthWrite: false })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.04;
  group.add(inner);

  var edgeR = C.car.radius * 0.9;
  var outerR = C.car.radius * 2.7;
  var positions = [];
  var colors = [];
  var indices = [];
  for (var i = 0; i <= segments; i++) {
    var a = (i / segments) * Math.PI * 2;
    var cx = Math.cos(a), cz = Math.sin(a);
    positions.push(cx * edgeR, 0.05, cz * edgeR);
    colors.push(rgb.r * 1.2 * fade, rgb.g * 1.2 * fade, rgb.b * 1.2 * fade);
    positions.push(cx * outerR, 0.05, cz * outerR);
    colors.push(0, 0, 0);
  }
  for (var i = 0; i < segments; i++) {
    var b = i * 2;
    indices.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
  }
  var geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  group.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  })));

  return group;
}

function headlightParams(headlightShape) {
  var t = (headlightShape != null ? headlightShape : 50) / 100;
  var length = 80 + (1 - t) * 100;
  var halfAngle = 0.2 + t * 0.5;
  return { length: length, halfAngle: halfAngle };
}

export class NightRenderer {
  constructor(scene, carSettings) {
    this.scene = scene;
    this.ambientLight = null;
    this.carPointLight = null;
    this.beamMeshL = null;
    this.beamMeshR = null;
    this.glowMesh = null;
    this.tailMesh = null;
    this.underglowMesh = null;
    this.underglowLight = null;
    this.prevNightState = null;

    this.setup(carSettings);
  }

  setup(carSettings) {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(this.ambientLight);

    var hlRgb = hexToRgb(carSettings.headlightsColor);
    var hp = headlightParams(carSettings.headlightShape);
    this.carPointLight = new THREE.PointLight(0xffe0a0, 0, 90, 2);
    this.scene.add(this.carPointLight);

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
  }

  updateColors(carSettings) {
    var hlRgb = hexToRgb(carSettings.headlightsColor);
    var ugRgb = hexToRgb(carSettings.underglowColor);
    var ugFade = carSettings.underglowOpacity / 100;
    var ugColorInt = hexToInt(carSettings.underglowColor);

    var beamAttrL = this.beamMeshL.geometry.getAttribute('color');
    beamAttrL.setXYZ(0, hlRgb.r, hlRgb.g, hlRgb.b);
    beamAttrL.needsUpdate = true;
    var beamAttrR = this.beamMeshR.geometry.getAttribute('color');
    beamAttrR.setXYZ(0, hlRgb.r, hlRgb.g, hlRgb.b);
    beamAttrR.needsUpdate = true;

    var glowAttr = this.glowMesh.geometry.getAttribute('color');
    glowAttr.setXYZ(0, hlRgb.r * 0.4, hlRgb.g * 0.3, hlRgb.b * 0.1);
    glowAttr.needsUpdate = true;

    var innerMesh = this.underglowMesh.children[0];
    innerMesh.material.color.setHex(ugColorInt);
    innerMesh.material.opacity = 0.45 * ugFade;

    var outerMesh = this.underglowMesh.children[1];
    var outerAttr = outerMesh.geometry.getAttribute('color');
    for (var i = 0; i <= 40; i++) {
      outerAttr.setXYZ(i * 2, ugRgb.r * 1.2 * ugFade, ugRgb.g * 1.2 * ugFade, ugRgb.b * 1.2 * ugFade);
    }
    outerAttr.needsUpdate = true;

    this.underglowLight.color.setHex(ugColorInt);
  }

  rebuildMeshes(carSettings) {
    disposeMesh(this.beamMeshL);
    disposeMesh(this.beamMeshR);
    disposeMesh(this.glowMesh);
    disposeMesh(this.tailMesh);
    disposeGroup(this.underglowMesh);
    this.scene.remove(this.beamMeshL, this.beamMeshR, this.glowMesh, this.tailMesh, this.underglowMesh, this.underglowLight);

    var hlRgb = hexToRgb(carSettings.headlightsColor);
    var hp = headlightParams(carSettings.headlightShape);

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
  }

  applyToggle(nightMode) {
    this.ambientLight.intensity = nightMode ? 0 : 1.0;
    this.scene.background.set(nightMode ? 0x000000 : 0x5d8a4a);
    this.scene.fog = nightMode ? new THREE.FogExp2(0x000000, 0.008) : null;
    this.carPointLight.intensity = nightMode ? 0.8 : 0;
    this.prevNightState = nightMode;
  }

  update(player, nightMode, underglowOpacity) {
    if (nightMode !== this.prevNightState) this.applyToggle(nightMode);

    var hasPlayer = !!player;
    var showBeams = nightMode && hasPlayer;
    this.beamMeshL.visible = showBeams;
    this.beamMeshR.visible = showBeams;
    this.glowMesh.visible = showBeams;
    this.tailMesh.visible = showBeams;
    this.underglowMesh.visible = nightMode && hasPlayer && underglowOpacity > 0;
    this.underglowLight.intensity = nightMode && hasPlayer ? 2.5 * (underglowOpacity / 100) : 0;

    if (!hasPlayer) return;

    var fx = Math.sin(player.angle);
    var fz = Math.cos(player.angle);

    this.underglowMesh.position.set(player.x, 0, player.z);
    this.underglowLight.position.set(player.x, 1.5, player.z);

    if (!showBeams) return;

    var headlightFwd = C.car.radius * 0.6;

    this.beamMeshL.position.set(player.x + fx * headlightFwd, 0, player.z + fz * headlightFwd);
    this.beamMeshL.rotation.y = player.angle - 0.06;
    this.beamMeshR.position.set(player.x + fx * headlightFwd, 0, player.z + fz * headlightFwd);
    this.beamMeshR.rotation.y = player.angle + 0.06;

    this.glowMesh.position.set(player.x, 0, player.z);
    this.tailMesh.position.set(player.x - fx * C.car.radius, 0, player.z - fz * C.car.radius);

    this.carPointLight.position.set(player.x, 8, player.z);
  }
}
