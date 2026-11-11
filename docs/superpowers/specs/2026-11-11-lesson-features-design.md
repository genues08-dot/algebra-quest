# Algebra Quest: Lesson Features Design Spec

- **Date:** 2026-11-11
- **Status:** Draft, awaiting review
- **Builds on:** `2026-11-11-algebra-quest-design.md` (the v1 spec). Everything there still holds unless this spec changes it.

## 1. Purpose

Version 1 quizzes. It does not teach, it cannot show a graph, and it has no end goal for a unit. The student is in Algebra 2, and the first real unit (polynomial functions) needs graphs and a graphing calculator.

This spec adds five things:

1. **Teaching cards:** each lesson teaches the idea before it asks questions.
2. **Graphs in problems:** a question can show a graph when the problem needs one.
3. **Calculator:** a panel in lessons that gives a number for plain math and a graph for anything with `x`.
4. **Final test:** each unit ends in a test that runs like a real one.
5. **Sounds:** short, satisfying sounds for answers and finished lessons (section 15).

Success means the student can learn a topic inside the app with no other notes, practice it, and then prove it on a test.

## 2. Out of scope

- The home screen redesign (path, daily goal, badges, dark mode). That is a separate spec.
- Graphs in worked solutions. Graphs appear only where a problem needs one, and on teaching cards.
- Trig functions, tables of values, tracing, and more than one function per graph.
- Timed tests, and showing the student's own wrong answers on the test result screen.
- Calculator history.

## 3. New files

| File | Job |
|---|---|
| `js/mathexpr.js` | Reads typed math and evaluates it. No DOM. |
| `js/plot.js` | Finds zeros and turning points, and draws a function as SVG. No DOM. |
| `js/calc.js` | Calculator logic: turns typed text into a number result or a graph result. No DOM. |
| `js/sound.js` | Defines the sounds and plays them with the browser's Web Audio. No DOM. |

All four use the same wrapper as the other `js/` files and load under Node for tests. The script order in `index.html` becomes `checker, mathexpr, units, plot, calc, game, storage, sound, views, ui, main`.

## 4. Typed math (`mathexpr.js`)

The app never runs typed text as code. `mathexpr.js` parses the text itself.

`AQ.mathexpr.compile(text)` returns one of:

- `{ ok: true, usesX: boolean, evaluate: function (x) -> number }`
- `{ ok: false, error: string }`

### What it accepts

- **Numbers:** `12`, `3.5`, `.5`.
- **Names:** the variable `x`, and the constants `pi` and `e`. Uppercase is treated as lowercase.
- **Operators:** `+`, `-`, `*`, `/`, `^`, and a leading `-` or `+`.
- **Parentheses.**
- **Functions:** `sqrt`, `cbrt`, `abs`, `log` (base 10), and `ln`. Each takes one value in parentheses.
- **Multiplying without a sign:** `2x`, `3(x+1)`, `(x+1)(x-2)`, `x(x+1)`, `2pi`, `2sqrt(3)`.
- **Symbols:** `−` is read as `-`, `×` as `*`, `÷` as `/`, and `π` as `pi`.
- **A leading `y =` or `f(x) =`** is ignored, so `y = 2x + 1` is read as `2x + 1`.

### Order of operations

From first to last: parentheses and functions, then `^`, then a leading `-`, then `*` and `/` (including multiplying without a sign), then `+` and `-`.

- `^` groups from the right, so `2^3^2` is `2^9`.
- `-x^2` is `-(x^2)`.
- `2^-3` is allowed.
- Multiplying without a sign has the same rank as `*`, and both group from the left. So `1/2x` is `(1/2)x`, not `1/(2x)`.

### Results and errors

`evaluate` returns a number. It returns `NaN` or an infinity when the value is not defined, such as `sqrt(-1)` or `1/0`. Callers check for that.

`error` is a plain sentence the student can act on:

