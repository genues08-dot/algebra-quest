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
  const equation = 'The calculator can\'t solve equations. Type one side, like x^2 - 4, to graph it.';
  assert.equal(error('x^2 = 4'), equation);
  assert.equal(error('3x - 7 = 11'), equation);
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
