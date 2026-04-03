// dog.js — Guard dog AI FSM, patrol, detection, distraction

var dogs = [];
var dogModel = null;
var dogModelLoaded = false;
var dogsVisible = false;

var DOG_STATES = {
  PATROL:      { anim: 'Walk',       loop: true  },
  PATROL_WAIT: { anim: 'Idle',       loop: true  },
  ALERT:       { anim: 'Idle Alert', loop: true  },
  INVESTIGATE: { anim: 'Fetch',      loop: false },
  SEARCH:      { anim: 'Sneak',      loop: true  },
  CHASE:       { anim: 'Run',        loop: true  },
  WARN:        { anim: 'Bark',       loop: false },
  RETURN:      { anim: 'Walk',       loop: true  },
};

function DogAgent(spawnPos, patrolWaypoints) {
  this.position = spawnPos.clone();
  this.waypoints = patrolWaypoints;
  this.waypointIdx = 0;
  this.state = 'PATROL';
  this.stateTimer = 0;
  this.alertTarget = null;
  this.distractTarget = null;
  this.mixer = null;
  this.currentAnim = null;
  this.currentAction = null;
  this.model = null;
  this.rotation = 0;
  this.animClips = {};
}

DogAgent.prototype.setAnim = function(clipName) {
  if (this.currentAnim === clipName) return;
  this.currentAnim = clipName;

  if (!this.mixer || !this.animClips[clipName]) return;

  var clip = this.animClips[clipName];
  var stateInfo = null;
  for (var key in DOG_STATES) {
    if (DOG_STATES[key].anim === clipName) {
      stateInfo = DOG_STATES[key];
      break;
    }
  }

  var newAction = this.mixer.clipAction(clip);
  newAction.setLoop(stateInfo && stateInfo.loop ? THREE.LoopRepeat : THREE.LoopOnce);
  if (stateInfo && !stateInfo.loop) {
    newAction.clampWhenFinished = true;
  }

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

DogAgent.prototype.moveToward = function(target, speed, dt) {
  if (!target) return;
  var dir = new THREE.Vector3().subVectors(target, this.position);
  dir.y = 0;
  var dist = dir.length();
  if (dist < 0.3) return;
  dir.normalize();
  this.position.addScaledVector(dir, speed * dt);

  // Face movement direction
  this.rotation = Math.atan2(dir.x, dir.z);
};

DogAgent.prototype.reachedWaypoint = function() {
  var wp = this.waypoints[this.waypointIdx];
  var dx = this.position.x - wp.x;
  var dz = this.position.z - wp.z;
  return (dx * dx + dz * dz) < 1.0;
};

DogAgent.prototype.reachedTarget = function(target) {
  if (!target) return false;
  var dx = this.position.x - target.x;
  var dz = this.position.z - target.z;
  return (dx * dx + dz * dz) < 2.0;
};

DogAgent.prototype.distanceTo = function(pos) {
  return this.position.distanceTo(pos);
};

DogAgent.prototype.canDetectFox = function(foxPos) {
  var toFox = new THREE.Vector3().subVectors(foxPos, this.position);
  toFox.y = 0;
  var dist = toFox.length();
  var sneakMult = foxState.isSneaking ? C.DOG_SNEAK_MULT : 1.0;
  var detMult = getDetectionMult();
  sneakMult *= detMult;

  // Hearing range
  if (dist < C.DOG_HEARING_RADIUS * sneakMult) return true;

  // Vision cone
  if (dist < C.DOG_DETECTION_FOR * sneakMult) {
    toFox.normalize();
    var forward = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
    var dot = forward.dot(toFox);
    var halfFOV = (C.DOG_DETECTION_FOV / 2) * (Math.PI / 180);
    if (dot > 0 && Math.acos(Math.min(dot, 1)) < halfFOV) return true;
  }

  return false;
};

DogAgent.prototype.canHearDistraction = function(distractions) {
  for (var i = 0; i < distractions.length; i++) {
    if (this.position.distanceTo(distractions[i].position) < C.DISTRACT_RADIUS * 1.5) {
      return true;
    }
  }
  return false;
};

DogAgent.prototype.nearestDistraction = function(distractions) {
  var nearest = null;
  var nearestDist = Infinity;
  for (var i = 0; i < distractions.length; i++) {
    var d = this.position.distanceTo(distractions[i].position);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = distractions[i].position.clone();
    }
  }
  return nearest;
};

