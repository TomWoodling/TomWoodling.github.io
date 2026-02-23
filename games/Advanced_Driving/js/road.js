// ═══ SPLINE ROAD SYSTEM ═══

var UP = new THREE.Vector3(0, 1, 0);
var roadSegments     = [];
var totalSegmentsCreated = 0;

// The palette of the most recently built segment — used to smoothly
// lerp the scene fog colour in game.js.
var activePalette = PALETTES[0];

var roadState = {
  segIdx:    0,
  t:         0,
  lateral:   0,
  totalDist: 0,
};

// ─── CONTROL POINTS ───────────────────────────
function generateControlPoints(startPos, startDir) {
  var points = [startPos.clone()];
  var dir = startDir.clone().normalize();
  var stepLen = C.segmentLength / (C.segmentPoints - 1);
  for (var i = 1; i < C.segmentPoints; i++) {
    var turnAngle = (Math.random() - 0.5) * 0.25;
    if (i === 1) turnAngle *= 0.2;
    dir.applyAxisAngle(UP, turnAngle);
    var pt = points[i - 1].clone().addScaledVector(dir, stepLen);
    pt.y = 0;
    points.push(pt);
  }
  return { points: points, exitDir: dir.clone() };
}

// ─── ROAD RIBBON ──────────────────────────────
function createRoadRibbon(curve, width, segments) {
  var half = width / 2;
  var positions = [], normals = [], uvs = [], indices = [];
  var totalLen = curve.getLength();
  for (var i = 0; i <= segments; i++) {
    var t = i / segments;
    var P = curve.getPointAt(t);
    var T = curve.getTangentAt(t);
    var right = new THREE.Vector3().crossVectors(T, UP).normalize();
    var L = P.clone().addScaledVector(right, -half);
    var R = P.clone().addScaledVector(right,  half);
    positions.push(L.x, L.y + 0.05, L.z, R.x, R.y + 0.05, R.z);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, t * totalLen / 3.0, 1, t * totalLen / 3.0);
  }
  for (var i = 0; i < segments; i++) {
    var a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,   3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,       2));
  geo.setIndex(indices);
  return geo;
}

// ─── GROUND STRIP ─────────────────────────────
function createGroundStrip(curve, side, width, segments) {
  var roadHalf = C.roadWidth / 2;
  var positions = [], normals = [], uvs = [], indices = [];
  for (var i = 0; i <= segments; i++) {
    var t = i / segments;
    var P = curve.getPointAt(t);
    var T = curve.getTangentAt(t);
    var right = new THREE.Vector3().crossVectors(T, UP).normalize();
    var inner = P.clone().addScaledVector(right, side * roadHalf);
    var outer = P.clone().addScaledVector(right, side * (roadHalf + width));
    positions.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, t, 1, t);
  }
  for (var i = 0; i < segments; i++) {
    var a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,   3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,       2));
  geo.setIndex(indices);
  return geo;
}

