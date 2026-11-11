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
    version: 1, xp: 0, streak: 0, lastStudyDate: null, currentUnitId: null, units: {}, progress: {}
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
  save.progress.u1 = { completedLessons: ['a1', 'old-lesson'], review: ['q2', 'old-question'] };
  storage.addUnit(save, makeUnit());
  assert.deepEqual(save.progress.u1, { completedLessons: ['a1'], review: ['q2'] });
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

test('backupFilename', () => {
  assert.equal(storage.backupFilename('2026-11-11'), 'algebra-quest-backup-2026-11-11.json');
});
