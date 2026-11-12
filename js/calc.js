// Calculator logic: plain math gives a number, anything with x gives a graph result.
// No DOM. Uses AQ.mathexpr to parse and AQ.plot to find zeros and turning points.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./mathexpr.js');
    require('./plot.js');
  }

  var DEFAULT_WINDOW = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
  var MIN_WIDTH = 1.25;
  var MAX_WIDTH = 1280;
  var MAX_DENOMINATOR = 1000;
  var FRACTION_TOLERANCE = 1e-9;
  var EXACT_TOLERANCE = 1e-12;
  var HISTORY_SIZE = 10;
  var UNDEFINED_MESSAGE = 'That is undefined, like dividing by zero.';

  function formatNumber(value) {
    var n = Number(value.toPrecision(10));
    if (n === 0) n = 0;
    return String(n);
  }

  function asFraction(value) {
    if (!isFinite(value)) return null;
    if (Math.abs(value - Math.round(value)) <= FRACTION_TOLERANCE) return null;
    for (var d = 2; d <= MAX_DENOMINATOR; d++) {
      var n = Math.round(value * d);
      if (Math.abs(value - n / d) <= FRACTION_TOLERANCE) return { n: n, d: d };
    }
    return null;
  }

  function numberDisplay(value) {
    var text = formatNumber(value);
    var fraction = asFraction(value);
    if (!fraction) return '= ' + text;
    var label = fraction.n + '/' + fraction.d;
    var exact = Math.abs(value - Number(text)) <= EXACT_TOLERANCE;
    return label + (exact ? ' = ' : ' ≈ ') + text;
  }

  function point(p) {
    return p.kind + ' (' + AQ.plot.format(p.x, 2) + ', ' + AQ.plot.format(p.y, 2) + ')';
  }

  function run(text, win, options) {
    if (typeof text !== 'string' || !text.trim()) {
      return { kind: 'error', message: 'Type something to calculate.' };
    }
    var compiled = AQ.mathexpr.compile(text, options);
    if (!compiled.ok) return { kind: 'error', message: compiled.error };
    if (!compiled.usesX) {
      var value = compiled.evaluate(0);
      if (typeof value !== 'number' || !isFinite(value)) {
        return { kind: 'error', message: UNDEFINED_MESSAGE };
      }
      return { kind: 'number', display: numberDisplay(value), value: value };
    }
    var found = AQ.plot.features(compiled.evaluate, win);
    var zeros = found.zeros || [];
    var turning = found.turningPoints || [];
    var zerosLine = zeros.length
      ? 'Zeros: x = ' + zeros.map(function (z) { return AQ.plot.format(z, 2); }).join(', ')
      : 'Zeros: none in this window';
    var turningLine = turning.length
      ? 'Turning points: ' + turning.map(point).join(', ')
      : 'Turning points: none in this window';
    return {
      kind: 'graph',
      evaluate: compiled.evaluate,
      window: win,
      zeros: zeros,
      turningPoints: turning,
      zerosLine: zerosLine,
      turningLine: turningLine
    };
  }

  function historyEntry(text, result) {
    if (!result || result.kind === 'error') return null;
    return { text: String(text).trim(), result: result.kind === 'graph' ? 'graph' : result.display };
  }

  function addHistory(history, entry) {
    return [entry].concat(history).slice(0, HISTORY_SIZE);
  }

  function zoom(win, factor) {
    var width = (win.xMax - win.xMin) * factor;
    if (width < MIN_WIDTH || width > MAX_WIDTH) return win;
    var cx = (win.xMin + win.xMax) / 2;
    var cy = (win.yMin + win.yMax) / 2;
    var hx = (win.xMax - win.xMin) / 2 * factor;
    var hy = (win.yMax - win.yMin) / 2 * factor;
    return { xMin: cx - hx, xMax: cx + hx, yMin: cy - hy, yMax: cy + hy };
  }

  var api = {
    DEFAULT_WINDOW: DEFAULT_WINDOW,
    HISTORY_SIZE: HISTORY_SIZE,
    run: run,
    historyEntry: historyEntry,
    addHistory: addHistory,
    zoom: zoom,
    formatNumber: formatNumber,
    asFraction: asFraction
  };
  AQ.calc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
