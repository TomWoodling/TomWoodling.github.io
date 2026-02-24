// helicopter.js — GLB loader, rotor effects, hover physics, landing state
// =======================================================================
// Public API:
//   initHelicopter(scene, modelPath)  → Promise
//   updateHelicopter(dt, input)
//   heliState  { pos, vel, onGround, landed, activeHelipad }
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

// Scene graph structure:
//
//   _heliRoot  (THREE.Group)          ← position + yaw live here
//     └─ _modelPivot  (THREE.Group)   ← tilt (pitch/roll) + model correction live here
//          └─ model / placeholder     ← GLB scene, never rotated directly
//          └─ _rotorDisc              ← main rotor, parented here so it tilts with body
//          └─ _tailRotor              ← tail rotor, same

var _heliRoot    = null;
var _modelPivot  = null;   // tilt applied here — keeps GLB correction isolated
var _heliBody    = null;   // the loaded GLB scene (or placeholder group)
var _rotorDisc   = null;
var _tailRotor   = null;
var _rotorMat    = null;
var _tailRotorMat= null;
var _loaded      = false;

// ─── Placeholder (shown while GLB loads or if load fails) ────────────────────

function _makePlaceholder() {
  var g = new THREE.Group();

  var bodyGeo = new THREE.CapsuleGeometry(1.0, 2.8, 8, 12);
  var bodyMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.3, roughness: 0.5 });
  var body    = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.z = Math.PI / 2;
  g.add(body);

  var tailGeo = new THREE.CylinderGeometry(0.2, 0.35, 4.0, 8);
  var tailMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.3, roughness: 0.5 });
  var tail    = new THREE.Mesh(tailGeo, tailMat);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-3.2, 0.15, 0);
  g.add(tail);

  [-1, 1].forEach(function(side) {
    var sGeo = new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6);
    var sMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
    var s    = new THREE.Mesh(sGeo, sMat);
    s.rotation.z = Math.PI / 2;
    s.position.set(0, -1.1, side * 0.9);
    g.add(s);
  });

  return g;
}

// ─── Rotor disc setup ─────────────────────────────────────────────────────────
// Called after model loads so we can position against actual bounding box.

function _addRotors(pivot, modelBox) {
  // Remove any previously added rotors (in case of reload)
  if (_rotorDisc)  pivot.remove(_rotorDisc);
  if (_tailRotor)  pivot.remove(_tailRotor);

  // Main rotor — horizontal disc above body
  var rGeo   = new THREE.CircleGeometry(C.ROTOR_RADIUS, 64);
  _rotorMat  = makeRotorMaterial(new THREE.Color(0xaaccff));
  _rotorDisc = new THREE.Mesh(rGeo, _rotorMat);
  _rotorDisc.rotation.x = -Math.PI / 2;
  // Sit just above the top of the model
  _rotorDisc.position.set(0, modelBox.max.y + 0.2, 0);
  pivot.add(_rotorDisc);

  // Tail rotor — vertical disc at tail end
  // For a Blender helicopter with nose toward -Z:
  //   tail is at +Z (box.max.z), and the rotor spins on the XY plane
  var trGeo     = new THREE.CircleGeometry(C.TAIL_ROTOR_RADIUS, 32);
  _tailRotorMat = makeRotorMaterial(new THREE.Color(0x88aaff));
  _tailRotor    = new THREE.Mesh(trGeo, _tailRotorMat);
  // No extra rotation — circle already faces forward (+Z), correct for tail rotor
  _tailRotor.position.set(
    0,
    modelBox.max.y * 0.55,
    modelBox.max.z + 0.1   // behind the tail
  );
  pivot.add(_tailRotor);

  console.log('[Heli] Rotors placed — main Y:', _rotorDisc.position.y.toFixed(2),
              '| tail Z:', _tailRotor.position.z.toFixed(2));
}

// ─── Public init ──────────────────────────────────────────────────────────────

function initHelicopter(scene, modelPath) {
  _heliRoot   = new THREE.Group();
  _modelPivot = new THREE.Group();
  _heliRoot.add(_modelPivot);
  _heliRoot.position.copy(heliState.pos);
  scene.add(_heliRoot);

  // Show placeholder immediately
  var placeholder = _makePlaceholder();
  _modelPivot.add(placeholder);
  _heliBody = placeholder;

  // Rotors on placeholder — approximate position
  var approxBox = new THREE.Box3(
    new THREE.Vector3(-2.5, -1.2, -1.0),
    new THREE.Vector3( 2.5,  1.5,  1.0)
  );
  _addRotors(_modelPivot, approxBox);

  if (modelPath && typeof THREE.GLTFLoader !== 'undefined' && THREE.GLTFLoader !== null) {
    var loader = new THREE.GLTFLoader();

    if (typeof THREE.DRACOLoader !== 'undefined') {
      var dracoLoader = new THREE.DRACOLoader();
      dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
      dracoLoader.setDecoderConfig({ type: 'wasm' });
      loader.setDRACOLoader(dracoLoader);
    }

    return new Promise(function(resolve) {
      loader.load(
        modelPath,
        function(gltf) {
          // ── Remove placeholder ──────────────────────────────────────
          _modelPivot.remove(placeholder);

          var model = gltf.scene;

          // ── Shadows off (synthwave look — no shadow maps needed) ────
          model.traverse(function(child) {
            if (child.isMesh) {
              child.castShadow    = false;
              child.receiveShadow = false;
            }
          });

          // ── Auto-scale: fit longest axis to 5 units ─────────────────
          var box  = new THREE.Box3().setFromObject(model);
          var size = new THREE.Vector3();
          box.getSize(size);
          var maxDim = Math.max(size.x, size.y, size.z);
          var targetSize = 5.0;
          if (maxDim > 0) model.scale.setScalar(targetSize / maxDim);

          // ── Re-centre: pivot at body midpoint ───────────────────────
          // Do this AFTER scaling so box values are in world scale
          box.setFromObject(model);
          var centre = new THREE.Vector3();
          box.getCenter(centre);
          model.position.sub(centre);

          // ── Orientation fix ─────────────────────────────────────────
          // Blender GLTF export applies a -90° X correction to the root
          // node to convert Z-up → Y-up. After that conversion, a helicopter
          // whose nose pointed along Blender's -Y axis now points along
          // Three.js's +Z (toward camera). We fix this on _modelPivot so the
          // GLB itself is never touched:
          //   - rotateY(Math.PI)  → flip nose to face -Z (Three.js "forward")
          // The tilt (pitch/roll) is then also applied to _modelPivot each frame,
          // ADDITIVE to this base rotation via Euler order 'YXZ'.
          _modelPivot.rotation.set(0, Math.PI, 0, 'YXZ');

          _modelPivot.add(model);
          _heliBody = model;
          _loaded   = true;

          // ── Reposition rotors against actual scaled + centred box ───
          box.setFromObject(model);  // re-measure after scale + recentre
          _addRotors(_modelPivot, box);

          console.log('[Heli] GLB loaded. Box:', JSON.stringify({
            min: box.min.toArray().map(function(v){ return v.toFixed(2); }),
            max: box.max.toArray().map(function(v){ return v.toFixed(2); }),
          }));

          resolve(model);
        },
        undefined,
        function(err) {
          console.warn('[Heli] GLB load failed, keeping placeholder:', err);
          _loaded = false;
          resolve(null);
        }
      );
    });
  }

  return Promise.resolve(null);
}

