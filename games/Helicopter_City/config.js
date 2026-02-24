// config.js — All tuneable constants for Helicopter City
// =========================================================

var C = {
  // City grid
  GRID_CELLS:       20,
  BLOCK_SIZE:       40,
  STREET_WIDTH:     10,
  CITY_HALF:        0,         // computed below

  // Building generation
  BLDG_MIN_HEIGHT:  8,
  BLDG_MAX_HEIGHT:  80,
  BLDG_MIN_W:       12,
  BLDG_MAX_W:       32,
  HELIPAD_CHANCE:   0.12,
  HELIPAD_MIN_H:    30,

  // ── Helicopter physics ────────────────────────────────────────────────────
  HELI_HOVER_GRAVITY:   4.0,   // downward pull when not thrusting up
  HELI_THRUST:          14.0,  // upward thrust force
  HELI_LATERAL:         10.0,  // horizontal movement force
  HELI_DRAG:            0.88,  // velocity damping (per frame lerp factor)
  HELI_TILT_MAX:        0.22,  // max body tilt radians
  HELI_TILT_SPEED:      4.0,   // tilt lerp speed
  HELI_ROTOR_SPEED:     8.0,   // rotor disc spin speed (rad/s)
  HELI_START_HEIGHT:    25.0,
  HELI_COLLISION_RADIUS:2.5,
  HELI_LAND_SPEED:      3.0,
  HELI_BOUNCE_FORCE:    0.5,

  // ── Rotor disc placement (tune these from console output after first load) ─
  // These are offsets in MODEL-LOCAL space (pre-Math.PI correction).
  // After load, console prints the model bounding box — set these accordingly.
  // Main rotor Y = box.max.y + this offset (above fuselage roof)
  ROTOR_Y_ABOVE_TOP:    0.25,
  // Tail rotor Z = box.min.z + this offset (negative = further back)
  TAIL_ROTOR_Z_BEHIND:  0.0,
  // Tail rotor height = box.max.y * this factor
  TAIL_ROTOR_HEIGHT_FACTOR: 0.55,

  ROTOR_RADIUS:         2.4,
  TAIL_ROTOR_RADIUS:    0.55,
  ROTOR_OPACITY:        0.55,

  // ── Camera ────────────────────────────────────────────────────────────────
  // Camera sits behind (+Z in heli local space) and above.
  // Nose faces -Z so behind = +Z = the tail direction.
  CAM_BACK:       18,   // distance behind helicopter
  CAM_UP:         6,    // height above helicopter
  CAM_LOOK_AHEAD: 8,    // how far ahead of heli the camera looks
  CAM_LAG:        0.08, // position lerp factor (lower = more lag)
  CAM_ROT_LAG:    0.06, // lookat lerp factor

  // ── Traffic ───────────────────────────────────────────────────────────────
  TRAFFIC_COUNT:    70,
  CAR_SPEED:        8.0,
  CAR_SPEED_VAR:    4.0,
  GRIDLOCK_DURATION:25,
  GRIDLOCK_RADIUS:  60,

  // ── AI helicopters ────────────────────────────────────────────────────────
  AI_HELI_COUNT:    3,
  AI_HELI_SPEED:    12.0,
  AI_HELI_HEIGHT_MIN: 30,
  AI_HELI_HEIGHT_MAX: 60,

  // ── Missions ──────────────────────────────────────────────────────────────
  MISSION_INTERVAL_MIN: 30,
  MISSION_INTERVAL_MAX: 60,
  MISSION_EXPIRE:       120,
  POLICE_MISSION_TIERS: [
    { label: 'Misdemeanour', time: 60,  color: 0x00ffff  },
    { label: 'Felony',       time: 45,  color: 0xff8800  },
    { label: 'Emergency',    time: 30,  color: 0xff0033  },
  ],

  // ── World ─────────────────────────────────────────────────────────────────
  WORLD_BOUNDARY_PUSH: 0.8,
};

// Derived
C.CELL_STRIDE = C.BLOCK_SIZE + C.STREET_WIDTH;
C.CITY_HALF   = (C.GRID_CELLS * C.CELL_STRIDE) / 2;

// ─── Colour Palettes ──────────────────────────────────────────────────────────
var PALETTES = [
  {
    id: 'downtown',
    fogColor:     new THREE.Color(0x280040),
    groundTint:   new THREE.Color(0x1a0030),
    neonP:        new THREE.Color(0xff00ff),
    neonS:        new THREE.Color(0x00ffff),
    buildingTint: new THREE.Color(0x1a1228),
  },
  {
    id: 'industrial',
    fogColor:     new THREE.Color(0x201030),
    groundTint:   new THREE.Color(0x150820),
    neonP:        new THREE.Color(0xff4400),
    neonS:        new THREE.Color(0xffcc00),
    buildingTint: new THREE.Color(0x1a1010),
  },
  {
    id: 'waterfront',
    fogColor:     new THREE.Color(0x102040),
    groundTint:   new THREE.Color(0x0a1530),
    neonP:        new THREE.Color(0x00ffcc),
    neonS:        new THREE.Color(0xff00aa),
    buildingTint: new THREE.Color(0x0f1a20),
  },
];

var ACTIVE_PALETTE = PALETTES[0];

var SKY_BASE    = new THREE.Color(0x2a0550);
var SKY_HORIZON = new THREE.Color(0x6a1030);

var PLAYLIST = {
  tracks:   ['audio/track1.mp3', 'audio/track2.mp3'],
  shuffle:  true,
  crossfade: 3.0,
};

var MISSION_TYPES = [
  { id: 'news_fire',       label: 'Structure Fire',    variant: 'news',   points: 100 },
  { id: 'news_protest',    label: 'Protest Downtown',  variant: 'news',   points: 80  },
  { id: 'news_accident',   label: 'Traffic Incident',  variant: 'news',   points: 60  },
  { id: 'news_breaking',   label: 'Breaking Story',    variant: 'news',   points: 120 },
  { id: 'police_pursuit',  label: 'Vehicle Pursuit',   variant: 'police', tier: 0, points: 150 },
  { id: 'police_felony',   label: 'Felony in Progress',variant: 'police', tier: 1, points: 250 },
  { id: 'police_emergency',label: 'Officer Needs Assist',variant:'police',tier: 2, points: 400 },
];
