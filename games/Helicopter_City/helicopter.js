// helicopter.js — GLB loader, rotor effects, hover physics, landing state
// =======================================================================
// Public API:
//   initHelicopter(scene, modelPath)  → Promise
//   updateHelicopter(dt, input)
//   heliState  { pos, vel, onGround, landed, activeHelipad }
// =======================================================================

var heliState = {
  pos:          new THREE.Vector3(0, C.HELI_START_HEIGHT, 0),
  vel:          new THREE.Vector3(0, 0, 0),
  yaw:          0,       // current heading radians
  yawTarget:    0,
  tiltX:        0,       // pitch (forward/back)
  tiltZ:        0,       // roll (left/right)
  onGround:     false,
  landed:       false,
  activeHelipad:null,
  engineOn:     true,
  rotorSpin:    0,       // accumulated rotor angle
};

var _heliRoot     = null;  // THREE.Group — the whole helicopter
var _heliBody     = null;  // loaded GLB group (child of _heliRoot)
var _rotorDisc    = null;  // main rotor ShaderMaterial mesh
var _tailRotor    = null;  // tail rotor ShaderMaterial mesh
var _rotorMat     = null;
var _tailRotorMat = null;
var _loaded       = false;

// ─── Placeholder geometry (shown before GLB loads) ────────────────────────────

function _makePlaceholder(scene) {
  var g = new THREE.Group();

  // Body
  var bodyGeo = new THREE.SphereGeometry(1.2, 12, 8);
  bodyGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 2.5, 1));
  var bodyMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.3, roughness: 0.6 });
  var body    = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.z = Math.PI / 2;
  g.add(body);

  // Tail boom
  var tailGeo = new THREE.CylinderGeometry(0.25, 0.4, 4.5, 8);
  var tailMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.3, roughness: 0.6 });
  var tail    = new THREE.Mesh(tailGeo, tailMat);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-3.8, 0.2, 0);
  g.add(tail);

  // Skids
  [-1, 1].forEach(function(side) {
    var skidGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.5, 6);
    var skidMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
    var skid    = new THREE.Mesh(skidGeo, skidMat);
    skid.rotation.z = Math.PI / 2;
    skid.position.set(0, -1.3, side * 1.0);
    g.add(skid);
  });

  return g;
}

// ─── Rotor disc setup ─────────────────────────────────────────────────────────

function _addRotors(root) {
  // Main rotor
  var rGeo = new THREE.CircleGeometry(C.ROTOR_RADIUS, 48);
  _rotorMat  = makeRotorMaterial(new THREE.Color(0xaaccff));
  _rotorDisc = new THREE.Mesh(rGeo, _rotorMat);
  _rotorDisc.rotation.x = -Math.PI / 2;
  _rotorDisc.position.y = 1.5; // above body centre
  root.add(_rotorDisc);

  // Tail rotor (vertical plane)
  var trGeo    = new THREE.CircleGeometry(C.TAIL_ROTOR_RADIUS, 24);
  _tailRotorMat = makeRotorMaterial(new THREE.Color(0x88aaff));
  _tailRotor    = new THREE.Mesh(trGeo, _tailRotorMat);
  _tailRotor.position.set(-5.5, 0.4, 0.15);
  root.add(_tailRotor);
}

// ─── Public init ──────────────────────────────────────────────────────────────

