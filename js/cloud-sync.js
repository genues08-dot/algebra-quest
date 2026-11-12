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
// This device's copy is { uid, save, base, dirty }: base is the cloud revision it grew from, and
// dirty is true when it has changes the cloud has not confirmed. uid ties it to one Firebase
// login, so a copy left by a deleted account is never given to a new account with that name.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./storage.js');
    require('./online.js');
  }
  var online = AQ.online;
  var KEY = AQ.storage.KEY;
  // Firestore keeps at most 1 MiB in a document; the rest of the document needs a little room.
  var MAX_BYTES = 1000000;
  // Errors worth sending the same save again for, after a pause.
  var TRY_AGAIN = ['unavailable', 'deadline-exceeded', 'resource-exhausted'];

  function byteLength(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    return unescape(encodeURIComponent(text)).length;
  }

  function newRev() {
    return new Date().toISOString() + '~' + Math.random().toString(36).slice(2, 8);
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
    var synced = false;    // the cloud has been read or has taken a save during this visit
    var closing = false;   // nothing more is sent or kept on the device
    var writing = false;   // a save is on its way to the cloud
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
        device.setItem(deviceKey, JSON.stringify({ uid: account.uid, save: save, base: cloudRev, dirty: save !== cloudSave }));
      } catch (e) { /* the cloud still gets it */ }
    }

    function packed() {
      return typeof memory[KEY] === 'string' ? online.packSave(memory[KEY], bundled) : null;
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
        cloudRev = cloudDoc ? cloudDoc.rev : null;
        cloudSave = cloudDoc ? cloudDoc.save : null;
        synced = true;
        pick = online.chooseStart(local, cloudDoc);
      } else {
        if (!local) return 'wait';
        cloudRev = local.base;
        cloudSave = local.dirty ? null : local.save;
        pick = 'local';
      }
      var doc = pick === 'local' ? local : (pick === 'cloud' ? cloudDoc : null);
      if (doc) memory[KEY] = online.unpackSave(doc.save, bundled);
      return pick || 'fresh';
    }

    // ----- Sending saves -----

    function pump() {
      if (closing || writing || queued === null) return;
      var save = queued;
      queued = null;
      if (save === cloudSave) return;
      if (byteLength(save) > MAX_BYTES) {
        warn('size', 'Your progress is too big to save online. Remove a unit you imported (More, then Remove this unit).');
        return;
      }
      var doc = { save: save, rev: newRev(), base: cloudRev };
      writing = true;
      cloud.writeSave(account.key, doc).then(function () {
        writing = false;
        cloudRev = doc.rev;
        cloudSave = doc.save;
        var first = !synced;
        synced = true;
        if (!closing) writeDevice(packed());
        if (first) scheduleRow();
        pump();
      }, function (error) {
        writing = false;
        var code = (error && error.code) || 'error';
        if (code === 'permission-denied') {
          checkConflict(save);
          return;
        }
        warn('write', 'Your progress could not be saved online (' + code + '). It is saved on this device for now.');
        if (TRY_AGAIN.indexOf(code) !== -1 && queued === null) {
          queued = save;
          setTimeout(pump, options.retryMs);
        }
      });
    }

    // A refused save: either another device saved since this one last heard from the cloud, or
    // the rules turned it down for another reason.
    function checkConflict(save) {
      cloud.loadSave(account.key).then(function (doc) {
        if (doc && doc.rev !== cloudRev) {
          closing = true;
          cloudRev = doc.rev;
          cloudSave = doc.save;
          writeDevice(doc.save);
          options.onConflict();
          return;
        }
        warn('denied', 'Your progress could not be saved online (permission-denied). It is saved on this device for now.');
      }, function () {
        if (queued === null) queued = save;
        setTimeout(pump, options.retryMs);
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
        scheduleRow();
      },
      removeItem: function (key) { delete memory[key]; }
    };

    // ----- The leaderboard row -----
    // Not written until the cloud has been reached, so a device holding old progress doesn't
    // lower the player's row.

    function scheduleRow() {
      if (rowTimer !== null || closing || !synced) return;
      var wait = lastRowAt === 0 ? options.firstRowMs : Math.max(0, options.rowEveryMs - (Date.now() - lastRowAt));
      rowTimer = setTimeout(writeRow, wait);
    }

    function writeRow() {
      if (rowTimer !== null) clearTimeout(rowTimer);
      rowTimer = null;
      if (closing || !synced) return;
      var save = null;
      try { save = JSON.parse(memory[KEY]); } catch (e) { return; }
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
      // Sends a waiting leaderboard row now.
      flushRow: function () {
        if (rowTimer !== null) writeRow();
      },
      // Resolves once no save is waiting to be sent, or after maxMs.
      whenIdle: function (maxMs) {
        var waited = 0;
        return new Promise(function (resolve) {
          (function check() {
            if ((!writing && queued === null) || waited >= maxMs) return resolve();
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
      // Undoes close, after a delete that failed, and sends the newest save.
      reopen: function () {
        closing = false;
        if (typeof memory[KEY] === 'string') store.setItem(KEY, memory[KEY]);
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
