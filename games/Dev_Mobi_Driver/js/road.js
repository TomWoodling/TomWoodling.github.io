// ═══ SPLINE ROAD SYSTEM ═══
// CatmullRomCurve3 segments with ribbon geometry, junctions, traffic & boosts

var UP = new THREE.Vector3(0, 1, 0);

// ═══ ROAD SEGMENT ═══
// Each segment has a CatmullRomCurve3, road mesh, ground grids, scenery, boosts, traffic
var roadSegments = [];     // active segment objects
var totalSegmentsCreated = 0;
var activeBiome = biomeOrder[0];
var biomeIdx = 0;
var biomeTimer = 0;

// Current car state on the road
var roadState = {
  segIdx:    0,          // index into roadSegments[] for the segment the car is on
  t:         0,          // 0..1 position along current segment's curve
  lateral:   0,          // -1..+1 lateral offset (multiplied by maxLateralOffset)
  totalDist: 0,
};

// ═══ SPLINE GENERATION ═══
// Each segment is a CatmullRomCurve3 through ~6 control points
// Successive segments share endpoint + tangent for G1 continuity

function generateControlPoints(startPos, startDir, biomeKey, turnBias) {
  turnBias = turnBias || 0;
  var points = [startPos.clone()];
  var dir = startDir.clone().normalize();
  var stepLen = C.segmentLength / (C.segmentPoints - 1);

  for (var i = 1; i < C.segmentPoints; i++) {
    // Gentle random turns + optional bias for junction branches
    var turnAngle = (Math.random() - 0.5) * 0.3 + turnBias * 0.15;
    // Reduce turn near start for smooth junction exit
    if (i === 1) turnAngle *= 0.3;

    dir.applyAxisAngle(UP, turnAngle);
    var pt = points[i - 1].clone().addScaledVector(dir, stepLen);
    pt.y = 0; // flat for now (terrain later)
    points.push(pt);
  }

  return { points: points, exitDir: dir.clone() };
}

