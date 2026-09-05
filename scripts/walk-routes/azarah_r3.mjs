import { AMAH, NICANOR_Z } from '../../src/content/units.js';

const at = (id, o = {}) => ({ id, ...o });
/** A point given in amos in the azarah frame (+x north, -z west), with the expected floor level. */
const p = (x, z, level, o = {}) => ({ x: x * AMAH, z: NICANOR_Z + z * AMAH, level, ...o });

const K = 'azaras_kohanim';
const C = 'cheil';
/** A wall, a parapet or a mass: the leg must end against it (result "stuck"), never over or through it. */
const blocked = { expect: 'blocked', reach: 0.3 };
/** A tread or landing of a Cheil stair, `up` amos above the Cheil (walk.mjs: feet >= level + minY - 0.5 m). */
const step = (x, z, up) => p(x, z, C, { reach: 0.4, minY: up * AMAH });
/** Hug point: reached within 0.3 m. */
const h = (x, z, level, o = {}) => p(x, z, level, { reach: 0.3, ...o });
/** A point on the terrace over the northern lishkos (11 amos over the court). */
const T = { minY: 11 * AMAH };
/** A point in the Beis Avtinas storey or its tower's upper flights (10 m and more over the court). */
const S = (x, z, o = {}) => p(x, z, K, { reach: 0.4, minY: 10, ...o });

/**
 * Round 3 (September 2026) content round in the Azarah, walked as a visitor would:
 * the kiyor at x -24 and the lane between it and the Ulam steps' south end, every
 * gap between the slaughter tables (x 51.5 .. 52.5, z -27.5 .. -50.5) and between the
 * hanging pillars (x 57.5 .. 58.5, z -27.5 .. -49.5) now that they end at z -27.5
 * beside Beis HaMoked's corner (z -26), the Beis Avtinas storey at y 24 and its
 * 43-step tower, the 2.5-amah slot between the Ulam's north wing and the narrowed
 * Madichin (x 50 .. 52.5 at z -92), the terrace parapet's return at z -108, and the
 * two Cheil stairs (GEO-D) with a `blocked` leg into every open side of every flight
 * and landing, and the kodesh / chol line in both chambers.
 *
 * Masses (the kiyor, the tables, the pillars, parapets, steps) stop the player's
 * centre only; walls (room walls, the band walls of the stairs) stop the 0.3 m body.
 */
