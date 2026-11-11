const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const { makeEnv } = require('./fake-page.js');
const { makeRichUnit, makeSave } = require('./fixtures.js');

const KEY = 'algebraQuest.v1';
const RIGHT = { t1: 1, t2: '2', t3: '3', t4: '4', t5: '5' };
function ready(change, options) {
  const save = makeSave(makeRichUnit());
  save.progress.u1.completedLessons = ['a1', 'a2', 'b1'];
  if (change) change(save);
  const env = makeEnv(storage.serialize(save), options);
  env.played = [];
  globalThis.AQ.sound.play = (name, enabled) => { env.played.push([name, enabled]); return true; };
  return env;
}
const stored = env => JSON.parse(env.ls.data[KEY]);
const shown = env => env.html().match(/T (t\d)/)[1];
function answer(env, right) {
  const id = shown(env);
  if (id === 't1') env.click('choose', { 'data-index': right ? '1' : '0' });
  else env.answerBox.value = right ? RIGHT[id] : '99';
  env.click('check');
  return id;
}

test('a locked test does not start', () => {
  const env = ready(save => { save.progress.u1.completedLessons = []; });
  env.click('start-test');
  assert.match(env.html(), /Final test/);
  assert.doesNotMatch(env.html(), /Question 1 of 5/);
});

test('the test gives no feedback and ends on the result screen', () => {
  const env = ready();
  env.click('start-test');
  for (let n = 1; n <= 5; n++) {
    assert.match(env.html(), new RegExp('Question ' + n + ' of 5'));
    assert.doesNotMatch(env.html(), /Correct!|Not quite|H t\d|S t\d/);
    answer(env, true);
  }
  assert.match(env.html(), /100%/);
  assert.match(env.html(), /Passed/);
  assert.deepEqual([stored(env).xp, stored(env).progress.u1.testBest], [100, 100]);
  env.click('home');
  assert.match(env.html(), /Best: 100%/);
});

test('skip counts as wrong, the result lists it, and retake starts over', () => {
  const env = ready();
  env.click('start-test');
  const skipped = shown(env);
  env.click('skip');
  for (let n = 0; n < 4; n++) answer(env, true);
  assert.match(env.html(), /80%/);
  assert.match(env.html(), new RegExp('S ' + skipped));
  assert.deepEqual(stored(env).progress.u1.review, [skipped]);
  env.click('retry');
  assert.match(env.html(), /Question 1 of 5/);
});

test('quitting the test asks with its own wording', () => {
  const env = ready(null, { confirm: false });
  env.click('start-test');
  env.click('quit');
  assert.deepEqual(env.confirms, ['Quit the test? You will have to start it again.']);
  assert.match(env.html(), /Question 1 of 5/);
});

test('lesson sounds', () => {
  const env = ready();
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  env.answerBox.value = '99';
  env.click('check');
  env.click('continue');
  env.answerBox.value = '0.5';
  env.click('check');
  env.click('continue');
  assert.deepEqual(env.played.map(p => p[0]), ['wrong', 'correct', 'complete']);
  env.played.length = 0;
  env.click('home');
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  env.answerBox.value = '0.5';
  env.click('check');
  env.click('continue');
  assert.deepEqual(env.played.map(p => p[0]), ['correct', 'perfect']);
});

test('picking a choice plays select, and running out of hearts plays failed', () => {
  const env = ready();
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  for (let n = 0; n < 5; n++) { env.answerBox.value = '99'; env.click('check'); env.click('continue'); }
  assert.equal(env.played[env.played.length - 1][0], 'failed');
  env.played.length = 0;
  env.click('home');
  env.click('start-lesson', { 'data-lesson-id': 'a1' });
  env.click('teach-skip');
  env.click('choose', { 'data-index': '0' });
  assert.deepEqual(env.played.map(p => p[0]), ['select']);
});

test('the test plays only submit until it ends', () => {
  const env = ready();
  env.click('start-test');
  let sawChoice = false;
  for (let n = 0; n < 5; n++) { sawChoice = shown(env) === 't1' || sawChoice; answer(env, n !== 0); }
  const names = env.played.map(p => p[0]).filter(name => name !== 'select');
  assert.deepEqual(names, ['submit', 'submit', 'submit', 'submit', 'submit', 'testPass']);
  assert.equal(sawChoice, true);
  const failing = ready();
  failing.click('start-test');
  for (let n = 0; n < 5; n++) failing.click('skip');
  assert.equal(failing.played[failing.played.length - 1][0], 'testFail');
});

test('Enter submits a typed test answer, and hint and Notes do nothing in a test', () => {
  const env = ready();
  env.click('start-test');
  if (shown(env) === 't1') answer(env, true);
  const number = Number(env.html().match(/Question (\d) of 5/)[1]);
  env.click('hint');
  env.click('notes');
  assert.doesNotMatch(env.html(), /H t\d|Card one/);
  env.answerBox.value = RIGHT[shown(env)];
  env.key('Enter', 'answer');
  assert.match(env.html(), new RegExp('Question ' + (number + 1) + ' of 5'));
  assert.doesNotMatch(env.html(), /Correct!|Not quite/);
  assert.equal(env.played[env.played.length - 1][0], 'submit');
});

test('the sound button saves the setting, and off is passed to play', () => {
  const env = ready();
  env.click('toggle-sound');
  assert.equal(stored(env).settings.sound, false);
  assert.match(env.html(), /Sound: off/);
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  env.answerBox.value = '0.5';
  env.click('check');
  assert.deepEqual(env.played[env.played.length - 1], ['correct', false]);
});
