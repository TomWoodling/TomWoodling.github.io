// helicopter.js
// =============================================================================
// COORDINATE CONTRACT — read this before touching anything:
//
//   _heliRoot  (Group)
//     Owns: world position (heliState.pos) + world yaw (heliState.yaw)
//     Never has pitch or roll.
//
//   _orientPivot  (Group, child of _heliRoot)
//     Owns: ONE permanent rotation — rotateY(Math.PI)
//     This corrects for Blender's GLTF export convention:
//       Blender -Y axis (nose) -> Three.js +Z after Z-up->Y-up bake
//       rotateY(PI) flips that to -Z = Three.js "forward"
//     Set ONCE at load time, NEVER changed again.
//
//   _tiltPivot  (Group, child of _orientPivot)
//     Owns: live pitch (X rotation) and roll (Z rotation) tilt.
//     This is separate from _orientPivot so tilt never
//     interferes with the orientation correction.
//
//   model / placeholder  (child of _tiltPivot)
//     Never rotated.
//
//   _rotorDisc, _tailRotor  (children of _tiltPivot)
//     Tilt with the body. Positioned in model-local space.
//
// MOVEMENT CONVENTION:
//   After rotateY(PI), helicopter nose points toward -Z in world space.
//   At yaw=0:
//     W (fwd=+1)  -> move in -Z direction  -> fz = -fwd
//     D (lat=+1)  -> move in +X direction  -> fx = +lat
//   At arbitrary yaw, rotate those vectors by yaw angle:
//     fx =  lat * cos(yaw) + fwd * sin(yaw)   [but see negation below]
//     fz = -fwd * cos(yaw) + lat * sin(yaw)
//   Wait — at yaw=0: fx = lat*1 + fwd*0 = lat  CHECK
//                    fz = -fwd*1 + lat*0 = -fwd CHECK
//
// CAMERA CONVENTION:
//   Camera sits in the +Z direction from the helicopter (behind the tail)
//   at height CAM_UP above it. At yaw=0 that is (0, CAM_UP, CAM_BACK).
//   Rotated by yaw: cam = heli + (sin(yaw)*BACK, UP, cos(yaw)*BACK)
//   Look-at is ahead of heli: heli + (-sin(yaw)*AHEAD, 0, -cos(yaw)*AHEAD)
// =============================================================================

var heliState = {
  pos:           new THREE.Vector3(0, C.HELI_START_HEIGHT, 0),
  vel:           new THREE.Vector3(0, 0, 0),
  yaw:           0,
  tiltX:         0,
  tiltZ:         0,
  landed:        false,
  activeHelipad: null,
  rotorSpin:     0,
};

var _heliRoot    = null;
var _orientPivot = null;
var _tiltPivot   = null;
var _heliBody    = null;
var _rotorDisc   = null;
var _tailRotor   = null;
var _rotorMat    = null;
var _tailRotorMat= null;

// =============================================================================
// Placeholder
// =============================================================================

function _makePlaceholder() {
  var g = new THREE.Group();

  // Elongated sphere for fuselage (r128 compatible — no CapsuleGeometry)
  var bodyGeo = new THREE.SphereGeometry(1.0, 12, 8);
  bodyGeo.applyMatrix4(new THREE.Matrix4().makeScale(2.8, 1.0, 1.0));
  g.add(new THREE.Mesh(bodyGeo,
    new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.3, roughness: 0.5 })));

  // Tail boom pointing in -X (will become +Z after orientPivot flips it)
  var tail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.32, 3.8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.3, roughness: 0.5 }));
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-3.0, 0.1, 0);
  g.add(tail);

  // Skids
  [-1, 1].forEach(function(side) {
    var skid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 3.0, 6),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 }));
    skid.rotation.z = Math.PI / 2;
    skid.position.set(0, -1.0, side * 0.85);
    g.add(skid);
  });

  return g;
}

// =============================================================================
// Rotor discs
// Positioned in model-local space using config offsets + measured bounding box.
// After orientPivot's rotateY(PI):
//   model-local +Z (nose) maps to world -Z
//   model-local -Z (tail) maps to world +Z
// So box.min.z is the tail in model-local space — correct for tail rotor.
// =============================================================================