| Problem | Message |
|---|---|
| Empty text | `Type something to calculate.` |
| A character it does not know | `I don't understand "<character>".` |
| A name it does not know | `I don't know the name "<name>".` |
| An open parenthesis with no close | `A closing parenthesis is missing.` |
| A close parenthesis with no open | `There is an extra closing parenthesis.` |
| An operator with nothing after it, or two in a row | `Something is missing near "<operator>".` |

## 5. Plotting (`plot.js`)

A **window** is `{ xMin, xMax, yMin, yMax }`.

### Features

`AQ.plot.features(evaluate, window)` returns `{ zeros: number[], turningPoints: { x, y, kind }[] }`, where `kind` is `'max'` or `'min'`.

- It samples the function at 400 even steps across the x-range.
- A **turning point** is where the slope changes sign. It is refined by bisection.
- A **zero** is where the value changes sign, refined by bisection, or a sampled point whose value is 0, or a turning point whose `y` is within `1e-6` of 0. The last case catches a graph that touches the x-axis and turns back.
- Values closer together than `1e-4` are one result. Results are sorted by `x`.
- Only results inside the x-range are returned.

### Drawing

`AQ.plot.svg(spec)` returns SVG markup as a string. `spec` is `{ evaluate, window, numbers, marks, label }`.

- The picture is square, with `viewBox="0 0 320 320"`, and scales to its container.
- It draws grid lines, then darker x and y axes, then the curve.
- Grid spacing is a "nice" step (1, 2, or 5 times a power of 10) that gives at most 10 lines per axis.
- With `numbers: true`, each grid line is labeled along its axis. With `numbers: false`, there are no numbers, for sketch-style problems.
- The curve is clipped to the window. Where the function is not defined, the curve breaks.
- The curve also breaks between two neighboring points that are outside the window on opposite sides. That keeps a jump, such as the one in `1/x`, from being drawn as a line.
- Points far outside the window are pulled in to a fixed distance, so the picture never holds huge coordinates.
- `marks` is a list of `{ x, y, kind }` drawn as dots, where `kind` is `'zero'`, `'max'`, or `'min'`.
- The SVG has `role="img"` and `aria-label` set to `label`. The label never includes the function unless the caller puts it there, so a sketch problem does not give away its formula.

## 6. Unit file additions

`format` stays `1`. Every addition is optional, so v1 unit files stay valid.

### `graph` on a question or a teaching card

```json
"graph": { "fn": "x^3 - 3x^2 - 3", "x": [-5, 5], "y": [-10, 10], "numbers": true }
```

- `fn` is required. It must compile with `mathexpr`.
- `x` and `y` are optional and default to `[-10, 10]`. Each is two finite numbers with the first less than the second.
- `numbers` is optional and defaults to `true`.

The graph is drawn under the question prompt, or under the text of a teaching card.

### `calculator` on a question

`"calculator": false` hides the calculator for that question. It is `true` when left out. It is for "without graphing" problems.

### `teach` on a lesson

```json
"teach": [
  {
    "title": "Product rule",
    "text": ["When you multiply powers with the same base, add the exponents."],
    "example": { "problem": "Simplify x³ · x²", "steps": ["Same base, so add the exponents: 3 + 2 = 5.", "x³ · x² = x⁵"] }
  }
]
```

- `teach` is a list of 1 to 5 cards.
- Each card needs a non-empty `title` and a `text` list of at least 1 non-empty paragraph.
- `example` is optional. It needs a non-empty `problem` and at least 1 non-empty step.
- `graph` is optional.

### `test` on a unit

```json
"test": {
  "questions": [
    {
      "id": "t1",
      "type": "input",
      "prompt": "Solve: x² − 9 = 0",
      "answers": ["3, -3"],
      "hint": "Factor it as a difference of squares.",
      "solution": "x² − 9 = (x + 3)(x − 3), so x = −3 or x = 3."
    }
  ]
}
```

