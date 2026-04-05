// hen.js — Golden Hen collectibles: placed around the maze, collected by proximity

var hens = [];
var henModelLoaded = false;
var henModelData = null;  // stored gltf for cloning
var totalHensCollected = 0;

// --- HenAgent constructor ---

function HenAgent(config, index) {
  this.id = config.id || ('hen_' + index);
  this.spawnPos = new THREE.Vector3(config.x, 0, config.z);
  this.position = this.spawnPos.clone();
  this.rotation = Math.random() * Math.PI * 2;
  this.baseY = 0;
  this.collected = false;
  this.collectTimer = 0;
  this.model = null;
  this.mixer = null;
  this.animClips = {};
  this.currentAnim = null;
  this.currentAction = null;
  this.glowLight = null;
  this.stateTimer = 0;
  this.state = 'IDLE';       // IDLE or WALK
  this.wanderTarget = null;
}

HenAgent.prototype.buildPlaceholder = function() {
  var group = new THREE.Group();

  // Golden body
  var bodyGeo = new THREE.SphereGeometry(0.35, 10, 10);
  bodyGeo.scale(1, 0.8, 1.2);
  var bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00,
    emissive: 0x443300,
    roughness: 0.4,
    metalness: 0.6,
  });
  var body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.4;
  body.castShadow = true;
  group.add(body);

  // Head
  var headGeo = new THREE.SphereGeometry(0.2, 8, 8);
  var headMat = new THREE.MeshStandardMaterial({
    color: 0xffdd33,
    emissive: 0x443300,
    roughness: 0.4,
    metalness: 0.6,
  });
  var head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 0.7, 0.25);
  head.castShadow = true;
  group.add(head);

  // Beak
  var beakGeo = new THREE.ConeGeometry(0.06, 0.15, 4);
  var beakMat = new THREE.MeshStandardMaterial({ color: 0xff8800 });
  var beak = new THREE.Mesh(beakGeo, beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.68, 0.42);
  group.add(beak);

  // Comb (red crest)
  var combGeo = new THREE.BoxGeometry(0.04, 0.12, 0.15);
  var combMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0x330000 });
  var comb = new THREE.Mesh(combGeo, combMat);
  comb.position.set(0, 0.88, 0.2);
  group.add(comb);

  // Glow light
  this.glowLight = new THREE.PointLight(C.HEN_GLOW_COLOR_GOLD, C.HEN_GLOW_INTENSITY, 8);
  this.glowLight.position.y = 0.6;
  group.add(this.glowLight);

  // Ground ring indicator
  var ringGeo = new THREE.RingGeometry(C.HEN_COLLECT_RADIUS - 0.2, C.HEN_COLLECT_RADIUS, 32);
  var ringMat = new THREE.MeshBasicMaterial({
    color: C.HEN_GLOW_COLOR_GOLD,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
  });
  var ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);
  this.ring = ring;

  group.scale.setScalar(C.HEN_SCALE);
  this.model = group;
};

