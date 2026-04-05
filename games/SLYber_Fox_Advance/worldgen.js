// worldgen.js — Procedural world generation: districts, mazes, placement pipeline
// Self-contained maze generator (Recursive Backtrack) + topology analyser + entity placer
// Outputs LevelData-compatible JSON that the existing game systems consume directly

// ============================================================
//  DISTRICT DEFINITIONS — the story spine
// ============================================================

var DISTRICTS = [
  {
    id: 'backyard', name: 'The Backyard',
    theme: { fence: 0x1a1a2e, fog: 0x0d0820, ambient: 0x1a0a2e, sky: 0x080614 },
    maze: { cols: 10, rows: 10, cellSize: 6 },
    hens: 3, roosters: 1, sneakPoints: 0, howlPoints: 0,
    powerupReward: 'speed',
    dogBriefing: 'district_1_briefing',
    dogComplete: 'district_1_complete',
  },
  {
    id: 'warehouse', name: 'The Warehouse',
    theme: { fence: 0x222240, fog: 0x0a0618, ambient: 0x150a30, sky: 0x060410 },
    maze: { cols: 14, rows: 14, cellSize: 6 },
    hens: 5, roosters: 3, sneakPoints: 2, howlPoints: 1,
    powerupReward: 'silent',
    dogBriefing: 'district_2_briefing',
    dogComplete: 'district_2_complete',
  },
  {
    id: 'factory', name: 'The Factory',
    theme: { fence: 0x2a1a1a, fog: 0x100808, ambient: 0x200a0a, sky: 0x0a0406 },
    maze: { cols: 16, rows: 16, cellSize: 6 },
    hens: 8, roosters: 5, sneakPoints: 3, howlPoints: 2,
    powerupReward: 'pulse',
    dogBriefing: 'district_3_briefing',
    dogComplete: 'district_3_complete',
  },
  {
    id: 'tower', name: 'The Comm Tower',
    theme: { fence: 0x1a2a2a, fog: 0x081010, ambient: 0x0a2020, sky: 0x040808 },
    maze: { cols: 18, rows: 18, cellSize: 6 },
    hens: 10, roosters: 7, sneakPoints: 4, howlPoints: 3,
    powerupReward: null,
    dogBriefing: 'district_4_briefing',
    dogComplete: 'district_4_complete',
  },
];

// ============================================================
//  SEEDED RANDOM (Mulberry32 — fast, deterministic)
// ============================================================

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ============================================================
//  MAZE GENERATOR — Recursive Backtrack on a grid
// ============================================================
//
//  COORDINATE SYSTEM (critical for entrance/exit):
//    Grid row 0  = SOUTH edge of maze (closest to hub, smallest Z)
//    Grid row N  = NORTH edge (farthest from hub, largest Z)
//    Grid col 0  = WEST, col N = EAST
//    World Z increases northward.  originZ = south edge of maze.
//    So grid[r][c] maps to worldZ = originZ + r * cellSize.
//
//  Entrance: bottom-centre = grid[0][cols/2], open its SOUTH wall
//  Exit:     top-centre    = grid[rows-1][cols/2], open its NORTH wall

var DIR = {
  N: { dr: 1, dc: 0, opposite: 'S' },   // N = +row = +Z = northward
  S: { dr: -1, dc: 0, opposite: 'N' },   // S = -row = -Z = southward
  E: { dr: 0,  dc: 1, opposite: 'W' },
  W: { dr: 0,  dc: -1, opposite: 'E' },
};
var DIR_KEYS = ['N', 'S', 'E', 'W'];

