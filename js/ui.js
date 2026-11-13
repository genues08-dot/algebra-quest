// UI: owns the page. Holds the screen state, draws it with AQ.views, and handles clicks and keys.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./storage.js');
    require('./game.js');
    require('./views.js');
    require('./calc.js');
    require('./sound.js');
    require('./mascot.js');
    require('./rewards.js');
    require('./online.js');
  }

  var views = AQ.views;
  var storage = AQ.storage;
  var game = AQ.game;
  var calc = AQ.calc;

  var RAW_SAVE_FILENAME = 'algebra-quest-raw-save.txt';
  var OK_ACTION = [{ action: 'home', label: 'OK' }];
  var ANSWER_BOX = '[data-role="answer"]';
  var CALC_BOX = '[data-role="calc-input"]';

  // screen is 'home', 'message', 'broken', 'teach', 'lesson', 'feedback', 'complete', 'failed',
  // 'test-result', 'calculator', 'badges', 'mascot', 'practice', 'profile', 'more', 'guide', 'quests',
  // 'shop', 'reward', 'speed-result', or 'leaderboard' (online app only). TAB_SCREENS have the tab bar. 'guide' shows a level's
  // teaching cards from its banner. 'reward' shows gems from an opened chest. A final test question shows on the 'lesson' screen,
  // drawn in test mode. 'calculator' is the full-screen calculator opened from home.
  // `save` is null only on the broken screen. The lesson fields are used only while a session runs.
  var state = {
    screen: 'home',
    save: null,
    message: null,
    rawSave: null,
    session: null,       // the running lesson, review, or final test session
    teach: null,         // { index, fromNotes } while the teaching cards show
    order: null,         // display order of the current choice question's choices
    selected: null,      // the picked choice, as its index in the unit file
    typedText: '',       // what is in the answer box
    hintVisible: false,
    lastResult: null,    // { correct, question } from the answer just checked
    rankAtStart: 1,      // the rank when the running session began
    news: null,          // { rankUp, newBadges } for the result screen, set when a session ends
    mascotTap: null,     // the line the mascot says after a tap on home, until home is opened again
    mascotLine: null,    // the mascot's line on the feedback panel, picked when the answer is checked
    mascotError: null,   // the message on the Mascot screen, such as a missing name
    guide: null,         // { level, index } while a level's guide shows
    mascotDraft: null,   // the text in the Mascot screen's name box, kept across redraws until saved
    reward: null,        // { title, gems } while the reward screen shows
    note: null,          // a short message on the Quests or Shop screen after a claim or a buy
    speedTimer: null,    // the timer that ends a running Speed Round
    // The leaderboard (online app). rows are the players' rows as the server gave them.
    board: { mode: 'week', status: 'loading', rows: [] },
    // The calculator panel. It lasts until the app closes: starting a lesson does not reset it.
    // The lesson panel and the calculator screen share it.
    // `graphText` is the last text that gave a graph, which the zoom buttons draw again.
    // `keys` is whether the keypad shows. `history` is the last results, newest first.
    // `ans` is the last number result, which `Ans` stands for (null before the first one).
    // `caret` and `caretEnd` are the selection in the box when a button was pressed, or null
    // when it is not known. They are equal when nothing is selected.
    // `ranText` is the text of the last run that gave a result, while the next key would start
    // a new entry. ←, C, a history tap, a key, or a failed run sets it back to null.
    calc: {
      open: false,
      text: '',
      result: null,
      error: null,
      window: calc.DEFAULT_WINDOW,
      graphText: null,
      keys: true,
      history: [],
      ans: null,
      caret: null,
      caretEnd: null,
      ranText: null
    }
  };
  var TAB_SCREENS = ['home', 'quests', 'practice', 'badges', 'profile', 'more', 'shop', 'leaderboard'];
  // The online app's account and leaderboard, from mount's options. Null in the offline app.
  // { uid, name, leaderboard() -> Promise of rows, logOut(), deleteAccount() -> Promise that
  // rejects with a message }.
  var online = null;
  // Counts leaderboard loads, so only the newest one's answer is drawn.
  var boardRequest = 0;
  var rootEl = null;
  var ls = null;
  var builtInUnits = []; // the units built into the app, from options.units
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

  function inTest() {
    return state.session !== null && state.session.kind === 'test';
  }

  function inSpeed() {
    return state.session !== null && state.session.kind === 'speed';
  }

  // Tests and Speed Rounds have no feedback panel: an answer is saved and the next question shows.
  function inQuickMode() {
    return inTest() || inSpeed();
  }

  // AQ.sound is looked up at each call, so a replacement made after mount (as the tests do) is used.
  // sound.js plays nothing when the setting is off.
  function playSound(name) {
    AQ.sound.play(name, state.save.settings.sound);
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
      graph: card.graph,
      mascot: mascotSettings()
    };
  }

  // `closable` is false on the calculator screen, which has a Home button instead.
  function calculatorModel(closable) {
    var panel = state.calc;
    return {
      text: panel.text,
      result: panel.result,
      error: panel.error,
      mode: state.save.settings.angle,
      keysShown: panel.keys,
      history: panel.history,
      closable: closable
    };
  }

  function lessonModel(question, locked) {
    var session = state.session;
    var calculatorAllowed = question.calculator !== false;
    var panel = state.calc;
    return {
      mode: session.kind === 'test' || session.kind === 'speed' ? session.kind : 'lesson',
      elapsed: session.kind === 'speed' ? (Date.now() - (session.endsAt - game.CONSTANTS.SPEED_SECONDS * 1000)) / 1000 : 0,
      right: session.firstTryCorrect,
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
      calculatorPanel: panel.open && calculatorAllowed ? calculatorModel(true) : null
    };
  }

  // The mascot as drawn everywhere: its look (as color), its name, and the hat it wears.
  function mascotSettings() {
    var mascot = state.save.settings.mascot;
    return { color: AQ.mascot.lookOf(mascot), name: mascot.name, hat: state.save.outfits ? state.save.outfits.worn : null };
  }

  // The rank-up and new badges of the session that just ended, and the mascot, for its result screen.
  function withNews(result) {
    return Object.assign(result, state.news || {}, { mascot: mascotSettings() });
  }

  function onTabScreen() {
    return TAB_SCREENS.indexOf(state.screen) !== -1;
  }

  // Every teaching card in the lessons of level levelIndex of the current unit.
  function guideCards(levelIndex) {
    var level = currentUnit().levels[levelIndex];
    if (!level) return [];
    return level.lessons.reduce(function (cards, lesson) { return cards.concat(lesson.teach || []); }, []);
  }

  function guideModel() {
    var cards = guideCards(state.guide.level);
    var card = cards[state.guide.index];
    return {
      index: state.guide.index,
      total: cards.length,
      guide: 'Level ' + (state.guide.level + 1),
      title: card.title,
      text: card.text,
      example: card.example,
      graph: card.graph,
      mascot: mascotSettings()
    };
  }

  function hoursToMidnight() {
    var now = new Date();
    var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return Math.max(1, Math.ceil((midnight - now) / 3600000));
  }

  function questsModel() {
    var model = views.homeModel(state.save, today());
    model.quests = AQ.rewards.questStatus(state.save, today());
    model.week = AQ.rewards.weekRewardStatus(state.save, today());
    model.challenge = AQ.rewards.challengeStatus(state.save, today());
    model.hoursLeft = hoursToMidnight();
    model.note = state.note;
    return model;
  }

  function shopModel() {
    var model = views.homeModel(state.save, today());
    var outfits = state.save.outfits || { owned: [], worn: null };
    model.hats = AQ.rewards.HATS.map(function (hat) {
      return { id: hat.id, name: hat.name, price: hat.price, owned: outfits.owned.indexOf(hat.id) !== -1, worn: outfits.worn === hat.id };
    });
    model.note = state.note;
    return model;
  }

  function boardModel() {
    var model = views.homeModel(state.save, today());
    var board = state.board;
    var ranked = [];
    if (board.status === 'ready') {
      var mine = AQ.online.playerRow(state.save, online.name, today());
      ranked = AQ.online.rankRows(AQ.online.withMyRow(board.rows, online.uid, mine), board.mode, today(), online.uid);
    }
    model.board = { mode: board.mode, status: board.status, rows: ranked, line: AQ.online.boardLine(ranked, board.mode) };
    return model;
  }

  function moreModel() {
    var model = views.homeModel(state.save, today());
    model.account = online === null ? null : { name: online.name };
    return model;
  }

  function homeHtml() {
    var model = views.homeModel(state.save, today());
    if (state.mascotTap !== null) {
      model.mascot.line = state.mascotTap;
      model.mascot.bounce = true;
    }
    return views.homeHtml(model);
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
          views.feedbackHtml({
            correct: state.lastResult.correct,
            solution: state.lastResult.question.solution,
            mascot: Object.assign({ line: state.mascotLine }, mascotSettings()),
            combo: state.lastResult.combo,
            xp: state.lastResult.xp
          });
      case 'complete':
        return views.completeHtml(withNews({ xpEarned: session.xpEarned, accuracy: game.accuracy(session), perfect: session.perfect }));
      case 'failed':
        return views.failedHtml(withNews({ missed: missedList() }));
      case 'test-result':
        return views.testResultHtml(withNews({
          score: game.testScore(session),
          passed: game.testPassed(session),
          xpEarned: session.xpEarned,
          missed: missedList()
        }));
      case 'calculator':
        return views.calculatorScreenHtml(calculatorModel(false));
      case 'badges':
        return views.badgesHtml(views.badgesModel(state.save, today()));
      case 'quests':
        return views.questsHtml(questsModel());
      case 'shop':
        return views.shopHtml(shopModel());
      case 'reward':
        return views.rewardHtml({ title: state.reward.title, gems: state.reward.gems, mascot: mascotSettings() });
      case 'speed-result':
        return views.speedResultHtml(withNews({
          right: session.firstTryCorrect,
          best: typeof state.save.progress[session.unitId].speedBest === 'number' ? state.save.progress[session.unitId].speedBest : null,
          newBest: session.newBest,
          xpEarned: session.xpEarned,
          missed: missedList()
        }));
      case 'mascot':
        return views.mascotScreenHtml({
          hat: mascotSettings().hat,
          color: mascotSettings().color,
          name: state.mascotDraft !== null ? state.mascotDraft : mascotSettings().name,
          error: state.mascotError
        });
      case 'practice':
        return views.practiceHtml(views.homeModel(state.save, today()));
      case 'profile':
        return views.profileHtml(views.homeModel(state.save, today()));
      case 'more':
        return views.moreHtml(moreModel());
      case 'leaderboard':
        return views.leaderboardHtml(boardModel());
      case 'guide':
        return views.teachHtml(guideModel());
      default:
        return homeHtml();
    }
  }

  function focusSelector() {
    if (state.screen === 'feedback') return '[data-action="continue"]';
    if (state.screen === 'lesson' && state.selected !== null) return '[data-index="' + state.selected + '"]';
    if (state.screen === 'lesson') return ANSWER_BOX;
    if (state.screen === 'calculator') return CALC_BOX;
    return null;
  }

  // Puts the keyboard where the next key press belongs. `selector`, when given, picks the element.
  // `caret`, when given, is where the caret goes in that box. Otherwise it goes after the text.
  function placeFocus(selector, caret) {
    selector = selector || focusSelector();
    var element = selector ? rootEl.querySelector(selector) : null;
    if (!element) return;
    element.focus();
    // Keep the caret after any text already typed, for example when the hint is opened mid-answer.
    var at = typeof caret === 'number' ? caret : element.value.length;
    if (element.setSelectionRange) element.setSelectionRange(at, at);
  }

  // A freshly drawn calculator box reports its caret at 0 in Edge, even when it is not focused.
  // This puts the caret after its text, without focusing it, so the next key types at the end.
  function parkCalculatorCaret() {
    var box = rootEl.querySelector(CALC_BOX);
    if (box && box.setSelectionRange) box.setSelectionRange(box.value.length, box.value.length);
  }

  // Sets the saved theme on the page's root element, where the CSS reads it.
  function applyTheme() {
    var page = root.document && root.document.documentElement;
    if (!page || typeof page.setAttribute !== 'function') return;
    page.setAttribute('data-theme', state.save && state.save.settings.theme === 'dark' ? 'dark' : 'light');
  }

  // Redraws the current screen in place. `focus` and `caret` are optional, for placeFocus.
  function render(focus, caret) {
    applyTheme();
    rootEl.innerHTML = screenHtml();
    parkCalculatorCaret();
    placeFocus(focus, caret);
  }

  // Switches to a screen and starts it at the top of the window.
  function show(screen) {
    state.screen = screen;
    render();
    root.scrollTo(0, 0);
  }

  // With no usable save (the unreadable-save screen was showing), home has nothing to draw.
  function showHome() {
    stopSpeedTimer();
    state.session = null;
    state.mascotTap = null;
    state.guide = null;
    show(state.save === null ? 'broken' : 'home');
    if (state.screen === 'home') scrollToCurrent(false);
  }

  // Scrolls home to the mascot's spot on the path. With always false, only when that spot is
  // below the bottom of the window.
  function scrollToCurrent(always) {
    var spot = rootEl.querySelector('[data-current]');
    if (!spot || typeof spot.scrollIntoView !== 'function') return;
    if (!always && spot.getBoundingClientRect().bottom <= (root.innerHeight || 0)) return;
    var still = typeof root.matchMedia === 'function' && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    spot.scrollIntoView({ block: 'center', behavior: always && !still ? 'smooth' : 'auto' });
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
    var frozen = game.refreshStreak(state.save, today());
    state.freezeNotice = frozen > 0 ? { used: frozen, streak: state.save.streak } : null;
    // Badges the save has already earned are recorded quietly. The next write saves them.
    game.earnBadges(state.save, null, today());
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
    showMessage('Storage is full', ['Your progress could not be saved on this device.', 'Clear some space in your browser, then try again.']);
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

  // ----- Lesson flow -----

  // A selection position read from a box, or null when the box does not give one.
  function selectionPosition(value) {
    return typeof value === 'number' ? value : null;
  }

  // Copies the answer box and the calculator box into the state, so a redraw keeps what was typed.
  // The calculator box's selection is kept too, so a key can type at the caret.
  // The click and Enter key handlers call this before acting. It is not done during a redraw:
  // the feedback screen still shows the old answer in a disabled box, which must not carry into
  // the next question.
  function readBoxes() {
    if (state.screen === 'mascot') {
      var nameBox = rootEl.querySelector('[data-role="mascot-name"]');
      if (nameBox) state.mascotDraft = nameBox.value;
      return;
    }
    if (state.screen !== 'lesson' && state.screen !== 'calculator') return;
    var answer = rootEl.querySelector(ANSWER_BOX);
    if (answer) state.typedText = answer.value;
    var calcInput = rootEl.querySelector(CALC_BOX);
    if (calcInput) {
      state.calc.text = calcInput.value;
      state.calc.caret = selectionPosition(calcInput.selectionStart);
      state.calc.caretEnd = selectionPosition(calcInput.selectionEnd);
    }
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

  // `session` is null when the lesson id is unknown, the review pile is empty, or the test is locked.
  // A lesson with teaching cards opens on its first card. Reviews and tests have no cards.
  function beginSession(session) {
    if (!session) return;
    stopSpeedTimer();
    state.session = session;
    if (session.kind === 'speed') startSpeedTimer(session);
    state.teach = null;
    state.news = null;
    state.rankAtStart = game.rankForXp(state.save.xp);
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

  function badgeById(id) {
    return game.BADGES.filter(function (badge) { return badge.id === id; })[0];
  }

  // Called once, when an answer or skip ends the session, before it is saved.
  // Records the badges it earned and notes a rank-up, for the result screen.
  function noteSessionEnd(session) {
    if (session.status === 'active') return;
    var ids = game.earnBadges(state.save, session, today());
    var rank = game.rankForXp(state.save.xp);
    var title = game.rankTitle(rank);
    state.news = {
      rankUp: rank > state.rankAtStart ? { rank: rank, name: title.name, tier: title.tier } : null,
      newBadges: ids.map(badgeById)
    };
  }

  // In a test there is no feedback: the answer is saved and the test moves on at once.
  function checkAnswer() {
    if (state.screen !== 'lesson') return;
    var unit = currentUnit();
    var question = game.currentQuestion(unit, state.session);
    var response = question.type === 'choice' ? state.selected : state.typedText;
    var result = game.submitAnswer(state.save, unit, state.session, response, today(), Date.now());
    if (!result) return;
    noteSessionEnd(state.session);
    if (!commit(state.save)) return;
    if (inSpeed()) {
      afterSpeedAnswer();
      return;
    }
    if (inTest()) {
      afterTestAnswer();
      return;
    }
    state.lastResult = result;
    state.mascotLine = AQ.mascot.pick(AQ.mascot.LINES[result.correct ? 'correct' : 'wrong'], Math.random());
    state.screen = 'feedback';
    render();
    playSound(result.correct ? 'correct' : 'wrong');
  }

  function continueLesson() {
    if (state.screen !== 'feedback') return;
    var session = state.session;
    game.continueSession(session);
    if (session.status === 'complete') {
      show('complete');
      playSound(session.perfect ? 'perfect' : 'complete');
    } else if (session.status === 'failed') {
      show('failed');
      playSound('failed');
    } else {
      showQuestion();
    }
  }

  // ----- Final test -----
  // Right and wrong are never shown or played during a test: they would give the answer away.

  // Returns null when the unit has no test or a level is still incomplete.
  function newTestSession(unit) {
    if (!unit || !game.isTestUnlocked(unit, state.save.progress[unit.id])) return null;
    return game.startTest(unit);
  }

  // Called once a test answer or skip is saved.
  function afterTestAnswer() {
    var session = state.session;
    playSound('submit');
    if (session.status !== 'complete') {
      showQuestion();
      return;
    }
    show('test-result');
    playSound(game.testPassed(session) ? 'testPass' : 'testFail');
  }

  // ----- Speed Round -----

  function stopSpeedTimer() {
    if (state.speedTimer !== null) root.clearTimeout(state.speedTimer);
    state.speedTimer = null;
  }

  // The timer ends the round when time is up, even if no answer is given.
  function startSpeedTimer(session) {
    stopSpeedTimer();
    var timer = root.setTimeout(function () {
      state.speedTimer = null;
      if (state.session !== session || session.status !== 'active') return;
      if (!game.finishSpeed(state.save, session, today())) return;
      noteSessionEnd(session);
      if (commit(state.save)) showSpeedResult();
    }, Math.max(0, session.endsAt - Date.now()));
    // In Node (the tests) the timer must not keep the process alive.
    if (timer && typeof timer.unref === 'function') timer.unref();
    state.speedTimer = timer;
  }

  function showSpeedResult() {
    stopSpeedTimer();
    show('speed-result');
    playSound(state.session.newBest ? 'perfect' : 'complete');
  }

  function afterSpeedAnswer() {
    if (state.session.status === 'complete') {
      showSpeedResult();
      return;
    }
    playSound('submit');
    showQuestion();
  }

  function skipQuestion() {
    if (state.screen !== 'lesson' || !inTest()) return;
    var result = game.skipQuestion(state.save, currentUnit(), state.session, today());
    if (!result) return;
    noteSessionEnd(state.session);
    if (commit(state.save)) afterTestAnswer();
  }

  // ----- Calculator -----
  // After each calculator action the keyboard goes back to the calculator box, so the next
  // Enter runs the calculator again instead of checking the answer.

  // The calculator screen always shows it. In a lesson it shows when open, unless the question
  // says "no calculator".
  function calculatorShowing() {
    if (state.screen === 'calculator') return true;
    if (state.screen !== 'lesson' || !state.calc.open) return false;
    return game.currentQuestion(currentUnit(), state.session).calculator !== false;
  }

  // The saved angle mode and the last number result, which every run uses.
  function calculatorOptions() {
    return { angle: state.save.settings.angle, ans: state.calc.ans };
  }

  // An error keeps the last result on show. Any other result replaces it and goes into the history.
  // A number result also becomes Ans. A graph leaves Ans as it was.
  function runCalculator() {
    if (!calculatorShowing()) return;
    var panel = state.calc;
    var result = calc.run(panel.text, panel.window, calculatorOptions());
    if (result.kind === 'error') {
      panel.error = result.message;
      panel.ranText = null;
    } else {
      panel.result = result;
      panel.error = null;
      panel.ranText = panel.text;
      panel.graphText = result.kind === 'graph' ? panel.text : null;
      if (result.kind === 'number') panel.ans = result.value;
      var entry = calc.historyEntry(panel.text, result);
      if (entry !== null) panel.history = calc.addHistory(panel.history, entry);
    }
    render(CALC_BOX);
    if (result.kind !== 'error') selectCalculatorText();
  }

  // Selects all the text in the calculator box, which has the focus after a run. Typing on the
  // keyboard then starts a new calculation instead of adding to the old one, and a click deselects.
  function selectCalculatorText() {
    var box = rootEl.querySelector(CALC_BOX);
    if (box && box.setSelectionRange) box.setSelectionRange(0, box.value.length);
  }

  // Draws the last graph again, for a new window or a new angle mode.
  function redrawGraph() {
    var panel = state.calc;
    if (panel.graphText !== null) panel.result = calc.run(panel.graphText, panel.window, calculatorOptions());
  }

  // Sets the graph window and draws the last graph again in it. An error stays on show,
  // because it is about the text in the box, which zooming does not change.
  function setCalculatorWindow(nextWindow) {
    if (!calculatorShowing()) return;
    state.calc.window = nextWindow;
    redrawGraph();
    render(CALC_BOX);
  }

  // The selection in the calculator box, kept inside the text. When the caret is not known,
  // both ends are the end of the text, so a key types at the end.
  function calculatorSelection() {
    var panel = state.calc;
    var length = panel.text.length;
    if (panel.caret === null || panel.caretEnd === null) return { start: length, end: length };
    var start = Math.min(Math.max(panel.caret, 0), length);
    var end = Math.min(Math.max(panel.caretEnd, start), length);
    return { start: start, end: end };
  }

  // Replaces the text from `start` to `end` with `insert`, then puts the caret after it.
  function editCalculatorText(start, end, insert) {
    var panel = state.calc;
    panel.text = panel.text.slice(0, start) + insert + panel.text.slice(end);
    render(CALC_BOX, start + insert.length);
  }

  // Keys whose text goes on from the last answer when they start a new entry, like 2 = then + 1.
  var CONTINUING_KEYS = ['+', '−', '×', '÷', '^', '!'];

  // True right after a run that gave a result, while the box still holds the text that was run.
  function startsNewEntry() {
    var panel = state.calc;
    return panel.ranText !== null && panel.text === panel.ranText;
  }

  // A keypad key types its text at the caret, over any selection.
  // Right after =, it starts a new entry instead, as on a TI: an operator key goes on from Ans
  // (when there is one), and any other key replaces the box.
  function typeCalculatorKey(insert) {
    if (!calculatorShowing() || typeof insert !== 'string') return;
    var panel = state.calc;
    if (startsNewEntry()) {
      panel.ranText = null;
      var fromAns = CONTINUING_KEYS.indexOf(insert.charAt(0)) >= 0 &&
        typeof panel.ans === 'number' && isFinite(panel.ans);
      editCalculatorText(0, panel.text.length, fromAns ? 'Ans' + insert : insert);
      return;
    }
    panel.ranText = null;
    var selection = calculatorSelection();
    editCalculatorText(selection.start, selection.end, insert);
  }

  // ← deletes the selection, or else the character before the caret.
  // Right after =, the box is selected only so typing replaces it, so ← deletes the last character.
  function deleteCalculatorText() {
    if (!calculatorShowing()) return;
    var length = state.calc.text.length;
    var selection = startsNewEntry() ? { start: length, end: length } : calculatorSelection();
    state.calc.ranText = null;
    var start = selection.start === selection.end ? Math.max(selection.start - 1, 0) : selection.start;
    editCalculatorText(start, selection.end, '');
  }

  // Saves the other angle mode, like the sound switch. A graph on show is drawn again in it.
  function switchAngleMode() {
    if (!calculatorShowing()) return;
    var next = copyOfSave();
    next.settings.angle = next.settings.angle === 'rad' ? 'deg' : 'rad';
    if (!commit(next)) return;
    redrawGraph();
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
    'start-test': function () {
      beginSession(newTestSession(currentUnit()));
    },
    // The Continue button: the next lesson, then the final test, then review.
    'resume': function () {
      if (state.screen !== 'home' || state.save.currentUnitId === null) return;
      var unit = currentUnit();
      var progress = state.save.progress[unit.id];
      var next = game.nextStep(unit, progress);
      if (next.kind === 'lesson') beginSession(game.startLesson(unit, next.lessonId));
      else if (next.kind === 'test') beginSession(newTestSession(unit));
      else if (next.kind === 'review') beginSession(game.startReview(unit, progress));
    },
    'open-badges': function () {
      if (onTabScreen()) show('badges');
    },
    'open-leaderboard': function () {
      if (online === null || !onTabScreen()) return;
      show('leaderboard');
      loadBoard();
    },
    'board-mode': function (target) {
      var mode = target.getAttribute('data-mode');
      if (state.screen !== 'leaderboard' || (mode !== 'week' && mode !== 'all')) return;
      state.board.mode = mode;
      render();
    },
    'board-retry': function () {
      if (state.screen === 'leaderboard') loadBoard();
    },
    'log-out': function () {
      if (online === null || state.screen !== 'more') return;
      if (root.confirm('Log out of Algebra Quest on this device?')) online.logOut();
    },
    'delete-account': function () {
      if (online === null || state.screen !== 'more') return;
      if (!root.confirm('Delete your account, your progress, and your leaderboard spot? This cannot be undone.')) return;
      online.deleteAccount().then(null, function (message) {
        showMessage('Your account was not deleted', [String(message)]);
      });
    },
    'open-practice': function () {
      if (onTabScreen()) show('practice');
    },
    'open-quests': function () {
      if (!onTabScreen()) return;
      state.note = null;
      show('quests');
    },
    'open-shop': function () {
      if (!onTabScreen()) return;
      state.note = null;
      show('shop');
    },
    'start-rewind': function () {
      if (state.screen !== 'practice' || state.save.currentUnitId === null) return;
      var unit = currentUnit();
      beginSession(game.startRewind(unit, state.save.progress[unit.id]));
    },
    'start-speed': function () {
      if (state.screen !== 'practice' || state.save.currentUnitId === null) return;
      var unit = currentUnit();
      beginSession(game.startSpeed(unit, state.save.progress[unit.id], Math.random, Date.now()));
    },
    'open-chest': function (target) {
      if (state.screen !== 'home' || state.save.currentUnitId === null) return;
      var next = copyOfSave();
      var gems = AQ.rewards.openChest(next, next.currentUnitId, Number(target.getAttribute('data-level')));
      if (gems === 0 || !commit(next)) return;
      state.reward = { title: 'Chest opened!', gems: gems };
      show('reward');
      playSound('perfect');
    },
    'claim-quest': function (target) {
      claimOnQuests(function (next) { return AQ.rewards.claimQuest(next, today(), target.getAttribute('data-quest')); });
    },
    'claim-week': function () {
      claimOnQuests(function (next) { return AQ.rewards.claimWeekReward(next, today()); });
    },
    'claim-challenge': function () {
      claimOnQuests(function (next) { return AQ.rewards.claimChallenge(next, today()); });
    },
    'buy-freeze': function () {
      shopAction(function (next) { return AQ.rewards.buyFreeze(next) ? 'Streak freeze added!' : null; });
    },
    'buy-hat': function (target) {
      var hat = AQ.rewards.hatById(target.getAttribute('data-hat'));
      shopAction(function (next) { return hat && AQ.rewards.buyHat(next, hat.id) ? hat.name + ' bought and on!' : null; });
    },
    'wear-hat': function (target) {
      shopAction(function (next) { return AQ.rewards.wearHat(next, target.getAttribute('data-hat')) ? '' : null; });
    },
    'open-profile': function () {
      if (onTabScreen()) show('profile');
    },
    'open-more': function () {
      if (onTabScreen()) show('more');
    },
    'jump': function () {
      if (state.screen === 'home') scrollToCurrent(true);
    },
    // Notes on a level banner: every teaching card of that level.
    'open-guide': function (target) {
      var level = Number(target.getAttribute('data-level'));
      if (state.screen !== 'home' || guideCards(level).length === 0) return;
      state.guide = { level: level, index: 0 };
      show('guide');
    },
    'guide-next': function () {
      if (state.screen !== 'guide') return;
      if (state.guide.index < guideCards(state.guide.level).length - 1) {
        state.guide.index++;
        show('guide');
      } else {
        showHome();
      }
    },
    'guide-back': function () {
      if (state.screen !== 'guide' || state.guide.index === 0) return;
      state.guide.index--;
      show('guide');
    },
    // A tap on the mascot on home: a new hype line and a bounce.
    'mascot-tap': function () {
      if (state.screen !== 'home') return;
      state.mascotTap = AQ.mascot.pick(AQ.mascot.LINES.tap, Math.random());
      render('[data-action="mascot-tap"]');
    },
    'open-mascot': function () {
      if (!onTabScreen()) return;
      state.mascotError = null;
      state.mascotDraft = null;
      show('mascot');
    },
    // A pet or one of its colors. data-color is a look, such as "pink" or "duck-pekin".
    'mascot-color': function (target) {
      var look = target.getAttribute('data-color');
      if (state.screen !== 'mascot' || !AQ.mascot.lookInfo(look)) return;
      var next = copyOfSave();
      var oldName = next.settings.mascot.name;
      next.settings.mascot = AQ.mascot.choose(next.settings.mascot, look);
      if (!commit(next)) return;
      // An untouched name box shows the new pet's starting name; a name being typed stays.
      if (state.mascotDraft === oldName) state.mascotDraft = null;
      render();
    },
    'mascot-name': saveMascotName,
    'cycle-goal': function () {
      if (!onTabScreen()) return;
      var next = copyOfSave();
      next.settings.goal = game.nextGoal(next.settings.goal);
      if (commit(next)) render('[data-action="cycle-goal"]');
    },
    'toggle-theme': function () {
      if (!onTabScreen()) return;
      var next = copyOfSave();
      next.settings.theme = next.settings.theme === 'dark' ? 'light' : 'dark';
      if (commit(next)) render('[data-action="toggle-theme"]');
    },
    'choose': function (target) {
      state.selected = Number(target.getAttribute('data-index'));
      render();
      playSound('select');
    },
    'hint': function () {
      if (inQuickMode()) return;
      state.hintVisible = true;
      render();
    },
    'check': checkAnswer,
    // The second click of a double-click (detail 2 or more) is ignored, so it cannot skip
    // a second question. A key press on the button gives detail 0 and still skips.
    'skip': function (target, event) {
      if (event && event.detail > 1) return;
      skipQuestion();
    },
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
    'calc-key': function (target) {
      typeCalculatorKey(target.getAttribute('data-insert'));
    },
    'calc-back': deleteCalculatorText,
    // C empties the box and clears the error. The last result and the history stay.
    'calc-clear': function () {
      if (!calculatorShowing()) return;
      state.calc.text = '';
      state.calc.error = null;
      state.calc.ranText = null;
      render(CALC_BOX);
    },
    'calc-mode': switchAngleMode,
    'calc-keys': function () {
      if (!calculatorShowing()) return;
      state.calc.keys = !state.calc.keys;
      render(CALC_BOX);
    },
    // A history entry puts its text back in the box. It does not run it.
    'calc-history': function (target) {
      if (!calculatorShowing()) return;
      var entry = state.calc.history[Number(target.getAttribute('data-index'))];
      if (!entry) return;
      state.calc.text = entry.text;
      state.calc.ranText = null;
      render(CALC_BOX);
    },
    'open-calculator': function () {
      if (onTabScreen()) show('calculator');
    },
    'calc-zoom-in': function () {
      setCalculatorWindow(calc.zoom(state.calc.window, 0.5));
    },
    'calc-zoom-out': function () {
      setCalculatorWindow(calc.zoom(state.calc.window, 2));
    },
    'calc-reset': function () {
      setCalculatorWindow(calc.DEFAULT_WINDOW);
    },
    // Quitting a test saves no score, but XP from its right answers stays.
    'quit': function () {
      var question = inTest() ? 'Quit the test? You will have to start it again.' :
        (inSpeed() ? 'Quit the Speed Round? XP you earned stays.' : 'Quit this lesson? XP you earned stays.');
      if (!root.confirm(question)) return;
      stopSpeedTimer();
      showHome();
    },
    // Retry on the out-of-hearts screen, and Retake on the test result screen.
    'retry': function () {
      var unit = currentUnit();
      var previous = state.session;
      var next;
      var progress = state.save.progress[unit.id];
      if (previous.kind === 'lesson') next = game.startLesson(unit, previous.lessonId);
      else if (previous.kind === 'test') next = newTestSession(unit);
      else if (previous.kind === 'rewind') next = game.startRewind(unit, progress);
      else if (previous.kind === 'speed') next = game.startSpeed(unit, progress, Math.random, Date.now());
      else next = game.startReview(unit, progress);
      if (next) beginSession(next);
      else showHome();
    },
    // Redraws home in place, keeping the window's scroll position and the keyboard on the button.
    'toggle-sound': function () {
      if (!onTabScreen()) return;
      var next = copyOfSave();
      next.settings.sound = !next.settings.sound;
      if (commit(next)) render('[data-action="toggle-sound"]');
    },
    'download-raw': function () {
      download(RAW_SAVE_FILENAME, state.rawSave);
    },
    'start-fresh': function () {
      if (!root.confirm('Start over with no progress?')) return;
      var fresh = storage.newSave();
      storage.syncUnits(fresh, builtInUnits);
      if (commit(fresh)) {
        state.rawSave = null;
        showHome();
      }
    }
  };

  // A claim on the Quests screen. claim(save) changes the save copy and returns the gems given.
  function claimOnQuests(claim) {
    if (state.screen !== 'quests') return;
    var next = copyOfSave();
    var gems = claim(next);
    if (gems === 0) {
      render();
      return;
    }
    if (!commit(next)) return;
    state.note = '+' + gems + ' gems!';
    render();
    playSound('correct');
  }

  // A buy or a hat change in the Shop. act(save) changes the save copy and returns a note, or null
  // when nothing changed.
  function shopAction(act) {
    if (state.screen !== 'shop') return;
    var next = copyOfSave();
    var note = act(next);
    if (note === null || !commit(next)) return;
    state.note = note || null;
    render();
    if (note) playSound('correct');
  }

  // Saves the name in the Mascot screen's box. An empty name is not saved.
  function saveMascotName() {
    if (state.screen !== 'mascot') return;
    var name = AQ.mascot.cleanName(state.mascotDraft !== null ? state.mascotDraft : mascotSettings().name);
    if (name === null) {
      state.mascotError = 'Type a name for your pet (up to ' + AQ.mascot.NAME_MAX + ' letters).';
      render('[data-role="mascot-name"]');
      return;
    }
    var next = copyOfSave();
    next.settings.mascot.name = name;
    if (!commit(next)) return;
    state.mascotError = null;
    state.mascotDraft = null;
    render();
  }

  function onClick(event) {
    var target = event.target.closest('[data-action]');
    if (!target || target.disabled || target.tagName === 'SELECT') return;
    var handler = actions[target.getAttribute('data-action')];
    if (!handler) return;
    readBoxes();
    handler(target, event);
  }

  function onChange(event) {
    var target = event.target;
    if (target.getAttribute('data-action') !== 'select-unit') return;
    var next = copyOfSave();
    next.currentUnitId = target.value;
    if (commit(next)) showHome();
  }

  // Enter checks a typed answer (in a test it submits it), Enter in the calculator box runs the
  // calculator (and never checks the answer), and Enter on the feedback panel continues.
  // Enter in the calculator box works on the lesson screen and on the calculator screen.
  // preventDefault stops the same key press from also clicking the button that gets focus next,
  // and a held-down key (event.repeat) is ignored so it cannot skip through questions.
  function onKeyDown(event) {
    if (event.key !== 'Enter') return;
    readBoxes();
    var role = event.target.getAttribute ? event.target.getAttribute('data-role') : null;
    if ((state.screen === 'lesson' || state.screen === 'calculator') && role === 'calc-input') {
      event.preventDefault();
      if (!event.repeat) runCalculator();
    } else if (state.screen === 'lesson' && role === 'answer') {
      event.preventDefault();
      if (!event.repeat) checkAnswer();
    } else if (state.screen === 'feedback') {
      event.preventDefault();
      if (!event.repeat) continueLesson();
    } else if (state.screen === 'mascot' && role === 'mascot-name') {
      event.preventDefault();
      if (!event.repeat) saveMascotName();
    }
  }

  // Loads the players' rows and draws the leaderboard when they arrive.
  function loadBoard() {
    var request = ++boardRequest;
    state.board.status = 'loading';
    render();
    online.leaderboard().then(function (rows) {
      if (request !== boardRequest) return;
      state.board.rows = rows;
      state.board.status = 'ready';
      if (state.screen === 'leaderboard') render();
    }, function () {
      if (request !== boardRequest) return;
      state.board.status = 'error';
      if (state.screen === 'leaderboard') render();
    });
  }

  // ----- Startup -----

  // options.online, when given, turns on the online app's Leaders tab and Account section.
  function mount(rootElement, storageObject, options) {
    rootEl = rootElement;
    ls = storageObject;
    online = options && options.online ? options.online : null;
    builtInUnits = options && options.units ? options.units : [];
    views.useLeadersTab(online !== null);
    rootEl.addEventListener('click', onClick);
    rootEl.addEventListener('change', onChange);
    document.addEventListener('keydown', onKeyDown);

    // The save is in memory before the first write, so a failed write still leaves a usable app.
    if (!loadFromStorage()) return;
    // The built-in units are added or updated before the first write.
    storage.syncUnits(state.save, builtInUnits);
    if (commit(state.save)) {
      showHome();
      if (state.freezeNotice) {
        showMessage('\u2744 Streak freeze used!', [
          'You missed ' + (state.freezeNotice.used === 1 ? 'a day' : state.freezeNotice.used + ' days') + ', so ' +
            (state.freezeNotice.used === 1 ? 'a streak freeze was' : 'streak freezes were') + ' used.',
          'Your ' + state.freezeNotice.streak + '-day streak is safe. Do a lesson today to keep it going!'
        ]);
        state.freezeNotice = null;
      }
    }
  }

  var api = { mount: mount };
  AQ.ui = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
