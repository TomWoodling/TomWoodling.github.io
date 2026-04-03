# The SLYber Fox — Claude Code Handoff Document

**Version:** 1.0  
**Game type:** Third-person stealth/exploration platformer  
**Engine:** Three.js r128, vanilla JS, no bundler  
**Target platform:** Browser (GitHub Pages), desktop-first

---

## Game Concept

The player controls the SLYber Fox — a cybernetic urban fox navigating a quiet suburban/industrial city at night. The goal is to infiltrate **HEN Houses** (High-Energy Network nodes) scattered across the city, absorbing their power to unlock new movement capabilities. Guard Dogs patrol the streets and will chase the fox away if it gets too close. The fox must use distraction and cunning — not combat — to outsmart the dogs and reach each HEN House.

**Core loop:**  
Read patrol → create distraction → slip past dogs → reach HEN House → absorb power → unlock next mission

**Tone:** Quiet, atmospheric, slightly lonely. Spirit of the North for tone, but with more responsive controls.

---

## File Structure

```
The_SlyberFox/
├── index.html
├── game.js          # Bootstrap, scene, renderer, game loop, camera, HUD
├── fox.js           # Player controller, physics, animation FSM
├── dog.js           # Guard dog AI FSM, patrol, detection, distraction
├── city.js          # City geometry, HEN houses, interactable objects, nav graph
├── dialogue.js      # Scripted NPC bark/conversation system
├── ui.js            # HUD, energy bar, mission prompts, power-up display
├── config.js        # All tunable constants
└── art/
    └── cyberfox_compressed.glb    # Fox model (Draco compressed, WebP textures)
    └── cyberdog_compressed.glb    # Dog model (same rig template, Draco compressed)
```

**Architecture rule:** `game.js` is the only file that imports from all others. No circular dependencies. All game constants live in `config.js`.

---

## Three.js Setup

### Version
```html
<!-- Use r128 exactly — do not upgrade without testing -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

### Loaders (CRITICAL — Draco + WebP)
```html
<!-- GLTFLoader and DracoLoader must match r128 -->
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js"></script>
```

```js
// In fox.js and dog.js — model loading pattern
var dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');

