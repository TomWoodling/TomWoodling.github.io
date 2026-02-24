// city.js — Grid-based city generation, buildings, streets, helipads
// ===================================================================
// Exports: cityData { buildings[], helipads[], streets[] }
//          buildingMaterials[] (for uniform updates each frame)
//          helipadMaterials[]
//          groundMaterial (for time uniform update)
//          initCity(scene, palette) → cityData
//          getNearbyBuildings(x, z) → AABB[]
// ===================================================================

var cityData = {
  buildings: [],   // { x, z, w, d, h, helipad }
  helipads:  [],   // { x, z, y }  world-space centres
  aabbs:     [],   // { minX, maxX, minZ, maxZ, h } for collision
};

var buildingMaterials = [];
var helipadMaterials  = [];
var groundMaterial    = null;

// Spatial grid for fast nearby-building lookup
var _cellMap = {};  // key "cx,cz" → array of aabb indices

function _cellKey(cx, cz) { return cx + ',' + cz; }

function _registerAabb(idx, aabb) {
  var step = C.CELL_STRIDE;
  var x0 = Math.floor((aabb.minX + C.CITY_HALF) / step);
  var x1 = Math.floor((aabb.maxX + C.CITY_HALF) / step);
  var z0 = Math.floor((aabb.minZ + C.CITY_HALF) / step);
  var z1 = Math.floor((aabb.maxZ + C.CITY_HALF) / step);
  for (var cx = x0; cx <= x1; cx++) {
    for (var cz = z0; cz <= z1; cz++) {
      var k = _cellKey(cx, cz);
      if (!_cellMap[k]) _cellMap[k] = [];
      _cellMap[k].push(idx);
    }
  }
}

function getNearbyBuildings(wx, wz) {
  var step = C.CELL_STRIDE;
  var cx = Math.floor((wx + C.CITY_HALF) / step);
  var cz = Math.floor((wz + C.CITY_HALF) / step);
  var seen = {};
  var result = [];
  for (var dx = -1; dx <= 1; dx++) {
    for (var dz = -1; dz <= 1; dz++) {
      var k = _cellKey(cx + dx, cz + dz);
      var arr = _cellMap[k];
      if (!arr) continue;
      for (var i = 0; i < arr.length; i++) {
        var idx = arr[i];
        if (!seen[idx]) {
          seen[idx] = true;
          result.push(cityData.aabbs[idx]);
        }
      }
    }
  }
  return result;
}

// ─── Seeded pseudo-random (deterministic city each load) ─────────────────────
var _seed = 42;
function seededRand() {
  _seed = (_seed * 1664525 + 1013904223) & 0xffffffff;
  return ((_seed >>> 0) / 0xffffffff);
}
function sRandRange(a, b) { return a + seededRand() * (b - a); }
function sRandInt(a, b)   { return Math.floor(sRandRange(a, b + 1)); }

// ─── Main init ────────────────────────────────────────────────────────────────

