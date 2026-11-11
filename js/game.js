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

  function awardXp(save, session, amount) {
    save.xp += amount;
    session.xpEarned += amount;
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
    awardXp(save, session, CONSTANTS.XP_LESSON_COMPLETE);
    if (session.wrongCount === 0) {
      awardXp(save, session, CONSTANTS.XP_PERFECT_BONUS);
      session.perfect = true;
    }
    if (session.kind === 'lesson') {
      addOnce(save.progress[session.unitId].completedLessons, session.lessonId);
    }
    applyStreak(save, today);
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
    session.queue.shift();

    if (correct) {
      awardXp(save, session, CONSTANTS.XP_CORRECT);
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
    levelStates: levelStates,
    localDateString: localDateString,
    dayDiff: dayDiff,
    applyStreak: applyStreak,
    refreshStreak: refreshStreak,
    shuffledOrder: shuffledOrder,
    startLesson: startLesson,
    startReview: startReview,
    currentQuestion: currentQuestion,
    submitAnswer: submitAnswer,
    continueSession: continueSession,
    accuracy: accuracy
  };
  AQ.game = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
