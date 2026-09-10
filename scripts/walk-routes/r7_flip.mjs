import { AMAH, NICANOR_Z } from '../../src/content/units.js';

const at = (id, o = {}) => ({ id, ...o });
/** A point given in amos in the azarah frame (+x north, -z west), with the expected floor level. */
const p = (x, z, level, o = {}) => ({ x: x * AMAH, z: NICANOR_Z + z * AMAH, level, ...o });

const K = 'azaras_kohanim';
const C = 'cheil';
const KHK = 'kodesh_hakodashim';
/** A wall, a parapet or a mass: the leg must end against it (result "stuck"), never over or through it. */
const blocked = { expect: 'blocked', reach: 0.3 };
const CHEIL_Y = -13.5;
const K_Y = 2.5;
/** Metres over the Cheil level of a height `y` amos over the Azarah floor (walk.mjs minY: feet >= level + minY - 0.5 m). */
const upC = (y) => (y - CHEIL_Y) * AMAH;
/** Metres over the Ezras Kohanim floor of a height `y` amos over the Azarah floor. */
const upK = (y) => (y - K_Y) * AMAH;
/** A tread or landing of the Avtinas tower whose top is `y` amos over the Azarah floor. */
const tower = (x, z, y) => p(x, z, K, { reach: 0.4, minY: upK(y) });
/** A blocked leg from such a surface: the feet stay up there. */
const towerWall = (x, z, y) => p(x, z, K, { ...blocked, minY: upK(y) });
/** A tread or landing of Palhedrin's stair whose top is `y` amos over the Azarah floor. */
const pal = (x, z, y) => p(x, z, C, { reach: 0.4, minY: upC(y) });
const palWall = (x, z, y) => p(x, z, C, { ...blocked, minY: upC(y) });
/** A point in the Beis Avtinas storey (21.5 amos over the court). */
const S = (x, z, o = {}) => p(x, z, K, { reach: 0.4, minY: 10, ...o });

/**
 * Round 7 walker: the flipped chambers as a visitor meets them. Beis Avtinas is the
 * storey over Shaar HaMayim (x -73.5 .. -61.5, z -24 .. -8, floor y 24) with its stair
 * tower west of it in the court (x -73.5 .. -61.5, z -32 .. -23): the court door in the
 * tower's west face (x -65 .. -62.5, z -32), four flights of half-amah steps along x in
 * 1.75-amah bands from the door end (11, 11, 11, 10), landings at alternate ends (the
 * wall end x -72.5 .. -70 at 8.05 and 19.05; the court end x -65 .. -62.5 at 13.55 and
 * 24.05), band walls between the flights stopping an amah short of the landing that
 * joins them, and the storey door in the shared wall at the top. Lishkas Palhedrin is
 * the chamber in the north Cheil west of Shaar HaKorban (x 73.5 .. 81, z -79 .. -63):
 * the Cheil door 2.5 x 6 in its east face at x 78.5, the entry strip x 77 .. 80, z -67 ..
 * -64, the lower flight (x 77 .. 80) west to the turn landing (z -78 .. -75, 8 amos up),
 * the upper flight (x 73.5 .. 76.5) back east to the top landing (z -67 .. -64) at the
 * court level, and the bay through the wall (z -67 .. -64) into the Korban gate passage.
 * The Cheil lane along the Soreg (x 81 .. 83.5) runs past it. minY is metres over the
 * leg's level (walk.mjs: feet >= level + minY - 0.5 m).
 */
