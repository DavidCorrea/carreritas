import CarPattern from './car-pattern.js';
import { sharedGeom } from '../car-geometries.js';

export default class StripePattern extends CarPattern {
  constructor() {
    super('stripe');
  }

  createMesh(group, opts) {
    const disc = new THREE.Mesh(
      sharedGeom.disc,
      opts.primaryMat
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 2;
    disc._colorRole = 'primary';
    group.add(disc);

    const stripe = new THREE.Mesh(
      sharedGeom.stripe,
      opts.secondaryMat
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.y = 2.15;
    stripe._colorRole = 'secondary';
    group.add(stripe);
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
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = secondary;
    ctx.fillRect(0, r - r * 0.18, r * 2, r * 0.36);
    ctx.restore();
  }
}
