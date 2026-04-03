// dialogue.js — Scripted NPC bark/conversation system

var DIALOGUES = {
  'npc_fox_1': [
    { speaker: 'RUSTY',  text: 'Stay low near the depot — that big dog\'s got wide eyes.' },
    { speaker: 'PLAYER', text: '...' },
    { speaker: 'RUSTY',  text: 'There\'s a loose panel round back. Makes a good noise.' },
  ],
  'npc_fox_2': [
    { speaker: 'VIXEN',  text: 'The HEN nodes pulse brighter when they\'re unlocked.' },
    { speaker: 'PLAYER', text: '...' },
    { speaker: 'VIXEN',  text: 'Absorb their power. You\'ll feel the difference.' },
  ],
  'hen_1_approach': [
    { speaker: 'SYSTEM', text: 'HEN NODE DETECTED. Absorb energy to OVERCLOCK sprint.' },
  ],
  'hen_2_approach': [
    { speaker: 'SYSTEM', text: 'HEN NODE DETECTED. Absorb energy for SILENT_PAW stealth.' },
  ],
  'hen_3_approach': [
    { speaker: 'SYSTEM', text: 'HEN NODE DETECTED. Absorb energy for PULSE_BARK range.' },
  ],
  'hen_4_approach': [
    { speaker: 'SYSTEM', text: 'CENTRAL HEN MAINFRAME. Final node. Absorb to complete infiltration.' },
  ],
  'game_start': [
    { speaker: 'SYSTEM', text: 'SLYber Fox online. Find the HEN Houses. Avoid the security orbs.' },
    { speaker: 'SYSTEM', text: 'Red orbs patrol. Blue orbs watch areas. Yellow orbs pulse on and off.' },
    { speaker: 'SYSTEM', text: 'Green orbs are safe zones — hide there when detected!' },
    { speaker: 'SYSTEM', text: 'WASD to move. SHIFT to sprint. SPACE to jump. E to bark/interact.' },
  ],
};

var DialogueSystem = {
  active: false,
  queue: [],
  current: null,

  startConversation: function(id) {
    this.queue = DIALOGUES[id] ? DIALOGUES[id].slice() : [];
    if (this.queue.length === 0) return;
    this.active = true;
    this.advance();
    showDialogueBox(true);
  },

  advance: function() {
    if (this.queue.length === 0) {
      this.active = false;
      this.current = null;
      showDialogueBox(false);
      return;
    }
    this.current = this.queue.shift();
    setDialogueText(this.current.speaker, this.current.text);
  },

  update: function() {
    // Auto-advance SYSTEM messages after a delay
    // Player messages advance on E press (handled in fox.js)
  },
};
