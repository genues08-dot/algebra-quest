# Algebra Quest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Algebra Quest, an offline Duolingo-style algebra study app that plays unit files and opens from a pinned taskbar shortcut.

**Architecture:** A static page with classic scripts that share one global, `AQ`. The logic files (`checker`, `units`, `game`, `storage`, `views`) never touch the DOM and also load under Node for tests. `ui.js` owns the DOM and events. All data lives in `localStorage`.

**Tech Stack:** HTML, CSS, JavaScript (no modules, no build step), Node 24 built-in test runner, PowerShell for the icon and shortcut scripts, Microsoft Edge `--app` mode.

**Spec:** `docs/superpowers/specs/2026-11-11-algebra-quest-design.md`

**Changes from the spec's file layout:** this plan adds `js/views.js` (pure HTML builders split out of `ui.js` so they can be tested), `tests/fixtures.js`, `tools/make-icon.ps1`, `tools/make-shortcut.ps1`, `README.md`, `CLAUDE.md`, and `.gitignore`. The test command is `node --test "tests/*.test.js"`.

## Global Constraints

- No npm packages, no `package.json`, no build step.
- No network requests at runtime: no CDNs, web fonts, or analytics.
- Classic `<script>` tags only. No `type="module"`, `import`, or `export`. Edge blocks module scripts on `file://`.
- Every `js/*.js` file except `main.js` uses this wrapper, with `NAME` set to its own name:

  ```js
  (function (root) {
    'use strict';
    var AQ = root.AQ = root.AQ || {};
    if (typeof module !== 'undefined' && module.exports) { /* require('./dep.js') for each AQ dependency */ }
    var api = { /* public functions */ };
    AQ.NAME = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
  })(typeof window !== 'undefined' ? window : globalThis);
  ```

- Only `ui.js` and `main.js` touch `document`, `window`, or `localStorage`. The one exception is the `typeof window` check in the wrapper. Storage functions take the storage object as a parameter.
- The `localStorage` key is `algebraQuest.v1`.
- Game constants: `XP_CORRECT` 10, `XP_LESSON_COMPLETE` 20, `XP_PERFECT_BONUS` 10, `XP_PER_RANK` 100, `HEARTS_PER_LESSON` 5, `REVIEW_LESSON_SIZE` 8.
- Dates are local `YYYY-MM-DD` strings. Game functions take `today` as a parameter and never read the clock.
- All text from unit files is HTML-escaped before it goes into the page.
- Math is plain text with Unicode symbols. No typesetting library.
- Tests use only `node:test`, `node:assert/strict`, and other Node built-ins.
- Styling: system font, CSS transitions only, no images, honor `prefers-reduced-motion`. Accent `#6C4DF5`, correct `#2E9E4F`, wrong `#D64545`. The layout works at 360px wide.
- Commit after every task. Append the session's `Co-Authored-By` trailer to each commit message.

## Review Focus

1. **Inequality symbols in unit text.** A prompt such as `x < 5 & y > 2` must show exactly as written, not vanish as HTML. Tests are in Tasks 7 and 8.
2. **Empty answers.** Pressing Check with an empty box, only spaces, or no choice picked must do nothing. It must not cost a heart. Test is in Task 5.
3. **Double submit.** Pressing Enter twice or double-clicking Check must grade the question once. Test is in Task 5.
4. **Valid JSON with the wrong shape.** A stored save or imported file that is `null`, `[]`, `{}`, or a half-built object must produce a clear error. It must not crash and must not wipe data. Tests are in Tasks 3 and 6.
5. **Streak across calendar edges.** Month ends, year ends, leap days, and daylight-saving changes must each count as exactly one day. Test is in Task 4.

## File Map

| File | Job |
|---|---|
| `index.html` | Shell: `<div id="app">`, script tags in order `checker, units, game, storage, views, ui, main` |
| `css/styles.css` | All styling |
| `js/checker.js` | Normalize and match typed answers |
| `js/units.js` | Validate unit files, look up lessons and questions |
| `js/game.js` | Rank, unlocking, streak, lesson and review sessions |
| `js/storage.js` | Save shape, load, persist, import parsing, backup |
| `js/views.js` | View models and HTML strings for every screen |
| `js/ui.js` | DOM mounting, event handling, screen state |
| `js/main.js` | Calls `AQ.ui.mount` on page load |
| `tools/validate-unit.js` | CLI unit validator |
| `tools/make-icon.ps1`, `tools/make-shortcut.ps1` | Generate `icon.ico` and `Algebra Quest.lnk` |
| `tests/fixtures.js`, `tests/*.test.js` | Shared test data and test suites |
| `units/sample-unit.json` | Sample unit for testing |

---

### Task 1: Skeleton, shortcut, and taskbar check

The spec requires the taskbar risk to be settled before the rest of the build.

**Files:**
- Create: `.gitignore`, `index.html`, `tools/make-icon.ps1`, `tools/make-shortcut.ps1`, `docs/taskbar-check.md`
- Generated: `icon.ico` (committed), `Algebra Quest.lnk` (ignored)

**Interfaces:**
- Produces: `icon.ico`, the shortcut, and `docs/taskbar-check.md`, which records the pin method that worked and whether storage is shared across file paths. Task 9 reads it.

- [ ] **Step 1: Create the repository.** Run `git init` in `C:\Users\tiff1\apps\algebra-quest`. Write `.gitignore` with two lines: `packets/` and `*.lnk`. Run `git config user.name`. If it prints nothing, ask the user what name and email to use before the first commit.

- [ ] **Step 2: Write the probe page `index.html`.** It is temporary and Task 7 replaces it.

```html
<!doctype html>
<meta charset="utf-8">
<title>Algebra Quest</title>
<h1>Algebra Quest</h1>
<p id="probe"></p>
<script>
  var n = Number(localStorage.getItem('algebraQuest.probe') || 0) + 1;
  localStorage.setItem('algebraQuest.probe', String(n));
  document.getElementById('probe').textContent = 'Opened ' + n + ' times';
</script>
```

- [ ] **Step 3: Write and run `tools/make-icon.ps1`.** It draws a rounded square filled `#6C4DF5` with a white bold lowercase `x`, at sizes 16, 32, 48, and 256, using `System.Drawing`. It writes `icon.ico` in the project root as an ICO container with four PNG-encoded entries.

Run: `powershell -ExecutionPolicy Bypass -File tools/make-icon.ps1`
Verify: `(Get-Content icon.ico -Encoding Byte -TotalCount 6) -join ' '` prints `0 0 1 0 4 0`.

- [ ] **Step 4: Write and run `tools/make-shortcut.ps1`.** It finds `msedge.exe` under `Program Files (x86)` or `Program Files` and fails with a clear message if neither exists. It creates `Algebra Quest.lnk` in the project root through the `WScript.Shell` COM object, with:
  - `TargetPath`: the Edge path
  - `Arguments`: `--app="<file URL of index.html>"`, where the URL comes from `([uri]$indexPath).AbsoluteUri`
  - `IconLocation`: the full path of `icon.ico`
  - `WorkingDirectory`: the project root

  The project root is the parent of `$PSScriptRoot`, so the script still works after the folder moves.

Run: `powershell -ExecutionPolicy Bypass -File tools/make-shortcut.ps1`
Verify: `$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$PWD\Algebra Quest.lnk"); $s.TargetPath; $s.Arguments`
Expected: the Edge path, then `--app="file:///C:/Users/tiff1/apps/algebra-quest/index.html"`.

