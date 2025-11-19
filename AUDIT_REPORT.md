# Procedural Launcher — Full Audit

I walked the entire repo, line by line, and wrote this for anyone curious about where the project truly stands—player, collaborator, or future-me after some rest. Use this as the single reference for what works, what is brittle, and where I am steering the launcher next.

## 1. Codebase Snapshot

- `index.html` — ultra-thin bootstrap that simply loads `script.js`. No manifest or meta tags yet.
- `script.js` — 2,100+ lines of DOM construction, canvas rendering, physics, audio, storage, and pause/settings UI.
- `music/Calming` — Kevin MacLeod MP3 set used for the in-game playlist; referenced programmatically.
- `music/credits.md` — attribution list that the pause menu mirrors.
- `notes.md` — historical diary of how the concept formed plus additional reminders (now pointing back to this audit).
- `README.md` — public-facing overview with install instructions and edit guidance.

There are **no** build tools, dependencies, or compiled assets. Everything is first-party JavaScript and static files.

## 2. How the Game Works Front to Back

1. `script.js` wipes the default document body, injects a full-viewport canvas, HUD, pause button, instructions, now-playing badge, and the pause/settings overlay ([script.js:5](script.js:5)).
2. Persistent state (`state`) tracks dimensions, physics coefficients, bucket and ball props, UI scale, sparkles, floating texts, and audio preferences ([script.js:67](script.js:67)).
3. `resizeCanvas()` sizes the canvas to device pixels, recalculates the ground line, launch origin, and UI scaling, rebuilds the parallax background, and randomizes the bucket ([script.js:1490](script.js:1490)).
4. Input flow:
   - Pointer down near the orb grabs it, clamps drag distance, and previews the elastic aim line ([script.js:1546](script.js:1546)).
   - Pointer up calls `launchBall()` to convert pull distance into `vx/vy`, hides the aim, and triggers the launch SFX ([script.js:1607](script.js:1607)).
5. `updateBall()` drives motion in tiny sub-steps: apply gravity, detect ground/wall/ceiling/bucket collisions, call `finishAttempt()` on success/fail, and collect a 60-point trail for rendering ([script.js:1730](script.js:1730)).
6. Rendering splits into `drawBackground`, `drawGround`, `drawLaunchPad`, `drawBucket`, `drawTrail`, `drawBall`, `drawAim`, `drawSparkles`, and `drawFloatingTexts`, all executed each animation frame ([script.js:1886](script.js:1886)).
7. Audio: Web Audio context lazy-initializes; playlist playback uses a plain `<audio>` element and `playTrackAt()` to rotate through `music/Calming` ([script.js:868](script.js:868)). Launch/collision success cues are synthesized.
8. Data: streak, best streak, lifetime makes, and audio preferences persist through `localStorage` via the `storage` helper ([script.js:45](script.js:45)).
9. Pause overlay: `createMenuButton`, slider constructors, and view toggles build the pause + settings panels on the fly; toggles call into the same state setters as gameplay ([script.js:187](script.js:187)).

## 3. Layout Guidance — What to Tweak vs Leave Alone

- **Great places to play**: palette generators (`rebuildBackdrop`, `randomizeBucket`), copy blocks (`instructions.textContent`, HUD labels), and playlist definitions. They are isolated and safe.
- **Proceed carefully**: pointer handlers (`canvas.addEventListener('pointer*')`), `launchBall`, and `finishAttempt` tie together physics, UI state, and audio cues. Any edit requires full regression testing.
- **Do not touch unless rewriting**: `updateBall`, `collideBallLine`, and the render loop around `tick()`. They assume specific state shapes, and almost every other feature depends on them.
- **Service hooks**: storage helper, audio context lifter, and install/home-screen logic are meant to be swapped once we add a manifest/service worker. Until then, leave the scaffolding so PWA work can land cleanly.

## 4. Issues and Risks I Found

### Functional Bugs / Player-Facing Problems

1. **Ground collisions are disabled for the first 10 trail samples**, so shots that skim the floor right after launch can clip through, miss the rebound, and trigger a failure instead of a bounce ([script.js:1730](script.js:1730)). The `ball.trail.length > 10` guard needs to be removed or replaced with an explicit “recently repositioned” flag.
2. **Resizing the window while a ball is mid-flight teleports the bucket and background**, because `resizeCanvas()` always rebuilds scenery and randomizes the bucket regardless of launch state ([script.js:1490](script.js:1490)). Any viewport change (rotation, keyboard dock, browser UI hide) can ruin an otherwise perfect shot.
3. **There is no manifest or service worker**, so the game cannot be installed offline even though the pause menu advertises “Install” ([index.html:1](index.html:1)). The browser treats it as a normal tab, and players lose the session if they close or go offline.
4. **Audio playback relies on a hidden `<audio>` element without user controls or visibility**, which can be blocked by browsers that require visible media controls or muted autoplay. There is no fallback message when `startMusic()` fails, so players may believe music is broken ([script.js:1017](script.js:1017)).

### Expandability / Maintainability Risks

