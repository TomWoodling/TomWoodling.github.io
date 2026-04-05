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

  // --- Mecha Rooster guards ---
  ROOSTER_PATROL_SPEED:    2.0,
  ROOSTER_CHASE_SPEED:     5.5,
  ROOSTER_ZONE_RADIUS:     10.0,
  ROOSTER_DETECT_FOV:      120,
  ROOSTER_DETECT_RANGE:    8.0,
  ROOSTER_HEARING_RADIUS:  4.0,
  ROOSTER_ALERT_DURATION:  1.5,
  ROOSTER_CHASE_DURATION:  5.0,
  ROOSTER_PUSH_SPEED:      12.0,
  ROOSTER_PUSH_DURATION:   0.6,
  ROOSTER_RETURN_SPEED:    3.0,
  ROOSTER_SNEAK_MULT:      0.35,
  ROOSTER_ZONE_COLOR:      0xff3333,
  ROOSTER_ZONE_OPACITY:    0.06,
  ROOSTER_GLOW_COLOR:      0xff2222,
  ROOSTER_GLOW_INTENSITY:  1.2,
  ROOSTER_SCALE:           1.0,

  // --- Golden Hens (collectibles) ---
  HEN_COLLECT_RADIUS:      2.5,
  HEN_GLOW_COLOR_GOLD:     0xffcc00,
  HEN_GLOW_INTENSITY:      1.5,
  HEN_PULSE_SPEED:         1.2,
  HEN_BOB_SPEED:           1.0,
  HEN_BOB_HEIGHT:          0.05,
  HEN_WANDER_RADIUS:       2.0,
  HEN_WANDER_SPEED:        0.6,
  HEN_SCALE:               0.8,
  HEN_COLLECT_ANIM_TIME:   1.0,

  // --- Sneak Points ---
  SNEAK_POINT_COLOR_LOCKED:   0xff4444,
  SNEAK_POINT_COLOR_UNLOCKED: 0x00ffcc,
  SNEAK_POINT_WIDTH:          2.0,

  // --- Howl Points ---
  HOWL_POINT_COLOR:         0x8844ff,
  HOWL_POINT_RADIUS:        2.0,
  HOWL_POINT_GLOW:          0x6633cc,

  // --- HRN Houses ---
  HRN_GLOW_COLOR:        0x00ffcc,
  HRN_PULSE_SPEED:       1.5,

  // Distraction
  DISTRACT_RADIUS:     6.0,
  DISTRACT_DURATION:   8.0,

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

  // City / Maze
  CITY_BLOCK_SIZE:     24,
  CITY_STREET_WIDTH:   8,
  FENCE_HEIGHT:        3.0,
  FENCE_THICKNESS:     0.4,
  FENCE_COLOR:         0x1a1a2e,
  AMBIENT_COLOR:       0x1a0a2e,
  FOG_COLOR:           0x0d0820,
  FOG_NEAR:            30,
  FOG_FAR:             120,

  // Debug
  DEBUG_TRIGGERS: false,
  DEBUG_ZONES: false,

  // Model paths
  FOX_MODEL_PATH:      'art/cyberfox_compressed.glb',
  DOG_MODEL_PATH:      'art/cyberdog_compressed.glb',
  ROOSTER_MODEL_PATH:  'art/mecha_rooster_compressed.glb',
  HEN_MODEL_PATH:      'art/golden_hen_compressed.glb',
};
