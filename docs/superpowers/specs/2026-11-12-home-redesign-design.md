# Home screen redesign: design

The home screen gets seven additions, A to G, agreed with the user on 2026-11-11. On 2026-11-12 the user said "just build it", so the details below are Claude's choices and were not reviewed before building.

## Goal

Make the home screen look like a game and always show the next step. It must stay light on an old PC: no images, no libraries, and CSS animation only where it helps.

## A. Winding path

- Lessons become round buttons (nodes) on a zigzag trail. Each node keeps `data-action="start-lesson"` and `data-lesson-id`.
- Each level starts with a heading row that shows its title and its state (Locked or Complete).
- Node offsets follow the pattern 0, 1, 2, 1, 0, −1, −2, −1, counted across the whole unit. One step is 44 px.
- A finished node is green with a ✓. An open node shows its lesson number. A locked node is grey and disabled.
- The next lesson's node is larger and glows, and a "Start" label sits on it. The glow does not move when the user has reduced motion turned on.
- The final test is a trophy node at the end of the path. It keeps `data-action="start-test"` and shows "Not taken yet" or "Best: N%". It is disabled until every level is complete.

## B. Continue button

A large button under the unit picker (`data-action="resume"`). It does the next thing in this order:

1. If a lesson is left, it starts the first unfinished lesson in the first unfinished level. Its label is "Continue", with "Level N · Lesson M: level title" under it.
2. If every lesson is done and the unit has a final test whose best score is under 80% or not taken, it starts the test. Its label is "Take the final test".
3. If the review pile has questions, it starts a review. Its label is "Review missed questions (N)".
4. Otherwise no button shows. A note reads "Unit complete! Every lesson is done."

## C. Daily goal ring

- An SVG ring in the top bar fills with the XP earned today. The text reads "N / goal XP today".
- The ring turns green and shows "Goal met!" once the goal is reached.
- A "Goal: N XP" button cycles the goal through 50, 100, 200 and 300. The default is 100, which is about one lesson.
- All XP counts toward the goal: lessons, reviews, and the final test.

## D. Week strip

- Seven dots for the last seven days, oldest first, each with its weekday letter. Today has a ring around its dot.
- A day is filled when a lesson, review, or test was finished that day, which is the same rule as the streak.
- Existing saves have no day log, so the days of the current streak count as studied.

## E. Rank titles

Ranks stay at 100 XP each. Each rank gets a title and a tier color.

| Ranks | Title | Tier |
|---|---|---|
| 1–2 | Rookie | 1 |
| 3–4 | Learner | 2 |
| 5–7 | Solver | 3 |
| 8–11 | Factor Finder | 4 |
| 12–16 | Equation Ace | 5 |
| 17–22 | Polynomial Pro | 6 |
| 23–29 | Function Master | 7 |
| 30+ | Algebra Legend | 8 |

- The top bar shows the title chip in its tier color, then "Rank N".
- Rank-up: when a lesson, review, or test ends with a higher rank than it started with, its result screen shows a "Rank up!" banner with the new rank and title. There is no separate screen and no new sound.

## F. Badges

Twelve badges. Each one is earned once, and the date it was first earned is kept.

| Id | Name | How to earn it |
|---|---|---|
| first-lesson | First steps | Finish your first lesson. |
| perfect | Flawless | Finish a lesson or review with no mistakes. |
| streak-3 | On a roll | Study 3 days in a row. |
| streak-7 | Week warrior | Study 7 days in a row. |
| streak-30 | Unstoppable | Study 30 days in a row. |
| goal | Goal getter | Reach your daily XP goal. |
| review-clear | Clean slate | Empty your review pile with a review. |
| level | Level cleared | Finish every lesson in a level. |
| unit | Unit conquered | Finish every lesson in a unit. |
| test-pass | Test passed | Score 80% or more on a final test. |
| test-100 | Perfect score | Score 100% on a final test. |
| rank-10 | Rank 10 | Reach rank 10. |

- Badges are checked when a session ends, before it is saved. New ones show on the result screen under "New badge!".
- Badges are also checked when the app opens, so an existing save gets the ones it has already earned. These are not announced.
- `perfect` and `review-clear` depend on the session that just ended. The others are read from the save.
- A **Badges (N/12)** button at the bottom of home opens a Badges screen. Earned badges are in color with their date. The others are grey and show how to earn them. **Home** goes back.

## G. Dark mode

- A **Dark mode: on / off** button at the bottom of home. The choice is saved.
- The app sets `data-theme="dark"` or `"light"` on the page's root element on every draw. Dark mode only changes CSS variables.
- Colors written straight into the CSS become variables, so both themes cover them.

## Save data

`version` stays 1. All new fields are optional, and `fillDefaults` adds them to older saves and backups.

- `days`: an object keyed by "YYYY-MM-DD", each value `{ xp: number ≥ 0, studied: boolean }`. Only today and the 13 days before it are kept. Older days are dropped whenever a day is written.
- `badges`: an object keyed by badge id, each value the "YYYY-MM-DD" date it was earned.
- `settings.goal`: 50, 100, 200 or 300. Default 100.
- `settings.theme`: "light" or "dark". Default "light".
- A save with a wrong value in any of these fields is not valid, the same as the existing fields.

## Where the code goes

- `js/game.js`: XP per day, studied days, rank titles, the week strip, the next step, and badges. It still never reads the clock.
- `js/storage.js`: checking and filling the new fields.
- `js/views.js`: the new home screen, the Badges screen, and the rank-up and badge parts of the result screens. `homeModel` takes `today` as a second argument.
- `js/ui.js`: the `resume`, `cycle-goal`, `toggle-theme` and `open-badges` actions, the `badges` screen, setting the theme, and passing rank-up and badge news to the result screens.
- `css/styles.css`: the path, ring, week strip, tier colors, Badges screen and dark theme.
- The phone page (`phone.html`) gets everything through the same files and is republished after the build.

## Build order

1. Save fields (storage) and game rules, with tests.
2. Views, with tests.
3. UI actions and screens, with tests.
4. CSS and a browser check at PC and phone sizes.
5. Final review, then the user's play-through.
