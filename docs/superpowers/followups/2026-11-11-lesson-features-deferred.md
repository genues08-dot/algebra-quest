# Lesson features: rulings and deferred findings

Copied from the build ledger when branch `lesson-features` was finished (2026-11-11). The ledger itself was scratch space and is deleted.

## Rulings

- Pre-flight: Ruling: CONFLICT 1 — the T10 instruction "before any redraw of the lesson screen, read both boxes into state" would, in a real browser, copy the previous question's answer into the next question (the feedback screen's disabled input still holds it). Read the answer box and calculator box at the START of each click/key handler while the screen is `lesson`, never inside render or showQuestion; showQuestion clears typedText and selected — matches spec 7 and 8 (nothing typed is lost) without leaking answers — cost if wrong: one helper moved.
- Pre-flight: Ruling: CONFLICT 2 — after T4, units.questionIds includes test questions, so the T12 CLI "counts lesson questions as before" must use questionIds(unit).length - testQuestions(unit).length — keeps the "24 questions" expectation true — cost if wrong: one line.
- Pre-flight: Ruling: NOTE 3 — new js files exist from T1 but index.html script tags arrive in T10, so the browser app is not runnable between T8 and T10. Accepted: no browser check is planned before T12 — cost if wrong: none.
- Pre-flight: Ruling: NOTE 4 — teachHtml labels when fromNotes is true on a non-last card are unspecified. Next reads "Next" on any non-last card; Skip reads "Back to question" when fromNotes, else "Skip to questions"; Next on the last card reads "Back to question" when fromNotes, else "Start practice" — consistent with the T8 tests — cost if wrong: label text.
- Pre-flight: Ruling: NOTE 5 — T12 Step 5 (browser check) is run by the controller after T12's review, through the preview pane, because implementer subagents may lack browser tools. The implementer does Steps 1-4 and 6 — cost if wrong: none; the check still runs.
- Task 2: Ruling: Important "poles reported as zeros and turning points" conflicts with the plan text (zero = any sign change, bisected). Spec intent is true zeros and turning points for the student; a pole is neither. Fix: keep a bisected zero only when |f(root)| <= max(|f(a)|, |f(b)|) of its bracketing samples, and keep a turning point only when its y is finite and stays within a bounded size of its neighbor samples; add tests with 1/(x - 0.03) and 1/(x - 0.03)^2 — cost if wrong: a real zero or turning point next to a pole could be dropped.
- Task 2: Ruling: ⚠️ "at most 10 lines per axis" — niceStep keeps range/step <= 10 per the plan (and its niceStep(20) = 2 test), which can give 11 lines when both window ends sit on grid multiples. The spec's intent is about 10 grid intervals; the extra line is the window edge. Code stands — cost if wrong: one extra grid line.
- Task 2: Ruling: the implementer added a second pole rule beyond the ruling (a turning point needs the slope to change sign at its bracket ends), because the size bound alone let 1/(x-0.03) through. Re-review found it correct and unable to drop a real turning point. Accepted — cost if wrong: two extrema inside one 0.05-wide sample bracket can be missed (they could before too).
- Task 10: Ruling: implementer concern 1 — Retry after running out of hearts reopens the teaching cards (the card check sits in beginSession). Kept: spec 7 says a lesson with cards opens on its first card, Skip is there for replays, and re-reading the rule after failing helps — cost if wrong: one extra click per retry.
- Task 10: Ruling: reviewer Minors 1 and 3 (fake boxes keep stale values after a redraw; no regression test for the stale-answer hazard) are carried into the Task 11 dispatch as test-only work, because Task 11's tests run on the same fake page and Task 11 edits the same redraw paths — cost if wrong: a little extra test code in Task 11.
- Task 11: Ruling: plan-mandated weak assertions (sawChoice is always true at tests/ui-test-mode.test.js:110; /80%/ also matches the fail line at :56) stand — the sound-order deepEqual and the review-pile/testPass assertions already pin the behavior those lines were meant to check — cost if wrong: two assertions that prove nothing.
- Final: Ruling: I3 overrides the plan's pinned test message `I don't understand "=".` for text that still contains "=" after the `y =` / `f(x) =` strip — the student is told what to do instead; tests/mathexpr.test.js updated — cost if wrong: one message string.
- Final: Ruling: Task 2 pole ruling outcome was incomplete (I1); the final fix replaces it — cost if wrong: see I1 fix tests.
- Final: Ruling: reviewer triage says the Task 1 closeParen deferred item is not a bug (sum() only returns at a close or end of input). Accepted; it stays recorded but needs no fix — cost if wrong: none.
- Final: Ruling: keeping Math.max instead of the reviewer's suggested Math.min in the bisected-zero check — Math.min drops real zeros such as x - 0.3; the huge-value threshold alone closes the pole cases — cost if wrong: none found in a 55,860-case sweep.

## Deferred minor findings

Set aside by task reviews and the final review. None blocks use; the final review triaged them as able to wait.

- Task 1: minor (deferred): closeParen checks only that a token exists, not that it is a close (js/mathexpr.js:180-183).
- Task 1: minor (deferred): thousands of nested "(" or "-" overflow the stack and compile throws RangeError instead of returning ok:false.
- Task 1: minor (deferred): charAt(0) splits a surrogate pair, so an emoji error shows half a character.
- Task 1: minor (deferred): no test for "sqrt(" or "x3".
- Task 2: minor (deferred): a peak with two exactly equal neighbor samples is skipped (strict slope sign test, js/plot.js:85).
- Task 2: minor (deferred): ys[i] * ys[i+1] < 0 can underflow to 0 for tiny values; compare signs instead (js/plot.js:79).
- Task 2: minor (deferred): bisect collapses toward lo when g(lo) is exactly 0 (js/plot.js:44).
- Task 2: minor (deferred): a segment from inside the window to outside across a pole is still drawn (js/plot.js:181).
- Task 2: minor (deferred): svg does not guard a window with zero or negative span (js/plot.js:139-140).
- Task 2: minor (deferred): marks[m].kind goes into a class attribute unescaped (js/plot.js:191).
- Task 2: minor (deferred): helper name isFinite_ is unclear (js/plot.js:34).
- Task 2: minor (deferred): no svg test for a break at an undefined stretch or for axes outside the window; niceStep untested at non-power-of-10 ranges.
- Task 2: minor (deferred): the turning-point size bound 2*max(|neighbor y|)+1 is a heuristic (js/plot.js:67-80).
- Task 3: minor (deferred): very large or tiny numbers display as 1e+21 or 1e-7 (plan-mandated formatNumber; reviewer graded Minor).
- Task 3: minor (deferred): run assumes a valid window and returns the same window object it was given.
- Task 3: minor (deferred): no direct tests for formatNumber (-0, trailing zeros) or zoom on an off-centre window.
- Task 4: minor (deferred): in the browser AQ.mathexpr must load before units.js — already required by the plan's script order, added to index.html in Task 10.
- Task 4: minor (deferred): a non-array test.questions reports "must have at least 1 question".
- Task 4: minor (deferred): no test cases for graph.x like [1, NaN] or ["a", 2], or for a graph with extra keys.
- Task 5: minor (deferred): no test that parseImportText fills defaults for an old v1 backup (the fillDefaults call there is unexercised).
- Task 5: minor (deferred): isValidSave tests lack settings: null and a NaN testBest as separate cases.
- Task 6: minor (deferred): testScore duplicates the accuracy formula (js/game.js:82-84, 171-173).
- Task 6: minor (deferred): session.seen is filled in test sessions but never read there (js/game.js:111).
- Task 6: minor (deferred): no tests for skip on a completed test, a skip that ends the test, or the streak not double-counting on a retake the same day.
- Task 7: minor (deferred): context.resume() returns a Promise that can reject under autoplay rules and log an unhandled rejection (js/sound.js:66).
- Task 7: minor (deferred): a failed AudioContext constructor is retried on every play (js/sound.js:65-66).
- Task 7: minor (deferred): a throw midway through scheduling returns false although some notes were scheduled (js/sound.js:68-82).
- Task 7: minor (deferred): sound tests depend on order (cached module context) and do not check notes() immutability, ramp timing, or resume().
- Task 8: minor (deferred): graphHtml reads graph.fn without guarding a non-string (validator guarantees it for unit files) (js/views.js:104-107).
- Task 8: minor (deferred): no test pins graph-label escaping, a max mark, or a number result without a graph.
- Task 8: minor (deferred): calculator placeholder "Try 2+3 or x^2-4" is copy not in the spec (js/views.js:145).
- Task 8: minor (deferred): .teach-actions .btn { flex: 1 } not checked against other .btn rules (css/styles.css:51).
- Task 9: minor (deferred): testResultHtml duplicates the missed-list markup from failedHtml; extract a shared helper.
- Task 9: minor (deferred): test-mode action rows are near-duplicate strings, and toolsModel is a manual key copy.
- Task 9: minor (deferred): tests do not cover the locked path in test mode and check hearts absence only by the word "hearts".
- Task 9: minor (deferred): .test-passed/.test-failed hard-code #1D6B34 instead of a variable (consistent with the file).
- Task 10: minor (deferred): fake click() fires actions that are not on the page (tightening it breaks a planned Task 10 test that clicks home from the lesson screen) (tests/fake-page.js:52-60).
- Task 10: minor (deferred): calc-open checks only the screen, not whether the question allows the calculator (js/ui.js:433-437).
- Task 10: minor (deferred): calculator-allowed and has-cards checks are written two and three times (js/ui.js:92, 362; 110, 317, 431).
- Task 10: minor (deferred): zoom calls calc.zoom before the guard; state.calc.window references the shared unfrozen DEFAULT_WINDOW (js/ui.js:37, 444-452).
- Task 10: minor (deferred): the calculator graph's accessible label uses the box text, not the drawn graph's text (js/ui.js:112-113, views.js:199).
- Task 10: minor (deferred): focus falls to the page body after each teaching-card Back/Next (js/ui.js:148-153).
- Task 10: minor (deferred): focusing the calculator box after zoom scrolls the page and can open a touch keyboard (js/ui.js:387, 160).
- Task 10: minor (deferred): checkAnswer relies on its caller having read the boxes; add a comment (js/ui.js:339).
- Task 10: minor (deferred): tests hard-code 'algebraQuest.v1' instead of storage.KEY.
- Task 10: minor (deferred): ui.js is now about 545 lines; plan a split.
- Task 11: minor (deferred): afterTestAnswer plays submit before redrawing; every other path redraws first (js/ui.js:401).
- Task 11: minor (deferred): session.kind === 'test' repeated instead of inTest() (js/ui.js:108).
- Task 11: minor (deferred): retry repeats the session-start dispatch (js/ui.js:526-535).
- Task 11: minor (deferred): fake-page UNESCAPES copies views' ESCAPES without a link between them (tests/fake-page.js:6).
- Task 11: minor (deferred): the AQ.sound.play test override is never restored (tests/ui-test-mode.test.js:15).
- Task 11: minor (deferred): the quit button keeps aria-label="Quit lesson" in test mode (js/views.js:324).
- Task 11: minor (deferred): the last test answer plays submit and testPass/testFail back to back; they may overlap in a real browser.
- Task 12: minor (deferred): the two-step-1 card's worked example (2x + 3 = 11) is the same problem as question ts1-q1/ts1-q2, so the card gives that answer away. Carry into Unit 5 authoring: card examples must not repeat lesson questions.
- Task 12: minor (deferred): the two-step-2 card example (−2x + 5 = 1) is close to test question t-q4 (−2x + 5 = −9).
- Task 12: minor (deferred): CLAUDE.md says 1 to 3 cards in the authoring rules and 1 to 5 in the field description (the validator limit).
- Browser check: minor (deferred): graph axis labels at the window edges are clipped (for example "-10" shows as "0").
- Browser check: minor (deferred): a last teaching card opened from Notes shows two identical "Back to question" buttons (Next and Skip).
- Browser check: minor (deferred): at 360px with the calculator open, Submit/Skip sit below the fold; the student scrolls.
- Final: minor (deferred): a flat-zero function such as abs(x)-x lists hundreds of zeros (js/plot.js:61, js/calc.js:64-66).
- Final: minor (deferred): x², ³, ·, √ copied from a prompt are refused by the calculator (js/mathexpr.js:30-38).
- Final: minor (deferred): implied multiplication is one-sided: (2)3 and (x+1)2 are refused (js/mathexpr.js:126-127).
- Final: minor (deferred): the calculator graph label doubles the prefix ("Graph of y = y = 2x+1") and uses the box text, not the drawn text (js/views.js:199).
- Final: minor (deferred): test mode keeps aria-label="Quit lesson" (js/views.js:324).
- Final: minor (deferred): the teaching-card screen has no Quit/Home, and focus drops to the page body after each card (js/views.js:241-250).
- Final: minor (deferred): the sample unit shows graph and no-calculator only on final-test question t-q2; no teaching card has a graph.
- Final: minor (deferred): validate can throw on thousands of nested parentheses in graph.fn (js/units.js:71).
- Final: minor (deferred): a save with settings: {} goes to the unreadable-save screen; remember when adding settings keys (js/storage.js:60-61).
- Final: minor (deferred): the midpoint jump check adds visible gaps to some polynomials at zoom-out x5 and x6 (js/plot.js:143, 207-208).
- Final: minor (deferred): from zoom-out x3, odd poles can still draw a short (<16 px) diagonal across the pole.
- Final: minor (deferred): a centred label near (not on) an edge can still be cut, e.g. -0.6 at zoom-in x4 may lose its minus sign; clamping ignores label width.
- Final: minor (deferred): x >= 2 gets the "can't solve equations" message although it is an inequality.
- Final: minor (deferred): x^8 - 1 reports a false min on its flat bottom (pre-branch behavior).
- Final: minor (deferred): a finite jump such as abs(x-0.05)/(x-0.05) draws a vertical stroke and reports a zero (pre-branch behavior).
- Final: minor (deferred): spec sections 4 and 5 do not yet describe the equation message, the huge-value rule, the midpoint jump check, or skipped edge labels.
