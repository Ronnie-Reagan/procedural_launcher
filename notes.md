# Notes
This is a simple file to track ideas/notes through-out the revisions that may happen.

---

## Retrospective Info

### Origins

I was sitting on the couch watching The Simpsons and imagined a game; one where there was no end game or final boss per-say.

The vision was a simple one: a _**single ball**_ on the lower left of the screen that you _**launch**_ to try land it inside a semi-randomly placed bucket on the upper-right side of the screen.

I got up and moved to the chromebook to start work; it went smooth as I've made many many ball simulations. I just wanted to make this one smoother or more polished.

## Ver.1.0

The game is now [**online**](https://ronnie-reagan.github.io/procedural_launcher/) at https://ronnie-reagan.github.io/procedural_launcher/

### I have tested on mobile/desktop and these are my notes:

- Music Credits must be added to the game itself; see pause menu overhaul for layout idea

- The UI is not scaling down aggressively enough resulting in overly-large HUD/UI in terms of game-window real estate

- The 'floor' is usually placed correctly but on chrome via iOS on iPhone: the navbar(the chrome back/forward/new-tab, tabs, more(three dots)) is not respected resulting in the vh being larger than it visually is. the info at the bottom displaying the text 'Drag from the orb to aim, release to score.\nPress R to reset or Pause for settings.' is off screen almost entirely.

- Chrome on iOS allows me to add the game to homescreen already; without a manifest or service worker. I expected more hassle but want to roll with this and add an option to 'add to home-screen' natively in the game's settings or via a pop-up/toast

- Reset Stats button in settins/pause menu MUST have a confirmation added to it; players will inevitably lose progress if not added.

- Pause menu needs an actual settings menu / full revision
    - Pause
        - Settings
            - Music volume
                - 0% - 100% (slider)
            - SFX volume
                - 0% - 100% (slider)
            - Reset Stats
                - Confirmation ("Are you sure? This is permanent!" - yes/no)
            - Credits
                - Developer: Don Reagan
                - Music: Kevin MacLeod
                    - List all tracks and link to the license (see music/credits.md for details)
                - Testing: Tunaz_420
                - Testing: Gaymer
                - Testing: ɮǟʀɮաɨʀɛ
                - Testing: Nishi Billi
            - Back/Exit
        - Music (Toggle)
        - SFX (Toggle)
        - Resume

- Collisions need to be revised to use dt for approximating the collision point in space and time to compute rebound/bouncing properly - this will be compute heavy but with a single ball should run fine

- It is too easy to cheat points and therefore the player's own fun by removing the goal of a high score; this shouldnt be restricted but rather appeased to by way of suggesting not editing when inspect element is open like social media platforms do with a console message

### Various players have given the following input:

- ɮǟʀɮաɨʀɛ — 6:12 AM
`My main prob is that on dragging it shows a dotted line (for the angle I assume), but on shooting it starts moving in a totally different direction, so any boundary collision seems uncontrollable`

- Nishi Billi — 6:05 AM
`If I pull the ball, I think the ball should move in the direction I pulled it.`

#### Given this input:

I suggest to revise the aiming system to move the ball with the cursor/grab-point aswell as revising the dotted line to be a solid line that gets thinner as it gets longer; like an elastic band; anchored to the ball's center and the corresponding launch point

---

## Direction Snapshot (see `AUDIT_REPORT.md` for detail)

- The fresh audit spells out logic risks, future feature topics, and platform plans from my point of view. Use it as the single source of truth before making sweeping edits.
- Theme tweaks, playlist swaps, or HUD copy changes are fair game; physics (`updateBall`, collision helpers) should not be touched unless we are ready to regression-test the whole toy.
- Offline/PWA install work now has a dedicated plan—start by wiring `manifest.webmanifest` and a cache-first service worker exactly as outlined there.
- Player research questions in the audit file should guide the next feedback round. Write the answers back here once gathered.
