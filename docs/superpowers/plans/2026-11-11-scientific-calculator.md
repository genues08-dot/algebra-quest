# Scientific Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Algebra Quest's calculator a scientific calculator: a button keypad, trig with a Degrees/Radians switch, Ans and history, extra keys, and a full-screen calculator on the home screen.

**Architecture:** The math reader (`mathexpr.js`) learns the new names, `!`, commas, and symbols, and takes an options argument (angle mode, Ans). `calc.js` passes the options through and adds history helpers. `storage.js` saves the angle mode. `views.js` draws the keypad, history, and a calculator screen. `ui.js` wires the keys, inserting at the caret, and adds the home calculator screen.

**Tech Stack:** Same as before: classic-script JavaScript on the global `AQ`, Node 24 built-in test runner, no npm.

**Spec:** `docs/superpowers/specs/2026-11-11-scientific-calculator-design.md`. Also read sections 4, 5, and 8 of `docs/superpowers/specs/2026-11-11-lesson-features-design.md`.

## Global Constraints

- No npm packages, no build step, no network requests. Classic `<script>` tags only. No `eval`, no `new Function`.
- Every `js/*.js` file except `main.js` keeps the v1 wrapper and exports under Node.
- Only `ui.js` and `main.js` touch `document`, `window`, or `localStorage`.
- All text from unit files, and all typed calculator text, is HTML-escaped before it reaches the page.
- `compile(text)` with no options behaves exactly as it does today. Trig defaults to radians. Unit-file graphs never pass options.
- The saved angle setting is `settings.angle`: `'deg'` or `'rad'`, default `'deg'`. Save `version` stays `1`.
- History holds at most 10 entries, newest first, and lasts until the app closes.
- The "no calculator" rule and the final test rules do not change.
- Messages, exactly:
  - `There is no answer yet.`
  - `Use a comma only inside root(n, x).`
  - `Use root(n, x) with a comma, like root(3, 8).`
- Tests: `node --test "tests/*.test.js"`. Commit after every task, with the session's `Co-Authored-By` trailer. Work on branch `scientific-calculator`.

## Review Focus

1. **Degree-mode exact angles.**
   - `sin(180)` and `cos(90)` must read `= 0`.
   - `tan(90)` must read as undefined, not as 1.6×10¹⁶.

   Tests are in Tasks 1 and 2.
2. **Trig typed without parentheses.** `sin30` and `sin 30` must give `Something is missing near "sin".`, not a wrong number. Test is in Task 1.
3. **A caret past the end of the text,** for example after a redraw shortened it. A key must append, not throw or insert in the wrong place. Test is in Task 5.
4. **Ans after a graph.** Ans keeps the last number result. A graph never changes it. Test is in Task 5.
5. **Switching DEG/RAD while a graph is shown.** The graph re-runs in the new mode. Test is in Task 5.

## File Map

| File | Change |
|---|---|
| `js/mathexpr.js` | Trig, `root`, `ans`, `!`, commas, `²`/`³`/`√`, options, closing-parenthesis fix |
| `js/calc.js` | Options, `value`, snapping tiny values, `historyEntry`, `addHistory` |
| `js/storage.js` | `settings.angle` |
| `js/views.js`, `css/styles.css` | Keypad, mode line, history, Keys toggle, home button, calculator screen |
| `js/ui.js` | Key wiring, caret, Ans, history, mode switch, Keys toggle, calculator screen |
| `tests/fake-page.js` | The calculator box records `selectionStart`/`selectionEnd` from `setSelectionRange` |
| `README.md`, `CLAUDE.md` | Calculator docs; unit-file trig is in radians |

---

### Task 1: Math reader additions

**Files:**
- Modify: `js/mathexpr.js`
- Test: `tests/mathexpr-sci.test.js`

**Interfaces:**
- Produces: `AQ.mathexpr.compile(text: string, options?: { angle?: 'deg' | 'rad', ans?: number | null }) -> { ok: true, usesX, evaluate } | { ok: false, error }`

