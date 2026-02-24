// shaders.js — All GLSL shader strings + material factories
// ==========================================================

// ─── Ground / Street Grid ────────────────────────────────────────────────────

var GROUND_VS = [
  'varying vec3 vWP;',
  'varying float vEyeDist;',
  'void main() {',
  '  vec4 w = modelMatrix * vec4(position, 1.0);',
  '  vWP = w.xyz;',
  '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
  '  vEyeDist = -mv.z;',
  '  gl_Position = projectionMatrix * mv;',
  '}'
].join('\n');

var GROUND_FS = [
  'uniform vec3 gridColor;',
  'uniform vec3 groundTint;',
  'uniform float time;',
  'varying vec3 vWP;',
  'varying float vEyeDist;',
  'void main() {',
  '  vec2 u = vWP.xz * 0.05;',
  '  float gx = smoothstep(0.02, 0.0, abs(fract(u.x) - 0.5) - 0.47);',
  '  float gy = smoothstep(0.02, 0.0, abs(fract(u.y) - 0.5) - 0.47);',
  '  float grid = max(gx, gy);',
  '  float gridFade  = exp(-pow(vEyeDist * 0.0025, 2.0));',
  '  float solidFade = 1.0 - smoothstep(80.0, 220.0, vEyeDist);',
  '  float pulse = 0.75 + 0.25 * sin(time * 0.4 + u.x * 0.3);',
  '  grid *= gridFade * pulse;',
  '  vec3 col = groundTint * 0.4 + gridColor * grid * 1.3;',
  '  float a = max(solidFade * 0.9, grid * gridFade);',
  '  gl_FragColor = vec4(col, a);',
  '}'
].join('\n');

function makeGroundMaterial(palette) {
  return new THREE.ShaderMaterial({
    uniforms: {
      gridColor:  { value: palette.neonP.clone() },
      groundTint: { value: palette.groundTint.clone() },
      time:       { value: 0.0 },
    },
    vertexShader:   GROUND_VS,
    fragmentShader: GROUND_FS,
    transparent:    true,
    depthWrite:     true,
    depthTest:      true,
    side:           THREE.DoubleSide,
  });
}

// ─── Building Edge Glow ───────────────────────────────────────────────────────

var BLDG_VS = [
  'varying vec3 vNormal;',
  'varying float vEyeDist;',
  'void main() {',
  '  vNormal = normalize(normalMatrix * normal);',
  '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
  '  vEyeDist = -mv.z;',
  '  gl_Position = projectionMatrix * mv;',
  '}'
].join('\n');

var BLDG_FS = [
  'uniform vec3 baseColor;',
  'uniform vec3 neonColor;',
  'uniform float time;',
  'uniform float glowStrength;',
  'varying vec3 vNormal;',
  'varying float vEyeDist;',
  'void main() {',
  '  float edge = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));',
  '  float pulse = 0.6 + 0.4 * sin(time * 1.2 + vNormal.x * 8.0);',
  '  float glow = pow(edge, 2.5) * pulse * glowStrength;',
  '  float fog = 1.0 - smoothstep(80.0, 250.0, vEyeDist);',
  '  vec3 col = baseColor + neonColor * glow;',
  '  gl_FragColor = vec4(col * fog, fog * 0.95);',
  '}'
].join('\n');

function makeBuildingMaterial(palette, glowStrength) {
  return new THREE.ShaderMaterial({
    uniforms: {
      baseColor:   { value: palette.buildingTint.clone() },
      neonColor:   { value: palette.neonS.clone() },
      time:        { value: 0.0 },
      glowStrength:{ value: glowStrength !== undefined ? glowStrength : 1.0 },
    },
    vertexShader:   BLDG_VS,
    fragmentShader: BLDG_FS,
    transparent:    true,
    depthWrite:     true,
    depthTest:      true,
  });
}

// ─── Rotor Disc ───────────────────────────────────────────────────────────────

var ROTOR_VS = [
  'varying vec2 vUv;',
  'void main() {',
  '  vUv = uv;',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
  '}'
].join('\n');

