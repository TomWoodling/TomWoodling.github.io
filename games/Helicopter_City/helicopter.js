// helicopter.js — GLB loader, rotor effects, hover physics, landing state
// =======================================================================

var heliState = {
  pos:           new THREE.Vector3(0, C.HELI_START_HEIGHT, 0),
  vel:           new THREE.Vector3(0, 0, 0),
  yaw:           0,
  tiltX:         0,
  tiltZ:         0,
  onGround:      false,
  landed:        false,
  activeHelipad: null,
  engineOn:      true,
  rotorSpin:     0,
};

// Scene graph:
//   _heliRoot (Group)      <- position + yaw
//     _modelPivot (Group)  <- Math.PI correction + tilt
//       model / placeholder
//       _rotorDisc
//       _tailRotor

var _heliRoot     = null;
var _modelPivot   = null;
var _heliBody     = null;
var _rotorDisc    = null;
var _tailRotor    = null;
var _rotorMat     = null;
var _tailRotorMat = null;
var _loaded       = false;

// ─── Placeholder ──────────────────────────────────────────────────────────────

function _makePlaceholder() {
  var g = new THREE.Group();

  var bodyGeo = new THREE.SphereGeometry(1.0, 12, 8);
  bodyGeo.applyMatrix4(new THREE.Matrix4().makeScale(2.8, 1.0, 1.0));
  var body = new THREE.Mesh(bodyGeo,
    new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.3, roughness: 0.5 }));
  g.add(body);

  var tail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.35, 4.0, 8),
    new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.3, roughness: 0.5 }));
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-3.2, 0.15, 0);
  g.add(tail);

  [-1, 1].forEach(function(side) {
    var skid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 }));
    skid.rotation.z = Math.PI / 2;
    skid.position.set(0, -1.1, side * 0.9);
    g.add(skid);
  });

  return g;
}

// ─── Rotor discs ──────────────────────────────────────────────────────────────
// modelBox is measured in model-local space BEFORE the Math.PI pivot correction.
// In that space: nose = +Z, tail = -Z, top = +Y.

