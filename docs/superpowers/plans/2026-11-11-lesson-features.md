# Lesson Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add teaching cards, graphs in problems, a number-and-graphing calculator, a final test, and sounds to Algebra Quest.

**Architecture:** Four new DOM-free files (`mathexpr`, `plot`, `calc`, `sound`) do the new thinking and are tested under Node. `units`, `game`, and `storage` grow optional fields, so v1 unit files and saves keep working. `views` builds the new HTML, and `ui` wires it to clicks and keys.

**Tech Stack:** Same as v1: HTML, CSS, classic-script JavaScript, Node 24 test runner. Web Audio for sounds, inline SVG for graphs.

**Spec:** `docs/superpowers/specs/2026-11-11-lesson-features-design.md`. The v1 spec, `docs/superpowers/specs/2026-11-11-algebra-quest-design.md`, still applies.

**Additions beyond the spec's file list:** `tests/fake-page.js` (the fake page from `tests/ui.test.js`, shared).

## Global Constraints

- No npm packages, no build step, no network requests.
- Classic `<script>` tags only. Every `js/*.js` file except `main.js` keeps the v1 wrapper and exports under Node.
- Typed text is never run as code: no `eval`, no `new Function`.
- Only `ui.js` and `main.js` touch `document`, `window`, or `localStorage`. `sound.js` may read `AudioContext` from the global object and nothing else.
- All text from unit files is HTML-escaped before it reaches the page.
- Unit `format` stays `1` and save `version` stays `1`. Every new field is optional.
- Script order in `index.html`: `checker, mathexpr, units, plot, calc, game, storage, sound, views, ui, main`.
- New constants: `XP_TEST_PASS` 50, `TEST_PASS_PERCENT` 80. Existing constants do not change.
- Calculator start window: −10 to 10 on both axes. Zoom limits: 1.25 and 1280 units wide.
- Styling rules from v1 hold: system font, CSS transitions only, no images, works at 360px wide.
- Tests: `node --test "tests/*.test.js"`, Node built-ins only.
- Work on branch `lesson-features`. Commit after every task, with the session's `Co-Authored-By` trailer.

## Review Focus

1. **What students type into the calculator.** `y = 2x + 1`, `f(x) = x^2`, `X^2`, `1/2x`, and `-x^2` must give the value a student expects, and an equation such as `x^2 = 4` must give a clear message. Tests in Task 1.
2. **Curves that leave the window or jump.** `x^5` and `1/(x - 0.03)` must draw without `NaN`, without huge coordinates, and without a line across the jump. Tests in Task 2.
3. **v1 files keep working.** A v1 unit and a v1 save must load unchanged, with the new fields filled in. Tests in Tasks 4 and 5.
4. **The final test must not leak answers.** No hint text, no feedback, no `correct` or `wrong` sound, and no formula in a graph's label. Tests in Tasks 9 and 11.
5. **Nothing typed is lost on redraw.** The typed answer, the picked choice, and the calculator text must survive opening Notes, the calculator, a hint, and zoom. Tests in Task 10.

## File Map

| File | Change |
|---|---|
| `js/mathexpr.js` | New. Parse and evaluate typed math. |
| `js/plot.js` | New. Zeros, turning points, SVG drawing, number formatting. |
| `js/calc.js` | New. Calculator results and zoom. |
| `js/sound.js` | New. Sound note lists and playback. |
| `js/units.js` | Validate `graph`, `calculator`, `teach`, `test`. Lookups cover test questions. |
| `js/game.js` | Final test sessions, skip, score, unlock. |
| `js/storage.js` | `testBest` and `settings`. |
| `js/views.js` | Graph, teaching card, calculator panel, test screens, home additions. |
| `js/ui.js` | Wiring for all of the above. |
| `index.html`, `css/styles.css` | Script tags and styles. |
| `tools/validate-unit.js`, `units/sample-unit.json` | Report and include the new parts. |
| `tests/fixtures.js` | `makeRichUnit()`; `makeSave` gains the new fields. |

---

### Task 1: Typed math reader

**Files:**
- Create: `js/mathexpr.js`
- Test: `tests/mathexpr.test.js`

**Interfaces:**
- Produces: `AQ.mathexpr.compile(text: string) -> { ok: true, usesX: boolean, evaluate: (x: number) -> number } | { ok: false, error: string }`

