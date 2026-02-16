// ═══ SCENERY GENERATORS ═══

function makeTree(nc) {
  var g = new THREE.Group();
  var trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 2.5, 6),
    neonMat(new THREE.Color(0x00ff88), 1)
  );
  trunk.position.y = 1.25;
  g.add(trunk);
  var layers = [
    { r: 1.8, h: 3,   y: 3.5 },
    { r: 1.4, h: 2.5, y: 5   },
    { r: 1,   h: 2,   y: 6.2 }
  ];
  layers.forEach(function(s) {
    var cone = new THREE.Mesh(
      new THREE.ConeGeometry(s.r, s.h, 6),
      neonMat(nc, 1.2)
    );
    cone.position.y = s.y;
    g.add(cone);
  });
  return g;
}

function makeBuilding(nc) {
  var g = new THREE.Group();
  var w = 3 + Math.random() * 5;
  var h = 6 + Math.random() * 18;
  var d = 3 + Math.random() * 5;
  var box = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    neonMat(nc, 1.3)
  );
  box.position.y = h / 2;
  g.add(box);
  for (var i = 0; i < Math.floor(h / 2.5); i++) {
    var wm = new THREE.MeshBasicMaterial({
      color: nc, transparent: true, opacity: 0.3 + Math.random() * 0.3
    });
    var wn = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 0.15), wm);
    wn.position.set(0, 2 + i * 2.5, d / 2 + 0.01);
    g.add(wn);
  }
  return g;
}

function makePalm(nc) {
  var g = new THREE.Group();
  var cv = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.3, 2.5, 0),
    new THREE.Vector3(-0.2, 5, 0),
    new THREE.Vector3(0.1, 7, 0)
  );
  g.add(new THREE.Mesh(
    new THREE.TubeGeometry(cv, 12, 0.2, 6, false),
    neonMat(nc, 1)
  ));
  for (var i = 0; i < 6; i++) {
    var a = (i / 6) * Math.PI * 2;
    var fc = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 7, 0),
      new THREE.Vector3(Math.cos(a) * 2, 7.5, Math.sin(a) * 2),
      new THREE.Vector3(Math.cos(a) * 3.5, 5.5, Math.sin(a) * 3.5)
    );
    g.add(new THREE.Mesh(
      new THREE.TubeGeometry(fc, 8, 0.08, 4, false),
      neonMat(new THREE.Color(0x00ff44), 1.5)
    ));
  }
  return g;
}

function makeWater() {
  var m = new THREE.ShaderMaterial({
    vertexShader: [
      'uniform float time;',
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  vec3 p = position;',
      '  p.z += sin(p.x * 0.5 + time * 0.8) * 0.3;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float time;',
      'uniform vec3 waterColor;',
      'varying vec2 vUv;',
      'void main() {',
      '  float g = min(',
      '    smoothstep(0.02, 0.0, abs(fract(vUv.x * 20.0 + time * 0.1) - 0.5) - 0.48) +',
      '    smoothstep(0.02, 0.0, abs(fract(vUv.y * 30.0 + time * 0.05) - 0.5) - 0.48),',
      '    1.0);',
      '  float ef = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);',
      '  gl_FragColor = vec4(waterColor * (g * 0.5 + 0.05) * ef, (g * 0.5 + 0.05) * 0.6 * ef);',
      '}'
    ].join('\n'),
    uniforms: {
      time:       { value: 0 },
      waterColor: { value: new THREE.Color(0x0066ff) }
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  var mesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 60, 40, 40), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(35, 0.05, 0);
  return mesh;
}
