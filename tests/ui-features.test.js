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