// ═══ RIBBON BUFFER GEOMETRY ═══
// Flat road mesh from spline, with proper UVs for shader markings

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
    var R = P.clone().addScaledVector(right, half);

    positions.push(L.x, L.y + 0.05, L.z, R.x, R.y + 0.05, R.z);
    normals.push(0, 1, 0, 0, 1, 0);
    // U: 0 = left edge, 1 = right edge
    // V: distance along road / dash spacing
    uvs.push(0, t * totalLen / 3.0, 1, t * totalLen / 3.0);
  }

  for (var i = 0; i < segments; i++) {
    var a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// ═══ GROUND GRID STRIPS ═══
// Two ground planes that follow the road on each side

function createGroundStrip(curve, side, width, segments) {
  var roadHalf = C.roadWidth / 2;
  var positions = [], normals = [], uvs = [], indices = [];

  for (var i = 0; i <= segments; i++) {
    var t = i / segments;
    var P = curve.getPointAt(t);
    var T = curve.getTangentAt(t);
    var right = new THREE.Vector3().crossVectors(T, UP).normalize();

    var innerOff = side * roadHalf;
    var outerOff = side * (roadHalf + width);

    var inner = P.clone().addScaledVector(right, innerOff);
    var outer = P.clone().addScaledVector(right, outerOff);

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
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// ═══ BOOST CHEVRONS ═══
// Placed on the road surface at specific t values

function createBoostChevron(curve, tPos, biome) {
  var P = curve.getPointAt(tPos);
  var T = curve.getTangentAt(tPos);
  var right = new THREE.Vector3().crossVectors(T, UP).normalize();

  var g = new THREE.Group();
  // 3 chevron strips
  for (var i = 0; i < 3; i++) {
    var offset = (i - 1) * 2.5;
    var chevronT = Math.min(1, Math.max(0, tPos + offset / curve.getLength()));
    var cP = curve.getPointAt(chevronT);
    var cT = curve.getTangentAt(chevronT);

    var mat = new THREE.ShaderMaterial({
      vertexShader: boostVS,
      fragmentShader: boostFS,
      uniforms: {
        time:       { value: 0 },
        boostColor: { value: new THREE.Color(0xffff00) }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(C.roadWidth * 0.6, 2), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(cP);
    mesh.position.y += 0.03;

    // Align chevron to road direction
    var angle = Math.atan2(cT.x, cT.z);
    mesh.rotation.y = angle;
    // Need to set rotation after the x rotation, use quaternion approach
    var q = new THREE.Quaternion();
    q.setFromAxisAngle(UP, angle);
    var flatQ = new THREE.Quaternion();
    flatQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    flatQ.premultiply(q);
    mesh.quaternion.copy(flatQ);

    g.add(mesh);
  }

  g.userData.tPos = tPos;
  g.userData.isBoost = true;
  g.userData.collected = false;
  return g;
}

// ═══ TRAFFIC CARS ═══
// Simple cars driving along the road

var trafficPool = [];

function spawnTraffic(segment, curve) {
  if (Math.random() > C.trafficSpawnChance) return [];
  var traffic = [];
  var count = Math.floor(Math.random() * C.trafficPerSegment) + 1;

  var colors = [
    new THREE.Color(0xff4488),
    new THREE.Color(0x44ff88),
    new THREE.Color(0x8844ff),
    new THREE.Color(0xff8844),
    new THREE.Color(0x44ffff),
  ];

  for (var i = 0; i < count; i++) {
    var tCar = makeTrafficCar(colors[Math.floor(Math.random() * colors.length)]);
    var tVal = 0.1 + Math.random() * 0.7;
    var lane = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 2);

    tCar.userData.t = tVal;
    tCar.userData.lane = lane;
    tCar.userData.speed = C.maxSpeed * C.trafficSpeed * (0.7 + Math.random() * 0.6);

    // Position on road
    positionOnCurve(tCar, curve, tVal, lane);
    scene.add(tCar);
    traffic.push(tCar);
  }
  return traffic;
}

function positionOnCurve(obj, curve, t, lateralOffset) {
  t = THREE.MathUtils.clamp(t, 0, 1);
  var P = curve.getPointAt(t);
  var T = curve.getTangentAt(t);
  var right = new THREE.Vector3().crossVectors(T, UP).normalize();

  obj.position.copy(P).addScaledVector(right, lateralOffset);
  obj.position.y = 0;

  // Face along road
  var angle = Math.atan2(T.x, T.z);
  obj.rotation.y = angle;
}

// ═══ SEGMENT BUILDER ═══
// Creates a complete road segment with all its visual elements

function buildRoadSegment(startPos, startDir, biomeKey, turnBias) {
  var b = BIOMES[biomeKey];
  var gen = generateControlPoints(startPos, startDir, biomeKey, turnBias);
  var curve = new THREE.CatmullRomCurve3(gen.points, false, 'centripetal');

  var group = new THREE.Group();

  // Road ribbon
  var roadGeo = createRoadRibbon(curve, C.roadWidth, C.roadSegments);
  var roadMat = new THREE.ShaderMaterial({
    vertexShader: rVS,
    fragmentShader: rFS,
    uniforms: {
      lineColor: { value: b.neonS.clone() },
      time:      { value: 0 }
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  var roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.renderOrder = 1;
  group.add(roadMesh);

  // Ground grids
  [-1, 1].forEach(function(side) {
    var gGeo = createGroundStrip(curve, side, C.groundExtent, C.roadSegments);
    var gMat = new THREE.ShaderMaterial({
      vertexShader: gVS,
      fragmentShader: gFS,
      uniforms: {
        gridColor: { value: b.neonP.clone() },
        time:      { value: 0 }
      },
      transparent: true,
      depthWrite: false
    });
    group.add(new THREE.Mesh(gGeo, gMat));
  });

  // Scenery along the road
  var sceneryCount = biomeKey === 'city' ? 10 : 12;
  for (var i = 0; i < sceneryCount; i++) {
    var st = (i + 0.5) / sceneryCount;
    if (st > 0.95 || st < 0.05) continue; // avoid ends

    [-1, 1].forEach(function(side) {
      if (Math.random() > 0.6) return;

      var obj;
      if (biomeKey === 'countryside') {
        obj = makeTree(b.neonP);
        obj.scale.setScalar(0.8 + Math.random() * 0.6);
      } else if (biomeKey === 'city') {
        obj = makeBuilding(b.neonP);
      } else {
        obj = makePalm(b.neonP);
        obj.scale.setScalar(0.7 + Math.random() * 0.5);
      }

      var off = biomeKey === 'city'
        ? C.roadWidth / 2 + 2 + Math.random() * 8
        : C.roadWidth / 2 + 3 + Math.random() * 25;

      positionOnCurve(obj, curve, st, side * off);
      obj.rotation.y += Math.random() * Math.PI * 2;
      group.add(obj);
    });
  }

  // Beach water
  if (biomeKey === 'beach') {
    // Place water patches along one side
    for (var w = 0; w < 3; w++) {
      var wt = 0.15 + w * 0.3;
      var wP = curve.getPointAt(wt);
      var wT = curve.getTangentAt(wt);
      var wRight = new THREE.Vector3().crossVectors(wT, UP).normalize();

      var water = makeWater();
      water.position.copy(wP).addScaledVector(wRight, 40);
      water.position.y = 0.05;
      group.add(water);
    }
  }

  // Boost chevrons
  var boosts = [];
  if (Math.random() < C.boostFrequency) {
    var boostT = 0.2 + Math.random() * 0.5;
    var boost = createBoostChevron(curve, boostT, biomeKey);
    group.add(boost);
    boosts.push(boost);
  }

  scene.add(group);

  // Traffic
  var traffic = spawnTraffic(group, curve);

  var seg = {
    group:    group,
    curve:    curve,
    exitPos:  gen.points[gen.points.length - 1].clone(),
    exitDir:  gen.exitDir.clone(),
    biome:    biomeKey,
    boosts:   boosts,
    traffic:  traffic,
    length:   curve.getLength(),
  };

  return seg;
}

// ═══ SEGMENT MANAGEMENT ═══

function removeSegment(seg) {
  // Remove traffic
  seg.traffic.forEach(function(t) {
    scene.remove(t);
    // Could pool these
  });
  scene.remove(seg.group);
  // Dispose geometries
  seg.group.traverse(function(child) {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (child.material.dispose) child.material.dispose();
    }
  });
}

function initRoad() {
  var startPos = new THREE.Vector3(0, 0, 0);
  var startDir = new THREE.Vector3(0, 0, 1); // initially heading +Z

  for (var i = 0; i < C.visibleSegments; i++) {
    var seg = buildRoadSegment(startPos, startDir, activeBiome, 0);
    roadSegments.push(seg);
    totalSegmentsCreated++;

    startPos = seg.exitPos.clone();
    startDir = seg.exitDir.clone();
  }

  roadState.segIdx = 0;
  roadState.t = 0;
  roadState.lateral = 0;

  dbg('Road initialized: ' + C.visibleSegments + ' spline segments');
}

// ═══ JUNCTION SYSTEM ═══
// At the end of each segment, player can choose to branch

var junction = {
  active:       false,
  choice:       'straight',  // 'left', 'right', 'straight'
  arrows:       null,        // arrow UI group
  pendingBiome: null,
};

function getJunctionBiomes() {
  // Left and right go to other biomes, straight stays
  var currentIdx = biomeOrder.indexOf(activeBiome);
  var leftIdx = (currentIdx + 1) % biomeOrder.length;
  var rightIdx = (currentIdx + 2) % biomeOrder.length;

  return {
    left:     biomeOrder[leftIdx],
    right:    biomeOrder[rightIdx],
    straight: activeBiome
  };
}

function createJunctionArrows(curve) {
  var g = new THREE.Group();
  var biomes = getJunctionBiomes();

  // Arrow at t=0.92 showing the three options
  var baseT = 0.90;
  var P = curve.getPointAt(baseT);
  var T = curve.getTangentAt(baseT);
  var right = new THREE.Vector3().crossVectors(T, UP).normalize();

  // Three floating arrow indicators
  var dirs = [
    { key: 'left',     offset: -4, color: BIOMES[biomes.left].neonP,     label: BIOMES[biomes.left].name },
    { key: 'straight', offset:  0, color: BIOMES[biomes.straight].neonP, label: 'STRAIGHT' },
    { key: 'right',    offset:  4, color: BIOMES[biomes.right].neonP,    label: BIOMES[biomes.right].name },
  ];

  dirs.forEach(function(d) {
    // Arrow mesh (simple triangle)
    var shape = new THREE.Shape();
    shape.moveTo(0, 1);
    shape.lineTo(-0.5, 0);
    shape.lineTo(0.5, 0);
    shape.closePath();

    var arrowMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      neonMat(d.color, 2.5)
    );

    var arrowGroup = new THREE.Group();
    arrowGroup.add(arrowMesh);

    // Position above road
    arrowGroup.position.copy(P).addScaledVector(right, d.offset);
    arrowGroup.position.y = 4;

    // Face camera (billboard) — we'll update in the loop
    arrowGroup.userData.junctionKey = d.key;
    arrowGroup.userData.label = d.label;

    g.add(arrowGroup);
  });

  g.userData.isJunctionArrows = true;
  scene.add(g);
  return g;
}

function removeJunctionArrows() {
  if (junction.arrows) {
    scene.remove(junction.arrows);
    junction.arrows.traverse(function(child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material && child.material.dispose) child.material.dispose();
    });
    junction.arrows = null;
  }
}

function resolveJunction() {
  // Determine which biome the player chose
  var biomes = getJunctionBiomes();
  var chosenBiome = biomes[junction.choice];

  var turnBias = 0;
  if (junction.choice === 'left') turnBias = -1;
  else if (junction.choice === 'right') turnBias = 1;

  // Generate the new segment with appropriate curve bias
  var lastSeg = roadSegments[roadSegments.length - 1];
  var newSeg = buildRoadSegment(
    lastSeg.exitPos.clone(),
    lastSeg.exitDir.clone(),
    chosenBiome,
    turnBias
  );
  roadSegments.push(newSeg);
  totalSegmentsCreated++;

  // If biome changed, trigger transition
  if (chosenBiome !== activeBiome) {
    activeBiome = chosenBiome;
    biomeIdx = biomeOrder.indexOf(activeBiome);
    audio.switchTo(activeBiome);
    showBiomeTransition(activeBiome);
    startCutscene(activeBiome);
  }

  removeJunctionArrows();
  junction.active = false;
  junction.choice = 'straight';

  // Remove old segments that are far behind
  while (roadSegments.length > C.visibleSegments + 2 && roadState.segIdx > 1) {
    removeSegment(roadSegments[0]);
    roadSegments.shift();
    roadState.segIdx--;
  }
}

// ═══ UPDATE ROAD STATE ═══
// Called each frame from game.js

function updateRoad(dt, speed, steerAxis) {
  if (roadSegments.length === 0) return;

  var seg = roadSegments[roadState.segIdx];
  if (!seg) return;
  var curve = seg.curve;

  // Advance t based on speed
  var spd = speed / 3.6; // KPH to m/s
  roadState.t += (spd * dt) / seg.length;
  roadState.totalDist += spd * dt;

  // Lateral movement from steering
  roadState.lateral -= steerAxis * (speed / C.maxSpeed) * 8 * dt;
  roadState.lateral = THREE.MathUtils.clamp(roadState.lateral, -C.maxLateralOffset, C.maxLateralOffset);

  // Check for junction zone
  if (roadState.t > C.junctionWarning && !junction.active) {
    junction.active = true;
    junction.choice = 'straight';
    junction.arrows = createJunctionArrows(curve);
    dbg('Junction approaching...');
  }

  // While junction is active, player's steer direction affects choice
  if (junction.active && roadState.t < C.junctionChoice) {
    if (steerAxis < -0.5) junction.choice = 'left';
    else if (steerAxis > 0.5) junction.choice = 'right';
    else junction.choice = 'straight';

    // Highlight chosen arrow
    if (junction.arrows) {
      junction.arrows.children.forEach(function(arrow) {
        var isChosen = arrow.userData.junctionKey === junction.choice;
        arrow.scale.setScalar(isChosen ? 1.4 : 0.8);
        arrow.position.y = isChosen ? 5 : 4;
      });
    }
  }

  // Transition to next segment
  if (roadState.t >= 1.0) {
    roadState.t -= 1.0;
    roadState.segIdx++;

    // If we need a new segment
    if (roadState.segIdx >= roadSegments.length - 1) {
      if (junction.active) {
        resolveJunction();
      } else {
        // Auto-generate straight continuation
        var lastSeg = roadSegments[roadSegments.length - 1];
        var newSeg = buildRoadSegment(
          lastSeg.exitPos.clone(),
          lastSeg.exitDir.clone(),
          activeBiome,
          0
        );
        roadSegments.push(newSeg);
        totalSegmentsCreated++;
      }

      // Cleanup old segments
      while (roadSegments.length > C.visibleSegments + 2 && roadState.segIdx > 1) {
        removeSegment(roadSegments[0]);
        roadSegments.shift();
        roadState.segIdx--;
      }
    }
  }

  // Update traffic positions
  roadSegments.forEach(function(s) {
    s.traffic.forEach(function(tc) {
      tc.userData.t += (tc.userData.speed / 3.6 * dt) / s.length;
      if (tc.userData.t > 1.0) tc.userData.t -= 1.0;
      positionOnCurve(tc, s.curve, tc.userData.t, tc.userData.lane);
    });
  });

  // Check boost collection
  var currentSeg = roadSegments[roadState.segIdx];
  if (currentSeg) {
    currentSeg.boosts.forEach(function(boost) {
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

// ═══ CAR WORLD POSITION FROM ROAD STATE ═══

function getCarWorldTransform() {
  var seg = roadSegments[roadState.segIdx];
  if (!seg) return null;

  var t = THREE.MathUtils.clamp(roadState.t, 0, 0.999);
  var curve = seg.curve;

  var P = curve.getPointAt(t);
  var T = curve.getTangentAt(t);
  var right = new THREE.Vector3().crossVectors(T, UP).normalize();

  var pos = P.clone().addScaledVector(right, roadState.lateral);
  pos.y = 0;

  var angle = Math.atan2(T.x, T.z);

  return {
    position: pos,
    tangent:  T,
    right:    right,
    angle:    angle,
  };
}

// ═══ GET LOOK-AHEAD POINT ═══
// For camera targeting

function getRoadLookAhead(dist) {
  var seg = roadSegments[roadState.segIdx];
  if (!seg) return new THREE.Vector3(0, 0, 10);

  var aheadT = roadState.t + dist / seg.length;

  // If look-ahead goes past current segment, sample from next
  if (aheadT >= 1.0 && roadState.segIdx + 1 < roadSegments.length) {
    var nextSeg = roadSegments[roadState.segIdx + 1];
    var remainT = (aheadT - 1.0);
    remainT = THREE.MathUtils.clamp(remainT, 0, 0.999);
    return nextSeg.curve.getPointAt(remainT);
  }

  aheadT = THREE.MathUtils.clamp(aheadT, 0, 0.999);
  return seg.curve.getPointAt(aheadT);
}
