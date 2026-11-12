const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../js/game.js');
const { makeUnit, makeSave, makeRichUnit } = require('./fixtures.js');

const TODAY = '2026-11-12'; // a Thursday

function playLesson(save, unit, lessonId, responses, today) {
  const session = game.startLesson(unit, lessonId);
  for (const response of responses) {
    game.submitAnswer(save, unit, session, response, today);
    game.continueSession(session);
  }
  return session;
}

test('XP earned is added to the day it was earned, and finishing marks the day studied', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  playLesson(save, unit, 'a1', [1, '7'], TODAY);
  assert.equal(save.xp, 50);
  assert.deepEqual(save.days, { [TODAY]: { xp: 50, studied: true } });
  assert.equal(game.todayXp(save, TODAY), 50);
  assert.equal(game.todayXp(save, '2026-11-13'), 0);
});

test('a lesson lost on hearts adds XP but does not mark the day studied', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  const session = game.startLesson(unit, 'a1');
  game.submitAnswer(save, unit, session, 1, TODAY);
  game.continueSession(session);
  for (let i = 0; i < 5; i++) {
    game.submitAnswer(save, unit, session, 'wrong', TODAY);
    game.continueSession(session);
  }
  assert.equal(session.status, 'failed');
  assert.deepEqual(save.days, { [TODAY]: { xp: 10, studied: false } });
});

test('only today and the 13 days before it are kept', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  save.days = {
    '2026-10-29': { xp: 5, studied: true },
    '2026-10-30': { xp: 7, studied: true },
    '2026-11-11': { xp: 9, studied: false },
    '2026-12-01': { xp: 200, studied: true }
  };
  playLesson(save, unit, 'a2', ['1/2'], TODAY);
  assert.deepEqual(Object.keys(save.days).sort(), ['2026-10-30', '2026-11-11', TODAY]);
});

test('test XP counts toward today', () => {
  const unit = makeRichUnit();
  const save = makeSave(unit);
  save.progress.u1.completedLessons = ['a1', 'a2', 'b1'];
  const session = game.startTest(unit, () => 0);
  while (session.status === 'active') game.skipQuestion(save, unit, session, TODAY);
  assert.deepEqual(save.days[TODAY], { xp: 0, studied: true });
});

test('rank titles', () => {
  const cases = [
    [1, 'Rookie', 1], [2, 'Rookie', 1], [3, 'Learner', 2], [4, 'Learner', 2], [5, 'Solver', 3], [7, 'Solver', 3],
    [8, 'Factor Finder', 4], [11, 'Factor Finder', 4], [12, 'Equation Ace', 5], [17, 'Polynomial Pro', 6],
    [23, 'Function Master', 7], [29, 'Function Master', 7], [30, 'Algebra Legend', 8], [99, 'Algebra Legend', 8]
  ];
  for (const [rank, name, tier] of cases) assert.deepEqual(game.rankTitle(rank), { name, tier }, 'rank ' + rank);
});

test('goal choices cycle 50, 100, 200, 300', () => {
  assert.deepEqual(game.CONSTANTS.GOAL_CHOICES, [50, 100, 200, 300]);
  assert.equal(game.CONSTANTS.DEFAULT_GOAL, 100);
  assert.equal(game.nextGoal(50), 100);
  assert.equal(game.nextGoal(300), 50);
  assert.equal(game.nextGoal(77), 100);
});

test('week strip: the last seven days, oldest first', () => {
  const save = makeSave(makeUnit());
  save.days = { '2026-11-07': { xp: 30, studied: true }, '2026-11-09': { xp: 5, studied: false } };
  const week = game.weekStrip(save, TODAY);
  assert.deepEqual(week.map(day => day.date),
    ['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', TODAY]);
  assert.deepEqual(week.map(day => day.letter), ['F', 'S', 'S', 'M', 'T', 'W', 'T']);
  assert.deepEqual(week.map(day => day.studied), [false, true, false, false, false, false, false]);
  assert.deepEqual(week.map(day => day.today), [false, false, false, false, false, false, true]);
});

test('week strip: the current streak counts as studied for saves with no day log', () => {
  const save = makeSave(makeUnit());
  delete save.days;
  save.streak = 3;
  save.lastStudyDate = '2026-11-11';
  const week = game.weekStrip(save, TODAY);
  assert.deepEqual(week.map(day => day.studied), [false, false, false, true, true, true, false]);
});

