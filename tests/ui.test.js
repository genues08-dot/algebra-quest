const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const { makeUnit, makeSave } = require('./fixtures.js');

const KEY = 'algebraQuest.v1';

// A minimal stand-in for the page: just enough for ui.js to mount, draw, and receive events.
// `stored` is the text already in storage. `failWrites` makes every write fail, like full storage.
function makeEnv(stored, options = {}) {
  const data = {};
  if (stored !== undefined) data[KEY] = stored;
  const ls = {
    data,
    getItem: key => (key in data ? data[key] : null),
    setItem(key, value) {
      if (options.failWrites) throw new Error('QuotaExceededError');
      data[key] = String(value);
    }
  };

  const handlers = {};
  const answerBox = { value: '', focus() {}, setSelectionRange() {} };
  const rootEl = {
    innerHTML: '',
    addEventListener: (type, handler) => { handlers[type] = handler; },
    querySelector: selector => {
      const wantsAnswerBox = selector.includes('data-role="answer"');
      return wantsAnswerBox && rootEl.innerHTML.includes('data-role="answer"') ? answerBox : null;
    }
  };
  const fileInput = { addEventListener() {}, click() {}, files: [], value: '' };
  globalThis.document = { getElementById: () => fileInput, addEventListener() {} };
  globalThis.scrollTo = () => {};
  globalThis.confirm = () => true;

  // ui.js keeps its state in the module, so each test loads a fresh copy.
  delete require.cache[require.resolve('../js/ui.js')];
  const ui = require('../js/ui.js');
  ui.mount(rootEl, ls);

  const click = (action, attributes = {}) => handlers.click({
    target: {
      closest: () => ({
        disabled: false,
        tagName: 'BUTTON',
        getAttribute: name => (name === 'data-action' ? action : attributes[name])
      })
    }
  });
  return { ls, answerBox, click, html: () => rootEl.innerHTML };
}

test('a lesson can be played from start to finish', () => {
  const env = makeEnv(storage.serialize(makeSave(makeUnit())));
  env.click('start-lesson', { 'data-lesson-id': 'a1' });
  assert.match(env.html(), /P q1/);

  env.click('check');
  assert.doesNotMatch(env.html(), /Correct!|Not quite/);

  env.click('choose', { 'data-index': '0' });
  env.click('check');
  assert.match(env.html(), /Not quite/);
  assert.match(env.html(), /4 of 5 hearts/);

  env.click('continue');
  assert.match(env.html(), /P q2/);
  env.answerBox.value = 'x = 7';
  env.click('check');
  assert.match(env.html(), /Correct!/);

  env.click('continue');
  env.click('choose', { 'data-index': '1' });
  env.click('check');
  env.click('continue');
  assert.match(env.html(), /Lesson complete!/);
  assert.match(env.html(), /\+40 XP/);

  const stored = JSON.parse(env.ls.data[KEY]);
  assert.deepEqual(
    [stored.xp, stored.streak, stored.progress.u1.completedLessons, stored.progress.u1.review],
    [40, 1, ['a1'], ['q1']]
  );
  env.click('home');
  assert.match(env.html(), /Review \(1\)/);
});

test('a failed first write still leaves a usable home screen', () => {
  const save = makeSave(makeUnit());
  save.xp = 250;
  const env = makeEnv(storage.serialize(save), { failWrites: true });
  assert.match(env.html(), /Storage is full/);
  env.click('home');
  assert.match(env.html(), /Rank 3/);
});

test('start fresh with a failed write returns to the unreadable-save screen', () => {
  const env = makeEnv('{}', { failWrites: true });
  assert.match(env.html(), /saved progress can&#39;t be read/);
  env.click('start-fresh');
  assert.match(env.html(), /Storage is full/);
  env.click('home');
  assert.match(env.html(), /saved progress can&#39;t be read/);
  assert.equal(env.ls.data[KEY], '{}');
});

test('progress saved by another window is not overwritten', () => {
  const unit = makeUnit();
  const env = makeEnv(storage.serialize(makeSave(unit)));

  // What a second Algebra Quest window would have written in the meantime.
  const newer = makeSave(unit);
  newer.xp = 900;
  newer.progress.u1.completedLessons = ['a1'];
  env.ls.data[KEY] = storage.serialize(newer);

  env.click('start-lesson', { 'data-lesson-id': 'a1' });
  env.click('choose', { 'data-index': '1' });
  env.click('check');

  assert.deepEqual(JSON.parse(env.ls.data[KEY]), newer);
  assert.match(env.html(), /another window/);
  env.click('home');
  assert.match(env.html(), /Rank 10/);
});