function generateMazeGrid(rows, cols, rng) {
  var grid = [];
  for (var r = 0; r < rows; r++) {
    grid[r] = [];
    for (var c = 0; c < cols; c++) {
      grid[r][c] = { N: false, S: false, E: false, W: false, visited: false };
    }
  }

  // Start carving from the entrance cell (row 0, centre col)
  var stack = [];
  var startR = 0, startC = Math.floor(cols / 2);
  grid[startR][startC].visited = true;
  stack.push({ r: startR, c: startC });

  while (stack.length > 0) {
    var cur = stack[stack.length - 1];
    var neighbours = [];
    for (var di = 0; di < 4; di++) {
      var d = DIR_KEYS[di];
      var nr = cur.r + DIR[d].dr;
      var nc = cur.c + DIR[d].dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !grid[nr][nc].visited) {
        neighbours.push({ d: d, r: nr, c: nc });
      }
    }
    if (neighbours.length === 0) {
      stack.pop();
      continue;
    }
    var pick = neighbours[Math.floor(rng() * neighbours.length)];
    grid[cur.r][cur.c][pick.d] = true;
    grid[pick.r][pick.c][DIR[pick.d].opposite] = true;
    grid[pick.r][pick.c].visited = true;
    stack.push({ r: pick.r, c: pick.c });
  }

  return grid;
}

// ============================================================
//  GRID → FENCE SEGMENTS converter
// ============================================================
//
//  Battle-tested approach from roguelike/maze games:
//  1. Generate the FULL set of boundary + internal walls
//  2. THEN punch entrance/exit holes by removing specific segments
//  This guarantees entrances always exist regardless of maze topology.

function gridToWalls(grid, rows, cols, cellSize, originX, originZ, entranceCol, exitCol) {
  var walls = [];
  var half = cellSize / 2;

  // We track which wall segments to SKIP for entrance/exit
  // Entrance = south wall of cell [0][entranceCol]
  // Exit = north wall of cell [rows-1][exitCol]

  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var cx = originX + c * cellSize + half;
      var cz = originZ + r * cellSize + half;
      var cell = grid[r][c];

      // --- SOUTH boundary wall (row 0 only) ---
      if (r === 0) {
        // Skip entrance cell's south boundary
        if (c !== entranceCol) {
          walls.push({ x1: cx - half, z1: cz - half, x2: cx + half, z2: cz - half });
        }
      }

      // --- NORTH boundary wall (last row only) ---
      if (r === rows - 1) {
        if (c !== exitCol) {
          walls.push({ x1: cx - half, z1: cz + half, x2: cx + half, z2: cz + half });
        }
      }

      // --- Internal NORTH wall (between this cell and cell above) ---
      // Only draw if passage is NOT open AND it's not a boundary
      if (r < rows - 1 && !cell.N) {
        walls.push({ x1: cx - half, z1: cz + half, x2: cx + half, z2: cz + half });
      }

      // --- WEST boundary wall (col 0 only) ---
      if (c === 0) {
        walls.push({ x1: cx - half, z1: cz - half, x2: cx - half, z2: cz + half });
      }

      // --- Internal EAST wall (between this cell and cell to the right) ---
      // Also serves as the east boundary for the last column
      if (!cell.E) {
        walls.push({ x1: cx + half, z1: cz - half, x2: cx + half, z2: cz + half });
      }
    }
  }

  return walls;
}

// ============================================================
//  TOPOLOGY ANALYSER
// ============================================================

function analyseMaze(grid, rows, cols, startR, startC) {
  var dist = [];
  for (var r = 0; r < rows; r++) {
    dist[r] = [];
    for (var c = 0; c < cols; c++) dist[r][c] = -1;
  }
  dist[startR][startC] = 0;
  var queue = [{ r: startR, c: startC }];
  var qi = 0;

  while (qi < queue.length) {
    var cur = queue[qi++];
    var cell = grid[cur.r][cur.c];
    for (var di = 0; di < 4; di++) {
      var d = DIR_KEYS[di];
      if (!cell[d]) continue;
      var nr = cur.r + DIR[d].dr;
      var nc = cur.c + DIR[d].dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (dist[nr][nc] >= 0) continue;
      dist[nr][nc] = dist[cur.r][cur.c] + 1;
      queue.push({ r: nr, c: nc });
    }
  }

  var deadEnds = [];
  var junctions = [];
  var allCells = [];

  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var cell = grid[r][c];
      var openCount = 0;
      if (cell.N) openCount++;
      if (cell.S) openCount++;
      if (cell.E) openCount++;
      if (cell.W) openCount++;

      var info = { r: r, c: c, dist: dist[r][c], openings: openCount };
      allCells.push(info);

      if (openCount === 1) deadEnds.push(info);
      if (openCount >= 3) junctions.push(info);
    }
  }

  deadEnds.sort(function(a, b) { return b.dist - a.dist; });
  junctions.sort(function(a, b) { return b.dist - a.dist; });

  return {
    dist: dist,
    deadEnds: deadEnds,
    junctions: junctions,
    allCells: allCells,
    farthestCell: queue[queue.length - 1],
  };
}