- [ ] **Step 1: Write the failing tests in `tests/mathexpr-sci.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mathexpr = require('../js/mathexpr.js');

const DEG = { angle: 'deg' };
const value = (text, x, options) => {
  const compiled = mathexpr.compile(text, options);
  assert.equal(compiled.ok, true, text + ': ' + compiled.error);
  return compiled.evaluate(x);
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, actual + ' vs ' + expected);
const error = (text, options) => {
  const compiled = mathexpr.compile(text, options);
  assert.equal(compiled.ok, false, text);
  return compiled.error;
};

test('trig is in radians by default and in degrees on request', () => {
  close(value('sin(pi/2)'), 1);
  close(value('cos(0)'), 1);
  close(value('atan(1)'), Math.PI / 4);
  close(value('sin(30)', 0, DEG), 0.5);
  close(value('cos(60)', 0, DEG), 0.5);
  close(value('tan(45)', 0, DEG), 1);
  close(value('asin(0.5)', 0, DEG), 30);
  close(value('acos(0)', 0, DEG), 90);
  close(value('atan(1)', 0, DEG), 45);
  close(value('2sin(30)', 0, DEG), 1);
  close(value('sin(x)', 90, DEG), 1);
  assert.ok(Number.isNaN(value('asin(2)')));
});

test('degree mode gives exact values at multiples of 90', () => {
  assert.equal(value('sin(180)', 0, DEG), 0);
  assert.equal(value('cos(90)', 0, DEG), 0);
  assert.equal(value('cos(-270)', 0, DEG), 0);
  assert.equal(value('sin(270)', 0, DEG), -1);
  assert.equal(value('tan(180)', 0, DEG), 0);
  assert.ok(Number.isNaN(value('tan(90)', 0, DEG)));
  assert.ok(Number.isNaN(value('tan(-270)', 0, DEG)));
});

test('factorial binds tighter than everything', () => {
  assert.equal(value('5!'), 120);
  assert.equal(value('0!'), 1);
  assert.equal(value('2^3!'), 64);
  assert.equal(value('3!^2'), 36);
  assert.equal(value('-3!'), -6);
  assert.equal(value('(2+1)!'), 6);
  assert.equal(value('x!', 4), 24);
  assert.ok(Number.isNaN(value('3.5!')));
  assert.ok(Number.isNaN(value('(-1)!')));
  assert.equal(value('171!'), Infinity);
});

test('nth root', () => {
  close(value('root(3, 8)'), 2);
  close(value('root(3, -8)'), -2);
  close(value('root(5, -32)'), -2);
  close(value('root(2, 9)'), 3);
  close(value('root(4, 16)'), 2);
  close(value('2root(3, 8)'), 4);
  close(value('root(3, x)', 27), 3);
  assert.ok(Number.isNaN(value('root(2, -4)')));
});

test('Ans', () => {
  assert.equal(value('Ans + 1', 0, { ans: 5 }), 6);
  assert.equal(value('ANS*2', 0, { ans: 2.5 }), 5);
  assert.equal(error('Ans'), 'There is no answer yet.');
  assert.equal(error('Ans + 1', { ans: null }), 'There is no answer yet.');
  assert.equal(error('ans', { ans: NaN }), 'There is no answer yet.');
});

test('symbols copied from a question', () => {
  assert.equal(value('x²', 3), 9);
  assert.equal(value('2³'), 8);
  assert.equal(value('x²+1', 2), 5);
  assert.equal(value('√9'), 3);
  assert.equal(value('√(16)'), 4);
  assert.equal(value('√2.25'), 1.5);
  assert.equal(value('2√x', 9), 6);
});

test('commas, parentheses, and trig without parentheses', () => {
  assert.equal(error('2, 3'), 'Use a comma only inside root(n, x).');
  assert.equal(error('sqrt(4, 2)'), 'Use a comma only inside root(n, x).');
  assert.equal(error('(2, 3)'), 'Use a comma only inside root(n, x).');
  assert.equal(error('root(3)'), 'Use root(n, x) with a comma, like root(3, 8).');
  assert.equal(error('(2 + 3'), 'A closing parenthesis is missing.');
  assert.equal(error('root(3, 8'), 'A closing parenthesis is missing.');
  assert.equal(error('sin30'), 'Something is missing near "sin".');
  assert.equal(error('sin 30'), 'Something is missing near "sin".');
});

test('unknown names are still refused', () => {
  assert.equal(error('exp(2)'), 'I don\'t know the name "exp".');
  assert.equal(error('sec(1)'), 'I don\'t know the name "sec".');
  assert.equal(error('sinh(1)'), 'I don\'t know the name "sinh".');
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test tests/mathexpr-sci.test.js`. Expected: the new tests fail, for example `I don't know the name "sin"`.

