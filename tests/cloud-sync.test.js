// js/cloud-sync.js on a fake cloud that checks saves the way firestore.rules does.
const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const online = require('../js/online.js');
const cloudSync = require('../js/cloud-sync.js');
const { makeUnit, makeSave } = require('./fixtures.js');

const KEY = storage.KEY;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const TODAY = '2026-11-12';
const ACCOUNT = { uid: 'uid-1', key: 'axl_fan', name: 'Axl_Fan' };

// The cloud: one save per key, refused unless it grew from the save there (like the rules).
function fakeCloud() {
  const cloud = {
    saves: {},
    players: {},
    online: true,
    writes: 0,
    loadSave(key) {
      return cloud.online ? Promise.resolve(cloud.saves[key] || null) : Promise.reject(Object.assign(new Error('x'), { code: 'unavailable' }));
    },
    writeSave(key, doc) {
      cloud.writes += 1;
      if (!cloud.online) return Promise.reject(Object.assign(new Error('x'), { code: 'unavailable' }));
      const current = cloud.saves[key];
      if (current && doc.base !== current.rev) return Promise.reject(Object.assign(new Error('x'), { code: 'permission-denied' }));
      cloud.saves[key] = { save: doc.save, rev: doc.rev, base: doc.base };
      return Promise.resolve();
    },
    writePlayer(key, row) {
      if (!cloud.online) return Promise.reject(new Error('offline'));
      cloud.players[key] = row;
      return Promise.resolve();
    }
  };
  return cloud;
}

function fakeDevice() {
  const data = {};
  return {
    data,
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: key => { delete data[key]; }
  };
}

function makeSync(cloud, device, extra = {}) {
  const events = { conflicts: 0, warnings: [] };
  const sync = cloudSync.create(Object.assign({
    cloud,
    account: ACCOUNT,
    bundled: [],
    device,
    prefix: 'aq.',
    today: () => TODAY,
    onConflict: () => { events.conflicts += 1; },
    onWarn: message => events.warnings.push(message),
    firstRowMs: 5,
    rowEveryMs: 20,
    retryMs: 10
  }, extra));
  return { sync, events };
}

const saveText = xp => {
  const save = makeSave(makeUnit());
  save.xp = xp;
  return storage.serialize(save);
};
const xpIn = text => JSON.parse(text).xp;
const deviceCopy = device => JSON.parse(device.data['aq.axl_fan']);

test('a new account starts fresh and its first save reaches the cloud', async () => {
  const cloud = fakeCloud();
  const device = fakeDevice();
  const { sync } = makeSync(cloud, device);
  assert.equal(sync.start(null, true), 'fresh');
  sync.store.setItem(KEY, saveText(10));
  await wait(5);
  assert.equal(xpIn(cloud.saves.axl_fan.save), 10);
  assert.equal(cloud.saves.axl_fan.base, null);
  assert.deepEqual([deviceCopy(device).dirty, deviceCopy(device).base], [false, cloud.saves.axl_fan.rev]);
  await wait(15);
  assert.equal(cloud.players.axl_fan.totalXp, 10);
});

test('saves go one at a time, each growing from the last', async () => {
  const cloud = fakeCloud();
  const { sync, events } = makeSync(cloud, fakeDevice());
  sync.start(null, true);
  sync.store.setItem(KEY, saveText(10));
  sync.store.setItem(KEY, saveText(20));
  sync.store.setItem(KEY, saveText(30));
  await sync.whenIdle(500);
  assert.equal(xpIn(cloud.saves.axl_fan.save), 30);
  assert.equal(events.conflicts, 0);
  assert.equal(cloud.writes, 2); // 10, then the newest (30); 20 was replaced while waiting
});

test('the cloud save is used when this device has nothing newer', () => {
  const cloud = fakeCloud();
  cloud.saves.axl_fan = { save: saveText(70), rev: 'B', base: 'A' };
  const device = fakeDevice();
  device.setItem('aq.axl_fan', JSON.stringify({ uid: 'uid-1', save: saveText(40), base: 'A', dirty: false }));
  const { sync } = makeSync(cloud, device);
  assert.equal(sync.start(cloud.saves.axl_fan, true), 'cloud');
  assert.equal(xpIn(sync.store.getItem(KEY)), 70);
});

test('offline play is kept when the cloud did not change meanwhile', async () => {
  const cloud = fakeCloud();
  cloud.saves.axl_fan = { save: saveText(50), rev: 'A', base: null };
  const device = fakeDevice();
  device.setItem('aq.axl_fan', JSON.stringify({ uid: 'uid-1', save: saveText(50), base: 'A', dirty: false }));

  cloud.online = false;
  const first = makeSync(cloud, device);
  assert.equal(first.sync.start(null, false), 'local');
  first.sync.store.setItem(KEY, saveText(80));
  await wait(5);
  assert.equal(deviceCopy(device).dirty, true);
  assert.equal(deviceCopy(device).base, 'A');

  cloud.online = true;
  const second = makeSync(cloud, device);
  assert.equal(second.sync.start(cloud.saves.axl_fan, true), 'local');
  second.sync.store.setItem(KEY, second.sync.store.getItem(KEY));
  await second.sync.whenIdle(500);
  assert.equal(xpIn(cloud.saves.axl_fan.save), 80);
});

