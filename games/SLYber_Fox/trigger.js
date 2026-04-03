// trigger.js — Invisible trigger areas that fire events when the fox enters them

var triggers = [];
var triggeredSet = {};
var triggerDebugMeshes = [];

function buildTriggers(scene) {
  triggers = [];
  triggeredSet = {};

  for (var i = 0; i < LevelData.triggers.length; i++) {
    var td = LevelData.triggers[i];
    triggers.push({
      id: td.id,
      x: td.x,
      z: td.z,
      w: td.w || 6,
      d: td.d || 6,
      event: td.event,
      data: td.data,
      once: td.once !== false,
    });

    // Debug visualization
    if (C.DEBUG_TRIGGERS && scene) {
      var geo = new THREE.BoxGeometry(td.w || 6, 2, td.d || 6);
      var mat = new THREE.MeshBasicMaterial({
        color: 0xffff00, transparent: true, opacity: 0.1, wireframe: true,
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(td.x, 1, td.z);
      scene.add(mesh);
      triggerDebugMeshes.push(mesh);
    }
  }
}

function updateTriggers(foxPos) {
  for (var i = 0; i < triggers.length; i++) {
    var t = triggers[i];

    // Skip if already triggered (one-shot)
    if (t.once && triggeredSet[t.id]) continue;

    // AABB check (XZ plane)
    var hw = (t.w || 6) / 2;
    var hd = (t.d || 6) / 2;
    if (foxPos.x >= t.x - hw && foxPos.x <= t.x + hw &&
        foxPos.z >= t.z - hd && foxPos.z <= t.z + hd) {
      fireTrigger(t);
      if (t.once) triggeredSet[t.id] = true;
    }
  }
}

function fireTrigger(trigger) {
  switch (trigger.event) {
    case 'dialogue':
      if (typeof DialogueSystem !== 'undefined') {
        DialogueSystem.startConversation(trigger.data);
      }
      break;
    case 'spawnOrb':
      if (typeof scene !== 'undefined' && trigger.data) {
        var orb = new OrbAgent(trigger.data);
        scene.add(orb.model);
        orbs.push(orb);
        if (orb.type === 'green') greenSafeZones.push(orb);
      }
      break;
    case 'unlock':
      for (var i = 0; i < henHouses.length; i++) {
        if (henHouses[i].id === trigger.data) {
          henHouses[i].locked = false;
          if (henHouseObjects[i]) {
            henHouseObjects[i].glow.intensity = 2.0;
            henHouseObjects[i].ring.material.opacity = 0.5;
          }
          break;
        }
      }
      break;
    case 'custom':
      if (trigger.data && trigger.data.eventName) {
        events.emit(trigger.data.eventName, trigger.data.eventData);
      }
      break;
  }
}
