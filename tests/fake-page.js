// A minimal stand-in for the page: just enough for ui.js to mount, draw, and receive events.
// `stored` is the text already in storage.
// Options: `failWrites` makes every write fail, like full storage.
// `confirm` is the answer every confirm() dialog gives (default true).
const KEY = 'algebraQuest.v1';
const UNESCAPES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

// The value a freshly drawn input would hold: its value="..." attribute, unescaped,
// or '' when the input has no value attribute or is not on the page.
function inputValue(html, role) {
  const tag = html.match(new RegExp('<input[^>]*data-role="' + role + '"[^>]*>'));
  const value = tag && tag[0].match(/\svalue="([^"]*)"/);
  return value ? value[1].replace(/&(amp|lt|gt|quot|#39);/g, entity => UNESCAPES[entity]) : '';
}

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
  // Every redraw resets them to what the new HTML holds, as a real page makes fresh inputs.
  const answerBox = { value: '', focus() {}, setSelectionRange() {} };
  const calcBox = { value: '', focus() {}, setSelectionRange() {} };
  let html = '';
  const rootEl = {
    get innerHTML() { return html; },
    set innerHTML(text) {
      html = String(text);
      answerBox.value = inputValue(html, 'answer');
      calcBox.value = inputValue(html, 'calc-input');
    },
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

  // `detail` is the click count, as on a real click: 2 is the second click of a double-click.
  const click = (action, attributes = {}, detail = 1) => handlers.click({
    detail,
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
