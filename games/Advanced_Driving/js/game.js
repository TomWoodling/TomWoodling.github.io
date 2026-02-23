// ═══ GAME ═══
// Monster Chase — main loop

var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.prepend(renderer.domElement);

var scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(SKY_BASE.getHex(), 0.006);
scene.background = SKY_BASE.clone();

var camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 600);

// ─── LIGHTS ───────────────────────────────────
var ambientLight = new THREE.AmbientLight(0x221133, 0.9);
scene.add(ambientLight);

var dirLight = new THREE.DirectionalLight(0xffccaa, 0.8);
dirLight.position.set(-8, 18, 5);
scene.add(dirLight);

var fillLight = new THREE.DirectionalLight(0x4466ff, 0.4);
fillLight.position.set(10, 6, -5);
scene.add(fillLight);

scene.add(car);
var sun = makeSun();
scene.add(sun);

// Stars
(function() {
  var geo = new THREE.BufferGeometry();
  var p = new Float32Array(6000);
  for (var i = 0; i < 2000; i++) {
    p[i*3]   = (Math.random() - 0.5) * 600;
    p[i*3+1] = 20 + Math.random() * 100;
    p[i*3+2] = (Math.random() - 0.5) * 600;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.35, transparent: true, opacity: 0.8
  })));
})();

initRoad();
initCarGLB();

// ═══ GAME STATE ═══
var gameStarted = false;
var speed = 0;
var steer = 0;
var time  = 0;

var camPos = new THREE.Vector3(0, C.camH, -C.camDist);
var camTgt = new THREE.Vector3(0, 1.2, 15);

// ─── RANDOM MONSTER EVENT SCHEDULER ──────────
// Fires encounters randomly, independently of road palette.
// Guarantees no overlap and a minimum gap between events.
var monsterScheduler = {
  nextEventIn:  45 + Math.random() * 30,  // first encounter 45–75s in
  eventRunning: false,

  update: function(dt, transform) {
    if (!gameStarted || !transform) return;
    if (this.eventRunning) {
      if (!monsterManager.active) {
        this.eventRunning = false;
        // Random gap between encounters: 30–70s
        this.nextEventIn = 30 + Math.random() * 40;
        dbg('Next encounter in ' + Math.round(this.nextEventIn) + 's');
      }
      return;
    }
    this.nextEventIn -= dt;
    if (this.nextEventIn <= 0) {
      this.eventRunning = true;
      monsterManager._activateNext(transform);
    }
  }
};

// Boost
var boostState = { active: false, timer: 0 };
function activateBoost() {
  boostState.active = true;
  boostState.timer  = C.boostDuration;
}

// Collision
var hitState = { cooldown: 0, flashing: false, flashTimer: 0 };

function checkHazardCollisions(carPos) {
  if (hitState.cooldown > 0 || boostState.active) return false;
  var d = C.collisionCheckDist;

  if (spider.state.active) {
    for (var i = 0; i < spider.webs.length; i++) {
      if (spider.webs[i].mesh.position.distanceTo(carPos) < d) return true;
    }
  }
  if (godzilla.state.active) {
    for (var i = 0; i < godzilla.debris.length; i++) {
      var db = godzilla.debris[i];
      if (db.isBeam   && db.mesh.position.distanceTo(carPos) < d + 2) return true;
      if (db.isRubble && db.mesh.position.y < 2.0 && db.mesh.position.distanceTo(carPos) < d) return true;
      if (db.isRoadDebris && db.mesh.position.distanceTo(carPos) < d) return true;
    }
  }
  if (crabs.state.active) {
    var cl = crabs.getCrabs();
    for (var i = 0; i < cl.length; i++) {
      if (cl[i].userData.done) continue;
      if (cl[i].position.distanceTo(carPos) < d + 1) return true;
    }
  }
  return false;
}

// ─── HUD HELPERS ──────────────────────────────
function showMonsterAlert(text) {
  var el = document.getElementById('monster-alert');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); }, 3000);
}

// ─── START ────────────────────────────────────
function startGame() {
  var overlay = document.getElementById('title-overlay');
  if (overlay.classList.contains('hidden')) return;
  overlay.classList.add('hidden');
  gameStarted = true;
  audio.init();
  audio.unlocked = true;
  audio.play();
  monsterManager.init();

  var retryCount = 0;
  var retryInterval = setInterval(function() {
    retryCount++;
    if (audio.retryPlay()) {
      clearInterval(retryInterval);
      dbg('Music started');
    } else if (retryCount > 20) {
      clearInterval(retryInterval);
      dbg('Music timeout', 'warn');
    }
  }, 250);

  dbg('Game started!');
}