test('a device opened offline with old progress never writes over newer progress', async () => {
  // Monday the phone saved revision A. Tuesday the PC saved revision B.
  const cloud = fakeCloud();
  cloud.saves.axl_fan = { save: saveText(200), rev: 'B', base: 'A' };
  const phone = fakeDevice();
  phone.setItem('aq.axl_fan', JSON.stringify({ uid: 'uid-1', save: saveText(100), base: 'A', dirty: false }));

  // Wednesday the phone opens with no signal and the app saves on start.
  cloud.online = false;
  const offline = makeSync(cloud, phone);
  assert.equal(offline.sync.start(null, false), 'local');
  offline.sync.store.setItem(KEY, saveText(110));
  await wait(5);

  // Thursday it opens online: the PC's progress wins.
  cloud.online = true;
  const later = makeSync(cloud, phone);
  assert.equal(later.sync.start(cloud.saves.axl_fan, true), 'cloud');
  assert.equal(xpIn(later.sync.store.getItem(KEY)), 200);
  assert.equal(xpIn(cloud.saves.axl_fan.save), 200);
});

test('a device left open while another device saved is refused and reloads with the newer progress', async () => {
  const cloud = fakeCloud();
  cloud.saves.axl_fan = { save: saveText(100), rev: 'A', base: null };
  const phone = fakeDevice();
  const { sync, events } = makeSync(cloud, phone);
  sync.start(cloud.saves.axl_fan, true);

  cloud.saves.axl_fan = { save: saveText(300), rev: 'B', base: 'A' }; // the PC played
  sync.store.setItem(KEY, saveText(110)); // the phone wakes up and saves
  await wait(10);
  assert.equal(events.conflicts, 1);
  assert.equal(xpIn(cloud.saves.axl_fan.save), 300);
  assert.deepEqual([xpIn(deviceCopy(phone).save), deviceCopy(phone).base, deviceCopy(phone).dirty], [300, 'B', false]);
  // Nothing more is sent or kept after that.
  sync.store.setItem(KEY, saveText(120));
  await wait(10);
  assert.equal(xpIn(cloud.saves.axl_fan.save), 300);
  assert.equal(xpIn(deviceCopy(phone).save), 300);
});

test('with no copy here and no cloud, the app waits instead of starting fresh', () => {
  const { sync } = makeSync(fakeCloud(), fakeDevice());
  assert.equal(sync.start(null, false), 'wait');
});

test('a device copy from another login with the same name is ignored', () => {
  const device = fakeDevice();
  device.setItem('aq.axl_fan', JSON.stringify({ uid: 'deleted-account', save: saveText(999), base: null, dirty: true }));
  const { sync } = makeSync(fakeCloud(), device);
  assert.equal(sync.start(null, true), 'fresh');
  assert.equal(sync.start(null, false), 'wait');
});

test('the leaderboard row waits until the cloud has been reached', async () => {
  const cloud = fakeCloud();
  const device = fakeDevice();
  device.setItem('aq.axl_fan', JSON.stringify({ uid: 'uid-1', save: saveText(40), base: null, dirty: true }));
  cloud.online = false;
  const { sync } = makeSync(cloud, device);
  sync.start(null, false);
  sync.store.setItem(KEY, saveText(45));
  cloud.online = true;
  await wait(15);
  assert.equal(cloud.players.axl_fan, undefined);
  // The retry sends the save, and then the row goes out.
  await wait(40);
  assert.equal(xpIn(cloud.saves.axl_fan.save), 45);
  assert.equal(cloud.players.axl_fan.totalXp, 45);
});

test('a save too big for the cloud is kept on the device, with one warning', async () => {
  const cloud = fakeCloud();
  const device = fakeDevice();
  const { sync, events } = makeSync(cloud, device);
  sync.start(null, true);
  const save = makeSave(makeUnit());
  save.units.big = { id: 'big', filler: 'x'.repeat(cloudSync.MAX_BYTES) };
  sync.store.setItem(KEY, storage.serialize(save));
  sync.store.setItem(KEY, storage.serialize(save));
  await wait(5);
  assert.equal(cloud.saves.axl_fan, undefined);
  assert.equal(events.warnings.length, 1);
  assert.equal(deviceCopy(device).dirty, true);
});

test('close stops sending; reopen sends the newest save', async () => {
  const cloud = fakeCloud();
  const { sync } = makeSync(cloud, fakeDevice());
  sync.start(null, true);
  sync.close();
  sync.store.setItem(KEY, saveText(60));
  await wait(5);
  assert.equal(cloud.saves.axl_fan, undefined);
  sync.reopen();
  await sync.whenIdle(500);
  assert.equal(xpIn(cloud.saves.axl_fan.save), 60);
});

test('bundled units are sent as markers', async () => {
  const unit = makeUnit();
  const cloud = fakeCloud();
  const { sync } = makeSync(cloud, fakeDevice(), { bundled: [unit] });
  sync.start(null, true);
  sync.store.setItem(KEY, storage.serialize(makeSave(unit)));
  await sync.whenIdle(500);
  assert.equal(JSON.parse(cloud.saves.axl_fan.save).units.u1, 'bundled');
  assert.equal(online.unpackSave(cloud.saves.axl_fan.save, [unit]).includes('"title":"Unit 1"'), true);
});