- [ ] **Step 1: Write the failing tests in `tests/mathexpr.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mathexpr = require('../js/mathexpr.js');

const value = (text, x) => {
  const compiled = mathexpr.compile(text);
  assert.equal(compiled.ok, true, text + ': ' + compiled.error);
  return compiled.evaluate(x);
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, actual + ' vs ' + expected);
const error = text => {
  const compiled = mathexpr.compile(text);
  assert.equal(compiled.ok, false, text);
  return compiled.error;
};

test('arithmetic and order of operations', () => {
  close(value('2 + 3 * 4'), 14);
  close(value('(2 + 3) * 4'), 20);
  close(value('10 - 4 - 3'), 3);
  close(value('12 / 4 / 3'), 1);
  close(value('2^3^2'), 512);
  close(value('-3^2'), -9);
  close(value('(-3)^2'), 9);
  close(value('2^-3'), 0.125);
  close(value('.5 + 1.25'), 1.75);
  close(value('+5'), 5);
  close(value('(-2)^3 * 8'), -64);
});

test('names, functions, and symbols', () => {
  close(value('sqrt(50)'), Math.sqrt(50));
  close(value('cbrt(-27)'), -3);
  close(value('abs(-4.5)'), 4.5);
  close(value('log(1000)'), 3);
  close(value('ln(e)'), 1);
  close(value('2pi'), 2 * Math.PI);
  close(value('2π'), 2 * Math.PI);
  close(value('SQRT(16)'), 4);
  close(value('7 − 2 × 3 ÷ 6'), 6);
});

test('multiplying without a sign', () => {
  close(value('2x', 5), 10);
  close(value('3(x+1)', 2), 9);
  close(value('(x+1)(x-2)', 4), 10);
  close(value('x(x+1)', 3), 12);
  close(value('2sqrt(9)'), 6);
  close(value('2x^2', 3), 18);
  close(value('1/2x', 4), 2);
  close(value('-x^2', 3), -9);
  close(value('x^3 - 6x^2 + 7x + 2', 1), 4);
});

test('what students type', () => {
  close(value('y = 2x + 1', 3), 7);
  close(value('f(x) = x^2', 4), 16);
  close(value('X^2', 5), 25);
  assert.equal(error('x^2 = 4'), 'I don\'t understand "=".');
});

test('usesX', () => {
  assert.equal(mathexpr.compile('2 + 3').usesX, false);
  assert.equal(mathexpr.compile('2x').usesX, true);
  assert.equal(mathexpr.compile('y = 5').usesX, false);
});

test('undefined values come back as not finite', () => {
  assert.ok(Number.isNaN(value('sqrt(-1)')));
  assert.ok(Number.isNaN(value('0/0')));
  assert.equal(value('1/0'), Infinity);
});

test('errors are plain sentences', () => {
  assert.equal(error(''), 'Type something to calculate.');
  assert.equal(error('   '), 'Type something to calculate.');
  assert.equal(error('2 # 3'), 'I don\'t understand "#".');
  assert.equal(error('y + 1'), 'I don\'t know the name "y".');
  assert.equal(error('(2 + 3'), 'A closing parenthesis is missing.');
  assert.equal(error('2 + 3)'), 'There is an extra closing parenthesis.');
  assert.equal(error('2 +'), 'Something is missing near "+".');
  assert.equal(error('2 * / 3'), 'Something is missing near "*".');
  assert.equal(error('* 3'), 'Something is missing near "*".');
  assert.equal(error('()'), 'Something is missing near "(".');
  assert.equal(error('sqrt 4'), 'Something is missing near "sqrt".');
  assert.equal(error('2 3'), 'Something is missing near "3".');
});

test('text that looks like code is refused', () => {
  assert.equal(error('alert(1)'), 'I don\'t know the name "alert".');
  assert.equal(error('constructor'), 'I don\'t know the name "constructor".');
  assert.equal(error('exp(2)'), 'I don\'t know the name "exp".');
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL, cannot find module `../js/mathexpr.js`.

- [ ] **Step 3: Implement `js/mathexpr.js`** as a tokenizer plus a recursive-descent parser that builds closures.
  - Before tokenizing: lowercase the text, map `−`, `×`, `÷`, `π` to `-`, `*`, `/`, `pi`, and drop one leading `y=` or `f(x)=` (spaces allowed).
  - A run of letters is split by longest match into the known names `sqrt`, `cbrt`, `abs`, `log`, `ln`, `pi`, `e`, `x`. If any part of the run does not match, the error names the whole run.
  - Grammar, loosest first: sum (`+`, `-`), product (`*`, `/`, and no-sign multiplication), leading sign, power (`^`, right-grouping, exponent may carry a leading sign), primary.
  - No-sign multiplication happens when a primary is followed by a name or `(`. A number directly after a number is the error `Something is missing near "<second number>".`
  - A function name must be followed by `(`. Otherwise the error is `Something is missing near "<function name>".`
  - When an operand is missing, the error names the token before the gap. If there is none, it names the token found.
  - `log` is base 10 and `ln` is natural log.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add js/mathexpr.js tests/mathexpr.test.js
git commit -m "feat: typed math reader"
```

---

### Task 2: Plotting

**Files:**
- Create: `js/plot.js`
- Test: `tests/plot.test.js`

**Interfaces:**
- Consumes: an `evaluate(x)` function from Task 1.
- Produces:
  - `AQ.plot.features(evaluate, window) -> { zeros: number[], turningPoints: { x: number, y: number, kind: 'max' | 'min' }[] }`
  - `AQ.plot.svg({ evaluate, window, numbers: boolean, marks: { x, y, kind: 'zero' | 'max' | 'min' }[], label: string }) -> string`
  - `AQ.plot.niceStep(range: number) -> number`
  - `AQ.plot.format(value: number, places: number) -> string`
  - A window is `{ xMin, xMax, yMin, yMax }`.

- [ ] **Step 1: Write the failing tests in `tests/plot.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mathexpr = require('../js/mathexpr.js');
const plot = require('../js/plot.js');

const f = text => mathexpr.compile(text).evaluate;
const W = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
const r2 = v => Math.round(v * 100) / 100 + 0;
const points = list => list.map(p => [r2(p.x), r2(p.y), p.kind]);

test('zeros and turning points of a cubic', () => {
  const found = plot.features(f('x^3 + x^2 - 2x'), W);
  assert.deepEqual(found.zeros.map(r2), [-2, 0, 1]);
  assert.deepEqual(points(found.turningPoints), [[-1.22, 2.11, 'max'], [0.55, -0.63, 'min']]);
});

test('turning points match the packet example', () => {
  const found = plot.features(f('x^3 - 6x^2 + 7x + 2'), W);
  assert.deepEqual(points(found.turningPoints), [[0.71, 4.3, 'max'], [3.29, -4.3, 'min']]);
});

test('a zero where the graph touches the axis is found once', () => {
  const found = plot.features(f('x^3 - 6x^2 + 9x'), W);
  assert.deepEqual(found.zeros.map(r2), [0, 3]);
  assert.deepEqual(points(found.turningPoints), [[1, 4, 'max'], [3, 0, 'min']]);
});

test('no zeros, zeros outside the window, and undefined stretches', () => {
  assert.deepEqual(plot.features(f('x^2 + 1'), W).zeros, []);
  assert.deepEqual(points(plot.features(f('x^2 + 1'), W).turningPoints), [[0, 1, 'min']]);
  assert.deepEqual(plot.features(f('x^2 - 400'), W).zeros, []);
  const root = plot.features(f('sqrt(x)'), W);
  assert.deepEqual(root.zeros.map(r2), [0]);
  assert.deepEqual(root.turningPoints, []);
  assert.deepEqual(plot.features(() => NaN, W), { zeros: [], turningPoints: [] });
});

test('niceStep gives at most 10 lines', () => {
  assert.deepEqual([20, 10, 8, 40, 200, 1].map(plot.niceStep), [2, 1, 1, 5, 20, 0.1]);
});

test('format rounds and trims', () => {
  assert.deepEqual([4.3033, -0.001, 2.5, 3, -6.066].map(v => plot.format(v, 2)), ['4.3', '0', '2.5', '3', '-6.07']);
});

test('svg has its parts', () => {
  const svg = plot.svg({ evaluate: f('x^2 - 4'), window: W, numbers: true, marks: [{ x: 2, y: 0, kind: 'zero' }, { x: 0, y: -4, kind: 'min' }], label: 'a < b' });
  assert.match(svg, /^<svg[^>]*viewBox="0 0 320 320"/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="a &lt; b"/);
  assert.match(svg, /class="plot-axis"/);
  assert.match(svg, /class="plot-grid"/);
  assert.match(svg, /<path[^>]*class="plot-curve"/);
  assert.match(svg, /class="plot-mark plot-mark-zero"/);
  assert.match(svg, /class="plot-mark plot-mark-min"/);
  assert.match(svg, /<text/);
  assert.doesNotMatch(svg, /x\^2/);
});

test('svg without numbers, and with nothing to draw', () => {
  const sketch = plot.svg({ evaluate: f('x^3'), window: W, numbers: false, marks: [], label: 'Graph' });
  assert.doesNotMatch(sketch, /<text/);
  const empty = plot.svg({ evaluate: () => NaN, window: W, numbers: true, marks: [], label: 'Graph' });
  assert.match(empty, /class="plot-axis"/);
  assert.doesNotMatch(empty, /plot-curve/);
});

test('steep curves and jumps draw safely', () => {
  const steep = plot.svg({ evaluate: f('x^5'), window: W, numbers: false, marks: [], label: 'Graph' });
  assert.doesNotMatch(steep, /NaN|Infinity/);
  const curve = steep.match(/<path[^>]*class="plot-curve"[^>]*>/)[0];
  for (const number of curve.match(/-?\d+(\.\d+)?/g).map(Number)) assert.ok(Math.abs(number) <= 2000, String(number));
  const jump = plot.svg({ evaluate: f('1/(x - 0.03)'), window: W, numbers: false, marks: [], label: 'Graph' });
  const pieces = jump.match(/<path[^>]*class="plot-curve"[^>]*d="([^"]*)"/)[1].match(/M/g).length;
  assert.ok(pieces >= 2, 'the curve should break at the jump');
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL, cannot find module `../js/plot.js`.

- [ ] **Step 3: Implement `js/plot.js`.**
  - `features` samples at `xMin + (xMax - xMin) * i / 400` for `i` from 0 to 400, and skips any stretch with a value that is not finite.
    - **Turning point:** the slope of two neighboring steps changes sign. Refine by 40 rounds of bisection on a central-difference slope. `kind` is `'max'` when the slope goes from positive to negative.
    - **Zero:** a sign change between neighbors, refined by 40 rounds of bisection; or a sampled value of exactly 0; or a turning point with `|y| < 1e-6`.
    - Merge results closer than `1e-4`, then sort by `x`.
  - `niceStep` returns the smallest of 1, 2, 5 times a power of 10 for which `range / step <= 10`.
  - `format` rounds to `places`, trims trailing zeros, and never returns `-0`.
  - `svg` maps the window onto a 320 by 320 square with `y` up. Element classes are `plot-grid`, `plot-axis`, `plot-curve`, `plot-mark plot-mark-<kind>`, and `plot-number`.
    - The curve is one `<path class="plot-curve" d="...">` from 200 steps. A new `M` starts after any point that is not finite, and between two neighbors that are outside the window on opposite sides.
    - Pixel values are held within −1000 to 1320.
    - With `numbers`, each grid line except 0 gets a `<text class="plot-number">` beside its axis.
    - `label` is escaped for the attribute.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add js/plot.js tests/plot.test.js
git commit -m "feat: zeros, turning points, and SVG graphs"
```

---

### Task 3: Calculator logic

**Files:**
- Create: `js/calc.js`
- Test: `tests/calc.test.js`

**Interfaces:**
- Consumes: `AQ.mathexpr.compile`, `AQ.plot.features`, `AQ.plot.format`.
- Produces:
  - `AQ.calc.DEFAULT_WINDOW`, which is `{ xMin: -10, xMax: 10, yMin: -10, yMax: 10 }`
  - `AQ.calc.run(text, window)` returns one of:
    - `{ kind: 'error', message: string }`
    - `{ kind: 'number', display: string }`
    - `{ kind: 'graph', evaluate, window, zeros, turningPoints, zerosLine: string, turningLine: string }`
  - `AQ.calc.zoom(window, factor: number) -> window`
  - `AQ.calc.formatNumber(value) -> string` and `AQ.calc.asFraction(value) -> { n, d } | null`

- [ ] **Step 1: Write the failing tests in `tests/calc.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../js/calc.js');

const W = calc.DEFAULT_WINDOW;
const display = text => calc.run(text, W).display;

test('default window', () => assert.deepEqual(W, { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }));

test('number results', () => {
  assert.equal(display('2 + 3 * 4'), '= 14');
  assert.equal(display('(-2)^3 * 8'), '= -64');
  assert.equal(display('sqrt(50)'), '= 7.071067812');
  assert.equal(display('2pi'), '= 6.283185307');
  assert.equal(display('2/3 + 1/4'), '11/12 ≈ 0.9166666667');
  assert.equal(display('3/4'), '3/4 = 0.75');
  assert.equal(display('0.1 + 0.2'), '3/10 = 0.3');
  assert.equal(display('-5/2'), '-5/2 = -2.5');
});

test('fractions', () => {
  assert.deepEqual(calc.asFraction(0.75), { n: 3, d: 4 });
  assert.deepEqual(calc.asFraction(1 / 3), { n: 1, d: 3 });
  assert.deepEqual(calc.asFraction(-2.5), { n: -5, d: 2 });
  assert.equal(calc.asFraction(2), null);
  assert.equal(calc.asFraction(Math.PI), null);
});

test('errors', () => {
  assert.deepEqual(calc.run('', W), { kind: 'error', message: 'Type something to calculate.' });
  assert.deepEqual(calc.run('(2', W), { kind: 'error', message: 'A closing parenthesis is missing.' });
  assert.deepEqual(calc.run('1/0', W), { kind: 'error', message: 'That is undefined, like dividing by zero.' });
  assert.deepEqual(calc.run('sqrt(-1)', W), { kind: 'error', message: 'That is undefined, like dividing by zero.' });
});

test('graph results', () => {
  const cubic = calc.run('x^3 + x^2 - 2x', W);
  assert.equal(cubic.kind, 'graph');
  assert.deepEqual(cubic.window, W);
  assert.equal(cubic.zerosLine, 'Zeros: x = -2, 0, 1');
  assert.equal(cubic.turningLine, 'Turning points: max (-1.22, 2.11), min (0.55, -0.63)');
  assert.equal(cubic.evaluate(2), 8);
  const bowl = calc.run('x^2 + 1', W);
  assert.equal(bowl.zerosLine, 'Zeros: none in this window');
  assert.equal(bowl.turningLine, 'Turning points: min (0, 1)');
  const line = calc.run('y = 2x + 1', W);
  assert.equal(line.zerosLine, 'Zeros: x = -0.5');
  assert.equal(line.turningLine, 'Turning points: none in this window');
});

test('zoom halves, doubles, and stops at its limits', () => {
  assert.deepEqual(calc.zoom(W, 0.5), { xMin: -5, xMax: 5, yMin: -5, yMax: 5 });
  assert.deepEqual(calc.zoom(W, 2), { xMin: -20, xMax: 20, yMin: -20, yMax: 20 });
  let small = W;
  for (let i = 0; i < 10; i++) small = calc.zoom(small, 0.5);
  assert.deepEqual(small, { xMin: -0.625, xMax: 0.625, yMin: -0.625, yMax: 0.625 });
  let large = W;
  for (let i = 0; i < 10; i++) large = calc.zoom(large, 2);
  assert.deepEqual(large, { xMin: -640, xMax: 640, yMin: -640, yMax: 640 });
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL, cannot find module `../js/calc.js`.

- [ ] **Step 3: Implement `js/calc.js`.**
  - `formatNumber` is `String(Number(value.toPrecision(10)))`, with `-0` shown as `0`.
  - `asFraction` tries denominators 2 to 1000 in order and returns the first reduced fraction within `1e-9` of the value. Whole numbers return `null`.
  - A number result reads `= <number>` with no fraction. With a fraction it reads `<n>/<d> = <number>` when `|value - Number(text)| <= 1e-12`, and `<n>/<d> ≈ <number>` otherwise.
  - Text with no `x` is evaluated once. A value that is not finite is the "undefined" error.
  - Text with `x` is a graph result. Its lines use `AQ.plot.format(value, 2)`.
  - `zoom` scales each axis about its center by `factor`. It returns the window unchanged when the new x-width would be under 1.25 or over 1280.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add js/calc.js tests/calc.test.js
git commit -m "feat: calculator logic"
```

---

### Task 4: Unit file additions

**Files:**
- Modify: `js/units.js`, `tests/fixtures.js`
- Test: `tests/units-features.test.js`

**Interfaces:**
- Consumes: `AQ.mathexpr.compile`.
- Produces:
  - `AQ.units.validate` accepts and checks `graph`, `calculator`, `teach`, and `test`.
  - `AQ.units.testQuestions(unit) -> question[]`, empty when the unit has no test.
  - `AQ.units.findQuestion` and `AQ.units.questionIds` include test questions, after lesson questions.
  - `makeRichUnit()` from `tests/fixtures.js`.

- [ ] **Step 1: Add `makeRichUnit` to `tests/fixtures.js`** and export it. `makeUnit` does not change.

```js
function makeRichUnit() {
  const unit = makeUnit();
  unit.levels[0].lessons[0].teach = [
    { title: 'Card one', text: ['First paragraph.', 'Second paragraph.'] },
    {
      title: 'Card two',
      text: ['Look at x < 3.'],
      example: { problem: 'Solve x + 1 = 3', steps: ['Subtract 1.', 'x = 2'] },
      graph: { fn: 'x^2 - 4', x: [-5, 5], y: [-6, 6], numbers: false }
    }
  ];
  unit.levels[0].lessons[1].questions[0].graph = { fn: 'x^3 - 3x^2 - 3' };
  unit.levels[1].lessons[0].questions[0].calculator = false;
  const typed = (id, answer) => ({ id, type: 'input', prompt: 'T ' + id, hint: 'H ' + id, solution: 'S ' + id, answers: [answer] });
  unit.test = {
    questions: [
      { id: 't1', type: 'choice', prompt: 'T t1', hint: 'H t1', solution: 'S t1', choices: ['no', 'yes'], answer: 1, graph: { fn: '2x - 4' } },
      typed('t2', '2'), typed('t3', '3'), typed('t4', '4'),
      Object.assign(typed('t5', '5'), { calculator: false })
    ]
  };
  return unit;
}
```

- [ ] **Step 2: Write the failing tests in `tests/units-features.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const units = require('../js/units.js');
const { makeUnit, makeRichUnit } = require('./fixtures.js');

const L0 = 'levels[0].lessons[0]';
const Q = 'levels[0].lessons[1].questions[0]';

test('a unit with every new part is valid, and a v1 unit still is', () => {
  assert.deepEqual(units.validate(makeRichUnit()), { ok: true, errors: [] });
  assert.deepEqual(units.validate(makeUnit()), { ok: true, errors: [] });
});

test('each broken rule reports one error with its location', () => {
  const lesson = u => u.levels[0].lessons[0];
  const question = u => u.levels[0].lessons[1].questions[0];
  const cases = [
    [u => { lesson(u).teach = []; }, L0 + '.teach: must have 1 to 5 cards'],
    [u => { lesson(u).teach = [1, 2, 3, 4, 5, 6].map(n => ({ title: 'T' + n, text: ['x'] })); }, L0 + '.teach: must have 1 to 5 cards'],
    [u => { lesson(u).teach[0] = 'card'; }, L0 + '.teach[0]: must be an object'],
    [u => { lesson(u).teach[0].title = ''; }, L0 + '.teach[0].title: must be a non-empty string'],
    [u => { lesson(u).teach[0].text = []; }, L0 + '.teach[0].text: must have at least 1 paragraph'],
    [u => { lesson(u).teach[0].text = ['ok', ' ']; }, L0 + '.teach[0].text[1]: must be a non-empty string'],
    [u => { lesson(u).teach[1].example = 'x'; }, L0 + '.teach[1].example: must be an object'],
    [u => { lesson(u).teach[1].example.problem = ''; }, L0 + '.teach[1].example.problem: must be a non-empty string'],
    [u => { lesson(u).teach[1].example.steps = []; }, L0 + '.teach[1].example.steps: must have at least 1 step'],
    [u => { lesson(u).teach[1].example.steps = ['']; }, L0 + '.teach[1].example.steps[0]: must be a non-empty string'],
    [u => { lesson(u).teach[1].graph.fn = '(x'; }, L0 + '.teach[1].graph.fn: A closing parenthesis is missing.'],
    [u => { question(u).graph = 'x^2'; }, Q + '.graph: must be an object'],
    [u => { question(u).graph.fn = ' '; }, Q + '.graph.fn: must be a non-empty string'],
    [u => { question(u).graph.x = [5, -5]; }, Q + '.graph.x: must be two numbers, smaller first'],
    [u => { question(u).graph.y = [1]; }, Q + '.graph.y: must be two numbers, smaller first'],
    [u => { question(u).graph.numbers = 'yes'; }, Q + '.graph.numbers: must be true or false'],
    [u => { u.levels[1].lessons[0].questions[0].calculator = 'no'; }, 'levels[1].lessons[0].questions[0].calculator: must be true or false'],
    [u => { u.test = []; }, 'test: must be an object'],
    [u => { u.test.questions = []; }, 'test.questions: must have at least 1 question'],
    [u => { u.test.questions[1].id = 'q1'; }, 'test.questions[1].id: duplicate question id "q1"'],
    [u => { u.test.questions[2].answers = []; }, 'test.questions[2].answers: must have at least 1 answer'],
    [u => { u.test.questions[0].graph.fn = 'y + 1'; }, 'test.questions[0].graph.fn: I don\'t know the name "y".']
  ];
  for (const [mutate, message] of cases) {
    const unit = makeRichUnit();
    mutate(unit);
    assert.deepEqual(units.validate(unit), { ok: false, errors: [message] }, message);
  }
});

test('lookups cover test questions', () => {
  const unit = makeRichUnit();
  assert.equal(units.findQuestion(unit, 't3').prompt, 'T t3');
  assert.deepEqual(units.questionIds(unit), ['q1', 'q2', 'q3', 'q4', 't1', 't2', 't3', 't4', 't5']);
  assert.deepEqual(units.testQuestions(unit).map(q => q.id), ['t1', 't2', 't3', 't4', 't5']);
  assert.deepEqual(units.testQuestions(makeUnit()), []);
  assert.deepEqual(units.questionIds(makeUnit()), ['q1', 'q2', 'q3', 'q4']);
});
```

- [ ] **Step 3: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL in the three new tests; every v1 test still passes.

- [ ] **Step 4: Extend `js/units.js`.** Under Node it also requires `./mathexpr.js`.
  - `graph` is checked the same way on a question and on a teaching card. A `graph.fn` that fails `compile` reports the compile error as its message.
  - `x` and `y` are each a 2-item array of finite numbers with the first less than the second.
  - Test questions go through the same question check as lesson questions, with the path `test.questions[i]` and the same duplicate-id set.
  - Keep the v1 rule that one mistake gives one error.

- [ ] **Step 5: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 6: Commit.**

```bash
git add js/units.js tests/fixtures.js tests/units-features.test.js
git commit -m "feat: unit files can hold graphs, teaching cards, and a final test"
```

---

### Task 5: Save data additions

**Files:**
- Modify: `js/storage.js`, `tests/fixtures.js`, `tests/storage.test.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Produces: a save with `settings: { sound: boolean }`, and `progress[unitId].testBest: number | null`. `AQ.storage.load` fills both in when they are missing.

- [ ] **Step 1: Change `makeSave` in `tests/fixtures.js`** so the save has `settings: { sound: true }` and each progress entry has `testBest: null`.

- [ ] **Step 2: Update and add tests in `tests/storage.test.js`.**
  - In `load: empty storage gives a new save`, add `settings: { sound: true }` to the expected save.
  - In `addUnit: replacing keeps progress only for ids that still exist`, start with `testBest: 85` in the old progress and expect `{ completedLessons: ['a1'], review: ['q2'], testBest: 85 }`.
  - Add these tests:

```js
test('load: a v1 save is valid and gets the new fields', () => {
  const old = makeSave(makeUnit());
  delete old.settings;
  delete old.progress.u1.testBest;
  const raw = JSON.stringify(old);
  const ls = fakeLs({ [KEY]: raw });
  const loaded = storage.load(ls);
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.save.settings, { sound: true });
  assert.equal(loaded.save.progress.u1.testBest, null);
  assert.equal(ls.data[KEY], raw);
});

test('isValidSave checks testBest and settings', () => {
  const withBest = value => { const save = makeSave(makeUnit()); save.progress.u1.testBest = value; return save; };
  const withSettings = value => { const save = makeSave(makeUnit()); save.settings = value; return save; };
  for (const good of [withBest(0), withBest(100), withBest(null), withSettings({ sound: false })]) assert.equal(storage.isValidSave(good), true);
  for (const bad of [withBest(101), withBest(-1), withBest(2.5), withBest('x'), withSettings([]), withSettings({ sound: 'yes' }), withSettings({})]) {
    assert.equal(storage.isValidSave(bad), false);
  }
});

test('a backup with the new fields restores', () => {
  const save = makeSave(makeUnit());
  save.settings.sound = false;
  save.progress.u1.testBest = 90;
  assert.deepEqual(storage.parseImportText(storage.serialize(save)), { kind: 'backup', save });
});
```

- [ ] **Step 3: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL in the storage tests named above.

- [ ] **Step 4: Update `js/storage.js`.**
  - `newSave` includes `settings: { sound: true }`.
  - `addUnit` gives a new unit `testBest: null` and keeps the old value when replacing.
  - `isValidSave` accepts a missing `settings` and a missing `testBest`. When present, `settings` is a plain object whose `sound` is a boolean, and `testBest` is `null` or a whole number from 0 to 100.
  - `load` and `parseImportText` fill in the missing fields on the object they return. `load` still never writes.

- [ ] **Step 5: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 6: Commit.**

```bash
git add js/storage.js tests/fixtures.js tests/storage.test.js
git commit -m "feat: save data holds the best test score and the sound setting"
```

---

### Task 6: Final test rules

**Files:**
- Modify: `js/game.js`, `tests/game-basics.test.js`
- Test: `tests/game-test.test.js`

**Interfaces:**
- Consumes: `AQ.units.testQuestions`, `AQ.units.findQuestion`, the save shape from Task 5.
- Produces:
  - `AQ.game.startTest(unit, rng?) -> session | null`
  - `AQ.game.skipQuestion(save, unit, session, today) -> { correct: false, question } | null`
  - `AQ.game.testScore(session) -> number`
  - `AQ.game.testPassed(session) -> boolean`
  - `AQ.game.isTestUnlocked(unit, progress) -> boolean`
  - `AQ.game.submitAnswer` handles `kind: 'test'` sessions.
  - `CONSTANTS.XP_TEST_PASS` and `CONSTANTS.TEST_PASS_PERCENT`.

- [ ] **Step 1: Update the `constants` test in `tests/game-basics.test.js`** to expect the two new constants, `XP_TEST_PASS: 50` and `TEST_PASS_PERCENT: 80`.

- [ ] **Step 2: Write the failing tests in `tests/game-test.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../js/game.js');
const { makeUnit, makeRichUnit, makeSave } = require('./fixtures.js');

const TODAY = '2026-11-11';
const IN_ORDER = () => 0.999999;
const RIGHT = { t1: 1, t2: '2', t3: '3', t4: '4', t5: '5' };
const setup = () => { const unit = makeRichUnit(); return { unit, save: makeSave(unit) }; };
function take(ctx, wrongIds) {
  const session = game.startTest(ctx.unit, IN_ORDER);
  while (session.status === 'active') {
    const id = session.queue[0];
    const response = wrongIds.includes(id) ? (id === 't1' ? 0 : '99') : RIGHT[id];
    game.submitAnswer(ctx.save, ctx.unit, session, response, TODAY);
  }
  return session;
}

test('startTest', () => {
  const { unit } = setup();
  const session = game.startTest(unit, IN_ORDER);
  assert.deepEqual([session.kind, session.lessonId, session.queue, session.total, session.hearts], ['test', null, ['t1', 't2', 't3', 't4', 't5'], 5, 5]);
  assert.deepEqual(game.startTest(unit).queue.slice().sort(), ['t1', 't2', 't3', 't4', 't5']);
  assert.equal(game.startTest(makeUnit(), IN_ORDER), null);
});

test('a perfect test', () => {
  const ctx = setup();
  const session = take(ctx, []);
  assert.deepEqual([session.status, game.testScore(session), game.testPassed(session), session.perfect], ['complete', 100, true, true]);
  assert.deepEqual([ctx.save.xp, session.xpEarned, session.hearts], [100, 100, 5]);
  assert.deepEqual([ctx.save.progress.u1.testBest, ctx.save.progress.u1.review, ctx.save.streak], [100, [], 1]);
});

test('answers move on at once, with no requeue and no wait', () => {
  const ctx = setup();
  const session = game.startTest(ctx.unit, IN_ORDER);
  const result = game.submitAnswer(ctx.save, ctx.unit, session, 0, TODAY);
  assert.equal(result.correct, false);
  assert.deepEqual([session.queue, session.awaitingContinue, session.hearts], [['t2', 't3', 't4', 't5'], false, 5]);
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, session, '   ', TODAY), null);
  assert.equal(session.queue.length, 4);
});

