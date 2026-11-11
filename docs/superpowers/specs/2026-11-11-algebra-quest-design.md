# Algebra Quest: Design Spec

- **Date:** 2026-11-11
- **Status:** Draft, awaiting review

## 1. Purpose

The user's algebra grade is dropping. Algebra Quest is a Duolingo-style study app for their Windows PC. It turns the paper packet for an algebra unit into a path of levels with XP, ranks, hearts, a daily streak, and a review pile.

Success means:

- Practice questions match what the teacher's packet covers.
- Every missed question teaches the step through a worked solution.
- The game loop (XP, streak, hearts) makes daily study feel like progress.
- The app opens from a pinned taskbar icon and runs smoothly on an old PC.

## 2. Constraints

- One user on one PC: Windows 10 Home, older hardware, Microsoft Edge installed.
- Free. No paid services and no internet needed while using the app.
- Opens in its own window and can be pinned to the taskbar.
- Packets are on paper, so the input is photos of the pages.

## 3. Out of scope (v1)

- The app reading photos itself, or calling any AI API.
- A built-in random problem generator.
- Multiple user profiles, syncing between devices, or a phone version.
- Sound effects.
- A math typesetting library. Questions use plain text with Unicode symbols (x², ½, −, ≤).

## 4. Architecture

A static web app made of HTML, CSS, and JavaScript. There is no build step and no server.

- **Launch:** a Windows shortcut, `Algebra Quest.lnk`, runs `msedge.exe --app="file:///C:/Users/tiff1/apps/algebra-quest/index.html"`. That opens the app in its own Edge window with no tabs or address bar. The user right-clicks the shortcut and picks **Pin to taskbar**. The shortcut uses a custom `icon.ico`.
- **Scripts:** these are classic `<script>` tags, not ES modules, because Edge blocks module scripts loaded from `file://` URLs. Each file adds its part to one global object, `AQ`. The logic files also export through `module.exports` when they run under Node, so tests can load them.
- **Storage:** all data lives in Edge `localStorage`.

### File layout

```
algebra-quest/
  index.html            app shell; loads the scripts in order
  icon.ico
  Algebra Quest.lnk     taskbar shortcut
  css/styles.css
  js/units.js           validates and parses unit files (no DOM)
  js/checker.js         normalizes and matches typed answers (no DOM)
  js/game.js            XP, rank, hearts, lesson queue, streak, review rules (no DOM)
  js/storage.js         save/load, backup export, backup restore (localStorage only)
  js/ui.js              screens, rendering, event handlers
  js/main.js            startup
  tools/validate-unit.js  CLI: node tools/validate-unit.js units/<file>.json
  tests/*.test.js       Node built-in test runner (node --test), no npm packages
  units/                generated unit files, including sample-unit.json
  packets/              packet photos, one folder per unit
  docs/                 this spec and the implementation plan
```

Each logic file has one job and does not touch the page, so it can be tested on its own. `ui.js` is the only file that touches the DOM.

## 5. Unit file format

Units are JSON files. Example:

```json
{
  "format": 1,
  "id": "unit-1-linear-equations",
  "title": "Unit 1: Linear Equations",
  "levels": [
    {
      "id": "one-step",
      "title": "One-step equations",
      "lessons": [
        {
          "id": "one-step-1",
          "questions": [
            {
              "id": "q1",
              "type": "choice",
              "prompt": "Solve: x + 5 = 12",
              "choices": ["x = 5", "x = 7", "x = 17", "x = 60"],
              "answer": 1,
              "hint": "Undo the + 5.",
              "solution": "Subtract 5 from both sides: x + 5 − 5 = 12 − 5, so x = 7."
            },
            {
              "id": "q2",
              "type": "input",
              "prompt": "Solve: 3x = 21",
              "answers": ["7"],
              "hint": "x is being multiplied by 3. Undo that.",
              "solution": "Divide both sides by 3: 3x ÷ 3 = 21 ÷ 3, so x = 7."
            }
          ]
        }
      ]
    }
  ]
}
```

### Validation rules (`units.js`)

- `format` must be `1`.
- The unit and each level must have a non-empty `id` and `title`. Each lesson must have a non-empty `id`. Lessons have no title; the app shows them as "Lesson 1", "Lesson 2", and so on.
- Level ids are unique within the unit. Lesson ids are unique within the unit. Question ids are unique within the unit.
- Each unit has at least 1 level, each level has at least 1 lesson, and each lesson has at least 1 question.
- Every question has a non-empty `prompt`, `hint`, and `solution`.
- A `choice` question has 2 to 6 `choices`, and `answer` is a whole-number index into `choices`.
- An `input` question has an `answers` array with at least 1 non-empty string.
- Any other `type` is an error.

