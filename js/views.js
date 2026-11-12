// Views: turn data into HTML strings for each screen. Nothing here touches the page.
// Every piece of text that comes from a unit file goes through escapeHtml.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./game.js');
    require('./rewards.js');
    require('./mascot.js');
    require('./mathexpr.js');
    require('./plot.js');
    require('./calc.js');
  }

  var ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (character) { return ESCAPES[character]; });
  }

  // ----- Mascot -----

  // Where each pose's head is, as fractions of its picture: x is the head's centre, y its top,
  // w its width. Measured by eye on the 12 pictures.
  var HEADS = {
    happy: { x: 0.52, y: 0.13, w: 0.46 },
    encourage: { x: 0.52, y: 0.13, w: 0.46 },
    think: { x: 0.55, y: 0.13, w: 0.44 },
    cheer: { x: 0.5, y: 0.15, w: 0.44 },
    'pink-cheer': { x: 0.55, y: 0.14, w: 0.44 }
  };

  // Each hat is drawn in a 100 × 70 box whose bottom edge sits on the head.
  var HAT_SVGS = {
    party: '<polygon points="50,4 76,66 24,66" fill="#FF6B9A"/>' +
      '<path d="M37 36 L63 36 M31 50 L69 50" stroke="#FFE066" stroke-width="5"/>' +
      '<circle cx="50" cy="6" r="7" fill="#FFE066"/>',
    beanie: '<path d="M14 58 C14 20 86 20 86 58 Z" fill="#4C8BF5"/>' +
      '<rect x="10" y="50" width="80" height="16" rx="7" fill="#2F6AD0"/>' +
      '<circle cx="50" cy="20" r="9" fill="#FFFFFF"/>',
    bow: '<path d="M50 50 L22 34 L22 66 Z M50 50 L78 34 L78 66 Z" fill="#FF4D8D"/>' +
      '<circle cx="50" cy="50" r="9" fill="#D6336C"/>',
    grad: '<polygon points="50,20 96,36 50,52 4,36" fill="#2B2540"/>' +
      '<path d="M26 44 L26 62 C40 70 60 70 74 62 L74 44 L50 52 Z" fill="#3B3456"/>' +
      '<path d="M50 36 L84 44 L84 60" stroke="#F2C94C" stroke-width="3" fill="none"/>' +
      '<circle cx="84" cy="62" r="4" fill="#F2C94C"/>',
    wizard: '<path d="M50 2 C56 20 66 40 72 58 L28 58 C34 40 44 20 50 2 Z" fill="#6C4DF5"/>' +
      '<ellipse cx="50" cy="60" rx="46" ry="9" fill="#5236C9"/>' +
      '<path d="M47 30 l3 -7 l3 7 l7 1 l-5 5 l1 7 l-6 -4 l-6 4 l1 -7 l-5 -5 Z" fill="#FFE066"/>',
    crown: '<path d="M14 64 L10 22 L32 40 L50 12 L68 40 L90 22 L86 64 Z" fill="#F2C94C" stroke="#C9A227" stroke-width="3"/>' +
      '<circle cx="50" cy="48" r="6" fill="#D63E8A"/><circle cx="29" cy="52" r="4" fill="#2F80ED"/><circle cx="71" cy="52" r="4" fill="#2E9E4F"/>'
  };
  var HAT_SCALE = 0.72;   // hat width as a share of the head's width
  var HAT_SINK = 0.06;    // how far the hat sits down onto the head, as a share of the picture

  function hatSvg(id) {
    return HAT_SVGS[id] ? '<svg viewBox="0 0 100 70" aria-hidden="true">' + HAT_SVGS[id] + '</svg>' : '';
  }

  // The axolotl picture, with its hat when one is worn. cls is the picture's class.
  function axlImgHtml(color, mood, hat, cls, alt) {
    var img = '<img class="' + cls + '" src="' + AQ.mascot.imagePath(color, mood) + '" alt="' + escapeHtml(alt || '') + '">';
    if (!hat || !HAT_SVGS[hat]) return img;
    var head = HEADS[color + '-' + mood] || HEADS[mood] || HEADS.happy;
    var width = head.w * HAT_SCALE;
    var top = head.y + HAT_SINK - width * 0.7;
    return '<span class="axl-wrap">' + img +
      '<span class="axl-hat" style="left:' + ((head.x - width / 2) * 100).toFixed(1) + '%;top:' + (top * 100).toFixed(1) +
        '%;width:' + (width * 100).toFixed(1) + '%">' + hatSvg(hat) + '</span>' +
    '</span>';
  }

  // m: { color, name, mood, line, size ('big' or 'small'), tap, bounce }. A tappable mascot is a
  // button; the line sits in a speech bubble beside it.
  function mascotHtml(m) {
    var classes = 'mascot mascot-' + (m.size || 'small') + ' mascot-' + m.mood + (m.bounce ? ' mascot-bounce' : '');
    var img = axlImgHtml(m.color, m.mood, m.hat, 'mascot-img', m.name);
    var figure = m.tap ?
      '<button type="button" class="mascot-button" data-action="mascot-tap" aria-label="Talk to ' + escapeHtml(m.name) + '">' + img + '</button>' :
      img;
    return '<div class="' + classes + '">' + figure +
      (m.line ? '<p class="mascot-bubble">' + escapeHtml(m.line) + '</p>' : '') +
    '</div>';
  }

  // The mascot settings on the save, or the default for a save made before there was one.
  function mascotOf(save) {
    return save.settings && save.settings.mascot ? save.settings.mascot : AQ.mascot.DEFAULT;
  }

  // The Mascot screen: pick a color, change the name. model: { color, name, error }.
  function mascotScreenHtml(model) {
    var colors = AQ.mascot.COLORS.map(function (color) {
      var chosen = color === model.color;
      return '<button type="button" class="mascot-choice' + (chosen ? ' mascot-chosen' : '') + '" data-action="mascot-color"' +
        ' data-color="' + color + '" aria-pressed="' + chosen + '">' +
        axlImgHtml(color, 'happy', model.hat, 'mascot-choice-img', '') +
        '<span class="mascot-choice-name">' + color.charAt(0).toUpperCase() + color.slice(1) + '</span>' +
      '</button>';
    }).join('');
    return '<section class="mascot-screen">' +
      '<header class="badges-bar">' +
        '<button type="button" class="btn" data-action="home">Home</button>' +
        '<h1 class="badges-title">Your axolotl</h1>' +
      '</header>' +
      '<h2 class="mascot-heading">Color</h2>' +
      '<div class="mascot-colors">' + colors + '</div>' +
      '<h2 class="mascot-heading"><label for="mascot-name">Name</label></h2>' +
      '<div class="mascot-name-row">' +
        '<input type="text" id="mascot-name" class="answer mascot-name" data-role="mascot-name" autocomplete="off" spellcheck="false"' +
          ' maxlength="' + AQ.mascot.NAME_MAX + '" value="' + escapeHtml(model.name) + '">' +
        '<button type="button" class="btn btn-primary" data-action="mascot-name">Save name</button>' +
      '</div>' +
      (model.error ? '<p class="calc-error" role="alert">' + escapeHtml(model.error) + '</p>' : '') +
    '</section>';
  }

  // ----- Home screen -----

  var LEVEL_COLORS = 6;

  // today is the local date "YYYY-MM-DD", for today's XP and the week strip.
  function homeModel(save, today) {
    var rank = AQ.game.rankForXp(save.xp);
    var badges = save.badges || {};
    var model = {
      rank: rank,
      xp: save.xp,
      xpIntoRank: AQ.game.xpIntoRank(save.xp),
      xpPerRank: AQ.game.CONSTANTS.XP_PER_RANK,
      streak: save.streak,
      title: AQ.game.rankTitle(rank),
      todayXp: AQ.game.todayXp(save, today),
      goal: AQ.game.goalOf(save),
      week: AQ.game.weekStrip(save, today),
      units: Object.keys(save.units).map(function (id) {
        return { id: id, title: save.units[id].title };
      }),
      currentUnitId: save.currentUnitId,
      lessonsDone: Object.keys(save.progress).reduce(function (sum, id) {
        return sum + save.progress[id].completedLessons.length;
      }, 0),
      reviewCount: 0,
      levels: [],
      test: null,
      next: null,
      soundOn: !save.settings || save.settings.sound !== false,
      darkOn: Boolean(save.settings) && save.settings.theme === 'dark',
      badgeCount: AQ.game.BADGES.filter(function (badge) { return has(badges, badge.id); }).length,
      badgeTotal: AQ.game.BADGES.length,
      gems: save.gems || 0,
      freezes: save.freezes || 0,
      bestCombo: save.bestCombo || 0,
      claimable: claimableCount(save, today),
      finishedLessons: 0,
      speedBest: null
    };
    var mascot = mascotOf(save);
    model.mascot = { color: mascot.color, name: mascot.name, line: '', hat: save.outfits ? save.outfits.worn : null };
    var lineInfo = {
      name: mascot.name,
      hasUnit: save.currentUnitId !== null,
      goalMet: model.todayXp >= model.goal,
      streak: save.streak,
      studiedToday: Boolean(save.days && has(save.days, today) && save.days[today].studied),
      todayXp: model.todayXp,
      goal: model.goal,
      next: null
    };
    if (save.currentUnitId === null) {
      model.mascot.line = AQ.mascot.homeLine(lineInfo);
      return model;
    }

    var unit = save.units[save.currentUnitId];
    var progress = save.progress[unit.id];
    var stars = progress.stars || {};
    var states = AQ.game.levelStates(unit, progress);
    model.reviewCount = progress.review.length;
    model.finishedLessons = progress.completedLessons.length;
    model.speedBest = typeof progress.speedBest === 'number' ? progress.speedBest : null;
    model.next = AQ.game.nextStep(unit, progress);
    lineInfo.next = model.next;
    model.mascot.line = AQ.mascot.homeLine(lineInfo);
    var nextLessonId = model.next.kind === 'lesson' ? model.next.lessonId : null;
    if (AQ.units.testQuestions(unit).length > 0) {
      model.test = {
        state: AQ.game.isTestUnlocked(unit, progress) ? 'open' : 'locked',
        best: typeof progress.testBest === 'number' ? progress.testBest : null
      };
    }
    model.levels = unit.levels.map(function (level, levelIndex) {
      return {
        title: level.title,
        state: states[levelIndex],
        color: levelIndex % LEVEL_COLORS,
        hasNotes: level.lessons.some(function (lesson) { return Boolean(lesson.teach && lesson.teach.length); }),
        chest: AQ.rewards.chestState(unit, progress, levelIndex),
        chestGems: AQ.rewards.chestGems(levelIndex),
        lessons: level.lessons.map(function (lesson, lessonIndex) {
          var complete = progress.completedLessons.indexOf(lesson.id) !== -1;
          return {
            id: lesson.id,
            number: lessonIndex + 1,
            complete: complete,
            next: lesson.id === nextLessonId,
            // Lessons finished before stars were kept count as 1 star.
            stars: complete ? (has(stars, lesson.id) ? stars[lesson.id] : 1) : 0
          };
        })
      };
    });
    return model;
  }

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  // How many rewards wait on the Quests tab: finished quests, the week reward, the challenge.
  function claimableCount(save, today) {
    var count = AQ.rewards.questStatus(save, today).filter(function (q) { return q.done && !q.claimed; }).length;
    if (AQ.rewards.weekRewardStatus(save, today).canClaim) count++;
    var challenge = AQ.rewards.challengeStatus(save, today);
    if (challenge.beaten && !challenge.claimed) count++;
    return count;
  }

  var RING_RADIUS = 18;
  var RING_LENGTH = 2 * Math.PI * RING_RADIUS;

  // A goal ring filled with today's XP, stopping at full. center is the text inside it.
  function ringSvg(model, cls, center) {
    var fraction = Math.min(model.todayXp / model.goal, 1);
    var offset = Math.round(RING_LENGTH * (1 - fraction) * 10) / 10;
    var circle = ' cx="22" cy="22" r="' + RING_RADIUS + '"';
    return '<svg class="' + cls + '" viewBox="0 0 44 44" role="img" aria-label="' + model.todayXp + ' of ' + model.goal + ' XP today">' +
      '<circle class="goal-track"' + circle + '></circle>' +
      '<circle class="goal-fill"' + circle + ' transform="rotate(-90 22 22)"' +
        ' stroke-dasharray="' + (Math.round(RING_LENGTH * 10) / 10) + '" stroke-dashoffset="' + offset + '"></circle>' +
      (center ? '<text class="goal-number" x="22" y="22">' + center + '</text>' : '') +
    '</svg>';
  }

  // The daily goal ring with its text and Goal button, on Profile.
  function goalHtml(model) {
    var met = model.todayXp >= model.goal;
    return '<div class="goal' + (met ? ' goal-met' : '') + '">' +
      ringSvg(model, 'goal-ring', met ? '&#10003;' : String(model.todayXp)) +
      '<div class="goal-text">' + (met ? 'Goal met!' : model.todayXp + ' / ' + model.goal + ' XP today') + '</div>' +
      '<button type="button" class="btn btn-quiet goal-button" data-action="cycle-goal">Goal: ' + model.goal + ' XP</button>' +
    '</div>';
  }

  // The bar pinned to the top of home: rank, streak, today's XP, and the review pile.
  function statsBarHtml(model) {
    var met = model.todayXp >= model.goal;
    return '<header class="statsbar">' +
      '<button type="button" class="stat stat-rank tier-' + model.title.tier + '" data-action="open-profile"' +
        ' aria-label="Rank ' + model.rank + ', ' + escapeHtml(model.title.name) + '">' +
        '<span class="stat-badge">' + model.rank + '</span>' +
        '<span class="stat-label rank-title-text">' + escapeHtml(model.title.name) + '</span>' +
      '</button>' +
      '<button type="button" class="stat stat-streak' + (model.streak > 0 ? '' : ' stat-off') + '" data-action="open-profile"' +
        ' aria-label="' + model.streak + '-day streak' + (model.freezes > 0 ? ', ' + model.freezes + ' streak freeze' + (model.freezes === 1 ? '' : 's') : '') + '">' +
        '<span class="stat-icon" aria-hidden="true">&#128293;</span><span class="stat-value">' + model.streak + '</span>' +
        (model.freezes > 0 ? '<span class="stat-freeze" aria-hidden="true">&#10052;</span>' : '') +
      '</button>' +
      '<button type="button" class="stat stat-goal' + (met ? ' goal-met' : '') + '" data-action="open-profile"' +
        ' aria-label="' + model.todayXp + ' of ' + model.goal + ' XP today">' +
        ringSvg(model, 'stat-ring', '') + '<span class="stat-value">' + model.todayXp + '</span>' +
      '</button>' +
      '<button type="button" class="stat stat-gems" data-action="open-shop" aria-label="' + model.gems + ' gems, open the shop">' +
        '<span class="stat-icon" aria-hidden="true">&#128142;</span><span class="stat-value">' + model.gems + '</span>' +
      '</button>' +
      '<button type="button" class="stat stat-review" data-action="open-practice"' +
        ' aria-label="' + model.reviewCount + ' questions to review">' +
        '<span class="stat-icon" aria-hidden="true">&#128257;</span><span class="stat-value">' + model.reviewCount + '</span>' +
      '</button>' +
    '</header>';
  }

  var WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function weekdayName(date) {
    return WEEKDAY_NAMES[new Date(date + 'T00:00:00Z').getUTCDay()];
  }

  // The streak count and the last seven days, on Profile.
  function weekHtml(model) {
    var days = model.streak === 1 ? 'day' : 'days';
    var dots = model.week.map(function (day) {
      var status = day.studied ? 'studied' : (day.frozen ? 'streak freeze used' : 'not studied');
      return '<span class="day' + (day.studied ? ' day-studied' : '') + (day.frozen ? ' day-frozen' : '') + (day.today ? ' day-today' : '') + '"' +
        ' role="img" aria-label="' + weekdayName(day.date) + (day.today ? ', today' : '') + ': ' + status + '">' +
        '<span class="day-dot">' + (day.frozen ? '&#10052;' : '') + '</span><span class="day-letter">' + day.letter + '</span>' +
      '</span>';
    }).join('');
    return '<section class="week">' +
      '<div class="streak' + (model.streak > 0 ? ' streak-on' : '') + '">' +
        '<div class="streak-count">' + model.streak + '</div>' +
        '<div class="streak-label">' + days + ' in a row</div>' +
      '</div>' +
      '<div class="week-days">' + dots + '</div>' +
    '</section>';
  }

  function unitBarHtml(model) {
    var options = model.units.map(function (unit) {
      var selected = unit.id === model.currentUnitId ? ' selected' : '';
      return '<option value="' + escapeHtml(unit.id) + '"' + selected + '>' + escapeHtml(unit.title) + '</option>';
    }).join('');
    return '<section class="unit-bar">' +
      '<label class="unit-label" for="unit-select">Unit</label>' +
      '<select id="unit-select" class="unit-select" data-action="select-unit">' + options + '</select>' +
    '</section>';
  }

  // The Continue button, which does model.next. Nothing left: a note instead.
  function resumeHtml(next) {
    if (!next) return '';
    if (next.kind === 'done') {
      return '<section class="resume"><p class="resume-done">Unit complete! Every lesson is done.</p></section>';
    }
    var label = 'Continue';
    var detail = '';
    if (next.kind === 'lesson') {
      detail = 'Level ' + next.levelNumber + ' · Lesson ' + next.lessonNumber + ': ' + escapeHtml(next.levelTitle);
    } else if (next.kind === 'test') {
      label = 'Take the final test';
    } else {
      label = 'Review missed questions (' + next.count + ')';
    }
    return '<section class="resume">' +
      '<button type="button" class="btn btn-primary btn-resume" data-action="resume">' +
        '<span class="resume-label">' + label + '</span>' +
        (detail ? '<span class="resume-detail">' + detail + '</span>' : '') +
      '</button>' +
    '</section>';
  }

  // Node offsets along the winding path, repeated. One step is drawn as 48px by the CSS.
  var PATH_SHIFTS = [0, 1, 2, 1, 0, -1, -2, -1];

  function pathShift(index) {
    return PATH_SHIFTS[index % PATH_SHIFTS.length];
  }

  // The mascot beside the path, on the side away from the circle, with its line above it.
  function pathAxlHtml(mascot, shift) {
    var side = shift > 0 ? 'left' : (shift < 0 ? 'right' : 'left');
    return '<div class="mascot mascot-big path-axl path-axl-' + side + (mascot.bounce ? ' mascot-bounce' : '') + '">' +
      '<p class="mascot-bubble path-bubble">' + escapeHtml(mascot.line) + '</p>' +
      '<button type="button" class="mascot-button" data-action="mascot-tap" aria-label="Talk to ' + escapeHtml(mascot.name) + '">' +
        axlImgHtml(mascot.color, 'happy', mascot.hat, 'mascot-img', mascot.name) +
      '</button>' +
    '</div>';
  }

  // A path row. withAxl puts the mascot beside it and marks it as the spot home scrolls to.
  function pathRowHtml(spot, shift, model, withAxl, extraClass) {
    return '<div class="path-row' + (extraClass ? ' ' + extraClass : '') + (withAxl ? ' path-row-axl" data-current="true' : '') + '">' +
      '<div class="path-spot" style="--shift:' + shift + '">' + spot + '</div>' +
      (withAxl ? pathAxlHtml(model.mascot, shift) : '') +
    '</div>';
  }

  function starsHtml(count) {
    var html = '';
    for (var i = 1; i <= 3; i++) html += '<span class="node-star' + (i <= count ? ' node-star-on' : '') + '">&#9733;</span>';
    return '<div class="node-stars" aria-hidden="true">' + html + '</div>';
  }

  function lessonNodeHtml(level, lesson) {
    var locked = level.state === 'locked';
    var kind = lesson.complete ? 'done' : (lesson.next ? 'next' : (locked ? 'locked' : 'open'));
    var status = { done: 'complete, ' + lesson.stars + ' of 3 stars', next: 'start here', locked: 'locked', open: 'not started' }[kind];
    return '<button type="button" class="node node-' + kind + '" data-action="start-lesson"' +
        ' data-lesson-id="' + escapeHtml(lesson.id) + '"' +
        ' aria-label="' + escapeHtml(level.title) + ', lesson ' + lesson.number + ', ' + status + '"' +
        (locked ? ' disabled' : '') + '>' +
        (lesson.next ? '<span class="node-start">Start</span>' : '') +
        '<span class="node-face" aria-hidden="true">&#9733;</span>' +
      '</button>' +
      (lesson.complete ? starsHtml(lesson.stars) : '');
  }

  // The final test, as a trophy circle at the end of the path.
  function trophyHtml(test) {
    var locked = test.state === 'locked';
    return '<button type="button" class="node node-trophy test-' + test.state + '" data-action="start-test"' +
        ' aria-label="Final test' + (locked ? ', locked until every level is complete' : '') + '"' +
        (locked ? ' disabled' : '') + '>' +
        '<span class="node-face" aria-hidden="true">&#127942;</span>' +
      '</button>' +
      '<div class="test-info">' +
        '<h2 class="test-title">Final test</h2>' +
        '<span class="test-best">' + (test.best === null ? 'Not taken yet' : 'Best: ' + test.best + '%') + '</span>' +
      '</div>';
  }

  // A chest drawn in SVG, closed or with its lid up.
  function chestSvg(open) {
    return '<svg class="chest-svg" viewBox="0 0 64 56" aria-hidden="true">' +
      '<rect x="6" y="24" width="52" height="28" rx="5" fill="#B9733A"/>' +
      '<rect x="6" y="24" width="52" height="8" fill="#9C5E2C"/>' +
      (open ? '<path d="M8 22 L14 4 L56 4 L58 22 Z" fill="#D08A4C"/><ellipse cx="32" cy="24" rx="20" ry="4" fill="#FFE066"/>' :
        '<path d="M6 26 C6 8 58 8 58 26 Z" fill="#D08A4C"/>') +
      '<rect x="27" y="' + (open ? 28 : 20) + '" width="10" height="12" rx="2" fill="#F2C94C"/>' +
    '</svg>';
  }

  function chestNodeHtml(level, index) {
    var labels = { locked: 'locked until you finish lessons 1 and 2', ready: 'ready to open', open: 'opened' };
    return '<button type="button" class="node node-chest chest-' + level.chest + '" data-action="open-chest" data-level="' + index + '"' +
      ' aria-label="Chest for level ' + (index + 1) + ', ' + labels[level.chest] + '"' + (level.chest === 'ready' ? '' : ' disabled') + '>' +
      chestSvg(level.chest === 'open') +
    '</button>';
  }

  var LEVEL_STATE_LABELS = { locked: 'Locked &#128274;', open: '', complete: 'Complete &#10003;' };

  function levelBannerHtml(level, index) {
    return '<div class="level-banner">' +
      '<div class="level-banner-text">' +
        '<div class="level-kicker">Level ' + (index + 1) +
          (level.state === 'open' ? '' : ' · <span class="level-state">' + LEVEL_STATE_LABELS[level.state] + '</span>') + '</div>' +
        '<h2 class="level-title">' + escapeHtml(level.title) + '</h2>' +
      '</div>' +
      (level.hasNotes ? '<button type="button" class="level-notes" data-action="open-guide" data-level="' + index + '"' +
        ' aria-label="Notes for level ' + (index + 1) + '"><span aria-hidden="true">&#128214;</span><span class="level-notes-label" aria-hidden="true">Notes</span></button>' : '') +
    '</div>';
  }

  function pathHtml(model) {
    // Where the mascot stands: the next lesson, else the trophy, else the last lesson.
    var lastId = null;
    model.levels.forEach(function (level) { level.lessons.forEach(function (lesson) { lastId = lesson.id; }); });
    var nextId = model.next && model.next.kind === 'lesson' ? model.next.lessonId : null;
    var axlAt = nextId || (model.test ? 'trophy' : lastId);
    var index = 0;
    var levels = model.levels.map(function (level, levelIndex) {
      var rows = level.lessons.map(function (lesson, lessonIndex) {
        var row = pathRowHtml(lessonNodeHtml(level, lesson), pathShift(index++), model, lesson.id === axlAt);
        if (lessonIndex === 1 && level.chest) row += pathRowHtml(chestNodeHtml(level, levelIndex), pathShift(index++), model, false, 'path-chest');
        return row;
      }).join('');
      return '<section class="path-level level-' + level.state + ' lc-' + level.color + '">' +
        levelBannerHtml(level, levelIndex) + rows +
      '</section>';
    }).join('');
    var trophy = model.test ? pathRowHtml(trophyHtml(model.test), pathShift(index), model, axlAt === 'trophy', 'path-trophy') : '';
    return '<div class="path">' + levels + trophy + '</div>';
  }

  // ----- Tab bar and the tab screens -----

  var TABS = [
    { id: 'home', action: 'home', label: 'Home', icon: '&#127968;' },
    { id: 'quests', action: 'open-quests', label: 'Quests', icon: '&#127919;' },
    { id: 'practice', action: 'open-practice', label: 'Practice', icon: '&#128170;' },
    { id: 'badges', action: 'open-badges', label: 'Badges', icon: '&#127941;' },
    { id: 'profile', action: 'open-profile', label: 'Profile', icon: null },
    { id: 'more', action: 'open-more', label: 'More', icon: '&#8943;' }
  ];

  // The bar pinned to the bottom of the main screens. The Profile tab shows the player's axolotl.
  // dot: how many rewards wait on the Quests tab (a red dot shows when it is more than 0).
  function tabBarHtml(active, mascotColor, dot) {
    return '<nav class="tabbar" aria-label="Main">' + TABS.map(function (tab) {
      var on = tab.id === active;
      var waiting = tab.id === 'quests' && dot > 0;
      var icon = tab.icon ||
        '<img class="tab-axl" src="' + AQ.mascot.imagePath(mascotColor, 'happy') + '" alt="">';
      return '<button type="button" class="tab' + (on ? ' tab-active' : '') + '" data-action="' + tab.action + '"' +
        (on ? ' aria-current="page"' : '') + '>' +
        '<span class="tab-icon" aria-hidden="true">' + icon + (waiting ? '<span class="tab-dot"></span>' : '') + '</span>' +
        '<span class="tab-label">' + tab.label + (waiting ? '<span class="visually-hidden"> (rewards waiting)</span>' : '') + '</span>' +
      '</button>';
    }).join('') + '</nav>';
  }

  function screenHeadHtml(title, note) {
    return '<header class="screen-head"><h1 class="screen-title">' + title + '</h1>' +
      (note ? '<p class="screen-note">' + note + '</p>' : '') + '</header>';
  }

  function homeHtml(model) {
    var tabs = tabBarHtml('home', model.mascot.color, model.claimable);
    if (model.units.length === 0) {
      return statsBarHtml(model) +
        '<section class="empty">' +
          mascotHtml(Object.assign({ mood: 'happy', size: 'big', tap: true }, model.mascot)) +
          '<button type="button" class="btn btn-primary btn-big" data-action="import">Import a unit to start</button>' +
        '</section>' + tabs;
    }
    return statsBarHtml(model) +
      unitBarHtml(model) +
      resumeHtml(model.next) +
      pathHtml(model) +
      '<button type="button" class="jump" data-action="jump" aria-label="Jump to your next lesson">&#11015;</button>' +
      tabs;
  }

  // A big card on the Practice screen.
  function practiceCardHtml(icon, title, note, button) {
    return '<section class="practice-card">' +
      '<div class="practice-icon" aria-hidden="true">' + icon + '</div>' +
      '<div class="practice-text"><h2 class="practice-title">' + title + '</h2><p class="practice-note">' + note + '</p></div>' +
      button +
    '</section>';
  }

  function practiceHtml(model) {
    var cards = '';
    if (model.currentUnitId !== null) {
      cards += practiceCardHtml('&#128257;', 'Mistakes',
        model.reviewCount === 0 ? 'No missed questions right now.' : model.reviewCount + ' missed ' + (model.reviewCount === 1 ? 'question comes' : 'questions come') + ' back here.',
        '<button type="button" class="btn btn-primary" data-action="start-review"' + (model.reviewCount === 0 ? ' disabled' : '') + '>' +
          'Review (' + model.reviewCount + ')</button>');
      if (model.test) {
        cards += practiceCardHtml('&#127942;', 'Final test',
          model.test.state === 'locked' ? 'Unlocks when every level is complete.' :
            (model.test.best === null ? 'Not taken yet.' : 'Best: ' + model.test.best + '%'),
          '<button type="button" class="btn btn-primary" data-action="start-test"' + (model.test.state === 'locked' ? ' disabled' : '') + '>Start test</button>');
      }
    }
    if (model.currentUnitId !== null) {
      var none = model.finishedLessons === 0;
      cards += practiceCardHtml('&#9194;', 'Unit Rewind',
        none ? 'Finish a lesson first.' : '10 questions from lessons you finished. +' + AQ.game.CONSTANTS.XP_REWIND_BONUS + ' XP bonus.',
        '<button type="button" class="btn btn-primary" data-action="start-rewind"' + (none ? ' disabled' : '') + '>Start +' +
          AQ.game.CONSTANTS.XP_REWIND_BONUS + ' XP</button>');
      cards += practiceCardHtml('&#9201;', 'Speed Round',
        none ? 'Finish a lesson first.' : 'Answer as many as you can in ' + AQ.game.CONSTANTS.SPEED_SECONDS + ' seconds.' +
          (model.speedBest !== null ? ' Best: ' + model.speedBest + '.' : ''),
        '<button type="button" class="btn btn-primary" data-action="start-speed"' + (none ? ' disabled' : '') + '>Go!</button>');
    }
    cards += practiceCardHtml('&#129518;', 'Calculator', 'Numbers, trig, and graphs.',
      '<button type="button" class="btn" data-action="open-calculator">Open</button>');
    return '<section class="tab-screen">' + screenHeadHtml('Practice', 'Sharpen up between lessons.') + cards + '</section>' +
      tabBarHtml('practice', model.mascot.color, model.claimable);
  }

  function statHtml(value, label) {
    return '<div class="profile-stat"><div class="profile-stat-value">' + value + '</div><div class="profile-stat-label">' + label + '</div></div>';
  }

  function profileHtml(model) {
    var percent = Math.round(100 * model.xpIntoRank / model.xpPerRank);
    var best = model.test && model.test.best !== null ? model.test.best + '%' : '–';
    return '<section class="tab-screen profile">' +
      '<header class="profile-head">' +
        axlImgHtml(model.mascot.color, 'happy', model.mascot.hat, 'profile-axl', '') +
        '<div class="profile-who">' +
          '<h1 class="screen-title">' + escapeHtml(model.mascot.name) + '</h1>' +
          '<button type="button" class="btn btn-quiet" data-action="open-mascot">Change color or name</button>' +
          '<button type="button" class="btn btn-primary profile-shop" data-action="open-shop">&#128142; Shop</button>' +
        '</div>' +
      '</header>' +
      '<section class="profile-card">' +
        '<div class="rank-head">' +
          '<span class="rank-title tier-' + model.title.tier + '">' + escapeHtml(model.title.name) + '</span>' +
          '<span class="rank-name">Rank ' + model.rank + '</span>' +
        '</div>' +
        '<div class="xp-bar"><div class="xp-fill" style="width:' + percent + '%"></div></div>' +
        '<div class="xp-text">' + model.xpIntoRank + ' / ' + model.xpPerRank + ' XP</div>' +
      '</section>' +
      '<section class="profile-card profile-goal">' + goalHtml(model) + '</section>' +
      weekHtml(model) +
      '<section class="profile-stats">' +
        statHtml(model.xp, 'total XP') +
        statHtml(model.lessonsDone, 'lessons done') +
        statHtml(best, 'best test') +
        statHtml(model.badgeCount + '/' + model.badgeTotal, 'badges') +
        statHtml('&#128142; ' + model.gems, 'gems') +
        statHtml('&#10052; ' + model.freezes, 'streak freezes') +
        statHtml(model.bestCombo, 'best combo') +
        statHtml(model.speedBest === null ? '–' : model.speedBest, 'Speed Round best') +
      '</section>' +
    '</section>' + tabBarHtml('profile', model.mascot.color, model.claimable);
  }

  function barHtml(value, target, cls) {
    var percent = target > 0 ? Math.min(100, Math.round(100 * value / target)) : 0;
    return '<div class="qbar' + (cls ? ' ' + cls : '') + '"><div class="qbar-fill" style="width:' + percent + '%"></div></div>';
  }

  // model: homeModel plus quests (questStatus), week (weekRewardStatus), challenge (challengeStatus),
  // hoursLeft (until midnight), and note (a message after a claim, or null).
  function questsHtml(model) {
    var quests = model.quests.map(function (q) {
      var button = q.claimed ? '<span class="quest-done">&#10003; Claimed</span>' :
        (q.done ? '<button type="button" class="btn btn-primary" data-action="claim-quest" data-quest="' + q.id + '">Claim ' + q.gems + ' &#128142;</button>' :
          '<span class="quest-reward">' + q.gems + ' &#128142;</span>');
      return '<li class="quest' + (q.done && !q.claimed ? ' quest-ready' : '') + '">' +
        '<div class="quest-text"><div class="quest-title">' + escapeHtml(q.text) + '</div>' +
          barHtml(q.progress, q.target) + '<div class="quest-count">' + q.progress + ' / ' + q.target + '</div></div>' +
        button +
      '</li>';
    }).join('');
    var slots = model.week.slots.map(function (slot, index) {
      return '<li class="week-slot slot-' + slot.state + '" aria-label="Day ' + (index + 1) + ': ' + slot.gems + ' gems, ' + slot.state + '">' +
        '<span class="slot-day">' + (index + 1) + '</span>' +
        '<span class="slot-icon" aria-hidden="true">' + (slot.state === 'claimed' ? '&#10003;' : (index === 6 ? '&#127873;' : '&#128142;')) + '</span>' +
        '<span class="slot-gems">' + slot.gems + '</span>' +
      '</li>';
    }).join('');
    var weekButton = model.week.canClaim ?
      '<button type="button" class="btn btn-primary" data-action="claim-week">Claim today&#39;s reward</button>' :
      '<p class="screen-note">' + (model.week.slots.some(function (s) { return s.state === 'waiting'; }) ?
        'Finish a lesson today to claim today&#39;s reward.' : 'Come back tomorrow for the next one.') + '</p>';
    var c = model.challenge;
    var challengeButton = c.claimed ? '<span class="quest-done">&#10003; Claimed</span>' :
      (c.beaten ? '<button type="button" class="btn btn-primary" data-action="claim-challenge">Claim ' + c.gems + ' &#128142;</button>' :
        '<p class="screen-note">Earn ' + (c.target - c.thisWeek) + ' more XP this week to win ' + c.gems + ' &#128142;.</p>');
    return '<section class="tab-screen quests">' +
      '<header class="quests-head"><h1 class="screen-title">Quests</h1><p>Finish quests to earn gems!</p></header>' +
      (model.note ? '<p class="quest-note" role="status">' + escapeHtml(model.note) + '</p>' : '') +
      '<section class="quest-card">' +
        '<div class="quest-card-head"><h2>Daily quests</h2><span class="quest-timer">&#9200; ' + model.hoursLeft + 'h left</span></div>' +
        '<ul class="quest-list">' + quests + '</ul>' +
      '</section>' +
      '<section class="quest-card">' +
        '<div class="quest-card-head"><h2>Week rewards</h2></div>' +
        '<ul class="week-slots">' + slots + '</ul>' + weekButton +
      '</section>' +
      '<section class="quest-card">' +
        '<div class="quest-card-head"><h2>Weekly challenge</h2></div>' +
        '<p class="challenge-line">Beat last week&#39;s XP</p>' +
        '<div class="challenge-row"><span>This week</span>' + barHtml(c.thisWeek, c.target, 'qbar-this') + '<span>' + c.thisWeek + '</span></div>' +
        '<div class="challenge-row"><span>Last week</span>' + barHtml(c.lastWeek, c.target, 'qbar-last') + '<span>' + c.lastWeek + '</span></div>' +
        challengeButton +
      '</section>' +
    '</section>' + tabBarHtml('quests', model.mascot.color, model.claimable);
  }

  // model: gems, freezes, hats (with owned and worn), mascot, note.
  function shopHtml(model) {
    var maxFreezes = AQ.game.CONSTANTS.MAX_FREEZES;
    var freezeButton = model.freezes >= maxFreezes ? '<span class="quest-done">Full (' + maxFreezes + '/' + maxFreezes + ')</span>' :
      '<button type="button" class="btn btn-primary" data-action="buy-freeze"' + (model.gems < AQ.rewards.FREEZE_PRICE ? ' disabled' : '') + '>' +
        AQ.rewards.FREEZE_PRICE + ' &#128142;</button>';
    var hats = model.hats.map(function (hat) {
      var button = hat.owned ?
        '<button type="button" class="btn' + (hat.worn ? ' btn-primary' : '') + '" data-action="wear-hat" data-hat="' + hat.id + '">' +
          (hat.worn ? 'Take off' : 'Wear') + '</button>' :
        '<button type="button" class="btn btn-primary" data-action="buy-hat" data-hat="' + hat.id + '"' + (model.gems < hat.price ? ' disabled' : '') + '>' +
          hat.price + ' &#128142;</button>';
      return '<li class="shop-item' + (hat.worn ? ' shop-worn' : '') + '">' +
        '<span class="shop-hat">' + hatSvg(hat.id) + '</span>' +
        '<span class="shop-name">' + escapeHtml(hat.name) + '</span>' + button +
      '</li>';
    }).join('');
    return '<section class="tab-screen shop">' +
      '<header class="screen-head badges-bar"><h1 class="screen-title">Shop</h1><span class="shop-gems">&#128142; ' + model.gems + '</span></header>' +
      (model.note ? '<p class="quest-note" role="status">' + escapeHtml(model.note) + '</p>' : '') +
      '<div class="shop-preview">' + axlImgHtml(model.mascot.color, 'happy', model.mascot.hat, 'shop-axl', model.mascot.name) + '</div>' +
      '<section class="practice-card">' +
        '<div class="practice-icon" aria-hidden="true">&#10052;</div>' +
        '<div class="practice-text"><h2 class="practice-title">Streak freeze</h2>' +
          '<p class="practice-note">Saves your streak on a day you miss. You have ' + model.freezes + ' of ' + maxFreezes + '.</p></div>' +
        freezeButton +
      '</section>' +
      '<h2 class="mascot-heading">Hats for ' + escapeHtml(model.mascot.name) + '</h2>' +
      '<ul class="shop-grid">' + hats + '</ul>' +
    '</section>' + tabBarHtml(null, model.mascot.color, model.claimable);
  }

  function moreRowHtml(action, icon, label) {
    return '<button type="button" class="more-row" data-action="' + action + '">' +
      '<span class="more-icon" aria-hidden="true">' + icon + '</span><span class="more-label">' + label + '</span>' +
    '</button>';
  }

  function moreHtml(model) {
    return '<section class="tab-screen">' + screenHeadHtml('More') +
      '<div class="more-list">' +
        moreRowHtml('import', '&#128229;', 'Import') +
        moreRowHtml('backup', '&#128190;', 'Backup') +
        moreRowHtml('toggle-sound', model.soundOn ? '&#128264;' : '&#128263;', 'Sound: ' + (model.soundOn ? 'on' : 'off')) +
        moreRowHtml('toggle-theme', '&#127769;', 'Dark mode: ' + (model.darkOn ? 'on' : 'off')) +
        (model.currentUnitId !== null ? moreRowHtml('remove-unit', '&#128465;', 'Remove this unit') : '') +
      '</div>' +
    '</section>' + tabBarHtml('more', model.mascot.color, model.claimable);
  }

  // ----- Badges screen -----

  var BADGE_ICONS = {
    'first-lesson': '&#128099;', 'perfect': '&#128142;', 'streak-3': '&#128293;', 'streak-7': '&#128293;',
    'streak-30': '&#128293;', 'goal': '&#127919;', 'review-clear': '&#129529;', 'level': '&#11088;',
    'unit': '&#127937;', 'test-pass': '&#9989;', 'test-100': '&#128175;', 'rank-10': '&#128081;'
  };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // "2026-11-03" reads "Nov 3, 2026".
  function formatDate(date) {
    var parts = date.split('-').map(Number);
    return MONTHS[parts[1] - 1] + ' ' + parts[2] + ', ' + parts[0];
  }

  function badgesModel(save, today) {
    var mascotColor = mascotOf(save).color;
    var claimable = today ? claimableCount(save, today) : 0;
    var earned = save.badges || {};
    var badges = AQ.game.BADGES.map(function (badge) {
      return { id: badge.id, name: badge.name, how: badge.how, earned: has(earned, badge.id) ? earned[badge.id] : null };
    });
    return {
      badges: badges,
      count: badges.filter(function (badge) { return badge.earned !== null; }).length,
      total: badges.length,
      mascotColor: mascotColor,
      claimable: claimable
    };
  }

  function badgeIconHtml(id) {
    return '<span class="badge-icon" aria-hidden="true">' + (BADGE_ICONS[id] || '&#11088;') + '</span>';
  }

  function badgesHtml(model) {
    var items = model.badges.map(function (badge) {
      var earned = badge.earned !== null;
      return '<li class="badge ' + (earned ? 'badge-earned' : 'badge-locked') + '">' +
        badgeIconHtml(badge.id) +
        '<span class="badge-name">' + escapeHtml(badge.name) + '</span>' +
        '<span class="badge-how">' + escapeHtml(badge.how) + '</span>' +
        (earned ? '<span class="badge-date">Earned ' + formatDate(badge.earned) + '</span>' : '') +
      '</li>';
    }).join('');
    return '<section class="badges-screen tab-screen">' +
      '<header class="screen-head badges-bar">' +
        '<h1 class="screen-title">Badges</h1>' +
        '<span class="badges-count">' + model.count + ' of ' + model.total + '</span>' +
      '</header>' +
      '<ul class="badge-grid">' + items + '</ul>' +
    '</section>' + tabBarHtml('badges', model.mascotColor, model.claimable);
  }

  // Rank up and new badges, for the result screens. Both are optional on the result.
  function newsHtml(result) {
    var html = '';
    if (result.rankUp) {
      html += '<div class="rank-up tier-' + result.rankUp.tier + '">' +
        '<div class="rank-up-title">Rank up!</div>' +
        '<div class="rank-up-detail">Rank ' + result.rankUp.rank + ' · ' + escapeHtml(result.rankUp.name) + '</div>' +
      '</div>';
    }
    var badges = result.newBadges || [];
    if (badges.length > 0) {
      html += '<div class="new-badges">' +
        '<div class="new-badges-title">' + (badges.length === 1 ? 'New badge!' : 'New badges!') + '</div>' +
        '<ul class="new-badge-list">' + badges.map(function (badge) {
          return '<li class="new-badge">' + badgeIconHtml(badge.id) +
            '<span class="badge-name">' + escapeHtml(badge.name) + '</span>' +
            '<span class="badge-how">' + escapeHtml(badge.how) + '</span>' +
          '</li>';
        }).join('') + '</ul>' +
      '</div>';
    }
    return html;
  }

  // ----- Message screen (errors and notices) -----

  function messageHtml(message) {
    var lines = message.lines.map(function (line) {
      return '<p class="message-line">' + escapeHtml(line) + '</p>';
    }).join('');
    var buttons = message.actions.map(function (action, index) {
      return '<button type="button" class="btn' + (index === 0 ? ' btn-primary' : '') + '"' +
        ' data-action="' + escapeHtml(action.action) + '">' + escapeHtml(action.label) + '</button>';
    }).join('');
    return '<section class="message">' +
      '<h1 class="message-title">' + escapeHtml(message.title) + '</h1>' +
      lines +
      '<div class="message-actions">' + buttons + '</div>' +
    '</section>';
  }

  // ----- Graphs, teaching cards, and the calculator -----

  // `graph` is a unit file graph object: { fn, x, y, numbers }. Returns '' when fn does not compile.
  function graphHtml(graph, label) {
    var compiled = AQ.mathexpr.compile(graph.fn);
    if (!compiled.ok) return '';
    var x = graph.x || [-10, 10];
    var y = graph.y || [-10, 10];
    var svg = AQ.plot.svg({
      evaluate: compiled.evaluate,
      window: { xMin: x[0], xMax: x[1], yMin: y[0], yMax: y[1] },
      numbers: graph.numbers !== false,
      marks: [],
      label: label
    });
    return '<figure class="graph">' + svg + '</figure>';
  }

  // The scientific keypad, in spec order. A key either types `insert` or runs its action.
  function key(label, insert, aria, cls) {
    return { label: label, action: 'calc-key', insert: insert, aria: aria, cls: cls };
  }
  var KEYPAD = [
    { label: 'DEG/RAD', action: 'calc-mode', aria: 'switch degrees and radians', cls: 'calc-k-fn' },
    key('Ans', 'Ans', 'previous answer', 'calc-k-fn'),
    key('(', '(', 'open parenthesis', 'calc-k-fn'),
    key(')', ')', 'close parenthesis', 'calc-k-fn'),
    { label: '←', action: 'calc-back', aria: 'delete', cls: 'calc-k-fn' },
    key('sin', 'sin(', 'sine', 'calc-k-fn'),
    key('cos', 'cos(', 'cosine', 'calc-k-fn'),
    key('tan', 'tan(', 'tangent', 'calc-k-fn'),
    key('π', 'π', 'pi', 'calc-k-fn'),
    { label: 'C', action: 'calc-clear', aria: 'clear', cls: 'calc-k-fn' },
    key('sin⁻¹', 'asin(', 'inverse sine', 'calc-k-fn'),
    key('cos⁻¹', 'acos(', 'inverse cosine', 'calc-k-fn'),
    key('tan⁻¹', 'atan(', 'inverse tangent', 'calc-k-fn'),
    key('e', 'e', 'e', 'calc-k-fn'),
    key('x', 'x', 'x', 'calc-k-fn'),
    key('x²', '^2', 'squared', 'calc-k-fn'),
    key('xʸ', '^', 'power', 'calc-k-fn'),
    key('√', '√(', 'square root', 'calc-k-fn'),
    key('ˣ√', 'root(', 'nth root', 'calc-k-fn'),
    key('|x|', 'abs(', 'absolute value', 'calc-k-fn'),
    key('log', 'log(', 'log base ten', 'calc-k-fn'),
    key('ln', 'ln(', 'natural log', 'calc-k-fn'),
    key('n!', '!', 'factorial', 'calc-k-fn'),
    key('1/x', '^(-1)', 'reciprocal', 'calc-k-fn'),
    key('×10ⁿ', '×10^(', 'times ten to the power', 'calc-k-fn'),
    key('7', '7', '7', 'calc-k-num'),
    key('8', '8', '8', 'calc-k-num'),
    key('9', '9', '9', 'calc-k-num'),
    key('÷', '÷', 'divide', 'calc-k-op'),
    key('(−)', '-', 'negative', 'calc-k-op'),
    key('4', '4', '4', 'calc-k-num'),
    key('5', '5', '5', 'calc-k-num'),
    key('6', '6', '6', 'calc-k-num'),
    key('×', '×', 'times', 'calc-k-op'),
    key(',', ',', 'comma', 'calc-k-op'),
    key('1', '1', '1', 'calc-k-num'),
    key('2', '2', '2', 'calc-k-num'),
    key('3', '3', '3', 'calc-k-num'),
    key('−', '−', 'minus', 'calc-k-op'),
    key('+', '+', 'plus', 'calc-k-op'),
    key('0', '0', '0', 'calc-k-num'),
    key('.', '.', 'decimal point', 'calc-k-num'),
    { label: '=', action: 'calc-run', aria: 'equals', cls: 'calc-k-eq' }
  ];

  function keypadHtml() {
    return '<div class="calc-keypad">' + KEYPAD.map(function (k) {
      return '<button type="button" class="calc-k ' + k.cls + '" data-action="' + k.action + '"' +
        (k.insert !== undefined ? ' data-insert="' + escapeHtml(k.insert) + '"' : '') +
        ' aria-label="' + escapeHtml(k.aria) + '">' + escapeHtml(k.label) + '</button>';
    }).join('') + '</div>';
  }

  // A whole-number result already starts with "= " (such as "= 2"), so it gets no second one.
  function historyLine(entry) {
    if (entry.result === 'graph') return entry.text + ' → graph';
    if (entry.result.indexOf('= ') === 0) return entry.text + ' ' + entry.result;
    return entry.text + ' = ' + entry.result;
  }

  function historyHtml(history) {
    if (!history.length) return '';
    return '<div class="calc-history"><h2 class="calc-history-title">History</h2>' +
      history.map(function (entry, i) {
        var line = historyLine(entry);
        return '<button type="button" class="calc-history-item" data-action="calc-history" data-index="' + i + '">' +
          escapeHtml(line) + '</button>';
      }).join('') + '</div>';
  }

  function calculatorHtml(model) {
    var mode = model.mode === 'rad' ? 'rad' : 'deg';
    var keysShown = model.keysShown !== false;
    var closable = model.closable !== false;
    var history = model.history || [];
    var result = model.result;
    var graphPart = '';
    var resultPart = '';
    if (result && result.kind === 'graph') {
      var marks = result.zeros.map(function (z) { return { x: z, y: 0, kind: 'zero' }; })
        .concat(result.turningPoints.map(function (p) { return { x: p.x, y: p.y, kind: p.kind }; }));
      graphPart = '<figure class="graph">' + AQ.plot.svg({
        evaluate: result.evaluate,
        window: result.window,
        numbers: true,
        marks: marks,
        label: 'Graph of y = ' + model.text
      }) + '</figure>' +
        '<p class="calc-line">' + escapeHtml(result.zerosLine) + '</p>' +
        '<p class="calc-line">' + escapeHtml(result.turningLine) + '</p>' +
        '<div class="calc-zoom">' +
          '<button type="button" class="btn" data-action="calc-zoom-in">Zoom in</button>' +
          '<button type="button" class="btn" data-action="calc-zoom-out">Zoom out</button>' +
          '<button type="button" class="btn" data-action="calc-reset">Reset</button>' +
        '</div>';
    } else if (result && result.kind === 'number') {
      resultPart = '<p class="calc-result">' + escapeHtml(result.display) + '</p>';
    }
    return '<section class="calc-panel">' +
      '<div class="calc-row">' +
        '<input type="text" class="calc-input" data-role="calc-input" autocomplete="off" spellcheck="false"' +
          ' aria-label="Calculator input" placeholder="Try 2+3 or x^2-4" value="' + escapeHtml(model.text) + '">' +
        '<button type="button" class="btn btn-primary" data-action="calc-run">Go</button>' +
        (closable ? '<button type="button" class="btn btn-quiet" data-action="calc-close" aria-label="Close calculator">&#10005;</button>' : '') +
      '</div>' +
      '<div class="calc-modebar"><span class="calc-mode-label">' + (mode === 'rad' ? 'RAD' : 'DEG') + '</span></div>' +
      (model.error ? '<p class="calc-error" role="alert">' + escapeHtml(model.error) + '</p>' : '') +
      resultPart +
      graphPart +
      (keysShown ? keypadHtml() : '') +
      '<button type="button" class="btn btn-quiet calc-keys-toggle" data-action="calc-keys">' + (keysShown ? 'Hide keys' : 'Show keys') + '</button>' +
      historyHtml(history) +
    '</section>';
  }

  function calculatorScreenHtml(model) {
    var screenModel = Object.assign({}, model, { closable: false });
    return '<section class="calc-screen">' +
      '<header class="calc-screen-bar">' +
        '<button type="button" class="btn" data-action="home">Home</button>' +
        '<h1 class="calc-screen-title">Calculator</h1>' +
      '</header>' +
      calculatorHtml(screenModel) +
    '</section>';
  }

  function teachHtml(model) {
    var last = model.index === model.total - 1;
    var paragraphs = (model.text || []).map(function (paragraph) {
      return '<p class="teach-text">' + escapeHtml(paragraph) + '</p>';
    }).join('');
    var example = '';
    if (model.example) {
      example = '<div class="teach-example">' +
        '<p class="teach-problem">' + escapeHtml(model.example.problem) + '</p>' +
        '<ol class="teach-steps">' + model.example.steps.map(function (step) {
          return '<li>' + escapeHtml(step) + '</li>';
        }).join('') + '</ol>' +
      '</div>';
    }
    var graph = model.graph ? graphHtml(model.graph, 'Graph for this card') : '';
    var nextLabel = !last ? 'Next' : (model.guide ? 'Done' : (model.fromNotes ? 'Back to question' : 'Start practice'));
    var skipLabel = model.guide ? 'Close' : (model.fromNotes ? 'Back to question' : 'Skip to questions');
    // The level guide (Notes on a level banner) has its own buttons.
    var act = model.guide ? { back: 'guide-back', next: 'guide-next', skip: 'home' } :
      { back: 'teach-back', next: 'teach-next', skip: 'teach-skip' };
    var coach = model.mascot ? mascotHtml({ color: model.mascot.color, name: model.mascot.name, hat: model.mascot.hat, mood: 'think',
      size: 'small', line: AQ.mascot.teachLine(model.index, model.total) }) : '';
    return '<section class="teach">' +
      coach +
      '<div class="teach-count">' + (model.guide ? escapeHtml(model.guide) + ' · ' : '') + (model.index + 1) + ' of ' + model.total + '</div>' +
      '<h1 class="teach-title">' + escapeHtml(model.title) + '</h1>' +
      paragraphs + example + graph +
      '<div class="teach-actions">' +
        '<button type="button" class="btn" data-action="' + act.back + '"' + (model.index === 0 ? ' disabled' : '') + '>Back</button>' +
        '<button type="button" class="btn btn-primary" data-action="' + act.next + '">' + nextLabel + '</button>' +
      '</div>' +
      '<button type="button" class="btn btn-quiet teach-skip" data-action="' + act.skip + '">' + skipLabel + '</button>' +
    '</section>';
  }

  // Notes and Calculator controls. None of it shows once the question is answered.
  function toolsHtml(model) {
    if (model.locked) return '';
    var notes = model.hasNotes ?
      '<button type="button" class="btn btn-quiet" data-action="notes">Notes</button>' : '';
    var calc = '';
    if (model.calculatorAllowed === true) {
      calc = model.calculatorPanel ? calculatorHtml(model.calculatorPanel) :
        '<button type="button" class="btn btn-quiet" data-action="calc-open">Calculator</button>';
    } else if (model.calculatorAllowed === false) {
      calc = '<p class="calc-note">No calculator for this question.</p>';
    }
    if (!notes && !calc) return '';
    return '<div class="lesson-tools">' + notes + calc + '</div>';
  }

  // ----- Lesson screen -----

  function heartsHtml(hearts, maxHearts) {
    var icons = '';
    for (var i = 0; i < maxHearts; i++) {
      icons += i < hearts ? '<span class="heart">&#9829;</span>' : '<span class="heart heart-lost">&#9825;</span>';
    }
    return '<div class="hearts" aria-label="' + hearts + ' of ' + maxHearts + ' hearts">' + icons + '</div>';
  }

  function choicesHtml(model) {
    var disabled = model.locked ? ' disabled' : '';
    var buttons = model.choices.map(function (choice) {
      var pressed = choice.index === model.selected;
      return '<button type="button" class="choice"' +
        ' data-action="choose" data-index="' + choice.index + '" aria-pressed="' + pressed + '"' + disabled + '>' +
        escapeHtml(choice.text) +
      '</button>';
    }).join('');
    return '<div class="choices">' + buttons + '</div>';
  }

  function answerBoxHtml(model) {
    var value = model.answerText ? ' value="' + escapeHtml(model.answerText) + '"' : '';
    return '<input type="text" class="answer" data-role="answer" autocomplete="off" spellcheck="false"' +
      ' aria-label="Your answer" placeholder="Type your answer"' + value + (model.locked ? ' disabled' : '') + '>';
  }

  // `locked` and `answerText` are optional. A locked lesson shows the question as answered,
  // with no Check or Hint buttons, so a feedback panel can sit under it.
  function lessonHtml(model) {
    if (model.mode === 'speed') return speedQuestionHtml(model);
    var testMode = model.mode === 'test';
    var percent = Math.round(100 * model.done / model.total);
    var buttons = model.locked ? '' : (testMode ?
      '<div class="lesson-actions">' +
        '<button type="button" class="btn" data-action="skip">Skip</button>' +
        '<button type="button" class="btn btn-primary" data-action="check">Submit</button>' +
      '</div>' :
      '<div class="lesson-actions">' +
        '<button type="button" class="btn" data-action="hint">Hint</button>' +
        '<button type="button" class="btn btn-primary" data-action="check">Check</button>' +
      '</div>');
    var top = testMode ?
      '<div class="test-count">Question ' + (model.done + 1) + ' of ' + model.total + '</div>' :
      '<div class="progress" aria-label="Question ' + model.done + ' of ' + model.total + ' done">' +
        '<div class="progress-fill" style="width:' + percent + '%"></div>' +
      '</div>' + heartsHtml(model.hearts, model.maxHearts);
    var toolsModel = model;
    if (testMode) {
      toolsModel = {};
      Object.keys(model).forEach(function (key) { toolsModel[key] = model[key]; });
      toolsModel.hasNotes = false;
    }
    return '<section class="lesson-screen">' +
      '<div class="lesson-top">' +
        '<button type="button" class="btn btn-quiet quit" data-action="quit" aria-label="Quit lesson">&#10005;</button>' +
        top +
      '</div>' +
      '<h1 class="prompt">' + escapeHtml(model.prompt) + '</h1>' +
      (model.graph ? graphHtml(model.graph, 'Graph for this question') : '') +
      (model.type === 'choice' ? choicesHtml(model) : answerBoxHtml(model)) +
      (model.hintVisible && !testMode ? '<p class="hint"><strong>Hint:</strong> ' + escapeHtml(model.hint) + '</p>' : '') +
      toolsHtml(toolsModel) +
      buttons +
    '</section>';
  }

  // A Speed Round question: a draining time bar and the count so far. The bar is a CSS animation
  // started elapsed seconds in, so the page does not redraw every second.
  function speedQuestionHtml(model) {
    var total = AQ.game.CONSTANTS.SPEED_SECONDS;
    var elapsed = Math.min(Math.max(model.elapsed || 0, 0), total);
    return '<section class="lesson-screen speed-screen">' +
      '<div class="lesson-top">' +
        '<button type="button" class="btn btn-quiet quit" data-action="quit" aria-label="Quit Speed Round">&#10005;</button>' +
        '<div class="speed-bar" role="img" aria-label="' + Math.round(total - elapsed) + ' seconds left">' +
          '<div class="speed-fill" style="animation-duration:' + total + 's;animation-delay:-' + elapsed.toFixed(1) + 's"></div>' +
        '</div>' +
        '<div class="speed-count" aria-label="' + model.right + ' right">&#9989; ' + model.right + '</div>' +
      '</div>' +
      '<h1 class="prompt">' + escapeHtml(model.prompt) + '</h1>' +
      (model.graph ? graphHtml(model.graph, 'Graph for this question') : '') +
      (model.type === 'choice' ? choicesHtml(model) : answerBoxHtml(model)) +
      '<div class="lesson-actions"><span></span>' +
        '<button type="button" class="btn btn-primary" data-action="check">Submit</button>' +
      '</div>' +
    '</section>';
  }

  // About 28 falling pieces. Positions come from a fixed pattern, so the page stays the same each draw.
  var CONFETTI_COLORS = ['#FF6B9A', '#FFE066', '#6C4DF5', '#2F80ED', '#2E9E4F', '#E07A1F'];
  function confettiHtml() {
    var pieces = '';
    for (var i = 0; i < 28; i++) {
      var left = (i * 37) % 100;
      var delay = ((i * 7) % 10) / 10;
      var turn = (i * 53) % 360;
      pieces += '<span class="confetti-piece" style="left:' + left + '%;background:' + CONFETTI_COLORS[i % CONFETTI_COLORS.length] +
        ';animation-delay:' + delay + 's;transform:rotate(' + turn + 'deg)"></span>';
    }
    return '<div class="confetti" aria-hidden="true">' + pieces + '</div>';
  }

  function feedbackHtml(feedback) {
    var body = feedback.correct ?
      '<h2 class="feedback-title">Correct!</h2>' :
      '<h2 class="feedback-title">Not quite</h2>' +
      '<p class="feedback-solution">' + escapeHtml(feedback.solution) + '</p>';
    var coach = feedback.mascot ? mascotHtml({ color: feedback.mascot.color, name: feedback.mascot.name, hat: feedback.mascot.hat,
      mood: feedback.correct ? 'cheer' : 'encourage', size: 'small', line: feedback.mascot.line }) : '';
    var combo = feedback.correct && feedback.combo >= 3 ?
      '<p class="combo">&#128293; ' + feedback.combo + ' in a row!</p>' : '';
    var pop = feedback.correct && feedback.xp ? '<span class="xp-pop" aria-hidden="true">+' + feedback.xp + ' XP</span>' : '';
    return '<section class="feedback ' + (feedback.correct ? 'feedback-correct' : 'feedback-wrong') + '">' +
      pop +
      coach +
      body +
      combo +
      '<button type="button" class="btn btn-primary" data-action="continue">Continue</button>' +
    '</section>';
  }

  // ----- End-of-lesson screens -----

  // The mascot on a result screen, when the result carries one: { color, name }.
  function resultMascotHtml(result, kind) {
    if (!result.mascot) return '';
    var said = AQ.mascot.result(kind, result);
    return mascotHtml({ color: result.mascot.color, name: result.mascot.name, hat: result.mascot.hat, mood: said.mood, size: 'big', line: said.line });
  }

  function completeHtml(result) {
    return confettiHtml() + '<section class="result">' +
      '<h1 class="result-title">Lesson complete!</h1>' +
      resultMascotHtml(result, 'complete') +
      '<div class="result-stats">' +
        '<div class="result-stat"><div class="result-value">+' + result.xpEarned + ' XP</div><div class="result-label">earned</div></div>' +
        '<div class="result-stat"><div class="result-value">' + result.accuracy + '%</div><div class="result-label">right on the first try</div></div>' +
      '</div>' +
      (result.perfect ? '<p class="result-perfect">Perfect! No mistakes.</p>' : '') +
      newsHtml(result) +
      '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" data-action="home">Continue</button>' +
      '</div>' +
    '</section>';
  }

  // The Speed Round result. result: { right, best, newBest, xpEarned, missed, mascot, rankUp, newBadges }.
  function speedResultHtml(result) {
    var missed = result.missed.map(function (item) {
      return '<li class="missed-item">' +
        '<div class="missed-prompt">' + escapeHtml(item.prompt) + '</div>' +
        '<div class="missed-solution">' + escapeHtml(item.solution) + '</div>' +
      '</li>';
    }).join('');
    var coach = result.mascot ? mascotHtml({ color: result.mascot.color, name: result.mascot.name, hat: result.mascot.hat,
      mood: result.newBest ? 'cheer' : (result.right > 0 ? 'happy' : 'encourage'), size: 'big',
      line: result.newBest ? 'NEW RECORD! Lightning brain!' : (result.right > 0 ? 'Nice speed! Go again?' : "Warm-up done! Let's go again!") }) : '';
    return (result.newBest || result.rankUp ? confettiHtml() : '') + '<section class="result speed-result">' +
      '<h1 class="result-title">Speed Round</h1>' + coach +
      '<div class="test-score">' + result.right + '</div>' +
      '<p class="test-verdict">right in ' + AQ.game.CONSTANTS.SPEED_SECONDS + ' seconds' +
        (result.newBest ? ' · New best!' : (result.best !== null ? ' · Best: ' + result.best : '')) + '</p>' +
      '<div class="result-stats">' +
        '<div class="result-stat"><div class="result-value">+' + result.xpEarned + ' XP</div><div class="result-label">earned</div></div>' +
      '</div>' +
      (missed ? '<p class="result-note">Missed (now in your review pile):</p><ul class="missed">' + missed + '</ul>' : '') +
      newsHtml(result) +
      '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" data-action="retry">Go again</button>' +
        '<button type="button" class="btn" data-action="home">Home</button>' +
      '</div>' +
    '</section>';
  }

  // A reward, such as an opened chest. model: { title, gems, mascot }.
  function rewardHtml(model) {
    var coach = model.mascot ? mascotHtml({ color: model.mascot.color, name: model.mascot.name, hat: model.mascot.hat,
      mood: 'cheer', size: 'big', line: 'Shiny! Spend them in the shop!' }) : '';
    return confettiHtml() + '<section class="result reward">' +
      '<h1 class="result-title">' + escapeHtml(model.title) + '</h1>' +
      '<div class="reward-chest">' + chestSvg(true) + '</div>' +
      '<div class="reward-gems">+' + model.gems + ' &#128142;</div>' +
      coach +
      '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" data-action="home">Continue</button>' +
      '</div>' +
    '</section>';
  }

  function failedHtml(result) {
    var missed = result.missed.map(function (item) {
      return '<li class="missed-item">' +
        '<div class="missed-prompt">' + escapeHtml(item.prompt) + '</div>' +
        '<div class="missed-solution">' + escapeHtml(item.solution) + '</div>' +
      '</li>';
    }).join('');
    return '<section class="result">' +
      (result.rankUp ? confettiHtml() : '') +
      '<h1 class="result-title">Out of hearts</h1>' +
      resultMascotHtml(result, 'failed') +
      '<p class="result-note">Read through the ones you missed, then try again.</p>' +
      '<ul class="missed">' + missed + '</ul>' +
      newsHtml(result) +
      '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" data-action="retry">Retry</button>' +
        '<button type="button" class="btn" data-action="home">Home</button>' +
      '</div>' +
    '</section>';
  }

  function testResultHtml(result) {
    var missed = result.missed.map(function (item) {
      return '<li class="missed-item">' +
        '<div class="missed-prompt">' + escapeHtml(item.prompt) + '</div>' +
        '<div class="missed-solution">' + escapeHtml(item.solution) + '</div>' +
      '</li>';
    }).join('');
    var pass = AQ.game.CONSTANTS.TEST_PASS_PERCENT;
    return (result.passed || result.rankUp ? confettiHtml() : '') + '<section class="result test-result">' +
      '<h1 class="result-title">Final test</h1>' +
      resultMascotHtml(result, 'test') +
      '<div class="test-score">' + result.score + '%</div>' +
      '<p class="test-verdict ' + (result.passed ? 'test-passed' : 'test-failed') + '">' +
        (result.passed ? 'Passed' : 'Not passed yet. You need ' + pass + '%.') + '</p>' +
      '<div class="result-stats">' +
        '<div class="result-stat"><div class="result-value">+' + result.xpEarned + ' XP</div><div class="result-label">earned</div></div>' +
      '</div>' +
      (result.missed.length === 0 ? '<p class="result-perfect">You got every question right.</p>' :
        '<p class="result-note">Questions you missed:</p><ul class="missed">' + missed + '</ul>') +
      newsHtml(result) +
      '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" data-action="retry">Retake</button>' +
        '<button type="button" class="btn" data-action="home">Home</button>' +
      '</div>' +
    '</section>';
  }

  var api = {
    escapeHtml: escapeHtml,
    homeModel: homeModel,
    homeHtml: homeHtml,
    badgesModel: badgesModel,
    badgesHtml: badgesHtml,
    practiceHtml: practiceHtml,
    questsHtml: questsHtml,
    shopHtml: shopHtml,
    rewardHtml: rewardHtml,
    speedResultHtml: speedResultHtml,
    confettiHtml: confettiHtml,
    hatSvg: hatSvg,
    profileHtml: profileHtml,
    moreHtml: moreHtml,
    tabBarHtml: tabBarHtml,
    mascotHtml: mascotHtml,
    mascotScreenHtml: mascotScreenHtml,
    messageHtml: messageHtml,
    lessonHtml: lessonHtml,
    graphHtml: graphHtml,
    teachHtml: teachHtml,
    calculatorHtml: calculatorHtml,
    calculatorScreenHtml: calculatorScreenHtml,
    KEYPAD: KEYPAD,
    feedbackHtml: feedbackHtml,
    completeHtml: completeHtml,
    failedHtml: failedHtml,
    testResultHtml: testResultHtml
  };
  AQ.views = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
