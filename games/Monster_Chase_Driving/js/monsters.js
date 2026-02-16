// ═══ MONSTERS ═══
// Spider (Countryside), Godzilla (City), Crabs (Beach)

// ──────────────────────────────────────────────
// ═══ SPIDER ═══
// Ball body, 8 hinged legs, 2 front legs attack
// ──────────────────────────────────────────────
var spider = (function() {
  var group = null;
  var self;
  var legs  = [];          // 8 leg groups, each with segments
  var frontLegs = [];      // indices 0 & 1 = front pair
  var legPhase = 0;

  // Attack sequence: L, R, LR
  var ATTACKS = ['left', 'right', 'both'];
  var attackIdx = 0;

  var state = {
    active:       false,
    phase:        'chase',   // chase | preattack | attack | recover | done
    phaseTimer:   0,
    attackSide:   null,
    totalAttacks: 0,
    pos:          new THREE.Vector3(),
    baseY:        3.5,
  };

  // Build a single leg: 2 segments + foot sphere
  function buildLeg(angle, isLeft, isRight) {
    var g = new THREE.Group();
    var mat = neonMat(new THREE.Color(0x44ff44), 1.6);

    // Upper segment
    var upper = new THREE.Group();
    var upMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.0, 6), mat);
    upMesh.position.y = -1.0;
    upper.add(upMesh);
    upper.rotation.z = isLeft ? 0.6 : -0.6;

    // Lower segment (hinged off end of upper)
    var lower = new THREE.Group();
    lower.position.y = -2.0;
    var lowerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6), mat);
    lowerMesh.position.y = -1.1;
    lower.add(lowerMesh);
    lower.rotation.z = isLeft ? -1.2 : 1.2;

    // Foot
    var foot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), mat);
    foot.position.y = -2.2;
    lower.add(foot);

    upper.add(lower);
    g.add(upper);

    // Position around body
    g.rotation.y = angle;

    return { group: g, upper: upper, lower: lower, angle: angle, isLeft: isLeft };
  }

  function build() {
    group = new THREE.Group();

    // Body — large sphere
    var bodyMat = neonMat(new THREE.Color(0x00dd44), 2);
    var body = new THREE.Mesh(new THREE.SphereGeometry(2.0, 10, 10), bodyMat);
    group.add(body);

    // Eyes — two glowing spots
    [-0.5, 0.5].forEach(function(x) {
      var eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 6, 6),
        neonMat(new THREE.Color(0xff2200), 3)
      );
      eye.position.set(x, 0.6, 1.9);
      group.add(eye);
    });

    // 8 legs spaced around body
    var legAngles = [
      // front pair (indices 0,1 used for attacks)
      { a: Math.PI * 0.15,  left: false },   // 0 right-front
      { a: Math.PI * 0.85,  left: true  },   // 1 left-front
      // mid/back pairs
      { a: Math.PI * 0.35,  left: false },
      { a: Math.PI * 0.65,  left: true  },
      { a: Math.PI * 0.55,  left: false },
      { a: Math.PI * 0.45,  left: true  },
      { a: Math.PI * 0.75,  left: false },
      { a: Math.PI * 0.25,  left: true  },
    ];

    legAngles.forEach(function(def, i) {
      var legData = buildLeg(def.a, def.left, !def.left);
      group.add(legData.group);
      legs.push(legData);
      if (i < 2) frontLegs.push(legData);
    });

    group.visible = false;
    self.group = group;
    return group;
  }

  function show(behindPos) {
    if (!group) return;
    group.visible = true;
    state.active  = true;
    state.phase   = 'chase';
    state.phaseTimer = 0;
    attackIdx     = 0;
    state.totalAttacks = 0;
    group.position.copy(behindPos);
    group.position.y = state.baseY;
    dbg('Spider ACTIVATED');
  }

  function hide() {
    if (group) group.visible = false;
    state.active = false;
  }

  function update(dt, carTransform, speed) {
    if (!state.active || !group || !carTransform) return;

    // Animate legs
    legPhase += dt * (speed / 30 + 0.5);
    legs.forEach(function(leg, i) {
      var phaseOff = i * (Math.PI * 2 / 8);
      var swing = Math.sin(legPhase + phaseOff) * 0.35;
      leg.upper.rotation.z = (leg.isLeft ? 0.6 : -0.6) + swing;
      leg.lower.rotation.z = (leg.isLeft ? -1.2 : 1.2) - swing * 0.5;
    });

    // Bob
    group.position.y = state.baseY + Math.sin(legPhase * 2) * 0.25;

    // Chase: stay behind car
    if (state.phase === 'chase') {
      var target = carTransform.position.clone()
        .addScaledVector(carTransform.tangent, -C.spiderFollowDist);
      target.y = state.baseY;
      group.position.lerp(target, dt * 1.5);

      // Face car
      var dir = carTransform.position.clone().sub(group.position).normalize();
      group.rotation.y = Math.atan2(dir.x, dir.z);

      state.phaseTimer += dt;
      // After 4 seconds start attack
      if (state.phaseTimer > 4.0 && state.totalAttacks < 3) {
        state.phase      = 'preattack';
        state.phaseTimer = 0;

        // Determine attack side
        var seq = ATTACKS[attackIdx % 3];
        attackIdx++;
        state.attackSide = seq;
        state.totalAttacks++;

        // Place warning marker
        var wSide = seq === 'left' ? -1 : seq === 'right' ? 1 : 0;
        if (seq === 'both') {
          addWarningToSegment(-1, new THREE.Color(0xff2200));
          addWarningToSegment( 1, new THREE.Color(0xff2200));
        } else {
          addWarningToSegment(wSide, new THREE.Color(0xff2200));
        }
        dbg('Spider preattack: ' + seq);
      } else if (state.totalAttacks >= 3) {
        // Boss done
        state.phase = 'done';
        dbg('Spider done');
        onMonsterDefeated('countryside');
      }
    }

    // Pre-attack: telegraph lunge for 2s
    if (state.phase === 'preattack') {
      state.phaseTimer += dt;

      // Rear back front legs
      var rearAmount = Math.sin(state.phaseTimer * 6) * 0.5;
      if (state.attackSide === 'left' || state.attackSide === 'both') {
        frontLegs[1].upper.rotation.z = 0.6 - rearAmount * 2;
      }
      if (state.attackSide === 'right' || state.attackSide === 'both') {
        frontLegs[0].upper.rotation.z = -0.6 + rearAmount * 2;
      }

      if (state.phaseTimer > 2.0) {
        state.phase      = 'attack';
        state.phaseTimer = 0;
      }
    }

    // Attack: lunge forward
    if (state.phase === 'attack') {
      state.phaseTimer += dt;
      var progress = state.phaseTimer / 0.6;

      // Surge forward (toward car)
      var lungeDir = carTransform.position.clone().sub(group.position).normalize();
      group.position.addScaledVector(lungeDir, dt * 60 * (1 - progress));

      // Animate front legs forward
      if (state.attackSide === 'left' || state.attackSide === 'both') {
        frontLegs[1].upper.rotation.z = THREE.MathUtils.lerp(
          frontLegs[1].upper.rotation.z, 1.8, dt * 10
        );
      }
      if (state.attackSide === 'right' || state.attackSide === 'both') {
        frontLegs[0].upper.rotation.z = THREE.MathUtils.lerp(
          frontLegs[0].upper.rotation.z, -1.8, dt * 10
        );
      }

      if (state.phaseTimer > 0.6) {
        state.phase      = 'recover';
        state.phaseTimer = 0;
      }
    }

    // Recover: reset and pause before next attack
    if (state.phase === 'recover') {
      state.phaseTimer += dt;
      // Reset front leg positions
      frontLegs[0].upper.rotation.z = THREE.MathUtils.lerp(
        frontLegs[0].upper.rotation.z, -0.6, dt * 5
      );
      frontLegs[1].upper.rotation.z = THREE.MathUtils.lerp(
        frontLegs[1].upper.rotation.z, 0.6, dt * 5
      );
      if (state.phaseTimer > 1.5) {
        state.phase      = 'chase';
        state.phaseTimer = 0;
      }
    }
  }

  self = { build: build, show: show, hide: hide, update: update, group: group, state: state };
  return self;
})();

