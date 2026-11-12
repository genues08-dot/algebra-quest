# Algebra Quest

A study app for algebra that works like Duolingo. You give it a unit, and it turns the unit into levels with XP, hearts, a daily streak, and a review pile.

It comes in two versions:

- **Online:** https://genues08-dot.github.io/algebra-quest/. Log in with a username and password, keep your progress on any device, and race your friends on the leaderboard. Install it to your home screen like an app.
- **Offline:** `offline.html` in this folder runs on this PC with no internet and no account. Its progress stays on this PC.

## Play online

1. Open https://genues08-dot.github.io/algebra-quest/.
2. Tap **New here? Create an account**. Pick a username (3 to 15 letters, numbers, or _) and a password (at least 6 characters). No email is needed.
3. Install it:
   - **iPhone:** in Safari, tap Share, then **Add to Home Screen**.
   - **Android:** in Chrome, tap the menu, then **Install app** (or **Add to Home screen**).
   - **PC:** in Edge, click the app icon at the right end of the address bar, or the menu, then **Apps**, then **Install Algebra Quest**.
4. Send your friends the link. Everyone who makes an account shows on the leaderboard.

- **Your progress** is saved to your account, so you get the same streak, gems, and axolotl on every device. Each device also keeps a copy, so the app opens offline after the first visit and syncs when it is back online. Use one device at a time: if two devices both change your progress while offline, the one changed last wins.
- **Leaderboard:** the **Leaders** tab ranks everyone by XP. **This week** starts over every Monday. **All time** counts all your XP. Your row is highlighted. On the online app, **Badges** open from your **Profile**.
- **Account:** **More** shows who is logged in, with **Log out** and **Delete my account**. Deleting removes your progress, your leaderboard spot, and your login for good. If it asks you to log in again first, log out, log back in, and delete within a few minutes.
- **Forgot your password?** It can't be reset by email, because there is no email. Ask the owner (see below).
- **Moving your PC progress online:** in the offline app, open **More**, then **Backup**. Then in the online app, open **More**, then **Import**, and pick that backup file.

## Run the online app (owner)

The website is this folder, served by GitHub Pages from the `main` branch of `genues08-dot/algebra-quest`. Accounts, saves, and the leaderboard live in the Firebase project `algebra-quest1`.

- **Reset a friend's password:** Firebase can't set a password for someone. Instead, open https://console.firebase.google.com/project/algebra-quest1/authentication/users, find their login (it shows as `username@algebra-quest1.firebaseapp.com`), and delete it from its ⋮ menu. Then they tap **Create account** with the same username and a new password. Their progress and leaderboard spot come back, because both are stored under the username.
- **Remove a player from the leaderboard:** in the Firebase console, open **Firestore Database**, then `players`, and delete their row. Delete their login under **Authentication** too, or the row comes back when they play.
- **Database rules:** `firestore.rules` holds them. After changing the file, paste it into the console under **Firestore Database**, then **Rules**, then click **Publish**.
- **Publish a change:** commit it to `main` and push. GitHub Pages updates the site within a few minutes, and players get it the next time they open the app online.
- **Add a unit for everyone:** make the unit file as below, then run `node tools/make-phone-units.js units/<every unit>.json` to rebuild `js/phone-units.js`, and publish.

## Open and pin the offline version

1. Open this folder and double-click **Algebra Quest** (the purple icon with a white x). It opens `offline.html`.
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

