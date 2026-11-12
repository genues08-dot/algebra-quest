# Algebra Quest

A study app for algebra that works like Duolingo. You give it a unit, and it turns the unit into levels with XP, hearts, a daily streak, and a review pile. It runs on this PC with no internet.

## Open and pin

1. Open this folder and double-click **Algebra Quest** (the purple icon with a white x).
2. To pin it, right-click that shortcut and pick **Pin to taskbar**.

If the shortcut ever stops working, rebuild it. Right-click `tools\make-shortcut.ps1` and pick **Run with PowerShell**, or run this in the folder:

```
powershell -ExecutionPolicy Bypass -File tools/make-shortcut.ps1
```

If you move this folder, rebuild the shortcut, then unpin the old taskbar icon and pin the new shortcut.

## Add a unit

1. Take photos of every page of your packet. Lay each page flat, use good light, and get the whole page in the shot.
2. Put the photos in a new folder inside `packets`, for example `packets\unit-3\`.
3. Open Claude Code in this folder and say: `make a unit from packets/unit-3`.
4. Claude writes a unit file into the `units` folder and tells you its name.
5. In the app, click **Import** and pick that file. The unit shows up in the Unit list.

`units\sample-unit.json` is a practice unit on one-step and two-step equations. Import it to try the app.

## How it works

- **Levels and lessons:** each unit is a path of levels. Finish every lesson in a level to unlock the next one. You can replay any finished lesson.
- **XP and rank:** each correct answer is 10 XP. Finishing a lesson adds 20, and a lesson with no mistakes adds 10 more. Every 100 XP raises your rank.
- **Hearts:** each lesson starts with 5. A wrong answer costs 1 and shows you the worked solution. At 0 the lesson ends and you can retry it.
- **Streak:** finish at least one lesson a day to keep it going. Miss a whole day and it resets.
- **Review:** every question you miss goes into the Review pile. Answer it right in a Review lesson and it leaves the pile.
- **Typing answers:** `x = 4`, `x=4`, `4 = x`, and `4` all count. Fractions, decimals, and mixed numbers with the same value all count, so `5/2`, `2.5`, and `2 1/2` match. For two answers, type them in any order, such as `3, -3` or `x = 3 or x = -3`. Type `<=` and `>=` for ≤ and ≥.
- **Teaching cards:** each lesson opens on a few short cards that teach the idea with a worked example. Tap **Notes** during a lesson to read them again. You come back to the same question.
- **Calculator:** each question has a calculator button. The **Calculator** button at the bottom of the home screen opens it on its own screen, and **Home** goes back. Some questions say "without graphing" and turn the calculator off.
  - **Keys:** type in the box or tap the keys. A key types where the cursor is. **←** deletes and **C** clears the box. **Hide keys** hides the keypad and **Show keys** brings it back.
  - **What it takes:** numbers and `+ - * /` (or `× ÷ −`), `^` for powers, `x²`, `√` or `sqrt`, `root(n, x)` for an nth root (such as `root(3, 8)`), `abs`, `log`, `ln`, `!` for factorial, `pi` or `π`, `e`, and `sin cos tan` with their inverses `asin acos atan`. Fractions show a decimal too, such as 11/12 ≈ 0.9166666667.
  - **DEG/RAD:** switches trig between degrees and radians. The line above the keys shows which one is on. It starts in degrees, and the app remembers your choice.
  - **Ans and history:** `Ans` stands for your last number answer, so `Ans + 1` adds 1 to it. History lists your last 10 results, newest first. Tap one to put it back in the box without running it.
  - **Graphs:** type anything with `x` in it and it draws a graph, with the zeros and turning points marked. Zoom in, zoom out, or reset the view.
- **Final test:** after you finish every lesson in a unit, the final test unlocks. It has no hints and no feedback while you answer. You need 80% to pass. Passing gives +50 XP. Your best score is kept, and you can retake it. Every question you miss goes into the Review pile.
- **Sound:** short sounds play for right and wrong answers and when you finish. Use the **Sound: on / off** button on the home screen to turn them off. The final test plays no right or wrong sounds.
- **One window at a time:** keep only one Algebra Quest window open. If two are open, the app notices and loads the newer progress instead of saving over it.

## Back up and restore

- **Back up:** click **Backup**. A file named `algebra-quest-backup-YYYY-MM-DD.json` lands in your Downloads folder. It holds your units and all your progress.
- **Restore:** click **Import** and pick a backup file. The app asks first, because restoring replaces everything you have now.

## What resets your progress

- **Clearing Edge's browsing data.** The app saves your progress inside Microsoft Edge. If you clear "Cookies and other site data" in Edge, your progress is erased. Make a backup first.
- **A different PC or Windows account.** Progress does not follow you. Make a backup on the old one and import it on the new one.

Moving this folder does not reset your progress.

## For developers

- Run the tests: `node --test "tests/*.test.js"`
- Check a unit file: `node tools/validate-unit.js units/<file>.json`
- Design spec: `docs/superpowers/specs/2026-11-11-algebra-quest-design.md`
