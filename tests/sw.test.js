// The online app's file lists must agree, or it breaks offline or in the fake-cloud check page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');
const attrs = (html, name) => [...html.matchAll(new RegExp(name + '="([^"]+)"', 'g'))].map(m => m[1]);

// The FILES list in sw.js, with FIREBASE + 'name' joined.
function cachedFiles() {
  const sw = read('sw.js');
  const firebase = sw.match(/var FIREBASE = '([^']+)'/)[1];
  const list = sw.match(/var FILES = \[([\s\S]*?)\];/)[1];
  return [...list.matchAll(/(FIREBASE \+ )?'([^']+)'/g)].map(m => (m[1] ? firebase : '') + m[2]);
}

test('the service worker keeps every file index.html loads', () => {
  const html = read('index.html');
  const used = attrs(html, 'src').concat(attrs(html, 'href'));
  const cached = cachedFiles();
  used.forEach(file => assert.ok(cached.includes(file), file + ' is not in sw.js'));
});

test('the service worker keeps every axolotl picture and the icons', () => {
  const cached = cachedFiles();
  fs.readdirSync(path.join(repo, 'img/axl')).forEach(name => assert.ok(cached.includes('img/axl/' + name), name));
  JSON.parse(read('manifest.webmanifest')).icons.forEach(icon => assert.ok(cached.includes(icon.src), icon.src));
});

test('every file the service worker keeps exists', () => {
  cachedFiles().filter(file => !file.startsWith('https://') && file !== './').forEach(file => {
    assert.ok(fs.existsSync(path.join(repo, file)), file + ' is missing');
  });
});

test('the fake-cloud page loads the same app scripts as index.html', () => {
  const appScripts = rel => attrs(read(rel), 'src').filter(src => src.startsWith('js/') &&
    !['js/firebase-config.js', 'js/cloud.js'].includes(src));
  assert.deepEqual(appScripts('tests/web-fake.html'), appScripts('index.html'));
  assert.ok(attrs(read('tests/web-fake.html'), 'src').includes('tests/fake-cloud.js'));
});

test('the Firebase scripts in index.html are the version the service worker keeps', () => {
  const firebase = read('sw.js').match(/var FIREBASE = '([^']+)'/)[1];
  const remote = attrs(read('index.html'), 'src').filter(src => src.startsWith('https://'));
  assert.equal(remote.length, 3);
  remote.forEach(src => assert.ok(src.startsWith(firebase), src));
});

test('the phone page loads every app script index.html loads before the online ones', () => {
  const scripts = rel => attrs(read(rel), 'src').filter(src => src.startsWith('js/'));
  const index = scripts('index.html');
  const core = index.slice(0, index.indexOf('js/online.js'));
  assert.ok(core.includes('js/pet-heads.js'));
  const phone = scripts('phone.html');
  core.forEach(src => assert.ok(phone.includes(src), src + ' is not in phone.html'));
});
