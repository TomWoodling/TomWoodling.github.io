// ═══ CONFIG ═══
var C = {
  // Road
  roadWidth:        12,
  segmentLength:    300,
  segmentPoints:    6,
  roadSegments:     60,
  visibleSegments:  5,
  groundExtent:     80,

  // Driving
  maxSpeed:         120,
  accel:            35,
  brake:            60,
  friction:         15,

  // Steering
  steerSpeed:       2.2,
  steerReturn:      3.0,
  maxSteer:         0.8,
  maxLateralOffset: 5,

  // Camera
  camSmoothPos:     3.0,
  camSmoothLook:    5.0,
  camH:             4.5,
  camDist:          9,
  camFovBase:       65,
  camFovSpeed:      12,

  // Biome sequence — each is a boss encounter then transition
  biomeDur:         60,   // seconds per biome before boss sequence starts

  // Mobile
  swipeSensitivity: 0.008,
  swipeDeadzone:    5,
  autoAccelRate:    0.7,
  brakeTouchForce:  1.0,

  // Boost
  boostSpeed:       200,
  boostDuration:    3.0,
  boostCamExtra:    5,
  boostFovExtra:    15,
  boostFrequency:   0.12,

  // Monster
  spiderFollowDist:  15,   // world units behind player
  godzillaFollowDist:55,
  crabSpawnInterval: 8,    // seconds between crab groups

  // Collision
  collisionSlowSpeed:  60,
  collisionCooldown:   1.5,
  collisionCheckDist:  4.0,

  // Warning markers
  warningFadeIn:  0.4,
  warningVisible: 1.8,
  warningFadeOut: 0.3,
};

// ═══ BIOMES ═══
var BIOMES = {
  countryside: {
    name:       'COUNTRYSIDE',
    fogColor:   new THREE.Color(0x050010),
    skyColor:   new THREE.Color(0x0a0014),
    neonP:      new THREE.Color(0x00ff88),
    neonS:      new THREE.Color(0x00ffff),
    roadMark:   new THREE.Color(0x00ff44),
    music:      'synth-country.mp3',
    monster:    'spider',
    transColor: new THREE.Color(0x00ff44),   // green chevrons
  },
  city: {
    name:       'NEON CITY',
    fogColor:   new THREE.Color(0x0a0020),
    skyColor:   new THREE.Color(0x0f0025),
    neonP:      new THREE.Color(0xff00ff),
    neonS:      new THREE.Color(0xff4488),
    roadMark:   new THREE.Color(0xff00ff),
    music:      'synth-city.mp3',
    monster:    'godzilla',
    transColor: new THREE.Color(0xaa00ff),   // purple chevrons
  },
  beach: {
    name:       'NEON BEACH',
    fogColor:   new THREE.Color(0x000a1a),
    skyColor:   new THREE.Color(0x000a18),
    neonP:      new THREE.Color(0xff8800),
    neonS:      new THREE.Color(0xffaa00),
    roadMark:   new THREE.Color(0xff6600),
    music:      'synth-beach.mp3',
    monster:    'crabs',
    transColor: new THREE.Color(0xff6600),   // orange chevrons
  }
};

var biomeOrder = ['countryside', 'city', 'beach'];