var gltfLoader = new THREE.GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load('art/cyberfox_compressed.glb', function(gltf) {
  var model = gltf.scene;
  scene.add(model);
  
  // WebP textures: Three.js r128 supports WebP natively in modern browsers.
  // No special handling required — GLTFLoader resolves texture URIs automatically.
  // If textures appear missing in old browsers, fall back is handled by the browser.
  
  var mixer = new THREE.AnimationMixer(model);
  // Store clips by name — see Animation section below
  gltf.animations.forEach(function(clip) {
    animClips[clip.name] = clip;
  });
}, undefined, function(err) {
  console.error('Fox model load error:', err);
});
```

### Renderer
```js
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
```

---

## config.js — All Tunable Constants

```js
var C = {
  // Fox physics
  FOX_WALK_SPEED:    4.0,
  FOX_RUN_SPEED:     9.0,
  FOX_SNEAK_SPEED:   2.5,
  FOX_JUMP_FORCE:    8.0,
  FOX_GRAVITY:      -20.0,
  FOX_COYOTE_MS:     120,   // ms of coyote time after leaving ledge
  FOX_EDGE_MAGNET:   0.4,   // snap distance to platform edges on land
  FOX_TURN_SPEED:    8.0,   // radians/sec rotation speed
  
  // Camera
  CAM_FOLLOW_DIST:   7.0,
  CAM_FOLLOW_HEIGHT: 3.5,
  CAM_LERP_POS:      6.0,   // position follow speed
  CAM_LERP_ROT:      4.0,   // rotation follow speed
  CAM_AUTO_ALIGN:    true,  // gently realign camera behind fox during runs
  
  // Guard dog AI
  DOG_PATROL_SPEED:    2.5,
  DOG_ALERT_SPEED:     0,    // stands still during alert
  DOG_CHASE_SPEED:     7.0,
  DOG_DETECTION_FOR:   8.0,  // forward detection cone radius (m)
  DOG_DETECTION_FOV:   90,   // degrees, ±45 either side of facing
  DOG_HEARING_RADIUS:  5.0,  // bark/noise detection radius (m)
  DOG_SNEAK_MULT:      0.4,  // detection radius multiplier when fox is sneaking
  DOG_ALERT_DURATION:  2.5,  // seconds in alert state before chase
  DOG_CHASE_DURATION:  6.0,  // seconds chasing before giving up
  DOG_RETURN_SPEED:    3.5,  // speed returning to patrol after losing fox
  
  // Distraction
  DISTRACT_RADIUS:     6.0,  // how far a distraction bark reaches
  DISTRACT_DURATION:   8.0,  // seconds a dog investigates a distraction
  
  // HEN Houses
  HEN_ENERGY_RESTORE:  1.0,  // fraction of energy bar filled per visit
  HEN_GLOW_COLOR:      0x00ffcc,
  HEN_PULSE_SPEED:     1.5,
  
  // Power-ups (unlocked by visiting HEN houses in order)
  POWERUPS: [
    { id: 'speed',  name: 'OVERCLOCK',  desc: 'Sprint faster, longer',    runMult: 1.5, energyCost: 0.4  },
    { id: 'silent', name: 'SILENT_PAW', desc: 'Reduced detection radius', dogDetMult: 0.5 },
    { id: 'pulse',  name: 'PULSE_BARK', desc: 'Bark range doubled',        barkMult: 2.0 },
  ],
  
  // Energy (sprint + bark cost)
  ENERGY_MAX:          100,
  ENERGY_REGEN:        8.0,  // per second when idle/walking
  ENERGY_SPRINT_DRAIN: 20.0, // per second while sprinting
  ENERGY_BARK_COST:    15.0, // per bark
  
  // City
  CITY_BLOCK_SIZE:     24,
  CITY_STREET_WIDTH:   8,
  AMBIENT_COLOR:       0x1a0a2e,
  FOG_COLOR:           0x0d0820,
  FOG_NEAR:            30,
  FOG_FAR:             120,
};
```

---

## Animation System

### Clip Names (exact strings from GLB)
Both fox and dog share this animation set — same names, same durations, different keyframe data.

| Index | Name         | Duration | Fox usage                        | Dog usage                        |
|-------|--------------|----------|----------------------------------|----------------------------------|
| 0     | `Bark`       | 2.875s   | E key — distraction/NPC talk     | Alert state warning              |
| 1     | `Bite`       | 0.833s   | Reserved / unused for now        | Reserved                         |
| 2     | `Death`      | 1.167s   | Caught by dog — then respawn     | Knocked by trap (future)         |
| 3     | `Fall`       | 0.542s   | Airborne + downward velocity     | Knocked off ledge (future)       |
| 4     | `Fetch`      | 1.0s     | Activating HEN house / object    | Investigating distraction object |
| 5     | `Howl`       | 2.333s   | HEN House power-up absorption    | Calling second dog (future)      |
| 6     | `Idle`       | 1.333s   | Standing still (loops)           | Patrol pause at waypoint (loops) |
| 7     | `Idle Alert` | 1.625s   | Near dog, tense (loops)          | Heard something — pre-chase      |
| 8     | `Jump`       | 2.167s   | Space bar — full clip then blend | —                                |
| 9     | `Run`        | 0.5s     | Shift held / sprint (loops)      | Chase state (loops)              |
| 10    | `Sit`        | 1.333s   | 8+ sec idle timeout (loops)      | —                                |
| 11    | `Sneak`      | 1.333s   | In dog detection zone (loops)    | Searching behaviour (loops)      |
| 12    | `Walk`       | 1.0s     | Default movement (loops)         | Patrol movement (loops)          |

### Animation FSM — Fox

```js
// fox.js — animation state machine
var FOX_ANIM_STATES = {
  IDLE:       { clip: 'Idle',       loop: true  },
  IDLE_LONG:  { clip: 'Sit',        loop: true  },   // after 8s idle
  IDLE_TENSE: { clip: 'Idle Alert', loop: true  },   // near dog
  WALK:       { clip: 'Walk',       loop: true  },
  RUN:        { clip: 'Run',        loop: true  },
  SNEAK:      { clip: 'Sneak',      loop: true  },
  JUMP:       { clip: 'Jump',       loop: false },
  FALL:       { clip: 'Fall',       loop: false },
  BARK:       { clip: 'Bark',       loop: false },
  HOWL:       { clip: 'Howl',       loop: false },
  FETCH:      { clip: 'Fetch',      loop: false },
  DEATH:      { clip: 'Death',      loop: false },
};