- **Getting around:** the bar at the bottom switches between **Home**, **Quests** (daily quests, week rewards, and the weekly challenge), **Practice** (your missed questions, the final test, Unit Rewind, Speed Round, and the calculator), **Badges** (**Leaders** in the online app), **Profile** (your axolotl, rank, daily goal, week, stats, the Shop, and Badges), and **More** (Import, Backup, Sound, Dark mode, Remove this unit, and your account in the online app). The bar at the top of Home shows your rank, streak, XP today, gems, and questions to review. Tap any of them for more. A red dot on Quests means a reward is waiting.
- **Levels and lessons:** each unit is a winding path of lesson circles, grouped under a colored banner for each level. Tap 📖 on a banner to read that level's notes. A finished lesson shows 1 to 3 stars: 3 for no mistakes, 2 for at least 70% right the first time. Finish every lesson in a level to unlock the next one. You can replay any finished lesson. The glowing circle marked **Start** is your next lesson, and the trophy at the end is the final test.
- **Continue:** the big **Continue** button starts your next lesson. When every lesson is done, it starts the final test, and after you pass, it starts a review of the questions you missed.
- **XP and rank:** each correct answer is 10 XP. Finishing a lesson adds 20, and a lesson with no mistakes adds 10 more. Every 100 XP raises your rank. Ranks have titles, from Rookie (ranks 1–2) up to Algebra Legend (rank 30 and up). When a lesson raises your rank, its result screen says so.
- **Daily goal:** the ring at the top fills with the XP you earn today. The goal starts at 100 XP, about one lesson. Tap **Goal** to change it to 50, 100, 200, or 300 XP.
- **Hearts:** each lesson starts with 5. A wrong answer costs 1 and shows you the worked solution. At 0 the lesson ends and you can retry it.
- **Streak:** finish at least one lesson a day to keep it going. Miss a whole day and it resets. The seven dots next to it show the last seven days. A filled dot is a day you finished a lesson, review, or test, and the ringed dot is today.
- **Badges:** there are 12 to earn, such as finishing a lesson with no mistakes or keeping a 7-day streak. New ones show on the result screen. Tap the **Badges** tab, or **Badges** on Profile, to see them all and how to earn the rest.
- **Review:** every question you miss goes into the Review pile. Answer it right in a Review lesson and it leaves the pile.
- **Gems:** earn 💎 by opening the chest on each level's path (after its second lesson), finishing daily quests, claiming a week reward each day you study, and beating last week's XP. Spend them in the **Shop** (tap 💎 at the top of Home, or **Shop** on Profile).
- **Shop:** a streak freeze (50 💎, hold up to 2) saves your streak on a day you miss. Hats (party hat, beanie, bow, grad cap, wizard hat, crown) go on your axolotl everywhere. Tap **Wear** or **Take off**.
- **Quests:** three new quests each day, such as "Get 5 right in a row". The week rewards grow each day you study, up to 50 💎 on the seventh. The weekly challenge pays 30 💎 when this week's XP beats last week's.
- **Practice modes:** **Unit Rewind** mixes 10 questions from lessons you finished, for a +20 XP bonus. **Speed Round** gives you 60 seconds to answer as many as you can, and keeps your best.
- **Combos:** 3 or more right in a row shows a 🔥 combo, and every 5 in a row adds +5 XP.
- **Typing answers:** `x = 4`, `x=4`, `4 = x`, and `4` all count. Fractions, decimals, and mixed numbers with the same value all count, so `5/2`, `2.5`, and `2 1/2` match. For two answers, type them in any order, such as `3, -3` or `x = 3 or x = -3`. Type `<=` and `>=` for ≤ and ≥.
- **Teaching cards:** each lesson opens on a few short cards that teach the idea with a worked example. Tap **Notes** during a lesson to read them again. You come back to the same question.
- **Calculator:** each question has a calculator button. The **Calculator** card on the **Practice** tab opens it on its own screen, and **Home** goes back. Some questions say "without graphing" and turn the calculator off.
  - **Keys:** type in the box or tap the keys. A key types where the cursor is. **←** deletes and **C** clears the box. **Hide keys** hides the keypad and **Show keys** brings it back. After **=**, typing or a key starts a new calculation, but an operator key such as **+** goes on from `Ans`.
  - **What it takes:** numbers and `+ - * /` (or `× ÷ −`), `^` for powers, `x²`, `√` or `sqrt`, `root(n, x)` for an nth root (such as `root(3, 8)`), `abs`, `log`, `ln`, `!` for factorial, `pi` or `π`, `e`, and `sin cos tan` with their inverses `asin acos atan`. Fractions show a decimal too, such as 11/12 ≈ 0.9166666667.
  - **DEG/RAD:** switches trig between degrees and radians. The line above the keys shows which one is on. It starts in degrees, and the app remembers your choice.
  - **Ans and history:** `Ans` stands for your last number answer, so `Ans + 1` adds 1 to it. History lists your last 10 results, newest first. Tap one to put it back in the box without running it.
  - **Graphs:** type anything with `x` in it and it draws a graph, with the zeros and turning points marked. Zoom in, zoom out, or reset the view.
- **Final test:** after you finish every lesson in a unit, the final test unlocks. It has no hints and no feedback while you answer. You need 80% to pass. Passing gives +50 XP. Your best score is kept, and you can retake it. Every question you miss goes into the Review pile.
- **Sound:** short sounds play for right and wrong answers and when you finish. Use the **Sound: on / off** button on the home screen to turn them off. The final test plays no right or wrong sounds.
- **Your axolotl:** an axolotl mascot cheers you on. It greets you on the home screen, reacts to your answers, explains the teaching cards, and celebrates on the result screens. Tap it on the home screen for a new line. On the **Profile** tab, tap **Change color or name** to pick its color (pink, purple, or blue) and give it a name. It stays quiet during the final test.
- **Dark mode:** the **Dark mode: on / off** button on the **More** tab switches to a dark theme. The app remembers your choice.
- **One window at a time:** keep only one Algebra Quest window open. If two are open, the app notices and loads the newer progress instead of saving over it.

## Back up and restore

- **Back up:** click **Backup**. A file named `algebra-quest-backup-YYYY-MM-DD.json` lands in your Downloads folder. It holds your units and all your progress.
- **Restore:** click **Import** and pick a backup file. The app asks first, because restoring replaces everything you have now.

## What resets your progress

In the online app, your progress is in your account, so none of the below erases it. These are about the offline version.

- **Clearing Edge's browsing data.** The app saves your progress inside Microsoft Edge. If you clear "Cookies and other site data" in Edge, your progress is erased. Make a backup first.
- **A different PC or Windows account.** Progress does not follow you. Make a backup on the old one and import it on the new one.

Moving this folder does not reset your progress.

## For developers

- Run the tests: `node --test "tests/*.test.js"`
- Check a unit file: `node tools/validate-unit.js units/<file>.json`
- Design spec: `docs/superpowers/specs/2026-11-11-algebra-quest-design.md`. The online app: `docs/superpowers/specs/2026-11-12-online-design.md`.
- Check the online app without Firebase: serve this folder (any local web server) and open `tests/web-fake.html`. It runs on a fake cloud kept in the browser, with two made-up friends on the leaderboard.
