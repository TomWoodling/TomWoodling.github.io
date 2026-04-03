// leveldata.js — Level data structure and loader (loaded after config.js, before city.js)

var LevelData = {
  playerSpawn: { x: 0, z: -15 },
  buildings: [],       // empty = use procedural generation in city.js
  walls: [],
  henHouses: [],
  orbs: [],
  triggers: [],
  distractions: [],
  streetLights: [],
  dogPatrols: [],
};

var LevelLoader = {
  loadDefault: function() {
    // HEN Houses — same positions as previously hardcoded in city.js
    LevelData.henHouses = [
      { id: 'HEN_1', x: 40, z: 20, locked: false, powerupId: 'speed',
        missionText: 'Find the OVERCLOCK node in the warehouse district.' },
      { id: 'HEN_2', x: -35, z: 45, locked: true, powerupId: 'silent',
        missionText: 'Locate SILENT_PAW in the old factory.' },
      { id: 'HEN_3', x: 20, z: -40, locked: true, powerupId: 'pulse',
        missionText: 'Reach PULSE_BARK at the comm tower.' },
      { id: 'HEN_4', x: 0, z: 75, locked: true, powerupId: null,
        missionText: 'Infiltrate the central HEN mainframe.' },
    ];

    // Distraction objects
    LevelData.distractions = [
      { x: 12, z: -5, type: 'bin' },
      { x: -8, z: 20, type: 'panel' },
      { x: 25, z: 15, type: 'crate' },
      { x: -20, z: 35, type: 'bin' },
      { x: 5, z: 50, type: 'panel' },
      { x: 30, z: 45, type: 'crate' },
      { x: -15, z: 60, type: 'bin' },
      { x: 10, z: 70, type: 'panel' },
    ];

    // Dog patrol waypoints (dogs spawn when detection bar fills)
    LevelData.dogPatrols = [
      { waypoints: [
        { x: -15, z: 5 }, { x: 15, z: 5 }, { x: 15, z: -5 }, { x: -15, z: -5 }
      ]},
      { waypoints: [
        { x: -20, z: 25 }, { x: 20, z: 25 }, { x: 20, z: 40 }, { x: -20, z: 40 }
      ]},
      { waypoints: [
        { x: -15, z: 55 }, { x: 15, z: 55 }, { x: 15, z: 75 }, { x: -15, z: 75 }
      ]},
    ];

    // Orbs — replace dogs as primary threat
    LevelData.orbs = [
      // Red orbs: patrol routes (former dog patrol areas)
      { type: 'red', x: -15, z: 5, waypoints: [
        { x: -15, z: 5 }, { x: 15, z: 5 }, { x: 15, z: -5 }, { x: -15, z: -5 }
      ]},
      { type: 'red', x: -20, z: 25, waypoints: [
        { x: -20, z: 25 }, { x: 20, z: 25 }, { x: 20, z: 40 }, { x: -20, z: 40 }
      ]},
      { type: 'red', x: -15, z: 55, waypoints: [
        { x: -15, z: 55 }, { x: 15, z: 55 }, { x: 15, z: 75 }, { x: -15, z: 75 }
      ]},

      // Blue orbs: stationary sentries at chokepoints
      { type: 'blue', x: 0, z: 10 },
      { type: 'blue', x: -30, z: 50 },
      { type: 'blue', x: 25, z: -30 },

      // Yellow orbs: timed sentries near objectives
      { type: 'yellow', x: 35, z: 18 },    // near HEN_1
      { type: 'yellow', x: -28, z: 42 },   // near HEN_2
      { type: 'yellow', x: 15, z: -35 },   // near HEN_3
      { type: 'yellow', x: 5, z: 68 },     // near HEN_4

      // Green orbs: safe zones
      { type: 'green', x: 0, z: -10 },     // near spawn
      { type: 'green', x: -10, z: 30 },    // mid-city
      { type: 'green', x: 30, z: 55 },     // north area
      { type: 'green', x: -25, z: 65 },    // industrial area
    ];

    // Triggers
    LevelData.triggers = [
      { id: 'tutorial_start', x: 0, z: -13, w: 10, d: 8,
        event: 'dialogue', data: 'game_start', once: true },
      { id: 'hen1_approach', x: 40, z: 20, w: 16, d: 16,
        event: 'dialogue', data: 'hen_1_approach', once: true },
    ];

    LevelData.playerSpawn = { x: 0, z: -15 };
  },

  fromJSON: function(jsonString) {
    var data = JSON.parse(jsonString);
    LevelData.playerSpawn = data.playerSpawn || { x: 0, z: -15 };
    LevelData.buildings = data.buildings || [];
    LevelData.walls = data.walls || [];
    LevelData.henHouses = data.henHouses || [];
    LevelData.orbs = data.orbs || [];
    LevelData.triggers = data.triggers || [];
    LevelData.distractions = data.distractions || [];
    LevelData.streetLights = data.streetLights || [];
    LevelData.dogPatrols = data.dogPatrols || [];
  },

  exportJSON: function() {
    return JSON.stringify({
      version: 1,
      playerSpawn: LevelData.playerSpawn,
      buildings: LevelData.buildings,
      walls: LevelData.walls,
      henHouses: LevelData.henHouses,
      orbs: LevelData.orbs,
      triggers: LevelData.triggers,
      distractions: LevelData.distractions,
      streetLights: LevelData.streetLights,
      dogPatrols: LevelData.dogPatrols,
    }, null, 2);
  },
};
