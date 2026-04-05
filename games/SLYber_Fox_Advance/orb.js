// orb.js — Colored orb enemies: Red (patrol), Blue (area), Yellow (timed), Green (safe zone)

var orbs = [];
var greenSafeZones = [];
var foxInSafeZone = false;

// --- OrbAgent constructor ---

function OrbAgent(config) {
  this.type = config.type;
  this.position = new THREE.Vector3(config.x, 1.5, config.z);
  this.active = true;
  this.rotation = 0;
  this.stateTimer = 0;
  this.waypointIdx = 0;
  this.model = new THREE.Group();

  // Type-specific setup
  switch (this.type) {
    case 'red':
      this.waypoints = [];
      var wps = config.waypoints || [];
      for (var i = 0; i < wps.length; i++) {
        this.waypoints.push(new THREE.Vector3(wps[i].x, 1.5, wps[i].z));
      }
      this.speed = C.ORB_RED_SPEED;
      this.detectRange = C.ORB_RED_DETECT_RANGE;
      this.detectRate = C.ORB_RED_DETECT_RATE;
      this.buildRedVisual();
      break;
    case 'blue':
      this.detectRange = C.ORB_BLUE_DETECT_RANGE;
      this.detectRate = C.ORB_BLUE_DETECT_RATE;
      this.buildBlueVisual();
      break;
    case 'yellow':
      this.detectRange = C.ORB_YELLOW_DETECT_RANGE;
      this.detectRate = C.ORB_YELLOW_DETECT_RATE;
      this.onDuration = config.onDuration || C.ORB_YELLOW_ON_DURATION;
      this.offDuration = config.offDuration || C.ORB_YELLOW_OFF_DURATION;
      this.cycleTimer = 0;
      this.buildYellowVisual();
      break;
    case 'green':
      this.safeRadius = config.radius || C.ORB_GREEN_SAFE_RADIUS;
      this.detectRange = 0;
      this.detectRate = 0;
      this.buildGreenVisual();
      break;
  }

  this.model.position.copy(this.position);
}

// --- Red Orb: patrol with orbiting mini-spheres ---

OrbAgent.prototype.buildRedVisual = function() {
  // Core sphere
  var coreGeo = new THREE.SphereGeometry(0.4, 12, 12);
  var coreMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
  this.model.add(this.coreMesh);

  // Orbiting mini-spheres
  var miniGeo = new THREE.SphereGeometry(0.12, 8, 8);
  var miniMat = new THREE.MeshBasicMaterial({ color: 0xff6666 });
  this.orbit1 = new THREE.Mesh(miniGeo, miniMat);
  this.orbit2 = new THREE.Mesh(miniGeo, miniMat);
  this.model.add(this.orbit1);
  this.model.add(this.orbit2);

  // Red glow light
  this.glowLight = new THREE.PointLight(0xff3333, 1.5, 8);
  this.model.add(this.glowLight);
};

// --- Blue Orb: stationary with rotating ring ---

OrbAgent.prototype.buildBlueVisual = function() {
  // Core sphere
  var coreGeo = new THREE.SphereGeometry(0.6, 12, 12);
  var coreMat = new THREE.MeshBasicMaterial({ color: 0x2266ff, transparent: true, opacity: 0.9 });
  this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
  this.model.add(this.coreMesh);

  // Rotating detection ring
  var ringGeo = new THREE.RingGeometry(0.9, 1.1, 32);
  var ringMat = new THREE.MeshBasicMaterial({
    color: 0x4488ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
  });
  this.ring = new THREE.Mesh(ringGeo, ringMat);
  this.model.add(this.ring);

  // Outer detection radius indicator (on ground)
  var rangeGeo = new THREE.RingGeometry(this.detectRange - 0.3, this.detectRange, 48);
  var rangeMat = new THREE.MeshBasicMaterial({
    color: 0x2244aa, transparent: true, opacity: 0.06, side: THREE.DoubleSide,
  });
  this.rangeRing = new THREE.Mesh(rangeGeo, rangeMat);
  this.rangeRing.rotation.x = -Math.PI / 2;
  this.rangeRing.position.y = -1.45;
  this.model.add(this.rangeRing);

  // Blue glow
  this.glowLight = new THREE.PointLight(0x3366ff, 1.2, 12);
  this.model.add(this.glowLight);
};

