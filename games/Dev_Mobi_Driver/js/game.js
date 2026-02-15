// ═══ GAME ═══
// Main renderer, scene setup, game loop with spline roads

// --- Renderer ---
var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

// --- Scene ---
var scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050010, 0.008);
scene.background = new THREE.Color(0x0a0014);

var camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 500);

// --- Lights ---
scene.add(new THREE.AmbientLight(0x111122, 0.3));
var dirLight = new THREE.DirectionalLight(0x4444ff, 0.4);
dirLight.position.set(-5, 10, 5);
scene.add(dirLight);

// --- Add car and sun ---
scene.add(car);
var sun = makeSun();
scene.add(sun);

// --- Stars ---
(function() {
  var geo = new THREE.BufferGeometry();
  var p = new Float32Array(6000);
  for (var i = 0; i < 2000; i++) {
    p[i * 3]     = (Math.random() - 0.5) * 600;
    p[i * 3 + 1] = 20 + Math.random() * 100;
    p[i * 3 + 2] = (Math.random() - 0.5) * 600;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.3, transparent: true, opacity: 0.6
  })));
})();

// --- Initialize systems ---
initRoad();
initCarGLB();

// --- Game State ---
var gameStarted = false;
var speed = 0;
var steer = 0;
var time = 0;
var biomeTransTimer = 0;
var camPos = new THREE.Vector3(0, C.camH, -C.camDist);
var camTgt = new THREE.Vector3(0, 1.2, 15);

// --- Boost State ---
var boostState = {
  active:    false,
  timer:     0,
  origSpeed: 0,
};

function activateBoost() {
  boostState.active = true;
  boostState.timer = C.boostDuration;
  boostState.origSpeed = speed;
}

// --- Cutscene State ---
var cutscene = {
  active:   false,
  timer:    0,
  duration: C.cutsceneDuration,
  biome:    null,
  orbitAngle: 0,
};

function startCutscene(biomeKey) {
  cutscene.active = true;
  cutscene.timer = cutscene.duration;
  cutscene.biome = biomeKey;
  cutscene.orbitAngle = 0;
  dbg('Cutscene: entering ' + BIOMES[biomeKey].name);
}

// --- Start Game ---
function startGame() {
  var overlay = document.getElementById('title-overlay');
  if (overlay.classList.contains('hidden')) return;

  overlay.classList.add('hidden');
  gameStarted = true;
  audio.init();
  audio.switchTo(activeBiome);
  dbg('Game started!');

  var retryCount = 0;
  var retryInterval = setInterval(function() {
    retryCount++;
    if (audio.retryPlay(activeBiome)) {
      clearInterval(retryInterval);
      dbg('Music started: ' + activeBiome);
    } else if (retryCount > 20) {
      clearInterval(retryInterval);
      dbg('Music load timeout', 'warn');
    }
  }, 250);
}

function showBiomeTransition(bk) {
  var el = document.getElementById('biome-transition');
  var b = BIOMES[bk];
  el.textContent = b.name;
  el.style.color = '#' + b.neonP.getHexString();
  el.classList.add('show');
  biomeTransTimer = 2.5;
}

// --- Resize ---
window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Update start prompt ---
(function() {
  var prompt = document.getElementById('start-prompt');
  if (prompt) {
    prompt.textContent = InputState.isMobile ? 'Tap to drive' : 'Press any key to drive';
  }
})();

// ═══ GAME LOOP ═══
var clock = new THREE.Clock();

