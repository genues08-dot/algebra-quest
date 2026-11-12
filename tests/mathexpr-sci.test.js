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

test('float residue from degree trig does not reach later steps', () => {
  assert.equal(value('sin(30)', 0, DEG), 0.5);
  assert.equal(value('tan(45)', 0, DEG), 1);
  assert.equal(value('asin(2sin(30))', 0, DEG), 90);
  assert.equal(value('acos(2cos(60))', 0, DEG), 0);
  assert.equal(value('asin(sqrt(2)/2*sqrt(2))', 0, DEG), 90);
  assert.equal(value('Ans!', 0, { angle: 'deg', ans: value('tan(45)', 0, DEG) }), 1);
  assert.equal(value('(sqrt(2)^2)!'), 2);
  assert.ok(Number.isNaN(value('3.5!')));
  assert.ok(Number.isNaN(value('asin(1.1)')));
  assert.ok(Number.isNaN(value('asin(1.1)', 0, DEG)));
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
  assert.equal(value('3!!'), 720);
  assert.equal(value('2!!!'), 2);
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
