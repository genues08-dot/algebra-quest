// Game rules: rank, level unlocking, streak, and lesson sessions.
// Nothing here touches the page or reads the clock. Dates are local "YYYY-MM-DD" strings.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./checker.js');
    require('./units.js');
  }

  var CONSTANTS = {
    XP_CORRECT: 10,
    XP_LESSON_COMPLETE: 20,
    XP_PERFECT_BONUS: 10,
    XP_PER_RANK: 100,
    HEARTS_PER_LESSON: 5,
    REVIEW_LESSON_SIZE: 8
  };
  var MS_PER_DAY = 24 * 60 * 60 * 1000;

  // ----- Rank -----

  function rankForXp(xp) {
    return Math.floor(xp / CONSTANTS.XP_PER_RANK) + 1;
  }

  function xpIntoRank(xp) {
    return xp % CONSTANTS.XP_PER_RANK;
  }

  // ----- Level unlocking -----

  function isLevelComplete(level, progress) {
    return level.lessons.every(function (lesson) {
      return progress.completedLessons.indexOf(lesson.id) !== -1;
    });
  }

  // One state per level: the first level is open, and each level opens when the one before it is complete.
  function levelStates(unit, progress) {
    var previousComplete = true;
    return unit.levels.map(function (level) {
      var complete = isLevelComplete(level, progress);
      var state = complete ? 'complete' : (previousComplete ? 'open' : 'locked');
      previousComplete = complete;
      return state;
    });
  }

  // ----- Dates and streak -----

  function pad2(number) {
    return (number < 10 ? '0' : '') + number;
  }

  function localDateString(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function utcMidnight(dateString) {
    var parts = dateString.split('-').map(Number);
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  }

  // Whole calendar days from one date to another. UTC math keeps daylight saving from shifting the count.
  function dayDiff(from, to) {
    return Math.round((utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY);
  }

  // Called when a lesson is completed. A date earlier than the last study date changes nothing.
  function applyStreak(save, today) {
    if (save.lastStudyDate === null) {
      save.streak = 1;
      save.lastStudyDate = today;
      return;
    }
    var days = dayDiff(save.lastStudyDate, today);
    if (days <= 0) return;
    save.streak = days === 1 ? save.streak + 1 : 1;
    save.lastStudyDate = today;
  }

  // Called when the app opens. The streak is lost once a whole day has been missed.
  function refreshStreak(save, today) {
    if (save.lastStudyDate === null || dayDiff(save.lastStudyDate, today) > 1) {
      save.streak = 0;
    }
  }

  // ----- Shuffle -----

  // Fisher-Yates shuffle of 0..n-1.
  function shuffledOrder(n, rng) {
    var random = rng || Math.random;
    var order = [];
    for (var i = 0; i < n; i++) order.push(i);
    for (var last = n - 1; last > 0; last--) {
      var pick = Math.floor(random() * (last + 1));
      var held = order[last];
      order[last] = order[pick];
      order[pick] = held;
    }
    return order;
  }

  var api = {
    CONSTANTS: CONSTANTS,
    rankForXp: rankForXp,
    xpIntoRank: xpIntoRank,
    levelStates: levelStates,
    localDateString: localDateString,
    dayDiff: dayDiff,
    applyStreak: applyStreak,
    refreshStreak: refreshStreak,
    shuffledOrder: shuffledOrder
  };
  AQ.game = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