function initCity(scene, palette) {
  _seed = 42;
  _cellMap = {};
  buildingMaterials = [];
  helipadMaterials  = [];
  cityData.buildings = [];
  cityData.helipads  = [];
  cityData.aabbs     = [];

  var stride = C.CELL_STRIDE;
  var half   = C.CITY_HALF;

  // ── Ground plane ──────────────────────────────────────────────────────────
  var gSize = half * 2.2;
  var gGeo  = new THREE.PlaneGeometry(gSize, gSize, 80, 80);
  gGeo.rotateX(-Math.PI / 2);
  groundMaterial = makeGroundMaterial(palette);
  var ground = new THREE.Mesh(gGeo, groundMaterial);
  ground.position.y = 0;
  ground.renderOrder = 0;
  scene.add(ground);

  // ── Buildings ─────────────────────────────────────────────────────────────
  var bMat = makeBuildingMaterial(palette, 1.0);
  buildingMaterials.push(bMat);

  // Secondary glow material for tall landmark buildings
  var bMatHigh = makeBuildingMaterial(palette, 1.8);
  buildingMaterials.push(bMatHigh);

  for (var gx = 0; gx < C.GRID_CELLS; gx++) {
    for (var gz = 0; gz < C.GRID_CELLS; gz++) {

      // World centre of this block
      var bx = -half + gx * stride + stride * 0.5;
      var bz = -half + gz * stride + stride * 0.5;

      // Skip a few cells for plazas / open areas
      if (seededRand() < 0.06) continue;

      // 1–4 buildings per block
      var count = sRandInt(1, 3);
      var occupied = false;

      for (var b = 0; b < count; b++) {
        var bw = sRandRange(C.BLDG_MIN_W, C.BLDG_MAX_W);
        var bd = sRandRange(C.BLDG_MIN_W, C.BLDG_MAX_W);
        var bh = sRandRange(C.BLDG_MIN_HEIGHT, C.BLDG_MAX_HEIGHT);

        // Skew toward downtown center — taller near middle
        var distCenter = Math.sqrt(bx * bx + bz * bz) / half;
        bh *= (1.4 - distCenter * 0.8);
        bh = Math.max(C.BLDG_MIN_HEIGHT, Math.min(C.BLDG_MAX_HEIGHT, bh));

        // Randomise position within block
        var offsetX = sRandRange(-8, 8);
        var offsetZ = sRandRange(-8, 8);
        var wx = bx + offsetX;
        var wz = bz + offsetZ;

        // Clamp to block footprint
        bw = Math.min(bw, C.BLOCK_SIZE - 6);
        bd = Math.min(bd, C.BLOCK_SIZE - 6);

        // Geometry — simple box with slight taper at top
        var geo = _makeBuildingGeo(bw, bh, bd);
        var mat = bh > 55 ? bMatHigh : bMat;
        var mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(wx, bh / 2, wz);
        scene.add(mesh);

        // AABB
        var aabb = {
          minX: wx - bw / 2, maxX: wx + bw / 2,
          minZ: wz - bd / 2, maxZ: wz + bd / 2,
          topY: bh,
          wx: wx, wz: wz, bw: bw, bd: bd,
          isHelipad: false,
        };
        var aabbIdx = cityData.aabbs.length;
        cityData.aabbs.push(aabb);
        _registerAabb(aabbIdx, aabb);
        cityData.buildings.push({ x: wx, z: wz, w: bw, d: bd, h: bh, aabb: aabb });

        // ── Helipad ───────────────────────────────────────────────────────
        if (bh >= C.HELIPAD_MIN_H && seededRand() < C.HELIPAD_CHANCE && !occupied) {
          occupied = true;
          aabb.isHelipad = true;

          var hpSize = Math.min(bw, bd) * 0.7;
          var hpGeo  = new THREE.CircleGeometry(hpSize / 2, 32);
          var hpMat  = makeHelipadMaterial();
          helipadMaterials.push(hpMat);

          var hp = new THREE.Mesh(hpGeo, hpMat);
          hp.rotation.x = -Math.PI / 2;
          hp.position.set(wx, bh + 0.15, wz);
          hp.renderOrder = 1;
          scene.add(hp);

          // Marker lights (4 corner beacons)
          _addHelipadLights(scene, wx, bh, wz, hpSize / 2, palette);

          cityData.helipads.push({ x: wx, y: bh, z: wz, radius: hpSize / 2 });
        }

        if (b === 0) occupied = true; // first building blocks subsequent helipads on this block
      }
    }
  }

  // ── Street lamp posts ─────────────────────────────────────────────────────
  _addStreetLamps(scene, palette);

  console.log('[City] Buildings:', cityData.buildings.length,
              '| Helipads:', cityData.helipads.length);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _makeBuildingGeo(w, h, d) {
  // Slight taper: top face scaled in slightly
  var shape = new THREE.BoxGeometry(w, h, d, 1, 4, 1);
  var pos = shape.attributes.position;
  for (var i = 0; i < pos.count; i++) {
    var y = pos.getY(i);
    if (y > h * 0.4) {
      var t = (y - h * 0.4) / (h * 0.6);
      var s = 1.0 - t * 0.08;
      pos.setX(i, pos.getX(i) * s);
      pos.setZ(i, pos.getZ(i) * s);
    }
  }
  pos.needsUpdate = true;
  shape.computeVertexNormals();
  return shape;
}

function _addHelipadLights(scene, x, y, z, r, palette) {
  var corners = [
    [x + r * 0.8, z + r * 0.8],
    [x - r * 0.8, z + r * 0.8],
    [x + r * 0.8, z - r * 0.8],
    [x - r * 0.8, z - r * 0.8],
  ];
  corners.forEach(function(c) {
    var lgeo = new THREE.SphereGeometry(0.3, 6, 6);
    var lmat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    var lm   = new THREE.Mesh(lgeo, lmat);
    lm.position.set(c[0], y + 0.5, c[1]);
    scene.add(lm);
    // Store for blinking (game.js handles time)
    if (!window._helipadLights) window._helipadLights = [];
    window._helipadLights.push(lm);
  });
}

function _addStreetLamps(scene, palette) {
  var stride = C.CELL_STRIDE;
  var half   = C.CITY_HALF;
  var lampColor = palette.neonS;

  for (var gx = 0; gx <= C.GRID_CELLS; gx++) {
    for (var gz = 0; gz <= C.GRID_CELLS; gz++) {
      var sx = -half + gx * stride;
      var sz = -half + gz * stride;

      // Only place lamps at street intersections
      var lgeo = new THREE.CylinderGeometry(0.1, 0.1, 6, 4);
      var lmat = new THREE.MeshBasicMaterial({ color: 0x334455 });
      var pole = new THREE.Mesh(lgeo, lmat);
      pole.position.set(sx, 3, sz);
      scene.add(pole);

      // Lamp head glow
      var hgeo = new THREE.SphereGeometry(0.4, 6, 6);
      var hmat = new THREE.MeshBasicMaterial({ color: lampColor });
      var head = new THREE.Mesh(hgeo, hmat);
      head.position.set(sx, 6.3, sz);
      scene.add(head);
    }
  }
}

// ─── Per-frame updates ────────────────────────────────────────────────────────

function updateCityUniforms(time) {
  if (groundMaterial) groundMaterial.uniforms.time.value = time;

  for (var i = 0; i < buildingMaterials.length; i++) {
    buildingMaterials[i].uniforms.time.value = time;
  }
  for (var j = 0; j < helipadMaterials.length; j++) {
    helipadMaterials[j].uniforms.time.value = time;
  }

  // Blink helipad lights
  if (window._helipadLights) {
    var blink = Math.sin(time * 3.0) > 0.0;
    for (var k = 0; k < window._helipadLights.length; k++) {
      window._helipadLights[k].visible = blink;
    }
  }
}
