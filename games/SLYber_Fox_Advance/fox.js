// fox.js — Player controller, physics, animation FSM

var foxModel = null;
var foxMixer = null;
var foxAnimClips = {};
var foxCurrentAction = null;

// Push state (from rooster encounters)
var foxPush = {
  active: false,
  dir: new THREE.Vector3(),
  speed: 0,
  timer: 0,
  duration: 0,
};

var foxState = {
  position:     new THREE.Vector3(0, 0, -20),
  velocity:     new THREE.Vector3(0, 0, 0),
  rotation:     0,
  onGround:     true,
  coyoteTimer:  0,
  animState:    'IDLE',
  idleTimer:    0,
  energy:       C.ENERGY_MAX,
  powerups:     [],
  isSneaking:   false,
  isCaught:     false,
  nearDanger:   false,
};

var FOX_ANIM_STATES = {
  IDLE:       { clip: 'Idle',       loop: true  },
  IDLE_LONG:  { clip: 'Sit',        loop: true  },
  IDLE_TENSE: { clip: 'Idle Alert', loop: true  },
  WALK:       { clip: 'Walk',       loop: true  },
  RUN:        { clip: 'Run',        loop: true  },
  SNEAK:      { clip: 'Sneak',      loop: true  },
  JUMP:       { clip: 'Jump',       loop: false },
  FALL:       { clip: 'Fall',       loop: false },
  BARK:       { clip: 'Bark',       loop: false },
  HOWL:       { clip: 'Howl',       loop: false },
  FETCH:      { clip: 'Fetch',      loop: false },
  DEATH:      { clip: 'Death',      loop: false },
};

// --- Input ---

var input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  shift: false,
  jumpPressed: false,
  jumpHeld: false,
  interact: false,
};

function setupInput() {
  window.addEventListener('keydown', function(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    input.forward = true; break;
      case 'KeyS': case 'ArrowDown':  input.backward = true; break;
      case 'KeyA': case 'ArrowLeft':  input.left = true; break;
      case 'KeyD': case 'ArrowRight': input.right = true; break;
      case 'ShiftLeft': case 'ShiftRight': input.shift = true; break;
      case 'Space':
        if (!input.jumpHeld) input.jumpPressed = true;
        input.jumpHeld = true;
        break;
      case 'KeyE': input.interact = true; break;
    }
  });
  window.addEventListener('keyup', function(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    input.forward = false; break;
      case 'KeyS': case 'ArrowDown':  input.backward = false; break;
      case 'KeyA': case 'ArrowLeft':  input.left = false; break;
      case 'KeyD': case 'ArrowRight': input.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': input.shift = false; break;
      case 'Space': input.jumpHeld = false; break;
    }
  });
}

function getInputDirection() {
  var rawX = 0;
  var rawZ = 0;
  if (input.forward)  rawZ -= 1;
  if (input.backward) rawZ += 1;
  if (input.left)     rawX -= 1;
  if (input.right)    rawX += 1;

  if (rawX === 0 && rawZ === 0) return new THREE.Vector3(0, 0, 0);

  var camForward = new THREE.Vector3(0, 0, -1);
  camForward.applyQuaternion(camera.quaternion);
  camForward.y = 0;
  camForward.normalize();

  var camRight = new THREE.Vector3(1, 0, 0);
  camRight.applyQuaternion(camera.quaternion);
  camRight.y = 0;
  camRight.normalize();

  var dir = new THREE.Vector3(0, 0, 0);
  dir.addScaledVector(camForward, -rawZ);
  dir.addScaledVector(camRight, rawX);
  dir.normalize();
  return dir;
}

// --- Power-up helpers ---

function getSpeedMult() {
  for (var i = 0; i < foxState.powerups.length; i++) {
    if (foxState.powerups[i] === 'speed') return 1.5;
  }
  return 1.0;
}

