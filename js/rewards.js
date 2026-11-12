// Rewards: gems, daily quests, the week rewards calendar, the weekly challenge, the Shop, and
// chests on the path. Nothing here touches the page or reads the clock. Dates are local
// "YYYY-MM-DD" strings. Functions that change the save return what they gave or did.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./game.js');
  }
  var game = AQ.game;

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function addGems(save, gems) {
    save.gems = (save.gems || 0) + gems;
    return gems;
  }

  // ----- Daily quests -----

  // measure(save, daily, today) gives the progress toward target.
  var QUESTS = [
    { id: 'xp50', text: 'Earn 50 XP', target: 50, gems: 10, measure: function (save, daily, today) { return game.todayXp(save, today); } },
    { id: 'xp100', text: 'Earn 100 XP', target: 100, gems: 20, measure: function (save, daily, today) { return game.todayXp(save, today); } },
    { id: 'lessons2', text: 'Finish 2 lessons', target: 2, gems: 15, measure: function (save, daily) { return daily.lessons; } },
    { id: 'combo5', text: 'Get 5 right in a row', target: 5, gems: 15, measure: function (save, daily) { return daily.bestCombo; } },
    { id: 'perfect1', text: 'Finish a lesson with no mistakes', target: 1, gems: 15, measure: function (save, daily) { return daily.perfect; } },
    { id: 'correct15', text: 'Answer 15 questions right', target: 15, gems: 10, measure: function (save, daily) { return daily.correct; } },
    { id: 'practice1', text: 'Finish a review or practice round', target: 1, gems: 10, measure: function (save, daily) { return daily.practice; } }
  ];
  var QUESTS_PER_DAY = 3;

  // A small random number maker seeded by the date, so each date always gives the same quests.
  function seededRandom(text) {
    var seed = 7;
    for (var i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) % 2147483647;
    return function () {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
  }

  function questsFor(date) {
    var order = game.shuffledOrder(QUESTS.length, seededRandom(date));
    // Never both XP quests on one day.
    var picked = [];
    order.forEach(function (index) {
      var quest = QUESTS[index];
      if (picked.length >= QUESTS_PER_DAY) return;
      if (quest.id.indexOf('xp') === 0 && picked.some(function (q) { return q.id.indexOf('xp') === 0; })) return;
      picked.push(quest);
    });
    return picked;
  }

  // Today's quests with their progress. Does not change the save.
  function questStatus(save, today) {
    var daily = save.daily && save.daily.date === today ? save.daily :
      { date: today, lessons: 0, perfect: 0, correct: 0, bestCombo: 0, practice: 0, claimed: [] };
    return questsFor(today).map(function (quest) {
      var progress = Math.min(quest.measure(save, daily, today), quest.target);
      return {
        id: quest.id, text: quest.text, target: quest.target, gems: quest.gems,
        progress: progress, done: progress >= quest.target, claimed: daily.claimed.indexOf(quest.id) !== -1
      };
    });
  }

  // Gives a finished, unclaimed quest's gems. Returns the gems given, or 0.
  function claimQuest(save, today, id) {
    var quest = questStatus(save, today).filter(function (q) { return q.id === id; })[0];
    if (!quest || !quest.done || quest.claimed) return 0;
    game.dailyFor(save, today).claimed.push(id);
    return addGems(save, quest.gems);
  }

  // ----- Weeks -----

  // The Monday of the week holding date.
  function weekStart(date) {
    var weekday = new Date(date + 'T00:00:00Z').getUTCDay();
    return game.addDays(date, -((weekday + 6) % 7));
  }

  function studiedOn(save, date) {
    return Boolean(save.days && has(save.days, date) && save.days[date].studied);
  }

  // ----- Week rewards calendar -----

  var WEEK_REWARDS = [5, 10, 10, 15, 15, 20, 50];

  function weekRewardsFor(save, today) {
    var week = weekStart(today);
    return save.weekRewards && save.weekRewards.week === week ? save.weekRewards : { week: week, claimed: [] };
  }

  // Seven slots: 'claimed', 'ready' (claim it now), 'waiting' (study today first), or 'later'.
  function weekRewardStatus(save, today) {
    var rewards = weekRewardsFor(save, today);
    var count = rewards.claimed.length;
    var claimedToday = rewards.claimed.indexOf(today) !== -1;
    var canClaim = !claimedToday && count < WEEK_REWARDS.length && studiedOn(save, today);
    return {
      canClaim: canClaim,
      slots: WEEK_REWARDS.map(function (gems, index) {
        var state = index < count ? 'claimed' :
          (index === count && !claimedToday ? (canClaim ? 'ready' : 'waiting') : 'later');
        return { gems: gems, state: state };
      })
    };
  }

  function claimWeekReward(save, today) {
    if (!weekRewardStatus(save, today).canClaim) return 0;
    var rewards = weekRewardsFor(save, today);
    var gems = WEEK_REWARDS[rewards.claimed.length];
    save.weekRewards = { week: rewards.week, claimed: rewards.claimed.concat([today]) };
    return addGems(save, gems);
  }

  // ----- Weekly challenge: this week's XP against last week's -----

  var CHALLENGE_GEMS = 30;
  var CHALLENGE_MIN_TARGET = 100;

  function xpBetween(save, first, last) {
    var total = 0;
    for (var date = first; game.dayDiff(date, last) >= 0; date = game.addDays(date, 1)) {
      if (save.days && has(save.days, date)) total += save.days[date].xp;
    }
    return total;
  }

  function challengeStatus(save, today) {
    var week = weekStart(today);
    var lastWeek = xpBetween(save, game.addDays(week, -7), game.addDays(week, -1));
    var thisWeek = xpBetween(save, week, today);
    var target = Math.max(lastWeek + 1, CHALLENGE_MIN_TARGET);
    var claimed = Boolean(save.weekChallenge && save.weekChallenge.week === week && save.weekChallenge.claimed);
    return { thisWeek: thisWeek, lastWeek: lastWeek, target: target, beaten: thisWeek >= target, claimed: claimed, gems: CHALLENGE_GEMS };
  }

  function claimChallenge(save, today) {
    var status = challengeStatus(save, today);
    if (!status.beaten || status.claimed) return 0;
    save.weekChallenge = { week: weekStart(today), claimed: true };
    return addGems(save, CHALLENGE_GEMS);
  }

  // ----- Shop -----

  var FREEZE_PRICE = 50;
  var HATS = [
    { id: 'party', name: 'Party hat', price: 30 },
    { id: 'beanie', name: 'Beanie', price: 40 },
    { id: 'bow', name: 'Bow', price: 40 },
    { id: 'grad', name: 'Grad cap', price: 60 },
    { id: 'wizard', name: 'Wizard hat', price: 100 },
    { id: 'crown', name: 'Crown', price: 120 }
  ];

  function hatById(id) {
    return HATS.filter(function (hat) { return hat.id === id; })[0] || null;
  }

  function outfitsOf(save) {
    return save.outfits || { owned: [], worn: null };
  }

  // Buys one streak freeze. False when gems are short or two are already held.
  function buyFreeze(save) {
    var freezes = save.freezes || 0;
    if (freezes >= game.CONSTANTS.MAX_FREEZES || (save.gems || 0) < FREEZE_PRICE) return false;
    save.gems -= FREEZE_PRICE;
    save.freezes = freezes + 1;
    return true;
  }

  // Buys a hat and puts it on. False when it is unknown, owned, or too dear.
  function buyHat(save, id) {
    var hat = hatById(id);
    var outfits = outfitsOf(save);
    if (!hat || outfits.owned.indexOf(id) !== -1 || (save.gems || 0) < hat.price) return false;
    save.gems -= hat.price;
    save.outfits = { owned: outfits.owned.concat([id]), worn: id };
    return true;
  }

  // Wears an owned hat, or none with id null. Wearing the hat already worn takes it off.
  function wearHat(save, id) {
    var outfits = outfitsOf(save);
    if (id !== null && outfits.owned.indexOf(id) === -1) return false;
    save.outfits = { owned: outfits.owned.slice(), worn: id === outfits.worn ? null : id };
    return true;
  }

  // ----- Chests on the path: one per level, after its second lesson -----

  function chestGems(levelIndex) {
    return 15 + 5 * (levelIndex % 3);
  }

  function hasChest(level) {
    return level.lessons.length >= 3;
  }

  // 'locked', 'ready', or 'open'. Null when the level has no chest.
  function chestState(unit, progress, levelIndex) {
    var level = unit.levels[levelIndex];
    if (!level || !hasChest(level)) return null;
    if ((progress.chests || []).indexOf(String(levelIndex)) !== -1) return 'open';
    var ready = level.lessons.slice(0, 2).every(function (lesson) {
      return progress.completedLessons.indexOf(lesson.id) !== -1;
    });
    return ready ? 'ready' : 'locked';
  }

  // Opens a ready chest. Returns the gems given, or 0.
  function openChest(save, unitId, levelIndex) {
    var unit = save.units[unitId];
    var progress = save.progress[unitId];
    if (!unit || chestState(unit, progress, levelIndex) !== 'ready') return 0;
    progress.chests = (progress.chests || []).concat([String(levelIndex)]);
    return addGems(save, chestGems(levelIndex));
  }

  var api = {
    QUESTS: QUESTS,
    WEEK_REWARDS: WEEK_REWARDS,
    CHALLENGE_GEMS: CHALLENGE_GEMS,
    FREEZE_PRICE: FREEZE_PRICE,
    HATS: HATS,
    hatById: hatById,
    questsFor: questsFor,
    questStatus: questStatus,
    claimQuest: claimQuest,
    weekStart: weekStart,
    weekRewardStatus: weekRewardStatus,
    claimWeekReward: claimWeekReward,
    challengeStatus: challengeStatus,
    claimChallenge: claimChallenge,
    buyFreeze: buyFreeze,
    buyHat: buyHat,
    wearHat: wearHat,
    chestGems: chestGems,
    chestState: chestState,
    openChest: openChest
  };
  AQ.rewards = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
