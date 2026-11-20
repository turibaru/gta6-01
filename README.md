# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/turibaru/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/turibaru/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay: Sunset Run

An original open-world sunset crime game for the **make.fun "Make GTA 6" (gta6-01)** bounty — built from scratch in a single recorded session, with no assets, names, or code taken from any commercial game.

You are a courier in **Neon Bay**, a sun-soaked coastal city of palm-lined boulevards, neon signs, a pier, a marina, and an old arcade. Explore the city **on foot and by car**, steal cars, dodge traffic and pedestrians, outrun the **Bay PD** as your wanted level climbs, and run **Rico's three-job story chain** across the map.

## How to play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and visit http://localhost:8080). No network, no build step, no install — every file the game loads lives under `game/`.

| Key | Action |
| --- | --- |
| WASD / arrows | Drive or walk (hold Shift to run on foot) |
| E | Enter / steal a nearby car, or step out of one |
| SPACE | Brake |
| ENTER | Start the current job |
| P | Pause |
| M | Mute |
| R | Run it back after game over |

## What's in the game

- **Open city** — a 3200×2400 road grid with six districts (Neon Strip, Marina, The Pier, Palm Heights, Bayfront, Old Arcade), buildings with lit windows and neon signs, palm trees, a beach and the bay.
- **On foot and by car** — walk the sidewalks, then press E near any parked or traffic car to take it. Cars have acceleration, steering, braking, and damage.
- **Traffic and pedestrians** — 14 traffic cars driving the grid and 26 pedestrians wandering the sidewalks.
- **Wanted level and police** — hit a pedestrian, smash traffic, speed past a patrol, or steal a car in daylight and the stars climb; Bay PD cruisers chase and ram you until you lose the heat.
- **Missions and story** — three jobs for Rico: a sunset pickup at the pier, a timed delivery dash to the Marina Hotel, and a three-star escape to the old arcade hideout. Completing jobs pays cash with a time bonus.
- **HUD with minimap** — cash, score, best haul, wanted stars, health, speed, mission banner with timer, and a live minimap showing the player, police, and the mission marker.
- **Combat by collision** — ramming, crashes, and police takedowns damage your car or your health; get busted on foot or wrecked in a car and the run ends.
- **Sound and save** — synthesized engine hum, sirens, and pickup chimes (WebAudio, no audio files); your best haul and jobs persist in the browser.
- **Start screen, pause, and game-over screen** with a restart.

## Screenshots

Four real renders of the game running in headless Chromium (see `shots.json` for the scenes): the cover drive down the Neon Strip, a three-star police chase, the pier pickup, and cruising city traffic.

## Structure

```
game/
  index.html          page + styles, loads the scripts below
  src/config.js       constants, palette, mission definitions
  src/world.js        city generation, roads, collision helpers
  src/input.js        keyboard + mouse input
  src/audio.js        synthesized WebAudio sound engine
  src/entities.js     traffic, pedestrians, police AI, particles
  src/missions.js     mission state machine and story progression
  src/render.js       city, cars, HUD, minimap, menus
  src/shots.js        screenshot scene catalogue
  src/main.js         game loop, player control, wanted level, save
main.ts               entry program: copies game/ + screenshots/ to /output,
                      writes dossier.json with vendor/makefun-game.ts
serve.ts              local static server for playtesting (port 8080)
screenshots/          4 real gameplay renders
```

## License

MIT — see [LICENSE](LICENSE).
