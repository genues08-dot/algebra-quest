# Algebra Quest

Offline Duolingo-style algebra study app. Spec: docs/superpowers/specs/2026-11-11-algebra-quest-design.md

- Tests: `node --test "tests/*.test.js"`
- No npm packages, no build step, no ES modules. `offline.html` runs from file://.
- `index.html` is the online app, served by GitHub Pages from `main` (`genues08-dot/algebra-quest`), with Firebase (project `algebra-quest1`) for logins, saves, and the leaderboard. Spec: docs/superpowers/specs/2026-11-12-online-design.md
- The repo is public. Never commit packet photos (`packets/` is ignored), passwords, or personal details.
- When a unit is added or changed, rebuild `js/phone-units.js` with `node tools/make-phone-units.js` and every unit file, so the online app gets it.
- When the online app gains or renames a file, add it to `FILES` in `sw.js` and raise `CACHE`. `tests/sw.test.js` checks the list.
- Making a unit from packet photos: follow spec section 10 and write `units/<unit-id>.json`. Then run `node tools/validate-unit.js units/<unit-id>.json` and fix every error before telling the user to import it.
- The student is in Algebra 2. Their packets set the content and level.

## Choosing typed or multiple choice

Typed (`input`) answers are graded by `js/checker.js`. It compares numbers by value and everything else as exact text, after removing spaces, case, and a leading `x =` or trailing `= x`.

Use a typed question when the answer is:

- **One number:** an integer, decimal, fraction, or mixed number. Write the key once, such as `"5/2"`. `2.5`, `5/2`, and `2 1/2` all match it.
- **Several numbers,** such as the two solutions of a quadratic. Write the key once as `"3, -3"`. Any order matches, and so do `x = 3 or x = -3`, `3 and -3`, and `±3`.
- **A simple inequality with one natural form,** such as `"x ≤ 5"`. The student can type `<=` and `>=`.

Use multiple choice when:

- **The form is the point,** such as "simplify" or "write as a decimal". The checker accepts `2/4` for `1/2` and `0.5` for `1/2`, so it cannot grade form.
- **The answer is an expression that can be written many ways:** factored forms, polynomials, radicals, rational expressions, complex numbers. `2x+6` does not match `6+2x`.
- **The answer is an ordered pair, an interval, or a graph feature.** These match only as exact text.

If an expression answer must be typed, list every reasonable form in `answers`. Write accepted answers the way a student types them: `^` for exponents, `sqrt(5)` for roots, `i` for the imaginary unit. Show the proper symbols (x², √5) in the prompt, hint, and solution.

## Teaching cards, graphs, calculator, and final test

Authoring rules:

- Every lesson gets 1 to 3 teaching cards taken from the packet's notes pages, each with a worked example.
- Questions in a lesson go from checking the idea to full problems.
- Add a graph only where the problem needs one.
- "Without graphing" problems get `"calculator": false`.
- Every unit gets a final test of about 20 new questions that do not repeat lesson questions. Test question ids must not match any lesson question id.

All of these fields are optional. `format` stays `1`.

`teach` on a lesson: 1 to 5 cards, each with a `title`, a `text` list, and an optional `example` and `graph`.

```json
"teach": [
  {
    "title": "Product rule",
    "text": ["When you multiply powers with the same base, add the exponents."],
    "example": { "problem": "Simplify x³ · x²", "steps": ["Same base, so add the exponents: 3 + 2 = 5.", "x³ · x² = x⁵"] }
  }
]
```

`graph` on a question or a teaching card: `fn` is required and uses the calculator's syntax (`^`, `*`, `/`, parentheses, `2x`, `sqrt(...)`, `sin(...)` and the other trig names, `root(n, x)`, and `!`). Trig in a unit-file graph is always in radians, whatever the student's DEG/RAD setting. `x` and `y` default to `[-10, 10]`. `numbers` defaults to `true`.

```json
"graph": { "fn": "x^3 - 3x^2 - 3", "x": [-5, 5], "y": [-10, 10], "numbers": true }
```

`calculator` on a question: `false` hides the calculator for that question.

```json
"calculator": false
```

`test` on a unit: `questions` use the same form as lesson questions. Ids are unique across the whole unit.

```json
"test": { "questions": [ { "id": "t-q1", "type": "input", "prompt": "Solve: 3x − 7 = 11", "answers": ["6"], "hint": "Undo the − 7 first.", "solution": "3x = 18, so x = 6." } ] }
```
