# Backlog

Open items found by the walking agents and the sprint reviews (September 2026). None of
these block the build; the routes and fuzz pass with the geometry as it stands.

## Content (`src/content/temple.json`)

- `outside.position.y` is -19.5 amos but the environment ground plane is at world y 0
  (amos -13.6), flush with the mount. Nothing models the six-amah drop, and the Chuldah
  thresholds meet the ground with a 5 cm step.
- The mikveh passage of Middot 1:9 (down from Beis HaMoked under the Birah) is not
  built; the hall's Cheil gate is reached by the vestibule and stair under its chol half
  (docs/content.md, GEO-D), and the hall's own north gateway stays closed above it.
- `soreg.position.z` is 158 while its notes and the builder put the ring at 157.
- `beis_avtinas` y 22.5 should be 24 (its floor is the storey over the Water Gate).
- Slaughter tables and pillars sit one amah too far north; `kiyor` x should be -24 so its
  north side clears the Ulam steps; the Klei Shir doors and the Madichin slot need a
  second look against Middos 5:3.
- Tour stops 9 and 13 (`src/content/tours/tamid.json`) would read better with the camera
  a few amos further back.

## Player and builders

- The player clamp (union of the area bounds in `TempleGame`) stops at the outer wall's
  inner face, so Shushan, Tadi and Kiponus cannot be walked through. Give `outside` (or
  each of those gates) bounds beyond the wall.
- The `cheil` route's comment still cites Lishkas HaEtz at z -102..-134 (now -118..-148).

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
