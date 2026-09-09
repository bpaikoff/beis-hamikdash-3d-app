# Content model: `src/content/temple.json`

Single source of truth for everything the walkthrough places, labels and explains.
Builders take positions and `geometry` hints from it; the HUD takes names, descriptions,
dimensions, sources and visitor questions. Nothing about the Temple is hard-coded elsewhere.

## Coordinate frame ("azarah")

All positions are in **amos** (one amah = 0.5 m in the scene, `src/content/units.js`).

| axis | meaning |
|---|---|
| origin | the threshold of the Nicanor Gate, at the Azarah (Ezras Yisrael) floor |
| +x | north (−x south) |
| −z | west, toward the Heichal (+z east, toward the Ezras Nashim) |
| +y | up |

`toWorld()` in `units.js` converts to scene metres; the content never uses metres.

### Floor levels (y, amos)

| floor | y | derivation |
|---|---|---|
| Har HaBayis, Cheil | −13.5 | 12 half-amah steps below the Ezras Nashim (Middot 2:3) |
| Ezras Nashim | −7.5 | 15 half-amah steps below the Azarah (Middot 2:3, 2:5) |
| Ezras Yisrael | 0 | frame origin |
| Duchan | 1 | one-amah step (Middot 2:6) |
| Ezras Kohanim | 2.5 | Duchan + three half-amah steps (Middot 2:6, R. Eliezer ben Yaakov) |
| Ulam, Heichal, Kodesh HaKodashim | 8.5 | 12 Ulam steps rising 6 over 22 amos (Middot 3:6) |

No Middot source gives a rise between Ulam and Heichal, or between Cheil and Har HaBayis,
so those pairs share a level. `meta.levels` in the JSON repeats this table.

### East-west section (z, amos) — Middot 5:1 and 4:7

```
  0 .. -11   Ezras Yisrael          -92 .. -98    Heichal east wall (6)
-11 .. -22   Ezras Kohanim          -98 .. -138   Heichal interior (40)
-22 .. -54   Mizbeach (32)          -138 .. -139  Amah Traksin
-54 .. -76   12 Ulam steps (22)     -139 .. -159  Kodesh HaKodashim (20)
-76 .. -81   Ulam wall (5)          -159 .. -165  Heichal west wall (6)
-81 .. -92   Ulam (11)              -165 .. -171  western ta (6), -171 .. -176 its wall (5)
                                    -176 .. -187  behind the Beis HaKapores (11)
  0 ..   6   Azarah east wall (thickness assumed)      147 .. 153  Cheil steps (12)
  6 .. 141   Ezras Nashim (135)                        153 .. 157  Cheil landing
141 .. 147   Ezras Nashim east wall                    157         Soreg
-222 .. 278  Har HaBayis (500), x -302.5 .. 197.5 (largest expanse south, Middot 2:1)
```

### North-south (x, amos) — Middot 5:2 and 4:7

Azarah interior x −67.5 .. 67.5. Kevesh + altar 62 (x −46 .. 16), 8 to the rings,
rings 24 (x 24 .. 48), 4 to the tables (x 52), 4 to the pillars (x 58), 8 to the wall.
Heichal interior x −10 .. 10, walls to ±16, ta'im to ±22, ta walls to ±27, mesibah /
water channel to ±30, outer walls to ±35; the Ulam is 100 wide (x −50 .. 50).

Walls of the courts are taken as 6 amos thick (not given in Middot); every such
assumption is stated in the entry's `position.note` or `geometry.notes`.

## Entry schema

```jsonc
{
  "id": "lishkas_haparvah",          // snake_case, unique, stable (code and ?at= links use it)
  "type": "chamber",                 // area | kli | gate | chamber | structure
  "name": {"he": "", "en": ""},
  "desc": {"he": "", "en": ""},      // 2-3 natural sentences each
  "period": ["bayis_sheni"],         // bayis_rishon and/or bayis_sheni; omitted = always
  "area": "azaras_kohanim",          // parent area id (non-areas only)
  "bounds": {"minX","maxX","minZ","maxZ"},   // areas only, amos
  "dimensions": [{"label": "", "value": 0, "unit": "amah|tefach|etzba|count", "source": "Sefaria ref", "note": ""}],
  "position": {"frame": "azarah", "x": 0, "y": 0, "z": 0, "unit": "amah", "source": "Sefaria ref", "note": "how it was derived; legacy value if any"},
  "sources": ["Sefaria ref", ...],   // 2-6, verified by scripts/verify_refs.mjs
  "disputes": [{"issue": "", "views": ["...", "..."]}],   // only where a real machlokes exists
  "questions": [{"he": "", "en": ""}],                    // 2-4, become tzadek.ai ?q= links
  "icon": "🛁",                      // emoji for now
  "geometry": {"kind": "box|room|gate|steps|ramp|arc_steps|pillar", "w": 0, "d": 0, "h": 0, "notes": ""},
  "children": [ { "id", "name", "desc", "position", "sources" } ],   // sub-rooms (Beis HaMoked); index.js flattens them into `entries`/`byId` with `parent` set
  "gateScheme": ["middos_1_4", "middos_2_6"],   // gates: which count(s) include this gate
  "outsideWall": "south",            // Azarah entries built in the Cheil beyond the wall (Etz, Palhedrin)
  "legacyId": "..."                  // phase-1 hotspot key, kept for the migration
}
```

