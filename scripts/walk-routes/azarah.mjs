import { AMAH, NICANOR_Z } from '../../src/content/units.js';

const at = (id, o = {}) => ({ id, ...o });
/** A point given in amos in the azarah frame (+x north, -z west), with the expected floor level. */
const p = (x, z, level, o = {}) => ({ x: x * AMAH, z: NICANOR_Z + z * AMAH, level, ...o });
/** Offsets in amos for `at`. */
const amos = (dx, dz) => ({ dx: dx * AMAH, dz: dz * AMAH });

const Y = 'azaras_yisrael';
const D = 'duchan';
const K = 'azaras_kohanim';
const C = 'cheil';
/** A closed gate: the leg must end against the leaves (result "stuck"), never through them. */
const blocked = { expect: 'blocked', reach: 0.3 };

/**
 * Walks are straight lines between waypoints, so every route goes through doors
 * explicitly (a point outside the door, then one inside). Nothing crosses the altar
 * (x -16 .. 16, z -22 .. -54), the kevesh (x -46 .. -29, z -46 .. -30) or the Ulam
 * steps (x +-20, z -54 .. -76) except where the route deliberately crosses the first
 * step. The Ulam and the Heichal walls stand on a foundation that starts 2.6 m above
 * the court floor, so nothing here comes within an amah of x +-50 at z -76 .. -92.
 *
 * Gate legs: one waypoint in the gateway (between the wall face and the leaves), then
 * one beyond the leaves with `expect: 'blocked'`.
 */
