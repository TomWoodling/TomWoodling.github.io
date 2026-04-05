// ui.js — HUD, energy bar, hen counter, district name, mission prompts, power-up display, dialogue box

var uiElements = {};

function createUI() {
  var container = document.getElementById('ui-overlay');

  // --- District name (top-center) ---
  var districtName = document.createElement('div');
  districtName.id = 'district-name';
  districtName.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);font-size:12px;letter-spacing:4px;color:#556677;text-align:center;';
  container.appendChild(districtName);
  uiElements.districtName = districtName;

  // --- Hen counter (bottom-left, above energy) ---
  var henContainer = document.createElement('div');
  henContainer.id = 'hen-counter-container';
  henContainer.innerHTML = '<div id="hen-counter-label">HENS</div><div id="hen-counter-text">0 / 0</div>';
  container.appendChild(henContainer);
  uiElements.henCounterText = document.getElementById('hen-counter-text');
  uiElements.henCounterContainer = henContainer;

  // --- Energy bar (bottom-left) ---
  var energyContainer = document.createElement('div');
  energyContainer.id = 'energy-container';
  energyContainer.innerHTML = '<div id="energy-label">ENERGY</div><div id="energy-bar-bg"><div id="energy-bar-fill"></div></div>';
  container.appendChild(energyContainer);
  uiElements.energyFill = document.getElementById('energy-bar-fill');
  uiElements.energyContainer = energyContainer;

  // --- Mission text (top-right) ---
  var missionBox = document.createElement('div');
  missionBox.id = 'mission-box';
  missionBox.innerHTML = '<div id="mission-label">MISSION</div><div id="mission-text"></div>';
  container.appendChild(missionBox);
  uiElements.missionText = document.getElementById('mission-text');
  uiElements.missionBox = missionBox;

  // --- Power-up icons (top-left) ---
  var powerupBar = document.createElement('div');
  powerupBar.id = 'powerup-bar';
  container.appendChild(powerupBar);
  uiElements.powerupBar = powerupBar;

  for (var i = 0; i < C.POWERUPS.length; i++) {
    var slot = document.createElement('div');
    slot.className = 'powerup-slot inactive';
    slot.id = 'powerup-' + C.POWERUPS[i].id;
    slot.textContent = C.POWERUPS[i].name;
    slot.title = C.POWERUPS[i].desc;
    powerupBar.appendChild(slot);
  }

  // --- Dialogue box (bottom-center) ---
  var dialogueBox = document.createElement('div');
  dialogueBox.id = 'dialogue-box';
  dialogueBox.style.display = 'none';
  dialogueBox.innerHTML = '<div id="dialogue-speaker"></div><div id="dialogue-text"></div><div id="dialogue-hint">[E] continue</div>';
  container.appendChild(dialogueBox);
  uiElements.dialogueBox = dialogueBox;
  uiElements.dialogueSpeaker = document.getElementById('dialogue-speaker');
  uiElements.dialogueText = document.getElementById('dialogue-text');

  // --- Danger vignette (rooster zone warning) ---
  var vignette = document.createElement('div');
  vignette.id = 'detection-vignette';
  container.appendChild(vignette);
  uiElements.vignette = vignette;

  // --- Push warning text ---
  var pushWarning = document.createElement('div');
  pushWarning.id = 'detection-warning';
  pushWarning.textContent = 'PUSHED OUT!';
  pushWarning.style.display = 'none';
  container.appendChild(pushWarning);
  uiElements.pushWarning = pushWarning;

  // --- Hen collect flash ---
  var henFlash = document.createElement('div');
  henFlash.id = 'hen-flash';
  henFlash.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px;font-weight:bold;letter-spacing:4px;color:#ffcc00;text-shadow:0 0 20px rgba(255,204,0,0.8);display:none;pointer-events:none;z-index:25;';
  container.appendChild(henFlash);
  uiElements.henFlash = henFlash;

  // --- Title / start screen ---
  var titleScreen = document.createElement('div');
  titleScreen.id = 'title-screen';
  titleScreen.innerHTML = [
    '<div id="title-text">THE SLYber FOX</div>',
    '<div id="title-sub">The Hen Heist</div>',
    '<div id="title-start">Press ENTER or click to start</div>',
  ].join('');
  container.appendChild(titleScreen);
  uiElements.titleScreen = titleScreen;

  // --- District complete screen ---
  var districtCompleteScreen = document.createElement('div');
  districtCompleteScreen.id = 'district-complete-screen';
  districtCompleteScreen.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,15,10,0.8);z-index:20;';
  districtCompleteScreen.innerHTML = [
    '<div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#00ffcc;text-shadow:0 0 30px rgba(0,255,204,0.5);margin-bottom:12px;" id="dc-title">DISTRICT COMPLETE</div>',
    '<div style="font-size:16px;color:#88bbaa;letter-spacing:3px;margin-bottom:40px;" id="dc-name"></div>',
    '<div style="font-size:14px;letter-spacing:3px;color:#88aacc;animation:blink 1.5s infinite;">Press ENTER or click to continue</div>',
  ].join('');
  container.appendChild(districtCompleteScreen);
  uiElements.districtCompleteScreen = districtCompleteScreen;
  uiElements.dcName = document.getElementById('dc-name');

  // --- Game over screen ---
  var gameOverScreen = document.createElement('div');
  gameOverScreen.id = 'gameover-screen';
  gameOverScreen.style.display = 'none';
  gameOverScreen.innerHTML = '<div id="gameover-text">HRN NETWORK INFILTRATED</div><div id="gameover-sub">All districts cleared. Every hen freed. The SLYber Fox prevails.</div>';
  container.appendChild(gameOverScreen);
  uiElements.gameOverScreen = gameOverScreen;

  // Listen for hen collection to flash UI
  events.on('henCollected', function(data) {
    showHenFlash(data.total);
  });

  // Listen for push events
  events.on('foxPushed', function() {
    showPushWarning();
  });
}

