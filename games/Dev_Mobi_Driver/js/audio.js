// ═══ AUDIO SYSTEM ═══
// Crossfading music tracks per biome

var audio = {
  tracks: {},
  current: null,
  masterVol: 0.5,
  fadeDur: 3,
  ready: false,

  init: function() {
    if (this.ready) return;
    this.ready = true;
    dbg('Audio system init');

    var self = this;
    biomeOrder.forEach(function(k) {
      var url = BIOMES[k].music;
      dbg('Loading audio: ' + url, 'warn');
      var a = new Audio(url);
      a.loop = true;
      a.volume = 0;
      a.preload = 'auto';
      self.tracks[k] = { el: a, target: 0, cur: 0, ok: false };

      a.addEventListener('canplaythrough', function() {
        self.tracks[k].ok = true;
        dbg('Audio ready: ' + url);
      });
      a.addEventListener('error', function() {
        dbg('Audio FAILED: ' + url + ' (' + (a.error ? a.error.message : 'unknown') + ')', 'err');
      });
    });
  },

  switchTo: function(k) {
    if (!this.ready) return;
    var isNew = this.current !== k;
    if (isNew) dbg('Music -> ' + BIOMES[k].name);

    var self = this;
    biomeOrder.forEach(function(b) {
      var t = self.tracks[b];
      if (b === k) {
        t.target = self.masterVol;
        if (t.ok && t.el.paused) {
          t.el.currentTime = 0;
          t.el.play().catch(function(e) { dbg('Play err: ' + e.message, 'err'); });
        }
      } else {
        t.target = 0;
      }
    });
    this.current = k;
  },

  retryPlay: function(k) {
    if (!this.ready) return false;
    var t = this.tracks[k];
    if (!t || !t.ok) return false;
    t.target = this.masterVol;
    if (t.el.paused) {
      t.el.currentTime = 0;
      t.el.play().catch(function(e) { dbg('Play err: ' + e.message, 'err'); });
    }
    return true;
  },

  update: function(dt) {
    if (!this.ready) return;
    var r = 1 / this.fadeDur;
    var self = this;

    biomeOrder.forEach(function(k) {
      var t = self.tracks[k];
      if (!t.ok) return;
      if (t.cur < t.target) t.cur = Math.min(t.cur + r * dt, t.target);
      else if (t.cur > t.target) t.cur = Math.max(t.cur - r * dt, 0);
      t.el.volume = t.cur;
      if (t.cur <= 0 && !t.el.paused) t.el.pause();
    });
  },

  setVol: function(v) {
    this.masterVol = v;
    if (this.current) this.tracks[this.current].target = v;
  }
};

document.getElementById('vol-slider').addEventListener('input', function(e) {
  audio.setVol(parseFloat(e.target.value));
  var mob = document.getElementById('vol-slider-mobile');
  if (mob) mob.value = e.target.value;
});
// Mobile HUD slider
var volMob = document.getElementById('vol-slider-mobile');
if (volMob) {
  volMob.addEventListener('input', function(e) {
    audio.setVol(parseFloat(e.target.value));
    document.getElementById('vol-slider').value = e.target.value;
  });
}
