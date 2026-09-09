# Backlog

Open items found by the walking agents and the sprint reviews (September 2026). None of
these block the build; the routes and fuzz pass with the geometry as it stands.

## Content (`src/content/temple.json`)

Round 3 (September 2026) closed the position items: `outside` y -13.5 (ground flush with
the mount, the drop is not modelled), `soreg` z 157, `beis_avtinas` y 24, tables and
pillars at z -39, `kiyor` x -24, Madichin 15 wide, tour stops 9 and 13 moved, and the
Cheil doors of Beis HaMoked and Lishkas HaGazis reached by vestibules and switchback
stairs (docs/content.md, GEO-D; `meta.disputes`). Still open:

- The mikveh passage of Middot 1:9 (down from the north-west chamber of Beis HaMoked
  under the Birah) is not built; it would start in the west bay of the vestibule's
  undercroft. Shaar HaNitzotz's wicket to the Cheil (Middot 1:5) has no stair either.
- The 16-amah drop from the Azarah chambers to the Cheil on the north and south is the
  eastern Cheil level (Middot 2:3, 2:5) carried round; no source gives those levels.

## Player and builders

- The player clamp is now the union of the area bounds with `outside` a ring 40 amos
  beyond the wall (`walkableBounds()` in `src/content/index.js`); all five outer gates
  walk through both ways.
- Round 4 (2026-09-06) closed the first-impression items: the hills are one heightfield
  (`EnvironmentBuilder.terrainHeight`, the east hill stretched into a north-south ridge for
  Har HaMishcha, fog to 534 m), Tadi is a gable of two leaning stones with no lintel
  (`wallRunA` `gable` option), the Ulam steps are dressed limestone with shaded risers,
  the Gazis benches are solid tiers and the kiyor's rim is a walkable kerb.
- Round 6 (2026-09-09) closed the round-4 leftovers: the ground material fades its normal
  map with camera distance in the shader (`EnvironmentBuilder.fadeNormalMapWithDistance`,
  full within 25 m, gone past 60 m; one material, no extra draw call), so the hills no
  longer carry the sand ripple; `?at=` (`src/game/spawn.js`) tries a ring of standing
  points round the entry (front first, then 30-degree steps, at 1x / 1.5x / 2x the
  distance) and keeps the first on a floor near the entry's base, outside every mass and
  wall, with an open line of sight, so `ulam_facade` stands north-east of the steps on the
  court at (29.1, -48.2) amos and shows them; the muchni post moved half an amah toward
  the laver (x -26.05 amos) with a 0.12 m solid, so (-27, -65) is walkable. Still open:
  the `ulam_facade` view sees the Ulam front at a grazing angle (the altar's north-east
  quadrant blocks every bearing nearer the axis); a hand-placed `cam` view would frame the
  facade square-on.
- Beis HaMoked's vestibule floor runs past flight A's outer wall into a dead-end pocket
  under the hall floor (x 68.5..75.75, z -5.25..-3); open, no drop, harmless.

## Characters (Sprint 4, round 5)

Round 5 (2026-09-06) replaced the mannequin: `kohen.glb` is the Quaternius Universal Base
Characters male body (CC0) on the Universal Animation Library rig, the three clips
retargeted by joint name (`scripts/fetch_assets.mjs`), its skin/eyes/eyebrow textures
shipped as five small files (`manifest.textures`). `CharacterSystem.paintHuman` splits the
body into a textured skin group and a vertex-coloured garment group by the rig's bones,
flattens the garment's normals to per-limb tubes and puffs it 3 cm so the muscular body
does not read through the robe; Yisraelim wear grey wool with a belt and hem and a sudar
cap. A skinned LOD (`figureTier`) hides figures below 4 px and their small parts beyond
~30 m. Still open:

- The garment is still paint over the body: a real tunic mesh with folds (or a garment
  normal map) would read better at arm's length; the shoulders keep the base body's bulk.
- The pack has no scalp hair, so bare heads are covered (sudar / migba'as). The two Levites
  on the Duchan wear the migba'as (default `createKohen` role); a Levite role with its own
  cap would be a small addition.
- No goat or bull model: the goat is the sheep narrowed and recoloured, the bull is the
  cow recoloured dark.

## Sky and lighting (Sprint 6, round 5)

Round 5 renders `scene.environment` from the sky dome per time of day (`Daylight`:
offscreen Sky + ground hemisphere + sun-side panels, PMREM cached per time), so dawn and
dusk reach the stone in the hero view; gold `envMapIntensity` retuned. Open: the burnish
on gold is flatter than the old studio map at some angles; the panels are the knob.

## Deployment

- DNS for mikdash.tzadek.ai (CNAME `mikdash` -> `4bae3oiu.up.railway.app`) is deferred
  until the app is closer to finished.
