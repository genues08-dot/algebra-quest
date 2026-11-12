# Online play: accounts, cloud save, leaderboard, and home-screen install: design

On 2026-11-12 the user asked to turn Algebra Quest into something they can add to their home screen and share with friends, with a leaderboard and accounts that use a username and password. They chose:

- **Hosting:** GitHub Pages, from the public repo `genues08-dot/algebra-quest`.
- **Accounts and data:** Firebase (free Spark plan), project `algebra-quest1`.
- **Sign-up:** a username and password only, with no email.
- **Leaderboard:** two tabs, This week and All time.
- **Saves:** progress is saved online with the account.
- **Branches:** merge all feature branches into `main` before publishing.

Claude chose the details below. The work is built on branch `online`, cut from `main` after the merge.

## Pages

- `index.html` is the online app. GitHub Pages serves it at `https://genues08-dot.github.io/algebra-quest/`.
- The old PC page moves to `offline.html`. It still runs from `file://` with `localStorage`, unchanged, and the desktop shortcut points to it.
- `phone.html`, the claude.ai build, is unchanged.
- The online app bundles the units in `js/phone-units.js`, as the phone build does, so friends never import anything.

## Install and offline play

- `manifest.webmanifest` declares:
  - the name "Algebra Quest";
  - `display: standalone`;
  - the theme color;
  - icons at 192 and 512 px, plus a 180 px `apple-touch-icon`, all drawn from `img/axl/pink-happy.png`.
- `sw.js` is a service worker:
  - same-origin files are network-first, with the cache as the fallback;
  - the Firebase scripts from `www.gstatic.com` are cache-first, since their URLs carry the version;
  - Firebase's own API calls are not touched.
- After one online visit, the app opens offline:
  - it uses the device's copy of the save;
  - it syncs the next time it is online.
- Installing:
  - **iPhone (Safari):** Share, then Add to Home Screen.
  - **Android (Chrome):** Install app.
  - **PC (Edge):** Install Algebra Quest.

## Accounts (Firebase Authentication, email and password provider)

- **Username:** 3 to 15 letters, numbers, or underscores. Capital letters don't matter for logging in. The username is shown as it was first typed.
- **Password:** 6 to 128 characters.
- **Login address:** Firebase needs an email address, so the app makes `<username in lowercase>@algebra-quest1.firebaseapp.com`.
  - No email is ever sent or collected.
  - Firebase keeps these addresses unique, so two players can't share a username.
- **Display name:** the username as typed is kept in the account's display name.
- **Staying logged in:** Firebase keeps the player logged in on that device.
- **Account section** on the More screen:
  - "Logged in as name".
  - **Log out**.
  - **Delete my account**, which deletes the save, the leaderboard row, and the login. If Firebase asks for a fresh login first, the app says to log out, log back in, and try again.
- **Forgotten passwords:** Firebase can't set a password for a player, and there is no email to reset it with. Saves and leaderboard rows are kept under the lowercase username, not Firebase's user id. So the owner deletes the login in the Firebase console (Authentication, then Users), and the player signs up again with the same username and a new password, which gets their progress back. The README gives the steps.
- **Error messages:**

| Firebase error | Message |
|---|---|
| `auth/email-already-in-use` | That username is taken. |
| `auth/invalid-credential` | Wrong username or password. |
| `auth/wrong-password` | Wrong username or password. |
| `auth/user-not-found` | Wrong username or password. |
| `auth/too-many-requests` | Too many tries. Wait a few minutes and try again. |
| `auth/network-request-failed` | No internet connection. |
| Anything else | Something went wrong (`code`). |

## Login screen

- Drawn by `js/web-boot.js` before the app mounts. It uses the app's own styles and Axl.
- It has two modes, **Log in** and **Create account**, switched by a link.
- Each mode has a username box and a password box. Create account adds a second password box.
- The first visit needs the internet. If Firebase can't load and the device has no saved copy, the screen says so and offers **Try again**.

## Cloud save (Cloud Firestore)

- Each player's save is the document `saves/{name}`, where name is the lowercase username. It holds `{ save, savedAt }`.
  - `save` is the save text, with bundled units replaced by `"bundled"` as in the phone build.
  - `savedAt` is an ISO time.
