// progression.js — Sneak points (fence gaps) and Howl points (rooster repositioning)

var sneakPoints = [];
var howlPoints = [];

// --- Sneak Points: gaps in fences that unlock when enough hens are collected ---

function SneakPoint(config, index) {
  this.id = config.id || ('sneak_' + index);
  this.position = new THREE.Vector3(config.x, 0, config.z);
  this.requiredHens = config.requiredHens || 1;
  this.unlocked = false;
  this.barrierMesh = null;
  this.glowLight = null;
  this.colliderIndex = -1;  // index into colliders[] for removal on unlock
}

SneakPoint.prototype.build = function(scene) {
  // Barrier: a glowing wall that blocks the fence gap
  var w = C.SNEAK_POINT_WIDTH;
  var h = C.FENCE_HEIGHT;
  var d = C.FENCE_THICKNESS + 0.2;

  var geo = new THREE.BoxGeometry(w, h, d);
  var mat = new THREE.MeshStandardMaterial({
    color: C.SNEAK_POINT_COLOR_LOCKED,
    emissive: C.SNEAK_POINT_COLOR_LOCKED,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.6,
    roughness: 0.3,
    metalness: 0.5,
  });
  this.barrierMesh = new THREE.Mesh(geo, mat);
  this.barrierMesh.position.set(this.position.x, h / 2, this.position.z);
  this.barrierMesh.castShadow = false;
  scene.add(this.barrierMesh);

  // Add collider
  var box = new THREE.Box3().setFromObject(this.barrierMesh);
  this.colliderIndex = colliders.length;
  colliders.push(box);

  // Glow
  this.glowLight = new THREE.PointLight(C.SNEAK_POINT_COLOR_LOCKED, 0.8, 6);
  this.glowLight.position.set(this.position.x, h, this.position.z);
  scene.add(this.glowLight);

  // Label: small floating text indicator showing required hens
  var labelGeo = new THREE.PlaneGeometry(1.2, 0.4);
  var canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 40;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 120, 40);
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#ff4444';
  ctx.textAlign = 'center';
  ctx.fillText(this.requiredHens + ' HENS', 60, 28);
  var labelTex = new THREE.CanvasTexture(canvas);
  var labelMat = new THREE.MeshBasicMaterial({
    map: labelTex,
    transparent: true,
    opacity: 0.8,
  });
  this.label = new THREE.Mesh(labelGeo, labelMat);
  this.label.position.set(this.position.x, h + 0.8, this.position.z);
  scene.add(this.label);
};

SneakPoint.prototype.tryUnlock = function(henCount) {
  if (this.unlocked) return;
  if (henCount >= this.requiredHens) {
    this.unlock();
  }
};

SneakPoint.prototype.unlock = function() {
  this.unlocked = true;

  // Remove barrier
  if (this.barrierMesh && this.barrierMesh.parent) {
    this.barrierMesh.parent.remove(this.barrierMesh);
  }

  // Remove label
  if (this.label && this.label.parent) {
    this.label.parent.remove(this.label);
  }

  // Remove collider
  if (this.colliderIndex >= 0 && this.colliderIndex < colliders.length) {
    // Set collider to a zero-size box so it doesn't block
    colliders[this.colliderIndex] = new THREE.Box3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0)
    );
  }

  // Change glow to green
  if (this.glowLight) {
    this.glowLight.color.setHex(C.SNEAK_POINT_COLOR_UNLOCKED);
    this.glowLight.intensity = 1.2;
    // Fade out over time (handled in update)
  }

  // Spawn unlock VFX
  spawnSneakUnlockVFX(this.position);
};

SneakPoint.prototype.update = function(dt) {
  if (this.unlocked) {
    // Fade out glow after unlock
    if (this.glowLight && this.glowLight.intensity > 0) {
      this.glowLight.intensity = Math.max(0, this.glowLight.intensity - dt * 0.5);
    }
    return;
  }

  // Pulse barrier
  if (this.barrierMesh) {
    var t = performance.now() / 1000;
    this.barrierMesh.material.opacity = 0.4 + Math.sin(t * 2) * 0.2;
  }
};

