// rooster.js — Mecha Rooster zone guards: patrol within a zone, chase fox OUT (not kill)

var roosters = [];
var roosterModelLoaded = false;
var roosterModelData = null;

var ROOSTER_STATES = {
  GUARD_IDLE:  { anim: 'Idle', loop: true  },
  GUARD_WALK:  { anim: 'Walk', loop: true  },
  ALERT:       { anim: 'Idle', loop: true  },   // will use Idle Alert if available
  CHASE:       { anim: 'Walk', loop: true  },   // will use Run if available
  PUSH_OUT:    { anim: 'Walk', loop: false },
  RETURN:      { anim: 'Walk', loop: true  },
};

// --- RoosterAgent constructor ---

function RoosterAgent(config, index) {
  this.id = config.id || ('rooster_' + index);
  this.zoneCenter = new THREE.Vector3(config.x, 0, config.z);
  this.position = this.zoneCenter.clone();
  this.zoneRadius = config.radius || C.ROOSTER_ZONE_RADIUS;
  this.rotation = 0;
  this.state = 'GUARD_IDLE';
  this.stateTimer = 0;
  this.patrolAngle = Math.random() * Math.PI * 2;
  this.patrolTarget = null;
  this.alertTarget = null;
  this.model = null;
  this.mixer = null;
  this.animClips = {};
  this.currentAnim = null;
  this.currentAction = null;
  this.glowLight = null;
  this.zoneDisc = null;
  this.zoneRing = null;
  this.pushTimer = 0;
  this.pushDir = new THREE.Vector3();

  // Pick a random initial patrol target within zone
  this.pickNewPatrolTarget();
}

RoosterAgent.prototype.pickNewPatrolTarget = function() {
  var angle = Math.random() * Math.PI * 2;
  var dist = Math.random() * this.zoneRadius * 0.6;
  this.patrolTarget = new THREE.Vector3(
    this.zoneCenter.x + Math.cos(angle) * dist,
    0,
    this.zoneCenter.z + Math.sin(angle) * dist
  );
};

RoosterAgent.prototype.setAnim = function(clipName) {
  if (this.currentAnim === clipName) return;
  this.currentAnim = clipName;
  if (!this.mixer) return;

  // Try exact name, then fallback
  var clip = this.animClips[clipName] ||
             this.animClips[clipName.toLowerCase()] ||
             null;
  if (!clip) return;

  var newAction = this.mixer.clipAction(clip);
  var isLoop = true;
  for (var key in ROOSTER_STATES) {
    if (ROOSTER_STATES[key].anim === clipName) {
      isLoop = ROOSTER_STATES[key].loop;
      break;
    }
  }
  newAction.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce);
  if (!isLoop) newAction.clampWhenFinished = true;

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

RoosterAgent.prototype.moveToward = function(target, speed, dt) {
  if (!target) return;
  var dir = new THREE.Vector3().subVectors(target, this.position);
  dir.y = 0;
  var dist = dir.length();
  if (dist < 0.5) return false; // reached
  dir.normalize();
  this.position.addScaledVector(dir, Math.min(speed * dt, dist));
  this.rotation = Math.atan2(dir.x, dir.z);
  return true; // still moving
};

RoosterAgent.prototype.isInZone = function(pos) {
  var dx = pos.x - this.zoneCenter.x;
  var dz = pos.z - this.zoneCenter.z;
  return (dx * dx + dz * dz) < (this.zoneRadius * this.zoneRadius);
};

RoosterAgent.prototype.distToFox = function(foxPos) {
  var dx = foxPos.x - this.position.x;
  var dz = foxPos.z - this.position.z;
  return Math.sqrt(dx * dx + dz * dz);
};

RoosterAgent.prototype.canDetectFox = function(foxPos) {
  // Only detect if fox is in our zone
  if (!this.isInZone(foxPos)) return false;

  var toFox = new THREE.Vector3().subVectors(foxPos, this.position);
  toFox.y = 0;
  var dist = toFox.length();
  var sneakMult = foxState.isSneaking ? C.ROOSTER_SNEAK_MULT : 1.0;

  // Hearing range (360)
  if (dist < C.ROOSTER_HEARING_RADIUS * sneakMult) return true;

  // Vision cone
  if (dist < C.ROOSTER_DETECT_RANGE * sneakMult) {
    toFox.normalize();
    var forward = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
    var dot = forward.dot(toFox);
    var halfFOV = (C.ROOSTER_DETECT_FOV / 2) * (Math.PI / 180);
    if (dot > 0 && Math.acos(Math.min(dot, 1)) < halfFOV) return true;
  }

  return false;
};

