import CarPattern from './car-pattern.js';
import { sharedGeom } from '../car-geometries.js';

export default class SolidPattern extends CarPattern {
  constructor() {
    super('solid');
  }

  createMesh(group, opts) {
    const matOpts = { transparent: opts.opacity < 1, opacity: opts.opacity };
    const disc = new THREE.Mesh(
      sharedGeom.disc,
      new THREE.MeshLambertMaterial(Object.assign({ color: opts.color }, matOpts))
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 2;
    disc._colorRole = 'primary';
    group.add(disc);
  }

  updateColors(group, primaryInt) {
    group.traverse(function(child) {
      if (child.isMesh && child._colorRole === 'primary') {
        child.material.color.setHex(primaryInt);
      }
    });
  }

  drawPreview(ctx, r, primary, _secondary) {
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.fill();
  }
}
