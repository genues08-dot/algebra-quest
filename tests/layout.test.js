const test = require('node:test');
const assert = require('node:assert/strict');
const views = require('../js/views.js');
const storage = require('../js/storage.js');
const { makeUnit, makeSave, makeRichUnit } = require('./fixtures.js');
const { makeEnv } = require('./fake-page.js');

const TODAY = '2026-11-12';
const count = (html, text) => html.split(text).length - 1;
const model = (change, unit) => {
  const save = makeSave(unit || makeRichUnit());
  if (change) change(save);
  return views.homeModel(save, TODAY);
};
const envWith = (unit, change) => {
  const save = makeSave(unit);
  if (change) change(save);
  return makeEnv(storage.serialize(save));
};

test('the tab bar marks the screen it is on', () => {
  const m = model();
  const screens = {
    home: views.homeHtml(m), practice: views.practiceHtml(m), profile: views.profileHtml(m), more: views.moreHtml(m),
    badges: views.badgesHtml(views.badgesModel(makeSave(makeRichUnit())))
  };
  for (const [name, html] of Object.entries(screens)) {
    assert.equal((html.match(/class="tab( tab-active)?"/g) || []).length, 5, name);
    assert.equal(count(html, 'tab-active'), 1, name);
    assert.match(html, new RegExp('class="tab tab-active" data-action="' + (name === 'home' ? 'home' : 'open-' + name) + '" aria-current="page"'), name);
  }
  assert.match(screens.home, /class="tab-axl" src="img\/axl\/pink-happy\.png"/);
});

test('level banners have a number, a color, and Notes only when the level has cards', () => {
  const html = views.homeHtml(model());
  assert.match(html, /class="level-kicker">Level 1</);
  assert.match(html, /data-action="open-guide" data-level="0"/);
  assert.doesNotMatch(html, /data-level="1"/);
});

test('finished lessons show their stars', () => {
  const html = views.homeHtml(model(save => {
    save.progress.u1.completedLessons = ['a1', 'a2'];
    save.progress.u1.stars = { a1: 2 };
  }));
  assert.match(html, /lesson 1, complete, 2 of 3 stars/);
  assert.match(html, /lesson 2, complete, 1 of 3 stars/);
  assert.equal(count(html, 'node-star node-star-on'), 3);
  assert.equal(count(html, 'class="node-star"'), 3);
});

test('Axl stands by the next lesson, else the trophy, else the last lesson', () => {
  const axlRow = html => html.match(/<div class="path-row[^"]*path-row-axl" data-current="true">[^]*?<\/div>/)[0];
  const next = views.homeHtml(model(save => { save.progress.u1.completedLessons = ['a1']; }));
  assert.equal(count(next, 'data-current'), 1);
  assert.match(axlRow(next), /data-lesson-id="a2"/);
  assert.match(next, /path-axl path-axl-left/);

  const trophy = views.homeHtml(model(save => { save.progress.u1.completedLessons = ['a1', 'a2', 'b1']; }));
  assert.match(trophy, /path-row path-trophy path-row-axl/);

  const noTest = views.homeHtml(model(save => { save.progress.u1.completedLessons = ['a1', 'a2', 'b1']; }, makeUnit()));
  assert.match(axlRow(noTest), /data-lesson-id="b1"/);
  assert.match(noTest, /data-action="jump"/);
});

test('home with no unit shows Axl and a big Import button', () => {
  const html = views.homeHtml(views.homeModel(storage.newSave(), TODAY));
  assert.match(html, /data-action="mascot-tap"/);
  assert.match(html, /data-action="import"[^>]*>Import a unit to start</);
  assert.doesNotMatch(html, /data-action="jump"/);
});

test('the tab buttons switch screens, and Home comes back', () => {
  const env = envWith(makeRichUnit(), save => { save.progress.u1.review = ['q1']; });
  env.click('open-practice');
  assert.match(env.html(), /class="practice-title">Mistakes/);
  assert.match(env.html(), /Review \(1\)/);
  env.click('open-profile');
  assert.match(env.html(), /class="profile-stats"/);
  env.click('open-more');
  assert.match(env.html(), /Remove this unit/);
  env.click('open-badges');
  assert.match(env.html(), /badges-screen/);
  env.click('home');
  assert.match(env.html(), /statsbar/);
  env.click('jump');
  assert.match(env.html(), /statsbar/);
});

test('the level guide walks through every card of a level, then returns home', () => {
  const env = envWith(makeRichUnit());
  env.click('open-guide', { 'data-level': '0' });
  assert.match(env.html(), /Level 1 · 1 of 2/);
  assert.match(env.html(), /Card one/);
  assert.match(env.html(), /data-action="guide-next"/);
  env.click('guide-back');
  assert.match(env.html(), /1 of 2/);
  env.click('guide-next');
  assert.match(env.html(), /Card two/);
  assert.match(env.html(), /data-action="guide-next">Done</);
  env.click('guide-next');
  assert.match(env.html(), /statsbar/);

  env.click('open-guide', { 'data-level': '1' });
  assert.match(env.html(), /statsbar/);
  env.click('open-guide', { 'data-level': '0' });
  env.click('home');
  assert.match(env.html(), /statsbar/);
});
