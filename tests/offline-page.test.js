// offline.html is what the old pinned PC shortcut opens. It erases the old PC progress and opens the online app.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const script = fs.readFileSync(path.join(__dirname, '../offline.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

function run(protocol, stored) {
  const data = Object.assign({}, stored);
  const localStorage = Object.assign(Object.create({
    removeItem(key) { delete data[key]; }
  }), data);
  // Object.keys(localStorage) lists the stored keys, as in a browser.
  const replaced = [];
  vm.runInNewContext(script, { location: { protocol, replace: url => replaced.push(url) }, localStorage });
  return { data, replaced };
}

test('from file://, it erases only Algebra Quest keys and opens the online app', () => {
  const { data, replaced } = run('file:', { 'algebraQuest.v1': '{}', 'algebraQuest.probe': '1', 'otherApp.notes': 'keep' });
  assert.deepEqual(data, { 'otherApp.notes': 'keep' });
  assert.deepEqual(replaced, ['https://genues08-dot.github.io/algebra-quest/']);
});

test('on the website, it erases nothing and goes to the app', () => {
  const { data, replaced } = run('https:', { 'algebraQuest.v1': '{}' });
  assert.deepEqual(data, { 'algebraQuest.v1': '{}' });
  assert.deepEqual(replaced, ['./']);
});