HenAgent.prototype.buildFromGLTF = function(gltf) {
  var group = new THREE.Group();

  // Clone with SkeletonUtils to properly rebind skinned meshes
  var modelClone = THREE.SkeletonUtils.clone(gltf.scene);
  modelClone.position.set(0, 0, 0);
  modelClone.rotation.set(0, 0, 0);
  modelClone.scale.setScalar(C.HEN_SCALE);
  modelClone.traverse(function(child) {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  group.add(modelClone);

  // Glow light
  this.glowLight = new THREE.PointLight(C.HEN_GLOW_COLOR_GOLD, C.HEN_GLOW_INTENSITY, 8);
  this.glowLight.position.y = 0.6;
  group.add(this.glowLight);

  // Ground ring indicator
  var ringGeo = new THREE.RingGeometry(C.HEN_COLLECT_RADIUS - 0.2, C.HEN_COLLECT_RADIUS, 32);
  var ringMat = new THREE.MeshBasicMaterial({
    color: C.HEN_GLOW_COLOR_GOLD,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
  });
  var ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);
  this.ring = ring;

  this.model = group;

  // Set up animation mixer
  if (gltf.animations && gltf.animations.length > 0) {
    this.mixer = new THREE.AnimationMixer(modelClone);
    for (var i = 0; i < gltf.animations.length; i++) {
      var clip = gltf.animations[i];
      this.animClips[clip.name] = clip;
    }
    this.mixer.update(0);
    this.setAnim('Idle');
  }
};

HenAgent.prototype.setAnim = function(clipName) {
  if (this.currentAnim === clipName) return;
  this.currentAnim = clipName;
  if (!this.mixer) return;

  var clip = this.animClips[clipName] || this.animClips[clipName.toLowerCase()] || null;
  if (!clip) return;

  var newAction = this.mixer.clipAction(clip);
  newAction.setLoop(THREE.LoopRepeat);
  if (this.currentAction) {
    newAction.reset();
    newAction.play();
    this.currentAction.crossFadeTo(newAction, 0.2, true);
  } else {
    newAction.reset();
    newAction.play();
  }
  this.currentAction = newAction;
};

HenAgent.prototype.pickWanderTarget = function() {
  var angle = Math.random() * Math.PI * 2;
  var dist = Math.random() * C.HEN_WANDER_RADIUS;
  this.wanderTarget = new THREE.Vector3(
    this.spawnPos.x + Math.cos(angle) * dist,
    0,
    this.spawnPos.z + Math.sin(angle) * dist
  );
};

HenAgent.prototype.update = function(dt, foxPos) {
  if (this.collected) {
    // Collection animation: shrink and rise
    this.collectTimer += dt;
    if (this.model) {
      var t = this.collectTimer / C.HEN_COLLECT_ANIM_TIME;
      var scale = Math.max(0, 1 - t) * C.HEN_SCALE;
      this.model.scale.setScalar(scale);
      this.model.position.y += 3 * dt;
      if (this.glowLight) {
        this.glowLight.intensity = Math.max(0, C.HEN_GLOW_INTENSITY * (1 - t));
      }
      if (t >= 1 && this.model.parent) {
        this.model.parent.remove(this.model);
      }
    }
    return;
  }

  this.stateTimer += dt;

  // --- Idle / Walk state machine ---
  switch (this.state) {
    case 'IDLE':
      if (this.stateTimer > 2 + Math.random() * 3) {
        this.pickWanderTarget();
        this.state = 'WALK';
        this.stateTimer = 0;
        this.setAnim('Walk');
      }
      break;

    case 'WALK':
      if (this.wanderTarget) {
        var dir = new THREE.Vector3().subVectors(this.wanderTarget, this.position);
        dir.y = 0;
        var dist = dir.length();
        if (dist < 0.3) {
          // Reached target, go idle
          this.state = 'IDLE';
          this.stateTimer = 0;
          this.setAnim('Idle');
        } else {
          dir.normalize();
          this.position.addScaledVector(dir, Math.min(C.HEN_WANDER_SPEED * dt, dist));
          this.rotation = Math.atan2(dir.x, dir.z);
        }
      }
      break;
  }

  // Gentle idle bob
  var bob = Math.sin(this.stateTimer * C.HEN_BOB_SPEED * Math.PI * 2) * C.HEN_BOB_HEIGHT;
  if (this.model) {
    this.model.position.set(this.position.x, this.baseY + bob, this.position.z);
    this.model.rotation.y = this.rotation;
  }

  // Pulse glow
  if (this.glowLight) {
    var pulse = C.HEN_GLOW_INTENSITY + Math.sin(this.stateTimer * C.HEN_PULSE_SPEED * Math.PI * 2) * 0.5;
    this.glowLight.intensity = pulse;
  }

  // Pulse ring
  if (this.ring) {
    this.ring.material.opacity = 0.08 + Math.sin(this.stateTimer * C.HEN_PULSE_SPEED * Math.PI * 2) * 0.04;
  }

  // Update animation mixer
  if (this.mixer) this.mixer.update(dt);

  // Check collection proximity
  if (foxPos) {
    var dx = foxPos.x - this.position.x;
    var dz = foxPos.z - this.position.z;
    var distToFox = Math.sqrt(dx * dx + dz * dz);
    if (distToFox < C.HEN_COLLECT_RADIUS) {
      this.collect();
    }
  }
};

HenAgent.prototype.collect = function() {
  if (this.collected) return;
  this.collected = true;
  this.collectTimer = 0;
  totalHensCollected++;

  // Spawn collection VFX (golden sparks)
  spawnHenCollectVFX(this.position);

  // Fire event for progression system
  events.emit('henCollected', { id: this.id, total: totalHensCollected });
};

// --- Collection VFX ---

function spawnHenCollectVFX(position) {
  var particleCount = 30;
  var geo = new THREE.BufferGeometry();
  var positions = new Float32Array(particleCount * 3);
  var velocities = [];
  for (var i = 0; i < particleCount; i++) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y + 0.5;
    positions[i * 3 + 2] = position.z;
    var angle = Math.random() * Math.PI * 2;
    var speed = 2 + Math.random() * 4;
    velocities.push(new THREE.Vector3(
      Math.cos(angle) * speed,
      3 + Math.random() * 5,
      Math.sin(angle) * speed
    ));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  var mat = new THREE.PointsMaterial({ color: 0xffcc00, size: 0.2 });
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
      velocities[i].y -= 8 * dt;
    }
    geo.attributes.position.needsUpdate = true;
    if (life > 1.2) {
      scene.remove(particles);
      geo.dispose();
      mat.dispose();
      return true;
    }
    return false;
  }
  activeVFX.push(animateParticles);
}

// --- Spawn all hens from level data ---

function spawnHens(scene) {
  hens = [];
  totalHensCollected = 0;

  var dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
  var gltfLoader = new THREE.GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  // Try to load GLB model
  gltfLoader.load(C.HEN_MODEL_PATH, function(gltf) {
    console.log('Hen GLB scene transform:', 'pos', gltf.scene.position.toArray(), 'rot', gltf.scene.rotation.toArray().slice(0,3));
    henModelLoaded = true;
    henModelData = gltf;
    for (var i = 0; i < LevelData.hens.length; i++) {
      var hen = new HenAgent(LevelData.hens[i], i);
      hen.buildFromGLTF(gltf);
      scene.add(hen.model);
      hen.model.position.set(hen.position.x, hen.baseY, hen.position.z);
      hens.push(hen);
    }
  }, undefined, function(err) {
    console.warn('Hen model not found, using placeholders:', err);
    for (var i = 0; i < LevelData.hens.length; i++) {
      var hen = new HenAgent(LevelData.hens[i], i);
      hen.buildPlaceholder();
      scene.add(hen.model);
      hen.model.position.set(hen.position.x, hen.baseY, hen.position.z);
      hens.push(hen);
    }
  });
}

// --- Update all hens ---

function updateAllHens(dt) {
  for (var i = 0; i < hens.length; i++) {
    hens[i].update(dt, foxState.position);
  }
}

// --- Query helpers ---

function getTotalHens() {
  return LevelData.hens ? LevelData.hens.length : 0;
}

function getCollectedHens() {
  return totalHensCollected;
}
