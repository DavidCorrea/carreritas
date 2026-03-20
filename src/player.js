import Constants from './constants.js';

const COLLISION_WINDOW = 40;
const _psd = { d: 0, cx: 0, cz: 0 };

function pointSegDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 0.001) {
    _psd.d = Math.sqrt((px - ax) * (px - ax) + (pz - az) * (pz - az));
    _psd.cx = ax; _psd.cz = az;
    return _psd;
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
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

  syncMeshTransform() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.angle;
  }

  /** After swapping the Three.js car mesh (e.g. new pattern); mesh must already be in the scene. */
  setCarMesh(mesh) {
    this.mesh = mesh;
    this.syncMeshTransform();
  }

  initTrackIndex(sampled) {
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
    if (this.speed > 5) {
      this.angle += steer * Constants.physics.steerSpeed * dt;
    }

    const fx = Math.sin(this.angle);
    const fz = Math.cos(this.angle);

    if (accel > 0) {
      const fwdSpeed = this.vx * fx + this.vz * fz;
      if (fwdSpeed < Constants.physics.maxSpeed) {
        this.vx += fx * Constants.physics.acceleration * accel * dt;
        this.vz += fz * Constants.physics.acceleration * accel * dt;
      }
    } else if (accel < 0) {
      this.vx += fx * Constants.physics.brakeForce * accel * dt;
      this.vz += fz * Constants.physics.brakeForce * accel * dt;
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

    this.mesh.rotation.y = this.angle;
  }

  wallCollision(edge) {
    const r = Constants.car.radius + 1.8;
    const n = edge.length;
    for (let offset = -COLLISION_WINDOW; offset <= COLLISION_WINDOW; offset++) {
      const i = ((this.lastTrackIdx + offset) % n + n) % n;
      const j = (i + 1) % n;
      pointSegDist(this.x, this.z, edge[i].x, edge[i].z, edge[j].x, edge[j].z);
      if (_psd.d < r && _psd.d > 0.01) {
        const nx = (this.x - _psd.cx) / _psd.d;
        const nz = (this.z - _psd.cz) / _psd.d;
        this.x = _psd.cx + nx * r;
        this.z = _psd.cz + nz * r;

        const dot = this.vx * nx + this.vz * nz;
        if (dot < 0) {
          this.vx -= 1.5 * dot * nx;
          this.vz -= 1.5 * dot * nz;
          this.vx *= 0.7;
          this.vz *= 0.7;
        }
      }
    }
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
