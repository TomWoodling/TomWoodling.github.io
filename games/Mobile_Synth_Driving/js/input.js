// ═══ INPUT SYSTEM ═══
// Unified keyboard + touch input with swipe-to-steer and auto-accelerate

var InputState = {
  throttle:  false,
  braking:   false,
  steerLeft: false,
  steerRight:false,
  steerAxis: 0,          // -1..+1 continuous steer from touch
  isMobile:  false,
  touchActive: false,
};

// --- Detect touch device ---
InputState.isMobile = ('ontouchstart' in window) ||
  (navigator.maxTouchPoints > 0) ||
  window.matchMedia('(hover: none) and (pointer: coarse)').matches;

if (InputState.isMobile) {
  dbg('Mobile device detected', 'warn');
}

// ═══ KEYBOARD ═══
var keys = {};

window.addEventListener('keydown', function(e) {
  keys[e.key.toLowerCase()] = true;
  startGame();
});

window.addEventListener('keyup', function(e) {
  keys[e.key.toLowerCase()] = false;
});

// Map keyboard to InputState each frame
function pollKeyboard() {
  InputState.throttle  = !!(keys['arrowup']   || keys['w']);
  InputState.braking   = !!(keys['arrowdown'] || keys['s']);
  InputState.steerLeft = !!(keys['arrowleft'] || keys['a']);
  InputState.steerRight= !!(keys['arrowright']|| keys['d']);
}

// ═══ TOUCH — SWIPE-TO-STEER ═══
var touchState = {
  steerTouchId: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  lastMoveTime: 0,
  braking: false,
  brakeTouchId: null,
};

var steerIndicator = document.getElementById('steer-indicator');
var steerDot = document.getElementById('steer-dot');
var brakeZone = document.getElementById('brake-zone');
var touchSteerZone = document.getElementById('touch-steer-zone');

// -- Steer zone: swipe left/right --
if (touchSteerZone) {
  touchSteerZone.addEventListener('touchstart', function(e) {
    e.preventDefault();
    startGame();

    // Take first new touch for steering
    if (touchState.steerTouchId === null) {
      var t = e.changedTouches[0];
      touchState.steerTouchId = t.identifier;
      touchState.startX = t.clientX;
      touchState.startY = t.clientY;
      touchState.currentX = t.clientX;
      touchState.lastMoveTime = performance.now();
      InputState.touchActive = true;

      steerIndicator.classList.add('active');
    }
  }, { passive: false });

  touchSteerZone.addEventListener('touchmove', function(e) {
    e.preventDefault();

    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === touchState.steerTouchId) {
        touchState.currentX = t.clientX;
        touchState.lastMoveTime = performance.now();

        // Calculate steer amount from horizontal displacement
        var dx = touchState.currentX - touchState.startX;
        var screenW = window.innerWidth;

        // Normalize: full screen swipe = full steer
        // With deadzone
        if (Math.abs(dx) < C.swipeDeadzone) {
          InputState.steerAxis = 0;
        } else {
          var effective = dx - Math.sign(dx) * C.swipeDeadzone;
          // Sensitivity: ~30% of screen width = full steer
          var maxSwipePx = screenW * 0.3;
          InputState.steerAxis = THREE.MathUtils.clamp(effective / maxSwipePx, -1, 1);
        }

        // Update visual indicator
        updateSteerIndicator(InputState.steerAxis);

        // Re-center the origin slowly so sustained swipes don't max out
        // "Rubber band" the start point toward current
        touchState.startX = THREE.MathUtils.lerp(touchState.startX, touchState.currentX, 0.008);
      }
    }
  }, { passive: false });

  touchSteerZone.addEventListener('touchend', handleSteerEnd, { passive: false });
  touchSteerZone.addEventListener('touchcancel', handleSteerEnd, { passive: false });
}

function handleSteerEnd(e) {
  for (var i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === touchState.steerTouchId) {
      touchState.steerTouchId = null;
      InputState.steerAxis = 0;
      InputState.touchActive = false;

      steerIndicator.classList.remove('active');
      updateSteerIndicator(0);
    }
  }
}

function updateSteerIndicator(axis) {
  if (!steerDot) return;
  // Map -1..+1 to 10%..90% of indicator
  var pct = 50 + axis * 40;
  steerDot.style.left = pct + '%';
}

// -- Brake zone: touch-and-hold --
if (brakeZone) {
  brakeZone.addEventListener('touchstart', function(e) {
    e.preventDefault();
    e.stopPropagation();
    startGame();
    touchState.braking = true;
    touchState.brakeTouchId = e.changedTouches[0].identifier;
    brakeZone.classList.add('active');
  }, { passive: false });

  brakeZone.addEventListener('touchend', handleBrakeEnd, { passive: false });
  brakeZone.addEventListener('touchcancel', handleBrakeEnd, { passive: false });
}

function handleBrakeEnd(e) {
  for (var i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === touchState.brakeTouchId) {
      touchState.braking = false;
      touchState.brakeTouchId = null;
      brakeZone.classList.remove('active');
    }
  }
}

// -- Pointer/touch start for game start --
window.addEventListener('pointerdown', function(e) {
  startGame();
});
// Direct touch on title overlay (z-index 100 blocks touches to layers beneath)
document.getElementById('title-overlay').addEventListener('touchstart', function(e) {
  e.preventDefault();
  startGame();
}, { passive: false });

// ═══ UNIFIED POLL ═══
// Called every frame to merge keyboard + touch into a single InputState
function pollInput() {
  pollKeyboard();

  // On mobile: auto-accelerate unless braking
  if (InputState.isMobile || InputState.touchActive) {
    // Touch overrides keyboard steer when active
    if (InputState.touchActive) {
      InputState.steerLeft = false;
      InputState.steerRight = false;
      // steerAxis is already set by touch handlers
    }

    // Auto-accelerate on mobile
    if (gameStarted) {
      InputState.throttle = !touchState.braking;
      InputState.braking = touchState.braking;
    }
  } else {
    // Desktop: steerAxis derived from keys
    if (InputState.steerLeft && !InputState.steerRight) {
      InputState.steerAxis = -1;
    } else if (InputState.steerRight && !InputState.steerLeft) {
      InputState.steerAxis = 1;
    } else {
      InputState.steerAxis = 0;
    }
  }
}

// ═══ PREVENT BROWSER GESTURES ═══
// Block pull-to-refresh, pinch-zoom, double-tap zoom on mobile
document.addEventListener('touchmove', function(e) {
  if (e.target.closest('#vol-slider')) return; // allow slider
  e.preventDefault();
}, { passive: false });

document.addEventListener('gesturestart', function(e) { e.preventDefault(); }, { passive: false });
document.addEventListener('gesturechange', function(e) { e.preventDefault(); }, { passive: false });
document.addEventListener('gestureend', function(e) { e.preventDefault(); }, { passive: false });

// Prevent double-tap zoom
var lastTap = 0;
document.addEventListener('touchend', function(e) {
  var now = Date.now();
  if (now - lastTap < 300) e.preventDefault();
  lastTap = now;
}, { passive: false });