// --- Yellow Orb: timed toggle with clock hand ---

OrbAgent.prototype.buildYellowVisual = function() {
  // Core sphere
  var coreGeo = new THREE.SphereGeometry(0.4, 12, 12);
  this.coreMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  this.coreMesh = new THREE.Mesh(coreGeo, this.coreMat);
  this.model.add(this.coreMesh);

  // Clock hand indicator
  var handGeo = new THREE.BoxGeometry(0.05, 0.05, 0.8);
  var handMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
  this.clockHand = new THREE.Mesh(handGeo, handMat);
  this.clockHand.position.z = 0.4;
  this.clockPivot = new THREE.Group();
  this.clockPivot.add(this.clockHand);
  this.model.add(this.clockPivot);

  // Yellow glow
  this.glowLight = new THREE.PointLight(0xffaa00, 1.2, 8);
  this.model.add(this.glowLight);
};

// --- Green Orb: safe zone with ground disc ---

OrbAgent.prototype.buildGreenVisual = function() {
  // Core sphere
  var coreGeo = new THREE.SphereGeometry(0.5, 12, 12);
  var coreMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
  this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
  this.model.add(this.coreMesh);

  // Safe zone ground disc
  var discGeo = new THREE.CircleGeometry(this.safeRadius, 48);
  var discMat = new THREE.MeshBasicMaterial({
    color: 0x00ff66, transparent: true, opacity: 0.08, side: THREE.DoubleSide,
  });
  this.safeDisc = new THREE.Mesh(discGeo, discMat);
  this.safeDisc.rotation.x = -Math.PI / 2;
  this.safeDisc.position.y = -1.45;
  this.model.add(this.safeDisc);

  // Safe zone border ring
  var ringGeo = new THREE.RingGeometry(this.safeRadius - 0.2, this.safeRadius, 48);
  var ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ff66, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
  });
  this.safeRing = new THREE.Mesh(ringGeo, ringMat);
  this.safeRing.rotation.x = -Math.PI / 2;
  this.safeRing.position.y = -1.44;
  this.model.add(this.safeRing);

  // Green glow
  this.glowLight = new THREE.PointLight(0x00ff66, 1.0, 10);
  this.model.add(this.glowLight);
};

// --- Update methods ---

OrbAgent.prototype.update = function(dt, foxPos) {
  this.stateTimer += dt;
  var detection = 0;

  switch (this.type) {
    case 'red':
      detection = this.updateRed(dt, foxPos);
      break;
    case 'blue':
      detection = this.updateBlue(dt, foxPos);
      break;
    case 'yellow':
      detection = this.updateYellow(dt, foxPos);
      break;
    case 'green':
      this.updateGreen(dt, foxPos);
      break;
  }

  // Update model position
  this.model.position.copy(this.position);

  return detection;
};

OrbAgent.prototype.updateRed = function(dt, foxPos) {
  // Patrol waypoints
  if (this.waypoints.length > 0) {
    var target = this.waypoints[this.waypointIdx];
    var dir = new THREE.Vector3().subVectors(target, this.position);
    dir.y = 0;
    var dist = dir.length();
    if (dist < 0.5) {
      this.waypointIdx = (this.waypointIdx + 1) % this.waypoints.length;
    } else {
      dir.normalize();
      this.position.addScaledVector(dir, this.speed * dt);
      this.rotation = Math.atan2(dir.x, dir.z);
    }
  }

  // Animate orbiting spheres
  var t = this.stateTimer * 3;
  this.orbit1.position.set(Math.cos(t) * 0.7, Math.sin(t * 0.7) * 0.2, Math.sin(t) * 0.7);
  this.orbit2.position.set(Math.cos(t + Math.PI) * 0.7, Math.sin(t * 0.7 + 1) * 0.2, Math.sin(t + Math.PI) * 0.7);

  // Detection: forward cone
  return this.detectCone(foxPos);
};

OrbAgent.prototype.updateBlue = function(dt, foxPos) {
  // Rotate ring
  this.ring.rotation.x += dt * 1.5;
  this.ring.rotation.y += dt * 0.8;

  // Pulse glow
  var pulse = 1.0 + Math.sin(this.stateTimer * 2) * 0.3;
  this.glowLight.intensity = pulse;

  // Detection: 360-degree radius
  return this.detect360(foxPos);
};

