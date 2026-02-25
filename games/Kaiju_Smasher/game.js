// game.js — Kaiju Smasher  (v2 — lighting, audio, punch/swipe/roar)

import * as THREE from 'three';
import { initCity, fractureBuilding, updateFragments } from './city.js';
import { loadKaiju, KaijuController, KAIJU_RADIUS, STOMP_RADIUS, PUNCH_RADIUS } from './kaiju.js';

// ── DOM ───────────────────────────────────────────────────────────────────────
const loadingEl   = document.getElementById('loading');
const loadingBar  = document.getElementById('loading-bar');
const titleScreen = document.getElementById('title-screen');
const startBtn    = document.getElementById('start-btn');
const hudEl       = document.getElementById('hud');
const scoreEl     = document.getElementById('score-val');
const buildingEl  = document.getElementById('building-val');
const remainingEl = document.getElementById('remaining-val');
const flashEl     = document.getElementById('destruction-flash');
const roarWaveEl  = document.getElementById('roar-wave');
const roarFillEl  = document.getElementById('roar-fill');
const roarLabelEl = document.getElementById('roar-label');

// ── Renderer ──────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Scene ─────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10091a);
scene.fog = new THREE.FogExp2(0x10091a, 0.0022);

// ── Camera ────────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2500);
const CAM_DIST = 210;
let cameraYaw   = 0;
let cameraPitch = 0.28;
const CAM_PITCH_MIN = 0.05;
const CAM_PITCH_MAX = 1.1;

// ── Lighting ──────────────────────────────────────────────────────────────────
// 1) Moonlight — cool blue-white from high angle, primary directional
const moon = new THREE.DirectionalLight(0xb8c8ff, 2.2);
moon.position.set(-300, 600, -200);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.near   = 1;
moon.shadow.camera.far    = 1600;
moon.shadow.camera.left   = moon.shadow.camera.bottom = -700;
moon.shadow.camera.right  = moon.shadow.camera.top    =  700;
moon.shadow.bias = -0.001;
scene.add(moon);

// 2) Low ambient — very dark purple, just enough to see shadow detail
const ambient = new THREE.AmbientLight(0x1a0f2a, 0.9);
scene.add(ambient);

// 3) Warm orange ground-bounce — simulates fire/lava glow from below
//    Positioned at ground level, points upward — gives the kaiju dramatic underlighting
const groundBounce = new THREE.PointLight(0xff6600, 3.5, 350, 1.5);
groundBounce.position.set(0, 5, 0); // will track kaiju XZ each frame
scene.add(groundBounce);

