# Rewards, quests, practice modes, and more lessons: design

On 2026-11-12 the user asked for ideas 8–17 from Claude's list, plus more lessons per level. They chose 4 lessons per level, with new questions. Claude chose the details below. The work is built on branch `quests`, cut from `layout`.

## Gems (shared by 8–12, 16)

- `save.gems`: a whole number of 0 or more. It starts at 0, and `fillDefaults` adds it.
- Earned from:
  - path chests: 15, 20, or 25 gems, depending on the level (`15 + 5 × (level index mod 3)`);
  - daily quests: 10, 15, or 20 each;
  - the week rewards calendar;
  - beating last week's XP: 30.
- Spent in the Shop.
- Shown in the stats bar (💎 n, which opens the Shop) and on Profile.

## 8. Chests on the path

- One chest per level, between lesson 2 and lesson 3, drawn as an SVG chest circle.
- The chest is ready once every lesson before it in that level is complete. Before that it is locked and grey.
- A ready chest glows. Tapping it opens it: the gems are added, and a **Reward** screen shows the opened chest, "+n gems", and Axl cheering, with confetti.
- An opened chest stays open and can't be tapped.
- `progress[unit].chests`: a list of opened level indexes as strings, such as `["0", "3"]`.

## 9. Shop and axolotl outfits

The Shop is a screen opened from the gems in the stats bar and from a Shop button on Profile.

- **Streak freeze:** 50 gems. You can hold at most 2.
- **Hats:**

| Id | Name | Price |
|---|---|---|
| party | Party hat | 30 |
| beanie | Beanie | 40 |
| bow | Bow | 40 |
| grad | Grad cap | 60 |
| wizard | Wizard hat | 100 |
| crown | Crown | 120 |

- Bought once. You can wear one at a time, or none.
- `save.outfits`: `{ owned: [ids], worn: id or null }`.
- A hat is an SVG drawn over every axolotl picture (path, feedback, results, Profile, Mascot screen). It is placed using a per-pose anchor measured from the 12 images: the head top centre and the head width, as fractions of the image box.

## 10. Streak freeze

- `save.freezes` holds 0 to 2.
- When the app opens and whole days were missed since `lastStudyDate`, and `freezes` covers every missed day:
  - those freezes are used;
  - each missed day is logged with `frozen: true` in `days`;
  - `lastStudyDate` becomes yesterday, so the streak is kept (not increased).
  - A message says so: "❄ Streak freeze used! Your n-day streak is safe."
- With too few freezes, none are used, and the streak resets as before.
- The week strip shows a frozen day as ❄.

## 11. Daily quests (new Quests tab)

- Three quests a day, picked from this pool by the date, so the same date always gives the same three:

| Id | Text | Target | Gems |
|---|---|---|---|
| xp50 | Earn 50 XP | 50 | 10 |
| xp100 | Earn 100 XP | 100 | 20 |
| lessons2 | Finish 2 lessons | 2 | 15 |
| combo5 | Get 5 right in a row | 5 | 15 |
| perfect1 | Finish a lesson with no mistakes | 1 | 15 |
| correct15 | Answer 15 questions right | 15 | 10 |
| practice1 | Finish a review or practice round | 1 | 10 |

- `save.daily = { date, lessons, perfect, correct, bestCombo, practice, claimed: [ids] }`. It is reset when the date changes. XP today comes from `days`.
- A finished quest shows **Claim** for its gems. A countdown shows the hours until midnight.

## 12. Week rewards calendar (Quests tab)

- The week starts on Monday. `save.weekRewards = { week: Monday date, claimed: [dates] }`.
- Once a day, after finishing any lesson, review, or practice round that day, you can claim the next reward.
- The rewards for the 1st to 7th claim of the week are 5, 10, 10, 15, 15, 20, and 50 gems.
- Seven slots show claimed (✓), claimable today (glowing), and future.

## 13. Practice modes (Practice tab)

- **Unit Rewind:** 10 random questions from finished lessons of the current unit.
  - Hearts and feedback work like a lesson. Finishing adds +20 XP.
  - It doesn't take questions off the review pile.
  - It needs at least 1 finished lesson.
- **Speed Round:** 60 seconds, questions shuffled from finished lessons (up to 40).
  - No hearts and no feedback panel: each answer moves straight on.
  - 10 XP per right answer, and wrong answers go to the review pile.
  - It ends when the time runs out (checked on each answer, plus a timer) or the questions run out.
  - Result: "n right in 60 seconds". The best is kept in `progress[unit].speedBest`.
  - The time left drains in a CSS bar, so nothing redraws every second.
- Both count for the streak, the "practice" quest, and the week reward.

## 14. Combo counter and XP pop

- `session.combo` counts right answers in a row in lessons, reviews, and Unit Rewind.
- The feedback panel shows "🔥 n in a row!" from 3 up.
- Every 5th in a row gives +5 bonus XP.
- `session.bestCombo` feeds the combo5 quest and `save.bestCombo`, the best ever, shown on Profile.
- A right answer shows a floating "+10 XP" (or "+15 XP") in the feedback panel.

## 15. Confetti

- About 28 CSS pieces fall once, on:
  - a finished lesson, review, or Rewind;
  - a passed test;
  - a rank-up;
  - an opened chest;
  - a new Speed Round best.
- There is no confetti when the user has reduced motion turned on.

## 16. Weekly challenge (Quests tab)

- This week's XP (Monday to today) against last week's (Monday to Sunday), from `days`. The 14-day log covers both.
- The target is last week's XP + 1, and at least 100.
- Beating it lets you claim 30 gems once per week. `save.weekChallenge = { week, claimed }`.

## 17. Profile additions

- Gems, streak freezes, best combo, and Speed Round best are added to the stats grid.
- A **Shop** button.
- The axolotl wears its hat.

## Tabs and stats bar

- The tabs are now Home, Quests (🎯), Practice, Badges, Profile, and More.
- The stats bar is: rank, streak (❄ beside it when you hold a freeze), XP today, 💎 gems, and 🔁 review.

## Level unlocking change

Unit 5 gets new lessons, and levels finished before would otherwise lock again. So:

- A level is open when the level before it is complete, **or** when it or any later level has a finished lesson.
- A level is complete only when all of its lessons are complete.

## More lessons per level (Unit 5)

- Each level gets lessons 3 and 4 (`<levelid>-3`, `<levelid>-4`), each with 1–2 teaching cards and about 8 new questions.
- The questions are generated by script from the packet's problem types, and every answer is checked by computation.
- Question ids are new and unique. The final test is unchanged.
- `js/phone-units.js` is rebuilt.

## Save validation

All new fields are optional and checked:

- `gems` and `freezes` (0–2) are whole numbers.
- `outfits.owned` holds known ids, and `outfits.worn` is null or an owned id.
- `daily`, `weekRewards`, and `weekChallenge` have the shapes above, with dates as "YYYY-MM-DD".
- `bestCombo` is a whole number.
- `progress.chests` holds strings, and `progress.speedBest` is a whole number.
- `days[d].frozen` is optional and boolean.
