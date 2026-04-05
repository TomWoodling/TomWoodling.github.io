// scout.js — Scout the Cyberdog NPC: stands in the exterior hub, gives mission briefings
// Uses the same GLB loading pattern as hen.js — Draco compressed, idle/walk anims

var scoutDog = null;         // single ScoutDog instance
var scoutModelData = null;   // cached gltf for reuse

function ScoutDog(config) {
  this.id = config.id || 'scout';
  this.position = new THREE.Vector3(config.x, 0, config.z);
  this.rotation = 0;
  this.dialogueId = config.dialogueId || '';
  this.completionDialogueId = config.completionDialogueId || '';
  this.model = null;
  this.mixer = null;
  this.animClips = {};
  this.currentAnim = null;
  this.currentAction = null;
  this.glowLight = null;
  this.stateTimer = 0;
}

ScoutDog.prototype.buildPlaceholder = function() {
  var group = new THREE.Group();

  // Body — larger than a hen, blue-grey metallic
  var bodyGeo = new THREE.BoxGeometry(0.7, 0.9, 1.4);
  var bodyMat = new THREE.MeshStandardMaterial({
    color: 0x556688,
    emissive: 0x112233,
    roughness: 0.4,
    metalness: 0.6,
  });
  var body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  // Head
  var headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.6);
  var headMat = new THREE.MeshStandardMaterial({
    color: 0x667799,
    emissive: 0x112233,
    roughness: 0.4,
    metalness: 0.6,
  });
  var head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 0.9, 0.7);
  head.castShadow = true;
  group.add(head);

  // Eyes — friendly cyan glow (not red like enemies)
  var eyeGeo = new THREE.SphereGeometry(0.06, 6, 6);
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
  var eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.12, 0.95, 0.95);
  group.add(eyeL);
  var eyeR = eyeL.clone();
  eyeR.position.x = 0.12;
  group.add(eyeR);

  // Tail (wagging slightly via update)
  var tailGeo = new THREE.BoxGeometry(0.1, 0.1, 0.4);
  var tailMat = new THREE.MeshStandardMaterial({ color: 0x556688, emissive: 0x112233 });
  this.tailMesh = new THREE.Mesh(tailGeo, tailMat);
  this.tailMesh.position.set(0, 0.7, -0.65);
  group.add(this.tailMesh);

  // Glow light — friendly cyan
  this.glowLight = new THREE.PointLight(0x00ffcc, 0.8, 8);
  this.glowLight.position.y = 1.5;
  group.add(this.glowLight);

  // Name tag floating above
  var tagGeo = new THREE.PlaneGeometry(1.4, 0.4);
  var canvas = document.createElement('canvas');
  canvas.width = 140;
  canvas.height = 40;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 140, 40);
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#00ffcc';
  ctx.textAlign = 'center';
  ctx.fillText('SCOUT [E]', 70, 28);
  var tagTex = new THREE.CanvasTexture(canvas);
  var tagMat = new THREE.MeshBasicMaterial({ map: tagTex, transparent: true, opacity: 0.85 });
  this.tagMesh = new THREE.Mesh(tagGeo, tagMat);
  this.tagMesh.position.y = 2.0;
  group.add(this.tagMesh);

  this.model = group;
};

