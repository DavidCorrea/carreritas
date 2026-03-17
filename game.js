(function () {
  var TRACK_WIDTH = 55;
  var CAR_RADIUS = 6;
  var MAX_SPEED = 280;
  var ACCELERATION = 200;
  var BRAKE_FORCE = 320;
  var STEER_SPEED = 2.8;
  var FRICTION = 0.985;
  var GRIP = 3.5;
  var totalLaps = 3;
  var reversed = false;
  var nightMode = false;
  var VIEW_SIZE = 450;
  var CAMERA_HEIGHT = 300;
  var CAMERA_MODES = ['TOP-DOWN', 'ROTATED', 'CHASE', 'ISOMETRIC'];
  var cameraModeIndex = 0;
  var TRACK_SAMPLES = 400;
  var RECORD_INTERVAL = 0.1;
  var STORAGE_PREFIX = 'haxrace_ghost_';

  var seriesMode = false;
  var stageCount = 3;
  var stageConfigs = [
    { code: '', reversed: false, nightMode: false },
    { code: '', reversed: false, nightMode: false },
    { code: '', reversed: false, nightMode: false },
    { code: '', reversed: false, nightMode: false },
    { code: '', reversed: false, nightMode: false }
  ];
  var currentStageIndex = 0;
  var seriesResults = [];

  var PLAYER_COLOR = 0xe84d4d;
  var GHOST_COLOR = 0x4da6e8;

  var scene, camera, renderer;
  var orthoCamera, perspCamera;
  var trackGroup;
  var track;
  var player;
  var ghostMesh;
  var keys = {};
  var ambientLight, carPointLight;
  var beamMeshL, beamMeshR, glowMesh, tailMesh;
  var centerLineMat;
  var gameState = 'menu';
  var raceTimer = 0;
  var countdownTimer = 0;
  var countdownValue = 0;
  var lastTime = 0;
  var rebuildTimer;
  var currentTrackCode = '';

  var recording = [];
  var recordAccum = 0;
  var bestReplay = null;
  var bestTime = null;

  var hud = document.getElementById('hud');
  var lapDisplay = document.getElementById('lap-display');
  var lapTimesList = document.getElementById('lap-times-list');
  var bestDisplay = document.getElementById('best-display');
  var timeDisplay = document.getElementById('time-display');
  var speedDisplay = document.getElementById('speed-display');
  var overlay = document.getElementById('overlay');
  var countdownEl = document.getElementById('countdown');
  var semLights = countdownEl.querySelectorAll('.sem-light');
  var resultsEl = document.getElementById('results');
  var resultsList = document.getElementById('results-list');
  var resultsTrackCode = document.getElementById('results-track-code');
  var resultsTrackText = document.getElementById('results-track-text');
  var copyTrackBtn = document.getElementById('copy-track-btn');
  var trackCodeInput = document.getElementById('track-code-input');
  var randomBtn = document.getElementById('random-btn');
  var lapsValueEl = document.getElementById('laps-value');
  var lapsLabel = document.getElementById('laps-label');
  var lapsMinusBtn = document.getElementById('laps-minus');
  var lapsPlusBtn = document.getElementById('laps-plus');
  var dirToggleBtn = document.getElementById('dir-toggle');
  var dirValueEl = document.getElementById('dir-value');
  var modeToggleBtn = document.getElementById('mode-toggle');
  var modeValueEl = document.getElementById('mode-value');
  var raceTypeBtn = document.getElementById('race-type-toggle');
  var raceTypeValue = document.getElementById('race-type-value');
  var singleConfigEl = document.getElementById('single-config');
  var seriesConfigEl = document.getElementById('series-config');
  var stagesValueEl = document.getElementById('stages-value');
  var stagesMinusBtn = document.getElementById('stages-minus');
  var stagesPlusBtn = document.getElementById('stages-plus');
  var rngAllBtn = document.getElementById('rng-all-btn');
  var stageListEl = document.getElementById('stage-list');
  var stageDisplayEl = document.getElementById('stage-display');
  var cameraDisplayEl = document.getElementById('camera-display');

  // ── Persistence (per track code) ──────────────────────────────────
  function storageKey(code) {
    return STORAGE_PREFIX + code + '_' + totalLaps + 'L' + (reversed ? '_R' : '') + (nightMode ? '_N' : '');
  }

  function encodeReplay(frames) {
    if (frames.length === 0) return [];
    var packed = [];
    var px = Math.round(frames[0].x * 10);
    var pz = Math.round(frames[0].z * 10);
    var pa = Math.round(frames[0].a * 100);
    packed.push(px, pz, pa);
    for (var i = 1; i < frames.length; i++) {
      var cx = Math.round(frames[i].x * 10);
      var cz = Math.round(frames[i].z * 10);
      var ca = Math.round(frames[i].a * 100);
      packed.push(cx - px, cz - pz, ca - pa);
      px = cx; pz = cz; pa = ca;
    }
    return packed;
  }

  function decodeReplay(packed) {
    var frames = [];
    if (packed.length < 3) return frames;
    var px = packed[0], pz = packed[1], pa = packed[2];
    frames.push({ x: px / 10, z: pz / 10, a: pa / 100 });
    for (var i = 3; i < packed.length; i += 3) {
      px += packed[i];
      pz += packed[i + 1];
      pa += packed[i + 2];
      frames.push({ x: px / 10, z: pz / 10, a: pa / 100 });
    }
    return frames;
  }

  function loadBest(code) {
    bestReplay = null;
    bestTime = null;
    try {
      var data = JSON.parse(localStorage.getItem(storageKey(code)));
      if (!data || !data.time) return;
      if (data.v === 2 && data.packed && data.packed.length >= 3) {
        bestReplay = decodeReplay(data.packed);
        bestTime = data.time;
      } else if (data.frames && data.frames.length > 0) {
        bestReplay = [];
        for (var i = 0; i < data.frames.length; i++) {
          bestReplay.push({ x: data.frames[i].x, z: data.frames[i].z, a: data.frames[i].a });
        }
        bestTime = data.time;
      }
    } catch (_) {}
  }

  function saveBest(code, time, frames) {
    bestReplay = frames;
    bestTime = time;
    localStorage.setItem(storageKey(code), JSON.stringify({ v: 2, time: time, packed: encodeReplay(frames) }));
  }

  // ── String → track points (polar) ────────────────────────────────
  function stringToTrackPoints(str) {
    while (str.length < 18) str += ' ';
    str = str.substring(0, 18);

    var radii = [];
    for (var i = 0; i < 18; i++) {
      var code = str.charCodeAt(i);
      var norm = (Math.min(Math.max(code, 32), 126) - 32) / 94;
      radii.push(140 + norm * 240);
    }

    var smoothed = [];
    for (var i = 0; i < 18; i++) {
      var prev = radii[(i + 17) % 18];
      var curr = radii[i];
      var next = radii[(i + 1) % 18];
      smoothed.push(prev * 0.25 + curr * 0.5 + next * 0.25);
    }

    var points = [];
    for (var i = 0; i < 18; i++) {
      var angle = (i / 18) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle) * smoothed[i],
        0,
        Math.sin(angle) * smoothed[i]
      ));
    }
    return points;
  }

  // ── Track generation ──────────────────────────────────────────────
  function generateTrack(code) {
    if (trackGroup) scene.remove(trackGroup);
    trackGroup = new THREE.Group();
    scene.add(trackGroup);

    var pts = stringToTrackPoints(code);
    var curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    var sampled = curve.getSpacedPoints(TRACK_SAMPLES);
    var halfW = TRACK_WIDTH / 2;
    var inner = [], outer = [];

    for (var i = 0; i < sampled.length; i++) {
      var t = i / sampled.length;
      var tan = curve.getTangentAt(t);
      var nx = -tan.z, nz = tan.x;
      var len = Math.sqrt(nx * nx + nz * nz);
      nx /= len; nz /= len;
      inner.push(new THREE.Vector3(
        sampled[i].x - nx * halfW, 0, sampled[i].z - nz * halfW
      ));
      outer.push(new THREE.Vector3(
        sampled[i].x + nx * halfW, 0, sampled[i].z + nz * halfW
      ));
    }

    buildTrackSurface(inner, outer);
    buildWalls(inner, outer);
    buildStartLine(curve);
    buildCenterLine(sampled);

    return { curve: curve, sampled: sampled, inner: inner, outer: outer };
  }

  function buildTrackSurface(inner, outer) {
    var verts = [], idx = [];
    for (var i = 0; i < inner.length; i++) {
      verts.push(inner[i].x, 0.01, inner[i].z);
      verts.push(outer[i].x, 0.01, outer[i].z);
    }
    for (var i = 0; i < inner.length; i++) {
      var n = (i + 1) % inner.length;
      var a = i * 2, b = i * 2 + 1, c = n * 2, d = n * 2 + 1;
      idx.push(a, c, b, b, c, d);
    }
    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geom.setIndex(idx);
    trackGroup.add(new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ color: 0x444444 })));
  }

  function buildWalls(inner, outer) {
    var step = 2;
    var count = Math.ceil(inner.length / step) + Math.ceil(outer.length / step);
    var geom = new THREE.SphereGeometry(1.8, 8, 6);
    var mesh = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial({ color: 0xcccccc }), count);
    var dummy = new THREE.Object3D();
    var n = 0;
    for (var i = 0; i < inner.length; i += step) {
      dummy.position.set(inner[i].x, 1.8, inner[i].z);
      dummy.updateMatrix();
      mesh.setMatrixAt(n++, dummy.matrix);
    }
    for (var i = 0; i < outer.length; i += step) {
      dummy.position.set(outer[i].x, 1.8, outer[i].z);
      dummy.updateMatrix();
      mesh.setMatrixAt(n++, dummy.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    trackGroup.add(mesh);
  }

  function buildStartLine(curve) {
    var p = curve.getPointAt(0);
    var t = curve.getTangentAt(0).normalize();
    var nx = -t.z, nz = t.x;
    var angle = Math.atan2(t.x, t.z);
    var squares = 8;
    var size = TRACK_WIDTH / squares;
    for (var i = 0; i < squares; i++) {
      var color = i % 2 === 0 ? 0xffffff : 0x222222;
      var box = new THREE.Mesh(
        new THREE.BoxGeometry(size, 0.1, 3),
        new THREE.MeshLambertMaterial({ color: color })
      );
      var offset = (i - squares / 2 + 0.5) * size;
      box.position.set(p.x + nx * offset, 0.05, p.z + nz * offset);
      box.rotation.y = angle;
      trackGroup.add(box);
    }
  }

  function buildCenterLine(sampled) {
    var geom = new THREE.BufferGeometry();
    var verts = [];
    for (var i = 0; i < sampled.length; i += 6) {
      var j = (i + 3) % sampled.length;
      verts.push(sampled[i].x, 0.03, sampled[i].z);
      verts.push(sampled[j].x, 0.03, sampled[j].z);
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    centerLineMat = new THREE.LineBasicMaterial({ color: 0x666666 });
    trackGroup.add(new THREE.LineSegments(geom, centerLineMat));
  }

  // ── Car mesh creation ─────────────────────────────────────────────
  function createCarMesh(color, x, z, angle, opacity) {
    var group = new THREE.Group();
    var transparent = opacity < 1;

    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(CAR_RADIUS, 20),
      new THREE.MeshLambertMaterial({ color: color, transparent: transparent, opacity: opacity })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 2;
    group.add(disc);

    var ring = new THREE.Mesh(
      new THREE.RingGeometry(CAR_RADIUS * 0.82, CAR_RADIUS, 20),
      new THREE.MeshLambertMaterial({ color: 0x000000, transparent: true, opacity: 0.3 * opacity })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 2.1;
    group.add(ring);

    var dot = new THREE.Mesh(
      new THREE.CircleGeometry(CAR_RADIUS * 0.22, 12),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: transparent, opacity: opacity })
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(0, 2.5, CAR_RADIUS * 0.55);
    group.add(dot);

    if (!transparent) {
      var shadow = new THREE.Mesh(
        new THREE.CircleGeometry(CAR_RADIUS * 1.1, 20),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(1, 0.005, -1);
      group.add(shadow);
    }

    group.position.set(x, 0, z);
    group.rotation.y = angle;
    scene.add(group);
    return group;
  }

  function getStartPosition() {
    var p = track.curve.getPointAt(0);
    var t = track.curve.getTangentAt(0).normalize();
    var angle = Math.atan2(t.x, t.z);
    if (reversed) {
      angle += Math.PI;
      return { x: p.x + t.x * 12, z: p.z + t.z * 12, angle: angle };
    }
    return { x: p.x + t.x * -12, z: p.z + t.z * -12, angle: angle };
  }

  // ── Rebuild track ─────────────────────────────────────────────────
  function rebuildTrack(code) {
    if (player) { scene.remove(player.mesh); player = null; }
    if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }

    currentTrackCode = code;
    track = generateTrack(code);
    loadBest(code);
    createPlayer();
    createGhost();
  }

  function randomCode() {
    var out = '';
    for (var i = 0; i < 18; i++) {
      out += String.fromCharCode(33 + Math.floor(Math.random() * 94));
    }
    return out;
  }

  // ── Player ────────────────────────────────────────────────────────
  function createPlayer() {
    var start = getStartPosition();
    var mesh = createCarMesh(PLAYER_COLOR, start.x, start.z, start.angle, 1);
    player = {
      mesh: mesh, x: start.x, z: start.z, angle: start.angle,
      vx: 0, vz: 0, speed: 0,
      lap: 0, sectorsVisited: 0, currentSector: 0,
      finished: false, finishTime: 0,
      lapTimes: [], lapStartTime: 0
    };
    var initialT = getTrackT(player);
    player.currentSector = Math.min(Math.floor(initialT * 4), 3);
  }

  // ── Ghost ─────────────────────────────────────────────────────────
  function createGhost() {
    if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
    if (!bestReplay) return;
    var start = getStartPosition();
    ghostMesh = createCarMesh(GHOST_COLOR, start.x, start.z, start.angle, 0.35);
    ghostMesh.traverse(function (child) {
      if (child.isMesh && child.material.type === 'MeshLambertMaterial') {
        var m = child.material;
        child.material = new THREE.MeshBasicMaterial({
          color: m.color, transparent: m.transparent, opacity: m.opacity
        });
      }
    });
  }

  function updateGhost() {
    if (!ghostMesh || !bestReplay) return;

    var frameTime = raceTimer / RECORD_INTERVAL;
    var i = Math.floor(frameTime);

    if (i >= bestReplay.length - 1) {
      ghostMesh.visible = false;
      return;
    }

    var frac = frameTime - i;
    var fa = bestReplay[i], fb = bestReplay[i + 1];

    var x = fa.x + (fb.x - fa.x) * frac;
    var z = fa.z + (fb.z - fa.z) * frac;

    var angleDiff = fb.a - fa.a;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    ghostMesh.position.set(x, 0, z);
    ghostMesh.rotation.y = fa.a + angleDiff * frac;
    ghostMesh.visible = true;
  }

  // ── Recording ─────────────────────────────────────────────────────
  function recordFrame(dt) {
    recordAccum += dt;
    if (recordAccum >= RECORD_INTERVAL) {
      recordAccum -= RECORD_INTERVAL;
      recording.push({ x: player.x, z: player.z, a: player.angle });
    }
  }

  // ── Physics ───────────────────────────────────────────────────────
  function updatePlayerPhysics(dt, accel, steer) {
    if (player.speed > 5) {
      player.angle += steer * STEER_SPEED * dt;
    }

    var fx = Math.sin(player.angle);
    var fz = Math.cos(player.angle);

    if (accel > 0) {
      var fwdSpeed = player.vx * fx + player.vz * fz;
      if (fwdSpeed < MAX_SPEED) {
        player.vx += fx * ACCELERATION * accel * dt;
        player.vz += fz * ACCELERATION * accel * dt;
      }
    } else if (accel < 0) {
      player.vx += fx * BRAKE_FORCE * accel * dt;
      player.vz += fz * BRAKE_FORCE * accel * dt;
    }

    var rx = -fz, rz = fx;
    var lateral = player.vx * rx + player.vz * rz;
    var gripDamp = 1 - Math.min(GRIP * dt, 0.95);
    player.vx -= rx * lateral * (1 - gripDamp);
    player.vz -= rz * lateral * (1 - gripDamp);

    var fricPow = Math.pow(FRICTION, dt * 60);
    player.vx *= fricPow;
    player.vz *= fricPow;

    player.x += player.vx * dt;
    player.z += player.vz * dt;
    player.speed = Math.sqrt(player.vx * player.vx + player.vz * player.vz);

    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.angle;
  }

  // ── Wall collision ────────────────────────────────────────────────
  function pointSegDist(px, pz, ax, az, bx, bz) {
    var dx = bx - ax, dz = bz - az;
    var lenSq = dx * dx + dz * dz;
    if (lenSq < 0.001) return { d: Math.sqrt((px - ax) * (px - ax) + (pz - az) * (pz - az)), cx: ax, cz: az };
    var t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
    var cx = ax + t * dx, cz = az + t * dz;
    var ex = px - cx, ez = pz - cz;
    return { d: Math.sqrt(ex * ex + ez * ez), cx: cx, cz: cz };
  }

  function wallCollision(edge) {
    var r = CAR_RADIUS + 1.8;
    for (var i = 0; i < edge.length; i++) {
      var j = (i + 1) % edge.length;
      var res = pointSegDist(player.x, player.z, edge[i].x, edge[i].z, edge[j].x, edge[j].z);
      if (res.d < r && res.d > 0.01) {
        var nx = (player.x - res.cx) / res.d;
        var nz = (player.z - res.cz) / res.d;
        player.x = res.cx + nx * r;
        player.z = res.cz + nz * r;

        var dot = player.vx * nx + player.vz * nz;
        if (dot < 0) {
          player.vx -= 1.5 * dot * nx;
          player.vz -= 1.5 * dot * nz;
          player.vx *= 0.7;
          player.vz *= 0.7;
        }
      }
    }
  }

  // ── Track projection & laps ───────────────────────────────────────
  function getTrackT(car) {
    var best = 0, bestD = Infinity;
    for (var i = 0; i < track.sampled.length; i++) {
      var dx = car.x - track.sampled[i].x;
      var dz = car.z - track.sampled[i].z;
      var d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best / track.sampled.length;
  }

  function updateLapTracking() {
    var t = getTrackT(player);
    var sector = Math.floor(t * 4);
    if (sector > 3) sector = 3;

    if (sector !== player.currentSector) {
      var expected = reversed ? (player.currentSector + 3) % 4 : (player.currentSector + 1) % 4;
      if (sector === expected) {
        player.sectorsVisited++;
        var finishSector = reversed ? 3 : 0;
        if (sector === finishSector && player.sectorsVisited >= 4) {
          var lapTime = raceTimer - player.lapStartTime;
          player.lapTimes.push(lapTime);
          player.lapStartTime = raceTimer;
          addLapTimeToHUD(player.lap + 1, lapTime);
          player.lap++;
          player.sectorsVisited = 0;
          if (player.lap >= totalLaps && !player.finished) {
            player.finished = true;
            player.finishTime = raceTimer;
          }
        }
      }
      player.currentSector = sector;
    }
  }

  // ── Series ────────────────────────────────────────────────────────
  function buildStageList() {
    stageListEl.innerHTML = '';
    for (var i = 0; i < stageCount; i++) {
      var block = document.createElement('div');
      block.className = 'stage-block';

      var num = document.createElement('span');
      num.className = 'stage-num';
      num.textContent = '#' + (i + 1);
      block.appendChild(num);

      var content = document.createElement('div');
      content.className = 'stage-content';

      var topRow = document.createElement('div');
      topRow.className = 'stage-row';

      var input = document.createElement('input');
      input.className = 'stage-code';
      input.type = 'text';
      input.maxLength = 18;
      input.value = stageConfigs[i].code;
      input.spellcheck = false;
      input.autocomplete = 'off';
      (function (idx) {
        input.addEventListener('input', function (e) {
          stageConfigs[idx].code = e.target.value;
        });
      })(i);
      topRow.appendChild(input);

      var rngBtn = document.createElement('button');
      rngBtn.className = 'stage-btn';
      rngBtn.type = 'button';
      rngBtn.textContent = 'RNG';
      (function (idx, inp) {
        rngBtn.addEventListener('click', function () {
          var code = randomCode();
          stageConfigs[idx].code = code;
          inp.value = code;
        });
      })(i, input);
      topRow.appendChild(rngBtn);

      content.appendChild(topRow);

      var bottomRow = document.createElement('div');
      bottomRow.className = 'stage-options';

      var dirSeg = document.createElement('div');
      dirSeg.className = 'seg-control seg-control-sm';
      var dirFwd = document.createElement('button');
      dirFwd.type = 'button';
      dirFwd.className = 'seg-option' + (stageConfigs[i].reversed ? '' : ' selected');
      dirFwd.dataset.val = 'FWD';
      dirFwd.textContent = 'FWD';
      var dirRev = document.createElement('button');
      dirRev.type = 'button';
      dirRev.className = 'seg-option' + (stageConfigs[i].reversed ? ' selected' : '');
      dirRev.dataset.val = 'REV';
      dirRev.textContent = 'REV';
      dirSeg.appendChild(dirFwd);
      dirSeg.appendChild(dirRev);
      (function (idx, seg) {
        seg.addEventListener('click', function (e) {
          var btn = e.target.closest('.seg-option');
          if (!btn || btn.classList.contains('selected')) return;
          seg.querySelector('.selected').classList.remove('selected');
          btn.classList.add('selected');
          stageConfigs[idx].reversed = btn.dataset.val === 'REV';
        });
      })(i, dirSeg);
      bottomRow.appendChild(dirSeg);

      var modeSeg = document.createElement('div');
      modeSeg.className = 'seg-control seg-control-sm';
      var modeDay = document.createElement('button');
      modeDay.type = 'button';
      modeDay.className = 'seg-option' + (stageConfigs[i].nightMode ? '' : ' selected');
      modeDay.dataset.val = 'DAY';
      modeDay.textContent = 'DAY';
      var modeNight = document.createElement('button');
      modeNight.type = 'button';
      modeNight.className = 'seg-option' + (stageConfigs[i].nightMode ? ' selected' : '');
      modeNight.dataset.val = 'NIGHT';
      modeNight.textContent = 'NIGHT';
      modeSeg.appendChild(modeDay);
      modeSeg.appendChild(modeNight);
      (function (idx, seg) {
        seg.addEventListener('click', function (e) {
          var btn = e.target.closest('.seg-option');
          if (!btn || btn.classList.contains('selected')) return;
          seg.querySelector('.selected').classList.remove('selected');
          btn.classList.add('selected');
          stageConfigs[idx].nightMode = btn.dataset.val === 'NIGHT';
        });
      })(i, modeSeg);
      bottomRow.appendChild(modeSeg);

      content.appendChild(bottomRow);
      block.appendChild(content);
      stageListEl.appendChild(block);
    }
  }

  function advanceToNextStage() {
    currentStageIndex++;
    resultsEl.style.display = 'none';
    startCountdown();
  }

  // ── Input ─────────────────────────────────────────────────────────
  function setupInput() {
    window.addEventListener('keydown', function (e) {
      keys[e.code] = true;

      if (e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'menu') {
          startCountdown();
        } else if (gameState === 'finished') {
          if (seriesMode && currentStageIndex < stageCount - 1) {
            advanceToNextStage();
          } else {
            restartCurrentMap();
          }
        }
      }

      if (e.code === 'Escape' && gameState === 'finished') {
        e.preventDefault();
        restartRace();
      }

      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        if (gameState === 'menu') {
          startCountdown();
        } else if (gameState === 'racing' || gameState === 'countdown') {
          restartCurrentMap();
        } else if (gameState === 'finished') {
          if (seriesMode && currentStageIndex < stageCount - 1) {
            advanceToNextStage();
          } else {
            restartCurrentMap();
          }
        }
      }

      if (e.code === 'KeyC' && document.activeElement.tagName !== 'INPUT') {
        cameraModeIndex = (cameraModeIndex + 1) % CAMERA_MODES.length;
        applyCameraMode();
      }
    });

    window.addEventListener('keyup', function (e) { keys[e.code] = false; });

    trackCodeInput.addEventListener('input', function () {
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(function () {
        if (gameState === 'menu') rebuildTrack(trackCodeInput.value);
      }, 200);
    });

    randomBtn.addEventListener('click', function () {
      trackCodeInput.value = randomCode();
      if (gameState === 'menu') rebuildTrack(trackCodeInput.value);
    });

    lapsMinusBtn.addEventListener('click', function () {
      if (totalLaps > 1) {
        totalLaps--;
        lapsValueEl.textContent = totalLaps;
        if (gameState === 'menu') rebuildTrack(trackCodeInput.value);
      }
    });

    lapsPlusBtn.addEventListener('click', function () {
      if (totalLaps < 20) {
        totalLaps++;
        lapsValueEl.textContent = totalLaps;
        if (gameState === 'menu') rebuildTrack(trackCodeInput.value);
      }
    });

    copyTrackBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(currentTrackCode).then(function () {
        copyTrackBtn.textContent = '\u2713';
        setTimeout(function () { copyTrackBtn.innerHTML = '&#9112;'; }, 1500);
      });
    });

    dirToggleBtn.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      dirToggleBtn.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      reversed = btn.dataset.val === 'REV';
      dirValueEl.textContent = reversed ? 'REV' : 'FWD';
      if (gameState === 'menu') rebuildTrack(trackCodeInput.value);
    });

    modeToggleBtn.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      modeToggleBtn.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      nightMode = btn.dataset.val === 'NIGHT';
      modeValueEl.textContent = nightMode ? 'NIGHT' : 'DAY';
    });

    raceTypeBtn.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-option');
      if (!btn || btn.classList.contains('selected')) return;
      raceTypeBtn.querySelector('.selected').classList.remove('selected');
      btn.classList.add('selected');
      seriesMode = btn.dataset.val === 'SERIES';
      raceTypeValue.textContent = seriesMode ? 'SERIES' : 'SINGLE';
      singleConfigEl.style.display = seriesMode ? 'none' : '';
      seriesConfigEl.style.display = seriesMode ? '' : 'none';
      lapsLabel.textContent = seriesMode ? 'LAPS PER STAGE' : 'LAPS';
      if (seriesMode) buildStageList();
      if (!seriesMode && gameState === 'menu') rebuildTrack(trackCodeInput.value);
    });

    stagesMinusBtn.addEventListener('click', function () {
      if (stageCount > 2) {
        stageCount--;
        stagesValueEl.textContent = stageCount;
        buildStageList();
      }
    });

    stagesPlusBtn.addEventListener('click', function () {
      if (stageCount < 5) {
        stageCount++;
        stagesValueEl.textContent = stageCount;
        buildStageList();
      }
    });

    rngAllBtn.addEventListener('click', function () {
      for (var i = 0; i < stageCount; i++) {
        stageConfigs[i].code = randomCode();
        stageConfigs[i].reversed = Math.random() > 0.5;
        stageConfigs[i].nightMode = Math.random() > 0.5;
      }
      totalLaps = Math.floor(Math.random() * 5) + 1;
      lapsValueEl.textContent = totalLaps;
      buildStageList();
    });
  }

  function getPlayerInput() {
    if (document.activeElement === trackCodeInput) return { accel: 0, steer: 0 };
    var accel = 0, steer = 0;
    if (keys['ArrowUp'] || keys['KeyW']) accel = 1;
    if (keys['ArrowDown'] || keys['KeyS']) accel = accel === 1 ? 0 : -1;
    if (keys['ArrowLeft'] || keys['KeyA']) steer = 1;
    if (keys['ArrowRight'] || keys['KeyD']) steer = -1;
    return { accel: accel, steer: steer };
  }

  // ── HUD ───────────────────────────────────────────────────────────
  function addLapTimeToHUD(lapNum, lapTime) {
    var div = document.createElement('div');
    div.className = 'hud-box';
    div.style.marginTop = '8px';
    var text = 'L' + lapNum + '  ' + formatTime(lapTime);
    if (lapNum > 1) {
      var prevTime = player.lapTimes[lapNum - 2];
      var delta = lapTime - prevTime;
      var sign = delta >= 0 ? '+' : '-';
      text += '  ' + sign + formatTime(Math.abs(delta));
      div.style.color = delta <= 0 ? '#4ecdc4' : '#e84d4d';
    }
    div.textContent = text;
    lapTimesList.appendChild(div);
  }

  function updateHUD() {
    var displayLap = Math.min(player.lap + 1, totalLaps);
    lapDisplay.textContent = 'LAP ' + displayLap + ' / ' + totalLaps;
    bestDisplay.textContent = 'BEST ' + (bestTime ? formatTime(bestTime) : '--:--.--');
    timeDisplay.textContent = formatTime(raceTimer);
    speedDisplay.textContent = Math.round(player.speed * 1.2) + ' km/h';
    if (seriesMode) {
      stageDisplayEl.style.display = 'block';
      stageDisplayEl.textContent = 'STAGE ' + (currentStageIndex + 1) + ' / ' + stageCount;
    } else {
      stageDisplayEl.style.display = 'none';
    }
  }

  // ── Game state ────────────────────────────────────────────────────
  function startCountdown() {
    if (seriesMode) {
      if (currentStageIndex === 0) seriesResults = [];
      var stage = stageConfigs[currentStageIndex];
      reversed = stage.reversed;
      nightMode = stage.nightMode;
      currentTrackCode = stage.code;
      rebuildTrack(stage.code);
    }
    gameState = 'countdown';
    overlay.classList.add('hidden');
    hud.style.display = 'block';
    updateHUD();
    for (var i = 0; i < semLights.length; i++) {
      semLights[i].className = 'sem-light';
    }
    countdownEl.style.display = 'flex';
    countdownTimer = 0;
    countdownValue = 0;
  }

  function updateCountdown(dt) {
    countdownTimer += dt;
    var lit = Math.floor(countdownTimer);
    if (lit > 3) lit = 3;
    if (lit !== countdownValue) {
      countdownValue = lit;
      if (lit <= 3) {
        for (var i = 0; i < semLights.length; i++) {
          if (i < lit) {
            semLights[i].className = 'sem-light red';
          }
        }
      }
    }
    if (countdownTimer >= 3.0 && countdownTimer < 3.6) {
      for (var i = 0; i < semLights.length; i++) {
        if (semLights[i].classList.contains('red')) {
          semLights[i].className = 'sem-light green';
        }
      }
    }
    if (countdownTimer >= 3.6) {
      gameState = 'racing';
      countdownEl.style.display = 'none';
      raceTimer = 0;
      recording = [{ x: player.x, z: player.z, a: player.angle }];
      recordAccum = 0;
      lapTimesList.innerHTML = '';
    }
  }

  function showResults() {
    gameState = 'finished';
    hud.style.display = 'none';
    resultsEl.style.display = 'flex';
    resultsList.innerHTML = '';

    recording.push({ x: player.x, z: player.z, a: player.angle });
    var isNewBest = !bestTime || player.finishTime < bestTime;
    if (isNewBest) saveBest(currentTrackCode, player.finishTime, recording);

    var existingRecord = resultsEl.querySelector('.new-record');
    if (existingRecord) existingRecord.remove();

    var resultsH2 = resultsEl.querySelector('h2');
    var promptEl = resultsEl.querySelector('.start-prompt');

    if (seriesMode) {
      seriesResults.push({
        code: currentTrackCode,
        reversed: reversed,
        nightMode: nightMode,
        time: player.finishTime,
        lapTimes: player.lapTimes.slice(),
        isNewBest: isNewBest
      });

      var isFinalStage = currentStageIndex >= stageCount - 1;

      if (isFinalStage) {
        resultsH2.textContent = 'SERIES COMPLETE';
        var totalTime = 0;
        for (var s = 0; s < seriesResults.length; s++) totalTime += seriesResults[s].time;
        resultsTrackText.textContent = stageCount + ' stages \u00B7 ' + formatTime(totalTime);
        copyTrackBtn.style.display = 'none';

        for (var s = 0; s < seriesResults.length; s++) {
          var sr = seriesResults[s];
          var stageLi = document.createElement('li');
          stageLi.className = 'lap-time';
          var dirLabel = sr.reversed ? 'REV' : 'FWD';
          var modeLabel = sr.nightMode ? 'NGT' : 'DAY';
          stageLi.textContent = '#' + (s + 1) + '  ' + formatTime(sr.time) + '  ' + dirLabel + ' ' + modeLabel;
          if (sr.isNewBest) stageLi.className += ' lap-fastest';
          resultsList.appendChild(stageLi);
        }
        promptEl.textContent = 'ENTER Retry  \u00B7  ESC Menu';
      } else {
        resultsH2.textContent = 'STAGE ' + (currentStageIndex + 1) + ' COMPLETE';
        resultsTrackText.textContent = currentTrackCode;
        copyTrackBtn.style.display = '';

        if (isNewBest) {
          var badge = document.createElement('p');
          badge.className = 'new-record';
          badge.textContent = 'NEW RECORD!';
          resultsEl.insertBefore(badge, resultsList);
        }

        var li = document.createElement('li');
        li.className = 'player';
        li.textContent = 'TIME  ' + formatTime(player.finishTime);
        li.style.color = '#' + PLAYER_COLOR.toString(16).padStart(6, '0');
        resultsList.appendChild(li);

        var fastestLap = Math.min.apply(null, player.lapTimes);
        for (var i = 0; i < player.lapTimes.length; i++) {
          var lapLi = document.createElement('li');
          lapLi.className = 'lap-time';
          lapLi.textContent = 'L' + (i + 1) + '  ' + formatTime(player.lapTimes[i]);
          if (player.lapTimes[i] === fastestLap) lapLi.className += ' lap-fastest';
          resultsList.appendChild(lapLi);
        }
        promptEl.textContent = 'Press ENTER for Stage ' + (currentStageIndex + 2);
      }
    } else {
      resultsH2.textContent = 'RACE COMPLETE';
      resultsTrackText.textContent = currentTrackCode;
      copyTrackBtn.style.display = '';

      if (isNewBest) {
        var badge = document.createElement('p');
        badge.className = 'new-record';
        badge.textContent = 'NEW RECORD!';
        resultsEl.insertBefore(badge, resultsList);
      }

      var li = document.createElement('li');
      li.className = 'player';
      li.textContent = 'TIME  ' + formatTime(player.finishTime);
      li.style.color = '#' + PLAYER_COLOR.toString(16).padStart(6, '0');
      resultsList.appendChild(li);

      var li2 = document.createElement('li');
      li2.className = 'best';
      li2.textContent = 'BEST  ' + formatTime(bestTime);
      resultsList.appendChild(li2);

      if (!isNewBest) {
        var li3 = document.createElement('li');
        li3.textContent = 'DELTA  +' + (player.finishTime - bestTime).toFixed(2) + 's';
        li3.style.color = '#e8944d';
        resultsList.appendChild(li3);
      }

      var fastestLap = Math.min.apply(null, player.lapTimes);
      for (var i = 0; i < player.lapTimes.length; i++) {
        var lapLi = document.createElement('li');
        lapLi.className = 'lap-time';
        lapLi.textContent = 'L' + (i + 1) + '  ' + formatTime(player.lapTimes[i]);
        if (player.lapTimes[i] === fastestLap) lapLi.className += ' lap-fastest';
        resultsList.appendChild(lapLi);
      }
      promptEl.textContent = 'ENTER Retry  \u00B7  ESC Menu';
    }
  }

  function formatTime(s) {
    var m = Math.floor(s / 60);
    var sec = (s % 60).toFixed(2);
    if (sec < 10) sec = '0' + sec;
    return m + ':' + sec;
  }

  function restartCurrentMap() {
    resultsEl.style.display = 'none';
    if (player) { scene.remove(player.mesh); player = null; }
    createPlayer();
    createGhost();
    gameState = 'countdown';
    overlay.classList.add('hidden');
    hud.style.display = 'block';
    for (var i = 0; i < semLights.length; i++) {
      semLights[i].className = 'sem-light';
    }
    countdownEl.style.display = 'flex';
    countdownTimer = 0;
    countdownValue = 0;
    raceTimer = 0;
    recording = [];
    recordAccum = 0;
    lapTimesList.innerHTML = '';
  }

  function restartRace() {
    resultsEl.style.display = 'none';
    overlay.classList.remove('hidden');
    gameState = 'menu';
    currentStageIndex = 0;
    seriesResults = [];
    if (seriesMode) {
      rebuildTrack(stageConfigs[0].code);
    } else {
      rebuildTrack(trackCodeInput.value);
    }
  }

  // ── Camera ────────────────────────────────────────────────────────
  function updateCamera() {
    var mode = CAMERA_MODES[cameraModeIndex];
    if (mode === 'TOP-DOWN') {
      camera.position.x += (player.x - camera.position.x) * 0.08;
      camera.position.z += (player.z - camera.position.z) * 0.08;
      camera.position.y = CAMERA_HEIGHT;
      camera.up.set(0, 0, -1);
      camera.lookAt(camera.position.x, 0, camera.position.z);
    } else if (mode === 'ROTATED') {
      camera.position.x += (player.x - camera.position.x) * 0.08;
      camera.position.z += (player.z - camera.position.z) * 0.08;
      camera.position.y = CAMERA_HEIGHT;
      camera.up.set(-Math.sin(player.angle), 0, -Math.cos(player.angle));
      camera.lookAt(camera.position.x, 0, camera.position.z);
    } else if (mode === 'CHASE') {
      var chaseDist = 60;
      var chaseHeight = 35;
      var lookAhead = 20;
      var behindX = player.x - Math.sin(player.angle) * chaseDist;
      var behindZ = player.z - Math.cos(player.angle) * chaseDist;
      camera.position.x += (behindX - camera.position.x) * 0.05;
      camera.position.z += (behindZ - camera.position.z) * 0.05;
      camera.position.y += (chaseHeight - camera.position.y) * 0.05;
      camera.lookAt(
        player.x + Math.sin(player.angle) * lookAhead,
        0,
        player.z + Math.cos(player.angle) * lookAhead
      );
    } else if (mode === 'ISOMETRIC') {
      var isoOff = 180;
      camera.position.x += (player.x + isoOff - camera.position.x) * 0.08;
      camera.position.z += (player.z + isoOff - camera.position.z) * 0.08;
      camera.position.y = 200;
      camera.up.set(0, 1, 0);
      camera.lookAt(camera.position.x - isoOff, 0, camera.position.z - isoOff);
    }
  }

  function applyCameraMode() {
    var mode = CAMERA_MODES[cameraModeIndex];
    if (mode === 'CHASE') {
      camera = perspCamera;
    } else {
      camera = orthoCamera;
      var aspect = window.innerWidth / window.innerHeight;
      var vs = (mode === 'ISOMETRIC') ? VIEW_SIZE * 1.4 : VIEW_SIZE;
      var hw = vs / 2, hh = hw / aspect;
      orthoCamera.left = -hw;
      orthoCamera.right = hw;
      orthoCamera.top = hh;
      orthoCamera.bottom = -hh;
      orthoCamera.updateProjectionMatrix();
    }
    if (player) {
      if (mode === 'TOP-DOWN' || mode === 'ROTATED') {
        camera.position.set(player.x, CAMERA_HEIGHT, player.z);
      } else if (mode === 'CHASE') {
        camera.position.set(
          player.x - Math.sin(player.angle) * 60, 35,
          player.z - Math.cos(player.angle) * 60
        );
        camera.lookAt(player.x, 0, player.z);
      } else if (mode === 'ISOMETRIC') {
        camera.position.set(player.x + 180, 200, player.z + 180);
        camera.lookAt(player.x, 0, player.z);
      }
    }
    cameraDisplayEl.textContent = mode;
  }

  // ── Night mode (3D) ──────────────────────────────────────────────
  function createBeamMesh(length, halfAngle) {
    var segments = 16;
    var positions = [0, 0.02, 0];
    var colors = [0.9, 0.85, 0.5];
    var indices = [];

    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      var a = -halfAngle + 2 * halfAngle * t;
      positions.push(Math.sin(a) * length, 0.02, Math.cos(a) * length);
      colors.push(0, 0, 0);
    }

    for (var i = 0; i < segments; i++) {
      indices.push(0, i + 1, i + 2);
    }

    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);

    return new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
  }

  function createGlowMesh(radius, r, g, b) {
    var segments = 24;
    var positions = [0, 0.02, 0];
    var colors = [r, g, b];
    var indices = [];

    for (var i = 0; i <= segments; i++) {
      var a = (i / segments) * Math.PI * 2;
      positions.push(Math.cos(a) * radius, 0.02, Math.sin(a) * radius);
      colors.push(0, 0, 0);
    }

    for (var i = 0; i < segments; i++) {
      indices.push(0, i + 1, i + 2);
    }

    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);

    return new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
  }

  function setupLights() {
    ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    carPointLight = new THREE.PointLight(0xffe0a0, 0, 90, 2);
    scene.add(carPointLight);

    beamMeshL = createBeamMesh(130, 0.45);
    beamMeshR = createBeamMesh(130, 0.45);
    glowMesh = createGlowMesh(35, 0.35, 0.28, 0.1);
    tailMesh = createGlowMesh(15, 0.15, 0.02, 0);

    scene.add(beamMeshL, beamMeshR, glowMesh, tailMesh);
    beamMeshL.visible = false;
    beamMeshR.visible = false;
    glowMesh.visible = false;
    tailMesh.visible = false;
  }

  function updateNightMode() {
    var isNight = nightMode;
    ambientLight.intensity = isNight ? 0 : 1.0;
    scene.background.set(isNight ? 0x000000 : 0x5d8a4a);
    if (centerLineMat) centerLineMat.color.set(isNight ? 0x111111 : 0x666666);

    carPointLight.intensity = isNight ? 0.8 : 0;

    var showBeams = isNight && !!player;
    beamMeshL.visible = showBeams;
    beamMeshR.visible = showBeams;
    glowMesh.visible = showBeams;
    tailMesh.visible = showBeams;

    if (!showBeams) return;

    var fx = Math.sin(player.angle);
    var fz = Math.cos(player.angle);
    var headlightFwd = CAR_RADIUS * 0.6;

    beamMeshL.position.set(player.x + fx * headlightFwd, 0, player.z + fz * headlightFwd);
    beamMeshL.rotation.y = player.angle - 0.06;
    beamMeshR.position.set(player.x + fx * headlightFwd, 0, player.z + fz * headlightFwd);
    beamMeshR.rotation.y = player.angle + 0.06;

    glowMesh.position.set(player.x, 0, player.z);
    tailMesh.position.set(player.x - fx * CAR_RADIUS, 0, player.z - fz * CAR_RADIUS);

    carPointLight.position.set(player.x, 8, player.z);
  }

  // ── Main loop ─────────────────────────────────────────────────────
  function gameLoop(time) {
    requestAnimationFrame(gameLoop);

    var dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
    lastTime = time;

    if (gameState === 'countdown') {
      updateCountdown(dt);
    }

    if (gameState === 'racing') {
      raceTimer += dt;

      var input = getPlayerInput();
      updatePlayerPhysics(dt, input.accel, input.steer);

      wallCollision(track.inner);
      wallCollision(track.outer);
      player.mesh.position.set(player.x, 0, player.z);

      updateLapTracking();
      recordFrame(dt);
      updateGhost();

      if (player.finished) {
        showResults();
      }

      updateHUD();
    }

    if (player) updateCamera();
    updateNightMode();
    renderer.render(scene, camera);
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5d8a4a);

    var aspect = window.innerWidth / window.innerHeight;
    var halfW = VIEW_SIZE / 2;
    var halfH = halfW / aspect;
    orthoCamera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 1000);
    orthoCamera.position.set(0, CAMERA_HEIGHT, 0);
    orthoCamera.up.set(0, 0, -1);
    orthoCamera.lookAt(0, 0, 0);
    perspCamera = new THREE.PerspectiveCamera(70, aspect, 1, 2000);
    camera = orthoCamera;
    cameraDisplayEl.textContent = CAMERA_MODES[cameraModeIndex];

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.prepend(renderer.domElement);
    setupLights();

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000, 40, 40),
      new THREE.MeshLambertMaterial({ color: 0x5d8a4a })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    var startCode = randomCode();
    trackCodeInput.value = startCode;
    for (var i = 0; i < stageConfigs.length; i++) stageConfigs[i].code = randomCode();
    rebuildTrack(startCode);
    setupInput();

    window.addEventListener('resize', function () {
      var a = window.innerWidth / window.innerHeight;
      var vs = (CAMERA_MODES[cameraModeIndex] === 'ISOMETRIC') ? VIEW_SIZE * 1.4 : VIEW_SIZE;
      var hw = vs / 2, hh = hw / a;
      orthoCamera.left = -hw; orthoCamera.right = hw;
      orthoCamera.top = hh; orthoCamera.bottom = -hh;
      orthoCamera.updateProjectionMatrix();
      perspCamera.aspect = a;
      perspCamera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    requestAnimationFrame(gameLoop);
  }

  init();
})();
