// dialogue.js — Scripted NPC bark/conversation system

var DIALOGUES = {
  // --- Dog NPC district briefings ---
  'district_1_briefing': [
    { speaker: 'SCOUT',  text: 'Hey, new fox on the block! Name\'s Scout.' },
    { speaker: 'SCOUT',  text: 'See that maze? The roosters locked down the backyard.' },
    { speaker: 'SCOUT',  text: 'Golden hens are trapped in there. Get \'em out.' },
    { speaker: 'SCOUT',  text: 'Watch the red zones — roosters\'ll push you out if they spot you.' },
    { speaker: 'SCOUT',  text: 'Sneak past \'em. You\'re a fox, not a bull.' },
    { speaker: 'SYSTEM', text: 'WASD to move. SHIFT to sprint. SPACE to jump. E to bark/interact.' },
  ],
  'district_1_complete': [
    { speaker: 'SCOUT',  text: 'Nice work! Knew you had it in you.' },
    { speaker: 'SCOUT',  text: 'That OVERCLOCK power will come in handy.' },
    { speaker: 'SCOUT',  text: 'The warehouse district is next. Bigger maze, more roosters.' },
    { speaker: 'SCOUT',  text: 'But I\'ve heard there are weak points in the fences...' },
    { speaker: 'SCOUT',  text: 'Collect enough hens and new paths might open up.' },
  ],
  'district_2_briefing': [
    { speaker: 'SCOUT',  text: 'The warehouse. This is where it gets serious.' },
    { speaker: 'SCOUT',  text: 'More roosters, bigger territory. But you\'ve got OVERCLOCK now.' },
    { speaker: 'SCOUT',  text: 'Look for the red barriers in the fences — SNEAK POINTS.' },
    { speaker: 'SCOUT',  text: 'Collect enough hens and those barriers dissolve. New paths!' },
    { speaker: 'SCOUT',  text: 'Good luck in there, fox.' },
  ],
  'district_2_complete': [
    { speaker: 'SCOUT',  text: 'SILENT_PAW. Now we\'re talking.' },
    { speaker: 'SCOUT',  text: 'Roosters won\'t hear you as easily with that.' },
    { speaker: 'SCOUT',  text: 'The factory is next. I don\'t like the look of it.' },
    { speaker: 'SCOUT',  text: 'I\'ve spotted purple pillars in there — HOWL POINTS.' },
    { speaker: 'SCOUT',  text: 'Stand on one and howl. It\'ll spook a rooster away.' },
  ],
  'district_3_briefing': [
    { speaker: 'SCOUT',  text: 'The factory. Dense, dangerous, lots of metal.' },
    { speaker: 'SCOUT',  text: 'You\'ll need everything — sneaking, howling, sprinting.' },
    { speaker: 'SCOUT',  text: 'The hens in here are well-hidden. Deep dead ends.' },
    { speaker: 'SCOUT',  text: 'Use the HOWL POINTS to clear rooster patrols.' },
    { speaker: 'SCOUT',  text: 'And the SNEAK POINTS to access the restricted zones.' },
    { speaker: 'SCOUT',  text: 'I believe in you. Go get \'em.' },
  ],
  'district_3_complete': [
    { speaker: 'SCOUT',  text: 'PULSE_BARK! Your howl now reaches twice as far.' },
    { speaker: 'SCOUT',  text: 'One more district. The comm tower.' },
    { speaker: 'SCOUT',  text: 'This is the big one. The central hub.' },
    { speaker: 'SCOUT',  text: 'Free those hens and we shut down the whole operation.' },
  ],
  'district_4_briefing': [
    { speaker: 'SCOUT',  text: 'The comm tower. Final mission.' },
    { speaker: 'SCOUT',  text: 'Biggest maze yet. Roosters everywhere.' },
    { speaker: 'SCOUT',  text: 'But you\'ve got OVERCLOCK, SILENT_PAW, and PULSE_BARK.' },
    { speaker: 'SCOUT',  text: 'Use everything. Plan your route.' },
    { speaker: 'SCOUT',  text: 'Free all the hens and we win. Simple as that.' },
    { speaker: 'SCOUT',  text: '...okay maybe not simple. But you\'re the SLYber Fox.' },
  ],
  'district_4_complete': [
    { speaker: 'SCOUT',  text: 'You did it. You actually did it.' },
    { speaker: 'SCOUT',  text: 'Every hen free. Every rooster outsmarted.' },
    { speaker: 'SCOUT',  text: 'The SLYber Fox. Legend.' },
  ],

  // --- Gameplay dialogues ---
  'rooster_warning': [
    { speaker: 'SYSTEM', text: 'CAUTION: Mecha Rooster zone ahead. The red ring shows its territory.' },
    { speaker: 'SYSTEM', text: 'Sneak to reduce detection. Sprint to escape if spotted!' },
  ],
  'hrn_1_approach': [
    { speaker: 'SYSTEM', text: 'HRN NODE DETECTED. Absorb energy to unlock a power-up!' },
  ],
  'sneak_unlocked': [
    { speaker: 'SYSTEM', text: 'SNEAK POINT UNLOCKED! A gap in the fence has opened. Explore further!' },
  ],
  'howl_available': [
    { speaker: 'SYSTEM', text: 'HOWL POINT available! Stand on the purple pillar and press E to howl.' },
    { speaker: 'SYSTEM', text: 'This will reposition a nearby rooster, opening a new path!' },
  ],
  'game_start': [
    { speaker: 'SYSTEM', text: 'SLYber Fox online. Welcome to the HRN compound.' },
    { speaker: 'SYSTEM', text: 'Collect the golden hens scattered through the maze.' },
    { speaker: 'SYSTEM', text: 'Watch for mecha roosters — they guard zones with red rings.' },
    { speaker: 'SYSTEM', text: 'They\'ll push you out if caught, but won\'t chase beyond their zone.' },
    { speaker: 'SYSTEM', text: 'WASD to move. SHIFT to sprint. SPACE to jump. E to bark/interact.' },
  ],

  // --- NPC foxes (still available for flavour) ---
  'npc_fox_1': [
    { speaker: 'RUSTY',  text: 'Those mecha roosters are tough — but they\'re territorial.' },
    { speaker: 'PLAYER', text: '...' },
    { speaker: 'RUSTY',  text: 'They\'ll chase you out of their zone, but they won\'t follow beyond it.' },
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
