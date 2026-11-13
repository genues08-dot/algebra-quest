// The mascot: the pets a player can pick, their pictures, and what they say. Nothing here touches the page,
// reads the clock, or makes random numbers. Where a line is picked from a list, the caller
// passes a number from 0 up to (not including) 1.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};

  // The axolotl's colors. A save's settings.mascot.color is always one of these, so an app from
  // before the other pets can still read the save. Another pet is kept in settings.mascot.look.
  var COLORS = ['pink', 'purple', 'blue'];
  var MOODS = ['happy', 'cheer', 'encourage', 'think'];
  var DEFAULT = { color: 'pink', name: 'Axl' };
  var NAME_MAX = 16;

  // The pets, each with a starting name and 3 colors. A look names a pet in a color: the axolotl's
  // looks are its plain colors, and every other look is "<pet>-<color>", as in "duck-pekin".
  // Pictures: img/axl/<color>-<mood>.png for the axolotl, img/pets/<look>-<mood>.png and
  // img/pets/<look>-thumb.png for the rest (made by tools/cut-pets.js).
  var PETS = [
    { id: 'axolotl', label: 'Axolotl', name: 'Axl', colors: [['pink', 'Pink'], ['purple', 'Purple'], ['blue', 'Blue']] },
    { id: 'duck', label: 'Duck', name: 'Ducky', colors: [['pekin', 'Pekin'], ['mallard', 'Mallard'], ['black', 'Black Duck']] },
    { id: 'horse', label: 'Horse', name: 'Pony', colors: [['bay', 'Bay'], ['palomino', 'Palomino'], ['gray', 'Gray']] },
    { id: 'chicken', label: 'Chicken', name: 'Nugget', colors: [['buff', 'Buff'], ['white', 'White'], ['black', 'Black']] },
    { id: 'giraffe', label: 'Giraffe', name: 'Stretch', colors: [['golden', 'Golden'], ['chestnut', 'Chestnut'], ['cream', 'Cream']] },
    { id: 'bear', label: 'Bear', name: 'Teddy', colors: [['polar', 'Polar Bear'], ['brown', 'Brown Bear'], ['black', 'Black Bear']] },
    { id: 'fox', label: 'Fox', name: 'Foxy', colors: [['red', 'Red Fox'], ['silver', 'Silver Fox'], ['arctic', 'Arctic Fox']] },
    { id: 'dog', label: 'Dog', name: 'Buddy', colors: [['golden', 'Golden'], ['chocolate', 'Chocolate'], ['black', 'Black']] },
    { id: 'cat', label: 'Cat', name: 'Whiskers', colors: [['orange', 'Orange Tabby'], ['gray', 'Gray Tabby'], ['tuxedo', 'Tuxedo']] },
    { id: 'cow', label: 'Cow', name: 'Moo', colors: [['black-white', 'Black & White'], ['brown-white', 'Brown & White'], ['jersey', 'Jersey']] },
    { id: 'goat', label: 'Goat', name: 'Billy', colors: [['white', 'White'], ['brown', 'Brown'], ['black-white', 'Black & White']] },
    { id: 'hamster', label: 'Hamster', name: 'Peanut', colors: [['golden', 'Golden'], ['cream', 'Cream'], ['black-white', 'Black & White']] },
    { id: 'frog', label: 'Frog', name: 'Hopper', colors: [['green', 'Green Tree Frog'], ['blue', 'Blue Dart Frog'], ['golden', 'Golden Dart Frog']] },
    { id: 'penguin', label: 'Penguin', name: 'Waddles', colors: [['emperor', 'Emperor'], ['rockhopper', 'Rockhopper'], ['little-blue', 'Little Blue']] }
  ];

  // Every look: { id, pet, color, label }, in PETS order.
  var LOOKS = [];
  PETS.forEach(function (pet) {
    pet.colors.forEach(function (pair) {
      LOOKS.push({ id: pet.id === 'axolotl' ? pair[0] : pet.id + '-' + pair[0], pet: pet.id, color: pair[0], label: pair[1] });
    });
  });
  var LOOK_IDS = LOOKS.map(function (look) { return look.id; });

  // The look with this id, or null.
  function lookInfo(id) {
    var index = LOOK_IDS.indexOf(id);
    return index === -1 ? null : LOOKS[index];
  }

  function petById(id) {
    return PETS.filter(function (pet) { return pet.id === id; })[0] || null;
  }

  // The look a save's mascot settings show: its look when it is a known one, else its axolotl color.
  function lookOf(mascot) {
    if (mascot && typeof mascot.look === 'string' && lookInfo(mascot.look)) return mascot.look;
    return mascot && COLORS.indexOf(mascot.color) !== -1 ? mascot.color : DEFAULT.color;
  }

  // New mascot settings showing `look`. A name that is still the old pet's starting name becomes
  // the new pet's starting name; a name the player chose stays.
  function choose(mascot, look) {
    var info = lookInfo(look);
    if (!info) return mascot;
    var oldPet = petById(lookInfo(lookOf(mascot)).pet);
    var newPet = petById(info.pet);
    var name = mascot.name === oldPet.name ? newPet.name : mascot.name;
    if (info.pet === 'axolotl') return { color: info.color, name: name };
    return { color: COLORS.indexOf(mascot.color) !== -1 ? mascot.color : DEFAULT.color, look: look, name: name };
  }

  var LINES = {
    tap: [
      "LET'S GO! Algebra time!",
      "You've got this, I believe in you!",
      'One more lesson? One more lesson!',
      'Math makes my day!',
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

  // Paths are relative to the page, so they work on the website and on the phone page.
  // look is a look id; an unknown one shows the default axolotl.
  function imagePath(look, mood) {
    var info = lookInfo(look) || lookInfo(DEFAULT.color);
    var m = MOODS.indexOf(mood) === -1 ? 'happy' : mood;
    return info.pet === 'axolotl' ? 'img/axl/' + info.color + '-' + m + '.png' : 'img/pets/' + info.id + '-' + m + '.png';
  }

  // A small picture of the look, for the tab bar, the leaderboard, and the pet picker.
  function thumbPath(look) {
    var info = lookInfo(look) || lookInfo(DEFAULT.color);
    return info.pet === 'axolotl' ? imagePath(info.id, 'happy') : 'img/pets/' + info.id + '-thumb.png';
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
    if (!info.hasUnit) return "Hi, I'm " + info.name + "! Let's crush some algebra!";
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
    PETS: PETS,
    LOOKS: LOOKS,
    LOOK_IDS: LOOK_IDS,
    lookInfo: lookInfo,
    petById: petById,
    lookOf: lookOf,
    choose: choose,
    thumbPath: thumbPath,
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
