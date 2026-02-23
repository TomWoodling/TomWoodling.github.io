// ═══ DEBUG LOGGER ═══
var debugEl = document.getElementById('debug-log');
var debugLines = [];
var debugVisible = false;

debugEl.style.display = 'none';

function dbg(msg, type) {
  type = type || 'ok';
  console.log('[MONSTER] ' + msg);
  if (!debugVisible) return;
  debugLines.push('<span class="' + type + '">' + msg + '</span>');
  if (debugLines.length > 8) debugLines.shift();
  debugEl.innerHTML = debugLines.join('<br>');
}

function toggleDebug() {
  debugVisible = !debugVisible;
  debugEl.style.display = debugVisible ? 'block' : 'none';
  if (debugVisible) debugEl.innerHTML = debugLines.join('<br>');
}

// Desktop: backtick key
document.addEventListener('keydown', function(e) {
  if (e.key === '`') toggleDebug();
});

// Mobile: triple-tap in bottom-left corner (where the log lives)
var _tapCount = 0, _tapTimer = null;
document.addEventListener('touchend', function(e) {
  var t = e.changedTouches[0];
  if (t && t.clientX < 180 && t.clientY > window.innerHeight * 0.75) {
    _tapCount++;
    clearTimeout(_tapTimer);
    _tapTimer = setTimeout(function() { _tapCount = 0; }, 800);
    if (_tapCount >= 3) { _tapCount = 0; toggleDebug(); }
  }
}, { passive: true });

dbg('Three.js loaded: r' + THREE.REVISION);