export const routes = {
  // (a) The kiyor (body x -25.6 .. -22.4, z -66.6 .. -63.4; the muchni post at x -26.55,
  // z -65) on all four sides, twice along the 2.4-amah lane between its body and the Ulam
  // steps' south end (x -20), and into it from each side, into the post, and into the
  // steps' south end from the lane.
  r3_kiyor: [
    p(-30, -58, K),
    h(-21.2, -58, K),
    h(-21.2, -70, K), // the lane between the body (x -22.4) and the steps' south end (x -20), east to west
    h(-28, -70, K),
    h(-28, -58, K), // past the post's south side (x -26.55)
    h(-21.2, -58, K),
    h(-21.2, -65, K),
    p(-24, -65, K, blocked), // into the body from the lane (east)
    h(-21.2, -65, K),
    p(-17, -65, K, blocked), // into the Ulam steps' south end from the lane (the rovad is 2 amos up)
    h(-21.2, -62.6, K),
    h(-28, -62.6, K), // the body's north face
    h(-28, -64, K),
    p(-24, -64, K, blocked), // into the body from the west, clear of the post
    h(-28, -64, K),
    h(-30, -65, K),
    p(-26.5, -65, K, blocked), // into the muchni post
    h(-30, -65, K),
    h(-28, -67.4, K),
    h(-21.2, -67.4, K), // the body's south face
    h(-24, -70, K),
    p(-24, -65, K, blocked), // into the body from the south
    h(-24, -70, K),
    h(-21.2, -70, K),
    h(-21.2, -58, K), // back up the lane
    p(-30, -58, K),
  ],

  // (b) Every gap between the eight tables (an amah wide, z -30, -33 .. -48), zigzagging
  // between the court (x 49) and the lane between the tables and the pillars (x 55).
  r3_table_gaps: [
    p(49, -24, K),
    h(49, -30, K),
    h(55, -30, K),
    h(55, -33, K),
    h(49, -33, K),
    h(49, -36, K),
    h(55, -36, K),
    h(55, -39, K),
    h(49, -39, K),
    h(49, -42, K),
    h(55, -42, K),
    h(55, -45, K),
    h(49, -45, K),
    h(49, -48, K),
    h(55, -48, K),
    h(55, -52, K), // past the last table (z -50.5)
    h(49, -52, K),
    h(49, -49.5, K),
    p(55, -49.5, K, blocked), // into the last table
    h(49, -52, K),
    h(49, -28.5, K),
    p(55, -28.5, K, blocked), // into the first table
    p(49, -24, K),
  ],

  // (c) Every gap between the eight pillars (two amos wide, z -29.5, -32.5 .. -47.5),
  // zigzagging between the lane (x 55) and the strip under the wall (x 60.5, clear of
  // the Beis Avtinas tower's wall at x 61.5 beside the last three), then the
  // hall's west face (z -26) hugged from the tables' column to the court wall and back,
  // and the lane between that face and the first table / first pillar (z -27.5).
  r3_pillar_gaps: [
    p(50, -24, K),
    h(55, -27, K),
    h(55, -29.5, K),
    h(60.5, -29.5, K),
    h(60.5, -32.5, K),
    h(55, -32.5, K),
    h(55, -35.5, K),
    h(60.5, -35.5, K),
    h(60.5, -38.5, K),
    h(55, -38.5, K),
    h(55, -41.5, K),
    h(60.5, -41.5, K),
    h(60.5, -44.5, K),
    h(55, -44.5, K),
    h(55, -47.5, K),
    h(60.5, -47.5, K),
    h(60.5, -51, K), // past the last pillar (z -49.5), beside the tower's south-west corner (x 61.5, z -51)
    h(55, -51, K),
    h(55, -49, K),
    p(61, -49, K, blocked), // into the last pillar
    h(55, -51, K),
    h(55, -28, K),
    p(61, -28, K, blocked), // into the first pillar
    h(55, -26.8, K),
    h(66.7, -26.8, K), // the hall's west face, to the court wall
    p(66.7, -23, K, blocked), // into the hall's west face
    h(66.7, -26.8, K),
    h(50, -26.8, K), // back along the face past the tables' end
    h(50, -24, K),
    p(55, -24, K, blocked), // into the hall's south face (x 52.5)
    p(50, -24, K),
  ],

  // (d) Beis Avtinas: up the tower's four flights (11, 11, 11, 10 half-amah steps) to
  // the storey 21.5 amos over the court, round the storey floor (x 62.5 .. 72.5,
  // z -65 .. -51) hugging its four walls, into each wall (the north wall stands over
  // the Cheil, 37 amos below), into the tower's outer walls from the top landing, and
  // down again.
  r3_avtinas_storey: [
    p(60, -30, K),
    p(63.75, -38, K),
    p(63.75, -43.9, K, { reach: 0.4 }),
    p(67.5, -43.9, K, { reach: 0.4, minY: 1 }),
    p(71.25, -44.75, K, { reach: 0.4, minY: 2.5 }),
    p(67.5, -45.6, K, { reach: 0.4, minY: 3.5 }),
    p(63.75, -46.5, K, { reach: 0.4, minY: 5 }),
    p(67.5, -47.4, K, { reach: 0.4, minY: 6 }),
    p(71.25, -48.25, K, { reach: 0.4, minY: 7.5 }),
    p(67.5, -49.1, K, { reach: 0.4, minY: 8.5 }),
    S(63.75, -49.1), // the top landing (x 62.5 .. 65, z -50 .. -48.25)
    S(63.75, -47, { ...blocked, minY: 8 }), // the band wall at z -48.25: beyond it the second landing lies 10.5 amos down
    S(63.75, -49.1),
    S(61, -49.1, blocked), // the tower's south wall
    S(63.75, -49.1),
    S(63.75, -53), // through the storey door (x 62.5 .. 65, z -51 .. -50)
    at('beis_avtinas', { level: K, minY: 10 }),
    S(61, -58, blocked), // the south wall (x 61.5 .. 62.5)
    at('beis_avtinas', { level: K, minY: 10 }),
    S(75, -58, blocked), // the north wall (x 72.5 .. 73.5), over the Cheil
    at('beis_avtinas', { level: K, minY: 10 }),
    S(67.5, -68, blocked), // the west wall (z -66 .. -65)
    at('beis_avtinas', { level: K, minY: 10 }),
    S(67.5, -48, blocked), // the east wall (z -51 .. -50) beside the door
    at('beis_avtinas', { level: K, minY: 10 }),
    S(63.3, -58),
    S(63.3, -64.2),
    S(71.7, -64.2),
    S(71.7, -51.8),
    S(63.3, -51.8),
    S(63.3, -58),
    at('beis_avtinas', { level: K, minY: 10 }),
    S(63.75, -53),
    S(63.75, -49.1),
    p(67.5, -49.1, K, { reach: 0.4, minY: 8.5 }),
    p(71.25, -48.25, K, { reach: 0.4, minY: 7.5 }),
    p(67.5, -47.4, K, { reach: 0.4, minY: 6 }),
    p(63.75, -46.5, K, { reach: 0.4, minY: 5 }),
    p(67.5, -45.6, K, { reach: 0.4, minY: 3.5 }),
    p(71.25, -44.75, K, { reach: 0.4, minY: 2.5 }),
    p(67.5, -43.9, K, { reach: 0.4, minY: 1 }),
    p(63.75, -43.9, K, { reach: 0.4 }),
    p(63.75, -38, K),
    p(60, -30, K),
  ],

  // (e) The 2.5-amah slot between the Ulam's north wing (x 35 .. 50, z -76 .. -92) and
  // the Madichin's court face (x 52.5, z -92 .. -108): from the pocket beside the wing
  // into the strip behind it and back, into the wing's end from the pocket and into
  // the Madichin's face from the strip.
  r3_madichin_slot: [
    p(60, -84, K),
    p(51.25, -88, K, { reach: 0.4 }),
    p(51.25, -94, K, { reach: 0.4 }),
    p(45, -100, K),
    p(51.25, -94, K, { reach: 0.4 }),
    p(51.25, -88, K, { reach: 0.4 }),
    p(60, -84, K),
    p(51.25, -85, K, { reach: 0.4 }),
    p(47, -85, K, blocked), // the wing's north face (x 50)
    p(51.25, -85, K, { reach: 0.4 }),
    p(51.25, -88, K, { reach: 0.4 }),
    p(51.25, -94, K, { reach: 0.4 }),
    p(51.25, -96, K, { reach: 0.4 }),
    p(55, -96, K, blocked), // the Madichin's face (x 52.5)
    p(51.25, -96, K, { reach: 0.4 }),
    p(51.25, -94, K, { reach: 0.4 }),
    p(45, -100, K),
  ],

  // (f) The terrace parapet's return across the step at z -108 (x 51.5 .. 53, z -108.5
  // .. -108), entered from the Parvah roof walking east along the parapet, and the
  // Madichin roof's court-edge parapet entered from its roof; up and down the Madichin
  // stair.
  r3_terrace_return: [
    p(40, -100, K),
    p(49, -100, K),
    at('lishkas_hamadichin', { level: K }),
    p(59.5, -94.3, K),
    p(64, -94.3, K, { reach: 0.5, minY: 0 }),
    p(64, -107.5, K, { reach: 0.5, ...T }),
    h(56, -107, K, T),
    h(53.4, -104, K, T), // beside the Madichin parapet (x 52.5 .. 53)
    p(51, -104, K, { ...blocked, ...T }), // into it
    h(53.4, -104, K, T),
    h(53.4, -112, K, T), // onto the Parvah roof past the return's end (x 53)
    h(52.25, -112, K, T), // beside the Parvah parapet (x 51.5 .. 52)
    p(52.25, -106, K, { ...blocked, ...T }), // into the return (z -108.5 .. -108)
    h(52.25, -112, K, T),
    p(50, -112, K, { ...blocked, ...T }), // into the Parvah parapet
    h(52.25, -112, K, T),
    h(56, -112, K, T),
    h(64, -108.5, K, T),
    p(64, -94.3, K, { reach: 0.5, minY: 0 }),
    p(56, -96, K),
    at('lishkas_hamadichin', { level: K }),
    p(49, -100, K),
    p(40, -100, K),
  ],

  // (g) The Beis HaMoked stair (stairs.mjs has the route and four rails): into every
  // open side of every flight and landing. Flight A x 73.5 .. 75.5 (outer wall x 75.5,
  // the A/B wall x 73 .. 73.5 to z -9), L1 x 71 .. 75.5, z -8 .. -5.5 (end wall z -5.5,
  // the B/C wall x 70.5 .. 71 from z -12.5), flight B x 71 .. 73, L2 x 68.5 .. 73,
  // z -16 .. -13.5 (end wall z -16, the partition x 67.5 .. 68.5), flight C x 68.5 .. 70.5
  // up through the well. The band walls stop an amah short of the landings; across those
  // gaps the neighbouring flight is at most 1.5 amos lower (the test asserts it).
  r3_moked_stair_sides: [
    p(80, -14, C),
    p(74.5, -15, C),
    step(74.5, -11, 3),
    p(72, -11, C, { ...blocked, minY: 3 * AMAH }), // A into the A/B wall
    step(74.5, -11, 3),
    p(77, -11, C, { ...blocked, minY: 3 * AMAH }), // A into the outer wall
    step(74.5, -11, 3),
    step(74.5, -7, 5.5), // L1
    step(73.25, -6.75, 5.5),
    p(73.25, -3, C, { ...blocked, minY: 5.5 * AMAH }), // L1 into its end wall (z -5.5)
    step(73.25, -6.75, 5.5),
    p(77, -6.75, C, { ...blocked, minY: 5.5 * AMAH }), // L1 into the outer wall
    step(73.25, -6.75, 5.5),
    p(69, -6.75, C, { ...blocked, minY: 5.5 * AMAH }), // L1 into the B/C wall
    step(72, -6.75, 5.5),
    step(72, -11, 9),
    p(75, -11, C, { ...blocked, minY: 9 * AMAH }), // B into the A/B wall
    step(72, -11, 9),
    p(69, -11, C, { ...blocked, minY: 9 * AMAH }), // B into the B/C wall
    step(72, -11, 9),
    step(72, -13, 11),
    step(70.75, -14.75, 11), // L2
    p(70.75, -18, C, { ...blocked, minY: 11 * AMAH }), // L2 into its end wall (z -16)
    step(70.75, -14.75, 11),
    p(75, -14.75, C, { ...blocked, minY: 11 * AMAH }), // L2 into the A/B wall
    step(70.75, -14.75, 11),
    p(66, -14.75, C, { ...blocked, minY: 11 * AMAH }), // L2 into the partition
    step(69.5, -14.75, 11),
    step(69.5, -11, 13.5), // flight C
    p(72.5, -11, C, { ...blocked, minY: 13.5 * AMAH }), // C into the B/C wall
    step(69.5, -11, 13.5),
    p(66, -11, C, { ...blocked, minY: 13.5 * AMAH }), // C into the partition
    step(69.5, -11, 13.5),
    p(69.5, -8.75, K, { reach: 0.4 }), // the top tread, level with the hall floor
    p(69.5, -6, K, { reach: 0.4 }),
    p(66, -6, K),
    p(66, -14, K),
    p(56, -14, K),
  ],

  // (h) The Gazis stair, likewise. Flight A x -76.5 .. -73.5 (outer wall x -76.5, the
  // A/B wall x -73.5 .. -73 to z -92.5), L1 x -76.5 .. -71, z -91.5 .. -89 (the chamber's
  // east wall z -89, the B/C wall x -71 .. -70.5 from z -96), flight B x -73 .. -71,
  // L2 x -73 .. -68.5, z -99.5 .. -97 (end wall z -99.5, the partition x -68.5 .. -67.5),
  // flight C x -70.5 .. -68.5 up through the well.
  r3_gazis_stair_sides: [
    p(-75, -113, C),
    p(-75, -101, C),
    step(-75, -94.5, 3),
    p(-72, -94.5, C, { ...blocked, minY: 3 * AMAH }), // A into the A/B wall
    step(-75, -94.5, 3),
    p(-78, -94.5, C, { ...blocked, minY: 3 * AMAH }), // A into the outer wall
    step(-75, -94.5, 3),
    step(-75, -90.25, 5.5), // L1
    step(-73.75, -90.25, 5.5),
    p(-73.75, -87, C, { ...blocked, minY: 5.5 * AMAH }), // L1 into the chamber's east wall (z -89)
    step(-73.75, -90.25, 5.5),
    p(-78, -90.25, C, { ...blocked, minY: 5.5 * AMAH }), // L1 into the outer wall
    step(-73.75, -90.25, 5.5),
    p(-69, -90.25, C, { ...blocked, minY: 5.5 * AMAH }), // L1 into the B/C wall
    step(-72, -90.25, 5.5),
    step(-72, -94.5, 9),
    p(-75, -94.5, C, { ...blocked, minY: 9 * AMAH }), // B into the A/B wall
    step(-72, -94.5, 9),
    p(-69, -94.5, C, { ...blocked, minY: 9 * AMAH }), // B into the B/C wall
    step(-72, -94.5, 9),
    step(-72, -96.5, 11),
    step(-70.75, -98.25, 11), // L2
    p(-70.75, -102, C, { ...blocked, minY: 11 * AMAH }), // L2 into its end wall (z -99.5)
    step(-70.75, -98.25, 11),
    p(-75, -98.25, C, { ...blocked, minY: 11 * AMAH }), // L2 into the A/B wall
    step(-70.75, -98.25, 11),
    p(-66, -98.25, C, { ...blocked, minY: 11 * AMAH }), // L2 into the partition
    step(-69.5, -98.25, 11),
    step(-69.5, -94.5, 13.5), // flight C
    p(-72.5, -94.5, C, { ...blocked, minY: 13.5 * AMAH }), // C into the B/C wall
    step(-69.5, -94.5, 13.5),
    p(-66, -94.5, C, { ...blocked, minY: 13.5 * AMAH }), // C into the partition
    step(-69.5, -94.5, 13.5),
    p(-69.5, -92.25, K, { reach: 0.4 }), // the top tread
    p(-69.5, -90.5, K, { reach: 0.4 }),
    p(-66, -90.5, K),
    at('lishkas_hagazis', { level: K }),
    p(-56, -103, K),
  ],

  // (i) The kodesh / chol line (Yoma 25a) in both chambers: an inlaid strip at x +-67.5,
  // crossed both ways on the hall floor (Beis HaMoked at z -20, between the chambers'
  // faces; the Gazis at z -98.5, between the well's parapet and the benches).
  r3_kodesh_line: [
    p(56, -14, K),
    p(66.5, -20, K),
    p(60, -20, K),
    p(76, -20, K),
    p(60, -20, K),
    p(66.5, -14, K),
    p(56, -14, K),
  ],
  r3_kodesh_line_gazis: [
    p(-56, -103, K),
    at('lishkas_hagazis', { level: K }),
    p(-62, -98.5, K),
    p(-76, -98.5, K),
    p(-62, -98.5, K),
    at('lishkas_hagazis', { level: K }),
    p(-56, -103, K),
  ],
};