// --- State machine ---

RoosterAgent.prototype.update = function(dt, foxPos) {
  this.stateTimer += dt;

  switch (this.state) {
    case 'GUARD_IDLE':
      // Stand idle, occasionally pick new patrol point
      if (this.stateTimer > 2 + Math.random() * 3) {
        this.pickNewPatrolTarget();
        this.state = 'GUARD_WALK';
        this.stateTimer = 0;
        this.setAnim('Walk');
      }
      if (this.canDetectFox(foxPos)) {
        this.enterAlert(foxPos);
      }
      break;

    case 'GUARD_WALK':
      // Walk to random point within zone
      var stillMoving = this.moveToward(this.patrolTarget, C.ROOSTER_PATROL_SPEED, dt);
      if (!stillMoving) {
        this.state = 'GUARD_IDLE';
        this.stateTimer = 0;
        this.setAnim('Idle');
      }
      if (this.canDetectFox(foxPos)) {
        this.enterAlert(foxPos);
      }
      break;

    case 'ALERT':
      // Spotted fox — brief alert before chase
      // Face the fox
      var toFox = new THREE.Vector3().subVectors(foxPos, this.position);
      toFox.y = 0;
      if (toFox.lengthSq() > 0.01) {
        this.rotation = Math.atan2(toFox.x, toFox.z);
      }
      if (this.stateTimer > C.ROOSTER_ALERT_DURATION) {
        if (this.isInZone(foxPos)) {
          this.enterChase();
        } else {
          // Fox left zone, return to patrol
          this.enterReturn();
        }
      }
      break;

    case 'CHASE':
      // Chase fox toward zone boundary
      this.moveToward(foxPos, C.ROOSTER_CHASE_SPEED, dt);

      // If reached fox — push them out!
      if (this.distToFox(foxPos) < 1.8) {
        this.enterPushOut(foxPos);
      }

      // If fox left zone on their own, stop chasing
      if (!this.isInZone(foxPos)) {
        this.enterReturn();
      }

      // Timeout
      if (this.stateTimer > C.ROOSTER_CHASE_DURATION) {
        this.enterReturn();
      }
      break;

    case 'PUSH_OUT':
      // Fox is being pushed — we just wait
      this.pushTimer += dt;
      if (this.pushTimer > C.ROOSTER_PUSH_DURATION + 0.5) {
        this.enterReturn();
      }
      break;

    case 'RETURN':
      // Walk back to zone center
      var back = this.moveToward(this.zoneCenter, C.ROOSTER_RETURN_SPEED, dt);
      if (!back) {
        this.state = 'GUARD_IDLE';
        this.stateTimer = 0;
        this.setAnim('Idle');
      }
      // If fox sneaks back in while we return, re-alert
      if (this.canDetectFox(foxPos)) {
        this.enterAlert(foxPos);
      }
      break;
  }

  // Update model position
  if (this.model) {
    this.model.position.copy(this.position);
    this.model.rotation.y = this.rotation;
  }
  if (this.mixer) this.mixer.update(dt);

  // Update zone visual intensity based on state
  this.updateZoneVisual();
};

RoosterAgent.prototype.enterAlert = function(foxPos) {
  this.state = 'ALERT';
  this.stateTimer = 0;
  this.alertTarget = foxPos.clone();
  this.setAnim('Idle');
};

RoosterAgent.prototype.enterChase = function() {
  this.state = 'CHASE';
  this.stateTimer = 0;
  this.setAnim('Walk');
};

RoosterAgent.prototype.enterPushOut = function(foxPos) {
  this.state = 'PUSH_OUT';
  this.stateTimer = 0;
  this.pushTimer = 0;

  // Calculate push direction: from zone center outward through fox
  this.pushDir.subVectors(foxPos, this.zoneCenter);
  this.pushDir.y = 0;
  this.pushDir.normalize();

  // Apply push to fox (handled in game loop via event)
  events.emit('foxPushed', {
    dir: this.pushDir.clone(),
    speed: C.ROOSTER_PUSH_SPEED,
    duration: C.ROOSTER_PUSH_DURATION,
    zoneCenter: this.zoneCenter.clone(),
    zoneRadius: this.zoneRadius,
  });

  this.setAnim('Idle');
};