ScoutDog.prototype.buildFromGLTF = function(gltf) {
  var group = new THREE.Group();

  var modelClone = THREE.SkeletonUtils
    ? THREE.SkeletonUtils.clone(gltf.scene)
    : gltf.scene.clone();

  modelClone.scale.set(1, 1, 1);
  modelClone.traverse(function(child) {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  group.add(modelClone);

  // Glow light
  this.glowLight = new THREE.PointLight(0x00ffcc, 0.8, 8);
  this.glowLight.position.y = 1.5;
  group.add(this.glowLight);

  // Name tag
  var tagGeo = new THREE.PlaneGeometry(1.4, 0.4);
  var canvas = document.createElement('canvas');
  canvas.width = 140;
  canvas.height = 40;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 140, 40);
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#00ffcc';
  ctx.textAlign = 'center';
  ctx.fillText('SCOUT [E]', 70, 28);
  var tagTex = new THREE.CanvasTexture(canvas);
  var tagMat = new THREE.MeshBasicMaterial({ map: tagTex, transparent: true, opacity: 0.85 });
  this.tagMesh = new THREE.Mesh(tagGeo, tagMat);
  this.tagMesh.position.y = 2.0;
  group.add(this.tagMesh);

  this.model = group;

  // Animation
  if (gltf.animations && gltf.animations.length > 0) {
    this.mixer = new THREE.AnimationMixer(modelClone);
    for (var i = 0; i < gltf.animations.length; i++) {
      this.animClips[gltf.animations[i].name] = gltf.animations[i];
    }
    this.mixer.update(0);
    this.setAnim('Idle');
  }
};

ScoutDog.prototype.setAnim = function(clipName) {
  if (this.currentAnim === clipName) return;
  this.currentAnim = clipName;
  if (!this.mixer) return;

  var clip = this.animClips[clipName] || this.animClips[clipName.toLowerCase()];
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

ScoutDog.prototype.update = function(dt) {
  this.stateTimer += dt;

  // Face toward fox if nearby
  if (typeof foxState !== 'undefined') {
    var dx = foxState.position.x - this.position.x;
    var dz = foxState.position.z - this.position.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 8 && dist > 0.5) {
      var targetRot = Math.atan2(dx, dz);
      this.rotation = lerpAngle(this.rotation, targetRot, 2.0 * dt);
    }
  }

  // Gentle glow pulse
  if (this.glowLight) {
    this.glowLight.intensity = 0.6 + Math.sin(this.stateTimer * 1.5) * 0.2;
  }

  // Wag tail (placeholder only)
  if (this.tailMesh) {
    this.tailMesh.rotation.y = Math.sin(this.stateTimer * 6) * 0.4;
  }

  // Billboard name tag
  if (this.tagMesh && typeof camera !== 'undefined') {
    this.tagMesh.lookAt(camera.position);
  }

  // Update model
  if (this.model) {
    this.model.position.copy(this.position);
    this.model.rotation.y = this.rotation;
  }
  if (this.mixer) this.mixer.update(dt);
};

// ============================================================
//  SPAWN / DESPAWN
// ============================================================

function spawnScoutDog(scene, config) {
  if (!config) return;

  scoutDog = new ScoutDog(config);

  var dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
  var gltfLoader = new THREE.GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  if (scoutModelData) {
    // Reuse cached model
    scoutDog.buildFromGLTF(scoutModelData);
    scene.add(scoutDog.model);
    scoutDog.model.position.copy(scoutDog.position);
    // Register as NPC fox can interact with
    registerScoutAsNPC();
    return;
  }

  gltfLoader.load(C.DOG_MODEL_PATH, function(gltf) {
    scoutModelData = gltf;
    scoutDog.buildFromGLTF(gltf);
    scene.add(scoutDog.model);
    scoutDog.model.position.copy(scoutDog.position);
    registerScoutAsNPC();
  }, undefined, function(err) {
    console.warn('Scout dog model not found, using placeholder:', err);
    scoutDog.buildPlaceholder();
    scene.add(scoutDog.model);
    scoutDog.model.position.copy(scoutDog.position);
    registerScoutAsNPC();
  });
}

function registerScoutAsNPC() {
  // Register Scout in the npcFoxes array so the fox's bark/interact system can find it
  if (typeof npcFoxes !== 'undefined' && scoutDog) {
    npcFoxes.push({
      position: scoutDog.position,
      dialogueId: scoutDog.dialogueId,
    });
  }
}

function despawnScoutDog() {
  if (scoutDog && scoutDog.model && scoutDog.model.parent) {
    scoutDog.model.parent.remove(scoutDog.model);
  }
  scoutDog = null;
  // Clear Scout from npcFoxes
  if (typeof npcFoxes !== 'undefined') {
    for (var i = npcFoxes.length - 1; i >= 0; i--) {
      if (npcFoxes[i].dialogueId && npcFoxes[i].dialogueId.indexOf('district_') === 0) {
        npcFoxes.splice(i, 1);
      }
    }
  }
}

function updateScoutDog(dt) {
  if (scoutDog) scoutDog.update(dt);
}
