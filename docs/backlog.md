# Backlog

Open items found by the walking agents and the sprint reviews (September 2026). None of
these block the build; the routes and fuzz pass with the geometry as it stands.

## Content (`src/content/temple.json`)

Round 3 (September 2026) closed the position items: `outside` y -13.5 (ground flush with
the mount, the drop is not modelled), `soreg` z 157, `beis_avtinas` y 24, tables and
pillars at z -39, `kiyor` x -24, Madichin 15 wide, tour stops 9 and 13 moved, and the
Cheil doors of Beis HaMoked and Lishkas HaGazis reached by vestibules and switchback
stairs (docs/content.md, GEO-D; `meta.disputes`). Still open:

- Round 6 (2026-09-09) built the Middot 1:9 passage (a well in the north-west chamber of
  Beis HaMoked, three flights to the vestibule's west bay, a vaulted lamp-lit corridor
  along the outer face of the north wall to a bath-house with a sunken pool at z -52..-42)
  and Shaar HaNitzotz's opening to the Cheil (Middot 1:5) as a stair tower on the Cheil
  west of the gate with a 2 x 4 wicket; both are reconstructions (`meta.disputes`). Still
  open: the passage and bath stand ON the Cheil pavement because `HarHaBayisBuilder`'s
  mount and pavement are single slabs; a sunken passage needs a notch in those slabs.
- Second reading of Yoma 19a (source reviewer, 2026-09-09): the Gemara raises and rejects
  the reasoning that Palhedrin was the southern chamber and leaves the question open;
  Rambam (Beis HaBechirah 5:17), Meiri (Yoma 19a) and Yerushalmi Yoma 1:5 put Beis Avtinas
  over the Water Gate in the south and Palhedrin (= Lishkas HaEtz) in the north. The notes
  now say so; the geometry still follows the rejected reading (Palhedrin south beside the
  Water Gate, Avtinas over the Korban gate). Decision pending: flip them (Avtinas as the
  aliyah over Shaar HaMayim with its stair; Palhedrin back beside Lishkas HaEtz).
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
- Round 6 court walker (2026-09-09): fuzz of azaras_kohanim / azaras_yisrael / ezras_nashim
  (40 starts each, seed 61) found no real fall; four `r6_court_*` routes (Nicanor to the
  Levites on the Duchan, round the flock at the rings, kiyor past the muchni post up the
  Ulam flight, the `ulam_facade` spawn down to the steps) walk green. The `?at=` picker was
  audited for every entry (`scripts/screenshot.mjs --at id,id` captures any spawn): a gate
  is now faced square-on along its passage from the side a visitor arrives, a standing
  point must be level ground within a step of the entry's base (no more standing on a
  slaughter table, a Gazis bench, the small kevesh or the kevesh foot) and never inside
  another chamber, and the Nicanor gate is seen from the axis over the Maalos Shir landing.
  The code reviewer found the old-rule fallback dropped `?at=taim` 11 m into the undercroft
  under the Heichal and `?at=beis_avtinas` onto the court; `pickSpawn` now runs four passes
  (level with sight; a step up with sight; any depth below with sight, so the Avtinas storey
  is looked up at from the Har HaBayis plaza; near the level without sight, so the sealed
  ta'im are seen from the Heichal floor) before that rule; both now stand on a floor but the
  views are poor (`taim` faces the Heichal's gold wall, `beis_avtinas` looks at the stone wall
  with the storey above the frame): hand `cam` views for both. Still open: `?at=pesach_haheichal`
  stands inside the Heichal facing the doorway from behind (the front candidate on the Ulam
  flight is a step off level and the sides fail sight); a hand `cam` would restore the view
  from the steps. `?at=lishkas_haetz` stands
  on the south strip and sees only the Gazis' and Golah's back walls (the Etz has no face
  on the court); Bechoros, Delek and Nitzotz are seen 30 degrees off their axis (the kevesh
  foot and the Ulam's wings take the axis points).
- Beis HaMoked's vestibule floor runs past flight A's outer wall into a dead-end pocket
  under the hall floor (x 68.5..75.75, z -5.25..-3); open, no drop, harmless.
- Round 6 north walker (2026-09-09), the Middot 1:9 passage and the Nitzotz tower: the
  vault now steps up over the passage's four steps (it ran level and left 1.35 m of head
  room on the top step) and the passage door's leaf stands beside its opening instead of
  in it. Still open: the vestibule's west bay (the stair's foot, the passage door) is
  sealed from the switchback's foot and the Cheil door (z -16.25..-15.75, x 68.5..81.5),
  so the tamei kohen's way to Tadi runs back up through the hall and down the switchback
  (`r6n_pool_to_tadi`); opening the seal east of flight A's outer wall (x 75.75..81.5)
  would give the passage a direct way to the Cheil door. The floor south of the pool is a
  half-amah sliver behind the kerb (z -51..-50.5), unwalkable, harmless. The passage sits
  on the Cheil pavement (no notch in the slab) and the lamps are static spheres.

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

- Round 6: the garment carries a seeded cloth-fold normal map (`TextureFactory.clothFolds`,
  baked to `public/textures/clothFolds.webp`, on a per-limb cylindrical `uv1`), so it reads
  as cloth at arm's length; the shoulders still keep the base body's bulk (a tunic mesh
  was judged unnecessary). Levites (`role: 'levi'`) wear white linen without the avnet and
  a flat wool turban (a reconstruction; see the comment in `CharacterSystem.js`).
- The pack has no scalp hair, so bare heads are covered (sudar / migba'as / the Levite's
  turban). Round 6 made the Yisrael's sudar a head-wrap to the ears (`SUDAR`: an ellipsoid
  cap with a rolled band, 12 cm down the skull, tested against the body's skull vertices)
  after `yisrael_close` showed bare scalp above the old 6 cm cap.
- The bull is now the Quaternius Ultimate Animated Animal Pack Bull (CC0, via Poly Pizza),
  merged to one primitive. No CC0 rigged goat exists (Quaternius, Kenney, Poly Pizza
  checked); the goat stays the sheep with horns and a beard hung on the head bone and a
  hide colour. `attachToBone` now divides out the bone's world scale (the FBX animals'
  head bone is scaled 0.2177).

## Sky and lighting (Sprint 6, round 5)

Round 5 renders `scene.environment` from the sky dome per time of day (`Daylight`:
offscreen Sky + ground hemisphere + sun-side panels, PMREM cached per time), so dawn and
dusk reach the stone in the hero view; gold `envMapIntensity` retuned. Round 6 set
`ENV.panelSun` 1.2 and the sun panel's radiance 60 (gold +5..11 % in the hero and altar
views, no clipped pixels); `panelSun` scales the panels down, not up.

## Deployment

- mikdash.tzadek.ai is attached to the Railway service (certificate pending). The DNS
  record still to add at Cloudflare: `mikdash CNAME 4bae3oiu.up.railway.app` (DNS-only
  until the certificate issues; SSL mode Full if proxied). tzadek.ai's landing page and
  app nav link to it (deployed once the name resolves).
