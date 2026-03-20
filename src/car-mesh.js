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
    
    this.pattern.createMesh(this, { 
      color: this.primaryColor, 
      secondaryColor: this.secondaryColor, 
      opacity: this.opacity 
    });

    const ringColor = this.pattern.name === 'ring' ? this.secondaryColor : 0x000000;
    const ringOpacity = this.pattern.name === 'ring' ? 0.8 * this.opacity : 0.3 * this.opacity;
    const ring = new THREE.Mesh(
      sharedGeom.ring,
      new THREE.MeshLambertMaterial({ color: ringColor, transparent: true, opacity: ringOpacity })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 2.1;
    ring._colorRole = 'ring';
    this.add(ring);

    const dot = new THREE.Mesh(
      sharedGeom.dot,
      new THREE.MeshLambertMaterial(Object.assign({ color: 0xffffff }, matOpts))
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(0, 2.5, Constants.car.radius * 0.55);
    this.add(dot);

    if (!this.transparent) {
      const shadow = new THREE.Mesh(
        sharedGeom.shadow,
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(1, 0.005, -1);
      this.add(shadow);
    }
  }

  updateColors(primaryInt, secondaryInt) {
    this.primaryColor = primaryInt;
    this.secondaryColor = secondaryInt;
    this.pattern.updateColors(this, primaryInt, secondaryInt);
    
    // Update ring color for ring pattern
    if (this.pattern.name === 'ring') {
      this.traverse(function(child) {
        if (child.isMesh && child._colorRole === 'ring') {
          child.material.color.setHex(secondaryInt);
        }
      });
    }
  }
}