// ─── BOOST CHEVRONS ───────────────────────────
function createBoostChevron(curve, tPos) {
  var g = new THREE.Group();
  for (var i = 0; i < 3; i++) {
    var offset = (i - 1) * 2.5;
    var chevronT = THREE.MathUtils.clamp(tPos + offset / curve.getLength(), 0, 0.99);
    var cP = curve.getPointAt(chevronT);
    var cT = curve.getTangentAt(chevronT);
    var mat = new THREE.ShaderMaterial({
      vertexShader: boostVS, fragmentShader: boostFS,
      uniforms: { time: { value: 0 }, boostColor: { value: new THREE.Color(0xffff00) } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(C.roadWidth * 0.6, 2), mat);
    var q = new THREE.Quaternion();
    q.setFromAxisAngle(UP, Math.atan2(cT.x, cT.z));
    var flatQ = new THREE.Quaternion();
    flatQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    flatQ.premultiply(q);
    mesh.quaternion.copy(flatQ);
    mesh.position.copy(cP);
    mesh.position.y += 0.03;
    g.add(mesh);
  }
  g.userData.tPos = tPos;
  g.userData.isBoost = true;
  g.userData.collected = false;
  return g;
}

// ─── WARNING MARKERS ──────────────────────────
function createWarningMarker(curve, tPos, side, color) {
  var P = curve.getPointAt(THREE.MathUtils.clamp(tPos, 0, 0.99));
  var T = curve.getTangentAt(THREE.MathUtils.clamp(tPos, 0, 0.99));
  var right = new THREE.Vector3().crossVectors(T, UP).normalize();
  var halfRoad = C.roadWidth / 2;
  var offset = right.clone().multiplyScalar(side * halfRoad * 0.5);

  var mat = new THREE.ShaderMaterial({
    vertexShader: warnVS, fragmentShader: warnFS,
    uniforms: {
      time:      { value: 0 },
      warnColor: { value: (color || new THREE.Color(0xff2200)).clone() },
      alpha:     { value: 0.0 }
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  });

  var size = halfRoad * 0.95;
  var mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  var q = new THREE.Quaternion();
  q.setFromAxisAngle(UP, Math.atan2(T.x, T.z));
  var flatQ = new THREE.Quaternion();
  flatQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  flatQ.premultiply(q);
  mesh.quaternion.copy(flatQ);
  mesh.position.copy(P).add(offset);
  mesh.position.y += 0.08;

  mesh.userData.isWarning  = true;
  mesh.userData.phase      = 'fadeIn';
  mesh.userData.phaseTimer = 0;
  mesh.userData.side       = side;
  return mesh;
}

// ─── SEGMENT BUILDER ──────────────────────────
// Each segment picks a random palette from PALETTES and random props
// from PROP_TYPES — no biome gating.
function buildRoadSegment(startPos, startDir) {
  // Pick a random palette (avoid repeating the same one twice in a row)
  var palette = activePalette;
  while (PALETTES.length > 1 && palette === activePalette) {
    palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  }
  activePalette = palette;

  var gen = generateControlPoints(startPos, startDir);
  var curve = new THREE.CatmullRomCurve3(gen.points, false, 'centripetal');
  var group = new THREE.Group();

  // Road ribbon
  var roadGeo = createRoadRibbon(curve, C.roadWidth, C.roadSegments);
  var roadMat = new THREE.ShaderMaterial({
    vertexShader: rVS, fragmentShader: rFS,
    uniforms: { lineColor: { value: palette.neonS.clone() }, time: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  });
  var roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.renderOrder = 1;
  group.add(roadMesh);

  // Ground strips either side
  [-1, 1].forEach(function(side) {
    var gGeo = createGroundStrip(curve, side, C.groundExtent, C.roadSegments);
    var gMat = new THREE.ShaderMaterial({
      vertexShader: gVS, fragmentShader: gFS,
      uniforms: {
        gridColor:   { value: palette.neonP.clone() },
        groundTint:  { value: palette.groundTint.clone() },
        time:        { value: 0 }
      },
      // depthWrite:true ensures the ground blocks objects behind it.
      // DoubleSide because the winding differs between left/right strips.
      // transparent:true so the far-edge alpha fade composites against fog.
      transparent: true,
      depthWrite:  true,
      depthTest:   true,
      side:        THREE.DoubleSide
    });
    group.add(new THREE.Mesh(gGeo, gMat));
  });

  // Scenery — random mix of all prop types
  var propCount = 12;
  for (var i = 0; i < propCount; i++) {
    var st = (i + 0.5) / propCount;
    if (st > 0.95 || st < 0.05) continue;
    [-1, 1].forEach(function(side) {
      if (Math.random() > 0.6) return;
      // Pick a random prop type
      var propType = PROP_TYPES[Math.floor(Math.random() * PROP_TYPES.length)];
      var obj;
      if (propType === 'tree')         obj = makeTree(palette.neonP);
      else if (propType === 'building') obj = makeBuilding(palette.neonP);
      else                              obj = makePalm(palette.neonP);

      // Buildings sit closer; natural props spread wide
      var off = propType === 'building'
        ? C.roadWidth / 2 + 2 + Math.random() * 8
        : C.roadWidth / 2 + 3 + Math.random() * 25;

      positionOnCurve(obj, curve, st, side * off);
      obj.rotation.y += Math.random() * Math.PI * 2;
      group.add(obj);
    });
  }

  // Boost chevrons
  var boosts = [];
  if (Math.random() < C.boostFrequency) {
    var bt = 0.2 + Math.random() * 0.5;
    var boost = createBoostChevron(curve, bt);
    group.add(boost);
    boosts.push(boost);
  }

  scene.add(group);

  return {
    group:          group,
    curve:          curve,
    exitPos:        gen.points[gen.points.length - 1].clone(),
    exitDir:        gen.exitDir.clone(),
    palette:        palette,
    boosts:         boosts,
    length:         curve.getLength(),
    warningMarkers: [],
  };
}

// ─── HELPERS ──────────────────────────────────
function positionOnCurve(obj, curve, t, lateralOffset) {
  t = THREE.MathUtils.clamp(t, 0, 0.999);
  var P = curve.getPointAt(t);
  var T = curve.getTangentAt(t);
  var right = new THREE.Vector3().crossVectors(T, UP).normalize();
  obj.position.copy(P).addScaledVector(right, lateralOffset);
  obj.position.y = 0;
  obj.rotation.y = Math.atan2(T.x, T.z);
}

function positionOnCurveKeepRot(obj, curve, t, lateralOffset) {
  t = THREE.MathUtils.clamp(t, 0, 0.999);
  var P = curve.getPointAt(t);
  var T = curve.getTangentAt(t);
  var right = new THREE.Vector3().crossVectors(T, UP).normalize();
  obj.position.copy(P).addScaledVector(right, lateralOffset);
  obj.position.y = 0;
}

function removeSegment(seg) {
  scene.remove(seg.group);
  seg.group.traverse(function(child) {
    if (child.geometry) child.geometry.dispose();
    if (child.material && child.material.dispose) child.material.dispose();
  });
}

// ─── INIT ─────────────────────────────────────
function initRoad() {
  var startPos = new THREE.Vector3(0, 0, 0);
  var startDir = new THREE.Vector3(0, 0, 1);
  for (var i = 0; i < C.visibleSegments; i++) {
    var seg = buildRoadSegment(startPos, startDir);
    roadSegments.push(seg);
    totalSegmentsCreated++;
    startPos = seg.exitPos.clone();
    startDir = seg.exitDir.clone();
  }
  roadState.segIdx  = 0;
  roadState.t       = 0;
  roadState.lateral = 0;
  dbg('Road initialized');
}

// ─── UPDATE ───────────────────────────────────
function updateRoad(dt, speed, steerAxis) {
  if (roadSegments.length === 0) return null;
  var seg = roadSegments[roadState.segIdx];
  if (!seg) return null;

  var spd = speed / 3.6;
  roadState.t         += (spd * dt) / seg.length;
  roadState.totalDist += spd * dt;

  // Lateral movement
  roadState.lateral -= steerAxis * (speed / C.maxSpeed) * 8 * dt;
  roadState.lateral  = THREE.MathUtils.clamp(roadState.lateral, -C.maxLateralOffset, C.maxLateralOffset);

  // Warning marker lifecycle
  seg.warningMarkers.forEach(function(wm) {
    if (!wm.userData || wm.userData.phase === 'done') return;
    var ud = wm.userData;
    ud.phaseTimer += dt;
    var a = 0;
    if (ud.phase === 'fadeIn') {
      a = THREE.MathUtils.clamp(ud.phaseTimer / C.warningFadeIn, 0, 1);
      if (ud.phaseTimer >= C.warningFadeIn) { ud.phase = 'visible'; ud.phaseTimer = 0; }
    } else if (ud.phase === 'visible') {
      a = 1;
      if (ud.phaseTimer >= C.warningVisible) { ud.phase = 'fadeOut'; ud.phaseTimer = 0; }
    } else if (ud.phase === 'fadeOut') {
      a = 1 - THREE.MathUtils.clamp(ud.phaseTimer / C.warningFadeOut, 0, 1);
      if (ud.phaseTimer >= C.warningFadeOut) { ud.phase = 'done'; a = 0; wm.visible = false; }
    }
    if (wm.material && wm.material.uniforms && wm.material.uniforms.alpha) {
      wm.material.uniforms.alpha.value = a;
    }
  });

  // Advance to next segment
  if (roadState.t >= 1.0) {
    roadState.t -= 1.0;
    roadState.segIdx++;

    // Build a new segment at the end of the road
    if (roadState.segIdx >= roadSegments.length - 1) {
      var lastSeg = roadSegments[roadSegments.length - 1];
      var newSeg = buildRoadSegment(lastSeg.exitPos.clone(), lastSeg.exitDir.clone());
      roadSegments.push(newSeg);
      totalSegmentsCreated++;
    }

    // Cull oldest segments
    while (roadSegments.length > C.visibleSegments + 2 && roadState.segIdx > 1) {
      removeSegment(roadSegments[0]);
      roadSegments.shift();
      roadState.segIdx--;
    }
  }

  // Boost collection
  var curSeg = roadSegments[roadState.segIdx];
  if (curSeg) {
    curSeg.boosts.forEach(function(boost) {
      if (!boost.userData.collected && Math.abs(boost.userData.tPos - roadState.t) < 0.03) {
        boost.userData.collected = true;
        boost.visible = false;
        activateBoost();
        dbg('BOOST!', 'warn');
      }
    });
  }

  return getCarWorldTransform();
}

// ─── ADD WARNING TO CURRENT SEGMENT ──────────
function addWarningToSegment(side, color) {
  var seg = roadSegments[roadState.segIdx];
  if (!seg) return null;
  var tPos = roadState.t + 0.35;
  if (tPos >= 1.0 && roadState.segIdx + 1 < roadSegments.length) {
    tPos -= 1.0;
    seg = roadSegments[roadState.segIdx + 1];
    if (!seg) return null;
  }
  tPos = THREE.MathUtils.clamp(tPos, 0.01, 0.98);
  var marker = createWarningMarker(seg.curve, tPos, side, color);
  seg.group.add(marker);
  seg.warningMarkers.push(marker);
  return marker;
}

// ─── CAR TRANSFORM ────────────────────────────
function getCarWorldTransform() {
  var seg = roadSegments[roadState.segIdx];
  if (!seg) return null;
  var t = THREE.MathUtils.clamp(roadState.t, 0, 0.999);
  var P = seg.curve.getPointAt(t);
  var T = seg.curve.getTangentAt(t);
  var right = new THREE.Vector3().crossVectors(T, UP).normalize();
  var pos = P.clone().addScaledVector(right, roadState.lateral);
  pos.y = 0;
  return { position: pos, tangent: T, right: right, angle: Math.atan2(T.x, T.z) };
}

function getRoadLookAhead(dist) {
  var seg = roadSegments[roadState.segIdx];
  if (!seg) return new THREE.Vector3(0, 0, 10);
  var aheadT = roadState.t + dist / seg.length;
  if (aheadT >= 1.0 && roadState.segIdx + 1 < roadSegments.length) {
    var nextSeg = roadSegments[roadState.segIdx + 1];
    return nextSeg.curve.getPointAt(THREE.MathUtils.clamp(aheadT - 1.0, 0, 0.999));
  }
  return seg.curve.getPointAt(THREE.MathUtils.clamp(aheadT, 0, 0.999));
}