- [ ] **Step 5: Human check. Stop and ask the user to do these and report each result.**
  1. Double-click `Algebra Quest.lnk`. Expected: its own window with no tabs or address bar, showing "Opened 1 times".
  2. Close it and open it again. Expected: "Opened 2 times".
  3. Right-click the shortcut and pick **Pin to taskbar**. Close the app, then click the pinned icon. Does the open window sit on the pinned icon (pass), or show up as a second icon (fail)?
  4. Only if item 3 failed: unpin it. Open the app from the shortcut, right-click its running taskbar icon, pick **Pin to taskbar**, close the app, click the pin, and check again.
  5. If item 4 also failed: stop. Fallback 2 in spec section 13 needs a plan change agreed with the user.

- [ ] **Step 6: Check whether storage is shared across file paths.** Copy `index.html` to `$env:TEMP\aq-probe\index.html` and open it with `Start-Process msedge '--app="<its file URL>"'`. Ask the user for the number shown. If it continues the earlier count, storage is shared and moving the folder is safe. If it says 1, moving the folder resets progress.

- [ ] **Step 7: Write `docs/taskbar-check.md`** with two lines: `Pin method: shortcut` or `Pin method: running window`, and `Storage shared across paths: yes` or `no`.

- [ ] **Step 8: Commit.**

```bash
git add -A
git commit -m "chore: project skeleton, icon, shortcut, taskbar check"
```

---

### Task 2: Answer checker

**Files:**
- Create: `js/checker.js`
- Test: `tests/checker.test.js`

**Interfaces:**
- Produces:
  - `AQ.checker.normalize(text: string) -> string`
  - `AQ.checker.parseNumber(normalized: string) -> number | null`
  - `AQ.checker.isCorrect(userText: string, answers: string[]) -> boolean`
  - `AQ.checker.isBlank(text: string) -> boolean`

- [ ] **Step 1: Write the failing tests in `tests/checker.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const checker = require('../js/checker.js');

test('normalize', () => {
  assert.equal(checker.normalize('  X = 4 '), '4');
  assert.equal(checker.normalize('x=4'), '4');
  assert.equal(checker.normalize('\u22123'), '-3');
  assert.equal(checker.normalize('y = 2x + 1'), '2x+1');
  assert.equal(checker.normalize('3, -3'), '3,-3');
});

test('parseNumber', () => {
  assert.equal(checker.parseNumber('4'), 4);
  assert.equal(checker.parseNumber('-4.50'), -4.5);
  assert.equal(checker.parseNumber('.5'), 0.5);
  assert.equal(checker.parseNumber('-3/4'), -0.75);
  for (const bad of ['', '1/0', '2x', '1/2/3', '--4', '4/']) assert.equal(checker.parseNumber(bad), null);
});

test('isCorrect: numbers match by value', () => {
  assert.equal(checker.isCorrect('0.5', ['1/2']), true);
  assert.equal(checker.isCorrect('4.0', ['4']), true);
  assert.equal(checker.isCorrect('-1/2', ['-0.5']), true);
  assert.equal(checker.isCorrect(' x = 7 ', ['7']), true);
  assert.equal(checker.isCorrect('8', ['7']), false);
  assert.equal(checker.isCorrect('0.333', ['1/3']), false);
});

test('isCorrect: other answers match by normalized text', () => {
  assert.equal(checker.isCorrect('3, -3', ['3,-3', '-3,3']), true);
  assert.equal(checker.isCorrect('-3,3', ['3,-3', '-3,3']), true);
  assert.equal(checker.isCorrect('2X + 1', ['2x+1']), true);
  assert.equal(checker.isCorrect('2x-1', ['2x+1']), false);
});

test('isCorrect: junk never matches and never throws', () => {
  for (const junk of ['', '   ', '1/0', '--4', 'x=', '4/', 'abc']) assert.equal(checker.isCorrect(junk, ['4']), false);
});

test('isBlank', () => {
  for (const blank of ['', '   ', 'x =']) assert.equal(checker.isBlank(blank), true);
  assert.equal(checker.isBlank('0'), false);
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL, cannot find module `../js/checker.js`.

- [ ] **Step 3: Implement `js/checker.js`.**
  - `normalize`: trim, lowercase, replace `\u2212` with `-`, remove all whitespace, then remove one leading match of `/^[a-z]=/`.
  - `parseNumber`: a decimal matches `/^-?(\d+\.?\d*|\.\d+)$/`. A fraction matches `/^-?\d+\/\d+$/` and has a non-zero denominator. Anything else is `null`.
  - `isCorrect`: normalize the user text and each answer. If both parse as numbers, they match when they differ by less than `1e-9`. Otherwise they match when the normalized strings are equal and not empty.
  - `isBlank`: true when `normalize(text)` is the empty string.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add js/checker.js tests/checker.test.js
git commit -m "feat: answer checker"
```

---

### Task 3: Unit files, validator CLI, and sample unit

**Files:**
- Create: `js/units.js`, `tools/validate-unit.js`, `units/sample-unit.json`, `tests/fixtures.js`
- Test: `tests/units.test.js`

**Interfaces:**
- Produces:
  - `AQ.units.validate(obj: any) -> { ok: boolean, errors: string[] }`
  - `AQ.units.findQuestion(unit, questionId: string) -> question | null`
  - `AQ.units.findLesson(unit, lessonId: string) -> { level, lesson, levelIndex: number, lessonIndex: number } | null`
  - `AQ.units.questionIds(unit) -> string[]` and `AQ.units.lessonIds(unit) -> string[]`, both in file order
  - `tests/fixtures.js` exports `makeUnit()` and `makeSave(unit)`
  - CLI: `node tools/validate-unit.js <file>`

- [ ] **Step 1: Write `tests/fixtures.js`.**

```js
function makeUnit() {
  const q = (id, extra) => Object.assign({ id, prompt: 'P ' + id, hint: 'H ' + id, solution: 'S ' + id }, extra);
  return {
    format: 1, id: 'u1', title: 'Unit 1',
    levels: [
      { id: 'A', title: 'Level A', lessons: [
        { id: 'a1', questions: [
          q('q1', { type: 'choice', choices: ['one', 'two', 'three'], answer: 1 }),
          q('q2', { type: 'input', answers: ['7'] })] },
        { id: 'a2', questions: [q('q3', { type: 'input', answers: ['1/2'] })] }] },
      { id: 'B', title: 'Level B', lessons: [
        { id: 'b1', questions: [q('q4', { type: 'input', answers: ['3,-3', '-3,3'] })] }] }
    ]
  };
}

function makeSave(unit) {
  return {
    version: 1, xp: 0, streak: 0, lastStudyDate: null, currentUnitId: unit.id,
    units: { [unit.id]: unit },
    progress: { [unit.id]: { completedLessons: [], review: [] } }
  };
}

module.exports = { makeUnit, makeSave };
```

