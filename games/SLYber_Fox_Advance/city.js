// city.js — Maze geometry, fences, HRN houses, interactable objects, collision

var colliders = [];
var distractObjects = [];
var cityMeshes = [];
var streetLights = [];
var henHouseObjects = [];

// --- Geometry helpers ---

function makeBlock(w, h, d, x, z, color) {
  var geo = new THREE.BoxGeometry(w, h, d);
  var mat = new THREE.MeshStandardMaterial({
    color: color || 0x111122,
    roughness: 0.9,
    metalness: 0.1,
  });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addBuilding(scene, w, h, d, x, z, color) {
  var mesh = makeBlock(w, h, d, x, z, color);
  scene.add(mesh);
  cityMeshes.push(mesh);

  var box = new THREE.Box3().setFromObject(mesh);
  colliders.push(box);

  addNeonEdges(scene, mesh, w, h, d, x, z);
  return mesh;
}

function addNeonEdges(scene, mesh) {
  var neonColors = [0x00ffcc, 0xff00aa, 0x3355ff, 0xffaa00, 0x00ff66];
  var color = neonColors[Math.floor(Math.random() * neonColors.length)];
  var edges = new THREE.EdgesGeometry(mesh.geometry);
  var lineMat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.4 });
  var line = new THREE.LineSegments(edges, lineMat);
  line.position.copy(mesh.position);
  scene.add(line);
}

// --- Ground plane ---

function createGround(scene) {
  var groundGeo = new THREE.PlaneGeometry(300, 300);
  var groundMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a18,
    roughness: 0.95,
    metalness: 0.05,
  });
  var ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

// --- Fence segments (maze walls) ---

function addFenceSegment(scene, x1, z1, x2, z2) {
  var dx = x2 - x1;
  var dz = z2 - z1;
  var length = Math.sqrt(dx * dx + dz * dz);
  var angle = Math.atan2(dx, dz);
  var cx = (x1 + x2) / 2;
  var cz = (z1 + z2) / 2;
  var h = C.FENCE_HEIGHT;
  var t = C.FENCE_THICKNESS;

  // Main fence body
  var geo = new THREE.BoxGeometry(t, h, length);
  var mat = new THREE.MeshStandardMaterial({
    color: C.FENCE_COLOR,
    roughness: 0.8,
    metalness: 0.2,
  });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, h / 2, cz);
  mesh.rotation.y = angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  cityMeshes.push(mesh);

  // Neon trim on top edge
  var trimGeo = new THREE.BoxGeometry(t + 0.1, 0.08, length);
  var trimColors = [0x00ffcc, 0xff00aa, 0x3355ff];
  var trimMat = new THREE.MeshBasicMaterial({
    color: trimColors[Math.floor(Math.random() * trimColors.length)],
    transparent: true,
    opacity: 0.5,
  });
  var trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.set(cx, h, cz);
  trim.rotation.y = angle;
  scene.add(trim);

  // Collider — we need to compute the AABB in world space
  // For axis-aligned fences this is straightforward
  // For angled fences we oversample the box
  var box = new THREE.Box3().setFromObject(mesh);
  colliders.push(box);
}

// --- Street lights ---

function addStreetLight(scene, x, z) {
  var pole = makeBlock(0.3, 5, 0.3, x, z, 0x333344);
  scene.add(pole);

  var light = new THREE.PointLight(0xffaa44, 1.5, 18);
  light.position.set(x, 5.5, z);
  light.castShadow = false;
  scene.add(light);

  var bulbGeo = new THREE.SphereGeometry(0.2, 8, 8);
  var bulbMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
  var bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(x, 5.5, z);
  scene.add(bulb);

  streetLights.push(light);
}

// --- HRN Houses (objective buildings, previously HEN houses) ---

var henHouses = [];  // kept as henHouses for compat with fox.js activateHENHouse

