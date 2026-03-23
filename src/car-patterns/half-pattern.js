import CarPattern from './car-pattern.js';
import { sharedGeom } from '../car-geometries.js';

export default class HalfPattern extends CarPattern {
  constructor() {
    super('half');
  }

  createMesh(group, opts) {
    const halfA = new THREE.Mesh(
      sharedGeom.halfA,
      opts.primaryMat
    );
    halfA.rotation.x = -Math.PI / 2;
    halfA.position.y = 2;
    halfA._colorRole = 'primary';
    group.add(halfA);

    const halfB = new THREE.Mesh(
      sharedGeom.halfB,
      opts.secondaryMat
    );
    halfB.rotation.x = -Math.PI / 2;
    halfB.position.y = 2;
    halfB._colorRole = 'secondary';
    group.add(halfB);
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
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r, r, r, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fillStyle = secondary;
    ctx.fill();
  }
}
