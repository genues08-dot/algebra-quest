// Plotting: finds zeros and turning points of a function, and draws it as an SVG string.
// It takes an evaluate(x) function (see mathexpr.js) and never touches the DOM.
// A window is { xMin, xMax, yMin, yMax }.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};

  var SIZE = 320;
  var SAMPLES = 400;
  var CURVE_STEPS = 200;
  var BISECTIONS = 40;
  var MERGE_DISTANCE = 1e-4;
  var ZERO_TOLERANCE = 1e-6;
  var SLOPE_STEP = 1e-6;
  var PIXEL_LIMIT = { min: -1000, max: 1320 };

  function isFinite_(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function sign(value) {
    return value > 0 ? 1 : value < 0 ? -1 : 0;
  }

  // Bisect on g between lo and hi, where g changes sign. Returns the x where it does.
  function bisect(g, lo, hi) {
    var signLo = sign(g(lo));
    for (var i = 0; i < BISECTIONS; i++) {
      var mid = (lo + hi) / 2;
      if (sign(g(mid)) === signLo) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function mergeClose(list, getX) {
    var sorted = list.slice().sort(function (a, b) { return getX(a) - getX(b); });
    var merged = [];
    for (var i = 0; i < sorted.length; i++) {
      if (merged.length && getX(sorted[i]) - getX(merged[merged.length - 1]) < MERGE_DISTANCE) continue;
      merged.push(sorted[i]);
    }
    return merged;
  }

  function features(evaluate, win) {
    var xs = [];
    var ys = [];
    var i;
    for (i = 0; i <= SAMPLES; i++) {
      var x = win.xMin + (win.xMax - win.xMin) * i / SAMPLES;
      xs.push(x);
      ys.push(evaluate(x));
    }
    var slope = function (x) {
      return (evaluate(x + SLOPE_STEP) - evaluate(x - SLOPE_STEP)) / (2 * SLOPE_STEP);
    };
    var zeros = [];
    var turns = [];
    for (i = 0; i <= SAMPLES; i++) {
      if (!isFinite_(ys[i])) continue;
      if (ys[i] === 0) zeros.push(xs[i]);
      if (i < SAMPLES && isFinite_(ys[i + 1]) && ys[i] * ys[i + 1] < 0) {
        // A real root is smaller than both bracketing samples. A pole is not.
        var root = bisect(evaluate, xs[i], xs[i + 1]);
        if (Math.abs(evaluate(root)) <= Math.max(Math.abs(ys[i]), Math.abs(ys[i + 1]))) zeros.push(root);
      }
      if (i > 0 && i < SAMPLES && isFinite_(ys[i - 1]) && isFinite_(ys[i + 1])) {
        var before = ys[i] - ys[i - 1];
        var after = ys[i + 1] - ys[i];
        if ((before > 0 && after < 0) || (before < 0 && after > 0)) {
          // The slope must really change sign; across a pole the values flip but the slope does not.
          if (sign(slope(xs[i - 1])) === sign(slope(xs[i + 1]))) continue;
          var tx = bisect(slope, xs[i - 1], xs[i + 1]);
          var ty = evaluate(tx);
          // A real turning point stays near its neighbors; a pole gives an enormous y.
          if (isFinite_(ty) && Math.abs(ty) <= 2 * Math.max(Math.abs(ys[i - 1]), Math.abs(ys[i]), Math.abs(ys[i + 1])) + 1) {
            turns.push({ x: tx, y: ty, kind: before > 0 ? 'max' : 'min' });
            if (Math.abs(ty) < ZERO_TOLERANCE) zeros.push(tx);
          }
        }
      }
    }
    return {
      zeros: mergeClose(zeros, function (v) { return v; }),
      turningPoints: mergeClose(turns, function (p) { return p.x; })
    };
  }

  // The smallest of 1, 2, 5 times a power of 10 that gives at most 10 steps across the range.
  function niceStep(range) {
    if (!(range > 0)) return 1;
    var power = Math.floor(Math.log10(range / 10)) - 1;
    var multipliers = [1, 2, 5];
    for (var guard = 0; guard < 40; guard++, power++) {
      for (var m = 0; m < multipliers.length; m++) {
        var step = multipliers[m] * Math.pow(10, power);
        if (range / step <= 10 + 1e-9) return step;
      }
    }
    return range;
  }

  function format(value, places) {
    var rounded = Number(value.toFixed(places));
    return String(rounded === 0 ? 0 : rounded);
  }

  function escapeAttribute(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pixel(value) {
    return Math.round(clamp(value, PIXEL_LIMIT.min, PIXEL_LIMIT.max) * 10) / 10;
  }

  function svg(options) {
    var win = options.window;
    var evaluate = options.evaluate;
    var xSpan = win.xMax - win.xMin;
    var ySpan = win.yMax - win.yMin;
    var px = function (x) { return (x - win.xMin) / xSpan * SIZE; };
    var py = function (y) { return SIZE - (y - win.yMin) / ySpan * SIZE; };
    var parts = [];

    var xStep = niceStep(xSpan);
    var yStep = niceStep(ySpan);
    var xAxis = win.yMin <= 0 && win.yMax >= 0;
    var yAxis = win.xMin <= 0 && win.xMax >= 0;
    var grid = [];
    var labels = [];
    var k;
    var first = Math.ceil(win.xMin / xStep - 1e-9);
    var last = Math.floor(win.xMax / xStep + 1e-9);
    for (k = first; k <= last; k++) {
      if (k === 0) continue;
      grid.push('M' + pixel(px(k * xStep)) + ' 0V' + SIZE);
      labels.push({ x: px(k * xStep), y: clamp(py(0) + 12, 12, SIZE - 4), anchor: 'middle', text: format(k * xStep, 6) });
    }
    first = Math.ceil(win.yMin / yStep - 1e-9);
    last = Math.floor(win.yMax / yStep + 1e-9);
    for (k = first; k <= last; k++) {
      if (k === 0) continue;
      grid.push('M0 ' + pixel(py(k * yStep)) + 'H' + SIZE);
      labels.push({ x: clamp(px(0) - 4, 24, SIZE - 2), y: py(k * yStep) + 4, anchor: 'end', text: format(k * yStep, 6) });
    }

    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + SIZE + ' ' + SIZE +
      '" role="img" aria-label="' + escapeAttribute(options.label) + '">');
    if (grid.length) parts.push('<path class="plot-grid" d="' + grid.join('') + '"/>');
    var axes = '';
    if (yAxis) axes += 'M' + pixel(px(0)) + ' 0V' + SIZE;
    if (xAxis) axes += 'M0 ' + pixel(py(0)) + 'H' + SIZE;
    parts.push('<path class="plot-axis" d="' + axes + '"/>');

    var d = '';
    var penDown = false;
    var previousSide = 0;
    for (var i = 0; i <= CURVE_STEPS; i++) {
      var x = win.xMin + xSpan * i / CURVE_STEPS;
      var y = evaluate(x);
      if (!isFinite_(y)) { penDown = false; previousSide = 0; continue; }
      var side = y > win.yMax ? 1 : y < win.yMin ? -1 : 0;
      if (penDown && side !== 0 && side === -previousSide) penDown = false;
      d += (penDown ? 'L' : 'M') + pixel(px(x)) + ' ' + pixel(py(y));
      penDown = true;
      previousSide = side;
    }
    if (d) parts.push('<path class="plot-curve" d="' + d + '"/>');

    var marks = options.marks || [];
    for (var m = 0; m < marks.length; m++) {
      if (!isFinite_(marks[m].x) || !isFinite_(marks[m].y)) continue;
      parts.push('<circle class="plot-mark plot-mark-' + marks[m].kind + '" cx="' + pixel(px(marks[m].x)) +
        '" cy="' + pixel(py(marks[m].y)) + '" r="4"/>');
    }
    if (options.numbers) {
      for (var n = 0; n < labels.length; n++) {
        parts.push('<text class="plot-number" x="' + pixel(labels[n].x) + '" y="' + pixel(labels[n].y) +
          '" text-anchor="' + labels[n].anchor + '">' + labels[n].text + '</text>');
      }
    }
    parts.push('</svg>');
    return parts.join('');
  }

  var api = { features: features, svg: svg, niceStep: niceStep, format: format };
  AQ.plot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
