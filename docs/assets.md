# Texture assets

Two kinds of texture feed the materials in `src/game/TempleBuilder.js`:

| Kind | Where | Made by | Loaded by |
|---|---|---|---|
| Procedural (21) | `public/textures/<name>.webp` | `src/game/TextureFactory.js` generators, baked with `npm run bake` | `TextureFactory.get(name)` |
| Photographic PBR sets (9) | `public/assets/textures/<set>/{color,normal,roughness,ao}.jpg` | ambientCG (CC0), fetched with `node scripts/fetch_assets.mjs` | `TextureFactory.pbrSet(set)` |

Both go through one `THREE.LoadingManager`; `TextureFactory.onProgress` / `whenLoaded`
count every file of both kinds, so the start screen's `Loading textures n/total` covers
the sets as well.

## The sets

All nine are 1K JPG downloads from [ambientCG](https://ambientcg.com), licence CC0 1.0
(no attribution required; `public/assets/LICENSES.md` lists them anyway). Only the four
maps the app reads are kept; Displacement and Metalness are not fetched. Total 19.5 MB,
static files outside the JS bundle.

| Set | ambientCG | Materials | Tile | Maps |
|---|---|---|---|---|
| `ashlar` | Tiles143 | `stone` (court and chamber walls) | 3 m | color, normal, roughness |
| `limestone` | Travertine009 | `stonePolished` (gate frames, ledges), `stoneFine` (altar, kiyor, steps; 1.25 m) | 2 m | color, normal, roughness, **ao** |
| `limestoneTiles` | Tiles139 | `floor` | 2 m | color, normal, roughness |
| `marbleWhite` | Marble021 | `marbleW` | 2 m | color, normal, roughness |
| `marbleRose` | Onyx010 | `marbleR` | 2 m | color, normal, roughness |
| `cedar` | Wood030 | `cedar` | 2 m | color, normal, roughness |
| `acacia` | Wood023 | `acacia` | 2 m | color, normal, roughness |
| `sand` | Ground093C | `ground` | 8 m | color, normal, roughness, **ao** |
| `gold` | Metal048C | `gold`, `goldEng` (normal + roughness only; the albedo stays the procedural gold) | 4 m | color (unused), normal, roughness |

ambientCG's procedural sets ship no AmbientOcclusion map, so only `limestone` and
`sand` have `aoMap` (at `aoMapIntensity` 0.8). The manifest is what `pbrSet` consults, so
a missing map costs no request.

Still procedural: `mosaic` (redesigned as opus tessellatum, one 2 m panel per tile),
`paroches`, `copper`, `copperPatina`, `water`, the fabrics and hides, and the fallbacks.

### Roughness

`MeshStandardMaterial.roughness` multiplies the roughness map and the shader clamps the
product to 1, so a multiplier above 1 lifts a map whose mean is low while keeping its
variation. The ambientCG maps here average: ashlar 0.33, limestoneTiles 0.51, sand 0.59,
cedar/acacia 0.50, gold 0.28, marbleWhite 0.12, limestone 0.04, marbleRose 0.04. The
materials use x2.6 (ashlar), x1.6 (tiles, sand, woods), x1.5-1.7 (gold, landing near the
0.38-0.45 the gold had before), x3 (white marble). The two near-black maps (`limestone`,
`marbleRose`) are not attached (`roughnessMap: false`): multiplying them by 20 only
amplifies JPEG noise, so those materials use a constant (0.55 / 0.8 / 0.35).

### UVs and aoMap

Tiling is per mesh (`BaseBuilder.scaleBoxUVs` scales the box's UVs by `TILE_METRES`),
never `texture.repeat`, so textures and materials stay shared and instancing-safe.

`aoMap` needs no second UV set with three 0.160: `Texture.channel` defaults to 0 and
`WebGLPrograms` maps channel 0 to the `uv` attribute (`uv1` is used only when
`aoMap.channel = 1`; before r151 the name was `uv2`). `BaseBuilder.test.js` pins the
default so a three upgrade that changes it fails the suite; at that point
`scaleBoxUVs` should also write `uv1` (the same attribute object can be reused).

## Fetching and verifying

```bash
node scripts/fetch_assets.mjs            # download every set in SETS (network)
node scripts/fetch_assets.mjs --only cedar
node scripts/fetch_assets.mjs --verify   # sha256 of every file on disk vs manifest.json
```

The script needs nothing beyond Node 22 (fetch plus a minimal zip reader on
`zlib.inflateRawSync`). It writes `public/assets/textures/manifest.json` (asset id,
page, download URL, zip sha256, per-file sha256 and size) and regenerates
`public/assets/LICENSES.md` from it. To swap a set, change its id in `SETS`, run the
script, re-check the screenshots, and commit the files with the manifest.

## Caching

`nginx.conf` serves `/assets/` as immutable for a year (it was written for Vite's hashed
bundle). The texture files are not content-hashed, so `pbrSet` appends
`?v=<first 8 hex of the file's sha256>` from the manifest to every URL: a swapped file
gets a new URL and the old cache entry is never hit. `try_files $uri` ignores the query.

## Switches

- `?pbr=0`: `TextureFactory` is built with `pbr: false`, `pbrSet` returns null and every
  material uses its procedural fallback (the pre-sprint-3 look).
- `?bake=0`: procedural textures are generated on the canvas instead of loading the
  baked WebP files (unchanged).

## Screenshots

`npm run build && node scripts/screenshot.mjs --out <dir>` renders the six fixed views
(hero, ezras_nashim_steps, mizbeach_kevesh, ulam_facade, heichal_interior,
kodesh_hakodashim) headlessly. Sprint 3's before/after pairs live in `shots/before` and
`shots/after` (untracked).