function makeHENHouse(scene, config) {
  var mesh = makeBlock(6, 8, 6, config.position.x, config.position.z, 0x002211);
  scene.add(mesh);
  cityMeshes.push(mesh);

  var box = new THREE.Box3().setFromObject(mesh);
  colliders.push(box);

  var glow = new THREE.PointLight(C.HRN_GLOW_COLOR, config.locked ? 0.2 : 2.0, 15);
  glow.position.set(config.position.x, 5, config.position.z);
  scene.add(glow);

  var ringGeo = new THREE.RingGeometry(3.5, 4, 32);
  var ringMat = new THREE.MeshBasicMaterial({
    color: C.HRN_GLOW_COLOR,
    transparent: true,
    opacity: config.locked ? 0.1 : 0.5,
    side: THREE.DoubleSide,
  });
  var ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(config.position.x, 0.05, config.position.z);
  scene.add(ring);

  var henObj = { mesh: mesh, glow: glow, ring: ring, config: config };
  henHouseObjects.push(henObj);
  return henObj;
}

// --- Distraction objects ---

function addDistractionObject(scene, x, z, type) {
  var color = type === 'bin' ? 0x334455 : type === 'panel' ? 0x225544 : 0x443322;
  var h = type === 'bin' ? 1.2 : 1.0;
  var mesh = makeBlock(1, h, 1, x, z, color);
  scene.add(mesh);

  var obj = {
    position: new THREE.Vector3(x, 0, z),
    type: type,
    active: false,
    timer: 0,
    mesh: mesh,
  };
  distractObjects.push(obj);
  return obj;
}

function triggerDistraction(obj) {
  obj.active = true;
  obj.timer = C.DISTRACT_DURATION;
  spawnDistractVFX(obj.position);
}

function spawnDistractVFX(position) {
  var particleCount = 20;
  var geo = new THREE.BufferGeometry();
  var positions = new Float32Array(particleCount * 3);
  var velocities = [];
  for (var i = 0; i < particleCount; i++) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y + 1;
    positions[i * 3 + 2] = position.z;
    velocities.push(new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      Math.random() * 5,
      (Math.random() - 0.5) * 4
    ));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  var mat = new THREE.PointsMaterial({ color: 0xffaa00, size: 0.15 });
  var particles = new THREE.Points(geo, mat);
  scene.add(particles);

  var life = 0;
  function animateParticles(dt) {
    life += dt;
    var pos = geo.attributes.position.array;
    for (var i = 0; i < particleCount; i++) {
      pos[i * 3] += velocities[i].x * dt;
      pos[i * 3 + 1] += velocities[i].y * dt;
      pos[i * 3 + 2] += velocities[i].z * dt;
      velocities[i].y -= 10 * dt;
    }
    geo.attributes.position.needsUpdate = true;
    if (life > 1.0) {
      scene.remove(particles);
      geo.dispose();
      mat.dispose();
      return true;
    }
    return false;
  }
  activeVFX.push(animateParticles);
}

var activeVFX = [];

// --- Build city / maze layout ---

function buildCity(scene) {
  createGround(scene);

  // Build fence walls from LevelData
  for (var i = 0; i < LevelData.walls.length; i++) {
    var w = LevelData.walls[i];
    addFenceSegment(scene, w.x1, w.z1, w.x2, w.z2);
  }

  // Build buildings from LevelData
  for (var i = 0; i < LevelData.buildings.length; i++) {
    var b = LevelData.buildings[i];
    var colors = [0x111122, 0x0f0f20, 0x151530, 0x0d0d1e, 0x121228];
    var col = b.color || colors[Math.floor(Math.random() * colors.length)];
    addBuilding(scene, b.w, b.h, b.d, b.x, b.z, col);
  }

  // Street lights from LevelData
  for (var i = 0; i < LevelData.streetLights.length; i++) {
    var sl = LevelData.streetLights[i];
    addStreetLight(scene, sl.x, sl.z);
  }

  // Distraction objects from LevelData
  for (var di = 0; di < LevelData.distractions.length; di++) {
    var dd = LevelData.distractions[di];
    addDistractionObject(scene, dd.x, dd.z, dd.type);
  }

  // HRN Houses from LevelData
  henHouses = [];
  for (var hi = 0; hi < LevelData.henHouses.length; hi++) {
    var hd = LevelData.henHouses[hi];
    var hen = {
      id: hd.id,
      position: new THREE.Vector3(hd.x, 0, hd.z),
      locked: hd.locked,
      visited: false,
      powerupId: hd.powerupId,
      missionText: hd.missionText,
    };
    henHouses.push(hen);
    makeHENHouse(scene, hen);
  }
}