DogAgent.prototype.enterAlert = function(foxPos) {
  this.state = 'ALERT';
  this.stateTimer = 0;
  this.alertTarget = foxPos.clone();
  this.setAnim('Idle Alert');
};

DogAgent.prototype.enterChase = function() {
  this.state = 'CHASE';
  this.stateTimer = 0;
  this.setAnim('Run');
};

DogAgent.prototype.enterSearch = function(lastPos) {
  this.state = 'SEARCH';
  this.stateTimer = 0;
  this.alertTarget = lastPos.clone();
  this.setAnim('Sneak');
};

DogAgent.prototype.enterInvestigate = function(target) {
  this.state = 'INVESTIGATE';
  this.stateTimer = 0;
  this.distractTarget = target;
  this.setAnim('Walk');
};

DogAgent.prototype.enterReturn = function() {
  this.state = 'RETURN';
  this.stateTimer = 0;
  this.setAnim('Walk');
};

DogAgent.prototype.update = function(dt, foxPos, distractions) {
  this.stateTimer += dt;

  switch (this.state) {
    case 'PATROL':
      this.moveToward(this.waypoints[this.waypointIdx], C.DOG_PATROL_SPEED, dt);
      if (this.reachedWaypoint()) {
        this.state = 'PATROL_WAIT';
        this.stateTimer = 0;
        this.setAnim('Idle');
      }
      if (this.canDetectFox(foxPos)) {
        this.enterAlert(foxPos);
      } else if (this.canHearDistraction(distractions)) {
        this.enterInvestigate(this.nearestDistraction(distractions));
      }
      break;

    case 'PATROL_WAIT':
      if (this.stateTimer > 2.0) {
        this.waypointIdx = (this.waypointIdx + 1) % this.waypoints.length;
        this.state = 'PATROL';
        this.setAnim('Walk');
      }
      if (this.canDetectFox(foxPos)) this.enterAlert(foxPos);
      break;

    case 'ALERT':
      if (this.stateTimer > C.DOG_ALERT_DURATION) {
        if (this.distanceTo(foxPos) < C.DOG_DETECTION_FOR) {
          this.enterChase();
        } else {
          this.enterSearch(foxPos);
        }
      }
      break;

    case 'CHASE':
      this.moveToward(foxPos, C.DOG_CHASE_SPEED, dt);
      if (this.distanceTo(foxPos) < 1.5) {
        this.setAnim('Bark');
        events.emit('foxCaught');
        this.state = 'WARN';
        this.stateTimer = 0;
      }
      if (this.stateTimer > C.DOG_CHASE_DURATION) {
        this.enterSearch(foxPos);
      }
      break;

    case 'WARN':
      if (this.stateTimer > 2.0) {
        this.enterReturn();
      }
      break;

    case 'INVESTIGATE':
      this.moveToward(this.distractTarget, C.DOG_PATROL_SPEED, dt);
      if (this.reachedTarget(this.distractTarget)) {
        this.setAnim('Fetch');
        if (this.stateTimer > C.DISTRACT_DURATION) {
          this.enterReturn();
        }
      }
      break;

    case 'SEARCH':
      this.moveToward(this.alertTarget, C.DOG_PATROL_SPEED, dt);
      if (this.canDetectFox(foxPos)) this.enterChase();
      if (this.stateTimer > 8.0) this.enterReturn();
      break;

    case 'RETURN':
      this.moveToward(this.waypoints[this.waypointIdx], C.DOG_RETURN_SPEED, dt);
      if (this.reachedWaypoint()) {
        this.state = 'PATROL';
        this.setAnim('Walk');
      }
      break;
  }

  // Update model position
  if (this.model) {
    this.model.position.copy(this.position);
    this.model.rotation.y = this.rotation;
  }
  if (this.mixer) this.mixer.update(dt);
};

// --- Load dog model and spawn ---

