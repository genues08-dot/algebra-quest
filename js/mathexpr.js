// Typed math reader: turns text like "2x^2 - 3" into a function of x.
//
// The text is parsed here and never run as code. Only the names listed below are known.
// Anything else is refused with a plain sentence the student can act on.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};

  var FUNCTIONS = {
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    log: Math.log10,
    ln: Math.log
  };
  var CONSTANTS = { pi: Math.PI, e: Math.E };
  // Longest first, so "sqrt" is never read as something shorter.
  var NAMES = ['asin', 'acos', 'atan', 'sqrt', 'cbrt', 'root', 'sin', 'cos', 'tan', 'abs', 'log', 'ans', 'ln', 'pi', 'e', 'x'];
  var COMMA_MESSAGE = 'Use a comma only inside root(n, x).';
  var ROOT_MESSAGE = 'Use root(n, x) with a comma, like root(3, 8).';
  var NO_ANSWER_MESSAGE = 'There is no answer yet.';
  var TRIG = { sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1 };
  // Float noise is cleared where it is made: a trig result this close to 0 is 0, and so is a
  // sum or difference this small next to its parts, like 0.1 + 0.2 - 0.3. Other small values,
  // like 1.6×10^-19, are kept.
  var NOISE = 1e-12;

  function trigNoise(v) {
    return Math.abs(v) < NOISE ? 0 : v;
  }

  // a + b or a - b, given as `result`, is 0 when it is only the noise left after cancelling.
  function cancelNoise(a, b, result) {
    if (!isFinite(result)) return result;
    return Math.abs(result) <= NOISE * Math.max(Math.abs(a), Math.abs(b)) ? 0 : result;
  }

  // Trig functions for the chosen angle mode. In degrees, multiples of 90 come out exact.
  function trigFunction(name, degrees) {
    if (!degrees) return Math[name];
    var toRad = Math.PI / 180;
    var toDeg = 180 / Math.PI;
    if (name === 'sin') {
      return function (a) {
        if (a % 90 === 0) return [0, 1, 0, -1][(((a / 90) % 4) + 4) % 4];
        return Math.sin(a * toRad);
      };
    }
    if (name === 'cos') {
      return function (a) {
        if (a % 90 === 0) return [1, 0, -1, 0][(((a / 90) % 4) + 4) % 4];
        return Math.cos(a * toRad);
      };
    }
    if (name === 'tan') {
      return function (a) {
        if (a % 90 === 0) return a % 180 === 0 ? 0 : NaN;
        return Math.tan(a * toRad);
      };
    }
    var inverse = Math[name];
    return function (v) { return inverse(v) * toDeg; };
  }

  function factorial(n) {
    if (n !== Math.floor(n) || n < 0 || !isFinite(n)) return NaN;
    if (n > 170) return Infinity;
    var result = 1;
    for (var i = 2; i <= n; i++) result *= i;
    return result;
  }

  // One closure per "!", so repeated "!!" each keep their own operand.
  function factorialOf(operand) {
    return function (x) { return factorial(operand(x)); };
  }

  function nthRoot(n, x) {
    if (x < 0 && n === Math.floor(n) && Math.abs(n) % 2 === 1) return -Math.pow(-x, 1 / n);
    return Math.pow(x, 1 / n);
  }

  var NUMBER = /^(\d+\.?\d*|\.\d+)/;
  var LETTERS = /^[a-z]+/;
  var LEADING_Y = /^\s*(?:y|f\s*\(\s*x\s*\))\s*=/;
  // An "=" left after the leading "y =" is gone means the student typed an equation.
  var EQUATION_MESSAGE = 'The calculator can\'t solve equations. Type one side, like x^2 - 4, to graph it.';

  function fail(error) {
    var problem = new Error(error);
    problem.isReaderError = true;
    throw problem;
  }

  function prepare(text) {
    return String(text)
      .toLowerCase()
      .replace(/−/g, '-')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/π/g, 'pi')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/√\(/g, 'sqrt(')
      .replace(/√(\d+\.?\d*|\.\d+)/g, 'sqrt($1)')
      .replace(/√x/g, 'sqrt(x)')
      .replace(LEADING_Y, '');
  }

  // Splits a run of letters into known names, or refuses the whole run.
  function splitLetters(run) {
    var parts = [];
    var rest = run;
    while (rest) {
      var found = null;
      for (var i = 0; i < NAMES.length; i++) {
        if (rest.indexOf(NAMES[i]) === 0) { found = NAMES[i]; break; }
      }
      if (!found) fail('I don\'t know the name "' + run + '".');
      parts.push(found);
      rest = rest.slice(found.length);
    }
    return parts;
  }

  function tokenize(text) {
    var tokens = [];
    var rest = text;
    while (rest) {
      var match;
      var ch = rest.charAt(0);
      if (/\s/.test(ch)) {
        rest = rest.slice(1);
      } else if ((match = NUMBER.exec(rest))) {
        tokens.push({ type: 'num', text: match[0] });
        rest = rest.slice(match[0].length);
      } else if (ch === ',') {
        tokens.push({ type: 'comma', text: ch });
        rest = rest.slice(1);
      } else if (ch === '!') {
        tokens.push({ type: 'bang', text: ch });
        rest = rest.slice(1);
      } else if ((match = LETTERS.exec(rest))) {
        splitLetters(match[0]).forEach(function (name) {
          tokens.push({ type: 'name', text: name });
        });
        rest = rest.slice(match[0].length);
      } else if ('+-*/^'.indexOf(ch) >= 0) {
        tokens.push({ type: 'op', text: ch });
        rest = rest.slice(1);
      } else if (ch === '(') {
        tokens.push({ type: 'open', text: ch });
        rest = rest.slice(1);
      } else if (ch === ')') {
        tokens.push({ type: 'close', text: ch });
        rest = rest.slice(1);
      } else {
        fail('I don\'t understand "' + ch + '".');
      }
    }
    return tokens;
  }

  // Recursive descent. Each parse function returns a closure: x -> number.
  function parse(tokens, options) {
    var degrees = options.angle === 'deg';
    var pos = 0;
    var usesX = false;

    function peek() { return tokens[pos]; }
    function isOp(token, chars) { return token && token.type === 'op' && chars.indexOf(token.text) >= 0; }

    // A missing operand is blamed on the token before the gap, or on the token found if none.
    function missing() {
      var near = pos > 0 ? tokens[pos - 1] : tokens[pos];
      fail('Something is missing near "' + near.text + '".');
    }

    function sum() {
      var left = product();
      while (isOp(peek(), '+-')) {
        left = combine(tokens[pos++].text, left, product());
      }
      return left;
    }

    function combine(op, a, b) {
      if (op === '+') return function (x) { var p = a(x), q = b(x); return cancelNoise(p, q, p + q); };
      if (op === '-') return function (x) { var p = a(x), q = b(x); return cancelNoise(p, q, p - q); };
      if (op === '*') return function (x) { return a(x) * b(x); };
      return function (x) { return a(x) / b(x); };
    }

    function product() {
      var left = unary();
      for (;;) {
        var token = peek();
        if (isOp(token, '*/')) {
          pos++;
          left = combine(token.text, left, unary());
        } else if (token && (token.type === 'name' || token.type === 'open')) {
          left = combine('*', left, power());
        } else if (token && token.type === 'num') {
          fail('Something is missing near "' + token.text + '".');
        } else {
          return left;
        }
      }
    }

    function unary() {
      if (isOp(peek(), '+-')) {
        var sign = tokens[pos++].text;
        var operand = unary();
        return sign === '-' ? function (x) { return -operand(x); } : operand;
      }
      return power();
    }

    function power() {
      var base = primary();
      if (isOp(peek(), '^')) {
        pos++;
        var exponent = signedPower();
        return function (x) { return Math.pow(base(x), exponent(x)); };
      }
      return base;
    }

    // The exponent of ^ may carry a sign, and groups to the right.
    function signedPower() {
      if (isOp(peek(), '+-')) {
        var sign = tokens[pos++].text;
        var operand = signedPower();
        return sign === '-' ? function (x) { return -operand(x); } : operand;
      }
      return power();
    }

    function closeParen() {
      var token = peek();
      if (!token) fail('A closing parenthesis is missing.');
      if (token.type === 'comma') fail(COMMA_MESSAGE);
      pos++;
    }

    // A value followed by any number of ! postfixes.
    function primary() {
      var value = atom();
      while (peek() && peek().type === 'bang') {
        pos++;
        value = factorialOf(value);
      }
      return value;
    }

    function atom() {
      var token = peek();
      if (!token || token.type === 'op' || token.type === 'close' || token.type === 'comma' || token.type === 'bang') missing();
      pos++;
      if (token.type === 'num') {
        var number = Number(token.text);
        return function () { return number; };
      }
      if (token.type === 'open') {
        var inner = sum();
        closeParen();
        return inner;
      }
      if (token.text === 'root') {
        if (!peek() || peek().type !== 'open') fail('Something is missing near "root".');
        pos++;
        var index = sum();
        var after = peek();
        if (!after) fail('A closing parenthesis is missing.');
        if (after.type === 'close') fail(ROOT_MESSAGE);
        if (after.type !== 'comma') missing();
        pos++;
        var radicand = sum();
        closeParen();
        return function (x) { return nthRoot(index(x), radicand(x)); };
      }
      if (token.text === 'ans') {
        var previous = options.ans;
        if (typeof previous !== 'number' || !isFinite(previous)) fail(NO_ANSWER_MESSAGE);
        return function () { return previous; };
      }
      if (TRIG.hasOwnProperty(token.text)) {
        if (!peek() || peek().type !== 'open') fail('Something is missing near "' + token.text + '".');
        pos++;
        var trigArgument = sum();
        closeParen();
        var trig = trigFunction(token.text, degrees);
        return function (x) { return trigNoise(trig(trigArgument(x))); };
      }
      if (FUNCTIONS.hasOwnProperty(token.text)) {
        if (!peek() || peek().type !== 'open') fail('Something is missing near "' + token.text + '".');
        pos++;
        var argument = sum();
        closeParen();
        var apply = FUNCTIONS[token.text];
        return function (x) { return apply(argument(x)); };
      }
      if (token.text === 'x') {
        usesX = true;
        return function (x) { return x; };
      }
      var constant = CONSTANTS[token.text];
      return function () { return constant; };
    }

    var result = sum();
    if (peek() && peek().type === 'comma') fail(COMMA_MESSAGE);
    if (peek()) fail('There is an extra closing parenthesis.');
    return { evaluate: result, usesX: usesX };
  }

  function compile(text, options) {
    var settings = {
      angle: options && options.angle === 'deg' ? 'deg' : 'rad',
      ans: options && options.ans !== undefined ? options.ans : null
    };
    try {
      var prepared = prepare(text);
      if (prepared.indexOf('=') >= 0) fail(EQUATION_MESSAGE);
      var tokens = tokenize(prepared);
      if (!tokens.length) fail('Type something to calculate.');
      var parsed = parse(tokens, settings);
      return { ok: true, usesX: parsed.usesX, evaluate: parsed.evaluate };
    } catch (problem) {
      if (problem && problem.isReaderError) return { ok: false, error: problem.message };
      throw problem;
    }
  }

  var api = { compile: compile };
  AQ.mathexpr = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
