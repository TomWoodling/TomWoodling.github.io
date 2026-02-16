// ═══ GAME ═══
// Monster Chase — main loop

var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

var scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050010, 0.007);
scene.background = new THREE.Color(0x0a0014);

var camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 600);

// Lights
scene.add(new THREE.AmbientLight(0x111122, 0.3));
var dirLight = new THREE.DirectionalLight(0x4444ff, 0.4);
dirLight.position.set(-5, 10, 5);
scene.add(dirLight);

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
    color: 0xffffff, size: 0.3, transparent: true, opacity: 0.6
  })));
})();

// Init
initRoad();
initCarGLB();

// ═══ GAME STATE ═══
var gameStarted = false;
var speed = 0;
var steer = 0;
var time  = 0;
var biomeTransTimer = 0;

var camPos = new THREE.Vector3(0, C.camH, -C.camDist);
var camTgt = new THREE.Vector3(0, 1.2, 15);

// Boost
var boostState = { active: false, timer: 0 };
function activateBoost() {
  boostState.active = true;
  boostState.timer  = C.boostDuration;
}

// ═══ HUD HELPERS ═══
function showBiomeTransition(bk) {
  var el = document.getElementById('biome-transition');
  var b  = BIOMES[bk];
  el.textContent = '⟶ ' + b.name;
  el.style.color = '#' + b.neonP.getHexString();
  el.classList.add('show');
  biomeTransTimer = 2.5;
}

function showMonsterAlert(text) {
  var el = document.getElementById('monster-alert');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); }, 3000);
}

// ═══ START ═══
function startGame() {
  var overlay = document.getElementById('title-overlay');
  if (overlay.classList.contains('hidden')) return;
  overlay.classList.add('hidden');
  gameStarted = true;
  audio.init();
  audio.switchTo(activeBiome);

  monsterManager.init();

  var retryCount = 0;
  var retryInterval = setInterval(function() {
    retryCount++;
    if (audio.retryPlay(activeBiome)) {
      clearInterval(retryInterval);
      dbg('Music started: ' + activeBiome);
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

  // Biome transition banner
  if (biomeTransTimer > 0) {
    biomeTransTimer -= dt;
    if (biomeTransTimer <= 0)
      document.getElementById('biome-transition').classList.remove('show');
  }

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

  // Road update
  var transform = updateRoad(dt, speed, steer);

  if (transform) {
    // Car position
    car.position.copy(transform.position);
    car.rotation.y = transform.angle - steer * 0.3;
    car.rotation.z = steer * 0.05;

    // Wheels
    var spd = speed / 3.6;
    carWheels.forEach(function(w) { w.rotation.x += spd * dt * 3; });

    // Monster update
    monsterManager.update(dt, transform, speed, boostState.active);

    // Camera
    var boostExtra = boostState.active ? C.boostCamExtra * (boostState.timer / C.boostDuration) : 0;
    var lookAhead  = getRoadLookAhead(15 + (speed / C.maxSpeed) * 10);
    var camDist    = C.camDist + (speed / C.maxSpeed) * 2 + boostExtra;

    // If a pursuing monster is very close, pull camera back further for drama
    var monsterClose = false;
    if (activeBiome === 'countryside' && spider.state.active && spider.group) {
      var spiderDist = spider.group.position.distanceTo(transform.position);
      if (spiderDist < 30) { camDist += 4; monsterClose = true; }
    }
    if (activeBiome === 'city' && godzilla.state.active && godzilla.group) {
      var gzDist = godzilla.group.position.distanceTo(transform.position);
      if (gzDist < 35) { camDist += 4; monsterClose = true; }
    }

    var ip = new THREE.Vector3(
      transform.position.x - transform.tangent.x * camDist + transform.right.x * roadState.lateral * 0.3,
      C.camH + (speed / C.maxSpeed) * 0.5 + (monsterClose ? 1.5 : 0),
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

    // Sun
    sun.position.copy(transform.position);
    sun.position.y = 15;
    sun.position.addScaledVector(transform.tangent, 350);
    sun.lookAt(camera.position);
  }

  // HUD
  document.getElementById('speed-val').textContent = Math.floor(speed);
  document.getElementById('dist-val').textContent = (roadState.totalDist / 1000).toFixed(1);

  var be = document.getElementById('biome-name');
  var bn = BIOMES[activeBiome].name;
  if (be.textContent !== bn) {
    be.textContent = bn;
    be.style.color  = '#' + BIOMES[activeBiome].neonP.getHexString();
  }

  // Boost indicator
  var boostEl = document.getElementById('boost-indicator');
  if (boostEl) {
    if (boostState.active) {
      boostEl.style.opacity = '1';
      boostEl.textContent   = '⚡ BOOST ' + Math.ceil(boostState.timer) + 's';
    } else {
      boostEl.style.opacity = '0';
    }
  }

  // Monster threat indicator
  var threatEl = document.getElementById('monster-threat');
  if (threatEl && transform) {
    var threatened = false;
    if (activeBiome === 'countryside' && spider.state.active) {
      var sDist = spider.group ? spider.group.position.distanceTo(transform.position) : 999;
      if (sDist < 50) {
        threatEl.textContent = '🕷 SPIDER ' + Math.round(sDist) + 'm';
        threatEl.style.opacity = '1';
        threatEl.style.color = '#00ff88';
        threatened = true;
      }
    } else if (activeBiome === 'city' && godzilla.state.active) {
      var gDist = godzilla.group ? godzilla.group.position.distanceTo(transform.position) : 999;
      if (gDist < 60) {
        threatEl.textContent = '🦎 GODZILLA ' + Math.round(gDist) + 'm';
        threatEl.style.opacity = '1';
        threatEl.style.color = '#ff00ff';
        threatened = true;
      }
    } else if (activeBiome === 'beach' && crabs.state.active) {
      threatEl.textContent = '🦀 CRABS ON ROAD';
      threatEl.style.opacity = '1';
      threatEl.style.color = '#ff8800';
      threatened = true;
    }
    if (!threatened) threatEl.style.opacity = '0';
  }

  // Fog / sky
  scene.fog.color.lerp(BIOMES[activeBiome].fogColor, dt * 0.5);
  scene.background.lerp(BIOMES[activeBiome].skyColor, dt * 0.5);

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
