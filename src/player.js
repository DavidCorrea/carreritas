import Constants from './constants.js';

const COLLISION_WINDOW = 40;
/** Spine segment search window — avoids snapping to a far chord when two segments are nearly equidistant (bumps). */
const SPINE_SEGMENT_WINDOW = 72;
/** One correction per frame, capped — avoids multi-segment loops fighting and visible teleports. */
const MAX_CORRIDOR_PUSH_PER_FRAME = Constants.car.radius * 0.45;
/** Ignore penetration smaller than this so float noise does not fight the solver every frame. */
const CORRIDOR_DEPTH_SLACK = 0.06;
const _psd = { d: 0, cx: 0, cz: 0, t: 0 };

function pointSegDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 0.001) {
    _psd.d = Math.sqrt((px - ax) * (px - ax) + (pz - az) * (pz - az));
    _psd.cx = ax; _psd.cz = az;
    _psd.t = 0;
    return _psd;
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  _psd.t = t;
  const cx = ax + t * dx, cz = az + t * dz;
  const ex = px - cx, ez = pz - cz;
  _psd.d = Math.sqrt(ex * ex + ez * ez);
  _psd.cx = cx; _psd.cz = cz;
  return _psd;
}

export default class Player {
  constructor(mesh, x, z, angle) {
    this.mesh = mesh;
    this.x = x;
    this.z = z;
    this.angle = angle;
    this.vx = 0;
    this.vz = 0;
    this.speed = 0;
    this.lap = 0;
    this.sectorsVisited = 0;
    this.currentSector = 0;
    this.lapTimes = [];
    this.lapStartTime = 0;
    this.finished = false;
    this.finishTime = 0;
    this.lastTrackIdx = 0;
  }

  /** Pose for ghost recording samples ({ x, z, a: angle }). */
  getReplaySample() {
    return { x: this.x, z: this.z, a: this.angle };
  }

  setWorldPose(x, z, angle) {
    this.x = x;
    this.z = z;
    this.angle = angle;
    this.syncMeshTransform();
  }

  /** Full grid reset: pose behind the start line, zero velocity, lap state cleared (e.g. after menu preview moved the car). */
  resetToGrid(track, direction) {
    const start = track.getStartPosition(direction);
    this.setWorldPose(start.x, start.z, start.angle);
    this.vx = 0;
    this.vz = 0;
    this.speed = 0;
    this.lap = 0;
    this.sectorsVisited = 0;
    this.currentSector = 0;
    this.lapTimes = [];
    this.lapStartTime = 0;
    this.finished = false;
    this.finishTime = 0;
    this.initTrackIndex(track.sampled);
  }