1. **Single-file monolith** — 2,100+ lines of imperative DOM + gameplay logic inside `script.js` ([script.js:1](script.js:1)). This blocks modular testing, type checking, and code reuse.
2. **Inline styles for every element** make theming difficult. There is no CSS file; every change requires touching JavaScript. This makes localization (longer strings) and accessibility (high contrast themes) painful ([script.js:180](script.js:180)).
3. **Hard-coded copy** is sprinkled through the file (`instructions.textContent`, `setStatus` messages, etc.). Nothing is externalized, so translating or even A/B testing instructions means editing code blocks scattered throughout.
4. **Playlist discovery depends on strict filename formatting**: `buildPlaylist()` strips numeric prefixes and splits on `' - '`. Any future soundtrack whose filenames do not match `NN Artist - Title.mp3` will be mislabeled or ignored ([script.js:84](script.js:84)).

## 5. Future Update Topics (Prioritized)

1. **Offline-ready PWA** — manifest + service worker + install banners so Windows/Linux/ChromeOS/Android/iOS users can launch it like a native toy.
2. **Fair physics polish** — fix the ground-collision gate, refine bucket detection tolerance, and consider optional aim assists for accessibility.
3. **Session variety** — introduce rotating “moods” (color + playlist bundles) and gentle modifiers (wind, moving bucket) that players can toggle.
4. **Progression hooks** — achievements for streak milestones, visual unlocks, or postcards players can share to keep engagement without competitive pressure.
5. **Accessibility + comfort** — reduced motion mode, colorblind-friendly palette presets, adjustable backgrounds, and larger text toggles for small screens.

## 6. Questions I Need Players to Answer

1. When you miss a shot, is it because you mis-aimed or because the orb behaved unexpectedly (bounced oddly, clipped through something)?
2. Do you leave the music on, and if not, why? (Need to know if the playlist or the controls are the issue.)
3. Would optional assists (ghost trajectory, slow-motion near the bucket) make the toy more fun or undermine the chill challenge?
4. How important is offline play versus new content like modifiers or achievements?
5. On mobile, do you use it more in portrait or landscape, and does the UI feel cramped in either orientation?

## 7. Offline / Install Everywhere Plan (PWA)

### Phase 1 — Foundation

1. **Create `manifest.webmanifest`** with app name, description, icons (256, 192, 128, 64, maskable variants), display `standalone`, background/theme colors.
2. Reference the manifest and theme color in `index.html` (`<link rel="manifest">`, `<meta name="theme-color">`) and add platform-friendly icons.
3. **Implement a service worker** (`sw.js`) that:
   - Pre-caches core files: `index.html`, `script.js`, manifest, CSS (if any), and low-bitrate versions of the soundtrack.
   - Uses a cache-first strategy for static assets, with a streaming/fallback approach for large MP3s to avoid huge first-install downloads.
   - Provides an offline fallback response with a short “Go back online to stream music” message.
4. **Register `sw.js`** from `script.js` (feature-detect) and surface install-ready status inside the pause overlay.

### Phase 2 — Platform-Specific Proof

- **Windows / Linux (Chrome & Edge)**: Verify the omnibox install icon appears, confirm desktop shortcut launches full-screen, and test offline launch after clearing browser cache (except the PWA). Document steps in README (done) plus screenshots for the GitHub Pages site.
- **Chromebook**: Confirm the app shows up in the shelf, works offline, and resumes audio after sleep. Pay attention to low storage scenarios.
- **Android**: Test “Add to Home Screen” plus the new install prompt (`beforeinstallprompt`). Verify service worker caching respects mobile storage and does not redownload 20 MP3s per install.
- **iOS / iPadOS (Safari)**: Since `beforeinstallprompt` is not supported, rely on “Add to Home Screen.” Ensure manifest icons + meta tags produce a clean full-screen icon and that the service worker caches files via WebKit (requires HTTPS, already satisfied on GitHub Pages).

### Phase 3 — Distribution Comfort

1. Add an in-game indicator (pause overlay) that says “Offline-ready” once the cache is primed, and expose a button to clear cached data.
2. Publish a short “Install me” blog post/video that mirrors the README steps for each platform.
3. Optional: package the PWA via tools like PWABuilder for Microsoft Store / Play Store listings once service worker + manifest pass audits.

## 8. Extra Plan: Codebase Modernization

I also need a concrete path to make the code maintainable:

1. **Module split** — break `script.js` into `app.js` (bootstrap), `state.js`, `physics.js`, `ui.js`, `audio.js`, and `pwa.js`. Use ES modules so the browser can load them directly without a bundler.
2. **Shared styles** — move repeated inline styles into a lightweight CSS file, keep theme tokens (colors, blur radii, typography) centralized, and expose CSS custom properties for later theming.
3. **Testing harness** — add a headless physics test (e.g., Vitest + jsdom) that feeds deterministic drag/launch inputs into `updateBall()` to lock down streak scoring and regression-test future tweaks.
4. **Copy + localization prep** — extract all user-facing strings into a JSON dictionary so translating or tweaking tone becomes a content change instead of code surgery.
5. **Observability** — add a minimal debug overlay (only in dev mode) to display current FPS, physics iterations, streak, and bucket position for faster tuning.

## 9. Closing Notes

- Every change described above is already reflected in `README.md` and `notes.md`; this audit is the living backbone.
- When editing, cross-reference the file/line callouts so fixes land in the right place the first time.
- Once the functionality bugs are solved and the PWA/service-worker plan is live, revisit the “Future update topics” and “Questions for players” so the roadmap stays grounded in actual player feedback.
