const test = require('node:test');
const assert = require('node:assert/strict');
const units = require('../js/units.js');
const { makeUnit, makeRichUnit } = require('./fixtures.js');

const L0 = 'levels[0].lessons[0]';
const Q = 'levels[0].lessons[1].questions[0]';

test('a unit with every new part is valid, and a v1 unit still is', () => {
  assert.deepEqual(units.validate(makeRichUnit()), { ok: true, errors: [] });
  assert.deepEqual(units.validate(makeUnit()), { ok: true, errors: [] });
});

test('each broken rule reports one error with its location', () => {
  const lesson = u => u.levels[0].lessons[0];
  const question = u => u.levels[0].lessons[1].questions[0];
  const cases = [
    [u => { lesson(u).teach = []; }, L0 + '.teach: must have 1 to 5 cards'],
    [u => { lesson(u).teach = [1, 2, 3, 4, 5, 6].map(n => ({ title: 'T' + n, text: ['x'] })); }, L0 + '.teach: must have 1 to 5 cards'],
    [u => { lesson(u).teach[0] = 'card'; }, L0 + '.teach[0]: must be an object'],
    [u => { lesson(u).teach[0].title = ''; }, L0 + '.teach[0].title: must be a non-empty string'],
    [u => { lesson(u).teach[0].text = []; }, L0 + '.teach[0].text: must have at least 1 paragraph'],
    [u => { lesson(u).teach[0].text = ['ok', ' ']; }, L0 + '.teach[0].text[1]: must be a non-empty string'],
    [u => { lesson(u).teach[1].example = 'x'; }, L0 + '.teach[1].example: must be an object'],
    [u => { lesson(u).teach[1].example.problem = ''; }, L0 + '.teach[1].example.problem: must be a non-empty string'],
    [u => { lesson(u).teach[1].example.steps = []; }, L0 + '.teach[1].example.steps: must have at least 1 step'],
    [u => { lesson(u).teach[1].example.steps = ['']; }, L0 + '.teach[1].example.steps[0]: must be a non-empty string'],
    [u => { lesson(u).teach[1].graph.fn = '(x'; }, L0 + '.teach[1].graph.fn: A closing parenthesis is missing.'],
    [u => { question(u).graph = 'x^2'; }, Q + '.graph: must be an object'],
    [u => { question(u).graph.fn = ' '; }, Q + '.graph.fn: must be a non-empty string'],
    [u => { question(u).graph.x = [5, -5]; }, Q + '.graph.x: must be two numbers, smaller first'],
    [u => { question(u).graph.y = [1]; }, Q + '.graph.y: must be two numbers, smaller first'],
    [u => { question(u).graph.numbers = 'yes'; }, Q + '.graph.numbers: must be true or false'],
    [u => { u.levels[1].lessons[0].questions[0].calculator = 'no'; }, 'levels[1].lessons[0].questions[0].calculator: must be true or false'],
    [u => { u.test = []; }, 'test: must be an object'],
    [u => { u.test.questions = []; }, 'test.questions: must have at least 1 question'],
    [u => { u.test.questions[1].id = 'q1'; }, 'test.questions[1].id: duplicate question id "q1"'],
    [u => { u.test.questions[2].answers = []; }, 'test.questions[2].answers: must have at least 1 answer'],
    [u => { u.test.questions[0].graph.fn = 'y + 1'; }, 'test.questions[0].graph.fn: I don\'t know the name "y".']
  ];
  for (const [mutate, message] of cases) {
    const unit = makeRichUnit();
    mutate(unit);
    assert.deepEqual(units.validate(unit), { ok: false, errors: [message] }, message);
  }
});

test('lookups cover test questions', () => {
  const unit = makeRichUnit();
  assert.equal(units.findQuestion(unit, 't3').prompt, 'T t3');
  assert.deepEqual(units.questionIds(unit), ['q1', 'q2', 'q3', 'q4', 't1', 't2', 't3', 't4', 't5']);
  assert.deepEqual(units.testQuestions(unit).map(q => q.id), ['t1', 't2', 't3', 't4', 't5']);
  assert.deepEqual(units.testQuestions(makeUnit()), []);
  assert.deepEqual(units.questionIds(makeUnit()), ['q1', 'q2', 'q3', 'q4']);
});