function loadDogModel(scene, onLoaded) {
  buildDogPatrols();

  var dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');

  var gltfLoader = new THREE.GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  gltfLoader.load(C.DOG_MODEL_PATH, function(gltf) {
    dogModel = gltf.scene;
    dogModelLoaded = true;

    // Spawn dogs from patrol data (hidden by default)
    for (var i = 0; i < dogPatrols.length; i++) {
      spawnDog(scene, gltf, dogPatrols[i][0], dogPatrols[i]);
    }

    // Hide all dogs initially — they appear when detection bar fills
    setDogsVisible(false);

    if (onLoaded) onLoaded();
  }, undefined, function(err) {
    console.error('Dog model load error:', err);
    // Create placeholder dogs (hidden by default)
    for (var i = 0; i < dogPatrols.length; i++) {
      spawnPlaceholderDog(scene, dogPatrols[i][0], dogPatrols[i]);
    }
    setDogsVisible(false);
    if (onLoaded) onLoaded();
  });
}

function spawnDog(scene, gltf, spawnPos, waypoints) {
  var dog = new DogAgent(spawnPos, waypoints);

  // Clone model
  var model = gltf.scene.clone();
  model.traverse(function(child) {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(model);
  dog.model = model;

  // Debug marker — red glowing sphere + column of light so dogs are always visible
  var markerGeo = new THREE.SphereGeometry(0.5, 8, 8);
  var markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  var marker = new THREE.Mesh(markerGeo, markerMat);
  marker.position.y = 2.0;
  model.add(marker);
  var dogLight = new THREE.PointLight(0xff3333, 1.5, 10);
  dogLight.position.y = 2.5;
  model.add(dogLight);

  // Set up mixer with cloned animations
  dog.mixer = new THREE.AnimationMixer(model);
  gltf.animations.forEach(function(clip) {
    dog.animClips[clip.name] = clip;
  });
  dog.mixer.update(0);
  dog.setAnim('Walk');

  dogs.push(dog);
}

function spawnPlaceholderDog(scene, spawnPos, waypoints) {
  var dog = new DogAgent(spawnPos, waypoints);
  var model = new THREE.Group();
  var body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.9, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x555566, emissive: 0x111122 })
  );
  body.position.y = 0.55;
  model.add(body);
  var head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x666677, emissive: 0x111122 })
  );
  head.position.set(0, 0.8, 0.7);
  model.add(head);

  // Red eyes
  var eyeGeo = new THREE.SphereGeometry(0.06, 6, 6);
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  var eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.12, 0.9, 0.95);
  model.add(eyeL);
  var eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.12, 0.9, 0.95);
  model.add(eyeR);

  // Debug marker
  var dogLight = new THREE.PointLight(0xff3333, 1.5, 10);
  dogLight.position.y = 2.5;
  model.add(dogLight);

  scene.add(model);
  dog.model = model;
  dogs.push(dog);
}

function updateAllDogs(dt) {
  if (!dogsVisible) return;
  var distractions = getActiveDistractions();
  for (var i = 0; i < dogs.length; i++) {
    dogs[i].update(dt, foxState.position, distractions);
  }
}

// --- Check if any dog is in alert/chase ---

function isAnyDogAlerted() {
  if (!dogsVisible) return false;
  for (var i = 0; i < dogs.length; i++) {
    var s = dogs[i].state;
    if (s === 'ALERT' || s === 'CHASE' || s === 'WARN') return true;
  }
  return false;
}

// --- Activate / deactivate dogs (called by detection system) ---

function setDogsVisible(visible) {
  dogsVisible = visible;
  for (var i = 0; i < dogs.length; i++) {
    if (dogs[i].model) {
      dogs[i].model.visible = visible;
    }
  }
}

function activateDogs() {
  setDogsVisible(true);
  // Reset dogs to chase state toward fox
  for (var i = 0; i < dogs.length; i++) {
    dogs[i].enterChase();
    // Move dogs to a patrol position near the fox for dramatic effect
    if (dogs[i].waypoints.length > 0) {
      dogs[i].position.copy(dogs[i].waypoints[0]);
    }
  }
}

function deactivateDogs() {
  setDogsVisible(false);
  // Reset dogs back to patrol start
  for (var i = 0; i < dogs.length; i++) {
    dogs[i].state = 'PATROL';
    dogs[i].waypointIdx = 0;
    if (dogs[i].waypoints.length > 0) {
      dogs[i].position.copy(dogs[i].waypoints[0]);
    }
    dogs[i].setAnim('Walk');
  }
}

// --- Listen for detection events ---

function setupDogEvents() {
  events.on('dogsSpawn', function() {
    activateDogs();
  });
  events.on('dogsDespawn', function() {
    deactivateDogs();
  });
}
