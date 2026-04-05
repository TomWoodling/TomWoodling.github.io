// leveldata.js — Level data structure and loader (loaded after config.js, before city.js)

var LevelData = {
  playerSpawn: { x: 0, z: -15 },
  buildings: [],
  walls: [],       // fence segments: { x1, z1, x2, z2 }
  henHouses: [],   // HRN houses (objective buildings)
  hens: [],        // golden hen collectibles
  roosters: [],    // mecha rooster zone guards
  sneakPoints: [], // fence gaps unlocked by hen count
  howlPoints: [],  // rooster repositioning points
  triggers: [],
  distractions: [],
  streetLights: [],
};

var LevelLoader = {
  loadDefault: function() {
    // ===== PLAYER SPAWN =====
    // Fox starts in the south safe zone, facing north into the maze
    LevelData.playerSpawn = { x: 0, z: -20 };

    // ===== MAZE WALLS (fence segments) =====
    // Format: { x1, z1, x2, z2 } — a straight fence from (x1,z1) to (x2,z2)
    //
    // Layout overview (top-down, Z increases northward):
    //
    //  z=80  ─────────── NORTH WALL ───────────
    //        │  NW area  │ gap │  NE area     │
    //  z=65  ─────┤ gap ├─────────────────────
    //        │           │     │               │
    //  z=55  ─────┤ gap ├──┤ sneak3 ├─────────
    //        │           │     │               │
    //  z=38  ........... inner wall (sneak3)....
    //        │           │     │               │
    //  z=25  ─────┤ gap ├──┤gap├──┤ gap ├─────
    //        │   W lane  │ centre │  E lane    │
    //  z=-5  ─────┤ FOX ENTRY (gap) ├─────────  south divider
    //        │         SPAWN AREA              │
    //  z=-30 ─────────── SOUTH WALL ───────────

    LevelData.walls = [
      // === Outer boundary ===
      // South wall has a gap at x=-4..4 for the entrance from "outside"
      { x1: -50, z1: -30, x2: -4, z2: -30 },    // south wall left
      { x1: 4, z1: -30, x2: 50, z2: -30 },       // south wall right
      { x1: -50, z1: 80, x2: 50, z2: 80 },       // north wall (solid)
      { x1: -50, z1: -30, x2: -50, z2: 80 },     // west wall
      { x1: 50, z1: -30, x2: 50, z2: 80 },       // east wall

      // === South divider (separates spawn from maze) ===
      // Gap at x=-4..4 lets the fox walk north into the maze
      { x1: -50, z1: -5, x2: -4, z2: -5 },       // south divider left
      { x1: 4, z1: -5, x2: 50, z2: -5 },         // south divider right

      // === Central maze — vertical lane walls ===
      // Left lane wall (gap at z=25..35 = sneak_1)
      { x1: -25, z1: -5, x2: -25, z2: 25 },      // left lane lower
      { x1: -25, z1: 35, x2: -25, z2: 55 },      // left lane upper

      // Right lane wall (gap at z=20..30 = sneak_2)
      { x1: 25, z1: -5, x2: 25, z2: 20 },        // right lane lower
      { x1: 25, z1: 30, x2: 25, z2: 55 },        // right lane upper

      // === Horizontal cross-walls ===
      // Mid cross-wall at z=25 (gap at x=-8..8)
      { x1: -25, z1: 25, x2: -8, z2: 25 },       // mid cross left
      { x1: 8, z1: 25, x2: 25, z2: 25 },         // mid cross right

      // Upper cross-wall at z=55 (gap at x=-4..4)
      { x1: -25, z1: 55, x2: -4, z2: 55 },       // upper cross left
      { x1: 4, z1: 55, x2: 25, z2: 55 },         // upper cross right

      // Inner horizontal wall at z=38 (gap blocked by sneak_3)
      { x1: -15, z1: 38, x2: -2, z2: 38 },       // inner wall left of gap
      { x1: 2, z1: 38, x2: 15, z2: 38 },         // inner wall right of gap

      // === North zone divider at z=65 ===
      // Gap at x=-4..4
      { x1: -50, z1: 65, x2: -4, z2: 65 },       // north divider left
      { x1: 4, z1: 65, x2: 50, z2: 65 },         // north divider right

      // === Inner corridor walls for variety ===
      { x1: -10, z1: -5, x2: -10, z2: 12 },      // inner left pocket wall
      { x1: 10, z1: -5, x2: 10, z2: 10 },        // inner right pocket wall
    ];

    // ===== BUILDINGS (decorative blocks adding atmosphere + collision) =====
    LevelData.buildings = [
      // South spawn area
      { x: -35, z: -20, w: 8, h: 6, d: 8, color: 0x111122 },
      { x: 35, z: -20, w: 8, h: 8, d: 8, color: 0x0f0f20 },
      { x: -20, z: -25, w: 5, h: 4, d: 5, color: 0x151530 },
      { x: 20, z: -25, w: 5, h: 4, d: 5, color: 0x0d0d1e },

      // Central zone
      { x: -38, z: 10, w: 10, h: 10, d: 12, color: 0x111122 },
      { x: 38, z: 10, w: 10, h: 8, d: 12, color: 0x0f0f20 },
      { x: -38, z: 40, w: 10, h: 12, d: 10, color: 0x151530 },
      { x: 38, z: 40, w: 10, h: 10, d: 10, color: 0x0d0d1e },
      { x: 0, z: 12, w: 5, h: 5, d: 5, color: 0x121228 },
      { x: -16, z: 42, w: 4, h: 7, d: 4, color: 0x111122 },
      { x: 16, z: 42, w: 4, h: 7, d: 4, color: 0x111122 },

      // North zone
      { x: -35, z: 72, w: 10, h: 8, d: 8, color: 0x0d0d1a },
      { x: 35, z: 72, w: 10, h: 8, d: 8, color: 0x101025 },
      { x: 0, z: 75, w: 7, h: 6, d: 7, color: 0x121228 },
    ];

    // ===== HRN HOUSES (objective buildings) =====
    LevelData.henHouses = [
      { id: 'HRN_1', x: -35, z: 15, locked: false, powerupId: 'speed',
        missionText: 'Find the OVERCLOCK node in the west wing.' },
      { id: 'HRN_2', x: 35, z: 35, locked: true, powerupId: 'silent',
        missionText: 'Locate SILENT_PAW in the east quarter.' },
      { id: 'HRN_3', x: 0, z: 72, locked: true, powerupId: 'pulse',
        missionText: 'Reach PULSE_BARK in the northern compound.' },
    ];

    // ===== GOLDEN HENS (collectibles) =====
    LevelData.hens = [
      // Easy (spawn area and first corridor)
      { id: 'hen_1', x: 0, z: -8 },         // just through the entrance
      { id: 'hen_2', x: -15, z: 5 },         // left side, no guards

      // Medium (central area, near rooster edges)
      { id: 'hen_3', x: 15, z: 12 },         // right pocket
      { id: 'hen_4', x: 0, z: 30 },          // central area, guarded

      // Hard (behind sneak points)
      { id: 'hen_5', x: -18, z: 45 },        // west upper, past sneak_1
      { id: 'hen_6', x: 18, z: 48 },         // east upper, past sneak_2

      // Final (north zone)
      { id: 'hen_7', x: -20, z: 70 },
      { id: 'hen_8', x: 20, z: 70 },
    ];

    // ===== MECHA ROOSTERS (zone guards) =====
    LevelData.roosters = [
      { id: 'rooster_1', x: 0, z: 18, radius: 8 },    // central crossroads
      { id: 'rooster_2', x: 18, z: 28, radius: 7 },    // east approach
      { id: 'rooster_3', x: 0, z: 45, radius: 9 },     // upper corridor
      { id: 'rooster_4', x: 0, z: 62, radius: 8 },     // north entrance
      { id: 'rooster_5', x: -25, z: 72, radius: 8 },   // north west
    ];

    // ===== SNEAK POINTS (fence gaps, unlock by hen count) =====
    LevelData.sneakPoints = [
      { id: 'sneak_1', x: -25, z: 30, requiredHens: 2 },  // left lane gap
      { id: 'sneak_2', x: 25, z: 25, requiredHens: 3 },   // right lane gap
      { id: 'sneak_3', x: 0, z: 38, requiredHens: 4 },    // inner wall shortcut
    ];

    // ===== HOWL POINTS (reposition roosters) =====
    LevelData.howlPoints = [
      {
        id: 'howl_1', x: 20, z: 10,
        requiredHens: 2,
        targetRooster: 'rooster_2',
        newX: 42, newZ: 15,
      },
      {
        id: 'howl_2', x: -15, z: 50,
        requiredHens: 4,
        targetRooster: 'rooster_3',
        newX: -42, newZ: 45,
      },
      {
        id: 'howl_3', x: 15, z: 58,
        requiredHens: 5,
        targetRooster: 'rooster_4',
        newX: 42, newZ: 60,
      },
    ];

    // ===== DISTRACTION OBJECTS =====
    LevelData.distractions = [
      { x: -5, z: -3, type: 'bin' },
      { x: 12, z: 8, type: 'panel' },
      { x: -20, z: 20, type: 'crate' },
      { x: 5, z: 33, type: 'bin' },
      { x: -10, z: 48, type: 'panel' },
      { x: 20, z: 58, type: 'crate' },
      { x: -30, z: 68, type: 'bin' },
      { x: 10, z: 73, type: 'panel' },
    ];

    // ===== TRIGGERS =====
    LevelData.triggers = [
      { id: 'tutorial_start', x: 0, z: -18, w: 12, d: 8,
        event: 'dialogue', data: 'game_start', once: true },
      { id: 'hrn1_approach', x: -35, z: 15, w: 16, d: 16,
        event: 'dialogue', data: 'hrn_1_approach', once: true },
      { id: 'first_rooster', x: 0, z: 5, w: 16, d: 8,
        event: 'dialogue', data: 'rooster_warning', once: true },
    ];

    // ===== STREET LIGHTS =====
    LevelData.streetLights = [
      { x: -5, z: -15 }, { x: 5, z: -15 },
      { x: -20, z: 0 },  { x: 20, z: 0 },
      { x: -15, z: 15 }, { x: 15, z: 15 },
      { x: -20, z: 30 }, { x: 20, z: 30 },
      { x: -15, z: 45 }, { x: 15, z: 45 },
      { x: -5, z: 55 },  { x: 5, z: 55 },
      { x: -20, z: 68 }, { x: 20, z: 68 },
      { x: 0, z: 78 },
    ];
  },

  fromJSON: function(jsonString) {
    var data = JSON.parse(jsonString);
    LevelData.playerSpawn = data.playerSpawn || { x: 0, z: -20 };
    LevelData.buildings = data.buildings || [];
    LevelData.walls = data.walls || [];
    LevelData.henHouses = data.henHouses || [];
    LevelData.hens = data.hens || [];
    LevelData.roosters = data.roosters || [];
    LevelData.sneakPoints = data.sneakPoints || [];
    LevelData.howlPoints = data.howlPoints || [];
    LevelData.triggers = data.triggers || [];
    LevelData.distractions = data.distractions || [];
    LevelData.streetLights = data.streetLights || [];
  },

  exportJSON: function() {
    return JSON.stringify({
      version: 2,
      playerSpawn: LevelData.playerSpawn,
      buildings: LevelData.buildings,
      walls: LevelData.walls,
      henHouses: LevelData.henHouses,
      hens: LevelData.hens,
      roosters: LevelData.roosters,
      sneakPoints: LevelData.sneakPoints,
      howlPoints: LevelData.howlPoints,
      triggers: LevelData.triggers,
      distractions: LevelData.distractions,
      streetLights: LevelData.streetLights,
    }, null, 2);
  },
};
