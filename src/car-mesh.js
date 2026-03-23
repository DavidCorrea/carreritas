import Constants from './constants.js';
import { sharedGeom } from './car-geometries.js';
import { resolveCarPattern } from './storage.js';

export class CarMesh extends THREE.Group {
  constructor(opts) {
    super();

    this.pattern = resolveCarPattern(opts.pattern);
    this.primaryColor = opts.color;
    this.secondaryColor = opts.secondaryColor || opts.color;
    this.opacity = opts.opacity || 1;
    this.transparent = this.opacity < 1;

    this._buildMesh();
    this.position.set(opts.x || 0, 0, opts.z || 0);
    this.rotation.y = opts.angle || 0;
  }

  _buildMesh() {
    const matOpts = { transparent: this.transparent, opacity: this.opacity };
    this._primaryMat = new THREE.MeshLambertMaterial(Object.assign({ color: this.primaryColor }, matOpts));
    this._secondaryMat = new THREE.MeshLambertMaterial(Object.assign({ color: this.secondaryColor }, matOpts));
    this._primaryMat._sharedCarPalette = true;
    this._secondaryMat._sharedCarPalette = true;

    this.pattern.createMesh(this, {
      color: this.primaryColor,
      secondaryColor: this.secondaryColor,
      opacity: this.opacity,
      primaryMat: this._primaryMat,
      secondaryMat: this._secondaryMat
    });

    const ringColor = this.pattern.name === 'ring' ? this.secondaryColor : 0x000000;
    const ringOpacity = this.pattern.name === 'ring' ? 0.8 * this.opacity : 0.3 * this.opacity;
    this._ringMat = new THREE.MeshLambertMaterial({
      color: ringColor, transparent: true, opacity: ringOpacity
    });
    this._ringMat._sharedCarPalette = true;
    const ring = new THREE.Mesh(
      sharedGeom.ring,
      this._ringMat
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 2.1;
    ring._colorRole = 'ring';
    this.add(ring);

    this._dotMat = new THREE.MeshLambertMaterial(Object.assign({ color: 0xffffff }, matOpts));
    this._dotMat._sharedCarPalette = true;
    const dot = new THREE.Mesh(
      sharedGeom.dot,
      this._dotMat
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(0, 2.5, Constants.car.radius * 0.55);
    this.add(dot);

    if (!this.transparent) {
      const shadow = new THREE.Mesh(
        sharedGeom.shadow,
        new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.15,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4
        })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(1, 0.012, -1);
      shadow.renderOrder = 1;
      this.add(shadow);
    }
  }

  updateColors(primaryInt, secondaryInt) {
    this.primaryColor = primaryInt;
    this.secondaryColor = secondaryInt;
    this._primaryMat.color.setHex(primaryInt);
    this._secondaryMat.color.setHex(secondaryInt);
    this.pattern.updateColors(this, primaryInt, secondaryInt);

    if (this.pattern.name === 'ring') {
      this._ringMat.color.setHex(secondaryInt);
    } else {
      this._ringMat.color.setHex(0x000000);
    }
  }
}
