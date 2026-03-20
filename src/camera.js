import Constants from './constants.js';

export default class Camera {
  constructor(orthoCamera, perspCamera) {
    this.ortho = orthoCamera;
    this.persp = perspCamera;
    this.active = orthoCamera;
    this.modeIndex = 0;
    this.showcaseActive = false;
    this.showcaseTimer = 0;
    this.showcaseShotIndex = 0;
    /** @type {-1 | number} */
    this._showcaseFixedShotId = -1;
    /** Snapshot of previous fixed rig before initing the next (fixed→fixed transition blend). */
    this._fixedPrevForTransition = null;
    this._defaultPerspFov = perspCamera.fov;
  }

  startShowcase() {
    this.showcaseActive = true;
    this.showcaseTimer = 0;
    this.showcaseShotIndex = 0;
    this._showcaseFixedShotId = -1;
    this._fixedPrevForTransition = null;
    this._fixedShowcasePos = null;
  }

  stopShowcase() {
    this.showcaseActive = false;
  }

  isShowcaseActive() {
    return this.showcaseActive;
  }

  getModeIndex() {
    return this.modeIndex;
  }

  getCurrentModeName() {
    return Constants.camera.modes[this.modeIndex].name;
  }

  /** Leave cinematic orbit and switch to a fixed camera slot (e.g. settings preview). */
  exitShowcaseToMode(modeIndex, player) {
    this.stopShowcase();
    this.modeIndex = modeIndex;
    return this.applyMode(player);
  }

  cycleMode(player) {
    this.modeIndex = (this.modeIndex + 1) % Constants.camera.modes.length;
    return this.applyMode(player);
  }

  setMode(index, player) {
    this.modeIndex = index;
    return this.applyMode(player);
  }

  applyMode(player) {
    this.persp.fov = this._defaultPerspFov;
    const mode = Constants.camera.modes[this.modeIndex];
    if (mode.usesPerspective) {
      this.active = this.persp;
    } else {
      this.active = this.ortho;
      const aspect = window.innerWidth / window.innerHeight;
      const vs = Constants.camera.viewSize * mode.viewSizeMultiplier;
      const hw = vs / 2, hh = hw / aspect;
      this.ortho.left = -hw;
      this.ortho.right = hw;
      this.ortho.top = hh;
      this.ortho.bottom = -hh;
      this.ortho.updateProjectionMatrix();
    }
    mode.applyPosition(this, player);
    return mode.name;
  }

  update(player, dt) {
    const mode = Constants.camera.modes[this.modeIndex];
    mode.update(this, player, dt);
  }

  showcaseShotPosition(shot, elapsed, angleOffset, player) {
    const c = Constants.camera.showcase;
    const orbitScale = c.orbitDistanceScale ?? 1;
    const hScale = c.showcaseHeightScale ?? 1;
    const aerialBoost = shot.aerial ? (c.aerialHeightBoost ?? 1) : 1;
    const dur = shot.duration > 0 ? shot.duration : 1;
    const u = Math.min(1, Math.max(0, elapsed / dur));

    const r0 = shot.radiusStart != null
      ? shot.radiusStart + (shot.radiusEnd - shot.radiusStart) * u
      : shot.radius;
    const r = r0 * orbitScale;
    const ang = angleOffset + elapsed * shot.speed;
    const rz = shot.radiusZScale != null ? shot.radiusZScale : 1;

    let hBase;
    if (shot.heightStart != null && shot.heightEnd != null) {
      hBase = shot.heightStart + (shot.heightEnd - shot.heightStart) * u;
    } else {
      hBase = shot.height ?? 12;
    }
    if (shot.heightSwayAmp) {
      hBase += shot.heightSwayAmp * Math.sin(elapsed * (shot.heightSwaySpeed ?? 1.12));
    }

    let lookY = shot.lookY;
    if (shot.lookYStart != null && shot.lookYEnd != null) {
      lookY = shot.lookYStart + (shot.lookYEnd - shot.lookYStart) * u;
    }
    if (lookY == null) lookY = 2;

    const y = hBase * hScale * aerialBoost;

    return {
      x: player.x + Math.sin(ang) * r,
      y,
      z: player.z + Math.cos(ang) * r * rz,
      lookY
    };
  }

  _showcaseShots(includeRunningOnly) {
    const c = Constants.camera.showcase;
    return includeRunningOnly ? c.shotsRunning : c.shotsIdle;
  }

