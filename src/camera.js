import { C } from './constants.js';

export class Camera {
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

  cycleMode() {
    this.modeIndex = (this.modeIndex + 1) % C.camera.modes.length;
    this.applyMode();
  }

  setMode(index) {
    this.modeIndex = index;
    this.applyMode();
  }

  applyMode(player) {
    var mode = C.camera.modes[this.modeIndex];
    if (mode === 'CHASE') {
      this.active = this.persp;
    } else {
      this.active = this.ortho;
      var aspect = window.innerWidth / window.innerHeight;
      var vs = (mode === 'ISOMETRIC') ? C.camera.viewSize * 1.4 : C.camera.viewSize;
      var hw = vs / 2, hh = hw / aspect;
      this.ortho.left = -hw;
      this.ortho.right = hw;
      this.ortho.top = hh;
      this.ortho.bottom = -hh;
      this.ortho.updateProjectionMatrix();
    }
    if (player) {
      if (mode === 'TOP-DOWN' || mode === 'ROTATED') {
        this.active.position.set(player.x, C.camera.height, player.z);
      } else if (mode === 'CHASE') {
        this.active.position.set(
          player.x - Math.sin(player.angle) * 60, 35,
          player.z - Math.cos(player.angle) * 60
        );
        this.active.lookAt(player.x, 0, player.z);
      } else if (mode === 'ISOMETRIC') {
        this.active.position.set(player.x + 180, 200, player.z + 180);
        this.active.lookAt(player.x, 0, player.z);
      }
    }
    return mode;
  }

  update(player, dt) {
    var mode = C.camera.modes[this.modeIndex];
    var f08 = 1 - Math.pow(0.92, dt * 60);
    var f05 = 1 - Math.pow(0.95, dt * 60);
    if (mode === 'TOP-DOWN') {
      this.active.position.x += (player.x - this.active.position.x) * f08;
      this.active.position.z += (player.z - this.active.position.z) * f08;
      this.active.position.y = C.camera.height;
      this.active.up.set(0, 0, -1);
      this.active.lookAt(this.active.position.x, 0, this.active.position.z);
    } else if (mode === 'ROTATED') {
      this.active.position.x += (player.x - this.active.position.x) * f08;
      this.active.position.z += (player.z - this.active.position.z) * f08;
      this.active.position.y = C.camera.height;
      this.active.up.set(-Math.sin(player.angle), 0, -Math.cos(player.angle));
      this.active.lookAt(this.active.position.x, 0, this.active.position.z);
    } else if (mode === 'CHASE') {
      var chaseDist = 60;
      var chaseHeight = 35;
      var lookAhead = 20;
      var behindX = player.x - Math.sin(player.angle) * chaseDist;
      var behindZ = player.z - Math.cos(player.angle) * chaseDist;
      this.active.position.x += (behindX - this.active.position.x) * f05;
      this.active.position.z += (behindZ - this.active.position.z) * f05;
      this.active.position.y += (chaseHeight - this.active.position.y) * f05;
      this.active.lookAt(
        player.x + Math.sin(player.angle) * lookAhead,
        0,
        player.z + Math.cos(player.angle) * lookAhead
      );
    } else if (mode === 'ISOMETRIC') {
      var isoOff = 180;
      this.active.position.x += (player.x + isoOff - this.active.position.x) * f08;
      this.active.position.z += (player.z + isoOff - this.active.position.z) * f08;
      this.active.position.y = 200;
      this.active.up.set(0, 1, 0);
      this.active.lookAt(this.active.position.x - isoOff, 0, this.active.position.z - isoOff);
    }
  }

  showcaseShotPosition(shot, elapsed, angleOffset, player) {
    var r = shot.radiusStart != null
      ? shot.radiusStart + (shot.radiusEnd - shot.radiusStart) * (elapsed / shot.duration)
      : shot.radius;
    var ang = angleOffset + elapsed * shot.speed;
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
    var shot = C.camera.showcase.shots[this.showcaseTimer < 0 ? 0 : this.showcaseShotIndex];
    var elapsed = this.showcaseTimer;

    if (elapsed >= shot.duration) {
      this.showcaseTimer = 0;
      elapsed = 0;
      this.showcaseShotIndex = (this.showcaseShotIndex + 1) % C.camera.showcase.shots.length;
      shot = C.camera.showcase.shots[this.showcaseShotIndex];
    }

    var angleOffset = this.showcaseShotIndex * 1.8;
    var pos = this.showcaseShotPosition(shot, elapsed, angleOffset, player);

    if (elapsed < C.camera.showcase.transition) {
      var prevIndex = (this.showcaseShotIndex - 1 + C.camera.showcase.shots.length) % C.camera.showcase.shots.length;
      var prevShot = C.camera.showcase.shots[prevIndex];
      var prevAngle = prevIndex * 1.8;
      var prevPos = this.showcaseShotPosition(prevShot, prevShot.duration, prevAngle, player);
      var t = elapsed / C.camera.showcase.transition;
      t = t * t * (3 - 2 * t);
      pos.x = prevPos.x + (pos.x - prevPos.x) * t;
      pos.y = prevPos.y + (pos.y - prevPos.y) * t;
      pos.z = prevPos.z + (pos.z - prevPos.z) * t;
      pos.lookY = prevPos.lookY + (pos.lookY - prevPos.lookY) * t;
    }

    this.active.position.set(pos.x, pos.y, pos.z);
    this.active.lookAt(player.x, pos.lookY, player.z);
  }

  handleResize(player) {
    var a = window.innerWidth / window.innerHeight;
    var mode = C.camera.modes[this.modeIndex];
    var vs = (mode === 'ISOMETRIC') ? C.camera.viewSize * 1.4 : C.camera.viewSize;
    var hw = vs / 2, hh = hw / a;
    this.ortho.left = -hw; this.ortho.right = hw;
    this.ortho.top = hh; this.ortho.bottom = -hh;
    this.ortho.updateProjectionMatrix();
    this.persp.aspect = a;
    this.persp.updateProjectionMatrix();
  }
}
