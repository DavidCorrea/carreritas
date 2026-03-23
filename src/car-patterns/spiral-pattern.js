import CarPattern from './car-pattern.js';
import { sharedGeom } from '../car-geometries.js';

export default class SpiralPattern extends CarPattern {
  constructor() {
    super('spiral');
  }

  createMesh(group, opts) {
    for (let si = 0; si < 6; si++) {
      const mat = si % 2 === 0 ? opts.primaryMat : opts.secondaryMat;
      const slice = new THREE.Mesh(
        sharedGeom['spiral' + si],
        mat
      );
      slice.rotation.x = -Math.PI / 2;
      slice.position.y = 2;
      slice._colorRole = si % 2 === 0 ? 'primary' : 'secondary';
      group.add(slice);
    }
  }

  updateColors(group, primaryInt, secondaryInt) {
    group.traverse(function(child) {
      if (!child.isMesh || !child._colorRole) return;
      const role = child._colorRole;
      if (role === 'primary') {
        child.material.color.setHex(primaryInt);
      } else if (role === 'secondary') {
        child.material.color.setHex(secondaryInt);
      }
    });
  }

  drawPreview(ctx, r, primary, secondary) {
    const blades = 6;
    const sliceA = (Math.PI * 2) / blades;
    for (let si = 0; si < blades; si++) {
      ctx.beginPath();
      ctx.moveTo(r, r);
      ctx.arc(r, r, r, si * sliceA - Math.PI / 2, (si + 1) * sliceA - Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = si % 2 === 0 ? primary : secondary;
      ctx.fill();
    }
  }
}
