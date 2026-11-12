const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const { makeUnit, makeSave } = require('./fixtures.js');

test('a new save has the home screen fields', () => {
  const save = storage.newSave();
  assert.deepEqual(save.days, {});
  assert.deepEqual(save.badges, {});
  assert.deepEqual(save.settings, { sound: true, angle: 'deg', goal: 100, theme: 'light', mascot: { color: 'pink', name: 'Axl' } });
});

test('an older save gets the home screen fields when it loads', () => {
  const old = makeSave(makeUnit());
  delete old.settings.goal;
  delete old.settings.theme;
  const ls = { getItem: () => JSON.stringify(old) };
  const loaded = storage.load(ls);
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.save.days, {});
  assert.deepEqual(loaded.save.badges, {});
  assert.equal(loaded.save.settings.goal, 100);
  assert.equal(loaded.save.settings.theme, 'light');
});

test('an older backup gets the home screen fields when it is imported', () => {
  const old = makeSave(makeUnit());
  delete old.settings;
  const result = storage.parseImportText(JSON.stringify(old));
  assert.equal(result.kind, 'backup');
  assert.deepEqual(result.save.settings, { sound: true, angle: 'deg', goal: 100, theme: 'light', mascot: { color: 'pink', name: 'Axl' } });
  assert.deepEqual(result.save.days, {});
});

test('valid home screen fields are accepted and kept', () => {
  const save = makeSave(makeUnit());
  save.days = { '2026-11-12': { xp: 40, studied: true }, '2026-11-11': { xp: 0, studied: false } };
  save.badges = { 'first-lesson': '2026-11-12' };
  save.settings.goal = 300;
  save.settings.theme = 'dark';
  assert.equal(storage.isValidSave(save), true);
  const loaded = storage.load({ getItem: () => JSON.stringify(save) });
  assert.deepEqual(loaded.save.days, save.days);
  assert.deepEqual(loaded.save.badges, save.badges);
  assert.equal(loaded.save.settings.theme, 'dark');
});

test('wrong values in the home screen fields make the save invalid', () => {
  const cases = [
    save => { save.days = []; },
    save => { save.days = { 'Nov 12': { xp: 1, studied: true } }; },
    save => { save.days = { '2026-11-12': { xp: -1, studied: true } }; },
    save => { save.days = { '2026-11-12': { xp: 'ten', studied: true } }; },
    save => { save.days = { '2026-11-12': { xp: 5, studied: 'yes' } }; },
    save => { save.days = { '2026-11-12': null }; },
    save => { save.badges = ['perfect']; },
    save => { save.badges = { perfect: 'today' }; },
    save => { save.settings.goal = 75; },
    save => { save.settings.theme = 'blue'; }
  ];
  cases.forEach((change, index) => {
    const save = makeSave(makeUnit());
    change(save);
    assert.equal(storage.isValidSave(save), false, 'case ' + index);
  });
});