- [ ] **Step 2: Write the failing tests in `tests/units.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const units = require('../js/units.js');
const { makeUnit } = require('./fixtures.js');

const q = (u, l, s, i) => u.levels[l].lessons[s].questions[i];
const samplePath = path.join(__dirname, '../units/sample-unit.json');

test('valid unit passes', () => assert.deepEqual(units.validate(makeUnit()), { ok: true, errors: [] }));

test('non-objects fail without throwing', () => {
  for (const bad of [null, undefined, 42, 'x', [], true]) {
    assert.deepEqual(units.validate(bad), { ok: false, errors: ['unit: must be an object'] });
  }
});

test('each broken rule reports one error with its location', () => {
  const cases = [
    [u => { u.format = 2; }, /^format: must be 1$/],
    [u => { u.title = ''; }, /^title: must be a non-empty string$/],
    [u => { u.levels = []; }, /^levels: must have at least 1 level$/],
    [u => { u.levels[1].title = 5; }, /^levels\[1\]\.title: must be a non-empty string$/],
    [u => { u.levels[0].lessons = []; }, /^levels\[0\]\.lessons: must have at least 1 lesson$/],
    [u => { u.levels[0].lessons[1].questions = []; }, /^levels\[0\]\.lessons\[1\]\.questions: must have at least 1 question$/],
    [u => { q(u, 0, 0, 0).hint = ' '; }, /^levels\[0\]\.lessons\[0\]\.questions\[0\]\.hint: must be a non-empty string$/],
    [u => { q(u, 0, 0, 0).type = 'essay'; }, /questions\[0\]\.type: must be "choice" or "input"$/],
    [u => { q(u, 0, 0, 0).choices = ['only']; }, /questions\[0\]\.choices: must have 2 to 6 choices$/],
    [u => { q(u, 0, 0, 0).answer = 5; }, /^levels\[0\]\.lessons\[0\]\.questions\[0\]: answer index 5 is out of range$/],
    [u => { q(u, 0, 0, 0).answer = 1.5; }, /questions\[0\]: answer must be a whole number$/],
    [u => { q(u, 0, 0, 1).answers = []; }, /questions\[1\]\.answers: must have at least 1 answer$/],
    [u => { q(u, 0, 0, 1).answers = ['']; }, /questions\[1\]\.answers\[0\]: must be a non-empty string$/],
    [u => { u.levels[1].id = 'A'; }, /^levels\[1\]\.id: duplicate level id "A"$/],
    [u => { u.levels[1].lessons[0].id = 'a1'; }, /^levels\[1\]\.lessons\[0\]\.id: duplicate lesson id "a1"$/],
    [u => { q(u, 1, 0, 0).id = 'q1'; }, /^levels\[1\]\.lessons\[0\]\.questions\[0\]\.id: duplicate question id "q1"$/]
  ];
  for (const [mutate, pattern] of cases) {
    const unit = makeUnit();
    mutate(unit);
    const result = units.validate(unit);
    assert.equal(result.ok, false);
    assert.equal(result.errors.length, 1, String(pattern));
    assert.match(result.errors[0], pattern);
  }
});

test('lookups', () => {
  const u = makeUnit();
  assert.equal(units.findQuestion(u, 'q3').prompt, 'P q3');
  assert.equal(units.findQuestion(u, 'nope'), null);
  const found = units.findLesson(u, 'b1');
  assert.deepEqual([found.levelIndex, found.lessonIndex, found.lesson.id, found.level.id], [1, 0, 'b1', 'B']);
  assert.equal(units.findLesson(u, 'nope'), null);
  assert.deepEqual(units.questionIds(u), ['q1', 'q2', 'q3', 'q4']);
  assert.deepEqual(units.lessonIds(u), ['a1', 'a2', 'b1']);
});

test('sample unit is valid and has the planned shape', () => {
  const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  assert.deepEqual(units.validate(sample), { ok: true, errors: [] });
  assert.equal(sample.id, 'sample-equations');
  assert.equal(sample.levels.length, 2);
  const types = new Set();
  for (const level of sample.levels) {
    assert.equal(level.lessons.length, 2);
    for (const lesson of level.lessons) {
      assert.equal(lesson.questions.length, 6);
      lesson.questions.forEach(x => types.add(x.type));
    }
  }
  assert.deepEqual([...types].sort(), ['choice', 'input']);
  assert.match(JSON.stringify(sample), /[<>]/);
});

test('validate-unit CLI', () => {
  const run = (...args) => spawnSync(process.execPath, [path.join(__dirname, '../tools/validate-unit.js'), ...args], { encoding: 'utf8' });
  const ok = run(samplePath);
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /^OK: .+ \(2 levels, 4 lessons, 24 questions\)/);
  const tmp = path.join(os.tmpdir(), 'aq-bad-unit.json');
  fs.writeFileSync(tmp, JSON.stringify({ format: 2 }));
  const invalid = run(tmp);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stdout + invalid.stderr, /format: must be 1/);
  const notJson = run(path.join(__dirname, 'fixtures.js'));
  assert.equal(notJson.status, 1);
  assert.match(notJson.stdout + notJson.stderr, /Not valid JSON/);
  assert.equal(run().status, 2);
});
```

- [ ] **Step 3: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL, cannot find module `../js/units.js`.

- [ ] **Step 4: Implement `js/units.js`.** Each error is `<path>: <message>`, with the exact messages the tests show. Rules that keep one mistake from producing two errors:
  - "Non-empty string" means a string whose trimmed length is above 0.
  - A missing or non-array `levels`, `lessons`, `questions`, `choices`, or `answers` gets the same error as an empty one.
  - Check `answer` only when `choices` is valid. Check the range only when `answer` is a whole number.
  - Check for a duplicate id only when that id is a non-empty string.
  - A question whose `type` is invalid gets no further type-specific checks.

- [ ] **Step 5: Implement `tools/validate-unit.js`.**
  - No argument: print `Usage: node tools/validate-unit.js <unit.json>` and exit 2.
  - File unreadable or not JSON: print `Not valid JSON: <file>` and exit 1.
  - Validation errors: print one per line and exit 1.
  - Valid: print `OK: <title> (<n> levels, <n> lessons, <n> questions)` and exit 0.

- [ ] **Step 6: Write `units/sample-unit.json`.** Use id `sample-equations` and title `Sample: One-step and Two-step Equations`. It has two levels, "One-step equations" and "Two-step equations", each with 2 lessons of 6 questions. Follow spec section 10: about 60% typed and 40% choice, wrong choices are common mistakes, and every question has a hint and a step-by-step solution. Include at least one negative answer, one fraction answer, and one choice whose text contains `<` or `>`. Solve every question by hand and confirm the stored answer before saving.

- [ ] **Step 7: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 8: Commit.**

```bash
git add js/units.js tools/validate-unit.js units/sample-unit.json tests/fixtures.js tests/units.test.js
git commit -m "feat: unit validation, validator CLI, sample unit"
```

---

### Task 4: Game basics (rank, unlocking, streak, shuffle)

**Files:**
- Create: `js/game.js`
- Test: `tests/game-basics.test.js`

**Interfaces:**
- Consumes: the save shape from `makeSave` in `tests/fixtures.js`
- Produces:
  - `AQ.game.CONSTANTS`
  - `AQ.game.rankForXp(xp: number) -> number` and `AQ.game.xpIntoRank(xp: number) -> number`
  - `AQ.game.levelStates(unit, progress) -> ('locked' | 'open' | 'complete')[]`, where `progress` is `save.progress[unit.id]`
  - `AQ.game.localDateString(date: Date) -> string`
  - `AQ.game.dayDiff(from: string, to: string) -> number`, in whole calendar days
  - `AQ.game.applyStreak(save, today: string) -> void`, which mutates `save`
  - `AQ.game.refreshStreak(save, today: string) -> void`, which mutates `save`
  - `AQ.game.shuffledOrder(n: number, rng?: () => number) -> number[]`

