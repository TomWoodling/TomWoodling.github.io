// ═══ DEBUG LOGGER ═══
var debugEl = document.getElementById('debug-log');
var debugLines = [];

function dbg(msg, type) {
  type = type || 'ok';
  console.log('[MONSTER] ' + msg);
  debugLines.push('<span class="' + type + '">' + msg + '</span>');
  if (debugLines.length > 8) debugLines.shift();
  debugEl.innerHTML = debugLines.join('<br>');
}

dbg('Three.js loaded: r' + THREE.REVISION);
