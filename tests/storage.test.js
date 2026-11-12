const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const units = require('../js/units.js');
const { makeUnit, makeSave } = require('./fixtures.js');

const KEY = 'algebraQuest.v1';
const BAD = "This file isn't a valid unit or backup.";
function fakeLs(initial) {
  const data = Object.assign({}, initial);
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

test('load: empty storage gives a new save', () => {
  assert.equal(storage.KEY, KEY);
  assert.deepEqual(storage.load(fakeLs()), { ok: true, save: {
    version: 1, xp: 0, streak: 0, lastStudyDate: null, currentUnitId: null, units: {}, progress: {},
    days: {}, badges: {}, gems: 0, freezes: 0, bestCombo: 0, outfits: { owned: [], worn: null }, settings: { sound: true, angle: 'deg', goal: 100, theme: 'light', mascot: { color: 'pink', name: 'Axl' } }
  } });
});

test('persist then load round-trips', () => {
  const ls = fakeLs();
  const save = makeSave(makeUnit());
  save.xp = 130;
  assert.deepEqual(storage.persist(ls, save), { ok: true });
  assert.deepEqual(Object.keys(ls.data), [KEY]);
  assert.deepEqual(storage.load(ls), { ok: true, save });
});

test('load: unreadable or wrong-shape data is reported and never wiped', () => {
  const good = makeSave(makeUnit());
  const broken = ['not json{', 'null', '[]', '{}', '"hi"',
    JSON.stringify({ ...good, version: 2 }),
    JSON.stringify({ ...good, xp: -5 }),
    JSON.stringify({ ...good, lastStudyDate: 'yesterday' }),
    JSON.stringify({ ...good, currentUnitId: 'missing' }),
    JSON.stringify({ ...good, progress: {} }),
    JSON.stringify({ ...good, units: { u1: { format: 1 } } })];
  for (const raw of broken) {
    const ls = fakeLs({ [KEY]: raw });
    assert.deepEqual(storage.load(ls), { ok: false, raw });
    assert.equal(ls.data[KEY], raw);
  }
});

test('persist: full storage reports quota and keeps the old value', () => {
  const ls = fakeLs({ [KEY]: 'old' });
  ls.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.deepEqual(storage.persist(ls, storage.newSave()), { ok: false, reason: 'quota' });
  assert.equal(ls.data[KEY], 'old');
});

test('addUnit: a new unit becomes current with empty progress', () => {
  const save = storage.newSave();
  const unit = makeUnit();
  assert.equal(storage.hasUnit(save, 'u1'), false);
  storage.addUnit(save, unit);
  assert.equal(storage.hasUnit(save, 'u1'), true);
  assert.deepEqual(save, makeSave(unit));
});

test('addUnit: replacing keeps progress only for ids that still exist', () => {
  const save = makeSave(makeUnit());
  save.xp = 70;
  save.progress.u1 = { completedLessons: ['a1', 'old-lesson'], review: ['q2', 'old-question'], testBest: 85 };
  storage.addUnit(save, makeUnit());
  assert.deepEqual(save.progress.u1, { completedLessons: ['a1'], review: ['q2'], testBest: 85, stars: {}, chests: [] });
  assert.equal(save.xp, 70);
});

test('removeUnit: deletes the unit and its progress, keeps XP and streak', () => {
  const save = makeSave(makeUnit());
  const second = makeUnit();
  second.id = 'u2';
  storage.addUnit(save, second);
  save.xp = 70;
  save.streak = 3;
  storage.removeUnit(save, 'u2');
  assert.deepEqual([Object.keys(save.units), Object.keys(save.progress), save.currentUnitId], [['u1'], ['u1'], 'u1']);
  storage.removeUnit(save, 'u1');
  assert.deepEqual([save.units, save.progress, save.currentUnitId, save.xp, save.streak], [{}, {}, null, 70, 3]);
});

test('parseImportText', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  assert.deepEqual(storage.parseImportText(JSON.stringify(unit)), { kind: 'unit', unit });
  assert.deepEqual(storage.parseImportText(storage.serialize(save)), { kind: 'backup', save });
  for (const text of ['nope{', '{"hello":1}', '[]', 'null', '42']) {
    assert.deepEqual(storage.parseImportText(text), { kind: 'error', messages: [BAD] });
  }
  const brokenBackup = JSON.stringify({ ...save, units: { u1: { format: 1 } } });
  assert.deepEqual(storage.parseImportText(brokenBackup), { kind: 'error', messages: [BAD] });
  const messy = makeUnit();
  messy.format = 3;
  messy.id = '';
  messy.title = '';
  messy.levels[0].title = '';
  messy.levels[1].title = '';
  messy.levels[0].lessons[0].questions[0].hint = '';
  messy.levels[0].lessons[0].questions[0].solution = '';
  const all = units.validate(messy).errors;
  assert.equal(all.length, 7);
  assert.deepEqual(storage.parseImportText(JSON.stringify(messy)), { kind: 'error', messages: all.slice(0, 5) });
});

test('load: a v1 save is valid and gets the new fields', () => {
  const old = makeSave(makeUnit());
  delete old.settings;
  delete old.progress.u1.testBest;
  const raw = JSON.stringify(old);
  const ls = fakeLs({ [KEY]: raw });
  const loaded = storage.load(ls);
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.save.settings, { sound: true, angle: 'deg', goal: 100, theme: 'light', mascot: { color: 'pink', name: 'Axl' } });
  assert.equal(loaded.save.progress.u1.testBest, null);
  assert.equal(ls.data[KEY], raw);
});

test('isValidSave checks testBest and settings', () => {
  const withBest = value => { const save = makeSave(makeUnit()); save.progress.u1.testBest = value; return save; };
  const withSettings = value => { const save = makeSave(makeUnit()); save.settings = value; return save; };
  for (const good of [withBest(0), withBest(100), withBest(null), withSettings({ sound: false })]) assert.equal(storage.isValidSave(good), true);
  for (const bad of [withBest(101), withBest(-1), withBest(2.5), withBest('x'), withSettings([]), withSettings({ sound: 'yes' }), withSettings({})]) {
    assert.equal(storage.isValidSave(bad), false);
  }
});

test('settings.angle is filled in and checked', () => {
  const noAngle = makeSave(makeUnit());
  delete noAngle.settings.angle;
  const loaded = storage.load(fakeLs({ [KEY]: JSON.stringify(noAngle) }));
  assert.deepEqual(loaded.save.settings, { sound: true, angle: 'deg', goal: 100, theme: 'light', mascot: { color: 'pink', name: 'Axl' } });
  assert.deepEqual(storage.parseImportText(JSON.stringify(noAngle)).save.settings, { sound: true, angle: 'deg', goal: 100, theme: 'light', mascot: { color: 'pink', name: 'Axl' } });
  const withAngle = value => { const save = makeSave(makeUnit()); save.settings.angle = value; return save; };
  assert.equal(storage.isValidSave(withAngle('rad')), true);
  for (const bad of ['grad', 5, null, '']) assert.equal(storage.isValidSave(withAngle(bad)), false, String(bad));
});

test('a backup with the new fields restores', () => {
  const save = makeSave(makeUnit());
  save.settings.sound = false;
  save.progress.u1.testBest = 90;
  assert.deepEqual(storage.parseImportText(storage.serialize(save)), { kind: 'backup', save });
});

test('backupFilename', () => {
  assert.equal(storage.backupFilename('2026-11-11'), 'algebra-quest-backup-2026-11-11.json');
});