test('80 percent passes and 60 does not', () => {
  const pass = setup();
  const passed = take(pass, ['t2']);
  assert.deepEqual([game.testScore(passed), game.testPassed(passed), pass.save.xp, passed.perfect], [80, true, 90, false]);
  assert.deepEqual([pass.save.progress.u1.review, passed.missed, pass.save.progress.u1.testBest], [['t2'], ['t2'], 80]);
  const fail = setup();
  const failed = take(fail, ['t2', 't4']);
  assert.deepEqual([failed.status, game.testScore(failed), game.testPassed(failed), fail.save.xp], ['complete', 60, false, 30]);
  assert.deepEqual([fail.save.progress.u1.testBest, fail.save.streak], [60, 1]);
});

test('the best score is kept, and an old save without one gets it', () => {
  const ctx = setup();
  delete ctx.save.progress.u1.testBest;
  take(ctx, []);
  take(ctx, ['t2', 't3']);
  assert.equal(ctx.save.progress.u1.testBest, 100);
});

test('skip counts as wrong, and only in a test', () => {
  const ctx = setup();
  const session = game.startTest(ctx.unit, IN_ORDER);
  const skipped = game.skipQuestion(ctx.save, ctx.unit, session, TODAY);
  assert.deepEqual([skipped.correct, skipped.question.id], [false, 't1']);
  assert.deepEqual([session.queue.length, session.missed, ctx.save.progress.u1.review], [4, ['t1'], ['t1']]);
  const lesson = game.startLesson(ctx.unit, 'a1');
  assert.equal(game.skipQuestion(ctx.save, ctx.unit, lesson, TODAY), null);
  assert.deepEqual(lesson.queue, ['q1', 'q2']);
});

