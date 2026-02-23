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

  // Monster — time between encounters (seconds of clean driving)
  monsterCooldown:  60,

  // Monster follow distances
  spiderFollowDist:  12,
  godzillaFollowDist:55,
  crabSpawnInterval: 8,

  // Collision
  collisionSlowSpeed:  60,
  collisionCooldown:   1.5,
  collisionCheckDist:  4.0,

  // Warning markers
  warningFadeIn:  0.4,
  warningVisible: 1.8,
  warningFadeOut: 0.3,
};

// ═══ PALETTES ═══
// fogColor is the tint blended INTO the sky base — keep it visible (not near-black).
var PALETTES = [
  {
    id:         'countryside',
    fogColor:   new THREE.Color(0x1a0050),  // deep violet
    groundTint: new THREE.Color(0x001a10),  // dark green ground
    neonP:      new THREE.Color(0x00ff88),
    neonS:      new THREE.Color(0x00ffff),
  },
  {
    id:         'city',
    fogColor:   new THREE.Color(0x280040),  // deep magenta-purple
    groundTint: new THREE.Color(0x1a0030),  // dark purple ground
    neonP:      new THREE.Color(0xff00ff),
    neonS:      new THREE.Color(0xff4488),
  },
  {
    id:         'beach',
    fogColor:   new THREE.Color(0x200a00),  // deep amber
    groundTint: new THREE.Color(0x150800),  // dark sand ground
    neonP:      new THREE.Color(0xff8800),
    neonS:      new THREE.Color(0xffaa00),
  },
  {
    id:         'alien',
    fogColor:   new THREE.Color(0x220050),  // electric purple
    groundTint: new THREE.Color(0x10002a),  // void purple ground
    neonP:      new THREE.Color(0xaa00ff),
    neonS:      new THREE.Color(0xff00cc),
  },
  {
    id:         'mountain',
    fogColor:   new THREE.Color(0x001830),  // deep teal-blue
    groundTint: new THREE.Color(0x000e20),  // dark blue ground
    neonP:      new THREE.Color(0x00ccff),
    neonS:      new THREE.Color(0x0066ff),
  },
  {
    id:         'techno',
    fogColor:   new THREE.Color(0x251800),  // deep gold-amber
    groundTint: new THREE.Color(0x180e00),  // dark gold ground
    neonP:      new THREE.Color(0xffff00),
    neonS:      new THREE.Color(0xff8800),
  },
];

// Sky colour — must be visibly coloured so lerp produces a readable sky.
var SKY_BASE    = new THREE.Color(0x2a0550);  // synthwave purple dusk
var SKY_HORIZON = new THREE.Color(0x6a1030);  // warm magenta-rose

// ═══ PROP TYPES ═══
// Which scenery props can appear on any segment.
// Add entries here to make new prop types available everywhere.
var PROP_TYPES = ['tree', 'building', 'palm'];

// ═══ MUSIC PLAYLIST ═══
// Tracks played in order, looping. Shuffle flag randomises on init.
var PLAYLIST = {
  tracks: [
    'synth-country.mp3',
    'synth-city.mp3',
    'synth-beach.mp3',
    'synth-alien.mp3',
    'synth-mountain.mp3',
    'synth-techno.mp3',
  ],
  shuffle: false,   // set true to randomise order on game start
  crossfade: 3.0,   // seconds to fade between tracks
};

// ═══ MONSTER ROSTER ═══
// Which monster keys cycle through encounters.
// Order determines sequence; manager cycles round-robin.
var MONSTER_ROSTER = ['spider', 'godzilla', 'crabs'];