// 4) Three slow-sweep searchlights — mounted on invisible towers at city edges
//    These are the "star" of the lighting: they catch the kaiju as they sweep
const SEARCHLIGHT_DEFS = [
  { pos: new THREE.Vector3( 450,  2,  450), color: 0xaaddff, orbit: 0 },
  { pos: new THREE.Vector3(-450,  2,  200), color: 0xffddaa, orbit: 2.1 },
  { pos: new THREE.Vector3( 100,  2, -500), color: 0xddaaff, orbit: 4.2 },
];
const searchlights = SEARCHLIGHT_DEFS.map(({ pos, color, orbit }) => {
  const spot = new THREE.SpotLight(color, 8, 900, Math.PI / 14, 0.35, 1.2);
  spot.position.copy(pos);
  spot.castShadow = false; // searchlights don't cast shadows — perf
  scene.add(spot);
  scene.add(spot.target);

  // Visible cone mesh so the beam shows in the air (volumetric-lite trick)
  const coneGeo = new THREE.CylinderGeometry(0, 28, 550, 16, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.04, side: THREE.BackSide, depthWrite: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.renderOrder = 1;
  scene.add(cone);

  return { spot, cone, orbitPhase: orbit };
});

// ── Distant horizon ───────────────────────────────────────────────────────────
const horizonGeo = new THREE.CylinderGeometry(1900, 1900, 300, 64, 1, true);
const horizonMat = new THREE.MeshBasicMaterial({ color: 0x08050d, side: THREE.BackSide });
const horizon = new THREE.Mesh(horizonGeo, horizonMat);
horizon.position.y = 100;
scene.add(horizon);

// ── Ambient dust ─────────────────────────────────────────────────────────────
const DUST_COUNT = 800;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(DUST_COUNT * 3);
const dustVel = [];
for (let i = 0; i < DUST_COUNT; i++) {
  dustPos[i*3]   = (Math.random() - 0.5) * 600;
  dustPos[i*3+1] = Math.random() * 120;
  dustPos[i*3+2] = (Math.random() - 0.5) * 600;
  dustVel.push({ x: (Math.random()-0.5)*4, y: (Math.random()-0.5)*2 });
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({
  color: 0xaa9988, size: 0.7, opacity: 0.3, transparent: true, sizeAttenuation: true,
});
scene.add(new THREE.Points(dustGeo, dustMat));

// ── Roar AoE hemisphere ───────────────────────────────────────────────────────
const ROAR_RADIUS_3D = 220; // world units
const roarHemiGeo = new THREE.SphereGeometry(ROAR_RADIUS_3D, 32, 16, 0, Math.PI*2, 0, Math.PI/2);
const roarHemiMat = new THREE.MeshBasicMaterial({
  color: 0xff6600, transparent: true, opacity: 0.0,
  side: THREE.BackSide, depthWrite: false,
});
const roarHemi = new THREE.Mesh(roarHemiGeo, roarHemiMat);
roarHemi.visible = false;
scene.add(roarHemi);

// ── Input ─────────────────────────────────────────────────────────────────────
const input = {
  forward: false, backward: false, left: false, right: false,
  punch: false, swipe: false, roar: false,
};

document.addEventListener('keydown', (e) => {
  // Prevent space scrolling the page
  if (e.key === ' ') e.preventDefault();
  switch (e.key.toLowerCase()) {
    case 'w': case 'arrowup':    input.forward  = true; break;
    case 's': case 'arrowdown':  input.backward = true; break;
    case 'a': case 'arrowleft':  input.left     = true; break;
    case 'd': case 'arrowright': input.right    = true; break;
    case ' ':                    input.punch    = true; break;
    case 'shift':                input.swipe    = true; break;
    case 'r':                    input.roar     = true; break;
  }
});
document.addEventListener('keyup', (e) => {
  switch (e.key.toLowerCase()) {
    case 'w': case 'arrowup':    input.forward  = false; break;
    case 's': case 'arrowdown':  input.backward = false; break;
    case 'a': case 'arrowleft':  input.left     = false; break;
    case 'd': case 'arrowright': input.right    = false; break;
    case ' ':                    input.punch    = false; break;
    case 'shift':                input.swipe    = false; break;
    case 'r':                    input.roar     = false; break;
  }
});

let pointerLocked = false;
document.addEventListener('click', () => { if (gameStarted) renderer.domElement.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === renderer.domElement; });
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  cameraYaw   -= e.movementX * 0.0025;
  cameraPitch -= e.movementY * 0.0025;
  cameraPitch  = Math.max(CAM_PITCH_MIN, Math.min(CAM_PITCH_MAX, cameraPitch));
});

// ── Audio ─────────────────────────────────────────────────────────────────────
let bgmAudio = null;

function initAudio() {
  bgmAudio = new Audio('audio/track_1.mp3');
  bgmAudio.loop   = true;
  bgmAudio.volume = 0.55;
  bgmAudio.play().catch(() => {
    // Some browsers need another gesture; retry silently
    document.addEventListener('click', () => bgmAudio.play().catch(() => {}), { once: true });
  });
}

// ── Game state ────────────────────────────────────────────────────────────────
let gameStarted  = false;
let score        = 0;
let demolished   = 0;
let kaijuCtrl    = null;
let cityResult   = null;
let lastTime     = 0;
let flashAlpha   = 0;
let shakeAmount  = 0;
let gameTime     = 0;