// Transition rules (highest priority first):
// 1. DEATH   — if caught (overrides all)
// 2. BARK    — if E pressed and not airborne (one-shot, then return)
// 3. HOWL    — if at HEN house interaction (one-shot, then return)
// 4. FETCH   — if at interactable object (one-shot, then return)
// 5. JUMP    — if airborne and vertical velocity > 0
// 6. FALL    — if airborne and vertical velocity < 0
// 7. SNEAK   — if in dog detection zone AND moving
// 8. IDLE_TENSE — if in dog detection zone AND still
// 9. RUN     — if Shift held and energy > 0
// 10. WALK   — if moving
// 11. IDLE_LONG — if idle > 8s
// 12. IDLE   — default

// Crossfade duration: 0.2s for locomotion, 0.0s for Death/Jump start
```

### Animation FSM — Guard Dog

```js
// dog.js — animation state machine
var DOG_STATES = {
  PATROL:      { anim: 'Walk',       loop: true  },
  PATROL_WAIT: { anim: 'Idle',       loop: true  },  // at waypoint
  ALERT:       { anim: 'Idle Alert', loop: true  },  // heard/saw something
  INVESTIGATE: { anim: 'Fetch',      loop: false },  // at distraction point
  SEARCH:      { anim: 'Sneak',      loop: true  },  // lost fox, sweeping
  CHASE:       { anim: 'Run',        loop: true  },
  WARN:        { anim: 'Bark',       loop: false },  // reached fox/boundary
  RETURN:      { anim: 'Walk',       loop: true  },  // returning to patrol
};
```

---

## Fox Controller — fox.js

### Physics

Use a simple character controller — no physics library needed.

```js
// fox.js
var foxState = {
  position:     new THREE.Vector3(0, 0, 0),
  velocity:     new THREE.Vector3(0, 0, 0),
  rotation:     0,           // Y-axis facing angle (radians)
  onGround:     false,
  coyoteTimer:  0,           // counts down from C.FOX_COYOTE_MS
  animState:    'IDLE',
  idleTimer:    0,
  energy:       C.ENERGY_MAX,
  powerups:     [],
  isSneaking:   false,
  isCaught:     false,
};

