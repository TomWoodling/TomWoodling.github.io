// config.js — All tuneable constants for Helicopter City
// =========================================================

var C = {
  // City grid
  GRID_CELLS:       20,        // NxN city grid
  BLOCK_SIZE:       40,        // world units per block
  STREET_WIDTH:     10,        // world units per street
  CITY_HALF:        0,         // computed below

  // Building generation
  BLDG_MIN_HEIGHT:  8,
  BLDG_MAX_HEIGHT:  80,
  BLDG_MIN_W:       12,
  BLDG_MAX_W:       32,
  HELIPAD_CHANCE:   0.12,      // probability a tall building gets a helipad
  HELIPAD_MIN_H:    30,        // min building height to be eligible

  // Helicopter physics
  HELI_HOVER_GRAVITY:   4.0,   // downward pull when not thrusting up
  HELI_THRUST:          14.0,  // upward thrust force
  HELI_LATERAL:         10.0,  // horizontal movement force
  HELI_DRAG:            0.88,  // velocity damping per frame (lerp factor)
  HELI_TILT_MAX:        0.28,  // max body tilt in radians
  HELI_TILT_SPEED:      4.0,   // tilt lerp speed
  HELI_ROTOR_SPEED:     8.0,   // rotor disc spin speed (radians/sec)
  HELI_START_HEIGHT:    25.0,
  HELI_COLLISION_RADIUS:2.2,
  HELI_LAND_SPEED:      3.0,   // max descent speed for safe landing
  HELI_BOUNCE_FORCE:    0.6,   // velocity reflection on building hit

  // Camera
  CAM_OFFSET:       new THREE.Vector3(0, 8, 22),
  CAM_LAG:          0.06,      // lerp factor — lower = more lag
  CAM_ROT_LAG:      0.04,

  // Traffic
  TRAFFIC_COUNT:    70,
  CAR_SPEED:        8.0,
  CAR_SPEED_VAR:    4.0,       // random speed variance
  GRIDLOCK_DURATION:25,        // seconds a gridlock event lasts
  GRIDLOCK_RADIUS:  60,        // world units affected

  // AI helicopters
  AI_HELI_COUNT:    3,
  AI_HELI_SPEED:    12.0,
  AI_HELI_HEIGHT_MIN: 30,
  AI_HELI_HEIGHT_MAX: 60,

  // Missions
  MISSION_INTERVAL_MIN: 30,    // seconds between mission spawns
  MISSION_INTERVAL_MAX: 60,
  MISSION_EXPIRE:       120,   // seconds before unaccepted mission expires
  POLICE_MISSION_TIERS: [
    { label: 'Misdemeanour', time: 60,  color: 0x00ffff  },
    { label: 'Felony',       time: 45,  color: 0xff8800  },
    { label: 'Emergency',    time: 30,  color: 0xff0033  },
  ],

  // Rotor disc
  ROTOR_RADIUS:     2.4,
  ROTOR_OPACITY:    0.55,
  TAIL_ROTOR_RADIUS:0.55,

  // World boundary (soft push)
  WORLD_BOUNDARY_PUSH: 0.8,    // force magnitude at boundary
};

// Derived
C.CELL_STRIDE  = C.BLOCK_SIZE + C.STREET_WIDTH;
C.CITY_HALF    = (C.GRID_CELLS * C.CELL_STRIDE) / 2;

// ─── Colour Palettes ──────────────────────────────────────────────────────────
// Rule: no single channel below 0x18 — see shader bug notes
var PALETTES = [
  {
    id:         'downtown',
    fogColor:   new THREE.Color(0x280040),
    groundTint: new THREE.Color(0x1a0030),
    neonP:      new THREE.Color(0xff00ff),
    neonS:      new THREE.Color(0x00ffff),
    buildingTint: new THREE.Color(0x1a1228),
  },
  {
    id:         'industrial',
    fogColor:   new THREE.Color(0x201030),
    groundTint: new THREE.Color(0x150820),
    neonP:      new THREE.Color(0xff4400),
    neonS:      new THREE.Color(0xffcc00),
    buildingTint: new THREE.Color(0x1a1010),
  },
  {
    id:         'waterfront',
    fogColor:   new THREE.Color(0x102040),
    groundTint: new THREE.Color(0x0a1530),
    neonP:      new THREE.Color(0x00ffcc),
    neonS:      new THREE.Color(0xff00aa),
    buildingTint: new THREE.Color(0x0f1a20),
  },
];

var ACTIVE_PALETTE = PALETTES[0];

// ─── Sky ──────────────────────────────────────────────────────────────────────
var SKY_BASE    = new THREE.Color(0x2a0550);
var SKY_HORIZON = new THREE.Color(0x6a1030);

// ─── Music playlist ───────────────────────────────────────────────────────────
var PLAYLIST = {
  tracks:    ['audio/track1.mp3', 'audio/track2.mp3'],
  shuffle:   true,
  crossfade: 3.0,
};

// ─── Mission types ────────────────────────────────────────────────────────────
var MISSION_TYPES = [
  { id: 'news_fire',      label: '🔥 Structure Fire',       variant: 'news',   points: 100 },
  { id: 'news_protest',   label: '📢 Protest Downtown',      variant: 'news',   points: 80  },
  { id: 'news_accident',  label: '🚗 Traffic Incident',      variant: 'news',   points: 60  },
  { id: 'news_breaking',  label: '📡 Breaking Story',        variant: 'news',   points: 120 },
  { id: 'police_pursuit', label: '🚨 Vehicle Pursuit',       variant: 'police', tier: 0, points: 150 },
  { id: 'police_felony',  label: '🚨 Felony in Progress',    variant: 'police', tier: 1, points: 250 },
  { id: 'police_emergency',label:'🚨 Officer Needs Assist',  variant: 'police', tier: 2, points: 400 },
];
