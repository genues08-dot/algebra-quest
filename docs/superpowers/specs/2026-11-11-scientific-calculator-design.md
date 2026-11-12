# Algebra Quest: Scientific Calculator Design Spec

- **Date:** 2026-11-11
- **Status:** Approved in chat. The user said "looks good just build it", so the spec and plan are build instructions, not review gates.
- **Builds on:** `2026-11-11-lesson-features-design.md`. Its calculator rules (section 8) still hold unless this spec changes them.

## 1. Purpose

The student wants the calculator to work like a scientific calculator (TI or Casio style): a button keypad, trig, an answer memory, and the usual extra keys. They also want to open it from the home screen for homework, not only inside lessons.

Success means the student can do every calculation in an Algebra 2 packet with taps or typing, and the result matches a TI calculator in the same angle mode.

## 2. What the user chose

- A button keypad, and typing still works.
- Trig functions and their inverses, with a Degrees/Radians switch.
- An Ans key and a history of recent calculations.
- More keys: factorial, nth root, 1/x, a negative key, and scientific notation.
- Available inside lessons, as now, and full-screen from a Calculator button on the home screen.
- One engine: the keypad types into the same box, and the existing math reader runs everything (approach 1).

## 3. Out of scope

- Solving equations. The existing "can't solve equations" message stays.
- Complex numbers, matrices, statistics, unit conversion, fraction templates, and a "2nd" shift key.
- Saving history between app sessions.
- Pan and trace on graphs. Zoom stays as it is.
- Changing the "no calculator" rule or the final test rules.

## 4. Math reader additions (`js/mathexpr.js`)

`compile(text, options)` gains an optional second argument, `{ angle: 'deg' | 'rad', ans: number | null }`.

- `angle` defaults to `'rad'`. Unit-file graphs (`graph.fn`) never pass options, so trig in unit files is in radians. The calculator always passes the student's mode.
- `ans` defaults to `null`.

New names. Names are still matched longest first, and anything else is still refused.

| Name | Meaning |
|---|---|
| `sin`, `cos`, `tan` | Trig. In `'deg'` mode the argument is in degrees. |
| `asin`, `acos`, `atan` | Inverse trig. In `'deg'` mode the result is in degrees. Outside the domain (for example `asin(2)`) the value is NaN. |
| `root` | `root(n, x)`: the nth root of x. For an odd whole number n and a negative x, it is the negative real root, so `root(3, -8)` is -2. For an even n and a negative x it is NaN. |
| `ans` | The `ans` option's value. When `ans` is not a finite number, compile fails with `There is no answer yet.` |

New syntax:

- **Factorial `!`:** a postfix operator that binds tighter than everything else, including `^`. So `5!` is 120, `2^3!` is 2^6, and `-3!` is -6. It is defined for whole numbers 0 to 170. Anything else is NaN (for example `3.5!`), and 171! is Infinity, so the calculator shows its undefined message.
- **Comma:** only inside `root( , )`. A comma anywhere else fails with `Use a comma only inside root(n, x).`
- **Symbols:**
  - `²` is read as `^2` and `³` as `^3`.
  - `√` followed by `(` is read as `sqrt(`. `√` followed by a number, or by `x`, is read as the square root of that one item, so `√9` is 3 and `2√x` is 2·sqrt(x).

Fix: a parenthesis is closed only by `)`. A comma where `)` is expected fails with the comma message. Running out of text fails with `A closing parenthesis is missing.`

Everything else in the v1 reader is unchanged. The existing tests keep passing.

## 5. Calculator logic (`js/calc.js`)

`run(text, window, options)` passes `options` (`{ angle, ans }`) to `compile`.

- A number result gains `value`, the number itself, so the UI can store it as Ans.
- When `|value| < 1e-12`, the value is treated as 0, both in `value` and in the display. So `sin(180)` in degrees reads `= 0`.
- Graph results use the same angle mode.

New helper: `addHistory(history, entry) -> history`. It returns a new list with `entry` (`{ text, result }`) first and at most 10 entries. The `result` text is:

- the number display for a number result, such as `11/12 ≈ 0.9166666667`;
- `graph` for a graph result.

Errors are not added to history.

## 6. Saved setting (`js/storage.js`)

`settings.angle` is `'deg'` or `'rad'`.

- A new save starts with `'deg'`.
- A save without `angle` is valid, and loading or restoring it fills in `'deg'`.
- Any other value makes the save invalid, the same as a bad `sound` value.

## 7. Keypad and screens (`js/views.js`, `css/styles.css`)

### Calculator panel

`calculatorHtml(model)` gains these model fields: `mode` (`'deg'`/`'rad'`), `keysShown` (boolean), `history` (list of `{ text, result }`), and `closable` (boolean).

- The top line shows the mode as `DEG` or `RAD`.
- The input row is the input box, **Go**, and a close button, shown only when `closable` is true.
- Under it are the result, the error, and the graph with its zoom buttons, as now.
- **History** (when not empty): a heading `History`, then one button per entry reading `<text> = <result>`, or `<text> → graph`. Each has `data-action="calc-history"` and `data-index`.
- **Keypad** (when `keysShown`): 43 keys in a 5-column grid, in the order below. A **Keys** toggle button (`data-action="calc-keys"`) always shows, reading `Hide keys` or `Show keys`.