// ─── Physics update ───────────────────────────────────────────────────────────

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

  // "Forward" in physics is -Z (nose direction after our Math.PI fix)
  var fx = (-fwd * sinY + lat * cosY) * C.HELI_LATERAL;
  var fz = (-fwd * cosY - lat * sinY) * C.HELI_LATERAL;
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
  var r      = C.HELI_COLLISION_RADIUS;
  s.landed        = false;
  s.activeHelipad = null;

  for (var i = 0; i < nearby.length; i++) {
    var ab = nearby[i];
    var inX = nx > ab.minX - r && nx < ab.maxX + r;
    var inZ = nz > ab.minZ - r && nz < ab.maxZ + r;
    if (!inX || !inZ) continue;

    if (ab.isHelipad && v.y <= 0 && ny <= ab.topY + r && ny >= ab.topY - 0.5) {
      s.landed        = true;
      s.activeHelipad = ab;
      ny  = ab.topY + r * 0.5;
      v.y = 0;
      continue;
    }

    if (ny <= ab.topY + r && p.y >= ab.topY) {
      ny  = ab.topY + r;
      v.y = Math.abs(v.y) * C.HELI_BOUNCE_FORCE;
      continue;
    }

    if (ny < ab.topY) {
      var overX = (nx < (ab.minX + ab.maxX) / 2) ? ab.minX - r - nx : ab.maxX + r - nx;
      var overZ = (nz < (ab.minZ + ab.maxZ) / 2) ? ab.minZ - r - nz : ab.maxZ + r - nz;
      if (Math.abs(overX) < Math.abs(overZ)) {
        nx   += overX;
        v.x  *= -C.HELI_BOUNCE_FORCE;
      } else {
        nz   += overZ;
        v.z  *= -C.HELI_BOUNCE_FORCE;
      }
    }
  }

  // ── Floor ────────────────────────────────────────────────────────────────
  var minH = r + 0.5;
  if (ny < minH) { ny = minH; v.y = Math.abs(v.y) * C.HELI_BOUNCE_FORCE; }

  // ── Soft boundary ────────────────────────────────────────────────────────
  var boundary = C.CITY_HALF * 0.95;
  if (Math.abs(nx) > boundary) v.x -= Math.sign(nx) * C.WORLD_BOUNDARY_PUSH * dt * 60;
  if (Math.abs(nz) > boundary) v.z -= Math.sign(nz) * C.WORLD_BOUNDARY_PUSH * dt * 60;

  p.set(nx, ny, nz);

  // ── Visuals ──────────────────────────────────────────────────────────────
  // Tilt is applied to _modelPivot ADDITIVELY on top of the base Y=Math.PI
  // correction using Euler order 'YXZ' so axes don't fight each other.
  var tgtTiltX = fwd * C.HELI_TILT_MAX;   // pitch: nose dips forward
  var tgtTiltZ = lat * C.HELI_TILT_MAX;   // roll:  bank into strafe
  s.tiltX += (tgtTiltX - s.tiltX) * C.HELI_TILT_SPEED * dt;
  s.tiltZ += (tgtTiltZ - s.tiltZ) * C.HELI_TILT_SPEED * dt;

  _heliRoot.rotation.y = s.yaw;

  if (_modelPivot) {
    // Keep base Y=PI correction, add live tilt on X and Z
    _modelPivot.rotation.set(s.tiltX, Math.PI, s.tiltZ, 'YXZ');
  }

  // ── Rotor spin ───────────────────────────────────────────────────────────
  s.rotorSpin += C.HELI_ROTOR_SPEED * dt;
  if (_rotorMat)     { _rotorMat.uniforms.spin.value     = s.rotorSpin;       _rotorMat.uniforms.time.value     += dt; }
  if (_tailRotorMat) { _tailRotorMat.uniforms.spin.value = s.rotorSpin * 2.5; _tailRotorMat.uniforms.time.value += dt; }
}

// ─── Convenience ─────────────────────────────────────────────────────────────

function getHeliWorldPos() { return heliState.pos.clone(); }
