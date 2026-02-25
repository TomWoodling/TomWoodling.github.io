// kaiju.js — Embercrest Kaiju loader & controller
// Three separate attack actions: punch (Space), tail swipe (Shift), roar (R)

import * as THREE from 'three';
import { GLTFLoader }  from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export const KAIJU_HEIGHT  = 100;
export const KAIJU_RADIUS  = 18;
export const KAIJU_SPEED   = 20;
export const STOMP_RADIUS  = 38;   // tail swipe / walk crush range
export const PUNCH_RADIUS  = 55;   // forward punch range (directional)

export async function loadKaiju(scene, onProgress) {
  return new Promise((resolve, reject) => {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/');

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      'models/embercrest_kaiju.glb',
      (gltf) => {
        const model = gltf.scene;

        // Scale to target height
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scaleFactor = KAIJU_HEIGHT / (size.y || 1);
        model.scale.setScalar(scaleFactor);

        // Feet at y = 0
        const box2 = new THREE.Box3().setFromObject(model);
        model.position.y -= box2.min.y;

        // Strip emission completely — lighting does all the work
        model.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow    = true;
          child.receiveShadow = false;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            if (!mat) return;
            mat.emissiveIntensity = 0;
            mat.emissiveMap       = null;
            mat.needsUpdate       = true;
          });
        });

        const root = new THREE.Group();
        root.add(model);
        scene.add(root);

        // Animations
        const mixer = gltf.animations.length ? new THREE.AnimationMixer(model) : null;

        let walkClip = null, idleClip = null, punchClip = null, swipeClip = null, roarClip = null;

        if (mixer) {
          for (const clip of gltf.animations) {
            const n = clip.name.toLowerCase();
            if      (n.includes('walk') || n.includes('run'))              walkClip  = clip;
            else if (n.includes('idle') || n.includes('stand'))            idleClip  = clip;
            else if (n.includes('punch') || n.includes('attack'))             punchClip = clip;
            else if (n.includes('swipe') || n.includes('stomp') || n.includes('tail') || n.includes('attack')) swipeClip = clip;
            else if (n.includes('roar') || n.includes('breath'))           roarClip  = clip;
          }
          // Fallbacks: assign first clip to everything that's missing
          const fallback = gltf.animations[0] || null;
          if (!walkClip)  walkClip  = fallback;
          if (!idleClip)  idleClip  = fallback;
          if (!punchClip) punchClip = fallback;
          if (!swipeClip) swipeClip = fallback;
          if (!roarClip)  roarClip  = fallback;

          console.log('[Kaiju] Clips found:', gltf.animations.map(c => c.name));
        }

        resolve({ root, mixer, walkClip, idleClip, punchClip, swipeClip, roarClip, model });
      },
      (xhr) => { if (onProgress) onProgress(xhr.loaded / xhr.total); },
      (err) => { console.error('[Kaiju] Load error:', err); reject(err); }
    );
  });
}

// ── Action enum ───────────────────────────────────────────────────────────────
export const Action = { IDLE: 0, WALK: 1, PUNCH: 2, SWIPE: 3, ROAR: 4 };

// ── KaijuController ───────────────────────────────────────────────────────────
export class KaijuController {
  constructor({ root, mixer, walkClip, idleClip, punchClip, swipeClip, roarClip }) {
    this.root      = root;
    this.mixer     = mixer;
    this.walkClip  = walkClip;
    this.idleClip  = idleClip;
    this.punchClip = punchClip;
    this.swipeClip = swipeClip;
    this.roarClip  = roarClip;

    this._activeAction = null;
    this._currentEnum  = Action.IDLE;
    this._attackTimer  = 0;
    this._yaw          = 0;
    this._isMoving     = false;

    if (mixer && idleClip) {
      this._activeAction = mixer.clipAction(idleClip);
      this._activeAction.play();
    }
  }

  get position() { return this.root.position; }
  get isAttacking() { return this._attackTimer > 0; }

  // Returns { moved, punchActive, swipeActive, roarActive }
  update(dt, input, cameraYaw) {
    let punchActive = false, swipeActive = false, roarActive = false;

    // ── Attacks (priority: roar > swipe > punch) ──────────────────────────────
    if (this._attackTimer > 0) {
      this._attackTimer -= dt;
      punchActive = (this._currentEnum === Action.PUNCH);
      swipeActive = (this._currentEnum === Action.SWIPE);
      roarActive  = (this._currentEnum === Action.ROAR);
    } else {
      // Attack inputs (only trigger when not already attacking)
      if (input.roar) {
        this._startAttack(Action.ROAR, this.roarClip);
        roarActive = true;
      } else if (input.swipe) {
        this._startAttack(Action.SWIPE, this.swipeClip);
        swipeActive = true;
      } else if (input.punch) {
        this._startAttack(Action.PUNCH, this.punchClip);
        punchActive = true;
      }
    }

    // ── Movement (suppressed during attacks) ──────────────────────────────────
    let moved = false;
    const isAttacking = this._attackTimer > 0;

    if (!isAttacking) {
      let dx = 0, dz = 0;
      if (input.forward)  { dx -= Math.sin(cameraYaw); dz -= Math.cos(cameraYaw); }
      if (input.backward) { dx += Math.sin(cameraYaw); dz += Math.cos(cameraYaw); }
      if (input.left)     { dx -= Math.cos(cameraYaw); dz += Math.sin(cameraYaw); }
      if (input.right)    { dx += Math.cos(cameraYaw); dz -= Math.sin(cameraYaw); }

      const moving = dx !== 0 || dz !== 0;

      if (moving) {
        const len = Math.sqrt(dx*dx + dz*dz);
        dx /= len; dz /= len;
        this.root.position.x += dx * KAIJU_SPEED * dt;
        this.root.position.z += dz * KAIJU_SPEED * dt;

        const targetYaw = Math.atan2(dx, dz) + Math.PI;
        let diff = targetYaw - this._yaw;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this._yaw += diff * Math.min(1, dt * 6);
        this.root.rotation.y = this._yaw;
        moved = true;
      }

      // Idle / walk transitions
      if (moving && this._currentEnum !== Action.WALK) this._playClip(this.walkClip, Action.WALK, 0.3, true);
      if (!moving && this._currentEnum !== Action.IDLE) this._playClip(this.idleClip, Action.IDLE, 0.3, true);
      this._isMoving = moving;
    }

    if (this.mixer) this.mixer.update(dt);

    return { moved, punchActive, swipeActive, roarActive };
  }

  _startAttack(actionEnum, clip) {
    const duration = (clip && clip.duration) ? clip.duration : 1.2;
    this._attackTimer = duration;
    this._playClip(clip, actionEnum, 0.15, false);
  }

  _playClip(clip, actionEnum, fadeTime = 0.3, loop = true) {
    if (!clip || !this.mixer) {
      this._currentEnum = actionEnum;
      return;
    }
    const action = this.mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    if (this._activeAction && this._activeAction !== action) this._activeAction.fadeOut(fadeTime);
    action.reset().fadeIn(fadeTime).play();
    this._activeAction = action;
    this._currentEnum  = actionEnum;
  }

  // Facing direction as unit vector (XZ)
  get facingDir() {
    return new THREE.Vector3(-Math.sin(this._yaw), 0, -Math.cos(this._yaw));
  }
}
