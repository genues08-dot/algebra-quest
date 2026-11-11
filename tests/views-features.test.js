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
