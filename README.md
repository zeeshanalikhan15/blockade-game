# Blockade Game

▶ **Play it live:** [zeeshanalikhan15.github.io/blockade-game](https://zeeshanalikhan15.github.io/blockade-game/)

A small browser-based grid game with a **settings-based theme system**. Pilot through a grid, avoid obstacles, and collect pickups — with switchable visual + audio themes.

## Themes

Themes live in `src/themes/` and are selected at runtime via the **Theme** setting (persisted):

- **Classic** — the original "Blockade Game" look: colored blocks, light background, arcade sounds.
- **Space Saver** — pilot a spaceship through a starfield, rescue astronauts, dodge asteroids, collect energy orbs and armory shields, with galactic sounds.

Each theme is a single object exposing `name`, `legend`, `render(ctx, state)`, `sound(name)`, and `music` (notes/tempo/tone). The shared engine in `src/app.js` delegates all visuals and audio to the active theme.

## How to play

- Move with the **arrow keys** (or WASD).
- **Collect pickups** (+10) and **bonuses** (+50).
- Grab a **power-up** to gain charges that **destroy obstacles** instead of crashing.
- Hit an obstacle without a charge and it's game over.

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
