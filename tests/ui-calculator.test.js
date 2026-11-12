const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const { makeEnv } = require('./fake-page.js');
const { makeRichUnit, makeSave } = require('./fixtures.js');

const KEY = 'algebraQuest.v1';
const tag = (html, marker) => html.match(new RegExp('<[a-z]+[^>]*' + marker + '[^>]*>'))[0];
const box = env => tag(env.html(), 'data-role="calc-input"').match(/value="([^"]*)"/)[1];
const stored = env => JSON.parse(env.ls.data[KEY]);
const press = (env, insert) => env.click('calc-key', { 'data-insert': insert });
function calcScreen() {
  const env = makeEnv(storage.serialize(makeSave(makeRichUnit())));
  env.click('open-calculator');
  return env;
}
function run(env, text) {
  env.calcBox.value = text;
  env.click('calc-run');
}

test('home opens the calculator screen, and Home returns', () => {
  const env = calcScreen();
  assert.match(env.html(), /data-role="calc-input"/);
  assert.doesNotMatch(env.html(), /data-action="calc-close"/);
  env.click('home');
  assert.match(env.html(), /data-action="open-calculator"/);
});

test('keys type at the end, = runs, C clears, and Ans remembers the result', () => {
  const env = calcScreen();
  for (const k of ['2', '×', '(', '3', '+', '4', ')']) press(env, k);
  assert.equal(box(env), '2×(3+4)');
  env.click('calc-run');
  assert.match(env.html(), /= 14/);
  env.click('calc-clear');
  assert.equal(box(env), '');
  assert.match(env.html(), /= 14/);
  for (const k of ['Ans', '+', '1']) press(env, k);
  env.click('calc-run');
  assert.match(env.html(), /= 15/);
});

test('keys insert at the caret, delete removes before it, and a stale caret appends', () => {
  const env = calcScreen();
  env.calcBox.value = '2+4';
  env.calcBox.selectionStart = env.calcBox.selectionEnd = 1;
  press(env, '0');
  assert.equal(box(env), '20+4');
  env.calcBox.selectionStart = env.calcBox.selectionEnd = 2;
  env.click('calc-back');
  assert.equal(box(env), '2+4');
  env.calcBox.selectionStart = env.calcBox.selectionEnd = 3;
  env.click('calc-back');
  assert.equal(box(env), '2+');
  env.calcBox.selectionStart = env.calcBox.selectionEnd = 99;
  press(env, '5');
  assert.equal(box(env), '2+5');
});

test('after Hint, a key still types at the end and ← still deletes', () => {
  const env = makeEnv(storage.serialize(makeSave(makeRichUnit())));
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  env.click('calc-open');
  for (const k of ['2', '+', '3']) press(env, k);
  env.click('hint');
  press(env, '×');
  assert.equal(box(env), '2+3×');
  env.click('hint');
  env.click('calc-back');
  assert.equal(box(env), '2+3');
});

test('after choosing, Notes, or the next question, a key still types at the end', () => {
  const env = makeEnv(storage.serialize(makeSave(makeRichUnit())));
  env.click('start-lesson', { 'data-lesson-id': 'a1' });
  env.click('teach-skip');
  env.click('calc-open');
  for (const k of ['1', '2']) press(env, k);
  env.click('choose', { 'data-index': '1' });
  press(env, '0');
  assert.equal(box(env), '120');
  env.click('notes');
  env.click('teach-skip');
  press(env, '4');
  assert.equal(box(env), '1204');
  env.click('check');
  env.click('continue');
  assert.match(env.html(), /P q2/);
  press(env, '5');
  assert.equal(box(env), '12045');
});

test('after =, an operator key goes on from Ans', () => {
  const env = calcScreen();
  for (const k of ['2', '×', '(', '3', '+', '4', ')']) press(env, k);
  env.click('calc-run');
  press(env, '+');
  press(env, '1');
  assert.equal(box(env), 'Ans+1');
  env.click('calc-run');
  assert.match(env.html(), /= 15/);
});

test('after =, a number key starts a new entry', () => {
  const env = calcScreen();
  run(env, '5*2');
  press(env, '7');
  assert.equal(box(env), '7');
});

test('after =, the box text is selected, so typing on the keyboard replaces it', () => {
  const env = calcScreen();
  run(env, '5*2');
  assert.deepEqual([env.calcBox.selectionStart, env.calcBox.selectionEnd], [0, 3]);
  run(env, '(2');
  assert.deepEqual([env.calcBox.selectionStart, env.calcBox.selectionEnd], [2, 2]);
});

test('after a graph with no Ans yet, an operator key starts a new entry', () => {
  const env = calcScreen();
  run(env, 'x^2');
  press(env, '+');
  assert.equal(box(env), '+');
});

test('after =, typing in the box, ←, or a history tap lets the keys edit as usual', () => {
  const env = calcScreen();
  run(env, '5*2');
  env.calcBox.value = '5*3';
  env.calcBox.selectionStart = env.calcBox.selectionEnd = 3;
  press(env, '+');
  assert.equal(box(env), '5*3+');
  run(env, '5*2');
  env.click('calc-back');
  press(env, '4');
  assert.equal(box(env), '5*4');
  run(env, '5*2');
  env.click('calc-history', { 'data-index': '1' });
  press(env, '1');
  assert.equal(box(env), '5*21');
});

test('Ans keeps the last number when a graph runs', () => {
  const env = calcScreen();
  run(env, '5*2');
  run(env, 'x^2');
  run(env, 'Ans + 1');
  assert.match(env.html(), /= 11/);
});

test('history is newest first, and a tap puts the text back without running it', () => {
  const env = calcScreen();
  run(env, '1+1');
  run(env, 'x^2 - 4');
  run(env, '(2');
  const items = [...env.html().matchAll(/data-action="calc-history" data-index="\d"[^>]*>([^<]*)</g)].map(m => m[1]);
  assert.deepEqual(items, ['x^2 - 4 → graph', '1+1 = 2']);
  env.click('calc-history', { 'data-index': '1' });
  assert.equal(box(env), '1+1');
  assert.match(env.html(), /Zeros: x = -2, 2/);
});

test('DEG/RAD is saved, changes results, and re-runs a graph', () => {
  const env = calcScreen();
  assert.match(env.html(), /calc-mode-label">DEG</);
  run(env, 'sin(30)');
  assert.match(env.html(), /= 0\.5/);
  run(env, 'sin(x)');
  assert.match(env.html(), /Zeros: x = 0</);
  env.click('calc-mode');
  assert.equal(stored(env).settings.angle, 'rad');
  assert.match(env.html(), /calc-mode-label">RAD</);
  assert.match(env.html(), /Zeros: x = -9\.42/);
});

test('Keys toggle and Enter on the calculator screen', () => {
  const env = calcScreen();
  env.click('calc-keys');
  assert.doesNotMatch(env.html(), /data-action="calc-key"/);
  env.click('calc-keys');
  assert.match(env.html(), /data-action="calc-key"/);
  env.calcBox.value = '6*7';
  env.key('Enter', 'calc-input');
  assert.match(env.html(), /= 42/);
});

test('the lesson calculator has the keypad, and a no-calculator question still hides it', () => {
  const env = makeEnv(storage.serialize(makeSave(makeRichUnit())));
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  env.click('calc-open');
  press(env, '5');
  assert.equal(box(env), '5');
  env.click('quit');
  env.click('start-lesson', { 'data-lesson-id': 'b1' });
  assert.match(env.html(), /No calculator for this question\./);
  assert.doesNotMatch(env.html(), /data-action="calc-key"/);
});
