const test = require('node:test');
const assert = require('node:assert/strict');
const views = require('../js/views.js');
const TODAY = '2026-11-12';
const storage = require('../js/storage.js');
const game = require('../js/game.js');
const { makeUnit, makeSave } = require('./fixtures.js');

const tag = (html, marker) => html.match(new RegExp('<[a-z]+[^>]*' + marker + '[^>]*>'))[0];
function busySave() {
  const unit = makeUnit();
  unit.title = 'Unit <1>';
  const save = makeSave(unit);
  save.xp = 250;
  save.streak = 4;
  save.lastStudyDate = '2026-11-11';
  save.days = { [TODAY]: { xp: 30, studied: false } };
  save.badges = { 'first-lesson': '2026-11-11' };
  save.progress.u1 = { completedLessons: ['a1'], review: ['q2', 'q4'] };
  return save;
}

test('escapeHtml', () => {
  assert.equal(views.escapeHtml('x < 5 & y > "2" \'z\''), 'x &lt; 5 &amp; y &gt; &quot;2&quot; &#39;z&#39;');
});

test('homeModel', () => {
  const save = busySave();
  assert.deepEqual(views.homeModel(save, TODAY), {
    rank: 3, xpIntoRank: 50, xpPerRank: 100, streak: 4, title: { name: 'Learner', tier: 2 },
    todayXp: 30, goal: 100, week: game.weekStrip(save, TODAY),
    units: [{ id: 'u1', title: 'Unit <1>' }], currentUnitId: 'u1', reviewCount: 2, test: null,
    next: { kind: 'lesson', lessonId: 'a2', levelNumber: 1, lessonNumber: 2, levelTitle: 'Level A' },
    soundOn: true, darkOn: false, badgeCount: 1, badgeTotal: 12,
    levels: [
      { title: 'Level A', state: 'open', lessons: [
        { id: 'a1', number: 1, complete: true, next: false },
        { id: 'a2', number: 2, complete: false, next: true }] },
      { title: 'Level B', state: 'locked', lessons: [{ id: 'b1', number: 1, complete: false, next: false }] }
    ]
  });
  const fresh = storage.newSave();
  assert.deepEqual(views.homeModel(fresh, TODAY), {
    rank: 1, xpIntoRank: 0, xpPerRank: 100, streak: 0, title: { name: 'Rookie', tier: 1 },
    todayXp: 0, goal: 100, week: game.weekStrip(fresh, TODAY),
    units: [], currentUnitId: null, reviewCount: 0, levels: [], test: null, next: null,
    soundOn: true, darkOn: false, badgeCount: 0, badgeTotal: 12
  });
});

test('homeHtml with a unit', () => {
  const html = views.homeHtml(views.homeModel(busySave(), TODAY));
  assert.match(html, /Rank 3/);
  assert.match(html, /50 \/ 100 XP/);
  assert.match(html, /Review \(2\)/);
  assert.match(html, /Unit &lt;1&gt;/);
  assert.doesNotMatch(html, /Unit <1>/);
  assert.match(tag(html, 'data-lesson-id="a1"'), /data-action="start-lesson"/);
  assert.doesNotMatch(tag(html, 'data-lesson-id="a2"'), /disabled/);
  assert.match(tag(html, 'data-lesson-id="b1"'), /disabled/);
  assert.doesNotMatch(tag(html, 'data-action="start-review"'), /disabled/);
  for (const action of ['import', 'backup', 'remove-unit']) assert.match(html, new RegExp('data-action="' + action + '"'));
});

test('homeHtml with no units and with an empty review pile', () => {
  const empty = views.homeHtml(views.homeModel(storage.newSave(), TODAY));
  assert.match(empty, /Import a unit to start/);
  assert.match(empty, /data-action="import"/);
  assert.doesNotMatch(empty, /data-action="start-review"/);
  const save = busySave();
  save.progress.u1.review = [];
  assert.match(tag(views.homeHtml(views.homeModel(save, TODAY)), 'data-action="start-review"'), /disabled/);
});

test('messageHtml escapes its lines', () => {
  const html = views.messageHtml({ title: 'Import failed', lines: ['a < b'], actions: [{ action: 'home', label: 'OK' }] });
  assert.match(html, /Import failed/);
  assert.match(html, /a &lt; b/);
  assert.match(html, /data-action="home"/);
});
