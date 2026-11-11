const test = require('node:test');
const assert = require('node:assert/strict');
const checker = require('../js/checker.js');

test('normalize', () => {
  assert.equal(checker.normalize('  X = 4 '), '4');
  assert.equal(checker.normalize('x=4'), '4');
  assert.equal(checker.normalize('−3'), '-3');
  assert.equal(checker.normalize('y = 2x + 1'), '2x+1');
  assert.equal(checker.normalize('3, -3'), '3,-3');
});

test('parseNumber', () => {
  assert.equal(checker.parseNumber('4'), 4);
  assert.equal(checker.parseNumber('-4.50'), -4.5);
  assert.equal(checker.parseNumber('.5'), 0.5);
  assert.equal(checker.parseNumber('-3/4'), -0.75);
  for (const bad of ['', '1/0', '2x', '1/2/3', '--4', '4/']) assert.equal(checker.parseNumber(bad), null);
});

test('isCorrect: numbers match by value', () => {
  assert.equal(checker.isCorrect('0.5', ['1/2']), true);
  assert.equal(checker.isCorrect('4.0', ['4']), true);
  assert.equal(checker.isCorrect('-1/2', ['-0.5']), true);
  assert.equal(checker.isCorrect(' x = 7 ', ['7']), true);
  assert.equal(checker.isCorrect('8', ['7']), false);
  assert.equal(checker.isCorrect('0.333', ['1/3']), false);
});

test('isCorrect: other answers match by normalized text', () => {
  assert.equal(checker.isCorrect('3, -3', ['3,-3', '-3,3']), true);
  assert.equal(checker.isCorrect('-3,3', ['3,-3', '-3,3']), true);
  assert.equal(checker.isCorrect('2X + 1', ['2x+1']), true);
  assert.equal(checker.isCorrect('2x-1', ['2x+1']), false);
});

test('isCorrect: junk never matches and never throws', () => {
  for (const junk of ['', '   ', '1/0', '--4', 'x=', '4/', 'abc']) assert.equal(checker.isCorrect(junk, ['4']), false);
});

test('isBlank', () => {
  for (const blank of ['', '   ', 'x =']) assert.equal(checker.isBlank(blank), true);
  assert.equal(checker.isBlank('0'), false);
});
