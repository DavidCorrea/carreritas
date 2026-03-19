import { C } from './constants.js';

var COLLISION_WINDOW = 40;
var _psd = { d: 0, cx: 0, cz: 0 };

function pointSegDist(px, pz, ax, az, bx, bz) {
  var dx = bx - ax, dz = bz - az;
  var lenSq = dx * dx + dz * dz;
  if (lenSq < 0.001) {
    _psd.d = Math.sqrt((px - ax) * (px - ax) + (pz - az) * (pz - az));
    _psd.cx = ax; _psd.cz = az;
    return _psd;
  }
  var t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  var cx = ax + t * dx, cz = az + t * dz;
  var ex = px - cx, ez = pz - cz;
  _psd.d = Math.sqrt(ex * ex + ez * ez);
  _psd.cx = cx; _psd.cz = cz;
  return _psd;
}

export class Player {
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

  initTrackIndex(sampled) {
    this.lastTrackIdx = 0;
    var bestD = Infinity;
    for (var i = 0; i < sampled.length; i++) {
      var dx = this.x - sampled[i].x;
      var dz = this.z - sampled[i].z;
      var d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; this.lastTrackIdx = i; }
    }
    this.currentSector = Math.min(Math.floor(this.lastTrackIdx / sampled.length * 4), 3);
  }

  updatePhysics(dt, accel, steer) {
    if (this.speed > 5) {
      this.angle += steer * C.physics.steerSpeed * dt;
    }

    var fx = Math.sin(this.angle);
    var fz = Math.cos(this.angle);

    if (accel > 0) {
      var fwdSpeed = this.vx * fx + this.vz * fz;
      if (fwdSpeed < C.physics.maxSpeed) {
        this.vx += fx * C.physics.acceleration * accel * dt;
        this.vz += fz * C.physics.acceleration * accel * dt;
      }
    } else if (accel < 0) {
      this.vx += fx * C.physics.brakeForce * accel * dt;
      this.vz += fz * C.physics.brakeForce * accel * dt;
    }

    var rx = -fz, rz = fx;
    var lateral = this.vx * rx + this.vz * rz;
    var gripDamp = 1 - Math.min(C.physics.grip * dt, 0.95);
    this.vx -= rx * lateral * (1 - gripDamp);
    this.vz -= rz * lateral * (1 - gripDamp);

    var fricPow = Math.pow(C.physics.friction, dt * 60);
    this.vx *= fricPow;
    this.vz *= fricPow;

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.speed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);

    this.mesh.rotation.y = this.angle;
  }

  wallCollision(edge) {
    var r = C.car.radius + 1.8;
    var n = edge.length;
    for (var offset = -COLLISION_WINDOW; offset <= COLLISION_WINDOW; offset++) {
      var i = ((this.lastTrackIdx + offset) % n + n) % n;
      var j = (i + 1) % n;
      pointSegDist(this.x, this.z, edge[i].x, edge[i].z, edge[j].x, edge[j].z);
      if (_psd.d < r && _psd.d > 0.01) {
        var nx = (this.x - _psd.cx) / _psd.d;
        var nz = (this.z - _psd.cz) / _psd.d;
        this.x = _psd.cx + nx * r;
        this.z = _psd.cz + nz * r;

        var dot = this.vx * nx + this.vz * nz;
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
    var n = sampled.length;
    var best = 0, bestD = Infinity;
    for (var offset = -COLLISION_WINDOW; offset <= COLLISION_WINDOW; offset++) {
      var i = ((this.lastTrackIdx + offset) % n + n) % n;
      var dx = this.x - sampled[i].x;
      var dz = this.z - sampled[i].z;
      var d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    this.lastTrackIdx = best;
    return best / n;
  }

  updateLapTracking(sampled, reversed, totalLaps, raceTimer, onLapComplete) {
    var t = this.getTrackT(sampled);
    var sector = Math.floor(t * 4);
    if (sector > 3) sector = 3;

    if (sector !== this.currentSector) {
      var expected = reversed ? (this.currentSector + 3) % 4 : (this.currentSector + 1) % 4;
      if (sector === expected) {
        this.sectorsVisited++;
        var finishSector = reversed ? 3 : 0;
        if (sector === finishSector && this.sectorsVisited >= 4) {
          var lapTime = raceTimer - this.lapStartTime;
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
