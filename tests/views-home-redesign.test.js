const test = require('node:test');
const assert = require('node:assert/strict');
const views = require('../js/views.js');
const storage = require('../js/storage.js');
const { makeUnit, makeSave, makeRichUnit } = require('./fixtures.js');

const TODAY = '2026-11-12';
const tag = (html, marker) => html.match(new RegExp('<[a-z]+[^>]*' + marker + '[^>]*>'))[0];
const count = (html, text) => html.split(text).length - 1;
const home = (save) => views.homeHtml(views.homeModel(save, TODAY));
const profile = (save) => views.profileHtml(views.homeModel(save, TODAY));
const more = (save) => views.moreHtml(views.homeModel(save, TODAY));

function richSave(change) {
  const save = makeSave(makeRichUnit());
  if (change) change(save);
  return save;
}

test('stats bar and Profile: rank title, goal ring, and goal button', () => {
  const change = save => {
    save.xp = 520;
    save.days = { [TODAY]: { xp: 40, studied: false } };
  };
  const bar = home(richSave(change));
  assert.match(bar, /class="stat stat-rank tier-3"/);
  assert.match(bar, /aria-label="Rank 6, Solver"/);
  assert.match(bar, /aria-label="40 of 100 XP today"/);
  const html = profile(richSave(change));
  assert.match(html, /<span class="rank-title tier-3">Solver<\/span>/);
  assert.match(html, /Rank 6/);
  assert.match(html, /aria-label="40 of 100 XP today"/);
  assert.match(html, /XP today/);
  assert.match(tag(html, 'data-action="cycle-goal"'), /class="[^"]*"/);
  assert.match(html, /data-action="cycle-goal"[^>]*>Goal: 100 XP</);
  assert.doesNotMatch(html, /goal-met/);
});

test('goal ring: met at the goal, and never drawn past full', () => {
  const met = profile(richSave(save => {
    save.settings.goal = 50;
    save.days = { [TODAY]: { xp: 120, studied: true } };
  }));
  assert.match(met, /goal-met/);
  assert.match(met, /Goal met!/);
  assert.match(met, /stroke-dashoffset="0"/);
  const empty = profile(richSave());
  assert.match(empty, /aria-label="0 of 100 XP today"/);
});

