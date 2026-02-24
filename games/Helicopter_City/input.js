// input.js — Keyboard, mouse and gamepad input state
// ====================================================

var InputState = {
  fwd:  0,   // forward/back   -1 / 0 / +1
  lat:  0,   // left/right     -1 / 0 / +1
  up:   0,   // up/down        -1 / 0 / +1
  yaw:  0,   // rotate         -1 / 0 / +1
};

var _keys = {};

function initInput() {
  window.addEventListener('keydown', function(e) {
    _keys[e.code] = true;
    // Prevent page scroll on arrow/space keys
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.code) !== -1) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', function(e) {
    _keys[e.code] = false;
  });
}

function updateInput() {
  // Forward / back — W/S or ArrowUp/Down
  InputState.fwd = 0;
  if (_keys['KeyW']    || _keys['ArrowUp'])   InputState.fwd = -1;
  if (_keys['KeyS']    || _keys['ArrowDown'])  InputState.fwd =  1;

  // Lateral — A/D strafe
  InputState.lat = 0;
  if (_keys['KeyA'])  InputState.lat = -1;
  if (_keys['KeyD'])  InputState.lat =  1;

  // Yaw — Q/E or ArrowLeft/Right
  InputState.yaw = 0;
  if (_keys['KeyQ']    || _keys['ArrowLeft'])  InputState.yaw = -1;
  if (_keys['KeyE']    || _keys['ArrowRight']) InputState.yaw =  1;

  // Up / down — Space / Shift or R / F
  InputState.up = 0;
  if (_keys['Space']       || _keys['KeyR']) InputState.up =  1;
  if (_keys['ShiftLeft']   || _keys['KeyF']) InputState.up = -1;

  // ── Gamepad ─────────────────────────────────────────────────────────────
  var pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (var i = 0; i < pads.length; i++) {
    var pad = pads[i];
    if (!pad || !pad.connected) continue;

    var deadzone = 0.15;
    var lx = Math.abs(pad.axes[0]) > deadzone ? pad.axes[0] : 0;
    var ly = Math.abs(pad.axes[1]) > deadzone ? pad.axes[1] : 0;
    var rx = Math.abs(pad.axes[2]) > deadzone ? pad.axes[2] : 0;

    if (lx !== 0) InputState.lat = lx;
    if (ly !== 0) InputState.fwd = ly;
    if (rx !== 0) InputState.yaw = rx;

    // Triggers for altitude (axes 3 or buttons 6/7 depending on controller)
    var rt = pad.buttons[7] ? pad.buttons[7].value : 0;
    var lt = pad.buttons[6] ? pad.buttons[6].value : 0;
    if (rt > 0.1) InputState.up =  rt;
    if (lt > 0.1) InputState.up = -lt;

    break; // use first connected pad
  }
}
