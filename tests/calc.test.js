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
