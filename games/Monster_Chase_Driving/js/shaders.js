// ═══ SHADERS ═══

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

// --- Road Surface ---
var rVS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

var rFS = [
  'uniform vec3 lineColor;',
  'uniform float time;',
  'varying vec2 vUv;',
  'void main() {',
  '  float cl = smoothstep(0.018, 0.004, abs(vUv.x - 0.5)) * step(0.5, fract(vUv.y * 20.0));',
  '  float edgeL = smoothstep(0.07, 0.02, vUv.x);',
  '  float edgeR = smoothstep(0.93, 0.98, vUv.x);',
  '  float el = max(edgeL, edgeR);',
  '  float glowL = smoothstep(0.20, 0.0, vUv.x) * 0.5;',
  '  float glowR = smoothstep(0.80, 1.0, vUv.x) * 0.5;',
  '  float edgeGlow = max(glowL, glowR);',
  '  float g = max(',
  '    smoothstep(0.005, 0.0, abs(fract(vUv.x * 12.0) - 0.5) - 0.48),',
  '    smoothstep(0.005, 0.0, abs(fract(vUv.y * 10.0) - 0.5) - 0.48)',
  '  ) * 0.2;',
  '  float pulse = 0.9 + 0.1 * sin(time * 2.0 + vUv.y * 30.0);',
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

// --- Boost Chevron ---
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

// --- Biome Transition Chevron ---
var transVS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

var transFS = [
  'uniform float time;',
  'uniform vec3 transColor;',
  'uniform float alpha;',
  'varying vec2 vUv;',
  'void main() {',
  // Thick chevron band
  '  float cx = abs(vUv.x - 0.5) * 2.0;',
  '  float chevron = step(cx, 1.0 - vUv.y * 0.7) * step(vUv.y, 0.95);',
  '  float pulse = 0.6 + 0.4 * sin(time * 6.0 - vUv.y * 8.0);',
  '  float glow = smoothstep(0.4, 0.0, abs(vUv.x - 0.5) - 0.1);',
  '  float a = chevron * pulse * alpha;',
  '  gl_FragColor = vec4(transColor * (a + glow * 0.3 * alpha), a + glow * 0.15 * alpha);',
  '}'
].join('\n');

// --- Warning Marker (danger zone on road) ---
var warnVS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

var warnFS = [
  'uniform float time;',
  'uniform vec3 warnColor;',
  'uniform float alpha;',
  'varying vec2 vUv;',
  'void main() {',
  '  float border = max(',
  '    smoothstep(0.06, 0.0, vUv.x),',
  '    max(smoothstep(0.94, 1.0, vUv.x),',
  '    max(smoothstep(0.06, 0.0, vUv.y), smoothstep(0.94, 1.0, vUv.y)))',
  '  );',
  '  float fill = 0.15;',
  '  float stripe = step(0.5, fract((vUv.x + vUv.y) * 4.0 + time * 2.0));',
  '  float v = max(border, fill * stripe);',
  '  float pulse = 0.7 + 0.3 * sin(time * 8.0);',
  '  gl_FragColor = vec4(warnColor * v * pulse, v * alpha * pulse);',
  '}'
].join('\n');

// --- Car Ground Glow ---
var carGlowVS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

var carGlowFS = [
  'uniform vec3 glowColor;',
  'uniform float time;',
  'varying vec2 vUv;',
  'void main() {',
  '  float d = length(vUv - vec2(0.5)) * 2.0;',
  '  float glow = smoothstep(1.0, 0.0, d);',
  '  glow = pow(glow, 2.0);',
  '  float pulse = 0.85 + 0.15 * sin(time * 2.0);',
  '  float a = glow * 0.5 * pulse;',
  '  gl_FragColor = vec4(glowColor * glow * pulse, a);',
  '}'
].join('\n');

// --- Spider Web ---
var webVS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

var webFS = [
  'uniform float time;',
  'uniform vec3 webColor;',
  'uniform float alpha;',
  'varying vec2 vUv;',
  'void main() {',
  '  vec2 c = vUv - vec2(0.5);',
  '  float r = length(c);',
  '  float ang = atan(c.y, c.x);',
  '  float rings = smoothstep(0.015, 0.0, abs(fract(r * 6.0) - 0.5) - 0.45);',
  '  float spokes = smoothstep(0.02, 0.0, abs(fract(ang / 3.14159 * 4.0) - 0.5) - 0.47);',
  '  float spiral = smoothstep(0.02, 0.0, abs(fract(r * 4.0 - ang / 6.28318) - 0.5) - 0.46);',
  '  float web = max(max(rings, spokes), spiral);',
  '  float mask = smoothstep(0.5, 0.35, r);',
  '  web *= mask;',
  '  float pulse = 0.7 + 0.3 * sin(time * 4.0 + r * 10.0);',
  '  float a = web * alpha * pulse;',
  '  gl_FragColor = vec4(webColor * a * 1.5, a * 0.85);',
  '}'
].join('\n');

// --- Crab Sand Particle ---
var crabParticleVS = [
  'attribute float alpha;',
  'varying float vAlpha;',
  'void main() {',
  '  vAlpha = alpha;',
  '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
  '  gl_PointSize = 4.0 * (300.0 / -mv.z);',
  '  gl_Position = projectionMatrix * mv;',
  '}'
].join('\n');

var crabParticleFS = [
  'uniform vec3 pColor;',
  'uniform float time;',
  'varying float vAlpha;',
  'void main() {',
  '  float d = length(gl_PointCoord - vec2(0.5));',
  '  if (d > 0.5) discard;',
  '  float glow = smoothstep(0.5, 0.0, d);',
  '  float pulse = 0.8 + 0.2 * sin(time * 3.0);',
  '  gl_FragColor = vec4(pColor * glow * pulse, vAlpha * glow);',
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