Conventions:

- `w` is the north-south extent, `d` east-west, `h` height, all in amos. `room` is a
  walkable interior, `box` a solid; `steps`/`arc_steps`/`ramp` rise by `h` over `d`.
- Gates are placed at the **inner** face of their wall (x ±67.5 or z −187) so they fall
  inside the Azarah bounds test. `beis_hamoked_gate` is in the hall's south wall (x 52.5).
  Chambers that straddle a wall (`lishkas_hagazis`, `beis_hamoked`) are centred on the wall
  line; the two that lie beyond the wall's inner face (`lishkas_haetz`, `lishkas_palhedrin`)
  carry `outsideWall` and reach the Cheil's outer edge (x ±83.5, the Soreg line) and no
  further. Lishkas HaEtz is the next room west of the Gazis, in the band of its chol half
  and the Cheil (x −67.5 .. −83.5, z −118 .. −148), behind the Golah and beyond the Gazis
  (Middot 5:4, Abba Shaul), entered from the Gazis' chol half. Palhedrin is in the Cheil
  beside the Water Gate in the south (the arrangement Yoma 19a raises and leaves unproved;
  Rambam 5:17 and Meiri put it north) with its floor at the Cheil level and an internal
  stair to a landing at the court level whose door opens into the Water Gate passage;
  Beis Avtinas is an upper storey on the north wall over the Korban gate, reached by a
  stair tower beside the gate (`geometry.stair`). Both stairs and the north/south
  assignment are reconstructions. The Kohen Gadol's first immersion was on the Water
  Gate's roof 'beside his chamber' (Yoma 31a), which chamber the Bavli leaves open and
  Meiri and Yerushalmi Yoma 1:5 take as Beis Avtinas.