An error names its location, for example `levels[0].lessons[1].questions[3]: answer index 5 is out of range`.

## 6. Answer checking (`checker.js`)

For `input` questions, the checker reads the user's text and each accepted answer the same way.

First it prepares the text:

1. Trim, then lowercase.
2. Replace `−` (Unicode minus) with `-`, `<=` with `≤`, and `>=` with `≥`.
3. Turn a mixed number into a fraction, so `2 1/2` becomes `5/2`.

Then it splits the text into parts on commas, semicolons, and the words `or` and `and`. For each part it removes all whitespace, and removes a single-letter assignment on the left (`x=`) or the right (`=x`). So `x = 4`, `x=4`, `4 = x`, and `4` all become `4`. A part that starts with `±` or `+-` becomes two parts, so `±3` is `3` and `-3`. Empty parts are dropped.

Two answers match when they have the same number of parts and every part pairs with a different part of the other answer. Order does not matter. Two parts match like this:

- If both parse as numbers, they match when they are equal within `1e-9`. Integers, decimals, and simple fractions `a/b` with an optional leading `-` count as numbers. So `0.5` matches `1/2`, and `4.0` matches `4`.
- Otherwise they match only when the text is equal.

A question with more than one answer, such as x = 3 or x = −3, needs only one key, `"3, -3"`. The student can type `-3, 3`, `x = 3 or x = -3`, or `±3`.

Expressions are compared as text, so `2x+6` does not match `6+2x`. The unit file must list each accepted form of an expression, or the question should be multiple choice. Because numbers match by value, a typed question cannot grade the form of a number, such as "simplify 2/4".

## 7. Game rules (`game.js`)

### Constants

| Name | Value |
|---|---|
| `XP_CORRECT` | 10 |
| `XP_LESSON_COMPLETE` | 20 |
| `XP_PERFECT_BONUS` | 10 |
| `XP_PER_RANK` | 100 |
| `HEARTS_PER_LESSON` | 5 |
| `REVIEW_LESSON_SIZE` | 8 |

The rank is `floor(totalXP / 100) + 1`.

### Levels and unlocking

- The first level of each unit is unlocked.
- A level is complete when all of its lessons are complete. Completing a level unlocks the next one.
- Completed lessons can be replayed at any time.

### Lesson flow

- The lesson queue starts with the lesson's questions in file order. Choice order is shuffled every time a choice question is shown. The `answer` index always refers to the order in the file, and the game tracks the shuffle.
- **Correct answer:** add 10 XP right away and remove the question from the queue.
- **Wrong answer:** lose 1 heart and show the worked solution. The question moves to the end of the queue and is added to the unit's review pile.
- The Hint button shows the hint. It costs nothing.
- **Out of hearts (0):** the lesson fails. XP already earned stays. The lesson is not marked complete and there is no completion bonus. The out-of-hearts screen lists the missed questions and offers Retry.
- **Queue empty:** the lesson is complete. Add 20 XP, plus 10 more if no answers were wrong. Mark the lesson complete and update the streak.
- **Quitting mid-lesson:** the app asks for confirmation. XP already earned and review-pile additions stay. The lesson is not marked complete.

### Review lesson

- Each unit has its own review pile: a list of question ids, oldest first.
- A review lesson takes the oldest questions from the pile, up to 8.
- A correct answer removes the question from the pile.
- A wrong answer costs 1 heart and moves the question to the end of the review lesson's queue. The question stays in the pile.
- Hearts, XP, the completion bonus, and streak rules are the same as a normal lesson. Review lessons do not count toward level completion.
- The Review button shows the pile size and is disabled when the pile is empty.

### Streak

- The save stores `streak` and `lastStudyDate`, a local date in `YYYY-MM-DD` format.
- When any lesson completes, normal or review:
  - If `lastStudyDate` is today, nothing changes.
  - If `lastStudyDate` is yesterday, `streak` goes up by 1.
  - Otherwise `streak` becomes 1.
  - Then `lastStudyDate` becomes today.
- When the app opens and `lastStudyDate` is earlier than yesterday, `streak` resets to 0.
- A failed lesson does not count toward the streak.
- Dates come from the PC's clock. Game functions take the current date as a parameter, so tests can set any date.

## 8. Save data (`storage.js`)

The app keeps one `localStorage` key, `algebraQuest.v1`:

```json
{
  "version": 1,
  "xp": 0,
  "streak": 0,
  "lastStudyDate": null,
  "currentUnitId": null,
  "units": { "<unitId>": { "...": "full unit JSON" } },
  "progress": {
    "<unitId>": { "completedLessons": ["one-step-1"], "review": ["q2"] }
  }
}
```

