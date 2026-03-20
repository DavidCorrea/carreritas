import { CAR_RADIUS } from './intrinsic-constants.js';

export const sharedGeom = {
  disc:           new THREE.CircleGeometry(CAR_RADIUS, 20),
  halfA:          new THREE.CircleGeometry(CAR_RADIUS, 20, 0, Math.PI),
  halfB:          new THREE.CircleGeometry(CAR_RADIUS, 20, Math.PI, Math.PI),
  ring:           new THREE.RingGeometry(CAR_RADIUS * 0.82, CAR_RADIUS, 20),
  dot:            new THREE.CircleGeometry(CAR_RADIUS * 0.22, 12),
  shadow:         new THREE.CircleGeometry(CAR_RADIUS * 1.1, 20),
  dotsDot:        new THREE.CircleGeometry(CAR_RADIUS * 0.17, 10),
  bullseyeMid:    new THREE.CircleGeometry(CAR_RADIUS * 0.65, 16),
  bullseyeCenter: new THREE.CircleGeometry(CAR_RADIUS * 0.35, 12),
  stripe:         new THREE.PlaneGeometry(CAR_RADIUS * 2, CAR_RADIUS * 0.35),
  spiral0:        new THREE.CircleGeometry(CAR_RADIUS, 8, 0, Math.PI / 3),
  spiral1:        new THREE.CircleGeometry(CAR_RADIUS, 8, Math.PI / 3, Math.PI / 3),
  spiral2:        new THREE.CircleGeometry(CAR_RADIUS, 8, Math.PI * 2 / 3, Math.PI / 3),
  spiral3:        new THREE.CircleGeometry(CAR_RADIUS, 8, Math.PI, Math.PI / 3),
  spiral4:        new THREE.CircleGeometry(CAR_RADIUS, 8, Math.PI * 4 / 3, Math.PI / 3),
  spiral5:        new THREE.CircleGeometry(CAR_RADIUS, 8, Math.PI * 5 / 3, Math.PI / 3)
};

for (const k in sharedGeom) sharedGeom[k]._shared = true;
