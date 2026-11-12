// The cloud: accounts, saves, and the leaderboard, on Firebase (the compat SDK loaded by
// index.html). web-boot.js uses only AQ.cloud, so tests/fake-cloud.js can stand in for it.
//
// AQ.cloud.ready is false when the Firebase scripts did not load (offline on a first visit).
// An account is { uid, name }. Promises reject with Firebase errors, which carry a `code`,
// except deleteAccount, which rejects with a message for the player.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  var config = root.AQ_FIREBASE_CONFIG;
  var firebase = root.firebase;
  // Firebase deletes a login only a few minutes after it was used.
  var RECENT_LOGIN_MS = 4 * 60 * 1000;
  var LOG_IN_AGAIN = 'For safety, log out, log back in, and then delete your account within a few minutes.';

  if (!firebase || !firebase.auth || !firebase.firestore || !config) {
    AQ.cloud = { ready: false };
    return;
  }
  firebase.initializeApp(config);
  var auth = firebase.auth();
  var db = firebase.firestore();

  function email(name) {
    return AQ.online.loginEmail(name, config.authDomain);
  }

  function account(user) {
    return user ? { uid: user.uid, name: user.displayName || AQ.online.nameFromEmail(user.email) } : null;
  }

  function saveDoc(uid) {
    return db.collection('saves').doc(uid);
  }

  function playerDoc(uid) {
    return db.collection('players').doc(uid);
  }

  AQ.cloud = {
    ready: true,
    // Calls back with the account, or null, now and whenever it changes.
    onAccount: function (callback) {
      auth.onAuthStateChanged(function (user) { callback(account(user)); });
    },
    signUp: function (name, password) {
      return auth.createUserWithEmailAndPassword(email(name), password).then(function (credential) {
        return credential.user.updateProfile({ displayName: name.trim() }).then(function () {
          return account(credential.user);
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
    // { save, savedAt } or null.
    loadSave: function (uid) {
      return saveDoc(uid).get().then(function (snap) { return snap.exists ? snap.data() : null; });
    },
    writeSave: function (uid, doc) {
      return saveDoc(uid).set({ save: doc.save, savedAt: doc.savedAt });
    },
    writePlayer: function (uid, row) {
      return playerDoc(uid).set(Object.assign({}, row, { updated: firebase.firestore.FieldValue.serverTimestamp() }));
    },
    // Every player's row, with its uid.
    listPlayers: function () {
      return db.collection('players').limit(AQ.online.BOARD_LIMIT).get().then(function (snap) {
        return snap.docs.map(function (doc) { return Object.assign({}, doc.data(), { uid: doc.id }); });
      });
    },
    // Deletes the leaderboard row, the save, and then the login. A login used too long ago is
    // refused before anything is deleted.
    deleteAccount: function (uid) {
      var user = auth.currentUser;
      if (!user || user.uid !== uid) return Promise.reject('You are not logged in.');
      var lastLogin = Date.parse(user.metadata.lastSignInTime);
      if (!(Date.now() - lastLogin < RECENT_LOGIN_MS)) return Promise.reject(LOG_IN_AGAIN);
      return Promise.all([playerDoc(uid).delete(), saveDoc(uid).delete()]).then(function () {
        return user.delete();
      }).catch(function (error) {
        if (error && error.code === 'auth/requires-recent-login') throw LOG_IN_AGAIN;
        throw AQ.online.authMessage(error && error.code);
      });
    }
  };
})(window);
