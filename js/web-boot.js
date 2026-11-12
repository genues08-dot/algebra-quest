// Startup for the online app (index.html). It replaces main.js:
// - The login screen comes first. After login the app (ui.js) runs unchanged on a storage
//   object made here.
// - The save is kept in the cloud (AQ.cloud), with a copy on this device for offline play.
//   Each account has its own device copy, so friends can share a phone.
// - The player's leaderboard row is updated from the save as it changes.
(function (root) {
  'use strict';
  var AQ = root.AQ;
  var online = AQ.online;
  var cloud = AQ.cloud;
  var KEY = AQ.storage.KEY;
  var BUNDLED = root.AQ_PHONE_UNITS || [];
  var LOCAL_PREFIX = 'algebraQuest.web.';
  var WAIT_MS = 10000;        // longest wait for the cloud save at start
  var FIRST_ROW_MS = 3000;    // the first leaderboard write waits this long after the first save
  var ROW_EVERY_MS = 15000;   // later leaderboard writes are at least this far apart
  var CHECK_AGAIN_MS = 15000; // wait before checking the cloud again after it could not be reached
  var IDLE_WAIT_MS = 4000;    // longest wait for the last save to reach the cloud before logging out

  var app = document.getElementById('app');
  var toastEl = document.getElementById('app-toast');
  var toastTimer = null;
  var escapeHtml = AQ.views.escapeHtml;

  function toast(text, ms) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, ms || 6000);
  }

  function reload() {
    root.location.reload();
  }

  function today() {
    return AQ.game.localDateString(new Date());
  }

  // ----- This device's copy of each account's save: { save, savedAt } -----

  function readLocal(uid) {
    try {
      var doc = JSON.parse(root.localStorage.getItem(LOCAL_PREFIX + uid));
      return doc && typeof doc.save === 'string' ? doc : null;
    } catch (e) {
      return null;
    }
  }

  function writeLocal(uid, doc) {
    try { root.localStorage.setItem(LOCAL_PREFIX + uid, JSON.stringify(doc)); } catch (e) { /* the cloud still has it */ }
  }

  function removeLocal(uid) {
    try { root.localStorage.removeItem(LOCAL_PREFIX + uid); } catch (e) { /* nothing to remove */ }
  }

  // ----- Screens before the app: a problem, and the login form -----

  function showProblem(title, text) {
    app.innerHTML = '<section class="login">' +
      '<img class="login-axl" src="img/axl/pink-think.png" alt="">' +
      '<h1 class="login-title">' + escapeHtml(title) + '</h1>' +
      '<p class="login-sub">' + escapeHtml(text) + '</p>' +
      '<button type="button" class="btn btn-primary btn-big" data-login="retry">Try again</button>' +
    '</section>';
  }

  var loginMode = 'login'; // or 'create'
  var loginName = '';
  var busy = false;        // a login or sign-up is waiting for Firebase

  function showLogin(error) {
    var create = loginMode === 'create';
    app.innerHTML = '<section class="login">' +
      '<img class="login-axl" src="img/axl/pink-' + (create ? 'cheer' : 'happy') + '.png" alt="">' +
      '<h1 class="login-title">Algebra Quest</h1>' +
      '<p class="login-sub">' + (create ? 'Make an account to save your progress and join the leaderboard.' : 'Log in to keep your streak going.') + '</p>' +
      '<form class="login-form" data-login="form" novalidate>' +
        '<label class="login-label">Username' +
          '<input class="login-input" name="username" value="' + escapeHtml(loginName) + '" maxlength="' + online.USERNAME_MAX + '"' +
          ' autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"></label>' +
        '<label class="login-label">Password' +
          '<input class="login-input" type="password" name="password" maxlength="' + online.PASSWORD_MAX + '"' +
          ' autocomplete="' + (create ? 'new-password' : 'current-password') + '"></label>' +
        (create ? '<label class="login-label">Password again' +
          '<input class="login-input" type="password" name="password2" maxlength="' + online.PASSWORD_MAX + '" autocomplete="new-password"></label>' : '') +
        (error ? '<p class="login-error" role="alert">' + escapeHtml(error) + '</p>' : '') +
        '<button type="submit" class="btn btn-primary btn-big login-go"' + (busy ? ' disabled' : '') + '>' +
          (busy ? 'One moment&hellip;' : (create ? 'Create account' : 'Log in')) + '</button>' +
      '</form>' +
      '<button type="button" class="btn btn-quiet" data-login="switch"' + (busy ? ' disabled' : '') + '>' +
        (create ? 'Have an account? Log in' : 'New here? Create an account') + '</button>' +
      (create ? '<p class="login-note">No email needed. Remember your password: it can&#39;t be reset by email.</p>' : '') +
    '</section>';
    var form = app.querySelector('form');
    var empty = [form.elements.username, form.elements.password].filter(function (box) { return box.value === ''; })[0];
    if (empty && !busy) empty.focus();
  }

  function onLoginSubmit(event) {
    if (mounted || event.target.getAttribute('data-login') !== 'form') return;
    event.preventDefault();
    if (busy) return;
    var form = event.target;
    var name = form.elements.username.value.trim();
    var password = form.elements.password.value;
    var create = loginMode === 'create';
    loginName = name;
    var problem = online.checkUsername(name) ||
      (create ? online.checkPassword(password, form.elements.password2.value) : (password === '' ? 'Type a password.' : null));
    if (problem) {
      showLogin(problem);
      return;
    }
    busy = true;
    showLogin();
    (create ? cloud.signUp(name, password) : cloud.logIn(name, password)).then(function (found) {
      busy = false;
      openApp(found);
    }, function (error) {
      busy = false;
      showLogin(online.authMessage(error && error.code));
    });
  }

  function onLoginClick(event) {
    if (mounted || busy) return;
    var button = event.target.closest('[data-login]');
    var role = button ? button.getAttribute('data-login') : null;
    if (role === 'retry') reload();
    if (role === 'switch') {
      loginMode = loginMode === 'login' ? 'create' : 'login';
      showLogin();
    }
  }

  // ----- The cloud save -----

  var account = null;   // { uid, name } once logged in
  var opened = false;   // openApp has run
  var mounted = false;  // the app is drawing the page
  var closing = false;  // logging out or deleting: nothing more is sent
  var memory = {};
  var writing = false;  // a save is on its way to the cloud
  var queued = null;    // the newest save not yet sent: { save, savedAt }
  var lastSent = null;  // the save text the cloud has
  var warned = false;
  // When the app started from this device's copy without reaching the cloud, the cloud may hold
  // newer progress from another device. Nothing is sent until that is checked.
  var verified = false;
  var startedAt = null; // savedAt of the copy the app started from, for that check

  function pump() {
    if (closing || writing || queued === null) return;
    if (!verified) {
      checkCloud();
      return;
    }
    var doc = queued;
    queued = null;
    if (doc.save === lastSent) return;
    writing = true;
    var again = false;
    cloud.writeSave(account.uid, doc).then(function () {
      lastSent = doc.save;
    }, function (error) {
      var code = (error && error.code) || 'error';
      // A brief outage: send it again soon, unless a newer save is waiting.
      if ((code === 'unavailable' || code === 'deadline-exceeded') && queued === null) {
        queued = doc;
        again = true;
      }
      if (!warned) {
        warned = true;
        toast('Your progress could not be saved online (' + code + '). It is saved on this device and will be sent again.', 8000);
      }
    }).then(function () {
      writing = false;
      if (again) setTimeout(pump, 5000);
      else pump();
    });
  }

  var checking = false;
  function checkCloud() {
    if (checking) return;
    checking = true;
    cloud.loadSave(account.uid).then(function (doc) {
      checking = false;
      // The cloud changed after the copy this visit started from: another device played since.
      // Its progress is kept, and this visit's offline play is dropped.
      if (online.newerSave({ save: 'x', savedAt: startedAt }, doc) === 'cloud' && doc.savedAt !== startedAt) {
        closing = true;
        writeLocal(account.uid, doc);
        root.alert('Newer progress from another device was found online. The app will reload with it.');
        reload();
        return;
      }
      verified = true;
      lastSent = doc ? doc.save : null;
      pump();
    }, function () {
      checking = false;
      setTimeout(pump, CHECK_AGAIN_MS);
    });
  }

  // Resolves once nothing is waiting to be sent, or after IDLE_WAIT_MS.
  function whenIdle() {
    var waited = 0;
    return new Promise(function (resolve) {
      (function check() {
        if ((!writing && queued === null) || waited >= IDLE_WAIT_MS) return resolve();
        waited += 100;
        setTimeout(check, 100);
      })();
    });
  }

  // The storage object the app uses in place of localStorage.
  var store = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
    setItem: function (key, value) {
      memory[key] = String(value);
      if (key !== KEY || closing) return;
      var doc = { save: online.packSave(memory[key], BUNDLED), savedAt: new Date().toISOString() };
      writeLocal(account.uid, doc);
      queued = doc;
      pump();
      scheduleRow();
    },
    removeItem: function (key) { delete memory[key]; }
  };

  // ----- The leaderboard row -----

  var rowTimer = null;
  var lastRow = null;
  var lastRowAt = 0;

  function scheduleRow() {
    if (rowTimer !== null || closing) return;
    var wait = lastRowAt === 0 ? FIRST_ROW_MS : Math.max(0, ROW_EVERY_MS - (Date.now() - lastRowAt));
    rowTimer = setTimeout(writeRow, wait);
  }

  function writeRow() {
    if (rowTimer !== null) clearTimeout(rowTimer);
    rowTimer = null;
    if (closing) return;
    var save = null;
    try { save = JSON.parse(memory[KEY]); } catch (e) { return; }
    if (!save) return;
    var row = online.playerRow(save, account.name, today());
    if (online.sameRow(row, lastRow)) return;
    lastRow = row;
    lastRowAt = Date.now();
    cloud.writePlayer(account.uid, row).then(null, function () { lastRow = null; });
  }

  // Send a waiting row now, when the player leaves the app.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && rowTimer !== null) writeRow();
  });

  // ----- Account actions the app calls -----

  function logOut() {
    if (rowTimer !== null) writeRow();
    return whenIdle().then(function () {
      closing = true;
      return cloud.logOut();
    }).then(reload, reload);
  }

  function deleteAccount() {
    closing = true;
    if (rowTimer !== null) clearTimeout(rowTimer);
    rowTimer = null;
    return whenIdle().then(function () {
      return cloud.deleteAccount(account.uid);
    }).then(function () {
      removeLocal(account.uid);
      reload();
    }, function (message) {
      closing = false;
      throw message;
    });
  }

  // ----- Starting the app -----

  function openApp(found) {
    if (opened || !found) return;
    opened = true;
    account = found;
    app.innerHTML = '<p class="boot-note">Loading your progress&hellip;</p>';
    var local = readLocal(account.uid);
    var done = false;

    function finish(cloudDoc, reached) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (reached) {
        verified = true;
        lastSent = cloudDoc ? cloudDoc.save : null;
        var pick = online.newerSave(local, cloudDoc);
        start(pick === 'local' ? local : (pick === 'cloud' ? cloudDoc : null), null);
      } else if (local) {
        startedAt = local.savedAt;
        start(local, 'Your online progress could not be reached, so this visit saves on this device. It syncs when you are back online.');
      } else {
        // Starting fresh here could replace real progress in the cloud, so wait for it instead.
        opened = false;
        showProblem("Can't reach your progress", 'Check your internet connection and try again.');
      }
    }

    var timer = setTimeout(function () { finish(null, false); }, WAIT_MS);
    cloud.loadSave(account.uid).then(function (doc) {
      finish(doc && typeof doc.save === 'string' ? doc : null, true);
    }, function () {
      finish(null, false);
    });
  }

  function start(doc, note) {
    if (doc) memory[KEY] = online.unpackSave(doc.save, BUNDLED);
    app.innerHTML = '';
    mounted = true;
    AQ.ui.mount(app, store, {
      online: {
        uid: account.uid,
        name: account.name,
        leaderboard: function () { return cloud.listPlayers(); },
        logOut: logOut,
        deleteAccount: deleteAccount
      }
    });
    // The bundled units are added to a new save, so nothing has to be imported.
    var saved = null;
    try { saved = JSON.parse(store.getItem(KEY)); } catch (e) { saved = null; }
    if (saved && saved.units) {
      BUNDLED.forEach(function (unit) {
        if (!saved.units[unit.id]) AQ.ui.importText(JSON.stringify(unit));
      });
    }
    if (note) toast(note, 8000);
  }

  app.addEventListener('submit', onLoginSubmit);
  app.addEventListener('click', onLoginClick);

  if ('serviceWorker' in navigator && (root.location.protocol === 'https:' || root.location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* the app works without it, online only */ });
  }

  if (!cloud || !cloud.ready) {
    showProblem('Algebra Quest needs the internet', 'The first time it opens, it needs a connection. Check yours and try again.');
    return;
  }
  cloud.onAccount(function (found) {
    if (opened || busy) return;
    if (found) openApp(found);
    else showLogin();
  });
})(window);
