// Views: turn data into HTML strings for each screen. Nothing here touches the page.
// Every piece of text that comes from a unit file goes through escapeHtml.
(function (root) {
  'use strict';
  var AQ = root.AQ = root.AQ || {};
  if (typeof module !== 'undefined' && module.exports) {
    require('./game.js');
  }

  var ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (character) { return ESCAPES[character]; });
  }

  // ----- Home screen -----

  function homeModel(save) {
    var model = {
      rank: AQ.game.rankForXp(save.xp),
      xpIntoRank: AQ.game.xpIntoRank(save.xp),
      xpPerRank: AQ.game.CONSTANTS.XP_PER_RANK,
      streak: save.streak,
      units: Object.keys(save.units).map(function (id) {
        return { id: id, title: save.units[id].title };
      }),
      currentUnitId: save.currentUnitId,
      reviewCount: 0,
      levels: []
    };
    if (save.currentUnitId === null) return model;

    var unit = save.units[save.currentUnitId];
    var progress = save.progress[unit.id];
    var states = AQ.game.levelStates(unit, progress);
    model.reviewCount = progress.review.length;
    model.levels = unit.levels.map(function (level, levelIndex) {
      return {
        title: level.title,
        state: states[levelIndex],
        lessons: level.lessons.map(function (lesson, lessonIndex) {
          return {
            id: lesson.id,
            number: lessonIndex + 1,
            complete: progress.completedLessons.indexOf(lesson.id) !== -1
          };
        })
      };
    });
    return model;
  }

  function headerHtml(model) {
    var percent = Math.round(100 * model.xpIntoRank / model.xpPerRank);
    var days = model.streak === 1 ? 'day' : 'days';
    return '<header class="topbar">' +
      '<div class="rank">' +
        '<div class="rank-name">Rank ' + model.rank + '</div>' +
        '<div class="xp-bar"><div class="xp-fill" style="width:' + percent + '%"></div></div>' +
        '<div class="xp-text">' + model.xpIntoRank + ' / ' + model.xpPerRank + ' XP</div>' +
      '</div>' +
      '<div class="streak' + (model.streak > 0 ? ' streak-on' : '') + '">' +
        '<div class="streak-count">' + model.streak + '</div>' +
        '<div class="streak-label">' + days + ' in a row</div>' +
      '</div>' +
    '</header>';
  }

  function unitBarHtml(model) {
    var options = model.units.map(function (unit) {
      var selected = unit.id === model.currentUnitId ? ' selected' : '';
      return '<option value="' + escapeHtml(unit.id) + '"' + selected + '>' + escapeHtml(unit.title) + '</option>';
    }).join('');
    return '<section class="unit-bar">' +
      '<label class="unit-label" for="unit-select">Unit</label>' +
      '<select id="unit-select" class="unit-select" data-action="select-unit">' + options + '</select>' +
      '<button type="button" class="btn btn-quiet" data-action="remove-unit">Remove unit</button>' +
    '</section>';
  }

  var LEVEL_STATE_LABELS = { locked: 'Locked', open: '', complete: 'Complete' };

  function levelHtml(level) {
    var locked = level.state === 'locked';
    var lessons = level.lessons.map(function (lesson) {
      return '<button type="button" class="lesson' + (lesson.complete ? ' done' : '') + '"' +
        ' data-action="start-lesson" data-lesson-id="' + escapeHtml(lesson.id) + '"' +
        (locked ? ' disabled' : '') + '>' +
        (lesson.complete ? '&#10003; ' : '') + 'Lesson ' + lesson.number +
      '</button>';
    }).join('');
    return '<section class="level level-' + level.state + '">' +
      '<div class="level-head">' +
        '<h2 class="level-title">' + escapeHtml(level.title) + '</h2>' +
        '<span class="level-state">' + LEVEL_STATE_LABELS[level.state] + '</span>' +
      '</div>' +
      '<div class="lessons">' + lessons + '</div>' +
    '</section>';
  }

  function footerHtml() {
    return '<footer class="footer">' +
      '<button type="button" class="btn" data-action="import">Import</button>' +
      '<button type="button" class="btn" data-action="backup">Backup</button>' +
    '</footer>';
  }

  function homeHtml(model) {
    if (model.units.length === 0) {
      return headerHtml(model) +
        '<section class="empty"><p class="empty-text">Import a unit to start</p></section>' +
        footerHtml();
    }
    var reviewDisabled = model.reviewCount === 0 ? ' disabled' : '';
    return headerHtml(model) +
      unitBarHtml(model) +
      '<div class="path">' + model.levels.map(levelHtml).join('') + '</div>' +
      '<section class="review-bar">' +
        '<button type="button" class="btn btn-primary" data-action="start-review"' + reviewDisabled + '>' +
          'Review (' + model.reviewCount + ')' +
        '</button>' +
        '<span class="review-note">Questions you missed come back here.</span>' +
      '</section>' +
      footerHtml();
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

  var api = {
    escapeHtml: escapeHtml,
    homeModel: homeModel,
    homeHtml: homeHtml,
    messageHtml: messageHtml
  };
  AQ.views = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