function spawnSneakUnlockVFX(position) {
  var particleCount = 25;
  var geo = new THREE.BufferGeometry();
  var positions = new Float32Array(particleCount * 3);
  var velocities = [];
  for (var i = 0; i < particleCount; i++) {
    positions[i * 3] = position.x + (Math.random() - 0.5) * 2;
    positions[i * 3 + 1] = Math.random() * C.FENCE_HEIGHT;
    positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.5;
    velocities.push(new THREE.Vector3(
      (Math.random() - 0.5) * 3,
      2 + Math.random() * 3,
      (Math.random() - 0.5) * 3
    ));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  var mat = new THREE.PointsMaterial({ color: 0x00ffcc, size: 0.15 });
  var particles = new THREE.Points(geo, mat);
  scene.add(particles);

  var life = 0;
  function anim(dt) {
    life += dt;
    var pos = geo.attributes.position.array;
    for (var i = 0; i < particleCount; i++) {
      pos[i * 3] += velocities[i].x * dt;
      pos[i * 3 + 1] += velocities[i].y * dt;
      pos[i * 3 + 2] += velocities[i].z * dt;
      velocities[i].y -= 6 * dt;
    }
    geo.attributes.position.needsUpdate = true;
    if (life > 1.5) {
      scene.remove(particles);
      geo.dispose();
      mat.dispose();
      return true;
    }
    return false;
  }
  activeVFX.push(anim);
}


// --- Howl Points: locations where fox howls to reposition a rooster ---

function HowlPoint(config, index) {
  this.id = config.id || ('howl_' + index);
  this.position = new THREE.Vector3(config.x, 0, config.z);
  this.requiredHens = config.requiredHens || 0;
  this.targetRoosterId = config.targetRooster;
  this.newRoosterPos = new THREE.Vector3(config.newX, 0, config.newZ);
  this.used = false;
  this.available = false;
  this.model = null;
  this.glowLight = null;
}

HowlPoint.prototype.build = function(scene) {
  var group = new THREE.Group();

  // Glowing pillar
  var pillarGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.5, 8);
  var pillarMat = new THREE.MeshStandardMaterial({
    color: C.HOWL_POINT_COLOR,
    emissive: C.HOWL_POINT_COLOR,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.5,
    roughness: 0.3,
    metalness: 0.4,
  });
  this.pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
  this.pillarMesh.position.y = 1.25;
  group.add(this.pillarMesh);

  // Ground ring
  var ringGeo = new THREE.RingGeometry(C.HOWL_POINT_RADIUS - 0.2, C.HOWL_POINT_RADIUS, 32);
  var ringMat = new THREE.MeshBasicMaterial({
    color: C.HOWL_POINT_COLOR,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  this.ring = new THREE.Mesh(ringGeo, ringMat);
  this.ring.rotation.x = -Math.PI / 2;
  this.ring.position.y = 0.02;
  group.add(this.ring);

  // Glow light
  this.glowLight = new THREE.PointLight(C.HOWL_POINT_GLOW, 0.8, 8);
  this.glowLight.position.y = 2.5;
  group.add(this.glowLight);

  // Label
  var labelGeo = new THREE.PlaneGeometry(1.4, 0.4);
  var canvas = document.createElement('canvas');
  canvas.width = 140;
  canvas.height = 40;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 140, 40);
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#8844ff';
  ctx.textAlign = 'center';
  ctx.fillText('HOWL [E]', 70, 28);
  var labelTex = new THREE.CanvasTexture(canvas);
  var labelMat2 = new THREE.MeshBasicMaterial({
    map: labelTex,
    transparent: true,
    opacity: 0.8,
  });
  this.labelMesh = new THREE.Mesh(labelGeo, labelMat2);
  this.labelMesh.position.y = 3.2;
  group.add(this.labelMesh);

  group.position.copy(this.position);
  this.model = group;
  scene.add(this.model);

  // Start invisible until available
  this.setVisible(false);
};

HowlPoint.prototype.setVisible = function(vis) {
  if (this.model) this.model.visible = vis;
};

HowlPoint.prototype.checkAvailability = function(henCount) {
  if (this.used) return;
  var wasAvailable = this.available;
  this.available = (henCount >= this.requiredHens);
  if (this.available && !wasAvailable) {
    this.setVisible(true);
  }
};

HowlPoint.prototype.activate = function() {
  if (this.used || !this.available) return false;
  this.used = true;

  // Reposition the target rooster
  var rooster = getRoosterById(this.targetRoosterId);
  if (rooster) {
    rooster.repositionTo(this.newRoosterPos);
  }

  // Visual feedback
  if (this.pillarMesh) {
    this.pillarMesh.material.emissiveIntensity = 1.0;
    this.pillarMesh.material.opacity = 0.8;
  }

  // Spawn howl VFX
  spawnHowlVFX(this.position);

  // Fade out after use (handled in update)
  return true;
};

HowlPoint.prototype.update = function(dt) {
  if (this.used) {
    // Fade out
    if (this.model && this.model.visible) {
      if (this.pillarMesh) {
        this.pillarMesh.material.opacity -= dt * 0.5;
        if (this.pillarMesh.material.opacity <= 0) {
          this.setVisible(false);
        }
      }
    }
    return;
  }

  if (!this.available) return;

  // Pulse
  var t = performance.now() / 1000;
  if (this.pillarMesh) {
    this.pillarMesh.material.opacity = 0.3 + Math.sin(t * 1.5) * 0.15;
    this.pillarMesh.material.emissiveIntensity = 0.15 + Math.sin(t * 1.5) * 0.1;
  }
  if (this.ring) {
    this.ring.material.opacity = 0.1 + Math.sin(t * 1.5) * 0.05;
  }
  if (this.glowLight) {
    this.glowLight.intensity = 0.6 + Math.sin(t * 1.5) * 0.3;
  }
  // Billboard label toward camera
  if (this.labelMesh && typeof camera !== 'undefined') {
    this.labelMesh.lookAt(camera.position);
  }
};

HowlPoint.prototype.isInRange = function(foxPos) {
  var dx = foxPos.x - this.position.x;
  var dz = foxPos.z - this.position.z;
  return Math.sqrt(dx * dx + dz * dz) < C.HOWL_POINT_RADIUS;
};

function spawnHowlVFX(position) {
  var ringCount = 3;
  var rings = [];
  for (var r = 0; r < ringCount; r++) {
    var geo = new THREE.RingGeometry(0.5, 0.8, 32);
    var mat = new THREE.MeshBasicMaterial({
      color: C.HOWL_POINT_COLOR,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, 0.5 + r * 0.3, position.z);
    scene.add(mesh);
    rings.push({ mesh: mesh, delay: r * 0.2, life: 0 });
  }

  function anim(dt) {
    var done = true;
    for (var i = 0; i < rings.length; i++) {
      var ring = rings[i];
      ring.life += dt;
      var t = ring.life - ring.delay;
      if (t < 0) { done = false; continue; }
      var scale = 1 + t * 8;
      ring.mesh.scale.setScalar(scale);
      ring.mesh.material.opacity = Math.max(0, 0.6 - t * 0.5);
      ring.mesh.position.y = 0.5 + t * 3;
      if (ring.mesh.material.opacity <= 0) {
        if (ring.mesh.parent) ring.mesh.parent.remove(ring.mesh);
      } else {
        done = false;
      }
    }
    return done;
  }
  activeVFX.push(anim);
}


// --- Build all progression objects ---

function buildProgression(scene) {
  sneakPoints = [];
  howlPoints = [];

  // Sneak points
  if (LevelData.sneakPoints) {
    for (var i = 0; i < LevelData.sneakPoints.length; i++) {
      var sp = new SneakPoint(LevelData.sneakPoints[i], i);
      sp.build(scene);
      sneakPoints.push(sp);
    }
  }

  // Howl points
  if (LevelData.howlPoints) {
    for (var i = 0; i < LevelData.howlPoints.length; i++) {
      var hp = new HowlPoint(LevelData.howlPoints[i], i);
      hp.build(scene);
      howlPoints.push(hp);
    }
  }

  // Listen for hen collection to update unlocks
  events.on('henCollected', function(data) {
    for (var i = 0; i < sneakPoints.length; i++) {
      sneakPoints[i].tryUnlock(data.total);
    }
    for (var i = 0; i < howlPoints.length; i++) {
      howlPoints[i].checkAvailability(data.total);
    }
  });
}

// --- Update all progression objects ---

function updateProgression(dt) {
  for (var i = 0; i < sneakPoints.length; i++) {
    sneakPoints[i].update(dt);
  }
  for (var i = 0; i < howlPoints.length; i++) {
    howlPoints[i].update(dt);
  }
}

// --- Try to activate nearest howl point (called from fox bark/interact) ---

function tryActivateHowlPoint(foxPos) {
  for (var i = 0; i < howlPoints.length; i++) {
    var hp = howlPoints[i];
    if (!hp.used && hp.available && hp.isInRange(foxPos)) {
      return hp.activate();
    }
  }
  return false;
}