- Each device keeps a copy in `localStorage` under `algebraQuest.web.<name>`, holding `{ save, savedAt }`. Two friends can then share one phone without mixing up their progress.
- **On start:**
  - The app reads the cloud document. It uses the newer of the cloud and device copies, by `savedAt`.
  - If the device copy is newer, it is uploaded.
  - If the cloud read fails or takes over 10 seconds, the app starts from the device copy and says progress will sync later. Before its first upload, it reads the cloud again. If the cloud changed after the copy the app started from, another device has played since. The app then keeps the cloud's progress, drops this visit's offline play, and reloads.
  - If the cloud can't be reached and the device has no copy, the app does not start fresh, because that could replace real progress. It says it can't reach the progress and offers **Try again**.
  - With no save in the cloud or on the device, the app starts fresh with the bundled units.
- **Writing:**
  - Every write updates the device copy at once.
  - Writes to the cloud go one at a time, always sending the newest save.
  - A failed cloud write shows one message, then keeps trying on later saves.
- **Moving existing progress:** make a Backup in the old app (`offline.html`), then use More, Import on the website. Import already handles backups.

## Leaderboard

- Each player has the document `players/{name}`, which holds:
  - `name`: the display username;
  - `nameLower`;
  - `weekXp`: the XP from Monday to today, from `days`;
  - `week`: that Monday's date;
  - `totalXp`: `save.xp`;
  - `color` and `hat`: the axolotl's color and hat;
  - `updated`: the server time.
- The row is written:
  - after a save, when any of its values changed;
  - 3 seconds after the first save, then at most once every 15 seconds;
  - right away when the app is hidden, such as when the player switches apps.
- **Tab bar:** in the online app, the Badges tab becomes **Leaders** (🏆). Badges open from a button on Profile, which shows in every build.
- **Leaderboard screen:**
  - Two tabs: **This week** and **All time**.
  - It loads every `players` row (at most 500) each time the screen opens, then ranks them on the device.
  - **This week:** rows whose `week` is not the viewer's current Monday count as 0. Rows with 0 are hidden, except the viewer's own.
  - **All time:** shows every row.
  - Ranks are ordered by XP, highest first. Ties share a rank and are ordered by name.
  - Each row shows the rank, with 🥇🥈🥉 for ranks 1 to 3, the player's axolotl with its hat, the name, and the XP.
  - The viewer's row is highlighted.
  - Axl's line above the list says the viewer's place, such as "You're #3 this week!", or "Earn XP to get on the board!".
  - While loading it shows "Loading…". After an error it shows a message and a **Try again** button.

## Security rules (`firestore.rules`, pasted into the Firebase console)

- A player owns `saves/{name}` and `players/{name}` only when their login address is exactly `<name>@algebra-quest1.firebaseapp.com`. The whole address is checked, so a login made some other way (such as `name@gmail.com` through Firebase's public API) owns nothing.
- `saves/{name}`:
  - only the signed-in owner can read, write, or delete it;
  - its fields are only `save` (a string under 900,000 characters) and `savedAt` (a string).
- `players/{name}`:
  - any signed-in player can read it;
  - only its owner can write or delete it.
- A written `players` row must have:
  - `nameLower` equal to the document's name;
  - `name` matching the username rule, and equal to `nameLower` when lowercased;
  - `weekXp` and `totalXp` as whole numbers from 0 to 10,000,000, with `weekXp` no more than `totalXp`;
  - `week` as a 10-character string;
  - `color` from the three colors, and `hat` either null or a known hat;
  - `updated` equal to the request time.
- Everything else is denied.
- XP is counted on the player's device, so a determined player could fake their own XP. For a game among friends, that is accepted.

## Files

- New:
  - `js/online.js`: pure functions for username rules, login addresses, leaderboard rows and ranking, and picking the newer save. It is tested in node.
  - `js/firebase-config.js`: the project's public web config.
  - `js/cloud.js`: a thin layer over the Firebase compat SDK.
  - `js/web-boot.js`: login, save syncing, leaderboard writes, and starting the app.
  - `firestore.rules`, `manifest.webmanifest`, `sw.js`, and `img/icon-*.png`.
- Changed:
  - `index.html` (now the online app);
  - `views.js`: the Leaders tab, the leaderboard screen, the Account section, and the Badges button;
  - `ui.js`: `mount(root, storage, options)` with `options.online`;
  - `README.md` and `CLAUDE.md`.
- Moved: the old `index.html` becomes `offline.html`.
- The Firebase SDK is the 13.3.0 compat build, loaded with classic `<script>` tags from `www.gstatic.com`, so there are still no ES modules and no build step.

## Testing

- Node tests cover:
  - `online.js`: usernames, login addresses, week XP, leaderboard rows, ranking, ties, and the newer save;
  - the leaderboard and account views;
  - the online UI flows, with a fake online object.
- A browser check runs `index.html` with a fake cloud in place of Firebase, because Claude may not create accounts with a real identity provider.
- The user makes the first real account after publishing.
