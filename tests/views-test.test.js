const test = require('node:test');
const assert = require('node:assert/strict');
const views = require('../js/views.js');
const TODAY = '2026-11-12';
const storage = require('../js/storage.js');
const { makeRichUnit, makeSave } = require('./fixtures.js');

const tag = (html, marker) => html.match(new RegExp('<[a-z]+[^>]*' + marker + '[^>]*>'))[0];
const has = (html, action) => html.includes('data-action="' + action + '"');
function richSave(change) {
  const save = makeSave(makeRichUnit());
  if (change) change(save);
  return save;
}

test('homeModel: test entry and sound', () => {
  assert.deepEqual(views.homeModel(richSave(), TODAY).test, { state: 'locked', best: null });
  const done = richSave(save => { save.progress.u1.completedLessons = ['a1', 'a2', 'b1']; save.progress.u1.testBest = 85; });
  assert.deepEqual(views.homeModel(done, TODAY).test, { state: 'open', best: 85 });
  assert.equal(views.homeModel(richSave(), TODAY).soundOn, true);
  assert.equal(views.homeModel(richSave(save => { save.settings.sound = false; }), TODAY).soundOn, false);
  assert.equal(views.homeModel(storage.newSave(), TODAY).test, null);
});

test('homeHtml: final test entry', () => {
  const locked = views.homeHtml(views.homeModel(richSave(), TODAY));
  assert.match(locked, /Final test/);
  assert.match(locked, /Not taken yet/);
  assert.match(tag(locked, 'data-action="start-test"'), /disabled/);
  const open = views.homeHtml(views.homeModel(richSave(save => { save.progress.u1.completedLessons = ['a1', 'a2', 'b1']; save.progress.u1.testBest = 85; }), TODAY));
  assert.doesNotMatch(tag(open, 'data-action="start-test"'), /disabled/);
  assert.match(open, /Best: 85%/);
});

test('homeHtml: sound button, with and without units', () => {
  assert.match(views.moreHtml(views.homeModel(richSave(), TODAY)), /data-action="toggle-sound"[^]*?Sound: on</);
  assert.match(views.moreHtml(views.homeModel(richSave(save => { save.settings.sound = false; }), TODAY)), /data-action="toggle-sound"[^]*?Sound: off</);
  assert.equal(has(views.moreHtml(views.homeModel(storage.newSave(), TODAY)), 'toggle-sound'), true);
  assert.equal(has(views.homeHtml(views.homeModel(storage.newSave(), TODAY)), 'start-test'), false);
  assert.equal(has(views.practiceHtml(views.homeModel(storage.newSave(), TODAY)), 'start-test'), false);
});

test('lessonHtml: test mode shows no hearts, hint, or Notes', () => {
  const html = views.lessonHtml({
    mode: 'test', done: 2, total: 20, hearts: 5, maxHearts: 5, prompt: 'Solve it', type: 'input',
    choices: null, selected: null, hint: 'SECRET HINT', hintVisible: true, hasNotes: true, calculatorAllowed: true, calculatorPanel: null
  });
  assert.match(html, /Question 3 of 20/);
  assert.doesNotMatch(html, /hearts|SECRET HINT/);
  assert.equal(has(html, 'hint') || has(html, 'notes'), false);
  assert.match(html, /data-action="check"[^>]*>Submit</);
  for (const action of ['skip', 'quit', 'calc-open']) assert.equal(has(html, action), true);
});

test('testResultHtml', () => {
  const passed = views.testResultHtml({ score: 85, passed: true, xpEarned: 220, missed: [{ prompt: 'a < b', solution: 'c & d' }] });
  assert.match(passed, /85%/);
  assert.match(passed, /Passed/);
  assert.match(passed, /\+220 XP/);
  assert.match(passed, /a &lt; b/);
  assert.match(passed, /c &amp; d/);
  for (const action of ['retry', 'home']) assert.equal(has(passed, action), true);
  assert.match(passed, /data-action="retry"[^>]*>Retake</);
  const failed = views.testResultHtml({ score: 60, passed: false, xpEarned: 120, missed: [] });
  assert.match(failed, /Not passed yet\. You need 80%\./);
  assert.doesNotMatch(failed, /Passed/);
  assert.match(views.testResultHtml({ score: 100, passed: true, xpEarned: 250, missed: [] }), /You got every question right\./);
});
