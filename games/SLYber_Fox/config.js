var C = {
  // Fox physics
  FOX_WALK_SPEED:    4.0,
  FOX_RUN_SPEED:     9.0,
  FOX_SNEAK_SPEED:   2.5,
  FOX_JUMP_FORCE:    8.0,
  FOX_GRAVITY:      -20.0,
  FOX_COYOTE_MS:     120,
  FOX_EDGE_MAGNET:   0.4,
  FOX_TURN_SPEED:    8.0,

  // Camera
  CAM_FOLLOW_DIST:   7.0,
  CAM_FOLLOW_HEIGHT: 3.5,
  CAM_LERP_POS:      6.0,
  CAM_LERP_ROT:      4.0,
  CAM_AUTO_ALIGN:    true,

  // Guard dog AI
  DOG_PATROL_SPEED:    2.5,
  DOG_ALERT_SPEED:     0,
  DOG_CHASE_SPEED:     7.0,
  DOG_DETECTION_FOR:   8.0,
  DOG_DETECTION_FOV:   90,
  DOG_HEARING_RADIUS:  5.0,
  DOG_SNEAK_MULT:      0.4,
  DOG_ALERT_DURATION:  2.5,
  DOG_CHASE_DURATION:  6.0,
  DOG_RETURN_SPEED:    3.5,

  // Distraction
  DISTRACT_RADIUS:     6.0,
  DISTRACT_DURATION:   8.0,

  // HEN Houses
  HEN_ENERGY_RESTORE:  1.0,
  HEN_GLOW_COLOR:      0x00ffcc,
  HEN_PULSE_SPEED:     1.5,

  // Power-ups
  POWERUPS: [
    { id: 'speed',  name: 'OVERCLOCK',  desc: 'Sprint faster, longer',    runMult: 1.5, energyCost: 0.4  },
    { id: 'silent', name: 'SILENT_PAW', desc: 'Reduced detection radius', dogDetMult: 0.5 },
    { id: 'pulse',  name: 'PULSE_BARK', desc: 'Bark range doubled',        barkMult: 2.0 },
  ],

  // Energy
  ENERGY_MAX:          100,
  ENERGY_REGEN:        8.0,
  ENERGY_SPRINT_DRAIN: 20.0,
  ENERGY_BARK_COST:    15.0,

  // City
  CITY_BLOCK_SIZE:     24,
  CITY_STREET_WIDTH:   8,
  AMBIENT_COLOR:       0x1a0a2e,
  FOG_COLOR:           0x0d0820,
  FOG_NEAR:            30,
  FOG_FAR:             120,

  // Orb enemies
  ORB_RED_SPEED:           2.0,
  ORB_RED_DETECT_RANGE:    6.0,
  ORB_RED_DETECT_RATE:     25,    // detection bar points/sec
  ORB_RED_FOV:             90,    // forward cone degrees
  ORB_BLUE_DETECT_RANGE:   12.0,
  ORB_BLUE_DETECT_RATE:    15,
  ORB_YELLOW_ON_DURATION:  4.0,
  ORB_YELLOW_OFF_DURATION: 3.0,
  ORB_YELLOW_DETECT_RANGE: 8.0,
  ORB_YELLOW_DETECT_RATE:  35,
  ORB_GREEN_SAFE_RADIUS:   8.0,

  // Detection bar
  DETECTION_BAR_MAX:           100,
  DETECTION_BAR_DECAY:         12,   // points/sec when not detected
  DETECTION_DOG_SPAWN_COOLDOWN: 15,  // seconds before dogs despawn in safe zone

  // Debug
  DEBUG_TRIGGERS: false,

  // Model paths
  FOX_MODEL_PATH:      'art/cyberfox_compressed.glb',
  DOG_MODEL_PATH:      'art/cyberdog_compressed.glb',
};
