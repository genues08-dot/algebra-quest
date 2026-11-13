// Save data: its shape, loading, saving, and the units built into the app.
// The storage object (localStorage in the app, a fake in tests) is always passed in.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./units.js');
    require('./game.js');
    require('./rewards.js');
    require('./mascot.js');
  }

  var KEY = 'algebraQuest.v1';
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
      gems: 0,
      freezes: 0,
      bestCombo: 0,
      outfits: { owned: [], worn: null },
      settings: { sound: true, angle: 'deg', goal: AQ.game.CONSTANTS.DEFAULT_GOAL, theme: 'light', mascot: defaultMascot() }
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

  function defaultMascot() {
    return { color: AQ.mascot.DEFAULT.color, name: AQ.mascot.DEFAULT.name };
  }

  // { color, name }: one of the mascot colors, and a name of 1 to 16 characters after trimming.
  function isValidMascot(mascot) {
    return isPlainObject(mascot) && AQ.mascot.COLORS.indexOf(mascot.color) !== -1 &&
      AQ.mascot.cleanName(mascot.name) !== null;
  }

  // Stars per finished lesson: { lessonId: 1, 2, or 3 }.
  function isValidStars(stars) {
    if (!isPlainObject(stars)) return false;
    return Object.keys(stars).every(function (id) {
      return Number.isInteger(stars[id]) && stars[id] >= 1 && stars[id] <= 3;
    });
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
        typeof entry.studied === 'boolean' &&
        (!has(entry, 'frozen') || typeof entry.frozen === 'boolean');
    });
  }

  function isCount(value) {
    return Number.isInteger(value) && value >= 0;
  }

  // { owned: [known hat ids, once each], worn: null or an owned id }.
  function isValidOutfits(outfits) {
    if (!isPlainObject(outfits) || !isStringArray(outfits.owned)) return false;
    var known = outfits.owned.every(function (id, index) {
      return AQ.rewards.hatById(id) !== null && outfits.owned.indexOf(id) === index;
    });
    return known && (outfits.worn === null || outfits.owned.indexOf(outfits.worn) !== -1);
  }

  // Today's quest counters.
  function isValidDaily(daily) {
    return isPlainObject(daily) && isDate(daily.date) &&
      ['lessons', 'perfect', 'correct', 'bestCombo', 'practice'].every(function (key) { return isCount(daily[key]); }) &&
      isStringArray(daily.claimed);
  }

  function isValidWeekRewards(rewards) {
    return isPlainObject(rewards) && isDate(rewards.week) && Array.isArray(rewards.claimed) &&
      rewards.claimed.length <= AQ.rewards.WEEK_REWARDS.length && rewards.claimed.every(isDate);
  }

  function isValidWeekChallenge(challenge) {
    return isPlainObject(challenge) && isDate(challenge.week) && typeof challenge.claimed === 'boolean';
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
      if (has(progress, 'stars') && !isValidStars(progress.stars)) return false;
      if (has(progress, 'chests') && !isStringArray(progress.chests)) return false;
      if (has(progress, 'speedBest') && progress.speedBest !== null && !isCount(progress.speedBest)) return false;
    }
    if (has(candidate, 'settings')) {
      var settings = candidate.settings;
      if (!(isPlainObject(settings) && typeof settings.sound === 'boolean')) return false;
      if (has(settings, 'angle') && settings.angle !== 'deg' && settings.angle !== 'rad') return false;
      if (has(settings, 'goal') && AQ.game.CONSTANTS.GOAL_CHOICES.indexOf(settings.goal) === -1) return false;
      if (has(settings, 'theme') && THEMES.indexOf(settings.theme) === -1) return false;
      if (has(settings, 'mascot') && !isValidMascot(settings.mascot)) return false;
    }
    if (has(candidate, 'days') && !isValidDays(candidate.days)) return false;
    if (has(candidate, 'badges') && !isValidBadges(candidate.badges)) return false;
    if (has(candidate, 'gems') && !isCount(candidate.gems)) return false;
    if (has(candidate, 'bestCombo') && !isCount(candidate.bestCombo)) return false;
    if (has(candidate, 'freezes') &&
        !(isCount(candidate.freezes) && candidate.freezes <= AQ.game.CONSTANTS.MAX_FREEZES)) return false;
    if (has(candidate, 'outfits') && !isValidOutfits(candidate.outfits)) return false;
    if (has(candidate, 'daily') && !isValidDaily(candidate.daily)) return false;
    if (has(candidate, 'weekRewards') && !isValidWeekRewards(candidate.weekRewards)) return false;
    if (has(candidate, 'weekChallenge') && !isValidWeekChallenge(candidate.weekChallenge)) return false;
    if (candidate.currentUnitId !== null && unitIds.indexOf(candidate.currentUnitId) === -1) return false;
    return true;
  }

  // Older v1 saves lack settings, settings.angle, testBest, the home screen fields
  // (days, badges, settings.goal, settings.theme), and settings.mascot. Fill them in on the object in hand.
  function fillDefaults(save) {
    if (!has(save, 'settings')) save.settings = { sound: true };
    if (!has(save.settings, 'angle')) save.settings.angle = 'deg';
    if (!has(save.settings, 'goal')) save.settings.goal = AQ.game.CONSTANTS.DEFAULT_GOAL;
    if (!has(save.settings, 'theme')) save.settings.theme = 'light';
    if (!has(save.settings, 'mascot')) save.settings.mascot = defaultMascot();
    if (!has(save, 'days')) save.days = {};
    if (!has(save, 'badges')) save.badges = {};
    if (!has(save, 'gems')) save.gems = 0;
    if (!has(save, 'freezes')) save.freezes = 0;
    if (!has(save, 'bestCombo')) save.bestCombo = 0;
    if (!has(save, 'outfits')) save.outfits = { owned: [], worn: null };
    Object.keys(save.progress).forEach(function (id) {
      if (!has(save.progress[id], 'testBest')) save.progress[id].testBest = null;
      if (!has(save.progress[id], 'stars')) save.progress[id].stars = {};
      if (!has(save.progress[id], 'chests')) save.progress[id].chests = [];
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
  // Replacing keeps completed lessons, stars, and review entries whose ids still exist in the new unit.
  function addUnit(save, unit) {
    var kept = { completedLessons: [], review: [], testBest: null, stars: {}, chests: [] };
    var old = hasUnit(save, unit.id) ? save.progress[unit.id] : null;
    if (old) {
      var lessonIds = AQ.units.lessonIds(unit);
      var questionIds = AQ.units.questionIds(unit);
      kept.completedLessons = old.completedLessons.filter(function (id) { return lessonIds.indexOf(id) !== -1; });
      kept.review = old.review.filter(function (id) { return questionIds.indexOf(id) !== -1; });
      kept.testBest = has(old, 'testBest') ? old.testBest : null;
      Object.keys(old.stars || {}).forEach(function (id) {
        if (lessonIds.indexOf(id) !== -1) kept.stars[id] = old.stars[id];
      });
      kept.chests = (old.chests || []).filter(function (index) { return Number(index) < unit.levels.length; });
      if (typeof old.speedBest === 'number') kept.speedBest = old.speedBest;
    }
    save.units[unit.id] = unit;
    save.progress[unit.id] = kept;
    save.currentUnitId = unit.id;
  }

  // Puts the units built into the app (js/phone-units.js) into a save. A missing unit is added, and
  // a changed one is replaced the way addUnit does, keeping progress. The current unit stays; a
  // save with none starts on the last built-in unit, the one the class is on now.
  // Returns true when the save changed.
  function syncUnits(save, builtIn) {
    var current = save.currentUnitId;
    var changed = false;
    builtIn.forEach(function (unit) {
      if (hasUnit(save, unit.id) && JSON.stringify(save.units[unit.id]) === JSON.stringify(unit)) return;
      if (!AQ.units.validate(unit).ok) return;
      addUnit(save, unit);
      changed = true;
    });
    if (current === null || !hasUnit(save, current)) {
      var present = builtIn.filter(function (unit) { return hasUnit(save, unit.id); });
      current = present.length > 0 ? present[present.length - 1].id : null;
    }
    if (save.currentUnitId !== current) {
      save.currentUnitId = current;
      changed = true;
    }
    return changed;
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
    syncUnits: syncUnits
  };
  AQ.storage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