function getBarkRadiusMult() {
  for (var i = 0; i < foxState.powerups.length; i++) {
    if (foxState.powerups[i] === 'pulse') return 2.0;
  }
  return 1.0;
}

function getBarkCostMult() {
  return 1.0;
}

function getDetectionMult() {
  for (var i = 0; i < foxState.powerups.length; i++) {
    if (foxState.powerups[i] === 'silent') return 0.5;
  }
  return 1.0;
}

// --- Fox danger zone check (based on rooster proximity) ---

function isInDangerZone() {
  if (typeof isFoxInRoosterZone === 'function') {
    return isFoxInRoosterZone();
  }
  return false;
}

// --- Model loading ---

function loadFoxModel(scene, onLoaded) {
  var dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');

  var gltfLoader = new THREE.GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  gltfLoader.load(C.FOX_MODEL_PATH, function(gltf) {
    foxModel = gltf.scene;
    foxModel.scale.set(1, 1, 1);
    foxModel.traverse(function(child) {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(foxModel);

    foxMixer = new THREE.AnimationMixer(foxModel);
    gltf.animations.forEach(function(clip) {
      foxAnimClips[clip.name] = clip;
    });

    foxMixer.update(0);
    setFoxAnim('IDLE', 0);

    if (onLoaded) onLoaded();
  }, undefined, function(err) {
    console.error('Fox model load error:', err);
    foxModel = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.8, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x331100 })
    );
    body.position.y = 0.5;
    foxModel.add(body);
    var head = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.4, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xff8833, emissive: 0x331100 })
    );
    head.position.set(0, 0.7, 0.6);
    foxModel.add(head);
    scene.add(foxModel);
    foxMixer = null;
    if (onLoaded) onLoaded();
  });
}

// --- Animation ---

function setFoxAnim(stateName, crossfade) {
  if (foxState.animState === stateName) return;
  foxState.animState = stateName;

  if (!foxMixer || !foxAnimClips) return;

  var stateInfo = FOX_ANIM_STATES[stateName];
  if (!stateInfo) return;

  var clip = foxAnimClips[stateInfo.clip];
  if (!clip) return;

  var newAction = foxMixer.clipAction(clip);
  newAction.setLoop(stateInfo.loop ? THREE.LoopRepeat : THREE.LoopOnce);
  if (!stateInfo.loop) {
    newAction.clampWhenFinished = true;
  }

  var fadeDuration = crossfade !== undefined ? crossfade : 0.2;

  if (foxCurrentAction) {
    newAction.reset();
    newAction.play();
    foxCurrentAction.crossFadeTo(newAction, fadeDuration, true);
  } else {
    newAction.reset();
    newAction.play();
  }

  foxCurrentAction = newAction;
}

function playAnimOnce(clipName, onDone) {
  if (!foxMixer || !foxAnimClips[clipName]) return;
  var clip = foxAnimClips[clipName];
  var action = foxMixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce);
  action.clampWhenFinished = true;
  action.reset();
  action.play();

  if (foxCurrentAction && foxCurrentAction !== action) {
    foxCurrentAction.crossFadeTo(action, 0.1, true);
  }
  foxCurrentAction = action;

  if (onDone) {
    var listener = function(e) {
      if (e.action === action) {
        foxMixer.removeEventListener('finished', listener);
        onDone();
      }
    };
    foxMixer.addEventListener('finished', listener);
  }
}

// --- Bark / Interact ---

var npcFoxes = [];

