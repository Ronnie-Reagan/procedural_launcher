# [Procedural Launcher](https://ronnie-reagan.github.io/procedural_launcher/)

I am Don Reagan and this is my cozy physics toy: sling a luminous orb, coax it into a shifting bucket, vibe out to Kevin MacLeod, and chase a calming streak instead of adrenaline spikes. Everything here is handcrafted vanilla HTML5 canvas with inline UI so it feels instant on touchscreens and desktops alike.

## Loop at a Glance

- Pull the orb from the launch pad (lower left), aim with the elastic trail, and release.
- Gravity, drag, wall bounces, and a procedural bucket layout keep every attempt fresh.
- Scoreboard shows **streak**, **best streak**, and **lifetime** makes. These values live in `localStorage` so players resume where they stopped.
- Pause opens a glass-panel overlay with resume, audio toggles, install hints, stats reset, and credits.
- Music and SFX can be toggled or rebalanced at runtime; preferences persist between sessions.

## Optional Training Wheels

- Toggle **Trajectory Preview** to see the predicted arc while aiming. It is available until you beat a streak of 5 or anytime after entering the `orbit` cheat code in Settings.
- **Super Easy Mode** widens and lowers the bucket and relaxes the rim detection for a laid-back vibe.
- **Streak Shield** keeps your streak from dropping on a miss so you can practice without pressure.
- All assists live in the Pause → Settings panel alongside the cheat code input.

## Layout Map & Mod Zones

I keep everything in a single `script.js` for now. If you are tinkering, here is the mental map:

- `state` (top of `script.js`) defines physics, UI references, persisted stats, and audio prefs. Tweak gravity, drag, or UI copy safely here.
- `rebuildBackdrop()` and `randomizeBucket()` are the best hooks for cosmetic experimentation (colors, gradients, bucket styles). They are self-contained.
- Pointer handling (`pointerdown` → `launchBall`) plus `updateBall()` control the physics. Unless you plan to overhaul core gameplay, leave `updateBall()` and `collideBallLine()` alone; a tiny typo here will break bounces and detection.
- Audio helpers (`playSuccessSound`, `playCollisionSound`, `startMusic`, etc.) are modular. It is safe to swap tracks or integrate another playlist loader without touching physics.
- UI helpers (`createMenuButton`, `createSliderRow`, etc.) render the pause/settings overlay. They are good spots to add more controls if you respect the shared styling object.
- The service layer is intentionally minimal—`storage` wraps `localStorage`, and there is no build tooling. Keep edits simple and vanilla.

## Persistence, Audio, and Scaling

- Stats keys: `launcher_best`, `launcher_lifetime`, `launcher_music_enabled`, `launcher_sfx_enabled`, and matching volume keys. Back up or migrate them if you ever change the prefix.
- Music lives in `music/Calming`. Playback is sequential shuffle; if a browser blocks autoplay the next pointer/tap unlocks the audio context.
- Canvas resizes with `resizeCanvas()` and enforces a responsive UI scale so HUD, pause badge, and instructions remain legible on small displays. Stick with those helpers when adding UI instead of setting arbitrary widths.

## Install and Play Anywhere (Current State)

There are no native binaries. Install it as a Progressive Web App (PWA) from [ronnie-reagan.github.io/procedural_launcher](https://ronnie-reagan.github.io/procedural_launcher/):

### Windows and Linux (Chrome or Edge)
1. Open the site in Chrome or Edge.
2. Watch for the install icon in the omnibox (or use the ⋮ menu → **Cast, Save and Share** → **Install page as app**).
3. Confirm to pin it to the Start menu or taskbar.

### Chromebook
1. Visit the site in Chrome.
2. Tap the install chip in the address bar or use the ⋮ menu → **Install Procedural Launcher**.
3. The app lands in the launcher shelf and works offline once the assets are cached (see roadmap below).

### Android (Chrome)
1. Navigate to the site, tap the ⋮ menu.
2. Choose **Add to Home Screen** → confirm.
3. The launcher icon behaves like any other app shortcut.

### iOS / iPadOS (Safari)
1. Open the site in Safari.
2. Tap the share icon → **Add to Home Screen**.
3. Confirm; the app installs full screen.

_Offline ability is being tracked in `AUDIT_REPORT.md` under “Offline/PWA rollout plan.”_

## Customizing or Contributing

- **Safe edits**: HUD copy, instruction text, button labels, playlists, default physics constants, and color palettes. These areas are labeled in `script.js`.
- **Handle with care**: `updateBall`, `collideBallLine`, persistence helpers, and DOM-creation bootstrapping near the top of the file. They are intertwined with input handling and scoring.
- **Do not touch unless you are refactoring**: the pointer capture logic, the `tick` loop, and the stat/badge updates. Bugs here lock the UI or tank performance.
- `notes.md` remains my scratch pad for retrospective thoughts; feel free to append structured notes there after syncing with the audit report.

## Documentation & Planning

- `AUDIT_REPORT.md` — exhaustive review, logic findings, future topics, player questions, and rollout plans written from my perspective.
- `notes.md` — rolling diary of experiments, player feedback, and legacy todos.
- `music/credits.md` — Kevin MacLeod attribution list.

## Credits

- Design, code, artwork: **Don Reagan**
- Testing: **Gaymer**, **Tunaz_420**, **ɮǟʀɮաɨʀɛ**, **Nishi Billi**
- Music: **Kevin MacLeod** ([Creative Commons BY 3.0](https://creativecommons.org/licenses/by/3.0/))
