# Neon Bay: Sunset Run — an original open-world crime game

**Bounty:** make.fun `gta6-01` · **Account:** @turibaru

A top-down open-world crime game in the spirit of GTA 6, playable in a desktop
browser from static files with no network request, keyboard + mouse. You are
**Rae Vega**, a driver who came home to the fictional sunset city of **Neon
Bay** with nothing but a fast car and a debt. Three jobs stand between her and
freedom — and the whole city is yours to take.

## What is in the game

- **City** — 3200×2400 Neon Bay: grid avenues, ~70 buildings, beach + water on
  the west edge, a park, the Marina pier, the Mall, and a safehouse.
- **On foot and by car** — WASD/arrows to walk (Shift to run), E to steal /
  enter a car and to get out. Driving has acceleration, braking/reverse,
  steering and a handbrake (Space); cars take damage and can be wrecked.
- **Traffic & pedestrians** — 14 traffic cars driving the avenues, 26
  pedestrians strolling the sidewalks who flee from danger.
- **Stealable cars** — traffic cars can be stolen (raises wanted); parked cars
  are free to take.
- **Wanted level + police** — 0–5 stars. Stealing, hitting pedestrians and
  shooting raise the heat; up to 6 police cars chase and ram you. Lose them
  and stars decay; get caught on foot with no health and you are **BUSTED**
  (lose 20% cash, wake up at the safehouse).
- **Missions + story** — 3 missions with a gold marker guiding you:
  1. **First Score** — collect the cash bag at the Marina (+$500).
  2. **Getaway** — 2 stars on you, reach the safehouse in 90 s (+$800).
  3. **Payback** — defeat the 3 Coral crew thugs at the Mall (+$1,200),
  then free roam.
- **Combat** — F to punch, mouse click to shoot toward the cursor (tracer,
  thugs and pedestrians react).
- **HUD + minimap** — cash, health bar, driving speed, 5 wanted stars,
  mission objective + timer, banner announcements, and a live minimap (roads,
  player, police, thugs, mission marker, viewport).
- **Start + save** — title screen with story and controls, continue a save
  with C, pause with P (auto-saves), save to localStorage every 15 s and on
  every mission completion; best cash is remembered.
- **Sound** — generated WebAudio only (no files): engine hum, police siren,
  gunshots, punches, pickups, mission jingles. M to mute.
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
