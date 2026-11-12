// The axolotl mascot: its colors, pictures, and what it says. Nothing here touches the page,
// reads the clock, or makes random numbers. Where a line is picked from a list, the caller
// passes a number from 0 up to (not including) 1.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};

  var COLORS = ['pink', 'purple', 'blue'];
  var MOODS = ['happy', 'cheer', 'encourage', 'think'];
  var DEFAULT = { color: 'pink', name: 'Axl' };
  var NAME_MAX = 16;

  var LINES = {
    tap: [
      "LET'S GO! Algebra time!",
      "You've got this, I believe in you!",
      'One more lesson? One more lesson!',
      'Math makes my gills wiggle!',
      'Big brain energy today!',
      'Every question makes you stronger!'
    ],
    correct: [
      'YESSS! Nailed it!',
      "You're on fire!",
      'Big brain moves!',
      'Correct! Keep it rolling!',
      "That's how it's done!"
    ],
    wrong: [
      'Shake it off! Check the steps.',
      "Almost! Read the solution, you've got this.",
      "Mistakes help you learn. Next one's yours!",
      "No worries! It's in your review pile now."
    ]
  };

  // Paths are relative to the page, so they work from file:// and on the phone page.
  function imagePath(color, mood) {
    var c = COLORS.indexOf(color) === -1 ? DEFAULT.color : color;
    var m = MOODS.indexOf(mood) === -1 ? 'happy' : mood;
    return 'img/axl/' + c + '-' + m + '.png';
  }

  // The name trimmed, or null when it is empty, too long, or not text.
  function cleanName(text) {
    if (typeof text !== 'string') return null;
    var name = text.trim();
    return name.length >= 1 && name.length <= NAME_MAX ? name : null;
  }

  function pick(list, rand) {
    var index = Math.floor(rand * list.length);
    return list[Math.min(Math.max(index, 0), list.length - 1)];
  }

  // `info`: name, hasUnit, goalMet, streak, studiedToday, todayXp, goal, and next (a game.nextStep
  // result plus levelTitle, or null with no unit).
  function homeLine(info) {
    if (!info.hasUnit) return "Hi, I'm " + info.name + "! Import a unit and let's crush some algebra!";
    if (info.goalMet) return "Goal smashed today! You're unstoppable!";
    if (info.streak > 0 && !info.studiedToday) return info.streak + '-day streak! One lesson keeps it alive!';
    if (info.todayXp > 0) return (info.goal - info.todayXp) + " XP to your goal! LET'S GO!";
    var next = info.next;
    if (next.kind === 'done') return "Unit complete! You're an algebra legend!";
    var what = next.kind === 'lesson' ? next.levelTitle : (next.kind === 'test' ? 'the final test' : 'your review pile');
    return 'Ready? Next up: ' + what + '!';
  }

  function teachLine(index, total) {
    if (index === 0) return "Here's the trick!";
    if (index === total - 1) return "Got it? Let's practice!";
    return 'Keep going!';
  }

  // The mood and line for a result screen. `kind` is 'complete', 'failed', or 'test'.
  function result(kind, info) {
    if (kind === 'complete') {
      return { mood: 'cheer', line: info.perfect ? 'PERFECT! Not a single mistake!' : 'Lesson done! You crushed it!' };
    }
    if (kind === 'test' && info.passed) return { mood: 'cheer', line: 'YOU PASSED! I knew you could do it!' };
    if (kind === 'test') return { mood: 'encourage', line: 'So close! Review the misses and come back stronger!' };
    return { mood: 'encourage', line: 'Out of hearts, not out of fight! Read these, then try again.' };
  }

  var api = {
    COLORS: COLORS,
    MOODS: MOODS,
    DEFAULT: DEFAULT,
    NAME_MAX: NAME_MAX,
    LINES: LINES,
    imagePath: imagePath,
    cleanName: cleanName,
    pick: pick,
    homeLine: homeLine,
    teachLine: teachLine,
    result: result
  };
  AQ.mascot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
