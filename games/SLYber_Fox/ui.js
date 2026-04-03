// ui.js — HUD, energy bar, mission prompts, power-up display, dialogue box

var uiElements = {};

function createUI() {
  var container = document.getElementById('ui-overlay');

  // --- Detection bar (bottom-left, above energy) ---
  var detectionContainer = document.createElement('div');
  detectionContainer.id = 'detection-container';
  detectionContainer.innerHTML = '<div id="detection-label">ALERT</div><div id="detection-bar-bg"><div id="detection-bar-fill"></div></div>';
  container.appendChild(detectionContainer);
  uiElements.detectionFill = document.getElementById('detection-bar-fill');
  uiElements.detectionContainer = detectionContainer;

  // Detection warning text
  var detectionWarning = document.createElement('div');
  detectionWarning.id = 'detection-warning';
  detectionWarning.textContent = 'EVADE — FIND SAFE ZONE';
  detectionWarning.style.display = 'none';
  container.appendChild(detectionWarning);
  uiElements.detectionWarning = detectionWarning;

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

  // Create power-up slots
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

  // --- Detection vignette ---
  var vignette = document.createElement('div');
  vignette.id = 'detection-vignette';
  container.appendChild(vignette);
  uiElements.vignette = vignette;

  // --- Title / start screen ---
  var titleScreen = document.createElement('div');
  titleScreen.id = 'title-screen';
  titleScreen.innerHTML = [
    '<div id="title-text">THE SLYber FOX</div>',
    '<div id="title-sub">A cyberpunk stealth adventure</div>',
    '<div id="title-start">Press ENTER or click to start</div>',
  ].join('');
  container.appendChild(titleScreen);
  uiElements.titleScreen = titleScreen;

  // --- Game over screen ---
  var gameOverScreen = document.createElement('div');
  gameOverScreen.id = 'gameover-screen';
  gameOverScreen.style.display = 'none';
  gameOverScreen.innerHTML = '<div id="gameover-text">NETWORK INFILTRATED</div><div id="gameover-sub">All HEN nodes absorbed. The SLYber Fox prevails.</div>';
  container.appendChild(gameOverScreen);
  uiElements.gameOverScreen = gameOverScreen;
}

function showDialogueBox(show) {
  uiElements.dialogueBox.style.display = show ? 'flex' : 'none';
}

function setDialogueText(speaker, text) {
  uiElements.dialogueSpeaker.textContent = speaker;
  uiElements.dialogueText.textContent = text;
}

function updateUI(state) {
  // Energy bar
  var pct = (state.energy / C.ENERGY_MAX) * 100;
  uiElements.energyFill.style.width = pct + '%';

  // Pulse when low
  if (pct < 25) {
    uiElements.energyFill.style.backgroundColor = '#ff3366';
    uiElements.energyContainer.classList.add('low-energy');
  } else {
    uiElements.energyFill.style.backgroundColor = '#00ffcc';
    uiElements.energyContainer.classList.remove('low-energy');
  }

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

  // Detection bar
  if (typeof detectionState !== 'undefined') {
    var detPct = (detectionState.level / C.DETECTION_BAR_MAX) * 100;
    uiElements.detectionFill.style.width = detPct + '%';

    // Color gradient: green -> yellow -> red
    if (detPct < 33) {
      uiElements.detectionFill.style.backgroundColor = '#44ff44';
    } else if (detPct < 66) {
      uiElements.detectionFill.style.backgroundColor = '#ffcc00';
    } else {
      uiElements.detectionFill.style.backgroundColor = '#ff3333';
    }

    // Show/hide detection bar based on level
    uiElements.detectionContainer.style.opacity = detPct > 0 ? '1' : '0.3';

    // Warning when dogs active
    uiElements.detectionWarning.style.display = detectionState.dogsActive ? 'block' : 'none';
  }

  // Detection vignette — driven by detection bar level
  var vignetteOpacity = 0;
  if (typeof detectionState !== 'undefined') {
    vignetteOpacity = (detectionState.level / C.DETECTION_BAR_MAX) * 0.5;
  }
  uiElements.vignette.style.opacity = vignetteOpacity.toString();
}

function getCurrentMission() {
  for (var i = 0; i < henHouses.length; i++) {
    if (!henHouses[i].visited && !henHouses[i].locked) {
      return henHouses[i].missionText;
    }
  }
  // All visited
  return 'All HEN nodes absorbed.';
}

function showTitleScreen(show) {
  uiElements.titleScreen.style.display = show ? 'flex' : 'none';
}

function showGameOver() {
  uiElements.gameOverScreen.style.display = 'flex';
}