test('isTestUnlocked', () => {
  const unit = makeRichUnit();
  assert.equal(game.isTestUnlocked(unit, { completedLessons: ['a1', 'a2'], review: [] }), false);
  assert.equal(game.isTestUnlocked(unit, { completedLessons: ['a1', 'a2', 'b1'], review: [] }), true);
  assert.equal(game.isTestUnlocked(makeUnit(), { completedLessons: ['a1', 'a2', 'b1'], review: [] }), false);
});
```

- [ ] **Step 3: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL in the `constants` test and in every new test.

- [ ] **Step 4: Extend `js/game.js`.**
  - `startTest` orders the test question ids with `shuffledOrder(n, rng)` and uses the lesson session shape with `kind: 'test'` and `lessonId: null`.
  - In a test session, `submitAnswer` keeps its v1 guards and then:
    - removes the question from the queue either way and never sets `awaitingContinue`;
    - if right, adds 10 XP and 1 to `firstTryCorrect`;
    - if wrong, adds 1 to `wrongCount` and adds the id to `missed` and to the review pile, once each;
    - never changes `hearts`.
  - When the queue empties, the session becomes `complete`. `perfect` is true with no wrong answers. A passing score adds `XP_TEST_PASS`. `testBest` becomes the higher of the old value and the new score, with a missing or `null` old value counting as lower. Then `applyStreak` runs.
  - `testScore` is `Math.round(100 * firstTryCorrect / total)`. `testPassed` compares it with `TEST_PASS_PERCENT`.
  - `skipQuestion` returns `null` unless the session is an active test. Otherwise it follows the wrong-answer path.
  - `isTestUnlocked` needs a test and every level complete.

- [ ] **Step 5: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 6: Commit.**

```bash
git add js/game.js tests/game-basics.test.js tests/game-test.test.js
git commit -m "feat: final test rules"
```

---

### Task 7: Sounds

**Files:**
- Create: `js/sound.js`
- Test: `tests/sound.test.js`

**Interfaces:**
- Produces:
  - `AQ.sound.names() -> string[]`
  - `AQ.sound.notes(name) -> { frequency, start, duration, type, volume }[] | null`
  - `AQ.sound.play(name, enabled: boolean) -> boolean`, true when the sound was scheduled

- [ ] **Step 1: Write the failing tests in `tests/sound.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const sound = require('../js/sound.js');

