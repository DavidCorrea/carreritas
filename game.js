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
  var TRACK_SAMPLES = 400;
  var RECORD_INTERVAL = 0.05;
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
  var trackGroup;
  var track;
  var player;
  var ghostMesh;
  var keys = {};
  var nightCanvas, nightCtx;
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
  var resultsEl = document.getElementById('results');
  var resultsList = document.getElementById('results-list');
  var resultsTrackCode = document.getElementById('results-track-code');
  var trackCodeInput = document.getElementById('track-code-input');
  var randomBtn = document.getElementById('random-btn');
  var lapsValueEl = document.getElementById('laps-value');
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

  // ── Persistence (per track code) ──────────────────────────────────
  function storageKey(code) {
    return STORAGE_PREFIX + code + '_' + totalLaps + 'L' + (reversed ? '_R' : '');
  }

  function loadBest(code) {
    bestReplay = null;
    bestTime = null;
    try {
      var data = JSON.parse(localStorage.getItem(storageKey(code)));
      if (data && data.time && data.frames && data.frames.length > 0) {
        bestReplay = data.frames;
        bestTime = data.time;
      }
    } catch (_) {}
  }

  function saveBest(code, time, frames) {
    bestReplay = frames;
    bestTime = time;
    localStorage.setItem(storageKey(code), JSON.stringify({ time: time, frames: frames }));
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
    trackGroup.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: 0x444444 })));
  }

  function buildWalls(inner, outer) {
    var step = 2;
    var count = Math.ceil(inner.length / step) + Math.ceil(outer.length / step);
    var geom = new THREE.SphereGeometry(1.8, 8, 6);
    var mesh = new THREE.InstancedMesh(geom, new THREE.MeshBasicMaterial({ color: 0xcccccc }), count);
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
        new THREE.MeshBasicMaterial({ color: color })
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
    trackGroup.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: 0x666666 })));
  }

  // ── Car mesh creation ─────────────────────────────────────────────
  function createCarMesh(color, x, z, angle, opacity) {
    var group = new THREE.Group();
    var transparent = opacity < 1;

    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(CAR_RADIUS, 20),
      new THREE.MeshBasicMaterial({ color: color, transparent: transparent, opacity: opacity })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 2;
    group.add(disc);

    var ring = new THREE.Mesh(
      new THREE.RingGeometry(CAR_RADIUS * 0.82, CAR_RADIUS, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 * opacity })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 2.1;
    group.add(ring);

    var dot = new THREE.Mesh(
      new THREE.CircleGeometry(CAR_RADIUS * 0.22, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: transparent, opacity: opacity })
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
  }

  function updateGhost() {
    if (!ghostMesh || !bestReplay) return;

    var i = 0;
    while (i < bestReplay.length - 1 && bestReplay[i + 1].t <= raceTimer) i++;

    if (i >= bestReplay.length - 1) {
      ghostMesh.visible = false;
      return;
    }

    var a = bestReplay[i], b = bestReplay[i + 1];
    var span = b.t - a.t;
    var frac = span > 0 ? (raceTimer - a.t) / span : 0;

    var x = a.x + (b.x - a.x) * frac;
    var z = a.z + (b.z - a.z) * frac;

    var angleDiff = b.a - a.a;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    ghostMesh.position.set(x, 0, z);
    ghostMesh.rotation.y = a.a + angleDiff * frac;
    ghostMesh.visible = true;
  }

  // ── Recording ─────────────────────────────────────────────────────
  function recordFrame(dt) {
    recordAccum += dt;
    if (recordAccum >= RECORD_INTERVAL) {
      recordAccum = 0;
      recording.push({ t: raceTimer, x: player.x, z: player.z, a: player.angle });
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
      var row = document.createElement('div');
      row.className = 'stage-row';

      var num = document.createElement('span');
      num.className = 'stage-num';
      num.textContent = '#' + (i + 1);
      row.appendChild(num);

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
      row.appendChild(input);

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
      row.appendChild(rngBtn);

      var dirBtn = document.createElement('button');
      dirBtn.className = 'stage-btn';
      dirBtn.type = 'button';
      dirBtn.textContent = stageConfigs[i].reversed ? 'REV' : 'FWD';
      (function (idx, btn) {
        btn.addEventListener('click', function () {
          stageConfigs[idx].reversed = !stageConfigs[idx].reversed;
          btn.textContent = stageConfigs[idx].reversed ? 'REV' : 'FWD';
        });
      })(i, dirBtn);
      row.appendChild(dirBtn);

      var modeBtn = document.createElement('button');
      modeBtn.className = 'stage-btn';
      modeBtn.type = 'button';
      modeBtn.textContent = stageConfigs[i].nightMode ? '\u263E' : '\u2600';
      (function (idx, btn) {
        btn.addEventListener('click', function () {
          stageConfigs[idx].nightMode = !stageConfigs[idx].nightMode;
          btn.textContent = stageConfigs[idx].nightMode ? '\u263E' : '\u2600';
        });
      })(i, modeBtn);
      row.appendChild(modeBtn);

      stageListEl.appendChild(row);
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
            restartRace();
          }
        }
      }

      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        if (gameState === 'menu') {
          startCountdown();
        } else if (gameState === 'finished') {
          if (seriesMode && currentStageIndex < stageCount - 1) {
            advanceToNextStage();
          } else {
            restartRace();
          }
        }
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

    dirToggleBtn.addEventListener('click', function () {
      reversed = !reversed;
      dirValueEl.textContent = reversed ? 'REV' : 'FWD';
      if (gameState === 'menu') rebuildTrack(trackCodeInput.value);
    });

    modeToggleBtn.addEventListener('click', function () {
      nightMode = !nightMode;
      modeValueEl.textContent = nightMode ? 'NIGHT' : 'DAY';
      modeToggleBtn.innerHTML = nightMode ? '&#9790;' : '&#9788;';
    });

    raceTypeBtn.addEventListener('click', function () {
      seriesMode = !seriesMode;
      raceTypeValue.textContent = seriesMode ? 'SERIES' : 'SINGLE';
      singleConfigEl.style.display = seriesMode ? 'none' : '';
      seriesConfigEl.style.display = seriesMode ? '' : 'none';
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
    div.style.marginTop = '4px';
    div.textContent = 'L' + lapNum + '  ' + formatTime(lapTime);
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
    countdownEl.style.display = 'flex';
    countdownTimer = 0;
    countdownValue = 3;
    countdownEl.textContent = '3';
  }

  function updateCountdown(dt) {
    countdownTimer += dt;
    var val = 3 - Math.floor(countdownTimer);
    if (val !== countdownValue) {
      countdownValue = val;
      if (val > 0) {
        countdownEl.textContent = val;
      } else if (val === 0) {
        countdownEl.textContent = 'GO!';
        countdownEl.style.color = '#4ecdc4';
      }
    }
    if (countdownTimer >= 3.8) {
      gameState = 'racing';
      countdownEl.style.display = 'none';
      countdownEl.style.color = '#fff';
      raceTimer = 0;
      recording = [];
      recordAccum = 0;
      lapTimesList.innerHTML = '';
    }
  }

  function showResults() {
    gameState = 'finished';
    hud.style.display = 'none';
    resultsEl.style.display = 'flex';
    resultsList.innerHTML = '';

    recording.push({ t: raceTimer, x: player.x, z: player.z, a: player.angle });
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
        resultsTrackCode.textContent = stageCount + ' stages \u00B7 ' + formatTime(totalTime);

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
        promptEl.textContent = 'Press ENTER to play again';
      } else {
        resultsH2.textContent = 'STAGE ' + (currentStageIndex + 1) + ' COMPLETE';
        resultsTrackCode.textContent = currentTrackCode;

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
      resultsTrackCode.textContent = 'Track: ' + currentTrackCode;

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
      promptEl.textContent = 'Press ENTER to play again';
    }
  }

  function formatTime(s) {
    var m = Math.floor(s / 60);
    var sec = (s % 60).toFixed(2);
    if (sec < 10) sec = '0' + sec;
    return m + ':' + sec;
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
    camera.position.x += (player.x - camera.position.x) * 0.08;
    camera.position.z += (player.z - camera.position.z) * 0.08;
    camera.lookAt(camera.position.x, 0, camera.position.z);
  }

  // ── Night mode ────────────────────────────────────────────────────
  function createNightOverlay() {
    nightCanvas = document.createElement('canvas');
    nightCanvas.width = window.innerWidth;
    nightCanvas.height = window.innerHeight;
    var s = nightCanvas.style;
    s.position = 'absolute';
    s.top = '0';
    s.left = '0';
    s.pointerEvents = 'none';
    s.zIndex = '10';
    s.display = 'none';
    document.body.appendChild(nightCanvas);
    nightCtx = nightCanvas.getContext('2d');
  }

  function renderNightOverlay() {
    if (!nightMode || !player) {
      nightCanvas.style.display = 'none';
      return;
    }
    nightCanvas.style.display = 'block';

    var w = nightCanvas.width;
    var h = nightCanvas.height;
    var ctx = nightCtx;

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 2, 8, 0.93)';
    ctx.fillRect(0, 0, w, h);

    var scale = w / VIEW_SIZE;
    var sx = (player.x - camera.position.x) * scale + w / 2;
    var sy = (player.z - camera.position.z) * scale + h / 2;
    var screenAngle = Math.atan2(Math.cos(player.angle), Math.sin(player.angle));

    ctx.globalCompositeOperation = 'destination-out';

    var ambR = 28 * scale;
    var ambGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, ambR);
    ambGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
    ambGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    ambGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ambGrad;
    ctx.beginPath();
    ctx.arc(sx, sy, ambR, 0, Math.PI * 2);
    ctx.fill();

    var beamLen = 150 * scale;
    drawHeadlightBeam(ctx, sx, sy, screenAngle - 0.06, beamLen, 0.35, scale);
    drawHeadlightBeam(ctx, sx, sy, screenAngle + 0.06, beamLen, 0.35, scale);

    ctx.globalCompositeOperation = 'source-over';

    var tailAngle = screenAngle + Math.PI;
    var tailOff = CAR_RADIUS * scale * 0.5;
    var tailX = sx + Math.cos(tailAngle) * tailOff;
    var tailY = sy + Math.sin(tailAngle) * tailOff;
    var tailR = 12 * scale;
    var tailGrad = ctx.createRadialGradient(tailX, tailY, 0, tailX, tailY, tailR);
    tailGrad.addColorStop(0, 'rgba(255, 20, 0, 0.15)');
    tailGrad.addColorStop(1, 'rgba(255, 20, 0, 0)');
    ctx.fillStyle = tailGrad;
    ctx.beginPath();
    ctx.arc(tailX, tailY, tailR, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHeadlightBeam(ctx, sx, sy, angle, length, spread, scale) {
    var offset = CAR_RADIUS * scale * 0.6;
    var ox = sx + Math.cos(angle) * offset;
    var oy = sy + Math.sin(angle) * offset;

    var grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, length);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.65, 'rgba(255,255,255,0.3)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, length, angle - spread, angle + spread);
    ctx.closePath();
    ctx.fill();
  }

  // ── Main loop ─────────────────────────────────────────────────────
  function gameLoop(time) {
    requestAnimationFrame(gameLoop);

    var dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
    lastTime = time;

    if (gameState === 'countdown') {
      updateCountdown(dt);
      updateCamera();
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
      updateCamera();
    }

    renderer.render(scene, camera);
    renderNightOverlay();
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5d8a4a);

    var aspect = window.innerWidth / window.innerHeight;
    var halfW = VIEW_SIZE / 2;
    var halfH = halfW / aspect;
    camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 1000);
    camera.position.set(0, CAMERA_HEIGHT, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.prepend(renderer.domElement);
    createNightOverlay();

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshBasicMaterial({ color: 0x5d8a4a })
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
      var hw = VIEW_SIZE / 2, hh = hw / a;
      camera.left = -hw; camera.right = hw;
      camera.top = hh; camera.bottom = -hh;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      nightCanvas.width = window.innerWidth;
      nightCanvas.height = window.innerHeight;
    });

    requestAnimationFrame(gameLoop);
  }

  init();
})();