function updateFox(dt) {
  // 1. Read input
  var moveDir = getInputDirection();    // normalised XZ from WASD/arrows
  var sprinting = input.shift && foxState.energy > 0;
  var sneaking = isInDogDetectionZone();
  
  // 2. Apply movement
  var speed = sneaking ? C.FOX_SNEAK_SPEED :
              sprinting ? C.FOX_RUN_SPEED * getSpeedMult() :
              C.FOX_WALK_SPEED;
  foxState.velocity.x = moveDir.x * speed;
  foxState.velocity.z = moveDir.z * speed;
  
  // 3. Gravity
  if (!foxState.onGround) {
    foxState.velocity.y += C.FOX_GRAVITY * dt;
  }
  
  // 4. Coyote time
  if (foxState.onGround) {
    foxState.coyoteTimer = C.FOX_COYOTE_MS;
  } else {
    foxState.coyoteTimer -= dt * 1000;
  }
  
  // 5. Jump
  if (input.jumpPressed && foxState.coyoteTimer > 0) {
    foxState.velocity.y = C.FOX_JUMP_FORCE;
    foxState.coyoteTimer = 0;
  }
  
  // 6. Move and collide
  foxState.position.addScaledVector(foxState.velocity, dt);
  resolveCollisions(foxState);    // see City section
  
  // 7. Rotate fox toward movement direction (smooth)
  if (moveDir.lengthSq() > 0.01) {
    var targetAngle = Math.atan2(moveDir.x, moveDir.z);
    foxState.rotation = lerpAngle(foxState.rotation, targetAngle, C.FOX_TURN_SPEED * dt);
  }
  
  // 8. Energy drain/regen
  if (sprinting) {
    foxState.energy = Math.max(0, foxState.energy - C.ENERGY_SPRINT_DRAIN * dt);
  } else {
    foxState.energy = Math.min(C.ENERGY_MAX, foxState.energy + C.ENERGY_REGEN * dt);
  }
  
  // 9. Update animation FSM
  updateFoxAnim(dt, sprinting, sneaking);
  
  // 10. Update mixer
  foxMixer.update(dt);
}
```

### Controls

| Key             | Action                              |
|-----------------|-------------------------------------|
| WASD / Arrows   | Move                                |
| Shift           | Sprint (drains energy)              |
| Space           | Jump (coyote time applies)          |
| E               | Bark / Interact                     |
| Mouse drag      | Rotate camera                       |
| Mouse wheel     | Zoom camera in/out                  |

### Bark / Interact (E key)

```js
function onBark() {
  if (foxState.isCaught) return;
  foxState.energy -= C.ENERGY_BARK_COST * getBarkCostMult();
  playAnimOnce('Bark');
  
  // Check for nearby interactables
  var barkRadius = C.DISTRACT_RADIUS * getBarkRadiusMult();
  
  // 1. Check for distraction objects (bins, crates, panels)
  var distractable = findNearestInRadius(distractObjects, foxState.position, barkRadius);
  if (distractable) {
    triggerDistraction(distractable);  // dog AI picks this up
    return;
  }
  
  // 2. Check for NPC foxes
  var npc = findNearestInRadius(npcFoxes, foxState.position, barkRadius);
  if (npc) {
    dialogue.startConversation(npc);
    return;
  }
}
```

---

## Guard Dog AI — dog.js

### FSM Implementation

```js
// dog.js
function DogAgent(spawnPos, patrolWaypoints) {
  this.position = spawnPos.clone();
  this.waypoints = patrolWaypoints;  // array of Vector3
  this.waypointIdx = 0;
  this.state = 'PATROL';
  this.stateTimer = 0;
  this.alertTarget = null;    // position that triggered alert
  this.distractTarget = null; // distraction object position
  this.mixer = null;          // AnimationMixer, set after model load
  this.currentAnim = null;
}

DogAgent.prototype.update = function(dt, foxPos, distractions) {
  this.stateTimer += dt;
  
  switch (this.state) {
    
    case 'PATROL':
      this.moveToward(this.waypoints[this.waypointIdx], C.DOG_PATROL_SPEED, dt);
      if (this.reachedWaypoint()) {
        this.state = 'PATROL_WAIT';
        this.stateTimer = 0;
        this.setAnim('Idle');
      }
      if (this.canDetectFox(foxPos)) {
        this.enterAlert(foxPos);
      }
      if (this.canHearDistraction(distractions)) {
        this.enterInvestigate(this.nearestDistraction(distractions));
      }
      break;
      
    case 'PATROL_WAIT':
      if (this.stateTimer > 2.0) {
        this.waypointIdx = (this.waypointIdx + 1) % this.waypoints.length;
        this.state = 'PATROL';
        this.setAnim('Walk');
      }
      if (this.canDetectFox(foxPos)) this.enterAlert(foxPos);
      break;
      
    case 'ALERT':
      // Stand still, play Idle Alert, build up before chasing
      if (this.stateTimer > C.DOG_ALERT_DURATION) {
        if (this.distanceToFox(foxPos) < C.DOG_DETECTION_FOR) {
          this.enterChase();
        } else {
          this.enterSearch(foxPos);
        }
      }
      break;
      
    case 'CHASE':
      this.moveToward(foxPos, C.DOG_CHASE_SPEED, dt);
      // If fox is close enough — bark warning and mark as caught
      if (this.distanceTo(foxPos) < 1.5) {
        this.setAnim('Bark');
        events.emit('foxCaught');
      }
      if (this.stateTimer > C.DOG_CHASE_DURATION) {
        this.enterSearch(foxPos);
      }
      break;
      
    case 'INVESTIGATE':
      this.moveToward(this.distractTarget, C.DOG_PATROL_SPEED, dt);
      if (this.reachedTarget(this.distractTarget)) {
        this.setAnim('Fetch');
        if (this.stateTimer > C.DISTRACT_DURATION) {
          this.enterReturn();
        }
      }
      break;
      
    case 'SEARCH':
      // Play Sneak, sweep the last known fox position area
      this.moveToward(this.alertTarget, C.DOG_PATROL_SPEED, dt);
      if (this.canDetectFox(foxPos)) this.enterChase();
      if (this.stateTimer > 8.0) this.enterReturn();
      break;
      
    case 'RETURN':
      this.moveToward(this.waypoints[this.waypointIdx], C.DOG_RETURN_SPEED, dt);
      if (this.reachedWaypoint()) {
        this.state = 'PATROL';
        this.setAnim('Walk');
      }
      break;
  }
  
  this.mixer.update(dt);
};

