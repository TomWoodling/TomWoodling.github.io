// ═══ CHUNK SYSTEM ═══
// Road chunks with biome-specific scenery

var chunks = [];
var totalChunks = 0;
var biomeIdx = 0;
var biomeTimer = 0;
var activeBiome = biomeOrder[0];

function makeChunk(ci, bk) {
  var g = new THREE.Group();
  var b = BIOMES[bk];
  g.position.z = ci * C.chunkLength;
  g.userData = { ci: ci, bk: bk };

  // Road surface
  var road = new THREE.Mesh(
    new THREE.PlaneGeometry(C.roadWidth, C.chunkLength),
    new THREE.ShaderMaterial({
      vertexShader: rVS,
      fragmentShader: rFS,
      uniforms: {
        time:         { value: 0 },
        lineColor:    { value: b.neonS.clone() },
        scrollOffset: { value: 0 }
      },
      transparent: true,
      depthWrite: true
    })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, C.chunkLength / 2);
  g.add(road);

  // Ground grids (left & right)
  [-1, 1].forEach(function(s) {
    var gm = new THREE.Mesh(
      new THREE.PlaneGeometry(80, C.chunkLength),
      new THREE.ShaderMaterial({
        vertexShader: gVS,
        fragmentShader: gFS,
        uniforms: {
          gridColor:    { value: b.neonP.clone() },
          scrollOffset: { value: 0 },
          time:         { value: 0 }
        },
        transparent: true,
        depthWrite: false
      })
    );
    gm.rotation.x = -Math.PI / 2;
    gm.position.set(s * (C.roadWidth / 2 + 40), 0, C.chunkLength / 2);
    g.add(gm);
  });

  // Scenery objects
  var sc = bk === 'city' ? 5 : 6;
  for (var i = 0; i < sc; i++) {
    var lz = (i / sc) * C.chunkLength + Math.random() * 8;
    [-1, 1].forEach(function(side) {
      if (Math.random() > 0.65) return;
      var obj;
      if (bk === 'countryside') {
        obj = makeTree(b.neonP);
        obj.scale.setScalar(0.8 + Math.random() * 0.6);
      } else if (bk === 'city') {
        obj = makeBuilding(b.neonP);
      } else {
        obj = makePalm(b.neonP);
        obj.scale.setScalar(0.7 + Math.random() * 0.5);
      }
      var off = bk === 'city'
        ? C.roadWidth / 2 + 2 + Math.random() * 6
        : C.roadWidth / 2 + 3 + Math.random() * 20;
      obj.position.set(side * off, 0, lz);
      obj.rotation.y = Math.random() * Math.PI * 2;
      g.add(obj);
    });
  }

  // Beach water
  if (bk === 'beach') {
    var w = makeWater();
    w.position.z = C.chunkLength / 2;
    w.position.x = 40;
    g.add(w);
  }

  scene.add(g);
  return g;
}

// Called from game.js after scene exists
function initChunks() {
  for (var i = 0; i < C.visibleChunks; i++) {
    chunks.push(makeChunk(i, activeBiome));
    totalChunks++;
  }
  dbg('Chunks initialized: ' + C.visibleChunks);
}
