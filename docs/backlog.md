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
  the Gazis benches are solid tiers and the kiyor's rim is a walkable kerb. Left open:
  the near hills carry the sand normal map's ripple (a second material without it costs
  a draw call); `ulam_facade` (`?at=maalos_ulam`) spawns on the altar top, so that view
  never shows the steps (`ulam_steps_altar` and `ulam_steps_low` do); the `?at=` back-off
  in `TempleGame` could stand beside the altar instead.
- Standing at (-27, -65) amos on the court, west of the laver, `PlayerController.collides()`
  is already true (the muchni's post within the player radius), so the controller refuses
  every move; reachable only by `?cam=`. A half-amah nudge of the post or a smaller solid
  would clear it.
- Beis HaMoked's vestibule floor runs past flight A's outer wall into a dead-end pocket
  under the hall floor (x 68.5..75.75, z -5.25..-3); open, no drop, harmless.

## Characters (Sprint 4)

- The kohanim are the Quaternius Universal Animation Library mannequin with per-role
  vertex colours: white robe, red avnet, cap, tan head and hands, no modelled face. A
  textured human (Quaternius Universal Base Characters, 122 MB download) or a Mixamo-style
  rig would replace them without touching `CharacterSystem`'s API.
- No goat or bull model: the goat is the sheep narrowed and recoloured, the bull is the
  cow recoloured dark.
- Skinned meshes are skipped by `DistanceCuller`; a distance LOD for characters would
  bring the hero view further below 800 draw calls.

## Sky and lighting (Sprint 6)

- Dawn and dusk change the sky and the sun's warmth, but in the hero view the sky is only
  a strip through the gate, so the effect reads faintly there. A sky-based PMREM for the
  environment map (instead of RoomEnvironment) would carry the time of day into the stone.

## Deployment

- DNS for mikdash.tzadek.ai (CNAME `mikdash` -> `4bae3oiu.up.railway.app`) is deferred
  until the app is closer to finished.
