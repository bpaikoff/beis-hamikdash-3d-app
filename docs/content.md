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
  "children": [ { "id", "name", "desc", "position", "sources" } ],   // sub-rooms (Beis HaMoked)
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
  line; the two that stand wholly outside it (`lishkas_haetz`, `lishkas_palhedrin`) carry
  `outsideWall` and are 10 wide so they fill the Cheil strip exactly to its outer edge
  (x ±83.5, the Soreg line) and no further. Palhedrin is beside the Water Gate in the south
  and Beis Avtinas an upper storey on the north wall (Yoma 19a); the Kohen Gadol's first
  immersion was on the Water Gate's roof beside Palhedrin (Yoma 31a).
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
  Kohanim strip (z −11 .. −22), whose floor is at that level.
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

## Review log

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

Builder adjustments made so the geometry follows the JSON: Beis Avtinas door/corbels are
side-aware and its mikveh moved to the wall top over the Water Gate; the Beis HaMoked
flight is built only if the hall lies below the court; the Ulam steps group 4-4-4 with a
top rovad; the ta storey height is read from `geometry.h`; Yachin/Boaz use their content z;
the Aron's keruvim stand at the ends of its long (north-south) side. Two test waypoints
moved with the entries (Beis HaMoked hall level; Lishkas HaEtz west wall).