// Roar charge
const ROAR_THRESHOLD = 25;
let roarCharge    = 0;  // 0 – ROAR_THRESHOLD
let roarReady     = false;
let roarActive    = false;        // true while roar AoE is expanding
let roarTimer     = 0;
const ROAR_DURATION = 1.4;        // seconds the AoE expands

// Punch one-shot debounce
let punchConsumed = false;
let swipeConsumed = false;
let roarConsumed  = false;

// ── LOD ───────────────────────────────────────────────────────────────────────
const LOD_DIST = 700;

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  loadingBar.style.width = '10%';

  const kaijuData = await loadKaiju(scene, (p) => {
    loadingBar.style.width = (10 + p * 60) + '%';
  }).catch((err) => { console.warn('[Game] Kaiju load failed:', err); return null; });

  loadingBar.style.width = '75%';

  cityResult = initCity(scene);

  loadingBar.style.width = '95%';

  if (kaijuData) {
    kaijuCtrl = new KaijuController(kaijuData);
    kaijuCtrl.root.position.set(0, 0, -50);
  } else {
    // Fallback placeholder
    const ph = new THREE.Mesh(
      new THREE.CylinderGeometry(KAIJU_RADIUS, KAIJU_RADIUS * 0.7, 90, 12),
      new THREE.MeshStandardMaterial({ color: 0x334422, roughness: 0.8 })
    );
    ph.position.set(0, 45, -50);
    scene.add(ph);
    kaijuCtrl = {
      root: ph,
      get position() { return ph.position; },
      get facingDir() { return new THREE.Vector3(0, 0, -1); },
      get isAttacking() { return false; },
      update(dt, inp, yaw) {
        let dx=0,dz=0;
        if(inp.forward) {dx-=Math.sin(yaw);dz-=Math.cos(yaw);}
        if(inp.backward){dx+=Math.sin(yaw);dz+=Math.cos(yaw);}
        if(inp.left)    {dx-=Math.cos(yaw);dz+=Math.sin(yaw);}
        if(inp.right)   {dx+=Math.cos(yaw);dz-=Math.sin(yaw);}
        const l=Math.sqrt(dx*dx+dz*dz)||1;
        ph.position.x+=dx/l*20*dt;
        ph.position.z+=dz/l*20*dt;
        return { punchActive: inp.punch, swipeActive: inp.swipe, roarActive: inp.roar };
      }
    };
  }

  loadingBar.style.width = '100%';
  setTimeout(() => {
    loadingEl.style.display  = 'none';
    titleScreen.style.display = 'flex';
  }, 400);
}

startBtn.addEventListener('click', () => {
  gameStarted = true;
  titleScreen.style.display = 'none';
  hudEl.style.display = 'block';
  remainingEl.textContent = cityResult.totalBuildings;
  renderer.domElement.requestPointerLock();
  initAudio();
  lastTime = performance.now() * 0.001;
  animate();
});

// ── Roar AoE ──────────────────────────────────────────────────────────────────
function triggerRoar() {
  if (!roarReady) return;
  roarReady   = false;
  roarCharge  = 0;
  roarActive  = true;
  roarTimer   = 0;
  roarConsumed = true;

  roarHemi.position.copy(kaijuCtrl.position);
  roarHemi.position.y = 0;
  roarHemi.scale.setScalar(0.05);
  roarHemi.visible = true;
  roarHemiMat.opacity = 0.55;

  // CSS ripple
  roarWaveEl.classList.remove('active');
  void roarWaveEl.offsetWidth;
  roarWaveEl.classList.add('active');
  setTimeout(() => roarWaveEl.classList.remove('active'), 900);

  // Big screen flash
  flashAlpha = Math.max(flashAlpha, 0.8);
  flashEl.style.opacity = flashAlpha;

  updateRoarHUD();
}

