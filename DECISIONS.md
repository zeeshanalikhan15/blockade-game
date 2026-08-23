# Decisions

What was decided and why, so humans, future sessions, and agents can build on top of this work.

## 2026-08-22

### Movement is grid-based
The README says "navigate a block through a *grid*", so movement is discrete cell-by-cell (20×15 grid of 40px cells) rather than free pixel movement. Arrow keys and WASD both work.

### Obstacles accumulate as the core pressure
Grey obstacle blocks pile up over time and end the game on contact — the "blockade" challenge.

### Obstacles spawn in score-triggered waves, not continuously
A steady trickle could drop an obstacle directly in the player's path with no warning. Changed to waves triggered each time the score crosses a threshold (default every 300 points), plus a 3×3 no-spawn zone around the player so nothing ever appears in its path.

### Score/level live in an HTML HUD, not the canvas
Moved score, level, and destroy-charges out of the canvas into HTML elements (`#hud`) so they're easier to style and read.

### Yellow bonus = destroy charges (not instant clear)
"Power to destroy 2–3 greys" is implemented as 2–3 charges: running into a grey while holding a charge destroys it instead of killing you. (Alternative — instantly clearing 2–3 random greys on pickup — was offered but not selected.)

### Settings apply on New Game
All settings are read when a new game starts (not mid-game), keeping state predictable. Values are clamped to sane ranges.

### Visual distinction: circles vs squares
Green collectibles are small squares; blue/yellow bonuses are circles, so pickups are visually distinct from blocks.

### Blue and yellow bonuses are independent
Blue and yellow bonuses spawn on unrelated schedules: blue on a fixed timer, yellow once per N levels (and only while the player is under the max destroy-charge cap). They never share a slot or a chance roll, and never spawn on the same cell. This removed the old "blue chance (%)" setting.

### Yellow bonus is rare and gated
Yellow appears at most once per `yellowLevelGap` levels, and never once the player holds more than `maxPowerForYellow` destroy charges. Both numbers are configurable settings.

### Sounds are synthesized, not files
All sound effects are generated in-browser with the Web Audio API (oscillators + noise bursts), so no audio assets are needed. The `AudioContext` is created lazily on the first user gesture (a key press) to satisfy the browser autoplay policy.

### Mute, level-based background colors, and background music
A persisted "mute" setting silences all audio and applies immediately. The cell *background* color cycles through a pastel palette each level (light tints chosen so pieces never blend in), behind a persisted toggle; grid lines are a darkened tint of the current cell background (85%), so they darken along with it. Background music is a soft looping arpeggio that starts on the first user gesture and stops on game over (with a descending "game over" sound).

### Continue-from-level option
On game over, the player can respawn at the level they died at by paying a fixed 1/3 of their score, floored. The board stays exactly the same; the player respawns on their last safe cell (the step before the collision — the position was never advanced on death). The cost is score-based rather than level-based, so the number of continues is naturally limited as the score shrinks toward zero; continue is only offered while the cost is at least 1.

### Settings persist via localStorage
Settings are auto-saved to the browser's `localStorage` whenever an input changes, and restored on page load. This survives refreshes and server restarts, but is per-browser/origin — not a shared file on disk. A shared `settings.json` + a small Node server is a possible future upgrade if cross-browser persistence is needed.

### Single `main` branch + settings-based themes
Themes are **not** separate git branches. There is a single `main` branch; each theme's look and sound lives in its own file under `src/themes/` (e.g. `classic.js`, `space.js`), and the active theme is chosen via a persisted "Theme" setting. The shared engine in `app.js` holds all game logic and delegates rendering + audio to the active theme object. Adding a theme = adding a file under `src/themes/` and an entry in the Theme dropdown.

### Tabbed layout (canvas left, sidebar right)
The canvas sits on the left; a right-side sidebar holds two tabs: **Game** (score/level/destroy + New Game/Continue buttons) and **Settings** (all settings). The Game tab is the default. This keeps the play area uncluttered and groups controls vs. configuration.

### GitHub Pages deployment via a `prod` branch
On every push to `main`, `.github/workflows/deploy.yml` copies `src/` to a `prod` branch (force-push) and GitHub Pages serves from `prod` at path `/`. This mirrors the `zeeshanalikhan15.github.io` repo's approach, minus the build step (the game is static HTML/JS/CSS). The public URL is `https://zeeshanalikhan15.github.io/blockade-game/`.

## 2026-08-23

### The board always draws in "art units"; the viewport maps them to the screen
`src/mobile.js` owns the screen, not the game. The engine keeps drawing the full 20×15 board in its native 800×600 "art units", and `mobile.js` sets a `VIEW` (scale, visible width/height, camera offset, `devicePixelRatio`). `draw()` clears in device pixels, translates by the camera, scales, renders the whole board, then restores. The two themes are untouched. `devicePixelRatio` is capped at 2× — beyond that the extra pixels cost more than a phone shows.

### Three layout tiers, not one responsive continuum
- **Desktop** — scale 1, whole board, sidebar, keyboard (unchanged).
- **Tablet** (touch, board still fits readably) — the whole board scales down to fit, plus a d-pad.
- **Phone** (smaller than 720×560) — cells stay ~38px readable, so the board no longer fits and the canvas becomes a **follow-camera window** onto it, clamped so it never scrolls past the edge. This is the "moving around a map and discovering" feel: you see a slice and the edges fade to hint there's more. No fog-of-war — the whole board is still fully rendered/known.

### Touch UI is detected, not width-gated alone
Touch UI = a coarse pointer, or touch points + a non-laptop width, or a narrow window. This catches tablets that request the desktop site (which can report a fine pointer) while leaving touchscreen laptops on the desktop layout.

### Settings + scores become a drawer on small screens
On touch UI the sidebar is a slide-in drawer (☰ in a compact top bar), so scores and settings never sit in the play area. Opening it **pauses** the game (clears the loop + music, restores them on close) so reading settings mid-game can't get you killed. The legend moves into the drawer's Game tab on phones so it stops consuming vertical space; the score/level/destroy stats are mirrored into the top bar for at-a-glance reading.

### On-screen pilot controls
A three-by-three d-pad (press moves once, holding auto-repeats like key auto-repeat, releasing stops) plus swipe-to-move on the canvas, and tap-to-restart after a game over. In landscape the d-pad floats over the board's lower-left corner instead of reserving vertical space.