const NAMES = ['select', 'correct', 'wrong', 'complete', 'perfect', 'failed', 'submit', 'testPass', 'testFail'];

test('every sound has notes within safe limits', () => {
  assert.deepEqual(sound.names().slice().sort(), NAMES.slice().sort());
  for (const name of NAMES) {
    const notes = sound.notes(name);
    assert.ok(notes.length >= 1, name);
    let end = 0;
    for (const note of notes) {
      assert.ok(note.frequency >= 100 && note.frequency <= 2000, name);
      assert.ok(note.start >= 0 && note.duration >= 0.03 && note.duration <= 0.6, name);
      assert.ok(note.volume > 0 && note.volume <= 0.3, name);
      assert.ok(['sine', 'triangle'].includes(note.type), name);
      end = Math.max(end, note.start + note.duration);
    }
    assert.ok(end <= 1.5, name);
  }
});

test('correct rises and wrong falls', () => {
  const up = sound.notes('correct');
  assert.ok(up[up.length - 1].frequency > up[0].frequency);
  const down = sound.notes('wrong');
  assert.ok(down[down.length - 1].frequency < down[0].frequency);
});

test('no audio, sound off, and unknown names are harmless', () => {
  assert.equal(sound.notes('nope'), null);
  assert.equal(sound.play('correct', true), false);
});