function updateRoarAoE(dt) {
  if (!roarActive) return;
  roarTimer += dt;
  const t = roarTimer / ROAR_DURATION;

  // Expand the hemisphere
  roarHemi.scale.setScalar(t);
  roarHemiMat.opacity = 0.55 * (1 - t * t);

  // Fracture buildings inside expanding radius
  const kp = kaijuCtrl.position;
  const currentR = ROAR_RADIUS_3D * t;
  for (const b of cityResult.buildingData) {
    if (b.fractured) continue;
    const bCX = (b.aabb.minX + b.aabb.maxX) * 0.5;
    const bCZ = (b.aabb.minZ + b.aabb.maxZ) * 0.5;
    const dx = bCX - kp.x, dz = bCZ - kp.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < currentR) {
      _impactPt.set(bCX, b.aabb.topY * 0.5, bCZ);
      fractureBuilding(b, scene, _impactPt);
      demolished++;
      score += Math.round(b.aabb.topY * 10);
      shakeAmount = Math.max(shakeAmount, 6);
    }
  }

  if (roarTimer >= ROAR_DURATION) {
    roarActive = false;
    roarHemi.visible = false;
    updateHUD();
  }
}

// ── Collision detection ───────────────────────────────────────────────────────
const _kPos     = new THREE.Vector3();
const _impactPt = new THREE.Vector3();

function checkCollisions(punchActive, swipeActive) {
  if (!cityResult) return;
  _kPos.copy(kaijuCtrl.position);

  for (const b of cityResult.buildingData) {
    if (b.fractured) continue;
    const aa = b.aabb;

    // Closest point on AABB to kaiju centre
    const cx = Math.max(aa.minX, Math.min(_kPos.x, aa.maxX));
    const cz = Math.max(aa.minZ, Math.min(_kPos.z, aa.maxZ));
    const dx = _kPos.x - cx, dz = _kPos.z - cz;
    const dist = Math.sqrt(dx*dx + dz*dz);

    // --- walk / body crush ---
    let hit = dist < KAIJU_RADIUS;

    // --- tail swipe: 360° AoE around body ---
    if (!hit && swipeActive) hit = dist < STOMP_RADIUS;

    // --- punch: forward cone ---
    if (!hit && punchActive) {
      const fd = kaijuCtrl.facingDir;
      const toCX = cx - _kPos.x, toCZ = cz - _kPos.z;
      const toCLen = Math.sqrt(toCX*toCX + toCZ*toCZ) || 1;
      const dot = (fd.x * toCX/toCLen) + (fd.z * toCZ/toCLen);
      if (dist < PUNCH_RADIUS && dot > 0.55) hit = true; // ~55° forward cone
    }

    if (hit) {
      _impactPt.set(cx, aa.topY * 0.5, cz);
      fractureBuilding(b, scene, _impactPt);
      demolished++;
      score += Math.round(aa.topY * 10);

      const shake = swipeActive ? aa.topY * 0.14 : aa.topY * 0.10;
      shakeAmount = Math.max(shakeAmount, shake);
      flashAlpha  = Math.max(flashAlpha, swipeActive ? 0.7 : 0.5);
      flashEl.style.opacity = flashAlpha;

      // Feed roar meter
      if (!roarReady) {
        roarCharge = Math.min(roarCharge + 1, ROAR_THRESHOLD);
        if (roarCharge >= ROAR_THRESHOLD) roarReady = true;
        updateRoarHUD();
      }
    }
  }

  updateHUD();
  if (demolished >= cityResult.totalBuildings) showWinScreen();
}

function updateHUD() {
  scoreEl.textContent    = score.toLocaleString();
  buildingEl.textContent = demolished;
  remainingEl.textContent = Math.max(0, cityResult.totalBuildings - demolished);
}