- [ ] **Step 3: Implement in `js/mathexpr.js`.**
  - `compile(text, options)`: read `angle` (default `'rad'`) and `ans` (default `null`) from options.
  - `NAMES` is longest first: `asin, acos, atan, sqrt, cbrt, root, sin, cos, tan, abs, log, ans, ln, pi, e, x`.
  - `prepare`, after lowercasing:
    - `²` → `^2`, `³` → `^3`;
    - `√(` → `sqrt(`;
    - `√` followed by a number (`\d+\.?\d*|\.\d+`) or by `x` → `sqrt(<that>)`.
  - **Trig.** One-argument functions take the angle mode. In `'deg'` mode:
    - `sin` and `cos` return exact `0`, `1`, or `-1` when the argument is a whole multiple of 90.
    - `tan` returns `0` at multiples of 180 and NaN at odd multiples of 90.
    - Inverses return degrees.
  - **`root`.** Parse `root ( sum , sum )`. If the first `sum` is followed by `)` instead of a comma, fail with the "with a comma" message. Value: when x < 0 and n is an odd whole number, `-Math.pow(-x, 1/n)`; otherwise `Math.pow(x, 1/n)`.
  - **`ans`.** At compile time, if `ans` is not a finite number, fail with `There is no answer yet.` Otherwise it is a constant.
  - **`!`.** Tokenize `!` as its own token. In `primary`, after a number, name, constant, or parenthesized group, apply any number of `!` postfixes. Factorial is defined for whole numbers 0 to 170. Over 170 it is Infinity. Anything else is NaN.
  - **`,`.** Tokenize as `comma`. `closeParen` accepts only a `close` token: a `comma` fails with the comma message, and no token fails with the missing-parenthesis message. A leftover `comma` at the top level fails with the comma message. A leftover `close` keeps the extra-parenthesis message.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass, including every existing `tests/mathexpr.test.js` case.

- [ ] **Step 5: Commit.**

```bash
git add js/mathexpr.js tests/mathexpr-sci.test.js
git commit -m "feat: scientific functions in the math reader"
```

---

### Task 2: Calculator logic additions

**Files:**
- Modify: `js/calc.js`
- Test: `tests/calc-sci.test.js`

**Interfaces:**
- Consumes: `compile(text, options)` from Task 1.
- Produces:
  - `AQ.calc.run(text, window, options?)`. A number result is `{ kind: 'number', display, value }`.
  - `AQ.calc.historyEntry(text: string, result) -> { text, result: string } | null`
  - `AQ.calc.addHistory(history: Entry[], entry: Entry) -> Entry[]`
  - `AQ.calc.HISTORY_SIZE` is 10.

- [ ] **Step 1: Write the failing tests in `tests/calc-sci.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../js/calc.js');

const W = calc.DEFAULT_WINDOW;
const DEG = { angle: 'deg' };
const UNDEFINED = { kind: 'error', message: 'That is undefined, like dividing by zero.' };

test('options reach the reader', () => {
  assert.equal(calc.run('sin(30)', W, DEG).display, '= 0.5');
  assert.equal(calc.run('sin(pi/6)', W).display, '= 0.5');
  assert.deepEqual(calc.run('Ans', W), { kind: 'error', message: 'There is no answer yet.' });
  assert.equal(calc.run('Ans * 2', W, { ans: 21 }).display, '= 42');
});

test('number results carry their value, and tiny values are zero', () => {
  assert.equal(calc.run('2/3 + 1/4', W).value, 2 / 3 + 1 / 4);
  assert.equal(calc.run('5!', W).value, 120);
  const nearZero = calc.run('sin(pi)', W);
  assert.deepEqual([nearZero.display, nearZero.value], ['= 0', 0]);
  assert.equal(calc.run('cos(90)', W, DEG).display, '= 0');
});

test('undefined results', () => {
  for (const text of ['asin(2)', '3.5!', 'root(2, -4)', '171!']) assert.deepEqual(calc.run(text, W), UNDEFINED, text);
  assert.deepEqual(calc.run('tan(90)', W, DEG), UNDEFINED);
});

test('graphs use the angle mode', () => {
  const deg = calc.run('sin(x)', { xMin: -350, xMax: 350, yMin: -2, yMax: 2 }, DEG);
  assert.equal(deg.zerosLine, 'Zeros: x = -180, 0, 180');
  assert.equal(deg.turningLine, 'Turning points: max (-270, 1), min (-90, -1), max (90, 1), min (270, -1)');
  assert.equal(calc.run('sin(x)', W).zerosLine, 'Zeros: x = -9.42, -6.28, -3.14, 0, 3.14, 6.28, 9.42');
});

test('historyEntry and addHistory', () => {
  assert.deepEqual(calc.historyEntry(' 1+1 ', calc.run('1+1', W)), { text: '1+1', result: '= 2' });
  assert.deepEqual(calc.historyEntry('x^2', calc.run('x^2', W)), { text: 'x^2', result: 'graph' });
  assert.equal(calc.historyEntry('(2', calc.run('(2', W)), null);
  assert.equal(calc.HISTORY_SIZE, 10);
  let history = [];
  for (let i = 1; i <= 12; i++) history = calc.addHistory(history, { text: String(i), result: '= ' + i });
  assert.equal(history.length, 10);
  assert.deepEqual([history[0].text, history[9].text], ['12', '3']);
  const before = [{ text: 'a', result: '= 1' }];
  calc.addHistory(before, { text: 'b', result: '= 2' });
  assert.equal(before.length, 1);
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test tests/calc-sci.test.js`. Expected: failures, for example `calc.historyEntry is not a function`.

