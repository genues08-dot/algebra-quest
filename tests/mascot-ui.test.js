const test = require('node:test');
const assert = require('node:assert/strict');
const views = require('../js/views.js');
const storage = require('../js/storage.js');
const mascot = require('../js/mascot.js');
const { makeUnit, makeSave, makeRichUnit } = require('./fixtures.js');
const { makeEnv } = require('./fake-page.js');

const KEY = 'algebraQuest.v1';
const TODAY = '2026-11-12';
const stored = env => JSON.parse(env.ls.data[KEY]);
const count = (html, text) => html.split(text).length - 1;

function envWith(unit, change) {
  const save = makeSave(unit);
  if (change) change(save);
  return makeEnv(storage.serialize(save));
}

// ----- Views -----

test('mascotHtml escapes the name and line and picks the image', () => {
  const html = views.mascotHtml({ color: 'blue', name: '<Gil>', mood: 'cheer', line: 'a < b', size: 'small' });
  assert.match(html, /src="img\/axl\/blue-cheer\.png"/);
  assert.match(html, /alt="&lt;Gil&gt;"/);
  assert.match(html, /a &lt; b/);
  assert.match(html, /class="mascot mascot-small mascot-cheer"/);
  assert.doesNotMatch(html, /data-action="mascot-tap"/);
  const tappable = views.mascotHtml({ color: 'pink', name: 'Axl', mood: 'happy', line: 'Hi', size: 'big', tap: true });
  assert.match(tappable, /data-action="mascot-tap"/);
  assert.match(tappable, /aria-label="Talk to Axl"/);
});

