// city.js — City geometry, HEN houses, interactable objects, collision

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

  // Collider
  var box = new THREE.Box3().setFromObject(mesh);
  colliders.push(box);

  // Neon edge trim
  addNeonEdges(scene, mesh, w, h, d, x, z);

  return mesh;
}

function addNeonEdges(scene, mesh, w, h, d, x, z) {
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

// --- Street lights ---

function addStreetLight(scene, x, z) {
  // Pole
  var pole = makeBlock(0.3, 5, 0.3, x, z, 0x333344);
  scene.add(pole);

  // Light
  var light = new THREE.PointLight(0xffaa44, 1.5, 18);
  light.position.set(x, 5.5, z);
  light.castShadow = false;
  scene.add(light);

  // Small glowing sphere at top
  var bulbGeo = new THREE.SphereGeometry(0.2, 8, 8);
  var bulbMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
  var bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(x, 5.5, z);
  scene.add(bulb);

  streetLights.push(light);
}

// --- HEN Houses (populated from LevelData) ---

var henHouses = [];

function makeHENHouse(scene, config) {
  var mesh = makeBlock(6, 8, 6, config.position.x, config.position.z, 0x002211);
  scene.add(mesh);
  cityMeshes.push(mesh);

  var box = new THREE.Box3().setFromObject(mesh);
  colliders.push(box);

  var glow = new THREE.PointLight(C.HEN_GLOW_COLOR, config.locked ? 0.2 : 2.0, 15);
  glow.position.set(config.position.x, 5, config.position.z);
  scene.add(glow);

  // Glowing ring at base
  var ringGeo = new THREE.RingGeometry(3.5, 4, 32);
  var ringMat = new THREE.MeshBasicMaterial({
    color: C.HEN_GLOW_COLOR,
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
  // Spark particles
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

  // Animate and remove
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
      return true; // done
    }
    return false;
  }
  activeVFX.push(animateParticles);
}

var activeVFX = [];

// --- Build city layout ---

function buildCity(scene) {
  createGround(scene);

  var BS = C.CITY_BLOCK_SIZE;
  var SW = C.CITY_STREET_WIDTH;

  // Starting alley — south area
  addBuilding(scene, 6, 6, 20, -8, -10, 0x111122);
  addBuilding(scene, 6, 8, 20, 8, -10, 0x0f0f20);

  // 3x3 city block grid
  for (var bx = -1; bx <= 1; bx++) {
    for (var bz = 0; bz <= 2; bz++) {
      var cx = bx * (BS + SW);
      var cz = bz * (BS + SW) + 10;

      // Each block = cluster of buildings
      var numBuildings = 2 + Math.floor(Math.random() * 3);
      for (var b = 0; b < numBuildings; b++) {
        var bw = 4 + Math.random() * 8;
        var bh = 4 + Math.random() * 12;
        var bd = 4 + Math.random() * 8;
        var ox = cx + (Math.random() - 0.5) * (BS - bw);
        var oz = cz + (Math.random() - 0.5) * (BS - bd);
        var colors = [0x111122, 0x0f0f20, 0x151530, 0x0d0d1e, 0x121228];
        var col = colors[Math.floor(Math.random() * colors.length)];
        addBuilding(scene, bw, bh, bd, ox, oz, col);
      }

      // Street lights along edges
      addStreetLight(scene, cx - BS / 2 - 2, cz);
      addStreetLight(scene, cx + BS / 2 + 2, cz);
    }
  }

  // Industrial yard — north area
  addBuilding(scene, 30, 5, 15, 0, 65, 0x0d0d1a);
  addBuilding(scene, 12, 7, 10, -18, 70, 0x101025);
  addBuilding(scene, 12, 7, 10, 18, 70, 0x101025);

  // More street lights
  addStreetLight(scene, -15, 0);
  addStreetLight(scene, 15, 0);
  addStreetLight(scene, -15, 30);
  addStreetLight(scene, 15, 30);
  addStreetLight(scene, 0, 55);
  addStreetLight(scene, -20, 55);
  addStreetLight(scene, 20, 55);

  // Distraction objects from LevelData
  for (var di = 0; di < LevelData.distractions.length; di++) {
    var dd = LevelData.distractions[di];
    addDistractionObject(scene, dd.x, dd.z, dd.type);
  }

  // Walls/fences along edges
  addBuilding(scene, 1, 3, 150, -60, 35, 0x0a0a15);
  addBuilding(scene, 1, 3, 150, 60, 35, 0x0a0a15);
  addBuilding(scene, 120, 3, 1, 0, -40, 0x0a0a15);
  addBuilding(scene, 120, 3, 1, 0, 90, 0x0a0a15);

  // HEN Houses from LevelData
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
    if (entityBox.intersectsBox(box)) {
      pushOut(entity, entityBox, box);
      // Recalculate after push
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
  // Calculate overlap on each axis
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
  // Pulse HEN house glows
  var time = performance.now() / 1000;
  for (var i = 0; i < henHouseObjects.length; i++) {
    var hen = henHouseObjects[i];
    if (!hen.config.locked) {
      var pulse = 1.5 + Math.sin(time * C.HEN_PULSE_SPEED * Math.PI * 2) * 0.8;
      hen.glow.intensity = pulse;
      hen.ring.material.opacity = 0.3 + Math.sin(time * C.HEN_PULSE_SPEED * Math.PI * 2) * 0.2;
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

// --- Dog patrol waypoints (built from LevelData) ---

var dogPatrols = [];

function buildDogPatrols() {
  dogPatrols = [];
  for (var i = 0; i < LevelData.dogPatrols.length; i++) {
    var patrol = LevelData.dogPatrols[i];
    var wps = [];
    for (var j = 0; j < patrol.waypoints.length; j++) {
      wps.push(new THREE.Vector3(patrol.waypoints[j].x, 0, patrol.waypoints[j].z));
    }
    dogPatrols.push(wps);
  }
}
