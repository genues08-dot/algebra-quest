const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../js/game.js');
const { makeUnit, makeRichUnit, makeSave } = require('./fixtures.js');

const TODAY = '2026-11-11';
const IN_ORDER = () => 0.999999;
const RIGHT = { t1: 1, t2: '2', t3: '3', t4: '4', t5: '5' };
const setup = () => { const unit = makeRichUnit(); return { unit, save: makeSave(unit) }; };
function take(ctx, wrongIds) {
  const session = game.startTest(ctx.unit, IN_ORDER);
  while (session.status === 'active') {
    const id = session.queue[0];
    const response = wrongIds.includes(id) ? (id === 't1' ? 0 : '99') : RIGHT[id];
    game.submitAnswer(ctx.save, ctx.unit, session, response, TODAY);
  }
  return session;
}

test('startTest', () => {
  const { unit } = setup();
  const session = game.startTest(unit, IN_ORDER);
  assert.deepEqual([session.kind, session.lessonId, session.queue, session.total, session.hearts], ['test', null, ['t1', 't2', 't3', 't4', 't5'], 5, 5]);
  assert.deepEqual(game.startTest(unit).queue.slice().sort(), ['t1', 't2', 't3', 't4', 't5']);
  assert.equal(game.startTest(makeUnit(), IN_ORDER), null);
});

test('a perfect test', () => {
  const ctx = setup();
  const session = take(ctx, []);
  assert.deepEqual([session.status, game.testScore(session), game.testPassed(session), session.perfect], ['complete', 100, true, true]);
  assert.deepEqual([ctx.save.xp, session.xpEarned, session.hearts], [100, 100, 5]);
  assert.deepEqual([ctx.save.progress.u1.testBest, ctx.save.progress.u1.review, ctx.save.streak], [100, [], 1]);
});

test('answers move on at once, with no requeue and no wait', () => {
  const ctx = setup();
  const session = game.startTest(ctx.unit, IN_ORDER);
  const result = game.submitAnswer(ctx.save, ctx.unit, session, 0, TODAY);
  assert.equal(result.correct, false);
  assert.deepEqual([session.queue, session.awaitingContinue, session.hearts], [['t2', 't3', 't4', 't5'], false, 5]);
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, session, '   ', TODAY), null);
  assert.equal(session.queue.length, 4);
});

test('80 percent passes and 60 does not', () => {
  const pass = setup();
  const passed = take(pass, ['t2']);
  assert.deepEqual([game.testScore(passed), game.testPassed(passed), pass.save.xp, passed.perfect], [80, true, 90, false]);
  assert.deepEqual([pass.save.progress.u1.review, passed.missed, pass.save.progress.u1.testBest], [['t2'], ['t2'], 80]);
  const fail = setup();
  const failed = take(fail, ['t2', 't4']);
  assert.deepEqual([failed.status, game.testScore(failed), game.testPassed(failed), fail.save.xp], ['complete', 60, false, 30]);
  assert.deepEqual([fail.save.progress.u1.testBest, fail.save.streak], [60, 1]);
});

test('the best score is kept, and an old save without one gets it', () => {
  const ctx = setup();
  delete ctx.save.progress.u1.testBest;
  take(ctx, []);
  take(ctx, ['t2', 't3']);
  assert.equal(ctx.save.progress.u1.testBest, 100);
});

test('skip counts as wrong, and only in a test', () => {
  const ctx = setup();
  const session = game.startTest(ctx.unit, IN_ORDER);
  const skipped = game.skipQuestion(ctx.save, ctx.unit, session, TODAY);
  assert.deepEqual([skipped.correct, skipped.question.id], [false, 't1']);
  assert.deepEqual([session.queue.length, session.missed, ctx.save.progress.u1.review], [4, ['t1'], ['t1']]);
  const lesson = game.startLesson(ctx.unit, 'a1');
  assert.equal(game.skipQuestion(ctx.save, ctx.unit, lesson, TODAY), null);
  assert.deepEqual(lesson.queue, ['q1', 'q2']);
});

test('isTestUnlocked', () => {
  const unit = makeRichUnit();
  assert.equal(game.isTestUnlocked(unit, { completedLessons: ['a1', 'a2'], review: [] }), false);
  assert.equal(game.isTestUnlocked(unit, { completedLessons: ['a1', 'a2', 'b1'], review: [] }), true);
  assert.equal(game.isTestUnlocked(makeUnit(), { completedLessons: ['a1', 'a2', 'b1'], review: [] }), false);
});
