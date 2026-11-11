// Answer checker: decides whether a typed answer matches an accepted answer.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};

  var DECIMAL = /^-?(\d+\.?\d*|\.\d+)$/;
  var FRACTION = /^-?\d+\/\d+$/;
  var TOLERANCE = 1e-9;

  // Reduces text to a comparable form, so "x = 4", "X=4", and "4" all become "4".
  function normalize(text) {
    return String(text)
      .trim()
      .toLowerCase()
      .replace(/−/g, '-')
      .replace(/\s+/g, '')
      .replace(/^[a-z]=/, '');
  }

  // Returns the numeric value of a normalized integer, decimal, or simple fraction, or null.
  function parseNumber(normalized) {
    if (DECIMAL.test(normalized)) return Number(normalized);
    if (FRACTION.test(normalized)) {
      var parts = normalized.split('/');
      var denominator = Number(parts[1]);
      if (denominator === 0) return null;
      return Number(parts[0]) / denominator;
    }
    return null;
  }

  function isCorrect(userText, answers) {
    var user = normalize(userText);
    if (user === '') return false;
    var userNumber = parseNumber(user);
    return answers.some(function (answer) {
      var accepted = normalize(answer);
      var acceptedNumber = parseNumber(accepted);
      if (userNumber !== null && acceptedNumber !== null) {
        return Math.abs(userNumber - acceptedNumber) < TOLERANCE;
      }
      return user === accepted;
    });
  }

  function isBlank(text) {
    return normalize(text) === '';
  }

  var api = { normalize: normalize, parseNumber: parseNumber, isCorrect: isCorrect, isBlank: isBlank };
  AQ.checker = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
