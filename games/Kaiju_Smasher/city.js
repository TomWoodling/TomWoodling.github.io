// city.js — Grid city for Kaiju Smasher
// Generates buildings as DestructibleMesh so they can be fractured.
// Returns { buildingData[], totalBuildings }
// buildingData: { mesh, aabb: {minX,maxX,minZ,maxZ,topY}, fractured, fragments[] }

import * as THREE from 'three';
import { DestructibleMesh, FractureOptions } from '@dgreenheck/three-pinata';

// ── Constants ─────────────────────────────────────────────────────────────────
const CITY_HALF   = 600;   // half-extent of city
const GRID_CELLS  = 14;    // NxN blocks
const CELL_STRIDE = (CITY_HALF * 2) / GRID_CELLS;
const BLOCK_SIZE  = CELL_STRIDE * 0.72;

const BLDG_MIN_W  = 14;
const BLDG_MAX_W  = 36;
const BLDG_MIN_H  = 12;
const BLDG_MAX_H  = 75;   // tallest ~75m, kaiju ~100m — she towers over them

// Seeded RNG for deterministic city
let _seed = 42;
function sr() { _seed = (_seed * 1664525 + 1013904223) & 0xffffffff; return ((_seed >>> 0) / 0xffffffff); }
function srRange(a, b) { return a + sr() * (b - a); }

// ── Materials ─────────────────────────────────────────────────────────────────
function makeBuildingMat(h) {
  // Tiered look: short=grey, mid=blue glass, tall=lit amber
  const t = h / BLDG_MAX_H;
  const color = new THREE.Color().setHSL(0.58 + t * 0.12, 0.35 + t * 0.3, 0.18 + t * 0.2);
  const emissive = new THREE.Color().setHSL(0.08, 0.9, t * 0.06);
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    roughness: 0.6 - t * 0.3,
    metalness: 0.1 + t * 0.4,
  });
}

function makeInnerMat() {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.7, 0.55, 0.45),
    roughness: 0.9,
  });
}