function onBark() {
  if (foxState.isCaught || foxPush.active) return;
  if (foxState.energy < C.ENERGY_BARK_COST) return;

  // Check howl points first (special interact)
  if (typeof tryActivateHowlPoint === 'function') {
    if (tryActivateHowlPoint(foxState.position)) {
      foxState.energy -= C.ENERGY_BARK_COST * getBarkCostMult();
      playAnimOnce('Howl', function() {
        setFoxAnim('IDLE', 0.3);
      });
      return;
    }
  }

  foxState.energy -= C.ENERGY_BARK_COST * getBarkCostMult();
  playAnimOnce('Bark');

  var barkRadius = C.DISTRACT_RADIUS * getBarkRadiusMult();

  // Check nearby HRN houses
  for (var i = 0; i < henHouses.length; i++) {
    var hen = henHouses[i];
    if (!hen.locked && !hen.visited) {
      var dist = foxState.position.distanceTo(hen.position);
      if (dist < 5) {
        activateHENHouse(hen);
        return;
      }
    }
  }

  // Check distraction objects
  var distractable = findNearestInRadius(distractObjects, foxState.position, barkRadius);
  if (distractable && !distractable.active) {
    triggerDistraction(distractable);
    return;
  }

  // Check NPC foxes
  var npc = findNearestInRadius(npcFoxes, foxState.position, barkRadius);
  if (npc) {
    DialogueSystem.startConversation(npc.dialogueId || 'npc_fox_1');
    return;
  }
}

function activateHENHouse(hen) {
  hen.visited = true;
  playAnimOnce('Howl', function() {
    setFoxAnim('IDLE', 0.3);
  });

  if (hen.powerupId) {
    foxState.powerups.push(hen.powerupId);
  }

  foxState.energy = C.ENERGY_MAX;

  // Unlock next HRN house
  for (var i = 0; i < henHouses.length; i++) {
    if (henHouses[i].locked) {
      henHouses[i].locked = false;
      if (henHouseObjects[i]) {
        henHouseObjects[i].glow.intensity = 2.0;
        henHouseObjects[i].ring.material.opacity = 0.5;
      }
      break;
    }
  }

  // Check win condition — all HRN houses visited
  var allVisited = true;
  for (var i = 0; i < henHouses.length; i++) {
    if (!henHouses[i].visited) allVisited = false;
  }
  if (allVisited) {
    events.emit('gameWon');
  }
}

// --- Update ---

function updateFox(dt) {
  if (foxState.isCaught) {
    if (foxMixer) foxMixer.update(dt);
    return;
  }

  // Handle push state (being pushed out by rooster)
  if (foxPush.active) {
    foxPush.timer += dt;
    foxState.velocity.x = foxPush.dir.x * foxPush.speed;
    foxState.velocity.z = foxPush.dir.z * foxPush.speed;
    foxState.position.addScaledVector(foxState.velocity, dt);
    resolveCollisions(foxState);

    if (foxPush.timer >= foxPush.duration) {
      foxPush.active = false;
      foxState.velocity.set(0, 0, 0);
    }

    if (foxModel) {
      foxModel.position.copy(foxState.position);
      foxModel.rotation.y = foxState.rotation;
    }
    if (foxMixer) foxMixer.update(dt);
    return;
  }

  // 1. Read input
  var moveDir = getInputDirection();
  var sprinting = input.shift && foxState.energy > 0;
  var inDanger = isInDangerZone();
  var sneaking = inDanger && !sprinting;
  foxState.isSneaking = sneaking;
  foxState.nearDanger = inDanger;

  // 2. Handle interact
  if (input.interact) {
    input.interact = false;
    if (DialogueSystem.active) {
      DialogueSystem.advance();
    } else {
      onBark();
    }
  }

  // 3. Apply movement
  var speed = sneaking ? C.FOX_SNEAK_SPEED :
              sprinting ? C.FOX_RUN_SPEED * getSpeedMult() :
              (moveDir.lengthSq() > 0.01 ? C.FOX_WALK_SPEED : 0);
  foxState.velocity.x = moveDir.x * speed;
  foxState.velocity.z = moveDir.z * speed;

  // 4. Gravity
  if (!foxState.onGround) {
    foxState.velocity.y += C.FOX_GRAVITY * dt;
  }

  // 5. Coyote time
  if (foxState.onGround) {
    foxState.coyoteTimer = C.FOX_COYOTE_MS;
  } else {
    foxState.coyoteTimer -= dt * 1000;
  }

  // 6. Jump
  if (input.jumpPressed && foxState.coyoteTimer > 0) {
    foxState.velocity.y = C.FOX_JUMP_FORCE;
    foxState.onGround = false;
    foxState.coyoteTimer = 0;
  }
  input.jumpPressed = false;

  // 7. Move and collide
  foxState.onGround = false;
  foxState.position.addScaledVector(foxState.velocity, dt);
  resolveCollisions(foxState);

  // 8. Rotate fox toward movement direction
  if (moveDir.lengthSq() > 0.01) {
    var targetAngle = Math.atan2(moveDir.x, moveDir.z);
    foxState.rotation = lerpAngle(foxState.rotation, targetAngle, C.FOX_TURN_SPEED * dt);
    foxState.idleTimer = 0;
  } else {
    foxState.idleTimer += dt;
  }

  // 9. Energy drain/regen
  if (sprinting && moveDir.lengthSq() > 0.01) {
    foxState.energy = Math.max(0, foxState.energy - C.ENERGY_SPRINT_DRAIN * dt);
  } else if (!sprinting) {
    foxState.energy = Math.min(C.ENERGY_MAX, foxState.energy + C.ENERGY_REGEN * dt);
  }

  // 10. Update animation FSM
  updateFoxAnim(dt, sprinting, sneaking, moveDir);

  // 11. Update model transform
  if (foxModel) {
    foxModel.position.copy(foxState.position);
    foxModel.rotation.y = foxState.rotation;
  }

  // 12. Update mixer
  if (foxMixer) foxMixer.update(dt);
}