  /**
   * World-fixed rig at shot start. Lateral = beside the track; forward = down the road ahead of the car
   * so it keeps looking at the player and the car reads as approaching from far (long lens).
   */
  _initFixedShowcaseShot(player, shot) {
    const rigScale = Constants.camera.showcase.fixedLateralScale ?? 1;
    const hScale = Constants.camera.showcase.showcaseHeightScale ?? 1;
    const fx = Math.sin(player.angle);
    const fz = Math.cos(player.angle);

    let px;
    let pz;
    if (shot.forward != null) {
      const ahead = shot.forward * rigScale;
      px = player.x + fx * ahead;
      pz = player.z + fz * ahead;
    } else {
      const lateral = (shot.lateral ?? 95) * rigScale;
      const side = shot.side ?? 1;
      px = player.x + side * lateral * Math.cos(player.angle);
      pz = player.z - side * lateral * Math.sin(player.angle);
    }

    this._fixedShowcasePos = {
      x: px,
      y: shot.height * hScale,
      z: pz,
      lookY: shot.lookY ?? 2
    };
  }

  /**
   * @param {number} dt
   * @param {import('./player.js').default} player
   * @param {boolean} [includeRunningOnlyShots] Settings preview with drive = RUNNING: includes trackside fixed shot.
   */
  updateShowcase(dt, player, includeRunningOnlyShots = false) {
    if (!player) return;
    this.active = this.persp;

    const shots = this._showcaseShots(includeRunningOnlyShots);
    const n = shots.length;

    this.showcaseTimer += dt;
    let idx = this.showcaseShotIndex % n;
    let shot = shots[idx];
    let elapsed = this.showcaseTimer;

    if (elapsed >= shot.duration) {
      this.showcaseTimer = 0;
      elapsed = 0;
      this.showcaseShotIndex = (this.showcaseShotIndex + 1) % n;
      idx = this.showcaseShotIndex % n;
      shot = shots[idx];
    }

    const angleOffset = idx * 1.8;

    let pos;
    if (shot.type === 'fixed') {
      if (this._showcaseFixedShotId !== idx) {
        if (this._showcaseFixedShotId >= 0 && this._fixedShowcasePos) {
          this._fixedPrevForTransition = {
            x: this._fixedShowcasePos.x,
            y: this._fixedShowcasePos.y,
            z: this._fixedShowcasePos.z,
            lookY: this._fixedShowcasePos.lookY
          };
        }
        this._initFixedShowcaseShot(player, shot);
        this._showcaseFixedShotId = idx;
      }
      pos = {
        x: this._fixedShowcasePos.x,
        y: this._fixedShowcasePos.y,
        z: this._fixedShowcasePos.z,
        lookY: this._fixedShowcasePos.lookY
      };
    } else {
      this._showcaseFixedShotId = -1;
      pos = this.showcaseShotPosition(shot, elapsed, angleOffset, player);
    }

    const transition = Constants.camera.showcase.transition;
    let fov = shot.fov ?? this._defaultPerspFov;

    if (elapsed < transition) {
      const prevIndex = (idx - 1 + n) % n;
      const prevShot = shots[prevIndex];
      const prevAngle = prevIndex * 1.8;
      let prevPos;
      if (prevShot.type === 'fixed') {
        const fixedToFixed = shot.type === 'fixed' && this._fixedPrevForTransition;
        if (fixedToFixed) {
          prevPos = { ...this._fixedPrevForTransition };
        } else if (this._fixedShowcasePos) {
          prevPos = {
            x: this._fixedShowcasePos.x,
            y: this._fixedShowcasePos.y,
            z: this._fixedShowcasePos.z,
            lookY: this._fixedShowcasePos.lookY
          };
        } else {
          prevPos = this.showcaseShotPosition(prevShot, prevShot.duration, prevAngle, player);
        }
      } else {
        prevPos = this.showcaseShotPosition(prevShot, prevShot.duration, prevAngle, player);
      }
      let t = elapsed / transition;
      t = t * t * (3 - 2 * t);
      pos.x = prevPos.x + (pos.x - prevPos.x) * t;
      pos.y = prevPos.y + (pos.y - prevPos.y) * t;
      pos.z = prevPos.z + (pos.z - prevPos.z) * t;
      pos.lookY = prevPos.lookY + (pos.lookY - prevPos.lookY) * t;
      const prevFov = prevShot.fov ?? this._defaultPerspFov;
      fov = prevFov + (fov - prevFov) * t;
    }

    this.persp.fov = fov;
    this.persp.updateProjectionMatrix();

    this.active.up.set(0, 1, 0);
    this.active.position.set(pos.x, pos.y, pos.z);
    this.active.lookAt(player.x, pos.lookY, player.z);
  }

  handleResize(_player) {
    const a = window.innerWidth / window.innerHeight;
    const mode = Constants.camera.modes[this.modeIndex];
    const vs = Constants.camera.viewSize * mode.viewSizeMultiplier;
    const hw = vs / 2, hh = hw / a;
    this.ortho.left = -hw; this.ortho.right = hw;
    this.ortho.top = hh; this.ortho.bottom = -hh;
    this.ortho.updateProjectionMatrix();
    this.persp.aspect = a;
    this.persp.updateProjectionMatrix();
  }
}
