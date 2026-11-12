const test = require('node:test');
const assert = require('node:assert/strict');
const online = require('../js/online.js');
const { makeUnit, makeSave } = require('./fixtures.js');

const TODAY = '2026-11-12'; // a Thursday; that week's Monday is 2026-11-09

test('usernames: 3 to 15 letters, numbers, or underscores', () => {
  assert.equal(online.checkUsername('Axl_Fan99'), null);
  assert.equal(online.checkUsername('  abc  '), null);
  assert.equal(online.checkUsername(''), 'Type a username.');
  assert.equal(online.checkUsername('ab'), 'Usernames need at least 3 characters.');
  assert.equal(online.checkUsername('a'.repeat(16)), 'Usernames can have at most 15 characters.');
  assert.equal(online.checkUsername('axl fan'), 'Use only letters, numbers, and _ in a username.');
  assert.equal(online.checkUsername('axl@fan'), 'Use only letters, numbers, and _ in a username.');
  assert.equal(online.checkUsername(undefined), 'Type a username.');
});

test('passwords: 6 to 128 characters, and the second copy must match', () => {
  assert.equal(online.checkPassword('secret'), null);
  assert.equal(online.checkPassword(''), 'Type a password.');
  assert.equal(online.checkPassword('12345'), 'Passwords need at least 6 characters.');
  assert.equal(online.checkPassword('x'.repeat(129)), 'Passwords can have at most 128 characters.');
  assert.equal(online.checkPassword('secret', 'secret'), null);
  assert.equal(online.checkPassword('secret', 'Secret'), "The two passwords don't match.");
});

test('a username becomes a lowercase login address, and back', () => {
  assert.equal(online.loginEmail(' Axl_Fan ', 'algebra-quest1.firebaseapp.com'), 'axl_fan@algebra-quest1.firebaseapp.com');
  assert.equal(online.nameFromEmail('axl_fan@algebra-quest1.firebaseapp.com'), 'axl_fan');
  assert.equal(online.nameFromEmail(null), '');
});

test('Firebase error codes become plain messages', () => {
  assert.equal(online.authMessage('auth/email-already-in-use'), 'That username is taken.');
  assert.equal(online.authMessage('auth/invalid-credential'), 'Wrong username or password.');
  assert.equal(online.authMessage('auth/network-request-failed'), 'No internet connection.');
  assert.equal(online.authMessage('auth/odd'), 'Something went wrong (auth/odd).');
});

test('week XP counts Monday to today only', () => {
  const save = makeSave(makeUnit());
  save.days = {
    '2026-11-08': { xp: 500, studied: true }, // last Sunday
    '2026-11-09': { xp: 30, studied: true },
    '2026-11-12': { xp: 45, studied: true },
    '2026-11-13': { xp: 99, studied: true } // tomorrow: a moved clock
  };
  assert.equal(online.weekXp(save, TODAY), 75);
});

test('a player row comes from the save', () => {
  const save = makeSave(makeUnit());
  save.xp = 1234.7;
  save.days = { '2026-11-10': { xp: 40, studied: true } };
  save.settings.mascot.color = 'blue';
  save.outfits = { owned: ['crown'], worn: 'crown' };
  assert.deepEqual(online.playerRow(save, 'Axl_Fan', TODAY), {
    name: 'Axl_Fan', nameLower: 'axl_fan', weekXp: 40, week: '2026-11-09', totalXp: 1234, color: 'blue', hat: 'crown'
  });
  save.outfits.worn = null;
  save.settings.mascot.color = 'green';
  const row = online.playerRow(save, 'Axl_Fan', TODAY);
  assert.deepEqual([row.color, row.hat], ['pink', null]);
});

test('week XP in a row is never more than total XP', () => {
  const save = makeSave(makeUnit());
  save.xp = 20;
  save.days = { '2026-11-10': { xp: 40, studied: true } };
  assert.equal(online.playerRow(save, 'abc', TODAY).weekXp, 20);
});

test('sameRow ignores nothing that shows on the board', () => {
  const save = makeSave(makeUnit());
  const a = online.playerRow(save, 'abc', TODAY);
  assert.equal(online.sameRow(a, Object.assign({}, a)), true);
  assert.equal(online.sameRow(a, Object.assign({}, a, { totalXp: 1 })), false);
  assert.equal(online.sameRow(a, Object.assign({}, a, { hat: 'bow' })), false);
  assert.equal(online.sameRow(a, null), false);
});

