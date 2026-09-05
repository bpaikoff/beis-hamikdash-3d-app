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

# Character assets

The kohanim, the Kohen Gadol, the Yisraelim and the animals are rigged glTF models under
`public/assets/characters/` (CC0, by Quaternius; see `public/assets/LICENSES.md`), loaded
by `src/game/CharacterSystem.js`. Doves stay primitives.

| File | Source | Clips | Size | Notes |
|---|---|---|---|---|
| `kohen.glb` | Universal Animation Library (Standard), `UAL1_Standard.glb` | `Idle_Loop`, `Idle_Talking_Loop`, `Walk_Loop` | 1.6 MB | the UAL mannequin, 1.8 m, two skinned primitives (8.5k vertices), 65 bones, in-place animation (not the root-motion file) |
| `sheep.glb` | Lowpoly Animated Animals (farm pack), `FBX/Sheep.fbx` | `Idle` | 0.2 MB | converted from FBX, scaled to 0.95 m, feet on y 0, facing +z; also the goats |
| `bull.glb` | same pack, `FBX/Cow.fbx` | `Idle` | 0.2 MB | the pack's cow, scaled to 1.5 m; coloured dark at load |

Total 2.0 MB, static files outside the JS bundle. No Draco or KTX2: the files are plain
glTF 2.0 binaries written by three's `GLTFExporter`, so `GLTFLoader` alone reads them and
vitest can parse them in node (`Characters.test.js`).

## Fetching

```bash
node scripts/fetch_assets.mjs --characters   # itch.io download + reduction (network, three in node)
node scripts/fetch_assets.mjs --verify       # also checks characters/manifest.json
```

The packs live on itch.io, which has no direct zip links: the script follows the site's
own flow (POST `download_url` for the "no thanks" download page, then POST `file/<id>`)
with a small cookie jar, so no account is needed. It then takes one entry out of each zip
and reduces it with three's loaders in node: the UAL file is re-exported with only the
three clips above (7.6 MB -> 1.6 MB); each animal FBX is parsed with `FBXLoader`, its
material groups merged (one primitive per material instead of one per polygon run),
scaled by its skinned bounds to the `height` in `CHARACTERS`, and exported as GLB.
`public/assets/characters/manifest.json` records the itch.io page, the zip's sha256, the
source entry, the clips and the sha256 of every output; `LICENSES.md` is regenerated from
it together with the texture manifest. URLs carry `?v=<sha256 prefix>` like the textures.

## How the figures are built

- One `GLTFLoader` on the shared `LoadingManager` (`TextureFactory.manager`); each file is
  loaded once and every figure is a `SkeletonUtils.clone` with its own `AnimationMixer`.
- Dress by vertex colour: the human is painted per role from its bind (T) pose — head and
  hands skin, the rest white linen (kohen), undyed wool (yisrael), or techeiles on the
  torso with the linen sleeves and hem showing (Kohen Gadol); a dark avnet band. Geometry
  is copied once per role, materials are shared per role (`whiteLinen` map x vertex colour).
- Meshes on bones: the migba'as (kohen) and the mitznefes, tzitz, ephod, choshen and the
  twelve stones (Kohen Gadol) are simple geometries attached to the `Head` / `spine_03`
  bones at rest-pose world positions, so they follow the idle animation.
- Animals swap materials by the source names (`White`, `Black`, `Pink`): wool, goat hide
  (the sheep model narrowed to 0.85 x 0.95 x 0.9) and dark bull hide.
- Budget: `LIMITS` = 20 humans, 14 animals, 12 doves. Mixers tick at 30 Hz and only for
  figures within 80 m of the camera; everything is frustum-culled by three (bind-pose
  bounding spheres, animations are in place). Walkers use `Walk_Loop` with the mixer's
  `timeScale = speed / CLIP_SPEED.kohen` so the feet do not slide.
- Placement is data: `templePlacements()` derives every spot from the content JSON
  (`worldPos` + level y); `Characters.test.js` probes each spot and every 0.25 m of the
  two walking loops (slaughter lane, Duchan strip) against the built Temple with
  `PlayerController.probe`, so a builder change that puts a figure inside a solid or off
  its floor fails the suite. Nothing changes with the period toggle.
- `dispose()` stops the mixers, disposes the cloned skeletons, painted geometries and
  materials; `TempleGame.dispose` calls it before traversing the scene.
