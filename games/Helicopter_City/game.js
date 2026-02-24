// game.js — Scene setup, main loop, camera, sky/fog
// ===================================================

var _scene, _camera, _renderer;
var _gameTime = 0;
var _clock    = new THREE.Clock();
var _sun      = null;

// Camera state — see coordinate contract in helicopter.js for derivation
var _camPos       = new THREE.Vector3();
var _camLookAt    = new THREE.Vector3();
var _camReady     = false;   // snaps instantly on first frame, lags after

// =============================================================================
// Audio
// =============================================================================

var _audio = {
  ctx:       null,
  source:    null,
  gainNode:  null,
  started:   false,
  trackPath: 'audio/track1.mp3',
};

function _initAudio() {
  if (_audio.started) return;
  _audio.started = true;

  _audio.ctx      = new (window.AudioContext || window.webkitAudioContext)();
  _audio.gainNode = _audio.ctx.createGain();
  _audio.gainNode.gain.value = 0;
  _audio.gainNode.connect(_audio.ctx.destination);

  fetch(_audio.trackPath)
    .then(function(r)   { return r.arrayBuffer(); })
    .then(function(buf) { return _audio.ctx.decodeAudioData(buf); })
    .then(function(decoded) {
      _audio.source        = _audio.ctx.createBufferSource();
      _audio.source.buffer = decoded;
      _audio.source.loop   = true;
      _audio.source.connect(_audio.gainNode);
      _audio.source.start(0);
      _audio.gainNode.gain.setValueAtTime(0, _audio.ctx.currentTime);
      _audio.gainNode.gain.linearRampToValueAtTime(0.55, _audio.ctx.currentTime + 3.0);
      console.log('[Audio] Playing:', _audio.trackPath);
    })
    .catch(function(e) { console.warn('[Audio] Load failed:', e); });
}

// First keypress unlocks audio context (browser autoplay policy)
window.addEventListener('keydown', _initAudio, { once: true });

// =============================================================================
// Boot
// =============================================================================

