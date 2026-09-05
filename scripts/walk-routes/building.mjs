const at = (id, o = {}) => ({ id, ...o });

// dx/dz are METRES in the scene frame (+x north, +z east). Walks are straight lines
// between waypoints, so route through doors and openings explicitly.
//
// Handy conversions (1 amah = 0.5 m): the court strips beside the building are
// x +-35 .. +-67.5 amos = +-17.5 .. +-33.75 m; beside the Ulam wings (x +-55) only
// +-27.5 .. +-33.75 m. The building's back wall is at z -176 (-80 m), the west wall of
// the Azarah at z -187 (-85.5 m). Waypoints on the altar are given as offsets from
// `mizbeach` (its centre): the base is 32 x 32 (+-8 m), the sovev ledge x/z +-14.5
// amos (+-7.25 m), the yesod +-15.5 amos (+-7.75 m).
const K = 'azaras_kohanim';
const U = 'ulam';
const H = 'heichal';
const KHK = 'kodesh_hakodashim';

export const routes = {
  // The main ladder: Har HaBayis -> Cheil steps -> Ezras Nashim -> 15 steps -> Nicanor -> Duchan
  // -> Kohanim court -> altar ramp -> back down -> Ulam steps -> Ulam -> Heichal -> KHK
  ladder: [
    at('ezras_nashim_gate', { dz: 14, level: 'har_habayis' }),
    at('cheil_steps', { dz: 5, level: 'har_habayis' }),
    at('cheil_steps', { dz: -5, level: 'ezras_nashim' }),
    at('ezras_nashim_gate', { dz: -6, level: 'ezras_nashim' }),
    at('ezras_nashim', { level: 'ezras_nashim' }),
    at('maalos_shir', { dz: 8, level: 'ezras_nashim' }),
    at('nicanor_gate', { dz: 1.5, level: 'azaras_yisrael' }),
    at('nicanor_gate', { dz: -4, level: 'azaras_yisrael' }),
    at('duchan', { dz: 2, level: 'azaras_yisrael' }),
    at('duchan', { dz: -3, level: K }),
    at('mizbeach', { dz: 12, level: K }),
    at('kevesh', { dx: -10, dz: 0, level: K }), // foot of the ramp (south end)
    at('kevesh', { dx: 6, dz: 0, level: K, minY: 3 }), // up the ramp
    at('kevesh', { dx: -10, dz: 0, level: K }),
    at('kiyor', { dz: 3, level: K }),
    // The flight's foot (z -54) meets the altar's west face, so the flight is entered
    // round its south-east corner and along the first tread.
    at('maalos_ulam', { dx: -11, dz: 5.4, level: K }), // x -22, z -54.2: the court at the corner
    at('maalos_ulam', { dz: 5.2, level: K }), // x 0 on the first tread
    at('maalos_ulam', { dz: -7, level: U }),
    at('ulam', { level: U }),
    at('pesach_haheichal', { dz: 2, level: U }),
    at('heichal', { dz: 6, level: H }),
    at('mizbeach_hazahav', { dx: 1, dz: 3, level: H }),
    at('paroches', { dx: 1, dz: 2, level: H }), // past the golden altar on its north side
    at('even_hashtiya', { dz: 3, level: KHK }),
  ],

  // The Kohanim-level strips beside the building. The three northern lishkos
  // (z -92 .. -140; the Madichin x 52.5 .. 67.5, the other two from x 51.5) leave only a
  // 2.5-amah slot past the Ulam's north wing (x 50, z -76 .. -92), so the north strip
  // behind the wing is reached the long way: the pocket beside the north wing, across in front of the flight, down the south
  // strip past Lishkas HaGazis (x -57.5) and HaGolah (x -51.5), round the back of the
  // Kodesh HaKodashim and up the north strip to the back of the north wing.
  around_building: [
    at('maalos_ulam', { dx: 22, dz: 0, level: K }), // x 44, z -65: beside the flight
    at('maalos_ulam', { dx: 22, dz: 5, level: K }), // z -55, just west of the altar face
    at('ulam', { dx: 30.5, dz: 4, level: K }), // x 61, beside the north wing
    at('ulam', { dx: 30.5, dz: 1, level: K }), // z -84.5, the pocket before Lishkas HaMadichin (z -88)
    at('ulam', { dx: 26, dz: 4, level: K }), // x 52, hugging the wing's end wall (x 50)
    at('maalos_ulam', { dx: 22, dz: -4, level: K }), // x 44, z -73: in front of the wing
    at('maalos_ulam', { dx: 22, dz: 5.2, level: K }),
    at('maalos_ulam', { dx: -22, dz: 5.2, level: K }), // across the flight's first tread (its foot meets the altar's face)
    at('maalos_ulam', { dx: -22, dz: -4, level: K }), // in front of the south wing
    at('ulam', { dx: -30.5, dz: 4, level: K }), // x -61, beside the south wing
    at('ulam', { dx: -27, dz: -4, level: K }), // x -54, z -94.5: between the wing (x -50) and Gazis (x -57.5)
    at('heichal', { dx: -22, dz: 0, level: K }), // x -44, z -118: the south strip
    at('heichal', { dx: -18, dz: -6, level: K }), // x -36, z -130: hugging the building's south wall
    at('kodesh_hakodashim', { dx: -22, dz: -8, level: K }), // x -44, z -165
    at('kodesh_hakodashim', { dx: -32, dz: -14, level: K }), // x -64, z -177: behind, at the south wall
    at('kodesh_hakodashim', { dx: -19, dz: -12, level: K }), // x -38, z -173: the building's back corner
    at('kodesh_hakodashim', { dx: -19, dz: -16, level: K }), // round the corner (back wall z -176)
    at('kodesh_hakodashim', { dx: 0, dz: -15, level: K }), // z -179, behind the Kodesh HaKodashim
    at('kodesh_hakodashim', { dx: 0, dz: -18.5, level: K }), // z -186, at the west wall
    at('kodesh_hakodashim', { dx: 19, dz: -16, level: K }),
    at('kodesh_hakodashim', { dx: 19, dz: -12, level: K }), // x 38, z -173
    at('kodesh_hakodashim', { dx: 32, dz: -14, level: K }), // x 64, z -177: behind, at the north wall
    at('kodesh_hakodashim', { dx: 22, dz: -8, level: K }), // x 44, z -165: the north strip
    at('heichal', { dx: 18, dz: -6, level: K }), // x 36, z -130: hugging the building's north wall
    at('heichal', { dx: 22, dz: 0, level: K }), // x 44, z -118
    at('ulam', { dx: 22, dz: -6, level: K }), // x 44, z -98.5
    at('ulam', { dx: 19, dz: -3.6, level: K }), // x 38, z -93.7: the corner behind the north wing (z -92)
  ],

  // The 12 Ulam steps from both edges of the flight, the Ulam end to end along its
  // back wall, the Heichal doorway, both side walls of the Heichal, between the two
  // parochos into the Kodesh HaKodashim and around the Even HaShtiya.
  ulam_heichal: [
    at('maalos_ulam', { dx: 9, dz: 7, level: K }), // x 18, in front of the flight's north edge
    at('maalos_ulam', { dx: 9, dz: -5, level: U }), // up the north edge to the top rovad
    at('maalos_ulam', { dx: -9, dz: -5, level: U }), // across the top rovad
    at('maalos_ulam', { dx: -9, dz: 7, level: K }), // down the south edge
    at('maalos_ulam', { dx: 0, dz: -5, level: U }), // up the middle
    at('ulam', { level: U }), // through the 20-amah opening
    at('ulam', { dx: 22, dz: 0, level: U }), // north end (x 44; the end wall's face is at x 45)
    at('ulam', { dx: 22, dz: -2.4, level: U }), // into the corner against the Heichal wall (z -92, 0.35 m off)
    at('ulam', { dx: -22, dz: -2.4, level: U }), // along the back wall to the south end
    at('ulam', { dx: -22, dz: 2.4, level: U }), // south end against the front wall (z -81)
    at('ulam', { dx: 0, dz: 0, level: U }),
    at('pesach_haheichal', { level: H }),
    // Along the side walls (faces at x +-5): the shulchan and menorah leave under 0.3 m of
    // play between themselves and the wall, so reach each corner closely and let the wall
    // itself hold the walker on its line.
    at('heichal', { dx: 4.65, dz: 9, level: H, reach: 0.25 }), // north wall, east end
    at('heichal', { dx: 4.65, dz: -9, level: H, reach: 0.25 }), // north wall, west end (past the shulchan)
    at('heichal', { dx: -4.65, dz: -9, level: H, reach: 0.25 }), // south wall, west end
    at('heichal', { dx: -4.65, dz: 9, level: H, reach: 0.25 }), // south wall, east end (past the menorah)
    at('paroches', { dz: 1.5, level: H }),
    at('amah_traksin', { level: H }), // between the two curtains
    at('even_hashtiya', { dz: 3, level: KHK }),
    at('even_hashtiya', { dx: 2, dz: 0, level: KHK }),
    at('even_hashtiya', { dx: 0, dz: -2, level: KHK }),
    at('even_hashtiya', { dx: -2, dz: 0, level: KHK }),
    at('even_hashtiya', { dx: 0, dz: 2, level: KHK }),
    at('even_hashtiya', { dx: 0, dz: 0, level: KHK, minY: 0 }), // onto the stone itself
    at('kodesh_hakodashim', { dx: -4.6, dz: -4.6, level: KHK }), // south-west corner of the room
    at('paroches', { dz: 1.5, level: H }),
  ],

  // The altar: up the kevesh to the ma'aracha, around the top, back down to the eastern
  // small ramp, along the sovev ledge all the way round, back to the kevesh, down to the
  // western small ramp, along the south face to the yesod, around the yesod (north and
  // west faces), off at the north-east corner and along the east face on the court to
  // the yesod-less south-east corner.
  altar: [
    at('kevesh', { dx: -13, dz: 0, level: K }), // x -57, on the court south of the foot (x -46)
    at('kevesh', { dx: -7.5, dz: 0, level: K }), // x -46, the foot of the ramp
    at('kevesh', { dx: 0, dz: 0, level: K, minY: 2 }), // x -31, 4.2 amos up
    at('kevesh', { dx: 7, dz: 0, level: K, minY: 4 }), // x -17, near the top
    at('mizbeach', { dx: -6, dz: 0, level: K, minY: 4.5 }), // on the ma'aracha tier (9 amos)
    at('mizbeach', { dx: 6, dz: 6, level: K, minY: 4.5 }),
    at('mizbeach', { dx: 6, dz: -6, level: K, minY: 4.5 }),
    at('mizbeach', { dx: -6, dz: -6, level: K, minY: 4.5 }),
    at('kevesh', { dx: 7, dz: 0, level: K, minY: 4 }), // back onto the kevesh
    at('kevesh', { dx: 3.5, dz: 0, level: K, minY: 3 }), // x -24, where the kevesh is 6 high
    at('kevesh_katan_east', { dx: -2, dz: 0, level: K, minY: 3 }), // onto the eastern small ramp (6 amos)
    at('kevesh_katan_east', { dx: 2, dz: 0, level: K, minY: 3, reach: 0.5 }), // its end at the sovev (x -16)
    // The sovev ledge is one amah (0.5 m) wide with the ma'aracha tier rising beside it:
    // after each corner a short "settle" leg pulls the walker onto the next side's
    // centreline before the long run (a long leg would only creep sideways).
    at('mizbeach', { dx: -7.25, dz: 4.5, level: K, minY: 3, reach: 0.5 }), // sovev ledge, south side
    at('mizbeach', { dx: -7.25, dz: 7.25, level: K, minY: 3, reach: 0.5 }), // south-east corner of the ledge
    at('mizbeach', { dx: -6.6, dz: 7.25, level: K, minY: 3, reach: 0.3 }),
    at('mizbeach', { dx: 7.25, dz: 7.25, level: K, minY: 3, reach: 0.5 }), // north-east
    at('mizbeach', { dx: 7.25, dz: 6.6, level: K, minY: 3, reach: 0.3 }),
    at('mizbeach', { dx: 7.25, dz: -7.25, level: K, minY: 3, reach: 0.5 }), // north-west
    at('mizbeach', { dx: 6.6, dz: -7.25, level: K, minY: 3, reach: 0.3 }),
    at('mizbeach', { dx: -7.25, dz: -7.25, level: K, minY: 3, reach: 0.5 }), // south-west
    at('mizbeach', { dx: -7.25, dz: -6.6, level: K, minY: 3, reach: 0.3 }),
    at('mizbeach', { dx: -7.25, dz: 4.5, level: K, minY: 3, reach: 0.5 }), // back along the south side, under the kevesh
    at('kevesh_katan_east', { dx: 2, dz: 0, level: K, minY: 3, reach: 0.5 }),
    at('kevesh_katan_east', { dx: -2.2, dz: 0, level: K, minY: 3 }), // west end of the walkway (x -24.4)
    at('kevesh', { dx: 3, dz: 0, level: K, minY: 3 }), // back onto the kevesh (x -25)
    at('kevesh', { dx: -7.5, dz: 0, level: K }), // down to the foot
    at('kevesh_katan_west', { dx: -10, dz: 0, level: K, minY: 0.95, reach: 0.5 }), // onto the western small ramp (1 amah), x -40
    at('kevesh_katan_west', { dx: 1.5, dz: 0, level: K, minY: 0.95, reach: 0.5 }), // along it to the altar's south face (x -17)
    at('mizbeach', { dx: -8.5, dz: -7.75, level: K, minY: 0.95, reach: 0.5 }), // along the south face to the SW corner
    // The yesod is one amah wide too, with the sovev rising beside it
    at('mizbeach', { dx: -7.75, dz: -7.75, level: K, minY: 0.95, reach: 0.5 }), // yesod, south-west corner
    at('mizbeach', { dx: -7.1, dz: -7.75, level: K, minY: 0.95, reach: 0.3 }),
    at('mizbeach', { dx: 7.75, dz: -7.75, level: K, minY: 0.95, reach: 0.5 }), // yesod, north-west corner
    at('mizbeach', { dx: 7.75, dz: -7.1, level: K, minY: 0.95, reach: 0.3 }),
    at('mizbeach', { dx: 7.75, dz: 7.75, level: K, minY: 0.95, reach: 0.5 }), // yesod, north-east corner
    at('mizbeach', { dx: 8.75, dz: 8.75, level: K }), // off onto the court
    at('mizbeach', { dx: -8.75, dz: 8.75, level: K }), // along the east face on the court
    at('mizbeach', { dx: -7.75, dz: 7.75, level: K, reach: 0.5 }), // the south-east corner: no yesod, court level
    at('kevesh_katan_east', { dx: 0, dz: 2, level: K }), // away to the east of the kevesh
  ],

  // The kiyor and the Heichal vessels are solid: go around each, hugging it.
  keilim: [
    // The kiyor's centre is 4 amos south of the Ulam steps' end (x -20; its body reaches
    // x -22.5); the muchni post is on its south side (1.3 m out), so it is passed on the
    // south side of the post: slide round and back.
    at('kiyor', { dz: 3, level: K }),
    at('kiyor', { dx: -2.4, dz: -3, level: K }), // clear of the muchni post
    at('kiyor', { dx: -3.4, dz: 0, level: K }),
    at('kiyor', { dx: -2.4, dz: 3, level: K }), // and back
    at('maalos_ulam', { dx: -11, dz: 5.4, level: K }),
    at('maalos_ulam', { dz: 5.2, level: K }), // the first tread
    at('maalos_ulam', { dz: -7, level: U }),
    at('ulam', { level: U }),
    at('pesach_haheichal', { level: H }),
    at('mizbeach_hazahav', { dx: 0.6, dz: 2, level: H }),
    at('mizbeach_hazahav', { dx: -0.6, dz: -2, level: H }), // around the golden altar
    at('menorah', { dx: 0.7, dz: 1.5, level: H }),
    at('menorah', { dx: -0.7, dz: -1.5, level: H }), // around the menorah
    at('shulchan', { dx: -0.5, dz: -1.5, level: H }),
    at('shulchan', { dx: 0.5, dz: 1.5, level: H }), // around the table
    at('mizbeach_hazahav', { dz: 3, level: H }),
  ],
};
