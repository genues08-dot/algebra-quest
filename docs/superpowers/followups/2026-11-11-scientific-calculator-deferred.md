# Scientific calculator: rulings and deferred findings

Copied from the build ledger when branch `scientific-calculator` was finished (2026-11-11). The ledger itself was scratch space and is deleted.

## Rulings

- Pre-flight: Ruling: Task 5 Step 8 (browser check) is run by the controller after Task 5's review; the user's play-through comes after the final review — cost if wrong: none.
- Task 2: Ruling: the plan's test expected sin(30) in DEG and sin(pi/6) to display "= 0.5"; the existing fraction rule (lesson-features spec section 8) shows "1/2 = 0.5". The implementer changed those two expectations to "1/2 = 0.5" and kept the fraction behavior. Accepted — the plan was wrong; Task 5's /= 0\.5/ assertion still matches — cost if wrong: none.
- Task 4: Ruling: the DEG/RAD label sits in its own row under the input row, not on the panel's top line as spec 7 says. Accepted — the label is visible next to the box it affects and the tests pin only the span — cost if wrong: move one span.
- Task 5: Ruling: implementer fixed a history line reading "1+1 = = 2" (Task 2's historyEntry result already starts with "= ", Task 4's view added another " = ") in js/views.js with a test, outside the brief's file list. Accepted — the plan's two tasks disagreed; the spec's "<text> = <result>" intent is one "=" — cost if wrong: a label format.
- Task 5: Ruling: implementer added state.calc.caretEnd so a key can replace a selection (the brief listed only caret). Accepted — spec 8 requires replacing a selection — cost if wrong: one extra field.
- Task 5: Ruling: the plan's "caret unknown → append" premise is wrong in real browsers. Fix: when the calculator box is drawn but is not the focus target, park its selection at the end with setSelectionRange(len, len) without focusing it; the fake page resets a fresh box to 0,0 like Edge — cost if wrong: a caret parked at the end when a student expected it elsewhere (they click to move it).
- Task 5: Ruling: REAL GAP B changes spec 8: after a successful calc-run, the next calc-key starts a fresh entry, like a TI. If the key's text starts with + − × ÷ ^ ! or ×10^( and Ans holds a number, the box becomes "Ans" + the key's text; otherwise the box becomes just the key's text. Typing in the box, ←, C, a history tap, or Go/= again end that state — cost if wrong: a student who wanted to edit the old expression with keys uses ← first or retypes.
- Final: Ruling: I1 changes spec section 5 — drop the absolute |value| < 1e-12 snap; snap where float noise is made instead: trig outputs with |v| < 1e-12 → 0, and + / − results with |result| <= 1e-12 × max(|a|, |b|) → 0 — cost if wrong: a genuine tiny difference of two large numbers reads 0.
- Final: Ruling: M1 — numbers that toPrecision would show in e-notation are displayed as <mantissa>×10^<exponent> (for example 6.02×10^23, 1.6×10^-19), which the reader accepts — cost if wrong: a display format.
- Final: Ruling: M2 — round degree-mode trig results to 15 significant digits; factorial accepts n within 1e-9 of a whole number; asin/acos clamp arguments within 1e-12 of ±1 — cost if wrong: a value within 1e-9 of a whole number is treated as whole.
- Final: Ruling: M3 — radian tan is NaN when |cos(arg)| < 1e-12 — cost if wrong: an angle within 1e-12 of a pole reads undefined.
- Final: Ruling: M4 — after a successful run, select all text in the calculator box (focused), so keyboard typing replaces it and a click deselects; the keypad's fresh-entry rule is unchanged; README says so — cost if wrong: a student who wanted to edit after = clicks once first.
- Final: Ruling: the fixer changed deleteCalculatorText so ← right after = deletes one character instead of the auto-selected whole box (select-all would otherwise make ← clear everything and broke an existing test). Accepted — C already clears; ← should delete one — cost if wrong: none.
- Final: Ruling: asin/acos clamp only arguments just outside ±1 (clamping just inside would shift results by ~1e-6). Accepted — cost if wrong: none found.

