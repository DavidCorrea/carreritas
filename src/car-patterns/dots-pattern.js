import CarPattern from './car-pattern.js';
import { CAR_RADIUS } from '../intrinsic-constants.js';
import { sharedGeom } from '../car-geometries.js';

export default class DotsPattern extends CarPattern {
  constructor() {
    super('dots');
  }

  createMesh(group, opts) {
    const transparent = opts.opacity < 1;
    const matOpts = { transparent, opacity: opts.opacity };
    const primary = opts.color;
    const secondary = opts.secondaryColor || primary;

    const dotsDisc = new THREE.Mesh(
      sharedGeom.disc,
      new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
    );
    dotsDisc.rotation.x = -Math.PI / 2;
    dotsDisc.position.y = 2;
    dotsDisc._colorRole = 'primary';
    group.add(dotsDisc);

    const dotAngles = [0.4, 1.4, 2.5, 3.7, 5.0];
    const dotDist = CAR_RADIUS * 0.55;
    for (let di = 0; di < dotAngles.length; di++) {
      const da = dotAngles[di];
      const dMesh = new THREE.Mesh(
        sharedGeom.dotsDot,
        new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
      );
      dMesh.rotation.x = -Math.PI / 2;
      dMesh.position.set(Math.sin(da) * dotDist, 2.15, Math.cos(da) * dotDist);
      dMesh._colorRole = 'secondary';
      group.add(dMesh);
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
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.fill();
    const dotAngles = [0.4, 1.4, 2.5, 3.7, 5.0];
    const dotDist = r * 0.55;
    const dotR = r * 0.17;
    for (let di = 0; di < dotAngles.length; di++) {
      ctx.beginPath();
      ctx.arc(r + Math.cos(dotAngles[di]) * dotDist, r + Math.sin(dotAngles[di]) * dotDist, dotR, 0, Math.PI * 2);
      ctx.fillStyle = secondary;
      ctx.fill();
    }
  }
}