- [ ] **Step 1: Write the failing tests in `tests/game-basics.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../js/game.js');
const { makeUnit, makeSave } = require('./fixtures.js');

test('constants', () => assert.deepEqual(game.CONSTANTS, {
  XP_CORRECT: 10, XP_LESSON_COMPLETE: 20, XP_PERFECT_BONUS: 10,
  XP_PER_RANK: 100, HEARTS_PER_LESSON: 5, REVIEW_LESSON_SIZE: 8
}));

test('rank', () => {
  assert.deepEqual([0, 99, 100, 250].map(game.rankForXp), [1, 1, 2, 3]);
  assert.equal(game.xpIntoRank(250), 50);
});

test('levelStates', () => {
  const unit = makeUnit();
  const states = done => game.levelStates(unit, { completedLessons: done, review: [] });
  assert.deepEqual(states([]), ['open', 'locked']);
  assert.deepEqual(states(['a1']), ['open', 'locked']);
  assert.deepEqual(states(['a1', 'a2']), ['complete', 'open']);
  assert.deepEqual(states(['a1', 'a2', 'b1']), ['complete', 'complete']);
});

test('localDateString uses local time and zero padding', () => {
  assert.equal(game.localDateString(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('dayDiff counts calendar days across edges', () => {
  assert.equal(game.dayDiff('2026-11-10', '2026-11-11'), 1);
  assert.equal(game.dayDiff('2026-12-31', '2027-01-01'), 1);
  assert.equal(game.dayDiff('2028-02-28', '2028-03-01'), 2);
  assert.equal(game.dayDiff('2026-03-07', '2026-03-09'), 2);
  assert.equal(game.dayDiff('2026-10-31', '2026-11-02'), 2);
  assert.equal(game.dayDiff('2026-11-11', '2026-11-10'), -1);
});

test('applyStreak', () => {
  const save = makeSave(makeUnit());
  const step = (today, streak, last) => {
    game.applyStreak(save, today);
    assert.deepEqual([save.streak, save.lastStudyDate], [streak, last], today);
  };
  step('2026-12-30', 1, '2026-12-30');
  step('2026-12-30', 1, '2026-12-30');
  step('2026-12-31', 2, '2026-12-31');
  step('2027-01-01', 3, '2027-01-01');
  step('2027-01-03', 1, '2027-01-03');
  step('2027-01-02', 1, '2027-01-03');
});

test('refreshStreak', () => {
  const check = (last, streak, today, expected) => {
    const save = makeSave(makeUnit());
    save.lastStudyDate = last;
    save.streak = streak;
    game.refreshStreak(save, today);
    assert.deepEqual([save.streak, save.lastStudyDate], [expected, last]);
  };
  check('2026-11-11', 4, '2026-11-11', 4);
  check('2026-11-10', 4, '2026-11-11', 4);
  check('2026-11-09', 4, '2026-11-11', 0);
  check(null, 0, '2026-11-11', 0);
  check('2026-11-12', 4, '2026-11-11', 4);
});

test('shuffledOrder returns a permutation', () => {
  assert.deepEqual(game.shuffledOrder(1), [0]);
  assert.deepEqual(game.shuffledOrder(4, () => 0.42).slice().sort(), [0, 1, 2, 3]);
  assert.deepEqual(game.shuffledOrder(6).slice().sort(), [0, 1, 2, 3, 4, 5]);
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL, cannot find module `../js/game.js`.

- [ ] **Step 3: Implement these functions in `js/game.js`.** Under Node it requires `./checker.js` and `./units.js`.
  - `dayDiff` parses the three numbers from each string and subtracts `Date.UTC` values, so daylight saving cannot shift the result.
  - `levelStates`: a level is `complete` when every one of its lesson ids is in `completedLessons`. It is `open` when it is the first level or the level before it is complete. Otherwise it is `locked`.
  - `applyStreak`: if `lastStudyDate` is null, set `streak` to 1 and the date to `today`. Otherwise use `dayDiff(lastStudyDate, today)`. When it is 0 or negative, change nothing. When it is 1, add 1. When it is above 1, set `streak` to 1. Whenever the diff is positive, set the date to `today`.
  - `refreshStreak`: set `streak` to 0 when `lastStudyDate` is null or `dayDiff(lastStudyDate, today)` is above 1. Never change `lastStudyDate`.
  - `shuffledOrder` is a Fisher-Yates shuffle of `0..n-1`. `rng` defaults to `Math.random`.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add js/game.js tests/game-basics.test.js
git commit -m "feat: rank, level unlocking, streak, shuffle"
```

---

### Task 5: Lesson and review sessions

**Files:**
- Modify: `js/game.js`
- Test: `tests/game-sessions.test.js`

**Interfaces:**
- Consumes: `AQ.checker.isCorrect`, `AQ.checker.isBlank`, `AQ.units.findLesson`, `AQ.units.findQuestion`, `AQ.game.applyStreak`
- Produces:
  - `AQ.game.startLesson(unit, lessonId: string) -> session | null`
  - `AQ.game.startReview(unit, progress) -> session | null`
  - `AQ.game.currentQuestion(unit, session) -> question | null`
  - `AQ.game.submitAnswer(save, unit, session, response, today: string) -> { correct: boolean, question } | null`. `response` is the original choice index for a choice question and the typed string for an input question. It mutates `save` and `session`.
  - `AQ.game.continueSession(session) -> void`
  - `AQ.game.accuracy(session) -> number`, a whole percent
  - The session shape, shown in full in the first test below

