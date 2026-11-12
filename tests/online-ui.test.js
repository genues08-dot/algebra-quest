const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const game = require('../js/game.js');
const rewards = require('../js/rewards.js');
const { makeUnit, makeSave } = require('./fixtures.js');
const { makeEnv } = require('./fake-page.js');

const settle = () => new Promise(resolve => setImmediate(resolve));
const today = () => game.localDateString(new Date());

// A stand-in for the online app's account and leaderboard.
function fakeOnline(rows, options = {}) {
  const calls = [];
  return {
    uid: 'me',
    name: 'Axl<Fan>',
    calls,
    leaderboard() {
      calls.push('leaderboard');
      return options.fail && calls.filter(c => c === 'leaderboard').length === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(rows);
    },
    logOut() { calls.push('logOut'); },
    deleteAccount() {
      calls.push('deleteAccount');
      return options.deleteError ? Promise.reject(options.deleteError) : new Promise(() => {});
    }
  };
}

function envWith(online, change, extra = {}) {
  const save = makeSave(makeUnit());
  if (change) change(save);
  return makeEnv(storage.serialize(save), Object.assign({ online }, extra));
}

const week = () => rewards.weekStart(today());
const otherRows = () => [
  { uid: 'p1', name: 'Bee', weekXp: 90, week: week(), totalXp: 500, color: 'blue', hat: 'crown' },
  { uid: 'p2', name: 'Cat', weekXp: 5, week: week(), totalXp: 5000, color: 'purple', hat: null },
  { uid: 'me', name: 'Axl<Fan>', weekXp: 0, week: week(), totalXp: 0, color: 'pink', hat: null }
];

test('the offline app keeps the Badges tab and has no leaderboard', () => {
  const env = envWith(null);
  assert.match(env.html(), /class="tab" data-action="open-badges"/);
  assert.doesNotMatch(env.html(), /open-leaderboard/);
  env.click('open-more');
  assert.doesNotMatch(env.html(), /Logged in as/);
});

test('the online app swaps the Badges tab for Leaders, and Profile opens Badges', () => {
  const env = envWith(fakeOnline(otherRows()));
  assert.match(env.html(), /class="tab" data-action="open-leaderboard"/);
  assert.doesNotMatch(env.html(), /class="tab[^"]*" data-action="open-badges"/);
  env.click('open-profile');
  assert.match(env.html(), /data-action="open-badges"/);
  env.click('open-badges');
  assert.match(env.html(), /class="badges-screen tab-screen"/);
});

test('the leaderboard loads, ranks with my newest XP, and switches tabs', async () => {
  const online = fakeOnline(otherRows());
  const env = envWith(online, save => {
    save.xp = 300;
    save.days = { [today()]: { xp: 100, studied: true } };
    save.outfits = { owned: ['bow'], worn: 'bow' };
  });
  env.click('open-leaderboard');
  assert.match(env.html(), /Loading&hellip;/);
  await settle();
  const html = env.html();
  assert.match(html, /class="tab tab-active" data-action="open-leaderboard"/);
  assert.match(html, /You&#39;re #1 this week! Keep it up!/);
  const names = [...html.matchAll(/class="board-name">([^<]*)/g)].map(m => m[1]);
  assert.deepEqual(names, ['Axl&lt;Fan&gt; ', 'Bee', 'Cat']);
  assert.match(html, /class="board-row board-me"><span class="board-rank">&#129351;<\/span>/);
  assert.match(html, /<span class="board-xp">100 XP<\/span>/);
  assert.match(html, /class="axl-hat"/);
  env.click('board-mode', { 'data-mode': 'all' });
  const all = [...env.html().matchAll(/class="board-name">([^<]*)/g)].map(m => m[1]);
  assert.deepEqual(all, ['Cat', 'Bee', 'Axl&lt;Fan&gt; ']);
  assert.match(env.html(), /You&#39;re #3 of all time! Keep going!/);
  assert.match(env.html(), /class="board-tab board-tab-on" data-action="board-mode" data-mode="all" aria-pressed="true"/);
});

test('a failed load offers Try again', async () => {
  const online = fakeOnline(otherRows(), { fail: true });
  const env = envWith(online);
  env.click('open-leaderboard');
  await settle();
  assert.match(env.html(), /The leaderboard could not load/);
  env.click('board-retry');
  await settle();
  assert.match(env.html(), /class="board-list"/);
  assert.equal(online.calls.filter(c => c === 'leaderboard').length, 2);
});

test('leaving the leaderboard before it loads keeps the other screen', async () => {
  const env = envWith(fakeOnline(otherRows()));
  env.click('open-leaderboard');
  env.click('open-profile');
  await settle();
  assert.match(env.html(), /class="tab-screen profile"/);
});

test('More shows the account; Log out asks first', () => {
  const online = fakeOnline([]);
  const env = envWith(online);
  env.click('open-more');
  assert.match(env.html(), /Logged in as <strong>Axl&lt;Fan&gt;<\/strong>/);
  env.click('log-out');
  assert.deepEqual(online.calls, ['logOut']);
  assert.equal(env.confirms[0], 'Log out of Algebra Quest on this device?');

  const declined = fakeOnline([]);
  const env2 = envWith(declined, null, { confirm: false });
  env2.click('open-more');
  env2.click('log-out');
  assert.deepEqual(declined.calls, []);
});

test('Delete my account asks first and shows why it failed', async () => {
  const online = fakeOnline([], { deleteError: 'For safety, log out and log back in first.' });
  const env = envWith(online);
  env.click('open-more');
  env.click('delete-account');
  assert.match(env.confirms[0], /cannot be undone/);
  assert.deepEqual(online.calls, ['deleteAccount']);
  await settle();
  assert.match(env.html(), /Your account was not deleted/);
  assert.match(env.html(), /For safety, log out and log back in first\./);
});

test('account actions do nothing outside More', () => {
  const online = fakeOnline([]);
  const env = envWith(online);
  env.click('log-out');
  env.click('delete-account');
  assert.deepEqual(online.calls, []);
});
