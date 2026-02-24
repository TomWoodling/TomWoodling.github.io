// traffic.js — Street-grid car agents and gridlock events
// =========================================================
// Cars follow axis-aligned street paths, turn at intersections.
// Gridlock events slow/stop cars in a radius around a world position.
// =========================================================

var trafficCars  = [];    // array of car state objects
var _carMeshes   = null;  // THREE.InstancedMesh
var _dummy       = new THREE.Object3D();

var gridlockEvent = {
  active:   false,
  pos:      new THREE.Vector3(),
  radius:   C.GRIDLOCK_RADIUS,
  timeLeft: 0,
};

// ─── Street path helpers ──────────────────────────────────────────────────────
// Streets run at: x = -CITY_HALF + n * CELL_STRIDE  (vertical streets)
//                 z = -CITY_HALF + n * CELL_STRIDE  (horizontal streets)

function _nearestStreetX(wx) {
  var stride = C.CELL_STRIDE;
  return -C.CITY_HALF + Math.round((wx + C.CITY_HALF) / stride) * stride;
}
function _nearestStreetZ(wz) {
  var stride = C.CELL_STRIDE;
  return -C.CITY_HALF + Math.round((wz + C.CITY_HALF) / stride) * stride;
}

// ─── Car state factory ────────────────────────────────────────────────────────

function _makeCar(seed) {
  var r = function(a, b) { return a + (seed = (seed * 1664525 + 1013904223) >>> 0, (seed / 0xffffffff)) * (b - a); };

  var half   = C.CITY_HALF * 0.9;
  var stride = C.CELL_STRIDE;

  // Pick a random intersection as start
  var gx = Math.floor(r(0, C.GRID_CELLS));
  var gz = Math.floor(r(0, C.GRID_CELLS));
  var sx = -C.CITY_HALF + gx * stride;
  var sz = -C.CITY_HALF + gz * stride;

  // Direction: 0=+X, 1=-X, 2=+Z, 3=-Z
  var dir = Math.floor(r(0, 4));

  return {
    x:       sx,
    z:       sz,
    dir:     dir,
    speed:   C.CAR_SPEED + r(-C.CAR_SPEED_VAR, C.CAR_SPEED_VAR),
    lane:    (r(0,1) > 0.5 ? 1 : -1) * 1.8,  // lateral offset within street
    waiting: 0,   // gridlock wait timer
    idx:     0,   // InstancedMesh index (set at init)
  };
}

// ─── Public init ──────────────────────────────────────────────────────────────

function initTraffic(scene) {
  trafficCars = [];

  // Two car colours: grey sedans and yellow taxis
  var geo = new THREE.BoxGeometry(3.0, 1.2, 1.6);
  var mat = new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.4, roughness: 0.5 });
  _carMeshes = new THREE.InstancedMesh(geo, mat, C.TRAFFIC_COUNT);
  _carMeshes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(_carMeshes);

  for (var i = 0; i < C.TRAFFIC_COUNT; i++) {
    var car  = _makeCar(i * 6364136223846793005 + 1442695040888963407);
    car.idx  = i;
    trafficCars.push(car);
    _syncCarMesh(car);
  }
}

// ─── Per-frame update ─────────────────────────────────────────────────────────

function updateTraffic(dt) {
  var stride = C.CELL_STRIDE;
  var half   = C.CITY_HALF;

  // Update gridlock timer
  if (gridlockEvent.active) {
    gridlockEvent.timeLeft -= dt;
    if (gridlockEvent.timeLeft <= 0) gridlockEvent.active = false;
  }

  for (var i = 0; i < trafficCars.length; i++) {
    var car = trafficCars[i];

    // Gridlock slowdown
    var gx = gridlockEvent.active ? (car.x - gridlockEvent.pos.x) : 9999;
    var gz = gridlockEvent.active ? (car.z - gridlockEvent.pos.z) : 9999;
    var inGridlock = (Math.sqrt(gx*gx + gz*gz) < gridlockEvent.radius);
    var speed = inGridlock ? car.speed * 0.08 : car.speed;

    var dx = 0, dz = 0;
    switch (car.dir) {
      case 0: dx =  speed * dt; break;
      case 1: dx = -speed * dt; break;
      case 2: dz =  speed * dt; break;
      case 3: dz = -speed * dt; break;
    }

    car.x += dx;
    car.z += dz;

    // Wrap at city edge
    if (car.x >  half) { car.x = -half; }
    if (car.x < -half) { car.x =  half; }
    if (car.z >  half) { car.z = -half; }
    if (car.z < -half) { car.z =  half; }

    // Random turn at intersections (every CELL_STRIDE)
    var relX = (car.x + half) % stride;
    var relZ = (car.z + half) % stride;
    var atIntersect = (relX < speed * dt * 2 || relX > stride - speed * dt * 2) &&
                      (relZ < speed * dt * 2 || relZ > stride - speed * dt * 2);

    if (atIntersect && Math.random() < 0.15) {
      car.dir = (car.dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
    }

    _syncCarMesh(car);
  }

  if (_carMeshes) _carMeshes.instanceMatrix.needsUpdate = true;
}

function _syncCarMesh(car) {
  if (!_carMeshes) return;
  _dummy.position.set(car.x, 0.6, car.z);
  var angle = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][car.dir] || 0;
  _dummy.rotation.y = angle;
  _dummy.updateMatrix();
  _carMeshes.setMatrixAt(car.idx, _dummy.matrix);
}

// ─── Trigger gridlock event ───────────────────────────────────────────────────

function triggerGridlock(wx, wz) {
  gridlockEvent.active   = true;
  gridlockEvent.pos.set(wx, 0, wz);
  gridlockEvent.timeLeft = C.GRIDLOCK_DURATION;
  gridlockEvent.radius   = C.GRIDLOCK_RADIUS;
  console.log('[Traffic] Gridlock at', wx.toFixed(0), wz.toFixed(0));
}