function showHenFlash(total) {
  var el = uiElements.henFlash;
  var max = typeof getTotalHens === 'function' ? getTotalHens() : '?';
  el.textContent = 'HEN COLLECTED! ' + total + ' / ' + max;
  el.style.display = 'block';
  el.style.opacity = '1';
  setTimeout(function() {
    el.style.transition = 'opacity 1s';
    el.style.opacity = '0';
    setTimeout(function() {
      el.style.display = 'none';
      el.style.transition = '';
    }, 1000);
  }, 1500);
}

function showPushWarning() {
  var el = uiElements.pushWarning;
  el.style.display = 'block';
  setTimeout(function() {
    el.style.display = 'none';
  }, 1500);
}

function showDialogueBox(show) {
  uiElements.dialogueBox.style.display = show ? 'flex' : 'none';
}

function setDialogueText(speaker, text) {
  uiElements.dialogueSpeaker.textContent = speaker;
  uiElements.dialogueText.textContent = text;
}

function showDistrictComplete(districtName) {
  uiElements.dcName.textContent = districtName + ' cleared!';
  uiElements.districtCompleteScreen.style.display = 'flex';
}

function hideDistrictComplete() {
  uiElements.districtCompleteScreen.style.display = 'none';
}

function updateUI(state) {
  // District name
  if (typeof WorldGen !== 'undefined') {
    var d = WorldGen.getCurrentDistrict();
    if (d) {
      uiElements.districtName.textContent = d.name.toUpperCase();
    }
  }

  // Energy bar
  var pct = (state.energy / C.ENERGY_MAX) * 100;
  uiElements.energyFill.style.width = pct + '%';

  if (pct < 25) {
    uiElements.energyFill.style.backgroundColor = '#ff3366';
    uiElements.energyContainer.classList.add('low-energy');
  } else {
    uiElements.energyFill.style.backgroundColor = '#00ffcc';
    uiElements.energyContainer.classList.remove('low-energy');
  }

  // Hen counter
  var collected = typeof getCollectedHens === 'function' ? getCollectedHens() : 0;
  var total = typeof getTotalHens === 'function' ? getTotalHens() : 0;
  uiElements.henCounterText.textContent = collected + ' / ' + total;

  // Mission text
  var currentMission = getCurrentMission();
  if (currentMission) {
    uiElements.missionText.textContent = currentMission;
  }

  // Power-ups
  for (var i = 0; i < C.POWERUPS.length; i++) {
    var slot = document.getElementById('powerup-' + C.POWERUPS[i].id);
    if (slot) {
      var active = state.powerups.indexOf(C.POWERUPS[i].id) !== -1;
      slot.className = 'powerup-slot' + (active ? ' active' : ' inactive');
    }
  }

  // Danger vignette
  var vignetteOpacity = 0;
  if (state.nearDanger) vignetteOpacity = 0.25;
  if (typeof foxPush !== 'undefined' && foxPush.active) vignetteOpacity = 0.6;
  uiElements.vignette.style.opacity = vignetteOpacity.toString();
}

function getCurrentMission() {
  var collected = typeof getCollectedHens === 'function' ? getCollectedHens() : 0;
  var total = typeof getTotalHens === 'function' ? getTotalHens() : 0;

  for (var i = 0; i < henHouses.length; i++) {
    if (!henHouses[i].visited && !henHouses[i].locked) {
      return henHouses[i].missionText;
    }
  }

  if (collected < total) {
    return 'Collect golden hens. ' + collected + '/' + total + ' found.';
  }

  return 'All hens collected! Find the HRN node!';
}

function showTitleScreen(show) {
  uiElements.titleScreen.style.display = show ? 'flex' : 'none';
}

function showGameOver() {
  uiElements.gameOverScreen.style.display = 'flex';
}