## Deferred minor findings

Set aside by task reviews, the controller's browser checks, and the final review. The final review found none that must be fixed before merge.

- Task 1: minor (deferred): √x² reads as sqrt(x)^2 (2.9999999999999996 at x=3).
- Task 1: minor (deferred): 3!2 and (2)!3 are refused (no implied multiplication of a number after "!"), same as the existing (2)3.
- Task 1: minor (deferred): root(0, 8) and non-integer n with negative x return Infinity/NaN without a test.
- Task 1: minor (deferred): no test for ans inside a graph expression.
- Task 2: minor (deferred): ZERO_BELOW and EXACT_TOLERANCE are both 1e-12 with different meanings; add a comment.
- Task 2: minor (deferred): the addHistory non-mutation test checks only length.
- Task 2: minor (deferred): no test that Ans reaches the graph path.
- Task 3: minor (deferred): no assertion that an existing 'rad' survives load/parseImportText, or for settings {sound} without angle as its own case.
- Task 4: minor (deferred): old calculatorHtml callers get the keypad by default; keys are dead until Task 5 wires them (plan-mandated, resolved by Task 5).
- Task 4: minor (deferred): KEYPAD is exported as a mutable array; Object.freeze it.
- Task 4: minor (deferred): the e and x keys use 'e' and 'x' as aria-labels instead of words.
- Task 4: minor (deferred): .calc-k-eq:hover brightness change has no transition.
- Browser check: minor (deferred): at 360x800 a shown graph pushes the keypad below the fold; the student scrolls.
- Browser check: minor (deferred): the DEG/RAD key label is tight at 360px.
- Task 5: minor (deferred): no tests for replacing or deleting a selection.
- Task 5: minor (deferred): no negative test that calc-key/calc-mode do nothing on home or a no-calculator question.
- Task 5: minor (deferred): a history tap leaves an old error showing.
- Task 5: minor (deferred): with keys hidden the student cannot switch DEG/RAD (the mode label is a plain span).
- Task 5: minor (deferred): README says the mode shows "on the line above the keys"; it is at the top of the panel.
- Task 5: minor (deferred): historyLine decides format by checking for a leading "= " (upstream display mismatch).
- Task 5: minor (deferred): ui.js is 763 lines; the calculator-guard-and-render pattern repeats 7 times; text-splice could move to calc.js.
- Task 5: minor (deferred): moving the caret without changing the text keeps the fresh-entry state.
- Final: minor (deferred): an operator key after a graph continues from an older Ans (M5).
- Final: minor (deferred): an old number result stays under a new DEG/RAD label (M6).
- Final: minor (deferred): √ before anything but a digit, x, or ( gives I don't understand "√" (M7).
- Final: minor (deferred): Go twice on the same text adds a duplicate history line (M8).
- Final: minor (deferred): no tests for a mode switch mid-lesson/test, a failed commit in the mode switch (M10).
- Final: minor (deferred): with the relative snap, sin(1e-13) RAD and 2-1.9999999999999 show 0 (accepted trade-off of the I1 ruling).
- Final: minor (deferred): ×10^ display starts below 1e-6 or from 1e21, not from 1e10 like a TI.
- Final: minor (deferred): zoom or DEG/RAD right after = clears the auto-selection.
- Final: minor (deferred): spec section 5 still describes the old absolute 1e-12 snap; spec 8 does not yet describe the fresh-entry rule or the select-all after =.
- Final: minor (deferred): 1.0000000005! gives 1 under the factorial tolerance (a TI refuses it).
- Final: minor (deferred): numbers from 1e10 to 1e21 show as plain digits, not ×10^.
- Final: minor (deferred): a double root such as x^2-4x+4 is found at 1.999999 (shows as 2).
