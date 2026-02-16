// ═══ INPUT SYSTEM ═══
var InputState = {
  throttle:   false,
  braking:    false,
  steerLeft:  false,
  steerRight: false,
  steerAxis:  0,
  isMobile:   false,
  touchActive:false,
};

InputState.isMobile = ('ontouchstart' in window) ||
  (navigator.maxTouchPoints > 0) ||
  window.matchMedia('(hover: none) and (pointer: coarse)').matches;

if (InputState.isMobile) dbg('Mobile detected', 'warn');

var keys = {};
window.addEventListener('keydown', function(e) { keys[e.key.toLowerCase()] = true;  startGame(); });
window.addEventListener('keyup',   function(e) { keys[e.key.toLowerCase()] = false; });

function pollKeyboard() {
  InputState.throttle   = !!(keys['arrowup']    || keys['w']);
  InputState.braking    = !!(keys['arrowdown']  || keys['s']);
  InputState.steerLeft  = !!(keys['arrowleft']  || keys['a']);
  InputState.steerRight = !!(keys['arrowright'] || keys['d']);
}

var touchState = {
  steerTouchId: null, startX: 0, startY: 0,
  currentX: 0, lastMoveTime: 0, braking: false, brakeTouchId: null,
};

var steerIndicator  = document.getElementById('steer-indicator');
var steerDot        = document.getElementById('steer-dot');
var brakeZone       = document.getElementById('brake-zone');
var touchSteerZone  = document.getElementById('touch-steer-zone');

if (touchSteerZone) {
  touchSteerZone.addEventListener('touchstart', function(e) {
    e.preventDefault();
    startGame();
    if (touchState.steerTouchId === null) {
      var t = e.changedTouches[0];
      touchState.steerTouchId = t.identifier;
      touchState.startX = t.clientX;
      touchState.currentX = t.clientX;
      touchState.lastMoveTime = performance.now();
      InputState.touchActive = true;
      if (steerIndicator) steerIndicator.classList.add('active');
    }
  }, { passive: false });

  touchSteerZone.addEventListener('touchmove', function(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === touchState.steerTouchId) {
        touchState.currentX = t.clientX;
        var dx = touchState.currentX - touchState.startX;
        var maxSwipePx = window.innerWidth * 0.3;
        if (Math.abs(dx) < C.swipeDeadzone) InputState.steerAxis = 0;
        else {
          var eff = dx - Math.sign(dx) * C.swipeDeadzone;
          InputState.steerAxis = THREE.MathUtils.clamp(eff / maxSwipePx, -1, 1);
        }
        updateSteerIndicator(InputState.steerAxis);
        touchState.startX = THREE.MathUtils.lerp(touchState.startX, touchState.currentX, 0.008);
      }
    }
  }, { passive: false });

  touchSteerZone.addEventListener('touchend',    handleSteerEnd, { passive: false });
  touchSteerZone.addEventListener('touchcancel', handleSteerEnd, { passive: false });
}

function handleSteerEnd(e) {
  for (var i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === touchState.steerTouchId) {
      touchState.steerTouchId = null;
      InputState.steerAxis = 0;
      InputState.touchActive = false;
      if (steerIndicator) steerIndicator.classList.remove('active');
      updateSteerIndicator(0);
    }
  }
}

function updateSteerIndicator(axis) {
  if (!steerDot) return;
  steerDot.style.left = (50 + axis * 40) + '%';
}

if (brakeZone) {
  brakeZone.addEventListener('touchstart', function(e) {
    e.preventDefault(); e.stopPropagation();
    startGame();
    touchState.braking = true;
    touchState.brakeTouchId = e.changedTouches[0].identifier;
    brakeZone.classList.add('active');
  }, { passive: false });
  brakeZone.addEventListener('touchend',    handleBrakeEnd, { passive: false });
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

window.addEventListener('pointerdown', function() { startGame(); });
document.getElementById('title-overlay').addEventListener('touchstart', function(e) {
  e.preventDefault(); startGame();
}, { passive: false });

function pollInput() {
  pollKeyboard();
  if (InputState.isMobile || InputState.touchActive) {
    if (InputState.touchActive) { InputState.steerLeft = false; InputState.steerRight = false; }
    if (gameStarted) {
      InputState.throttle = !touchState.braking;
      InputState.braking  = touchState.braking;
    }
  } else {
    if (InputState.steerLeft  && !InputState.steerRight) InputState.steerAxis = -1;
    else if (InputState.steerRight && !InputState.steerLeft) InputState.steerAxis =  1;
    else InputState.steerAxis = 0;
  }
}

document.addEventListener('touchmove', function(e) {
  if (e.target.closest('#vol-slider') || e.target.closest('#vol-slider-mobile')) return;
  e.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', function(e) { e.preventDefault(); }, { passive: false });
var lastTap = 0;
document.addEventListener('touchend', function(e) {
  var now = Date.now();
  if (now - lastTap < 300) e.preventDefault();
  lastTap = now;
}, { passive: false });