function update() {
  var dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  // --- Pre-game camera orbit ---
  if (!gameStarted) {
    // Position car at start of road for title screen
    var titleTransform = getCarWorldTransform();
    if (titleTransform) {
      car.position.copy(titleTransform.position);
      car.rotation.y = titleTransform.angle;
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

  // --- Poll input ---
  pollInput();

  // --- Biome transition timer ---
  if (biomeTransTimer > 0) {
    biomeTransTimer -= dt;
    if (biomeTransTimer <= 0) {
      document.getElementById('biome-transition').classList.remove('show');
    }
  }
  audio.update(dt);

  // --- Boost ---
  if (boostState.active) {
    boostState.timer -= dt;
    if (boostState.timer <= 0) {
      boostState.active = false;
    }
  }

  // --- Driving physics ---
  var thr = InputState.throttle;
  var brk = InputState.braking;
  var effectiveMaxSpeed = boostState.active ? C.boostSpeed : C.maxSpeed;

  if (thr) {
    var accelRate = InputState.isMobile ? C.accel * C.autoAccelRate : C.accel;
    speed = Math.min(speed + accelRate * dt, effectiveMaxSpeed);
  } else if (brk) {
    speed = Math.max(speed - C.brake * dt, 0);
  } else {
    speed = Math.max(speed - C.friction * dt, 0);
  }

  // Boost force
  if (boostState.active && speed < C.boostSpeed) {
    speed = Math.min(speed + C.accel * 2 * dt, C.boostSpeed);
  }

  // --- Steering ---
  var targetSteer = InputState.steerAxis * C.maxSteer;
  if (Math.abs(InputState.steerAxis) > 0.01) {
    steer = THREE.MathUtils.lerp(steer, targetSteer, C.steerSpeed * dt * 2);
  } else {
    if (Math.abs(steer) < 0.05) steer = 0;
    else steer -= Math.sign(steer) * C.steerReturn * dt;
  }

  // --- Cutscene auto-drive ---
  if (cutscene.active) {
    cutscene.timer -= dt;
    cutscene.orbitAngle += dt * C.cutsceneCamOrbit / cutscene.duration;

    // Auto-drive during cutscene
    steer = 0;
    speed = THREE.MathUtils.lerp(speed, C.maxSpeed * 0.6, dt * 2);

    if (cutscene.timer <= 0) {
      cutscene.active = false;
      dbg('Cutscene ended');
    }
  }

  // --- Update road (moves car along spline, handles junctions) ---
  var transform = updateRoad(dt, speed, steer);

  if (transform) {
    // Position car on road
    car.position.copy(transform.position);
    car.rotation.y = transform.angle - steer * 0.3;
    car.rotation.z = steer * 0.05;

    // Wheel spin
    var spd = speed / 3.6;
    carWheels.forEach(function(w) {
      w.rotation.x += spd * dt * 3;
    });

    // --- Camera ---
    var boostCamExtra = boostState.active ? C.boostCamExtra * (boostState.timer / C.boostDuration) : 0;

    if (cutscene.active) {
      // Cutscene camera: zoom out, orbit, pan
      var progress = 1 - cutscene.timer / cutscene.duration;
      // Smooth ease-in-out
      var ease = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      var cHeight = THREE.MathUtils.lerp(C.camH, C.cutsceneCamHeight, Math.sin(ease * Math.PI));
      var cDist   = THREE.MathUtils.lerp(C.camDist, C.cutsceneCamDist, Math.sin(ease * Math.PI));

      var orbitX = Math.sin(cutscene.orbitAngle * Math.PI * 2) * cDist * 0.4;
      var orbitZ = Math.cos(cutscene.orbitAngle * Math.PI * 2) * cDist;

      var ip = new THREE.Vector3(
        transform.position.x + orbitX,
        cHeight,
        transform.position.z - orbitZ
      );

      var lookAhead = getRoadLookAhead(20);
      var it = new THREE.Vector3(
        (transform.position.x + lookAhead.x) * 0.5,
        1.2,
        (transform.position.z + lookAhead.z) * 0.5
      );

      camPos.lerp(ip, C.camSmoothPos * dt * 0.8);
      camTgt.lerp(it, C.camSmoothLook * dt * 0.8);
    } else {
      // Normal camera: follow behind car along road tangent
      var lookAhead = getRoadLookAhead(15 + (speed / C.maxSpeed) * 10);
      var camDist = C.camDist + (speed / C.maxSpeed) * 2 + boostCamExtra;

      var ip = new THREE.Vector3(
        transform.position.x - transform.tangent.x * camDist + transform.right.x * roadState.lateral * 0.3,
        C.camH + (speed / C.maxSpeed) * 0.5,
        transform.position.z - transform.tangent.z * camDist + transform.right.z * roadState.lateral * 0.3
      );
      var it = new THREE.Vector3(
        lookAhead.x + roadState.lateral * transform.right.x * 0.3,
        1.2,
        lookAhead.z + roadState.lateral * transform.right.z * 0.3
      );

      camPos.lerp(ip, C.camSmoothPos * dt);
      camTgt.lerp(it, C.camSmoothLook * dt);
    }

    camera.position.copy(camPos);
    camera.lookAt(camTgt);

    // FOV
    var targetFov = C.camFovBase + (speed / C.maxSpeed) * C.camFovSpeed;
    if (boostState.active) targetFov += C.boostFovExtra * (boostState.timer / C.boostDuration);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, dt * 2);
    camera.updateProjectionMatrix();

    // Sun follows the general road direction far ahead
    sun.position.copy(transform.position);
    sun.position.y = 15;
    sun.position.addScaledVector(transform.tangent, 350);
    sun.lookAt(camera.position);
  }

  // --- HUD ---
  document.getElementById('speed-val').textContent = Math.floor(speed);
  document.getElementById('dist-val').textContent = (roadState.totalDist / 1000).toFixed(1);

  var be = document.getElementById('biome-name');
  var bn = BIOMES[activeBiome].name;
  if (be.textContent !== bn) {
    be.textContent = bn;
    be.style.color = '#' + BIOMES[activeBiome].neonP.getHexString();
  }

  // Boost indicator
  var boostEl = document.getElementById('boost-indicator');
  if (boostEl) {
    if (boostState.active) {
      boostEl.style.opacity = '1';
      boostEl.textContent = 'BOOST ' + Math.ceil(boostState.timer) + 's';
    } else {
      boostEl.style.opacity = '0';
    }
  }

  // Junction hint
  var juncEl = document.getElementById('junction-hint');
  if (juncEl) {
    if (junction.active) {
      var biomes = getJunctionBiomes();
      juncEl.style.opacity = '1';
      var choiceText = junction.choice === 'left' ? '◄ ' + BIOMES[biomes.left].name
                     : junction.choice === 'right' ? BIOMES[biomes.right].name + ' ►'
                     : '▲ STRAIGHT';
      juncEl.textContent = choiceText;
      juncEl.style.color = '#' + BIOMES[biomes[junction.choice]].neonP.getHexString();
    } else {
      juncEl.style.opacity = '0';
    }
  }

  // --- Fog/sky transitions ---
  scene.fog.color.lerp(BIOMES[activeBiome].fogColor, dt * 0.5);
  scene.background.lerp(BIOMES[activeBiome].skyColor, dt * 0.5);

  // --- Shader uniforms ---
  updateShaderTime(time);

  renderer.render(scene, camera);
  requestAnimationFrame(update);
}

function updateShaderTime(t) {
  scene.traverse(function(o) {
    if (o.material && o.material.uniforms) {
      if (o.material.uniforms.time) o.material.uniforms.time.value = t;
    }
  });
}

update();
dbg('Game loop started');
