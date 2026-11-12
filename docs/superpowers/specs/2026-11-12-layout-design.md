# Bigger, livelier layout: design

The user said the app "feels tight and small and more boring". They shared a screen recording of a popular language app for inspiration. On 2026-11-12 they picked ideas 1–7 from the list Claude made from it. Everything below is our own design: it borrows layout ideas, not branding or art.

## 1. Full-screen layout

- On phones the app uses the whole width, with 12 px side padding and no outer card borders around home sections.
- On a PC the content column stays at most 720 px wide.
- The base text size goes from 16 to 17 px. Headings and buttons get bigger.

## 2. Chunky 3D buttons

- Buttons, answer choices, path nodes, and cards get a thick bottom edge: a 4 px shadow in a darker shade.
- A button sinks into that edge when pressed.

## 3. Stats bar

A bar stays pinned to the top of the home screen. It has four buttons:

- **Rank:** the rank number in its tier color and the rank title. Opens Profile.
- **Streak:** 🔥 and the streak count, grey when it is 0. Opens Profile.
- **Today's XP:** a small goal ring and today's XP. Opens Profile.
- **Review:** 🔁 and the review pile count. Opens Practice.

## 4. Level banners

- Each level starts with a big colored banner that stays pinned under the stats bar while its lessons scroll by. The next level's banner pushes it away.
- The banner shows "LEVEL n", the title, and Complete ✓ or Locked 🔒.
- Six banner colors repeat down the path, and the level's lesson circles share its color.
- If the level's lessons have teaching cards, a 📖 **Notes** button opens a guide: every card from that level, one at a time. Back and Next move between cards, and Done or Close returns home.

## 5. Path circles

- Lesson circles are 80 px, and the next lesson's circle is 92 px.
- Each circle shows a ★. Open circles use the level color, finished ones are gold, and locked ones are grey.
- A finished lesson shows 1 to 3 small stars under its circle:
  - 3 stars: no mistakes.
  - 2 stars: at least 70% right on the first try.
  - 1 star: finished.
- The best result is kept. Lessons finished before this change show 1 star.
- The final test is a trophy circle at the end.
- Offsets follow the same zigzag as before, at 48 px a step.

### Save data

- `progress[unit].stars` is `{ lessonId: 1 | 2 | 3 }`. It is optional, and `fillDefaults` adds `{}`.
- A value outside 1–3 makes the save invalid.
- Replacing a unit keeps the stars of lessons that still exist.

## 6. Axl beside the path

- The mascot stands beside the current lesson's circle, on the side away from it, with its speech bubble above it.
- If no lesson is left, it stands by the trophy, or by the last lesson when there is no test.
- The home mascot block above Continue is removed. Tapping Axl on the path still gives a hype line.
- A round ⬇ button floats above the tab bar and scrolls to Axl's spot.
- When home opens and that spot is below the bottom of the screen, home scrolls to it.

## 7. Bottom tab bar

A bar pinned to the bottom of the screen on the five main screens:

| Tab | Screen |
|---|---|
| 🏠 Home | The stats bar, unit picker, Continue button, and path. |
| 💪 Practice | Cards for **Mistakes** (the review pile, with a count; Start review), **Final test** (best score or locked; Start test), and **Calculator**. |
| 🏅 Badges | The Badges screen, as before. |
| Profile (the player's axolotl as the icon) | Axl with its name and a **Change** button (to the Mascot screen), the rank title and XP bar, the daily goal ring with the Goal button, the week strip, and a stats grid (total XP, lessons done, best test, badges). |
| ⋯ More | Import, Backup, Sound on/off, Dark mode on/off, and Remove this unit. |

- The active tab is highlighted.
- The page leaves room at the bottom so the bar covers nothing.
- Sub-screens keep their own Home buttons and show no tab bar: the calculator, the Mascot screen, the Notes guide, lessons, and results.

## Code

- `js/game.js`: stars when a lesson completes.
- `js/storage.js`: checking, filling, and keeping `stars`.
- `js/views.js`:
  - the new home pieces;
  - `practiceHtml`, `profileHtml`, `moreHtml`, and `tabBarHtml`;
  - the guide reuses `teachHtml` with its own button actions.
- `js/ui.js`:
  - the `practice`, `profile`, `more`, and `guide` screens;
  - the `open-practice`, `open-profile`, `open-more`, `open-guide`, `guide-next`, `guide-back`, and `jump` actions;
  - home actions now work from any tab screen;
  - scrolling home to Axl's spot.
- `css/styles.css`: the restyle.
