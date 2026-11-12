const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../js/calc.js');

const W = calc.DEFAULT_WINDOW;
const DEG = { angle: 'deg' };
const UNDEFINED = { kind: 'error', message: 'That is undefined, like dividing by zero.' };

test('options reach the reader', () => {
  assert.equal(calc.run('sin(30)', W, DEG).display, '1/2 = 0.5');
  assert.equal(calc.run('sin(pi/6)', W).display, '1/2 = 0.5');
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

test('small results keep their value, and float noise is zero', () => {
  const small = [
    ['1.6×10^(-19)', 1.6e-19],
    ['6.626×10^(-34)', 6.626e-34],
    ['(3×10^(-8))×(2×10^(-7))', 6e-15],
    ['9.11×10^(-31)×2', 1.822e-30]
  ];
  for (const [text, expected] of small) {
    const result = calc.run(text, W);
    assert.notEqual(result.value, 0, text);
    assert.equal(Number(result.value.toPrecision(10)), expected, text);
  }
  const noise = [['sin(pi)'], ['cos(pi/2)'], ['0.1+0.2-0.3'], ['sin(30)-0.5', DEG]];
  for (const [text, options] of noise) {
    const result = calc.run(text, W, options);
    assert.deepEqual([result.display, result.value], ['= 0', 0], text);
  }
});

test('very big and very small numbers show as ×10^, which reads back as the same value', () => {
  const shown = [
    ['25!', '1.551121004×10^25'],
    ['6.02×10^(23)', '6.02×10^23'],
    ['-6.02×10^(23)', '-6.02×10^23'],
    ['1.6×10^(-19)', '1.6×10^-19']
  ];
  for (const [text, display] of shown) {
    const result = calc.run(text, W);
    assert.equal(result.display, '= ' + display, text);
    const again = calc.run(display, W);
    assert.equal(again.value.toPrecision(10), result.value.toPrecision(10), display);
    assert.equal(again.display, result.display, display);
  }
});

test('undefined results', () => {
  for (const text of ['asin(2)', '3.5!', 'root(2, -4)', '171!']) assert.deepEqual(calc.run(text, W), UNDEFINED, text);
  assert.deepEqual(calc.run('tan(90)', W, DEG), UNDEFINED);
});

test('radian poles are undefined', () => {
  assert.deepEqual(calc.run('tan(pi/2)', W), UNDEFINED);
  assert.deepEqual(calc.run('1/sin(pi)', W), UNDEFINED);
  assert.equal(calc.run('tan(pi/4)', W).display, '= 1');
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