- `questions` holds at least 1 question, in the same form as lesson questions.
- Question ids are unique across the whole unit, test questions included.

### Validation and lookups

`units.validate` checks every rule above and reports errors in the same `<path>: <message>` form, for example `levels[0].lessons[1].teach[0].title: must be a non-empty string` and `test.questions[3].graph.fn: A closing parenthesis is missing.`

`findQuestion` and `questionIds` include test questions. That lets a missed test question sit in the review pile.

## 7. Teaching cards

- A lesson with `teach` cards opens on its first card. A lesson without them opens on its first question, as in v1.
- Each card shows its title, its paragraphs, its worked example as numbered steps, and its graph.
- The card screen has **Back**, **Next**, and a count such as "2 of 3". On the last card, Next reads **Start practice**.
- **Skip to questions** is always there, for replays.
- During the lesson, a **Notes** button reopens the cards. Leaving them returns to the same question with the typed text and picked choice still in place.
- Review lessons and the final test have no Notes button.

Seeing or skipping cards is not saved and earns no XP.

## 8. Calculator

- A **Calculator** button on the question screen opens a panel under the question. The button is hidden when the question has `"calculator": false`, and a line reads `No calculator for this question.`
- The panel has one input box and a run button. Enter in the box runs it. Enter in the calculator never checks the answer.
- The panel, its text, and its zoom stay as they are when the lesson moves to the next question. A Close button hides it.

### Plain math

When the text has no `x`, the panel shows a number.

- The number is rounded to 10 significant digits, with trailing zeros removed.
- When the value equals a fraction with a denominator of 1000 or less, to within `1e-9`, and is not a whole number, the fraction is shown too: `11/12 ≈ 0.9166666667`. When the decimal is exact, the sign is `=`, as in `3/4 = 0.75`.
- Without a fraction, the result reads `= 14`.
- A value that is not defined shows `That is undefined, like dividing by zero.`

### Graphing

When the text has `x`, the panel shows its graph.

- The starting window is −10 to 10 on both axes, with numbers on.
- Zeros and turning points inside the window are marked on the graph and listed under it, rounded to 2 decimals with trailing zeros removed:
  - `Zeros: x = -1, 2.5` or `Zeros: none in this window`
  - `Turning points: max (0.71, 4.3), min (3.29, -4.3)` or `Turning points: none in this window`
- **Zoom in** halves the window on both axes. **Zoom out** doubles it. **Reset** returns to −10 to 10.
- Zoom stops at a window 1.25 units wide on the small end and 1280 units wide on the large end.

### Errors

A `compile` error shows its message under the input box. The panel keeps its last result.

## 9. Final test

### On the home screen

- A unit with a `test` shows a **Final test** entry after its last level.
- It is locked until every level in the unit is complete.
- It shows the best score so far, such as `Best: 85%`, or `Not taken yet`.

### Running the test

- The questions are shown in a shuffled order, one at a time, as "Question 3 of 20".
- There are no hearts, no hints, no Notes button, and no right-or-wrong feedback.
- **Submit** records the answer and moves on. An empty answer or no picked choice is ignored, as in lessons.
- **Skip** counts the question as wrong and moves on.
- The calculator follows the same rule as in lessons.
- **Quit** asks first: `Quit the test? You will have to start it again.` XP already earned stays, and no score is saved.

### Scoring

| Name | Value |
|---|---|
| `XP_CORRECT` | 10, as in lessons |
| `XP_TEST_PASS` | 50 |
| `TEST_PASS_PERCENT` | 80 |

- Each correct answer adds 10 XP right away. The lesson-complete and perfect bonuses do not apply.
- The score is the whole percent of questions answered right.
- A score of 80 or more passes and adds 50 XP.
- Every missed or skipped question goes into the unit's review pile.
- Finishing the test counts as studying for the streak, pass or not.
- The best score is saved as `progress[unitId].testBest`. A lower score later does not replace it.