function _buildRotors(parent, box) {
  if (_rotorDisc)  { parent.remove(_rotorDisc);  _rotorDisc  = null; }
  if (_tailRotor)  { parent.remove(_tailRotor);   _tailRotor  = null; }

  // Main rotor — horizontal, above fuselage roof
  _rotorMat  = makeRotorMaterial(new THREE.Color(0xaaccff));
  _rotorDisc = new THREE.Mesh(new THREE.CircleGeometry(C.ROTOR_RADIUS, 64), _rotorMat);
  _rotorDisc.rotation.x = -Math.PI / 2;
  _rotorDisc.position.set(0, box.max.y + C.ROTOR_Y_ABOVE_TOP, 0);
  parent.add(_rotorDisc);

  // Tail rotor — vertical, at tail end
  _tailRotorMat = makeRotorMaterial(new THREE.Color(0x88aaff));
  _tailRotor    = new THREE.Mesh(
    new THREE.CircleGeometry(C.TAIL_ROTOR_RADIUS, 32), _tailRotorMat);
  _tailRotor.rotation.y = Math.PI / 2;
  _tailRotor.position.set(
    0,
    box.max.y * C.TAIL_ROTOR_HEIGHT_FACTOR,
    box.min.z + C.TAIL_ROTOR_Z_BEHIND
  );
  parent.add(_tailRotor);

  console.log('[Heli] Rotors set — main Y:', _rotorDisc.position.y.toFixed(3),
              '| tail Z:', _tailRotor.position.z.toFixed(3));
}

// =============================================================================
// Init
// =============================================================================

