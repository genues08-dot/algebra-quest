// Online play: usernames, login addresses, leaderboard rows and ranking, and choosing between
// the device's copy of a save and the cloud's. Nothing here touches the page, the network, or the
// clock. Dates are local "YYYY-MM-DD" strings.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./game.js');
    require('./rewards.js');
    require('./mascot.js');
  }
  var game = AQ.game;

  var USERNAME_MIN = 3;
  var USERNAME_MAX = 15;
  var USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
  var PASSWORD_MIN = 6;
  var PASSWORD_MAX = 128;
  var XP_MAX = 10000000;
  var BOARD_LIMIT = 500;
  var MEDALS = ['&#129351;', '&#129352;', '&#129353;'];

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  // ----- Accounts -----

  // A message saying what is wrong with a username, or null when it is fine.
  function checkUsername(name) {
    var text = typeof name === 'string' ? name.trim() : '';
    if (text === '') return 'Type a username.';
    if (text.length < USERNAME_MIN) return 'Usernames need at least ' + USERNAME_MIN + ' characters.';
    if (text.length > USERNAME_MAX) return 'Usernames can have at most ' + USERNAME_MAX + ' characters.';
    if (!USERNAME_PATTERN.test(text)) return 'Use only letters, numbers, and _ in a username.';
    return null;
  }

  // A message saying what is wrong with a password, or null when it is fine.
  // `again`, when given, is the second copy typed on Create account.
  function checkPassword(password, again) {
    if (typeof password !== 'string' || password === '') return 'Type a password.';
    if (password.length < PASSWORD_MIN) return 'Passwords need at least ' + PASSWORD_MIN + ' characters.';
    if (password.length > PASSWORD_MAX) return 'Passwords can have at most ' + PASSWORD_MAX + ' characters.';
    if (again !== undefined && again !== password) return "The two passwords don't match.";
    return null;
  }

  // Firebase logs in with an email address, so a username becomes one. No email is ever sent to it.
  function loginEmail(name, domain) {
    return name.trim().toLowerCase() + '@' + domain;
  }

  function nameFromEmail(email) {
    return typeof email === 'string' ? email.split('@')[0] : '';
  }

  var AUTH_MESSAGES = {
    'auth/email-already-in-use': 'That username is taken.',
    'auth/invalid-credential': 'Wrong username or password.',
    'auth/invalid-login-credentials': 'Wrong username or password.',
    'auth/wrong-password': 'Wrong username or password.',
    'auth/user-not-found': 'Wrong username or password.',
    'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
    'auth/network-request-failed': 'No internet connection.'
  };

  // The message for a Firebase error code.
  function authMessage(code) {
    return has(AUTH_MESSAGES, code) ? AUTH_MESSAGES[code] : 'Something went wrong (' + (code || 'unknown') + ').';
  }

  // ----- Leaderboard rows -----

  function wholeXp(value) {
    return typeof value === 'number' && isFinite(value) ? Math.min(XP_MAX, Math.max(0, Math.floor(value))) : 0;
  }

  // XP earned from this week's Monday to today, from the day log.
  function weekXp(save, today) {
    var total = 0;
    var days = save.days || {};
    for (var date = AQ.rewards.weekStart(today); game.dayDiff(date, today) >= 0; date = game.addDays(date, 1)) {
      if (has(days, date)) total += days[date].xp;
    }
    return total;
  }

  // A row's color is the pet's look, such as "pink" or "duck-pekin".
  function knownColor(color) {
    return AQ.mascot.lookInfo(color) ? color : AQ.mascot.DEFAULT.color;
  }

  function knownHat(id) {
    return typeof id === 'string' && AQ.rewards.hatById(id) ? id : null;
  }

  // The player's leaderboard row, made from their save.
  function playerRow(save, name, today) {
    var mascot = save.settings && save.settings.mascot ? save.settings.mascot : AQ.mascot.DEFAULT;
    var total = wholeXp(save.xp);
    return {
      name: name,
      nameLower: name.toLowerCase(),
      weekXp: Math.min(wholeXp(weekXp(save, today)), total),
      week: AQ.rewards.weekStart(today),
      totalXp: total,
      color: knownColor(AQ.mascot.lookOf(mascot)),
      hat: knownHat(save.outfits ? save.outfits.worn : null)
    };
  }

  // True when two rows would show the same on the leaderboard.
  function sameRow(a, b) {
    if (!a || !b) return false;
    return ['name', 'weekXp', 'week', 'totalXp', 'color', 'hat'].every(function (key) { return a[key] === b[key]; });
  }

  // The rows with the viewer's own row put in (or replaced) from their save, which is newer than
  // what the server last got.
  function withMyRow(rows, uid, row) {
    return rows.filter(function (other) { return other.uid !== uid; }).concat([Object.assign({ uid: uid }, row)]);
  }

  // Ranks rows for a mode: 'week' or 'all'. Rows from players: { uid, name, weekXp, week, totalXp,
  // color, hat }, any of which may be missing or wrong, since other players wrote them.
  // Gives [{ uid, name, xp, color, hat, rank, medal, me }], highest XP first. Ties share a rank
  // and are ordered by name. This week, rows with 0 XP are left out, except the viewer's own.
  function rankRows(rows, mode, today, myUid) {
    var week = AQ.rewards.weekStart(today);
    var list = rows.map(function (row) {
      var xp = mode === 'week' ? (row.week === week ? wholeXp(row.weekXp) : 0) : wholeXp(row.totalXp);
      return {
        uid: row.uid,
        name: typeof row.name === 'string' && row.name !== '' ? row.name : 'Player',
        xp: xp,
        color: knownColor(row.color),
        hat: knownHat(row.hat),
        me: row.uid === myUid
      };
    }).filter(function (row) {
      return mode !== 'week' || row.xp > 0 || row.me;
    });
    list.sort(function (a, b) {
      if (b.xp !== a.xp) return b.xp - a.xp;
      var an = a.name.toLowerCase();
      var bn = b.name.toLowerCase();
      return an < bn ? -1 : (an > bn ? 1 : 0);
    });
    list.forEach(function (row, index) {
      row.rank = index > 0 && list[index - 1].xp === row.xp ? list[index - 1].rank : index + 1;
      row.medal = row.xp > 0 && row.rank <= MEDALS.length ? MEDALS[row.rank - 1] : null;
    });
    return list;
  }

  // What Axl says above the leaderboard.
  function boardLine(ranked, mode) {
    var mine = ranked.filter(function (row) { return row.me; })[0];
    if (!mine || mine.xp === 0) return mode === 'week' ? 'Earn XP this week to get on the board!' : 'Earn XP to get on the board!';
    var when = mode === 'week' ? ' this week' : ' of all time';
    if (mine.rank === 1) return "You're #1" + when + '! Keep it up!';
    return "You're #" + mine.rank + when + '! Keep going!';
  }

  // ----- Saves -----

  function usable(doc) {
    return Boolean(doc) && typeof doc.save === 'string' && doc.save !== '';
  }

  // Which copy to start from: 'local' (this device), 'cloud', or null when neither has a save.
  // local is this device's copy, { save, base, pending, dirty }: base is the cloud revision it
  // grew from, pending is a revision it sent that may have landed without an answer, and dirty
  // is true when it has changes the cloud never confirmed. cloud is { save, rev } or null.
  // The device's copy wins only when it has such changes and grew from the cloud's revision as
  // it is now (its base, or its own pending save). Clocks are never compared, so a device with a
  // wrong clock can't win.
  function chooseStart(local, cloud) {
    if (!usable(cloud)) return usable(local) ? 'local' : null;
    var grewFromCloud = usable(local) && cloud.rev != null &&
      (local.base === cloud.rev || local.pending === cloud.rev);
    return grewFromCloud && local.dirty === true ? 'local' : 'cloud';
  }

  // Bundled units are stored as the marker "bundled", so a saved document stays small and always
  // gets the newest copy of the unit. `bundled` is the list of units built into the page.
  function packSave(text, bundled) {
    try {
      var save = JSON.parse(text);
      if (save && save.units) {
        Object.keys(save.units).forEach(function (id) {
          if (bundled.some(function (unit) { return unit.id === id; })) save.units[id] = 'bundled';
        });
      }
      return JSON.stringify(save);
    } catch (e) {
      return text;
    }
  }

  function unpackSave(text, bundled) {
    try {
      var save = JSON.parse(text);
      if (save && save.units) {
        Object.keys(save.units).forEach(function (id) {
          if (save.units[id] !== 'bundled') return;
          var unit = bundled.filter(function (u) { return u.id === id; })[0];
          if (unit) save.units[id] = unit;
          else delete save.units[id];
        });
        // A unit this page does not have is dropped for now; its progress stays for a newer page.
        if (save.currentUnitId != null && !save.units[save.currentUnitId]) {
          var left = Object.keys(save.units);
          save.currentUnitId = left.length > 0 ? left[left.length - 1] : null;
        }
      }
      return JSON.stringify(save);
    } catch (e) {
      return text;
    }
  }

  var api = {
    USERNAME_MAX: USERNAME_MAX,
    PASSWORD_MAX: PASSWORD_MAX,
    BOARD_LIMIT: BOARD_LIMIT,
    checkUsername: checkUsername,
    checkPassword: checkPassword,
    loginEmail: loginEmail,
    nameFromEmail: nameFromEmail,
    authMessage: authMessage,
    weekXp: weekXp,
    playerRow: playerRow,
    sameRow: sameRow,
    withMyRow: withMyRow,
    rankRows: rankRows,
    boardLine: boardLine,
    chooseStart: chooseStart,
    packSave: packSave,
    unpackSave: unpackSave
  };
  AQ.online = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