// ──────────────────────────────────────────────
// ═══ GODZILLA ═══
// Blocky bipedal titan, beam attack, rubble
// ──────────────────────────────────────────────
var godzilla = (function() {
  var group  = null;
  var self;
  var debris = [];  // falling rubble cubes

  var state = {
    active:     false,
    phase:      'chase',
    phaseTimer: 0,
    beamCount:  0,
    beamSide:   1,
    pos:        new THREE.Vector3(),
    walkPhase:  0,
  };

  var leftLeg = null, rightLeg = null;
  var leftArm = null, rightArm = null;
  var tail    = null;

  function build() {
    group = new THREE.Group();
    var mat = neonMat(new THREE.Color(0xff00ff), 1.8);
    var accentMat = neonMat(new THREE.Color(0xff4488), 2.5);

    // Torso
    var torso = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4, 2.5), mat);
    torso.position.y = 6;
    group.add(torso);

    // Head
    var head = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2, 2.5), mat);
    head.position.y = 9;
    group.add(head);

    // Snout
    var snout = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.5), mat);
    snout.position.set(0, 8.6, 1.7);
    group.add(snout);

    // Eyes
    [-0.7, 0.7].forEach(function(x) {
      var eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.2),
        neonMat(new THREE.Color(0xffff00), 3.5)
      );
      eye.position.set(x, 9.2, 1.26);
      group.add(eye);
    });

    // Dorsal spines
    for (var i = 0; i < 5; i++) {
      var spine = new THREE.Mesh(
        new THREE.ConeGeometry(0.25 + i * 0.08, 1.0 + i * 0.3, 4),
        accentMat
      );
      spine.position.set(0, 7.5 + i * 0.5, -1.0 - i * 0.2);
      group.add(spine);
    }

    // Hips
    var hips = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 2), mat);
    hips.position.y = 4;
    group.add(hips);

    // Legs
    leftLeg  = new THREE.Group();
    rightLeg = new THREE.Group();
    [-1, 1].forEach(function(side) {
      var leg = side === -1 ? leftLeg : rightLeg;
      var upper = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 1.2), mat);
      upper.position.y = -1.25;
      leg.add(upper);

      var lower = new THREE.Group();
      lower.position.y = -2.5;
      var lowerMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.5, 1.0), mat);
      lowerMesh.position.y = -1.25;
      lower.add(lowerMesh);

      var foot = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.8), mat);
      foot.position.set(0, -2.5, 0.4);
      lower.add(foot);

      leg.add(lower);
      leg.position.set(side * 1.4, 3.5, 0);
      group.add(leg);
    });

    // Arms
    leftArm  = new THREE.Group();
    rightArm = new THREE.Group();
    [-1, 1].forEach(function(side) {
      var arm = side === -1 ? leftArm : rightArm;
      var upper = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), mat);
      upper.position.y = -1.1;
      arm.add(upper);

      var hand = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat);
      hand.position.y = -2.4;
      arm.add(hand);

      arm.position.set(side * 2.2, 7.0, 0);
      arm.rotation.z = side * 0.3;
      group.add(arm);
    });

    // Tail (several segments curving behind)
    tail = new THREE.Group();
    for (var i = 0; i < 5; i++) {
      var tseg = new THREE.Mesh(
        new THREE.BoxGeometry(1.2 - i * 0.18, 1.2 - i * 0.18, 0.9),
        mat
      );
      tseg.position.set(0, 2.5 - i * 0.5, -2.0 - i * 1.0);
      tail.add(tseg);
    }
    group.add(tail);

    group.visible = false;
    self.group = group;
    return group;
  }

  function show(behindPos) {
    if (!group) return;
    group.visible = true;
    state.active  = true;
    state.phase   = 'chase';
    state.phaseTimer = 0;
    state.beamCount  = 0;
    state.beamSide   = 1;
    group.position.copy(behindPos);
    group.position.y = 0;
    dbg('Godzilla ACTIVATED');
  }

  function hide() {
    if (group) group.visible = false;
    state.active = false;
    // Clear debris
    debris.forEach(function(d) {
      scene.remove(d.mesh);
    });
    debris = [];
  }

  function spawnBeam(side) {
    // Warning first (called before this)
    // Create a elongated box that slides down the road edge
    var beamColor = new THREE.Color(0xff00ff);
    var beamMat = neonMat(beamColor, 4);
    var beam = new THREE.Mesh(new THREE.BoxGeometry(C.roadWidth * 0.45, 0.4, 6), beamMat);
    var transform = getCarWorldTransform();
    if (!transform) return;
    var offset = side * (C.roadWidth * 0.28);
    beam.position.copy(transform.position)
      .addScaledVector(transform.right, offset)
      .addScaledVector(transform.tangent, 25);
    beam.position.y = 0.3;
    beam.rotation.y = transform.angle;
    scene.add(beam);

    // Animate: slide toward car then fade
    beam.userData.life = 2.5;
    beam.userData.vel  = transform.tangent.clone().multiplyScalar(-18);
    debris.push({ mesh: beam, isBeam: true, life: 2.5 });
  }

  function spawnRubble(transform) {
    for (var i = 0; i < 5; i++) {
      var size = 1.2 + Math.random() * 1.8;
      var rMat = neonMat(new THREE.Color(0xff4488), 1.5);
      var rMesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), rMat);

      var lateralOff = (Math.random() - 0.5) * (C.roadWidth - 2);
      rMesh.position.copy(transform.position)
        .addScaledVector(transform.right, lateralOff)
        .addScaledVector(transform.tangent, 20 + i * 6);
      rMesh.position.y = 12 + Math.random() * 8;  // high up, falls down

      scene.add(rMesh);
      debris.push({
        mesh:     rMesh,
        isRubble: true,
        velY:     -(6 + Math.random() * 4),
        lateralOff: lateralOff,
        life:     6,
      });
    }
    dbg('Rubble spawned!', 'warn');
  }

  function update(dt, carTransform, speed) {
    if (!state.active || !group || !carTransform) return;

    // Walk animation
    state.walkPhase += dt * (speed / 25 + 0.3);
    if (leftLeg)  leftLeg.rotation.x  =  Math.sin(state.walkPhase) * 0.5;
    if (rightLeg) rightLeg.rotation.x = -Math.sin(state.walkPhase) * 0.5;
    if (leftArm)  leftArm.rotation.x  = -Math.sin(state.walkPhase) * 0.3;
    if (rightArm) rightArm.rotation.x =  Math.sin(state.walkPhase) * 0.3;
    if (tail)     tail.rotation.y     =  Math.sin(state.walkPhase * 0.7) * 0.3;

    group.position.y = Math.abs(Math.sin(state.walkPhase)) * 0.6;

    // Chase
    if (state.phase === 'chase') {
      var target = carTransform.position.clone()
        .addScaledVector(carTransform.tangent, -C.godzillaFollowDist);
      target.y = 0;
      group.position.lerp(target, dt * 1.2);
      var dir = carTransform.position.clone().sub(group.position).normalize();
      group.rotation.y = Math.atan2(dir.x, dir.z);

      state.phaseTimer += dt;
      if (state.phaseTimer > 5.0) {
        state.phase      = 'prebeam';
        state.phaseTimer = 0;
        // Add warning
        var wSide = state.beamCount % 2 === 0 ? 1 : -1;
        state.beamSide = wSide;
        addWarningToSegment(wSide, new THREE.Color(0xff00ff));
        dbg('Godzilla prebeam side ' + (wSide > 0 ? 'right' : 'left'));
      }
    }

    // Pre-beam: charge up for 1.8s
    if (state.phase === 'prebeam') {
      state.phaseTimer += dt;
      // Raise the arm that fires
      var arm = state.beamSide > 0 ? rightArm : leftArm;
      if (arm) arm.rotation.z = THREE.MathUtils.lerp(arm.rotation.z, state.beamSide * 1.4, dt * 4);
      // Chase still
      var target = carTransform.position.clone()
        .addScaledVector(carTransform.tangent, -C.godzillaFollowDist);
      target.y = 0;
      group.position.lerp(target, dt * 1.0);

      if (state.phaseTimer > 1.8) {
        state.phase      = 'beam';
        state.phaseTimer = 0;
        state.beamCount++;
        spawnBeam(state.beamSide);

        // After 2 beams, third destroys building = rubble
        if (state.beamCount === 3) {
          spawnRubble(carTransform);
        }
      }
    }

    // Beam fired: recover
    if (state.phase === 'beam') {
      state.phaseTimer += dt;
      var arm = state.beamSide > 0 ? rightArm : leftArm;
      if (arm) arm.rotation.z = THREE.MathUtils.lerp(arm.rotation.z, state.beamSide * 0.3, dt * 3);

      if (state.phaseTimer > 1.0) {
        if (state.beamCount >= 3) {
          // After 3 beams (including rubble) boss done
          state.phase = 'done';
          dbg('Godzilla done');
          onMonsterDefeated('city');
        } else {
          state.phase      = 'chase';
          state.phaseTimer = 0;
        }
      }
    }

    // Update debris
    for (var i = debris.length - 1; i >= 0; i--) {
      var d = debris[i];
      d.life -= dt;
      if (d.life <= 0) {
        scene.remove(d.mesh);
        debris.splice(i, 1);
        continue;
      }
      if (d.isBeam) {
        d.mesh.position.addScaledVector(d.mesh.userData.vel || new THREE.Vector3(), dt);
        var ba = Math.min(1, d.life / 0.5);
        if (d.mesh.material && d.mesh.material.uniforms && d.mesh.material.uniforms.opacity) {
          d.mesh.material.uniforms.opacity.value = ba;
        }
      }
      if (d.isRubble) {
        d.velY += dt * 9.8 * 2; // gravity
        d.mesh.position.y -= d.velY * dt;
        d.mesh.rotation.x += dt * 2;
        d.mesh.rotation.z += dt * 1.5;
        if (d.mesh.position.y <= 0.6) {
          d.mesh.position.y = 0.6; // rest on road
        }
      }
    }
  }

  self = { build: build, show: show, hide: hide, update: update, group: group, state: state, debris: debris };
  return self;
})();