- [ ] **Step 1: Write the failing tests in `tests/game-sessions.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../js/game.js');
const { makeUnit, makeSave } = require('./fixtures.js');

const TODAY = '2026-11-11';
const setup = () => { const unit = makeUnit(); return { unit, save: makeSave(unit) }; };
const answer = (ctx, session, response) => {
  const result = game.submitAnswer(ctx.save, ctx.unit, session, response, TODAY);
  game.continueSession(session);
  return result;
};

test('startLesson', () => {
  const { unit } = setup();
  const s = game.startLesson(unit, 'a1');
  assert.deepEqual(s, {
    unitId: 'u1', kind: 'lesson', lessonId: 'a1', queue: ['q1', 'q2'], total: 2,
    hearts: 5, wrongCount: 0, firstTryCorrect: 0, seen: [], missed: [],
    xpEarned: 0, perfect: false, status: 'active', awaitingContinue: false
  });
  assert.equal(game.currentQuestion(unit, s).id, 'q1');
  assert.equal(game.startLesson(unit, 'nope'), null);
});

test('perfect lesson', () => {
  const ctx = setup();
  const s = game.startLesson(ctx.unit, 'a1');
  assert.deepEqual(answer(ctx, s, 1), { correct: true, question: ctx.unit.levels[0].lessons[0].questions[0] });
  assert.equal(ctx.save.xp, 10);
  answer(ctx, s, ' x = 7 ');
  assert.deepEqual([s.status, s.perfect, s.xpEarned, ctx.save.xp], ['complete', true, 50, 50]);
  assert.deepEqual(ctx.save.progress.u1.completedLessons, ['a1']);
  assert.deepEqual([ctx.save.streak, ctx.save.lastStudyDate], [1, TODAY]);
  assert.equal(game.accuracy(s), 100);
  assert.equal(game.currentQuestion(ctx.unit, s), null);
});

test('wrong answers cost a heart, requeue, and join the review pile once', () => {
  const ctx = setup();
  const s = game.startLesson(ctx.unit, 'a1');
  assert.equal(answer(ctx, s, 0).correct, false);
  assert.deepEqual([s.hearts, s.queue, ctx.save.xp], [4, ['q2', 'q1'], 0]);
  assert.deepEqual(ctx.save.progress.u1.review, ['q1']);
  answer(ctx, s, '7');
  answer(ctx, s, 0);
  answer(ctx, s, 1);
  assert.deepEqual([s.status, s.perfect, s.hearts, ctx.save.xp], ['complete', false, 3, 40]);
  assert.deepEqual(s.missed, ['q1']);
  assert.deepEqual(ctx.save.progress.u1.review, ['q1']);
  assert.equal(game.accuracy(s), 50);
});

test('out of hearts fails the lesson and keeps earned XP', () => {
  const ctx = setup();
  const s = game.startLesson(ctx.unit, 'a1');
  answer(ctx, s, 1);
  for (let i = 0; i < 5; i++) answer(ctx, s, '8');
  assert.deepEqual([s.status, s.hearts, ctx.save.xp], ['failed', 0, 10]);
  assert.deepEqual(ctx.save.progress.u1.completedLessons, []);
  assert.deepEqual([ctx.save.streak, ctx.save.lastStudyDate], [0, null]);
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, s, '7', TODAY), null);
});

test('ignored submissions change nothing', () => {
  const ctx = setup();
  const s = game.startLesson(ctx.unit, 'a1');
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, s, null, TODAY), null);
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, s, 1, TODAY).correct, true);
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, s, '8', TODAY), null);
  game.continueSession(s);
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, s, '   ', TODAY), null);
  assert.equal(game.submitAnswer(ctx.save, ctx.unit, s, 'x =', TODAY), null);
  assert.deepEqual([s.hearts, ctx.save.xp, s.queue], [5, 10, ['q2']]);
});

test('replaying a completed lesson does not list it twice', () => {
  const ctx = setup();
  for (let round = 0; round < 2; round++) {
    const s = game.startLesson(ctx.unit, 'a2');
    answer(ctx, s, '0.5');
  }
  assert.deepEqual(ctx.save.progress.u1.completedLessons, ['a2']);
  assert.equal(ctx.save.xp, 80);
});

test('review lesson removes questions answered right', () => {
  const ctx = setup();
  ctx.save.progress.u1.review = ['q2', 'q4'];
  const s = game.startReview(ctx.unit, ctx.save.progress.u1);
  assert.deepEqual([s.kind, s.lessonId, s.queue, s.total], ['review', null, ['q2', 'q4'], 2]);
  answer(ctx, s, '8');
  assert.deepEqual(ctx.save.progress.u1.review, ['q2', 'q4']);
  assert.deepEqual(s.queue, ['q4', 'q2']);
  answer(ctx, s, '-3, 3');
  assert.deepEqual(ctx.save.progress.u1.review, ['q2']);
  answer(ctx, s, '7');
  assert.deepEqual([s.status, ctx.save.xp, ctx.save.streak], ['complete', 40, 1]);
  assert.deepEqual(ctx.save.progress.u1.review, []);
  assert.deepEqual(ctx.save.progress.u1.completedLessons, []);
});

test('review takes the 8 oldest, skips unknown ids, and is null when empty', () => {
  const ctx = setup();
  const extra = ['q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12'];
  for (const id of extra) ctx.unit.levels[1].lessons[0].questions.push({ id, type: 'input', prompt: 'P', hint: 'H', solution: 'S', answers: ['1'] });
  const progress = ctx.save.progress.u1;
  progress.review = ['gone', 'q12', 'q11', 'q10', 'q9', 'q8', 'q7', 'q6', 'q5', 'q4', 'q3'];
  assert.deepEqual(game.startReview(ctx.unit, progress).queue, ['q12', 'q11', 'q10', 'q9', 'q8', 'q7', 'q6', 'q5']);
  progress.review = [];
  assert.equal(game.startReview(ctx.unit, progress), null);
  progress.review = ['gone'];
  assert.equal(game.startReview(ctx.unit, progress), null);
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL, `game.startLesson is not a function`.

- [ ] **Step 3: Implement the session functions in `js/game.js`.**

  `submitAnswer` works in this order:
  1. Return `null` and change nothing when `session.status` is not `'active'`, when `session.awaitingContinue` is true, when a choice response is not a number, or when an input response is not a string or `AQ.checker.isBlank` is true for it.
  2. Grade the head of the queue. A choice is correct when `response === question.answer`. An input is correct when `AQ.checker.isCorrect(response, question.answers)` is true.
  3. If correct: add 10 to `save.xp` and `session.xpEarned`, and remove the question from the queue. Add 1 to `firstTryCorrect` if its id is not in `seen`. In a review session, remove its id from the review pile.
  4. If wrong: subtract 1 from `hearts`, add 1 to `wrongCount`, and move the question to the end of the queue. Add its id to `missed` and to the review pile unless it is already there.
  5. Add the id to `seen` if it is not there. Set `awaitingContinue` to true.
  6. If `hearts` is 0, set `status` to `'failed'`. Otherwise, if the queue is empty, set `status` to `'complete'` and add 20 XP to the save and the session. If `wrongCount` is 0, add 10 more and set `perfect` to true. In a lesson session, add `lessonId` to `completedLessons` unless it is already there. Then call `applyStreak(save, today)`.

  Other rules:
  - A normal lesson never removes ids from the review pile. Only a review session does.
  - `continueSession` sets `awaitingContinue` to false.
  - `accuracy` is `Math.round(100 * firstTryCorrect / total)`.
  - `startReview` takes the first 8 pile ids that exist in the unit.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add js/game.js tests/game-sessions.test.js
git commit -m "feat: lesson and review sessions"
```

---

### Task 6: Storage

**Files:**
- Create: `js/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Consumes: `AQ.units.validate`, `AQ.units.questionIds`, `AQ.units.lessonIds`
- Produces:
  - `AQ.storage.KEY`, which is `'algebraQuest.v1'`
  - `AQ.storage.newSave() -> save`
  - `AQ.storage.isValidSave(obj: any) -> boolean`
  - `AQ.storage.serialize(save) -> string`
  - `AQ.storage.load(ls) -> { ok: true, save } | { ok: false, raw: string }`
  - `AQ.storage.persist(ls, save) -> { ok: true } | { ok: false, reason: 'quota' }`
  - `AQ.storage.hasUnit(save, unitId: string) -> boolean`
  - `AQ.storage.addUnit(save, unit) -> void` and `AQ.storage.removeUnit(save, unitId: string) -> void`, both of which mutate `save`
  - `AQ.storage.parseImportText(text: string) -> { kind: 'unit', unit } | { kind: 'backup', save } | { kind: 'error', messages: string[] }`
  - `AQ.storage.backupFilename(today: string) -> string`
  - `ls` is any object with `getItem(key)` and `setItem(key, value)`

- [ ] **Step 1: Write the failing tests in `tests/storage.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../js/storage.js');
const units = require('../js/units.js');
const { makeUnit, makeSave } = require('./fixtures.js');

