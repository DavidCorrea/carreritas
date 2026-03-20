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
  }

  startShowcase() {
    this.showcaseActive = true;
    this.showcaseTimer = 0;
    this.showcaseShotIndex = 0;
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
    const r = shot.radiusStart != null
      ? shot.radiusStart + (shot.radiusEnd - shot.radiusStart) * (elapsed / shot.duration)
      : shot.radius;
    const ang = angleOffset + elapsed * shot.speed;
    return {
      x: player.x + Math.sin(ang) * r,
      y: shot.height,
      z: player.z + Math.cos(ang) * r,
      lookY: shot.lookY
    };
  }

  updateShowcase(dt, player) {
    if (!player) return;
    this.active = this.persp;

    this.showcaseTimer += dt;
    let shot = Constants.camera.showcase.shots[this.showcaseTimer < 0 ? 0 : this.showcaseShotIndex];
    let elapsed = this.showcaseTimer;

    if (elapsed >= shot.duration) {
      this.showcaseTimer = 0;
      elapsed = 0;
      this.showcaseShotIndex = (this.showcaseShotIndex + 1) % Constants.camera.showcase.shots.length;
      shot = Constants.camera.showcase.shots[this.showcaseShotIndex];
    }

    const angleOffset = this.showcaseShotIndex * 1.8;
    const pos = this.showcaseShotPosition(shot, elapsed, angleOffset, player);

    if (elapsed < Constants.camera.showcase.transition) {
      const prevIndex = (this.showcaseShotIndex - 1 + Constants.camera.showcase.shots.length) % Constants.camera.showcase.shots.length;
      const prevShot = Constants.camera.showcase.shots[prevIndex];
      const prevAngle = prevIndex * 1.8;
      const prevPos = this.showcaseShotPosition(prevShot, prevShot.duration, prevAngle, player);
      let t = elapsed / Constants.camera.showcase.transition;
      t = t * t * (3 - 2 * t);
      pos.x = prevPos.x + (pos.x - prevPos.x) * t;
      pos.y = prevPos.y + (pos.y - prevPos.y) * t;
      pos.z = prevPos.z + (pos.z - prevPos.z) * t;
      pos.lookY = prevPos.lookY + (pos.lookY - prevPos.lookY) * t;
    }

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