// ──────────────────────────────────────────────
// ═══ CRABS ═══
// Sideways-walking crabs, boss crab needs boost
// ──────────────────────────────────────────────
var crabs = (function() {
  var crabList = [];
  var state = {
    active:       false,
    spawnTimer:   0,
    crabsSpawned: 0,
    bossCrab:     null,
    bossActive:   false,
    bossCleared:  false,
  };

  function buildCrab(isBoss) {
    var g = new THREE.Group();
    var scale = isBoss ? 3.5 : 1.2;
    var col   = isBoss ? new THREE.Color(0xff4400) : new THREE.Color(0xff8800);
    var mat   = neonMat(col, isBoss ? 2.5 : 1.8);

    // Shell (flattened sphere)
    var shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.4 * scale, 8, 6),
      mat
    );
    shell.scale.y = 0.55;
    shell.position.y = 0.6 * scale;
    g.add(shell);

    // Claws (2 large front)
    [-1, 1].forEach(function(side) {
      var clawGroup = new THREE.Group();
      // Upper arm
      var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.22 * scale, 1.6 * scale, 6), mat);
      arm.rotation.z = Math.PI / 2;
      arm.position.x = side * 1.0 * scale;
      clawGroup.add(arm);
      // Claw tip (triangle-ish)
      var clawA = new THREE.Mesh(new THREE.BoxGeometry(0.8 * scale, 0.5 * scale, 0.35 * scale), mat);
      clawA.position.set(side * 2.2 * scale, 0.2 * scale, 0);
      clawGroup.add(clawA);
      var clawB = new THREE.Mesh(new THREE.BoxGeometry(0.8 * scale, 0.5 * scale, 0.35 * scale), mat);
      clawB.position.set(side * 2.2 * scale, -0.2 * scale, 0);
      clawGroup.add(clawB);

      clawGroup.position.y = 0.8 * scale;
      g.add(clawGroup);
    });

    // 8 legs (4 each side)
    var legMat = neonMat(col, 1.5);
    for (var i = 0; i < 4; i++) {
      [-1, 1].forEach(function(side) {
        var leg = new THREE.Group();
        var zOff = (i - 1.5) * 0.5 * scale;

        var upper = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 1.0 * scale, 5),
          legMat
        );
        upper.position.y = -0.5 * scale;
        leg.add(upper);

        var lower = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.8 * scale, 5),
          legMat
        );
        lower.position.y = -1.3 * scale;
        lower.rotation.z = side * 0.5;
        leg.add(lower);

        leg.position.set(side * 1.3 * scale, 0.5 * scale, zOff);
        leg.rotation.z = side * 0.5;
        g.add(leg);
      });
    }

    // Eye stalks
    [-0.4, 0.4].forEach(function(x) {
      var stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.5 * scale, 5),
        mat
      );
      stalk.position.set(x * scale, 1.4 * scale, 0.9 * scale);
      g.add(stalk);
      var eyeball = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 * scale, 5, 5),
        neonMat(new THREE.Color(0xffff00), 3)
      );
      eyeball.position.set(x * scale, 1.75 * scale, 0.9 * scale);
      g.add(eyeball);
    });

    g.userData.isBoss = isBoss;
    g.userData.walkPhase = Math.random() * Math.PI * 2;
    return g;
  }

  function spawnNormalCrab(transform) {
    var crab = buildCrab(false);
    // Spawn on one side of road, walk across
    var startSide = Math.random() > 0.5 ? -1 : 1;
    crab.position.copy(transform.position)
      .addScaledVector(transform.right, startSide * (C.roadWidth / 2 + 6))
      .addScaledVector(transform.tangent, 20 + Math.random() * 20);
    crab.position.y = 0;

    // Face perpendicular to road (walking sideways)
    crab.rotation.y = transform.angle + Math.PI / 2 * startSide;

    crab.userData.startSide  = startSide;
    crab.userData.crossSpeed = 4 + Math.random() * 3;
    crab.userData.progress   = 0;  // 0..1 crossing road
    crab.userData.done       = false;

    scene.add(crab);
    crabList.push(crab);
    state.crabsSpawned++;
    dbg('Crab spawned (' + state.crabsSpawned + ')');
    return crab;
  }

  function spawnBossCrab(transform) {
    var crab = buildCrab(true);
    crab.position.copy(transform.position)
      .addScaledVector(transform.right, -1 * (C.roadWidth + 8))
      .addScaledVector(transform.tangent, 30);
    crab.position.y = 0;
    crab.rotation.y = transform.angle + Math.PI / 2;

    crab.userData.startSide  = -1;
    crab.userData.crossSpeed = 2.5;  // slow — blocks road
    crab.userData.progress   = 0;
    crab.userData.done       = false;
    crab.userData.isBossCrab = true;
    crab.userData.boosted    = false;  // set true when player boost passes through

    scene.add(crab);
    crabList.push(crab);
    state.bossCrab  = crab;
    state.bossActive = true;
    dbg('BOSS CRAB spawned!', 'warn');
    return crab;
  }

  function show(transform) {
    state.active       = true;
    state.spawnTimer   = 0;
    state.crabsSpawned = 0;
    state.bossCrab     = null;
    state.bossActive   = false;
    state.bossCleared  = false;
    crabList           = [];
    dbg('Crab encounter STARTED');
  }

  function hide() {
    state.active = false;
    crabList.forEach(function(c) { scene.remove(c); });
    crabList = [];
    state.bossCrab = null;
  }

  function update(dt, carTransform, speed, boostActive) {
    if (!state.active || !carTransform) return;

    // Leg animation for all crabs
    crabList.forEach(function(crab) {
      crab.userData.walkPhase = (crab.userData.walkPhase || 0) + dt * 4;
    });

    // Spawn normal crabs
    if (state.crabsSpawned < 5) {
      state.spawnTimer += dt;
      if (state.spawnTimer > C.crabSpawnInterval) {
        state.spawnTimer = 0;
        spawnNormalCrab(carTransform);
      }
    } else if (!state.bossActive && !state.bossCleared && state.crabsSpawned >= 5) {
      // All normals done, spawn boss
      state.bossActive = true;
      spawnBossCrab(carTransform);
    }

    // Move crabs
    for (var i = crabList.length - 1; i >= 0; i--) {
      var crab = crabList[i];
      if (crab.userData.done) continue;

      var crossDir = carTransform.right.clone().multiplyScalar(-crab.userData.startSide);

      if (crab.userData.isBossCrab) {
        // Boss crab moves slowly across — stops halfway to block
        if (!crab.userData.boosted) {
          var mid = C.roadWidth / 2;
          var currentX = crab.position.clone().dot(carTransform.right);
          if (crab.userData.progress < 0.4) {
            crab.position.addScaledVector(crossDir, crab.userData.crossSpeed * dt);
            crab.userData.progress += dt / 10;
          }
          // Stays put blocking road — player must boost through

          // Check if player boosted through the crab
          if (boostActive) {
            var distToCar = crab.position.distanceTo(carTransform.position);
            if (distToCar < C.roadWidth * 0.7) {
              crab.userData.boosted = true;
              dbg('Boss crab SMASHED by boost!', 'warn');
              // Scatter it off road
              var scatterDir = carTransform.right.clone()
                .multiplyScalar(crab.userData.startSide * 20);
              crab.userData.scatterVel = scatterDir;
              crab.userData.scatterTimer = 0;
            }
          }
        } else {
          // Scatter away
          crab.userData.scatterTimer = (crab.userData.scatterTimer || 0) + dt;
          var sv = crab.userData.scatterVel || new THREE.Vector3();
          crab.position.addScaledVector(sv, dt);
          crab.position.y += dt * 5; // bounce up
          crab.rotation.z += dt * 3;
          if (crab.userData.scatterTimer > 2.5) {
            scene.remove(crab);
            crabList.splice(i, 1);
            state.bossCleared = true;
            dbg('Boss crab cleared, beach done!');
            onMonsterDefeated('beach');
          }
        }
      } else {
        // Normal crab: walk across road
        crab.position.addScaledVector(crossDir, crab.userData.crossSpeed * dt);
        crab.userData.progress += dt / 8;

        // Leg waggle
        var wp = crab.userData.walkPhase;
        crab.children.forEach(function(child, ci) {
          if (ci > 2) { // legs (skip shell, claws)
            child.rotation.z = Math.sin(wp + ci * 0.5) * 0.4 + (Math.sign(child.position.x) * 0.5);
          }
        });

        if (crab.userData.progress > 1.2) {
          // Crossed road, remove
          crab.userData.done = true;
          scene.remove(crab);
        }
      }
    }
  }

  return { show: show, hide: hide, update: update, state: state };
})();

