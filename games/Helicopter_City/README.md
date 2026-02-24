# Helicopter City

A synthwave neon helicopter exploration game built in vanilla Three.js.

## File Structure

```
Helicopter_City/
├── index.html          — Entry point
├── config.js           — All constants, palettes, mission types
├── shaders.js          — GLSL shaders + material factories
├── city.js             — Procedural city grid, buildings, helipads
├── traffic.js          — Street car agents, gridlock events
├── helicopter.js       — GLB loader, rotor FX, hover physics
├── missions.js         — Mission scheduler, completion logic
├── hud.js              — Canvas overlay, minimap, alerts
├── input.js            — Keyboard + gamepad
├── game.js             — Scene, lights, main loop, camera
├── models/
│   ├── heli_news.glb   ← drop your news helicopter here
│   └── heli_police.glb ← drop your police helicopter here
└── audio/
    ├── track1.mp3      ← synthwave track 1
    └── track2.mp3      ← synthwave track 2
```

## Controls

| Key | Action |
|-----|--------|
| W / S | Forward / back |
| A / D | Strafe left / right |
| Q / E (or ← →) | Rotate / yaw |
| Space / R | Ascend |
| Shift / F | Descend |
| M | Accept incoming mission |
| P | Cycle city palette (debug) |

Gamepad supported: left stick = move, right stick X = yaw, triggers = up/down.

## Adding your helicopter models

Drop `heli_news.glb` and `heli_police.glb` into the `models/` folder.

To enable GLB loading, replace the stub in `index.html` with the real GLTFLoader:

```html
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
```

The game auto-scales the loaded model and repositions the rotor disc to sit
on top of it. If the rotor looks off, tweak `ROTOR_RADIUS` and the offset
in the GLB load callback inside `helicopter.js`.

## Palettes

Three colour palettes are defined in `config.js` — press P to cycle them live.
Add new palettes by appending to the `PALETTES` array (follow the schema comments
— no colour channel below 0x18 or lerp goes black).

## Missions

Mission types are defined in `MISSION_TYPES` in `config.js`. News missions are
free-roam: fly to the beacon. Police missions are timed — difficulty scales by
tier (Misdemeanour / Felony / Emergency).

## Next features (planned)
- AI patrol helicopters (ai_helis.js)
- Police skin switcher
- Radio chatter audio events
- Building interior lights (window glow texture)
- Pursuit cars that deviate from grid
