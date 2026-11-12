const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const game = require('../js/game.js');
const { makeUnit, makeSave, makeRichUnit } = require('./fixtures.js');
const { makeEnv } = require('./fake-page.js');

const KEY = 'algebraQuest.v1';
const stored = env => JSON.parse(env.ls.data[KEY]);
const today = () => game.localDateString(new Date());

function envWith(unit, change) {
  const save = makeSave(unit);
  if (change) change(save);
  return makeEnv(storage.serialize(save));
}

// Answers the plain fixture unit's questions right. q1 is a choice with answer 1.
function answerRight(env) {
  const html = env.html();
  if (/P q1/.test(html)) env.click('choose', { 'data-index': '1' });
  else if (/P q2/.test(html)) env.answerBox.value = '7';
  else if (/P q3/.test(html)) env.answerBox.value = '1/2';
  else if (/P q4/.test(html)) env.answerBox.value = '3, -3';
  env.click('check');
  env.click('continue');
}

test('home shows the new parts', () => {
  const env = envWith(makeUnit());
  const html = env.html();
  for (const marker of ['rank-title', 'goal-ring', 'week-days', 'data-action="resume"', 'path-row', 'open-badges', 'toggle-theme']) {
    assert.ok(html.includes(marker), marker);
  }
  assert.equal(env.theme(), 'light');
});

test('continue starts the next lesson, then review when lessons are done', () => {
  const env = envWith(makeUnit(), save => { save.progress.u1.completedLessons = ['a1']; });
  env.click('resume');
  assert.match(env.html(), /P q3/);
  env.click('home');

  const done = envWith(makeUnit(), save => {
    save.progress.u1.completedLessons = ['a1', 'a2', 'b1'];
    save.progress.u1.review = ['q4'];
  });
  done.click('resume');
  assert.match(done.html(), /P q4/);
});

test('continue starts the final test once every lesson is done', () => {
  const env = envWith(makeRichUnit(), save => { save.progress.u1.completedLessons = ['a1', 'a2', 'b1']; });
  env.click('resume');
  assert.match(env.html(), /Question 1 of 5/);
});

test('the goal button cycles the goal and saves it', () => {
  const env = envWith(makeUnit());
  env.click('cycle-goal');
  assert.equal(stored(env).settings.goal, 200);
  assert.match(env.html(), /Goal: 200 XP/);
  env.click('cycle-goal');
  env.click('cycle-goal');
  assert.equal(stored(env).settings.goal, 50);
});

test('dark mode is saved and set on the page', () => {
  const env = envWith(makeUnit());
  env.click('toggle-theme');
  assert.equal(stored(env).settings.theme, 'dark');
  assert.equal(env.theme(), 'dark');
  assert.match(env.html(), /Dark mode: on/);
  env.click('toggle-theme');
  assert.equal(env.theme(), 'light');

  const saved = envWith(makeUnit(), save => { save.settings.theme = 'dark'; });
  assert.equal(saved.theme(), 'dark');
});

test('the badges screen opens from home and Home returns', () => {
  const env = envWith(makeUnit());
  env.click('open-badges');
  assert.match(env.html(), /badges-screen/);
  assert.match(env.html(), /0 of 12/);
  env.click('home');
  assert.match(env.html(), /data-action="resume"/);
});

test('badges already earned are recorded when the app opens, without a message', () => {
  const env = envWith(makeUnit(), save => {
    save.progress.u1.completedLessons = ['a1', 'a2'];
    save.streak = 3;
    save.lastStudyDate = today();
  });
  assert.deepEqual(Object.keys(stored(env).badges).sort(), ['first-lesson', 'level', 'streak-3']);
  assert.equal(stored(env).badges.level, today());
  assert.doesNotMatch(env.html(), /New badge/);
  assert.match(env.html(), /Badges \(3\/12\)/);
});

test('finishing a lesson shows new badges and a rank up, and saves the day', () => {
  const env = envWith(makeUnit(), save => { save.xp = 80; });
  env.click('start-lesson', { 'data-lesson-id': 'a1' });
  answerRight(env);
  answerRight(env);
  const html = env.html();
  assert.match(html, /Lesson complete!/);
  assert.match(html, /Rank up!/);
  assert.match(html, /Rank 2 · Rookie/);
  assert.match(html, /New badges!/);
  assert.match(html, /First steps/);
  assert.match(html, /Flawless/);
  const save = stored(env);
  assert.deepEqual(Object.keys(save.badges).sort(), ['first-lesson', 'perfect']);
  assert.deepEqual(save.days[today()], { xp: 50, studied: true });

  env.click('home');
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  answerRight(env);
  assert.match(env.html(), /New badge!/);
  assert.match(env.html(), /Level cleared/);
  assert.doesNotMatch(env.html(), /Rank up!|Flawless/);
});

test('running out of hearts can still show a rank up', () => {
  const env = envWith(makeUnit(), save => { save.xp = 95; });
  env.click('start-lesson', { 'data-lesson-id': 'a1' });
  answerRight(env);
  for (let i = 0; i < 5; i++) {
    env.answerBox.value = 'wrong';
    env.click('check');
    env.click('continue');
  }
  assert.match(env.html(), /Out of hearts/);
  assert.match(env.html(), /Rank up!/);
});

test('a perfect final test earns its badges on the result screen', () => {
  const env = envWith(makeRichUnit(), save => { save.progress.u1.completedLessons = ['a1', 'a2', 'b1']; });
  env.click('start-test');
  for (let n = 0; n < 5; n++) {
    const html = env.html();
    const id = html.match(/T (t\d)/)[1];
    if (id === 't1') env.click('choose', { 'data-index': '1' });
    else env.answerBox.value = id.slice(1);
    env.click('check');
  }
  assert.match(env.html(), /100%/);
  assert.match(env.html(), /Test passed/);
  assert.match(env.html(), /Perfect score/);
  assert.deepEqual(['test-pass', 'test-100'].every(id => id in stored(env).badges), true);
});