export const routes = {
  // From the court beside the tower through its door, up the four flights to the storey,
  // once round the storey's floor, and back down to the court.
  r7f_court_to_avtinas_storey: [
    p(-55, -45, K),
    p(-63.75, -38, K),
    p(-63.75, -30.1, K, { reach: 0.4 }), // inside the court door (x -65 .. -62.5), on the tower floor
    tower(-67.5, -30.1, 5), // the first flight, half-way up (its treads rise from 3.05 to 8.05)
    tower(-71.25, -29.25, 8.05), // the first landing, at the wall end
    tower(-67.5, -28.4, 10.5),
    tower(-63.75, -27.5, 13.55), // the second landing, at the court end
    tower(-67.5, -26.6, 16),
    tower(-71.25, -25.75, 19.05), // the third landing
    tower(-67.5, -24.9, 21.5),
    tower(-63.75, -24.9, 24.05), // the top landing
    S(-63.75, -21), // through the storey door (x -65 .. -62.5, z -24 .. -23)
    at('beis_avtinas', { level: K, minY: 10 }),
    S(-63.3, -9.8), // the north-east corner (interior x -72.5 .. -62.5, z -23 .. -9)
    S(-71.7, -9.8),
    S(-71.7, -22.2),
    S(-63.3, -22.2),
    S(-63.75, -21),
    tower(-63.75, -24.9, 24.05),
    tower(-67.5, -24.9, 21.5),
    tower(-71.25, -25.75, 19.05),
    tower(-67.5, -26.6, 16),
    tower(-63.75, -27.5, 13.55),
    tower(-67.5, -28.4, 10.5),
    tower(-71.25, -29.25, 8.05),
    tower(-67.5, -30.1, 5),
    p(-63.75, -30.1, K, { reach: 0.4 }),
    p(-63.75, -38, K),
    p(-55, -45, K),
  ],

  // The Cheil from Shaar HaNashim's front west along the lane to Palhedrin's Cheil door,
  // up its two flights, through the bay into the Korban gate passage and out into the
  // court, then back the same way to the Cheil.
  r7f_cheil_to_palhedrin_to_court: [
    p(78.5, -36, C), // Shaar HaNashim's front
    p(80, -40, C, { reach: 0.4 }),
    p(82.4, -41, C, { reach: 0.4 }), // the lane past the bath-house (x to 81.5)
    p(82.4, -53.5, C, { reach: 0.4 }),
    p(78.5, -58, C), // Shaar HaKorban's front
    p(78.5, -61.5, C, { reach: 0.4 }), // before the Cheil door (x 77.25 .. 79.75 in the face z -63)
    p(78.5, -65.5, C, { reach: 0.4 }), // the entry strip
    pal(78.5, -68.25, -12.5), // the lower flight (16 half-amah rises from -13.5)
    pal(78.5, -72.25, -8.5),
    pal(78.5, -76.5, -5.5), // the turn landing (z -78 .. -75)
    pal(75, -76.5, -5.5),
    pal(75, -72.25, -2.5), // the upper flight
    pal(75, -68.25, 1.5),
    p(75, -65.5, K, { reach: 0.4 }), // the top landing, at the court level
    p(70.5, -65.5, K, { reach: 0.4 }), // the bay through the wall (z -67 .. -64)
    p(64, -65.5, K, { reach: 0.4 }), // the Korban gate passage
    p(58, -62, K), // the court
    p(64, -65.5, K, { reach: 0.4 }),
    p(70.5, -65.5, K, { reach: 0.4 }),
    p(75, -65.5, K, { reach: 0.4 }),
    pal(75, -68.25, 1.5),
    pal(75, -72.25, -2.5),
    pal(75, -76.5, -5.5),
    pal(78.5, -76.5, -5.5),
    pal(78.5, -72.25, -8.5),
    pal(78.5, -68.25, -12.5),
    p(78.5, -65.5, C, { reach: 0.4 }),
    p(78.5, -61.5, C, { reach: 0.4 }),
    p(78.5, -58, C),
  ],

  // The Cheil lane along the Soreg from the bath-house (z -52 .. -42) past Shaar HaKorban's
  // front, Palhedrin (z -79 .. -63) and the Nitzotz tower (z -99 .. -83) to the Cheil beyond,
  // and back; then into Palhedrin's north face and the tower's from the lane.
  r7f_cheil_lane_bath_to_nitzotz: [
    p(78.5, -36, C),
    p(80, -40, C, { reach: 0.4 }),
    p(82.4, -41, C, { reach: 0.4 }),
    p(82.4, -53.5, C, { reach: 0.4 }),
    p(82.4, -60, C, { reach: 0.4 }),
    p(82.4, -82, C, { reach: 0.4 }), // past Palhedrin (x to 81)
    p(82.4, -100.5, C, { reach: 0.4 }), // past the Nitzotz tower (x to 81)
    p(78.5, -104, C),
    p(76, -110, C),
    p(78.5, -104, C),
    p(82.4, -100.5, C, { reach: 0.4 }),
    p(82.4, -82, C, { reach: 0.4 }),
    p(82.4, -70, C, { reach: 0.4 }),
    p(78, -70, C, blocked), // Palhedrin's north wall (x 80 .. 81)
    p(82.4, -70, C, { reach: 0.4 }),
    p(82.4, -60, C, { reach: 0.4 }),
    p(78.5, -58, C),
    p(75, -58, C, { reach: 0.4 }),
    p(75, -66, C, blocked), // Palhedrin's east wall beside the door (z -64 .. -63)
    p(75, -58, C, { reach: 0.4 }),
    p(82.4, -53.5, C, { reach: 0.4 }),
    p(82.4, -41, C, { reach: 0.4 }),
    p(80, -40, C, { reach: 0.4 }),
    p(78.5, -36, C),
  ],

  // What stops a visitor in the Avtinas tower and storey: the band walls between the
  // flights from every landing and flight, the tower's walls, and the storey's four walls.
  r7f_avtinas_blocked: [
    p(-55, -45, K),
    p(-58, -30, K),
    p(-63, -30, K, blocked), // the tower's east wall from the court (x -62.5 .. -61.5)
    p(-58, -30, K),
    p(-63.75, -38, K),
    p(-63.75, -30.1, K, { reach: 0.4 }),
    tower(-67.5, -30.1, 5),
    towerWall(-67.5, -25, 4.5), // the first flight into the band wall at z -29.25 (x -69 .. -62.5)
    tower(-71.25, -29.25, 8.05),
    towerWall(-71.25, -24, 8.05), // the first landing into the band wall at z -27.5 (x -72.5 .. -66)
    towerWall(-75, -29.25, 8.05), // and into the tower's west wall
    tower(-67.5, -28.4, 10.5),
    towerWall(-67.5, -33, 10), // the second flight into the band wall at z -29.25
    towerWall(-67.5, -23, 10), // and into the band wall at z -27.5
    tower(-63.75, -27.5, 13.55),
    towerWall(-63.75, -33, 13.55), // the second landing into the band wall at z -29.25
    towerWall(-63.75, -22, 13.55), // and into the band wall at z -25.75 (x -69 .. -62.5)
    towerWall(-59, -27.5, 13.55), // and into the tower's east wall
    tower(-67.5, -26.6, 16),
    towerWall(-67.5, -31, 15.5), // the third flight into the band wall at z -27.5
    towerWall(-67.5, -21, 15.5), // and into the band wall at z -25.75
    tower(-71.25, -25.75, 19.05),
    towerWall(-71.25, -31, 19.05), // the third landing into the band wall at z -27.5
    towerWall(-71.25, -20, 19.05), // and into the tower's wall toward the storey (z -24 .. -23)
    tower(-67.5, -24.9, 21.5),
    towerWall(-67.5, -29, 21), // the top flight into the band wall at z -25.75
    tower(-63.75, -24.9, 24.05),
    towerWall(-63.75, -29, 24.05), // the top landing into the band wall at z -25.75
    towerWall(-59, -24.9, 24.05), // and into the tower's east wall
    S(-63.75, -21),
    at('beis_avtinas', { level: K, minY: 10 }),
    S(-58, -14, blocked), // the storey's north wall (x -62.5 .. -61.5)
    at('beis_avtinas', { level: K, minY: 10 }),
    S(-77, -14, blocked), // its south wall (x -73.5 .. -72.5), over the Cheil
    at('beis_avtinas', { level: K, minY: 10 }),
    S(-67.5, -4, blocked), // its east wall (z -9 .. -8)
    at('beis_avtinas', { level: K, minY: 10 }),
    S(-69, -27, blocked), // its west wall (z -24 .. -23) beside the door
    at('beis_avtinas', { level: K, minY: 10 }),
    S(-63.75, -21),
    tower(-63.75, -24.9, 24.05),
  ],

  // What stops a visitor in Lishkas Palhedrin: its walls from the Cheil, the wall between
  // the flights from every tread and landing, the turn landing's end wall, the top
  // landing's east wall, and the gate's jamb beside the bay.
  r7f_palhedrin_blocked: [
    p(78.5, -58, C),
    p(82.4, -60, C, { reach: 0.4 }),
    p(82.4, -82, C, { reach: 0.4 }), // the lane past Palhedrin
    p(77, -81, C, { reach: 0.4 }), // the Cheil between Palhedrin and the Nitzotz tower (z -83 .. -79)
    p(77, -76, C, blocked), // Palhedrin's west wall (z -79 .. -78)
    p(77, -81, C, { reach: 0.4 }),
    p(82.4, -82, C, { reach: 0.4 }),
    p(82.4, -60, C, { reach: 0.4 }),
    p(78.5, -58, C),
    p(78.5, -61.5, C, { reach: 0.4 }),
    p(78.5, -65.5, C, { reach: 0.4 }),
    p(83, -65.5, C, blocked), // the entry strip's north wall (x 80 .. 81)
    p(78.5, -65.5, C, { reach: 0.4 }),
    p(74, -65.5, C, blocked), // the wall between the flights (x 76.5 .. 77) and the top landing's side
    p(78.5, -65.5, C, { reach: 0.4 }),
    pal(78.5, -70.25, -10.5),
    palWall(74, -70.25, -11), // the lower flight into the wall between the flights
    palWall(83, -70.25, -11), // and into the north wall
    pal(78.5, -76.5, -5.5),
    palWall(78.5, -81, -5.5), // the turn landing's west wall
    palWall(83, -76.5, -5.5), // its north wall
    pal(75, -76.5, -5.5),
    palWall(71, -76.5, -5.5), // the court wall (x 67.5 .. 73.5)
    pal(75, -70.25, -0.5),
    palWall(79, -70.25, -1), // the upper flight into the wall between the flights
    palWall(71, -70.25, -1), // and into the court wall
    p(75, -65.5, K, { reach: 0.4 }),
    p(75, -60, K, { ...blocked, minY: 0 }), // the top landing's east wall (z -64 .. -63)
    p(79, -65.5, K, { ...blocked, minY: 0 }), // and the wall between the flights
    p(70.5, -65.5, K, { reach: 0.4 }),
    p(70.5, -60, K, { ...blocked, minY: 0 }), // the gate's west jamb beside the bay (z -64 .. -63)
    p(70.5, -70, K, { ...blocked, minY: 0 }), // the wall west of the bay
    p(64, -65.5, K, { reach: 0.4 }),
  ],

  // The Even HaShtiya (round 7: a bedrock outcrop, walkable): onto the stone and off it on
  // each of its four sides, and round the Kodesh HaKodashim's walls.
  r7f_khk_stone: [
    at('even_hashtiya', { dz: 3, level: KHK }),
    at('even_hashtiya', { level: KHK, minY: 0 }), // onto the stone from the east
    at('even_hashtiya', { dz: -3, level: KHK }), // off to the west
    at('even_hashtiya', { level: KHK, minY: 0 }),
    at('even_hashtiya', { dx: 3, level: KHK }), // off to the north
    at('even_hashtiya', { level: KHK, minY: 0 }),
    at('even_hashtiya', { dx: -3, level: KHK }), // off to the south
    at('even_hashtiya', { level: KHK, minY: 0 }),
    at('even_hashtiya', { dz: 3, level: KHK }), // off to the east
    at('kodesh_hakodashim', { dx: 4.6, dz: -4.6, level: KHK }), // the north-west corner
    at('kodesh_hakodashim', { dx: -4.6, dz: -4.6, level: KHK }),
    at('kodesh_hakodashim', { dx: -4.6, dz: 4.6, level: KHK }),
    at('even_hashtiya', { dz: 3, level: KHK }),
  ],

  // The kevesh with the kohen walker on it (round 7: he climbs the ramp on a looped path;
  // walkers are not colliders): up the ramp's centre line onto the altar top and back down.
  r7f_kevesh_with_kohen: [
    at('kevesh', { dx: -10, dz: 0, level: K }),
    at('kevesh', { dx: 0, dz: 0, level: K, minY: 1.5 }),
    at('kevesh', { dx: 6, dz: 0, level: K, minY: 3 }),
    at('mizbeach', { dx: -6, dz: 0, level: K, minY: 4.5 }), // the altar top
    at('kevesh', { dx: 6, dz: 0, level: K, minY: 3 }),
    at('kevesh', { dx: 0, dz: 0, level: K, minY: 1.5 }),
    at('kevesh', { dx: -10, dz: 0, level: K }),
  ],
};