const KEY = 'algebraQuest.v1';
const BAD = "This file isn't a valid unit or backup.";
function fakeLs(initial) {
  const data = Object.assign({}, initial);
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

test('load: empty storage gives a new save', () => {
  assert.equal(storage.KEY, KEY);
  assert.deepEqual(storage.load(fakeLs()), { ok: true, save: {
    version: 1, xp: 0, streak: 0, lastStudyDate: null, currentUnitId: null, units: {}, progress: {}
  } });
});

test('persist then load round-trips', () => {
  const ls = fakeLs();
  const save = makeSave(makeUnit());
  save.xp = 130;
  assert.deepEqual(storage.persist(ls, save), { ok: true });
  assert.deepEqual(Object.keys(ls.data), [KEY]);
  assert.deepEqual(storage.load(ls), { ok: true, save });
});

test('load: unreadable or wrong-shape data is reported and never wiped', () => {
  const good = makeSave(makeUnit());
  const broken = ['not json{', 'null', '[]', '{}', '"hi"',
    JSON.stringify({ ...good, version: 2 }),
    JSON.stringify({ ...good, xp: -5 }),
    JSON.stringify({ ...good, lastStudyDate: 'yesterday' }),
    JSON.stringify({ ...good, currentUnitId: 'missing' }),
    JSON.stringify({ ...good, progress: {} }),
    JSON.stringify({ ...good, units: { u1: { format: 1 } } })];
  for (const raw of broken) {
    const ls = fakeLs({ [KEY]: raw });
    assert.deepEqual(storage.load(ls), { ok: false, raw });
    assert.equal(ls.data[KEY], raw);
  }
});

test('persist: full storage reports quota and keeps the old value', () => {
  const ls = fakeLs({ [KEY]: 'old' });
  ls.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.deepEqual(storage.persist(ls, storage.newSave()), { ok: false, reason: 'quota' });
  assert.equal(ls.data[KEY], 'old');
});

test('addUnit: a new unit becomes current with empty progress', () => {
  const save = storage.newSave();
  const unit = makeUnit();
  assert.equal(storage.hasUnit(save, 'u1'), false);
  storage.addUnit(save, unit);
  assert.equal(storage.hasUnit(save, 'u1'), true);
  assert.deepEqual(save, makeSave(unit));
});

test('addUnit: replacing keeps progress only for ids that still exist', () => {
  const save = makeSave(makeUnit());
  save.xp = 70;
  save.progress.u1 = { completedLessons: ['a1', 'old-lesson'], review: ['q2', 'old-question'] };
  storage.addUnit(save, makeUnit());
  assert.deepEqual(save.progress.u1, { completedLessons: ['a1'], review: ['q2'] });
  assert.equal(save.xp, 70);
});

test('removeUnit: deletes the unit and its progress, keeps XP and streak', () => {
  const save = makeSave(makeUnit());
  const second = makeUnit();
  second.id = 'u2';
  storage.addUnit(save, second);
  save.xp = 70;
  save.streak = 3;
  storage.removeUnit(save, 'u2');
  assert.deepEqual([Object.keys(save.units), Object.keys(save.progress), save.currentUnitId], [['u1'], ['u1'], 'u1']);
  storage.removeUnit(save, 'u1');
  assert.deepEqual([save.units, save.progress, save.currentUnitId, save.xp, save.streak], [{}, {}, null, 70, 3]);
});

test('parseImportText', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  assert.deepEqual(storage.parseImportText(JSON.stringify(unit)), { kind: 'unit', unit });
  assert.deepEqual(storage.parseImportText(storage.serialize(save)), { kind: 'backup', save });
  for (const text of ['nope{', '{"hello":1}', '[]', 'null', '42']) {
    assert.deepEqual(storage.parseImportText(text), { kind: 'error', messages: [BAD] });
  }
  const brokenBackup = JSON.stringify({ ...save, units: { u1: { format: 1 } } });
  assert.deepEqual(storage.parseImportText(brokenBackup), { kind: 'error', messages: [BAD] });
  const messy = makeUnit();
  messy.format = 3;
  messy.id = '';
  messy.title = '';
  messy.levels[0].title = '';
  messy.levels[1].title = '';
  messy.levels[0].lessons[0].questions[0].hint = '';
  messy.levels[0].lessons[0].questions[0].solution = '';
  const all = units.validate(messy).errors;
  assert.equal(all.length, 7);
  assert.deepEqual(storage.parseImportText(JSON.stringify(messy)), { kind: 'error', messages: all.slice(0, 5) });
});

