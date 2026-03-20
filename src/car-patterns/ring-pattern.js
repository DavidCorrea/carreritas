import CarPattern from './car-pattern.js';
import { sharedGeom } from '../car-geometries.js';

export default class RingPattern extends CarPattern {
  constructor() {
    super('ring');
  }

  createMesh(group, opts) {
    const transparent = opts.opacity < 1;
    const matOpts = { transparent, opacity: opts.opacity };
    const disc = new THREE.Mesh(
      sharedGeom.disc,
      new THREE.MeshLambertMaterial(Object.assign({ color: opts.color }, matOpts))
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 2;
    disc._colorRole = 'primary';
    group.add(disc);
  }

  updateColors(group, primaryInt, secondaryInt) {
    group.traverse(function(child) {
      if (!child.isMesh || !child._colorRole) return;
      const role = child._colorRole;
      if (role === 'primary') {
        child.material.color.setHex(primaryInt);
      } else if (role === 'ring') {
        child.material.color.setHex(secondaryInt);
      }
    });
  }

  drawPreview(ctx, r, primary, secondary) {
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fillStyle = secondary;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r, r, r * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.fill();
  }
}
