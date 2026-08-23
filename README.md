# Blockade Game

▶ **Play it live:** [zeeshanalikhan15.github.io/blockade-game](https://zeeshanalikhan15.github.io/blockade-game/)

A small browser-based grid game with a **settings-based theme system**. Pilot through a grid, avoid obstacles, and collect pickups — with switchable visual + audio themes.

## Themes

Themes live in `src/themes/` and are selected at runtime via the **Theme** setting (persisted):

- **Classic** — the original "Blockade Game" look: colored blocks, light background, arcade sounds.
- **Space Saver** — pilot a spaceship through a starfield, rescue astronauts, dodge asteroids, collect energy orbs and armory shields, with galactic sounds.

Each theme is a single object exposing `name`, `legend`, `render(ctx, state)`, `sound(name)`, and `music` (notes/tempo/tone). The shared engine in `src/app.js` delegates all visuals and audio to the active theme.

## How to play

- Move with the **arrow keys** (or WASD). On touch screens, use the **on-screen joystick** or **swipe** across the board.
- **Collect pickups** (+10) and **bonuses** (+50).
- Grab a **power-up** to gain charges that **destroy obstacles** instead of crashing.
- Hit an obstacle without a charge and it's game over.
- On a phone the board is a window that **follows you** up to the edges — a pulsing **chevron** points to the nearest *off-screen* pickup, and the ☰ button opens scores & settings in a side drawer.
- On a phone, when the game ends, **New Game** and **Continue** buttons appear right over the board.

## Getting started

```bash
npm install
npm start
```

`npm start` serves the `src/` folder with live-server (default http://127.0.0.1:8080).

## Configuration

The in-game **Settings** panel (auto-saved to your browser) tunes obstacle waves, score thresholds, pickup count, bonus frequency, music volume, and the active theme.

## License

MIT
