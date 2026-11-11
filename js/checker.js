// Answer checker: decides whether a typed answer matches an accepted answer.
//
// An answer is read as one or more parts, split on commas, semicolons, "or", and "and".
// So "3, -3", "x = -3 or x = 3", and "±3" are all the same two-part answer, in any order.
// Each part is compared by value when it is a number, and as text otherwise.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};

  var DECIMAL = /^-?(\d+\.?\d*|\.\d+)$/;
  var FRACTION = /^-?\d+\/\d+$/;
  var MIXED_NUMBER = /(-?)(\d+)\s+(\d+)\/(\d+)/g;
  var PART_SEPARATOR = /[,;]|\bor\b|\band\b/;
  var PLUS_MINUS = /^(?:±|\+-|\+\/-)(.+)$/;
  var TOLERANCE = 1e-9;

  // "2 1/2" becomes "5/2". This must run while the space is still there:
  // with the space removed it would read as 21/2.
  function mixedToFraction(match, sign, whole, numerator, denominator) {
    return sign + (Number(whole) * Number(denominator) + Number(numerator)) + '/' + denominator;
  }

  // First pass over raw text. Spaces are kept, because splitting into parts needs them.
  function prepare(text) {
    return String(text)
      .trim()
      .toLowerCase()
      .replace(/−/g, '-')
      .replace(/<=/g, '≤')
      .replace(/>=/g, '≥')
      .replace(MIXED_NUMBER, mixedToFraction);
  }

  // Second pass over one part: drops spaces and a "x =" on the left or "= x" on the right.
  function finishPart(prepared) {
    return prepared.replace(/\s+/g, '').replace(/^[a-z]=|=[a-z]$/, '');
  }

  // Reduces text to a comparable form, so "x = 4", "X=4", "4 = x", and "4" all become "4".
  // It does not split the text into parts.
  function normalize(text) {
    return finishPart(prepare(text));
  }

  // The parts of an answer, each normalized. Empty parts are dropped, and "±3" gives "3" and "-3".
  function answerParts(text) {
    var parts = [];
    prepare(text).split(PART_SEPARATOR).forEach(function (piece) {
      var part = finishPart(piece);
      if (part === '') return;
      var plusMinus = PLUS_MINUS.exec(part);
      if (plusMinus) parts.push(plusMinus[1], '-' + plusMinus[1]);
      else parts.push(part);
    });
    return parts;
  }

  // Returns the numeric value of a normalized integer, decimal, or simple fraction, or null.
  function parseNumber(normalized) {
    if (DECIMAL.test(normalized)) return Number(normalized);
    if (FRACTION.test(normalized)) {
      var pieces = normalized.split('/');
      var denominator = Number(pieces[1]);
      if (denominator === 0) return null;
      return Number(pieces[0]) / denominator;
    }
    return null;
  }

  function partsMatch(first, second) {
    var firstNumber = parseNumber(first);
    var secondNumber = parseNumber(second);
    if (firstNumber !== null && secondNumber !== null) {
      return Math.abs(firstNumber - secondNumber) < TOLERANCE;
    }
    return first === second;
  }

  // True when every typed part pairs with a different accepted part. Order does not matter.
  function sameParts(typed, accepted) {
    if (typed.length !== accepted.length) return false;
    var unused = accepted.slice();
    return typed.every(function (part) {
      for (var i = 0; i < unused.length; i++) {
        if (partsMatch(part, unused[i])) {
          unused.splice(i, 1);
          return true;
        }
      }
      return false;
    });
  }

  function isCorrect(userText, answers) {
    var typed = answerParts(userText);
    if (typed.length === 0) return false;
    return answers.some(function (answer) {
      return sameParts(typed, answerParts(answer));
    });
  }

  // True when there is nothing to grade: empty text, spaces, a bare "x =", or only separators.
  function isBlank(text) {
    return answerParts(text).length === 0;
  }

  var api = { normalize: normalize, parseNumber: parseNumber, isCorrect: isCorrect, isBlank: isBlank };
  AQ.checker = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
