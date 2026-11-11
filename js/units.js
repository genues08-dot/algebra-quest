// Unit files: validation and lookups. A unit is levels > lessons > questions.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};

  var MIN_CHOICES = 2;
  var MAX_CHOICES = 6;

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isText(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  // Returns { ok, errors }. Each error is "<path>: <message>". Never throws.
  function validate(unit) {
    if (!isPlainObject(unit)) return { ok: false, errors: ['unit: must be an object'] };

    var errors = [];
    var seenIds = { level: Object.create(null), lesson: Object.create(null), question: Object.create(null) };

    function requireText(owner, key, path) {
      if (isText(owner[key])) return true;
      errors.push(path + key + ': must be a non-empty string');
      return false;
    }

    function requireUniqueId(owner, kind, path) {
      if (!requireText(owner, 'id', path)) return;
      if (seenIds[kind][owner.id]) errors.push(path + 'id: duplicate ' + kind + ' id "' + owner.id + '"');
      seenIds[kind][owner.id] = true;
    }

    function checkChoiceQuestion(question, path) {
      var choices = question.choices;
      if (!Array.isArray(choices) || choices.length < MIN_CHOICES || choices.length > MAX_CHOICES) {
        errors.push(path + '.choices: must have ' + MIN_CHOICES + ' to ' + MAX_CHOICES + ' choices');
        return;
      }
      choices.forEach(function (choice, index) {
        if (!isText(choice)) errors.push(path + '.choices[' + index + ']: must be a non-empty string');
      });
      if (!Number.isInteger(question.answer)) {
        errors.push(path + ': answer must be a whole number');
      } else if (question.answer < 0 || question.answer >= choices.length) {
        errors.push(path + ': answer index ' + question.answer + ' is out of range');
      }
    }

    function checkInputQuestion(question, path) {
      var answers = question.answers;
      if (!Array.isArray(answers) || answers.length < 1) {
        errors.push(path + '.answers: must have at least 1 answer');
        return;
      }
      answers.forEach(function (answer, index) {
        if (!isText(answer)) errors.push(path + '.answers[' + index + ']: must be a non-empty string');
      });
    }

    function checkQuestion(question, path) {
      if (!isPlainObject(question)) {
        errors.push(path + ': must be an object');
        return;
      }
      requireUniqueId(question, 'question', path + '.');
      requireText(question, 'prompt', path + '.');
      requireText(question, 'hint', path + '.');
      requireText(question, 'solution', path + '.');
      if (question.type === 'choice') checkChoiceQuestion(question, path);
      else if (question.type === 'input') checkInputQuestion(question, path);
      else errors.push(path + '.type: must be "choice" or "input"');
    }

    function checkLesson(lesson, path) {
      if (!isPlainObject(lesson)) {
        errors.push(path + ': must be an object');
        return;
      }
      requireUniqueId(lesson, 'lesson', path + '.');
      if (!Array.isArray(lesson.questions) || lesson.questions.length < 1) {
        errors.push(path + '.questions: must have at least 1 question');
        return;
      }
      lesson.questions.forEach(function (question, index) {
        checkQuestion(question, path + '.questions[' + index + ']');
      });
    }

    function checkLevel(level, path) {
      if (!isPlainObject(level)) {
        errors.push(path + ': must be an object');
        return;
      }
      requireUniqueId(level, 'level', path + '.');
      requireText(level, 'title', path + '.');
      if (!Array.isArray(level.lessons) || level.lessons.length < 1) {
        errors.push(path + '.lessons: must have at least 1 lesson');
        return;
      }
      level.lessons.forEach(function (lesson, index) {
        checkLesson(lesson, path + '.lessons[' + index + ']');
      });
    }

    if (unit.format !== 1) errors.push('format: must be 1');
    requireText(unit, 'id', '');
    requireText(unit, 'title', '');
    if (!Array.isArray(unit.levels) || unit.levels.length < 1) {
      errors.push('levels: must have at least 1 level');
    } else {
      unit.levels.forEach(function (level, index) {
        checkLevel(level, 'levels[' + index + ']');
      });
    }

    return { ok: errors.length === 0, errors: errors };
  }

  // The lookups below expect a unit that has passed validate().

  function findLesson(unit, lessonId) {
    for (var levelIndex = 0; levelIndex < unit.levels.length; levelIndex++) {
      var level = unit.levels[levelIndex];
      for (var lessonIndex = 0; lessonIndex < level.lessons.length; lessonIndex++) {
        var lesson = level.lessons[lessonIndex];
        if (lesson.id === lessonId) {
          return { level: level, lesson: lesson, levelIndex: levelIndex, lessonIndex: lessonIndex };
        }
      }
    }
    return null;
  }

  function findQuestion(unit, questionId) {
    for (var l = 0; l < unit.levels.length; l++) {
      var lessons = unit.levels[l].lessons;
      for (var s = 0; s < lessons.length; s++) {
        var questions = lessons[s].questions;
        for (var i = 0; i < questions.length; i++) {
          if (questions[i].id === questionId) return questions[i];
        }
      }
    }
    return null;
  }

  function lessonIds(unit) {
    var ids = [];
    unit.levels.forEach(function (level) {
      level.lessons.forEach(function (lesson) { ids.push(lesson.id); });
    });
    return ids;
  }

  function questionIds(unit) {
    var ids = [];
    unit.levels.forEach(function (level) {
      level.lessons.forEach(function (lesson) {
        lesson.questions.forEach(function (question) { ids.push(question.id); });
      });
    });
    return ids;
  }

  var api = {
    validate: validate,
    findLesson: findLesson,
    findQuestion: findQuestion,
    lessonIds: lessonIds,
    questionIds: questionIds
  };
  AQ.units = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