function updateRoarHUD() {
  const pct = Math.min(100, (roarCharge / ROAR_THRESHOLD) * 100);
  roarFillEl.style.width = pct + '%';

  if (roarReady) {
    roarFillEl.classList.add('ready');
    roarLabelEl.classList.add('ready');
    roarLabelEl.textContent = '🔥 PRESS R TO ROAR! 🔥';
  } else {
    roarFillEl.classList.remove('ready');
    roarLabelEl.classList.remove('ready');
    roarLabelEl.textContent = `ROAR METER — ${roarCharge} / ${ROAR_THRESHOLD}`;
  }
}

// ── Searchlight update ────────────────────────────────────────────────────────
function updateSearchlights(time, kaijuPos) {
  searchlights.forEach(({ spot, cone, orbitPhase }, i) => {
    // Each light sweeps slowly in a wide arc, targeting roughly toward kaiju
    const angle = time * 0.18 + orbitPhase;
    const targetX = kaijuPos.x + Math.sin(angle) * 180;
    const targetZ = kaijuPos.z + Math.cos(angle) * 180;
    const targetY = kaijuPos.y + 60; // aim at kaiju mid-height

    spot.target.position.set(targetX, targetY, targetZ);
    spot.target.updateMatrixWorld();

    // Sync visible cone with spotlight
    const dx = targetX - spot.position.x;
    const dy = targetY - spot.position.y;
    const dz = targetZ - spot.position.z;
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);

    cone.position.copy(spot.position);
    cone.position.x += dx / len * 275;
    cone.position.y += dy / len * 275;
    cone.position.z += dz / len * 275;

    // Point cone along beam direction
    const quat = new THREE.Quaternion();
    const up   = new THREE.Vector3(0,1,0);
    const dir  = new THREE.Vector3(dx/len, dy/len, dz/len);
    quat.setFromUnitVectors(up, dir);
    cone.setRotationFromQuaternion(quat);
  });
}

// ── Ground bounce tracks kaiju ────────────────────────────────────────────────
function updateGroundBounce(kaijuPos) {
  groundBounce.position.x = kaijuPos.x;
  groundBounce.position.z = kaijuPos.z;
}

// ── Camera ────────────────────────────────────────────────────────────────────
const _camDesired = new THREE.Vector3();
const _camTarget  = new THREE.Vector3();

function updateCamera(dt) {
  const kp = kaijuCtrl.position;
  _camTarget.set(kp.x, kp.y + 50, kp.z);

  const camX = kp.x + Math.sin(cameraYaw) * CAM_DIST * Math.cos(cameraPitch);
  const camY = kp.y + Math.sin(cameraPitch) * CAM_DIST + 20;
  const camZ = kp.z + Math.cos(cameraYaw) * CAM_DIST * Math.cos(cameraPitch);

  _camDesired.set(camX, camY, camZ);
  camera.position.lerp(_camDesired, 1 - Math.pow(0.88, dt * 60));

  if (shakeAmount > 0.1) {
    camera.position.x += (Math.random()-0.5) * shakeAmount;
    camera.position.y += (Math.random()-0.5) * shakeAmount * 0.4;
    camera.position.z += (Math.random()-0.5) * shakeAmount;
    shakeAmount *= Math.pow(0.55, dt * 60);
  } else { shakeAmount = 0; }

  camera.lookAt(_camTarget);
}

// ── LOD ───────────────────────────────────────────────────────────────────────
function updateLOD() {
  if (!cityResult) return;
  const kp  = kaijuCtrl.position;
  const D2  = LOD_DIST * LOD_DIST;
  for (const b of cityResult.buildingData) {
    if (b.fractured) continue;
    const bx = (b.aabb.minX + b.aabb.maxX) * 0.5 - kp.x;
    const bz = (b.aabb.minZ + b.aabb.maxZ) * 0.5 - kp.z;
    b.mesh.visible = (bx*bx + bz*bz) < D2;
  }
}

