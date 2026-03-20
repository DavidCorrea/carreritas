import Constants from '../constants.js';
import { hexToInt, hexToRgb } from '../utils/index.js';

const UNDERGLOW_SEGMENTS = 40;

const GROUND_DECAL_OFFSET = { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 };

export function createUnderglowMesh(color, underglowOpacity) {
  const group = new THREE.Group();
  const rgb = hexToRgb(color);
  const colorInt = hexToInt(color);
  const fade = underglowOpacity / 100;

  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(Constants.car.radius * 1.05, UNDERGLOW_SEGMENTS),
    new THREE.MeshBasicMaterial(Object.assign({
      color: colorInt, transparent: true, opacity: 0.45 * fade, depthWrite: false
    }, GROUND_DECAL_OFFSET))
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.045;
  inner.renderOrder = 2;
  group.add(inner);

  const edgeR = Constants.car.radius * 0.9;
  const outerR = Constants.car.radius * 2.7;
  const positions = [];
  const colors = [];
  const indices = [];
  for (let i = 0; i <= UNDERGLOW_SEGMENTS; i++) {
    const a = (i / UNDERGLOW_SEGMENTS) * Math.PI * 2;
    const cx = Math.cos(a), cz = Math.sin(a);
    positions.push(cx * edgeR, 0.055, cz * edgeR);
    colors.push(rgb.r * 1.2 * fade, rgb.g * 1.2 * fade, rgb.b * 1.2 * fade);
    positions.push(cx * outerR, 0.055, cz * outerR);
    colors.push(0, 0, 0);
  }
  for (let k = 0; k < UNDERGLOW_SEGMENTS; k++) {
    const b = k * 2;
    indices.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  const outer = new THREE.Mesh(geom, new THREE.MeshBasicMaterial(Object.assign({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  }, GROUND_DECAL_OFFSET)));
  outer.renderOrder = 3;
  group.add(outer);

  return group;
}

export function applyUnderglowAppearance(underglowMesh, underglowLight, carSettings) {
  if (!underglowMesh || !underglowLight) return;
  const ugRgb = hexToRgb(carSettings.underglowColor);
  const ugFade = carSettings.underglowOpacity / 100;
  const ugColorInt = hexToInt(carSettings.underglowColor);

  const innerMesh = underglowMesh.children[0];
  innerMesh.material.color.setHex(ugColorInt);
  innerMesh.material.opacity = 0.45 * ugFade;

  const outerMesh = underglowMesh.children[1];
  const outerAttr = outerMesh.geometry.getAttribute('color');
  for (let i = 0; i <= UNDERGLOW_SEGMENTS; i++) {
    outerAttr.setXYZ(i * 2, ugRgb.r * 1.2 * ugFade, ugRgb.g * 1.2 * ugFade, ugRgb.b * 1.2 * ugFade);
  }
  outerAttr.needsUpdate = true;

  underglowLight.color.setHex(ugColorInt);
}