// ── Geometry ──────────────────────────────────────────────────────────────────
function makeBuildingGeo(w, h, d) {
  // Slight taper
  const geo = new THREE.BoxGeometry(w, h, d, 1, 3, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0) {
      const t = y / (h / 2);
      const s = 1.0 - t * 0.05;
      pos.setX(i, pos.getX(i) * s);
      pos.setZ(i, pos.getZ(i) * s);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function initCity(scene) {
  _seed = 42;
  const buildingData = [];

  // Ground
  const groundGeo = new THREE.PlaneGeometry(CITY_HALF * 2.2, CITY_HALF * 2.2, 2, 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a22,
    roughness: 0.95,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Road grid overlay (simple lines using LineSegments)
  _addRoadGrid(scene);

  // Buildings
  for (let gx = 0; gx < GRID_CELLS; gx++) {
    for (let gz = 0; gz < GRID_CELLS; gz++) {
      const bx = -CITY_HALF + gx * CELL_STRIDE + CELL_STRIDE * 0.5;
      const bz = -CITY_HALF + gz * CELL_STRIDE + CELL_STRIDE * 0.5;

      if (sr() < 0.07) continue; // occasional plaza

      const count = Math.floor(srRange(1, 3.99));
      for (let b = 0; b < count; b++) {
        let bw = srRange(BLDG_MIN_W, BLDG_MAX_W);
        let bd = srRange(BLDG_MIN_W, BLDG_MAX_W);
        let bh = srRange(BLDG_MIN_H, BLDG_MAX_H);

        // Downtown skew
        const dist = Math.sqrt(bx * bx + bz * bz) / CITY_HALF;
        bh *= (1.5 - dist * 0.9);
        bh = Math.max(BLDG_MIN_H, Math.min(BLDG_MAX_H, bh));

        bw = Math.min(bw, BLOCK_SIZE - 8);
        bd = Math.min(bd, BLOCK_SIZE - 8);

        const ox = srRange(-6, 6);
        const oz = srRange(-6, 6);
        const wx = bx + ox;
        const wz = bz + oz;

        const geo  = makeBuildingGeo(bw, bh, bd);
        const mat  = makeBuildingMat(bh);
        const imat = makeInnerMat();

        // Use DestructibleMesh for all buildings
        const mesh = new DestructibleMesh(geo, mat, imat);
        mesh.position.set(wx, bh / 2, wz);
        mesh.castShadow  = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        // Add window glows on taller buildings
        const windowMeshes = bh > 30 ? _addWindowLights(scene, wx, bh, wz, bw, bd) : [];

        const aabb = {
          minX: wx - bw / 2, maxX: wx + bw / 2,
          minZ: wz - bd / 2, maxZ: wz + bd / 2,
          topY: bh,
        };

        buildingData.push({ mesh, aabb, fractured: false, fragments: [], windowMeshes });
      }
    }
  }

  console.log('[City] Buildings:', buildingData.length);
  return { buildingData, totalBuildings: buildingData.length };
}

function _addWindowLights(scene, wx, bh, wz, bw, bd) {
  // Tiny emissive quads simulating window rows — cheap point lights alternative
  const meshes = [];
  const rows  = Math.floor(bh / 5);
  const color = new THREE.Color().setHSL(Math.random() * 0.1 + 0.05, 0.8, 0.7);
  const mat   = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 });

  for (let r = 1; r < rows; r += 2) {
    // front face
    const geo = new THREE.PlaneGeometry(bw * 0.7, 1.2);
    const m   = new THREE.Mesh(geo, mat);
    m.position.set(wx, r * 5 + 2, wz + bd / 2 + 0.05);
    scene.add(m);
    meshes.push(m);
  }
  return meshes;
}

function _addRoadGrid(scene) {
  const pts = [];
  const half = CITY_HALF;
  const step = CELL_STRIDE;
  const y = 0.05;
  // Lines along Z
  for (let gx = 0; gx <= GRID_CELLS; gx++) {
    const x = -half + gx * step;
    pts.push(x, y, -half, x, y, half);
  }
  // Lines along X
  for (let gz = 0; gz <= GRID_CELLS; gz++) {
    const z = -half + gz * step;
    pts.push(-half, y, z, half, y, z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x2a2a38, opacity: 0.7, transparent: true });
  scene.add(new THREE.LineSegments(geo, mat));
}

// ── Fracture a building on kaiju impact ───────────────────────────────────────
export function fractureBuilding(building, scene, impactWorldPos) {
  if (building.fractured) return;
  building.fractured = true;

  const mesh = building.mesh;

  // Convert world impact point to local space
  const localImpact = mesh.worldToLocal(impactWorldPos.clone());

  const options = new FractureOptions({
    fractureMethod: 'voronoi',
    fragmentCount: 14,          // quality over quantity
    voronoiOptions: {
      mode: '3D',
      impactPoint: localImpact,
      impactRadius: 0.4,
    },
  });

  const fragments = mesh.fracture(options, (frag) => {
    frag.castShadow  = true;
    frag.receiveShadow = true;

    // Copy world transform from original
    frag.position.copy(mesh.position);
    frag.rotation.copy(mesh.rotation);
    frag.scale.copy(mesh.scale);

    // Simple physics data stored in userData
    frag.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 18,
      Math.random() * 22 + 8,
      (Math.random() - 0.5) * 18,
    );
    frag.userData.angVel = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
    );
    frag.userData.lifetime = 8 + Math.random() * 4;

    scene.add(frag);
    building.fragments.push(frag);
  });

  // Hide window light planes so they don't float over rubble
  for (const wm of building.windowMeshes) {
    wm.visible = false;
  }
  mesh.visible = false;
  return fragments;
}

// ── Update fragment physics each frame ────────────────────────────────────────
const GRAVITY = -28;
export function updateFragments(buildingData, dt, scene) {
  for (const b of buildingData) {
    for (let i = b.fragments.length - 1; i >= 0; i--) {
      const f = b.fragments[i];
      f.userData.vel.y += GRAVITY * dt;
      f.position.x += f.userData.vel.x * dt;
      f.position.y += f.userData.vel.y * dt;
      f.position.z += f.userData.vel.z * dt;
      f.rotation.x += f.userData.angVel.x * dt;
      f.rotation.y += f.userData.angVel.y * dt;
      f.rotation.z += f.userData.angVel.z * dt;

      // Bounce / settle on ground
      if (f.position.y < 0) {
        f.position.y = 0;
        f.userData.vel.y *= -0.25;
        f.userData.vel.x *= 0.6;
        f.userData.vel.z *= 0.6;
        f.userData.angVel.multiplyScalar(0.4);
      }

      f.userData.lifetime -= dt;
      if (f.userData.lifetime <= 0) {
        scene.remove(f);
        f.geometry.dispose();
        b.fragments.splice(i, 1);
      }
    }
  }
}
