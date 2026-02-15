// ═══ CONFIG ═══
// All tuneable game constants

var C = {
  // Road — spline-based
  roadWidth:      12,
  segmentLength:  300,      // approx length of each spline segment
  segmentPoints:  6,        // control points per segment
  roadSegments:   60,       // mesh subdivisions per spline segment
  visibleSegments: 5,       // number of road segments to keep alive
  groundExtent:   80,       // ground grid width each side

  // Driving
  maxSpeed:       120,      // KPH
  accel:          35,
  brake:          60,
  friction:       15,

  // Steering
  steerSpeed:     2.2,
  steerReturn:    3.0,
  maxSteer:       0.8,
  maxLateralOffset: 5,      // max distance from road center

  // Camera
  camSmoothPos:   3.0,
  camSmoothLook:  5.0,
  camH:           4.5,
  camDist:        9,
  camFovBase:     65,
  camFovSpeed:    12,       // added at max speed

  // Biomes
  biomeDur:       45,

  // Mobile
  swipeSensitivity: 0.008,
  swipeDeadzone:    5,
  autoAccelRate:    0.7,
  brakeTouchForce:  1.0,

  // Junctions
  junctionAngle:    0.4,      // radians for branch curves
  junctionWarning:  0.85,     // t value when arrows appear
  junctionChoice:   0.95,     // t value when choice is locked

  // Boost
  boostSpeed:       180,      // KPH during boost
  boostDuration:    3.0,      // seconds
  boostCamExtra:    5,        // extra camera distance during boost
  boostFovExtra:    15,       // extra FOV during boost
  boostFrequency:   0.15,     // chance per segment of a boost chevron

  // Traffic
  trafficPerSegment: 2,       // max traffic cars per segment
  trafficSpeed:      0.4,     // fraction of player max speed
  trafficSpawnChance: 0.5,    // chance per segment

  // Cutscene (zone transition)
  cutsceneDuration:  3.5,     // seconds
  cutsceneCamHeight: 18,      // camera Y during cutscene
  cutsceneCamDist:   25,      // camera distance during cutscene
  cutsceneCamOrbit:  0.6,     // radians of orbit during cutscene
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