test('backupFilename', () => {
  assert.equal(storage.backupFilename('2026-11-11'), 'algebra-quest-backup-2026-11-11.json');
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL, cannot find module `../js/storage.js`.

- [ ] **Step 3: Implement `js/storage.js`.**
  - `isValidSave` requires all of the following:
    - The value is a plain object, not an array.
    - `version` is exactly 1.
    - `xp` is a finite number, 0 or above.
    - `streak` is a whole number, 0 or above.
    - `lastStudyDate` is null or matches `/^\d{4}-\d{2}-\d{2}$/`.
    - `units` is a plain object in which every value passes `AQ.units.validate` and its key equals the unit's `id`.
    - `progress` has an entry for every unit, with `completedLessons` and `review` as arrays of strings.
    - `currentUnitId` is null or a key of `units`.
  - `load`: a missing key returns a new save. Text that fails `JSON.parse` or `isValidSave` returns `{ ok: false, raw }`. It never writes.
  - `persist` wraps `ls.setItem(KEY, serialize(save))` in `try`/`catch`.
  - `serialize` is `JSON.stringify(save, null, 2)`.
  - `parseImportText`: an object with `format` and `levels` is a unit. An object with `version` and `xp` is a backup. Everything else is an error with the one fixed message. A unit that fails validation returns its first 5 errors. A backup that fails `isValidSave` returns the fixed message.
  - `addUnit` sets `currentUnitId` to the added unit's id.
  - `removeUnit` sets `currentUnitId` to the first remaining unit id, or null.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "feat: save storage, import parsing, backup"
```

---

### Task 7: Home screen, import, backup, and unit management

**Files:**
- Create: `js/views.js`, `js/ui.js`, `js/main.js`, `css/styles.css`
- Modify: `index.html` (replace the probe page)
- Test: `tests/views-home.test.js`

**Interfaces:**
- Consumes: everything `AQ.storage` and `AQ.game` produce in Tasks 4 to 6
- Produces:
  - `AQ.views.escapeHtml(text: string) -> string`
  - `AQ.views.homeModel(save) -> model`, with the shape shown in the test
  - `AQ.views.homeHtml(model) -> string`
  - `AQ.views.messageHtml({ title: string, lines: string[], actions: { action: string, label: string }[] }) -> string`
  - `AQ.ui.mount(rootEl: Element, ls: Storage) -> void`
  - `AQ.ui.importText(text: string) -> void`, the same path the file picker uses
  - Inside `ui.js`: a `state` object `{ screen, save, ... }`, a `render()` that switches on `state.screen`, and an `actions` table keyed by `data-action` name. One click listener on the root element dispatches to it. Task 8 adds screens and actions to these.

- [ ] **Step 1: Write the failing tests in `tests/views-home.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const views = require('../js/views.js');
const storage = require('../js/storage.js');
const { makeUnit, makeSave } = require('./fixtures.js');

const tag = (html, marker) => html.match(new RegExp('<[a-z]+[^>]*' + marker + '[^>]*>'))[0];
function busySave() {
  const unit = makeUnit();
  unit.title = 'Unit <1>';
  const save = makeSave(unit);
  save.xp = 250;
  save.streak = 4;
  save.progress.u1 = { completedLessons: ['a1'], review: ['q2', 'q4'] };
  return save;
}

test('escapeHtml', () => {
  assert.equal(views.escapeHtml('x < 5 & y > "2" \'z\''), 'x &lt; 5 &amp; y &gt; &quot;2&quot; &#39;z&#39;');
});

test('homeModel', () => {
  assert.deepEqual(views.homeModel(busySave()), {
    rank: 3, xpIntoRank: 50, xpPerRank: 100, streak: 4,
    units: [{ id: 'u1', title: 'Unit <1>' }], currentUnitId: 'u1', reviewCount: 2,
    levels: [
      { title: 'Level A', state: 'open', lessons: [{ id: 'a1', number: 1, complete: true }, { id: 'a2', number: 2, complete: false }] },
      { title: 'Level B', state: 'locked', lessons: [{ id: 'b1', number: 1, complete: false }] }
    ]
  });
  assert.deepEqual(views.homeModel(storage.newSave()), {
    rank: 1, xpIntoRank: 0, xpPerRank: 100, streak: 0, units: [], currentUnitId: null, reviewCount: 0, levels: []
  });
});

test('homeHtml with a unit', () => {
  const html = views.homeHtml(views.homeModel(busySave()));
  assert.match(html, /Rank 3/);
  assert.match(html, /50 \/ 100 XP/);
  assert.match(html, /Review \(2\)/);
  assert.match(html, /Unit &lt;1&gt;/);
  assert.doesNotMatch(html, /Unit <1>/);
  assert.match(tag(html, 'data-lesson-id="a1"'), /data-action="start-lesson"/);
  assert.doesNotMatch(tag(html, 'data-lesson-id="a2"'), /disabled/);
  assert.match(tag(html, 'data-lesson-id="b1"'), /disabled/);
  assert.doesNotMatch(tag(html, 'data-action="start-review"'), /disabled/);
  for (const action of ['import', 'backup', 'remove-unit']) assert.match(html, new RegExp('data-action="' + action + '"'));
});

test('homeHtml with no units and with an empty review pile', () => {
  const empty = views.homeHtml(views.homeModel(storage.newSave()));
  assert.match(empty, /Import a unit to start/);
  assert.match(empty, /data-action="import"/);
  assert.doesNotMatch(empty, /data-action="start-review"/);
  const save = busySave();
  save.progress.u1.review = [];
  assert.match(tag(views.homeHtml(views.homeModel(save)), 'data-action="start-review"'), /disabled/);
});

test('messageHtml escapes its lines', () => {
  const html = views.messageHtml({ title: 'Import failed', lines: ['a < b'], actions: [{ action: 'home', label: 'OK' }] });
  assert.match(html, /Import failed/);
  assert.match(html, /a &lt; b/);
  assert.match(html, /data-action="home"/);
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL, cannot find module `../js/views.js`.

- [ ] **Step 3: Implement `js/views.js`.**
  - `homeHtml` shows `Rank <n>`, an XP bar with the text `<xpIntoRank> / <xpPerRank> XP`, and the streak count.
  - It shows a `<select data-action="select-unit">` of units and a `remove-unit` button.
  - Each level has its title and its state as a CSS class. Each lesson is a `<button data-action="start-lesson" data-lesson-id="...">Lesson <number></button>`. The button is `disabled` when the level is locked and has class `done` when the lesson is complete.
  - The review button is `<button data-action="start-review">Review (<count>)</button>`, `disabled` when the count is 0.
  - There are `import` and `backup` buttons.
  - With no units, it shows only the header, the text `Import a unit to start`, and the `import` and `backup` buttons. Backup stays available because XP and streak can exist with no units.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Replace `index.html`.** It holds `<meta charset="utf-8">`, a viewport meta tag, `<title>Algebra Quest</title>`, a link to `css/styles.css`, `<div id="app"></div>`, a hidden `<input type="file" id="import-file" accept=".json,application/json">`, and the script tags in the File Map order.

- [ ] **Step 6: Implement `js/ui.js` and `js/main.js`.** `main.js` removes the `algebraQuest.probe` key and calls `AQ.ui.mount(document.getElementById('app'), window.localStorage)`. `ui.js` behavior:
  - **On mount:** call `AQ.storage.load`. If it fails, show the `broken` screen (see below). Otherwise call `refreshStreak` with today's date, persist, and render home.
  - **Broken screen:** title `Your saved progress can't be read`, with two actions. `download-raw` downloads the raw text as `algebra-quest-raw-save.txt`. `start-fresh` confirms `Start over with no progress?`, then persists a new save and shows home.
  - **Import:** clicking `import` opens the hidden file input. The chosen file's text goes to `importText`, and the input's value is cleared afterward so the same file can be picked again.
    - On `error`: show a message screen titled `Import failed` with the messages and an OK button that returns home. The save is not changed.
    - On `unit`: when `hasUnit` is true, confirm `Replace "<title>"?` first. Then `addUnit`, persist, and render home.
    - On `backup`: confirm `Replace all current progress with this backup?`. Then replace `state.save`, call `refreshStreak`, persist, and render home.
  - **Backup:** download `serialize(save)` as `backupFilename(today)`, using a `Blob`, an object URL, and a temporary `<a download>`.
  - **Unit picker:** a `change` event sets `currentUnitId`, persists, and renders.
  - **Remove unit:** confirm `Remove "<title>" and its progress?`, then `removeUnit`, persist, and render.
  - **Persist failure:** whenever `persist` returns `ok: false`, show a message screen titled `Storage is full` with the line `Make a backup, then remove old units.`
  - "Today" always comes from `AQ.game.localDateString(new Date())`.

- [ ] **Step 7: Write `css/styles.css`** for the home and message screens. Follow the styling rules in Global Constraints.

- [ ] **Step 8: Verify in the browser.** Open `index.html` in Edge through the shortcut. Check each of these:
  1. A first open shows "Import a unit to start".
  2. Import `units/sample-unit.json`. The home screen shows `Rank 1`, `0 / 100 XP`, the two levels, the first level open, the second level's lessons disabled, and `Review (0)` disabled.
  3. Import a file that is not JSON, such as `tests/fixtures.js`, or run `AQ.ui.importText('nope{')` in DevTools. It shows "Import failed" with the fixed message, and OK returns to an unchanged home screen.
  4. Import the sample unit again. It asks `Replace "Sample: One-step and Two-step Equations"?`.
  5. Backup downloads `algebra-quest-backup-<today>.json`. Importing that file asks to replace progress and then shows the same home screen.
  6. Close and reopen the app. The unit is still there.
  7. Remove the unit. It asks for confirmation and returns to the empty home screen.
  8. In DevTools, run `localStorage.setItem('algebraQuest.v1', '{}')` and reload. The broken-save screen appears. Download gives a `.txt` file containing `{}`. Start fresh returns to the empty home screen.

- [ ] **Step 9: Commit.**

```bash
git add index.html css/styles.css js/views.js js/ui.js js/main.js tests/views-home.test.js
git commit -m "feat: home screen, import, backup, unit management"
```

---

### Task 8: Lesson, feedback, completion, and out-of-hearts screens

**Files:**
- Modify: `js/views.js`, `js/ui.js`, `css/styles.css`
- Test: `tests/views-lesson.test.js`

**Interfaces:**
- Consumes: `AQ.game` session functions from Task 5, and the `state`, `render()`, and `actions` structure in `ui.js` from Task 7
- Produces:
  - `AQ.views.lessonHtml(model) -> string`, where `model` is `{ done, total, hearts, maxHearts, prompt, type, choices, selected, hint, hintVisible }`. For a choice question, `choices` is `{ index: number, text: string }[]` in display order and `selected` is an original index or null. Both are null for an input question.
  - `AQ.views.feedbackHtml({ correct: boolean, solution: string }) -> string`
  - `AQ.views.completeHtml({ xpEarned: number, accuracy: number, perfect: boolean }) -> string`
  - `AQ.views.failedHtml({ missed: { prompt: string, solution: string }[] }) -> string`

- [ ] **Step 1: Write the failing tests in `tests/views-lesson.test.js`.**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const views = require('../js/views.js');

const tag = (html, marker) => html.match(new RegExp('<[a-z]+[^>]*' + marker + '[^>]*>'))[0];
const typed = extra => Object.assign({
  done: 1, total: 6, hearts: 3, maxHearts: 5, prompt: 'Solve: x < 5 & x > 2', type: 'input',
  choices: null, selected: null, hint: 'Think <hard>', hintVisible: false
}, extra);

test('lessonHtml: typed question', () => {
  const html = views.lessonHtml(typed());
  assert.match(html, /Solve: x &lt; 5 &amp; x &gt; 2/);
  assert.match(html, /aria-label="3 of 5 hearts"/);
  assert.match(html, /<input[^>]*data-role="answer"/);
  assert.doesNotMatch(html, /Think/);
  for (const action of ['check', 'hint', 'quit']) assert.match(html, new RegExp('data-action="' + action + '"'));
  assert.match(views.lessonHtml(typed({ hintVisible: true })), /Think &lt;hard&gt;/);
});

test('lessonHtml: choice question keeps original indexes in display order', () => {
  const html = views.lessonHtml(typed({
    type: 'choice', selected: 0,
    choices: [{ index: 2, text: 'x > 1' }, { index: 0, text: 'x = 1' }, { index: 1, text: 'x < 1' }]
  }));
  const order = [...html.matchAll(/data-action="choose" data-index="(\d)"/g)].map(m => m[1]);
  assert.deepEqual(order, ['2', '0', '1']);
  assert.match(html, /x &gt; 1/);
  assert.match(tag(html, 'data-index="0"'), /aria-pressed="true"/);
  assert.match(tag(html, 'data-index="2"'), /aria-pressed="false"/);
  assert.doesNotMatch(html, /data-role="answer"/);
});

test('feedbackHtml', () => {
  const right = views.feedbackHtml({ correct: true, solution: 'a < b' });
  assert.match(right, /Correct!/);
  assert.doesNotMatch(right, /a &lt; b/);
  const wrong = views.feedbackHtml({ correct: false, solution: 'a < b' });
  assert.match(wrong, /Not quite/);
  assert.match(wrong, /a &lt; b/);
  for (const html of [right, wrong]) assert.match(html, /data-action="continue"/);
});

test('completeHtml', () => {
  const perfect = views.completeHtml({ xpEarned: 50, accuracy: 100, perfect: true });
  assert.match(perfect, /\+50 XP/);
  assert.match(perfect, /100%/);
  assert.match(perfect, /Perfect/);
  assert.match(perfect, /data-action="home"/);
  assert.doesNotMatch(views.completeHtml({ xpEarned: 40, accuracy: 50, perfect: false }), /Perfect/);
});

test('failedHtml', () => {
  const html = views.failedHtml({ missed: [{ prompt: 'a < b', solution: 'c & d' }] });
  assert.match(html, /a &lt; b/);
  assert.match(html, /c &amp; d/);
  for (const action of ['retry', 'home']) assert.match(html, new RegExp('data-action="' + action + '"'));
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `node --test "tests/*.test.js"`. Expected: FAIL, `views.lessonHtml is not a function`.

- [ ] **Step 3: Implement the four builders in `js/views.js`.**
  - Hearts are a wrapper with `aria-label="<hearts> of <maxHearts> hearts"`, holding `♥` for each heart left and `♡` for each heart lost.
  - Choice buttons write their attributes in this order: `data-action="choose" data-index="<index>" aria-pressed="<true|false>"`.
  - The typed answer is `<input type="text" data-role="answer" autocomplete="off">`.
  - The lesson screen has a progress bar at `done / total`, and `check`, `hint`, and `quit` buttons.

- [ ] **Step 4: Run and confirm pass.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass.

- [ ] **Step 5: Add the lesson flow to `js/ui.js`.**
  - **`start-lesson` and `start-review`:** create the session with `startLesson` or `startReview`. Do nothing when it returns null. Show the lesson screen.
  - **Showing a question:** `done` is `session.total - session.queue.length`. For a choice question, build a new display order with `shuffledOrder` each time it is shown. For an input question, focus the text box.
  - **`choose`:** store the original index as the selection and re-render.
  - **`hint`:** show the hint.
  - **`check`, or Enter in the text box:** call `submitAnswer` with the selection or the typed text. When it returns null, do nothing. Otherwise persist and show the feedback panel.
  - **`continue`, or Enter on the feedback panel:** call `continueSession`. Then show the complete screen when the status is `complete`, the out-of-hearts screen when it is `failed`, and the next question otherwise.
  - **`quit`:** confirm `Quit this lesson? XP you earned stays.`, then go home.
  - **`retry`:** start the same lesson again, or a new review session. If the review pile is now empty, go home.
  - **`home`:** render the home screen from the current save.
  - **Out-of-hearts screen:** it lists `session.missed` with each question's prompt and solution.

- [ ] **Step 6: Add lesson styles to `css/styles.css`.** The feedback panel uses the correct color or the wrong color from Global Constraints.

- [ ] **Step 7: Verify in the browser.** Open the app with the sample unit imported. Check each of these:
  1. Answer a whole lesson correctly. The complete screen shows `+90 XP` (6 answers at 10, plus 20, plus 10), `100%`, and `Perfect`. Home then shows `90 / 100 XP`, a streak of 1, and the lesson marked done.
  2. Type an answer and press Enter. It submits. Press Enter again. It continues.
  3. Press Check with an empty box, and with no choice picked. Nothing happens and no heart is lost.
  4. Answer one question wrong. A heart is lost, the worked solution shows, the question returns at the end of the lesson, and home then shows `Review (1)`.
  5. The choice with `<` or `>` displays its symbol.
  6. Get 5 wrong in one lesson. The out-of-hearts screen lists the missed questions. Retry restarts with 5 hearts.
  7. Finish every lesson in level 1. Level 2 unlocks.
  8. Run a review lesson and answer correctly. The Review count drops.
  9. Quit mid-lesson. It asks first. XP earned so far is still on the home screen.
  10. Close and reopen the app. XP, streak, completed lessons, and the review pile are unchanged.

- [ ] **Step 8: Commit.**

```bash
git add js/views.js js/ui.js css/styles.css tests/views-lesson.test.js
git commit -m "feat: lesson, feedback, completion, out-of-hearts screens"
```

---

### Task 9: Docs and final check with the user

**Files:**
- Create: `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `docs/taskbar-check.md` from Task 1

- [ ] **Step 1: Write `CLAUDE.md` with exactly this content.**

```markdown
# Algebra Quest

Offline Duolingo-style algebra study app. Spec: docs/superpowers/specs/2026-11-11-algebra-quest-design.md

- Tests: `node --test "tests/*.test.js"`
- No npm packages, no build step, no ES modules. The app runs from file://.
- Making a unit from packet photos: follow spec section 10 and write `units/<unit-id>.json`. Then run `node tools/validate-unit.js units/<unit-id>.json` and fix every error before telling the user to import it.
```

- [ ] **Step 2: Write `README.md`** for the user, in plain language, with these sections:
  - **Open and pin:** use the pin method recorded in `docs/taskbar-check.md`. Say that running `tools/make-shortcut.ps1` rebuilds the shortcut.
  - **Add a unit:** photos go in `packets/<unit-name>/`, then ask Claude to make the unit, then use Import.
  - **Back up and restore:** how the Backup and Import buttons do it.
  - **What resets progress:** clearing Edge site data always does. Moving the folder does only if `docs/taskbar-check.md` says storage is not shared.

- [ ] **Step 3: Run the full suite.** Run: `node --test "tests/*.test.js"`. Expected: all tests pass, 0 failures.

- [ ] **Step 4: Human check. Ask the user to run the app from the pinned icon and confirm each item.**
  1. The app opens from the pinned taskbar icon.
  2. Importing the sample unit works.
  3. A lesson can be finished perfectly, finished with mistakes, and failed.
  4. A review lesson works.
  5. Backup and restore work.
  6. Progress is still there after closing and reopening.

- [ ] **Step 5: Commit.**

```bash
git add README.md CLAUDE.md
git commit -m "docs: README and project notes"
```
