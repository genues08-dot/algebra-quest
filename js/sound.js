// Sounds: short tones made in code with the Web Audio API. No audio files.
//
// This file reads only AudioContext / webkitAudioContext from the global object.
// play() never throws: any audio error makes it return false.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};

  // Each note is [frequency in Hz, start in seconds, duration in seconds].
  var COMPLETE = [[523.25, 0, 0.1], [659.25, 0.1, 0.1], [783.99, 0.2, 0.1], [1046.5, 0.3, 0.3]];
  var DEFS = {
    select: { type: 'sine', volume: 0.08, notes: [[660, 0, 0.05]] },
    correct: { type: 'triangle', volume: 0.2, notes: [[659.25, 0, 0.09], [987.77, 0.09, 0.16]] },
    wrong: { type: 'sine', volume: 0.18, notes: [[220, 0, 0.12], [174.61, 0.12, 0.2]] },
    complete: { type: 'triangle', volume: 0.2, notes: COMPLETE },
    perfect: { type: 'triangle', volume: 0.2, notes: COMPLETE.concat([[1318.51, 0.45, 0.35]]) },
    failed: { type: 'sine', volume: 0.18, notes: [[392, 0, 0.16], [329.63, 0.16, 0.16], [261.63, 0.32, 0.3]] },
    submit: { type: 'sine', volume: 0.1, notes: [[523.25, 0, 0.06]] },
    testPass: {
      type: 'triangle', volume: 0.2,
      notes: [[392, 0, 0.1], [523.25, 0.1, 0.1], [659.25, 0.2, 0.1], [783.99, 0.3, 0.1], [1046.5, 0.4, 0.4]]
    },
    testFail: { type: 'sine', volume: 0.16, notes: [[392, 0, 0.15], [349.23, 0.15, 0.3]] }
  };

  var context = null;

  function names() {
    return Object.keys(DEFS);
  }

  // A fresh array each call, so callers cannot change the stored table.
  function notes(name) {
    if (!Object.prototype.hasOwnProperty.call(DEFS, name)) return null;
    var def = DEFS[name];
    return def.notes.map(function (n) {
      return { frequency: n[0], start: n[1], duration: n[2], type: def.type, volume: def.volume };
    });
  }

  function play(name, enabled) {
    if (!enabled) return false;
    var list = notes(name);
    if (!list) return false;
    try {
      var AudioClass = root.AudioContext || root.webkitAudioContext;
      if (!AudioClass) return false;
      if (!context) context = new AudioClass();
      if (context.state === 'suspended') context.resume();
      var now = context.currentTime;
      list.forEach(function (n) {
        var begin = now + n.start;
        var end = begin + n.duration;
        var osc = context.createOscillator();
        var gain = context.createGain();
        osc.type = n.type;
        osc.frequency.setValueAtTime(n.frequency, begin);
        gain.gain.setValueAtTime(0, begin);
        gain.gain.linearRampToValueAtTime(n.volume, begin + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, end);
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(begin);
        osc.stop(end);
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  var api = { names: names, notes: notes, play: play };
  AQ.sound = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
