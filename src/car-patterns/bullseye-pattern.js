import CarPattern from './car-pattern.js';
import { sharedGeom } from '../car-geometries.js';

export default class BullseyePattern extends CarPattern {
  constructor() {
    super('bullseye');
  }

  createMesh(group, opts) {
    const transparent = opts.opacity < 1;
    const matOpts = { transparent, opacity: opts.opacity };
    const primary = opts.color;
    const secondary = opts.secondaryColor || primary;

    const beDisc = new THREE.Mesh(
      sharedGeom.disc,
      new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
    );
    beDisc.rotation.x = -Math.PI / 2;
    beDisc.position.y = 2;
    beDisc._colorRole = 'primary';
    group.add(beDisc);

    const beRing = new THREE.Mesh(
      sharedGeom.bullseyeMid,
      new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
    );
    beRing.rotation.x = -Math.PI / 2;
    beRing.position.y = 2.1;
    beRing._colorRole = 'secondary';
    group.add(beRing);

    const beCenter = new THREE.Mesh(
      sharedGeom.bullseyeCenter,
      new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
    );
    beCenter.rotation.x = -Math.PI / 2;
    beCenter.position.y = 2.15;
    beCenter._colorRole = 'primary';
    group.add(beCenter);
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
    ctx.arc(r, r, r * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = secondary;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r, r, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.fill();
  }
}