// ═══ MONSTER MANAGER ═══
var monsterManager = {
  currentBiome: null,
  active:       false,
  biomeTimer:   0,

  init: function() {
    scene.add(spider.build());
    scene.add(godzilla.build());
    this.currentBiome = activeBiome;
    this.biomeTimer   = 0;
    dbg('Monsters initialized');
  },

  update: function(dt, carTransform, speed, boostActive) {
    if (!gameStarted || !carTransform) return;

    this.biomeTimer += dt;

    // Timer-based: activate boss after biomeDur seconds
    if (!this.active && this.biomeTimer > C.biomeDur) {
      this.activateBoss(activeBiome, carTransform);
    }

    // Update active monster
    var bk = activeBiome;
    if (bk === 'countryside') spider.update(dt, carTransform, speed);
    else if (bk === 'city')   godzilla.update(dt, carTransform, speed);
    else if (bk === 'beach')  crabs.update(dt, carTransform, speed, boostActive);
  },

  activateBoss: function(biomeKey, carTransform) {
    this.active = true;
    if (biomeKey === 'countryside') {
      var behind = carTransform.position.clone()
        .addScaledVector(carTransform.tangent, -C.spiderFollowDist - 5);
      behind.y = spider.state.baseY;
      spider.show(behind);
    } else if (biomeKey === 'city') {
      var behind = carTransform.position.clone()
        .addScaledVector(carTransform.tangent, -C.godzillaFollowDist - 5);
      godzilla.show(behind);
    } else if (biomeKey === 'beach') {
      crabs.show(carTransform);
    }
    dbg('Boss activated: ' + biomeKey, 'warn');
  },

  deactivate: function() {
    this.active = false;
    spider.hide();
    godzilla.hide();
    crabs.hide();
  },

  reset: function(newBiome) {
    this.deactivate();
    this.currentBiome = newBiome;
    this.biomeTimer   = 0;
    dbg('Monster reset for: ' + newBiome);
  }
};

// ═══ CALLBACKS ═══
// Called by monster objects when their sequence completes
function onMonsterDefeated(biomeKey) {
  monsterManager.active = false;
  monsterManager.biomeTimer = 0;

  // Decide next biome (random if not chosen)
  var currIdx  = biomeOrder.indexOf(biomeKey);
  var nextIdx  = (currIdx + 1 + Math.floor(Math.random() * 2)) % biomeOrder.length;
  var nextBiome = biomeOrder[nextIdx];

  // Place transition chevrons on road
  scheduleTransitionSegment(nextBiome);

  dbg('Monster defeated! -> ' + BIOMES[nextBiome].name, 'warn');
}

// Called when biome actually changes (road crosses the chevron)
function onBiomeChanged(newBiome) {
  monsterManager.reset(newBiome);
}
