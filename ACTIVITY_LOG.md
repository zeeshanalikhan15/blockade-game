# Activity Log

Chronological record of every activity performed on this repo. Append in sequence; do not reorder.

## 2026-08-22

1. **Explored the repo** — found a skeleton "Blockade Game": an 800×600 canvas, an unwired "Start Game" button, and an empty arrow-key handler in `src/app.js`.
2. **Started the dev server** — `npm start` (live-server) serving `src` at http://127.0.0.1:8080.
3. **Implemented the full game logic** in `src/app.js`: 20×15 grid (40px cells), arrow/WASD movement, obstacle + collectible spawning, collision/game-over, restart via button or Enter/Space.
4. **Wired up existing-but-unused CSS** — added `.button` and `.score` classes to elements in `index.html`.
5. **Tuned spawn rates** — obstacles slower (~1.2s), green collectibles faster (~0.8s).
6. **Switched obstacles to score-triggered waves** (every 300 points), added a 3×3 no-spawn zone around the player, and added a "Level" display.
7. **Moved score/level out of the canvas** into an HTML HUD; added a **settings panel** (score-per-wave, greys-per-wave, max-levels, max-greens); added **bonus pickups** (blue +50, yellow = 2–3 destroy charges).
8. **Added bonus settings** — bonus frequency (seconds) and blue-chance (%).
9. **Created this log and DECISIONS.md** per user request, and backfilled the history above.
10. **Gated the yellow bonus** — it now appears at most once every 5 levels, and never once the player holds more than 10 destroy charges (otherwise the bonus spawns as blue).
11. **Made yellow gating configurable** — added "levels between spawns" and "max destroy charges" as settings.
12. **Added settings persistence** — settings are auto-saved to `localStorage` on change and restored on page load, so they survive refreshes and server restarts.
13. **Made blue and yellow bonuses independent** — each spawns on its own schedule (blue on a timer, yellow once per N levels), no longer sharing a single bonus slot or the blue/yellow chance roll; removed the "blue chance" setting.
14. **Added synthesized sound effects** (Web Audio API, no external files) — distinct sounds for green/blue/yellow pickups, grey destruction (blast), level-up ("walls growing"), and movement.
15. **Added mute toggle, level-based grid colors, and background music** — a persisted "mute" setting, pastel grid tints that cycle per level (chosen to keep pieces visible), and a soft looping background arpeggio.
16. **Refined audio & colors** — background music stops on game over with a descending game-over sound; cell *background* (not grid lines) cycles color per level, behind a persisted enable/disable toggle.
17. **Tinted grid lines** — grid lines are now a darkened tint of the cell background (85%), so they darken along with the background.
18. **Added a "continue" option** — on game over, respawn at the level you died at with the *board unchanged*, on your last safe cell (the step before the collision), paying a fixed 1/3 of your score (floored); offered only while the cost is at least 1.
19. **Created a "Space Saver" theme** (spaceship, astronauts, asteroids, energy orbs, armory shields, galactic starfield, galactic sounds) — initially on a temporary branch.
20. **Loudened + space-ified sounds** and added a persisted "Music volume" slider.
21. **Refactored to a settings-based theme system on a single `main` branch** — extracted "Classic" and "Space" into `src/themes/`, added a "Theme" selector, and deleted the abandoned theme branch.
22. **Restructured the UI into two tabs** — canvas moved to the left, with a right-side sidebar holding a "Game" tab (score/level/destroy + New Game/Continue) and a "Settings" tab (all settings).
23. **Centered the title over the grid** — moved the `<h1>` inside the left column so it centers above the canvas rather than the whole page.
