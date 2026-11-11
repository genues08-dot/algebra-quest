// UI: owns the page. Holds the screen state, draws it with AQ.views, and handles clicks and keys.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};

  var views = AQ.views;
  var storage = AQ.storage;
  var game = AQ.game;

  var RAW_SAVE_FILENAME = 'algebra-quest-raw-save.txt';
  var OK_ACTION = [{ action: 'home', label: 'OK' }];

  // screen is 'home', 'message', or 'broken'. `save` is null only on the broken screen.
  var state = { screen: 'home', save: null, message: null, rawSave: null };
  var rootEl = null;
  var ls = null;
  var fileInput = null;

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

  function render() {
    var html;
    if (state.screen === 'message') html = views.messageHtml(state.message);
    else if (state.screen === 'broken') html = views.messageHtml(BROKEN_MESSAGE);
    else html = views.homeHtml(views.homeModel(state.save));
    rootEl.innerHTML = html;
  }

  function showHome() {
    state.screen = 'home';
    render();
  }

  function showMessage(title, lines) {
    state.screen = 'message';
    state.message = { title: title, lines: lines, actions: OK_ACTION };
    render();
  }

  // ----- Saving -----

  // Writes `save` to storage. On success it becomes the current save.
  // On failure the previous save stays current and a message is shown.
  function commit(save) {
    if (storage.persist(ls, save).ok) {
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

  // ----- Actions: one entry per data-action name -----

  var actions = {
    'home': function () {
      showHome();
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
      state.rawSave = null;
      if (commit(storage.newSave())) showHome();
    }
  };

  function onClick(event) {
    var target = event.target.closest('[data-action]');
    if (!target || target.disabled || target.tagName === 'SELECT') return;
    var handler = actions[target.getAttribute('data-action')];
    if (handler) handler(target);
  }

  function onChange(event) {
    var target = event.target;
    if (target.getAttribute('data-action') !== 'select-unit') return;
    var next = copyOfSave();
    next.currentUnitId = target.value;
    if (commit(next)) showHome();
  }

  // ----- Startup -----

  function mount(rootElement, storageObject) {
    rootEl = rootElement;
    ls = storageObject;
    fileInput = document.getElementById('import-file');
    rootEl.addEventListener('click', onClick);
    rootEl.addEventListener('change', onChange);
    fileInput.addEventListener('change', onFilePicked);

    var loaded = storage.load(ls);
    if (!loaded.ok) {
      state.rawSave = loaded.raw;
      state.screen = 'broken';
      render();
      return;
    }
    game.refreshStreak(loaded.save, today());
    if (commit(loaded.save)) showHome();
  }

  var api = { mount: mount, importText: importText };
  AQ.ui = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
