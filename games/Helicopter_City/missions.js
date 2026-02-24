// missions.js — Mission scheduler, active mission state, completion logic
// ========================================================================

var missionState = {
  active:       null,   // current mission object or null
  pending:      null,   // offered but not accepted
  nextIn:       0,      // seconds until next mission spawn
  score:        0,
  completedIDs: [],
};

var _missionMarker  = null;  // THREE.Group shown at mission target
var _markerMat      = null;
var _scene          = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

function initMissions(scene) {
  _scene = scene;

  // Build reusable marker group (beacon pillar + floating ring)
  _missionMarker = new THREE.Group();
  _missionMarker.visible = false;

  // Vertical beam
  var beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 120, 8, 1, true);
  _markerMat  = new THREE.MeshBasicMaterial({
    color: 0x00ffcc, transparent: true, opacity: 0.35,
    side: THREE.DoubleSide, depthWrite: false,
  });
  _missionMarker.add(new THREE.Mesh(beamGeo, _markerMat));

  // Ring
  var ringGeo = new THREE.TorusGeometry(6, 0.4, 8, 32);
  var ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
  var ring    = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 2;
  _missionMarker.add(ring);

  scene.add(_missionMarker);

  missionState.nextIn = C.MISSION_INTERVAL_MIN + Math.random() *
    (C.MISSION_INTERVAL_MAX - C.MISSION_INTERVAL_MIN);
}

// ─── Per-frame update ─────────────────────────────────────────────────────────

function updateMissions(dt, heliPos) {
  // Tick marker pulse
  if (_missionMarker && _missionMarker.visible) {
    _missionMarker.rotation.y += dt * 0.8;
  }

  // ── Active mission: check reach & timer ────────────────────────────────
  var m = missionState.active;
  if (m) {
    if (m.timed) {
      m.timeLeft -= dt;
      if (m.timeLeft <= 0) {
        _failMission('Time expired!');
        return;
      }
    }

    // Distance to target
    var dx = heliPos.x - m.targetX;
    var dz = heliPos.z - m.targetZ;
    var dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < 12) {
      _completeMission();
    }
    return;
  }

  // ── Spawn new mission ──────────────────────────────────────────────────
  missionState.nextIn -= dt;
  if (missionState.nextIn <= 0 && !missionState.pending) {
    _spawnMission();
    missionState.nextIn = C.MISSION_INTERVAL_MIN + Math.random() *
      (C.MISSION_INTERVAL_MAX - C.MISSION_INTERVAL_MIN);
  }

  // Auto-expire pending
  if (missionState.pending) {
    missionState.pending.expireTimer -= dt;
    if (missionState.pending.expireTimer <= 0) {
      missionState.pending = null;
      if (window.hudShowAlert) hudShowAlert('Mission expired', '#ff4400');
    }
  }
}

// ─── Spawn logic ──────────────────────────────────────────────────────────────

function _spawnMission() {
  // Pick random type — weight toward news (60%) vs police (40%)
  var pool = MISSION_TYPES.filter(function(t) {
    return t.variant === 'news' || Math.random() < 0.4;
  });
  var type  = pool[Math.floor(Math.random() * pool.length)];

  // Pick a target location (random building or helipad)
  var targets = cityData.buildings;
  var tgt     = targets[Math.floor(Math.random() * targets.length)];
  if (!tgt) return;

  var mission = {
    id:          type.id,
    label:       type.label,
    variant:     type.variant,
    points:      type.points,
    targetX:     tgt.x,
    targetZ:     tgt.z,
    targetY:     tgt.h,
    expireTimer: C.MISSION_EXPIRE,
    timed:       type.variant === 'police',
    timeLeft:    0,
    tier:        type.tier,
  };

  if (mission.timed && type.tier !== undefined) {
    mission.timeLeft = C.POLICE_MISSION_TIERS[type.tier].time;
    mission.color    = C.POLICE_MISSION_TIERS[type.tier].color;
  }

  missionState.pending = mission;

  // Show marker
  _showMarker(tgt.x, tgt.h, tgt.z, mission.variant === 'police' ? 0xff0033 : 0x00ffcc);

  // HUD notification
  if (window.hudShowAlert) hudShowAlert('New: ' + type.label, '#00ffcc');
  console.log('[Mission] Spawned:', type.label, 'at', tgt.x.toFixed(0), tgt.z.toFixed(0));
}

function acceptMission() {
  if (!missionState.pending) return false;
  missionState.active  = missionState.pending;
  missionState.pending = null;
  return true;
}

function _completeMission() {
  var m = missionState.active;
  if (!m) return;
  missionState.score += m.points;
  missionState.completedIDs.push(m.id);
  missionState.active = null;
  _missionMarker.visible = false;
  if (window.hudShowAlert) hudShowAlert('✓ ' + m.label + ' +' + m.points, '#ffcc00');
  console.log('[Mission] Complete:', m.label, '| Score:', missionState.score);
}

function _failMission(reason) {
  var m = missionState.active;
  missionState.active = null;
  _missionMarker.visible = false;
  if (window.hudShowAlert) hudShowAlert('✗ ' + (m ? m.label : '') + ' — ' + reason, '#ff0033');
}

function _showMarker(x, y, z, color) {
  _missionMarker.position.set(x, 0, z);
  _missionMarker.visible = true;
  if (_markerMat) _markerMat.color.setHex(color);
}

// ─── Trigger a gridlock event as part of a news mission ───────────────────────
function maybeTriggerGridlock() {
  if (typeof triggerGridlock !== 'undefined' && cityData.buildings.length > 0) {
    var b = cityData.buildings[Math.floor(Math.random() * cityData.buildings.length)];
    triggerGridlock(b.x, b.z);
  }
}
