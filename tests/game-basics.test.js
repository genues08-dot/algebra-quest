const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../js/game.js');
const { makeUnit, makeSave } = require('./fixtures.js');

test('constants', () => assert.deepEqual(game.CONSTANTS, {
  XP_CORRECT: 10, XP_LESSON_COMPLETE: 20, XP_PERFECT_BONUS: 10,
  XP_PER_RANK: 100, HEARTS_PER_LESSON: 5, REVIEW_LESSON_SIZE: 8
}));

test('rank', () => {
  assert.deepEqual([0, 99, 100, 250].map(game.rankForXp), [1, 1, 2, 3]);
  assert.equal(game.xpIntoRank(250), 50);
});

test('levelStates', () => {
  const unit = makeUnit();
  const states = done => game.levelStates(unit, { completedLessons: done, review: [] });
  assert.deepEqual(states([]), ['open', 'locked']);
  assert.deepEqual(states(['a1']), ['open', 'locked']);
  assert.deepEqual(states(['a1', 'a2']), ['complete', 'open']);
  assert.deepEqual(states(['a1', 'a2', 'b1']), ['complete', 'complete']);
});

test('localDateString uses local time and zero padding', () => {
  assert.equal(game.localDateString(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('dayDiff counts calendar days across edges', () => {
  assert.equal(game.dayDiff('2026-11-10', '2026-11-11'), 1);
  assert.equal(game.dayDiff('2026-12-31', '2027-01-01'), 1);
  assert.equal(game.dayDiff('2028-02-28', '2028-03-01'), 2);
  assert.equal(game.dayDiff('2026-03-07', '2026-03-09'), 2);
  assert.equal(game.dayDiff('2026-10-31', '2026-11-02'), 2);
  assert.equal(game.dayDiff('2026-11-11', '2026-11-10'), -1);
});

test('applyStreak', () => {
  const save = makeSave(makeUnit());
  const step = (today, streak, last) => {
    game.applyStreak(save, today);
    assert.deepEqual([save.streak, save.lastStudyDate], [streak, last], today);
  };
  step('2026-12-30', 1, '2026-12-30');
  step('2026-12-30', 1, '2026-12-30');
  step('2026-12-31', 2, '2026-12-31');
  step('2027-01-01', 3, '2027-01-01');
  step('2027-01-03', 1, '2027-01-03');
  step('2027-01-02', 1, '2027-01-03');
});

test('refreshStreak', () => {
  const check = (last, streak, today, expected) => {
    const save = makeSave(makeUnit());
    save.lastStudyDate = last;
    save.streak = streak;
    game.refreshStreak(save, today);
    assert.deepEqual([save.streak, save.lastStudyDate], [expected, last]);
  };
  check('2026-11-11', 4, '2026-11-11', 4);
  check('2026-11-10', 4, '2026-11-11', 4);
  check('2026-11-09', 4, '2026-11-11', 0);
  check(null, 0, '2026-11-11', 0);
  check('2026-11-12', 4, '2026-11-11', 4);
});

test('shuffledOrder returns a permutation', () => {
  assert.deepEqual(game.shuffledOrder(1), [0]);
  assert.deepEqual(game.shuffledOrder(4, () => 0.42).slice().sort(), [0, 1, 2, 3]);
  assert.deepEqual(game.shuffledOrder(6).slice().sort(), [0, 1, 2, 3, 4, 5]);
});