- Imported units are stored inside the save, so the app never needs the original file again.
- The app saves after every answer.
- **Backup:** the Backup button downloads the whole save as `algebra-quest-backup-YYYY-MM-DD.json` to the Downloads folder.
- **Restore:** the Import button accepts unit files and backup files. It tells them apart by their keys: a unit has `format` and `levels`, while a backup has `version` and `xp`. Restoring a backup asks for confirmation before it replaces the current save.
- **Re-importing a unit with an id that already exists:** the app asks "Replace Unit 1?" first. Completed lessons and review entries for ids that still exist are kept, and the rest are dropped.
- **Removing a unit:** the unit picker has a Remove option with a confirmation. It deletes that unit and its progress. XP, rank, and streak stay.

## 9. Screens (`ui.js`)

- **Home:** rank, XP bar toward the next rank, streak count, unit picker, and the level path with each level shown as locked, open, or complete. Also the Review button with its count, an Import button, and a Backup button. With no units imported, the home screen shows a short "Import a unit to start" message.
- **Lesson:** a progress bar, hearts, the question prompt, and either choice buttons or a text box. Check and Hint buttons. After Check, a feedback panel shows "Correct!" or the worked solution, with a Continue button. Enter submits a typed answer.
- **Lesson complete:** XP earned, accuracy, any perfect bonus, and a Continue button. Accuracy is the number of questions answered right on the first try, divided by the number of questions in the lesson.
- **Out of hearts:** the missed questions, plus Retry and Home buttons.

## 10. Unit generation workflow (done with Claude, not by the app)

1. The user photographs the packet pages, flat and in good light, and saves them in `packets/<unit-name>/`.
2. The user asks Claude to make a unit from that folder.
3. Claude reads every photo and lists the topics in packet order. Each topic becomes a level.
4. Each level gets 2 or 3 lessons of 6 to 10 questions. Typed questions are for solving problems, and choice questions are for concepts, vocabulary, and "which step comes next". The mix is roughly 60% typed and 40% choice.
5. Questions use the packet's own problems plus similar problems with changed numbers. Wrong choices are common mistakes, such as sign errors or doing the inverse operation on one side only.
6. Every question gets a hint and a step-by-step solution.
7. Claude solves every question independently. If the packet has an answer key, Claude checks against it, and any mismatch is flagged to the user.
8. Claude runs `node tools/validate-unit.js` on the file and fixes every error before handing it over.
9. If a photo is blurry or a page is cut off, Claude names the photo to retake and does not guess its content.

The output is `units/<unit-id>.json`, which the user imports with the Import button.

## 11. Error handling

- **Import file that is not valid JSON:** "This file isn't a valid unit or backup." The save is unchanged.
- **Unit that fails validation:** the app lists the first 5 problems. The save is unchanged.
- **Save that cannot be read (corrupted JSON):** the app shows an error screen with two options: download the raw data, or start fresh. It never wipes data on its own.
- **Storage full:** the app shows a message suggesting a backup and removing old units. The previous stored save stays intact, and the app keeps running on the progress in memory.
- **Two windows open:** before every write, the app checks that the stored save is still the one this window last read or wrote. If another window has saved since, this window writes nothing. It loads the newer save and shows "Progress was updated in another window".

## 12. Testing

- `node --test tests/` runs automated tests for `checker.js`, `game.js` (XP, rank, hearts, lesson queue, review pile, and streak across date changes), `units.js` validation, and `storage.js` load, save, and restore against a fake `localStorage`.
- The app ships with `units/sample-unit.json` (one-step and two-step equations), so it can be tested before a real packet exists.
- Manual checks in Edge:
  - The shortcut opens the app window, and pinning to the taskbar works.
  - Importing the sample unit works.
  - A lesson can be completed perfectly, completed with mistakes, and failed by running out of hearts.
  - A review lesson works.
  - Backup and restore work.
  - Progress survives closing and reopening the app.

## 13. Risks to verify during the build

- **Taskbar grouping:** a pinned Edge `--app` shortcut can open its window under the Edge icon instead of its own. This must be tested first, before the rest of the build. If it happens, try these fallbacks in order:
  1. Open the app from the shortcut, then right-click its taskbar icon and pin the running window.
  2. Serve the folder from a small local Node server that the shortcut starts, and install it with Edge's **Apps > Install this site as an app**. An installed app gets its own taskbar icon. The cost is that the server has to start every time the app opens, so this is a last resort.
- **Edge site data:** clearing Edge's site data erases progress. The Backup button covers this.
- **Moving the app folder:** this changes the `file://` path. Whether Edge keeps the same `localStorage` after a move must be tested. If it doesn't, restoring from a backup covers it.
