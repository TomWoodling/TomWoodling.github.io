// ═══ GAME ═══
// Main renderer, scene setup, and game loop

// --- Renderer ---
var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

// --- Scene ---
var scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050010, 0.012);
scene.background = new THREE.Color(0x0a0014);

var camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 500);

// --- Lights ---
scene.add(new THREE.AmbientLight(0x111122, 0.3));
var dirLight = new THREE.DirectionalLight(0x4444ff, 0.4);
dirLight.position.set(-5, 10, 5);
scene.add(dirLight);

// --- Add car and sun to scene ---
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

// --- Initialize systems that need scene ---
initChunks();
initCarGLB();

// --- Game State ---
var gameStarted = false;
var speed = 0;
var steer = 0;
var carX = 0;
var distance = 0;
var scrollOff = 0;
var time = 0;
var biomeTransTimer = 0;
var camPos = new THREE.Vector3(0, C.camH, -C.camDist);
var camTgt = new THREE.Vector3(0, 1.2, 15);

// --- Start Game ---
function startGame() {
  var overlay = document.getElementById('title-overlay');
  if (overlay.classList.contains('hidden')) return;

  overlay.classList.add('hidden');
  gameStarted = true;
  audio.init();
  audio.switchTo(activeBiome);
  dbg('Game started!');

  // Retry music start
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

// --- Update title start prompt based on device ---
(function() {
  var prompt = document.getElementById('start-prompt');
  if (prompt) {
    if (InputState.isMobile) {
      prompt.textContent = 'Tap to drive';
    } else {
      prompt.textContent = 'Press any key to drive';
    }
  }
})();

// ═══ GAME LOOP ═══
var clock = new THREE.Clock();

function update() {
  var dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  // --- Pre-game camera orbit ---
  if (!gameStarted) {
    camera.position.set(
      Math.sin(time * 0.3) * 2,
      C.camH + Math.sin(time * 0.5) * 0.3,
      car.position.z - C.camDist
    );
    camera.lookAt(car.position.x, 1.5, car.position.z + 10);

    // Animate shaders
    scene.traverse(function(o) {
      if (o.material && o.material.uniforms) {
        if (o.material.uniforms.time) o.material.uniforms.time.value = time;
        if (o.material.uniforms.scrollOffset) o.material.uniforms.scrollOffset.value = scrollOff * 0.1;
      }
    });

    renderer.render(scene, camera);
    requestAnimationFrame(update);
    return;
  }

  // --- Poll input ---
  pollInput();

  // --- Biome timing ---
  biomeTimer += dt;
  if (biomeTimer >= C.biomeDur) {
    biomeTimer = 0;
    biomeIdx = (biomeIdx + 1) % biomeOrder.length;
    activeBiome = biomeOrder[biomeIdx];
    audio.switchTo(activeBiome);
    showBiomeTransition(activeBiome);
  }
  if (biomeTransTimer > 0) {
    biomeTransTimer -= dt;
    if (biomeTransTimer <= 0) {
      document.getElementById('biome-transition').classList.remove('show');
    }
  }
  audio.update(dt);

  // --- Driving physics ---
  var thr = InputState.throttle;
  var brk = InputState.braking;

  // Acceleration — on mobile, auto-cruise at a fraction of max accel
  if (thr) {
    var accelRate = InputState.isMobile ? C.accel * C.autoAccelRate : C.accel;
    speed = Math.min(speed + accelRate * dt, C.maxSpeed);
  } else if (brk) {
    speed = Math.max(speed - C.brake * dt, 0);
  } else {
    speed = Math.max(speed - C.friction * dt, 0);
  }

  // --- Steering ---
  // Touch: use continuous steerAxis
  // Keyboard: use discrete steerAxis from pollInput
  var targetSteer = InputState.steerAxis * C.maxSteer;

  if (Math.abs(InputState.steerAxis) > 0.01) {
    // Steer toward target
    steer = THREE.MathUtils.lerp(steer, targetSteer, C.steerSpeed * dt * 2);
  } else {
    // Return to center
    if (Math.abs(steer) < 0.05) {
      steer = 0;
    } else {
      steer -= Math.sign(steer) * C.steerReturn * dt;
    }
  }

  // Movement
  var spd = speed / 3.6;  // KPH to m/s
  distance += spd * dt;
  scrollOff += spd * dt;

  carX -= steer * (speed / C.maxSpeed) * 12 * dt;
  carX = THREE.MathUtils.clamp(carX, -C.roadWidth / 2 + 1.2, C.roadWidth / 2 - 1.2);

  car.position.x = carX;
  car.rotation.y = -steer * 0.3;
  car.rotation.z = steer * 0.05;

  // --- Wheel spin ---
  carWheels.forEach(function(w) {
    w.rotation.x += spd * dt * 3;
  });

  // --- Chunk scrolling ---
  chunks.forEach(function(c) { c.position.z -= spd * dt; });
  sun.position.z = -50 + 350;

  chunks.forEach(function(ch, idx) {
    if (ch.position.z < -C.chunkLength * 2) {
      var mx = -Infinity;
      chunks.forEach(function(c) { if (c.position.z > mx) mx = c.position.z; });
      scene.remove(ch);
      totalChunks++;
      var nc = makeChunk(totalChunks, activeBiome);
      nc.position.z = mx + C.chunkLength;
      chunks[idx] = nc;
    }
  });

  // --- Camera ---
  var ip = new THREE.Vector3(
    carX * 0.7,
    C.camH + (speed / C.maxSpeed) * 0.5,
    car.position.z - C.camDist - (speed / C.maxSpeed) * 2
  );
  var it = new THREE.Vector3(
    carX * 0.5,
    1.2,
    car.position.z + 15 + (speed / C.maxSpeed) * 10
  );
  camPos.lerp(ip, C.camSmoothPos * dt);
  camTgt.lerp(it, C.camSmoothLook * dt);
  camera.position.copy(camPos);
  camera.lookAt(camTgt);
  camera.fov = THREE.MathUtils.lerp(camera.fov, 65 + (speed / C.maxSpeed) * 12, dt * 2);
  camera.updateProjectionMatrix();

  // --- HUD ---
  document.getElementById('speed-val').textContent = Math.floor(speed);
  document.getElementById('dist-val').textContent = (distance / 1000).toFixed(1);

  var be = document.getElementById('biome-name');
  var bn = BIOMES[activeBiome].name;
  if (be.textContent !== bn) {
    be.textContent = bn;
    be.style.color = '#' + BIOMES[activeBiome].neonP.getHexString();
  }

  // --- Fog/sky transitions ---
  scene.fog.color.lerp(BIOMES[activeBiome].fogColor, dt * 0.5);
  scene.background.lerp(BIOMES[activeBiome].skyColor, dt * 0.5);

  // --- Shader uniforms ---
  scene.traverse(function(o) {
    if (o.material && o.material.uniforms) {
      if (o.material.uniforms.time) o.material.uniforms.time.value = time;
      if (o.material.uniforms.scrollOffset) o.material.uniforms.scrollOffset.value = scrollOff * 0.1;
    }
  });

  renderer.render(scene, camera);
  requestAnimationFrame(update);
}

update();
dbg('Game loop started');
