// A minimal stand-in for the page: just enough for ui.js to mount, draw, and receive events.
// `stored` is the text already in storage.
// Options: `failWrites` makes every write fail, like full storage.
// `confirm` is the answer every confirm() dialog gives (default true).
// `online` is passed to mount as the online app's account and leaderboard.
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
  // The calculator box also keeps the selection set on it. A redraw puts it back at 0, as Edge
  // reports for a freshly drawn input that has not been focused.
  const answerBox = { value: '', focus() {}, setSelectionRange() {} };
  const nameBox = { value: '', focus() {}, setSelectionRange() {} };
  const calcBox = {
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    focus() {},
    setSelectionRange(start, end) {
      calcBox.selectionStart = start;
      calcBox.selectionEnd = end;
    }
  };
  let html = '';
  const rootEl = {
    get innerHTML() { return html; },
    set innerHTML(text) {
      html = String(text);
      answerBox.value = inputValue(html, 'answer');
      nameBox.value = inputValue(html, 'mascot-name');
      calcBox.value = inputValue(html, 'calc-input');
      calcBox.selectionStart = 0;
      calcBox.selectionEnd = 0;
    },
    addEventListener: (type, handler) => { handlers[type] = handler; },
    querySelector: selector => {
      for (const [role, box] of [['answer', answerBox], ['calc-input', calcBox], ['mascot-name', nameBox]]) {
        const marker = 'data-role="' + role + '"';
        if (selector.includes(marker)) return rootEl.innerHTML.includes(marker) ? box : null;
      }
      return null;
    }
  };
  const fileInput = { addEventListener() {}, click() {}, files: [], value: '' };
  const confirms = [];
  // The page's root element. ui.js sets data-theme on it.
  const pageAttributes = {};
  globalThis.document = {
    documentElement: { setAttribute: (name, value) => { pageAttributes[name] = String(value); } },
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
  ui.mount(rootEl, ls, options.online ? { online: options.online } : undefined);

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
  return { ls, answerBox, calcBox, nameBox, confirms, click, key, html: () => rootEl.innerHTML, theme: () => pageAttributes['data-theme'] };
}

module.exports = { makeEnv };