test('with audio, play starts one oscillator per note', () => {
  let started = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  globalThis.AudioContext = class {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createOscillator() { return { type: '', frequency: param(), connect() {}, start() { started += 1; }, stop() {} }; }
    createGain() { return { gain: param(), connect() {} }; }
    resume() {}
  };
  try {
    assert.equal(sound.play('correct', false), false);
    assert.equal(sound.play('nope', true), false);
    assert.equal(started, 0);
    assert.equal(sound.play('correct', true), true);
    assert.equal(started, sound.notes('correct').length);
  } finally {
    delete globalThis.AudioContext;
  }
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL, cannot find module `../js/sound.js`.

- [ ] **Step 3: Implement `js/sound.js`** with these notes. Each entry is frequency in Hz, start in seconds, duration in seconds.

| Name | Type | Volume | Notes |
|---|---|---|---|
| `select` | sine | 0.08 | 660 at 0 for 0.05 |
| `correct` | triangle | 0.2 | 659.25 at 0 for 0.09; 987.77 at 0.09 for 0.16 |
| `wrong` | sine | 0.18 | 220 at 0 for 0.12; 174.61 at 0.12 for 0.2 |
| `complete` | triangle | 0.2 | 523.25 at 0 for 0.1; 659.25 at 0.1 for 0.1; 783.99 at 0.2 for 0.1; 1046.5 at 0.3 for 0.3 |
| `perfect` | triangle | 0.2 | the `complete` notes, then 1318.51 at 0.45 for 0.35 |
| `failed` | sine | 0.18 | 392 at 0 for 0.16; 329.63 at 0.16 for 0.16; 261.63 at 0.32 for 0.3 |
| `submit` | sine | 0.1 | 523.25 at 0 for 0.06 |
| `testPass` | triangle | 0.2 | 392 at 0 for 0.1; 523.25 at 0.1 for 0.1; 659.25 at 0.2 for 0.1; 783.99 at 0.3 for 0.1; 1046.5 at 0.4 for 0.4 |
| `testFail` | sine | 0.16 | 392 at 0 for 0.15; 349.23 at 0.15 for 0.3 |

  - `play` returns false when `enabled` is false, when the name is unknown, or when the global object has neither `AudioContext` nor `webkitAudioContext`. It never throws: any audio error is caught and returns false.
  - It looks up the audio class each time it is called, creates one context on first use, keeps it, and calls `resume()` when the context is suspended.
  - Each note is one oscillator through one gain node. The gain rises from 0 to `volume` in 0.01 s, then decays to 0.001 by the note's end.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add js/sound.js tests/sound.test.js
git commit -m "feat: sounds"
```

---

### Task 8: Views for graphs, teaching cards, and the calculator

**Files:**
- Modify: `js/views.js`, `css/styles.css`
- Test: `tests/views-features.test.js`

**Interfaces:**
- Consumes: `AQ.mathexpr.compile`, `AQ.plot.svg`, a result from `AQ.calc.run`.
- Produces:
  - `AQ.views.graphHtml(graph, label: string) -> string`, where `graph` is a unit file graph object. Returns `''` when `fn` does not compile.
  - `AQ.views.teachHtml({ title, text, example, graph, index, total, fromNotes }) -> string`
  - `AQ.views.calculatorHtml({ text, result, error }) -> string`. `result` is the last number or graph result or `null`. `error` is a message or `null`.
  - `AQ.views.lessonHtml` reads four more optional fields: `graph`, `calculatorAllowed`, `calculatorPanel` (a `calculatorHtml` model or `null`), and `hasNotes`.

- [ ] **Step 1: Write the failing tests in `tests/views-features.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const views = require('../js/views.js');
const calc = require('../js/calc.js');

const tag = (html, marker) => html.match(new RegExp('<[a-z]+[^>]*' + marker + '[^>]*>'))[0];
const has = (html, action) => html.includes('data-action="' + action + '"');
const typed = extra => Object.assign({
  done: 1, total: 6, hearts: 3, maxHearts: 5, prompt: 'Solve it', type: 'input',
  choices: null, selected: null, hint: 'A hint', hintVisible: false
}, extra);

test('graphHtml', () => {
  const sketch = views.graphHtml({ fn: 'x^2 - 4', x: [-5, 5], y: [-6, 6], numbers: false }, 'Graph for this question');
  assert.match(sketch, /^<figure class="graph"/);
  assert.match(sketch, /<svg/);
  assert.match(sketch, /aria-label="Graph for this question"/);
  assert.doesNotMatch(sketch, /<text/);
  assert.doesNotMatch(sketch, /x\^2/);
  assert.match(views.graphHtml({ fn: 'x' }, 'G'), /<text/);
  assert.equal(views.graphHtml({ fn: '(x' }, 'G'), '');
});

test('lessonHtml: graph under the prompt', () => {
  assert.match(views.lessonHtml(typed({ graph: { fn: 'x^2' } })), /<figure class="graph"/);
  assert.doesNotMatch(views.lessonHtml(typed()), /<figure/);
});

test('lessonHtml: calculator button, note, and panel', () => {
  const closed = views.lessonHtml(typed({ calculatorAllowed: true, calculatorPanel: null }));
  assert.equal(has(closed, 'calc-open'), true);
  assert.doesNotMatch(closed, /data-role="calc-input"/);
  const off = views.lessonHtml(typed({ calculatorAllowed: false, calculatorPanel: { text: '2', result: null, error: null } }));
  assert.equal(has(off, 'calc-open'), false);
  assert.doesNotMatch(off, /data-role="calc-input"/);
  assert.match(off, /No calculator for this question\./);
  const open = views.lessonHtml(typed({ calculatorAllowed: true, calculatorPanel: { text: '2 < 3', result: { kind: 'number', display: '= 4' }, error: null } }));
  assert.match(tag(open, 'data-role="calc-input"'), /value="2 &lt; 3"/);
  assert.match(open, /= 4/);
  for (const action of ['calc-run', 'calc-close']) assert.equal(has(open, action), true);
  assert.equal(has(open, 'calc-open'), false);
  const locked = views.lessonHtml(typed({ locked: true, calculatorAllowed: true, calculatorPanel: null, hasNotes: true }));
  assert.equal(has(locked, 'calc-open') || has(locked, 'notes'), false);
});

test('calculatorHtml: graph result, error, and empty', () => {
  const graph = views.calculatorHtml({ text: 'x^2 - 4', result: calc.run('x^2 - 4', calc.DEFAULT_WINDOW), error: null });
  assert.match(graph, /<svg/);
  assert.match(graph, /class="plot-mark plot-mark-zero"/);
  assert.match(graph, /Zeros: x = -2, 2/);
  assert.match(graph, /Turning points: min \(0, -4\)/);
  for (const action of ['calc-zoom-in', 'calc-zoom-out', 'calc-reset']) assert.equal(has(graph, action), true);
  const both = views.calculatorHtml({ text: '(2', result: { kind: 'number', display: '= 4' }, error: 'A closing parenthesis is missing.' });
  assert.match(both, /class="calc-error"[^>]*>A closing parenthesis is missing\./);
  assert.match(both, /= 4/);
  const empty = views.calculatorHtml({ text: '', result: null, error: null });
  assert.doesNotMatch(empty, /calc-error|<svg/);
  assert.equal(has(empty, 'calc-zoom-in'), false);
});

test('lessonHtml: Notes button', () => {
  assert.equal(has(views.lessonHtml(typed({ hasNotes: true })), 'notes'), true);
  assert.equal(has(views.lessonHtml(typed()), 'notes'), false);
});

test('teachHtml', () => {
  const card = { title: 'Card <1>', text: ['a < b', 'second'], example: { problem: 'Solve x + 1 = 3', steps: ['Subtract 1.', 'x = 2'] }, graph: { fn: 'x^2' } };
  const first = views.teachHtml(Object.assign({ index: 0, total: 2, fromNotes: false }, card));
  assert.match(first, /Card &lt;1&gt;/);
  assert.match(first, /a &lt; b/);
  assert.match(first, /1 of 2/);
  assert.equal(first.match(/<li/g).length, 2);
  assert.match(first, /<figure class="graph"/);
  assert.match(tag(first, 'data-action="teach-back"'), /disabled/);
  assert.match(first, /data-action="teach-next"[^>]*>Next</);
  assert.match(first, /data-action="teach-skip"[^>]*>Skip to questions</);
  const last = views.teachHtml({ title: 'T', text: ['p'], index: 1, total: 2, fromNotes: false });
  assert.doesNotMatch(last, /<ol|<figure/);
  assert.doesNotMatch(tag(last, 'data-action="teach-back"'), /disabled/);
  assert.match(last, /data-action="teach-next"[^>]*>Start practice</);
  const notes = views.teachHtml({ title: 'T', text: ['p'], index: 1, total: 2, fromNotes: true });
  assert.match(notes, /data-action="teach-next"[^>]*>Back to question</);
  assert.match(notes, /data-action="teach-skip"[^>]*>Back to question</);
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL in the new tests.

- [ ] **Step 3: Extend `js/views.js`.** Under Node it also requires `./mathexpr.js`, `./plot.js`, and `./calc.js`.
  - `graphHtml` fills in the window defaults (`[-10, 10]` and `numbers: true`) and wraps the SVG in `<figure class="graph">`. It passes no marks.
  - In `lessonHtml`, the graph goes right after the prompt with the label `Graph for this question`.
  - `calculatorAllowed === true` with no panel shows a `calc-open` button labeled `Calculator`. `calculatorAllowed === false` shows the line `No calculator for this question.` and never the panel. A missing value shows neither.
  - A locked lesson shows no calculator button, no panel, and no Notes button.
  - `calculatorHtml` draws a graph result with `numbers: true`, one mark per zero (`y: 0`) and per turning point, and the label `Graph of y = <text>`. It puts the two text lines under the graph, then the three zoom buttons. The error line has class `calc-error`. The input is `<input type="text" data-role="calc-input">`.
  - `teachHtml` shows the title, each paragraph, the example as its problem plus an `<ol>` of steps, the graph with the label `Graph for this card`, and `<index + 1> of <total>`. The Back button is disabled on the first card.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Add styles to `css/styles.css`** for `.graph`, the `plot-*` classes, the teaching card, and the calculator panel. The graph is at most 360px wide and scales down. Curve color is the accent, zeros are the accent, max is the correct color, and min is the wrong color.

- [ ] **Step 6: Commit.**

```bash
git add js/views.js css/styles.css tests/views-features.test.js
git commit -m "feat: views for graphs, teaching cards, and the calculator"
```

---

### Task 9: Views for the final test, the home entry, and the sound button

**Files:**
- Modify: `js/views.js`, `css/styles.css`, `tests/views-home.test.js`
- Test: `tests/views-test.test.js`

**Interfaces:**
- Consumes: `AQ.game.isTestUnlocked`, `AQ.units.testQuestions`.
- Produces:
  - `AQ.views.homeModel(save)` gains `test: null | { state: 'locked' | 'open', best: number | null }` and `soundOn: boolean`.
  - `AQ.views.lessonHtml` reads `mode: 'lesson' | 'test'`, default `'lesson'`.
  - `AQ.views.testResultHtml({ score, passed, xpEarned, missed: { prompt, solution }[] }) -> string`

- [ ] **Step 1: Update `tests/views-home.test.js`.** In both `homeModel` expectations, add `test: null, soundOn: true`.

- [ ] **Step 2: Write the failing tests in `tests/views-test.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const views = require('../js/views.js');
const storage = require('../js/storage.js');
const { makeRichUnit, makeSave } = require('./fixtures.js');

const tag = (html, marker) => html.match(new RegExp('<[a-z]+[^>]*' + marker + '[^>]*>'))[0];
const has = (html, action) => html.includes('data-action="' + action + '"');
function richSave(change) {
  const save = makeSave(makeRichUnit());
  if (change) change(save);
  return save;
}

test('homeModel: test entry and sound', () => {
  assert.deepEqual(views.homeModel(richSave()).test, { state: 'locked', best: null });
  const done = richSave(save => { save.progress.u1.completedLessons = ['a1', 'a2', 'b1']; save.progress.u1.testBest = 85; });
  assert.deepEqual(views.homeModel(done).test, { state: 'open', best: 85 });
  assert.equal(views.homeModel(richSave()).soundOn, true);
  assert.equal(views.homeModel(richSave(save => { save.settings.sound = false; })).soundOn, false);
  assert.equal(views.homeModel(storage.newSave()).test, null);
});

test('homeHtml: final test entry', () => {
  const locked = views.homeHtml(views.homeModel(richSave()));
  assert.match(locked, /Final test/);
  assert.match(locked, /Not taken yet/);
  assert.match(tag(locked, 'data-action="start-test"'), /disabled/);
  const open = views.homeHtml(views.homeModel(richSave(save => { save.progress.u1.completedLessons = ['a1', 'a2', 'b1']; save.progress.u1.testBest = 85; })));
  assert.doesNotMatch(tag(open, 'data-action="start-test"'), /disabled/);
  assert.match(open, /Best: 85%/);
});

test('homeHtml: sound button, with and without units', () => {
  assert.match(views.homeHtml(views.homeModel(richSave())), /data-action="toggle-sound"[^>]*>Sound: on</);
  assert.match(views.homeHtml(views.homeModel(richSave(save => { save.settings.sound = false; }))), /data-action="toggle-sound"[^>]*>Sound: off</);
  const empty = views.homeHtml(views.homeModel(storage.newSave()));
  assert.equal(has(empty, 'toggle-sound'), true);
  assert.equal(has(empty, 'start-test'), false);
});

test('lessonHtml: test mode shows no hearts, hint, or Notes', () => {
  const html = views.lessonHtml({
    mode: 'test', done: 2, total: 20, hearts: 5, maxHearts: 5, prompt: 'Solve it', type: 'input',
    choices: null, selected: null, hint: 'SECRET HINT', hintVisible: true, hasNotes: true, calculatorAllowed: true, calculatorPanel: null
  });
  assert.match(html, /Question 3 of 20/);
  assert.doesNotMatch(html, /hearts|SECRET HINT/);
  assert.equal(has(html, 'hint') || has(html, 'notes'), false);
  assert.match(html, /data-action="check"[^>]*>Submit</);
  for (const action of ['skip', 'quit', 'calc-open']) assert.equal(has(html, action), true);
});

test('testResultHtml', () => {
  const passed = views.testResultHtml({ score: 85, passed: true, xpEarned: 220, missed: [{ prompt: 'a < b', solution: 'c & d' }] });
  assert.match(passed, /85%/);
  assert.match(passed, /Passed/);
  assert.match(passed, /\+220 XP/);
  assert.match(passed, /a &lt; b/);
  assert.match(passed, /c &amp; d/);
  for (const action of ['retry', 'home']) assert.equal(has(passed, action), true);
  const failed = views.testResultHtml({ score: 60, passed: false, xpEarned: 120, missed: [] });
  assert.match(failed, /Not passed yet\. You need 80%\./);
  assert.doesNotMatch(failed, /Passed/);
  assert.match(views.testResultHtml({ score: 100, passed: true, xpEarned: 250, missed: [] }), /You got every question right\./);
});
```

- [ ] **Step 3: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL in the updated `homeModel` test and in the new tests.

- [ ] **Step 4: Extend `js/views.js`.**
  - `homeModel.test` is `null` when the current unit has no test or there is no unit. `best` comes from `testBest`.
  - On the home screen the test entry comes after the last level: the title `Final test`, then `Best: <n>%` or `Not taken yet`, then a `start-test` button labeled `Start test`, disabled while locked.
  - The `toggle-sound` button sits in the footer next to Import and Backup, on both forms of the home screen.
  - In test mode the lesson screen replaces the hearts and progress bar with `Question <done + 1> of <total>`, labels the `check` button `Submit`, adds a `skip` button labeled `Skip`, and shows no hint, no Hint button, and no Notes button.
  - The pass line of `testResultHtml` reads `Passed`. The 80 comes from `TEST_PASS_PERCENT`. With nothing missed and a pass, it adds `You got every question right.`

- [ ] **Step 5: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 6: Add styles** for the test entry and the result screen, then commit.

```bash
git add js/views.js css/styles.css tests/views-home.test.js tests/views-test.test.js
git commit -m "feat: views for the final test and the sound button"
```

---

### Task 10: Wiring for teaching cards, Notes, graphs, and the calculator

**Files:**
- Create: `tests/fake-page.js`
- Modify: `js/ui.js`, `index.html`, `tests/ui.test.js`
- Test: `tests/ui-features.test.js`

**Interfaces:**
- Consumes: Tasks 3, 4, and 8.
- Produces:
  - `tests/fake-page.js` exports `makeEnv(stored, options) -> { ls, answerBox, calcBox, confirms, click, key, html }`.
  - New actions in `ui.js`: `teach-next`, `teach-back`, `teach-skip`, `notes`, `calc-open`, `calc-close`, `calc-run`, `calc-zoom-in`, `calc-zoom-out`, `calc-reset`.
  - New screen: `teach`.

- [ ] **Step 1: Move `makeEnv` from `tests/ui.test.js` into `tests/fake-page.js`** and require it from `tests/ui.test.js`. Extend it:
  - `calcBox` is a second fake input, returned when the selector includes `data-role="calc-input"` and the page HTML has that input.
  - `confirms` is the list of every `confirm` message. `options.confirm` sets the answer, default `true`.
  - The fake `document.addEventListener` keeps the `keydown` handler. `key(name, role)` calls it with `{ key: name, repeat: false, preventDefault() {}, target: { getAttribute: attr => (attr === 'data-role' ? role : null) } }`.

  Run: `node --test "tests/*.test.js"`. Expected: all tests still pass.

- [ ] **Step 2: Write the failing tests in `tests/ui-features.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const { makeEnv } = require('./fake-page.js');
const { makeRichUnit, makeSave } = require('./fixtures.js');

const tag = (html, marker) => html.match(new RegExp('<[a-z]+[^>]*' + marker + '[^>]*>'))[0];
const open = () => makeEnv(storage.serialize(makeSave(makeRichUnit())));
const start = (env, lessonId) => env.click('start-lesson', { 'data-lesson-id': lessonId });

test('teaching cards come first, then the questions', () => {
  const env = open();
  start(env, 'a1');
  assert.match(env.html(), /Card one/);
  assert.match(env.html(), /1 of 2/);
  env.click('teach-next');
  assert.match(env.html(), /Card two/);
  env.click('teach-back');
  assert.match(env.html(), /Card one/);
  env.click('teach-next');
  env.click('teach-next');
  assert.match(env.html(), /P q1/);
});

test('skip goes to the first question, and a lesson without cards starts there', () => {
  const env = open();
  start(env, 'a1');
  env.click('teach-skip');
  assert.match(env.html(), /P q1/);
  const plain = open();
  start(plain, 'a2');
  assert.match(plain.html(), /P q3/);
  assert.match(plain.html(), /<figure class="graph"/);
});

test('Notes returns to the same question with nothing lost', () => {
  const env = open();
  start(env, 'a1');
  env.click('teach-skip');
  env.click('choose', { 'data-index': '1' });
  env.click('notes');
  assert.match(env.html(), /Card one/);
  env.click('teach-next');
  env.click('teach-next');
  assert.match(env.html(), /P q1/);
  assert.match(tag(env.html(), 'data-index="1"'), /aria-pressed="true"/);
  env.click('check');
  env.click('continue');
  env.answerBox.value = 'x = 7';
  env.click('notes');
  env.click('teach-skip');
  assert.match(tag(env.html(), 'data-role="answer"'), /value="x = 7"/);
});

test('calculator: number, graph, zoom, error, and it stays open on the next question', () => {
  const env = open();
  start(env, 'a1');
  env.click('teach-skip');
  env.click('calc-open');
  env.calcBox.value = '2/3 + 1/4';
  env.click('calc-run');
  assert.match(env.html(), /11\/12 ≈ 0\.9166666667/);
  env.calcBox.value = 'x^2 - 4';
  env.click('calc-run');
  assert.match(env.html(), /Zeros: x = -2, 2/);
  for (let i = 0; i < 4; i++) env.click('calc-zoom-in');
  assert.match(env.html(), /Zeros: none in this window/);
  env.click('calc-zoom-out');
  assert.match(env.html(), /Zeros: none in this window/);
  env.click('calc-reset');
  assert.match(env.html(), /Zeros: x = -2, 2/);
  env.calcBox.value = '(2';
  env.click('calc-run');
  assert.match(env.html(), /A closing parenthesis is missing\./);
  assert.match(env.html(), /Zeros: x = -2, 2/);
  assert.match(tag(env.html(), 'data-role="calc-input"'), /value="\(2"/);
  env.click('choose', { 'data-index': '1' });
  env.click('check');
  env.click('continue');
  assert.match(env.html(), /P q2/);
  assert.match(env.html(), /data-role="calc-input"/);
  env.click('calc-close');
  assert.doesNotMatch(env.html(), /data-role="calc-input"/);
});

test('opening the calculator keeps the typed answer, and Enter in it does not check', () => {
  const env = open();
  start(env, 'a2');
  env.answerBox.value = '0.25';
  env.click('calc-open');
  assert.match(tag(env.html(), 'data-role="answer"'), /value="0\.25"/);
  env.calcBox.value = '6 * 7';
  env.key('Enter', 'calc-input');
  assert.match(env.html(), /= 42/);
  assert.doesNotMatch(env.html(), /Correct!|Not quite/);
  env.click('hint');
  assert.match(tag(env.html(), 'data-role="calc-input"'), /value="6 \* 7"/);
  assert.match(tag(env.html(), 'data-role="answer"'), /value="0\.25"/);
});

test('a no-calculator question hides an open calculator', () => {
  const env = open();
  start(env, 'a2');
  env.click('calc-open');
  env.click('home');
  start(env, 'b1');
  assert.match(env.html(), /No calculator for this question\./);
  assert.doesNotMatch(env.html(), /data-role="calc-input"/);
});
```

- [ ] **Step 3: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL in the new tests.

- [ ] **Step 4: Extend `js/ui.js`** and add the new script tags to `index.html` in the Global Constraints order.
  - State gains `teach: null | { index, fromNotes }` and `calc: { open, text, result, error, window }`. The calculator state lasts until the app closes; starting a lesson does not reset it.
  - Before any redraw of the lesson screen, read both the answer box and the calculator box into state.
  - `start-lesson` opens the `teach` screen at card 0 when the lesson has cards. Review sessions never do.
  - `teach-next` on the last card, and `teach-skip`, go to the first question, or back to the current question when `fromNotes` is true. Going back changes no lesson state.
  - `notes` is offered only in a lesson session whose lesson has cards.
  - The lesson model passes `graph` from the question, `calculatorAllowed` as `question.calculator !== false`, and `calculatorPanel` when the calculator is open and allowed.
  - `calc-run` calls `AQ.calc.run(text, window)`. An error result sets `error` and keeps `result`. Any other result replaces `result` and clears `error`.
  - The zoom actions change `window` with `AQ.calc.zoom` by 0.5 or 2, or reset it to the default, and then re-run the last text that gave a graph result.
  - Enter in the calculator box runs `calc-run`. It must not reach the answer check.

- [ ] **Step 5: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 6: Commit.**

```bash
git add js/ui.js index.html tests/fake-page.js tests/ui.test.js tests/ui-features.test.js
git commit -m "feat: teaching cards, Notes, graphs, and the calculator in lessons"
```

---

### Task 11: Wiring for the final test and sounds

**Files:**
- Modify: `js/ui.js`
- Test: `tests/ui-test-mode.test.js`

**Interfaces:**
- Consumes: Tasks 6, 7, 9, and 10.
- Produces: actions `start-test`, `skip`, and `toggle-sound`; screen `test-result`; every sound from spec section 15 played through `AQ.sound.play(name, save.settings.sound)`.

- [ ] **Step 1: Write the failing tests in `tests/ui-test-mode.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const { makeEnv } = require('./fake-page.js');
const { makeRichUnit, makeSave } = require('./fixtures.js');

const KEY = 'algebraQuest.v1';
const RIGHT = { t1: 1, t2: '2', t3: '3', t4: '4', t5: '5' };
function ready(change, options) {
  const save = makeSave(makeRichUnit());
  save.progress.u1.completedLessons = ['a1', 'a2', 'b1'];
  if (change) change(save);
  const env = makeEnv(storage.serialize(save), options);
  env.played = [];
  globalThis.AQ.sound.play = (name, enabled) => { env.played.push([name, enabled]); return true; };
  return env;
}
const stored = env => JSON.parse(env.ls.data[KEY]);
const shown = env => env.html().match(/T (t\d)/)[1];
function answer(env, right) {
  const id = shown(env);
  if (id === 't1') env.click('choose', { 'data-index': right ? '1' : '0' });
  else env.answerBox.value = right ? RIGHT[id] : '99';
  env.click('check');
  return id;
}

test('a locked test does not start', () => {
  const env = ready(save => { save.progress.u1.completedLessons = []; });
  env.click('start-test');
  assert.match(env.html(), /Final test/);
  assert.doesNotMatch(env.html(), /Question 1 of 5/);
});

test('the test gives no feedback and ends on the result screen', () => {
  const env = ready();
  env.click('start-test');
  for (let n = 1; n <= 5; n++) {
    assert.match(env.html(), new RegExp('Question ' + n + ' of 5'));
    assert.doesNotMatch(env.html(), /Correct!|Not quite|H t\d|S t\d/);
    answer(env, true);
  }
  assert.match(env.html(), /100%/);
  assert.match(env.html(), /Passed/);
  assert.deepEqual([stored(env).xp, stored(env).progress.u1.testBest], [100, 100]);
  env.click('home');
  assert.match(env.html(), /Best: 100%/);
});

test('skip counts as wrong, the result lists it, and retake starts over', () => {
  const env = ready();
  env.click('start-test');
  const skipped = shown(env);
  env.click('skip');
  for (let n = 0; n < 4; n++) answer(env, true);
  assert.match(env.html(), /80%/);
  assert.match(env.html(), new RegExp('S ' + skipped));
  assert.deepEqual(stored(env).progress.u1.review, [skipped]);
  env.click('retry');
  assert.match(env.html(), /Question 1 of 5/);
});

test('quitting the test asks with its own wording', () => {
  const env = ready(null, { confirm: false });
  env.click('start-test');
  env.click('quit');
  assert.deepEqual(env.confirms, ['Quit the test? You will have to start it again.']);
  assert.match(env.html(), /Question 1 of 5/);
});

test('lesson sounds', () => {
  const env = ready();
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  env.answerBox.value = '99';
  env.click('check');
  env.click('continue');
  env.answerBox.value = '0.5';
  env.click('check');
  env.click('continue');
  assert.deepEqual(env.played.map(p => p[0]), ['wrong', 'correct', 'complete']);
  env.played.length = 0;
  env.click('home');
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  env.answerBox.value = '0.5';
  env.click('check');
  env.click('continue');
  assert.deepEqual(env.played.map(p => p[0]), ['correct', 'perfect']);
});

test('picking a choice plays select, and running out of hearts plays failed', () => {
  const env = ready();
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  for (let n = 0; n < 5; n++) { env.answerBox.value = '99'; env.click('check'); env.click('continue'); }
  assert.equal(env.played[env.played.length - 1][0], 'failed');
  env.played.length = 0;
  env.click('home');
  env.click('start-lesson', { 'data-lesson-id': 'a1' });
  env.click('teach-skip');
  env.click('choose', { 'data-index': '0' });
  assert.deepEqual(env.played.map(p => p[0]), ['select']);
});

test('the test plays only submit until it ends', () => {
  const env = ready();
  env.click('start-test');
  let sawChoice = false;
  for (let n = 0; n < 5; n++) { sawChoice = shown(env) === 't1' || sawChoice; answer(env, n !== 0); }
  const names = env.played.map(p => p[0]).filter(name => name !== 'select');
  assert.deepEqual(names, ['submit', 'submit', 'submit', 'submit', 'submit', 'testPass']);
  assert.equal(sawChoice, true);
  const failing = ready();
  failing.click('start-test');
  for (let n = 0; n < 5; n++) failing.click('skip');
  assert.equal(failing.played[failing.played.length - 1][0], 'testFail');
});

test('the sound button saves the setting, and off is passed to play', () => {
  const env = ready();
  env.click('toggle-sound');
  assert.equal(stored(env).settings.sound, false);
  assert.match(env.html(), /Sound: off/);
  env.click('start-lesson', { 'data-lesson-id': 'a2' });
  env.answerBox.value = '0.5';
  env.click('check');
  assert.deepEqual(env.played[env.played.length - 1], ['correct', false]);
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL in the new tests.

- [ ] **Step 3: Extend `js/ui.js`.**
  - `start-test` does nothing unless `AQ.game.isTestUnlocked` is true. It starts a test session and shows the first question in test mode. It never shows teaching cards.
  - In a test, `check` calls `submitAnswer`, saves, and goes straight to the next question or to the `test-result` screen. There is no feedback screen.
  - `skip` calls `skipQuestion` and then does the same.
  - The result screen gets `score`, `passed`, `xpEarned`, and the missed questions' prompts and solutions.
  - `retry` on the result screen starts a new test. `quit` in a test asks `Quit the test? You will have to start it again.`
  - Enter in the answer box submits in a test, as in a lesson.
  - Sounds, each as `AQ.sound.play(name, state.save.settings.sound)`, looked up on `AQ.sound` at the moment of the call:
    - `select` when a choice is picked, in any session;
    - `correct` or `wrong` when a lesson or review answer is checked;
    - `complete` or `perfect` when a lesson or review reaches its complete screen, and `failed` when it reaches the out-of-hearts screen;
    - `submit` for each test answer or skip, then `testPass` or `testFail` on the result screen. A test never plays `correct` or `wrong`.
  - `toggle-sound` flips `settings.sound` on a copy of the save, saves it, and redraws home.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add js/ui.js tests/ui-test-mode.test.js
git commit -m "feat: final test and sounds in the app"
```

---

### Task 12: Sample unit, validator output, docs, and checks

**Files:**
- Modify: `units/sample-unit.json`, `tools/validate-unit.js`, `tests/units.test.js`, `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Update `tests/units.test.js`.**
  - In the sample unit test, also assert that every lesson has 1 to 3 `teach` cards and that each card has an `example`; that `sample.test.questions` has 5 questions; that at least one test question has a `graph`; and that at least one has `calculator: false`.
  - In the CLI test, expect `/^OK: .+ \(2 levels, 4 lessons, 24 questions, final test: 5 questions\)/`.

  Run: `node --test "tests/*.test.js"`. Expected: FAIL in those two tests.

- [ ] **Step 2: Update `tools/validate-unit.js`.** It counts lesson questions as before and adds `, final test: <n> questions` inside the parentheses when the unit has a test.

- [ ] **Step 3: Extend `units/sample-unit.json`.**
  - Give each of the 4 lessons 1 or 2 teaching cards with a worked example. Cover: undoing addition and subtraction; undoing multiplication and division; the order of steps in a two-step equation; negatives and fractions in two-step equations.
  - Add a 5-question `test` with new problems. One is a choice question with a `graph` of a line, asking where it crosses the x-axis, with `"calculator": false`. The others are typed.
  - Solve every new problem by hand before saving.

  Run: `node --test "tests/*.test.js"`. Expected: all tests pass. Run: `node tools/validate-unit.js units/sample-unit.json`. Expected: the `OK:` line with `final test: 5 questions`.

- [ ] **Step 4: Update the docs.**
  - `CLAUDE.md`: add the authoring rules from spec section 14, and the unit file fields `teach`, `graph`, `calculator`, and `test` with one example of each.
  - `README.md`: add teaching cards, the calculator (with what it accepts), the final test rules, and the sound button to "How it works".

- [ ] **Step 5: Check in a browser.** Serve the folder with the preview server and confirm, with no console errors:
  1. A lesson opens on its teaching cards, and Notes returns to the same question.
  2. The calculator gives `11/12 ≈ 0.9166666667` for `2/3 + 1/4` and draws `x^3 - 6x^2 + 7x + 2` with marks at its zeros and turning points.
  3. Zoom in, zoom out, and reset redraw the graph.
  4. The final test is locked until every lesson is done, runs with no feedback, and shows the result screen.
  5. The graph question draws its line, and the no-calculator question hides the calculator.
  6. The layout holds at 360px wide.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat: sample unit, validator, and docs for the lesson features"
```

- [ ] **Step 7: Human check, after the final review and its fixes.** Ask the user to open the app from the pinned icon, re-import `units\sample-unit.json`, and confirm:
  1. Their old progress is still there.
  2. A lesson teaches first, and the sounds play.
  3. The calculator works for a number and for a graph.
  4. The final test unlocks after the last lesson and shows a score.
  5. The Sound button turns the sounds off.