const rows = [
  { uid: 'u1', name: 'Bee', weekXp: 50, week: '2026-11-09', totalXp: 900, color: 'blue', hat: null },
  { uid: 'u2', name: 'ant', weekXp: 50, week: '2026-11-09', totalXp: 100, color: 'purple', hat: 'crown' },
  { uid: 'u3', name: 'Cat', weekXp: 80, week: '2026-11-02', totalXp: 2000, color: 'pink', hat: null }, // last week
  { uid: 'u4', name: 'Dog', weekXp: 10, week: '2026-11-09', totalXp: 10, color: 'nope', hat: 'nope' },
  { uid: 'me', name: 'Me', weekXp: 0, week: '2026-11-09', totalXp: 0, color: 'pink', hat: null }
];

test('This week ranks by week XP, shares ranks on ties, and hides 0 XP except mine', () => {
  const ranked = online.rankRows(rows, 'week', TODAY, 'me');
  assert.deepEqual(ranked.map(r => [r.name, r.xp, r.rank, r.me]), [
    ['ant', 50, 1, false], ['Bee', 50, 1, false], ['Dog', 10, 3, false], ['Me', 0, 4, true]
  ]);
  assert.deepEqual(ranked.map(r => r.medal), ['&#129351;', '&#129351;', '&#129353;', null]);
  assert.deepEqual([ranked[2].color, ranked[2].hat], ['pink', null]);
});

test('All time ranks by total XP', () => {
  const ranked = online.rankRows(rows, 'all', TODAY, 'me');
  assert.deepEqual(ranked.map(r => [r.name, r.xp, r.rank]), [
    ['Cat', 2000, 1], ['Bee', 900, 2], ['ant', 100, 3], ['Dog', 10, 4], ['Me', 0, 5]
  ]);
});

test('bad rows from other players are made safe', () => {
  const ranked = online.rankRows([{ uid: 'x', name: '', totalXp: -5 }, { uid: 'y', totalXp: 'lots' }], 'all', TODAY, 'me');
  assert.deepEqual(ranked.map(r => [r.name, r.xp]), [['Player', 0], ['Player', 0]]);
});

test('my row from my save replaces the one from the server', () => {
  const merged = online.withMyRow(rows, 'me', { name: 'Me', weekXp: 60, week: '2026-11-09', totalXp: 60, color: 'pink', hat: null });
  const ranked = online.rankRows(merged, 'week', TODAY, 'me');
  assert.deepEqual(ranked.map(r => r.name), ['Me', 'ant', 'Bee', 'Dog']);
  assert.equal(merged.length, rows.length);
});

test('Axl says the viewer place', () => {
  const week = online.rankRows(rows, 'week', TODAY, 'me');
  assert.equal(online.boardLine(week, 'week'), 'Earn XP this week to get on the board!');
  assert.equal(online.boardLine(online.rankRows(rows, 'all', TODAY, 'u2'), 'all'), "You're #3 of all time! Keep going!");
  assert.equal(online.boardLine(online.rankRows(rows, 'all', TODAY, 'u3'), 'all'), "You're #1 of all time! Keep it up!");
  assert.equal(online.boardLine([], 'all'), 'Earn XP to get on the board!');
});

test('the device copy wins only with unsent changes grown from the cloud as it is now', () => {
  const cloud = { save: '{"c":1}', rev: 'B' };
  const device = (base, dirty) => ({ save: '{"d":1}', base, dirty });
  assert.equal(online.chooseStart(device('B', true), cloud), 'local');
  assert.equal(online.chooseStart(device('B', false), cloud), 'cloud');
  assert.equal(online.chooseStart(device('A', true), cloud), 'cloud'); // another device saved B since
  assert.equal(online.chooseStart(device(null, true), cloud), 'cloud');
  assert.equal(online.chooseStart(null, cloud), 'cloud');
  assert.equal(online.chooseStart(device('A', false), null), 'local');
  assert.equal(online.chooseStart(null, null), null);
  assert.equal(online.chooseStart({ save: '' }, { save: '' }), null);
  // Its own save landed without an answer, then it played on.
  assert.equal(online.chooseStart({ save: '{}', base: 'A', pending: 'B', dirty: true }, cloud), 'local');
  assert.equal(online.chooseStart({ save: '{}', base: 'A', pending: 'C', dirty: true }, cloud), 'cloud');
  assert.equal(online.chooseStart({ save: '{}', base: undefined, dirty: true }, { save: '{}' }), 'cloud');
});

test('bundled units are packed to a marker and unpacked to the newest copy', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  save.units.other = { id: 'other' };
  const packed = online.packSave(JSON.stringify(save), [unit]);
  assert.equal(JSON.parse(packed).units.u1, 'bundled');
  assert.deepEqual(JSON.parse(packed).units.other, { id: 'other' });
  const newer = Object.assign({}, unit, { title: 'Unit 1, updated' });
  assert.equal(JSON.parse(online.unpackSave(packed, [newer])).units.u1.title, 'Unit 1, updated');
  assert.equal(JSON.parse(online.unpackSave(packed, [])).units.u1, undefined);
  assert.equal(online.packSave('not json', [unit]), 'not json');
});