function initHelicopter(scene, modelPath) {
  _heliRoot = new THREE.Group();
  _heliRoot.position.copy(heliState.pos);
  scene.add(_heliRoot);

  // Always add placeholder immediately so there's something visible
  var placeholder = _makePlaceholder(scene);
  _heliRoot.add(placeholder);
  _heliBody = placeholder;

  _addRotors(_heliRoot);

  if (modelPath && typeof THREE.GLTFLoader !== 'undefined' && THREE.GLTFLoader !== null) {
    var loader = new THREE.GLTFLoader();

    // Wire up DRACOLoader for Draco-compressed GLBs
    if (typeof THREE.DRACOLoader !== 'undefined') {
      var dracoLoader = new THREE.DRACOLoader();
      // Draco decoder WASM — pulled from the same CDN as the loaders
      dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
      dracoLoader.setDecoderConfig({ type: 'wasm' });
      loader.setDRACOLoader(dracoLoader);
    }

    return new Promise(function(resolve, reject) {
      loader.load(
        modelPath,
        function(gltf) {
          // Remove placeholder
          _heliRoot.remove(placeholder);

          var model = gltf.scene;
          // Normalise scale — adjust if model arrives oversized/undersized
          model.traverse(function(child) {
            if (child.isMesh) {
              child.castShadow    = false;
              child.receiveShadow = false;
            }
          });

          // Auto-scale to fit within ~5 unit bounding box
          var box = new THREE.Box3().setFromObject(model);
          var size = new THREE.Vector3();
          box.getSize(size);
          var maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) model.scale.setScalar(5.0 / maxDim);

          // Re-centre so pivot is at body midpoint
          box.setFromObject(model);
          var centre = new THREE.Vector3();
          box.getCenter(centre);
          model.position.sub(centre);

          _heliRoot.add(model);
          _heliBody = model;
          _loaded   = true;

          // Reposition rotors relative to actual model top
          box.setFromObject(model);
          _rotorDisc.position.y  = box.max.y + 0.1;
          _tailRotor.position.x  = box.min.x - 0.3;
          _tailRotor.position.y  = box.max.y * 0.7;

          console.log('[Heli] GLB loaded:', modelPath);
          resolve(model);
        },
        undefined,
        function(err) {
          console.warn('[Heli] GLB load failed, using placeholder:', err);
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

  var s  = heliState;
  var p  = s.pos;
  var v  = s.vel;

  // ── Input forces ────────────────────────────────────────────────────────
  var fwd   = input.fwd   || 0;   // -1 / 0 / +1
  var lat   = input.lat   || 0;   // -1 / 0 / +1
  var up    = input.up    || 0;   // -1 / 0 / +1
  var yawIn = input.yaw   || 0;   // -1 / 0 / +1

  // Yaw
  s.yaw += yawIn * dt * 1.8;

  // World-space movement direction
  var sinY = Math.sin(s.yaw);
  var cosY = Math.cos(s.yaw);

  var fx = (fwd * sinY + lat * cosY) * C.HELI_LATERAL;
  var fz = (fwd * cosY - lat * sinY) * C.HELI_LATERAL;
  var fy = up * C.HELI_THRUST - C.HELI_HOVER_GRAVITY;

  // If landed and no up input, hold position
  if (s.landed && up <= 0) {
    v.set(0, 0, 0);
    // Allow yaw in place
    _heliRoot.rotation.y = s.yaw;
    return;
  }

  // Integrate
  v.x += fx * dt;
  v.y += fy * dt;
  v.z += fz * dt;

  // Drag
  v.x *= Math.pow(C.HELI_DRAG, dt * 60);
  v.z *= Math.pow(C.HELI_DRAG, dt * 60);
  v.y *= Math.pow(0.92,        dt * 60);

  // Tentative new position
  var nx = p.x + v.x * dt;
  var ny = p.y + v.y * dt;
  var nz = p.z + v.z * dt;

  // ── Collision ────────────────────────────────────────────────────────────
  var nearby = getNearbyBuildings(nx, nz);
  var r = C.HELI_COLLISION_RADIUS;
  s.landed       = false;
  s.activeHelipad = null;

  for (var i = 0; i < nearby.length; i++) {
    var ab = nearby[i];

    var inX = nx > ab.minX - r && nx < ab.maxX + r;
    var inZ = nz > ab.minZ - r && nz < ab.maxZ + r;
    if (!inX || !inZ) continue;

    // ── Landing check: descending onto helipad ─────────────────────────
    if (ab.isHelipad && v.y <= 0 && ny <= ab.topY + r && ny >= ab.topY - 0.5) {
      // Close enough to land
      s.landed       = true;
      s.activeHelipad = ab;
      ny = ab.topY + r * 0.5;
      v.y = 0;
      continue;
    }

    // ── Bounce off top of building ─────────────────────────────────────
    if (ny <= ab.topY + r && p.y >= ab.topY) {
      ny = ab.topY + r;
      v.y = Math.abs(v.y) * C.HELI_BOUNCE_FORCE;
      continue;
    }

    // ── Side collision ─────────────────────────────────────────────────
    if (ny < ab.topY) {
      // Push out on axis of least penetration
      var overX = (nx < (ab.minX + ab.maxX) / 2)
        ? ab.minX - r - nx
        : ab.maxX + r - nx;
      var overZ = (nz < (ab.minZ + ab.maxZ) / 2)
        ? ab.minZ - r - nz
        : ab.maxZ + r - nz;

      if (Math.abs(overX) < Math.abs(overZ)) {
        nx += overX;
        v.x *= -C.HELI_BOUNCE_FORCE;
      } else {
        nz += overZ;
        v.z *= -C.HELI_BOUNCE_FORCE;
      }
    }
  }

  // ── Ground floor ──────────────────────────────────────────────────────────
  var minHeight = r + 0.5;
  if (ny < minHeight) {
    ny = minHeight;
    v.y = Math.abs(v.y) * C.HELI_BOUNCE_FORCE;
  }

  // ── Soft world boundary ───────────────────────────────────────────────────
  var boundary = C.CITY_HALF * 0.95;
  if (Math.abs(nx) > boundary) v.x -= Math.sign(nx) * C.WORLD_BOUNDARY_PUSH * dt * 60;
  if (Math.abs(nz) > boundary) v.z -= Math.sign(nz) * C.WORLD_BOUNDARY_PUSH * dt * 60;

  p.set(nx, ny, nz);

  // ── Visual: tilt body ─────────────────────────────────────────────────────
  var tgtTiltX = -fwd * C.HELI_TILT_MAX;
  var tgtTiltZ =  lat * C.HELI_TILT_MAX;
  s.tiltX += (tgtTiltX - s.tiltX) * C.HELI_TILT_SPEED * dt;
  s.tiltZ += (tgtTiltZ - s.tiltZ) * C.HELI_TILT_SPEED * dt;

  _heliRoot.position.copy(p);
  _heliRoot.rotation.y = s.yaw;

  if (_heliBody) {
    _heliBody.rotation.x = s.tiltX;
    _heliBody.rotation.z = s.tiltZ;
  }

  // ── Rotor spin ─────────────────────────────────────────────────────────────
  s.rotorSpin += C.HELI_ROTOR_SPEED * dt;
  if (_rotorMat)  {
    _rotorMat.uniforms.spin.value = s.rotorSpin;
    _rotorMat.uniforms.time.value += dt;
  }
  if (_tailRotorMat) {
    _tailRotorMat.uniforms.spin.value = s.rotorSpin * 2.5;
    _tailRotorMat.uniforms.time.value += dt;
  }
}

// ─── Convenience getter ───────────────────────────────────────────────────────

function getHeliWorldPos() {
  return heliState.pos.clone();
}
