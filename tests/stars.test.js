const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../js/game.js');
const storage = require('../js/storage.js');
const { makeUnit, makeSave } = require('./fixtures.js');

const TODAY = '2026-11-12';

function play(save, unit, lessonId, responses) {
  const session = game.startLesson(unit, lessonId);
  for (const response of responses) {
    game.submitAnswer(save, unit, session, response, TODAY);
    game.continueSession(session);
  }
  return session;
}

test('a lesson earns 3 stars with no mistakes, 2 at 70% or more, else 1, and the best is kept', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  play(save, unit, 'a1', [0, '7', 1]); // 1 of 2 right first time: 50%
  assert.equal(save.progress.u1.stars.a1, 1);
  play(save, unit, 'a1', [1, '7']);
  assert.equal(save.progress.u1.stars.a1, 3);
  play(save, unit, 'a1', [0, '7', 1]);
  assert.equal(save.progress.u1.stars.a1, 3);
  const session = { wrongCount: 1, firstTryCorrect: 7, total: 10 };
  assert.equal(game.lessonStars(session), 2);
  assert.equal(game.lessonStars({ wrongCount: 2, firstTryCorrect: 6, total: 10 }), 1);
});

test('stars are checked, filled in for old saves, and kept when a unit is replaced', () => {
  const old = makeSave(makeUnit());
  delete old.progress.u1.stars;
  const loaded = storage.load({ getItem: () => JSON.stringify(old) });
  assert.deepEqual(loaded.save.progress.u1.stars, {});

  for (const bad of [[], { a1: 0 }, { a1: 4 }, { a1: 2.5 }, { a1: '3' }]) {
    const save = makeSave(makeUnit());
    save.progress.u1.stars = bad;
    assert.equal(storage.isValidSave(save), false, JSON.stringify(bad));
  }

  const save = makeSave(makeUnit());
  save.progress.u1.stars = { a1: 3, gone: 2 };
  storage.addUnit(save, makeUnit());
  assert.deepEqual(save.progress.u1.stars, { a1: 3 });
});