test('next step: first unfinished lesson, then the test, then review, then done', () => {
  const unit = makeRichUnit();
  const progress = { completedLessons: [], review: [], testBest: null };
  assert.deepEqual(game.nextStep(unit, progress),
    { kind: 'lesson', lessonId: 'a1', levelNumber: 1, lessonNumber: 1, levelTitle: 'Level A' });
  progress.completedLessons = ['a1'];
  assert.equal(game.nextStep(unit, progress).lessonId, 'a2');
  progress.completedLessons = ['a2'];
  assert.equal(game.nextStep(unit, progress).lessonId, 'a1');
  progress.completedLessons = ['a1', 'a2'];
  assert.deepEqual(game.nextStep(unit, progress),
    { kind: 'lesson', lessonId: 'b1', levelNumber: 2, lessonNumber: 1, levelTitle: 'Level B' });
  progress.completedLessons = ['a1', 'a2', 'b1'];
  assert.deepEqual(game.nextStep(unit, progress), { kind: 'test' });
  progress.testBest = 79;
  assert.deepEqual(game.nextStep(unit, progress), { kind: 'test' });
  progress.testBest = 80;
  assert.deepEqual(game.nextStep(unit, progress), { kind: 'done' });
  progress.review = ['q1', 'q2'];
  assert.deepEqual(game.nextStep(unit, progress), { kind: 'review', count: 2 });
});

test('next step: a unit with no test goes from lessons to review', () => {
  const unit = makeUnit();
  const progress = { completedLessons: ['a1', 'a2', 'b1'], review: [], testBest: null };
  assert.deepEqual(game.nextStep(unit, progress), { kind: 'done' });
  progress.review = ['q4'];
  assert.deepEqual(game.nextStep(unit, progress), { kind: 'review', count: 1 });
});

test('badges list', () => {
  assert.deepEqual(game.BADGES.map(badge => badge.id), [
    'first-lesson', 'perfect', 'streak-3', 'streak-7', 'streak-30', 'goal',
    'review-clear', 'level', 'unit', 'test-pass', 'test-100', 'rank-10'
  ]);
  for (const badge of game.BADGES) {
    assert.equal(typeof badge.name, 'string');
    assert.equal(typeof badge.how, 'string');
  }
});

test('badges read from the save are earned once, with the date', () => {
  const unit = makeRichUnit();
  const save = makeSave(unit);
  assert.deepEqual(game.earnBadges(save, null, TODAY), []);
  assert.deepEqual(save.badges, {});

  save.progress.u1.completedLessons = ['a1', 'a2'];
  save.streak = 7;
  save.xp = 950;
  save.days = { [TODAY]: { xp: 100, studied: true } };
  assert.deepEqual(game.earnBadges(save, null, TODAY), ['first-lesson', 'streak-3', 'streak-7', 'goal', 'level', 'rank-10']);
  assert.equal(save.badges['first-lesson'], TODAY);

  save.progress.u1.completedLessons = ['a1', 'a2', 'b1'];
  save.progress.u1.testBest = 100;
  assert.deepEqual(game.earnBadges(save, null, '2026-11-13'), ['unit', 'test-pass', 'test-100']);
  assert.equal(save.badges['first-lesson'], TODAY);
  assert.deepEqual(game.earnBadges(save, null, '2026-11-13'), []);
});

test('the goal badge uses the saved goal', () => {
  const save = makeSave(makeUnit());
  save.settings.goal = 200;
  save.days = { [TODAY]: { xp: 150, studied: true } };
  assert.deepEqual(game.earnBadges(save, null, TODAY), []);
  save.settings.goal = 50;
  assert.deepEqual(game.earnBadges(save, null, TODAY), ['goal']);
});

test('perfect and review-clear badges come from the session that ended', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  const perfect = playLesson(save, unit, 'a2', ['1/2'], TODAY);
  assert.equal(perfect.perfect, true);
  assert.deepEqual(game.earnBadges(save, perfect, TODAY), ['first-lesson', 'perfect']);

  const other = makeSave(unit);
  other.progress.u1.review = ['q3'];
  const review = game.startReview(unit, other.progress.u1);
  game.submitAnswer(other, unit, review, 'wrong', TODAY);
  game.continueSession(review);
  game.submitAnswer(other, unit, review, '1/2', TODAY);
  assert.equal(review.status, 'complete');
  assert.deepEqual(other.progress.u1.review, []);
  assert.deepEqual(game.earnBadges(other, review, TODAY), ['review-clear']);
});

test('a review that leaves questions in the pile does not clear it', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  save.progress.u1.review = ['q3'];
  const review = game.startReview(unit, save.progress.u1);
  game.submitAnswer(save, unit, review, '1/2', TODAY);
  assert.equal(review.status, 'complete');
  // Another question went into the pile before the review ended, so the pile is not empty.
  save.progress.u1.review = ['q4'];
  assert.equal(game.earnBadges(save, review, TODAY).includes('review-clear'), false);
});