- [ ] **Step 3: Implement in `js/calc.js`.**
  - `run` passes `options` to `compile`. For a graph, the same options go to the compile that builds `evaluate`.
  - A number whose `|value| < 1e-12` becomes `0` before display.
  - Number results add `value`.
  - `historyEntry` trims the text. It returns `null` for an error result, `result: 'graph'` for a graph, and `result: <display>` for a number.
  - `addHistory` returns a new array, newest first, cut to `HISTORY_SIZE`.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add js/calc.js tests/calc-sci.test.js
git commit -m "feat: calculator options, Ans value, and history helpers"
```

---

### Task 3: Saved angle mode

**Files:**
- Modify: `js/storage.js`, `tests/fixtures.js`, `tests/storage.test.js`

**Interfaces:**
- Produces: `save.settings.angle: 'deg' | 'rad'`. `newSave` sets `'deg'`. `load` and `parseImportText` fill it in when it is missing.

- [ ] **Step 1: Update the fixtures and tests.**
  - In `tests/fixtures.js`, `makeSave` uses `settings: { sound: true, angle: 'deg' }`.
  - In `tests/storage.test.js`:
    - The expected new save's settings become `{ sound: true, angle: 'deg' }`.
    - The "v1 save" test expects `{ sound: true, angle: 'deg' }`.
    - Add:

```js
test('settings.angle is filled in and checked', () => {
  const noAngle = makeSave(makeUnit());
  delete noAngle.settings.angle;
  const loaded = storage.load(fakeLs({ [KEY]: JSON.stringify(noAngle) }));
  assert.deepEqual(loaded.save.settings, { sound: true, angle: 'deg' });
  assert.deepEqual(storage.parseImportText(JSON.stringify(noAngle)).save.settings, { sound: true, angle: 'deg' });
  const withAngle = value => { const save = makeSave(makeUnit()); save.settings.angle = value; return save; };
  assert.equal(storage.isValidSave(withAngle('rad')), true);
  for (const bad of ['grad', 5, null, '']) assert.equal(storage.isValidSave(withAngle(bad)), false, String(bad));
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test tests/storage.test.js`. Expected: failures on the new and updated expectations.

- [ ] **Step 3: Implement in `js/storage.js`.**
  - `newSave` includes `angle: 'deg'`.
  - `isValidSave` accepts a missing `angle` and rejects anything other than `'deg'` or `'rad'`.
  - `fillDefaults` fills in `angle: 'deg'`.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass. Any other test that compares a stored save with `makeSave` passes, because both sides now have `angle`.

- [ ] **Step 5: Commit.**

```bash
git add js/storage.js tests/fixtures.js tests/storage.test.js
git commit -m "feat: save the calculator's angle mode"
```

---

### Task 4: Keypad, history, and calculator screen views

**Files:**
- Modify: `js/views.js`, `css/styles.css`
- Test: `tests/views-calculator.test.js`

**Interfaces:**
- Consumes: history entries `{ text, result }` from Task 2.
- Produces:
  - `AQ.views.calculatorHtml(model)` reads new optional fields:
    - `mode`: `'deg'` | `'rad'`, default `'deg'`;
    - `keysShown`: default `true`;
    - `history`: default `[]`;
    - `closable`: default `true`.
  - `AQ.views.calculatorScreenHtml(model) -> string`: the same panel with `closable: false`, under a top bar.
  - `AQ.views.KEYPAD`: the list of keys, `[{ label, action, insert?, aria }]`, in spec order.
  - `homeHtml` shows an `open-calculator` button.

- [ ] **Step 1: Write the failing tests in `tests/views-calculator.test.js`.**

```js
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
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test tests/views-calculator.test.js`. Expected: failures, for example `views.calculatorScreenHtml is not a function`.

- [ ] **Step 3: Implement in `js/views.js`.**
  - Define `KEYPAD` once as data in spec order and render it into a `.calc-keypad` grid.
  - Each key renders exactly as `<button type="button" class="calc-k[ extra classes]" data-action="…"[ data-insert="…"] aria-label="…">label</button>`, with `data-insert` and `aria-label` escaped.
  - `=` spans three columns.
  - The mode label is `<span class="calc-mode-label">DEG</span>` or `RAD`.
  - The Keys toggle comes after the keypad, or after the input row when the keys are hidden.
  - A history item is `<button type="button" class="calc-history-item" data-action="calc-history" data-index="i">text = result</button>`, or `text → graph`.
  - The home footer's `Calculator` button sits next to Import, Backup, and Sound.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass, including the existing `calculatorHtml` tests.

- [ ] **Step 5: Add styles to `css/styles.css`** for `.calc-keypad` (5 equal columns, 6px gap, keys at least 40px tall), `.calc-k`, the number keys, `=` in the accent color, the history list, and `.calc-screen`. The layout must work at 360px wide.

- [ ] **Step 6: Commit.**

```bash
git add js/views.js css/styles.css tests/views-calculator.test.js
git commit -m "feat: keypad, history, and calculator screen views"
```

---

### Task 5: Wiring and docs

**Files:**
- Modify: `js/ui.js`, `tests/fake-page.js`, `README.md`, `CLAUDE.md`
- Test: `tests/ui-calculator.test.js`

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces:
  - new actions: `calc-key`, `calc-back`, `calc-clear`, `calc-mode`, `calc-keys`, `calc-history`, `open-calculator`;
  - new screen: `calculator`;
  - `state.calc` gains `keys`, `history`, `ans`, and `caret`.

- [ ] **Step 1: Extend `tests/fake-page.js`.** The calculator box's `setSelectionRange(start, end)` stores `selectionStart` and `selectionEnd` on the box. Each redraw clears both to `undefined`, as with a fresh input. Run `node --test "tests/*.test.js"` to confirm nothing breaks.

- [ ] **Step 2: Write the failing tests in `tests/ui-calculator.test.js`.**

```js
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
```

- [ ] **Step 3: Run and confirm failure.** Run: `node --test tests/ui-calculator.test.js`. Expected: failures, for example no `open-calculator` action.

- [ ] **Step 4: Implement in `js/ui.js`.**
  - `state.calc` gains `keys: true`, `history: []`, `ans: null`, `caret: null`.
  - `calculatorShowing()` is true on the `calculator` screen, and keeps its lesson rule.
  - `readBoxes` also runs on the `calculator` screen. It sets `caret` from the calculator box's `selectionStart` when that is a number, else `null`.
  - **Inserting.** Clamp `caret` to `0..text.length`. Replace the selection from `selectionStart` to `selectionEnd` when both are known; otherwise append. After the redraw, focus the box and call `setSelectionRange` with the caret after the inserted text.
  - **`calc-run`:**
    - pass `{ angle: state.save.settings.angle, ans: state.calc.ans }`;
    - on a number, set `ans = result.value`;
    - for a non-null `historyEntry`, set `history = addHistory(…)`.
  - **Zoom** re-runs with the same options.
  - **`calc-mode`** flips `settings.angle` on `copyOfSave()` and saves through `commit`. If `graphText` is set, it re-runs that text in the new mode.
  - **`open-calculator`** works only from home and shows the `calculator` screen.
  - **`home`** works from the calculator screen.
  - The panel model passes `mode`, `keysShown`, `history`, and `closable` (false on the calculator screen).

- [ ] **Step 5: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 6: Update the docs.**
  - **README.md, calculator section:**
    - the keypad and the home Calculator button;
    - DEG/RAD;
    - Ans and history;
    - what it accepts, adding `sin cos tan` and their inverses, `root(n, x)`, `!`, `x²`, and `√`.
  - **CLAUDE.md:** in `graph.fn`, trig is in radians, and the calculator syntax now includes `sin(`, `root(n, x)`, and `!`.

- [ ] **Step 7: Commit.**

```bash
git add js/ui.js tests/fake-page.js tests/ui-calculator.test.js README.md CLAUDE.md
git commit -m "feat: scientific calculator keypad, Ans, history, and home screen"
```

- [ ] **Step 8: Browser check (controller) and the user's play-through (after the final review).**
