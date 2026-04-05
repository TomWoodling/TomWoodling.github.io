// game.js — Bootstrap, scene, renderer, game loop, camera, HUD

var scene, camera, renderer;
var gameState = 'TITLE'; // TITLE, LOADING, PLAYING, WON, DISTRICT_COMPLETE
var clock;
var foxRimLight;
var foxKeyLight;
var currentDistrictIndex = 0;

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
var camYaw = Math.PI;
var camPitch = 0.3;
var camDist = C.CAM_FOLLOW_DIST;
var camActual = new THREE.Vector3(0, 5, -10);
var camDragging = false;

// --- Init ---

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080614);
  scene.fog = new THREE.Fog(C.FOG_COLOR, C.FOG_NEAR, C.FOG_FAR);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 5, -10);

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

  var hemiLight = new THREE.HemisphereLight(0x6688cc, 0x333344, 0.35);
  scene.add(hemiLight);

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

  foxKeyLight = new THREE.SpotLight(0xffeedd, 1.5, 20, Math.PI / 4, 0.6, 1);
  foxKeyLight.castShadow = false;
  scene.add(foxKeyLight);
  scene.add(foxKeyLight.target);

  createUI();
  setupInput();
  setupMouseInput();

  events.on('foxCaught', function() { foxCaught(); });
  events.on('gameWon', function() { onDistrictComplete(); });
  events.on('foxPushed', function(data) {
    foxPush.active = true;
    foxPush.dir.copy(data.dir);
    foxPush.speed = data.speed;
    foxPush.timer = 0;
    foxPush.duration = data.duration;
  });

  window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  showTitleScreen(true);

  window.addEventListener('keydown', function(e) {
    if (e.code === 'Enter' && gameState === 'TITLE') startGame();
    if (e.code === 'Enter' && gameState === 'DISTRICT_COMPLETE') advanceToNextDistrict();
  });
  document.getElementById('game-canvas').addEventListener('click', function() {
    if (gameState === 'TITLE') startGame();
    if (gameState === 'DISTRICT_COMPLETE') advanceToNextDistrict();
  });

  renderTitle();
}

function renderTitle() {
  if (gameState !== 'TITLE' && gameState !== 'LOADING') return;
  requestAnimationFrame(renderTitle);
  renderer.render(scene, camera);
}

// --- Start / load district ---

function startGame() {
  if (gameState !== 'TITLE') return;
  gameState = 'LOADING';
  showTitleScreen(false);
  currentDistrictIndex = 0;
  loadAndStartDistrict(currentDistrictIndex);
}

function loadAndStartDistrict(districtIndex) {
  clearGameObjects();

  var levelParam = new URLSearchParams(window.location.search).get('level');
  if (levelParam === 'localstorage') {
    var savedLevel = localStorage.getItem('slyberFoxTestLevel');
    if (savedLevel) LevelLoader.fromJSON(savedLevel);
    else WorldGen.loadDistrict(districtIndex);
  } else if (levelParam === 'manual') {
    LevelLoader.loadDefault();
  } else {
    var seedParam = new URLSearchParams(window.location.search).get('seed');
    var seed = seedParam ? parseInt(seedParam) : null;
    WorldGen.loadDistrict(districtIndex, seed);
  }

  // Build the level
  buildCity(scene);
  spawnHens(scene);
  spawnRoosters(scene);
  buildProgression(scene);
  buildTriggers(scene);

  // Spawn Scout the dog NPC (if level data includes dogNPC)
  if (LevelData.dogNPC) {
    spawnScoutDog(scene, LevelData.dogNPC);
  }

  // Set fox spawn
  foxState.position.set(LevelData.playerSpawn.x, 0, LevelData.playerSpawn.z);
  foxState.velocity.set(0, 0, 0);
  foxState.energy = C.ENERGY_MAX;
  foxState.isCaught = false;
  foxState.animState = '';
  foxPush.active = false;

  if (!foxModel) {
    loadFoxModel(scene, function() {
      gameState = 'PLAYING';
      if (!clock) { clock = new THREE.Clock(); gameLoop(); }
      else clock.getDelta();
    });
  } else {
    foxModel.position.copy(foxState.position);
    setFoxAnim('IDLE', 0);
    gameState = 'PLAYING';
    if (!clock) { clock = new THREE.Clock(); gameLoop(); }
    else clock.getDelta();
  }
}

// --- Clear game objects between districts ---

