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
- **Typing answers:** `x = 4`, `x=4`, and `4` all count. Fractions and decimals with the same value both count, so `1/2` and `0.5` match.

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
