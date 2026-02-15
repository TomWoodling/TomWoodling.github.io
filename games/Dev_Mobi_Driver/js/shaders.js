// ═══ SHADERS ═══
// All custom shader materials for the synthwave aesthetic

// --- Neon Edge Glow ---
var nVS = [
  'varying vec3 vWP, vN, vV;',
  'void main() {',
  '  vec4 w = modelMatrix * vec4(position, 1.0);',
  '  vWP = w.xyz;',
  '  vN = normalize(normalMatrix * normal);',
  '  vV = normalize(cameraPosition - w.xyz);',
  '  gl_Position = projectionMatrix * viewMatrix * w;',
  '}'
].join('\n');

var nFS = [
  'uniform vec3 edgeColor;',
  'uniform float opacity, glowIntensity, time;',
  'varying vec3 vWP, vN, vV;',
  'void main() {',
  '  float e = 1.0 - abs(dot(vN, vV));',
  '  e = pow(e, 1.8);',
  '  float p = 0.85 + 0.15 * sin(time * 1.5 + vWP.y * 2.0);',
  '  float g = e * glowIntensity * p;',
  '  vec3 c = mix(edgeColor * 0.05, edgeColor, e * 0.9) + edgeColor * g * 0.5;',
  '  gl_FragColor = vec4(c, max(e * opacity, 0.06));',
  '}'
].join('\n');

function neonMat(color, intensity) {
  intensity = intensity || 1.5;
  return new THREE.ShaderMaterial({
    vertexShader: nVS,
    fragmentShader: nFS,
    uniforms: {
      edgeColor:     { value: color.clone() },
      opacity:       { value: 0.9 },
      glowIntensity: { value: intensity },
      time:          { value: 0 }
    },
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false
  });
}

// --- Road Surface (spline UV version) ---
var rVS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

var rFS = [
  'uniform vec3 lineColor;',
  'uniform float time;',
  'varying vec2 vUv;',
  'void main() {',
  // Center dashed line
  '  float cl = smoothstep(0.018, 0.004, abs(vUv.x - 0.5)) * step(0.5, fract(vUv.y * 20.0));',
  // Edge lines — bright and solid
  '  float edgeL = smoothstep(0.07, 0.02, vUv.x);',
  '  float edgeR = smoothstep(0.93, 0.98, vUv.x);',
  '  float el = max(edgeL, edgeR);',
  // Soft edge glow extending inward
  '  float glowL = smoothstep(0.20, 0.0, vUv.x) * 0.5;',
  '  float glowR = smoothstep(0.80, 1.0, vUv.x) * 0.5;',
  '  float edgeGlow = max(glowL, glowR);',
  // Road surface grid
  '  float g = max(',
  '    smoothstep(0.005, 0.0, abs(fract(vUv.x * 12.0) - 0.5) - 0.48),',
  '    smoothstep(0.005, 0.0, abs(fract(vUv.y * 10.0) - 0.5) - 0.48)',
  '  ) * 0.2;',
  // Pulse animation
  '  float pulse = 0.9 + 0.1 * sin(time * 2.0 + vUv.y * 30.0);',
  // Combine — high base so road surface is always clearly visible
  '  float lines = max(max(cl, el), g) * pulse;',
  '  float a = max(lines, edgeGlow);',
  '  vec3 col = lineColor * (a * 1.8 + 0.15) + lineColor * edgeGlow;',
  '  gl_FragColor = vec4(col, max(a + 0.1, 0.35));',
  '}'
].join('\n');

// --- Ground Grid ---
var gVS = [
  'varying vec3 vWP;',
  'void main() {',
  '  vec4 w = modelMatrix * vec4(position, 1.0);',
  '  vWP = w.xyz;',
  '  gl_Position = projectionMatrix * viewMatrix * w;',
  '}'
].join('\n');

var gFS = [
  'uniform vec3 gridColor;',
  'uniform float time;',
  'varying vec3 vWP;',
  'void main() {',
  '  vec2 u = vWP.xz * 0.08;',
  '  float g = max(',
  '    smoothstep(0.015, 0.0, abs(fract(u.x) - 0.5) - 0.48),',
  '    smoothstep(0.015, 0.0, abs(fract(u.y) - 0.5) - 0.48)',
  '  );',
  '  float f = exp(-pow(length(vWP.xz) * 0.005, 2.0));',
  '  g *= f;',
  '  gl_FragColor = vec4(gridColor * g * 0.3 * (0.8 + 0.2 * sin(time * 0.5)), g * 0.4 * f);',
  '}'
].join('\n');

// --- Boost Chevron Shader ---
var boostVS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

var boostFS = [
  'uniform float time;',
  'uniform vec3 boostColor;',
  'varying vec2 vUv;',
  'void main() {',
  '  float cx = abs(vUv.x - 0.5) * 2.0;',
  '  float chevron = step(cx, 1.0 - vUv.y * 0.8) * step(vUv.y, 0.9);',
  '  float pulse = 0.7 + 0.3 * sin(time * 8.0);',
  '  float edge = smoothstep(0.0, 0.15, chevron) * smoothstep(0.6, 0.4, abs(vUv.x - 0.5));',
  '  gl_FragColor = vec4(boostColor * edge * pulse, edge * 0.8 * pulse);',
  '}'
].join('\n');

// --- Synthwave Sun ---
function makeSun() {
  var m = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform float time;',
      'varying vec2 vUv;',
      'void main() {',
      '  vec2 u = vUv;',
      '  float d = length((u - vec2(0.5, 0.35)) * vec2(1, 1.8));',
      '  float s = smoothstep(0.35, 0.28, d) * mix(1.0, step(0.4, fract(u.y * 30.0 + time * 0.3)), step(0.35, 1.0 - u.y) * 0.8);',
      '  vec3 sc = mix(vec3(1, 0.6, 0), vec3(1, 0, 0.5), u.y);',
      '  float h = exp(-pow((u.y - 0.3) * 3.0, 2.0)) * 0.4;',
      '  gl_FragColor = vec4(sc * s + vec3(0.8, 0, 0.5) * h, max(s, h * 0.6));',
      '}'
    ].join('\n'),
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  var mesh = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), m);
  mesh.position.set(0, 15, 350);
  mesh.renderOrder = -1;
  return mesh;
}