// ============================================================
//  CELL → WORLD POSITION helper
// ============================================================

function cellToWorld(r, c, cellSize, originX, originZ) {
  return {
    x: originX + c * cellSize + cellSize / 2,
    z: originZ + r * cellSize + cellSize / 2,
  };
}

// ============================================================
//  ENTITY PLACEMENT PIPELINE
// ============================================================

function placeEntities(district, grid, topo, rows, cols, cellSize, originX, originZ, rng, entranceCol) {
  var result = {
    hens: [],
    roosters: [],
    sneakPoints: [],
    howlPoints: [],
    distractions: [],
    streetLights: [],
    henHouses: [],
  };

  var usedCells = {};
  // Reserve entrance cell
  usedCells[0 + ',' + entranceCol] = true;

  // --- Place hens at dead ends, farthest first ---
  var henCells = [];

  for (var i = 0; i < topo.deadEnds.length && henCells.length < district.hens; i++) {
    var de = topo.deadEnds[i];
    var key = de.r + ',' + de.c;
    if (usedCells[key]) continue;
    henCells.push(de);
    usedCells[key] = true;
  }

  // Fill from farthest general cells if needed
  if (henCells.length < district.hens) {
    var sorted = topo.allCells.slice().sort(function(a, b) { return b.dist - a.dist; });
    for (var i = 0; i < sorted.length && henCells.length < district.hens; i++) {
      var key = sorted[i].r + ',' + sorted[i].c;
      if (usedCells[key]) continue;
      henCells.push(sorted[i]);
      usedCells[key] = true;
    }
  }

  for (var i = 0; i < henCells.length; i++) {
    var pos = cellToWorld(henCells[i].r, henCells[i].c, cellSize, originX, originZ);
    result.hens.push({ id: 'hen_' + i, x: pos.x, z: pos.z });
  }

  // --- Place roosters at junctions ---
  var roosterCells = [];
  var maxHenDist = henCells.length > 0 ? henCells[0].dist : 1;

  for (var i = 0; i < topo.junctions.length && roosterCells.length < district.roosters; i++) {
    var j = topo.junctions[i];
    var key = j.r + ',' + j.c;
    if (usedCells[key]) continue;
    var ratio = j.dist / maxHenDist;
    if (ratio < 0.25 || ratio > 0.9) continue;
    roosterCells.push(j);
    usedCells[key] = true;
  }

  if (roosterCells.length < district.roosters) {
    for (var i = 0; i < topo.junctions.length && roosterCells.length < district.roosters; i++) {
      var key = topo.junctions[i].r + ',' + topo.junctions[i].c;
      if (usedCells[key]) continue;
      roosterCells.push(topo.junctions[i]);
      usedCells[key] = true;
    }
  }

  for (var i = 0; i < roosterCells.length; i++) {
    var pos = cellToWorld(roosterCells[i].r, roosterCells[i].c, cellSize, originX, originZ);
    var radius = C.ROOSTER_ZONE_RADIUS * (0.7 + rng() * 0.6);
    result.roosters.push({ id: 'rooster_' + i, x: pos.x, z: pos.z, radius: radius });
  }

  // --- Place sneak points ---
  var sneakCandidates = [];
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var cell = grid[r][c];
      if (!cell.E && c + 1 < cols) {
        var distDiff = Math.abs(topo.dist[r][c] - topo.dist[r][c + 1]);
        if (distDiff > 3) {
          var wallPos = cellToWorld(r, c, cellSize, originX, originZ);
          sneakCandidates.push({ x: wallPos.x + cellSize / 2, z: wallPos.z, distDiff: distDiff });
        }
      }
      if (!cell.N && r + 1 < rows) {
        var distDiff = Math.abs(topo.dist[r][c] - topo.dist[r + 1][c]);
        if (distDiff > 3) {
          var wallPos = cellToWorld(r, c, cellSize, originX, originZ);
          sneakCandidates.push({ x: wallPos.x, z: wallPos.z + cellSize / 2, distDiff: distDiff });
        }
      }
    }
  }
  sneakCandidates.sort(function(a, b) { return b.distDiff - a.distDiff; });

  for (var i = 0; i < Math.min(district.sneakPoints, sneakCandidates.length); i++) {
    var sp = sneakCandidates[i];
    var reqHens = Math.max(1, Math.floor((i + 1) * district.hens / (district.sneakPoints + 1)));
    result.sneakPoints.push({ id: 'sneak_' + i, x: sp.x, z: sp.z, requiredHens: reqHens });
  }

  // --- Place howl points ---
  for (var i = 0; i < Math.min(district.howlPoints, roosterCells.length); i++) {
    var roosterIdx = i;
    var bestHowlCell = null;
    for (var ci = 0; ci < topo.allCells.length; ci++) {
      var ac = topo.allCells[ci];
      var key = ac.r + ',' + ac.c;
      if (usedCells[key]) continue;
      if (ac.dist < roosterCells[roosterIdx].dist - 2) {
        var cellDist = Math.abs(ac.r - roosterCells[roosterIdx].r) + Math.abs(ac.c - roosterCells[roosterIdx].c);
        if (cellDist >= 3) {
          bestHowlCell = ac;
          usedCells[key] = true;
          break;
        }
      }
    }
    if (bestHowlCell) {
      var howlPos = cellToWorld(bestHowlCell.r, bestHowlCell.c, cellSize, originX, originZ);
      var edgeR = Math.min(rows - 1, roosterCells[roosterIdx].r + 3);
      var edgeC = Math.min(cols - 1, roosterCells[roosterIdx].c + 3);
      var newPos = cellToWorld(edgeR, edgeC, cellSize, originX, originZ);
      var reqHens = Math.max(1, Math.floor((i + 1) * district.hens / (district.howlPoints + 1)));
      result.howlPoints.push({
        id: 'howl_' + i, x: howlPos.x, z: howlPos.z,
        requiredHens: reqHens,
        targetRooster: 'rooster_' + roosterIdx,
        newX: newPos.x, newZ: newPos.z,
      });
    }
  }

  // --- Distractions ---
  var distractCount = Math.max(4, Math.floor(rows * cols * 0.04));
  var types = ['bin', 'panel', 'crate'];
  var shuffled = topo.allCells.slice().sort(function() { return rng() - 0.5; });
  for (var i = 0; i < Math.min(distractCount, shuffled.length); i++) {
    var key = shuffled[i].r + ',' + shuffled[i].c;
    if (usedCells[key]) continue;
    var pos = cellToWorld(shuffled[i].r, shuffled[i].c, cellSize, originX, originZ);
    result.distractions.push({
      x: pos.x + (rng() - 0.5) * 2,
      z: pos.z + (rng() - 0.5) * 2,
      type: types[Math.floor(rng() * types.length)],
    });
    usedCells[key] = true;
  }

  // --- Street lights ---
  for (var r = 0; r < rows; r += 3) {
    for (var c = 0; c < cols; c += 3) {
      var pos = cellToWorld(r, c, cellSize, originX, originZ);
      result.streetLights.push({ x: pos.x + 1.5, z: pos.z });
    }
  }

  // --- HRN house at farthest cell ---
  if (topo.farthestCell && district.powerupReward) {
    var pos = cellToWorld(topo.farthestCell.r, topo.farthestCell.c, cellSize, originX, originZ);
    result.henHouses.push({
      id: 'HRN_' + district.id, x: pos.x, z: pos.z,
      locked: false, powerupId: district.powerupReward,
      missionText: 'Absorb the ' + district.powerupReward.toUpperCase() + ' node.',
    });
  }

  return result;
}

