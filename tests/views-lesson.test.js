const test = require('node:test');
const assert = require('node:assert/strict');
const views = require('../js/views.js');

const tag = (html, marker) => html.match(new RegExp('<[a-z]+[^>]*' + marker + '[^>]*>'))[0];
const typed = extra => Object.assign({
  done: 1, total: 6, hearts: 3, maxHearts: 5, prompt: 'Solve: x < 5 & x > 2', type: 'input',
  choices: null, selected: null, hint: 'Think <hard>', hintVisible: false
}, extra);

test('lessonHtml: typed question', () => {
  const html = views.lessonHtml(typed());
  assert.match(html, /Solve: x &lt; 5 &amp; x &gt; 2/);
  assert.match(html, /aria-label="3 of 5 hearts"/);
  assert.match(html, /<input[^>]*data-role="answer"/);
  assert.doesNotMatch(html, /Think/);
  for (const action of ['check', 'hint', 'quit']) assert.match(html, new RegExp('data-action="' + action + '"'));
  assert.match(views.lessonHtml(typed({ hintVisible: true })), /Think &lt;hard&gt;/);
});

test('lessonHtml: choice question keeps original indexes in display order', () => {
  const html = views.lessonHtml(typed({
    type: 'choice', selected: 0,
    choices: [{ index: 2, text: 'x > 1' }, { index: 0, text: 'x = 1' }, { index: 1, text: 'x < 1' }]
  }));
  const order = [...html.matchAll(/data-action="choose" data-index="(\d)"/g)].map(m => m[1]);
  assert.deepEqual(order, ['2', '0', '1']);
  assert.match(html, /x &gt; 1/);
  assert.match(tag(html, 'data-index="0"'), /aria-pressed="true"/);
  assert.match(tag(html, 'data-index="2"'), /aria-pressed="false"/);
  assert.doesNotMatch(html, /data-role="answer"/);
});

test('feedbackHtml', () => {
  const right = views.feedbackHtml({ correct: true, solution: 'a < b' });
  assert.match(right, /Correct!/);
  assert.doesNotMatch(right, /a &lt; b/);
  const wrong = views.feedbackHtml({ correct: false, solution: 'a < b' });
  assert.match(wrong, /Not quite/);
  assert.match(wrong, /a &lt; b/);
  for (const html of [right, wrong]) assert.match(html, /data-action="continue"/);
});

test('completeHtml', () => {
  const perfect = views.completeHtml({ xpEarned: 50, accuracy: 100, perfect: true });
  assert.match(perfect, /\+50 XP/);
  assert.match(perfect, /100%/);
  assert.match(perfect, /Perfect/);
  assert.match(perfect, /data-action="home"/);
  assert.doesNotMatch(views.completeHtml({ xpEarned: 40, accuracy: 50, perfect: false }), /Perfect/);
});

test('failedHtml', () => {
  const html = views.failedHtml({ missed: [{ prompt: 'a < b', solution: 'c & d' }] });
  assert.match(html, /a &lt; b/);
  assert.match(html, /c &amp; d/);
  for (const action of ['retry', 'home']) assert.match(html, new RegExp('data-action="' + action + '"'));
});

test('lessonHtml: a locked typed question keeps the answer and drops Check and Hint', () => {
  const html = views.lessonHtml(typed({ locked: true, answerText: 'x < "5"' }));
  const box = tag(html, 'data-role="answer"');
  assert.match(box, /value="x &lt; &quot;5&quot;"/);
  assert.match(box, /disabled/);
  assert.doesNotMatch(html, /data-action="(check|hint)"/);
  assert.match(html, /data-action="quit"/);
});

test('lessonHtml: an unlocked typed question with text keeps it and stays editable', () => {
  const box = tag(views.lessonHtml(typed({ answerText: '12' })), 'data-role="answer"');
  assert.match(box, /value="12"/);
  assert.doesNotMatch(box, /disabled/);
});

test('lessonHtml: a locked choice question disables every choice', () => {
  const html = views.lessonHtml(typed({
    type: 'choice', selected: 1, locked: true,
    choices: [{ index: 0, text: 'a' }, { index: 1, text: 'b' }]
  }));
  for (const index of [0, 1]) assert.match(tag(html, 'data-index="' + index + '"'), /disabled/);
  assert.doesNotMatch(html, /data-action="(check|hint)"/);
});