RoosterAgent.prototype.enterReturn = function() {
  this.state = 'RETURN';
  this.stateTimer = 0;
  this.setAnim('Walk');
};

// --- Reposition (used by howl points) ---

RoosterAgent.prototype.repositionTo = function(newCenter) {
  this.zoneCenter.copy(newCenter);
  this.state = 'RETURN';
  this.stateTimer = 0;
  this.setAnim('Walk');

  // Move zone visual
  if (this.zoneDisc) {
    this.zoneDisc.position.set(newCenter.x, 0.02, newCenter.z);
  }
  if (this.zoneRing) {
    this.zoneRing.position.set(newCenter.x, 0.03, newCenter.z);
  }
};

// --- Zone visual update ---

RoosterAgent.prototype.updateZoneVisual = function() {
  if (!this.zoneRing) return;
  var chasing = (this.state === 'CHASE' || this.state === 'ALERT');
  this.zoneRing.material.opacity = chasing ? 0.25 : 0.08;
  if (this.glowLight) {
    this.glowLight.intensity = chasing ? C.ROOSTER_GLOW_INTENSITY * 1.5 : C.ROOSTER_GLOW_INTENSITY;
  }
};

// --- Build placeholder visual ---

RoosterAgent.prototype.buildPlaceholder = function(scene) {
  var group = new THREE.Group();

  // Body (bigger than hen, metallic)
  var bodyGeo = new THREE.SphereGeometry(0.5, 10, 10);
  bodyGeo.scale(1, 1, 1.3);
  var bodyMat = new THREE.MeshStandardMaterial({
    color: 0xcc2222,
    emissive: 0x440000,
    roughness: 0.3,
    metalness: 0.8,
  });
  var body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  group.add(body);

  // Head
  var headGeo = new THREE.SphereGeometry(0.25, 8, 8);
  var headMat = new THREE.MeshStandardMaterial({
    color: 0xdd3333,
    emissive: 0x440000,
    roughness: 0.3,
    metalness: 0.8,
  });
  var head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 1.0, 0.35);
  head.castShadow = true;
  group.add(head);

  // Comb (big red crest — mecha style)
  var combGeo = new THREE.BoxGeometry(0.05, 0.25, 0.2);
  var combMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0x660000,
    metalness: 0.9,
    roughness: 0.2,
  });
  var comb = new THREE.Mesh(combGeo, combMat);
  comb.position.set(0, 1.25, 0.3);
  group.add(comb);

  // Beak (sharp, metallic)
  var beakGeo = new THREE.ConeGeometry(0.08, 0.25, 4);
  var beakMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.7, roughness: 0.3 });
  var beak = new THREE.Mesh(beakGeo, beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.95, 0.55);
  group.add(beak);

  // Eyes (glowing red)
  var eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  var eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.1, 1.05, 0.52);
  group.add(eyeL);
  var eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  group.add(eyeR);

  // Tail feathers (metallic plates)
  var tailGeo = new THREE.BoxGeometry(0.4, 0.5, 0.05);
  var tailMat = new THREE.MeshStandardMaterial({
    color: 0x991111,
    emissive: 0x330000,
    metalness: 0.9,
    roughness: 0.2,
  });
  var tail = new THREE.Mesh(tailGeo, tailMat);
  tail.position.set(0, 0.8, -0.55);
  tail.rotation.x = -0.3;
  group.add(tail);

  // Glow light
  this.glowLight = new THREE.PointLight(C.ROOSTER_GLOW_COLOR, C.ROOSTER_GLOW_INTENSITY, 10);
  this.glowLight.position.y = 1.5;
  group.add(this.glowLight);

  group.scale.setScalar(C.ROOSTER_SCALE);
  this.model = group;
  scene.add(this.model);

  // Zone visuals
  this.buildZoneVisuals(scene);
};