window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

(function() {
  var prompt = document.getElementById('start-prompt');
  if (prompt) prompt.textContent = (('ontouchstart' in window) ? 'Tap to escape' : 'Press any key to escape');
})();

// ═══ GAME LOOP ═══
var clock = new THREE.Clock();
var currentFogColor = SKY_BASE.clone();

function update() {
  var dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  // Pre-game orbit
  if (!gameStarted) {
    var tt = getCarWorldTransform();
    if (tt) {
      car.position.copy(tt.position);
      car.rotation.y = tt.angle;
    }
    camera.position.set(
      car.position.x + Math.sin(time * 0.3) * 8,
      C.camH + 3 + Math.sin(time * 0.5) * 0.5,
      car.position.z - C.camDist - 3
    );
    camera.lookAt(car.position.x, 1.5, car.position.z + 10);
    updateShaderTime(time);
    renderer.render(scene, camera);
    requestAnimationFrame(update);
    return;
  }

  pollInput();
  audio.update(dt);

  // Boost
  if (boostState.active) {
    boostState.timer -= dt;
    if (boostState.timer <= 0) boostState.active = false;
  }

  // Speed / braking
  var effectiveMax = boostState.active ? C.boostSpeed : C.maxSpeed;
  if (InputState.throttle) {
    var accelRate = InputState.isMobile ? C.accel * C.autoAccelRate : C.accel;
    speed = Math.min(speed + accelRate * dt, effectiveMax);
  } else if (InputState.braking) {
    speed = Math.max(speed - C.brake * dt, 0);
  } else {
    speed = Math.max(speed - C.friction * dt, 0);
  }
  if (boostState.active && speed < C.boostSpeed)
    speed = Math.min(speed + C.accel * 2 * dt, C.boostSpeed);

  // Steering
  var targetSteer = InputState.steerAxis * C.maxSteer;
  if (Math.abs(InputState.steerAxis) > 0.01) {
    steer = THREE.MathUtils.lerp(steer, targetSteer, C.steerSpeed * dt * 2);
  } else {
    if (Math.abs(steer) < 0.05) steer = 0;
    else steer -= Math.sign(steer) * C.steerReturn * dt;
  }

  var transform = updateRoad(dt, speed, steer);

  if (transform) {
    car.position.copy(transform.position);
    car.rotation.y = transform.angle - steer * 0.3;
    car.rotation.z = steer * 0.05;

    var spd = speed / 3.6;
    carWheels.forEach(function(w) { w.rotation.x += spd * dt * 3; });

    // Monster scheduler (random encounters) + active monster tick
    monsterScheduler.update(dt, transform);
    monsterManager.update(dt, transform, speed, boostState.active);

    // Collision detection
    if (hitState.cooldown > 0) {
      hitState.cooldown -= dt;
    } else if (checkHazardCollisions(transform.position)) {
      speed = C.collisionSlowSpeed;
      hitState.cooldown = C.collisionCooldown;
      hitState.flashing = true;
      hitState.flashTimer = 1.0;
      dbg('HIT! Speed dropped to ' + C.collisionSlowSpeed, 'warn');
    }

    if (hitState.flashing) {
      hitState.flashTimer -= dt;
      if (hitState.flashTimer <= 0) {
        hitState.flashing = false;
        car.visible = true;
      } else {
        car.visible = (Math.floor(hitState.flashTimer * 20) % 2 === 0);
      }
    }

    // Camera
    var boostExtra = boostState.active ? C.boostCamExtra * (boostState.timer / C.boostDuration) : 0;
    var lookAhead  = getRoadLookAhead(15 + (speed / C.maxSpeed) * 10);
    var camDist    = C.camDist + (speed / C.maxSpeed) * 2 + boostExtra;

    var monsterClose = false;
    var monsterCamH  = 0;
    if (spider.state.active && spider.state.phase !== 'done' && spider.group && !boostState.active) {
      var spiderFromCar = spider.group.position.distanceTo(transform.position);
      var neededCamDist = spiderFromCar + 10;
      if (camDist < neededCamDist) camDist = neededCamDist;
      monsterCamH = 3.5 + Math.min(spiderFromCar * 0.08, 2.0);
      monsterClose = true;
      var pursuitPulse = Math.sin(time * 0.8) * 0.5 + 0.5;
      if (pursuitPulse > 0.7) {
        var pulseStr = (pursuitPulse - 0.7) / 0.3;
        camDist     += 6 * pulseStr;
        monsterCamH += 2 * pulseStr;
      }
    }
    if (godzilla.state.active && godzilla.group) {
      var gzDist = godzilla.group.position.distanceTo(transform.position);
      if (gzDist < 35) { camDist += 4; monsterClose = true; }
    }

    var ip = new THREE.Vector3(
      transform.position.x - transform.tangent.x * camDist + transform.right.x * roadState.lateral * 0.3,
      C.camH + (speed / C.maxSpeed) * 0.5 + (monsterClose ? 1.5 : 0) + monsterCamH,
      transform.position.z - transform.tangent.z * camDist + transform.right.z * roadState.lateral * 0.3
    );
    var it = new THREE.Vector3(
      lookAhead.x + roadState.lateral * transform.right.x * 0.3,
      1.2,
      lookAhead.z + roadState.lateral * transform.right.z * 0.3
    );

    camPos.lerp(ip, C.camSmoothPos * dt);
    camTgt.lerp(it, C.camSmoothLook * dt);
    camera.position.copy(camPos);
    camera.lookAt(camTgt);

    var targetFov = C.camFovBase + (speed / C.maxSpeed) * C.camFovSpeed;
    if (boostState.active) targetFov += C.boostFovExtra * (boostState.timer / C.boostDuration);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, dt * 2);
    camera.updateProjectionMatrix();

    sun.position.copy(transform.position);
    sun.position.y = 15;
    sun.position.addScaledVector(transform.tangent, 350);
    sun.lookAt(camera.position);
  }

  // ─── HUD ──────────────────────────────────
  document.getElementById('speed-val').textContent = Math.floor(speed);
  document.getElementById('dist-val').textContent  = (roadState.totalDist / 1000).toFixed(1);

  var be = document.getElementById('biome-name');
  if (be) be.textContent = audio.trackName();

  var boostEl = document.getElementById('boost-indicator');
  if (boostEl) {
    if (boostState.active) {
      boostEl.style.opacity = '1';
      boostEl.textContent   = '⚡ BOOST ' + Math.ceil(boostState.timer) + 's';
    } else {
      boostEl.style.opacity = '0';
    }
  }

  var threatEl = document.getElementById('monster-threat');
  if (threatEl && transform) {
    var threatened = false;
    if (spider.state.active) {
      var sDist = spider.group ? spider.group.position.distanceTo(transform.position) : 999;
      if (sDist < 50) {
        threatEl.textContent   = '🕷 SPIDER ' + Math.round(sDist) + 'm';
        threatEl.style.opacity = '1';
        threatEl.style.color   = '#00ff88';
        threatened = true;
      }
    }
    if (!threatened && godzilla.state.active) {
      var gDist = godzilla.group ? godzilla.group.position.distanceTo(transform.position) : 999;
      if (gDist < 60) {
        threatEl.textContent   = '🦎 GODZILLA ' + Math.round(gDist) + 'm';
        threatEl.style.opacity = '1';
        threatEl.style.color   = '#ff00ff';
        threatened = true;
      }
    }
    if (!threatened && crabs.state.active) {
      threatEl.textContent   = '🦀 CRABS ON ROAD';
      threatEl.style.opacity = '1';
      threatEl.style.color   = '#ff8800';
      threatened = true;
    }
    if (!threatened) threatEl.style.opacity = '0';
  }

  // ─── FOG / SKY ────────────────────────────
  // The palette fogColor is the tint target — always a visible colour.
  // We blend it slightly toward SKY_BASE so there's always some purple
  // synthwave in the atmosphere regardless of palette.
  // The background is SKY_BASE lifted by the palette tint and brightened
  // so it reads clearly above the ground plane.
  var targetFog = activePalette.fogColor.clone().lerp(SKY_BASE, 0.35);
  currentFogColor.lerp(targetFog, dt * 0.5);
  scene.fog.color.copy(currentFogColor);

  // Sky: start from SKY_BASE, tint toward palette, then brighten so it's
  // always noticeably lighter than the fog.
  var skyTarget = SKY_BASE.clone().lerp(activePalette.fogColor, 0.3);
  scene.background.lerp(skyTarget, dt * 0.5);
  // Clamp channels so sky stays visible without washing out
  scene.background.r = Math.min(scene.background.r * 1.7, 0.35);
  scene.background.g = Math.min(scene.background.g * 1.7, 0.25);
  scene.background.b = Math.min(scene.background.b * 1.7, 0.55);

  updateShaderTime(time);
  renderer.render(scene, camera);
  requestAnimationFrame(update);
}

function updateShaderTime(t) {
  scene.traverse(function(o) {
    if (o.material && o.material.uniforms && o.material.uniforms.time)
      o.material.uniforms.time.value = t;
  });
}

update();
dbg('Game loop started');
