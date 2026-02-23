// ═══ AUDIO — PLAYLIST SYSTEM ═══
var audio = {
  tracks:    [],    // array of { url, el, ok, cur, target }
  current:   -1,   // index into tracks[]
  next:      -1,   // index being faded in
  masterVol: 0.5,
  ready:     false,
  unlocked:  false,

  // Build the ordered (or shuffled) track list from config
  _buildOrder: function() {
    var order = PLAYLIST.tracks.slice();
    if (PLAYLIST.shuffle) {
      for (var i = order.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
      }
    }
    return order;
  },

  init: function() {
    if (this.ready) return;
    this.ready = true;
    dbg('Audio system init');
    var self = this;
    var urls = this._buildOrder();
    urls.forEach(function(url, i) {
      var a = new Audio(url);
      a.loop = false;   // playlist handles looping
      a.volume = 0;
      a.preload = 'auto';
      var track = { url: url, el: a, ok: false, cur: 0, target: 0 };
      self.tracks.push(track);
      a.addEventListener('canplaythrough', function() {
        track.ok = true;
        dbg('Audio ready: ' + url);
      });
      a.addEventListener('ended', function() {
        // Track finished naturally — advance playlist
        if (self.current === i) self._advance();
      });
      a.addEventListener('error', function() {
        dbg('Audio FAILED: ' + url, 'err');
      });
    });
  },

  // Start playing from the first track
  play: function() {
    if (!this.ready || this.tracks.length === 0) return;
    this._startTrack(0);
  },

  // Immediately switch to a specific track index (with crossfade)
  _startTrack: function(idx) {
    if (idx < 0 || idx >= this.tracks.length) idx = 0;
    var self = this;
    // Fade out everything except target
    this.tracks.forEach(function(t, i) {
      t.target = (i === idx) ? self.masterVol : 0;
    });
    var t = this.tracks[idx];
    if (t.ok && t.el.paused) {
      t.el.currentTime = 0;
      t.el.play().catch(function(e) { dbg('Play err: ' + e.message, 'err'); });
    }
    this.current = idx;
    dbg('Playlist -> track ' + (idx + 1) + '/' + this.tracks.length + ': ' + t.url);
  },

  // Move to next track in playlist
  _advance: function() {
    var next = (this.current + 1) % this.tracks.length;
    this._startTrack(next);
  },

  // Try to play current track (called after user gesture unlocks audio)
  retryPlay: function() {
    if (!this.ready || this.tracks.length === 0) return false;
    if (this.current < 0) { this.play(); return true; }
    var t = this.tracks[this.current];
    if (!t || !t.ok) return false;
    t.target = this.masterVol;
    if (t.el.paused) {
      t.el.play().catch(function(e) { dbg('Play err: ' + e.message, 'err'); });
    }
    return true;
  },

  // Skip to the next track manually
  skip: function() {
    this._advance();
  },

  update: function(dt) {
    if (!this.ready) return;
    var r = 1 / PLAYLIST.crossfade;
    var self = this;
    this.tracks.forEach(function(t, i) {
      if (!t.ok) return;
      if (t.cur < t.target)      t.cur = Math.min(t.cur + r * dt, t.target);
      else if (t.cur > t.target) t.cur = Math.max(t.cur - r * dt, 0);
      t.el.volume = t.cur;

      // Resume if it should be playing but isn't (e.g. after tab focus)
      if (t.target > 0 && t.el.paused && self.unlocked) {
        t.el.play().catch(function(e) { dbg('Resume err: ' + e.message, 'err'); });
      }
      // Pause fully faded tracks
      if (t.cur <= 0 && t.target <= 0 && !t.el.paused) t.el.pause();
    });
  },

  setVol: function(v) {
    this.masterVol = v;
    if (this.current >= 0) this.tracks[this.current].target = v;
  },

  // Current track display name (filename without path/extension)
  trackName: function() {
    if (this.current < 0 || !this.tracks[this.current]) return '';
    return this.tracks[this.current].url.replace(/\.mp3$/, '').replace(/^.*\//, '');
  },
};

// Re-arm audio permission after any user gesture
document.addEventListener('touchstart', function() { audio.unlocked = true; }, { passive: true, once: false });
document.addEventListener('click',      function() { audio.unlocked = true; }, { once: false });

document.getElementById('vol-slider').addEventListener('input', function(e) {
  audio.setVol(parseFloat(e.target.value));
  var mob = document.getElementById('vol-slider-mobile');
  if (mob) mob.value = e.target.value;
});
var volMob = document.getElementById('vol-slider-mobile');
if (volMob) {
  volMob.addEventListener('input', function(e) {
    audio.setVol(parseFloat(e.target.value));
    document.getElementById('vol-slider').value = e.target.value;
  });
}
