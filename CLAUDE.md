# Algebra Quest

Duolingo-style algebra study app. Spec: docs/superpowers/specs/2026-11-11-algebra-quest-design.md

- Tests: `node --test "tests/*.test.js"`
- No npm packages, no build step, no ES modules (classic scripts on a global `AQ`).
- The offline PC version was retired on 2026-11-13. `offline.html`, which the pinned PC shortcut opens, only erases the old PC progress and opens the online app.
- `index.html` is the online app, served by GitHub Pages from `main` (`genues08-dot/algebra-quest`), with Firebase (project `algebra-quest1`) for logins, saves, and the leaderboard. Spec: docs/superpowers/specs/2026-11-12-online-design.md
- The repo is public. Never commit packet photos (`packets/` is ignored), passwords, or personal details.
- Units are built into the app; there is no Import or Backup button. When a unit is added or changed, rebuild `js/phone-units.js` with `node tools/make-phone-units.js` and every unit file in unit order (Unit 1 first). New players start on the last file listed, so it should be the unit the class is on now. On its next start, every save gets missing units and the new version of changed ones, keeping progress (`storage.syncUnits`).
- When the online app gains or renames a file, add it to `FILES` in `sw.js` and raise `CACHE`. `tests/sw.test.js` checks the list.
- Making a unit from packet photos: follow spec section 10 and write `units/<unit-id>.json`. Then run `node tools/validate-unit.js units/<unit-id>.json` and fix every error before adding it to `js/phone-units.js`.
- The student is in Algebra 2. Their packets set the content and level.
- Pets: 14, each in 3 colors, listed in `PETS` in `js/mascot.js`. A look (`pink`, `duck-pekin`) is kept in `settings.mascot.look`; `settings.mascot.color` stays an axolotl color so older apps can read the save. Pictures, the axolotl's included, come from the user's sprite folder (transparent 400 × 400 PNGs, not in the repo) through `tools/cut-pets.js`, which also measures each head for hats into `js/pet-heads.js`. A new look must also go in the list in `firestore.rules` (a test checks it), and the rules must be published before the site.

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