// ============================================================
//  EXTERIOR HUB GENERATOR — the dog NPC safe zone
// ============================================================

function generateExteriorHub(district, mazeOriginX, mazeOriginZ, cellSize, cols, entranceCol) {
  var hubWidth = cols * cellSize;
  var hubDepth = 20;
  var hubZ = mazeOriginZ - hubDepth;  // hub is directly south of maze

  // The entrance gap is aligned with the entrance cell
  var gapCenterX = mazeOriginX + entranceCol * cellSize + cellSize / 2;
  var gapHalf = cellSize / 2 + 0.2;  // slightly wider than one cell for comfort

  var result = {
    walls: [],
    buildings: [],
    streetLights: [],
    dogSpawn: { x: gapCenterX, z: hubZ + hubDepth * 0.4 },
    playerSpawn: { x: gapCenterX, z: hubZ + hubDepth * 0.75 },
  };

  var left = mazeOriginX - 5;
  var right = mazeOriginX + hubWidth + 5;
  var south = hubZ;
  var north = mazeOriginZ;  // hub's north edge = maze's south edge (seamless)

  // South wall (with entrance from "outside world")
  result.walls.push({ x1: left, z1: south, x2: gapCenterX - gapHalf, z2: south });
  result.walls.push({ x1: gapCenterX + gapHalf, z1: south, x2: right, z2: south });
  // West wall
  result.walls.push({ x1: left, z1: south, x2: left, z2: north });
  // East wall
  result.walls.push({ x1: right, z1: south, x2: right, z2: north });
  // North wall — gap at entrance cell so player can walk into maze
  // The maze's own south boundary (with its entrance hole) starts at z=north,
  // so we DON'T draw a hub north wall — the maze boundary IS the north wall.
  // We just need side walls to connect.

  // Decorative buildings
  result.buildings.push({ x: left + 6, z: hubZ + 6, w: 6, h: 5, d: 6, color: 0x111122 });
  result.buildings.push({ x: right - 6, z: hubZ + 6, w: 6, h: 7, d: 6, color: 0x0f0f20 });

  // Lights
  result.streetLights.push({ x: gapCenterX - 5, z: hubZ + hubDepth / 2 });
  result.streetLights.push({ x: gapCenterX + 5, z: hubZ + hubDepth / 2 });
  result.streetLights.push({ x: gapCenterX, z: hubZ + 3 });

  return result;
}

