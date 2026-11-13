const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const { makeUnit, makeSave } = require('./fixtures.js');
const { makeEnv } = require('./fake-page.js');

const KEY = 'algebraQuest.v1';

test('a lesson can be played from start to finish', () => {
  const env = makeEnv(storage.serialize(makeSave(makeUnit())));
  env.click('start-lesson', { 'data-lesson-id': 'a1' });
  assert.match(env.html(), /P q1/);

  env.click('check');
  assert.doesNotMatch(env.html(), /Correct!|Not quite/);

  env.click('choose', { 'data-index': '0' });
  env.click('check');
  assert.match(env.html(), /Not quite/);
  assert.match(env.html(), /4 of 5 hearts/);

  env.click('continue');
  assert.match(env.html(), /P q2/);
  env.answerBox.value = 'x = 7';
  env.click('check');
  assert.match(env.html(), /Correct!/);

  env.click('continue');
  env.click('choose', { 'data-index': '1' });
  env.click('check');
  env.click('continue');
  assert.match(env.html(), /Lesson complete!/);
  assert.match(env.html(), /\+40 XP/);

  const stored = JSON.parse(env.ls.data[KEY]);
  assert.deepEqual(
    [stored.xp, stored.streak, stored.progress.u1.completedLessons, stored.progress.u1.review],
    [40, 1, ['a1'], ['q1']]
  );
  env.click('home');
  assert.match(env.html(), /aria-label="1 questions to review"/);
  env.click('open-practice');
  assert.match(env.html(), /Review \(1\)/);
});

test('a failed first write still leaves a usable home screen', () => {
  const save = makeSave(makeUnit());
  save.xp = 250;
  const env = makeEnv(storage.serialize(save), { failWrites: true });
  assert.match(env.html(), /Storage is full/);
  env.click('home');
  assert.match(env.html(), /Rank 3/);
});

test('start fresh with a failed write returns to the unreadable-save screen', () => {
  const env = makeEnv('{}', { failWrites: true });
  assert.match(env.html(), /saved progress can&#39;t be read/);
  env.click('start-fresh');
  assert.match(env.html(), /Storage is full/);
  env.click('home');
  assert.match(env.html(), /saved progress can&#39;t be read/);
  assert.equal(env.ls.data[KEY], '{}');
});

test('progress saved by another window is not overwritten', () => {
  const unit = makeUnit();
  const env = makeEnv(storage.serialize(makeSave(unit)));

  // What a second Algebra Quest window would have written in the meantime.
  const newer = makeSave(unit);
  newer.xp = 900;
  newer.progress.u1.completedLessons = ['a1'];
  env.ls.data[KEY] = storage.serialize(newer);

  env.click('start-lesson', { 'data-lesson-id': 'a1' });
  env.click('choose', { 'data-index': '1' });
  env.click('check');

  assert.deepEqual(JSON.parse(env.ls.data[KEY]), newer);
  assert.match(env.html(), /another window/);
  env.click('home');
  assert.match(env.html(), /Rank 10/);
});

test('the built-in units are added when the app opens, in unit order, starting on the last one', () => {
  const named = (id, title) => { const unit = makeUnit(); unit.id = id; unit.title = title; return unit; };
  const builtIn = [named('u1', 'Unit 1: Equations'), named('u2', 'Unit 2: Lines'), named('u10', 'Unit 10: Trig')];
  const env = makeEnv(null, { units: builtIn });
  const options = [...env.html().matchAll(/<option value="([^"]+)"( selected)?>/g)].map(m => m[1] + (m[2] ? '*' : ''));
  assert.deepEqual(options, ['u1', 'u2', 'u10*']);
  const saved = JSON.parse(env.ls.data[KEY]);
  assert.deepEqual(Object.keys(saved.units), ['u1', 'u2', 'u10']);
  assert.doesNotMatch(env.html(), /data-action="import"/);
});

test('opening the app keeps the current unit and adds new built-in ones', () => {
  const named = (id, title) => { const unit = makeUnit(); unit.id = id; unit.title = title; return unit; };
  const save = makeSave(named('u5', 'Unit 5: Polynomials'));
  save.progress.u5.completedLessons = ['a1'];
  const env = makeEnv(storage.serialize(save), { units: [named('u1', 'Unit 1: Equations'), named('u5', 'Unit 5: Polynomials')] });
  const saved = JSON.parse(env.ls.data[KEY]);
  assert.equal(saved.currentUnitId, 'u5');
  assert.deepEqual(saved.progress.u5.completedLessons, ['a1']);
  assert.ok(saved.units.u1);
  assert.match(env.html(), /<option value="u5" selected>/);
});

test('Start fresh gives a save with the built-in units', () => {
  const env = makeEnv('{}', { units: [makeUnit()] });
  env.click('start-fresh');
  const saved = JSON.parse(env.ls.data[KEY]);
  assert.deepEqual(Object.keys(saved.units), ['u1']);
  assert.equal(saved.xp, 0);
});
