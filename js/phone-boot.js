// Startup for the phone build (phone.html), which runs as a page on claude.ai.
// That page frame refuses confirm() and downloads, and its localStorage may be missing,
// so this file replaces main.js:
// - The save is kept in the viewer's private claude.ai storage (the `db` capability),
//   with a localStorage copy when the browser allows one.
// - confirm() becomes "tap again to confirm".
// - The units in phone-units.js are added on first start, so nothing has to be imported.
(function (root) {
  'use strict';
  var AQ = root.AQ;
  var KEY = AQ.storage.KEY;
  var BUNDLED = root.AQ_PHONE_UNITS || [];
  var WAIT_MS = 10000;

  var app = document.getElementById('app');
  var toastEl = document.getElementById('phone-toast');
  var toastTimer = null;

  function toast(text, ms) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = ms ? setTimeout(function () { toastEl.hidden = true; }, ms) : null;
  }

  // ----- Confirm: the same question asked twice within 5 seconds counts as yes. -----
  var pendingQuestion = null;
  var pendingTime = 0;
  root.confirm = function (message) {
    var now = Date.now();
    if (pendingQuestion === message && now - pendingTime < 5000) {
      pendingQuestion = null;
      toastEl.hidden = true;
      return true;
    }
    pendingQuestion = message;
    pendingTime = now;
    toast(message + ' Tap again to confirm.', 5000);
    return false;
  };

  // ----- Local copy (may be blocked in the frame) -----
  function localGet() {
    try { return root.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function localSet(value) {
    try { root.localStorage.setItem(KEY, value); } catch (e) { /* no local copy */ }
  }

  // ----- Bundled units are stored as a marker, so the saved document stays small. -----
  function bundledUnit(id) {
    for (var i = 0; i < BUNDLED.length; i++) if (BUNDLED[i].id === id) return BUNDLED[i];
    return null;
  }
  function pack(raw) {
    try {
      var save = JSON.parse(raw);
      if (save && save.units) {
        Object.keys(save.units).forEach(function (id) { if (bundledUnit(id)) save.units[id] = 'bundled'; });
      }
      return JSON.stringify(save);
    } catch (e) {
      return raw;
    }
  }
  function unpack(text) {
    try {
      var save = JSON.parse(text);
      if (save && save.units) {
        Object.keys(save.units).forEach(function (id) {
          if (save.units[id] !== 'bundled') return;
          var unit = bundledUnit(id);
          if (unit) save.units[id] = unit;
          else delete save.units[id];
        });
      }
      return JSON.stringify(save);
    } catch (e) {
      return text;
    }
  }

  // ----- Remote save: one write at a time, always the newest value. -----
  var docRef = null;
  var writing = false;
  var queued = null;
  var lastWritten = null;
  var warned = false;

  function pump() {
    if (!docRef || writing || queued === null) return;
    var value = queued;
    queued = null;
    if (value === lastWritten) return;
    writing = true;
    var retry = false;
    docRef.set({ save: value, savedAt: new Date().toISOString() }).then(function () {
      lastWritten = value;
    }, function (error) {
      // A brief outage: try the same save once more after a pause, unless a newer one is waiting.
      if (error && error.code === 'unavailable' && queued === null) {
        queued = value;
        retry = true;
        return;
      }
      if (!warned) {
        warned = true;
        toast('Your progress could not be saved online (' + ((error && error.code) || 'error') + '). It is saved on this phone only for now.', 8000);
      }
    }).then(function () {
      writing = false;
      if (retry) setTimeout(pump, 1500);
      else pump();
    });
  }

  // ----- The storage object the app uses -----
  var memory = {};
  var store = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
    setItem: function (key, value) {
      memory[key] = String(value);
      if (key !== KEY) return;
      localSet(memory[key]);
      queued = pack(memory[key]);
      pump();
    },
    removeItem: function (key) { delete memory[key]; }
  };

  // ----- Start -----
  var started = false;
  function start(raw, note) {
    if (started) return;
    started = true;
    if (raw) memory[KEY] = raw;
    if (docRef && raw) lastWritten = pack(raw);
    app.innerHTML = '';
    AQ.ui.mount(app, store, { units: BUNDLED });
    if (note) toast(note, 8000);
  }

  function startLocal(note) { start(localGet(), note); }

  function connect() {
    var timer = setTimeout(function () {
      startLocal('Your online progress could not be reached, so this visit saves on this phone only.');
    }, WAIT_MS);
    Promise.all([root.claude.use('db'), root.claude.use('user')]).then(function (found) {
      var db = found[0];
      var user = found[1];
      if (!db || !user) throw new Error('no db');
      return user.id().then(function (id) {
        if (!id) throw new Error('no id');
        var ref = db.collection('data/users/' + id).doc('save');
        return ref.get().then(function (snap) {
          if (started) return;
          clearTimeout(timer);
          docRef = ref;
          var data = snap.exists ? snap.data() : null;
          if (data && typeof data.save === 'string') start(unpack(data.save));
          else start(localGet());
        });
      });
    }).catch(function () {
      clearTimeout(timer);
      startLocal('Sign in to claude.ai to keep your progress between devices. For now it saves on this phone only.');
    });
  }

  // Outside claude.ai (a local preview), there is no `claude` object: run on localStorage.
  var tries = 0;
  (function waitForClaude() {
    if (root.claude && typeof root.claude.use === 'function') return connect();
    if (++tries > 20) return startLocal();
    setTimeout(waitForClaude, 100);
  })();
})(window);