function _addRotors(pivot, modelBox) {
  if (_rotorDisc) pivot.remove(_rotorDisc);
  if (_tailRotor) pivot.remove(_tailRotor);

  // Main rotor — horizontal disc, just above model top
  _rotorMat  = makeRotorMaterial(new THREE.Color(0xaaccff));
  _rotorDisc = new THREE.Mesh(new THREE.CircleGeometry(C.ROTOR_RADIUS, 64), _rotorMat);
  _rotorDisc.rotation.x = -Math.PI / 2;
  _rotorDisc.position.set(0, modelBox.max.y + 0.15, 0);
  pivot.add(_rotorDisc);

  // Tail rotor — vertical disc at tail end (model-local min.z = tail before flip)
  _tailRotorMat = makeRotorMaterial(new THREE.Color(0x88aaff));
  _tailRotor    = new THREE.Mesh(new THREE.CircleGeometry(C.TAIL_ROTOR_RADIUS, 32), _tailRotorMat);
  _tailRotor.rotation.y = Math.PI / 2;
  _tailRotor.position.set(0, modelBox.max.y * 0.5, modelBox.min.z - 0.1);
  pivot.add(_tailRotor);

  console.log('[Heli] Rotors — main Y:', _rotorDisc.position.y.toFixed(2),
              '| tail Z:', _tailRotor.position.z.toFixed(2));
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function initHelicopter(scene, modelPath) {
  _heliRoot   = new THREE.Group();
  _modelPivot = new THREE.Group();
  _heliRoot.add(_modelPivot);
  _heliRoot.position.copy(heliState.pos);
  scene.add(_heliRoot);

  var placeholder = _makePlaceholder();
  _modelPivot.add(placeholder);
  _heliBody = placeholder;

  _addRotors(_modelPivot, new THREE.Box3(
    new THREE.Vector3(-2.5, -1.2, -1.0),
    new THREE.Vector3( 2.5,  1.5,  1.0)
  ));

  if (modelPath && typeof THREE.GLTFLoader !== 'undefined' && THREE.GLTFLoader !== null) {
    var loader = new THREE.GLTFLoader();

    if (typeof THREE.DRACOLoader !== 'undefined') {
      var dracoLoader = new THREE.DRACOLoader();
      dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
      dracoLoader.setDecoderConfig({ type: 'wasm' });
      loader.setDRACOLoader(dracoLoader);
    }

    return new Promise(function(resolve) {
      loader.load(modelPath, function(gltf) {

        _modelPivot.remove(placeholder);
        var model = gltf.scene;

        model.traverse(function(child) {
          if (child.isMesh) { child.castShadow = false; child.receiveShadow = false; }
        });

        // Auto-scale to 5 units on longest axis
        var box  = new THREE.Box3().setFromObject(model);
        var size = new THREE.Vector3();
        box.getSize(size);
        var maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) model.scale.setScalar(5.0 / maxDim);

        // Re-centre pivot at body midpoint
        box.setFromObject(model);
        var centre = new THREE.Vector3();
        box.getCenter(centre);
        model.position.sub(centre);

        // Blender exports with -90 X baked in (Z-up -> Y-up conversion).
        // After that, the nose (Blender -Y) lands at Three.js +Z (facing camera).
        // rotateY(PI) flips it to face -Z = correct Three.js "forward".
        // This base correction lives permanently on _modelPivot; tilt is added
        // each frame on top of it using Euler order YXZ.
        _modelPivot.rotation.set(0, Math.PI, 0, 'YXZ');

        _modelPivot.add(model);
        _heliBody = model;
        _loaded   = true;

        // Measure AFTER recentre but BEFORE adding to pivot (pre-correction space)
        box.setFromObject(model);
        _addRotors(_modelPivot, box);

        console.log('[Heli] Loaded. Box min:', box.min.toArray().map(function(v){ return v.toFixed(2); }),
                    'max:', box.max.toArray().map(function(v){ return v.toFixed(2); }));
        resolve(model);

      }, undefined, function(err) {
        console.warn('[Heli] Load failed, using placeholder:', err);
        resolve(null);
      });
    });
  }

  return Promise.resolve(null);
}

// ─── Physics & visuals update ─────────────────────────────────────────────────

