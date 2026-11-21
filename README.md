# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/turibaru/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/turibaru/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# NEON BAY: SUNSET RUN — open-world crime in a sunset beach city: 7 story jobs, neon radar + mission beacons, NBPD heat with roadblocks and air support, weapon wheel, garage upgrades, respect ranks, radio & saves

An original open-world sunset crime game for the **make.fun "Make GTA 6" (gta6-01)** bounty — built from scratch in recorded sessions, with no assets, names, or code taken from any commercial game.

You are a courier in **Neon Bay**, a sun-soaked coastal city of palm-lined boulevards, neon signs, a pier, a marina, dockyards, and an old arcade. Explore the city **on foot and by car**, steal cars, dodge traffic and pedestrians, outrun the **Bay PD** as your wanted level climbs, and run **Rico's seven-job story chain** across the map — from a sunset pickup at the pier to a street race against Vega, a harbor heist, a turf war with the Coral crew, and a five-star finale run to the boat at the Pier.

## How to play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and visit http://localhost:8080). No network, no build step, no install — every file the game loads lives under `game/`.

| Key | Action |
| --- | --- |
| WASD / arrows | Drive or walk (hold Shift to run on foot) |
| E | Enter / steal a nearby car, or step out of one |
| SPACE | Brake |
| ENTER | Start the current job |
| 1–4 | Weapon wheel: Pistol / Scattergun / SMG / Fists |
| F or mouse click | Shoot (click aims at the cursor) |
| G | Garage at the safehouse (repair, armor, engine, repaint) |
| R | Switch radio station (NEON 99.1 / OMBO 98.4 / VICE FM) |
| H | Honk |
| P | Pause |
| M | Mute |
| R (after game over) | Run it back |

## What's in the game

- **Open city** — a 3200×2400 road grid with six districts (Neon Strip, Marina, The Pier, Palm Heights, Bayfront, Old Arcade), 2.5D buildings with sunset side faces and long shadows, lit windows, neon signs, street lamps, palm trees, zebra crosswalks, dock containers, animated surf on the beach, and a golden-hour vignette.
- **Seven story jobs** — a sunset pickup at the pier, a timed delivery dash to the Marina Hotel, a three-star escape to the old arcade hideout, the **Sunset Grand Prix** (a 4-checkpoint street race against rival Vega), the **Harbor Heist** (steal a money truck at the Docks and shake a three-star tail), **Clean House** (take down five Coral runners), and the finale **Kingpin's Last Run** (run the heist truck to the boat at the Pier under a five-star storm — AIR-1 and roadblocks the whole way). Completing jobs pays cash with a time bonus. Every job opens with a mission briefing card from the crew and 8 seconds of spawn grace.
- **Neon radar** — the minimap upgraded into an open-world radar: heli blip, roadblock markers, garage icon, range rings, a rotating sweep, and the district you are standing in.
- **Mission beacon + objective HUD** — a pulsing neon ring and light pillar mark the active job target in the world; an edge arrow with the distance in metres points the way when the target is off-screen; a banner under the top HUD names the job and its remaining time.
- **Wanted stars + police alerts** — five gold stars across the top of the screen, bound to the live wanted level (flashing at four and five stars), and a big centre-screen alert when the heat climbs: HEAT RISING, ROADBLOCK AHEAD, AIR-1 OVERHEAD.
- **NBPD dispatch** — hit a pedestrian, smash traffic, speed past a patrol, or steal a car in daylight and the stars climb. From three stars the department drops **roadblocks** on the road ahead (ram them or shoot them to smash through); from four stars **AIR-1**, the police helicopter, shadows you with a sweeping searchlight.
- **Weapon wheel** — Pistol (unlimited ammo), Scattergun (5-pellet spread, 24 shells), SMG (rapid fire, 120 rounds), and Fists for close work. Ammo counts live in the HUD; bullets can drop cruisers, runners, and roadblocks — and clip Vega's race car.
- **Garage upgrades** — park at the safehouse garage and spend cash on a full repair ($100), plated armor (+50 max health, $500), a tuned engine (+60 top speed, $800), or a fresh sunset repaint ($150).
- **Respect ranks** — earn RP from jobs, car theft, and takedowns and climb Rookie → Hustler → Fixer → Shot Caller → Kingpin. Rank-ups pay a cash bonus; the HUD shows your rank and progress to the next one.
- **Radio** — three synthwave stations (NEON 99.1, OMBO 98.4, VICE FM), each with its own key, tempo, and bass line, synthesized live in WebAudio. Press R to flip stations.
- **Crew dialogue** — Marco, Mira, and Vega talk to you in portrait dialogue boxes when jobs start and finish.
- **Traffic and pedestrians** — 14 traffic cars driving the grid and 26 pedestrians wandering the sidewalks, plus Vega's rival racer and the five Coral runners.
- **HUD with neon radar** — cash, score, best haul, wanted stars, AIR-1 warning, car condition %, speed, weapon wheel with ammo, respect bar, radio badge, race checkpoint counter, mission banner with timer, objective banner, police alert banners, vehicle condition panel while driving, and a live neon radar showing the player, police, the heli, roadblocks, the garage, and the mission marker.
- **Street dressing** — named shop signs on the walls facing the main roads (Marina Hotel, Sugar Rush Donuts, Old Arcade, Ink & Neon Tattoo, Salt Air Cafe, Rico's Garage, Pier 9 Bait & Tackle), festival lights strung along the pier, and extra palms and street lamps by the landmarks.
- **Sound and save** — synthesized engine hum, sirens, gunshots, and pickup chimes (WebAudio, no audio files); your best haul and jobs persist in the browser.

## Screenshots

Four real renders of the game running in headless Chromium (see `game/src/shots.js` for the scenes): the sunset start on the Strip, cruising city traffic, a four-star chase with AIR-1 and a roadblock, and the mission 6 shootout.

## Structure

```
game/
  index.html          page + styles, loads the scripts below
  src/config.js       constants, palette, mission definitions, weapons, radio, ranks
  src/world.js        city generation, roads, collision helpers
  src/input.js        keyboard + mouse input
  src/audio.js        synthesized WebAudio sound engine + radio notes
  src/entities.js     traffic, pedestrians, police AI, particles
  src/missions.js     mission state machine, race checkpoints, takedown counter
  src/weapons.js      weapon wheel, bullets, hits on police/runners/roadblocks
  src/heat.js         AIR-1 helicopter and police roadblocks
  src/respect.js      respect ladder Rookie → Kingpin
  src/garage.js       safehouse garage upgrades
  src/radio.js        three synthwave station sequencers
  src/dialog.js       crew dialogue boxes with portraits
  src/rivals.js       Vega's race car and the Coral runners
  src/beacon.js       mission beacon, off-screen target arrow, objective banner
  src/wanted.js       wanted stars and police alert banners
  src/dressing.js     named shop signs, pier lights, extra palms and lamps
  src/visuals.js      2.5D buildings, waves, crosswalks, docks, vignette
  src/render.js       city, cars, HUD, minimap, menus
  src/shots.js        screenshot scene catalogue
  src/main.js         game loop, player control, wanted level, camera zoom, save
main.ts               entry program: copies game/ + screenshots/ to /output,
                      writes dossier.json with vendor/makefun-game.ts
serve.ts              local static server for playtesting (port 8080)
screenshots/          4 real gameplay renders
```

## License

MIT — see [LICENSE](LICENSE).
