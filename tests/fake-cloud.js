// A stand-in for js/cloud.js, for checking the online app in a browser without Firebase or a
// real account. tests/web-fake.html loads it. Everything is kept in this browser's localStorage
// under "fakeCloud.v1", so it lasts across reloads. Every call waits a moment, like a network.
// To make every save and leaderboard call fail, run localStorage.setItem('fakeCloud.down', '1')
// in the console (it lasts across reloads), or set window.FAKE_CLOUD_DOWN = true.
// It refuses to run anywhere but this PC (localhost), so nobody types a real password into it
// on the published site, and its device copies use their own prefix, apart from the real app's.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  var STORE = 'fakeCloud.v1';
  var DELAY_MS = 300;

  if (['localhost', '127.0.0.1'].indexOf(root.location.hostname) === -1) {
    AQ.cloud = { ready: false };
    return;
  }

  function load() {
    try {
      var data = JSON.parse(root.localStorage.getItem(STORE));
      if (data) return data;
    } catch (e) { /* start over */ }
    var week = AQ.rewards.weekStart(AQ.game.localDateString(new Date()));
    return {
      users: {},
      saves: {},
      // Two friends already on the leaderboard.
      players: {
        bee: { name: 'Bee', nameLower: 'bee', weekXp: 140, week: week, totalXp: 900, color: 'blue', hat: 'crown' },
        cat_22: { name: 'Cat_22', nameLower: 'cat_22', weekXp: 60, week: week, totalXp: 2400, color: 'purple', hat: null }
      },
      session: null
    };
  }

  function keep(data) {
    root.localStorage.setItem(STORE, JSON.stringify(data));
  }

  function later(work) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        try { resolve(work(load())); } catch (error) { reject(error); }
      }, DELAY_MS);
    });
  }

  function fail(code) {
    var error = new Error(code);
    error.code = code;
    throw error;
  }

  function down() {
    if (root.FAKE_CLOUD_DOWN || root.localStorage.getItem('fakeCloud.down') === '1') fail('unavailable');
  }

  var listeners = [];
  function tell(account) {
    listeners.forEach(function (callback) { callback(account); });
  }

  function accountOf(data, key) {
    var user = data.users[key];
    return user ? { uid: user.uid, key: key, name: user.name } : null;
  }

  AQ.cloud = {
    ready: true,
    devicePrefix: 'fakeCloud.copy.',
    onAccount: function (callback) {
      listeners.push(callback);
      later(function (data) { callback(data.session ? accountOf(data, data.session) : null); });
    },
    signUp: function (name, password) {
      return later(function (data) {
        var key = name.trim().toLowerCase();
        if (data.users[key]) fail('auth/email-already-in-use');
        data.users[key] = { uid: 'fake-' + Math.random().toString(36).slice(2, 10), name: name.trim(), password: password };
        data.session = key;
        keep(data);
        var account = accountOf(data, key);
        tell(account);
        return account;
      });
    },
    logIn: function (name, password) {
      return later(function (data) {
        var user = data.users[name.trim().toLowerCase()];
        if (!user || user.password !== password) fail('auth/invalid-credential');
        var key = name.trim().toLowerCase();
        data.session = key;
        keep(data);
        var account = accountOf(data, key);
        tell(account);
        return account;
      });
    },
    logOut: function () {
      return later(function (data) {
        data.session = null;
        keep(data);
        tell(null);
      });
    },
    loadSave: function (key) {
      return later(function (data) {
        down();
        return data.saves[key] || null;
      });
    },
    writeSave: function (key, doc) {
      return later(function (data) {
        down();
        // Like the database rules: a save must grow from the one in the cloud.
        var current = data.saves[key];
        if (current && doc.base !== current.rev) fail('permission-denied');
        data.saves[key] = { save: doc.save, rev: doc.rev, base: doc.base };
        keep(data);
      });
    },
    writePlayer: function (key, row) {
      return later(function (data) {
        down();
        data.players[key] = row;
        keep(data);
      });
    },
    listPlayers: function () {
      return later(function (data) {
        down();
        return Object.keys(data.players).map(function (uid) { return Object.assign({}, data.players[uid], { uid: uid }); });
      });
    },
    deleteAccount: function (key) {
      return later(function (data) {
        delete data.players[key];
        delete data.saves[key];
        delete data.users[key];
        data.session = null;
        keep(data);
      });
    }
  };
})(window);
