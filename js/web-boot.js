// Startup for the online app (index.html). It replaces main.js:
// - The login screen comes first. After login the app (ui.js) runs unchanged on the storage
//   object from js/cloud-sync.js, which keeps the save in the cloud with a copy on this device
//   and keeps the player's leaderboard row up to date.
// - Everything is kept under the account's key, its username in lowercase (see cloud.js).
(function (root) {
  'use strict';
  var AQ = root.AQ;
  var online = AQ.online;
  var cloud = AQ.cloud;
  var KEY = AQ.storage.KEY;
  var BUNDLED = root.AQ_PHONE_UNITS || [];
  var WAIT_MS = 10000;       // longest wait for the cloud save at start
  var IDLE_WAIT_MS = 4000;   // longest wait for the last save to reach the cloud before logging out
  var DELETE_WAIT_MS = 20000;

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

  // localStorage, or a stand-in kept in memory when the browser blocks it.
  function deviceStorage() {
    try {
      root.localStorage.getItem('x');
      return root.localStorage;
    } catch (e) {
      var data = {};
      return {
        getItem: function (key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
        setItem: function (key, value) { data[key] = String(value); },
        removeItem: function (key) { delete data[key]; }
      };
    }
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

  // ----- The app -----

  var account = null;  // { uid, key, name } once logged in
  var sync = null;     // from AQ.cloudSync.create
  var opened = false;  // openApp has run
  var mounted = false; // the app is drawing the page
  var deleting = null; // the account delete under way

  function logOut() {
    sync.flushRow();
    return sync.whenIdle(IDLE_WAIT_MS).then(function () {
      sync.close();
      return cloud.logOut();
    }).then(reload, reload);
  }

  // Rejects after ms with a message, unless work settles first.
  function withTimeout(work, ms, message) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(message); }, ms);
      work.then(function (value) { clearTimeout(timer); resolve(value); }, function (error) { clearTimeout(timer); reject(error); });
    });
  }

  function deleteAccount() {
    if (deleting) return deleting;
    toast('Deleting your account…', DELETE_WAIT_MS);
    deleting = sync.whenIdle(IDLE_WAIT_MS).then(function () {
      sync.close();
      return withTimeout(cloud.deleteAccount(account.key), DELETE_WAIT_MS, 'No internet connection. Try again when you are online.');
    }).then(function () {
      sync.forgetDevice();
      reload();
    }, function (message) {
      deleting = null;
      toastEl.hidden = true;
      sync.reopen();
      throw message;
    });
    return deleting;
  }

  function openApp(found) {
    if (opened || !found) return;
    opened = true;
    account = found;
    app.innerHTML = '<p class="boot-note">Loading your progress&hellip;</p>';
    sync = AQ.cloudSync.create({
      cloud: cloud,
      account: account,
      bundled: BUNDLED,
      device: deviceStorage(),
      prefix: cloud.devicePrefix || 'algebraQuest.web.',
      today: today,
      onConflict: function () {
        root.alert('Newer progress from another device was found online. The app will reload with it.');
        reload();
      },
      onWarn: function (message) { toast(message, 8000); },
      firstRowMs: 3000,
      rowEveryMs: 15000,
      retryMs: 10000
    });

    var done = false;
    function finish(cloudDoc, reached) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      var how = sync.start(cloudDoc, reached);
      if (how === 'wait') {
        opened = false;
        showProblem("Can't reach your progress", 'Check your internet connection and try again.');
        return;
      }
      start(reached ? null : 'Your online progress could not be reached, so this visit saves on this device. It syncs when you are back online.');
    }
    var timer = setTimeout(function () { finish(null, false); }, WAIT_MS);
    cloud.loadSave(account.key).then(function (doc) {
      finish(doc && typeof doc.save === 'string' ? doc : null, true);
    }, function () {
      finish(null, false);
    });
  }

  function start(note) {
    app.innerHTML = '';
    mounted = true;
    AQ.ui.mount(app, sync.store, {
      online: {
        uid: account.key,
        name: account.name,
        leaderboard: function () { return cloud.listPlayers(); },
        logOut: logOut,
        deleteAccount: deleteAccount
      }
    });
    // The bundled units are added to a new save, so nothing has to be imported.
    var saved = null;
    try { saved = JSON.parse(sync.store.getItem(KEY)); } catch (e) { saved = null; }
    if (saved && saved.units) {
      BUNDLED.forEach(function (unit) {
        if (!saved.units[unit.id]) AQ.ui.importText(JSON.stringify(unit));
      });
    }
    if (note) toast(note, 8000);
  }

  // Send a waiting leaderboard row when the player leaves the app.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && sync) sync.flushRow();
  });

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
