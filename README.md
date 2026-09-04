# בית המקדש — Beis HaMikdash 3D Explorer

A first-person walkthrough of the Second Temple as described in Maseches Middos and the
Rambam's Hilchos Beis HaBechirah: from Har HaBayis through the Cheil, the Ezras Nashim, the
fifteen steps and the Nicanor Gate into the Azarah, up to the Ulam, the Heichal and the
Kodesh HaKodashim. Every court, gate, chamber and vessel is a hotspot with a sourced card:
Hebrew and English descriptions, dimensions in amos with their Mishnah or Rambam reference,
Sefaria links, and questions you can put to the poskim at [tzadek.ai](https://tzadek.ai).

Built with React 18, three.js (procedural geometry, no downloaded models), Vite 7 and
`@hebcal/core` for the day's korbanos. The screenshots in `screenshots/` are from the earlier
version; the current look is captured by CI on every pull request (see below).

## Run it

```bash
nvm use            # Node 22 (see .nvmrc)
npm ci
npm run dev        # http://localhost:5173
```

Controls: `W A S D` move, mouse look (click to lock the pointer, `Esc` to release), `Space`
jump, `Shift` run, `E` inspect the hotspot you are looking at, `G` ghost mode (free flight,
shows the position readout). On touch devices a joystick and drag-look appear instead.

Useful URLs while developing:

| URL | What it does |
|---|---|
| `/?at=mizbeach` | spawn just east of a content entry, facing it, with its card open |
| `/?cam=x,y,z,yaw,pitch` | spawn at scene coordinates (metres, degrees) |
| `/?autostart=1` | skip the start screen |
| `/?shadows=0`, `/?bloom=0`, `/?bake=0` | disable shadows / bloom / baked textures |

## Scripts

| Command | Purpose |
|---|---|
| `npm run lint` / `npm run format` | ESLint (flat config) and Prettier |
| `npm test` | Vitest: content schema, korbanos and calendar, geometry walkability (raycast tests, no browser) |
| `npm run build` / `npm run preview` | production bundle (three.js and hebcal in their own chunks) |
| `npm run screenshot` | six fixed views through headless Chromium; prints draw calls per view |
| `npm run bake` | regenerate `public/textures/*.webp` from the procedural texture generators |
| `node scripts/verify_refs.mjs` | check every Sefaria ref in the content against the Sefaria API |

## How it is put together

```
src/content/temple.json     the single source of truth: 71 entries (areas, gates, chambers,
                            structures, vessels) in amos in the "azarah" frame; docs/content.md
src/content/units.js        amos <-> metres, floor levels, formatLength()
src/game/TempleGame.js      renderer, composer (bloom), lifecycle, spawn, period toggle
src/game/builders/          geometry built from the JSON: HarHaBayis, EzrasNashim, Azara,
                            Heichal, Keilim, Environment, Lighting; CourtBuilder/BaseBuilder helpers
src/game/PlayerController   BVH floor collider, wall sliding, stairs and ramps
src/game/Hotspots.js        in-scene labels (CSS2DRenderer), gaze focus, E to inspect
src/components/             HUD: HotspotCard, StartScreen, Minimap, Compass, touch controls
src/store.js                zustand store; per-frame position goes through a transient subscription
src/utils/                  HebrewCalendar (hebcal, Jerusalem sunset) and Korbanos (Bamidbar 28-29)
```

The content frame: origin at the Nicanor threshold on the Azarah floor, `+x` north, `-z` west
toward the Heichal, one amah = 0.5 m. Builders never hard-code positions; they read the JSON,
so a content correction moves the geometry and the hotspot together. To add or fix an entry,
see `docs/content.md` and run `node scripts/verify_refs.mjs` before committing.

## Quality gates

CI (`.github/workflows/ci.yml`) runs lint, tests, the build, bakes the textures and captures
six screenshots with SwiftShader Chromium; the images and the draw-call counts are uploaded as
artifacts on every pull request, so visual changes are reviewed from the same fixed cameras.

## Deploy

The app is a static site. `Dockerfile` builds it and serves `dist/` with nginx (immutable
`/assets`, no-cache `index.html`, SPA fallback); `railway.json` points Railway at it. Steps and
checks are in `docs/deploy.md`. Production target: `mikdash.tzadek.ai`.

## Sources and accuracy

Dimensions and placements follow Mishnah Middot (with Middot 5:1 arithmetic for the Azarah),
Rambam Beit HaBechirah, Yoma, Tamid and Shekalim, and each card cites them. Where the sources
disagree (the seven gates of Middot 1:4-5 against the thirteen of 2:6, the side of Lishkas
HaGazis, the Cheil as terrace or rampart) the card shows the dispute. Items that existed only in
the First Temple (the Aron, Yachin and Boaz) are hidden unless the start screen's period toggle
is set to Bayis Rishon. The content was written and reviewed with Claude; it has not been
reviewed by a posek. Corrections are welcome as pull requests against `src/content/temple.json`.