test('week strip: seven days with letters, studied days filled, today marked', () => {
  const html = profile(richSave(save => {
    save.days = { '2026-11-10': { xp: 50, studied: true }, [TODAY]: { xp: 10, studied: true } };
  }));
  assert.equal((html.match(/class="day( [^"]*)?"/g) || []).length, 7);
  assert.equal(count(html, 'day-studied'), 2);
  assert.equal(count(html, 'day-today'), 1);
  assert.match(html, /<span class="day-letter">F<\/span>/);
  assert.match(html, /aria-label="Thursday, today: studied"/);
  assert.match(html, /aria-label="Friday: not studied"/);
});

test('continue button: the next lesson, then the test, then review, then done', () => {
  const lesson = home(richSave(save => { save.progress.u1.completedLessons = ['a1']; }));
  assert.match(lesson, /data-action="resume"/);
  assert.match(lesson, /Level 1 · Lesson 2: Level A/);

  const testNext = home(richSave(save => { save.progress.u1.completedLessons = ['a1', 'a2', 'b1']; }));
  assert.match(testNext, /data-action="resume"[^>]*>[^]*?Take the final test/);

  const review = home(richSave(save => {
    save.progress.u1.completedLessons = ['a1', 'a2', 'b1'];
    save.progress.u1.testBest = 90;
    save.progress.u1.review = ['q1', 'q2', 'q3'];
  }));
  assert.match(review, /Review missed questions \(3\)/);

  const done = home(richSave(save => {
    save.progress.u1.completedLessons = ['a1', 'a2', 'b1'];
    save.progress.u1.testBest = 90;
  }));
  assert.doesNotMatch(done, /data-action="resume"/);
  assert.match(done, /Unit complete!/);
});

test('winding path: nodes zigzag across the whole unit', () => {
  const html = home(richSave(save => { save.progress.u1.completedLessons = ['a1']; }));
  const shifts = [...html.matchAll(/class="path-spot" style="--shift:(-?\d+)"/g)].map(match => Number(match[1]));
  assert.deepEqual(shifts, [0, 1, 2, 1, 0]); // a1, a2, the chest, b1, the trophy
});

test('winding path: done, next, open and locked nodes', () => {
  const html = home(richSave(save => { save.progress.u1.completedLessons = ['a1']; }));
  const done = tag(html, 'data-lesson-id="a1"');
  assert.match(done, /data-action="start-lesson"/);
  assert.match(done, /node-done/);
  assert.match(done, /aria-label="Level A, lesson 1, complete, 1 of 3 stars"/);
  const next = tag(html, 'data-lesson-id="a2"');
  assert.match(next, /node-next/);
  assert.match(next, /aria-label="Level A, lesson 2, start here"/);
  assert.match(html, /<span class="node-start">Start<\/span>/);
  const locked = tag(html, 'data-lesson-id="b1"');
  assert.match(locked, /node-locked/);
  assert.match(locked, /disabled/);
  assert.match(locked, /aria-label="Level B, lesson 1, locked"/);
  assert.equal(count(html, 'data-lesson-id='), 3);
});

test('winding path: level headings keep their state labels', () => {
  const html = home(richSave(save => { save.progress.u1.completedLessons = ['a1', 'a2']; }));
  assert.match(html, /class="path-level level-complete lc-0"/);
  assert.match(html, /class="path-level level-open lc-1"/);
  assert.match(html, /<span class="level-state">Complete &#10003;<\/span>/);
});

test('winding path: the final test is a trophy node at the end', () => {
  const html = home(richSave());
  const trophy = tag(html, 'data-action="start-test"');
  assert.match(trophy, /node-trophy/);
  assert.match(trophy, /disabled/);
  assert.match(html, /Not taken yet/);
  assert.equal(home(makeSave(makeUnit())).includes('node-trophy'), false);
});

test('Profile counts badges, and More has the dark mode button', () => {
  const html = profile(richSave(save => { save.badges = { 'first-lesson': TODAY, perfect: TODAY }; }));
  assert.match(html, /2\/12/);
  assert.match(more(richSave()), /data-action="toggle-theme"[^]*?Dark mode: off</);
  assert.match(more(richSave(save => { save.settings.theme = 'dark'; })), /data-action="toggle-theme"[^]*?Dark mode: on</);
  const empty = home(storage.newSave());
  for (const action of ['open-badges', 'open-profile', 'open-more']) {
    assert.match(empty, new RegExp('data-action="' + action + '"'));
  }
  assert.doesNotMatch(empty, /data-action="resume"/);
});

test('badges screen: earned in color with a date, the rest show how to earn them', () => {
  const save = richSave(save => { save.badges = { perfect: '2026-11-03' }; });
  const html = views.badgesHtml(views.badgesModel(save));
  assert.match(html, /data-action="home"/);
  assert.match(html, /1 of 12/);
  assert.equal(count(html, 'class="badge '), 12);
  assert.equal(count(html, 'badge-earned'), 1);
  assert.match(html, /Flawless[^]*?Earned Nov 3, 2026/);
  assert.match(html, /First steps[^]*?Finish your first lesson\./);
});

test('result screens show rank up and new badges', () => {
  const news = {
    rankUp: { rank: 5, name: 'Solver', tier: 3 },
    newBadges: [{ id: 'perfect', name: 'Flawless', how: 'Finish a lesson or review with no mistakes.' }]
  };
  const complete = views.completeHtml(Object.assign({ xpEarned: 40, accuracy: 100, perfect: true }, news));
  assert.match(complete, /Rank up!/);
  assert.match(complete, /Rank 5 · Solver/);
  assert.match(complete, /class="rank-up tier-3"/);
  assert.match(complete, /New badge!/);
  assert.match(complete, /Flawless/);
  const failed = views.failedHtml(Object.assign({ missed: [] }, news));
  assert.match(failed, /Rank up!/);
  const result = views.testResultHtml(Object.assign({ score: 90, passed: true, xpEarned: 90, missed: [] }, news,
    { newBadges: news.newBadges.concat([{ id: 'test-pass', name: 'Test passed', how: 'x' }]) }));
  assert.match(result, /New badges!/);
  const quiet = views.completeHtml({ xpEarned: 40, accuracy: 100, perfect: true });
  assert.doesNotMatch(quiet, /Rank up!|New badge/);
});