// ============================================================
//  DOG NPC DATA
// ============================================================

function generateDogNPC(hubData, district) {
  return {
    id: 'dog_' + district.id,
    x: hubData.dogSpawn.x,
    z: hubData.dogSpawn.z,
    dialogueId: district.dogBriefing,
    completionDialogueId: district.dogComplete,
  };
}

// ============================================================
//  MASTER GENERATOR
// ============================================================

var WorldGen = {
  currentDistrict: 0,
  seed: null,
  lastDogNPC: null,  // stored for game.js to spawn the dog

  generate: function(districtIndex, seed) {
    var district = DISTRICTS[districtIndex] || DISTRICTS[0];
    var s = seed || Math.floor(Math.random() * 999999);
    this.seed = s;
    var rng = mulberry32(s);

    var cols = district.maze.cols;
    var rows = district.maze.rows;
    var cellSize = district.maze.cellSize;

    var originX = -(cols * cellSize) / 2;
    var originZ = 0;

    // 1. Generate maze
    var grid = generateMazeGrid(rows, cols, rng);

    // 2. Designate entrance (row 0, centre) and exit (last row, centre)
    var entranceCol = Math.floor(cols / 2);
    var exitCol = Math.floor(cols / 2);

    // 3. Convert to walls — entrance/exit holes are punched automatically
    var mazeWalls = gridToWalls(grid, rows, cols, cellSize, originX, originZ, entranceCol, exitCol);

    // 4. Topology analysis (BFS from entrance cell)
    var topo = analyseMaze(grid, rows, cols, 0, entranceCol);

    // 5. Place entities
    var entities = placeEntities(district, grid, topo, rows, cols, cellSize, originX, originZ, rng, entranceCol);

    // 6. Exterior hub
    var hub = generateExteriorHub(district, originX, originZ, cellSize, cols, entranceCol);

    // 7. Dog NPC
    var dogNPC = generateDogNPC(hub, district);
    this.lastDogNPC = dogNPC;

    // 8. Assemble LevelData
    var levelData = {
      version: 3,
      district: district.id,
      districtName: district.name,
      seed: s,
      playerSpawn: hub.playerSpawn,
      walls: hub.walls.concat(mazeWalls),
      buildings: hub.buildings.concat(
        this._generateMazeBuildings(cols, rows, cellSize, originX, originZ, rng)
      ),
      henHouses: entities.henHouses,
      hens: entities.hens,
      roosters: entities.roosters,
      sneakPoints: entities.sneakPoints,
      howlPoints: entities.howlPoints,
      distractions: entities.distractions,
      streetLights: hub.streetLights.concat(entities.streetLights),
      triggers: [
        {
          id: 'dog_briefing',
          x: hub.dogSpawn.x, z: hub.dogSpawn.z,
          w: 8, d: 8,
          event: 'dialogue',
          data: district.dogBriefing,
          once: true,
        },
      ],
      dogNPC: dogNPC,
    };

    return levelData;
  },

  _generateMazeBuildings: function(cols, rows, cellSize, originX, originZ, rng) {
    var buildings = [];
    var colors = [0x111122, 0x0f0f20, 0x151530, 0x0d0d1e, 0x121228];
    var mazeW = cols * cellSize;
    var mazeH = rows * cellSize;

    // Corner buildings
    buildings.push({ x: originX - 6, z: originZ + 5, w: 8, h: 8 + rng() * 6, d: 8, color: colors[Math.floor(rng() * colors.length)] });
    buildings.push({ x: originX + mazeW + 6, z: originZ + 5, w: 8, h: 6 + rng() * 8, d: 8, color: colors[Math.floor(rng() * colors.length)] });
    buildings.push({ x: originX - 6, z: originZ + mazeH - 5, w: 8, h: 7 + rng() * 5, d: 8, color: colors[Math.floor(rng() * colors.length)] });
    buildings.push({ x: originX + mazeW + 6, z: originZ + mazeH - 5, w: 8, h: 9 + rng() * 4, d: 8, color: colors[Math.floor(rng() * colors.length)] });

    for (var i = 0; i < 3; i++) {
      var t = (i + 1) / 4;
      buildings.push({
        x: originX - 5 - rng() * 4, z: originZ + t * mazeH,
        w: 5 + rng() * 5, h: 5 + rng() * 10, d: 5 + rng() * 5,
        color: colors[Math.floor(rng() * colors.length)],
      });
      buildings.push({
        x: originX + mazeW + 5 + rng() * 4, z: originZ + t * mazeH,
        w: 5 + rng() * 5, h: 5 + rng() * 10, d: 5 + rng() * 5,
        color: colors[Math.floor(rng() * colors.length)],
      });
    }

    return buildings;
  },

  loadDistrict: function(districtIndex, seed) {
    var data = this.generate(districtIndex, seed);
    LevelData.playerSpawn = data.playerSpawn;
    LevelData.walls = data.walls;
    LevelData.buildings = data.buildings;
    LevelData.henHouses = data.henHouses;
    LevelData.hens = data.hens;
    LevelData.roosters = data.roosters;
    LevelData.sneakPoints = data.sneakPoints;
    LevelData.howlPoints = data.howlPoints;
    LevelData.distractions = data.distractions;
    LevelData.streetLights = data.streetLights;
    LevelData.triggers = data.triggers;
    LevelData.dogNPC = data.dogNPC;
    this.currentDistrict = districtIndex;
    return data;
  },

  getDistrict: function(index) { return DISTRICTS[index] || null; },
  getDistrictCount: function() { return DISTRICTS.length; },
  getCurrentDistrict: function() { return DISTRICTS[this.currentDistrict] || DISTRICTS[0]; },
};