var ROTOR_FS = [
  'uniform float time;',
  'uniform float opacity;',
  'uniform vec3 color;',
  'uniform float spin;',
  'varying vec2 vUv;',
  'void main() {',
  '  vec2 uv = vUv - 0.5;',
  '  float r = length(uv);',
  '  float angle = atan(uv.y, uv.x) + spin;',
  '  float blades = abs(sin(angle * 2.0)) * 0.5 + 0.5;',
  '  float ring = smoothstep(0.48, 0.45, r) * smoothstep(0.05, 0.1, r);',
  '  float inner = exp(-r * 6.0) * 0.4;',
  '  float streak = pow(blades, 8.0) * smoothstep(0.45, 0.1, r);',
  '  float alpha = (ring * 0.5 + inner + streak * 0.7) * opacity;',
  '  float pulse = 0.8 + 0.2 * sin(time * 15.0);',
  '  gl_FragColor = vec4(color * pulse, alpha);',
  '}'
].join('\n');

function makeRotorMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time:    { value: 0.0 },
      opacity: { value: C.ROTOR_OPACITY },
      color:   { value: color || new THREE.Color(0xaaccff) },
      spin:    { value: 0.0 },
    },
    vertexShader:   ROTOR_VS,
    fragmentShader: ROTOR_FS,
    transparent:    true,
    depthWrite:     false,
    side:           THREE.DoubleSide,
  });
}

// ─── Helipad ──────────────────────────────────────────────────────────────────

var HELIPAD_FS = [
  'uniform float time;',
  'uniform vec3 color;',
  'varying vec2 vUv;',
  'void main() {',
  '  vec2 uv = vUv - 0.5;',
  '  float r = length(uv);',
  '  float ring1 = smoothstep(0.01, 0.0, abs(r - 0.48));',
  '  float ring2 = smoothstep(0.01, 0.0, abs(r - 0.38));',
  '  float H = 0.0;',
  '  float hx = abs(uv.x);',
  '  float hy = abs(uv.y);',
  '  float bar = smoothstep(0.015, 0.0, abs(hx - 0.16)) * step(hy, 0.22);',
  '  float crossbar = smoothstep(0.015, 0.0, hy) * step(hx, 0.16);',
  '  H = max(bar, crossbar);',
  '  float pulse = 0.5 + 0.5 * sin(time * 2.5);',
  '  float a = max(ring1, max(ring2 * 0.5, H));',
  '  gl_FragColor = vec4(color * (1.0 + pulse * 0.5), a * 0.9);',
  '}'
].join('\n');

function makeHelipadMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      time:  { value: 0.0 },
      color: { value: new THREE.Color(0x00ffcc) },
    },
    vertexShader: [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: HELIPAD_FS,
    transparent:    true,
    depthWrite:     false,
    side:           THREE.DoubleSide,
  });
}

// ─── Sun ──────────────────────────────────────────────────────────────────────

function makeSun(scene) {
  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  var ctx = canvas.getContext('2d');

  var grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0.0,  'rgba(255,220,100,1.0)');
  grd.addColorStop(0.25, 'rgba(255,80,40,0.9)');
  grd.addColorStop(0.5,  'rgba(220,20,80,0.6)');
  grd.addColorStop(1.0,  'rgba(100,0,60,0.0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);

  // Scanlines
  ctx.strokeStyle = 'rgba(20,0,10,0.35)';
  ctx.lineWidth = 3;
  for (var y = 0; y < 256; y += 8) {
    if (y > 128) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
  }

  var tex = new THREE.CanvasTexture(canvas);
  // Note: SpriteMaterial doesn't accept renderOrder — set it on the Sprite object instead
  var mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false,
  });
  var sprite = new THREE.Sprite(mat);
  sprite.scale.set(180, 180, 1);
  sprite.renderOrder = -1;
  scene.add(sprite);
  return sprite;
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function makeStars(scene) {
  var geo = new THREE.BufferGeometry();
  var count = 2200;
  var pos = new Float32Array(count * 3);
  for (var i = 0; i < count; i++) {
    var theta = Math.random() * Math.PI * 2;
    var phi   = Math.acos(Math.random() * 2 - 1);
    var r     = 280 + Math.random() * 40;
    pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    pos[i*3+1] = Math.abs(r * Math.cos(phi)) + 10; // upper hemisphere only
    pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var mat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.4, transparent: true, opacity: 0.8,
    sizeAttenuation: true, depthWrite: false,
  });
  scene.add(new THREE.Points(geo, mat));
}