| Row | Keys |
|---|---|
| 1 | DEG/RAD, Ans, (, ), ← |
| 2 | sin, cos, tan, π, C |
| 3 | sin⁻¹, cos⁻¹, tan⁻¹, e, x |
| 4 | x², xʸ, √, ˣ√, \|x\| |
| 5 | log, ln, n!, 1/x, ×10ⁿ |
| 6 | 7, 8, 9, ÷, (−) |
| 7 | 4, 5, 6, ×, `,` |
| 8 | 1, 2, 3, −, + |
| 9 | 0, ., = (three columns wide) |

What each key does:

- **Typing keys** have `data-action="calc-key"` and `data-insert="<text>"`. The text they type:

  | Key | Types |
  |---|---|
  | Ans | `Ans` |
  | sin, cos, tan | `sin(`, `cos(`, `tan(` |
  | sin⁻¹, cos⁻¹, tan⁻¹ | `asin(`, `acos(`, `atan(` |
  | π, e, x | `π`, `e`, `x` |
  | x² | `^2` |
  | xʸ | `^` |
  | √ | `√(` |
  | ˣ√ | `root(` |
  | \|x\| | `abs(` |
  | log, ln | `log(`, `ln(` |
  | n! | `!` |
  | 1/x | `^(-1)` |
  | ×10ⁿ | `×10^(` |
  | (−) | `-` |
  | digits, `.`, `(`, `)`, `,`, ÷, ×, −, + | themselves |

- **DEG/RAD:** `data-action="calc-mode"`.
- **←:** `data-action="calc-back"`.
- **C:** `data-action="calc-clear"`.
- **=:** `data-action="calc-run"`.

Each key has an `aria-label` naming it in words, for example `sine`, `inverse sine`, `square root`, `nth root`, `factorial`, `negative`, `times ten to the power`, `delete`, `clear`.

### Home screen

The footer gains a **Calculator** button (`data-action="open-calculator"`), on both forms of the home screen.

### Calculator screen

A new screen, `calculatorScreenHtml(model)`, shows:

- a top bar with a **Home** button (`data-action="home"`) and the title `Calculator`;
- the calculator panel with `closable: false`.

## 8. Wiring (`js/ui.js`)

- `state.calc` gains:
  - `keys`: default `true`;
  - `history`: default `[]`;
  - `ans`: default `null`;
  - `caret`: the cursor position in the box, or `null`.

  These last until the app closes.
- The calculator works on the `lesson` screen, as now, and on the new `calculator` screen, where it is always open. `readBoxes` also reads the calculator box, with its `selectionStart` as `caret`, on the calculator screen.
- **calc-key:** inserts the key's text into `state.calc.text` at `caret`, replacing any selection, or at the end when the caret is unknown. Then it redraws, focuses the box, and puts the caret after the inserted text.
- **calc-back:** deletes the selection, or the character before the caret. It deletes the last character when the caret is unknown.
- **calc-clear:** empties the box and clears the error. The last result and the history stay.
- **calc-run:**
  - runs with `{ angle: save.settings.angle, ans: state.calc.ans }`;
  - on a number result, stores `value` as `ans`;
  - on a number or graph result, adds it to history with `calc.addHistory`.
- **calc-history:** puts that entry's text in the box without running it.
- **calc-mode:** flips `settings.angle` on a copy of the save and saves it through `commit`, like `toggle-sound`. When the last result was a graph, it re-runs the graph so it uses the new mode.
- **calc-keys:** flips `keys`.
- **open-calculator:** shows the `calculator` screen from home.
- **home**, from the calculator screen: returns home.
- Enter in the calculator box runs the calculator on both screens.
- The "no calculator" rule and the final test rules are unchanged: every calculator action still needs `calculatorShowing()`, which is now true on the calculator screen too.

## 9. Error handling

- Every reader error is shown under the input box, and the last result stays, as now.
- New messages:
  - `There is no answer yet.`
  - `Use a comma only inside root(n, x).`
- Undefined values (`asin(2)`, `3.5!`, `root(2, -4)`, `171!`) show `That is undefined, like dividing by zero.`

## 10. Testing

Automated, with `node --test "tests/*.test.js"`:

- **mathexpr:** every new name in both angle modes, factorial edges, root edges, Ans present and missing, symbols, comma errors, the closing-parenthesis fix. All existing tests still pass.
- **calc:** options passed through, `value`, snapping tiny values to 0, degree-mode graphs, `addHistory`.
- **storage:** `settings.angle` defaults, validation, and filling in.
- **views:** the keypad's keys, inserts and labels, the mode line, history, the Keys toggle, the home Calculator button, and the calculator screen.
- **ui (fake page):**
  - keys insert at the end and at a caret;
  - ← and C;
  - = runs and stores Ans;
  - Ans in a later calculation;
  - history tap;
  - the mode switch is saved and changes results;
  - Keys toggle;
  - the home calculator screen and Enter there;
  - the calculator still hidden on a "no calculator" question.

Then a browser check by the controller, and the user's play-through.