// Detection — cone + optional hearing
DogAgent.prototype.canDetectFox = function(foxPos) {
  var toFox = foxPos.clone().sub(this.position);
  var dist = toFox.length();
  var sneakMult = foxState.isSneaking ? C.DOG_SNEAK_MULT : 1.0;
  
  // Hearing range (omnidirectional, reduced if sneaking)
  if (dist < C.DOG_HEARING_RADIUS * sneakMult) return true;
  
  // Vision cone (reduced if sneaking)
  if (dist < C.DOG_DETECTION_FOR * sneakMult) {
    toFox.normalize();
    var forward = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
    var dot = forward.dot(toFox.normalize());
    var halfFOV = (C.DOG_DETECTION_FOV / 2) * (Math.PI / 180);
    if (Math.acos(dot) < halfFOV) return true;
  }
  
  return false;
};
```

### Distraction System

```js
// city.js — interactable distraction objects
var distractObjects = [
  { position: new THREE.Vector3(12, 0, -5), type: 'bin',   active: false, timer: 0 },
  { position: new THREE.Vector3(-8, 0, 20), type: 'panel', active: false, timer: 0 },
  // ... auto-generated with city layout
];

function triggerDistraction(obj) {
  obj.active = true;
  obj.timer = C.DISTRACT_DURATION;
  // Visual effect: sparks/noise particle burst at obj.position
  spawnDistractVFX(obj.position);
}
```

---

## City — city.js

### Layout Strategy

The city is a **hand-authored hub** built from modular geometry — not fully procedural. This ensures good patrol routes and satisfying HEN House placement.

```
[ Starting alley ]
        |
  [ Street grid, 3x3 blocks ]
  /     |     \
[HEN1] [HEN2] [HEN3]
  \     |     /
  [ Industrial yard ]
        |
   [ HEN4 — final ]
