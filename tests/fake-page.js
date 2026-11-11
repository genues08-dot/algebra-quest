// A minimal stand-in for the page: just enough for ui.js to mount, draw, and receive events.
// `stored` is the text already in storage.
// Options: `failWrites` makes every write fail, like full storage.
// `confirm` is the answer every confirm() dialog gives (default true).
const KEY = 'algebraQuest.v1';

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
  let keydown = null;
  // The answer box and the calculator box. Each is found only while the page HTML has it.
  const answerBox = { value: '', focus() {}, setSelectionRange() {} };
  const calcBox = { value: '', focus() {}, setSelectionRange() {} };
  const rootEl = {
    innerHTML: '',
    addEventListener: (type, handler) => { handlers[type] = handler; },
    querySelector: selector => {
      for (const [role, box] of [['answer', answerBox], ['calc-input', calcBox]]) {
        const marker = 'data-role="' + role + '"';
        if (selector.includes(marker)) return rootEl.innerHTML.includes(marker) ? box : null;
      }
      return null;
    }
  };
  const fileInput = { addEventListener() {}, click() {}, files: [], value: '' };
  const confirms = [];
  globalThis.document = {
    getElementById: () => fileInput,
    addEventListener: (type, handler) => { if (type === 'keydown') keydown = handler; }
  };
  globalThis.scrollTo = () => {};
  globalThis.confirm = message => {
    confirms.push(message);
    return options.confirm === undefined ? true : options.confirm;
  };

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
  // A key press in the element whose data-role is `role`.
  const key = (name, role) => keydown({
    key: name,
    repeat: false,
    preventDefault() {},
    target: { getAttribute: attr => (attr === 'data-role' ? role : null) }
  });
  return { ls, answerBox, calcBox, confirms, click, key, html: () => rootEl.innerHTML };
}

module.exports = { makeEnv };