- Sub-rooms listed under a parent's `children` (Beis HaMoked's four) are flattened by
  `src/content/index.js` into `entries` and `byId` with `parent` set: they keep their own
  id, name, desc, position and sources and inherit type, area, period, icon and questions,
  so `?at=`, `hotspots()` and the walk routes can address them. The bounds test skips them
  (they lie inside their parent's footprint, which may straddle a wall).
- Hotspot positions are walkable spots, not geometric centres: `azaras_kohanim` sits at
  x 25, z −60 (the court's centre is inside the altar), `ezras_nashim_balcony` on the
  gallery floor (z 139), `lishkos_klei_shir` in its northern door (x 20).
- The thirteen-gate count (Abba Yose ben Chanan, Middot 2:6) is fully represented.
  Gates with `gateScheme: ["middos_2_6"]` only are optional for the builders; two of them
  (`shaar_yechonya`, `shaar_hashir`) share an opening with `nitzotz_gate` and
  `beis_hamoked_gate` — build one opening, label both. The dispute is recorded on every
  gate involved.
- Bayis Rishon-only items (`aron`, `keruvim`, `yachin`, `boaz`) carry `period: ["bayis_rishon"]`;
  `amah_traksin` and `paroches` describe both periods in their notes. `ulam`, `heichal` and
  `kodesh_hakodashim` carry both periods (their measures are Bayis Sheni, Middot 4:6-7) so the
  Bayis Rishon items have a building to stand in.
- `beis_hamoked` and everything in it sit at y 2.5: its Azarah gate opens onto the Ezras
  Kohanim strip (z −11 .. −22), whose floor is at that level. Its gate to the Cheil
  (Middot 1:7) and the Gazis' door to the chol (Yoma 25a) are 16 amos over the Cheil, so
  each is built as a door at the Cheil level into a vestibule under the chamber's chol
  half, with a switchback of 32 half-amah steps in three flights up to a well with a
  parapet in the chamber floor beside the kodesh line (`CourtBuilder.switchbackA`);
  reconstructions, stated in `meta.disputes` and the entries' notes. The kodesh halves
  stand on solid bases and the kodesh / chol line is inlaid in both floors.
- Sefaria spellings: `Mishnah Middot 3:1`, `Mishnah Tamid 3:9`, `Mishnah Yoma 3:3`,
  `Yoma 51b`, `Mishneh Torah, The Chosen Temple 5:4`, `Mishnah Shekalim 6:4`, `Numbers 28:15`,
  `I Kings 7:21`, `II Chronicles 3:14`. One ref per string (no ranges).
- Anything the sources do not give (a chamber's size, a step flight's width, a wall's
  thickness) is flagged as "reconstruction" or "not given" in the note, never silently invented.

## Adding an entry

1. Pick a stable snake_case id and the parent `area`.
2. Derive the position from the tables above and say how in `position.note`
   (e.g. "Middot 5:1: 22 west of Nicanor + 16"). Cite the Mishnah that fixes it in `position.source`.
3. Give every dimension a Sefaria ref; 2-6 `sources`; a `disputes` entry only for a real machlokes.
4. Write 2-4 questions a visitor might click through to tzadek.ai, in both languages.
5. Add a `geometry` hint if it is to be built.
6. `npx vitest run` (schema, bounds, Middot arithmetic) and `node scripts/verify_refs.mjs --cache .refs-cache.json`.

## Verifying refs

```bash
node scripts/verify_refs.mjs                          # every ref, ~300 ms apart
node scripts/verify_refs.mjs --cache .refs-cache.json # skip refs verified before
node scripts/verify_refs.mjs --file other.json --gap 500
```

It collects every `sources[]`, `dimensions[].source` and `position.source` (including
`children`) from `temple.json`, plus the tour and stop `sources[]` of every
`tours/*.json`, dedupes, and requests
`https://www.sefaria.org/api/v3/texts/<ref>?version=hebrew`. A ref is bad on HTTP 404 or
a JSON body with an `error` key; 5xx and network errors are retried twice. Exit code 1
if any ref is bad. `.refs-cache.json` is a local convenience and is not committed.

## Tests (`src/content/content.test.js`)

Unique ids; bilingual name/desc; azarah frame; areas have bounds; ref-shaped sources on
entries and children; required ids exist; ≥2 sources, 2-4 questions, icon and parent area
on every non-area; known `geometry.kind` and units; Azarah items inside x ±67.5, z −187..0;
the Middot 5:1 arithmetic (altar −38, Heichal −118, Kodesh HaKodashim −149, levels).

## Tours (`src/content/tours/*.json`)

A tour is an ordered list of stops over the entries above; the engine (`src/game/Tour.js`)
moves the camera between them and shows a text card at each. `src/content/tours/index.js`
exports `tours`, `byTourId`, and three helpers: `tourEntry(id)` (an entry, or one of Beis
HaMoked's `children` with `parent` set until those are flattened into `entries`),
`stopCamera(stop)` and `stopLook(stop)` (both in amos, azarah frame).

```jsonc
{
  "id": "tamid",
  "title": {"he": "", "en": ""},
  "intro": {"he": "", "en": ""},
  "sources": ["Mishnah Tamid 1:1", ...],       // superset of every stop's sources
  "stops": [{
    "id": "beis_hamoked_watch",                // snake_case, unique within the tour
    "at": "beis_hamoked",                      // entry id (or a Beis HaMoked child id)
    "camera": {"x": 64, "y": 2.5, "z": -14},   // amos, azarah frame; y = the floor it was authored at
    // or "offset": {"dx": 0, "dz": 4.5},      // metres from `at` (+x north, +z east), 4-8 m into open court
    "look": "beis_hatevilah_descent",          // entry id, or {"x", "z"} (optional "y") in amos
    "dwell": 12,                               // seconds on the card, 5-20
    "title": {"he": "", "en": ""},
    "text": {"he": "", "en": ""},              // 2-4 sentences each; Hebrew without transliteration
    "sources": ["Mishnah Tamid 1:1", ...],     // 2-4 exact Sefaria refs
    "questions": [{"he": "", "en": ""}]        // 1-2, become tzadek.ai ?q= links
  }]
}
```

Conventions:

- A camera is a walkable spot beside the entry, never inside a wall, a chamber's solid, or
  the altar's body; the engine stands the camera at eye height on the floor there (so `y`
  is a hint — the `maaracha` stop stands on the kevesh at about 7.8 amos up). Beis HaMoked
  stops stand in the hall's free cross (x 62.5..72.5 / z −16..−12); Lishkas HaGazis stops
  in its eastern (kodesh) half, clear of the Sanhedrin benches (x < −71.5).
- The stops follow the Mishnah's order, not the shortest path: the tamid tour goes Beis
  HaMoked → Gazis → altar → Beis HaMoked → Ulam → rings → kevesh → Gazis → Heichal → Ulam
  steps → Duchan, as the service did.
- `scripts/verify_refs.mjs` scans every `tours/*.json` (tour and stop `sources[]`) along
  with `temple.json`; `--file` restricts it to one file of either kind.
- Tests (`src/content/tours.test.js`): ids unique; every `at`/`look` id exists (entries or
  children); `camera` xor `offset` (offset ≤ 8 m); the camera inside the courts and not in
  the altar or the building's walls; dwell 5-20; 10-14 stops; bilingual title/text/questions;
  2-4 ref-shaped sources per stop, each listed on the tour; Hebrew fields contain Hebrew.

### Tamid (`tamid.json`) — "The Morning Tamid"

Thirteen stops through Mishnah Tamid 1-7 with Yoma 2-4 and Middot where they fix a place:
Beis HaMoked at night (1:1) → the memuneh and the mikveh under the hall (1:2, Middot 1:9)
→ the first payis in Lishkas HaGazis (1:2-3, Yoma 2:2, Yoma 25a) → terumas hadeshen east of
the kevesh (1:4, 2:1-2) → the ma'aracha seen from the kevesh (2:3-5) → the second payis,
"Barkai", and the lamb by torchlight from Lishkas Telaei Korban (3:2-4, Middot 1:6) → the
wicket and the great gate of the Heichal (3:6-8) → the slaughter on the second ring and the
blood on the north-east and south-west corners (4:1) → dismembering and the limbs on the
lower west half of the kevesh (4:2-3) → Shema and the ketores lottery in the Gazis (5:1-3)
→ the menorah and the ketores on the golden altar (3:9, 6:1-3, Yoma 3:5) → the blessing on
the Ulam steps and the limbs on the fire (7:1-3) → the Levites' song on the Duchan (7:3-4,
Middot 2:6). Where the sources differ, the card states the Mishnah's text and the tour
follows the Gemara's placement: Tamid 1:2 reads as if the first lottery was in Beis HaMoked,
Yoma 25a puts it in the east of the Gazis; Tamid 3:3 puts the chamber of lambs in the
north-west, Middot 1:6 in the south-west (Yoma 17a reconciles).

### Engine (`src/game/Tour.js`, `src/components/TourCard.jsx`)

`TempleGame.startTour(id, stop)` builds a `Tour` over the tour's data and hands the camera
to it: while a tour is active `animate()` calls `tour.update(delta)` instead of
`player.update`, the movement keys and pointer lock stand down, and the crosshair, the
in-scene labels and the key hint are hidden (`.tour-active`). Escape or the card's Exit
calls `tour.stop()`, which returns control at the current position (the player's euler,
ground height and velocity are synced first). Deep links: `?tour=tamid` starts the tour
after the first frame, `?tour=tamid&stop=5` starts at a stop (1-based); the start screen's
"Take the tour" button does the same without taking the pointer.

- `start(i)` stands at stop `i` (no travel); `next()`, `prev()`, `goTo(i)` travel along a
  rail; a manual step turns auto-advance off until the card's play button (or Space)
  turns it back on. `update()` counts the dwell down at a stop and advances; hovering or
  focusing the card, or an open Ask panel, holds the countdown.
- A stop's position is `stopCamera()` in metres with the y hint snapped to the floor
  (`player.floorUnder`) and the eye at `PLAYER_HEIGHT`. The look point is the entry's
  position a little up its body (an entry look), the given `{x, y, z}`, or level (`{x, z}`).
- Rails: a centripetal Catmull-Rom curve through the current position, the routing
  waypoints and the stop, sampled every 0.25 m with the feet re-probed progressively and
  smoothed over ±1 m (ramps and stairs are followed without step jitter); a trapezoidal
  speed profile at 3 m/s with 0.8 s ramps. The view turns to the heading over the first
  20 % of the travel and to the stop's look target over the last 40 %.
- Routing: a straight walk is accepted when every sample passes the player's own tests
  (probe from step height not inside a solid, rise ≤ 0.6 m, drop ≤ 0.6 m, no wall box in
  the body column, and no solid at chest height within the player's radius, which keeps
  the camera off ledges such as the altar's yesod). Otherwise Dijkstra over a hard-coded
  graph of walkable court nodes (`NODES`/`EDGES`: Nicanor threshold, the Kohanim strip
  east of the altar and its ends, Beis HaMoked's gate and cross, the kevesh foot, the
  south lane, the Gazis door, the Ulam steps' two corners and second step, the Ulam)
  whose edges are verified with the same test at first use. Stops connect to any node
  their straight line reaches. Stop 4 → 5 goes `kevesh_foot` and up the ramp's axis.
  If a curve's rounded corner fails the test the polyline is used; if no route exists
  the straight line is used and `rail.routed` is false.
- Screenshot views `tour_1`, `tour_5`, `tour_9`, `tour_13` (`scripts/screenshot.mjs`)
  load `?tour=tamid&stop=N&autostart=1` and wait for `window.__mikdash.tour.state ===
  'dwell'`; `src/game/Tour.test.js` covers the profile, the router (a schematic court
  with the altar, the kevesh wedge and the Duchan) and the tour's transitions.

## Review log

### 2026-09-09 — Round 6 (Middot 1:9 passage, Nitzotz opening, second reading of Yoma 19a)

Content: `beis_hatevilah_descent` (position note: the well, stair, corridor, bath-house
and pool, every measure a reconstruction), `beis_hamoked` geometry-notes tail,
`nitzotz_gate` (position and geometry notes, a dimension row "opening to the Cheil",
Middot 1:5, the Mishnah's word is פתח), `meta.disputes[0]` (the passage) and a new entry
for the Nitzotz opening. No position moved. Builders: `AzaraBuilder.buildTevilahPassage`
(hall floor with two wells, `flightMergedA`, the vaulted corridor with lamps, the
bath-house and pool) and `buildNitzotzWicket` (tower, wicket, two flights, a bay through
the north wall at z -87..-84); the passage and bath stand on the Cheil pavement because
the mount and pavement are single slabs. Source reviewer (read-only, Sefaria): the
"under the Birah" gloss was misattributed (Yoma 2a itself: R' Yochanan, a place on the
mount; Reish Lakish, the whole Mikdash, followed by Rambam Beis HaBechirah 5:11 and
Bartenura; there is no Tosafos s.v. birah); Middot 1:6 does have them "go down" from the
north-west chamber (a winding stair on Rashi Yoma 19a, a tunnel on Bartenura), and R'
Eliezer ben Yaakov (Middot 1:9) runs the passage under the Cheil to Tadi; Middot 1:6
does not say which pair of chambers is chol (Rambam's diagram); Bartenura (Middot 1:5)
puts the Nitzotz opening in one of the exedra's side walls, and the Bavli's baraisa
(Yoma 19a) has no opening; Middot 2:6 lists Shaar Yechonya without naming Nitzotz. All
applied as note wording. **Yoma 19a, second reading:** the sugya suggests Palhedrin was
the southern chamber and rejects the reasoning; Rambam 5:17 and Bartenura (Middot 5:4)
make Palhedrin the Lishkas HaEtz in the north, Meiri (Yoma 19a) states Palhedrin north and
Beis Avtinas south by the Water Gate, Yerushalmi Yoma 1:5 puts Beis Avtinas over the
Water Gate. The `lishkas_palhedrin` and `beis_avtinas` notes and descriptions now say
the built arrangement follows the rejected suggestion and the printed Mishnah's southern
Lishkas HaEtz; flipping the geometry is an open decision (docs/backlog.md). Levite dress:
II Chron 5:12 is the singers' byssus and Josephus (Ant. 20.216-218) has Second Temple
Levites win linen only under Agrippa II, so the white linen is labelled a choice.

Verification: lint, 348 tests, build, 196 refs; walkers fuzzed azaras_kohanim,
azaras_yisrael, ezras_nashim, har_habayis (no real fall) and probed every landing, the
pool, the vault (head room fixed over the four steps), the wicket and the Cheil lane;
the full route set walked in four batches; screenshots Read.

### 2026-09-06 — Round 4 (visual fidelity: hills, Tadi, Ulam steps, benches, kiyor rim)

Three build agents in worktrees, then two read-only reviewers; no position moved.

- **Terrain** (`EnvironmentBuilder`): the eight six-sided cones and the flat ground quad
  are one heightfield mesh (`terrainHeight(x, z, hills)`: cosine bumps at the seeded
  `hillPlacements()` with 1.6-radius feet, plus three octaves of seeded value noise,
  ±1.5 m; exactly 0 within the walkable ring + 15 m, blended over 40 m beyond; vertex
  colours from sand to scrub and rock; 6 m cells out to the farthest foot, 16 m beyond,
  ~52k triangles in the floor collider). The east hill is stretched 3.2× along x into a
  north-south ridge for Har HaMishcha (Middot 2:4; the Mount of Olives per Bartenura and
  Tiferes Yisrael; Parah 3:6's causeway is not built); a reconstruction, no source gives
  its position, length or height. `RENDER_DISTANCE` 400 → 550, fog end 352 → 534 m.
- **Shaar Tadi** (`CourtBuilder.wallRunA` `gable: { rise, t, proud }`, `gableWallA`,
  `gableStonesA`; `HarHaBayisBuilder.tadiGate`): the wall over the opening is an extruded
  piece with an inverted-V notch and two 1-amah slabs lean from the jamb tops (6.5) to a
  ridge 3.1 higher (31.8°, tops at 10.78, 0.72 under the wall top); `gateA` keeps the
  jambs and drops the lintel (`frameTop`). `shaar_tadi.geometry.notes` states the two
  readings of Middot 2:3's שתי אבנים מוטות זו על גב זו: the gable (Rambam's diagram,
  Tiferes Yisrael) that is built, and the Rash's two hollowed blocks set one on the other
  (Tosafos Yom Tov), which would have a lintel. Pitch and thickness are a reconstruction.
- **Ulam steps** (`HeichalBuilder.buildMaalosUlam`): `marbleW` (Marble021, a near-uniform
  white with flat normals) rendered the twelve 0.25 m steps as one grey slope; they are now
  `stoneFine` dressed limestone with an instanced shaded riser facing (`stoneRiser`, a
  polygon offset). Middot 3:6 gives count and sizes only; Sukkah 51b / Bava Basra 4a's
  shaisha and marmara describe Herod's wall courses, not floors or flights, so the material
  is a reconstruction and the Ulam floor keeps its (equally unsourced) white marble.
- **Gazis benches** (`AzaraBuilder.buildLishkasHagazis`): three `blockA` tiers, a LIP over
  the floor (0.8, 0.55, 0.3 m; the top blocks, the lower two are stepped onto). The comment
  no longer claims a "half-circle facing east" from Sanhedrin 4:3, which gives only the
  half-circle "like half a round threshing floor" with no direction and no tiers; the
  straight tiers stand in for it (three rows before the judges, Sanhedrin 4:4; no sitting
  in the Azarah, Yoma 25a).
- **Kiyor rim** (`KeilimBuilder.buildKiyor`): the 0.12 m cistern kerb is a walkable floor,
  widened to 1.7 r so the centre can reach it past the laver's solid. Yoma 3:10 names only
  the muchni; the wheel that sank the laver is Yoma 37a, the cistern Bartenura; the kerb is
  a reconstruction (`kiyor.geometry.notes` corrected likewise).
- **HUD**: the compass named south when facing north (a positive yaw turns the camera
  toward -x); the quadrants run W, S, E, N.

Reviewer findings applied: the rim route's south leg had ended outside the rim (the
harness's `minY` accepts feet 0.5 m under the mass, so it cannot tell a 0.12 m kerb from
the floor; `HeichalKeilim.test.js` now walks the approaches with the controller);
`gableGeom` throws above 45°; tests read `TADI_GABLE_RISE`, `TADI_STONE_T` and `LIP` from
the builders. Noted for the backlog: at (-27, -65) on the court `collides()` is already
true (a knee-high mass, the muchni, within the player radius), reachable only by `?cam=`.

Verification: `npm run lint` (the one pre-existing warning), 253 tests, `npm run build`,
196 refs verified; all 72 routes walked in five batches (three concurrent, then the two
outside batches): `azarah_hug_avtinas` failed three steps in the 22-route batch and
passed alone (load flake); `cheil_ring` failed at the foot of the twelve steps in the
batch and alone, a route flaw (its corner waypoint was reached 1.2 m short, inside the
flight's span) fixed with a tight reach. Fuzz 40 starts × 3 walks on all eight areas,
0 failing. Screenshots on the final build: `hero` 943 draw calls (budget 1200),
`ulam_steps_altar`, `ulam_steps_low`, `kiyor_east`, `gazis_benches`, `gazis_well`,
`tadi_outside`, `tadi_gable`, `tadi_inside`, `hills_east/north/south/west`, `ridge_se`,
`corner_se_outside`, `shushan_outside`, `mizbeach_kevesh`, all read.

### 2026-09-05 — GEO-D (the Cheil stairs)

The PW1 walker found Beis HaMoked's Cheil gate and Lishkas HaGazis' chol door opening
16 amos over the Cheil with nothing to climb. Content: `meta.disputes` added (two
reconstruction entries), `beis_hamoked` (gates dimension note, position note, geometry
notes) and `lishkas_hagazis` (position note, geometry notes) state the vestibules and
stairs; no position moved. Builders: `CourtBuilder.switchbackA` / `floorWithWellA` /
`wellParapetA` (additive); `buildBeisHamoked` and `buildLishkasHagazis` build the
vestibule under the chol half (x 67.5 .. 82.5 / x −77.5 .. −67.5, the Cheil pavement
plus a LIP its floor, walls from the ground to the chamber floor's underside), the door
in the outer wall (Beis HaMoked: north wall, z −16.5 .. −11.5, 5 × 8, under the hall's
closed gateway; Gazis: south wall, z −115 .. −111, 4 × 7, replacing the closed door 16
amos up), the three flights along z in 2-amah bands (Beis HaMoked: C x 68.5 .. 70.5, B
71 .. 73, A 73.5 .. 75.5, foot z −13.5, landings z −16 .. −13.5 and −8 .. −5.5; Gazis:
C x −70.5 .. −68.5, B −73 .. −71, A −76.5 .. −73.5, foot z −97, landings z −99.5 .. −97
and −91.5 .. −89), the well in the floor over flight C with a half-amah parapet 1.5
high on three sides, and the kodesh / chol line inlaid in the floor. The Gazis benches
end at z −99, west of the stair head. `CHEIL_LIP` moved to `CourtBuilder`. Routes:
`scripts/walk-routes/stairs.mjs` (`beis_hamoked_stair`, `beis_hamoked_stair_rails`,
`gazis_stair`, `gazis_stair_rails`, walked in `AzarahRoutes.test.js`); `cheil` and
`soreg_openings` now enter the Beis HaMoked vestibule; `azarah_beis_hamoked` passes the
well along z −15; `azarah_gazis` rounds the well. The hug routes are unchanged.

### 2026-09-04 — content-reviewer (94 rows, 39 "fix")

Applied 36 rows in full (every high/medium row and the low-confidence wording rows):
Heichal door / Ulam beams and vine (Middot 3:7-8, 4:1-2); Ulam paroches moved out of
`disputes`; altar offset dispute corrected (Zevachim 58b, Yoma 16b) and the 28 × 28 tier
distinguished from the 24 × 24 ma'aracha; Tamid ceased on 17 Tammuz (Taanit 4:6); small
kevesh shirayim on the southern yesod (Zevachim 5:3); Tadi Gate per Middot 1:9; menorah
duplicate dimension; paroches 82 ribo; ring-area and table notes; unsourced `maalos_shir`
dispute removed; Gazis girsa stated; `ulam`/`heichal`/`kodesh_hakodashim` in both periods;
Palhedrin south beside the Water Gate and Beis Avtinas north (Yoma 19a, 31a); Etz and
Palhedrin 10 wide inside the Soreg; Beis HaMoked at y 2.5; Yachin/Boaz at z −74; Aron
north-south (Menachot 98a); Ulam steps 4/3/4/3/4/4 = 22; ta'im storey 15. Sources added
where the reviewer named them (Yoma 31a, Yoma 16b, Zevachim 58b, Mishnah Taanit 4:6,
Menachot 98a, Mishnah Middot 3:8, 4:5, Mishnah Zevachim 5:3, Mishnah Shekalim 8:4,
I Kings 6:2, 6:10, II Chronicles 3:17); all 166 refs verified on Sefaria.

Applied as notes only (low-confidence geometry/position rows, nothing moved):
- `kevesh_katan_west` / `kevesh_katan_east` geometry: the builder already builds these as
  level walkways leaving the kevesh where it reaches yesod / sovev height, which is the
  reviewer's reconstruction; the JSON notes now say so and `position` is documented as the
  hotspot only. Dimension `rise` relabelled `height at the altar` (builder follows).
- `slaughter_tables` geometry: the Middot 3:5 "between the pillars" tension is stated in
  `geometry.notes`; the column at x 52 stays.
- `duchan` position: the area/bounds mismatch is stated in `position.note`; `area` stays
  `azaras_yisrael` and the flight stays at z −11 .. −14.

### 2026-09-05 — Round A (content positions + builders)

Content (`id.field old -> new`): `azaras_kohanim.position` x 0 -> 25, z −43.5 -> −60 (the
old spot was inside the altar); `lishkos_klei_shir.position.x` 30 -> 20 (doors on the open
court between the steps' radius 12.5 and the corner chambers at 27.5);
`lishkas_hamadichin` / `lishkas_haparvah` / `lishkas_hamelach` z −96 / −112 / −128 ->
−100 / −116 / −132 (12 amos west, so the strip beside the Ulam's north wing, x 50 .. 67.5,
z −76 .. −92, stays open; recorded in each one's `disputes` as a reconstruction);
`lishkas_haetz.position` x −78.5 -> −75.5, z −118 -> −133, `geometry` w 10 -> 16, d 32 -> 30
(behind the Gazis per Abba Shaul, Middot 5:4: the next room west in the band of the Gazis'
chol half and the Cheil, with a door from the Gazis); `lishkas_palhedrin.position` y 2.5 ->
−13.5, z −30 -> −29, `geometry.h` 10 -> 22 (floor at the Cheil level, door to the Cheil,
internal stair and a second door into the Water Gate passage, Yoma 19a; reconstruction);
`beis_avtinas.geometry.stair` added ("internal, from the court beside the Korban gate");
`ezras_nashim_balcony.position.z` 137 -> 139 (on the gallery floor). `src/content/index.js`
flattens `children` into `entries`/`byId` with `parent` set (test: `lishkas_telaei_korban`).

Builders: the Duchan flight and platform stop 12 amos short of the south wall and of the
Beis HaMoked's face (x −55.5 .. 40.5); beside its ends the Kohanim floor runs east to the
Water Gate's and the Beis HaMoked gate's frontage (both gateways are at the Kohanim level,
2.5) and five half-amah steps drop to the Ezras Yisrael, so both gates open onto flat
court. Palhedrin is built at the Cheil level (the Cheil pavement is its floor) with two
flights of sixteen half-amah steps to a landing at 2.5 and a door into a 4-amah bay of the
Water Gate passage cut through the wall west of the gate's south reveal, so the chamber
connects the Cheil to the court. Beis Avtinas gets a stair tower east of the storey
(x 61.5 .. 73.5, z −51 .. −42, sharing the storey's east wall): four flights of ten
half-amah steps with half-amah treads (the plan's "20 half-amah steps, 1-amah treads"
would rise only 10 amos; the storey is 20 up over the 20-amah gate, and 1-amah treads do
not fit between the gates), a door from the court on its east face and a door into the
storey at the top. Lishkas HaEtz is built west of the Gazis with the door between them in
the middle of the wall's thickness (x −70.5); the Gazis' chol door to the Cheil, 16 amos
above the Cheil, is kept closed. The klei-shir doors and the northern lishkos follow the
JSON. CharacterSystem: doves orbit their spawn point (baseX/baseZ; the code used baseY
for x). Routes added: `azarah_palhedrin`, `azarah_avtinas`, `azarah_etz`;
`lishkos_klei_shir` rewritten from the open court; `azarah_gazis`, `azarah_yisrael`,
`azarah_slaughter`, `azarah_gates_north`, `azarah_west`, `azarah_northern_lishkos` and
`ezras_nashim_balcony` adjusted where entries moved or the tower now stands.

### 2026-09-04 — builder follow-through

Builder adjustments made so the geometry follows the JSON: Beis Avtinas door/corbels are
side-aware and its mikveh moved to the wall top over the Water Gate; the Beis HaMoked
flight is built only if the hall lies below the court; the Ulam steps group 4-4-4 with a
top rovad; the ta storey height is read from `geometry.h`; Yachin/Boaz use their content z;
the Aron's keruvim stand at the ends of its long (north-south) side. Two test waypoints
moved with the entries (Beis HaMoked hall level; Lishkas HaEtz west wall).

### Round 3 (September 2026) — content positions, builders, tour stops

Content (`id.field old -> new`), with the reasoning:

- `beis_avtinas.position.y` 22.5 -> 24. Shaar HaKorban is 20 high (Middot 2:3) from the
  Ezras Kohanim floor (2.5), so its opening tops out at 22.5; the gate frame's lintel takes
  an amah more and the storey's 0.8-amah floor slab has to sit on that. At 22.5 the
  `frameTop` cap fell below the gate's top and `buildNorthWall` dropped the lintel; the
  cap (the slab's underside, 23.2) is now above it and the lintel is built again. The
  stair tower's four flights keep half-amah risers (the Cheil steps' profile, Middot 2:3)
  and are 11, 11, 11 and 10 steps (43, 21.5 amos) instead of 4 × 10. Notes updated;
  `CourtBuilders.test.js` probes the storey interior at y 25, asserts the lintel top at
  23.2 and the wall under the slab; `AzarahRoutes.test.js` reads the landing height from
  the JSON.
- `slaughter_tables.position.z` / `hanging_pillars.position.z` -38 -> -39 (tables z -27 ..
  -51, pillars -28 .. -49). Beis HaMoked's south-west corner is at z -26 (its 24-amah
  depth from z -2, chosen so the hall does not reach the pillars, Middot 5:2); at -38 the
  first table and pillar stood half an amah from it. `buildSlaughterArea` spread both rows
  over the rings' z range; it now centres each on its own `position.z` (same 24-amah
  length). `azarah_slaughter`, `azarah_hug_altar` and `azarah_hug_north` thread the new
  first gaps (z -30 between the tables, -29.5 between the pillars).
- `kiyor.position.x` -22 -> -24. Middot 3:6 draws the laver toward the south so that it
  does not stand between the altar and the Ulam entrance; its 3-amah body (x -25.5 ..
  -22.5) now stands an amah clear of the Ulam steps' south end at x -20 instead of
  touching it. The muchni stays on its south side (KeilimBuilder). `azarah_hug_altar` now
  loops all four sides; `azarah_hug_building` passes the post at x -27.6; `keilim` in
  building.mjs is relative and unchanged; the Tour router's `south_lane` comment follows.
- `soreg.position.z` 158 -> 157: the note and `meta.zLayout` say 157 (the Cheil's 10
  amos beyond the Ezras Nashim wall at 147, Middot 2:3). `HarHaBayisBuilder.ring` had
  subtracted the amah back out (`position.z - 1`); it now reads `position.z`, so the
  built ring does not move.
- `outside.position.y` -19.5 -> -13.5. The ground outside is drawn flush with the mount
  at the Har HaBayis level; the drop from the mount to the streets is not given in Middot
  and is not modelled, so the hotspot no longer sits 6 amos under the ground that is
  built. `outside.bounds` untouched (edited separately).
- `lishkas_hamadichin.geometry.w` 16 -> 15 (x 52.5 .. 67.5). Middot 5:3 gives the three
  northern chambers no size; an amah off the Madichin makes the slot between its court
  face and the Ulam's north wing (x 50) 2.5 amos instead of 1.5, wide enough to walk
  without hugging. The stair well is placed from the room's wall side and is unchanged;
  the terrace parapet now follows each roof's own court edge with a return across the
  step at z -108 (the west-end parapet spans the Melach's full width, which the old
  Madichin-based extent left an amah short). `azarah_hug_north` and `azarah_hug_terrace`
  re-derived; `AzarahRoutes.test.js` probes the stepped parapet.
- `tours/tamid.json` stop 9 `camera` (-52, -52) -> (-55, -53.5) and stop 13 `offset.dz`
  3.75 -> 5.5 m: each camera moved 3.4-3.5 amos back along its look direction so the
  kevesh's west half and the Duchan flight fill the frame instead of crowding it. Every
  stop was probed with `floorAt`/`insideSolid` (all on their floors, none in a solid) and
  the 8 -> 9 and 12 -> 13 transitions were driven with the real renderer (both routed).

Checked and left alone: `beis_hamoked` / `lishkas_hagazis` and their builder functions
(stairs being added concurrently); `outside.bounds`; `scripts/walk-routes/har_habayis.mjs`.

Verification: `npm run lint` (one pre-existing warning in BaseBuilder.js), 212 tests,
`npm run build`, 196 refs verified; walked `azarah_slaughter`, `azarah_hug_altar`,
`azarah_hug_north`, `azarah_northern_lishkos`, `azarah_hug_terrace`, `azarah_avtinas`,
`azarah_hug_avtinas`, `azarah_hug_building`, `azarah_gates_north`, `azarah_kohanim`,
`keilim`, `ladder`, `around_building`, `cheil`, `cheil_ring`, `soreg_openings`,
`har_habayis_gates` (one flaky `cheil_ring` step at the foot of the twelve steps in the
long batch; the route passes alone on this build and on master). Screenshots
`altar_fire`, `mizbeach_kevesh`, `tour_9`, `tour_13` plus ad-hoc views of the kiyor, the
tables, the storey over the Korban gate and the terrace parapet.