```

### Geometry Approach

Build from simple box geometry — this is a night city, shadows and silhouettes do the work:

```js
function makeBlock(w, h, d, x, z, color) {
  var geo = new THREE.BoxGeometry(w, h, d);
  var mat = new THREE.MeshStandardMaterial({
    color: color || 0x111122,
    roughness: 0.9,
    metalness: 0.1,
  });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
```

Add neon trim to buildings with emissive `EdgesGeometry` lines — cheap, reads great at night.

### Collision

Use axis-aligned bounding boxes (AABB) for all city geometry. No physics engine needed.

```js
// city.js
var colliders = [];  // Array of THREE.Box3

function resolveCollisions(entity) {
  var entityBox = new THREE.Box3().setFromCenterAndSize(
    entity.position,
    new THREE.Vector3(0.6, 1.2, 0.6)
  );
  
  colliders.forEach(function(box) {
    if (entityBox.intersectsBox(box)) {
      // Push entity out along shortest axis
      pushOut(entity, entityBox, box);
    }
  });
  
  // Ground check
  if (entity.position.y <= 0) {
    entity.position.y = 0;
    entity.velocity.y = 0;
    entity.onGround = true;
  }
}
```

### HEN Houses

```js
// Each HEN House is a special building node
var henHouses = [
  {
    id: 'HEN_1',
    position: new THREE.Vector3(40, 0, 20),
    locked: false,       // first one is always unlocked
    visited: false,
    powerupId: 'speed',
    missionText: 'Find the OVERCLOCK node in the warehouse district.',
  },
  // ...
];

function makeHENHouse(config) {
  // Glowing cyan box with pulsing PointLight
  var mesh = makeBlock(6, 8, 6, config.position.x, config.position.z, 0x002211);
  var glow = new THREE.PointLight(C.HEN_GLOW_COLOR, config.locked ? 0.2 : 2.0, 15);
  glow.position.copy(config.position).add(new THREE.Vector3(0, 5, 0));
  // Pulse glow intensity in game loop using sin wave
  return { mesh, glow, config };
}
```

---

## Camera — game.js

```js
// Third-person follow camera with soft auto-alignment
var camOffset = new THREE.Vector3(0, C.CAM_FOLLOW_HEIGHT, -C.CAM_FOLLOW_DIST);
var camTarget = new THREE.Vector3();
var camActual = new THREE.Vector3();
var camYaw = 0;    // player-controlled horizontal rotation (mouse drag)
var camPitch = 0.3; // fixed slight downward angle

function updateCamera(dt) {
  // Desired camera position relative to fox
  var foxAngle = foxState.rotation;
  
  if (C.CAM_AUTO_ALIGN && foxState.velocity.lengthSq() > 1.0) {
    // Gently nudge yaw toward 0 (behind fox) during movement
    camYaw = lerpAngle(camYaw, 0, 1.5 * dt);
  }
  
  var totalAngle = foxAngle + camYaw;
  var desiredOffset = new THREE.Vector3(
    Math.sin(totalAngle) * C.CAM_FOLLOW_DIST,
    C.CAM_FOLLOW_HEIGHT,
    Math.cos(totalAngle) * C.CAM_FOLLOW_DIST
  );
  
  camTarget.copy(foxState.position).add(desiredOffset);
  camActual.lerp(camTarget, C.CAM_LERP_POS * dt);
  
  camera.position.copy(camActual);
  camera.lookAt(foxState.position.x, foxState.position.y + 1.0, foxState.position.z);
}

// Mouse drag: update camYaw on mousemove when button held
// Mouse wheel: adjust CAM_FOLLOW_DIST (clamp 3–12)
```

---

## Dialogue System — dialogue.js

Scripted for now, designed for easy AI upgrade later.

```js
// dialogue.js
var DIALOGUES = {
  'npc_fox_1': [
    { speaker: 'RUSTY',  text: 'Stay low near the depot — that big dog\'s got wide eyes.' },
    { speaker: 'PLAYER', text: '...' },   // bark animation plays
    { speaker: 'RUSTY',  text: 'There\'s a loose panel round back. Makes a good noise.' },
  ],
  'hen_1_approach': [
    { speaker: 'SYSTEM', text: 'HEN NODE DETECTED. Absorb energy to OVERCLOCK sprint.' },
  ],
  // ...
};

var DialogueSystem = {
  active: false,
  queue: [],
  current: null,
  
  startConversation: function(npcId) {
    this.queue = DIALOGUES[npcId] ? DIALOGUES[npcId].slice() : [];
    this.active = true;
    this.advance();
    ui.showDialogueBox(true);
  },
  
  advance: function() {
    if (this.queue.length === 0) {
      this.active = false;
      ui.showDialogueBox(false);
      return;
    }
    this.current = this.queue.shift();
    ui.setDialogueText(this.current.speaker, this.current.text);
  },
  
  // Call advance() on E press while dialogue is active
  // FUTURE: swap DIALOGUES[npcId] fetch for Anthropic API call
};
```

---

## Lighting

```js
// game.js — night city lighting
scene.background = new THREE.Color(0x080614);
scene.fog = new THREE.Fog(C.FOG_COLOR, C.FOG_NEAR, C.FOG_FAR);

// Ambient — very low, cool purple. PBR needs it or models go black
var ambient = new THREE.AmbientLight(0x1a1035, 0.7);

// Moon — soft blue-white directional from above
var moonLight = new THREE.DirectionalLight(0xaaccff, 0.4);
moonLight.position.set(-20, 50, 30);
moonLight.castShadow = true;

// Street lamp warm pools — PointLights at lamp positions
// Use a shared orange-warm color: 0xffaa44, intensity 1.5, distance 18
// Place automatically along street edges in city.js

// HEN house glow — cyan PointLight per house (see HEN Houses section)

// Fox rim light — follows fox, simulates ambient street bounce
var foxRimLight = new THREE.PointLight(0x3355ff, 0.8, 6);
// Update position each frame: foxRimLight.position.copy(foxState.position).add(up * 2)
```

---

## HUD — ui.js

```
┌─────────────────────────────────────────────────────┐
│  [ENERGY ████████░░]          [MISSION: Find HEN_2]  │
│                                                      │
│  Active power-ups: [OVERCLOCK] [SILENT_PAW]         │
└─────────────────────────────────────────────────────┘
```

- Energy bar: bottom-left, cyan fill, pulses when low
- Mission text: top-right, dim until close to target
- Power-up icons: top-left row, light up when active
- Dialogue box: bottom-centre, dark panel, monospace font
- Detection indicator: subtle screen-edge red vignette when dog is in alert/chase state

---

## Game Loop — game.js

```js
var clock = new THREE.Clock();

function gameLoop() {
  requestAnimationFrame(gameLoop);
  var dt = Math.min(clock.getDelta(), 0.05);  // cap at 50ms to prevent spiral
  
  if (gameState === 'PLAYING') {
    updateFox(dt);
    updateAllDogs(dt);
    updateCity(dt);         // HEN glow pulse, distraction timers
    updateCamera(dt);
    dialogue.update();
    ui.update(foxState);
  }
  
  renderer.render(scene, camera);
}
```

---

## Known Three.js r128 Gotchas

1. **No `CapsuleGeometry`** — use cylinder + sphere caps if needed for any debug shapes
2. **No `RoundedBoxGeometry`** — use plain `BoxGeometry`
3. **DracoLoader decoder path** — must point to the CDN decoder, not a local path, unless files are served locally
4. **WebP textures** — supported natively, no extra handling needed; GLTFLoader resolves them if embedded in GLB
5. **Shadow camera frustum** — `DirectionalLight.shadow.camera` needs manual `near/far/left/right` sizing or shadows will be clipped
6. **AnimationMixer.update(0)** must be called once after loading to set initial pose before first frame renders
7. **`transparent: true` + `depthWrite: false`** — avoid this combo on solid geometry (ground, buildings) or depth sorting artefacts appear
8. **Color.lerp between near-black values** — see SKILL note; fog/sky values must be visibly coloured (any channel < 0x18 is invisible)

---

## Build & Run

No bundler needed. Serve locally with VS Code Live Server or any static server:

```bash
# From The_SlyberFox/ directory
npx serve .
# or in VS Code: right-click index.html → Open with Live Server
```

For GitHub Pages: push to main, enable Pages from root. No build step.

---

## Art Assets

| File                          | Format        | Notes                                      |
|-------------------------------|---------------|--------------------------------------------|
| `art/cyberfox_compressed.glb` | GLB + Draco   | ~800KB, WebP textures embedded, 13 anims   |
| `art/cyberdog_compressed.glb` | GLB + Draco   | Same rig template, 13 matching anims       |

Guard dog model path: update `C.DOG_MODEL_PATH` in config.js once file is placed.

---

## Future / Deferred Features

These are scoped OUT of v1 but architecture should not block them:

- **AI-powered NPC dialogue** — swap `DIALOGUES[id]` lookup in `dialogue.js` for Anthropic API call
- **Additional fox NPCs** — use same GLB loader pattern; `npcFoxes[]` array in city.js is already wired
- **Friendly crow scout** — bark to trigger aerial patrol reveal; separate `crow.js` module
- **Dog reinforcements** — `Howl` animation already reserved; triggers second dog spawn
- **Multiple guard dog patrols** — `DogAgent` is already instanced, just push more into `dogs[]` array
- **Unlockable city zones** — HEN house `locked` flag already in data model

---

*End of handoff document. All constants are in config.js. All animation clip names are exact strings from the GLB. Good luck, SLYber Fox.*