function initHelicopter(scene, modelPath) {

  // Build hierarchy
  _heliRoot    = new THREE.Group();
  _orientPivot = new THREE.Group();
  _tiltPivot   = new THREE.Group();

  _heliRoot.add(_orientPivot);
  _orientPivot.add(_tiltPivot);

  // orientPivot correction: permanent, never changes after this line
  _orientPivot.rotation.y = Math.PI;

  _heliRoot.position.copy(heliState.pos);
  scene.add(_heliRoot);

  // Show placeholder immediately
  var ph = _makePlaceholder();
  _tiltPivot.add(ph);
  _heliBody = ph;

  // Approximate rotors for placeholder
  _buildRotors(_tiltPivot, new THREE.Box3(
    new THREE.Vector3(-2.5, -1.0, -1.0),
    new THREE.Vector3( 2.5,  1.2,  1.0)
  ));

  // Load GLB if available
  if (modelPath &&
      typeof THREE.GLTFLoader !== 'undefined' &&
      THREE.GLTFLoader !== null) {

    var loader = new THREE.GLTFLoader();

    if (typeof THREE.DRACOLoader !== 'undefined') {
      var draco = new THREE.DRACOLoader();
      draco.setDecoderPath(
        'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
      draco.setDecoderConfig({ type: 'wasm' });
      loader.setDRACOLoader(draco);
    }

    return new Promise(function(resolve) {
      loader.load(modelPath,
        function(gltf) {
          _tiltPivot.remove(ph);

          var model = gltf.scene;
          model.traverse(function(c) {
            if (c.isMesh) { c.castShadow = false; c.receiveShadow = false; }
          });

          // ── Scale: fit longest axis to 5 world units ──────────────────
          // Measure BEFORE adding to scene to get raw model-local size.
          var rawBox  = new THREE.Box3().setFromObject(model);
          var rawSize = new THREE.Vector3();
          rawBox.getSize(rawSize);
          var maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
          if (maxDim > 0) model.scale.setScalar(5.0 / maxDim);

          // ── Centre: shift so bounding box midpoint is at group origin ─
          // Re-measure after scale (still not in scene, so world = local).
          var scaledBox = new THREE.Box3().setFromObject(model);
          var centre    = new THREE.Vector3();
          scaledBox.getCenter(centre);
          model.position.sub(centre);

          // ── Add to tiltPivot ──────────────────────────────────────────
          _tiltPivot.add(model);
          _heliBody = model;

          // ── Measure final local box for rotor placement ───────────────
          // model.position has been adjusted so centre is at origin.
          // getObjectByProperty traversal finds actual mesh bounds.
          // We measure model standalone (before it picks up parent transforms)
          // by temporarily removing it, measuring, then re-adding.
          _tiltPivot.remove(model);
          var localBox = new THREE.Box3().setFromObject(model);
          _tiltPivot.add(model);

          console.log('[Heli] Model box — min:',
            localBox.min.toArray().map(function(v){ return (+v).toFixed(3); }),
            'max:',
            localBox.max.toArray().map(function(v){ return (+v).toFixed(3); }));

          _buildRotors(_tiltPivot, localBox);

          console.log('[Heli] GLB ready:', modelPath);
          resolve(model);
        },
        undefined,
        function(err) {
          console.warn('[Heli] Load failed, keeping placeholder:', err);
          resolve(null);
        }
      );
    });
  }

  return Promise.resolve(null);
}

// =============================================================================
// Update — called every frame from game.js
// =============================================================================

function updateHelicopter(dt, input) {
  if (!_heliRoot) return;

  var s = heliState;
  var p = s.pos;
  var v = s.vel;

  var fwd   = input.fwd || 0;   // +1 = W (forward)
  var lat   = input.lat || 0;   // +1 = D (right)
  var up    = input.up  || 0;   // +1 = Space (up)
  var yawIn = input.yaw || 0;   // +1 = E (rotate right)

  // Yaw
  s.yaw += yawIn * dt * 1.8;

  // ── Movement forces ────────────────────────────────────────────────────────
  // See coordinate contract at top of file for derivation.
  // At yaw=0: fwd pushes -Z, lat pushes +X.
  var sinY = Math.sin(s.yaw);
  var cosY = Math.cos(s.yaw);
  var fx =  lat * cosY + fwd * sinY;
  var fz = -fwd * cosY + lat * sinY;
  fx *= C.HELI_LATERAL;
  fz *= C.HELI_LATERAL;
  var fy = up * C.HELI_THRUST - C.HELI_HOVER_GRAVITY;

  // Hold still on ground when not lifting
  if (s.landed && up <= 0) {
    v.set(0, 0, 0);
    _heliRoot.rotation.y = s.yaw;
    return;
  }

  // Integrate velocity
  v.x += fx * dt;
  v.y += fy * dt;
  v.z += fz * dt;

  // Drag
  var dragXZ = Math.pow(C.HELI_DRAG, dt * 60);
  var dragY  = Math.pow(0.92,        dt * 60);
  v.x *= dragXZ;
  v.z *= dragXZ;
  v.y *= dragY;

  var nx = p.x + v.x * dt;
  var ny = p.y + v.y * dt;
  var nz = p.z + v.z * dt;

  // ── Building collision ────────────────────────────────────────────────────
  var r      = C.HELI_COLLISION_RADIUS;
  var nearby = getNearbyBuildings(nx, nz);
  s.landed        = false;
  s.activeHelipad = null;

  for (var i = 0; i < nearby.length; i++) {
    var ab = nearby[i];
    if (nx <= ab.minX - r || nx >= ab.maxX + r) continue;
    if (nz <= ab.minZ - r || nz >= ab.maxZ + r) continue;

    // Landing on helipad
    if (ab.isHelipad && v.y <= 0 && ny <= ab.topY + r && ny >= ab.topY - 0.8) {
      s.landed = true; s.activeHelipad = ab;
      ny = ab.topY + r * 0.5; v.y = 0;
      continue;
    }

    // Bounce off roof
    if (ny <= ab.topY + r && p.y >= ab.topY - 0.5) {
      ny = ab.topY + r;
      v.y = Math.abs(v.y) * C.HELI_BOUNCE_FORCE;
      continue;
    }

    // Side push-out (smallest overlap axis)
    if (ny < ab.topY) {
      var cx    = (ab.minX + ab.maxX) * 0.5;
      var cz    = (ab.minZ + ab.maxZ) * 0.5;
      var overX = nx < cx ? ab.minX - r - nx : ab.maxX + r - nx;
      var overZ = nz < cz ? ab.minZ - r - nz : ab.maxZ + r - nz;
      if (Math.abs(overX) < Math.abs(overZ)) { nx += overX; v.x *= -C.HELI_BOUNCE_FORCE; }
      else                                   { nz += overZ; v.z *= -C.HELI_BOUNCE_FORCE; }
    }
  }

  // Floor
  var floor = r + 0.5;
  if (ny < floor) { ny = floor; v.y = Math.abs(v.y) * C.HELI_BOUNCE_FORCE; }

  // Soft city boundary
  var bound = C.CITY_HALF * 0.95;
  if (Math.abs(nx) > bound) v.x -= Math.sign(nx) * C.WORLD_BOUNDARY_PUSH * dt * 60;
  if (Math.abs(nz) > bound) v.z -= Math.sign(nz) * C.WORLD_BOUNDARY_PUSH * dt * 60;

  // ── Commit ────────────────────────────────────────────────────────────────
  p.set(nx, ny, nz);
  _heliRoot.position.copy(p);
  _heliRoot.rotation.y = s.yaw;

  // ── Visual tilt (on _tiltPivot only) ──────────────────────────────────────
  // Pitch: nose dips when moving forward (fwd > 0 = negative X rotation)
  // Roll:  bank right when strafing right (lat > 0 = positive Z rotation)
  var tgtX = -fwd * C.HELI_TILT_MAX;
  var tgtZ =  lat * C.HELI_TILT_MAX;
  s.tiltX += (tgtX - s.tiltX) * C.HELI_TILT_SPEED * dt;
  s.tiltZ += (tgtZ - s.tiltZ) * C.HELI_TILT_SPEED * dt;

  if (_tiltPivot) {
    _tiltPivot.rotation.x = s.tiltX;
    _tiltPivot.rotation.z = s.tiltZ;
  }

  // ── Rotor spin ────────────────────────────────────────────────────────────
  s.rotorSpin += C.HELI_ROTOR_SPEED * dt;
  if (_rotorMat) {
    _rotorMat.uniforms.spin.value = s.rotorSpin;
    _rotorMat.uniforms.time.value += dt;
  }
  if (_tailRotorMat) {
    _tailRotorMat.uniforms.spin.value = s.rotorSpin * 2.5;
    _tailRotorMat.uniforms.time.value += dt;
  }
}

function getHeliWorldPos() { return heliState.pos.clone(); }
