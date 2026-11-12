// The cloud: accounts, saves, and the leaderboard, on Firebase (the compat SDK loaded by
// index.html). web-boot.js and cloud-sync.js use only AQ.cloud, so tests/fake-cloud.js can stand
// in for it.
//
// AQ.cloud.ready is false when the Firebase scripts did not load (offline on a first visit).
// An account is { uid, key, name }:
// - uid is Firebase's id for the login;
// - key is the username in lowercase, which names the player's save and leaderboard row, so a
//   player who signs up again with the same username gets them back;
// - name is the username as first typed.
// Promises reject with Firebase errors, which carry a `code`, except deleteAccount, which
// rejects with a message for the player.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  var config = root.AQ_FIREBASE_CONFIG;
  var loginDomain = root.AQ_LOGIN_DOMAIN;
  var firebase = root.firebase;
  // Firebase deletes a login only a few minutes after it was used.
  var RECENT_LOGIN_MS = 4 * 60 * 1000;
  var LOG_IN_AGAIN = 'For safety, log out, log back in, and then delete your account within a few minutes.';

  if (!firebase || !firebase.auth || !firebase.firestore || !config || !loginDomain) {
    AQ.cloud = { ready: false };
    return;
  }
  firebase.initializeApp(config);
  var auth = firebase.auth();
  var db = firebase.firestore();

  function email(name) {
    return AQ.online.loginEmail(name, loginDomain);
  }

  function account(user, name) {
    if (!user) return null;
    var key = AQ.online.nameFromEmail(user.email);
    return { uid: user.uid, key: key, name: name || user.displayName || key };
  }

  function saveDoc(key) {
    return db.collection('saves').doc(key);
  }

  function playerDoc(key) {
    return db.collection('players').doc(key);
  }

  AQ.cloud = {
    ready: true,
    // Calls back with the account, or null, now and whenever it changes.
    onAccount: function (callback) {
      auth.onAuthStateChanged(function (user) { callback(account(user)); });
    },
    // The display name is extra: if Firebase fails to store it, the account still works.
    signUp: function (name, password) {
      return auth.createUserWithEmailAndPassword(email(name), password).then(function (credential) {
        var shown = name.trim();
        return credential.user.updateProfile({ displayName: shown }).catch(function () { /* keep going */ }).then(function () {
          return account(credential.user, shown);
        });
      });
    },
    logIn: function (name, password) {
      return auth.signInWithEmailAndPassword(email(name), password).then(function (credential) {
        return account(credential.user);
      });
    },
    logOut: function () {
      return auth.signOut();
    },
    // { save, rev, base } or null.
    loadSave: function (key) {
      return saveDoc(key).get().then(function (snap) { return snap.exists ? snap.data() : null; });
    },
    writeSave: function (key, doc) {
      return saveDoc(key).set({ save: doc.save, rev: doc.rev, base: doc.base });
    },
    writePlayer: function (key, row) {
      return playerDoc(key).set(Object.assign({}, row, { updated: firebase.firestore.FieldValue.serverTimestamp() }));
    },
    // The players' rows, most total XP first, each with its key as uid.
    listPlayers: function () {
      return db.collection('players').orderBy('totalXp', 'desc').limit(AQ.online.BOARD_LIMIT).get().then(function (snap) {
        return snap.docs.map(function (doc) { return Object.assign({}, doc.data(), { uid: doc.id }); });
      });
    },
    // Deletes the leaderboard row, the save, and then the login. A login used too long ago is
    // refused before anything is deleted. Both times come from Firebase's servers, so the
    // device's clock doesn't matter.
    deleteAccount: function (key) {
      var user = auth.currentUser;
      if (!user || AQ.online.nameFromEmail(user.email) !== key) return Promise.reject('You are not logged in.');
      return user.getIdTokenResult(true).then(function (token) {
        if (Date.parse(token.issuedAtTime) - Date.parse(token.authTime) > RECENT_LOGIN_MS) throw LOG_IN_AGAIN;
        return Promise.all([playerDoc(key).delete(), saveDoc(key).delete()]);
      }).then(function () {
        return user.delete();
      }).catch(function (error) {
        if (typeof error === 'string') throw error;
        if (error && error.code === 'auth/requires-recent-login') throw LOG_IN_AGAIN;
        throw AQ.online.authMessage(error && error.code);
      });
    }
  };
})(window);
