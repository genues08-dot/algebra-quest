// Views: turn data into HTML strings for each screen. Nothing here touches the page.
// Every piece of text that comes from a unit file goes through escapeHtml.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./game.js');
    require('./mathexpr.js');
    require('./plot.js');
    require('./calc.js');
  }

  var ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (character) { return ESCAPES[character]; });
  }

  // ----- Home screen -----

  function homeModel(save) {
    var model = {
      rank: AQ.game.rankForXp(save.xp),
      xpIntoRank: AQ.game.xpIntoRank(save.xp),
      xpPerRank: AQ.game.CONSTANTS.XP_PER_RANK,
      streak: save.streak,
      units: Object.keys(save.units).map(function (id) {
        return { id: id, title: save.units[id].title };
      }),
      currentUnitId: save.currentUnitId,
      reviewCount: 0,
      levels: [],
      test: null,
      soundOn: !save.settings || save.settings.sound !== false
    };
    if (save.currentUnitId === null) return model;

    var unit = save.units[save.currentUnitId];
    var progress = save.progress[unit.id];
    var states = AQ.game.levelStates(unit, progress);
    model.reviewCount = progress.review.length;
    if (AQ.units.testQuestions(unit).length > 0) {
      model.test = {
        state: AQ.game.isTestUnlocked(unit, progress) ? 'open' : 'locked',
        best: typeof progress.testBest === 'number' ? progress.testBest : null
      };
    }
    model.levels = unit.levels.map(function (level, levelIndex) {
      return {
        title: level.title,
        state: states[levelIndex],
        lessons: level.lessons.map(function (lesson, lessonIndex) {
          return {
            id: lesson.id,
            number: lessonIndex + 1,
            complete: progress.completedLessons.indexOf(lesson.id) !== -1
          };
        })
      };
    });
    return model;
  }

  function headerHtml(model) {
    var percent = Math.round(100 * model.xpIntoRank / model.xpPerRank);
    var days = model.streak === 1 ? 'day' : 'days';
    return '<header class="topbar">' +
      '<div class="rank">' +
        '<div class="rank-name">Rank ' + model.rank + '</div>' +
        '<div class="xp-bar"><div class="xp-fill" style="width:' + percent + '%"></div></div>' +
        '<div class="xp-text">' + model.xpIntoRank + ' / ' + model.xpPerRank + ' XP</div>' +
      '</div>' +
      '<div class="streak' + (model.streak > 0 ? ' streak-on' : '') + '">' +
        '<div class="streak-count">' + model.streak + '</div>' +
        '<div class="streak-label">' + days + ' in a row</div>' +
      '</div>' +
    '</header>';
  }

  function unitBarHtml(model) {
    var options = model.units.map(function (unit) {
      var selected = unit.id === model.currentUnitId ? ' selected' : '';
      return '<option value="' + escapeHtml(unit.id) + '"' + selected + '>' + escapeHtml(unit.title) + '</option>';
    }).join('');
    return '<section class="unit-bar">' +
      '<label class="unit-label" for="unit-select">Unit</label>' +
      '<select id="unit-select" class="unit-select" data-action="select-unit">' + options + '</select>' +
      '<button type="button" class="btn btn-quiet" data-action="remove-unit">Remove unit</button>' +
    '</section>';
  }

  var LEVEL_STATE_LABELS = { locked: 'Locked', open: '', complete: 'Complete' };

  function levelHtml(level) {
    var locked = level.state === 'locked';
    var lessons = level.lessons.map(function (lesson) {
      return '<button type="button" class="lesson' + (lesson.complete ? ' done' : '') + '"' +
        ' data-action="start-lesson" data-lesson-id="' + escapeHtml(lesson.id) + '"' +
        (locked ? ' disabled' : '') + '>' +
        (lesson.complete ? '&#10003; ' : '') + 'Lesson ' + lesson.number +
      '</button>';
    }).join('');
    return '<section class="level level-' + level.state + '">' +
      '<div class="level-head">' +
        '<h2 class="level-title">' + escapeHtml(level.title) + '</h2>' +
        '<span class="level-state">' + LEVEL_STATE_LABELS[level.state] + '</span>' +
      '</div>' +
      '<div class="lessons">' + lessons + '</div>' +
    '</section>';
  }

  function footerHtml(model) {
    return '<footer class="footer">' +
      '<button type="button" class="btn" data-action="import">Import</button>' +
      '<button type="button" class="btn" data-action="backup">Backup</button>' +
      '<button type="button" class="btn" data-action="open-calculator">Calculator</button>' +
      '<button type="button" class="btn" data-action="toggle-sound">Sound: ' + (model.soundOn ? 'on' : 'off') + '</button>' +
    '</footer>';
  }

  function testEntryHtml(test) {
    if (!test) return '';
    return '<section class="test-entry test-' + test.state + '">' +
      '<div class="test-info">' +
        '<h2 class="test-title">Final test</h2>' +
        '<span class="test-best">' + (test.best === null ? 'Not taken yet' : 'Best: ' + test.best + '%') + '</span>' +
      '</div>' +
      '<button type="button" class="btn btn-primary" data-action="start-test"' +
        (test.state === 'locked' ? ' disabled' : '') + '>Start test</button>' +
    '</section>';
  }

  function homeHtml(model) {
    if (model.units.length === 0) {
      return headerHtml(model) +
        '<section class="empty"><p class="empty-text">Import a unit to start</p></section>' +
        footerHtml(model);
    }
    var reviewDisabled = model.reviewCount === 0 ? ' disabled' : '';
    return headerHtml(model) +
      unitBarHtml(model) +
      '<div class="path">' + model.levels.map(levelHtml).join('') + '</div>' +
      testEntryHtml(model.test) +
      '<section class="review-bar">' +
        '<button type="button" class="btn btn-primary" data-action="start-review"' + reviewDisabled + '>' +
          'Review (' + model.reviewCount + ')' +
        '</button>' +
        '<span class="review-note">Questions you missed come back here.</span>' +
      '</section>' +
      footerHtml(model);
  }

  // ----- Message screen (errors and notices) -----

  function messageHtml(message) {
    var lines = message.lines.map(function (line) {
      return '<p class="message-line">' + escapeHtml(line) + '</p>';
    }).join('');
    var buttons = message.actions.map(function (action, index) {
      return '<button type="button" class="btn' + (index === 0 ? ' btn-primary' : '') + '"' +
        ' data-action="' + escapeHtml(action.action) + '">' + escapeHtml(action.label) + '</button>';
    }).join('');
    return '<section class="message">' +
      '<h1 class="message-title">' + escapeHtml(message.title) + '</h1>' +
      lines +
      '<div class="message-actions">' + buttons + '</div>' +
    '</section>';
  }

  // ----- Graphs, teaching cards, and the calculator -----

  // `graph` is a unit file graph object: { fn, x, y, numbers }. Returns '' when fn does not compile.
  function graphHtml(graph, label) {
    var compiled = AQ.mathexpr.compile(graph.fn);
    if (!compiled.ok) return '';
    var x = graph.x || [-10, 10];
    var y = graph.y || [-10, 10];
    var svg = AQ.plot.svg({
      evaluate: compiled.evaluate,
      window: { xMin: x[0], xMax: x[1], yMin: y[0], yMax: y[1] },
      numbers: graph.numbers !== false,
      marks: [],
      label: label
    });
    return '<figure class="graph">' + svg + '</figure>';
  }

  // The scientific keypad, in spec order. A key either types `insert` or runs its action.
  function key(label, insert, aria, cls) {
    return { label: label, action: 'calc-key', insert: insert, aria: aria, cls: cls };
  }
  var KEYPAD = [
    { label: 'DEG/RAD', action: 'calc-mode', aria: 'switch degrees and radians', cls: 'calc-k-fn' },
    key('Ans', 'Ans', 'previous answer', 'calc-k-fn'),
    key('(', '(', 'open parenthesis', 'calc-k-fn'),
    key(')', ')', 'close parenthesis', 'calc-k-fn'),
    { label: '←', action: 'calc-back', aria: 'delete', cls: 'calc-k-fn' },
    key('sin', 'sin(', 'sine', 'calc-k-fn'),
    key('cos', 'cos(', 'cosine', 'calc-k-fn'),
    key('tan', 'tan(', 'tangent', 'calc-k-fn'),
    key('π', 'π', 'pi', 'calc-k-fn'),
    { label: 'C', action: 'calc-clear', aria: 'clear', cls: 'calc-k-fn' },
    key('sin⁻¹', 'asin(', 'inverse sine', 'calc-k-fn'),
    key('cos⁻¹', 'acos(', 'inverse cosine', 'calc-k-fn'),
    key('tan⁻¹', 'atan(', 'inverse tangent', 'calc-k-fn'),
    key('e', 'e', 'e', 'calc-k-fn'),
    key('x', 'x', 'x', 'calc-k-fn'),
    key('x²', '^2', 'squared', 'calc-k-fn'),
    key('xʸ', '^', 'power', 'calc-k-fn'),
    key('√', '√(', 'square root', 'calc-k-fn'),
    key('ˣ√', 'root(', 'nth root', 'calc-k-fn'),
    key('|x|', 'abs(', 'absolute value', 'calc-k-fn'),
    key('log', 'log(', 'log base ten', 'calc-k-fn'),
    key('ln', 'ln(', 'natural log', 'calc-k-fn'),
    key('n!', '!', 'factorial', 'calc-k-fn'),
    key('1/x', '^(-1)', 'reciprocal', 'calc-k-fn'),
    key('×10ⁿ', '×10^(', 'times ten to the power', 'calc-k-fn'),
    key('7', '7', '7', 'calc-k-num'),
    key('8', '8', '8', 'calc-k-num'),
    key('9', '9', '9', 'calc-k-num'),
    key('÷', '÷', 'divide', 'calc-k-op'),
    key('(−)', '-', 'negative', 'calc-k-op'),
    key('4', '4', '4', 'calc-k-num'),
    key('5', '5', '5', 'calc-k-num'),
    key('6', '6', '6', 'calc-k-num'),
    key('×', '×', 'times', 'calc-k-op'),
    key(',', ',', 'comma', 'calc-k-op'),
    key('1', '1', '1', 'calc-k-num'),
    key('2', '2', '2', 'calc-k-num'),
    key('3', '3', '3', 'calc-k-num'),
    key('−', '−', 'minus', 'calc-k-op'),
    key('+', '+', 'plus', 'calc-k-op'),
    key('0', '0', '0', 'calc-k-num'),
    key('.', '.', 'decimal point', 'calc-k-num'),
    { label: '=', action: 'calc-run', aria: 'equals', cls: 'calc-k-eq' }
  ];

  function keypadHtml() {
    return '<div class="calc-keypad">' + KEYPAD.map(function (k) {
      return '<button type="button" class="calc-k ' + k.cls + '" data-action="' + k.action + '"' +
        (k.insert !== undefined ? ' data-insert="' + escapeHtml(k.insert) + '"' : '') +
        ' aria-label="' + escapeHtml(k.aria) + '">' + escapeHtml(k.label) + '</button>';
    }).join('') + '</div>';
  }

  // A whole-number result already starts with "= " (such as "= 2"), so it gets no second one.
  function historyLine(entry) {
    if (entry.result === 'graph') return entry.text + ' → graph';
    if (entry.result.indexOf('= ') === 0) return entry.text + ' ' + entry.result;
    return entry.text + ' = ' + entry.result;
  }

  function historyHtml(history) {
    if (!history.length) return '';
    return '<div class="calc-history"><h2 class="calc-history-title">History</h2>' +
      history.map(function (entry, i) {
        var line = historyLine(entry);
        return '<button type="button" class="calc-history-item" data-action="calc-history" data-index="' + i + '">' +
          escapeHtml(line) + '</button>';
      }).join('') + '</div>';
  }

  function calculatorHtml(model) {
    var mode = model.mode === 'rad' ? 'rad' : 'deg';
    var keysShown = model.keysShown !== false;
    var closable = model.closable !== false;
    var history = model.history || [];
    var result = model.result;
    var graphPart = '';
    var resultPart = '';
    if (result && result.kind === 'graph') {
      var marks = result.zeros.map(function (z) { return { x: z, y: 0, kind: 'zero' }; })
        .concat(result.turningPoints.map(function (p) { return { x: p.x, y: p.y, kind: p.kind }; }));
      graphPart = '<figure class="graph">' + AQ.plot.svg({
        evaluate: result.evaluate,
        window: result.window,
        numbers: true,
        marks: marks,
        label: 'Graph of y = ' + model.text
      }) + '</figure>' +
        '<p class="calc-line">' + escapeHtml(result.zerosLine) + '</p>' +
        '<p class="calc-line">' + escapeHtml(result.turningLine) + '</p>' +
        '<div class="calc-zoom">' +
          '<button type="button" class="btn" data-action="calc-zoom-in">Zoom in</button>' +
          '<button type="button" class="btn" data-action="calc-zoom-out">Zoom out</button>' +
          '<button type="button" class="btn" data-action="calc-reset">Reset</button>' +
        '</div>';
    } else if (result && result.kind === 'number') {
      resultPart = '<p class="calc-result">' + escapeHtml(result.display) + '</p>';
    }
    return '<section class="calc-panel">' +
      '<div class="calc-row">' +
        '<input type="text" class="calc-input" data-role="calc-input" autocomplete="off" spellcheck="false"' +
          ' aria-label="Calculator input" placeholder="Try 2+3 or x^2-4" value="' + escapeHtml(model.text) + '">' +
        '<button type="button" class="btn btn-primary" data-action="calc-run">Go</button>' +
        (closable ? '<button type="button" class="btn btn-quiet" data-action="calc-close" aria-label="Close calculator">&#10005;</button>' : '') +
      '</div>' +
      '<div class="calc-modebar"><span class="calc-mode-label">' + (mode === 'rad' ? 'RAD' : 'DEG') + '</span></div>' +
      (model.error ? '<p class="calc-error" role="alert">' + escapeHtml(model.error) + '</p>' : '') +
      resultPart +
      graphPart +
      (keysShown ? keypadHtml() : '') +
      '<button type="button" class="btn btn-quiet calc-keys-toggle" data-action="calc-keys">' + (keysShown ? 'Hide keys' : 'Show keys') + '</button>' +
      historyHtml(history) +
    '</section>';
  }

  function calculatorScreenHtml(model) {
    var screenModel = Object.assign({}, model, { closable: false });
    return '<section class="calc-screen">' +
      '<header class="calc-screen-bar">' +
        '<button type="button" class="btn" data-action="home">Home</button>' +
        '<h1 class="calc-screen-title">Calculator</h1>' +
      '</header>' +
      calculatorHtml(screenModel) +
    '</section>';
  }

  function teachHtml(model) {
    var last = model.index === model.total - 1;
    var paragraphs = (model.text || []).map(function (paragraph) {
      return '<p class="teach-text">' + escapeHtml(paragraph) + '</p>';
    }).join('');
    var example = '';
    if (model.example) {
      example = '<div class="teach-example">' +
        '<p class="teach-problem">' + escapeHtml(model.example.problem) + '</p>' +
        '<ol class="teach-steps">' + model.example.steps.map(function (step) {
          return '<li>' + escapeHtml(step) + '</li>';
        }).join('') + '</ol>' +
      '</div>';
    }
    var graph = model.graph ? graphHtml(model.graph, 'Graph for this card') : '';
    var nextLabel = !last ? 'Next' : (model.fromNotes ? 'Back to question' : 'Start practice');
    var skipLabel = model.fromNotes ? 'Back to question' : 'Skip to questions';
    return '<section class="teach">' +
      '<div class="teach-count">' + (model.index + 1) + ' of ' + model.total + '</div>' +
      '<h1 class="teach-title">' + escapeHtml(model.title) + '</h1>' +
      paragraphs + example + graph +
      '<div class="teach-actions">' +
        '<button type="button" class="btn" data-action="teach-back"' + (model.index === 0 ? ' disabled' : '') + '>Back</button>' +
        '<button type="button" class="btn btn-primary" data-action="teach-next">' + nextLabel + '</button>' +
      '</div>' +
      '<button type="button" class="btn btn-quiet teach-skip" data-action="teach-skip">' + skipLabel + '</button>' +
    '</section>';
  }

  // Notes and Calculator controls. None of it shows once the question is answered.
  function toolsHtml(model) {
    if (model.locked) return '';
    var notes = model.hasNotes ?
      '<button type="button" class="btn btn-quiet" data-action="notes">Notes</button>' : '';
    var calc = '';
    if (model.calculatorAllowed === true) {
      calc = model.calculatorPanel ? calculatorHtml(model.calculatorPanel) :
        '<button type="button" class="btn btn-quiet" data-action="calc-open">Calculator</button>';
    } else if (model.calculatorAllowed === false) {
      calc = '<p class="calc-note">No calculator for this question.</p>';
    }
    if (!notes && !calc) return '';
    return '<div class="lesson-tools">' + notes + calc + '</div>';
  }

  // ----- Lesson screen -----

  function heartsHtml(hearts, maxHearts) {
    var icons = '';
    for (var i = 0; i < maxHearts; i++) {
      icons += i < hearts ? '<span class="heart">&#9829;</span>' : '<span class="heart heart-lost">&#9825;</span>';
    }
    return '<div class="hearts" aria-label="' + hearts + ' of ' + maxHearts + ' hearts">' + icons + '</div>';
  }

  function choicesHtml(model) {
    var disabled = model.locked ? ' disabled' : '';
    var buttons = model.choices.map(function (choice) {
      var pressed = choice.index === model.selected;
      return '<button type="button" class="choice"' +
        ' data-action="choose" data-index="' + choice.index + '" aria-pressed="' + pressed + '"' + disabled + '>' +
        escapeHtml(choice.text) +
      '</button>';
    }).join('');
    return '<div class="choices">' + buttons + '</div>';
  }

  function answerBoxHtml(model) {
    var value = model.answerText ? ' value="' + escapeHtml(model.answerText) + '"' : '';
    return '<input type="text" class="answer" data-role="answer" autocomplete="off" spellcheck="false"' +
      ' aria-label="Your answer" placeholder="Type your answer"' + value + (model.locked ? ' disabled' : '') + '>';
  }

  // `locked` and `answerText` are optional. A locked lesson shows the question as answered,
  // with no Check or Hint buttons, so a feedback panel can sit under it.
  function lessonHtml(model) {
    var testMode = model.mode === 'test';
    var percent = Math.round(100 * model.done / model.total);
    var buttons = model.locked ? '' : (testMode ?
      '<div class="lesson-actions">' +
        '<button type="button" class="btn" data-action="skip">Skip</button>' +
        '<button type="button" class="btn btn-primary" data-action="check">Submit</button>' +
      '</div>' :
      '<div class="lesson-actions">' +
        '<button type="button" class="btn" data-action="hint">Hint</button>' +
        '<button type="button" class="btn btn-primary" data-action="check">Check</button>' +
      '</div>');
    var top = testMode ?
      '<div class="test-count">Question ' + (model.done + 1) + ' of ' + model.total + '</div>' :
      '<div class="progress" aria-label="Question ' + model.done + ' of ' + model.total + ' done">' +
        '<div class="progress-fill" style="width:' + percent + '%"></div>' +
      '</div>' + heartsHtml(model.hearts, model.maxHearts);
    var toolsModel = model;
    if (testMode) {
      toolsModel = {};
      Object.keys(model).forEach(function (key) { toolsModel[key] = model[key]; });
      toolsModel.hasNotes = false;
    }
    return '<section class="lesson-screen">' +
      '<div class="lesson-top">' +
        '<button type="button" class="btn btn-quiet quit" data-action="quit" aria-label="Quit lesson">&#10005;</button>' +
        top +
      '</div>' +
      '<h1 class="prompt">' + escapeHtml(model.prompt) + '</h1>' +
      (model.graph ? graphHtml(model.graph, 'Graph for this question') : '') +
      (model.type === 'choice' ? choicesHtml(model) : answerBoxHtml(model)) +
      (model.hintVisible && !testMode ? '<p class="hint"><strong>Hint:</strong> ' + escapeHtml(model.hint) + '</p>' : '') +
      toolsHtml(toolsModel) +
      buttons +
    '</section>';
  }

  function feedbackHtml(feedback) {
    var body = feedback.correct ?
      '<h2 class="feedback-title">Correct!</h2>' :
      '<h2 class="feedback-title">Not quite</h2>' +
      '<p class="feedback-solution">' + escapeHtml(feedback.solution) + '</p>';
    return '<section class="feedback ' + (feedback.correct ? 'feedback-correct' : 'feedback-wrong') + '">' +
      body +
      '<button type="button" class="btn btn-primary" data-action="continue">Continue</button>' +
    '</section>';
  }

  // ----- End-of-lesson screens -----

  function completeHtml(result) {
    return '<section class="result">' +
      '<h1 class="result-title">Lesson complete!</h1>' +
      '<div class="result-stats">' +
        '<div class="result-stat"><div class="result-value">+' + result.xpEarned + ' XP</div><div class="result-label">earned</div></div>' +
        '<div class="result-stat"><div class="result-value">' + result.accuracy + '%</div><div class="result-label">right on the first try</div></div>' +
      '</div>' +
      (result.perfect ? '<p class="result-perfect">Perfect! No mistakes.</p>' : '') +
      '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" data-action="home">Continue</button>' +
      '</div>' +
    '</section>';
  }

  function failedHtml(result) {
    var missed = result.missed.map(function (item) {
      return '<li class="missed-item">' +
        '<div class="missed-prompt">' + escapeHtml(item.prompt) + '</div>' +
        '<div class="missed-solution">' + escapeHtml(item.solution) + '</div>' +
      '</li>';
    }).join('');
    return '<section class="result">' +
      '<h1 class="result-title">Out of hearts</h1>' +
      '<p class="result-note">Read through the ones you missed, then try again.</p>' +
      '<ul class="missed">' + missed + '</ul>' +
      '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" data-action="retry">Retry</button>' +
        '<button type="button" class="btn" data-action="home">Home</button>' +
      '</div>' +
    '</section>';
  }

  function testResultHtml(result) {
    var missed = result.missed.map(function (item) {
      return '<li class="missed-item">' +
        '<div class="missed-prompt">' + escapeHtml(item.prompt) + '</div>' +
        '<div class="missed-solution">' + escapeHtml(item.solution) + '</div>' +
      '</li>';
    }).join('');
    var pass = AQ.game.CONSTANTS.TEST_PASS_PERCENT;
    return '<section class="result test-result">' +
      '<h1 class="result-title">Final test</h1>' +
      '<div class="test-score">' + result.score + '%</div>' +
      '<p class="test-verdict ' + (result.passed ? 'test-passed' : 'test-failed') + '">' +
        (result.passed ? 'Passed' : 'Not passed yet. You need ' + pass + '%.') + '</p>' +
      '<div class="result-stats">' +
        '<div class="result-stat"><div class="result-value">+' + result.xpEarned + ' XP</div><div class="result-label">earned</div></div>' +
      '</div>' +
      (result.missed.length === 0 ? '<p class="result-perfect">You got every question right.</p>' :
        '<p class="result-note">Questions you missed:</p><ul class="missed">' + missed + '</ul>') +
      '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" data-action="retry">Retake</button>' +
        '<button type="button" class="btn" data-action="home">Home</button>' +
      '</div>' +
    '</section>';
  }

  var api = {
    escapeHtml: escapeHtml,
    homeModel: homeModel,
    homeHtml: homeHtml,
    messageHtml: messageHtml,
    lessonHtml: lessonHtml,
    graphHtml: graphHtml,
    teachHtml: teachHtml,
    calculatorHtml: calculatorHtml,
    calculatorScreenHtml: calculatorScreenHtml,
    KEYPAD: KEYPAD,
    feedbackHtml: feedbackHtml,
    completeHtml: completeHtml,
    failedHtml: failedHtml,
    testResultHtml: testResultHtml
  };
  AQ.views = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
