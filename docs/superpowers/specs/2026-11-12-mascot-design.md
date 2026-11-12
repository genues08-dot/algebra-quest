# Axolotl mascot: design

A mascot makes the app feel alive. The user chose these on 2026-11-12:

- **The animal** is an axolotl, drawn by the user: it sits, wears a green bandana with a white plus, and has leafy gills.
- **Colors:** the player picks pink, purple, or blue.
- **Name:** the player picks a name, and the default is "Axl".
- **Personality:** hype and cheerful.
- **No glasses option**, because the art has glasses only for the waving pose.
- **Where it shows:** the home screen, lesson feedback, result screens, and teaching cards.

## Art

- The user's two picture sheets are cut out into 12 transparent PNGs: `img/axl/<color>-<mood>.png`.
  - `color` is `pink`, `purple`, or `blue`.
  - `mood` is `happy` (waving), `cheer` (arms up, confetti), `encourage` (hand on chest), or `think` (hand on chin, "?").
- Each image is at most 240 px on a side, so it stays sharp at twice the size it is shown. All 12 together are about 780 KB.
- The cut-out script lives outside the repo. Run it again only if the art changes.

## Save data

`settings.mascot` is `{ color, name }`. The default is `{ color: "pink", name: "Axl" }`, and `fillDefaults` adds it to older saves.

A save is not valid when:

- `color` is not one of the three colors, or
- `name` is not a string of 1 to 16 characters after trimming.

## What the mascot says

`js/mascot.js` (`AQ.mascot`) holds the lines and picks one. It never reads the clock or uses random numbers itself. When a line is picked from a list, the caller passes a number from 0 up to, but not including, 1.

### Home screen

The mascot uses the happy pose. Its line is the first of these that applies:

1. **No units:** "Hi, I'm {name}! Import a unit and let's crush some algebra!"
2. **Goal met today:** "Goal smashed today! You're unstoppable!"
3. **Streak at risk** (a streak, and nothing finished today): "{streak}-day streak! One lesson keeps it alive!"
4. **Some XP today, goal not met:** "{left} XP to your goal! LET'S GO!"
5. **Unit complete** (the Continue step is "done"): "Unit complete! You're an algebra legend!"
6. **Otherwise:** "Ready? Next up: {next}!"
   - `{next}` is the next lesson's level title, "the final test", or "your review pile".

Tapping the mascot shows a random line from a list of hype lines, and it bounces. The home line comes back after the next redraw of home from another screen.

### The rest of the app

- **Lesson feedback:** the cheer pose with a random line when the answer is right. The encourage pose with a random line when it is wrong.
- **Final test questions:** no mascot, so it cannot give the answer away.
- **Teaching cards:** a small thinking pose.
  - First card: "Here's the trick!"
  - Last card: "Got it? Let's practice!"
  - Any other card: "Keep going!"
  - A lesson with a single card uses the first-card line.
- **Lesson complete:** the cheer pose. "PERFECT! Not a single mistake!" for a perfect lesson, otherwise "Lesson done! You crushed it!".
- **Out of hearts:** the encourage pose. "Out of hearts, not out of fight! Read these, then try again."
- **Final test:** the cheer pose with "YOU PASSED! I knew you could do it!" when passed. Otherwise the encourage pose with "So close! Review the misses and come back stronger!".

## Mascot screen

- A **Mascot** button at the bottom of home opens it.
- It shows the three colors as the happy pose. The chosen color is marked. Tapping a color saves it.
- It has a name box of up to 16 characters and a **Save name** button.
  - An empty name is not saved. A message asks for a name.
  - Enter in the box also saves.
- **Home** goes back.

## Motion

- On home, the mascot bobs gently.
- The cheer pose bounces once when it appears.
- A tap on home makes it bounce.
- There is no motion when the user has reduced motion turned on.

## Files

| File | What changes |
|---|---|
| `js/mascot.js` | New: lines, colors, image paths. It loads after `game.js`. |
| `js/storage.js` | `settings.mascot`: default, check, and fill. |
| `js/views.js` | `mascotHtml`; the mascot on home, feedback, teaching cards, and result screens; the Mascot screen. |
| `js/ui.js` | The `mascot-tap`, `open-mascot`, `mascot-color`, and `mascot-name` actions; the `mascot` screen; picking lines when answers are checked. |
| `css/styles.css` | Mascot layout, speech bubble, motion. |
| `index.html`, `phone.html` | Load `js/mascot.js`. |
| `img/axl/*.png` | The 12 poses. |

The phone page is republished with the new files.