function clearGameObjects() {
  // City meshes + colliders
  for (var i = cityMeshes.length - 1; i >= 0; i--) {
    if (cityMeshes[i].parent) cityMeshes[i].parent.remove(cityMeshes[i]);
  }
  cityMeshes = [];
  colliders = [];

  // Street lights
  for (var i = streetLights.length - 1; i >= 0; i--) {
    if (streetLights[i].parent) streetLights[i].parent.remove(streetLights[i]);
  }
  streetLights = [];

  // HRN houses
  for (var i = henHouseObjects.length - 1; i >= 0; i--) {
    var h = henHouseObjects[i];
    if (h.mesh && h.mesh.parent) h.mesh.parent.remove(h.mesh);
    if (h.glow && h.glow.parent) h.glow.parent.remove(h.glow);
    if (h.ring && h.ring.parent) h.ring.parent.remove(h.ring);
  }
  henHouseObjects = [];
  henHouses = [];

  // Hens
  for (var i = hens.length - 1; i >= 0; i--) {
    if (hens[i].model && hens[i].model.parent) hens[i].model.parent.remove(hens[i].model);
  }
  hens = [];
  totalHensCollected = 0;

  // Roosters
  for (var i = roosters.length - 1; i >= 0; i--) {
    if (roosters[i].model && roosters[i].model.parent) roosters[i].model.parent.remove(roosters[i].model);
    if (roosters[i].zoneDisc && roosters[i].zoneDisc.parent) roosters[i].zoneDisc.parent.remove(roosters[i].zoneDisc);
    if (roosters[i].zoneRing && roosters[i].zoneRing.parent) roosters[i].zoneRing.parent.remove(roosters[i].zoneRing);
  }
  roosters = [];

  // Sneak points
  for (var i = sneakPoints.length - 1; i >= 0; i--) {
    var sp = sneakPoints[i];
    if (sp.barrierMesh && sp.barrierMesh.parent) sp.barrierMesh.parent.remove(sp.barrierMesh);
    if (sp.label && sp.label.parent) sp.label.parent.remove(sp.label);
    if (sp.glowLight && sp.glowLight.parent) sp.glowLight.parent.remove(sp.glowLight);
  }
  sneakPoints = [];

  // Howl points
  for (var i = howlPoints.length - 1; i >= 0; i--) {
    if (howlPoints[i].model && howlPoints[i].model.parent) howlPoints[i].model.parent.remove(howlPoints[i].model);
  }
  howlPoints = [];

  // Distractions
  for (var i = distractObjects.length - 1; i >= 0; i--) {
    if (distractObjects[i].mesh && distractObjects[i].mesh.parent) distractObjects[i].mesh.parent.remove(distractObjects[i].mesh);
  }
  distractObjects = [];

  // Scout dog NPC
  despawnScoutDog();

  // Triggers + VFX + NPC list
  triggers = [];
  triggeredSet = {};
  activeVFX = [];
  npcFoxes = [];
}

// --- District completion ---

function onDistrictComplete() {
  var district = WorldGen.getDistrict(currentDistrictIndex);
  if (!district) { gameState = 'WON'; showGameOver(); return; }

  if (district.dogComplete && DIALOGUES[district.dogComplete]) {
    DialogueSystem.startConversation(district.dogComplete);
  }

  if (currentDistrictIndex + 1 >= WorldGen.getDistrictCount()) {
    setTimeout(function() { gameState = 'WON'; showGameOver(); }, 3000);
  } else {
    gameState = 'DISTRICT_COMPLETE';
    showDistrictComplete(district.name);
  }
}

function advanceToNextDistrict() {
  if (gameState !== 'DISTRICT_COMPLETE') return;
  hideDistrictComplete();
  currentDistrictIndex++;
  gameState = 'LOADING';
  loadAndStartDistrict(currentDistrictIndex);
}

// --- Mouse input ---

function setupMouseInput() {
  var canvas = document.getElementById('game-canvas');

  canvas.addEventListener('mousedown', function(e) {
    if (e.button === 0 || e.button === 2) camDragging = true;
  });
  window.addEventListener('mouseup', function() { camDragging = false; });
  window.addEventListener('mousemove', function(e) {
    if (camDragging && gameState === 'PLAYING') camYaw -= e.movementX * 0.005;
  });
  canvas.addEventListener('wheel', function(e) {
    camDist += e.deltaY * 0.01;
    camDist = Math.max(3, Math.min(12, camDist));
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });
}

// --- Camera ---

function updateCamera(dt) {
  if (C.CAM_AUTO_ALIGN && foxState.velocity.lengthSq() > 1.0) {
    var behindAngle = foxState.rotation + Math.PI;
    camYaw = lerpAngle(camYaw, behindAngle, 1.5 * dt);
  }
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

  if (gameState === 'PLAYING' || gameState === 'DISTRICT_COMPLETE') {
    updateFox(dt);
    updateAllHens(dt);
    updateAllRoosters(dt);
    updateScoutDog(dt);
    updateProgression(dt);
    updateTriggers(foxState.position);
    updateCity(dt);
    updateCamera(dt);
    DialogueSystem.update();
    updateUI(foxState);

    if (foxRimLight) {
      foxRimLight.position.set(foxState.position.x, foxState.position.y + 2, foxState.position.z);
    }
    if (foxKeyLight) {
      foxKeyLight.position.set(foxState.position.x, foxState.position.y + 5, foxState.position.z);
      foxKeyLight.target.position.copy(foxState.position);
    }
  }

  renderer.render(scene, camera);
}

// --- Start ---
window.addEventListener('DOMContentLoaded', init);
