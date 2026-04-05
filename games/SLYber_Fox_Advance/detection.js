// detection.js — Detection bar: fills from orb detection, drains when safe, spawns dogs at max

var detectionState = {
  level: 0,
  dogsActive: false,
  dogCooldownTimer: 0,
};

function updateDetection(dt, orbDetectionRate) {
  // In safe zone: clear detection, countdown dog despawn
  if (foxInSafeZone) {
    detectionState.level = Math.max(0, detectionState.level - C.DETECTION_BAR_DECAY * 3 * dt);

    if (detectionState.dogsActive) {
      detectionState.dogCooldownTimer -= dt;
      if (detectionState.dogCooldownTimer <= 0) {
        detectionState.dogsActive = false;
        detectionState.level = 0;
        events.emit('dogsDespawn');
      }
    }
    return;
  }

  // Not in safe zone
  if (orbDetectionRate > 0) {
    detectionState.level += orbDetectionRate * dt;
  } else {
    detectionState.level -= C.DETECTION_BAR_DECAY * dt;
  }

  // Clamp
  detectionState.level = Math.max(0, Math.min(C.DETECTION_BAR_MAX, detectionState.level));

  // Trigger dogs when bar fills
  if (detectionState.level >= C.DETECTION_BAR_MAX && !detectionState.dogsActive) {
    detectionState.dogsActive = true;
    detectionState.dogCooldownTimer = C.DETECTION_DOG_SPAWN_COOLDOWN;
    events.emit('dogsSpawn');
  }
}

function resetDetection() {
  detectionState.level = 0;
  detectionState.dogsActive = false;
  detectionState.dogCooldownTimer = 0;
}