test('home shows the mascot with its home line, and Profile has the Mascot button', () => {
  const save = makeSave(makeUnit());
  save.settings.mascot = { color: 'purple', name: 'Gilly' };
  const model = views.homeModel(save, TODAY);
  const html = views.homeHtml(model);
  assert.match(html, /img\/axl\/purple-happy\.png/);
  assert.match(html, /Ready\? Next up: Level A!/);
  assert.match(views.profileHtml(model), /data-action="open-mascot"/);
  assert.match(views.profileHtml(model), /Gilly/);
  const empty = views.homeHtml(views.homeModel(storage.newSave(), TODAY));
  assert.match(empty, /Hi, I&#39;m Axl! Import a unit/);
});

test('feedback, teaching cards, and result screens show the mascot when given one', () => {
  const m = { color: 'pink', name: 'Axl' };
  const right = views.feedbackHtml({ correct: true, solution: 's', mascot: Object.assign({ line: 'YESSS!' }, m) });
  assert.match(right, /pink-cheer\.png/);
  assert.match(right, /YESSS!/);
  const wrong = views.feedbackHtml({ correct: false, solution: 's', mascot: Object.assign({ line: 'Shake it off!' }, m) });
  assert.match(wrong, /pink-encourage\.png/);
  assert.doesNotMatch(views.feedbackHtml({ correct: true, solution: 's' }), /mascot/);

  const card = views.teachHtml({ title: 'T', text: ['p'], index: 0, total: 2, fromNotes: false, mascot: m });
  assert.match(card, /pink-think\.png/);
  assert.match(card, /Here&#39;s the trick!/);

  assert.match(views.completeHtml({ xpEarned: 40, accuracy: 100, perfect: true, mascot: m }), /PERFECT! Not a single mistake!/);
  assert.match(views.failedHtml({ missed: [], mascot: m }), /pink-encourage\.png/);
  assert.match(views.testResultHtml({ score: 90, passed: true, xpEarned: 90, missed: [], mascot: m }), /YOU PASSED!/);
  assert.match(views.testResultHtml({ score: 50, passed: false, xpEarned: 50, missed: [], mascot: m }), /So close!/);
});

test('the Mascot screen marks the chosen color and holds the name', () => {
  const html = views.mascotScreenHtml({ color: 'blue', name: 'Gil "G"' });
  assert.equal(count(html, 'data-action="mascot-color"'), 3);
  assert.match(html, /data-color="blue"[^>]*aria-pressed="true"/);
  assert.match(html, /data-color="pink"[^>]*aria-pressed="false"/);
  assert.match(html, /data-role="mascot-name"[^>]*maxlength="16"[^>]*value="Gil &quot;G&quot;"/);
  assert.match(html, /data-action="mascot-name"/);
  assert.match(html, /data-action="home"/);
});

// ----- UI -----

test('tapping the mascot shows a hype line, and home gets its own line back later', () => {
  const env = envWith(makeUnit());
  const original = Math.random;
  Math.random = () => 0;
  try {
    env.click('mascot-tap');
  } finally {
    Math.random = original;
  }
  assert.ok(env.html().includes(views.escapeHtml(mascot.LINES.tap[0])));
  assert.match(env.html(), /mascot-bounce/);
  env.click('open-badges');
  env.click('home');
  assert.match(env.html(), /Ready\? Next up: Level A!/);
});

test('the Mascot screen saves a color and a name', () => {
  const env = envWith(makeUnit());
  env.click('open-mascot');
  assert.match(env.html(), /data-role="mascot-name"/);
  env.click('mascot-color', { 'data-color': 'blue' });
  assert.equal(stored(env).settings.mascot.color, 'blue');
  assert.match(env.html(), /data-color="blue"[^>]*aria-pressed="true"/);

  env.nameBox.value = '  Gilly ';
  env.click('mascot-name');
  assert.equal(stored(env).settings.mascot.name, 'Gilly');
  env.nameBox.value = 'Squiggle';
  env.key('Enter', 'mascot-name');
  assert.equal(stored(env).settings.mascot.name, 'Squiggle');

  env.nameBox.value = '   ';
  env.click('mascot-name');
  assert.equal(stored(env).settings.mascot.name, 'Squiggle');
  assert.match(env.html(), /Type a name for your axolotl/);

  env.click('home');
  assert.match(env.html(), /img\/axl\/blue-happy\.png/);
  env.click('mascot-color', { 'data-color': 'green' });
  assert.equal(stored(env).settings.mascot.color, 'blue');
});

test('lesson feedback cheers or encourages, and the line stays put on redraw', () => {
  const env = envWith(makeUnit(), save => { save.settings.mascot = { color: 'purple', name: 'Axl' }; });
  env.click('start-lesson', { 'data-lesson-id': 'a1' });
  env.click('choose', { 'data-index': '0' });
  env.click('check');
  assert.match(env.html(), /purple-encourage\.png/);
  const line = env.html().match(/class="mascot-bubble">([^<]*)</)[1];
  assert.ok(mascot.LINES.wrong.map(views.escapeHtml).includes(line));
  env.click('continue');
  env.answerBox.value = '7';
  env.click('check');
  assert.match(env.html(), /purple-cheer\.png/);
});

test('teaching cards show the thinking mascot, and the final test shows none', () => {
  const env = envWith(makeRichUnit());
  env.click('start-lesson', { 'data-lesson-id': 'a1' });
  assert.match(env.html(), /pink-think\.png/);

  const test = envWith(makeRichUnit(), save => { save.progress.u1.completedLessons = ['a1', 'a2', 'b1']; });
  test.click('start-test');
  test.answerBox.value = '1';
  test.click('choose', { 'data-index': '0' });
  test.click('check');
  assert.doesNotMatch(test.html(), /img\/axl\//);
});

test('result screens show the mascot', () => {
  const env = envWith(makeUnit());
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  env.answerBox.value = '1/2';
  env.click('check');
  env.click('continue');
  assert.match(env.html(), /Lesson complete!/);
  assert.match(env.html(), /pink-cheer\.png/);
  assert.match(env.html(), /PERFECT! Not a single mistake!/);
});

test('the name box keeps what was typed when a color is picked or the name is refused', () => {
  const env = envWith(makeUnit());
  env.click('open-mascot');
  env.nameBox.value = 'Bubbles';
  env.click('mascot-color', { 'data-color': 'purple' });
  assert.match(env.html(), /data-role="mascot-name"[^>]*value="Bubbles"/);
  env.click('mascot-name');
  assert.equal(stored(env).settings.mascot.name, 'Bubbles');

  env.nameBox.value = '';
  env.key('Enter', 'mascot-name');
  assert.match(env.html(), /Type a name/);
  assert.match(env.html(), /data-role="mascot-name"[^>]*value=""/);
  assert.equal(stored(env).settings.mascot.name, 'Bubbles');

  env.click('home');
  env.click('open-mascot');
  assert.match(env.html(), /data-role="mascot-name"[^>]*value="Bubbles"/);
});
