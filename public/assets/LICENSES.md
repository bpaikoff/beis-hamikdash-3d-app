# Third-party assets

## PBR textures (`public/assets/textures/`)

All texture sets in this directory come from [ambientCG](https://ambientcg.com) and are
released under the **Creative Commons CC0 1.0 Universal** licence
(<https://creativecommons.org/publicdomain/zero/1.0/>): they may be used, modified and
redistributed for any purpose, commercial or not, without attribution. ambientCG asks
(but does not require) that projects mention it; we do so here.

Each set is the 1K JPG download of the asset, reduced to the four maps the app reads
(Color, NormalGL, Roughness, AmbientOcclusion), renamed `color.jpg`, `normal.jpg`,
`roughness.jpg`, `ao.jpg`. Nothing else was edited. `manifest.json` records the asset
id, the download URL and the sha256 of the zip and of every extracted file;
`node scripts/fetch_assets.mjs --verify` checks the files on disk against it and
`node scripts/fetch_assets.mjs` reproduces the download.

| Directory | ambientCG asset | Maps | Size | Used for |
|---|---|---|---|---|
| `acacia/` | [Wood023](https://ambientcg.com/view?id=Wood023) | 3 | 2733 KB | acacia wood: Aron, Shulchan cores (acacia) |
| `ashlar/` | [Tiles143](https://ambientcg.com/view?id=Tiles143) | 3 | 2305 KB | Jerusalem limestone ashlar: court and chamber walls (stone) |
| `cedar/` | [Wood030](https://ambientcg.com/view?id=Wood030) | 3 | 3230 KB | cedar panelling, doors, beams (cedar) |
| `gold/` | [Metal048C](https://ambientcg.com/view?id=Metal048C) | 3 | 1911 KB | burnished gold: normal + roughness only, the albedo stays procedural (gold, goldEng) |
| `limestone/` | [Travertine009](https://ambientcg.com/view?id=Travertine009) | 4 | 1554 KB | fine dressed limestone: altar, kiyor, steps, gate frames (stoneFine, stonePolished) |
| `limestoneTiles/` | [Tiles139](https://ambientcg.com/view?id=Tiles139) | 3 | 2286 KB | limestone floor slabs (floor) |
| `marbleRose/` | [Onyx010](https://ambientcg.com/view?id=Onyx010) | 3 | 1854 KB | rose / red-veined marble (marbleR) |
| `marbleWhite/` | [Marble021](https://ambientcg.com/view?id=Marble021) | 3 | 1713 KB | white marble: Ulam, Heichal, chamber floors (marbleW) |
| `sand/` | [Ground093C](https://ambientcg.com/view?id=Ground093C) | 4 | 2337 KB | dusty ground on Har HaBayis (ground) |

Total: 19.5 MB. Fetched 2026-09-05.

## Rigged characters (`public/assets/characters/`)

The animated figures are by [Quaternius](https://quaternius.com), released under
**CC0 1.0 Universal** (<https://creativecommons.org/publicdomain/zero/1.0/>); the packs'
own License.txt reads "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication. Models by
@Quaternius". No attribution is required; Quaternius asks for support on Patreon
(<https://www.patreon.com/quaternius>).

Each file is one model taken out of the pack's zip and reduced with
`node scripts/fetch_assets.mjs --characters` (three's loaders and GLTFExporter in node):
the human is the Universal Base Characters body carrying only the clips listed from the
Universal Animation Library (same rig), with its textures moved out of the glb into the
files below; the FBX animals are converted to GLB, scaled to metres and their material
groups merged. Nothing was resculpted or re-animated. `manifest.json` records the
itch.io page, the zip's sha256, the source entry and the sha256 of every output file;
`--verify` checks them.

| File | Pack (itch.io) | Source entry | Clips kept | Size | Used for |
|---|---|---|---|---|---|
| `kohen.glb` | [universal-base-characters](https://quaternius.itch.io/universal-base-characters) (body), [universal-animation-library](https://quaternius.itch.io/universal-animation-library) (clips) | `Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf` + `Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb` | Idle_Loop, Idle_Talking_Loop, Walk_Loop | 1526 KB | rigged human (the Universal Base Characters male body on the Universal Animation Library rig, 1.8 m, 8.5k vertices): every kohen, the Kohen Gadol and the Yisraelim, skin textured from the files beside it and the garments painted by vertex colour at load |
| `sheep.glb` | [lowpoly-animated-animals](https://quaternius.itch.io/lowpoly-animated-animals) | `FBX/Sheep.fbx` | Idle | 188 KB | sheep (also the goats, recoloured and narrowed) at the Tamid pen |
| `bull.glb` | [lowpoly-animated-animals](https://quaternius.itch.io/lowpoly-animated-animals) | `FBX/Cow.fbx` | Idle | 234 KB | bull (the pack's cow, recoloured dark) at the Tamid pen |

Models: 1.9 MB. Fetched 2026-09-06.

The textures the human is drawn with are the pack's own PNGs, resized (Python PIL,
`scripts/resize_textures.py`, Lanczos) and re-encoded; the roughness map is the G channel
of the pack's packed metallic-roughness texture. Nothing was repainted.

| File | Pack (itch.io) | Source entry | Size | Bytes |
|---|---|---|---|---|
| `kohen_skin.jpg` | [universal-base-characters](https://quaternius.itch.io/universal-base-characters) | `Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Superhero_Male_Dark.png` | 1024² | 51 KB |
| `kohen_skin_normal.jpg` | [universal-base-characters](https://quaternius.itch.io/universal-base-characters) | `Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Superhero_Male_Normal.png` | 1024² | 99 KB |
| `kohen_skin_rough.jpg` | [universal-base-characters](https://quaternius.itch.io/universal-base-characters) | `Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Superhero_Male_Roughness.png` | 512² | 39 KB |
| `kohen_hair.jpg` | [universal-base-characters](https://quaternius.itch.io/universal-base-characters) | `Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Hair_1_BaseColor.png` | 512² | 30 KB |
| `kohen_eyes.png` | [universal-base-characters](https://quaternius.itch.io/universal-base-characters) | `Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Eye_Brown.png` | 256² | 32 KB |

Textures: 250 KB.

## Procedural textures (`public/textures/`)

Generated by `src/game/TextureFactory.js` and baked with `npm run bake`; part of this
project, same licence as the code.
