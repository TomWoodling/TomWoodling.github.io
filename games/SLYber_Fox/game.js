// game.js — Bootstrap, scene, renderer, game loop, camera, HUD

var scene, camera, renderer;
var gameState = 'TITLE'; // TITLE, LOADING, PLAYING, WON
var clock;
var foxRimLight;
var foxKeyLight;

// --- Simple event system ---
var events = {
  _listeners: {},
  on: function(name, fn) {
    if (!this._listeners[name]) this._listeners[name] = [];
    this._listeners[name].push(fn);
  },
  emit: function(name, data) {
    var fns = this._listeners[name] || [];
    for (var i = 0; i < fns.length; i++) fns[i](data);
  },
};

// --- Camera state ---
var camYaw = Math.PI;  // Start behind the fox
var camPitch = 0.3;
var camDist = C.CAM_FOLLOW_DIST;
var camActual = new THREE.Vector3(0, 5, -10);
var camDragging = false;

// No longer needed — input direction derived from camera.quaternion directly

// --- Init ---

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080614);
  scene.fog = new THREE.Fog(C.FOG_COLOR, C.FOG_NEAR, C.FOG_FAR);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 5, -10);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('game-canvas') });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Lighting
  var ambient = new THREE.AmbientLight(0x1a1035, 0.7);
  scene.add(ambient);

  var moonLight = new THREE.DirectionalLight(0xaaccff, 0.4);
  moonLight.position.set(-20, 50, 30);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 2048;
  moonLight.shadow.mapSize.height = 2048;
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 120;
  moonLight.shadow.camera.left = -60;
  moonLight.shadow.camera.right = 60;
  moonLight.shadow.camera.top = 60;
  moonLight.shadow.camera.bottom = -60;
  scene.add(moonLight);

  foxRimLight = new THREE.PointLight(0x3355ff, 0.8, 6);
  scene.add(foxRimLight);

  // Warm diffuse spotlight that follows the fox for better visibility
  foxKeyLight = new THREE.SpotLight(0xffeedd, 1.5, 20, Math.PI / 4, 0.6, 1);
  foxKeyLight.castShadow = false;
  scene.add(foxKeyLight);
  scene.add(foxKeyLight.target);

  // Load level data
  var levelParam = new URLSearchParams(window.location.search).get('level');
  if (levelParam === 'localstorage') {
    var savedLevel = localStorage.getItem('slyberFoxTestLevel');
    if (savedLevel) {
      LevelLoader.fromJSON(savedLevel);
    } else {
      LevelLoader.loadDefault();
    }
  } else if (levelParam) {
    // Will be loaded async before startGame if needed
    LevelLoader.loadDefault(); // fallback
  } else {
    LevelLoader.loadDefault();
  }

  // Build city
  buildCity(scene);

  // Create UI
  createUI();

  // Setup input
  setupInput();
  setupMouseInput();

  // Setup events
  events.on('foxCaught', function() {
    foxCaught();
  });
  events.on('gameWon', function() {
    gameState = 'WON';
    showGameOver();
  });

  // Resize handler
  window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Start title screen
  showTitleScreen(true);

  // Start button handler
  function startGame() {
    if (gameState !== 'TITLE') return;
    gameState = 'LOADING';
    showTitleScreen(false);

    // Spawn orbs and build triggers
    spawnOrbs(scene);
    buildTriggers(scene);

    // Setup dog spawn/despawn events
    setupDogEvents();

    // Set fox spawn position from level data
    foxState.position.set(LevelData.playerSpawn.x, 0, LevelData.playerSpawn.z);

    var loaded = 0;
    var needed = 2;
    function onModelLoaded() {
      loaded++;
      if (loaded >= needed) {
        gameState = 'PLAYING';
        clock = new THREE.Clock();
        gameLoop();
      }
    }

    loadFoxModel(scene, onModelLoaded);
    loadDogModel(scene, onModelLoaded);
  }

  window.addEventListener('keydown', function(e) {
    if (e.code === 'Enter' && gameState === 'TITLE') startGame();
  });
  document.getElementById('game-canvas').addEventListener('click', function() {
    if (gameState === 'TITLE') startGame();
  });

  // Render title screen
  renderTitle();
}

function renderTitle() {
  if (gameState !== 'TITLE' && gameState !== 'LOADING') return;
  requestAnimationFrame(renderTitle);
  renderer.render(scene, camera);
}

// --- Mouse input for camera ---

function setupMouseInput() {
  var canvas = document.getElementById('game-canvas');

  canvas.addEventListener('mousedown', function(e) {
    if (e.button === 0 || e.button === 2) {
      camDragging = true;
    }
  });

  window.addEventListener('mouseup', function() {
    camDragging = false;
  });

  window.addEventListener('mousemove', function(e) {
    if (camDragging && gameState === 'PLAYING') {
      camYaw -= e.movementX * 0.005;
    }
  });

  canvas.addEventListener('wheel', function(e) {
    camDist += e.deltaY * 0.01;
    camDist = Math.max(3, Math.min(12, camDist));
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });
}

// --- Camera update ---

function updateCamera(dt) {
  // Standard third-person orbit camera:
  // camYaw orbits around the player (mouse drag), auto-aligns behind when moving
  if (C.CAM_AUTO_ALIGN && foxState.velocity.lengthSq() > 1.0) {
    // Slowly align camera behind the fox's facing direction
    var behindAngle = foxState.rotation + Math.PI;
    camYaw = lerpAngle(camYaw, behindAngle, 1.5 * dt);
  }

  // Camera orbits at camYaw angle, camDist away, camHeight above
  var desiredPos = new THREE.Vector3(
    foxState.position.x + Math.sin(camYaw) * camDist,
    foxState.position.y + C.CAM_FOLLOW_HEIGHT,
    foxState.position.z + Math.cos(camYaw) * camDist
  );

  camActual.lerp(desiredPos, Math.min(C.CAM_LERP_POS * dt, 1));
  camera.position.copy(camActual);
  camera.lookAt(foxState.position.x, foxState.position.y + 1.0, foxState.position.z);
}

// --- Game Loop ---

function gameLoop() {
  requestAnimationFrame(gameLoop);
  var dt = Math.min(clock.getDelta(), 0.05);

  if (gameState === 'PLAYING') {
    updateFox(dt);
    var orbDetection = updateAllOrbs(dt);
    updateDetection(dt, orbDetection);
    updateTriggers(foxState.position);
    updateAllDogs(dt);
    updateCity(dt);
    updateCamera(dt);
    DialogueSystem.update();
    updateUI(foxState);

    // Update fox follow lights
    if (foxRimLight) {
      foxRimLight.position.set(
        foxState.position.x,
        foxState.position.y + 2,
        foxState.position.z
      );
    }
    if (foxKeyLight) {
      foxKeyLight.position.set(
        foxState.position.x,
        foxState.position.y + 5,
        foxState.position.z
      );
      foxKeyLight.target.position.copy(foxState.position);
    }
  }

  renderer.render(scene, camera);
}

// --- Start ---
window.addEventListener('DOMContentLoaded', init);
