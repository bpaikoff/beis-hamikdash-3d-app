import { AMAH, NICANOR_Z } from '../../src/content/units.js';

const at = (id, o = {}) => ({ id, ...o });
/** A point given in amos in the azarah frame (+x north, -z west), with the expected floor level. */
const p = (x, z, level, o = {}) => ({ x: x * AMAH, z: NICANOR_Z + z * AMAH, level, ...o });
/** Offsets in amos for `at`. */
const amos = (dx, dz) => ({ dx: dx * AMAH, dz: dz * AMAH });

const Y = 'azaras_yisrael';
const D = 'duchan';
const K = 'azaras_kohanim';
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
  // The Ezras Yisrael strip end to end, the Nicanor gateway, the Duchan and its three steps.
  azarah_yisrael: [
    p(-60, -5, Y),
    p(50, -5, Y),
    p(0, -5, Y),
    at('nicanor_gate', { ...amos(0, 3), level: Y }),
    p(0, -5, Y),
    p(0, -11.7, D, { reach: 0.4 }),
    p(0, -16, K),
    p(-60, -16, K),
    p(-60, -5, Y),
    p(-60, -11.7, D, { reach: 0.4 }),
    p(-60, -16, K),
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

  // Slaughtering area (Middot 3:5, 5:2): along the tables, between the tables and the
  // pillars, between the pillars and the north wall, through the gaps, and into a table
  // and a pillar (both must stop the player).
  azarah_slaughter: [
    p(50, -20, K),
    p(50, -52, K),
    p(55, -52, K),
    p(55, -28.5, K, { reach: 0.4 }),
    p(62, -28.5, K),
    p(62, -52, K),
    p(62, -28.5, K, { reach: 0.4 }),
    p(55, -28.5, K, { reach: 0.4 }),
    p(55, -29, K, { reach: 0.4 }),
    p(48, -29, K),
    p(48, -27.5, K, { reach: 0.4 }),
    p(56, -27.5, K, blocked),
    p(48, -29, K, { reach: 0.4 }),
    p(55, -29, K, { reach: 0.4 }),
    p(55, -27, K, { reach: 0.4 }),
    p(61, -27, K, blocked),
    p(55, -45, K),
    at('tamid_lamb', { ...amos(0, 4), level: K }),
    p(50, -20, K),
  ],

  // Lishkas HaGazis (both halves) and on through its chol door into Lishkas HaEtz.
  azarah_gazis: [
    p(-45, -103, K),
    p(-56, -103, K),
    at('lishkas_hagazis', { level: K }),
    p(-70, -96, K),
    p(-70, -110, K),
    p(-72, -110, K),
    p(-80.5, -110, K),
    p(-80.5, -118, K),
    p(-80.5, -128, K),
    p(-80.5, -110, K),
    p(-72, -110, K),
    at('lishkas_hagazis', { level: K }),
    p(-56, -103, K),
    p(-45, -103, K),
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
    p(40, -96, K),
    p(49, -96, K),
    at('lishkas_hamadichin', { level: K }),
    p(59.5, -90.3, K),
    p(64, -90.3, K, { reach: 0.5, minY: 0 }),
    p(64, -104, K, { minY: 11 * AMAH }),
    p(64, -112, K, { minY: 11 * AMAH }),
    p(64, -132, K, { minY: 11 * AMAH }),
    p(64, -112, K, { minY: 11 * AMAH }),
    p(59.5, -112, K, { ...blocked, minY: 11 * AMAH }),
    p(64, -104, K, { minY: 11 * AMAH }),
    p(64, -90.3, K, { reach: 0.5, minY: 0 }),
    p(56, -92, K),
    at('lishkas_hamadichin', { level: K }),
    p(49, -96, K),
    p(49, -112, K),
    at('lishkas_haparvah', { level: K }),
    p(49, -112, K),
    p(49, -128, K),
    at('lishkas_hamelach', { level: K }),
    p(49, -128, K),
    p(40, -128, K),
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
    p(61, -140, K),
    p(45, -140, K),
    p(45, -94, K),
    p(45, -140, K),
    p(61, -140, K),
    p(61, -181, K),
    p(0, -181, K),
    p(-61, -181, K),
    p(-61, -150, K),
  ],
};
