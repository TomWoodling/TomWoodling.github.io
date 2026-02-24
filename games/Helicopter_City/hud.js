// hud.js — Canvas overlay: minimap, mission info, altitude, speed, score
// =======================================================================

var _hudCanvas = null;
var _hudCtx    = null;
var _alertQueue = [];

function initHud() {
  _hudCanvas = document.getElementById('hud');
  _hudCtx    = _hudCanvas.getContext('2d');
  _resizeHud();
  window.addEventListener('resize', _resizeHud);

  // Expose alert function globally for other modules
  window.hudShowAlert = hudShowAlert;
}

function _resizeHud() {
  _hudCanvas.width  = window.innerWidth;
  _hudCanvas.height = window.innerHeight;
}

function hudShowAlert(text, color) {
  _alertQueue.push({ text: text, color: color || '#00ffcc', ttl: 3.5 });
}

function updateHud(dt, heliPos, heliVel) {
  if (!_hudCtx) return;
  var W = _hudCanvas.width;
  var H = _hudCanvas.height;
  _hudCtx.clearRect(0, 0, W, H);

  // ── Alerts ────────────────────────────────────────────────────────────────
  for (var i = _alertQueue.length - 1; i >= 0; i--) {
    _alertQueue[i].ttl -= dt;
    if (_alertQueue[i].ttl <= 0) _alertQueue.splice(i, 1);
  }
  for (var j = 0; j < _alertQueue.length; j++) {
    var a = _alertQueue[j];
    var alpha = Math.min(1, a.ttl);
    _hudCtx.save();
    _hudCtx.globalAlpha = alpha;
    _hudCtx.font = 'bold 18px monospace';
    _hudCtx.fillStyle = a.color;
    _hudCtx.textAlign = 'center';
    _hudCtx.fillText(a.text, W / 2, H * 0.18 + j * 28);
    _hudCtx.restore();
  }

  // ── Mission panel ─────────────────────────────────────────────────────────
  var m = missionState.active || missionState.pending;
  if (m) {
    var isActive  = !!missionState.active;
    var panelW    = 280, panelH = isActive && m.timed ? 68 : 52;
    var px        = 20, py = H - panelH - 20;

    _hudCtx.save();
    _hudCtx.globalAlpha = 0.82;
    _hudCtx.fillStyle   = '#0a001a';
    _roundRect(px, py, panelW, panelH, 6);
    _hudCtx.fill();

    _hudCtx.strokeStyle = isActive ? '#00ffcc' : '#ff8800';
    _hudCtx.lineWidth   = 1.5;
    _roundRect(px, py, panelW, panelH, 6);
    _hudCtx.stroke();

    _hudCtx.font      = 'bold 14px monospace';
    _hudCtx.fillStyle = isActive ? '#00ffcc' : '#ff8800';
    _hudCtx.textAlign = 'left';
    _hudCtx.fillText(isActive ? '● ACTIVE' : '● INCOMING', px + 12, py + 18);

    _hudCtx.font      = '13px monospace';
    _hudCtx.fillStyle = '#ffffff';
    _hudCtx.fillText(m.label, px + 12, py + 35);

    if (isActive && m.timed) {
      var tPct = m.timeLeft / C.POLICE_MISSION_TIERS[m.tier].time;
      _hudCtx.fillStyle = tPct > 0.4 ? '#00ffcc' : '#ff3300';
      _hudCtx.fillText('⏱ ' + Math.ceil(m.timeLeft) + 's', px + 12, py + 55);
    } else if (!isActive) {
      _hudCtx.font      = '11px monospace';
      _hudCtx.fillStyle = '#888888';
      _hudCtx.fillText('[M] to accept', px + 12, py + 52);
    }
    _hudCtx.restore();
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  _hudCtx.save();
  _hudCtx.font      = 'bold 15px monospace';
  _hudCtx.fillStyle = '#ffcc00';
  _hudCtx.textAlign = 'left';
  _hudCtx.fillText('SCORE  ' + missionState.score, 20, 30);
  _hudCtx.restore();

  // ── Telemetry (top right) ─────────────────────────────────────────────────
  var speed = Math.sqrt(heliVel.x * heliVel.x + heliVel.z * heliVel.z);
  _hudCtx.save();
  _hudCtx.font      = '13px monospace';
  _hudCtx.fillStyle = '#aaccff';
  _hudCtx.textAlign = 'right';
  _hudCtx.fillText('ALT  ' + heliPos.y.toFixed(0) + 'm',     W - 20, 30);
  _hudCtx.fillText('SPD  ' + (speed * 3.6).toFixed(0) + 'kph', W - 20, 50);

  // Landing status
  if (heliState.landed) {
    _hudCtx.fillStyle = '#00ffcc';
    _hudCtx.fillText('▼ LANDED', W - 20, 72);
  }
  _hudCtx.restore();

  // ── Minimap ────────────────────────────────────────────────────────────────
  _drawMinimap(W, H, heliPos);

  // ── Controls hint (fades after 8s) ────────────────────────────────────────
  if (typeof _gameTime !== 'undefined' && _gameTime < 8) {
    var fade = Math.min(1, 8 - _gameTime);
    _hudCtx.save();
    _hudCtx.globalAlpha = fade * 0.7;
    _hudCtx.font        = '12px monospace';
    _hudCtx.fillStyle   = '#aaaaaa';
    _hudCtx.textAlign   = 'center';
    _hudCtx.fillText('W/S — forward/back  |  A/D — strafe  |  Q/E — rotate  |  Space — up  |  Shift — down  |  M — accept mission', W/2, H - 20);
    _hudCtx.restore();
  }
}

// ─── Minimap ──────────────────────────────────────────────────────────────────

function _drawMinimap(W, H, heliPos) {
  var mSize  = 130;
  var mPad   = 14;
  var mx     = W - mSize - mPad;
  var my     = H - mSize - mPad;
  var scale  = mSize / (C.CITY_HALF * 2);

  _hudCtx.save();
  _hudCtx.globalAlpha = 0.78;

  // Background
  _hudCtx.fillStyle = '#06000e';
  _hudCtx.beginPath();
  _hudCtx.rect(mx, my, mSize, mSize);
  _hudCtx.fill();
  _hudCtx.strokeStyle = '#440066';
  _hudCtx.lineWidth   = 1;
  _hudCtx.stroke();

  // Buildings (simplified dots)
  _hudCtx.fillStyle = '#331155';
  for (var i = 0; i < cityData.buildings.length; i++) {
    var b  = cityData.buildings[i];
    var bx = mx + (b.x + C.CITY_HALF) * scale;
    var bz = my + (b.z + C.CITY_HALF) * scale;
    var bw = Math.max(1, b.w * scale * 0.5);
    _hudCtx.fillRect(bx - bw/2, bz - bw/2, bw, bw);
  }

  // Helipads
  _hudCtx.fillStyle = '#00ffcc';
  for (var j = 0; j < cityData.helipads.length; j++) {
    var hp = cityData.helipads[j];
    var hx = mx + (hp.x + C.CITY_HALF) * scale;
    var hz = my + (hp.z + C.CITY_HALF) * scale;
    _hudCtx.beginPath();
    _hudCtx.arc(hx, hz, 2, 0, Math.PI * 2);
    _hudCtx.fill();
  }

  // Mission marker
  var m = missionState.active || missionState.pending;
  if (m) {
    var mmx = mx + (m.targetX + C.CITY_HALF) * scale;
    var mmz = my + (m.targetZ + C.CITY_HALF) * scale;
    _hudCtx.strokeStyle = '#ff4400';
    _hudCtx.lineWidth   = 1.5;
    _hudCtx.beginPath();
    _hudCtx.arc(mmx, mmz, 4, 0, Math.PI * 2);
    _hudCtx.stroke();
  }

  // Player dot
  var px = mx + (heliPos.x + C.CITY_HALF) * scale;
  var pz = my + (heliPos.z + C.CITY_HALF) * scale;
  _hudCtx.fillStyle = '#ffffff';
  _hudCtx.beginPath();
  _hudCtx.arc(px, pz, 3, 0, Math.PI * 2);
  _hudCtx.fill();

  _hudCtx.restore();
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function _roundRect(x, y, w, h, r) {
  _hudCtx.beginPath();
  _hudCtx.moveTo(x + r, y);
  _hudCtx.lineTo(x + w - r, y);
  _hudCtx.arcTo(x + w, y, x + w, y + r, r);
  _hudCtx.lineTo(x + w, y + h - r);
  _hudCtx.arcTo(x + w, y + h, x + w - r, y + h, r);
  _hudCtx.lineTo(x + r, y + h);
  _hudCtx.arcTo(x, y + h, x, y + h - r, r);
  _hudCtx.lineTo(x, y + r);
  _hudCtx.arcTo(x, y, x + r, y, r);
  _hudCtx.closePath();
}