function updateFoxAnim(dt, sprinting, sneaking, moveDir) {
  var moving = moveDir && moveDir.lengthSq() > 0.01;

  if (foxState.isCaught) {
    setFoxAnim('DEATH', 0);
    return;
  }

  // Don't interrupt one-shot anims
  if (foxState.animState === 'BARK' || foxState.animState === 'HOWL' || foxState.animState === 'FETCH') {
    if (foxCurrentAction && foxCurrentAction.paused) {
      // One-shot finished
    } else {
      return;
    }
  }

  if (!foxState.onGround && foxState.velocity.y > 0.5) {
    setFoxAnim('JUMP', 0);
    return;
  }
  if (!foxState.onGround && foxState.velocity.y < -0.5) {
    setFoxAnim('FALL', 0);
    return;
  }

  if (sneaking && moving) {
    setFoxAnim('SNEAK', 0.2);
    return;
  }
  if (foxState.nearDanger && !moving) {
    setFoxAnim('IDLE_TENSE', 0.2);
    return;
  }
  if (sprinting && moving) {
    setFoxAnim('RUN', 0.2);
    return;
  }
  if (moving) {
    setFoxAnim('WALK', 0.2);
    return;
  }
  if (foxState.idleTimer > 8) {
    setFoxAnim('IDLE_LONG', 0.5);
    return;
  }
  setFoxAnim('IDLE', 0.2);
}

// --- Utility ---

function lerpAngle(a, b, t) {
  var diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * Math.min(t, 1);
}

// --- Death / caught ---

function foxCaught() {
  if (foxState.isCaught) return;
  foxState.isCaught = true;
  setFoxAnim('DEATH', 0);

  setTimeout(function() {
    foxRespawn();
  }, 2500);
}

function foxRespawn() {
  foxState.isCaught = false;
  foxState.position.set(LevelData.playerSpawn.x, 0, LevelData.playerSpawn.z);
  foxState.velocity.set(0, 0, 0);
  foxState.energy = C.ENERGY_MAX;
  foxState.idleTimer = 0;
  foxState.animState = '';
  foxPush.active = false;
  setFoxAnim('IDLE', 0);
}
