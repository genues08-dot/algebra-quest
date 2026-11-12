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
    DAYS_KEPT: 14,
    TWO_STAR_PERCENT: 70,
    XP_REWIND_BONUS: 20,
    REWIND_SIZE: 10,
    SPEED_SECONDS: 60,
    SPEED_MAX: 40,
    COMBO_BONUS_EVERY: 5,
    COMBO_BONUS_XP: 5,
    MAX_FREEZES: 2,
    LESSONS_TO_UNLOCK: 2
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
  function doneCount(level, progress) {
    return level.lessons.filter(function (lesson) {
      return progress.completedLessons.indexOf(lesson.id) !== -1;
    }).length;
  }

  // One state per level. The first level is open. A level opens when the open level before it has
  // LESSONS_TO_UNLOCK finished lessons (all of them, if it has fewer), or when it or a later level
  // has any finished lesson, so adding lessons to a unit never locks a level again.
  // A level is complete only when all of its lessons are.
  function levelStates(unit, progress) {
    var lastTouched = -1;
    unit.levels.forEach(function (level, index) {
      if (doneCount(level, progress) > 0) lastTouched = index;
    });
    var opensNext = true;
    return unit.levels.map(function (level, index) {
      var done = doneCount(level, progress);
      var state = done === level.lessons.length ? 'complete' : (opensNext || index <= lastTouched ? 'open' : 'locked');
      opensNext = state !== 'locked' && done >= Math.min(CONSTANTS.LESSONS_TO_UNLOCK, level.lessons.length);
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

  // Today's entry, made if needed. Whenever a day is written, days older than DAYS_KEPT are dropped,
  // and so are days after today (left by a PC clock that was set ahead).
  function dayEntry(save, today) {
    if (!save.days) save.days = {};
    Object.keys(save.days).forEach(function (date) {
      var age = dayDiff(date, today);
      if (age >= CONSTANTS.DAYS_KEPT || age < 0) delete save.days[date];
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
      var frozen = hasDay(save, date) && save.days[date].frozen === true && !logged;
      var inStreak = false;
      if (save.lastStudyDate !== null && save.streak > 0) {
        var before = dayDiff(date, save.lastStudyDate);
        inStreak = before >= 0 && before < save.streak;
      }
      week.push({
        date: date,
        letter: WEEKDAY_LETTERS.charAt(new Date(utcMidnight(date)).getUTCDay()),
        studied: Boolean(logged || (inStreak && !frozen)),
        frozen: Boolean(frozen),
        today: back === 0
      });
    }
    return week;
  }

  // Called when a lesson is completed. Same day: no change. Next day: one more.
  // Anything else restarts at 1, including a date before the last study date (a corrected PC clock).
  // The day is also marked studied in the day log.
  function applyStreak(save, today) {
    if (save.lastStudyDate !== null && dayDiff(save.lastStudyDate, today) > 1) refreshStreak(save, today);
    dayEntry(save, today).studied = true;
    var days = save.lastStudyDate === null ? null : dayDiff(save.lastStudyDate, today);
    if (days === 0) return;
    save.streak = days === 1 ? save.streak + 1 : 1;
    save.lastStudyDate = today;
  }

  // Called when the app opens. The streak is lost once a whole day has been missed.
  // When whole days were missed and the saved streak freezes cover all of them, the freezes are
  // used: the missed days are logged as frozen and the streak goes on. Otherwise it is lost.
  // Returns the number of freezes used.
  function refreshStreak(save, today) {
    if (save.lastStudyDate === null) {
      save.streak = 0;
      return 0;
    }
    var gap = dayDiff(save.lastStudyDate, today);
    if (gap <= 1) return 0;
    var missed = gap - 1;
    var freezes = save.freezes || 0;
    if (save.streak > 0 && missed <= freezes) {
      for (var day = 1; day <= missed; day++) {
        var date = addDays(save.lastStudyDate, day);
        if (!save.days) save.days = {};
        if (!hasDay(save, date)) save.days[date] = { xp: 0, studied: false };
        save.days[date].frozen = true;
      }
      dayEntry(save, today);
      save.freezes = freezes - missed;
      save.lastStudyDate = addDays(today, -1);
      return missed;
    }
    save.streak = 0;
    return 0;
  }

  // ----- Today's counters, for the daily quests -----

  // A date before the saved one (a clock moved back) gets throwaway counters, so the saved day,
  // and what was claimed on it, stays.
  function dailyFor(save, today) {
    if (save.daily && dayDiff(save.daily.date, today) < 0) {
      return { date: today, lessons: 0, perfect: 0, correct: 0, bestCombo: 0, practice: 0, claimed: [] };
    }
    if (!save.daily || save.daily.date !== today) {
      save.daily = { date: today, lessons: 0, perfect: 0, correct: 0, bestCombo: 0, practice: 0, claimed: [] };
    }
    return save.daily;
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
      awaitingContinue: false,
      combo: 0,
      bestCombo: 0
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

  // The ids of every question in the unit's finished lessons.
  function finishedQuestionIds(unit, progress) {
    var ids = [];
    unit.levels.forEach(function (level) {
      level.lessons.forEach(function (lesson) {
        if (progress.completedLessons.indexOf(lesson.id) === -1) return;
        lesson.questions.forEach(function (question) { ids.push(question.id); });
      });
    });
    return ids;
  }

  function pickRandom(ids, count, rng) {
    return shuffledOrder(ids.length, rng).slice(0, count).map(function (index) { return ids[index]; });
  }

  // Unit Rewind: random questions from finished lessons, played like a lesson. Null with none finished.
  function startRewind(unit, progress, rng) {
    var ids = finishedQuestionIds(unit, progress);
    if (ids.length === 0) return null;
    return newSession(unit, 'rewind', null, pickRandom(ids, CONSTANTS.REWIND_SIZE, rng));
  }

  // Speed Round: as many questions from finished lessons as can be answered before endsAt.
  function startSpeed(unit, progress, rng, now) {
    var ids = finishedQuestionIds(unit, progress);
    if (ids.length === 0) return null;
    var session = newSession(unit, 'speed', null, pickRandom(ids, CONSTANTS.SPEED_MAX, rng));
    session.endsAt = now + CONSTANTS.SPEED_SECONDS * 1000;
    session.newBest = false;
    return session;
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

  // 3 stars for no mistakes, 2 for at least 70% right on the first try, otherwise 1.
  function lessonStars(session) {
    if (session.wrongCount === 0) return 3;
    return accuracy(session) >= CONSTANTS.TWO_STAR_PERCENT ? 2 : 1;
  }

  // Keeps the best stars a lesson has earned.
  function recordStars(progress, lessonId, stars) {
    if (!progress.stars) progress.stars = {};
    if (!(progress.stars[lessonId] >= stars)) progress.stars[lessonId] = stars;
  }

  function completeSession(save, session, today) {
    session.status = 'complete';
    awardXp(save, session, CONSTANTS.XP_LESSON_COMPLETE, today);
    if (session.wrongCount === 0) {
      awardXp(save, session, CONSTANTS.XP_PERFECT_BONUS, today);
      session.perfect = true;
    }
    if (session.kind === 'rewind') awardXp(save, session, CONSTANTS.XP_REWIND_BONUS, today);
    var daily = dailyFor(save, today);
    if (session.kind === 'lesson') {
      var progress = save.progress[session.unitId];
      addOnce(progress.completedLessons, session.lessonId);
      recordStars(progress, session.lessonId, lessonStars(session));
      daily.lessons += 1;
      if (session.perfect) daily.perfect += 1;
    } else {
      daily.practice += 1;
    }
    applyStreak(save, today);
  }

  // Ends a Speed Round, when time is up or the questions run out. Keeps the best score.
  function finishSpeed(save, session, today) {
    if (session.kind !== 'speed' || session.status !== 'active') return false;
    var progress = save.progress[session.unitId];
    session.status = 'complete';
    if (!(progress.speedBest >= session.firstTryCorrect)) {
      session.newBest = session.firstTryCorrect > 0;
      progress.speedBest = session.firstTryCorrect;
    }
    if (session.seen.length > 0) {
      dailyFor(save, today).practice += 1;
      applyStreak(save, today);
    }
    return true;
  }

  // A Speed Round answer: like a test answer, it is graded once and the round moves on.
  function recordSpeedAnswer(save, session, progress, question, correct, today) {
    session.queue.shift();
    if (correct) {
      awardXp(save, session, CONSTANTS.XP_CORRECT, today);
      session.firstTryCorrect += 1;
      dailyFor(save, today).correct += 1;
    } else {
      session.wrongCount += 1;
      addOnce(session.missed, question.id);
      addOnce(progress.review, question.id);
    }
    addOnce(session.seen, question.id);
    if (session.queue.length === 0) finishSpeed(save, session, today);
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
  // now (milliseconds) is needed only for a Speed Round: an answer after its time is up ends the
  // round without being graded, and the result has timeUp: true.
  function submitAnswer(save, unit, session, response, today, now) {
    if (session.status !== 'active' || session.awaitingContinue) return null;
    var question = currentQuestion(unit, session);
    if (!question) return null;
    if (session.kind === 'speed' && typeof now === 'number' && now >= session.endsAt) {
      finishSpeed(save, session, today);
      return { correct: false, question: question, timeUp: true };
    }
    if (!isUsableResponse(question, response)) return null;

    var progress = save.progress[session.unitId];
    var correct = isRightAnswer(question, response);

    if (session.kind === 'test') {
      if (correct) dailyFor(save, today).correct += 1;
      recordTestAnswer(save, session, progress, question, correct, today);
      return { correct: correct, question: question };
    }
    if (session.kind === 'speed') {
      recordSpeedAnswer(save, session, progress, question, correct, today);
      return { correct: correct, question: question };
    }
    session.queue.shift();

    var xp = 0;
    if (correct) {
      awardXp(save, session, CONSTANTS.XP_CORRECT, today);
      xp = CONSTANTS.XP_CORRECT;
      if (session.seen.indexOf(question.id) === -1) session.firstTryCorrect += 1;
      if (session.kind === 'review') removeItem(progress.review, question.id);
      session.combo += 1;
      session.bestCombo = Math.max(session.bestCombo, session.combo);
      if (session.combo % CONSTANTS.COMBO_BONUS_EVERY === 0) {
        awardXp(save, session, CONSTANTS.COMBO_BONUS_XP, today);
        xp += CONSTANTS.COMBO_BONUS_XP;
      }
      var daily = dailyFor(save, today);
      daily.correct += 1;
      daily.bestCombo = Math.max(daily.bestCombo, session.combo);
      save.bestCombo = Math.max(save.bestCombo || 0, session.combo);
    } else {
      session.combo = 0;
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
    return { correct: correct, question: question, xp: xp, combo: session.combo };
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
  // Also open when the test was taken before, so a unit that gains lessons does not lock it again.
  function isTestUnlocked(unit, progress) {
    if (AQ.units.testQuestions(unit).length === 0) return false;
    if (typeof progress.testBest === 'number') return true;
    return unit.levels.every(function (level) { return isLevelComplete(level, progress); });
  }

  // What the Continue button on home does next: the first unfinished lesson, then the final test
  // until it is passed, then the review pile. 'done' when none of those is left.
  // The next lesson is the first unfinished, open one after the latest finished lesson on the path,
  // or else the first unfinished, open one anywhere.
  function nextStep(unit, progress) {
    var states = levelStates(unit, progress);
    var open = [];
    var lastDone = -1;
    unit.levels.forEach(function (level, i) {
      level.lessons.forEach(function (lesson, j) {
        if (progress.completedLessons.indexOf(lesson.id) !== -1) {
          lastDone = open.length;
          open.push(null);
        } else {
          open.push(states[i] === 'locked' ? null :
            { kind: 'lesson', lessonId: lesson.id, levelNumber: i + 1, lessonNumber: j + 1, levelTitle: level.title });
        }
      });
    });
    var after = open.slice(lastDone + 1).filter(Boolean)[0];
    var anywhere = open.filter(Boolean)[0];
    if (after || anywhere) return after || anywhere;
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
    addDays: addDays,
    dailyFor: dailyFor,
    startRewind: startRewind,
    startSpeed: startSpeed,
    finishSpeed: finishSpeed,
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
    accuracy: accuracy,
    lessonStars: lessonStars
  };
  AQ.game = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
