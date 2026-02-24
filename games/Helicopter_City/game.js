// game.js — Scene setup, main loop, camera, sky/fog system
// ==========================================================

var _scene, _camera, _renderer;
var _gameTime  = 0;
var _clock     = new THREE.Clock();
var _sun       = null;

// Camera lag state
var _camPos    = new THREE.Vector3();
var _camLookAt = new THREE.Vector3();

// ─── Audio ────────────────────────────────────────────────────────────────────
var _audio = {
  ctx:         null,
  source:      null,
  gainNode:    null,
  buffer:      null,
  loaded:      false,
  started:     false,
  trackPath:   'audio/track1.mp3',
};

function _initAudio() {
  // Must be called from a user gesture — we trigger on first keydown
  if (_audio.started) return;
  _audio.started = true;

  _audio.ctx      = new (window.AudioContext || window.webkitAudioContext)();
  _audio.gainNode = _audio.ctx.createGain();
  _audio.gainNode.gain.value = 0.0;   // start silent, fade in
  _audio.gainNode.connect(_audio.ctx.destination);

  fetch(_audio.trackPath)
    .then(function(r) { return r.arrayBuffer(); })
    .then(function(buf) { return _audio.ctx.decodeAudioData(buf); })
    .then(function(decoded) {
      _audio.buffer = decoded;
      _audio.source = _audio.ctx.createBufferSource();
      _audio.source.buffer = decoded;
      _audio.source.loop   = true;
      _audio.source.connect(_audio.gainNode);
      _audio.source.start(0);
      _audio.loaded = true;
      // Fade in over 3 seconds
      _audio.gainNode.gain.setValueAtTime(0, _audio.ctx.currentTime);
      _audio.gainNode.gain.linearRampToValueAtTime(0.55, _audio.ctx.currentTime + 3.0);
      console.log('[Audio] BGM playing:', _audio.trackPath);
    })
    .catch(function(e) {
      console.warn('[Audio] Could not load track:', e);
    });
}

// One-time audio init on first user gesture
window.addEventListener('keydown', function _audioUnlock() {
  _initAudio();
  window.removeEventListener('keydown', _audioUnlock);
}, { once: true });

// ─── Boot ─────────────────────────────────────────────────────────────────────

function boot() {
  // ── Renderer ──────────────────────────────────────────────────────────────
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

  // ── Scene & fog ───────────────────────────────────────────────────────────
  _scene = new THREE.Scene();
  _scene.background = SKY_BASE.clone();
  _scene.fog        = new THREE.FogExp2(ACTIVE_PALETTE.fogColor.clone(), 0.005);

  // ── Camera ────────────────────────────────────────────────────────────────
  _camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 800);
  _camera.position.set(0, C.HELI_START_HEIGHT + 8, 22);

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
  // Try news helicopter first; fall back to placeholder if not found
  initHelicopter(_scene, 'models/heli_news.glb').then(function() {
    console.log('[Game] Helicopter ready');
  });

  // ── Missions ──────────────────────────────────────────────────────────────
  initMissions(_scene);
  // Kick off a gridlock after 20s to demo traffic
  setTimeout(maybeTriggerGridlock, 20000);

  // ── HUD ───────────────────────────────────────────────────────────────────
  initHud();

  // ── Input ─────────────────────────────────────────────────────────────────
  initInput();

  // Mission accept key
  window.addEventListener('keydown', function(e) {
    if (e.code === 'KeyM') {
      if (acceptMission()) {
        hudShowAlert('Mission accepted!', '#00ffcc');
      }
    }
    // Debug: cycle palette with P
    if (e.code === 'KeyP') _cyclePalette();
  });

  // ── Camera initial position ───────────────────────────────────────────────
  _camPos.copy(_camera.position);
  _camLookAt.copy(heliState.pos);

  // ── Start loop ────────────────────────────────────────────────────────────
  _clock.start();
  _loop();
}

// ─── Main loop ────────────────────────────────────────────────────────────────

