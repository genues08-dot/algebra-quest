const test = require('node:test');
const assert = require('node:assert/strict');
const mascot = require('../js/mascot.js');
const storage = require('../js/storage.js');
const { makeUnit, makeSave } = require('./fixtures.js');

test('colors, moods, defaults, and image paths', () => {
  assert.deepEqual(mascot.COLORS, ['pink', 'purple', 'blue']);
  assert.deepEqual(mascot.MOODS, ['happy', 'cheer', 'encourage', 'think']);
  assert.deepEqual(mascot.DEFAULT, { color: 'pink', name: 'Axl' });
  assert.equal(mascot.imagePath('purple', 'think'), 'img/axl/purple-think.png');
  assert.equal(mascot.imagePath('green', 'happy'), 'img/axl/pink-happy.png');
  assert.equal(mascot.imagePath('blue', 'dance'), 'img/axl/blue-happy.png');
});

test('names are trimmed and must be 1 to 16 characters', () => {
  assert.equal(mascot.cleanName('  Gilly  '), 'Gilly');
  assert.equal(mascot.cleanName('Sixteen chars ok'), 'Sixteen chars ok');
  assert.equal(mascot.cleanName('   '), null);
  assert.equal(mascot.cleanName('Seventeen chars!!'), null);
  assert.equal(mascot.cleanName(42), null);
});

test('pick takes a list item from a number in [0, 1)', () => {
  const list = ['a', 'b', 'c'];
  assert.equal(mascot.pick(list, 0), 'a');
  assert.equal(mascot.pick(list, 0.5), 'b');
  assert.equal(mascot.pick(list, 0.999), 'c');
  assert.equal(mascot.pick(list, 1), 'c');
  for (const kind of ['tap', 'correct', 'wrong']) assert.ok(mascot.LINES[kind].length >= 4, kind);
});

test('home line: the first situation that applies', () => {
  const base = { name: 'Axl', hasUnit: true, goalMet: false, streak: 0, studiedToday: false, todayXp: 0, goal: 100,
    next: { kind: 'lesson', levelTitle: 'Factoring' } };
  const line = change => mascot.homeLine(Object.assign({}, base, change));
  assert.equal(line({ hasUnit: false, next: null }), "Hi, I'm Axl! Let's crush some algebra!");
  assert.equal(line({ goalMet: true, streak: 4 }), "Goal smashed today! You're unstoppable!");
  assert.equal(line({ streak: 4 }), '4-day streak! One lesson keeps it alive!');
  assert.equal(line({ streak: 4, studiedToday: true, todayXp: 40 }), '60 XP to your goal! LET\'S GO!');
  assert.equal(line({ todayXp: 30 }), '70 XP to your goal! LET\'S GO!');
  assert.equal(line({ next: { kind: 'done' } }), "Unit complete! You're an algebra legend!");
  assert.equal(line({}), 'Ready? Next up: Factoring!');
  assert.equal(line({ next: { kind: 'test' } }), 'Ready? Next up: the final test!');
  assert.equal(line({ next: { kind: 'review', count: 3 } }), 'Ready? Next up: your review pile!');
});

test('teaching card and result lines', () => {
  assert.equal(mascot.teachLine(0, 3), "Here's the trick!");
  assert.equal(mascot.teachLine(1, 3), 'Keep going!');
  assert.equal(mascot.teachLine(2, 3), "Got it? Let's practice!");
  assert.equal(mascot.teachLine(0, 1), "Here's the trick!");
  assert.deepEqual(mascot.result('complete', { perfect: true }), { mood: 'cheer', line: 'PERFECT! Not a single mistake!' });
  assert.deepEqual(mascot.result('complete', { perfect: false }), { mood: 'cheer', line: 'Lesson done! You crushed it!' });
  assert.deepEqual(mascot.result('failed', {}),
    { mood: 'encourage', line: 'Out of hearts, not out of fight! Read these, then try again.' });
  assert.deepEqual(mascot.result('test', { passed: true }), { mood: 'cheer', line: 'YOU PASSED! I knew you could do it!' });
  assert.deepEqual(mascot.result('test', { passed: false }),
    { mood: 'encourage', line: 'So close! Review the misses and come back stronger!' });
});

test('saves get a mascot setting, and bad ones are refused', () => {
  assert.deepEqual(storage.newSave().settings.mascot, { color: 'pink', name: 'Axl' });
  const old = makeSave(makeUnit());
  delete old.settings.mascot;
  const loaded = storage.load({ getItem: () => JSON.stringify(old) });
  assert.deepEqual(loaded.save.settings.mascot, { color: 'pink', name: 'Axl' });

  const good = makeSave(makeUnit());
  good.settings.mascot = { color: 'blue', name: 'Gilly' };
  assert.equal(storage.isValidSave(good), true);
  const bad = [
    { color: 'green', name: 'Axl' }, { color: 'pink', name: '' }, { color: 'pink', name: '   ' },
    { color: 'pink', name: 'x'.repeat(17) }, { color: 'pink' }, 'pink', null
  ];
  for (const value of bad) {
    const save = makeSave(makeUnit());
    save.settings.mascot = value;
    assert.equal(storage.isValidSave(save), false, JSON.stringify(value));
  }
});
