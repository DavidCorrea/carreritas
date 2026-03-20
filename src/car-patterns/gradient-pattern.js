import CarPattern from './car-pattern.js';
import { CAR_RADIUS } from '../intrinsic-constants.js';
import { hexToRgb, intToHex } from '../utils/index.js';

export default class GradientPattern extends CarPattern {
  constructor() {
    super('gradient');
  }

  createMesh(group, opts) {
    const transparent = opts.opacity < 1;
    const primary = opts.color;
    const secondary = opts.secondaryColor || primary;
    const aSegs = 32;
    const rSegs = 10;
    const pRgb = hexToRgb(intToHex(primary));
    const sRgb = hexToRgb(intToHex(secondary));
    const gPositions = [];
    const gColors = [];
    const gIndices = [];

    for (let ri = 0; ri <= rSegs; ri++) {
      const rFrac = ri / rSegs;
      const rad = rFrac * CAR_RADIUS;
      for (let ai = 0; ai <= aSegs; ai++) {
        const ang = (ai / aSegs) * Math.PI * 2;
        const px = Math.cos(ang) * rad;
        const py = Math.sin(ang) * rad;
        gPositions.push(px, py, 0);
        const t = (py / CAR_RADIUS + 1) * 0.5;
        gColors.push(pRgb.r * t + sRgb.r * (1 - t));
        gColors.push(pRgb.g * t + sRgb.g * (1 - t));
        gColors.push(pRgb.b * t + sRgb.b * (1 - t));
      }
    }

    const stride = aSegs + 1;
    for (let ri2 = 0; ri2 < rSegs; ri2++) {
      for (let ai2 = 0; ai2 < aSegs; ai2++) {
        const a = ri2 * stride + ai2;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        gIndices.push(a, c, b, b, c, d);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(gPositions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(gColors, 3));
    geom.setIndex(gIndices);
    geom.computeVertexNormals();
    const gDisc = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({
      vertexColors: true, transparent, opacity: opts.opacity
    }));
    gDisc._colorRole = 'gradient';
    gDisc._gradientType = 'gradient';
    gDisc.rotation.x = -Math.PI / 2;
    gDisc.position.y = 2;
    group.add(gDisc);
  }

  updateColors(group, primaryInt, secondaryInt) {
    const pRgb = hexToRgb(intToHex(primaryInt));
    const sRgb = hexToRgb(intToHex(secondaryInt));
    group.traverse(function(child) {
      if (!child.isMesh || child._colorRole !== 'gradient') return;
      const colors = child.geometry.getAttribute('color');
      const positions = child.geometry.getAttribute('position');
      for (let i = 0; i < colors.count; i++) {
        const t = (positions.getY(i) / CAR_RADIUS + 1) * 0.5;
        colors.setXYZ(i, pRgb.r * t + sRgb.r * (1 - t), pRgb.g * t + sRgb.g * (1 - t), pRgb.b * t + sRgb.b * (1 - t));
      }
      colors.needsUpdate = true;
    });
  }

  drawPreview(ctx, r, primary, secondary) {
    const grad = ctx.createLinearGradient(r, 0, r, r * 2);
    grad.addColorStop(0, primary);
    grad.addColorStop(1, secondary);
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
}
