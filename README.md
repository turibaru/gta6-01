# NEON BAY: SUNSET RUN — open-world crime in a sunset beach city: 6 story jobs, NBPD dispatch with roadblocks and air support, weapon wheel, garage upgrades, respect ranks, radio & saves

**Bounty:** make.fun `gta6-01` · **Account:** @turibaru

A top-down open-world crime game in the spirit of GTA 6, playable in a desktop
browser from static files with no network request, keyboard + mouse. You are
**Rae Vega**, a driver who came home to the fictional sunset city of **Neon
Bay** with nothing but a fast car and a debt. Six jobs stand between her and
freedom — and the whole city is yours to take.

## What is in the game

- **City** — 3200×2400 Neon Bay: grid avenues, ~70 buildings with lit windows
  and neon signs, beach + waves on the west edge, a park, the Marina pier with
  a boat, the Mall, the east Docks, and a safehouse with a garage. Sunset
  lighting, long shadows, street lamps and palm trees.
- **On foot and by car** — WASD/arrows to walk (Shift to run), E to steal /
  enter a car and to get out. Driving has acceleration, braking/reverse,
  steering and a handbrake (Space); cars take damage and can be wrecked.
- **Traffic & pedestrians** — 14 traffic cars driving the avenues, 26
  pedestrians strolling the sidewalks who flee from danger.
- **Stealable cars** — traffic cars can be stolen (raises wanted); parked cars
  are free to take.
- **Wanted level + police** — 0–5 stars. Stealing, hitting pedestrians and
  shooting raise the heat; up to 6 police cars chase and ram you. At 3+ stars
  the NBPD sets **roadblocks** across the road ahead (ram through them); at
  4+ stars the **AIR-1 helicopter** joins with a searchlight. Lose them and
  stars decay; get caught on foot with no health and you are **BUSTED**
  (lose 20% cash, wake up at the safehouse).
- **Missions + story** — 6 missions with a gold marker and crew dialogue:
  1. **First Score** — collect the cash bag at the Marina (+$500).
  2. **Getaway** — 2 stars on you, reach the safehouse in 90 s (+$800).
  3. **Payback** — defeat the 3 Coral crew thugs at the Mall (+$1,200).
  4. **Sunset Grand Prix** — beat rival driver Vega through 4 checkpoints in
     100 s (+$900).
  5. **Harbor Heist** — steal the Coral cash truck at the Docks, bring it home
     through 3-star heat (+$1,500).
  6. **Clean House** — take down the 5 Coral runners across the city
     (+$1,000), then free roam.
- **Combat — weapon wheel** — F to punch, mouse click to shoot toward the
  cursor. Switch weapons with 1/2/3: Pistol (infinite), Scattergun (5-pellet
  spread, 24 shells), SMG (fast, 120 rounds). Ammo pickups refill.
- **Respect ranks** — earn RP from missions, steals and takedowns: Rookie →
  Hustler → Fixer → Shot Caller → Kingpin.
- **Garage** — at the safehouse (G): repair ($100), armor +50 max HP ($500),
  engine +60 top speed ($800), repaint ($150).
- **Radio** — R cycles 3 synthwave stations (NEON 99.1, OMBO 98.4, VICE FM),
  generated WebAudio, shown in the HUD.
- **HUD + minimap** — cash, health bar, car condition, driving speed, 5 wanted
  stars, air-unit warning, weapon wheel with ammo, respect bar, radio, mission
  objective + timer + checkpoint counter, dialogue boxes with crew portraits,
  banner announcements, and a live minimap (roads, player, police, helicopter,
  roadblocks, thugs, truck, rival, mission marker, viewport).
- **Start + save** — title screen with story and controls, continue a save
  with C, pause with P (auto-saves), save to localStorage every 15 s and on
  every mission completion; best cash is remembered.
- **Sound** — generated WebAudio only (no files): engine hum, police siren,
  gunshots, punches, pickups, mission jingles, radio basslines. M to mute.
- **Original everything** — city, characters, vehicles, names, story, art and
  sound are all original; nothing from Rockstar Games.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Run (on foot) |
| E | Steal / enter car, exit car |
| F | Punch |
| Mouse click | Shoot toward cursor |
| 1 / 2 / 3 | Weapon wheel: Pistol / Scattergun / SMG |
| R | Radio station · G garage (at safehouse) |
| Space | Handbrake (driving) / confirm |
| P / Esc | Pause · Q quit to title (from pause) |
| C | Continue save (title) · M mute |

## Try it

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

Screenshot scenes: `?shot=start|drive|chase|mission` (with `&seed=N`) —
each plays the real rules forward with an autopilot and sets
`window.__shotReady`. See `shots.json`.

## Layout

- `main.ts` — Node 22 entrypoint (kit pattern): copies `game/` +
  `screenshots/` to the output and writes `dossier.json`.
- `vendor/makefun-game.ts` — copied from the kit, unchanged.
- `game/` — `index.html`, `src/config.js`, `src/world.js` (rules/state),
  `src/render.js` (camera/HUD/minimap/screens), `src/input.js`,
  `src/audio.js`, `src/main.js` (loop/screens/save), `src/shots.js`,
  `src/random.js`.
- `screenshots/` — 4 real renders: title, driving, police chase, mission 3.

## License

MIT — see `LICENSE`.