function _loop() {
  requestAnimationFrame(_loop);

  var dt = Math.min(_clock.getDelta(), 0.05); // cap at 50ms
  _gameTime += dt;

  // ── Input ─────────────────────────────────────────────────────────────────
  updateInput();

  // ── Helicopter ────────────────────────────────────────────────────────────
  updateHelicopter(dt, InputState);

  // ── Traffic ───────────────────────────────────────────────────────────────
  updateTraffic(dt);

  // ── Missions ──────────────────────────────────────────────────────────────
  updateMissions(dt, heliState.pos);

  // ── City uniforms ─────────────────────────────────────────────────────────
  updateCityUniforms(_gameTime);

  // ── Sky / fog lerp ────────────────────────────────────────────────────────
  _updateSky(dt);

  // ── Sun position ─────────────────────────────────────────────────────────
  if (_sun) {
    // Place sun ahead and high, independent of player direction
    _sun.position.set(
      heliState.pos.x + 120,
      heliState.pos.y + 60,
      heliState.pos.z - 200
    );
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  _updateCamera(dt);

  // ── HUD ───────────────────────────────────────────────────────────────────
  updateHud(dt, heliState.pos, heliState.vel);

  // ── Render ────────────────────────────────────────────────────────────────
  _renderer.render(_scene, _camera);
}

// ─── Camera ───────────────────────────────────────────────────────────────────

function _updateCamera(dt) {
  var hp = heliState.pos;
  var yaw = heliState.yaw;

  // Desired camera position: behind and above the helicopter
  var offset = C.CAM_OFFSET.clone();
  // Rotate offset by helicopter yaw
  var ox = offset.x * Math.cos(yaw) + offset.z * Math.sin(yaw);
  var oz = -offset.x * Math.sin(yaw) + offset.z * Math.cos(yaw);

  var targetPos = new THREE.Vector3(
    hp.x + ox,
    hp.y + offset.y,
    hp.z + oz
  );

  // Lazy follow with lag
  _camPos.lerp(targetPos, C.CAM_LAG * dt * 60);
  _camera.position.copy(_camPos);

  // Look at a point slightly ahead of the helicopter
  var lookTarget = new THREE.Vector3(
    hp.x - Math.sin(yaw) * 5,
    hp.y + 1,
    hp.z - Math.cos(yaw) * 5
  );
  _camLookAt.lerp(lookTarget, C.CAM_ROT_LAG * dt * 60);
  _camera.lookAt(_camLookAt);
}

// ─── Sky / fog ────────────────────────────────────────────────────────────────

var _currentFogColor = new THREE.Color();
var _currentSkyColor = new THREE.Color();
var _skyInit         = false;

function _updateSky(dt) {
  if (!_skyInit) {
    _currentFogColor.copy(ACTIVE_PALETTE.fogColor);
    _currentSkyColor.copy(SKY_BASE);
    _skyInit = true;
  }

  var targetFog = ACTIVE_PALETTE.fogColor.clone().lerp(SKY_BASE, 0.35);
  _currentFogColor.lerp(targetFog, dt * 0.5);
  _scene.fog.color.copy(_currentFogColor);

  var skyTarget = SKY_BASE.clone().lerp(ACTIVE_PALETTE.fogColor, 0.3);
  _currentSkyColor.lerp(skyTarget, dt * 0.5);

  // Brightness lift
  _currentSkyColor.r = Math.min(_currentSkyColor.r * 1.7, 0.35);
  _currentSkyColor.g = Math.min(_currentSkyColor.g * 1.7, 0.25);
  _currentSkyColor.b = Math.min(_currentSkyColor.b * 1.7, 0.55);
  _scene.background.copy(_currentSkyColor);

  // Altitude: thin fog at height (less dense above the city)
  var altFactor = Math.max(0.002, 0.006 - heliState.pos.y * 0.00003);
  _scene.fog.density = altFactor;
}

// ─── Debug: cycle palette ─────────────────────────────────────────────────────

var _paletteIdx = 0;
function _cyclePalette() {
  _paletteIdx = (_paletteIdx + 1) % PALETTES.length;
  ACTIVE_PALETTE = PALETTES[_paletteIdx];
  hudShowAlert('Palette: ' + ACTIVE_PALETTE.id, '#ffcc00');
}

// ─── Start ────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', boot);
