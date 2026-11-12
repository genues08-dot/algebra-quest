// Save data: its shape, loading, saving, importing units and backups.
// The storage object (localStorage in the app, a fake in tests) is always passed in.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./units.js');
    require('./game.js');
  }

  var KEY = 'algebraQuest.v1';
  var BAD_FILE_MESSAGE = "This file isn't a valid unit or backup.";
  var MAX_IMPORT_ERRORS = 5;
  var THEMES = ['light', 'dark'];
  var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function newSave() {
    return {
      version: 1,
      xp: 0,
      streak: 0,
      lastStudyDate: null,
      currentUnitId: null,
      units: {},
      progress: {},
      days: {},
      badges: {},
      settings: { sound: true, angle: 'deg', goal: AQ.game.CONSTANTS.DEFAULT_GOAL, theme: 'light' }
    };
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isStringArray(value) {
    return Array.isArray(value) && value.every(function (item) { return typeof item === 'string'; });
  }

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function isDate(value) {
    return typeof value === 'string' && DATE_PATTERN.test(value);
  }

  // The day log: { "YYYY-MM-DD": { xp, studied } }.
  function isValidDays(days) {
    if (!isPlainObject(days)) return false;
    return Object.keys(days).every(function (date) {
      var entry = days[date];
      return isDate(date) && isPlainObject(entry) &&
        typeof entry.xp === 'number' && isFinite(entry.xp) && entry.xp >= 0 &&
        typeof entry.studied === 'boolean';
    });
  }

  // Earned badges: { badgeId: "YYYY-MM-DD" }.
  function isValidBadges(badges) {
    if (!isPlainObject(badges)) return false;
    return Object.keys(badges).every(function (id) { return isDate(badges[id]); });
  }

  function isValidSave(candidate) {
    if (!isPlainObject(candidate)) return false;
    if (candidate.version !== 1) return false;
    if (typeof candidate.xp !== 'number' || !isFinite(candidate.xp) || candidate.xp < 0) return false;
    if (!Number.isInteger(candidate.streak) || candidate.streak < 0) return false;
    var date = candidate.lastStudyDate;
    if (date !== null && !isDate(date)) return false;
    if (!isPlainObject(candidate.units) || !isPlainObject(candidate.progress)) return false;

    var unitIds = Object.keys(candidate.units);
    for (var i = 0; i < unitIds.length; i++) {
      var id = unitIds[i];
      var unit = candidate.units[id];
      if (!AQ.units.validate(unit).ok || unit.id !== id) return false;
      var progress = candidate.progress[id];
      if (!isPlainObject(progress)) return false;
      if (!isStringArray(progress.completedLessons) || !isStringArray(progress.review)) return false;
      if (has(progress, 'testBest') && progress.testBest !== null &&
          !(Number.isInteger(progress.testBest) && progress.testBest >= 0 && progress.testBest <= 100)) return false;
    }
    if (has(candidate, 'settings')) {
      var settings = candidate.settings;
      if (!(isPlainObject(settings) && typeof settings.sound === 'boolean')) return false;
      if (has(settings, 'angle') && settings.angle !== 'deg' && settings.angle !== 'rad') return false;
      if (has(settings, 'goal') && AQ.game.CONSTANTS.GOAL_CHOICES.indexOf(settings.goal) === -1) return false;
      if (has(settings, 'theme') && THEMES.indexOf(settings.theme) === -1) return false;
    }
    if (has(candidate, 'days') && !isValidDays(candidate.days)) return false;
    if (has(candidate, 'badges') && !isValidBadges(candidate.badges)) return false;
    if (candidate.currentUnitId !== null && unitIds.indexOf(candidate.currentUnitId) === -1) return false;
    return true;
  }

  // Older v1 saves lack settings, settings.angle, testBest, and the home screen fields
  // (days, badges, settings.goal, settings.theme). Fill them in on the object in hand.
  function fillDefaults(save) {
    if (!has(save, 'settings')) save.settings = { sound: true };
    if (!has(save.settings, 'angle')) save.settings.angle = 'deg';
    if (!has(save.settings, 'goal')) save.settings.goal = AQ.game.CONSTANTS.DEFAULT_GOAL;
    if (!has(save.settings, 'theme')) save.settings.theme = 'light';
    if (!has(save, 'days')) save.days = {};
    if (!has(save, 'badges')) save.badges = {};
    Object.keys(save.progress).forEach(function (id) {
      if (!has(save.progress[id], 'testBest')) save.progress[id].testBest = null;
    });
    return save;
  }

  function serialize(save) {
    return JSON.stringify(save, null, 2);
  }

  // Never writes. Data that cannot be used is handed back as `raw` so the user can keep a copy.
  function load(ls) {
    var raw = ls.getItem(KEY);
    if (raw === null) return { ok: true, save: newSave() };
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { ok: false, raw: raw };
    }
    if (!isValidSave(parsed)) return { ok: false, raw: raw };
    return { ok: true, save: fillDefaults(parsed) };
  }

  // A failed write leaves the previous stored value in place.
  function persist(ls, save) {
    try {
      ls.setItem(KEY, serialize(save));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: 'quota' };
    }
  }

  function hasUnit(save, unitId) {
    return has(save.units, unitId);
  }

  // Adds or replaces a unit and makes it current.
  // Replacing keeps completed lessons and review entries whose ids still exist in the new unit.
  function addUnit(save, unit) {
    var kept = { completedLessons: [], review: [], testBest: null };
    var old = hasUnit(save, unit.id) ? save.progress[unit.id] : null;
    if (old) {
      var lessonIds = AQ.units.lessonIds(unit);
      var questionIds = AQ.units.questionIds(unit);
      kept.completedLessons = old.completedLessons.filter(function (id) { return lessonIds.indexOf(id) !== -1; });
      kept.review = old.review.filter(function (id) { return questionIds.indexOf(id) !== -1; });
      kept.testBest = has(old, 'testBest') ? old.testBest : null;
    }
    save.units[unit.id] = unit;
    save.progress[unit.id] = kept;
    save.currentUnitId = unit.id;
  }

  // Deletes a unit and its progress. XP and streak stay.
  function removeUnit(save, unitId) {
    delete save.units[unitId];
    delete save.progress[unitId];
    if (save.currentUnitId === unitId) {
      var remaining = Object.keys(save.units);
      save.currentUnitId = remaining.length > 0 ? remaining[0] : null;
    }
  }

  // Works out whether imported text is a unit file or a backup, and checks it.
  function parseImportText(text) {
    var badFile = { kind: 'error', messages: [BAD_FILE_MESSAGE] };
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return badFile;
    }
    if (!isPlainObject(parsed)) return badFile;

    if (has(parsed, 'format') && has(parsed, 'levels')) {
      var result = AQ.units.validate(parsed);
      if (result.ok) return { kind: 'unit', unit: parsed };
      return { kind: 'error', messages: result.errors.slice(0, MAX_IMPORT_ERRORS) };
    }
    if (has(parsed, 'version') && has(parsed, 'xp')) {
      return isValidSave(parsed) ? { kind: 'backup', save: fillDefaults(parsed) } : badFile;
    }
    return badFile;
  }

  function backupFilename(today) {
    return 'algebra-quest-backup-' + today + '.json';
  }

  var api = {
    KEY: KEY,
    newSave: newSave,
    isValidSave: isValidSave,
    serialize: serialize,
    load: load,
    persist: persist,
    hasUnit: hasUnit,
    addUnit: addUnit,
    removeUnit: removeUnit,
    parseImportText: parseImportText,
    backupFilename: backupFilename
  };
  AQ.storage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
