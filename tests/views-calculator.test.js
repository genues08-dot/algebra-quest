const test = require('node:test');
const assert = require('node:assert/strict');
const views = require('../js/views.js');
const storage = require('../js/storage.js');
const { makeUnit, makeSave } = require('./fixtures.js');

const panel = extra => Object.assign({ text: '', result: null, error: null, mode: 'deg', keysShown: true, history: [], closable: true }, extra);
const keys = html => [...html.matchAll(/<button type="button" class="calc-k[^"]*" data-action="([a-z-]+)"(?: data-insert="([^"]*)")? aria-label="([^"]*)">([^<]*)<\/button>/g)]
  .map(m => ({ action: m[1], insert: m[2], aria: m[3], label: m[4] }));

test('the keypad has 43 keys in spec order', () => {
  const found = keys(views.calculatorHtml(panel()));
  assert.deepEqual(found.map(k => k.label), [
    'DEG/RAD', 'Ans', '(', ')', '←',
    'sin', 'cos', 'tan', 'π', 'C',
    'sin⁻¹', 'cos⁻¹', 'tan⁻¹', 'e', 'x',
    'x²', 'xʸ', '√', 'ˣ√', '|x|',
    'log', 'ln', 'n!', '1/x', '×10ⁿ',
    '7', '8', '9', '÷', '(−)',
    '4', '5', '6', '×', ',',
    '1', '2', '3', '−', '+',
    '0', '.', '='
  ]);
  for (const key of found) assert.ok(key.aria.trim(), key.label);
});

test('keys type the spec text or run an action', () => {
  const byLabel = Object.fromEntries(keys(views.calculatorHtml(panel())).map(k => [k.label, k]));
  const inserts = {
    'Ans': 'Ans', 'sin': 'sin(', 'cos': 'cos(', 'tan': 'tan(', 'sin⁻¹': 'asin(', 'cos⁻¹': 'acos(', 'tan⁻¹': 'atan(',
    'π': 'π', 'e': 'e', 'x': 'x', 'x²': '^2', 'xʸ': '^', '√': '√(', 'ˣ√': 'root(', '|x|': 'abs(',
    'log': 'log(', 'ln': 'ln(', 'n!': '!', '1/x': '^(-1)', '×10ⁿ': '×10^(', '(−)': '-',
    '7': '7', '0': '0', '.': '.', '(': '(', ')': ')', ',': ',', '÷': '÷', '×': '×', '−': '−', '+': '+'
  };
  for (const [label, text] of Object.entries(inserts)) assert.deepEqual([byLabel[label].action, byLabel[label].insert], ['calc-key', text], label);
  assert.equal(byLabel['DEG/RAD'].action, 'calc-mode');
  assert.equal(byLabel['←'].action, 'calc-back');
  assert.equal(byLabel['C'].action, 'calc-clear');
  assert.equal(byLabel['='].action, 'calc-run');
  const aria = { 'sin': 'sine', 'sin⁻¹': 'inverse sine', '√': 'square root', 'ˣ√': 'nth root', 'n!': 'factorial', '(−)': 'negative', '×10ⁿ': 'times ten to the power', '←': 'delete', 'C': 'clear' };
  for (const [label, words] of Object.entries(aria)) assert.equal(byLabel[label].aria, words, label);
});

test('mode line, Keys toggle, and close button', () => {
  assert.match(views.calculatorHtml(panel()), /class="calc-mode-label">DEG</);
  assert.match(views.calculatorHtml(panel({ mode: 'rad' })), /class="calc-mode-label">RAD</);
  const hidden = views.calculatorHtml(panel({ keysShown: false }));
  assert.equal(keys(hidden).length, 0);
  assert.match(hidden, /data-action="calc-keys"[^>]*>Show keys</);
  assert.match(views.calculatorHtml(panel()), /data-action="calc-keys"[^>]*>Hide keys</);
  assert.match(views.calculatorHtml(panel()), /data-action="calc-close"/);
  assert.doesNotMatch(views.calculatorHtml(panel({ closable: false })), /data-action="calc-close"/);
});

test('history lists entries newest first and escapes them', () => {
  const html = views.calculatorHtml(panel({ history: [
    { text: 'x < 3', result: 'graph' },
    { text: '2/3 + 1/4', result: '11/12 ≈ 0.9166666667' }
  ] }));
  const items = [...html.matchAll(/data-action="calc-history" data-index="(\d)"[^>]*>([^<]*)</g)].map(m => [m[1], m[2]]);
  assert.deepEqual(items, [['0', 'x &lt; 3 → graph'], ['1', '2/3 + 1/4 = 11/12 ≈ 0.9166666667']]);
  assert.match(html, /History/);
  assert.doesNotMatch(views.calculatorHtml(panel()), /History/);
});

test('home has a Calculator button, and the calculator screen has Home and no close', () => {
  assert.match(views.homeHtml(views.homeModel(makeSave(makeUnit()))), /data-action="open-calculator"/);
  assert.match(views.homeHtml(views.homeModel(storage.newSave())), /data-action="open-calculator"/);
  const screen = views.calculatorScreenHtml(panel());
  assert.match(screen, /data-action="home"/);
  assert.match(screen, /Calculator/);
  assert.match(screen, /data-role="calc-input"/);
  assert.doesNotMatch(screen, /data-action="calc-close"/);
  assert.equal(keys(screen).length, 43);
});
