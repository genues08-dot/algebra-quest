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

test('the variable can be on the right side', () => {
  assert.equal(checker.normalize('12 = x'), '12');
  assert.equal(checker.isCorrect('12 = x', ['12']), true);
  assert.equal(checker.isCorrect('6=X', ['6']), true);
});

test('mixed numbers are read as one value', () => {
  assert.equal(checker.isCorrect('2 1/2', ['5/2']), true);
  assert.equal(checker.isCorrect('x = 2 1/2', ['2.5']), true);
  assert.equal(checker.isCorrect('-2 1/2', ['-5/2']), true);
  assert.equal(checker.isCorrect('2 1/2', ['21/2']), false);
  assert.equal(checker.isCorrect('21/2', ['21/2']), true);
});

test('several solutions match in any order and in common forms', () => {
  const key = ['3,-3'];
  for (const typed of ['3, -3', '-3, 3', 'x = 3, x = -3', '3 or -3', 'x = -3 or x = 3', '3 and -3', '-3;3', '±3', 'x = ±3', '+-3']) {
    assert.equal(checker.isCorrect(typed, key), true, typed);
  }
  for (const typed of ['3', '3, 3', '3, -3, 1', '3, 4', '']) {
    assert.equal(checker.isCorrect(typed, key), false, typed);
  }
  assert.equal(checker.isCorrect('1/2, -2', ['-2, 0.5']), true);
});

test('inequality signs can be typed with two keys', () => {
  assert.equal(checker.isCorrect('x <= 5', ['x ≤ 5']), true);
  assert.equal(checker.isCorrect('x >= -2', ['x≥-2']), true);
  assert.equal(checker.isCorrect('x < 2 or x > 5', ['x > 5 or x < 2']), true);
  assert.equal(checker.isCorrect('x < 5', ['x ≤ 5']), false);
});

test('ordered pairs are not reordered', () => {
  assert.equal(checker.isCorrect('(3, -2)', ['(3,-2)']), true);
  assert.equal(checker.isCorrect('(-2, 3)', ['(3,-2)']), false);
});

test('isBlank is true for separators with nothing between them', () => {
  for (const blank of [',', ' , ; ', 'x = ,']) assert.equal(checker.isBlank(blank), true, blank);
  assert.equal(checker.isBlank('3,'), false);
});
