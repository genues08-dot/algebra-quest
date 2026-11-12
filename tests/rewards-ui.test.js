const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const game = require('../js/game.js');
const rewards = require('../js/rewards.js');
const views = require('../js/views.js');
const { makeUnit, makeSave } = require('./fixtures.js');
const { makeEnv } = require('./fake-page.js');

const KEY = 'algebraQuest.v1';
const stored = env => JSON.parse(env.ls.data[KEY]);
const today = () => game.localDateString(new Date());

function fourLessonUnit() {
  const unit = makeUnit();
  const q = (id, answer) => ({ id, type: 'input', prompt: 'P ' + id, hint: 'h', solution: 's', answers: [answer] });
  unit.levels[0].lessons.push({ id: 'a3', questions: [q('q5', '5')] }, { id: 'a4', questions: [q('q6', '6')] });
  return unit;
}
const envWith = (unit, change) => {
  const save = makeSave(unit);
  if (change) change(save);
  return makeEnv(storage.serialize(save));
};

test('a ready chest on the path opens for gems and shows the reward screen', () => {
  const env = envWith(fourLessonUnit(), save => { save.progress.u1.completedLessons = ['a1', 'a2']; });
  assert.match(env.html(), /class="node node-chest chest-ready" data-action="open-chest" data-level="0"/);
  env.click('open-chest', { 'data-level': '0' });
  assert.match(env.html(), /Chest opened!/);
  assert.match(env.html(), /\+15 &#128142;/);
  assert.match(env.html(), /class="confetti"/);
  assert.equal(stored(env).gems, 15);
  env.click('home');
  assert.match(env.html(), /chest-open/);
  env.click('open-chest', { 'data-level': '0' });
  assert.equal(stored(env).gems, 15);
});

test('the stats bar shows gems and opens the Shop; buying a freeze and a hat', () => {
  const env = envWith(makeUnit(), save => { save.gems = 120; });
  assert.match(env.html(), /aria-label="120 gems, open the shop"/);
  env.click('open-shop');
  assert.match(env.html(), /class="tab-screen shop"/);
  env.click('buy-freeze');
  assert.deepEqual([stored(env).gems, stored(env).freezes], [70, 1]);
  assert.match(env.html(), /Streak freeze added!/);
  env.click('buy-hat', { 'data-hat': 'party' });
  assert.deepEqual(stored(env).outfits, { owned: ['party'], worn: 'party' });
  assert.match(env.html(), /class="axl-hat"/);
  env.click('wear-hat', { 'data-hat': 'party' });
  assert.equal(stored(env).outfits.worn, null);
  env.click('buy-hat', { 'data-hat': 'crown' });
  assert.equal(stored(env).gems, 40);
  env.click('home');
  assert.match(env.html(), /stat-freeze/);
});

test('a worn hat shows on the axolotl on home, Profile, and lesson feedback', () => {
  const env = envWith(makeUnit(), save => { save.outfits = { owned: ['crown'], worn: 'crown' }; });
  assert.match(env.html(), /path-axl[^]*?class="axl-hat"/);
  env.click('open-profile');
  assert.match(env.html(), /profile-head[^]*?class="axl-hat"/);
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  env.answerBox.value = '1/2';
  env.click('check');
  assert.match(env.html(), /feedback[^]*?class="axl-hat"/);
});

test('the Quests tab claims a finished quest, the week reward, and the challenge', () => {
  const quests = rewards.questsFor(today());
  const env = envWith(makeUnit(), save => {
    save.days = { [today()]: { xp: 500, studied: true } };
    save.daily = { date: today(), lessons: 3, perfect: 2, correct: 30, bestCombo: 9, practice: 2, claimed: [] };
  });
  assert.match(env.html(), /class="tab-dot"/);
  env.click('open-quests');
  assert.match(env.html(), /Daily quests/);
  assert.match(env.html(), /h left/);
  env.click('claim-quest', { 'data-quest': quests[0].id });
  assert.equal(stored(env).gems, quests[0].gems);
  assert.match(env.html(), new RegExp('\\+' + quests[0].gems + ' gems!'));
  env.click('claim-week');
  env.click('claim-challenge');
  assert.equal(stored(env).gems, quests[0].gems + 5 + 30);
  env.click('claim-week');
  assert.equal(stored(env).gems, quests[0].gems + 5 + 30);
});

test('Practice starts a Unit Rewind with a combo, and it ends with the bonus', () => {
  const env = envWith(makeUnit(), save => { save.progress.u1.completedLessons = ['a2']; });
  env.click('open-practice');
  assert.match(env.html(), /Unit Rewind/);
  env.click('start-rewind');
  assert.match(env.html(), /P q3/);
  env.answerBox.value = '1/2';
  env.click('check');
  assert.match(env.html(), /\+10 XP/);
  env.click('continue');
  assert.match(env.html(), /Lesson complete!/);
  assert.match(env.html(), /\+60 XP/);
});

test('the feedback panel shows a combo from 3 in a row, with the bonus XP on the 5th', () => {
  const html = views.feedbackHtml({ correct: true, solution: 's', combo: 5, xp: 15 });
  assert.match(html, /5 in a row!/);
  assert.match(html, /\+15 XP/);
  assert.doesNotMatch(views.feedbackHtml({ correct: true, solution: 's', combo: 2, xp: 10 }), /in a row/);
  assert.doesNotMatch(views.feedbackHtml({ correct: false, solution: 's', combo: 0, xp: 0 }), /XP|in a row/);
});

test('a Speed Round runs without feedback and shows its result when time is up', () => {
  const env = envWith(makeUnit(), save => { save.progress.u1.completedLessons = ['a1', 'a2']; });
  env.click('open-practice');
  env.click('start-speed');
  assert.match(env.html(), /speed-bar/);
  assert.doesNotMatch(env.html(), /data-action="hint"/);
  const realNow = Date.now;
  try {
    const html = env.html();
    if (/P q1/.test(html)) env.click('choose', { 'data-index': '1' });
    else env.answerBox.value = /P q2/.test(html) ? '7' : '1/2';
    env.click('check');
    assert.doesNotMatch(env.html(), /Correct!|Not quite/);
    assert.match(env.html(), /&#9989; 1/);
    Date.now = () => realNow() + 61000;
    env.answerBox.value = 'whatever';
    env.click('choose', { 'data-index': '0' });
    env.click('check');
  } finally {
    Date.now = realNow;
  }
  assert.match(env.html(), /Speed Round/);
  assert.match(env.html(), /right in 60 seconds/);
  assert.match(env.html(), /New best!/);
  assert.equal(stored(env).progress.u1.speedBest, 1);
  env.click('home');
  assert.match(env.html(), /statsbar/);
});

test('a missed day is covered by a streak freeze, with a message', () => {
  const twoDaysAgo = game.addDays(today(), -2);
  const env = envWith(makeUnit(), save => {
    save.streak = 4;
    save.lastStudyDate = twoDaysAgo;
    save.freezes = 1;
  });
  assert.match(env.html(), /Streak freeze used!/);
  assert.match(env.html(), /Your 4-day streak is safe/);
  assert.deepEqual([stored(env).streak, stored(env).freezes], [4, 0]);
  env.click('home');
  env.click('open-profile');
  assert.match(env.html(), /day-frozen/);
});

test('Profile shows gems, freezes, best combo, Speed Round best, and a Shop button', () => {
  const env = envWith(makeUnit(), save => { save.gems = 42; save.freezes = 2; save.bestCombo = 7; save.progress.u1.speedBest = 9; });
  env.click('open-profile');
  const html = env.html();
  for (const text of ['&#128142; 42', '&#10052; 2', 'best combo', 'Speed Round best', 'data-action="open-shop"']) {
    assert.ok(html.includes(text), text);
  }
});
