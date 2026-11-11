const test = require('node:test');
const assert = require('node:assert/strict');
const sound = require('../js/sound.js');

const NAMES = ['select', 'correct', 'wrong', 'complete', 'perfect', 'failed', 'submit', 'testPass', 'testFail'];

test('every sound has notes within safe limits', () => {
  assert.deepEqual(sound.names().slice().sort(), NAMES.slice().sort());
  for (const name of NAMES) {
    const notes = sound.notes(name);
    assert.ok(notes.length >= 1, name);
    let end = 0;
    for (const note of notes) {
      assert.ok(note.frequency >= 100 && note.frequency <= 2000, name);
      assert.ok(note.start >= 0 && note.duration >= 0.03 && note.duration <= 0.6, name);
      assert.ok(note.volume > 0 && note.volume <= 0.3, name);
      assert.ok(['sine', 'triangle'].includes(note.type), name);
      end = Math.max(end, note.start + note.duration);
    }
    assert.ok(end <= 1.5, name);
  }
});

test('correct rises and wrong falls', () => {
  const up = sound.notes('correct');
  assert.ok(up[up.length - 1].frequency > up[0].frequency);
  const down = sound.notes('wrong');
  assert.ok(down[down.length - 1].frequency < down[0].frequency);
});

test('no audio, sound off, and unknown names are harmless', () => {
  assert.equal(sound.notes('nope'), null);
  assert.equal(sound.play('correct', true), false);
});

test('with audio, play starts one oscillator per note', () => {
  let started = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  globalThis.AudioContext = class {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createOscillator() { return { type: '', frequency: param(), connect() {}, start() { started += 1; }, stop() {} }; }
    createGain() { return { gain: param(), connect() {} }; }
    resume() {}
  };
  try {
    assert.equal(sound.play('correct', false), false);
    assert.equal(sound.play('nope', true), false);
    assert.equal(started, 0);
    assert.equal(sound.play('correct', true), true);
    assert.equal(started, sound.notes('correct').length);
  } finally {
    delete globalThis.AudioContext;
  }
});