function boot() {

  // ── Renderer ────────────────────────────────────────────────────────────
  _renderer = new THREE.WebGLRenderer({ antialias: true });
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.setSize(window.innerWidth, window.innerHeight);
  _renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  _renderer.toneMappingExposure = 1.25;
  document.getElementById('canvas-container').appendChild(_renderer.domElement);

  window.addEventListener('resize', function() {
    _camera.aspect = window.innerWidth / window.innerHeight;
    _camera.updateProjectionMatrix();
    _renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Scene ────────────────────────────────────────────────────────────────
  _scene = new THREE.Scene();
  _scene.background = SKY_BASE.clone();
  _scene.fog        = new THREE.FogExp2(ACTIVE_PALETTE.fogColor.clone(), 0.005);

  // ── Camera ────────────────────────────────────────────────────────────────
  _camera = new THREE.PerspectiveCamera(
    65, window.innerWidth / window.innerHeight, 0.5, 800);
  // Initial position set on first _updateCamera call via _camReady flag

  // ── Lights ────────────────────────────────────────────────────────────────
  _scene.add(new THREE.AmbientLight(0x221133, 0.9));
  var key = new THREE.DirectionalLight(0xffccaa, 0.8);
  key.position.set(-8, 18, 5);
  _scene.add(key);
  var fill = new THREE.DirectionalLight(0x4466ff, 0.45);
  fill.position.set(10, 6, -5);
  _scene.add(fill);

  // ── Sky decorations ───────────────────────────────────────────────────────
  makeStars(_scene);
  _sun = makeSun(_scene);

  // ── City ──────────────────────────────────────────────────────────────────
  initCity(_scene, ACTIVE_PALETTE);

  // ── Traffic ───────────────────────────────────────────────────────────────
  initTraffic(_scene);

  // ── Helicopter ────────────────────────────────────────────────────────────
  initHelicopter(_scene, 'models/heli_news.glb').then(function() {
    console.log('[Game] Helicopter ready');
  });

  // ── Missions ──────────────────────────────────────────────────────────────
  initMissions(_scene);
  setTimeout(maybeTriggerGridlock, 20000);

  // ── HUD ───────────────────────────────────────────────────────────────────
  initHud();

  // ── Input ─────────────────────────────────────────────────────────────────
  initInput();

  window.addEventListener('keydown', function(e) {
    if (e.code === 'KeyM' && acceptMission()) hudShowAlert('Mission accepted!', '#00ffcc');
    if (e.code === 'KeyP') _cyclePalette();
  });

  _clock.start();
  _loop();
}

// =============================================================================
// Main loop
// =============================================================================

function _loop() {
  requestAnimationFrame(_loop);

  var dt = Math.min(_clock.getDelta(), 0.05);
  _gameTime += dt;

  updateInput();
  updateHelicopter(dt, InputState);
  updateTraffic(dt);
  updateMissions(dt, heliState.pos);
  updateCityUniforms(_gameTime);
  _updateSky(dt);
  _updateSun();
  _updateCamera(dt);
  updateHud(dt, heliState.pos, heliState.vel);

  _renderer.render(_scene, _camera);
}

// =============================================================================
// Camera
// =============================================================================
//
// Nose faces -Z (world space, at yaw=0).  Tail = +Z.
// Camera sits behind (tail side = +Z) and above.
//
//   targetPos  = heliPos + rotateY(yaw) * (0, CAM_UP, CAM_BACK)
//              = heliPos + (sin(yaw)*BACK, UP, cos(yaw)*BACK)
//
//   lookTarget = heliPos + rotateY(yaw) * (0, 0, -CAM_LOOK_AHEAD)
//              = heliPos + (-sin(yaw)*AHEAD, 0, -cos(yaw)*AHEAD)

function _updateCamera(dt) {
  var hp   = heliState.pos;
  var yaw  = heliState.yaw;
  var sinY = Math.sin(yaw);
  var cosY = Math.cos(yaw);

  var targetPos = new THREE.Vector3(
    hp.x + sinY * C.CAM_BACK,
    hp.y + C.CAM_UP,
    hp.z + cosY * C.CAM_BACK
  );

  var lookTarget = new THREE.Vector3(
    hp.x - sinY * C.CAM_LOOK_AHEAD,
    hp.y,
    hp.z - cosY * C.CAM_LOOK_AHEAD
  );

  if (!_camReady) {
    // Snap on first frame — no lag until we know the camera is in the right place
    _camPos.copy(targetPos);
    _camLookAt.copy(lookTarget);
    _camReady = true;
  } else {
    _camPos.lerp(targetPos,    C.CAM_LAG     * dt * 60);
    _camLookAt.lerp(lookTarget, C.CAM_ROT_LAG * dt * 60);
  }

  _camera.position.copy(_camPos);
  _camera.lookAt(_camLookAt);
}

// =============================================================================
// Sky / fog
// =============================================================================

var _fogColor = new THREE.Color();
var _skyColor = new THREE.Color();
var _skyReady = false;

function _updateSky(dt) {
  if (!_skyReady) {
    _fogColor.copy(ACTIVE_PALETTE.fogColor);
    _skyColor.copy(SKY_BASE);
    _skyReady = true;
  }

  var targetFog = ACTIVE_PALETTE.fogColor.clone().lerp(SKY_BASE, 0.35);
  _fogColor.lerp(targetFog, dt * 0.5);
  _scene.fog.color.copy(_fogColor);

  var targetSky = SKY_BASE.clone().lerp(ACTIVE_PALETTE.fogColor, 0.3);
  _skyColor.lerp(targetSky, dt * 0.5);
  // Brightness lift — prevents sky looking identical to fog
  _skyColor.r = Math.min(_skyColor.r * 1.7, 0.35);
  _skyColor.g = Math.min(_skyColor.g * 1.7, 0.25);
  _skyColor.b = Math.min(_skyColor.b * 1.7, 0.55);
  _scene.background.copy(_skyColor);

  // Fog thins at altitude
  _scene.fog.density = Math.max(0.002, 0.006 - heliState.pos.y * 0.00003);
}

function _updateSun() {
  if (_sun) {
    _sun.position.set(
      heliState.pos.x + 120,
      heliState.pos.y + 60,
      heliState.pos.z - 200
    );
  }
}

// =============================================================================
// Debug
// =============================================================================

var _paletteIdx = 0;
function _cyclePalette() {
  _paletteIdx     = (_paletteIdx + 1) % PALETTES.length;
  ACTIVE_PALETTE  = PALETTES[_paletteIdx];
  hudShowAlert('Palette: ' + ACTIVE_PALETTE.id, '#ffcc00');
}

// =============================================================================
// Start
// =============================================================================

window.addEventListener('DOMContentLoaded', boot);