// ── Dust ──────────────────────────────────────────────────────────────────────
function updateDust(dt, kp) {
  const pos = dustGeo.attributes.position;
  for (let i = 0; i < DUST_COUNT; i++) {
    pos.array[i*3]   += dustVel[i].x * dt;
    pos.array[i*3+1] += dustVel[i].y * dt;
    const rx = pos.array[i*3] - kp.x, rz = pos.array[i*3+2] - kp.z;
    if (Math.abs(rx) > 300) pos.array[i*3]   = kp.x + (Math.random()-0.5)*500;
    if (Math.abs(rz) > 300) pos.array[i*3+2] = kp.z + (Math.random()-0.5)*500;
    if (pos.array[i*3+1] < 0 || pos.array[i*3+1] > 140) dustVel[i].y *= -1;
  }
  pos.needsUpdate = true;
}

// ── Win screen ────────────────────────────────────────────────────────────────
function showWinScreen() {
  gameStarted = false;
  if (document.pointerLockElement) document.exitPointerLock();
  if (bgmAudio) bgmAudio.pause();
  const win = document.createElement('div');
  win.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:radial-gradient(ellipse at center,#1a0520 0%,#050008 100%);font-family:Segoe UI,sans-serif';
  win.innerHTML = `
    <h1 style="font-size:clamp(2.5rem,8vw,5rem);font-weight:900;text-transform:uppercase;letter-spacing:.15em;color:#ff5500;text-shadow:0 0 40px #ff3300;line-height:1">CITY RAZED</h1>
    <p style="color:#ffaa44;font-size:1.2rem;letter-spacing:.3em;text-transform:uppercase">Nothing remains</p>
    <div style="color:#ff5500;font-size:2.5rem;font-weight:900;text-shadow:0 0 20px #ff3300;margin-top:16px">${score.toLocaleString()} pts</div>
    <button onclick="location.reload()" style="margin-top:30px;padding:18px 60px;background:#ff3300;color:#fff;border:none;font-size:1.3rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;clip-path:polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%);pointer-events:all">DESTROY AGAIN</button>`;
  document.body.appendChild(win);
}

// ── Bounds ────────────────────────────────────────────────────────────────────
const CITY_BOUND = 750;
function clampBounds() {
  const p = kaijuCtrl.position;
  p.x = Math.max(-CITY_BOUND, Math.min(CITY_BOUND, p.x));
  p.z = Math.max(-CITY_BOUND, Math.min(CITY_BOUND, p.z));
}

// ── Main loop ─────────────────────────────────────────────────────────────────
function animate() {
  if (!gameStarted) return;
  requestAnimationFrame(animate);

  const now = performance.now() * 0.001;
  const dt  = Math.min(now - lastTime, 0.05);
  lastTime  = now;
  gameTime += dt;

  // Roar input: only trigger on rising edge while ready, not held
  if (input.roar && roarReady && !roarConsumed) {
    triggerRoar();
  }
  if (!input.roar) roarConsumed = false;

  // Punch / swipe: consume on rising edge so one press = one hit check
  const punchEdge = input.punch && !punchConsumed;
  const swipeEdge = input.swipe && !swipeConsumed;
  if (!input.punch) punchConsumed = false;
  if (!input.swipe) swipeConsumed = false;
  if (punchEdge) punchConsumed = true;
  if (swipeEdge) swipeConsumed = true;

  // Update kaiju controller (handles animation, movement)
  const attackResult = kaijuCtrl.update(dt, input, cameraYaw);

  // Collision checks
  checkCollisions(punchEdge, swipeEdge);

  // Roar AoE expansion
  if (roarActive) updateRoarAoE(dt);

  // Fragments physics
  updateFragments(cityResult.buildingData, dt, scene);

  // Bound
  clampBounds();

  // Lighting
  updateSearchlights(gameTime, kaijuCtrl.position);
  updateGroundBounce(kaijuCtrl.position);

  // Camera
  updateCamera(dt);

  // LOD + dust
  updateLOD();
  updateDust(dt, kaijuCtrl.position);

  // Flash fade
  if (flashAlpha > 0) {
    flashAlpha = Math.max(0, flashAlpha - dt * 4);
    flashEl.style.opacity = flashAlpha;
  }

  renderer.render(scene, camera);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
