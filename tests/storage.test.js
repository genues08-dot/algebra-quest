const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const units = require('../js/units.js');
const { makeUnit, makeSave } = require('./fixtures.js');

const KEY = 'algebraQuest.v1';
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

const named = (id, title) => { const unit = makeUnit(); unit.id = id; unit.title = title; return unit; };

test('syncUnits: a new save gets every built-in unit and starts on the last one', () => {
  const save = storage.newSave();
  const builtIn = [named('u1', 'Unit 1'), named('u5', 'Unit 5')];
  assert.equal(storage.syncUnits(save, builtIn), true);
  assert.deepEqual(Object.keys(save.units), ['u1', 'u5']);
  assert.equal(save.currentUnitId, 'u5');
  assert.deepEqual(save.progress.u1.completedLessons, []);
  assert.equal(storage.isValidSave(save), true);
  assert.equal(storage.syncUnits(save, builtIn), false);
});

test('syncUnits: adds missing units and keeps the current unit and its progress', () => {
  const save = makeSave(named('u5', 'Unit 5'));
  save.progress.u5.completedLessons = ['a1'];
  save.xp = 40;
  assert.equal(storage.syncUnits(save, [named('u1', 'Unit 1'), named('u5', 'Unit 5')]), true);
  assert.equal(save.currentUnitId, 'u5');
  assert.deepEqual(save.progress.u5.completedLessons, ['a1']);
  assert.deepEqual(save.progress.u1.completedLessons, []);
  assert.equal(save.xp, 40);
});

test('syncUnits: a changed unit is replaced, keeping progress for lessons that still exist', () => {
  const save = makeSave(named('u5', 'Unit 5'));
  save.progress.u5.completedLessons = ['a1', 'a2'];
  const changed = named('u5', 'Unit 5: Polynomials');
  changed.levels[0].lessons = changed.levels[0].lessons.filter(lesson => lesson.id !== 'a2');
  assert.equal(storage.syncUnits(save, [changed]), true);
  assert.equal(save.units.u5.title, 'Unit 5: Polynomials');
  assert.deepEqual(save.progress.u5.completedLessons, ['a1']);
  assert.equal(save.currentUnitId, 'u5');
});

test('syncUnits: units that are not built in stay, and a broken built-in unit is skipped', () => {
  const save = makeSave(named('mine', 'My unit'));
  const broken = named('bad', 'Broken');
  broken.levels = [];
  assert.equal(storage.syncUnits(save, [broken]), false);
  assert.deepEqual(Object.keys(save.units), ['mine']);
  assert.equal(save.currentUnitId, 'mine');
  const empty = storage.newSave();
  assert.equal(storage.syncUnits(empty, []), false);
  assert.equal(empty.currentUnitId, null);
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
  const withAngle = value => { const save = makeSave(makeUnit()); save.settings.angle = value; return save; };
  assert.equal(storage.isValidSave(withAngle('rad')), true);
  for (const bad of ['grad', 5, null, '']) assert.equal(storage.isValidSave(withAngle(bad)), false, String(bad));
});
