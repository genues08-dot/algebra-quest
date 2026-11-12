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
    REVIEW_LESSON_SIZE: 8,
    XP_TEST_PASS: 50,
    TEST_PASS_PERCENT: 80,
    GOAL_CHOICES: [50, 100, 200, 300],
    DEFAULT_GOAL: 100,
    DAYS_KEPT: 14
  };
  var MS_PER_DAY = 24 * 60 * 60 * 1000;

  // ----- Rank -----

  function rankForXp(xp) {
    return Math.floor(xp / CONSTANTS.XP_PER_RANK) + 1;
  }

  function xpIntoRank(xp) {
    return xp % CONSTANTS.XP_PER_RANK;
  }

  // Each title starts at its rank and lasts until the next one. Tier picks the title's color.
  var RANK_TITLES = [
    [1, 'Rookie'], [3, 'Learner'], [5, 'Solver'], [8, 'Factor Finder'],
    [12, 'Equation Ace'], [17, 'Polynomial Pro'], [23, 'Function Master'], [30, 'Algebra Legend']
  ];

  function rankTitle(rank) {
    var tier = 1;
    for (var i = 0; i < RANK_TITLES.length; i++) {
      if (rank >= RANK_TITLES[i][0]) tier = i + 1;
    }
    return { name: RANK_TITLES[tier - 1][1], tier: tier };
  }

  // ----- Daily goal -----

  // The goal after this one, for the goal button. An unknown goal goes to the default.
  function nextGoal(goal) {
    var choices = CONSTANTS.GOAL_CHOICES;
    var index = choices.indexOf(goal);
    if (index === -1) return CONSTANTS.DEFAULT_GOAL;
    return choices[(index + 1) % choices.length];
  }

  function goalOf(save) {
    return save.settings && typeof save.settings.goal === 'number' ? save.settings.goal : CONSTANTS.DEFAULT_GOAL;
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

  function addDays(dateString, count) {
    var date = new Date(utcMidnight(dateString) + count * MS_PER_DAY);
    return date.getUTCFullYear() + '-' + pad2(date.getUTCMonth() + 1) + '-' + pad2(date.getUTCDate());
  }

  // ----- Day log: XP and studying per day, for the goal ring and the week strip -----

  function hasDay(save, date) {
    return Boolean(save.days) && Object.prototype.hasOwnProperty.call(save.days, date);
  }

  // Today's entry, made if needed. Days older than DAYS_KEPT are dropped whenever a day is written.
  function dayEntry(save, today) {
    if (!save.days) save.days = {};
    Object.keys(save.days).forEach(function (date) {
      if (dayDiff(date, today) >= CONSTANTS.DAYS_KEPT) delete save.days[date];
    });
    if (!hasDay(save, today)) save.days[today] = { xp: 0, studied: false };
    return save.days[today];
  }

  function todayXp(save, today) {
    return hasDay(save, today) ? save.days[today].xp : 0;
  }

  var WEEKDAY_LETTERS = 'SMTWTFS';

  // The last seven days, oldest first. A day counts as studied when the log says so, or when it is
  // part of the current streak (saves from before the log have only the streak).
  function weekStrip(save, today) {
    var week = [];
    for (var back = 6; back >= 0; back--) {
      var date = addDays(today, -back);
      var logged = hasDay(save, date) && save.days[date].studied;
      var inStreak = false;
      if (save.lastStudyDate !== null && save.streak > 0) {
        var before = dayDiff(date, save.lastStudyDate);
        inStreak = before >= 0 && before < save.streak;
      }
      week.push({
        date: date,
        letter: WEEKDAY_LETTERS.charAt(new Date(utcMidnight(date)).getUTCDay()),
        studied: Boolean(logged || inStreak),
        today: back === 0
      });
    }
    return week;
  }

  // Called when a lesson is completed. Same day: no change. Next day: one more.
  // Anything else restarts at 1, including a date before the last study date (a corrected PC clock).
  // The day is also marked studied in the day log.
  function applyStreak(save, today) {
    dayEntry(save, today).studied = true;
    var days = save.lastStudyDate === null ? null : dayDiff(save.lastStudyDate, today);
    if (days === 0) return;
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

  // ----- Lesson and review sessions -----
  // A session is plain data. `queue` holds the ids of questions not yet answered right, in order.

  function newSession(unit, kind, lessonId, questionIds) {
    return {
      unitId: unit.id,
      kind: kind,
      lessonId: lessonId,
      queue: questionIds,
      total: questionIds.length,
      hearts: CONSTANTS.HEARTS_PER_LESSON,
      wrongCount: 0,
      firstTryCorrect: 0,
      seen: [],
      missed: [],
      xpEarned: 0,
      perfect: false,
      status: 'active',
      awaitingContinue: false
    };
  }

  function startLesson(unit, lessonId) {
    var found = AQ.units.findLesson(unit, lessonId);
    if (!found) return null;
    var ids = found.lesson.questions.map(function (question) { return question.id; });
    return newSession(unit, 'lesson', lessonId, ids);
  }

  // Takes the oldest questions from the review pile. Ids the unit no longer has are skipped.
  function startReview(unit, progress) {
    var ids = progress.review
      .filter(function (id) { return AQ.units.findQuestion(unit, id) !== null; })
      .slice(0, CONSTANTS.REVIEW_LESSON_SIZE);
    if (ids.length === 0) return null;
    return newSession(unit, 'review', null, ids);
  }

  // The final test: every test question once, in random order. No hearts, no requeue, no wait.
  function startTest(unit, rng) {
    var questions = AQ.units.testQuestions(unit);
    if (questions.length === 0) return null;
    var ids = shuffledOrder(questions.length, rng).map(function (index) { return questions[index].id; });
    return newSession(unit, 'test', null, ids);
  }

  function currentQuestion(unit, session) {
    if (session.queue.length === 0) return null;
    return AQ.units.findQuestion(unit, session.queue[0]);
  }

  function addOnce(list, item) {
    if (list.indexOf(item) === -1) list.push(item);
  }

  function removeItem(list, item) {
    var index = list.indexOf(item);
    if (index !== -1) list.splice(index, 1);
  }

  function awardXp(save, session, amount, today) {
    save.xp += amount;
    session.xpEarned += amount;
    dayEntry(save, today).xp += amount;
  }

  // A choice response is the choice's index in the unit file. An input response is the typed text.
  function isUsableResponse(question, response) {
    if (question.type === 'choice') return typeof response === 'number';
    return typeof response === 'string' && !AQ.checker.isBlank(response);
  }

  function isRightAnswer(question, response) {
    if (question.type === 'choice') return response === question.answer;
    return AQ.checker.isCorrect(response, question.answers);
  }

  function completeSession(save, session, today) {
    session.status = 'complete';
    awardXp(save, session, CONSTANTS.XP_LESSON_COMPLETE, today);
    if (session.wrongCount === 0) {
      awardXp(save, session, CONSTANTS.XP_PERFECT_BONUS, today);
      session.perfect = true;
    }
    if (session.kind === 'lesson') {
      addOnce(save.progress[session.unitId].completedLessons, session.lessonId);
    }
    applyStreak(save, today);
  }

  function testScore(session) {
    return Math.round(100 * session.firstTryCorrect / session.total);
  }

  function testPassed(session) {
    return testScore(session) >= CONSTANTS.TEST_PASS_PERCENT;
  }

  function completeTest(save, session, today) {
    var progress = save.progress[session.unitId];
    var score = testScore(session);
    session.status = 'complete';
    session.perfect = session.wrongCount === 0;
    if (testPassed(session)) awardXp(save, session, CONSTANTS.XP_TEST_PASS, today);
    if (typeof progress.testBest !== 'number' || score > progress.testBest) progress.testBest = score;
    applyStreak(save, today);
  }

  // A test question is answered once. Right or wrong, it leaves the queue and the test moves on.
  function recordTestAnswer(save, session, progress, question, correct, today) {
    session.queue.shift();
    if (correct) {
      awardXp(save, session, CONSTANTS.XP_CORRECT, today);
      session.firstTryCorrect += 1;
    } else {
      session.wrongCount += 1;
      addOnce(session.missed, question.id);
      addOnce(progress.review, question.id);
    }
    addOnce(session.seen, question.id);
    if (session.queue.length === 0) completeTest(save, session, today);
  }

  // Grades the question at the head of the queue and updates the save and the session.
  // Returns null, changing nothing, when the session is not waiting for an answer or the response is empty.
  // Only a review session removes ids from the review pile; a normal lesson never does.
  function submitAnswer(save, unit, session, response, today) {
    if (session.status !== 'active' || session.awaitingContinue) return null;
    var question = currentQuestion(unit, session);
    if (!question || !isUsableResponse(question, response)) return null;

    var progress = save.progress[session.unitId];
    var correct = isRightAnswer(question, response);

    if (session.kind === 'test') {
      recordTestAnswer(save, session, progress, question, correct, today);
      return { correct: correct, question: question };
    }
    session.queue.shift();

    if (correct) {
      awardXp(save, session, CONSTANTS.XP_CORRECT, today);
      if (session.seen.indexOf(question.id) === -1) session.firstTryCorrect += 1;
      if (session.kind === 'review') removeItem(progress.review, question.id);
    } else {
      session.hearts -= 1;
      session.wrongCount += 1;
      session.queue.push(question.id);
      addOnce(session.missed, question.id);
      addOnce(progress.review, question.id);
    }
    addOnce(session.seen, question.id);
    session.awaitingContinue = true;

    if (session.hearts === 0) {
      session.status = 'failed';
    } else if (session.queue.length === 0) {
      completeSession(save, session, today);
    }
    return { correct: correct, question: question };
  }

  // Counts the current test question as wrong. Only an active test can be skipped.
  function skipQuestion(save, unit, session, today) {
    if (session.kind !== 'test' || session.status !== 'active') return null;
    var question = currentQuestion(unit, session);
    if (!question) return null;
    recordTestAnswer(save, session, save.progress[session.unitId], question, false, today);
    return { correct: false, question: question };
  }

  // The test opens once the unit has one and every level is complete.
  function isTestUnlocked(unit, progress) {
    if (AQ.units.testQuestions(unit).length === 0) return false;
    return unit.levels.every(function (level) { return isLevelComplete(level, progress); });
  }

  // What the Continue button on home does next: the first unfinished lesson, then the final test
  // until it is passed, then the review pile. 'done' when none of those is left.
  function nextStep(unit, progress) {
    var states = levelStates(unit, progress);
    for (var i = 0; i < unit.levels.length; i++) {
      if (states[i] !== 'open') continue;
      var level = unit.levels[i];
      for (var j = 0; j < level.lessons.length; j++) {
        if (progress.completedLessons.indexOf(level.lessons[j].id) !== -1) continue;
        return { kind: 'lesson', lessonId: level.lessons[j].id, levelNumber: i + 1, lessonNumber: j + 1, levelTitle: level.title };
      }
    }
    var passed = typeof progress.testBest === 'number' && progress.testBest >= CONSTANTS.TEST_PASS_PERCENT;
    if (AQ.units.testQuestions(unit).length > 0 && !passed) return { kind: 'test' };
    if (progress.review.length > 0) return { kind: 'review', count: progress.review.length };
    return { kind: 'done' };
  }

  // ----- Badges -----

  var BADGES = [
    { id: 'first-lesson', name: 'First steps', how: 'Finish your first lesson.' },
    { id: 'perfect', name: 'Flawless', how: 'Finish a lesson or review with no mistakes.' },
    { id: 'streak-3', name: 'On a roll', how: 'Study 3 days in a row.' },
    { id: 'streak-7', name: 'Week warrior', how: 'Study 7 days in a row.' },
    { id: 'streak-30', name: 'Unstoppable', how: 'Study 30 days in a row.' },
    { id: 'goal', name: 'Goal getter', how: 'Reach your daily XP goal.' },
    { id: 'review-clear', name: 'Clean slate', how: 'Empty your review pile with a review.' },
    { id: 'level', name: 'Level cleared', how: 'Finish every lesson in a level.' },
    { id: 'unit', name: 'Unit conquered', how: 'Finish every lesson in a unit.' },
    { id: 'test-pass', name: 'Test passed', how: 'Score 80% or more on a final test.' },
    { id: 'test-100', name: 'Perfect score', how: 'Score 100% on a final test.' },
    { id: 'rank-10', name: 'Rank 10', how: 'Reach rank 10.' }
  ];

  // True when any unit in the save passes the check, which gets the unit and its progress.
  function anyUnit(save, check) {
    return Object.keys(save.units).some(function (id) { return check(save.units[id], save.progress[id]); });
  }

  function testBestAtLeast(save, percent) {
    return anyUnit(save, function (unit, progress) {
      return typeof progress.testBest === 'number' && progress.testBest >= percent;
    });
  }

  // Each check gets the save, the session that just ended (null when the app opens), and today.
  var BADGE_CHECKS = {
    'first-lesson': function (save) {
      return anyUnit(save, function (unit, progress) { return progress.completedLessons.length > 0; });
    },
    'perfect': function (save, session) {
      return session !== null && session.kind !== 'test' && session.status === 'complete' && session.perfect;
    },
    'streak-3': function (save) { return save.streak >= 3; },
    'streak-7': function (save) { return save.streak >= 7; },
    'streak-30': function (save) { return save.streak >= 30; },
    'goal': function (save, session, today) { return todayXp(save, today) >= goalOf(save); },
    'review-clear': function (save, session) {
      if (session === null || session.kind !== 'review' || session.status !== 'complete') return false;
      var progress = save.progress[session.unitId];
      return Boolean(progress) && progress.review.length === 0;
    },
    'level': function (save) {
      return anyUnit(save, function (unit, progress) { return levelStates(unit, progress).indexOf('complete') !== -1; });
    },
    'unit': function (save) {
      return anyUnit(save, function (unit, progress) {
        return unit.levels.length > 0 && unit.levels.every(function (level) { return isLevelComplete(level, progress); });
      });
    },
    'test-pass': function (save) { return testBestAtLeast(save, CONSTANTS.TEST_PASS_PERCENT); },
    'test-100': function (save) { return testBestAtLeast(save, 100); },
    'rank-10': function (save) { return rankForXp(save.xp) >= 10; }
  };

  // Records every badge the save has now earned and did not have, dated today.
  // Returns the new ids in BADGES order.
  function earnBadges(save, session, today) {
    if (!save.badges) save.badges = {};
    var earned = [];
    BADGES.forEach(function (badge) {
      if (Object.prototype.hasOwnProperty.call(save.badges, badge.id)) return;
      if (!BADGE_CHECKS[badge.id](save, session || null, today)) return;
      save.badges[badge.id] = today;
      earned.push(badge.id);
    });
    return earned;
  }

  function continueSession(session) {
    session.awaitingContinue = false;
  }

  // Whole percent of questions answered right the first time they were shown.
  function accuracy(session) {
    return Math.round(100 * session.firstTryCorrect / session.total);
  }

  var api = {
    CONSTANTS: CONSTANTS,
    rankForXp: rankForXp,
    xpIntoRank: xpIntoRank,
    rankTitle: rankTitle,
    nextGoal: nextGoal,
    goalOf: goalOf,
    todayXp: todayXp,
    weekStrip: weekStrip,
    nextStep: nextStep,
    BADGES: BADGES,
    earnBadges: earnBadges,
    levelStates: levelStates,
    localDateString: localDateString,
    dayDiff: dayDiff,
    applyStreak: applyStreak,
    refreshStreak: refreshStreak,
    shuffledOrder: shuffledOrder,
    startLesson: startLesson,
    startReview: startReview,
    startTest: startTest,
    skipQuestion: skipQuestion,
    testScore: testScore,
    testPassed: testPassed,
    isTestUnlocked: isTestUnlocked,
    currentQuestion: currentQuestion,
    submitAnswer: submitAnswer,
    continueSession: continueSession,
    accuracy: accuracy
  };
  AQ.game = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