export const routes = {
  // The Ezras Yisrael strip end to end, the Nicanor gateway, the Duchan and its three
  // steps (x -55.5 .. 40.5), and beside its ends the flat gate frontages at the Kohanim
  // level (Water Gate, Beis HaMoked gate) with their five steps down to the Ezras Yisrael.
  azarah_yisrael: [
    p(-60, -5, Y),
    p(50, -5, Y),
    p(0, -5, Y),
    at('nicanor_gate', { ...amos(0, 3), level: Y }),
    p(0, -5, Y),
    p(0, -11.7, D, { reach: 0.4 }),
    p(0, -16, K),
    p(-50, -16, K),
    p(-50, -5, Y),
    p(-50, -11.7, D, { reach: 0.4 }),
    p(-50, -16, K),
    p(-62, -16, K),
    p(-62, -12, K),
    p(-62, -5, Y),
    p(-62, -12.5, K, { reach: 0.4 }),
    p(-62, -16, K),
    p(46, -16, K),
    p(46, -10, K),
    p(46, -5, Y),
    p(46, -10.5, K, { reach: 0.4 }),
    p(46, -16, K),
  ],

  // The Ezras Kohanim end to end: the strip east of the altar, the lane between the altar
  // and the rings, across the first Ulam step west of the altar, the lane south of the
  // kevesh, and back.
  azarah_kohanim: [
    p(-62, -18, K),
    p(50, -18, K),
    p(20, -18, K),
    p(20, -54.5, K),
    p(-22, -54.5, K),
    p(-62, -54.5, K),
    p(-62, -18, K),
    p(-50, -18, K),
    p(-50, -52, K),
    p(-62, -52, K),
    at('kiyor', { ...amos(0, 4), level: K }),
    p(-62, -18, K),
  ],

  // Slaughtering area (Middot 3:5, 5:2): along the tables (x 51.5 .. 52.5, centres z
  // -28.5, -31.5 .. -49.5) and the pillars (x 57.5 .. 58.5, z -28, -31 .. -49), between the
  // tables and the pillars, between the pillars and the north wall, through the first
  // gap of each (z -30 between the tables, -29.5 between the pillars), and into the
  // first table and the first pillar (both must stop the player).
  azarah_slaughter: [
    p(50, -20, K),
    p(50, -53, K),
    p(55, -53, K),
    p(55, -29.5, K, { reach: 0.4 }),
    p(60, -29.5, K),
    p(60, -53, K), // between the pillars and the Beis Avtinas stair tower (x 61.5 .. 73.5, z -51 .. -42)
    p(60, -29.5, K, { reach: 0.4 }),
    p(55, -29.5, K, { reach: 0.4 }),
    p(55, -30, K, { reach: 0.4 }),
    p(48, -30, K),
    p(48, -28.5, K, { reach: 0.4 }),
    p(56, -28.5, K, blocked),
    p(48, -30, K, { reach: 0.4 }),
    p(55, -30, K, { reach: 0.4 }),
    p(55, -28, K, { reach: 0.4 }),
    p(61, -28, K, blocked),
    p(55, -45, K),
    at('tamid_lamb', { ...amos(0, 4), level: K }),
    p(50, -20, K),
  ],

  // Lishkas HaGazis (both halves) and its closed door to the Cheil in the chol half.
  azarah_gazis: [
    p(-45, -103, K),
    p(-56, -103, K),
    at('lishkas_hagazis', { level: K }),
    p(-70, -96, K),
    p(-70, -110, K),
    p(-79, -110, K, blocked),
    p(-70, -110, K),
    at('lishkas_hagazis', { level: K }),
    p(-56, -103, K),
    p(-45, -103, K),
  ],

  // Lishkas HaEtz behind the Gazis (Abba Shaul, Middot 5:4): from the court through the
  // Gazis, its chol half and the door in its west wall (x -70.5) into the Etz, and back.
  azarah_etz: [
    p(-45, -103, K),
    p(-56, -103, K),
    at('lishkas_hagazis', { level: K }),
    p(-70.5, -110, K),
    p(-70.5, -114, K, { reach: 0.5 }),
    p(-70.5, -121, K),
    at('lishkas_haetz', { level: K }),
    p(-80, -145, K),
    p(-70.5, -121, K),
    p(-70.5, -114, K, { reach: 0.5 }),
    at('lishkas_hagazis', { level: K }),
    p(-56, -103, K),
    p(-45, -103, K),
  ],

  // Lishkas Palhedrin (Yoma 19a): from the Cheil through its door, up its two flights to
  // the landing at the court level, through the upper door into the Water Gate passage
  // and out into the court; then back down to the Cheil.
  azarah_palhedrin: [
    p(-78.5, -10, C),
    p(-78.5, -19.5, C, { reach: 0.5 }),
    p(-78.5, -23.5, C, { reach: 0.4 }),
    p(-81, -24.5, C, { reach: 0.4 }),
    p(-81, -32.5, C, { reach: 0.4, minY: 3.5 }),
    p(-78.5, -34.5, C, { reach: 0.4, minY: 4 }),
    p(-76, -32.5, C, { reach: 0.4, minY: 4 }),
    p(-76, -25.5, K, { reach: 0.4 }),
    p(-76, -23.5, K, { reach: 0.4 }),
    p(-70.5, -23, K, { reach: 0.4 }),
    p(-62, -23, K),
    p(-70.5, -23, K, { reach: 0.4 }),
    p(-76, -23.5, K, { reach: 0.4 }),
    p(-76, -25.5, K, { reach: 0.4 }),
    p(-76, -32.5, C, { reach: 0.4, minY: 4 }),
    p(-78.5, -34.5, C, { reach: 0.4, minY: 4 }),
    p(-81, -32.5, C, { reach: 0.4, minY: 3.5 }),
    p(-81, -24.5, C, { reach: 0.4 }),
    p(-78.5, -23.5, C, { reach: 0.4 }),
    p(-78.5, -10, C),
  ],

  // Beis Avtinas: from the court beside the Korban gate into the stair tower (door on its
  // east face, x 62.5 .. 65), up its four flights of half-amah steps (11, 11, 11, 10; bands
  // 1.75 amos wide, landings at alternate ends) to the storey 21.5 amos up, into the
  // storey, and back down.
  azarah_avtinas: [
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
    p(63.75, -49.1, K, { reach: 0.4, minY: 10 }),
    p(63.75, -53, K, { reach: 0.4, minY: 10 }),
    at('beis_avtinas', { level: K, minY: 10 }),
    p(63.75, -53, K, { reach: 0.4, minY: 10 }),
    p(63.75, -49.1, K, { reach: 0.4, minY: 10 }),
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

  // Lishkas HaGolah through its door and back.
  azarah_golah: [
    p(-40, -133, K),
    p(-49, -133, K),
    at('lishkas_hagolah', { level: K }),
    p(-63, -138, K),
    p(-49, -133, K),
    p(-40, -133, K),
  ],

  // Madichin, Parvah and Melach through their doors; the Madichin stair to the roof
  // terrace, along it past the mikveh (which must stop the player) and down again.
  azarah_northern_lishkos: [
    p(40, -100, K),
    p(49, -100, K),
    at('lishkas_hamadichin', { level: K }),
    p(59.5, -94.3, K),
    p(64, -94.3, K, { reach: 0.5, minY: 0 }),
    p(64, -108, K, { minY: 11 * AMAH }),
    p(64, -116, K, { minY: 11 * AMAH }),
    p(64, -136, K, { minY: 11 * AMAH }),
    p(64, -116, K, { minY: 11 * AMAH }),
    p(59.5, -116, K, { ...blocked, minY: 11 * AMAH }),
    p(64, -108, K, { minY: 11 * AMAH }),
    p(64, -94.3, K, { reach: 0.5, minY: 0 }),
    p(56, -96, K),
    at('lishkas_hamadichin', { level: K }),
    p(49, -100, K),
    p(49, -116, K),
    at('lishkas_haparvah', { level: K }),
    p(49, -116, K),
    p(49, -132, K),
    at('lishkas_hamelach', { level: K }),
    p(49, -132, K),
    p(40, -132, K),
  ],

  // Beis HaMoked: the gate, the hall, each of the four corner chambers (children of the
  // entry, so given by position: Telaei Korban, Osei Lechem HaPanim, Avnei HaMizbeach,
  // Beis HaTevilah) through its door, and the closed gate to the Cheil.
  azarah_beis_hamoked: [
    p(40, -14, K),
    p(50, -14, K),
    p(56, -14, K),
    p(66.5, -14, K),
    p(66.5, -20, K),
    p(58.5, -20, K),
    p(66.5, -20, K),
    p(66.5, -8, K),
    p(58.5, -8, K),
    p(66.5, -8, K),
    p(76.5, -8, K),
    p(66.5, -8, K),
    p(66.5, -20, K),
    p(76.5, -20, K),
    p(66.5, -20, K),
    p(66.5, -14, K),
    p(80.5, -14, K),
    p(84, -14, K, blocked),
    p(66.5, -14, K),
    p(56, -14, K),
    p(40, -14, K),
  ],

  // The three southern gates of Middot 1:4 and Shaar HaElyon, each entered from the court.
  azarah_gates_south: [
    p(-58, -16, K),
    p(-69, -16, K, { reach: 0.6 }),
    p(-73, -16, K, blocked),
    p(-58, -16, K),
    p(-58, -44, K),
    p(-69, -44, K, { reach: 0.6 }),
    p(-73, -44, K, blocked),
    p(-58, -44, K),
    p(-61, -60, K),
    p(-61, -78, K),
    p(-69, -78, K, { reach: 0.6 }),
    p(-73, -78, K, blocked),
    p(-61, -78, K),
    p(-61, -86, K),
    p(-56, -89, K, { reach: 0.4 }),
    p(-56, -117, K, { reach: 0.4 }),
    p(-45, -120, K),
    p(-45, -145, K),
    p(-61, -150, K),
    p(-61, -172, K),
    p(-69, -172, K, { reach: 0.6 }),
    p(-73, -172, K, blocked),
    p(-61, -172, K),
  ],

  // The three northern gates of Middot 1:5 (Beis HaMoked's is in azarah_beis_hamoked) and Shaar HaNashim.
  azarah_gates_north: [
    p(61, -36, K),
    p(69, -36, K, { reach: 0.6 }),
    p(73, -36, K, blocked),
    p(61, -36, K),
    p(60, -40, K), // past the Beis Avtinas stair tower (x 61.5 .. 73.5, z -51 .. -42)
    p(60, -54, K),
    p(61, -58, K),
    p(69, -58, K, { reach: 0.6 }),
    p(73, -58, K, blocked),
    p(61, -58, K),
    p(61, -78, K),
    p(69, -78, K, { reach: 0.6 }),
    p(73, -78, K, blocked),
    p(61, -78, K),
    p(61, -86, K),
    p(61, -58, K),
  ],

  // The strip behind the building (z -176 .. -187) end to end with the two western gates,
  // reached along the south side; the northern strip from the back up to the Melach.
  azarah_west: [
    p(-61, -150, K),
    p(-61, -185, K),
    p(-50, -181, K),
    p(-50, -189, K, { reach: 0.6 }),
    p(-50, -193, K, blocked),
    p(-50, -181, K),
    p(0, -181, K),
    p(50, -181, K),
    p(50, -189, K, { reach: 0.6 }),
    p(50, -193, K, blocked),
    p(50, -181, K),
    p(61, -181, K),
    p(61, -144, K), // the Melach's west wall is at z -140
    p(45, -144, K),
    p(45, -94, K),
    p(45, -144, K),
    p(61, -144, K),
    p(61, -181, K),
    p(0, -181, K),
    p(-61, -181, K),
    p(-61, -150, K),
  ],
};

// ----------------------------------------------------------------------------
// Perimeter routes (Round A, PW2). Every leg hugs a face 0.4 m (HUG = 0.8 amos) off it,
// with `reach` tightened to 0.3 m so a corner is actually turned where it is placed.
// The walker stops within +-0.3 m of a target along its leg, so at a convex corner (a
// wall corner the walker goes round, a door jamb it comes out past) the target is
// pushed PUSH amos further along the arriving leg (`hc`), which keeps the player's
// 0.3 m body clear of the face it turns along; at a concave corner the second face
// stops the walker at the right spot by itself. Masses (steps, the altar, tables,
// parapets) are tested at the player's centre only, so they need no push.
// Gate legs go into the reveal along one side (REVEAL amos off it), into the closed
// leaves (`blocked`) and out along the other side.
// ----------------------------------------------------------------------------
const X_IN = 67.5;
const HUG = 0.8;
const PUSH = 0.8;
const REVEAL = 1.3;
/** Hug point: HUG off a face, reached within 0.3 m. */
const h = (x, z, level, o = {}) => p(x, z, level, { reach: 0.3, ...o });
/** Hug point at a convex corner: pushed PUSH amos along the arriving leg (see `pushed`). */
const hc = (x, z, level, o = {}) => h(x, z, level, { push: PUSH, ...o });
/** Apply the `push` of hc points along the direction from the previous waypoint (world metres). */
const pushed = (list) =>
  list.map((wp, i) => {
    if (!wp.push) return wp;
    const prev = list[i - 1];
    const { push, ...rest } = wp;
    if (prev?.x == null) return rest;
    const dx = wp.x - prev.x;
    const dz = wp.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    return { ...rest, x: wp.x + (dx / len) * push * AMAH, z: wp.z + (dz / len) * push * AMAH };
  });
/** Into a court gate's reveal on the wall side `s` (-1 south, +1 north): one side in, the leaves, the other side out. */
const gateReveal = (s, zc, w = 10) => [
  h(s * (X_IN - HUG), zc - w / 2 + REVEAL, K),
  h(s * (X_IN + 2), zc - w / 2 + REVEAL, K),
  p(s * (X_IN + 5.5), zc, K, blocked),
  h(s * (X_IN + 2), zc + w / 2 - REVEAL, K),
  hc(s * (X_IN - HUG), zc + w / 2 - REVEAL, K),
];
/** Into a chamber through a door in a face at x = `face` (door centre z `zc`), round its interior, out; `s` is the side the court lies on. */
const chamberLoop = (face, zc, s, depth, half) => [
  h(face + s * HUG, zc, K),
  h(face - s * depth, zc, K),
  h(face - s * (1 + 2 * half - HUG), zc - half + HUG, K),
  h(face - s * (1 + 2 * half - HUG), zc + half - HUG, K),
  h(face - s * (1 + HUG), zc + half - HUG, K),
  h(face - s * (1 + HUG), zc - half + HUG, K),
  h(face - s * depth, zc, K),
  hc(face + s * HUG, zc, K),
];

Object.assign(routes, {
  // (east) The inside face of the east wall at the Ezras Yisrael level, corner to corner,
  // into both side chambers and across the Nicanor gateway.
  azarah_hug_east: pushed([
    h(-X_IN + HUG, -HUG, Y),
    h(-12, -HUG, Y),
    h(-12, 2, Y), // Lishkas Osei Chavitin, built into the wall
    hc(-12, -HUG, Y),
    h(-3, -HUG, Y),
    h(-3, 3, Y), // the Nicanor gateway
    h(3, 3, Y),
    hc(3, -HUG, Y),
    h(12, -HUG, Y),
    h(12, 2, Y), // Lishkas Pinchas HaMalbish
    hc(12, -HUG, Y),
    h(X_IN - HUG, -HUG, Y),
  ]),

  // (a) South wall inside face from the Nicanor corner to the back corner: the frontage
  // steps, the Water Gate, the Palhedrin bay, Bechoros, Delek, round Lishkas HaGazis and
  // through its open door, round Lishkas HaGolah and through its door, Shaar HaElyon.
  azarah_hug_south: pushed([
    h(-X_IN + HUG, -HUG, Y),
    h(-X_IN + HUG, -7, Y),
    h(-X_IN + HUG, -12, K),
    ...gateReveal(-1, -16),
    h(-X_IN + HUG, -23, K),
    h(-X_IN - 3, -23, K), // the Palhedrin bay off the Water Gate passage
    hc(-X_IN + HUG, -23, K),
    h(-X_IN + HUG, -37, K),
    ...gateReveal(-1, -44),
    h(-X_IN + HUG, -60, K),
    h(-X_IN + HUG, -71, K),
    ...gateReveal(-1, -78),
    h(-X_IN + HUG, -88 + HUG, K),
    hc(-57.5 + HUG, -88 + HUG, K), // the Gazis' east face
    h(-57.5 + HUG, -103, K),
    h(-60, -103, K), // through its open door
    hc(-57.5 + HUG, -103, K),
    hc(-57.5 + HUG, -118 - HUG, K),
    h(-X_IN + HUG, -118 - HUG, K), // its west face
    h(-X_IN + HUG, -125 + HUG, K),
    hc(-51.5 + HUG, -125 + HUG, K), // the Golah's east face
    h(-51.5 + HUG, -133, K),
    h(-55, -133, K), // through its door
    hc(-51.5 + HUG, -133, K),
    hc(-51.5 + HUG, -141 - HUG, K),
    h(-X_IN + HUG, -141 - HUG, K), // its west face
    h(-X_IN + HUG, -160, K),
    ...gateReveal(-1, -172),
    h(-X_IN + HUG, -187 + HUG, K),
  ]),

  // (a) North wall inside face: the strip between the east wall and Beis HaMoked, the
  // hall's south face with the frontage steps and its open gate, its west face, Shaar
  // HaNashim, round the Beis Avtinas stair tower, Korban, Nitzotz, the pocket beside the
  // Ulam's north wing, the slot past the wing, the three northern lishkos through their
  // doors, and the wall behind them to the back corner.
  azarah_hug_north: pushed([
    h(X_IN - HUG, -1, Y),
    h(52.5 + HUG, -1, Y),
    hc(52.5 - HUG, -1, Y),
    h(52.5 - HUG, -5.5, Y),
    h(52.5 - HUG, -9 - HUG, K),
    h(52.5 - HUG, -14, K),
    h(56, -14, K), // the hall's open gate
    hc(52.5 - HUG, -14, K),
    h(52.5 - HUG, -25, K), // the slaughter tables (x 51.5 .. 52.5) start at z -27.5, an amah and a half from the hall's corner
    h(51.5 - HUG, -30, K),
    h(52.5 + HUG, -30, K), // through the gap between the first two tables (z -29.5 .. -30.5)
    h(52.5 + HUG, -26 - HUG, K),
    h(57.5 - HUG, -26 - HUG, K), // the hall's west face, to the first pillar (x 57.5 .. 58.5, z -28.5 .. -27.5)
    h(57.5 - HUG, -29.5, K),
    h(58.5 + HUG, -29.5, K), // through the gap between the first two pillars (z -28.5 .. -30.5)
    h(58.5 + HUG, -26 - HUG, K),
    h(X_IN - HUG, -26 - HUG, K), // the rest of the hall's west face
    ...gateReveal(1, -36),
    h(X_IN - HUG, -42 + HUG, K),
    hc(61.5 - HUG, -42 + HUG, K), // round the Beis Avtinas stair tower
    hc(61.5 - HUG, -51 - HUG, K),
    h(X_IN - HUG, -51 - HUG, K),
    ...gateReveal(1, -58),
    h(X_IN - HUG, -70, K),
    ...gateReveal(1, -78),
    h(X_IN - HUG, -92 + HUG, K), // the pocket beside the north wing (x 50 .. 67.5, z -76 .. -92)
    h(50 + HUG, -92 + HUG, K),
    h(50 + HUG, -76 + HUG, K),
    h(50 + HUG, -92 + HUG, K),
    h(50 + HUG, -93.5, K), // through the 1.5-amah slot between the wing and the Madichin
    h(51.5 - HUG, -100, K),
    h(54, -100, K), // Lishkas HaMadichin through its door
    hc(51.5 - HUG, -100, K),
    h(51.5 - HUG, -116, K),
    h(54, -116, K), // Lishkas HaParvah
    hc(51.5 - HUG, -116, K),
    h(51.5 - HUG, -132, K),
    h(54, -132, K), // Lishkas HaMelach
    hc(51.5 - HUG, -132, K),
    hc(51.5 - HUG, -140 - HUG, K),
    h(X_IN - HUG, -140 - HUG, K), // the Melach's west face
    h(X_IN - HUG, -160, K),
    h(X_IN - HUG, -187 + HUG, K),
  ]),

  // (b) Behind the building: the west wall's inside face corner to corner with both
  // western gates, and the building's back face (z -176) between the ta'im corners.
  azarah_hug_west: pushed([
    h(-X_IN + HUG, -187 + HUG, K),
    h(-55 + REVEAL, -187 + HUG, K),
    h(-55 + REVEAL, -189.5, K),
    p(-50, -193, K, blocked),
    h(-45 - REVEAL, -189.5, K),
    hc(-45 - REVEAL, -187 + HUG, K),
    h(45 + REVEAL, -187 + HUG, K),
    h(45 + REVEAL, -189.5, K),
    p(50, -193, K, blocked),
    h(55 - REVEAL, -189.5, K),
    hc(55 - REVEAL, -187 + HUG, K),
    h(X_IN - HUG, -187 + HUG, K),
    h(35 + REVEAL, -187 + HUG, K),
    h(35 + REVEAL, -176 - REVEAL, K), // short of the building's back corner
    h(-35 - REVEAL, -176 - REVEAL, K), // along the back face (z -176) to the other corner
    h(-35 - REVEAL, -187 + HUG, K),
    h(-X_IN + HUG, -187 + HUG, K),
  ]),

  // (c) Round the building's outer faces at court level: the Ulam front beside the
  // flight, the north wing's end, the Ulam's back beside the wing, the north ta'im wall,
  // the back, the south ta'im wall, the south wing and front, and past the kiyor.
  azarah_hug_building: pushed([
    p(44, -54.5, K),
    h(20 + HUG, -54.6, K),
    h(20 + HUG, -76 + HUG, K), // along the flight's north end to the Ulam front
    hc(50 + HUG, -76 + HUG, K),
    h(50 + HUG, -92 + HUG, K), // the wing's end wall
    h(50 + HUG, -93.5, K), // the slot
    h(35 + HUG, -92 - HUG, K), // the Ulam's back beside the wing
    hc(35 + HUG, -176 - HUG, K), // the north ta'im wall, past the back corner
    h(-35 - REVEAL, -176 - HUG, K), // the back, short of the south corner
    h(-35 - HUG, -92 - HUG, K), // the south ta'im wall
    hc(-50 - HUG, -92 - HUG, K),
    hc(-50 - HUG, -76 + HUG, K), // the south wing's end wall
    h(-27.6, -76 + HUG, K), // the Ulam front to the kiyor (x -24, its solid x -25.6 .. -22.4, the muchni post on its south at x -26.5)
    h(-27.6, -62.4, K), // past the post's south side
    h(-20 - HUG, -62.4, K),
    h(-20 - HUG, -54.6, K), // the flight's south end
    p(-44, -54.5, K),
  ]),

  // (d) The altar zone: a loop round the kiyor and its muchni (the body x -25.6 .. -22.4,
  // z -66.6 .. -63.4, the post on its south at x -26.5; an amah of court between it and
  // the flight's south end at x -20), the yesod's west face along the first Ulam tread, the yesod's
  // north face, the sovev's east and south faces, the kevesh's north flank, its foot, its
  // south flank clear of the small western kevesh's shelf; then the slaughter furniture:
  // the tables' court side, between the tables and the pillars, between the pillars and
  // the wall, through a gap between two pillars and through a gap between two tables.
  azarah_hug_altar: pushed([
    p(-21.6, -62.4, K),
    h(-27.6, -62.4, K), // the kiyor's east side, past the post
    h(-27.6, -67.6, K),
    h(-21.6, -67.6, K), // its west side
    h(-21.6, -62.4, K), // its north side, between the body and the flight's end (x -20)
    h(-21.6, -54.6, K),
    h(16 + HUG, -54.6, K), // the yesod's west face, along the first Ulam tread
    h(16 + HUG, -22 + HUG, K), // the yesod's north face
    h(-15 - HUG, -22 + HUG, K), // the sovev's east face
    h(-15 - HUG, -30 + HUG, K), // its south face to the kevesh
    h(-46 + HUG, -30 + HUG, K), // the kevesh's north flank to its foot
    h(-46 - HUG, -30 + HUG, K),
    h(-46 - HUG, -46 - HUG, K),
    h(-44, -48 - HUG - 0.4, K), // its south flank, clear of the western small kevesh (z -48 .. -46, 1 high)
    h(-19.5, -48 - HUG - 0.4, K),
    h(-19.5, -54.6, K),
    p(44, -54.6, K),
    h(51.5 - HUG, -50.5 - HUG, K), // the last table ends at z -50.5
    h(51.5 - HUG, -27, K), // the tables' court side, past their north end (z -27.5) toward the hall's corner (z -26)
    h(51.5 - HUG, -30, K),
    h(52.5 + HUG, -30, K), // through the gap between the first two tables (z -29.5 .. -30.5)
    h(52.5 + HUG, -27, K),
    h(52.5 + HUG, -50.5 - HUG, K), // between the tables and the pillars
    h(57.5 - HUG, -50.5 - HUG, K),
    h(57.5 - HUG, -27, K),
    h(57.5 - HUG, -29.5, K),
    h(58.5 + HUG, -29.5, K), // through the gap between the first two pillars (z -28.5 .. -30.5)
    h(58.5 + HUG, -27, K),
    h(58.5 + HUG, -49.5 - HUG, K), // between the pillars and the wall (the last pillar ends at z -49.5)
    h(58.5 + HUG, -29.5, K),
    h(57.5 - HUG, -29.5, K),
    h(52.5 + HUG, -30, K),
    h(51.5 - HUG, -30, K),
  ]),

  // (e) The terrace over Madichin / Parvah / Melach: up the Madichin stair, round the
  // stair well's parapet, the court-edge parapet, both end parapets and the mikveh rim,
  // each one entered (`blocked`), and down again.
  azarah_hug_terrace: pushed([
    p(40, -100, K),
    p(49, -100, K),
    at('lishkas_hamadichin', { level: K }),
    p(59.5, -94.3, K),
    p(64, -94.3, K, { reach: 0.5, minY: 0 }),
    p(64, -107.5, K, { reach: 0.5, minY: 11 * AMAH }),
    h(60, -107.5, K, { minY: 11 * AMAH }), // beside the well's top end
    h(60, -95, K, { minY: 11 * AMAH }), // along the well's court-side parapet
    p(64, -95, K, { ...blocked, minY: 11 * AMAH }), // into it
    h(60, -93 - HUG, K, { minY: 11 * AMAH }),
    p(60, -90, K, { ...blocked, minY: 11 * AMAH }), // the east end parapet
    h(52 + HUG, -93 - HUG, K, { minY: 11 * AMAH }),
    h(52 + HUG, -120, K, { minY: 11 * AMAH }), // along the court-edge parapet
    p(50, -120, K, { ...blocked, minY: 11 * AMAH }), // into it
    h(52 + HUG, -139.5 + HUG, K, { minY: 11 * AMAH }),
    h(66, -139.5 + HUG, K, { minY: 11 * AMAH }), // the west end parapet
    p(66, -142, K, { ...blocked, minY: 11 * AMAH }),
    h(61.5 + HUG, -118 - HUG, K, { minY: 11 * AMAH }), // round the mikveh rim (x 57.5 .. 61.5, z -118 .. -114)
    h(61.5 + HUG, -114 + HUG, K, { minY: 11 * AMAH }),
    h(57.5 - HUG, -114 + HUG, K, { minY: 11 * AMAH }),
    h(57.5 - HUG, -118 - HUG, K, { minY: 11 * AMAH }),
    h(61.5 + HUG, -118 - HUG, K, { minY: 11 * AMAH }),
    p(59.5, -116, K, { ...blocked, minY: 11 * AMAH }), // into the rim
    h(64, -108.5, K, { minY: 11 * AMAH }),
    p(64, -94.3, K, { reach: 0.5, minY: 0 }),
    p(56, -96, K),
    at('lishkas_hamadichin', { level: K }),
    p(49, -100, K),
    p(40, -100, K),
  ]),

  // (e) Beis Avtinas: up the stair tower (azarah_avtinas checks each flight) and round
  // the storey's four walls, then down.
  azarah_hug_avtinas: pushed([
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
    p(63.75, -49.1, K, { reach: 0.4, minY: 10 }),
    p(63.75, -53, K, { reach: 0.4, minY: 10 }),
    h(62.5 + HUG, -51 - HUG, K, { minY: 10 }),
    h(62.5 + HUG, -65 + HUG, K, { minY: 10 }), // the storey's south wall
    h(72.5 - HUG, -65 + HUG, K, { minY: 10 }), // its west wall
    h(72.5 - HUG, -51 - HUG, K, { minY: 10 }), // its north wall, in the court wall's thickness
    h(62.5 + HUG, -51 - HUG, K, { minY: 10 }), // its east wall
    p(63.75, -53, K, { reach: 0.4, minY: 10 }),
    p(63.75, -49.1, K, { reach: 0.4, minY: 10 }),
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
  ]),

  // (f) Beis HaMoked: the hall's cross-shaped floor hugging the chamber faces and the
  // ledges, the closed north gate, and each corner chamber's four walls through its door.
  azarah_hug_moked: pushed([
    p(40, -14, K),
    p(56, -14, K),
    hc(62.5 + HUG, -16 + HUG, K),
    h(62.5 + HUG, -24 + HUG, K), // Telaei Korban's face, to the west ledge
    h(72.5 - HUG, -24 + HUG, K),
    hc(72.5 - HUG, -16 + HUG, K), // Beis HaTevilah's face
    h(81.5 - HUG, -16 + HUG, K),
    h(81.5 - HUG, -12 - HUG, K), // the north gate's alcove
    p(84, -14, K, blocked),
    hc(72.5 - HUG, -12 - HUG, K), // Avnei HaMizbeach's face
    h(72.5 - HUG, -4 - HUG, K), // the east ledge
    h(62.5 + HUG, -4 - HUG, K),
    hc(62.5 + HUG, -12 - HUG, K), // Osei Lechem HaPanim's face
    h(53.5 + HUG, -12 - HUG, K), // the gate's alcove
    h(53.5 + HUG, -16 + HUG, K),
    h(62.5 + HUG, -16 + HUG, K),
    ...chamberLoop(62.5, -20, 1, 3.3, 3), // Lishkas Telaei Korban
    ...chamberLoop(62.5, -8, 1, 3.3, 3), // Lishkas Osei Lechem HaPanim
    h(72.5 - HUG, -8, K),
    ...chamberLoop(72.5, -8, -1, 3.3, 3), // Lishkas Avnei HaMizbeach
    h(72.5 - HUG, -20, K),
    ...chamberLoop(72.5, -20, -1, 3.3, 3), // Beis HaTevilah's descent
    h(66.5, -14, K),
    p(56, -14, K),
    p(40, -14, K),
  ]),
});
