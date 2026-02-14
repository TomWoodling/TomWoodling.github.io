// ═══ CONFIG ═══
// All tuneable game constants in one place

var C = {
  // Road
  roadWidth:    12,
  chunkLength:  60,
  visibleChunks: 14,

  // Driving
  maxSpeed:     120,       // KPH
  accel:        35,
  brake:        60,
  friction:     15,

  // Steering
  steerSpeed:   2.2,
  steerReturn:  3.0,
  maxSteer:     0.8,

  // Camera
  camSmoothPos: 3.0,
  camSmoothLook:5.0,
  camH:         4.5,
  camDist:      9,

  // Biomes
  biomeDur:     45,

  // Mobile
  swipeSensitivity: 0.008,  // how much horizontal movement → steer
  swipeDeadzone:    5,      // px before steer activates
  autoAccelRate:    0.7,    // fraction of max accel for auto-cruise
  brakeTouchForce:  1.0,    // multiplier for touch-brake
};

// ═══ BIOMES ═══
var BIOMES = {
  countryside: {
    name: 'COUNTRYSIDE',
    fogColor:  new THREE.Color(0x050010),
    skyColor:  new THREE.Color(0x0a0014),
    neonP:     new THREE.Color(0x00ff88),
    neonS:     new THREE.Color(0x00ffff),
    music:     'synth-country.mp3'
  },
  city: {
    name: 'NEON CITY',
    fogColor:  new THREE.Color(0x0a0020),
    skyColor:  new THREE.Color(0x0f0025),
    neonP:     new THREE.Color(0xff00ff),
    neonS:     new THREE.Color(0xff4488),
    music:     'synth-city.mp3'
  },
  beach: {
    name: 'NEON BEACH',
    fogColor:  new THREE.Color(0x000a1a),
    skyColor:  new THREE.Color(0x000a18),
    neonP:     new THREE.Color(0xff8800),
    neonS:     new THREE.Color(0xffaa00),
    music:     'synth-beach.mp3'
  }
};

var biomeOrder = ['countryside', 'city', 'beach'];
