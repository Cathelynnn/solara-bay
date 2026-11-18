# Solara Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Cathelynnn/solara-bay/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Cathelynnn/solara-bay/reward.svg)](https://make.fun/c/gta6-01)

An original top-down 2D open-world crime game, built for the make.fun **gta6-01** bounty ("Make GTA 6"). No Rockstar names, art or assets — everything here is original: the city, the story, the characters, the sounds.

Re-authored 2026-11-18 under a fresh make.fun recording so the entry's transcript carries its own authorship.

**The story.** Mara Reyes came back to Solara Bay with $40 and a grudge. The Bay Bank took her brother's garage. Tonight she takes it back — one hot car, one loud job at a time.

## Play

Serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) and play in desktop Chrome. No network requests, no build step, no libraries — vanilla canvas ES modules and procedural WebAudio.

- **Open world** — a 3200×2400 sun-soaked coastal city: grid avenues and streets, procedural buildings, sidewalks, palms, a beach and ocean edge. Camera follows you.
- **On foot & by car** — WASD/arrows to walk, Shift to run, E to enter/exit any car. Driving: W/S accelerate and brake, A/D steer, Space handbrake, speedometer on the HUD.
- **Traffic & pedestrians** — AI cars cruise the roads, pedestrians stroll the sidewalks and panic when things get loud.
- **Wanted level 0–5 stars** — stealing a car, hitting a pedestrian or firing a shot raises heat; taking down a cop raises it more. Foot cops chase at 1–2 stars, police cars ram you at 2+, cops shoot back at 3+. Lay low and the heat fades.
- **Five story missions** — press M to accept each job in order: steal a car for the North Garage, run three packages to the South Docks, hit 2 stars then lose the tail, a timed cross-town getaway under full pursuit, and the marina heist finale. Cash rewards, mission markers on the minimap.
- **Combat** — F to punch, mouse aim + click to shoot (ammo pickups around the city).
- **HUD** — cash, wanted stars, health bar, ammo, objective line, live minimap with roads, the mission marker and police dots.
- **Save** — cash, jobs done, best haul and mute setting persist in localStorage. Health 0 is WASTED: respawn and lose 10% of your cash.
- **Sound** — fully procedural WebAudio: engine hum by speed, two-tone siren, gunshots, pickup blips, mission jingle and a lazy golden-hour groove. N to mute.
- **Polish** — dust, muzzle flash, crash sparks, screen shake, speed lines at full throttle, golden-hour tint.

## Files

- `game/index.html` — the page; `game/src/` — one module per job: `config.js` (tuning, missions), `city.js` (procedural city), `world.js` (rules), `render.js` (drawing + HUD), `input.js`, `audio.js`, `shots.js` (screenshot staging), `main.js` (loop + save).
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — four real renders of the game: title, driving in traffic, police chase, mission in progress.

## License

MIT — see `LICENSE`.
