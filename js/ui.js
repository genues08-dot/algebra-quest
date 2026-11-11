// UI: owns the page. Holds the screen state, draws it with AQ.views, and handles clicks and keys.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./storage.js');
    require('./views.js');
    require('./calc.js');
  }

  var views = AQ.views;
  var storage = AQ.storage;
  var game = AQ.game;
  var calc = AQ.calc;

  var RAW_SAVE_FILENAME = 'algebra-quest-raw-save.txt';
  var OK_ACTION = [{ action: 'home', label: 'OK' }];
  var ANSWER_BOX = '[data-role="answer"]';
  var CALC_BOX = '[data-role="calc-input"]';

  // screen is 'home', 'message', 'broken', 'teach', 'lesson', 'feedback', 'complete', or 'failed'.
  // `save` is null only on the broken screen. The lesson fields are used only while a session runs.
  var state = {
    screen: 'home',
    save: null,
    message: null,
    rawSave: null,
    session: null,       // the running lesson or review session
    teach: null,         // { index, fromNotes } while the teaching cards show
    order: null,         // display order of the current choice question's choices
    selected: null,      // the picked choice, as its index in the unit file
    typedText: '',       // what is in the answer box
    hintVisible: false,
    lastResult: null,    // { correct, question } from the answer just checked
    // The calculator panel. It lasts until the app closes: starting a lesson does not reset it.
    // `graphText` is the last text that gave a graph, which the zoom buttons draw again.
    calc: { open: false, text: '', result: null, error: null, window: calc.DEFAULT_WINDOW, graphText: null }
  };
  var rootEl = null;
  var ls = null;
  var fileInput = null;
  // The stored text this window last read or wrote. A different value in storage means
  // another window has saved since then.
  var lastRaw = null;

  function today() {
    return game.localDateString(new Date());
  }

  // ----- Drawing -----

  var BROKEN_MESSAGE = {
    title: "Your saved progress can't be read",
    lines: [
      'The saved data on this PC is damaged, so the app cannot open it.',
      'Download a copy first if you want someone to try to repair it. Then start fresh.'
    ],
    actions: [
      { action: 'download-raw', label: 'Download my data' },
      { action: 'start-fresh', label: 'Start fresh' }
    ]
  };

  function currentUnit() {
    return state.save.units[state.save.currentUnitId];
  }

  // The teaching cards of the running lesson. Review sessions have none.
  function lessonCards() {
    var session = state.session;
    if (!session || session.kind !== 'lesson') return [];
    var found = AQ.units.findLesson(currentUnit(), session.lessonId);
    return found && found.lesson.teach ? found.lesson.teach : [];
  }

  function teachModel() {
    var cards = lessonCards();
    var card = cards[state.teach.index];
    return {
      index: state.teach.index,
      total: cards.length,
      fromNotes: state.teach.fromNotes,
      title: card.title,
      text: card.text,
      example: card.example,
      graph: card.graph
    };
  }

  function lessonModel(question, locked) {
    var session = state.session;
    var calculatorAllowed = question.calculator !== false;
    var panel = state.calc;
    return {
      done: session.total - session.queue.length,
      total: session.total,
      hearts: session.hearts,
      maxHearts: game.CONSTANTS.HEARTS_PER_LESSON,
      prompt: question.prompt,
      type: question.type,
      choices: question.type === 'choice' ? state.order.map(function (index) {
        return { index: index, text: question.choices[index] };
      }) : null,
      selected: state.selected,
      hint: question.hint,
      hintVisible: state.hintVisible,
      locked: locked,
      answerText: state.typedText,
      graph: question.graph || null,
      hasNotes: lessonCards().length > 0,
      calculatorAllowed: calculatorAllowed,
      calculatorPanel: panel.open && calculatorAllowed ?
        { text: panel.text, result: panel.result, error: panel.error } : null
    };
  }

  function missedList() {
    var unit = currentUnit();
    return state.session.missed.map(function (id) {
      var question = AQ.units.findQuestion(unit, id);
      return { prompt: question.prompt, solution: question.solution };
    });
  }

  function screenHtml() {
    var session = state.session;
    switch (state.screen) {
      case 'message':
        return views.messageHtml(state.message);
      case 'broken':
        return views.messageHtml(BROKEN_MESSAGE);
      case 'teach':
        return views.teachHtml(teachModel());
      case 'lesson':
        return views.lessonHtml(lessonModel(game.currentQuestion(currentUnit(), session), false));
      case 'feedback':
        return views.lessonHtml(lessonModel(state.lastResult.question, true)) +
          views.feedbackHtml({ correct: state.lastResult.correct, solution: state.lastResult.question.solution });
      case 'complete':
        return views.completeHtml({ xpEarned: session.xpEarned, accuracy: game.accuracy(session), perfect: session.perfect });
      case 'failed':
        return views.failedHtml({ missed: missedList() });
      default:
        return views.homeHtml(views.homeModel(state.save));
    }
  }

  function focusSelector() {
    if (state.screen === 'feedback') return '[data-action="continue"]';
    if (state.screen === 'lesson' && state.selected !== null) return '[data-index="' + state.selected + '"]';
    if (state.screen === 'lesson') return ANSWER_BOX;
    return null;
  }

  // Puts the keyboard where the next key press belongs. `selector`, when given, picks the element.
  function placeFocus(selector) {
    selector = selector || focusSelector();
    var element = selector ? rootEl.querySelector(selector) : null;
    if (!element) return;
    element.focus();
    // Keep the caret after any text already typed, for example when the hint is opened mid-answer.
    if (element.setSelectionRange) element.setSelectionRange(element.value.length, element.value.length);
  }

  // Redraws the current screen in place. `focus` is an optional selector for placeFocus.
  function render(focus) {
    rootEl.innerHTML = screenHtml();
    placeFocus(focus);
  }

  // Switches to a screen and starts it at the top of the window.
  function show(screen) {
    state.screen = screen;
    render();
    root.scrollTo(0, 0);
  }

  // With no usable save (the unreadable-save screen was showing), home has nothing to draw.
  function showHome() {
    state.session = null;
    show(state.save === null ? 'broken' : 'home');
  }

  function showMessage(title, lines) {
    state.message = { title: title, lines: lines, actions: OK_ACTION };
    show('message');
  }

  // ----- Saving -----

  // Reads the stored save into the state. Returns false, and shows the unreadable-save screen,
  // when the stored data cannot be used.
  function loadFromStorage() {
    lastRaw = ls.getItem(storage.KEY);
    var loaded = storage.load(ls);
    state.session = null;
    if (!loaded.ok) {
      state.save = null;
      state.rawSave = loaded.raw;
      show('broken');
      return false;
    }
    state.save = loaded.save;
    state.rawSave = null;
    game.refreshStreak(state.save, today());
    return true;
  }

  // Writes `save` to storage. On success it becomes the current save and this returns true.
  // If the write fails, a message is shown and the save in memory is left as it was.
  // If another Algebra Quest window has saved since this window last read or wrote, nothing is
  // written: this window loads that newer save instead, so neither window wipes the other's progress.
  function commit(save) {
    if (ls.getItem(storage.KEY) !== lastRaw) {
      if (loadFromStorage()) {
        showMessage('Progress was updated in another window', [
          'This window has loaded the newer progress.',
          'Close the other Algebra Quest window so the two cannot get out of step again.'
        ]);
      }
      return false;
    }
    if (storage.persist(ls, save).ok) {
      lastRaw = ls.getItem(storage.KEY);
      state.save = save;
      return true;
    }
    showMessage('Storage is full', ['Make a backup, then remove old units.']);
    return false;
  }

  function copyOfSave() {
    return JSON.parse(storage.serialize(state.save));
  }

  function download(filename, text) {
    var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // ----- Import -----

  // Takes the text of a unit file or a backup file. The file picker and tests both call this.
  function importText(text) {
    if (state.save === null) return;
    var result = storage.parseImportText(text);
    if (result.kind === 'error') {
      showMessage('Import failed', result.messages);
      return;
    }

    var next;
    if (result.kind === 'unit') {
      var unit = result.unit;
      if (storage.hasUnit(state.save, unit.id) && !root.confirm('Replace "' + unit.title + '"?')) return;
      next = copyOfSave();
      storage.addUnit(next, unit);
    } else {
      if (!root.confirm('Replace all current progress with this backup?')) return;
      next = result.save;
      game.refreshStreak(next, today());
    }
    if (commit(next)) showHome();
  }

  function onFilePicked() {
    var file = fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      fileInput.value = '';
      importText(String(reader.result));
    };
    reader.onerror = function () {
      fileInput.value = '';
      showMessage('Import failed', ['The file could not be read.']);
    };
    reader.readAsText(file);
  }

  // ----- Lesson flow -----

  // Copies the answer box and the calculator box into the state, so a redraw keeps what was typed.
  // The click and Enter key handlers call this before acting. It is not done during a redraw:
  // the feedback screen still shows the old answer in a disabled box, which must not carry into
  // the next question.
  function readBoxes() {
    if (state.screen !== 'lesson') return;
    var answer = rootEl.querySelector(ANSWER_BOX);
    if (answer) state.typedText = answer.value;
    var calcInput = rootEl.querySelector(CALC_BOX);
    if (calcInput) state.calc.text = calcInput.value;
  }

  function showQuestion() {
    var question = game.currentQuestion(currentUnit(), state.session);
    state.selected = null;
    state.typedText = '';
    state.hintVisible = false;
    state.lastResult = null;
    state.order = question.type === 'choice' ? game.shuffledOrder(question.choices.length) : null;
    show('lesson');
  }

  // `session` is null when the lesson id is unknown or the review pile is empty.
  // A lesson with teaching cards opens on its first card.
  function beginSession(session) {
    if (!session) return;
    state.session = session;
    state.teach = null;
    if (lessonCards().length > 0) openCards(false);
    else showQuestion();
  }

  // `fromNotes` is true when the cards were opened from a question with the Notes button.
  function openCards(fromNotes) {
    state.teach = { index: 0, fromNotes: fromNotes };
    show('teach');
  }

  // Leaving the cards from Notes goes back to the same question with nothing changed.
  function leaveCards() {
    var fromNotes = state.teach.fromNotes;
    state.teach = null;
    if (fromNotes) show('lesson');
    else showQuestion();
  }

  function checkAnswer() {
    if (state.screen !== 'lesson') return;
    var unit = currentUnit();
    var question = game.currentQuestion(unit, state.session);
    var response = question.type === 'choice' ? state.selected : state.typedText;
    var result = game.submitAnswer(state.save, unit, state.session, response, today());
    if (!result) return;
    state.lastResult = result;
    if (!commit(state.save)) return;
    state.screen = 'feedback';
    render();
  }

  function continueLesson() {
    if (state.screen !== 'feedback') return;
    game.continueSession(state.session);
    if (state.session.status === 'complete') show('complete');
    else if (state.session.status === 'failed') show('failed');
    else showQuestion();
  }

  // ----- Calculator -----
  // After each calculator action the keyboard goes back to the calculator box, so the next
  // Enter runs the calculator again instead of checking the answer.

  function calculatorShowing() {
    if (state.screen !== 'lesson' || !state.calc.open) return false;
    return game.currentQuestion(currentUnit(), state.session).calculator !== false;
  }

  // An error keeps the last result on show. Any other result replaces it.
  function runCalculator() {
    if (!calculatorShowing()) return;
    var panel = state.calc;
    var result = calc.run(panel.text, panel.window);
    if (result.kind === 'error') {
      panel.error = result.message;
    } else {
      panel.result = result;
      panel.error = null;
      panel.graphText = result.kind === 'graph' ? panel.text : null;
    }
    render(CALC_BOX);
  }

  // Sets the graph window and draws the last graph again in it. An error stays on show,
  // because it is about the text in the box, which zooming does not change.
  function setCalculatorWindow(nextWindow) {
    if (!calculatorShowing()) return;
    var panel = state.calc;
    panel.window = nextWindow;
    if (panel.graphText !== null) panel.result = calc.run(panel.graphText, panel.window);
    render(CALC_BOX);
  }

  // ----- Actions: one entry per data-action name -----

  var actions = {
    'home': function () {
      showHome();
    },
    'start-lesson': function (target) {
      beginSession(game.startLesson(currentUnit(), target.getAttribute('data-lesson-id')));
    },
    'start-review': function () {
      var unit = currentUnit();
      beginSession(game.startReview(unit, state.save.progress[unit.id]));
    },
    'choose': function (target) {
      state.selected = Number(target.getAttribute('data-index'));
      render();
    },
    'hint': function () {
      state.hintVisible = true;
      render();
    },
    'check': checkAnswer,
    'continue': continueLesson,
    'teach-next': function () {
      if (state.screen !== 'teach') return;
      if (state.teach.index < lessonCards().length - 1) {
        state.teach.index++;
        show('teach');
      } else {
        leaveCards();
      }
    },
    'teach-back': function () {
      if (state.screen !== 'teach' || state.teach.index === 0) return;
      state.teach.index--;
      show('teach');
    },
    'teach-skip': function () {
      if (state.screen === 'teach') leaveCards();
    },
    'notes': function () {
      if (state.screen === 'lesson' && lessonCards().length > 0) openCards(true);
    },
    'calc-open': function () {
      if (state.screen !== 'lesson') return;
      state.calc.open = true;
      render(CALC_BOX);
    },
    'calc-close': function () {
      if (!calculatorShowing()) return;
      state.calc.open = false;
      render();
    },
    'calc-run': runCalculator,
    'calc-zoom-in': function () {
      setCalculatorWindow(calc.zoom(state.calc.window, 0.5));
    },
    'calc-zoom-out': function () {
      setCalculatorWindow(calc.zoom(state.calc.window, 2));
    },
    'calc-reset': function () {
      setCalculatorWindow(calc.DEFAULT_WINDOW);
    },
    'quit': function () {
      if (root.confirm('Quit this lesson? XP you earned stays.')) showHome();
    },
    'retry': function () {
      var unit = currentUnit();
      var previous = state.session;
      var next = previous.kind === 'lesson' ?
        game.startLesson(unit, previous.lessonId) :
        game.startReview(unit, state.save.progress[unit.id]);
      if (next) beginSession(next);
      else showHome();
    },
    'import': function () {
      fileInput.click();
    },
    'backup': function () {
      download(storage.backupFilename(today()), storage.serialize(state.save));
    },
    'remove-unit': function () {
      var unit = state.save.units[state.save.currentUnitId];
      if (!unit || !root.confirm('Remove "' + unit.title + '" and its progress?')) return;
      var next = copyOfSave();
      storage.removeUnit(next, unit.id);
      if (commit(next)) showHome();
    },
    'download-raw': function () {
      download(RAW_SAVE_FILENAME, state.rawSave);
    },
    'start-fresh': function () {
      if (!root.confirm('Start over with no progress?')) return;
      if (commit(storage.newSave())) {
        state.rawSave = null;
        showHome();
      }
    }
  };

  function onClick(event) {
    var target = event.target.closest('[data-action]');
    if (!target || target.disabled || target.tagName === 'SELECT') return;
    var handler = actions[target.getAttribute('data-action')];
    if (!handler) return;
    readBoxes();
    handler(target);
  }

  function onChange(event) {
    var target = event.target;
    if (target.getAttribute('data-action') !== 'select-unit') return;
    var next = copyOfSave();
    next.currentUnitId = target.value;
    if (commit(next)) showHome();
  }

  // Enter checks a typed answer, Enter in the calculator box runs the calculator (and never checks
  // the answer), and Enter on the feedback panel continues.
  // preventDefault stops the same key press from also clicking the button that gets focus next,
  // and a held-down key (event.repeat) is ignored so it cannot skip through questions.
  function onKeyDown(event) {
    if (event.key !== 'Enter') return;
    readBoxes();
    var role = event.target.getAttribute ? event.target.getAttribute('data-role') : null;
    if (state.screen === 'lesson' && role === 'calc-input') {
      event.preventDefault();
      if (!event.repeat) runCalculator();
    } else if (state.screen === 'lesson' && role === 'answer') {
      event.preventDefault();
      if (!event.repeat) checkAnswer();
    } else if (state.screen === 'feedback') {
      event.preventDefault();
      if (!event.repeat) continueLesson();
    }
  }

  // ----- Startup -----

  function mount(rootElement, storageObject) {
    rootEl = rootElement;
    ls = storageObject;
    fileInput = document.getElementById('import-file');
    rootEl.addEventListener('click', onClick);
    rootEl.addEventListener('change', onChange);
    document.addEventListener('keydown', onKeyDown);
    fileInput.addEventListener('change', onFilePicked);

    // The save is in memory before the first write, so a failed write still leaves a usable app.
    if (loadFromStorage() && commit(state.save)) showHome();
  }

  var api = { mount: mount, importText: importText };
  AQ.ui = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
