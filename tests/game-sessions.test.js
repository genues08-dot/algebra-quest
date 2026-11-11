const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../js/game.js');
const { makeUnit, makeSave } = require('./fixtures.js');

const TODAY = '2026-11-11';
const setup = () => { const unit = makeUnit(); return { unit, save: makeSave(unit) }; };
const answer = (ctx, session, response) => {
  const result = game.submitAnswer(ctx.save, ctx.unit, session, response, TODAY);
  game.continueSession(session);
  return result;
};

test('startLesson', () => {
  const { unit } = setup();
  const s = game.startLesson(unit, 'a1');
  assert.deepEqual(s, {
    unitId: 'u1', kind: 'lesson', lessonId: 'a1', queue: ['q1', 'q2'], total: 2,
    hearts: 5, wrongCount: 0, firstTryCorrect: 0, seen: [], missed: [],
    xpEarned: 0, perfect: false, status: 'active', awaitingContinue: false
  });
  assert.equal(game.currentQuestion(unit, s).id, 'q1');
  assert.equal(game.startLesson(unit, 'nope'), null);
});

test('perfect lesson', () => {
  const ctx = setup();
  const s = game.startLesson(ctx.unit, 'a1');
  assert.deepEqual(answer(ctx, s, 1), { correct: true, question: ctx.unit.levels[0].lessons[0].questions[0] });
  assert.equal(ctx.save.xp, 10);
  answer(ctx, s, ' x = 7 ');
  assert.deepEqual([s.status, s.perfect, s.xpEarned, ctx.save.xp], ['complete', true, 50, 50]);
  assert.deepEqual(ctx.save.progress.u1.completedLessons, ['a1']);
  assert.deepEqual([ctx.save.streak, ctx.save.lastStudyDate], [1, TODAY]);
  assert.equal(game.accuracy(s), 100);
  assert.equal(game.currentQuestion(ctx.unit, s), null);
});

test('wrong answers cost a heart, requeue, and join the review pile once', () => {
  const ctx = setup();
  const s = game.startLesson(ctx.unit, 'a1');
  assert.equal(answer(ctx, s, 0).correct, false);
  assert.deepEqual([s.hearts, s.queue, ctx.save.xp], [4, ['q2', 'q1'], 0]);
  assert.deepEqual(ctx.save.progress.u1.review, ['q1']);
  answer(ctx, s, '7');
  answer(ctx, s, 0);
  answer(ctx, s, 1);
  assert.deepEqual([s.status, s.perfect, s.hearts, ctx.save.xp], ['complete', false, 3, 40]);
  assert.deepEqual(s.missed, ['q1']);
  assert.deepEqual(ctx.save.progress.u1.review, ['q1']);
  assert.equal(game.accuracy(s), 50);
});

test('out of hearts fails the lesson and keeps earned XP', () => {
  const ctx = setup();
  const s = game.startLesson(ctx.unit, 'a1');
  answer(ctx, s, 1);
  for (let i = 0; i < 5; i++) answer(ctx, s, '8');
  assert.deepEqual([s.status, s.hearts, ctx.save.xp], ['failed', 0, 10]);
  assert.deepEqual(ctx.save.progress.u1.completedLessons, []);
  assert.deepEqual([ctx.save.streak, ctx.save.lastStudyDate], [0, null]);
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, s, '7', TODAY), null);
});

test('ignored submissions change nothing', () => {
  const ctx = setup();
  const s = game.startLesson(ctx.unit, 'a1');
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, s, null, TODAY), null);
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, s, 1, TODAY).correct, true);
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, s, '8', TODAY), null);
  game.continueSession(s);
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, s, '   ', TODAY), null);
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, s, 'x =', TODAY), null);
  assert.deepEqual([s.hearts, ctx.save.xp, s.queue], [5, 10, ['q2']]);
});

test('replaying a completed lesson does not list it twice', () => {
  const ctx = setup();
  for (let round = 0; round < 2; round++) {
    const s = game.startLesson(ctx.unit, 'a2');
    answer(ctx, s, '0.5');
  }
  assert.deepEqual(ctx.save.progress.u1.completedLessons, ['a2']);
  assert.equal(ctx.save.xp, 80);
});

test('review lesson removes questions answered right', () => {
  const ctx = setup();
  ctx.save.progress.u1.review = ['q2', 'q4'];
  const s = game.startReview(ctx.unit, ctx.save.progress.u1);
  assert.deepEqual([s.kind, s.lessonId, s.queue, s.total], ['review', null, ['q2', 'q4'], 2]);
  answer(ctx, s, '8');
  assert.deepEqual(ctx.save.progress.u1.review, ['q2', 'q4']);
  assert.deepEqual(s.queue, ['q4', 'q2']);
  answer(ctx, s, '-3, 3');
  assert.deepEqual(ctx.save.progress.u1.review, ['q2']);
  answer(ctx, s, '7');
  assert.deepEqual([s.status, ctx.save.xp, ctx.save.streak], ['complete', 40, 1]);
  assert.deepEqual(ctx.save.progress.u1.review, []);
  assert.deepEqual(ctx.save.progress.u1.completedLessons, []);
});

test('review takes the 8 oldest, skips unknown ids, and is null when empty', () => {
  const ctx = setup();
  const extra = ['q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12'];
  for (const id of extra) ctx.unit.levels[1].lessons[0].questions.push({ id, type: 'input', prompt: 'P', hint: 'H', solution: 'S', answers: ['1'] });
  const progress = ctx.save.progress.u1;
  progress.review = ['gone', 'q12', 'q11', 'q10', 'q9', 'q8', 'q7', 'q6', 'q5', 'q4', 'q3'];
  assert.deepEqual(game.startReview(ctx.unit, progress).queue, ['q12', 'q11', 'q10', 'q9', 'q8', 'q7', 'q6', 'q5']);
  progress.review = [];
  assert.equal(game.startReview(ctx.unit, progress), null);
  progress.review = ['gone'];
  assert.equal(game.startReview(ctx.unit, progress), null);
});
