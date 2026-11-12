// A stand-in for js/cloud.js, for checking the online app in a browser without Firebase or a
// real account. tests/web-fake.html loads it. Everything is kept in this browser's localStorage
// under "fakeCloud.v1", so it lasts across reloads. Every call waits a moment, like a network.
// To make every save and leaderboard call fail, run localStorage.setItem('fakeCloud.down', '1')
// in the console (it lasts across reloads), or set window.FAKE_CLOUD_DOWN = true.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  var STORE = 'fakeCloud.v1';
  var DELAY_MS = 300;

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
        f1: { name: 'Bee', nameLower: 'bee', weekXp: 140, week: week, totalXp: 900, color: 'blue', hat: 'crown' },
        f2: { name: 'Cat_22', nameLower: 'cat_22', weekXp: 60, week: week, totalXp: 2400, color: 'purple', hat: null }
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

  function accountOf(data, uid) {
    var user = Object.keys(data.users).map(function (key) { return data.users[key]; }).filter(function (u) { return u.uid === uid; })[0];
    return user ? { uid: user.uid, name: user.name } : null;
  }

  AQ.cloud = {
    ready: true,
    onAccount: function (callback) {
      listeners.push(callback);
      later(function (data) { callback(data.session ? accountOf(data, data.session) : null); });
    },
    signUp: function (name, password) {
      return later(function (data) {
        var key = name.trim().toLowerCase();
        if (data.users[key]) fail('auth/email-already-in-use');
        var uid = 'fake-' + key;
        data.users[key] = { uid: uid, name: name.trim(), password: password };
        data.session = uid;
        keep(data);
        var account = accountOf(data, uid);
        tell(account);
        return account;
      });
    },
    logIn: function (name, password) {
      return later(function (data) {
        var user = data.users[name.trim().toLowerCase()];
        if (!user || user.password !== password) fail('auth/invalid-credential');
        data.session = user.uid;
        keep(data);
        var account = accountOf(data, user.uid);
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
    loadSave: function (uid) {
      return later(function (data) {
        down();
        return data.saves[uid] || null;
      });
    },
    writeSave: function (uid, doc) {
      return later(function (data) {
        down();
        data.saves[uid] = { save: doc.save, savedAt: doc.savedAt };
        keep(data);
      });
    },
    writePlayer: function (uid, row) {
      return later(function (data) {
        down();
        data.players[uid] = row;
        keep(data);
      });
    },
    listPlayers: function () {
      return later(function (data) {
        down();
        return Object.keys(data.players).map(function (uid) { return Object.assign({}, data.players[uid], { uid: uid }); });
      });
    },
    deleteAccount: function (uid) {
      return later(function (data) {
        delete data.players[uid];
        delete data.saves[uid];
        Object.keys(data.users).forEach(function (key) { if (data.users[key].uid === uid) delete data.users[key]; });
        data.session = null;
        keep(data);
      });
    }
  };
})(window);