OrbAgent.prototype.updateYellow = function(dt, foxPos) {
  this.cycleTimer += dt;
  var cycleDuration = this.active ? this.onDuration : this.offDuration;

  if (this.cycleTimer >= cycleDuration) {
    this.cycleTimer = 0;
    this.active = !this.active;
  }

  // Rotate clock hand to show cycle progress
  var progress = this.cycleTimer / cycleDuration;
  this.clockPivot.rotation.y = progress * Math.PI * 2;

  // Visual feedback for active/inactive
  if (this.active) {
    this.coreMat.color.setHex(0xffcc00);
    this.coreMesh.scale.setScalar(1.0);
    this.glowLight.intensity = 1.2;
    this.glowLight.color.setHex(0xffaa00);
  } else {
    this.coreMat.color.setHex(0x555544);
    this.coreMesh.scale.setScalar(0.6);
    this.glowLight.intensity = 0.2;
    this.glowLight.color.setHex(0x666644);
  }

  // Detection only when active
  if (this.active) {
    return this.detect360(foxPos);
  }
  return 0;
};

OrbAgent.prototype.updateGreen = function(dt, foxPos) {
  // Gentle vertical bob
  this.position.y = 1.5 + Math.sin(this.stateTimer * 1.5) * 0.2;

  // Pulse glow
  var pulse = 0.8 + Math.sin(this.stateTimer * 2) * 0.3;
  this.glowLight.intensity = pulse;

  // Pulse safe disc opacity
  this.safeDisc.material.opacity = 0.06 + Math.sin(this.stateTimer * 1.5) * 0.03;

  // Check if fox is in safe zone
  var dx = foxPos.x - this.position.x;
  var dz = foxPos.z - this.position.z;
  if (Math.sqrt(dx * dx + dz * dz) < this.safeRadius) {
    foxInSafeZone = true;
  }
};

// --- Detection helpers ---

OrbAgent.prototype.detect360 = function(foxPos) {
  var dx = foxPos.x - this.position.x;
  var dz = foxPos.z - this.position.z;
  var dist = Math.sqrt(dx * dx + dz * dz);

  var sneakMult = foxState.isSneaking ? C.DOG_SNEAK_MULT : 1.0;
  var detMult = getDetectionMult();
  var effectiveRange = this.detectRange * sneakMult * detMult;

  if (dist < effectiveRange) {
    return this.detectRate;
  }
  return 0;
};

OrbAgent.prototype.detectCone = function(foxPos) {
  var toFox = new THREE.Vector3().subVectors(foxPos, this.position);
  toFox.y = 0;
  var dist = toFox.length();

  var sneakMult = foxState.isSneaking ? C.DOG_SNEAK_MULT : 1.0;
  var detMult = getDetectionMult();

  // Hearing range (small 360-degree radius)
  var hearRange = (this.detectRange * 0.5) * sneakMult * detMult;
  if (dist < hearRange) {
    return this.detectRate;
  }

  // Vision cone
  var effectiveRange = this.detectRange * sneakMult * detMult;
  if (dist < effectiveRange) {
    toFox.normalize();
    var forward = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
    var dot = forward.dot(toFox);
    var halfFOV = (C.ORB_RED_FOV / 2) * (Math.PI / 180);
    if (dot > 0 && Math.acos(Math.min(dot, 1)) < halfFOV) {
      return this.detectRate;
    }
  }
  return 0;
};

// --- Spawn and update all orbs ---

function spawnOrbs(scene) {
  orbs = [];
  greenSafeZones = [];
  for (var i = 0; i < LevelData.orbs.length; i++) {
    var orb = new OrbAgent(LevelData.orbs[i]);
    scene.add(orb.model);
    orbs.push(orb);
    if (orb.type === 'green') {
      greenSafeZones.push(orb);
    }
  }
}

function updateAllOrbs(dt) {
  foxInSafeZone = false;
  var totalDetection = 0;
  for (var i = 0; i < orbs.length; i++) {
    totalDetection += orbs[i].update(dt, foxState.position);
  }
  return totalDetection;
}
