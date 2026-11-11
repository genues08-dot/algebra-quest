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

test('poles are not zeros or turning points', () => {
  assert.deepEqual(plot.features(f('1/(x - 0.03)'), W), { zeros: [], turningPoints: [] });
  assert.deepEqual(plot.features(f('1/(x - 0.03)^2'), W), { zeros: [], turningPoints: [] });
});
