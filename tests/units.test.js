const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const units = require('../js/units.js');
const { makeUnit } = require('./fixtures.js');

const q = (u, l, s, i) => u.levels[l].lessons[s].questions[i];
const samplePath = path.join(__dirname, '../units/sample-unit.json');

test('valid unit passes', () => assert.deepEqual(units.validate(makeUnit()), { ok: true, errors: [] }));

test('non-objects fail without throwing', () => {
  for (const bad of [null, undefined, 42, 'x', [], true]) {
    assert.deepEqual(units.validate(bad), { ok: false, errors: ['unit: must be an object'] });
  }
});

test('each broken rule reports one error with its location', () => {
  const cases = [
    [u => { u.format = 2; }, /^format: must be 1$/],
    [u => { u.title = ''; }, /^title: must be a non-empty string$/],
    [u => { u.levels = []; }, /^levels: must have at least 1 level$/],
    [u => { u.levels[1].title = 5; }, /^levels\[1\]\.title: must be a non-empty string$/],
    [u => { u.levels[0].lessons = []; }, /^levels\[0\]\.lessons: must have at least 1 lesson$/],
    [u => { u.levels[0].lessons[1].questions = []; }, /^levels\[0\]\.lessons\[1\]\.questions: must have at least 1 question$/],
    [u => { q(u, 0, 0, 0).hint = ' '; }, /^levels\[0\]\.lessons\[0\]\.questions\[0\]\.hint: must be a non-empty string$/],
    [u => { q(u, 0, 0, 0).type = 'essay'; }, /questions\[0\]\.type: must be "choice" or "input"$/],
    [u => { q(u, 0, 0, 0).choices = ['only']; }, /questions\[0\]\.choices: must have 2 to 6 choices$/],
    [u => { q(u, 0, 0, 0).answer = 5; }, /^levels\[0\]\.lessons\[0\]\.questions\[0\]: answer index 5 is out of range$/],
    [u => { q(u, 0, 0, 0).answer = 1.5; }, /questions\[0\]: answer must be a whole number$/],
    [u => { q(u, 0, 0, 1).answers = []; }, /questions\[1\]\.answers: must have at least 1 answer$/],
    [u => { q(u, 0, 0, 1).answers = ['']; }, /questions\[1\]\.answers\[0\]: must be a non-empty string$/],
    [u => { u.levels[1].id = 'A'; }, /^levels\[1\]\.id: duplicate level id "A"$/],
    [u => { u.levels[1].lessons[0].id = 'a1'; }, /^levels\[1\]\.lessons\[0\]\.id: duplicate lesson id "a1"$/],
    [u => { q(u, 1, 0, 0).id = 'q1'; }, /^levels\[1\]\.lessons\[0\]\.questions\[0\]\.id: duplicate question id "q1"$/]
  ];
  for (const [mutate, pattern] of cases) {
    const unit = makeUnit();
    mutate(unit);
    const result = units.validate(unit);
    assert.equal(result.ok, false);
    assert.equal(result.errors.length, 1, String(pattern));
    assert.match(result.errors[0], pattern);
  }
});

test('lookups', () => {
  const u = makeUnit();
  assert.equal(units.findQuestion(u, 'q3').prompt, 'P q3');
  assert.equal(units.findQuestion(u, 'nope'), null);
  const found = units.findLesson(u, 'b1');
  assert.deepEqual([found.levelIndex, found.lessonIndex, found.lesson.id, found.level.id], [1, 0, 'b1', 'B']);
  assert.equal(units.findLesson(u, 'nope'), null);
  assert.deepEqual(units.questionIds(u), ['q1', 'q2', 'q3', 'q4']);
  assert.deepEqual(units.lessonIds(u), ['a1', 'a2', 'b1']);
});

test('sample unit is valid and has the planned shape', () => {
  const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  assert.deepEqual(units.validate(sample), { ok: true, errors: [] });
  assert.equal(sample.id, 'sample-equations');
  assert.equal(sample.levels.length, 2);
  const types = new Set();
  for (const level of sample.levels) {
    assert.equal(level.lessons.length, 2);
    for (const lesson of level.lessons) {
      assert.equal(lesson.questions.length, 6);
      lesson.questions.forEach(x => types.add(x.type));
    }
  }
  assert.deepEqual([...types].sort(), ['choice', 'input']);
  assert.match(JSON.stringify(sample), /[<>]/);
});

test('validate-unit CLI', () => {
  const run = (...args) => spawnSync(process.execPath, [path.join(__dirname, '../tools/validate-unit.js'), ...args], { encoding: 'utf8' });
  const ok = run(samplePath);
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /^OK: .+ \(2 levels, 4 lessons, 24 questions\)/);
  const tmp = path.join(os.tmpdir(), 'aq-bad-unit.json');
  fs.writeFileSync(tmp, JSON.stringify({ format: 2 }));
  const invalid = run(tmp);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stdout + invalid.stderr, /format: must be 1/);
  const notJson = run(path.join(__dirname, 'fixtures.js'));
  assert.equal(notJson.status, 1);
  assert.match(notJson.stdout + notJson.stderr, /Not valid JSON/);
  assert.equal(run().status, 2);
});