  syncMeshTransform() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.angle;
  }

  /** False if physics/collision produced NaN/Infinity — breaks cameras and can explode the scene. */
  isPoseFinite() {
    return (
      Number.isFinite(this.x) &&
      Number.isFinite(this.z) &&
      Number.isFinite(this.vx) &&
      Number.isFinite(this.vz) &&
      Number.isFinite(this.angle)
    );
  }

  /** After swapping the Three.js car mesh (e.g. new pattern); mesh must already be in the scene. */
  setCarMesh(mesh) {
    this.mesh = mesh;
    this.syncMeshTransform();
  }

  initTrackIndex(sampled) {
    if (!sampled || sampled.length === 0) return;
    this.lastTrackIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < sampled.length; i++) {
      const dx = this.x - sampled[i].x;
      const dz = this.z - sampled[i].z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; this.lastTrackIdx = i; }
    }
    this.currentSector = Math.min(Math.floor(this.lastTrackIdx / sampled.length * 4), 3);
  }

  updatePhysics(dt, accel, steer) {
    const a = Number.isFinite(accel) ? accel : 0;
    const s = Number.isFinite(steer) ? steer : 0;

    if (this.speed > 5) {
      this.angle += s * Constants.physics.steerSpeed * dt;
    }

    const fx = Math.sin(this.angle);
    const fz = Math.cos(this.angle);

    if (a > 0) {
      const fwdSpeed = this.vx * fx + this.vz * fz;
      if (fwdSpeed < Constants.physics.maxSpeed) {
        this.vx += fx * Constants.physics.acceleration * a * dt;
        this.vz += fz * Constants.physics.acceleration * a * dt;
      }
    } else if (a < 0) {
      this.vx += fx * Constants.physics.brakeForce * a * dt;
      this.vz += fz * Constants.physics.brakeForce * a * dt;
    }

    const rx = -fz, rz = fx;
    const lateral = this.vx * rx + this.vz * rz;
    const gripDamp = 1 - Math.min(Constants.physics.grip * dt, 0.95);
    this.vx -= rx * lateral * (1 - gripDamp);
    this.vz -= rz * lateral * (1 - gripDamp);

    const fricPow = Constants.physics.friction**(dt * 60);
    this.vx *= fricPow;
    this.vz *= fricPow;

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.speed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);

    this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));

    this.mesh.rotation.y = this.angle;
  }

  /**
   * Keep the car within the road half-width along the spine (same adaptive half-widths as track mesh).
   * Inner/outer polyline half-planes are a poor fit for a closed loop: bogus “worst violations” can pull
   * the car into the hole at the origin (ortho view: tiny car, track slivers at the edges, 0 km/h).
   */
  trackCorridorCollision(track) {
    const spine = track.sampled;
    const curve = track.curve;
    const halfWidths = track.spineHalfWidths;
    if (!spine?.length || !curve || !halfWidths || halfWidths.length !== spine.length) return;

    const n = spine.length;
    const clearance = Constants.car.radius + Constants.track.corridorShell;
    const limitPad = clearance - CORRIDOR_DEPTH_SLACK;

    if (!Number.isFinite(this.x) || !Number.isFinite(this.z)) return;

    let bestI = this.lastTrackIdx;
    let bestD2 = Infinity;
    for (let o = -SPINE_SEGMENT_WINDOW; o <= SPINE_SEGMENT_WINDOW; o++) {
      const i = ((this.lastTrackIdx + o) % n + n) % n;
      const j = (i + 1) % n;
      pointSegDist(this.x, this.z, spine[i].x, spine[i].z, spine[j].x, spine[j].z);
      const d2 = _psd.d * _psd.d;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestI = i;
      }
    }
    const fallbackD2 = (Constants.track.width * 8) ** 2;
    if (bestD2 > fallbackD2) {
      bestI = 0;
      bestD2 = Infinity;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        pointSegDist(this.x, this.z, spine[i].x, spine[i].z, spine[j].x, spine[j].z);
        const d2 = _psd.d * _psd.d;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestI = i;
        }
      }
    }

    const i = bestI;
    const j = (i + 1) % n;
    pointSegDist(this.x, this.z, spine[i].x, spine[i].z, spine[j].x, spine[j].z);
    const t = _psd.t;
    const qx = _psd.cx;
    const qz = _psd.cz;

    let u = (i + t) / n;
    if (u >= 1) u = 0;
    const tan = curve.getTangentAt(u);
    let tx = tan.x;
    let tz = tan.z;
    let tlen = Math.hypot(tx, tz);
    if (tlen < 1e-10) {
      tx = spine[j].x - spine[i].x;
      tz = spine[j].z - spine[i].z;
      tlen = Math.hypot(tx, tz);
    }
    if (tlen < 1e-10) {
      this.lastTrackIdx = bestI;
      return;
    }
    tx /= tlen;
    tz /= tlen;
    const nx = -tz;
    const nz = tx;

    const wx = this.x - qx;
    const wz = this.z - qz;
    const lateral = wx * nx + wz * nz;
    const allowedHalf = halfWidths[i] * (1 - t) + halfWidths[j] * t;
    const limit = Math.max(0, allowedHalf - limitPad);

    const alat = Math.abs(lateral);
    if (alat > limit) {
      const excess = alat - limit;
      const push = Math.min(excess, MAX_CORRIDOR_PUSH_PER_FRAME);
      const sign = lateral >= 0 ? -1 : 1;
      this.x += sign * nx * push;
      this.z += sign * nz * push;
      const dot = this.vx * nx + this.vz * nz;
      if (Number.isFinite(dot) && ((lateral > 0 && dot > 0) || (lateral < 0 && dot < 0))) {
        this.vx -= dot * nx;
        this.vz -= dot * nz;
      }
    }

    this.lastTrackIdx = bestI;
  }

  getTrackT(sampled) {
    const n = sampled.length;
    let best = 0, bestD = Infinity;
    for (let offset = -COLLISION_WINDOW; offset <= COLLISION_WINDOW; offset++) {
      const i = ((this.lastTrackIdx + offset) % n + n) % n;
      const dx = this.x - sampled[i].x;
      const dz = this.z - sampled[i].z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    this.lastTrackIdx = best;
    return best / n;
  }

  updateLapTracking(sampled, direction, totalLaps, raceTimer, onLapComplete) {
    const reversed = direction.isRev();
    const t = this.getTrackT(sampled);
    let sector = Math.floor(t * 4);
    if (sector > 3) sector = 3;

    if (sector !== this.currentSector) {
      const expected = reversed ? (this.currentSector + 3) % 4 : (this.currentSector + 1) % 4;
      if (sector === expected) {
        this.sectorsVisited++;
        const finishSector = reversed ? 3 : 0;
        if (sector === finishSector && this.sectorsVisited >= 4) {
          const lapTime = raceTimer - this.lapStartTime;
          this.lapTimes.push(lapTime);
          this.lapStartTime = raceTimer;
          if (onLapComplete) onLapComplete(this.lap + 1, lapTime);
          this.lap++;
          this.sectorsVisited = 0;
          if (this.lap >= totalLaps && !this.finished) {
            this.finished = true;
            this.finishTime = raceTimer;
          }
        }
      }
      this.currentSector = sector;
    }
  }
}