// --- Collision resolution ---

function resolveCollisions(entity) {
  var halfW = 0.3, halfH = 0.6, halfD = 0.3;
  var entityBox = new THREE.Box3(
    new THREE.Vector3(entity.position.x - halfW, entity.position.y, entity.position.z - halfD),
    new THREE.Vector3(entity.position.x + halfW, entity.position.y + halfH * 2, entity.position.z + halfD)
  );

  for (var i = 0; i < colliders.length; i++) {
    var box = colliders[i];
    // Skip zero-size boxes (cleared sneak points)
    if (box.min.x === box.max.x && box.min.z === box.max.z) continue;

    if (entityBox.intersectsBox(box)) {
      pushOut(entity, entityBox, box);
      entityBox.min.set(entity.position.x - halfW, entity.position.y, entity.position.z - halfD);
      entityBox.max.set(entity.position.x + halfW, entity.position.y + halfH * 2, entity.position.z + halfD);
    }
  }

  // Ground check
  if (entity.position.y <= 0) {
    entity.position.y = 0;
    entity.velocity.y = 0;
    entity.onGround = true;
  }
}

function pushOut(entity, entityBox, box) {
  var overlapX1 = entityBox.max.x - box.min.x;
  var overlapX2 = box.max.x - entityBox.min.x;
  var overlapZ1 = entityBox.max.z - box.min.z;
  var overlapZ2 = box.max.z - entityBox.min.z;
  var overlapY1 = entityBox.max.y - box.min.y;
  var overlapY2 = box.max.y - entityBox.min.y;

  var minOverlap = Infinity;
  var pushAxis = 'x';
  var pushDir = 1;

  if (overlapX1 < minOverlap) { minOverlap = overlapX1; pushAxis = 'x'; pushDir = -1; }
  if (overlapX2 < minOverlap) { minOverlap = overlapX2; pushAxis = 'x'; pushDir = 1; }
  if (overlapZ1 < minOverlap) { minOverlap = overlapZ1; pushAxis = 'z'; pushDir = -1; }
  if (overlapZ2 < minOverlap) { minOverlap = overlapZ2; pushAxis = 'z'; pushDir = 1; }
  if (overlapY1 < minOverlap) { minOverlap = overlapY1; pushAxis = 'y'; pushDir = -1; }
  if (overlapY2 < minOverlap) { minOverlap = overlapY2; pushAxis = 'y'; pushDir = 1; }

  entity.position[pushAxis] += pushDir * minOverlap;

  if (pushAxis === 'y') {
    entity.velocity.y = 0;
    if (pushDir === 1) {
      entity.onGround = true;
    }
  }
}

// --- Update ---

function updateCity(dt) {
  // Pulse HRN house glows
  var time = performance.now() / 1000;
  for (var i = 0; i < henHouseObjects.length; i++) {
    var hen = henHouseObjects[i];
    if (!hen.config.locked) {
      var pulse = 1.5 + Math.sin(time * C.HRN_PULSE_SPEED * Math.PI * 2) * 0.8;
      hen.glow.intensity = pulse;
      hen.ring.material.opacity = 0.3 + Math.sin(time * C.HRN_PULSE_SPEED * Math.PI * 2) * 0.2;
    }
  }

  // Update distraction timers
  for (var i = 0; i < distractObjects.length; i++) {
    var obj = distractObjects[i];
    if (obj.active) {
      obj.timer -= dt;
      if (obj.timer <= 0) {
        obj.active = false;
      }
    }
  }

  // Update VFX
  for (var i = activeVFX.length - 1; i >= 0; i--) {
    if (activeVFX[i](dt)) {
      activeVFX.splice(i, 1);
    }
  }
}

// --- Utility ---

function findNearestInRadius(objects, pos, radius) {
  var nearest = null;
  var nearestDist = radius;
  for (var i = 0; i < objects.length; i++) {
    var d = pos.distanceTo(objects[i].position);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = objects[i];
    }
  }
  return nearest;
}

function getActiveDistractions() {
  var active = [];
  for (var i = 0; i < distractObjects.length; i++) {
    if (distractObjects[i].active) {
      active.push(distractObjects[i]);
    }
  }
  return active;
}