RoosterAgent.prototype.buildFromGLTF = function(scene, gltf) {
  var group = new THREE.Group();
  // Clone with SkeletonUtils to properly rebind skinned meshes
  var modelClone = THREE.SkeletonUtils.clone(gltf.scene);
  modelClone.position.set(0, 0, 0);
  modelClone.rotation.set(0, 0, 0);
  modelClone.scale.setScalar(C.ROOSTER_SCALE);
  modelClone.traverse(function(child) {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Shift model up by half the bounding box offset (base is at center of box)
  var bbox = new THREE.Box3().setFromObject(modelClone);
  modelClone.position.y = -bbox.min.y * 0.5;

  group.add(modelClone);

  // Glow light
  this.glowLight = new THREE.PointLight(C.ROOSTER_GLOW_COLOR, C.ROOSTER_GLOW_INTENSITY, 10);
  this.glowLight.position.y = 1.5;
  group.add(this.glowLight);

  this.model = group;
  scene.add(this.model);

  // Animation
  if (gltf.animations && gltf.animations.length > 0) {
    this.mixer = new THREE.AnimationMixer(modelClone);
    for (var i = 0; i < gltf.animations.length; i++) {
      this.animClips[gltf.animations[i].name] = gltf.animations[i];
    }
    this.mixer.update(0);
    this.setAnim('Idle');
  }

  // Zone visuals
  this.buildZoneVisuals(scene);
};

RoosterAgent.prototype.buildZoneVisuals = function(scene) {
  // Ground disc showing zone
  var discGeo = new THREE.CircleGeometry(this.zoneRadius, 48);
  var discMat = new THREE.MeshBasicMaterial({
    color: C.ROOSTER_ZONE_COLOR,
    transparent: true,
    opacity: C.ROOSTER_ZONE_OPACITY,
    side: THREE.DoubleSide,
  });
  this.zoneDisc = new THREE.Mesh(discGeo, discMat);
  this.zoneDisc.rotation.x = -Math.PI / 2;
  this.zoneDisc.position.set(this.zoneCenter.x, 0.02, this.zoneCenter.z);
  scene.add(this.zoneDisc);

  // Zone border ring
  var ringGeo = new THREE.RingGeometry(this.zoneRadius - 0.3, this.zoneRadius, 48);
  var ringMat = new THREE.MeshBasicMaterial({
    color: C.ROOSTER_ZONE_COLOR,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
  });
  this.zoneRing = new THREE.Mesh(ringGeo, ringMat);
  this.zoneRing.rotation.x = -Math.PI / 2;
  this.zoneRing.position.set(this.zoneCenter.x, 0.03, this.zoneCenter.z);
  scene.add(this.zoneRing);
};

// --- Spawn all roosters ---

function spawnRoosters(scene) {
  roosters = [];
  if (!LevelData.roosters || LevelData.roosters.length === 0) return;

  var dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
  var gltfLoader = new THREE.GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  gltfLoader.load(C.ROOSTER_MODEL_PATH, function(gltf) {
    console.log('Rooster GLB scene transform:', 'pos', gltf.scene.position.toArray(), 'rot', gltf.scene.rotation.toArray().slice(0,3));
    roosterModelLoaded = true;
    roosterModelData = gltf;
    for (var i = 0; i < LevelData.roosters.length; i++) {
      var rooster = new RoosterAgent(LevelData.roosters[i], i);
      rooster.buildFromGLTF(scene, gltf);
      rooster.model.position.copy(rooster.position);
      roosters.push(rooster);
    }
  }, undefined, function(err) {
    console.warn('Rooster model not found, using placeholders:', err);
    for (var i = 0; i < LevelData.roosters.length; i++) {
      var rooster = new RoosterAgent(LevelData.roosters[i], i);
      rooster.buildPlaceholder(scene);
      rooster.model.position.copy(rooster.position);
      roosters.push(rooster);
    }
  });
}

// --- Update all roosters ---

function updateAllRoosters(dt) {
  for (var i = 0; i < roosters.length; i++) {
    roosters[i].update(dt, foxState.position);
  }
}

// --- Query: is fox in any rooster zone? ---

function isFoxInRoosterZone() {
  for (var i = 0; i < roosters.length; i++) {
    if (roosters[i].isInZone(foxState.position)) {
      return true;
    }
  }
  return false;
}

// --- Get rooster by id (for howl point repositioning) ---

function getRoosterById(id) {
  for (var i = 0; i < roosters.length; i++) {
    if (roosters[i].id === id) return roosters[i];
  }
  return null;
}
