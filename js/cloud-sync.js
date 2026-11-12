// Keeping a player's save in the cloud, with a copy on this device, and their leaderboard row up
// to date. Nothing here touches the page, so tests/cloud-sync.test.js runs it on a fake cloud.
// js/web-boot.js makes one sync per login.
//
// Every cloud save has a revision, rev, and names the revision it grew from, base. The database
// rules accept a save only when its base is the cloud's rev, so a device holding old progress
// (opened offline, or left open while another device played) can't write over newer progress.
// When the cloud refuses a save for that reason, the cloud's progress is kept and the page
// reloads with it.
//
// This device's copy is { uid, save, base, pending, dirty }:
// - uid ties it to one Firebase login, so a copy left by a deleted account is never given to a
//   new account with that name;
// - base is the cloud revision it grew from;
// - pending is the revision of a save sent but not yet confirmed (the page may close before the
//   cloud answers, though the cloud got it), or null;
// - dirty is true when it has changes the cloud has not confirmed.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./storage.js');
    require('./online.js');
  }
  var online = AQ.online;
  var KEY = AQ.storage.KEY;
  // Firestore keeps at most 1 MiB in a document, and the rules allow under 1,000,000 characters.
  var MAX_BYTES = 990000;
  // Errors worth sending the same save again for, after a pause.
  var TRY_AGAIN = ['unavailable', 'deadline-exceeded', 'resource-exhausted'];
  // The rules allow one leaderboard change every 5 seconds.
  var ROW_GAP_MS = 6000;

  function byteLength(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    return unescape(encodeURIComponent(text)).length;
  }

  function newRev() {
    return new Date().toISOString() + '~' + Math.random().toString(36).slice(2, 8);
  }

  function codeOf(error) {
    return (error && error.code) || 'error';
  }

  // options:
  //   cloud: AQ.cloud (loadSave, writeSave, writePlayer)
  //   account: { uid, key, name }
  //   bundled: the units built into the page
  //   device: localStorage, or anything with getItem, setItem, and removeItem
  //   prefix: the start of the device copy's storage key
  //   today(): today's date, "YYYY-MM-DD"
  //   onConflict(): another device saved newer progress; the page should reload
  //   onWarn(message): show a message to the player
  //   firstRowMs, rowEveryMs, retryMs: waits, in milliseconds
  function create(options) {
    var cloud = options.cloud;
    var account = options.account;
    var bundled = options.bundled || [];
    var device = options.device;
    var deviceKey = options.prefix + account.key;

    var memory = {};
    var cloudRev = null;   // the cloud's revision, as far as this device knows
    var cloudSave = null;  // the save text with that revision, or null when not known
    var maybeRev = null;   // a revision this device sent in an earlier visit that may have landed
    var sending = null;    // the revision on its way to the cloud
    var closing = false;   // nothing more is sent or kept on the device
    var queued = null;     // the newest save not yet sent
    var warned = {};
    var rowTimer = null;
    var lastRow = null;
    var lastRowAt = 0;

    function warn(kind, message) {
      if (warned[kind]) return;
      warned[kind] = true;
      options.onWarn(message);
    }

    function readDevice() {
      try {
        var doc = JSON.parse(device.getItem(deviceKey));
        return doc && doc.uid === account.uid && typeof doc.save === 'string' ? doc : null;
      } catch (e) {
        return null;
      }
    }

    function writeDevice(save) {
      try {
        device.setItem(deviceKey, JSON.stringify({
          uid: account.uid, save: save, base: cloudRev, pending: sending || maybeRev, dirty: save !== cloudSave
        }));
      } catch (e) { /* the cloud still gets it */ }
    }

    function packed() {
      return typeof memory[KEY] === 'string' ? online.packSave(memory[KEY], bundled) : null;
    }

    // Takes a save the cloud is known to have.
    function confirmed(rev, save) {
      cloudRev = rev || null;
      cloudSave = save;
      maybeRev = null;
    }

    // ----- Starting -----

    // Chooses the save to start from and puts it in the store. cloudDoc is the cloud's save,
    // { save, rev }, or null. reached is false when the cloud could not be read.
    // Returns 'cloud', 'local', 'fresh', or 'wait'. 'wait' means the cloud could not be read
    // and this device has no copy: starting fresh then could replace real progress.
    function start(cloudDoc, reached) {
      var local = readDevice();
      var pick;
      if (reached) {
        confirmed(cloudDoc ? cloudDoc.rev : null, cloudDoc ? cloudDoc.save : null);
        pick = online.chooseStart(local, cloudDoc);
        scheduleRow();
      } else {
        if (!local) return 'wait';
        cloudRev = local.base || null;
        cloudSave = local.dirty ? null : local.save;
        maybeRev = local.pending || null;
        pick = 'local';
      }
      var doc = pick === 'local' ? local : (pick === 'cloud' ? cloudDoc : null);
      if (doc) memory[KEY] = online.unpackSave(doc.save, bundled);
      return pick || 'fresh';
    }

    // ----- Sending saves -----

    function tryLater(save) {
      if (queued === null) queued = save;
      setTimeout(pump, options.retryMs);
    }

    function pump() {
      if (closing || sending !== null || queued === null) return;
      var save = queued;
      queued = null;
      if (save === cloudSave) return;
      if (byteLength(save) > MAX_BYTES) {
        warn('size', 'Your progress is too big to save online. Remove a unit you imported (More, then Remove this unit).');
        return;
      }
      var doc = { save: save, rev: newRev(), base: cloudRev };
      sending = doc.rev;
      writeDevice(packed());
      Promise.resolve().then(function () {
        return cloud.writeSave(account.key, doc);
      }).then(function () {
        sending = null;
        confirmed(doc.rev, doc.save);
        if (!closing) writeDevice(packed());
        scheduleRow();
        pump();
      }, function (error) {
        sending = null;
        var code = codeOf(error);
        if (code === 'permission-denied') {
          checkConflict(save);
          return;
        }
        warn('write', 'Your progress could not be saved online (' + code + '). It is saved on this device for now.');
        if (TRY_AGAIN.indexOf(code) !== -1) tryLater(save);
        else if (queued !== null) setTimeout(pump, options.retryMs);
      });
    }

    // A refused save: another device saved since this one last heard from the cloud, or this
    // device's own save from an earlier visit landed without an answer, or the rules turned it
    // down for another reason.
    function checkConflict(save) {
      Promise.resolve().then(function () {
        return cloud.loadSave(account.key);
      }).then(function (doc) {
        var rev = doc ? doc.rev || null : null;
        if (doc && rev !== null && rev === maybeRev) {
          // This device's own save: carry on from it.
          confirmed(rev, doc.save);
          tryLater(save);
          return;
        }
        if (doc && rev !== cloudRev) {
          closing = true;
          confirmed(rev, doc.save);
          writeDevice(doc.save);
          options.onConflict();
          return;
        }
        warn('denied', 'Your progress could not be saved online (permission-denied). It is saved on this device for now.');
      }, function (error) {
        if (TRY_AGAIN.indexOf(codeOf(error)) !== -1) tryLater(save);
        else warn('denied', 'Your progress could not be saved online (' + codeOf(error) + '). Log out and back in if this keeps happening.');
      });
    }

    // The storage object the app uses in place of localStorage.
    var store = {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
      setItem: function (key, value) {
        memory[key] = String(value);
        if (key !== KEY || closing) return;
        var save = packed();
        writeDevice(save);
        queued = save;
        pump();
      },
      removeItem: function (key) { delete memory[key]; }
    };

    // ----- The leaderboard row -----
    // Made only from the save the cloud has confirmed, so a device holding old progress can't
    // lower the player's row.

    function scheduleRow() {
      if (rowTimer !== null || closing || cloudSave === null) return;
      var wait = lastRowAt === 0 ? options.firstRowMs : Math.max(0, options.rowEveryMs - (Date.now() - lastRowAt));
      rowTimer = setTimeout(writeRow, wait);
    }

    function writeRow() {
      if (rowTimer !== null) clearTimeout(rowTimer);
      rowTimer = null;
      if (closing || cloudSave === null) return;
      var save = null;
      try { save = JSON.parse(cloudSave); } catch (e) { return; }
      if (!save) return;
      var row = online.playerRow(save, account.name, options.today());
      if (online.sameRow(row, lastRow)) return;
      lastRow = row;
      lastRowAt = Date.now();
      cloud.writePlayer(account.key, row).then(null, function () { lastRow = null; });
    }

    // ----- For logging out and deleting -----

    return {
      store: store,
      start: start,
      // Sends a waiting leaderboard row now, unless the last one went out too recently.
      flushRow: function () {
        if (rowTimer !== null && Date.now() - lastRowAt >= ROW_GAP_MS) writeRow();
      },
      // Resolves once no save is waiting to be sent, or after maxMs.
      whenIdle: function (maxMs) {
        var waited = 0;
        return new Promise(function (resolve) {
          (function check() {
            if ((sending === null && queued === null) || waited >= maxMs) return resolve();
            waited += 50;
            setTimeout(check, 50);
          })();
        });
      },
      // Stops sending saves and rows.
      close: function () {
        closing = true;
        if (rowTimer !== null) clearTimeout(rowTimer);
        rowTimer = null;
      },
      // Undoes close, after a delete that failed, and sends the newest save and row again.
      reopen: function () {
        closing = false;
        lastRow = null;
        if (typeof memory[KEY] === 'string') store.setItem(KEY, memory[KEY]);
        scheduleRow();
      },
      forgetDevice: function () {
        try { device.removeItem(deviceKey); } catch (e) { /* nothing to remove */ }
      }
    };
  }

  var api = { create: create, MAX_BYTES: MAX_BYTES };
  AQ.cloudSync = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