function updateHelicopter(dt, input) {
  if (!_heliRoot) return;

  var s = heliState;
  var p = s.pos;
  var v = s.vel;

  var fwd   = input.fwd || 0;
  var lat   = input.lat || 0;
  var up    = input.up  || 0;
  var yawIn = input.yaw || 0;

  s.yaw += yawIn * dt * 1.8;

  var sinY = Math.sin(s.yaw);
  var cosY = Math.cos(s.yaw);

  // W (fwd=+1) moves forward. With Math.PI correction nose faces -Z,
  // so forward thrust is -Z. sinY/cosY rotate that into world axes.
  var fx = -(fwd * cosY - lat * sinY) * C.HELI_LATERAL;  // wait — derive carefully:
  // When yaw=0: forward = -Z, so fz should be negative for fwd=+1.
  // fz = -(fwd * cosY) = -fwd when yaw=0. Correct.
  // strafe right (lat=+1) at yaw=0 should move +X. fx = lat when yaw=0.
  // General: fx = lat*cosY + fwd*sinY, fz = -(fwd*cosY - lat*sinY) ... let's be explicit:
  fx = (lat * cosY + fwd * sinY) * C.HELI_LATERAL;
  var fz = (-fwd * cosY + lat * sinY) * C.HELI_LATERAL;
  var fy = up * C.HELI_THRUST - C.HELI_HOVER_GRAVITY;

  if (s.landed && up <= 0) {
    v.set(0, 0, 0);
    _heliRoot.rotation.y = s.yaw;
    return;
  }

  v.x += fx * dt;
  v.y += fy * dt;
  v.z += fz * dt;

  v.x *= Math.pow(C.HELI_DRAG, dt * 60);
  v.z *= Math.pow(C.HELI_DRAG, dt * 60);
  v.y *= Math.pow(0.92,        dt * 60);

  var nx = p.x + v.x * dt;
  var ny = p.y + v.y * dt;
  var nz = p.z + v.z * dt;

  // ── Collision ────────────────────────────────────────────────────────────
  var nearby = getNearbyBuildings(nx, nz);
  var r = C.HELI_COLLISION_RADIUS;
  s.landed        = false;
  s.activeHelipad = null;

  for (var i = 0; i < nearby.length; i++) {
    var ab = nearby[i];
    if (!(nx > ab.minX - r && nx < ab.maxX + r)) continue;
    if (!(nz > ab.minZ - r && nz < ab.maxZ + r)) continue;

    if (ab.isHelipad && v.y <= 0 && ny <= ab.topY + r && ny >= ab.topY - 0.5) {
      s.landed = true; s.activeHelipad = ab;
      ny = ab.topY + r * 0.5; v.y = 0;
      continue;
    }
    if (ny <= ab.topY + r && p.y >= ab.topY) {
      ny = ab.topY + r; v.y = Math.abs(v.y) * C.HELI_BOUNCE_FORCE;
      continue;
    }
    if (ny < ab.topY) {
      var overX = (nx < (ab.minX + ab.maxX) / 2) ? ab.minX - r - nx : ab.maxX + r - nx;
      var overZ = (nz < (ab.minZ + ab.maxZ) / 2) ? ab.minZ - r - nz : ab.maxZ + r - nz;
      if (Math.abs(overX) < Math.abs(overZ)) { nx += overX; v.x *= -C.HELI_BOUNCE_FORCE; }
      else                                   { nz += overZ; v.z *= -C.HELI_BOUNCE_FORCE; }
    }
  }

  // ── Floor ────────────────────────────────────────────────────────────────
  if (ny < r + 0.5) { ny = r + 0.5; v.y = Math.abs(v.y) * C.HELI_BOUNCE_FORCE; }

  // ── Soft city boundary ───────────────────────────────────────────────────
  var boundary = C.CITY_HALF * 0.95;
  if (Math.abs(nx) > boundary) v.x -= Math.sign(nx) * C.WORLD_BOUNDARY_PUSH * dt * 60;
  if (Math.abs(nz) > boundary) v.z -= Math.sign(nz) * C.WORLD_BOUNDARY_PUSH * dt * 60;

  // ── Commit position ──────────────────────────────────────────────────────
  p.set(nx, ny, nz);
  _heliRoot.position.copy(p);   // <-- sync scene graph to physics state

  // ── Visual tilt (on _modelPivot, preserving Math.PI base) ────────────────
  var tgtTiltX = fwd * C.HELI_TILT_MAX;
  var tgtTiltZ = lat * C.HELI_TILT_MAX;
  s.tiltX += (tgtTiltX - s.tiltX) * C.HELI_TILT_SPEED * dt;
  s.tiltZ += (tgtTiltZ - s.tiltZ) * C.HELI_TILT_SPEED * dt;

  _heliRoot.rotation.y = s.yaw;
  if (_modelPivot) _modelPivot.rotation.set(s.tiltX, Math.PI, s.tiltZ, 'YXZ');

  // ── Rotor spin ───────────────────────────────────────────────────────────
  s.rotorSpin += C.HELI_ROTOR_SPEED * dt;
  if (_rotorMat)     { _rotorMat.uniforms.spin.value     = s.rotorSpin;       _rotorMat.uniforms.time.value     += dt; }
  if (_tailRotorMat) { _tailRotorMat.uniforms.spin.value = s.rotorSpin * 2.5; _tailRotorMat.uniforms.time.value += dt; }
}

function getHeliWorldPos() { return heliState.pos.clone(); }