### Result screen

- It shows the score, `Passed` or `Not passed yet. You need 80%.`, and the XP earned.
- It lists every missed question with its prompt and worked solution.
- It has **Retake** and **Home** buttons.

## 10. Save data

`progress[unitId]` gains `testBest`: a whole number from 0 to 100, or `null` when the test has not been finished.

- A new unit starts with `testBest: null`.
- A save from v1 has no `testBest`. It is still valid, and loading it fills in `null`.
- Re-importing a unit keeps `testBest`.
- The save `version` stays `1`.

The save also gains `settings: { "sound": true }`. A save without `settings` is still valid, and loading it fills in `{ "sound": true }`.

## 11. Game code (`game.js`)

- `startTest(unit, rng)` returns a session with `kind: 'test'`, or `null` when the unit has no test. It uses the same session shape as lessons. `hearts` is present and never changes.
- `submitAnswer` handles a test session by the rules in section 9: no heart loss, no requeue, and no wait for Continue.
- `skipQuestion(save, unit, session, today)` counts the current test question as wrong. It does nothing in other sessions.
- `testScore(session)` returns the whole percent.
- `isTestUnlocked(unit, progress)` is true when every level is complete.

## 12. Error handling

- A unit whose `graph.fn` does not compile is rejected at import with the error's path, and by the validator CLI.
- A graph with no drawable points in its window shows the grid and axes alone.
- Calculator errors never change the lesson state.

## 13. Testing

Automated, with `node --test "tests/*.test.js"`:

- **`mathexpr`:** order of operations, multiplying without a sign, every function, every error message, and proof that text such as `alert(1)` or `constructor` is refused.
- **`plot`:** zeros and turning points of known polynomials, including a zero that touches the axis, plus the SVG's parts and its label.
- **`calc`:** number results, fractions, undefined values, graph results with their two lines of text, and zoom limits.
- **`sound`:** every sound has notes within safe limits, and playing does nothing and does not fail when sound is off or the browser has no audio.
- **`units`:** every new validation rule, and that a v1 unit still passes.
- **`game`:** a whole test session, skip, pass and fail, best score, and unlocking.
- **`storage`:** `testBest` on new, old, and re-imported units.
- **`views` and `ui`:** teaching cards, the graph under a question, the calculator panel, and the test screens, through the fake page.

The sample unit gains teaching cards, one graph question, one no-calculator question, and a short final test, so every feature can be tried by hand.

## 14. Authoring rules

`CLAUDE.md` gains rules for writing units with the new parts:

- Every lesson gets 1 to 3 teaching cards taken from the packet's notes pages, each with a worked example.
- Questions in a lesson go from checking the idea to full problems.
- A graph is added only where the problem needs one.
- "Without graphing" problems get `"calculator": false`.
- Every unit gets a final test of about 20 new questions that do not repeat lesson questions.

## 15. Sounds

Sounds are made in code with the browser's Web Audio. There are no audio files, so the app stays small and works offline.

| Sound | When it plays |
|---|---|
| `select` | A choice is picked. |
| `correct` | A lesson or review answer is right. |
| `wrong` | A lesson or review answer is wrong. |
| `complete` | A lesson or review is finished with at least one mistake. |
| `perfect` | A lesson or review is finished with no mistakes. |
| `failed` | A lesson ends with no hearts left. |
| `submit` | A final test answer is submitted or skipped. |
| `testPass` | A final test is passed. |
| `testFail` | A final test is finished but not passed. |

- During the final test, `correct` and `wrong` never play. They would give away the answer.
- Each sound is a few short notes. `correct` rises, `wrong` is low and soft, and the finish sounds are short rising runs. No sound is longer than 1.5 seconds.
- The home screen has a **Sound: on / off** button. The choice is saved in `settings.sound`.
- When sound is off, or the browser has no Web Audio, playing a sound does nothing and never causes an error.
